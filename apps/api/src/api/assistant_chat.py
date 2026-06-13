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
import re
from datetime import datetime
from typing import Any, Dict, List, Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, desc, text

from src.core.dependencies import get_current_user
from src.core.database import SessionLocal
from src.core.models import CandidateProfile, Job, Company, JobApplication, ChatThread, ChatMessage, User, RecruiterProfile, JobView, Interview, ResumeData, ProfileScore
from src.services.recruiter_service import recruiter_service
from src.services.candidate_service import CandidateService
from src.services.notification_service import NotificationService
from src.services.chat_service import ChatService
from src.services.s3_service import S3Service

log = logging.getLogger(__name__)

def infer_experience_band_from_prompt(prompt: str, fallback: str) -> str:
    text = (prompt or "").lower()
    if not text:
        return fallback

    explicit_years = [int(value) for value in re.findall(r"(\d+)\+?\s*(?:years?|yrs?)", text)]
    if explicit_years:
        max_years = max(explicit_years)
        if max_years <= 1:
            return "fresher"
        if max_years <= 4:
            return "mid"
        if max_years <= 9:
            return "senior"
        return "leadership"

    band_keywords = [
        ("leadership", ["leadership", "director", "vp", "vice president", "head of", "principal", "10+ years", "10 years", "12 years"]),
        ("senior", ["senior", "sr.", "sr ", "7 years", "8 years", "9 years", "5 years", "5+ years"]),
        ("mid", ["mid", "intermediate", "experienced", "3 years", "4 years", "2 years", "2+ years"]),
        ("fresher", ["fresher", "entry level", "junior", "intern", "0 years", "1 year", "1+ years"]),
    ]

    for band, keywords in band_keywords:
        if any(keyword in text for keyword in keywords):
            return band

    return fallback

def prompt_contains_job_details(prompt: str, filters: Dict[str, Any]) -> bool:
    if not prompt:
        return False

    clean_p = prompt.lower().strip()
    clean_p = re.sub(r'[^\w\s]', '', clean_p)

    # If the user explicitly stated they want to post/create/publish/hire a role/job/position
    # without providing the actual description yet, it's just a trigger.
    # Let's match typical starter phrases:
    starter_patterns = [
        r"^i want to (post|create|publish|add)( a)?( new)? (job|role|position|vacancy|opening)",
        r"^i would like to (post|create|publish|add)( a)?( new)? (job|role|position|vacancy|opening)",
        r"^(post|create|publish|add)( a)?( new)? (job|role|position|vacancy|opening)",
        r"^hiring( a)?( new)? (job|role|position|vacancy|opening)",
        r"^hiring"
    ]
    if any(re.search(pat, clean_p) for pat in starter_patterns):
        return False

    trigger_phrases = {
        "i would like to post a job", "i want to post a job", "post a job", "create a job", 
        "post job", "create job", "i want to create a job", "i would like to create a job",
        "hiring a new role", "hiring", "post new job", "publish a job", "publish job",
        "i want to post a new role", "post a new role", "i want to publish a role",
        "publish a new role", "post a role", "create a role", "create a new role",
        "post a new position", "create a new position", "post new position", "create new position",
        "post a position", "create a position", "i want to post a position", "i would like to post a new role",
        "i want to post a role", "hiring a role", "post new role", "publish a role", "publish new role"
    }
    
    if clean_p in trigger_phrases:
        return False

    # If the LLM successfully extracted title, description, skills, or requirements from the prompt
    # AND it is not just a basic trigger phrase:
    if filters:
        if (filters.get("job_title") or 
            filters.get("description") or 
            filters.get("skills") or 
            filters.get("requirements")):
            if len(clean_p) > 50:
                return True

    # If the cleaned prompt is too short, it's highly unlikely to contain useful job details
    if len(clean_p) < 40:
        return False
        
    return True

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


async def _expand_search_skills(skills: Any) -> List[str]:
    if not skills:
        return []
    
    if isinstance(skills, str):
        skills_list = [s.strip() for s in skills.split(",") if s.strip()]
    elif isinstance(skills, list):
        skills_list = [str(s).strip() for s in skills if s]
    else:
        skills_list = []

    if not skills_list:
        return []

    prompt = f"""
    You are an expert technical recruiting AI.
    Expand the following list of candidate search skills/technologies into a comprehensive list of related technical synonyms, abbreviations, closely associated frameworks, and industry equivalent names (specifically within Tech Sales and general Software/IT fields).
    
    Input skills: {json.dumps(skills_list)}
    
    For example:
    - "SaaS" -> ["SaaS", "Software as a Service", "Cloud Sales", "Subscription model"]
    - "Negotiation" -> ["Negotiation", "Deal Closing", "Contract Negotiation", "Negotiating"]
    - "CRM" -> ["CRM", "Salesforce", "HubSpot", "Customer Relationship Management"]
    
    Return a JSON object with a single key "skills" containing the list of original skills merged with their expanded synonyms/equivalents.
    Ensure all output strings are clean and concise.
    
    {{
      "skills": ["...", "..."]
    }}
    """
    try:
        res = await _call_ai_json(prompt, "AI Technical Skill Expansion Engine")
        if res and isinstance(res, dict) and "skills" in res:
            expanded = res["skills"]
            if isinstance(expanded, list):
                all_skills = list(set(skills_list + [str(s).strip() for s in expanded if s]))
                return all_skills
    except Exception as e:
        log.error("Failed to expand skills: %s", e)
    
    return skills_list


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
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS recruiter_chat_actions (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id         UUID NOT NULL,
            session_id      UUID,
            action_type     TEXT NOT NULL,
            target_id       TEXT,
            metadata        JSONB DEFAULT '{}',
            created_at      TIMESTAMPTZ DEFAULT NOW()
        )
    """))
    db.execute(text("""
        CREATE INDEX IF NOT EXISTS idx_recruiter_chat_actions_user
            ON recruiter_chat_actions (user_id, created_at DESC)
    """))
    db.commit()
    _TABLE_ENSURED = True


def _log_recruiter_action(db, user_id: str, session_id: Optional[str], action_type: str, target_id: Optional[str] = None, metadata: Optional[Dict] = None) -> None:
    try:
        sid_val = None
        if session_id:
            try:
                import uuid
                sid_val = str(uuid.UUID(session_id))
            except Exception:
                pass
        
        db.execute(
            text("""
                INSERT INTO recruiter_chat_actions (user_id, session_id, action_type, target_id, metadata)
                VALUES (:uid, :sid, :atype, :tid, :meta)
            """),
            {
                "uid": user_id,
                "sid": sid_val,
                "atype": action_type,
                "tid": target_id,
                "meta": json.dumps(metadata or {})
            }
        )
        db.commit()
        log.info("Logged recruiter action: %s", action_type)
    except Exception as e:
        log.error("Failed to log recruiter action: %s", e)


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
                        c.profile_score                               AS company_profile_score,
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

async def _get_live_market_insights(limit: int = 6) -> List[Dict]:
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
        platform_jobs = [
            {"title": row.title or "Unknown Role", "count": int(row.demand_count or 0)}
            for row in rows
        ]
        
        total_candidates = db.query(CandidateProfile).count()
        
        prompt = f"""
        You are an expert IT Tech Sales Market Analyst.
        Provide a JSON object containing real-time 2026 IT Tech Sales industry benchmarks for the top roles on our platform.
        Top roles: {[pj['title'] for pj in platform_jobs]}
        Total platform candidates: {total_candidates}
        
        Generate realistic, detailed market insights including:
        - "average_salary_range": average industry salaries for these roles in 2026
        - "trending_skills": high-demand skills for these roles
        - "hiring_difficulty": rating (Easy, Medium, Hard) and a brief reason
        - "market_trend": a brief overview of the 2026 Tech Sales hiring market (focusing on SaaS, AI integrations, B2B sales)
        
        Return ONLY a JSON object:
        {{
          "benchmarks": [
            {{
              "role": "...",
              "average_salary_range": "...",
              "trending_skills": ["...", "..."],
              "hiring_difficulty": "...",
              "difficulty_reason": "..."
            }}
          ],
          "market_trend_summary": "..."
        }}
        """
        llm_insights = await _call_ai_json(prompt, "IT Tech Sales Market Insights Engine")
        
        results = []
        benchmarks = llm_insights.get("benchmarks", [])
        bench_map = {b.get("role", "").lower(): b for b in benchmarks}
        
        for pj in platform_jobs:
            title_lower = pj["title"].lower()
            matching_bench = bench_map.get(title_lower)
            if not matching_bench:
                for r_name, b_val in bench_map.items():
                    if r_name in title_lower or title_lower in r_name:
                        matching_bench = b_val
                        break
                        
            results.append({
                "label": pj["title"],
                "value": pj["count"],
                "average_salary_range": matching_bench.get("average_salary_range", "Not Available") if matching_bench else "Not Available",
                "trending_skills": matching_bench.get("trending_skills", []) if matching_bench else [],
                "hiring_difficulty": matching_bench.get("hiring_difficulty", "Medium") if matching_bench else "Medium",
                "difficulty_reason": matching_bench.get("difficulty_reason", "") if matching_bench else "",
                "total_candidates_pool": total_candidates
            })
            
        if not results:
            default_roles = ["Sales Manager", "Tech Sales Representative", "Account Executive", "Business Development Representative"]
            for role in default_roles:
                matching_bench = bench_map.get(role.lower())
                results.append({
                    "label": role,
                    "value": 0,
                    "average_salary_range": matching_bench.get("average_salary_range", "$80k - $120k") if matching_bench else "$80k - $120k",
                    "trending_skills": matching_bench.get("trending_skills", ["B2B Sales", "SaaS", "Negotiation"]) if matching_bench else ["B2B Sales", "SaaS", "Negotiation"],
                    "hiring_difficulty": matching_bench.get("hiring_difficulty", "Hard") if matching_bench else "Hard",
                    "difficulty_reason": matching_bench.get("difficulty_reason", "High demand for specialized AI sales professionals") if matching_bench else "High demand for specialized AI sales professionals",
                    "total_candidates_pool": total_candidates
                })
        
        for r in results:
            r["market_trend_summary"] = llm_insights.get("market_trend_summary", "Tech sales remains highly competitive in 2026, driven by AI SaaS expansion.")
            
        return results
    except Exception as e:
        log.error("Failed to generate market insights: %s", e)
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
                {
                    "label": row.title or "Unknown Role", 
                    "value": int(row.demand_count or 0),
                    "average_salary_range": "Not Available",
                    "trending_skills": [],
                    "hiring_difficulty": "Medium",
                    "difficulty_reason": "",
                    "total_candidates_pool": 0,
                    "market_trend_summary": "Standard tech sales roles."
                }
                for row in rows
            ]
        except Exception:
            return []
    finally:
        db.close()


# ────────────────────────────────────────────────────────────────
# Intent Resolution
# ────────────────────────────────────────────────────────────────

async def _resolve_intent(
    prompt: str,
    role: str,
    history: List[Dict],
    active_workflow: Optional[str] = None,
    current_slots: Optional[Dict] = None,
) -> Dict:
    history_snippet = "\n".join(
        f"{m['role'].upper()}: {m['content'][:200]}"
        for m in history[-8:]
    ) or "No prior messages."

    active_workflow_str = f"Active Workflow: {active_workflow}\nCurrent Slots: {json.dumps(current_slots or {})}" if active_workflow else "No active workflow."

    intent_prompt = f"""
You are an intent-classification and slot-extraction engine for a hiring platform.

User role : {role}
Conversation (recent):
{history_snippet}

Workflow State:
{active_workflow_str}

Current query: "{prompt}"

Based on the current query, the workflow state, and conversation history, classify and extract slots.
If there is an active workflow and the user says "yes", "confirm", "publish", "go ahead", "sure", or matches a positive confirmation, classify intent as "confirm_action".
If the user says "no", "cancel", "stop", "abort", or matches a negative confirmation, classify intent as "cancel_action".

