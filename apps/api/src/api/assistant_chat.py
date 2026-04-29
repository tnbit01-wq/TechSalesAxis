from typing import Any, Dict, Optional, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, desc

from src.core.dependencies import get_current_user
from src.core.database import SessionLocal
from src.core.models import Job
from src.services.recruiter_service import recruiter_service
from src.services.candidate_service import CandidateService

router = APIRouter(prefix="/ai/assistant", tags=["AI Assistant"])


class AssistantChatRequest(BaseModel):
    prompt: str
    client_context: Optional[Dict[str, Any]] = None


async def _call_general_ai(prompt: str, system_message: str = "You are a helpful talent and career assistant.") -> str:
    """
    Lightweight general-purpose AI call using the existing recruiter_service OpenAI client
    so we do not duplicate HTTP/OpenAI integration logic.
    """
    return await recruiter_service._call_ai(prompt, system_message)


def _append_next_steps(text: str, role: str, intent: str) -> str:
    """
    Add product-driving next actions so users are guided toward platform features.
    """
    recruiter_next_steps = {
        "candidate_search": "Would you like me to narrow this list by location, experience band, or top 3 must-have skills? I can also help you draft a matching job post.",
        "market_intel": "Would you like me to suggest a job description and compensation band for the highest-demand role so you can post it now?",
        "general_chat": "Would you like me to convert this guidance into a shortlist strategy, interview rubric, or a job post draft?",
    }
    candidate_next_steps = {
        "job_search": "Would you like me to refine this by salary, location, or role seniority and then suggest your top 3 applications for today?",
        "company_research": "Would you like me to narrow this to companies with your preferred salary band, location, and growth stage?",
        "career_guidance": "Would you like me to turn this into a 7-day action plan and suggest roles you can apply to immediately?",
        "general_chat": "Would you like me to find matching jobs or companies based on this discussion?",
    }

    if role == "recruiter":
        cta = recruiter_next_steps.get(intent, recruiter_next_steps["general_chat"])
    else:
        cta = candidate_next_steps.get(intent, candidate_next_steps["general_chat"])
    return f"{text}\n\n{cta}"


def _extract_job_filters(prompt_lower: str) -> Dict[str, Any]:
    """
    Basic NL extraction for candidate job search filters.
    """
    location = None
    for marker in [" in ", " at ", " near ", " from "]:
        if marker in prompt_lower:
            chunk = prompt_lower.split(marker, 1)[1].strip()
            location = chunk.split(" with ")[0].split(" salary")[0].split(" and ")[0].strip(" .,!?")
            break

    min_salary = None
    if "above" in prompt_lower:
        maybe = prompt_lower.split("above", 1)[1].strip().split(" ")[0].replace(",", "")
        if maybe.replace(".", "", 1).isdigit():
            min_salary = float(maybe)

    experience_band = None
    if any(x in prompt_lower for x in ["fresher", "entry", "junior"]):
        experience_band = "fresher"
    elif any(x in prompt_lower for x in ["mid", "intermediate"]):
        experience_band = "mid"
    elif any(x in prompt_lower for x in ["senior", "lead"]):
        experience_band = "senior"
    elif any(x in prompt_lower for x in ["director", "vp", "head", "leadership"]):
        experience_band = "leadership"

    return {
        "location": location,
        "min_salary": min_salary,
        "experience_band": experience_band,
    }


def _get_live_market_demand(limit: int = 5) -> List[Dict[str, Any]]:
    """
    Fetch live market demand from current active jobs in DB.
    """
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
            {"label": (row.title or "Unknown Role"), "value": int(row.demand_count or 0)}
            for row in rows
        ]
    finally:
        db.close()


