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


async def _call_general_ai(prompt: str, system_message: str = "You are a helpful assistant.") -> str:
    return await recruiter_service._call_ai(prompt, system_message)


async def _call_ai_json(prompt: str, system_message: str) -> Dict[str, Any]:
    return await recruiter_service._call_ai_json(prompt, system_message)


def _get_live_market_demand(limit: int = 5) -> List[Dict[str, Any]]:
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


async def _resolve_intent(prompt: str, role: str) -> Dict[str, Any]:
    """
    AI decides EVERYTHING:
    - intent
    - filters
    - which tool to use
    """
    intent_prompt = f"""
User role: {role}
User query: "{prompt}"

Return ONLY valid JSON:
{{
  "intent": "candidate_search | job_search | company_search | market_insights | general",
  "filters": {{
    "skills": [],
    "location": "",
    "experience_band": "",
    "min_salary": null
  }},
  "requires_data": true
}}

Rules:
- Extract filters only if explicitly or implicitly present
- If query is informational, set intent = "general"
- If query relates to hiring → candidate_search
- If query relates to jobs → job_search
- If query relates to companies → company_search
- If query relates to trends → market_insights
"""
    result = await _call_ai_json(intent_prompt, "AI Intent Engine")
    return result or {}


async def _execute_tool(intent: str, filters: Dict[str, Any], user_id: str) -> Any:
    """
    Dynamic tool execution layer
    """
    try:
        if intent == "candidate_search":
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

    except Exception:
        return None

    return None


@router.post("/chat")
async def assistant_chat(
    payload: AssistantChatRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    prompt = (payload.prompt or "").strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="Prompt is required")

    role = current_user.get("role")
    user_id = current_user.get("sub")

    if not role or not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")

    # 🔹 Step 1: AI decides intent + filters
    intent_data = await _resolve_intent(prompt, role)

    intent = intent_data.get("intent", "general")
    filters = intent_data.get("filters", {})
    requires_data = intent_data.get("requires_data", False)

    # 🔹 Step 2: Execute DB/service if needed
    data = None
    if requires_data:
        data = await _execute_tool(intent, filters, user_id)

    # Normalize data for frontend
    data_results = []
    data_type = "none"

    if data:
        if isinstance(data, dict):
            if data.get("data"):
                data_results = data["data"][:10]
            elif isinstance(data.get("results"), list):
                data_results = data["results"][:10]
            else:
                data_results = []
        elif isinstance(data, list):
            data_results = data[:10]

        data_type = intent

    # 🔹 Step 3: AI generates final response using REAL data
    response_prompt = f"""
User role: {role}
User query: "{prompt}"

Detected intent: {intent}
Filters used: {filters}

Data retrieved: {data_results}

Instructions:
- Generate a natural, helpful response
- Use the data meaningfully if available
- If no data, still answer helpfully
- Do NOT mention "based on system" or "based on data retrieval"
- Be concise but insightful
"""

    final_text = await _call_general_ai(
        response_prompt,
        "You are an intelligent hiring and career assistant generating accurate, data-backed responses.",
    )

    return {
        "text": final_text or "I'm here to help.",
        "data_type": data_type,
        "data_results": data_results,
    }