If the user wants to update, edit, modify, or change details of an existing job posting they have on the platform (e.g. "edit Sales Manager role", "update location of Account Executive job", "change the description of the Sales Rep vacancy", "modify the requirements for the Senior Manager job"), classify intent as "job_edit" and extract the job title or job ID in filters.

DATABASE STATUS AWARENESS: If the query requests specific candidates, jobs, or applications that do not exist, do not hallucinate fake details. Classify the intent correctly and allow the data pipeline to execute. If the database/tool execution returns no records, the system must clearly report that no such records exist in the database.

CRITICAL: Determine if the user is switching context. If there is an active workflow but the user's query is completely unrelated (e.g. they want to search candidates/jobs, view organizations, ask a general question like "What is Python?", or start a different task), set "is_context_switch" to true. Otherwise, if they are answering slot questions, giving a JD, or confirming/canceling the workflow, set "is_context_switch" to false.

For "career_readiness", extract and map any availability/mobility/relocation preferences to these exact enum tokens:
["immediate", "short_notice", "long_notice", "active_job_seeker", "passive_candidate", "between_roles", "laid_off_recently", "willing_to_relocate", "remote_only", "contract_preferred", "flexible", "salary_seeking_raise", "high_fit_by_compensation", "needs_salary_clarification", "requires_visa_sponsorship"].

For expected/budget salary, populate "min_salary" and "max_salary". For current earnings/salary (e.g. 'earning under 10L', 'current salary 8-12 LPA'), populate "min_current_salary" and "max_current_salary".

For "clear_filters", if the user explicitly requests to clear, ignore, or not consider a criteria (e.g. "do not consider experience", "any location", "any salary", "from any location"), populate "clear_filters" with matching tokens from: ["experience", "location", "salary", "skills", "job_type", "career_readiness"].

For "next_steps", suggest 2 to 3 logical, highly contextual next steps/suggested follow-up actions (as short user query strings, e.g. "Invite Sonam Shukla", "Filter by 10+ years experience", "Find candidates in Indore", "View Sonam Shukla's resume", "Browse all active jobs"). These should reflect a natural conversational flow, helping the user proceed directly with actions or refinements.

Classify and return ONLY valid JSON — no markdown, no prose:
{{
  "intent": "<one of: job_creation | job_application | candidate_invite | application_status_update | view_jobs | view_candidates | candidate_search | job_search | company_search | market_insights | profile_view | resume_view | post_job | application_status | schedule_interview | general | greeting | help | confirm_action | cancel_action | job_status_update | job_delete | job_stats | job_edit>",
  "is_context_switch": <boolean>,
  "sub_intent": "<optional short description>",
  "filters": {{
    "skills": [],
    "location": "",
    "experience_band": "<one of: fresher | mid | senior | leadership | all>",
    "min_experience": null,
    "max_experience": null,
    "min_salary": null,
    "max_salary": null,
    "min_current_salary": null,
    "max_current_salary": null,
    "company_name": "",
    "candidate_name": "",
    "job_title": "",
    "job_id": "",
    "candidate_id": "",
    "status": "<one of: shortlisted | rejected | selected | hired | pending | applied | active | open | paused | closed>",
    "job_type": "<one of: onsite | remote | hybrid>",
    "salary_range": "",
    "match_type": "<one of: culture_fit | skill_match>",
    "career_readiness": [],
    "requirements": [],
    "description": "",
    "message": ""
  }},
  "clear_filters": [],
  "requires_data": true,
  "is_followup": false,
  "references_previous": false,
  "next_steps": []
}}
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


def _infer_time_label(client_context: Optional[Dict[str, Any]] = None) -> str:
    context = client_context or {}

    local_hour = context.get("local_hour")
    if isinstance(local_hour, (int, float)) and 0 <= int(local_hour) <= 23:
        hour = int(local_hour)
    else:
        tz_name = context.get("timezone")
        if isinstance(tz_name, str) and tz_name.strip():
            try:
                hour = datetime.now(ZoneInfo(tz_name.strip())).hour
            except Exception:
                hour = datetime.now().hour
        else:
            hour = datetime.now().hour

    if hour < 12:
        return "morning"
    if hour < 16:
        return "afternoon"
    return "evening"


def _search_candidates_by_name(candidate_name: str, limit: int = 5) -> List[Dict[str, Any]]:
    db = SessionLocal()
    try:
        rows = (
            db.query(CandidateProfile)
            .filter(CandidateProfile.full_name.ilike(f"%{candidate_name}%"))
            .limit(limit)
            .all()
        )
        results = []
        for row in rows:
            resume_data_obj = db.query(ResumeData).filter(ResumeData.user_id == row.user_id).first()
            res_data = None
            if resume_data_obj:
                res_data = {
                    "timeline": resume_data_obj.timeline,
                    "education": resume_data_obj.education,
                    "achievements": resume_data_obj.achievements,
                    "skills": resume_data_obj.skills
                }
            results.append({
                "user_id": str(row.user_id),
                "full_name": row.full_name,
                "current_role": row.current_role,
                "location": row.location,
                "resume_path": S3Service.get_signed_url(row.resume_path) if row.resume_path else None,
                "resume_data": res_data
            })
        return results
    finally:
        db.close()


# ────────────────────────────────────────────────────────────────
# Tool Execution
# ────────────────────────────────────────────────────────────────

