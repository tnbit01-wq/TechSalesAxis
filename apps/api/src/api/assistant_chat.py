"""
assistant_chat.py — Global AI Assistant
────────────────────────────────────────
Features:
  • PostgreSQL-backed session/conversation memory
  • Time-aware, personalised greetings referencing previous activity
  • Role-gated data access (recruiter vs candidate)
  • Rich NLP intent resolution with conversation context
  • Next-step action cards with deep-link redirects
  • Market-demand live data from RDS
  • Resumable sessions via session_id
  • Session history listing + message replay
"""

from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, desc, text

from src.core.dependencies import get_current_user
from src.core.database import SessionLocal
from src.core.models import Job
from src.services.recruiter_service import recruiter_service
from src.services.candidate_service import CandidateService

log = logging.getLogger(__name__)
router = APIRouter(prefix="/ai/assistant", tags=["AI Assistant"])

# ────────────────────────────────────────────────────────────────
# Request / Response Models
# ────────────────────────────────────────────────────────────────

class AssistantChatRequest(BaseModel):
    prompt: str
    session_id: Optional[str] = None
    client_context: Optional[Dict[str, Any]] = None


# ────────────────────────────────────────────────────────────────
# AI Wrappers
# ────────────────────────────────────────────────────────────────

async def _call_ai(prompt: str, system: str = "You are a helpful assistant.") -> str:
    try:
        return await recruiter_service._call_ai(prompt, system)
    except Exception as exc:
        log.error("_call_ai error: %s", exc)
        return ""


async def _call_ai_json(prompt: str, system: str) -> Dict[str, Any]:
    try:
        return await recruiter_service._call_ai_json(prompt, system) or {}
    except Exception as exc:
        log.error("_call_ai_json error: %s", exc)
        return {}


# ────────────────────────────────────────────────────────────────
# Database — Sessions
# ────────────────────────────────────────────────────────────────

_TABLE_ENSURED = False


def _ensure_sessions_table(db) -> None:
    global _TABLE_ENSURED
    if _TABLE_ENSURED:
        return
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS ai_assistant_sessions (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id         UUID NOT NULL,
            session_title   TEXT,
            messages        JSONB NOT NULL DEFAULT '[]',
            last_intent     TEXT,
            last_filters    JSONB DEFAULT '{}',
            last_data_summary TEXT,
            session_context JSONB DEFAULT '{}',
            message_count   INTEGER DEFAULT 0,
            created_at      TIMESTAMPTZ DEFAULT NOW(),
            updated_at      TIMESTAMPTZ DEFAULT NOW()
        )
    """))
    db.execute(text("""
        CREATE INDEX IF NOT EXISTS idx_ai_sessions_user_updated
            ON ai_assistant_sessions (user_id, updated_at DESC)
    """))
    db.commit()
    _TABLE_ENSURED = True


def _get_or_create_session(db, user_id: str, session_id: Optional[str]) -> Dict:
    _ensure_sessions_table(db)

    if session_id:
        row = db.execute(
            text("SELECT * FROM ai_assistant_sessions WHERE id = :sid AND user_id = :uid"),
            {"sid": session_id, "uid": user_id},
        ).fetchone()
        if row:
            return dict(row._mapping)

    # New session
    row = db.execute(
        text("""
            INSERT INTO ai_assistant_sessions (user_id, messages, session_context)
            VALUES (:uid, '[]', '{}')
            RETURNING *
        """),
        {"uid": user_id},
    ).fetchone()
    db.commit()
    return dict(row._mapping)


def _update_session(
    db,
    session_id: str,
    messages: List[Dict],
    intent: str,
    filters: Dict,
    data_summary: str,
    context: Dict,
    title: Optional[str] = None,
) -> None:
    db.execute(
        text("""
            UPDATE ai_assistant_sessions
            SET messages          = :messages,
                last_intent       = :intent,
                last_filters      = :filters,
                last_data_summary = :summary,
                session_context   = :context,
                message_count     = :count,
                session_title     = COALESCE(:title, session_title),
                updated_at        = NOW()
            WHERE id = :sid
        """),
        {
            "messages": json.dumps(messages),
            "intent": intent,
            "filters": json.dumps(filters or {}),
            "summary": data_summary,
            "context": json.dumps(context or {}),
            "count": len(messages),
            "title": title,
            "sid": session_id,
        },
    )
    db.commit()


# ────────────────────────────────────────────────────────────────
# Database — User Context
# ────────────────────────────────────────────────────────────────

def _get_user_context(db, user_id: str, role: str) -> Dict:
    """Rich snapshot of the user's current state for personalisation."""
    try:
        if role == "recruiter":
            row = db.execute(
                text("""
                    SELECT
                        rp.full_name,
                        rp.job_title,
                        c.name                                        AS company_name,
                        (SELECT COUNT(*) FROM jobs
                         WHERE recruiter_id = :uid AND status = 'active')   AS active_jobs,
                        (SELECT COUNT(*) FROM job_applications ja
                         JOIN jobs j ON j.id = ja.job_id
                         WHERE j.recruiter_id = :uid
                           AND ja.status = 'applied')                       AS pending_applications,
                        (SELECT COUNT(*) FROM job_applications ja
                         JOIN jobs j ON j.id = ja.job_id
                         WHERE j.recruiter_id = :uid
                           AND ja.updated_at > NOW() - INTERVAL '24 hours') AS new_today
                    FROM recruiter_profiles rp
                    LEFT JOIN companies c ON c.id = rp.company_id
                    WHERE rp.user_id = :uid
                """),
                {"uid": user_id},
            ).fetchone()
        else:
            row = db.execute(
                text("""
                    SELECT
                        cp.full_name,
                        cp.current_role,
                        cp.job_search_mode,
                        cp.assessment_status,
                        cp.profile_strength,
                        cp.completion_score,
                        (SELECT COUNT(*) FROM job_applications
                         WHERE candidate_id = :uid)                         AS total_applications,
                        (SELECT COUNT(*) FROM saved_jobs
                         WHERE candidate_id = :uid)                         AS saved_jobs_count,
                        (SELECT COUNT(*) FROM job_applications
                         WHERE candidate_id = :uid
                           AND updated_at > NOW() - INTERVAL '7 days')      AS applied_this_week
                    FROM candidate_profiles cp
                    WHERE cp.user_id = :uid
                """),
                {"uid": user_id},
            ).fetchone()

        return dict(row._mapping) if row else {}
    except Exception as exc:
        log.warning("_get_user_context error: %s", exc)
        return {}