@router.post("/chat")
async def assistant_chat(
    payload: AssistantChatRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Unified AI Assistant entrypoint for both recruiters and candidates.
    Returns a normalized shape that the GlobalChatInterface understands.
    """
    prompt = (payload.prompt or "").strip()
    if not prompt:
        return {
            "text": "Please type a question or instruction so I can help.",
            "data_type": "none",
            "data_results": [],
        }

    role = current_user.get("role")
    user_id = current_user.get("sub")

    if not role or not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")

    prompt_lower = prompt.lower()

    if role == "recruiter":
        return await _handle_recruiter_prompt(prompt, prompt_lower, user_id)

    if role == "candidate":
        return await _handle_candidate_prompt(prompt, prompt_lower, user_id)

    # Fallback for unknown roles – general chat only
    text = await _call_general_ai(prompt)
    return {
        "text": text or "I'm here to help with recruiting and career questions.",
        "data_type": "none",
        "data_results": [],
    }


async def _handle_recruiter_prompt(prompt: str, prompt_lower: str, user_id: str) -> Dict[str, Any]:
    """
    Recruiter assistant flow:
    - Natural-language candidate search over the talent pool.
    - General recruiting strategy questions.
    """
    is_market_query = any(x in prompt_lower for x in ["market status", "high demand", "market demand", "demand today", "trend"])

    if is_market_query:
        demand_metrics = _get_live_market_demand(limit=6)
        if demand_metrics:
            headline = f"Based on live active jobs in your platform right now, the highest-demand tech sales roles are led by {demand_metrics[0]['label']}."
            return {
                "text": _append_next_steps(headline, "recruiter", "market_intel"),
                "data_type": "market_data",
                "data_results": demand_metrics,
            }

    # Heuristic: treat as candidate search if it clearly looks like a sourcing query
    search_keywords = [
        "find",
        "search",
        "looking for",
        "candidates",
        "talent",
        "account executive",
        "sales rep",
        "sdr",
        "bdr",
        "ae",
    ]
    is_search = any(kw in prompt_lower for kw in search_keywords)

    if is_search:
        # Reuse the proven get_recommended_candidates engine with a simple LLM-based
        # extraction of skills/location/experience band, mirroring ai_intent.py.
        intent_prompt = f"""
Extract search criteria from this recruiter query: "{prompt}"

Return ONLY valid JSON (no markdown, no code fences):
{{
  "skills": ["skill1", "skill2"],
  "location": "city or region",
  "experience_band": "fresher|mid|senior|leadership",
  "keywords": ["additional search terms"]
}}

Rules:
- For experience: < 2 years = "fresher", 2-5 years = "mid", 5-10 years = "senior", > 10 years = "leadership"
- Extract location from any mention of cities/regions.
- Extract skills related to roles mentioned (SaaS, closing, SDR, AE, etc.).
- skills and keywords can be empty lists if not explicitly mentioned.
"""
        criteria = await recruiter_service._call_ai_json(intent_prompt, "Search Intent Extractor")
        if not criteria:
            criteria = {"skills": [], "location": "", "experience_band": "all", "keywords": []}

        if not criteria.get("experience_band"):
            criteria["experience_band"] = "all"

        is_broad_query = (
            not criteria.get("skills")
            and not criteria.get("location")
            and criteria.get("experience_band") in [None, "", "all", "mid"]
        )

        recommendations = await recruiter_service.get_recommended_candidates(
            user_id=user_id,
            filter_type="profile_matching" if is_broad_query else "skill_match",
            params={
                "required_skills": criteria.get("skills", []),
                "location": criteria.get("location"),
                "experience_band": criteria.get("experience_band", "all"),
            },
        )

        if not recommendations:
            return {
                "text": _append_next_steps(
                    "I could not find candidates that match this query. Try relaxing skills, location, or seniority and I can rerun instantly.",
                    "recruiter",
                    "candidate_search",
                ),
                "data_type": "candidate_list",
                "data_results": [],
            }

        top_for_summary = recommendations[:5]
        summary_prompt = f"""
You are a strategic tech sales recruiter assistant.
Summarize in 2-3 sentences why these candidates are a good match for the recruiter query: "{prompt}".
Highlight seniority, core skills, and culture fit.

Data: {top_for_summary}
"""
        summary_text = await _call_general_ai(summary_prompt, "You are an expert recruitment copilot.")

        return {
            "text": _append_next_steps(
                summary_text or f"Here are {len(recommendations)} candidates I believe match your query.",
                "recruiter",
                "candidate_search",
            ),
            "data_type": "candidate_list",
            "data_results": recommendations[:10],
        }

    # Otherwise: general recruiter chat (playbook, interview questions, etc.)
    general_text = await _call_general_ai(
        prompt,
        "You are an expert GTM and recruiting assistant for tech sales teams. "
        "Give concise, actionable guidance tailored for a recruiter.",
    )
    return {
        "text": _append_next_steps(
            general_text or "I can help you with candidate search, interviews, and hiring strategy.",
            "recruiter",
            "general_chat",
        ),
        "data_type": "none",
        "data_results": [],
    }


async def _handle_candidate_prompt(prompt: str, prompt_lower: str, user_id: str) -> Dict[str, Any]:
    """
    Candidate assistant flow:
    - Natural-language job search / recommendation.
    - Company discovery.
    - General career-coach style chat.
    """
    is_job_search = any(
        kw in prompt_lower
        for kw in ["job", "role", "position", "opening", "opportunity", "apply", "hiring"]
    )
    is_company_search = "company" in prompt_lower or "companies" in prompt_lower

    # Prefer job search when both are present
    if is_job_search:
        filters = _extract_job_filters(prompt_lower)
        # For now we rely on the existing recommendation engine which already factors in
        # profile, skills, experience, and history. We can later add LLM-based filters.
        recs = await CandidateService.get_recommended_jobs(
            user_id=user_id,
            filter_type="role_match",
            location=filters.get("location"),
            experience_band=filters.get("experience_band"),
            min_salary=filters.get("min_salary"),
        )
        if recs.get("status") != "success" or not recs.get("data"):
            # Fallback to generic available jobs
            jobs = await CandidateService.list_available_jobs(user_id)
            if not jobs:
                return {
                    "text": _append_next_steps(
                        "I couldn't find suitable roles right now. Try widening location/salary constraints or updating profile skills so matching improves.",
                        "candidate",
                        "job_search",
                    ),
                    "data_type": "job_list",
                    "data_results": [],
                }

            return {
                "text": _append_next_steps(
                    "Here are active roles selected from your profile fit signals (skills, experience, and preferences).",
                    "candidate",
                    "job_search",
                ),
                "data_type": "job_list",
                "data_results": jobs[:10],
            }

        job_cards = recs["data"][:10]
        summary_prompt = f"""
You are a career coach for tech sales candidates.
Explain in 2-3 sentences why these roles fit the candidate based on role, skills, and location.

Query: "{prompt}"
Jobs: {job_cards}
"""
        text = await _call_general_ai(summary_prompt, "You are a concise tech sales career coach.")
        return {
            "text": _append_next_steps(
                text or f"I've found {recs.get('total_count', len(job_cards))} roles that align with your profile.",
                "candidate",
                "job_search",
            ),
            "data_type": "job_list",
            "data_results": job_cards,
        }

    if is_company_search:
        companies = await CandidateService.get_recommended_companies(
            user_id=user_id,
            filter_type="culture_fit",
        )
        if companies.get("status") != "success" or not companies.get("data"):
            return {
                "text": _append_next_steps(
                    "I couldn't find matching companies right now, but I can still help define your ideal company profile and refine search filters.",
                    "candidate",
                    "company_research",
                ),
                "data_type": "company_list",
                "data_results": [],
            }

        company_cards = companies["data"][:10]
        explain_prompt = f"""
You are a tech sales career advisor.
Summarize why these companies might be a good fit for the candidate's preferences.
Keep it to 2-3 sentences.

Query: "{prompt}"
Companies: {company_cards}
"""
        text = await _call_general_ai(explain_prompt, "You are a concise career advisor for tech sales talent.")
        return {
            "text": _append_next_steps(
                text
                or f"Here are {companies.get('total_count', len(company_cards))} companies that may fit your style and growth goals.",
                "candidate",
                "company_research",
            ),
            "data_type": "company_list",
            "data_results": company_cards,
        }

    # General career guidance chat
    coach_text = await _call_general_ai(
        prompt,
        "You are a friendly but direct tech sales career coach. "
        "Give specific, practical advice to help the candidate move forward.",
    )
    return {
        "text": _append_next_steps(
            coach_text or "I can help you discover roles, companies, and growth paths in tech sales.",
            "candidate",
            "career_guidance",
        ),
        "data_type": "none",
        "data_results": [],
    }

