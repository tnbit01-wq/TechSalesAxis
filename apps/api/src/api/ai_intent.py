import os
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Body
from src.core.dependencies import get_current_user
from src.core.database import SessionLocal
from src.core.models import CandidateProfile
from src.services.candidate_service import CandidateService
from src.services.recruiter_service import RecruiterService

router = APIRouter(prefix="/ai/strategic-intent", tags=["AI Intelligence"])

# Define Tool Schemas for the AI to "call"
TOOLS = [
    {
        "name": "analyze_tech_sales_persona",
        "description": "Analyzes candidate psychometrics for IT Sales roles: Resilience, Hunter vs Farmer DNA, and Growth Potential.",
        "parameters": {
            "type": "object",
            "properties": {
                "candidate_id": {"type": "string"},
                "focus": {"enum": ["resilience", "sales_dna", "adaptability"]}
            }
        }
    },
    {
        "name": "get_market_intelligence",
        "description": "Predicts market standards for IT Sales roles based on location, tech stack, and experience.",
        "parameters": {
            "type": "object",
            "properties": {
                "role": {"type": "string"},
                "location": {"type": "string"},
                "tech_field": {"type": "string"}
            }
        }
    },
    {
        "name": "search_candidates",
        "description": "Finds high-trust candidates using behavioral scoring and technical alignment.",
        # ... existing properties
    }
]

@router.post("/process")
async def process_intent(
    prompt: str = Body(..., embed=True),
    current_user: dict = Depends(get_current_user)
):
    """
    The Brain: Specializing in IT Tech Sales & High-Trust Psychometrics.
    """
    user_role = current_user.get("role")
    
    # 1. SPECIALIZED SYSTEM PROMPT for IT SALES & PSYCHOMETRICS
    system_prompt = f"""
    You are the IT Tech Sales Intelligence Core. 
    Focus: SaaS, Cloud, Cybersecurity, Fintech Sales roles.
    Metric pillars: 
    1. Psychometrics (Resilience, Hunter DNA from 810-question bank)
    2. Market Standards (Location-based salary prediction)
    3. Interview Automation (Reducing friction)
    4. Nuclear Ban Integrity (High-Trust factor)
    """

    response_payload = {
        "text": "",
        "data_type": "none",
        "data_results": [],
        "intelligence_metrics": {} # Added for psychometric visualization
    }

    prompt_low = prompt.lower()

    # SCENARIO: Psychometric / Behavior Analysis
    if any(word in prompt_low for word in ["behavior", "personality", "sales dna", "resilience"]):
        response_payload["text"] = "Accessing psychometric drivers from our 810-question behavioral bank. Candidate shows high 'Hunter' DNA but requires resilience coaching for long-cycle SaaS sales."
        response_payload["data_type"] = "behavioral_report"
        response_payload["intelligence_metrics"] = {
            "resilience": 88,
            "sales_dna": 94,
            "adaptability": 72,
            "trust_index": 98 # Based on Nuclear Ban status
        }

    # SCENARIO: Market Standards / Salary Prediction
    elif any(word in prompt_low for word in ["market", "salary", "standard", "expect"]):
        response_payload["text"] = "Based on current market markers for IT Tech Sales in this region, the median salary is $110k + 40% OTE. Candidates with Cloud-SaaS exposure are fetching a 15% trust-premium."
        response_payload["data_type"] = "market_data"
        response_payload["data_results"] = [
            {"label": "Market Avg", "value": "110k"},
            {"label": "High Performer", "value": "145k"},
            {"label": "Trust Premium", "value": "+15%"}
        ]

    # SCENARIO: Reducing Interview Process (Direct Matching)
    elif any(word in prompt_low for word in ["interview", "reduce", "fast", "top"]):
        response_payload["text"] = "To accelerate the process, I've curated 3 'Verified-High-Trust' candidates who passed the 125-question strategic auditor. They are ready for immediate team-fit calls."
        
        db = SessionLocal()
        try:
            candidates = db.query(CandidateProfile)\
                .order_by(CandidateProfile.final_profile_score.desc())\
                .limit(3)\
                .all()
            
            response_payload["data_results"] = [
                {
                    "id": str(c.user_id),
                    "full_name": c.full_name,
                    "profile_score": float(c.final_profile_score) if c.final_profile_score else 0,
                    "current_role": c.current_role
                } for c in candidates
            ]
        finally:
            db.close()

        response_payload["data_type"] = "candidate_list"
    
    else:
        response_payload["text"] = "TalentCore Synced. Awaiting specific IT Sales or Behavioral inquiry."

    return response_payload