# ────────────────────────────────────────────────────────────────
# Market Data
# ────────────────────────────────────────────────────────────────

def _get_live_market_demand(limit: int = 6) -> List[Dict]:
    db = SessionLocal()
    try:
        rows = (
            db.query(Job.title, func.count(Job.id).label("demand_count"))
            .filter(Job.status == "active")
            .group_by(Job.title)
            .order_by(desc("demand_count"))
            .limit(limit)
            .all()
        )
        return [
            {"label": row.title or "Unknown Role", "value": int(row.demand_count or 0)}
            for row in rows
        ]
    finally:
        db.close()


# ────────────────────────────────────────────────────────────────
# Intent Resolution
# ────────────────────────────────────────────────────────────────

async def _resolve_intent(prompt: str, role: str, history: List[Dict]) -> Dict:
    history_snippet = "\n".join(
        f"{m['role'].upper()}: {m['content'][:200]}"
        for m in history[-8:]
    ) or "No prior messages."

    intent_prompt = f"""
You are an intent-classification engine for a hiring platform.

User role : {role}
Conversation (recent):
{history_snippet}

Current query: "{prompt}"

Classify and return ONLY valid JSON — no markdown, no prose:
{{
  "intent": "<one of: candidate_search | job_search | company_search | market_insights | profile_view | resume_view | post_job | application_status | schedule_interview | general | greeting | help>",
  "sub_intent": "<optional short description>",
  "filters": {{
    "skills": [],
    "location": "",
    "experience_band": "",
    "min_salary": null,
    "company_name": "",
    "candidate_name": "",
    "job_title": ""
  }},
  "requires_data": true,
  "is_followup": false,
  "references_previous": false,
  "suggested_redirects": [],
  "next_steps": []
}}

Redirect paths to use (use most relevant 1-3):
  Recruiter:
    /recruiter/candidates          – browse candidates
    /recruiter/candidates/<id>     – specific candidate profile
    /recruiter/jobs/create         – post a new job
    /recruiter/jobs                – manage jobs
    /recruiter/applications        – view all applications
    /recruiter/dashboard           – dashboard overview
  Candidate:
    /candidate/jobs                – browse jobs
    /candidate/jobs/<id>           – specific job detail
    /candidate/applications        – my applications
    /candidate/profile             – my profile
    /candidate/dashboard           – dashboard

next_steps: 2-3 natural-language strings describing what the user might do next.
is_followup: true if this query references something from the history.
references_previous: true if the answer should incorporate prior search results.
"""
    return await _call_ai_json(intent_prompt, "AI Intent Classification Engine — Hiring Platform")