async def _execute_tool(intent: str, filters: Dict, user_id: str, role: str, prompt: str = "") -> Any:
    try:
        if intent == "candidate_search" and role == "recruiter":
            if filters.get("skills"):
                orig = filters["skills"]
                if isinstance(orig, list):
                    filters["original_skills"] = list(orig)
                elif isinstance(orig, str):
                    filters["original_skills"] = [s.strip() for s in orig.split(",") if s.strip()]
                else:
                    filters["original_skills"] = []
                filters["skills"] = await _expand_search_skills(filters["skills"])
            
            is_rec = is_recommendation_request(prompt, filters)
            
            # If it's a recommendation request because of job title or job ID,
            # verify that the job actually exists in the database.
            job_exists = False
            job_id = filters.get("job_id")
            job_title = filters.get("job_title")
            if is_rec and (job_id or job_title):
                db_check = SessionLocal()
                try:
                    if job_id:
                        job_exists = db_check.query(Job).filter(Job.id == job_id).first() is not None
                    elif job_title:
                        job_exists = db_check.query(Job).filter(
                            Job.recruiter_id == user_id,
                            Job.title.ilike(f"%%{job_title}%%")
                        ).first() is not None
                except Exception:
                    pass
                finally:
                    db_check.close()
            
            # If recommendation request is specified but the job does NOT exist,
            # or if it is not a recommendation request, do a pure talent pool search/filter!
            if not is_rec or ((job_id or job_title) and not job_exists):
                return await recruiter_service.search_talent_pool(filters)

            # 1. Resolve filter_type - recommendation type is fixed to skills match
            filter_type = "skill_match"
            
            # 2. Resolve job_id
            job_id = filters.get("job_id")
            job_title = filters.get("job_title")
            db = SessionLocal()
            try:
                if not job_id and job_title:
                    job_obj = db.query(Job).filter(
                        Job.recruiter_id == user_id,
                        Job.title.ilike(f"%{job_title}%"),
                        Job.status == "active"
                    ).first()
                    if job_obj:
                        job_id = str(job_obj.id)
                
                # Default to latest active job if no context was specified
                if not job_id:
                    latest_job = db.query(Job).filter(
                        Job.recruiter_id == user_id,
                        Job.status == "active"
                    ).order_by(Job.created_at.desc()).first()
                    if latest_job:
                        job_id = str(latest_job.id)
                    else:
                        any_job = db.query(Job).filter(
                            Job.recruiter_id == user_id
                        ).order_by(Job.created_at.desc()).first()
                        if any_job:
                            job_id = str(any_job.id)
            finally:
                db.close()

            # 3. Resolve skills list
            skills_list = []
            if filters.get("skills"):
                if isinstance(filters["skills"], list):
                    skills_list = filters["skills"]
                elif isinstance(filters["skills"], str):
                    skills_list = [s.strip() for s in filters["skills"].split(",") if s.strip()]

            # 4. Prepare params
            params = {
                "location": filters.get("location"),
                "max_salary": filters.get("max_salary"),
                "min_current_salary": filters.get("min_current_salary"),
                "max_current_salary": filters.get("max_current_salary"),
                "required_skills": skills_list,
                "original_skills": filters.get("original_skills"),
                "career_readiness": ",".join(filters["career_readiness"]) if isinstance(filters.get("career_readiness"), list) else filters.get("career_readiness"),
                "experience_band": filters.get("experience_band", "all"),
                "min_experience": filters.get("min_experience"),
                "max_experience": filters.get("max_experience"),
                "job_type": filters.get("job_type"),
                "job_title": filters.get("job_title"),
            }
            if job_id:
                params["job_id"] = job_id

            return await recruiter_service.get_recommended_candidates(
                user_id=user_id,
                filter_type=filter_type,
                params=params,
            )

        elif intent == "job_search":
            return await CandidateService.get_recommended_jobs(
                user_id=user_id,
                filter_type="skills_focus",
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
            return await _get_live_market_insights(limit=6)

        elif intent in ("profile_view", "resume_view") and role == "recruiter":
            candidate_name = (filters.get("candidate_name") or "").strip()
            if candidate_name:
                return _search_candidates_by_name(candidate_name, limit=5)
            return await recruiter_service.get_recommended_candidates(
                user_id=user_id,
                filter_type="skill_match",
                params={},
            )

    except Exception as exc:
        log.error("_execute_tool[%s] error: %s", intent, exc)

    return None


# ────────────────────────────────────────────────────────────────
# Greeting Generator
# ────────────────────────────────────────────────────────────────

async def _generate_greeting(
    user_context: Dict,
    role: str,
    prev_summary: Optional[str],
    client_context: Optional[Dict[str, Any]] = None,
) -> str:
    time_label = _infer_time_label(client_context)
    first_name = (user_context.get("full_name") or "").split()[0] or ""
    greeting_name = f", {first_name}" if first_name else ""
    return f"Good {time_label}{greeting_name}! How can I assist you today?"


async def _generate_chat_title(prompt: str) -> str:
    title_prompt = f"""
Create a short, concise chat title (maximum 4-5 words, no quotes, no markdown, no punctuation) summarizing this initial user query:
"{prompt}"
"""
    try:
        title = await _call_ai(title_prompt, "You are a helpful assistant that summarizes queries into brief titles.")
        title = title.strip().replace('"', '').replace("'", "").strip()
        if title and len(title) < 50:
            return title
    except Exception:
        pass
    # Fallback
    return prompt[:40] + "..." if len(prompt) > 40 else prompt


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
1. If data_results exist and are being rendered as structured cards (e.g. candidate profiles, candidate lists, resumes, job lists, company lists), DO NOT output their full details (like phone numbers, emails, skills, experience, description, or requirements) in the conversational text. Instead, keep the text response extremely brief (1-2 sentences), introducing the results and directing the user to look at the card(s) rendered below. Do not repeat the information that is already displayed inside the cards. If there is a single candidate profile view, only give a brief intro (e.g. "Here is the profile for Sonam Shukla:") and avoid listing their experience, phone, email, and skills in the text.
2. Limit to {limit} items. Reference is_followup context from history if relevant.
3. If NO results (the results list is empty) → explicitly and clearly state to the user that no matching records were found in the database. Do not invent, assume, or hallucinate any mock or fake records. Ask exactly ONE focused follow-up question to refine the search.
4. Briefly mention 1-2 next_steps at the end as natural suggestions (not a list).
5. No markdown headers, no bullet points, no emoji. Conversational prose only.
6. Keep response under 220 words.
7. Do not expose internal filters or JSON to the user.
8. NEVER print, output, or expose raw S3 URLs, signed S3 URLs, or file paths in the conversation prose. If a resume URL/path is in the results, do not display the string. Suggest that the user click the 'Open Resume' button/card provided below to view the file.
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

    first_item = data_results[0] if data_results else {}
    first_id = (
        first_item.get("id")
        or first_item.get("user_id")
        or first_item.get("candidate_id")
        or first_item.get("job_id")
        or ""
    )

    recruiter_profile_url = (
        f"/dashboard/recruiter/candidate/{first_id}?tab=resume"
        if first_id
        else "/dashboard/recruiter/talent-pool"
    )
    recruiter_resume_url = (
        f"/dashboard/recruiter/candidate/{first_id}?tab=original_resume"
        if first_id
        else "/dashboard/recruiter/talent-pool"
    )

    routing: Dict[str, List[Dict]] = {
        "candidate_search": [
            {"label": "View Full Profile", "url": recruiter_profile_url, "icon": "user"},
            {"label": "View Resume",        "url": recruiter_resume_url, "icon": "file"},
            {"label": "Browse All",         "url": "/dashboard/recruiter/talent-pool", "icon": "users"},
        ],
        "recommendations_locked": [
            {"label": "Complete DNA Assessment", "url": "/onboarding/recruiter", "icon": "plus"},
        ],
        "job_search": [
            {"label": "View Job Details",   "url": f"/dashboard/candidate/jobs/{first_id}" if first_id else "/dashboard/candidate/jobs", "icon": "briefcase"},
            {"label": "Apply Now",          "url": f"/dashboard/candidate/jobs/{first_id}" if first_id else "/dashboard/candidate/jobs", "icon": "send"},
            {"label": "Browse All Jobs",    "url": "/dashboard/candidate/jobs", "icon": "search"},
        ],
        "company_search": [
            {"label": "View Company",       "url": "/dashboard/candidate/jobs", "icon": "building"},
            {"label": "Browse Companies",   "url": "/dashboard/candidate/jobs", "icon": "building2"},
        ],
        "market_insights": [
            {"label": "Post a Job",         "url": "/dashboard/recruiter/hiring/jobs/new", "icon": "plus"},
            {"label": "View Market Trends", "url": "/dashboard/recruiter", "icon": "chart"},
        ],
        "application_status": [
            {"label": "View Applications",  "url": "/dashboard/recruiter/hiring/applications" if role == "recruiter" else "/dashboard/candidate/applications", "icon": "clipboard"},
        ],
        "post_job": [
            {"label": "Post a Job Now",     "url": "/dashboard/recruiter/hiring/jobs/new", "icon": "plus"},
        ],
        "profile_view": [
            {"label": "View Candidate Profile", "url": recruiter_profile_url if role == "recruiter" else "/dashboard/candidate/profile", "icon": "user"},
        ],
        "resume_view": [
            {"label": "Open Resume", "url": recruiter_resume_url if role == "recruiter" else "/dashboard/candidate/profile", "icon": "file"},
        ],
    }

    always_show_intents = {"application_status", "post_job", "profile_view", "resume_view", "market_insights", "recommendations_locked"}
    if intent in routing and (data_results or intent in always_show_intents):
        cards.extend(routing[intent])

    # NOTE: suggested_redirects suppressed — we prefer only deterministic action cards
    # (suggested_redirects often include query strings or noisy links that create
    # transient buttons in the chat UI; removing keeps action cards stable)

    return cards[:4]  # Cap at 4 cards


def _get_dynamic_next_steps(role: str, intent: str, data_results: List[Dict], next_steps: List[str]) -> List[str]:
    if role != "recruiter":
        return next_steps

    dynamic_steps = [
        "Would you like to post a job?",
        "Would you like to view matching candidates?",
        "Would you like to see real-time market insights?",
        "Would you like to view your posted jobs?"
    ]
    
    if intent in ("candidate_search", "view_candidates"):
        dynamic_steps = [
            "Would you like to post a job?",
            "Would you like to see real-time market insights?",
            "Would you like to view matching candidates for your active jobs?",
            "Would you like to search for candidates with other experience levels?"
        ]
    elif intent in ("job_creation", "post_job", "job_edit"):
        dynamic_steps = [
            "Would you like to view matching candidates?",
            "Would you like to see real-time market insights?",
            "Would you like to view your posted jobs?",
            "Would you like to post another job?"
        ]
    elif intent == "market_insights":
        dynamic_steps = [
            "Would you like to post a job?",
            "Would you like to view matching candidates?",
            "Would you like to view your posted jobs?",
            "Would you like to refine search by location?"
        ]

    combined_steps = []
    seen = set()
    for step in (dynamic_steps + next_steps):
        step_clean = step.strip().lower()
        if step_clean not in seen and len(combined_steps) < 4:
            combined_steps.append(step)
            seen.add(step_clean)
    return combined_steps


async def _get_learned_next_steps(db, user_id: str, role: str, intent: str, data_results: List[Dict], next_steps: List[str]) -> List[str]:
    if role != "recruiter":
        return next_steps
    try:
        rows = db.execute(
            text("""
                SELECT action_type 
                FROM recruiter_chat_actions 
                WHERE user_id = :uid 
                ORDER BY created_at DESC 
                LIMIT 20
            """),
            {"uid": user_id}
        ).fetchall()
        actions = [r[0] for r in rows]
    except Exception as e:
        log.error("Failed to query recruiter actions: %s", e)
        actions = []

    intent_to_action = {
        "candidate_search": "searched_candidates",
        "profile_view": "viewed_profile",
        "resume_view": "viewed_resume",
        "view_jobs": "viewed_jobs",
        "job_creation": "created_job",
        "post_job": "created_job",
        "job_edit": "edited_job",
        "application_status": "viewed_applications",
        "application_status_update": "updated_application",
        "market_insights": "viewed_insights"
    }
    
    current_action = intent_to_action.get(intent)
    
    next_action_counts = {}
    if len(actions) >= 2 and current_action:
        for i in range(len(actions) - 1):
            if actions[i+1] == current_action:
                followed_by = actions[i]
                next_action_counts[followed_by] = next_action_counts.get(followed_by, 0) + 1

    predicted_actions = sorted(next_action_counts.keys(), key=lambda k: next_action_counts[k], reverse=True)
    
    action_chips = {
        "viewed_profile": "Would you like to view candidate profiles?",
        "viewed_resume": "Would you like to view candidate resumes?",
        "invited_candidate": "Would you like to invite candidates to your active jobs?",
        "scheduled_interview": "Would you like to schedule an interview?",
        "updated_application": "Would you like to update application statuses?",
        "created_job": "Would you like to post a new job?",
        "edited_job": "Would you like to edit your posted jobs?",
        "viewed_insights": "Would you like to see real-time market insights?",
        "searched_candidates": "Would you like to search for matching candidates?"
    }

    dynamic_steps = []
    for act in predicted_actions:
        chip = action_chips.get(act)
        if chip and chip not in dynamic_steps:
            dynamic_steps.append(chip)
            
    defaults = []
    if intent in ("candidate_search", "view_candidates"):
        defaults = [
            "Would you like to post a job?",
            "Would you like to see real-time market insights?",
            "Would you like to view matching candidates for your active jobs?",
            "Would you like to search for candidates with other experience levels?"
        ]
    elif intent in ("job_creation", "post_job", "job_edit"):
        defaults = [
            "Would you like to view matching candidates?",
            "Would you like to see real-time market insights?",
            "Would you like to view your posted jobs?",
            "Would you like to post another job?"
        ]
    elif intent == "market_insights":
        defaults = [
            "Would you like to post a job?",
            "Would you like to view matching candidates?",
            "Would you like to view your posted jobs?",
            "Would you like to refine search by location?"
        ]
    else:
        defaults = [
            "Would you like to post a job?",
            "Would you like to view matching candidates?",
            "Would you like to see real-time market insights?",
            "Would you like to view your posted jobs?"
        ]

    for d in defaults:
        if d not in dynamic_steps and len(dynamic_steps) < 4:
            dynamic_steps.append(d)

    combined_steps = []
    seen = set()
    for step in (dynamic_steps + next_steps):
        step_clean = step.strip().lower()
        if step_clean not in seen and len(combined_steps) < 4:
            combined_steps.append(step)
            seen.add(step_clean)
            
    return combined_steps


# ────────────────────────────────────────────────────────────────
# Intent → data_type mapping
# ────────────────────────────────────────────────────────────────

_INTENT_TYPE: Dict[str, str] = {
    "candidate_search": "candidate_list",
    "view_candidates":  "candidate_list",
    "job_search":       "job_list",
    "view_jobs":        "job_list",
    "job_stats":        "job_list",
    "company_search":   "company_list",
    "market_insights":  "market_data",
    "profile_view":     "candidate_profile",
    "resume_view":      "resume_info",
    "application_status": "application_cards",
    "application_status_update": "application_cards",
    "schedule_interview": "schedule_interview",
}


def is_recommendation_request(prompt: str, filters: Dict) -> bool:
    p_lower = prompt.lower()
    rec_keywords = ["recommend", "matching", "culture fit", "skill match", "best fit", "suitable candidates", "icp", "dna assessment", "suggest"]
    if any(kw in p_lower for kw in rec_keywords):
        return True
    if filters.get("match_type") in ("culture_fit", "skill_match") and ("fit" in p_lower or "match" in p_lower):
        return True
    if filters.get("job_id"):
        return True
    return False

def merge_search_filters(old_filters: Dict[str, Any], new_filters: Dict[str, Any], clear_filters: List[str]) -> Dict[str, Any]:
    merged = dict(old_filters)
    
    # 1. Apply clear_filters
    for cf in (clear_filters or []):
        if cf == "experience":
            merged.pop("experience_band", None)
            merged.pop("min_experience", None)
            merged.pop("max_experience", None)
        elif cf == "location":
            merged.pop("location", None)
        elif cf == "salary":
            merged.pop("min_salary", None)
            merged.pop("max_salary", None)
            merged.pop("min_current_salary", None)
            merged.pop("max_current_salary", None)
            merged.pop("salary_range", None)
        elif cf == "skills":
            merged.pop("skills", None)
        elif cf == "job_type":
            merged.pop("job_type", None)
        elif cf == "career_readiness":
            merged.pop("career_readiness", None)
            
    # 2. Merge new filters
    for k, v in new_filters.items():
        if k in ("experience_band", "min_experience", "max_experience") and "experience" in (clear_filters or []):
            continue
        if k == "location" and "location" in (clear_filters or []):
            continue
        if k in ("min_salary", "max_salary", "min_current_salary", "max_current_salary", "salary_range") and "salary" in (clear_filters or []):
            continue
        if k == "skills" and "skills" in (clear_filters or []):
            continue
        if k == "job_type" and "job_type" in (clear_filters or []):
            continue
        if k == "career_readiness" and "career_readiness" in (clear_filters or []):
            continue

        if v is not None and v != "" and v != []:
            if k == "skills" and isinstance(v, list) and isinstance(merged.get("skills"), list):
                merged["skills"] = list(set(merged["skills"] + v))
            elif k == "career_readiness" and isinstance(v, list) and isinstance(merged.get("career_readiness"), list):
                merged["career_readiness"] = list(set(merged["career_readiness"] + v))
            else:
                merged[k] = v
                
    return merged


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

    role    = current_user.get("role", "").strip().lower()
    user_id = current_user.get("sub", "")
    if not role or not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")

    db = SessionLocal()
    try:
        # If greeting request and no session_id is provided, return greeting without DB persistence
        if prompt == "__greeting__" and not payload.session_id:
            last_sess = db.execute(
                text("""
                    SELECT last_data_summary 
                    FROM ai_assistant_sessions 
                    WHERE user_id = :uid 
                    ORDER BY updated_at DESC LIMIT 1
                """),
                {"uid": user_id}
            ).fetchone()
            prev_summary = last_sess[0] if last_sess else None
            
            user_context = _get_user_context(db, user_id, role)
            greeting = await _generate_greeting(
                user_context=user_context,
                role=role,
                prev_summary=prev_summary,
                client_context=payload.client_context
            )
            
            next_steps = [
                "Give me candidates from Bengaluru",
                "Show candidates from Indore",
                "Browse all candidates in the pool"
            ] if role == "recruiter" else [
                "Browse active job postings",
                "View my job application status"
            ]
            
            return {
                "session_id":   None,
                "text":         greeting,
                "data_type":    "none",
                "data_results": [],
                "action_cards": [],
                "next_steps":   next_steps,
                "intent":       "greeting",
                "is_new_session": True,
            }

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

        # Load session_context from database session
        session_context = session.get("session_context") or {}
        if isinstance(session_context, str):
            try:
                session_context = json.loads(session_context)
            except Exception:
                session_context = {}

        active_workflow = session_context.get("active_workflow")
        current_slots = session_context.get("slots") or {}

        # ── 3. Intent Resolution ────────────────────────────────
        intent_data        = await _resolve_intent(prompt, role, messages, active_workflow, current_slots)
        intent             = intent_data.get("intent", "general")
        filters            = intent_data.get("filters", {})
        requires_data      = intent_data.get("requires_data", True)
        suggested_redirects= intent_data.get("suggested_redirects", [])
        next_steps         = intent_data.get("next_steps", [])

        # Force requires_data to True for search, view, and statistics intents that need data
        data_fetching_intents = {
            "candidate_search", "job_search", "company_search", "market_insights",
            "profile_view", "resume_view", "application_status", "view_candidates",
            "view_jobs", "job_stats"
        }
        if intent in data_fetching_intents:
            requires_data = True

        # Normalize view_candidates to candidate_search if filters are present
        if role == "recruiter" and intent == "view_candidates":
            has_search_criteria = any(
                filters.get(k) for k in ("skills", "location", "experience_band", "min_experience", "max_experience", "min_salary", "max_salary", "min_current_salary", "max_current_salary", "job_title", "career_readiness")
            )
            if has_search_criteria:
                intent = "candidate_search"

        # Override intent to candidate_search if recruiter is searching for candidates/talent
        # or refining a previous candidate search
        prev_is_candidate_search = False
        if messages:
            for m in reversed(messages):
                if m.get("role") == "assistant":
                    if m.get("intent") in ("candidate_search", "view_candidates") or m.get("data_type") == "candidate_list":
                        prev_is_candidate_search = True
                    break

        if role == "recruiter":
            prompt_lower = prompt.lower().strip()
            refine_keywords = ["among", "whose", "with", "having", "filter", "restrict", "only", "also", "and", "who ", "immediate joiner", "years of experience", "experience of", "in ", "from ", "salary", "lpa", "experience", "skill", "knows"]
            
            is_refinement = False
            if prev_is_candidate_search:
                if any(prompt_lower.startswith(kw) or kw in prompt_lower for kw in refine_keywords):
                    is_refinement = True
                elif any(intent_data.get("filters", {}).get(k) for k in ("skills", "location", "experience_band", "min_experience", "max_experience", "min_salary", "max_salary", "min_current_salary", "max_current_salary", "career_readiness", "job_type")):
                    is_refinement = True

            if intent in ("view_jobs", "job_search", "general", "greeting", "view_candidates", "help") or is_refinement:
                if "candidate" in prompt_lower or "talent" in prompt_lower or "people" in prompt_lower or "resume" in prompt_lower or is_refinement:
                    intent = "candidate_search"

        # Sticky candidate search filters merge
        if role == "recruiter" and intent == "candidate_search":
            search_filters = session_context.get("search_filters", {})
            
            is_followup = intent_data.get("is_followup", False) or intent_data.get("references_previous", False)
            prompt_lower = prompt.lower().strip()
            refine_keywords = ["among", "whose", "with", "having", "filter", "restrict", "only", "also", "and", "who ", "immediate joiner", "years of experience", "experience of"]
            if not is_followup:
                if any(prompt_lower.startswith(kw) or kw in prompt_lower for kw in refine_keywords):
                    is_followup = True
            
            clear_filters = intent_data.get("clear_filters", [])
            # Support text-based overrides for clearing
            if "any location" in prompt_lower or "from any location" in prompt_lower:
                if "location" not in clear_filters:
                    clear_filters.append("location")
            if "do not consider any experience" in prompt_lower or "do not consider experience" in prompt_lower or "no experience" in prompt_lower or "any experience" in prompt_lower or "from any location, do not consider experience" in prompt_lower:
                if "experience" not in clear_filters:
                    clear_filters.append("experience")

            if is_followup:
                search_filters = merge_search_filters(search_filters, filters, clear_filters)
            else:
                search_filters = merge_search_filters({}, filters, clear_filters)
            
            session_context["search_filters"] = search_filters
            filters = search_filters

        # ── 4. Role-based guard ─────────────────────────────────
        # Candidates cannot trigger recruiter-only intents
        restricted_for_candidate = {
            "candidate_search", "post_job", "job_creation", 
            "candidate_invite", "application_status_update", "view_candidates",
            "job_status_update", "job_delete", "job_stats", "job_edit"
        }
        if role == "candidate" and intent in restricted_for_candidate:
            intent = "general"
            requires_data = False

        # Recruiters cannot trigger candidate-only intents
        restricted_for_recruiter = {"job_application", "job_search"}
        if role == "recruiter" and intent in restricted_for_recruiter:
            if intent == "job_application":
                intent = "application_status"
            elif intent == "job_search":
                intent = "view_jobs"

        # ── 5. Workflow State Machine Core ──────────────────────
        workflow_text = None
        data_type = "none"
        data_results = []
        action_cards = []

        # Company Onboarding Lock Gate for Recruiter Recommendations
        if role == "recruiter" and intent == "candidate_search":
            if is_recommendation_request(prompt, intent_data.get("filters", {})):
                comp_score = user_context.get("company_profile_score")
                if comp_score is None or comp_score == 0:
                    workflow_text = "Assessment Locked: Your company recommendations are locked. To unlock recommended candidates, please complete your TechSales Axis DNA Assessment first."
                    data_type = "recommendations_locked"
                    data_results = []
                    requires_data = False

        # Switch to a new workflow if a workflow-triggering intent is detected
        workflow_intents = {"job_creation", "post_job", "job_application", "candidate_invite", "application_status_update", "job_delete", "job_edit"}
        
        is_context_switch = intent_data.get("is_context_switch", False)
        
        # Safety fallback: if intent is a clear non-workflow search/help/status intent, force context switch
        clear_switch_intents = {
            "candidate_search", "job_search", "company_search", 
            "market_insights", "view_candidates", "view_jobs", 
            "greeting", "help", "application_status", "job_status_update", "job_stats"
        }
        if intent in clear_switch_intents:
            is_context_switch = True
            
        # If the user is switching context or starting a DIFFERENT workflow, clear the current active workflow
        if active_workflow and (is_context_switch or intent in (workflow_intents - {active_workflow})):
            active_workflow = None
            current_slots = {}
            session_context["active_workflow"] = None
            session_context["slots"] = {}

        # Clear search filters on context switch to non-search intents
        if is_context_switch and intent != "candidate_search":
            session_context.pop("search_filters", None)

        if intent in workflow_intents:
            new_wf = "job_creation" if intent in ("job_creation", "post_job") else intent
            if active_workflow != new_wf:
                active_workflow = new_wf
                current_slots = {}
                session_context["active_workflow"] = active_workflow
                session_context["slots"] = current_slots

        # Ensure active workflow is safe from role mismatch (run AFTER setting/updating it)
        if role == "recruiter" and active_workflow in ("job_application", "job_search"):
            active_workflow = None
            current_slots = {}
            session_context["active_workflow"] = None
            session_context["slots"] = {}
        if role == "candidate" and active_workflow in ("job_creation", "candidate_invite", "application_status_update", "job_delete"):
            active_workflow = None
            current_slots = {}
            session_context["active_workflow"] = None
            session_context["slots"] = {}

        # Process active workflows
        if active_workflow == "job_creation":
            is_cancel = intent == "cancel_action" or prompt.lower() in ("cancel", "cancel job", "stop", "abort", "no")
            is_confirm = (
                intent == "confirm_action" 
                or prompt.lower() in ("confirm", "publish", "publish job", "yes", "yes, publish", "yes, publish it")
                or prompt.startswith("confirm publish_job_draft ")
            )

            if is_cancel:
                workflow_text = "Job creation workflow has been canceled."
                active_workflow = None
                current_slots = {}
            elif is_confirm:
                # Intercept edited draft payload
                if prompt.startswith("confirm publish_job_draft "):
                    try:
                        payload_str = prompt[len("confirm publish_job_draft "):].strip()
                        updated_slots = json.loads(payload_str)
                        current_slots.update(updated_slots)
                    except Exception as e:
                        log.error("Failed to parse edited draft JSON: %s", e)

                if current_slots.get("title") and current_slots.get("description"):
                    res = await recruiter_service.create_job(user_id, current_slots)
                    _log_recruiter_action(db, user_id, session_id, "created_job", target_id=res.get("id") if isinstance(res, dict) else None, metadata={"job_title": current_slots.get('title')})
                    workflow_text = f"Awesome! The job '{current_slots.get('title')}' has been successfully published to the platform."
                    
                    # Fetch recruiter's jobs to show
                    job_list = []
                    try:
                        profile = db.query(RecruiterProfile).filter(RecruiterProfile.user_id == user_id).first()
                        if profile:
                            jobs = db.query(Job).filter(Job.recruiter_id == user_id).order_by(Job.created_at.desc()).limit(5).all()
                            job_list = [{
                                "id": str(j.id),
                                "title": j.title,
                                "company_name": user_context.get("company_name", "Your Company"),
                                "location": j.location,
                                "salary_range": j.salary_range,
                                "experience_band": j.experience_band,
                                "job_type": j.job_type,
                                "status": j.status
                            } for j in jobs]
                    except Exception as e:
                        log.error("Error fetching jobs: %s", e)
                    
                    data_type = "job_list"
                    data_results = job_list
                    active_workflow = None
                    current_slots = {}
                else:
                    workflow_text = "I don't have a job draft to publish yet. Please share the job details or description."
            else:
                # If they provided non-empty details
                if len(prompt.strip()) > 3 and prompt_contains_job_details(prompt, filters):
                    parser_prompt = f"""
                    Analyze the user prompt or job description and generate/extract structured job details.
                    USER PROMPT: "{prompt}"
                    
                    CRITICAL INSTRUCTIONS:
                    1. Extract the official title, location, experience band, job type, and salary range if mentioned.
                    2. If location is not specified, default to "Remote".
                    3. If job_type is not specified, default to "onsite".
                    4. Calculate a "salary_range" based on the extracted role, location, and experience band using CURRENT 2026 tech sales industry standards if not explicitly specified.
                    5. Provide the extracted location in the "location" field.
                    6. Generate/extract a clean professional description of the job (2-3 paragraphs about company and role). If a detailed description is not provided, generate a compelling one.
                    7. Extract/generate 5-7 key requirements (as bullet points) in the "requirements" array.
                    8. Extract/generate top 5 technical/soft skills in the "skills_required" array.

                    Structure the response as a valid JSON object:
                    {{
                      "title": "<extracted title>",
                      "location": "<extracted location or Remote>",
                      "experience_band": "<fresher | mid | senior | leadership>",
                      "job_type": "<onsite | remote | hybrid>",
                      "salary_range": "<extracted/calculated salary range or standard e.g. $80k - $120k>",
                      "skills_required": ["skill1", "skill2"],
                      "requirements": ["req1", "req2"],
                      "description": "<clean professional description>"
                    }}
                    """
                    extracted = await _call_ai_json(parser_prompt, "You are an elite Tech Sales Recruiter AI specialized in market-accurate job generation.")
                    
                    # Infer experience band using the robust helper function
                    inferred_exp = infer_experience_band_from_prompt(prompt, extracted.get("experience_band", "mid"))
                    extracted["experience_band"] = inferred_exp
                    
                    # Merge extracted slots into current_slots
                    for k in ["title", "location", "experience_band", "job_type", "salary_range", "skills_required", "requirements", "description"]:
                        if extracted.get(k):
                            current_slots[k] = extracted[k]

                # Check if we have the minimum required slots to show a draft
                if current_slots.get("title") and current_slots.get("description"):
                    workflow_text = "Here is a draft of the job posting. Review the details below and confirm if you want to publish it."
                    data_type = "job_draft"
                    data_results = [current_slots]
                else:
                    workflow_text = "Sure, I can help you post a job. Please share the job description or details (such as title, location, salary, experience, and requirements) at once, and I will create a draft for you."

        elif active_workflow == "job_edit":
            is_cancel = intent == "cancel_action" or prompt.lower() in ("cancel", "cancel edit", "stop", "abort", "no")
            is_confirm = (
                intent == "confirm_action" 
                or prompt.lower() in ("confirm", "save", "save changes", "yes", "yes, save", "confirm changes")
                or prompt.startswith("confirm publish_job_draft ")
            )

            if is_cancel:
                workflow_text = "Job editing workflow has been canceled."
                active_workflow = None
                current_slots = {}
            elif is_confirm:
                # Intercept edited draft payload from the inline card's publish action
                if prompt.startswith("confirm publish_job_draft "):
                    try:
                        payload_str = prompt[len("confirm publish_job_draft "):].strip()
                        updated_slots = json.loads(payload_str)
                        current_slots.update(updated_slots)
                    except Exception as e:
                        log.error("Failed to parse edited draft JSON: %s", e)

                job_id = current_slots.get("job_id")
                if job_id:
                    # Update job in database!
                    try:
                        profile = db.query(RecruiterProfile).filter(RecruiterProfile.user_id == user_id).first()
                        job = db.query(Job).filter(Job.id == job_id).first()
                        if profile and job and job.company_id == profile.company_id:
                            # Update fields
                            for k in ["title", "description", "requirements", "skills_required", "experience_band", "job_type", "location", "salary_range"]:
                                if k in current_slots:
                                    setattr(job, k, current_slots[k])
                            db.commit()
                            _log_recruiter_action(db, user_id, session_id, "edited_job", target_id=str(job.id), metadata={"job_title": job.title})
                            workflow_text = f"Awesome! The job '{job.title}' has been successfully updated."
                        else:
                            workflow_text = "Sorry, I couldn't find the job to update, or you don't have permission to edit it."
                    except Exception as e:
                        log.error("Failed to update job: %s", e)
                        workflow_text = f"An error occurred while updating the job: {str(e)}"
                else:
                    workflow_text = "I couldn't identify which job to update."

                # Reset workflow state
                active_workflow = None
                current_slots = {}
                data_type = "none"
                data_results = []
            else:
                # If they provided edit details in conversational way (e.g. "change location to London")
                # and we already have a job loaded:
                job_id = current_slots.get("job_id")

                # If we don't have a job ID yet, let's find the job to edit!
                if not job_id:
                    # Look for job title in filters or prompt
                    search_title = filters.get("job_title") or current_slots.get("job_title") or prompt
                    # If search_title is just a generic word, clean it
                    try:
                        profile = db.query(RecruiterProfile).filter(RecruiterProfile.user_id == user_id).first()
                        if profile:
                            # Try to match the title
                            if search_title and search_title.lower() not in ("edit", "edit job", "update", "update job", "change"):
                                # Clean search_title to remove starting "edit job ", "edit ", "update job ", "update "
                                clean_title = search_title
                                for prefix in ["edit job ", "edit ", "update job ", "update ", "change job ", "change details of "]:
                                    if clean_title.lower().startswith(prefix):
                                        clean_title = clean_title[len(prefix):].strip()
                                
                                matched_jobs = db.query(Job).filter(
                                    Job.company_id == profile.company_id,
                                    Job.title.ilike(f"%{clean_title}%")
                                ).all()
                            else:
                                matched_jobs = db.query(Job).filter(Job.company_id == profile.company_id).all()

                            if len(matched_jobs) == 1:
                                j = matched_jobs[0]
                                current_slots = {
                                    "job_id": str(j.id),
                                    "title": j.title,
                                    "location": j.location,
                                    "experience_band": j.experience_band,
                                    "job_type": j.job_type,
                                    "salary_range": j.salary_range,
                                    "skills_required": j.skills_required or [],
                                    "requirements": j.requirements or [],
                                    "description": j.description
                                }
                                workflow_text = f"Found job: **{j.title}**. Here are its current details. What changes would you like to make? You can tell me what to update conversationally or edit them in the card below."
                                data_type = "job_draft"
                                data_results = [current_slots]
                            elif len(matched_jobs) > 1:
                                workflow_text = "I found multiple jobs. Which one would you like to edit?\n" + "\n".join(f"- **{j.title}**" for j in matched_jobs)
                                data_type = "job_list"
                                data_results = [{
                                    "id": str(j.id),
                                    "title": j.title,
                                    "location": j.location,
                                    "salary_range": j.salary_range,
                                    "experience_band": j.experience_band,
                                    "job_type": j.job_type,
                                    "status": j.status
                                } for j in matched_jobs]
                            else:
                                workflow_text = "I couldn't find any jobs matching your request. Which job would you like to edit? Please specify the title."
                        else:
                            workflow_text = "I couldn't find your recruiter profile to retrieve jobs."
                    except Exception as e:
                        log.error("Error finding job to edit: %s", e)
                        workflow_text = f"An error occurred: {str(e)}"
                else:
                    # We already have a job loaded, and the user typed conversational changes (e.g. "change location to Bengaluru")
                    # Let's call the AI to extract updates and merge them!
                    parser_prompt = f"""
                    You are editing an existing job posting.
                    CURRENT JOB DETAILS:
                    {json.dumps(current_slots, indent=2)}

                    USER EDIT REQUEST: "{prompt}"

                    Extract the changes from the USER EDIT REQUEST and merge them with the CURRENT JOB DETAILS.
                    - If the user specifies a new value for title, location, salary range, experience band, or job type, update that field.
                    - If they want to add a requirement, append it to the requirements list.
                    - If they want to remove a requirement, remove it.
                    - If they want to add a skill, append it to skills_required.
                    - If they want to remove a skill, remove it from skills_required.
                    - If they want to update the description, update it.
                    - Otherwise, retain the current value.

                    Return ONLY a valid JSON object matching the CURRENT JOB DETAILS structure:
                    {{
                      "job_id": "{job_id}",
                      "title": "<updated or current title>",
                      "location": "<updated or current location>",
                      "experience_band": "<updated or current experience band: fresher | mid | senior | leadership>",
                      "job_type": "<updated or current job type: onsite | remote | hybrid>",
                      "salary_range": "<updated or current salary range>",
                      "skills_required": [...],
                      "requirements": [...],
                      "description": "<updated or current description>"
                    }}
                    """
                    try:
                        updated = await _call_ai_json(parser_prompt, "You are a job editor assistant.")
                        # Retain the job_id
                        updated["job_id"] = job_id
                        current_slots.update(updated)
                        workflow_text = "I've updated the details. Review the changes below and say 'save' to confirm, or continue making edits."
                        data_type = "job_draft"
                        data_results = [current_slots]
                    except Exception as e:
                        log.error("Failed to parse edit JSON: %s", e)
                        workflow_text = "Sorry, I couldn't parse the changes. Please try stating the updates clearly (e.g., 'Change location to remote')."
                        data_type = "job_draft"
                        data_results = [current_slots]

        elif active_workflow == "job_application":
            job_id = current_slots.get("job_id") or filters.get("job_id")
            job_title = current_slots.get("job_title") or filters.get("job_title")

            if not job_id and job_title:
                job_obj = db.query(Job, Company).join(Company, Job.company_id == Company.id).filter(Job.title.ilike(f"%{job_title}%"), Job.status == "active").first()
                if job_obj:
                    job_id = str(job_obj[0].id)
                    current_slots["job_id"] = job_id
                    current_slots["job_title"] = job_obj[0].title
                    current_slots["company_name"] = job_obj[1].name

            is_cancel = intent == "cancel_action" or prompt.lower() in ("cancel", "no", "cancel application")
            is_confirm = intent == "confirm_action" or prompt.lower() in ("confirm", "apply", "yes", "confirm application")

            if is_cancel:
                workflow_text = "Job application canceled."
                active_workflow = None
                current_slots = {}
            elif not job_id:
                workflow_text = "Which job role would you like to apply for?"
            else:
                if is_confirm:
                    res = await CandidateService.apply_to_job(user_id, job_id)
                    status = res.get("status")
                    if status == "success":
                        workflow_text = f"Your application for '{current_slots.get('job_title')}' has been successfully transmitted to the recruiter."
                    elif status == "limit_reached":
                        workflow_text = "Daily transmission limit reached (5/5). Your signal buffer will reset tomorrow."
                    elif status == "already_applied":
                        workflow_text = f"You have already applied to the '{current_slots.get('job_title')}' position."
                    else:
                        workflow_text = "Failed to submit application. Please try again."
                    active_workflow = None
                    current_slots = {}
                else:
                    workflow_text = f"Would you like to transmit your profile and apply for the '{current_slots.get('job_title')}' role at {current_slots.get('company_name')}?"
                    data_type = "application_confirm"
                    job_obj = db.query(Job, Company).join(Company, Job.company_id == Company.id).filter(Job.id == job_id).first()
                    if job_obj:
                        data_results = [{
                            "id": str(job_obj[0].id),
                            "title": job_obj[0].title,
                            "company_name": job_obj[1].name,
                            "location": job_obj[0].location,
                            "salary_range": job_obj[0].salary_range,
                            "experience_band": job_obj[0].experience_band,
                            "job_type": job_obj[0].job_type
                        }]

        elif active_workflow == "candidate_invite":
            candidate_id = current_slots.get("candidate_id") or filters.get("candidate_id")
            candidate_name = current_slots.get("candidate_name") or filters.get("candidate_name")
            job_id = current_slots.get("job_id") or filters.get("job_id")
            job_title = current_slots.get("job_title") or filters.get("job_title")
            message_text = current_slots.get("message") or filters.get("message")

            if not candidate_id and candidate_name:
                candidates = _search_candidates_by_name(candidate_name, limit=1)
                if candidates:
                    candidate_id = candidates[0]["user_id"]
                    current_slots["candidate_id"] = candidate_id
                    current_slots["candidate_name"] = candidates[0]["full_name"]

            # Cooldown guard: Check if recruiter has an inactive thread with candidate within last 30 days
            if candidate_id:
                from datetime import timedelta
                cutoff = datetime.utcnow() - timedelta(days=30)
                blocked_thread = db.query(ChatThread).filter(
                    ChatThread.recruiter_id == user_id,
                    ChatThread.candidate_id == candidate_id,
                    ChatThread.is_active == False,
                    ChatThread.last_message_at >= cutoff
                ).first()
                if blocked_thread:
                    workflow_text = f"Invitation blocked: You cannot invite {current_slots.get('candidate_name') or 'this candidate'} because they declined your invitation within the last 30 days."
                    active_workflow = None
                    current_slots = {}
            
            if active_workflow == "candidate_invite":
                if not job_id and job_title:
                    job_obj = db.query(Job).filter(Job.recruiter_id == user_id, Job.title.ilike(f"%{job_title}%"), Job.status == "active").first()
                    if job_obj:
                        job_id = str(job_obj.id)
                        current_slots["job_id"] = job_id
                        current_slots["job_title"] = job_obj.title

                is_cancel = intent == "cancel_action" or prompt.lower() in ("cancel", "no", "cancel invite")
                is_confirm = intent == "confirm_action" or prompt.lower() in ("confirm", "invite", "yes", "yes, send invite", "send invite", "send")

                if is_cancel:
                    workflow_text = "Candidate invite canceled."
                    active_workflow = None
                    current_slots = {}
                elif not candidate_id:
                    workflow_text = "Which candidate would you like to invite?"
                else:
                    # If not confirm/cancel and prompt has actual text, treat as custom message update
                    if not is_confirm and len(prompt.strip()) > 3 and not prompt.lower().startswith("invite") and not prompt.lower().startswith("show profile"):
                        message_text = prompt
                        current_slots["message"] = message_text

                    if is_confirm:
                        target_name = current_slots.get("candidate_name")
                        invite_msg = message_text or f"Hi {target_name}, we're interested in connecting with you about exciting opportunities!"
                        
                        # Fetch or create thread
                        thread_data = ChatService.get_or_create_thread(db, user_id, candidate_id)
                        thread_id = thread_data["id"]

                        new_msg = ChatMessage(
                            thread_id=thread_id,
                            sender_id=user_id,
                            text=f"[Job Invite] {invite_msg}"
                        )
                        db.add(new_msg)
                        
                        thread = db.query(ChatThread).filter(ChatThread.id == thread_id).first()
                        if thread:
                            thread.last_message_at = datetime.utcnow()
                            thread.is_active = True # Ensure thread is active upon invite
                        
                        # Create notification
                        NotificationService.create_notification(
                            candidate_id,
                            "job_invite",
                            "New recruiter interest",
                            invite_msg,
                            {"job_id": job_id or "", "recruiter_id": user_id},
                            db,
                        )
                        db.commit()
                        _log_recruiter_action(db, user_id, session_id, "invited_candidate", target_id=candidate_id, metadata={"job_id": job_id, "message": invite_msg})

                        workflow_text = f"Invite sent successfully to {target_name}!"
                        active_workflow = None
                        current_slots = {}
                    else:
                        target_name = current_slots.get("candidate_name")
                        preview_msg = message_text or f"Hi {target_name}, we're interested in connecting with you about exciting opportunities!"
                        workflow_text = f"Here is a preview of the invitation message for {target_name}:\n\n" \
                                        f"\"{preview_msg}\"\n\n" \
                                        f"Reply with a custom message to change it, or reply 'confirm' to send the invitation."

        elif active_workflow == "application_status_update":
            candidate_id = current_slots.get("candidate_id") or filters.get("candidate_id")
            candidate_name = current_slots.get("candidate_name") or filters.get("candidate_name")
            job_id = current_slots.get("job_id") or filters.get("job_id")
            job_title = current_slots.get("job_title") or filters.get("job_title")
            status = current_slots.get("status") or filters.get("status")
            application_id = current_slots.get("application_id")

            if not application_id:
                query = db.query(JobApplication).join(Job, JobApplication.job_id == Job.id).filter(Job.recruiter_id == user_id)
                if candidate_id:
                    query = query.filter(JobApplication.candidate_id == candidate_id)
                elif candidate_name:
                    cand_profile = db.query(CandidateProfile).filter(CandidateProfile.full_name.ilike(f"%{candidate_name}%")).first()
                    if cand_profile:
                        candidate_id = str(cand_profile.user_id)
                        current_slots["candidate_id"] = candidate_id
                        current_slots["candidate_name"] = cand_profile.full_name
                        query = query.filter(JobApplication.candidate_id == candidate_id)
                
                if job_id:
                    query = query.filter(JobApplication.job_id == job_id)
                elif job_title:
                    job_obj = db.query(Job).filter(Job.recruiter_id == user_id, Job.title.ilike(f"%{job_title}%")).first()
                    if job_obj:
                        job_id = str(job_obj.id)
                        current_slots["job_id"] = job_id
                        current_slots["job_title"] = job_obj.title
                        query = query.filter(JobApplication.job_id == job_id)
                    
                    app_obj = query.first()
                    if app_obj:
                        application_id = str(app_obj.id)
                        current_slots["application_id"] = application_id
                        if not candidate_name:
                            cand_profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == app_obj.candidate_id).first()
                            if cand_profile:
                                current_slots["candidate_name"] = cand_profile.full_name
                        if not job_title:
                            job_obj = db.query(Job).filter(Job.id == app_obj.job_id).first()
                            if job_obj:
                                current_slots["job_title"] = job_obj.title

            is_cancel = intent == "cancel_action" or prompt.lower() in ("cancel", "no", "cancel status update")
            is_confirm = intent == "confirm_action" or prompt.lower() in ("confirm", "yes", "update status")

            if is_cancel:
                workflow_text = "Application status update canceled."
                active_workflow = None
                current_slots = {}
            elif not application_id:
                workflow_text = "Which candidate application would you like to update?"
            elif not status:
                workflow_text = f"What status would you like to set for {current_slots.get('candidate_name')}? (shortlisted, selected, or rejected)"
            else:
                if is_confirm:
                    app = db.query(JobApplication).filter(JobApplication.id == application_id).first()
                    if app:
                        old_status = app.status
                        app.status = status
                        
                        if status == "shortlisted" and old_status != "shortlisted":
                            chat = db.query(ChatThread).filter(
                                ChatThread.candidate_id == app.candidate_id,
                                ChatThread.recruiter_id == user_id
                            ).first()
                            if chat:
                                chat.is_active = True
                            else:
                                new_chat = ChatThread(
                                    candidate_id=app.candidate_id,
                                    recruiter_id=user_id,
                                    is_active=True
                                )
                                db.add(new_chat)
                            
                            NotificationService.create_notification(
                                user_id=app.candidate_id,
                                type="APPLICATION_SHORTLISTED",
                                title="Congratulations! You've been shortlisted",
                                message=f"You have been shortlisted for the {current_slots.get('job_title')} position. The recruiter can now message you directly.",
                                metadata={"application_id": str(app.id), "job_id": str(app.job_id), "job_title": current_slots.get("job_title")},
                                db=db
                            )
                        db.commit()
                        _log_recruiter_action(db, user_id, session_id, "updated_application", target_id=application_id, metadata={"candidate_id": candidate_id, "job_id": job_id, "status": status})

                        # Fetch updated applications for this job (or all)
                        query = db.query(JobApplication, Job, CandidateProfile, ProfileScore, User).join(
                            Job, JobApplication.job_id == Job.id
                        ).join(
                            CandidateProfile, JobApplication.candidate_id == CandidateProfile.user_id
                        ).join(
                            User, JobApplication.candidate_id == User.id
                        ).outerjoin(
                            ProfileScore, JobApplication.candidate_id == ProfileScore.user_id
                        ).filter(
                            Job.recruiter_id == user_id
                        )
                        
                        target_job_id = current_slots.get("job_id")
                        if target_job_id:
                            query = query.filter(Job.id == target_job_id)
                            
                        apps = query.order_by(JobApplication.created_at.desc()).all()
                        data_results = []
                        for ap in apps:
                            # Fetch scheduled/pending interviews
                            interviews = db.query(Interview).filter(Interview.application_id == ap[0].id).all()
                            int_list = [{
                                "id": str(i.id),
                                "round_name": i.round_name,
                                "round_number": i.round_number,
                                "format": i.format,
                                "location": i.location,
                                "meeting_link": i.meeting_link,
                                "status": i.status
                            } for i in interviews]
                            
                            # Fetch resume data if available
                            resume_data_obj = db.query(ResumeData).filter(ResumeData.user_id == ap[2].user_id).first()
                            res_data = None
                            if resume_data_obj:
                                res_data = {
                                    "timeline": resume_data_obj.timeline,
                                    "education": resume_data_obj.education,
                                    "achievements": resume_data_obj.achievements,
                                    "skills": resume_data_obj.skills
                                }
                                
                            data_results.append({
                                "id": str(ap[0].id),
                                "candidate_id": str(ap[2].user_id),
                                "candidate_name": ap[2].full_name,
                                "candidate_role": ap[2].current_role,
                                "candidate_location": ap[2].location or "Remote",
                                "job_id": str(ap[1].id),
                                "job_title": ap[1].title,
                                "status": ap[0].status,
                                "created_at": ap[0].created_at.isoformat() if ap[0].created_at else None,
                                "match_score": ap[3].final_score if ap[3] else None,
                                "resume_path": S3Service.get_signed_url(ap[2].resume_path) if ap[2].resume_path else None,
                                "candidate_email": ap[4].email,
                                "interviews": int_list,
                                "resume_data": res_data
                            })
                        data_type = "application_cards"

                    workflow_text = f"Successfully updated {current_slots.get('candidate_name')}'s application status to '{status}'."
                    active_workflow = None
                    current_slots = {}
                else:
                    workflow_text = f"Do you want to update {current_slots.get('candidate_name')}'s status for the '{current_slots.get('job_title')}' role to '{status}'?"

        elif active_workflow == "job_delete" or (intent == "job_delete" and role == "recruiter"):
            # If we are already in the job_delete workflow, check confirmation
            is_cancel = intent == "cancel_action" or prompt.lower() in ("cancel", "no", "abort")
            is_confirm = intent == "confirm_action" or prompt.lower() in ("confirm", "yes", "delete", "yes, delete")
            
            # Check if user is trying to delete a different job
            is_new_delete_request = False
            if active_workflow == "job_delete":
                p_lower = prompt.lower()
                if any(x in p_lower for x in ("delete", "remove", "kill")):
                    is_new_delete_request = True
                else:
                    # Check if the prompt contains any of the recruiter's other job titles
                    recruiter_jobs = db.query(Job).filter(Job.recruiter_id == user_id).all()
                    for rj in recruiter_jobs:
                        if str(rj.id) != current_slots.get("job_id") and rj.title.lower() in p_lower:
                            is_new_delete_request = True
                            break
            
            if active_workflow == "job_delete" and current_slots.get("job_id") and not is_new_delete_request:
                if is_cancel:
                    workflow_text = "Job deletion canceled."
                    active_workflow = None
                    current_slots = {}
                elif is_confirm:
                    target_job_id = current_slots.get("job_id")
                    job = db.query(Job).filter(Job.id == target_job_id, Job.recruiter_id == user_id).first()
                    if job:
                        db.delete(job)
                        db.commit()
                        _log_recruiter_action(db, user_id, session_id, "deleted_job", target_id=target_job_id, metadata={"job_title": job.title})
                        workflow_text = f"Successfully deleted the job posting for '{current_slots.get('job_title')}'."
                        
                        # Fetch updated job list to show
                        jobs = db.query(Job).filter(Job.recruiter_id == user_id).order_by(Job.created_at.desc()).all()
                        data_results = [{
                            "id": str(j.id),
                            "title": j.title,
                            "company_name": user_context.get("company_name", "Your Company"),
                            "location": j.location,
                            "salary_range": j.salary_range,
                            "experience_band": j.experience_band or "mid",
                            "job_type": j.job_type or "onsite",
                            "status": j.status
                        } for j in jobs]
                        data_type = "job_list"
                    else:
                        workflow_text = "Failed to delete: Job not found or unauthorized."
                    active_workflow = None
                    current_slots = {}
                else:
                    workflow_text = f"Are you sure you want to permanently delete the job posting for '{current_slots.get('job_title')}'? This action cannot be undone. Reply 'confirm' or 'cancel'."
            else:
                # We are initiating job_delete (either first time, or switching to a new delete request)
                job_title = filters.get("job_title")
                job_id = filters.get("job_id")
                
                if not job_title and not job_id:
                    # Clean prompt for fallback matching
                    clean_prompt = prompt.lower()
                    for prefix in ["delete job ", "delete posting ", "delete role ", "delete ", "remove job ", "remove "]:
                        if clean_prompt.startswith(prefix):
                            clean_prompt = clean_prompt[len(prefix):].strip()
                            break
                    
                    recruiter_jobs = db.query(Job).filter(Job.recruiter_id == user_id).all()
                    # Try exact match first
                    for rj in recruiter_jobs:
                        if rj.title.lower() == clean_prompt:
                            job_id = str(rj.id)
                            job_title = rj.title
                            break
                            
                    # Try substring match
                    if not job_id:
                        for rj in recruiter_jobs:
                            if rj.title.lower() in clean_prompt or clean_prompt in rj.title.lower():
                                job_id = str(rj.id)
                                job_title = rj.title
                                break

                if not job_title and not job_id:
                    workflow_text = "Which job posting would you like to delete?"
                else:
                    # Find the job
                    query = db.query(Job).filter(Job.recruiter_id == user_id)
                    if job_id:
                        job = query.filter(Job.id == job_id).first()
                    else:
                        job = query.filter(Job.title.ilike(f"%{job_title}%")).first()

                    if not job:
                        workflow_text = f"Could not find a job matching '{job_title}' among your postings."
                    else:
                        active_workflow = "job_delete"
                        current_slots = {"job_id": str(job.id), "job_title": job.title}
                        session_context["active_workflow"] = active_workflow
                        session_context["slots"] = current_slots
                        workflow_text = f"Are you sure you want to permanently delete the job posting for '{job.title}'? This action cannot be undone. Reply 'confirm' or 'cancel'."

        elif intent == "job_status_update" and role == "recruiter":
            job_title = filters.get("job_title")
            job_id = filters.get("job_id")
            status = filters.get("status")
            
            # Map common statuses
            if status:
                status = status.lower().strip()
                if status in ("open", "active", "publish", "unpause"):
                    status = "active"
                elif status in ("pause", "paused", "hold", "on hold"):
                    status = "paused"
                elif status in ("close", "closed", "finish", "stop"):
                    status = "closed"
            
            if not job_title and not job_id:
                # Try to extract matching job title from the prompt directly
                recruiter_jobs = db.query(Job).filter(Job.recruiter_id == user_id).all()
                for rj in recruiter_jobs:
                    if rj.title.lower() in prompt.lower():
                        job_id = str(rj.id)
                        job_title = rj.title
                        break

            # Try to extract status from prompt if not in filters
            if not status:
                p_lower = prompt.lower()
                if any(x in p_lower for x in ("open", "active", "publish", "unpause")):
                    status = "active"
                elif any(x in p_lower for x in ("pause", "paused", "hold", "on hold")):
                    status = "paused"
                elif any(x in p_lower for x in ("close", "closed")):
                    status = "closed"

            if not job_title and not job_id:
                workflow_text = "Which job posting would you like to update?"
            elif not status:
                workflow_text = f"What status would you like to set for '{job_title or 'this job'}'? (open, paused, or closed)"
            else:
                # Find the job
                query = db.query(Job).filter(Job.recruiter_id == user_id)
                if job_id:
                    job = query.filter(Job.id == job_id).first()
                else:
                    job = query.filter(Job.title.ilike(f"%{job_title}%")).first()

                if not job:
                    workflow_text = f"Could not find a job matching '{job_title}' among your postings."
                else:
                    job.status = status
                    db.commit()
                    _log_recruiter_action(db, user_id, session_id, "edited_job", target_id=str(job.id), metadata={"status": status, "job_title": job.title})
                    workflow_text = f"Successfully updated the status of '{job.title}' to '{status}' (Open/Active)." if status == "active" else f"Successfully updated the status of '{job.title}' to '{status}'."
                    
                    # Fetch updated job list to show
                    jobs = db.query(Job).filter(Job.recruiter_id == user_id).order_by(Job.created_at.desc()).all()
                    data_results = [{
                        "id": str(j.id),
                        "title": j.title,
                        "company_name": user_context.get("company_name", "Your Company"),
                        "location": j.location,
                        "salary_range": j.salary_range,
                        "experience_band": j.experience_band or "mid",
                        "job_type": j.job_type or "onsite",
                        "status": j.status
                    } for j in jobs]
                    data_type = "job_list"

        elif intent == "job_stats" and role == "recruiter":
            recruiter_jobs = db.query(Job).filter(Job.recruiter_id == user_id).all()
            job_ids = [job.id for job in recruiter_jobs]
            
            total = len(recruiter_jobs)
            active = sum(1 for j in recruiter_jobs if j.status == "active")
            paused = sum(1 for j in recruiter_jobs if j.status == "paused")
            closed = sum(1 for j in recruiter_jobs if j.status == "closed")
            
            total_views = 0
            if job_ids:
                total_views = db.query(JobView).filter(JobView.job_id.in_(job_ids)).count()
                
            workflow_text = f"Here is a summary of your job board status:\n\n" \
                            f"• Total Job Listings: {total}\n" \
                            f"• Open/Active Roles: {active}\n" \
                            f"• Paused Roles: {paused}\n" \
                            f"• Closed Roles: {closed}\n" \
                            f"• Total Candidate Views: {total_views}\n\n" \
                            f"You can ask me to change status (open/pause/close) or delete any specific job."
                            
            # Let's also output the job list so they can see all jobs
            data_results = [{
                "id": str(j.id),
                "title": j.title,
                "company_name": user_context.get("company_name", "Your Company"),
                "location": j.location,
                "salary_range": j.salary_range,
                "experience_band": j.experience_band or "mid",
                "job_type": j.job_type or "onsite",
                "status": j.status
            } for j in recruiter_jobs]
            data_type = "job_list"

        elif intent == "view_candidates" and role == "recruiter":
            candidates = await recruiter_service.get_talent_pool()
            workflow_text = "Here is the talent pool with all active candidates."
            data_type = "candidate_list"
            data_results = candidates[:10]  # Show top 10 in chat

        elif intent == "application_status":
            if role == "recruiter":
                profile = db.query(RecruiterProfile).filter(RecruiterProfile.user_id == user_id).first()
                if profile:
                    query = db.query(JobApplication, Job, CandidateProfile, ProfileScore, User).join(
                        Job, JobApplication.job_id == Job.id
                    ).join(
                        CandidateProfile, JobApplication.candidate_id == CandidateProfile.user_id
                    ).join(
                        User, JobApplication.candidate_id == User.id
                    ).outerjoin(
                        ProfileScore, JobApplication.candidate_id == ProfileScore.user_id
                    ).filter(
                        Job.recruiter_id == user_id
                    )
                    
                    job_title = filters.get("job_title")
                    job_id = filters.get("job_id")
                    
                    if not job_title and not job_id:
                        recruiter_jobs = db.query(Job).filter(Job.recruiter_id == user_id).all()
                        for rj in recruiter_jobs:
                            if rj.title.lower() in prompt.lower():
                                job_id = str(rj.id)
                                job_title = rj.title
                                break
                                
                    if job_id:
                        query = query.filter(Job.id == job_id)
                        workflow_text = f"Here are the applications for the job role '{job_title or 'Selected Job'}':"
                    elif job_title:
                        query = query.filter(Job.title.ilike(f"%{job_title}%"))
                        workflow_text = f"Here are the applications for the job role '{job_title}':"
                    else:
                        workflow_text = "Here are the applications for the jobs posted by you:"
                        
                    apps = query.order_by(JobApplication.created_at.desc()).all()
                    data_results = []
                    for app in apps:
                        # Fetch scheduled/pending interviews
                        interviews = db.query(Interview).filter(Interview.application_id == app[0].id).all()
                        int_list = [{
                            "id": str(i.id),
                            "round_name": i.round_name,
                            "round_number": i.round_number,
                            "format": i.format,
                            "location": i.location,
                            "meeting_link": i.meeting_link,
                            "status": i.status
                        } for i in interviews]
                        
                        # Fetch resume data if available
                        resume_data_obj = db.query(ResumeData).filter(ResumeData.user_id == app[2].user_id).first()
                        res_data = None
                        if resume_data_obj:
                            res_data = {
                                "timeline": resume_data_obj.timeline,
                                "education": resume_data_obj.education,
                                "achievements": resume_data_obj.achievements,
                                "skills": resume_data_obj.skills
                            }
                            
                        data_results.append({
                            "id": str(app[0].id),
                            "candidate_id": str(app[2].user_id),
                            "candidate_name": app[2].full_name,
                            "candidate_role": app[2].current_role,
                            "candidate_location": app[2].location or "Remote",
                            "job_id": str(app[1].id),
                            "job_title": app[1].title,
                            "status": app[0].status,
                            "created_at": app[0].created_at.isoformat() if app[0].created_at else None,
                            "match_score": app[3].final_score if app[3] else None,
                            "resume_path": S3Service.get_signed_url(app[2].resume_path) if app[2].resume_path else None,
                            "candidate_email": app[4].email,
                            "interviews": int_list,
                            "resume_data": res_data
                        })
                    data_type = "application_cards"
                else:
                    workflow_text = "Could not find recruiter profile details."
                    data_type = "none"
            else:
                query = db.query(JobApplication, Job, Company).join(
                    Job, JobApplication.job_id == Job.id
                ).join(
                    Company, Job.company_id == Company.id
                ).filter(
                    JobApplication.candidate_id == user_id
                )
                apps = query.order_by(JobApplication.created_at.desc()).all()
                data_results = [{
                    "id": str(app[0].id),
                    "company_name": app[2].name,
                    "job_title": app[1].title,
                    "status": app[0].status
                } for app in apps]
                workflow_text = "Here is the status of your job applications:"
                data_type = "application_list"

        elif intent == "view_jobs":
            if role == "recruiter":
                profile = db.query(RecruiterProfile).filter(RecruiterProfile.user_id == user_id).first()
                if profile:
                    query = db.query(Job).filter(Job.recruiter_id == user_id)
                    job_title = filters.get("job_title")
                    if not job_title:
                        # Try to extract matching job title from the prompt directly
                        recruiter_jobs = db.query(Job).filter(Job.recruiter_id == user_id).all()
                        for rj in recruiter_jobs:
                            if rj.title.lower() in prompt.lower():
                                job_title = rj.title
                                break
                    
                    if job_title:
                        query = query.filter(Job.title.ilike(f"%{job_title}%"))
                        workflow_text = f"Here are your posted jobs matching '{job_title}':"
                    else:
                        workflow_text = "Here are the jobs currently posted by you."
                        
                    jobs = query.order_by(Job.created_at.desc()).all()
                    data_results = [{
                        "id": str(job.id),
                        "title": job.title,
                        "company_name": user_context.get("company_name", "Your Company"),
                        "location": job.location,
                        "salary_range": job.salary_range,
                        "experience_band": job.experience_band or "mid",
                        "job_type": job.job_type or "onsite",
                        "status": job.status
                    } for job in jobs]
                    data_type = "job_list"
                else:
                    workflow_text = "Could not find recruiter profile details."
                    data_type = "none"
            else:
                jobs = await CandidateService.list_available_jobs(user_id)
                data_results = jobs[:10]
                workflow_text = "Here are the active job postings available on the platform."
                data_type = "job_list"

        elif intent == "schedule_interview" and role == "recruiter":
            application_id = filters.get("application_id")
            candidate_id = filters.get("candidate_id")
            candidate_name = filters.get("candidate_name")
            job_id = filters.get("job_id")
            job_title = filters.get("job_title")

            # Try to resolve application_id or candidate details
            query = db.query(JobApplication, Job, CandidateProfile, User).join(
                Job, JobApplication.job_id == Job.id
            ).join(
                CandidateProfile, JobApplication.candidate_id == CandidateProfile.user_id
            ).join(
                User, JobApplication.candidate_id == User.id
            ).filter(
                Job.recruiter_id == user_id
            )

            if application_id:
                query = query.filter(JobApplication.id == application_id)
            else:
                if candidate_id:
                    query = query.filter(JobApplication.candidate_id == candidate_id)
                elif candidate_name:
                    query = query.filter(CandidateProfile.full_name.ilike(f"%{candidate_name}%"))
                
                if job_id:
                    query = query.filter(JobApplication.job_id == job_id)
                elif job_title:
                    query = query.filter(Job.title.ilike(f"%{job_title}%"))

            app_obj = query.order_by(JobApplication.created_at.desc()).first()
            if app_obj:
                # Get existing scheduled/pending interviews
                interviews = db.query(Interview).filter(Interview.application_id == app_obj[0].id).all()
                int_list = [{
                    "id": str(i.id),
                    "round_name": i.round_name,
                    "round_number": i.round_number,
                    "format": i.format,
                    "location": i.location,
                    "meeting_link": i.meeting_link,
                    "status": i.status
                } for i in interviews]

                # Outer join ProfileScore if it exists
                profile_score = db.query(ProfileScore).filter(ProfileScore.user_id == app_obj[2].user_id).first()
                match_score = profile_score.final_score if profile_score else None

                # Get resume timeline if exists
                resume_data_obj = db.query(ResumeData).filter(ResumeData.user_id == app_obj[2].user_id).first()
                res_data = None
                if resume_data_obj:
                    res_data = {
                        "timeline": resume_data_obj.timeline,
                        "education": resume_data_obj.education,
                        "achievements": resume_data_obj.achievements,
                        "skills": resume_data_obj.skills
                    }

                data_results = [{
                    "id": str(app_obj[0].id),
                    "candidate_id": str(app_obj[2].user_id),
                    "candidate_name": app_obj[2].full_name,
                    "candidate_role": app_obj[2].current_role,
                    "candidate_location": app_obj[2].location or "Remote",
                    "job_id": str(app_obj[1].id),
                    "job_title": app_obj[1].title,
                    "status": app_obj[0].status,
                    "created_at": app_obj[0].created_at.isoformat() if app_obj[0].created_at else None,
                    "match_score": match_score,
                    "resume_path": S3Service.get_signed_url(app_obj[2].resume_path) if app_obj[2].resume_path else None,
                    "candidate_email": app_obj[3].email,
                    "interviews": int_list,
                    "resume_data": res_data
                }]
                workflow_text = f"Ready to schedule an interview with {app_obj[2].full_name} for the '{app_obj[1].title}' position."
                data_type = "schedule_interview"
                _log_recruiter_action(db, user_id, session_id, "scheduled_interview", target_id=str(app_obj[0].id), metadata={"candidate_name": app_obj[2].full_name, "job_title": app_obj[1].title})
            else:
                workflow_text = "Could not find a matching active candidate application to schedule an interview for."
                data_type = "none"

        elif intent in ("profile_view", "resume_view") and role == "recruiter":
            candidate_id = filters.get("candidate_id")
            candidate_name = filters.get("candidate_name")

            if not candidate_id and candidate_name:
                clean_name = candidate_name.strip()
                cand_profile = db.query(CandidateProfile).filter(CandidateProfile.full_name.ilike(f"%{clean_name}%")).first()
                if cand_profile:
                    candidate_id = str(cand_profile.user_id)

            if not candidate_id:
                # Try fallback parsing from prompt
                clean_prompt = prompt.lower()
                for prefix in ["show profile of ", "show profile for ", "view profile of ", "view profile for ", "profile of ", "profile for ", "show resume of ", "show resume for ", "view resume of ", "view resume for ", "resume of ", "resume for "]:
                    if clean_prompt.startswith(prefix):
                        cand_name = prompt[len(prefix):].strip()
                        cand_name = re.sub(r'[?.!]$', '', cand_name).strip()
                        cand_profile = db.query(CandidateProfile).filter(CandidateProfile.full_name.ilike(f"%{cand_name}%")).first()
                        if cand_profile:
                            candidate_id = str(cand_profile.user_id)
                            break

            if not candidate_id:
                workflow_text = "Which candidate's profile would you like to view?" if intent == "profile_view" else "Which candidate's resume would you like to view?"
                data_type = "none"
            else:
                cand_profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == candidate_id).first()
                if not cand_profile:
                    workflow_text = "Could not find the specified candidate."
                    data_type = "none"
                else:
                    user_obj = db.query(User).filter(User.id == candidate_id).first()
                    score_obj = db.query(ProfileScore).filter(ProfileScore.user_id == candidate_id).first()
                    resume_data_obj = db.query(ResumeData).filter(ResumeData.user_id == candidate_id).first()
                    
                    res_data = None
                    if resume_data_obj:
                        res_data = {
                            "timeline": resume_data_obj.timeline,
                            "education": resume_data_obj.education,
                            "achievements": resume_data_obj.achievements,
                            "skills": resume_data_obj.skills
                        }
                    
                    data_results = [{
                        "user_id": str(cand_profile.user_id),
                        "full_name": cand_profile.full_name,
                        "email": user_obj.email if user_obj else None,
                        "phone": cand_profile.phone_number if cand_profile.phone_number else None,
                        "phone_number": cand_profile.phone_number if cand_profile.phone_number else None,
                        "location": cand_profile.location or "Remote",
                        "current_role": cand_profile.current_role or "IT Sales Professional",
                        "skills": cand_profile.skills or [],
                        "years_of_experience": cand_profile.years_of_experience or 0,
                        "profile_strength": cand_profile.profile_strength or "Good",
                        "expected_salary": float(cand_profile.expected_salary) if cand_profile.expected_salary else None,
                        "gender": cand_profile.gender if cand_profile.gender else None,
                        "bio": cand_profile.bio if cand_profile.bio else None,
                        "resume_path": S3Service.get_signed_url(cand_profile.resume_path) if cand_profile.resume_path else None,
                        "match_score": score_obj.final_score if score_obj else None,
                        "resume_data": res_data
                    }]
                    data_type = "candidate_profile" if intent == "profile_view" else "resume_info"

        # Update workflow slots & state in session context
        session_context["active_workflow"] = active_workflow
        session_context["slots"] = current_slots

        # ── 6. Limit (Fallback) ─────────────────────────────────
        limit = await _extract_limit(prompt)

        # ── 7. Tool Execution & Response Generation (Fallback) ───
        if not workflow_text:
            raw_data = None
            if requires_data and intent not in ("general", "greeting", "help") and not data_results:
                raw_data = await _execute_tool(intent, filters, user_id, role, prompt=prompt)

            # Normalise results
            if raw_data:
                if isinstance(raw_data, dict):
                    data_results = raw_data.get("data") or raw_data.get("results") or []
                elif isinstance(raw_data, list):
                    data_results = raw_data
            data_results = data_results[:limit]
            data_type = _INTENT_TYPE.get(intent, "none") if data_results else "none"

            next_steps = await _get_learned_next_steps(db, user_id, role, intent, data_results, next_steps)

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
        else:
            final_text = workflow_text
            next_steps = await _get_learned_next_steps(db, user_id, role, intent, data_results, next_steps)

        # ── 8. Greeting prefix for new sessions ─────────────────
        if is_new_session and prompt == "__greeting__":
            greeting = await _generate_greeting(
                user_context,
                role,
                prev_summary,
                payload.client_context,
            )
            final_text = f"{greeting}\n\n{final_text}"

        # ── 9. Action Cards ─────────────────────────────────────
        action_cards_intent = "recommendations_locked" if data_type == "recommendations_locked" else intent
        action_cards = _build_action_cards(
            action_cards_intent, data_results, suggested_redirects, next_steps, role
        )

        # Trigger recruiter-specific notifications for searches and views
        if role == "recruiter" and data_results:
            try:
                if intent in ("candidate_search", "view_candidates"):
                    match_count = len(data_results)
                    location_str = filters.get("location") or ""
                    loc_part = f" in {location_str}" if location_str else ""
                    NotificationService.create_notification(
                        user_id=user_id,
                        type="info",
                        title="Candidate Search Fit",
                        message=f"Found {match_count} candidate matching results{loc_part}.",
                        metadata={"session_id": session_id, "filters": filters},
                        db=db
                    )
                    db.commit()
                    _log_recruiter_action(db, user_id, session_id, "searched_candidates", metadata={"filters": filters, "results_count": match_count})
                elif intent == "profile_view":
                    cand_name = data_results[0].get("full_name") or "Candidate"
                    NotificationService.create_notification(
                        user_id=user_id,
                        type="info",
                        title="Profile Viewed",
                        message=f"You viewed {cand_name}'s profile details conversationally.",
                        metadata={"candidate_id": data_results[0].get("user_id"), "session_id": session_id},
                        db=db
                    )
                    db.commit()
                    _log_recruiter_action(db, user_id, session_id, "viewed_profile", target_id=data_results[0].get("user_id"), metadata={"candidate_name": cand_name})
                elif intent == "resume_view":
                    cand_name = data_results[0].get("full_name") or "Candidate"
                    NotificationService.create_notification(
                        user_id=user_id,
                        type="info",
                        title="Resume Viewed",
                        message=f"You conversationally opened {cand_name}'s resume preview.",
                        metadata={"candidate_id": data_results[0].get("user_id"), "session_id": session_id},
                        db=db
                    )
                    db.commit()
                    _log_recruiter_action(db, user_id, session_id, "viewed_resume", target_id=data_results[0].get("user_id"), metadata={"candidate_name": cand_name})
                elif intent == "market_insights":
                    _log_recruiter_action(db, user_id, session_id, "viewed_insights")
            except Exception as notif_err:
                log.warning("Could not create recruiter notification: %s", notif_err)

        # ── 10. Persist session ─────────────────────────────────
        data_summary = (
            f"Found {len(data_results)} {intent} results"
            if data_results
            else f"No results for {intent}"
        )

        # Auto-title: use first user message as session title (summarized by LLM)
        session_title = session.get("session_title")
        if not session_title or session_title in ("__greeting__", "New Chat", "New Session", ""):
            if prompt and prompt != "__greeting__":
                session_title = await _generate_chat_title(prompt)
            else:
                session_title = "New Chat"

        messages.append({
            "role": "user",
            "content": prompt,
            "timestamp": datetime.now().isoformat(),
        })

        # Persist assistant reply with rich metadata so UI can rehydrate cards after reload
        messages.append({
            "role": "assistant",
            "content": final_text,
            "timestamp": datetime.now().isoformat(),
            "intent": intent,
            "data_type": data_type,
            "data_results": data_results,
            "action_cards": action_cards,
            "feature_prompts": next_steps if next_steps else [],
            "next_steps": next_steps,
        })
        messages = messages[-30:]  # keep rolling window of 30 messages

        _update_session(
            db, session_id, messages, intent, filters,
            data_summary, session_context, session_title
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


class UpdateMessagesRequest(BaseModel):
    messages: List[Dict[str, Any]]

@router.put("/sessions/{session_id}/messages")
async def update_session_messages(
    session_id: str,
    payload: UpdateMessagesRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    user_id = current_user.get("sub")
    db = SessionLocal()
    try:
        _ensure_sessions_table(db)
        row = db.execute(
            text("SELECT user_id FROM ai_assistant_sessions WHERE id = :sid AND user_id = :uid"),
            {"sid": session_id, "uid": user_id},
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Session not found")
            
        db.execute(
            text("""
                UPDATE ai_assistant_sessions
                SET messages = :messages,
                    message_count = :count,
                    updated_at = NOW()
                WHERE id = :sid
            """),
            {
                "messages": json.dumps(payload.messages),
                "count": len(payload.messages),
                "sid": session_id,
            }
        )
        db.commit()
        return {"success": True}
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