# ────────────────────────────────────────────────────────────────
# Limit Extraction
# ────────────────────────────────────────────────────────────────

async def _extract_limit(prompt: str) -> int:
    result = await _call_ai_json(
        f'Query: "{prompt}"\nReturn ONLY: {{"limit": <integer>}}\nDefault 10 if not specified. Max 20.',
        "Limit Extractor",
    )
    return min(int(result.get("limit", 10)), 20) if result else 10


# ────────────────────────────────────────────────────────────────
# Tool Execution
# ────────────────────────────────────────────────────────────────

async def _execute_tool(intent: str, filters: Dict, user_id: str, role: str) -> Any:
    try:
        if intent == "candidate_search" and role == "recruiter":
            return await recruiter_service.get_recommended_candidates(
                user_id=user_id,
                filter_type="skill_match",
                params={
                    "required_skills": filters.get("skills", []),
                    "location": filters.get("location"),
                    "experience_band": filters.get("experience_band", "all"),
                },
            )

        elif intent == "job_search":
            return await CandidateService.get_recommended_jobs(
                user_id=user_id,
                filter_type="role_match",
                location=filters.get("location"),
                experience_band=filters.get("experience_band"),
                min_salary=filters.get("min_salary"),
            )

        elif intent == "company_search":
            return await CandidateService.get_recommended_companies(
                user_id=user_id,
                filter_type="culture_fit",
            )

        elif intent == "market_insights":
            return _get_live_market_demand(limit=6)

    except Exception as exc:
        log.error("_execute_tool[%s] error: %s", intent, exc)

    return None


# ────────────────────────────────────────────────────────────────
# Greeting Generator
# ────────────────────────────────────────────────────────────────

async def _generate_greeting(user_context: Dict, role: str, prev_summary: Optional[str]) -> str:
    hour = datetime.now().hour
    time_label = "morning" if hour < 12 else "afternoon" if hour < 17 else "evening"
    first_name = (user_context.get("full_name") or "").split()[0] or ""

    prev_ref = f'Previously: "{prev_summary}".' if prev_summary else ""

    # Recruiter-specific stats
    stats = ""
    if role == "recruiter":
        active = user_context.get("active_jobs", 0)
        pending = user_context.get("pending_applications", 0)
        new_today = user_context.get("new_today", 0)
        if active or pending:
            stats = f"You have {active} active job(s) and {pending} pending application(s). {new_today} new today."
    else:
        apps = user_context.get("total_applications", 0)
        saved = user_context.get("saved_jobs_count", 0)
        if apps or saved:
            stats = f"You have applied to {apps} job(s) and saved {saved}."

    prompt = f"""
Write a warm, direct, PROFESSIONAL greeting. 2 sentences MAX. No markdown.

Name: {first_name or "there"}
Role: {role}
Time: Good {time_label}
Stats: {stats}
{prev_ref}

Rules:
- Address by first name if available
- If prev_ref exists, say "Last time you were looking at …, want to continue?"
- Otherwise offer a relevant suggestion based on their stats
- Natural tone, not robotic
- End with a soft open question or offer
"""
    greeting = await _call_ai("".join(prompt.split()), "Warm professional AI greeter")
    return greeting or f"Good {time_label}{', ' + first_name if first_name else ''}! What can I help you with today?"


# ────────────────────────────────────────────────────────────────
# Response Generator
# ────────────────────────────────────────────────────────────────

async def _generate_response(
    prompt: str,
    role: str,
    intent: str,
    filters: Dict,
    data_results: List,
    limit: int,
    history: List[Dict],
    next_steps: List[str],
    user_context: Dict,
) -> str:
    history_text = "\n".join(
        f"{m['role'].upper()}: {m['content'][:150]}"
        for m in history[-6:]
    ) or ""

    results_preview = json.dumps(data_results[:limit], default=str)

    response_prompt = f"""
You are a conversational AI assistant for a hiring platform.

User role   : {role}
Query       : "{prompt}"
Intent      : {intent}
Filters     : {json.dumps(filters)}
Results     : {len(data_results)} items → {results_preview}

Conversation context:
{history_text}

Suggested next steps: {next_steps}

STRICT RULES:
1. If data_results exist → present them naturally (name, role, why they match). No "I found X results."
2. Limit to {limit} items. Reference is_followup context from history if relevant.
3. If NO results → ask exactly ONE focused follow-up question to refine the search.
4. Briefly mention 1-2 next_steps at the end as natural suggestions (not a list).
5. No markdown headers, no bullet points, no emoji. Conversational prose only.
6. Keep response under 220 words.
7. Do not expose internal filters or JSON to the user.
"""
    return await _call_ai(response_prompt, "Precise, conversational AI hiring assistant.")


# ────────────────────────────────────────────────────────────────
# Action Cards Builder
# ────────────────────────────────────────────────────────────────

def _build_action_cards(
    intent: str,
    data_results: List[Dict],
    suggested_redirects: List[str],
    next_steps: List[str],
    role: str,
) -> List[Dict]:
    cards: List[Dict] = []

    first_id = data_results[0].get("id", "") if data_results else ""

    routing: Dict[str, List[Dict]] = {
        "candidate_search": [
            {"label": "View Full Profile", "url": f"/recruiter/candidates/{first_id}", "icon": "user"},
            {"label": "View Resume",        "url": f"/recruiter/candidates/{first_id}/resume", "icon": "file"},
            {"label": "Browse All",         "url": "/recruiter/candidates", "icon": "users"},
        ],
        "job_search": [
            {"label": "View Job Details",   "url": f"/candidate/jobs/{first_id}", "icon": "briefcase"},
            {"label": "Apply Now",          "url": f"/candidate/jobs/{first_id}/apply", "icon": "send"},
            {"label": "Browse All Jobs",    "url": "/candidate/jobs", "icon": "search"},
        ],
        "company_search": [
            {"label": "View Company",       "url": f"/candidate/companies/{first_id}", "icon": "building"},
            {"label": "Browse Companies",   "url": "/candidate/companies", "icon": "building2"},
        ],
        "market_insights": [
            {"label": "Post a Job",         "url": "/recruiter/jobs/create", "icon": "plus"},
            {"label": "View Market Trends", "url": "/recruiter/dashboard", "icon": "chart"},
        ],
        "application_status": [
            {"label": "View Applications",  "url": f"/{'recruiter' if role == 'recruiter' else 'candidate'}/applications", "icon": "clipboard"},
        ],
        "post_job": [
            {"label": "Post a Job Now",     "url": "/recruiter/jobs/create", "icon": "plus"},
        ],
        "profile_view": [
            {"label": "View My Profile",    "url": "/candidate/profile", "icon": "user"},
        ],
    }

    if intent in routing and data_results:
        cards.extend(routing[intent])

    # Add AI-suggested redirects (deduplicated)
    existing_urls = {c["url"] for c in cards}
    for url in suggested_redirects[:2]:
        if url not in existing_urls:
            label = url.rstrip("/").split("/")[-1].replace("-", " ").title()
            cards.append({"label": label, "url": url, "icon": "link"})
            existing_urls.add(url)

    return cards[:4]  # Cap at 4 cards


# ────────────────────────────────────────────────────────────────
# Intent → data_type mapping
# ────────────────────────────────────────────────────────────────

_INTENT_TYPE: Dict[str, str] = {
    "candidate_search": "candidate_list",
    "job_search":       "job_list",
    "company_search":   "company_list",
    "market_insights":  "market_data",
}


# ────────────────────────────────────────────────────────────────
# Main Chat Endpoint
# ────────────────────────────────────────────────────────────────

@router.post("/chat")
async def assistant_chat(
    payload: AssistantChatRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    prompt = (payload.prompt or "").strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="Prompt is required")

    role    = current_user.get("role", "")
    user_id = current_user.get("sub", "")
    if not role or not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")

    db = SessionLocal()
    try:
        # ── 1. Session ──────────────────────────────────────────
        session    = _get_or_create_session(db, user_id, payload.session_id)
        session_id = str(session["id"])
        messages: List[Dict] = session.get("messages") or []
        if isinstance(messages, str):
            messages = json.loads(messages)

        is_new_session = len(messages) == 0
        prev_summary   = session.get("last_data_summary") if not is_new_session else None

        # ── 2. User Context ─────────────────────────────────────
        user_context = _get_user_context(db, user_id, role)

        # ── 3. Intent Resolution ────────────────────────────────
        intent_data        = await _resolve_intent(prompt, role, messages)
        intent             = intent_data.get("intent", "general")
        filters            = intent_data.get("filters", {})
        requires_data      = intent_data.get("requires_data", True)
        suggested_redirects= intent_data.get("suggested_redirects", [])
        next_steps         = intent_data.get("next_steps", [])

        # ── 4. Role-based guard ─────────────────────────────────
        # Candidates cannot trigger recruiter-only intents
        restricted_for_candidate = {"candidate_search", "post_job"}
        if role == "candidate" and intent in restricted_for_candidate:
            intent = "general"
            requires_data = False

        # ── 5. Limit ────────────────────────────────────────────
        limit = await _extract_limit(prompt)

        # ── 6. Tool Execution ───────────────────────────────────
        raw_data = None
        if requires_data and intent not in ("general", "greeting", "help"):
            raw_data = await _execute_tool(intent, filters, user_id, role)

        # Normalise results
        data_results: List[Dict] = []
        if raw_data:
            if isinstance(raw_data, dict):
                data_results = raw_data.get("data") or raw_data.get("results") or []
            elif isinstance(raw_data, list):
                data_results = raw_data
        data_results = data_results[:limit]

        data_type = _INTENT_TYPE.get(intent, "none") if data_results else "none"

        # ── 7. AI Response ──────────────────────────────────────
        final_text = await _generate_response(
            prompt=prompt,
            role=role,
            intent=intent,
            filters=filters,
            data_results=data_results,
            limit=limit,
            history=messages,
            next_steps=next_steps,
            user_context=user_context,
        )

        # ── 8. Greeting prefix for new sessions ─────────────────
        if is_new_session:
            greeting = await _generate_greeting(user_context, role, prev_summary)
            final_text = f"{greeting}\n\n{final_text}"

        # ── 9. Action Cards ─────────────────────────────────────
        action_cards = _build_action_cards(
            intent, data_results, suggested_redirects, next_steps, role
        )

        # ── 10. Persist session ─────────────────────────────────
        data_summary = (
            f"Found {len(data_results)} {intent} results"
            if data_results
            else f"No results for {intent}"
        )

        # Auto-title: use first user message as session title
        session_title = session.get("session_title") or prompt[:60]

        messages.append({"role": "user",      "content": prompt,     "timestamp": datetime.now().isoformat()})
        messages.append({"role": "assistant",  "content": final_text, "timestamp": datetime.now().isoformat()})
        messages = messages[-30:]  # keep rolling window of 30 messages

        _update_session(
            db, session_id, messages, intent, filters,
            data_summary, user_context, session_title
        )

        return {
            "session_id":   session_id,
            "text":         final_text,
            "data_type":    data_type,
            "data_results": data_results,
            "action_cards": action_cards,
            "next_steps":   next_steps,
            "intent":       intent,
            "is_new_session": is_new_session,
        }

    finally:
        db.close()


# ────────────────────────────────────────────────────────────────
# Session History Endpoints
# ────────────────────────────────────────────────────────────────

@router.get("/sessions")
async def list_sessions(current_user: Dict[str, Any] = Depends(get_current_user)):
    user_id = current_user.get("sub")
    db = SessionLocal()
    try:
        _ensure_sessions_table(db)
        rows = db.execute(
            text("""
                SELECT id, session_title, last_intent, last_data_summary,
                       message_count, created_at, updated_at
                FROM ai_assistant_sessions
                WHERE user_id = :uid
                ORDER BY updated_at DESC
                LIMIT 20
            """),
            {"uid": user_id},
        ).fetchall()
        return {
            "sessions": [
                {
                    **dict(r._mapping),
                    "id":         str(r._mapping["id"]),
                    "created_at": r._mapping["created_at"].isoformat() if r._mapping.get("created_at") else None,
                    "updated_at": r._mapping["updated_at"].isoformat() if r._mapping.get("updated_at") else None,
                }
                for r in rows
            ]
        }
    finally:
        db.close()


@router.get("/sessions/{session_id}/messages")
async def get_session_messages(
    session_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    user_id = current_user.get("sub")
    db = SessionLocal()
    try:
        _ensure_sessions_table(db)
        row = db.execute(
            text("""
                SELECT messages, last_intent, session_title
                FROM ai_assistant_sessions
                WHERE id = :sid AND user_id = :uid
            """),
            {"sid": session_id, "uid": user_id},
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Session not found")
        messages = row._mapping["messages"] or []
        if isinstance(messages, str):
            messages = json.loads(messages)
        return {
            "session_id":    session_id,
            "session_title": row._mapping.get("session_title"),
            "last_intent":   row._mapping.get("last_intent"),
            "messages":      messages,
        }
    finally:
        db.close()


@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    user_id = current_user.get("sub")
    db = SessionLocal()
    try:
        _ensure_sessions_table(db)
        db.execute(
            text("DELETE FROM ai_assistant_sessions WHERE id = :sid AND user_id = :uid"),
            {"sid": session_id, "uid": user_id},
        )
        db.commit()
        return {"deleted": True}
    finally:
        db.close()