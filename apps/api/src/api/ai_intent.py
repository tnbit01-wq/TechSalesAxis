import os
import json
import asyncio
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
    Supports Unified Talent Search (Verified + Shadow Profiles).
    IMPORTANT: Only recruiters can search for candidates.
    """
    try:
        user_role = current_user.get("role")
        user_id = current_user.get("sub")
        
        print(f"🔍 AI Intent - User ID: {user_id}, Role: {user_role}")
        print(f"🔍 Prompt: {prompt}")
        
        # ROLE CHECK: Only recruiters can query candidates
        if user_role != "recruiter":
            print(f"❌ Non-recruiter access attempt: {user_role}")
            return {
                "text": "🔒 Access Denied: Only recruiters can search for candidates. Please switch to recruiter mode.",
                "data_type": "error",
                "data_results": []
            }
        
        # Check if this is a search request
        search_keywords = ["find", "search", "looking for", "candidates", "talent", "developers", "sales", "experience"]
        prompt_low = prompt.lower()
        
        if any(keyword in prompt_low for keyword in search_keywords):
            print(f"🔍 Detected search query")
            
            # 1. Extract Intent using RecruiterService
            from src.services.recruiter_service import recruiter_service
            
            # Enhanced extraction prompt with better parsing
            intent_prompt = f"""
            Extract search criteria from this recruiter query: "{prompt}"
            
            Return ONLY valid JSON (NO markdown, NO code blocks):
            {{
                "skills": ["skill1", "skill2"],
                "location": "city or region",
                "experience_band": "fresher|mid|senior|leadership",
                "keywords": ["additional search terms"]
            }}
            
            Rules:
            - For experience: < 2 years = "fresher", 2-5 years = "mid", 5-10 years = "senior", > 10 years = "leadership"
            - Extract location from any mention of cities
            - Extract all skills related to roles mentioned
            - Skills can be empty list if not explicitly mentioned
            """
            
            criteria = await recruiter_service._call_ai_json(intent_prompt, "Search Intent Extractor")
            print(f"📋 Extracted criteria: {criteria}")
            
            if not criteria:
                criteria = {"skills": [], "location": "", "experience_band": "mid", "keywords": []}
            
            # 2. Map experience years mentioned to bands if not extracted
            if not criteria.get("experience_band") or criteria.get("experience_band") == "mid":
                if any(word in prompt_low for word in ["entry", "fresher", "0-1", "junior"]):
                    criteria["experience_band"] = "fresher"
                elif any(word in prompt_low for word in ["senior", "10+", "leadership", "10 year", "more than 8", "more than 9", "more than 10"]):
                    criteria["experience_band"] = "leadership"
                elif any(word in prompt_low for word in ["5-10", "intermediate"]):
                    criteria["experience_band"] = "senior"
            
            print(f"🎯 Final criteria: {criteria}")
            
            # 3. Search talent pool (Shadow + Verified)
            print(f"🔎 Searching recommendations with params: {criteria}")
            
            recommendations = await recruiter_service.get_recommended_candidates(
                user_id=user_id,
                filter_type="skill_match",  # Use skill matching for better accuracy
                params={
                    "required_skills": criteria.get("skills", []),
                    "location": criteria.get("location"),
                    "experience_band": criteria.get("experience_band", "mid")
                }
            )
            
            print(f"✅ Found {len(recommendations)} candidates")
            
            if not recommendations:
                return {
                    "text": f"No candidates found matching: {', '.join(criteria.get('skills', []))} in {criteria.get('location', 'any location')} with {criteria.get('experience_band', 'mid')} level experience. Try broader search criteria.",
                    "data_type": "candidate_list",
                    "data_results": [],
                    "criteria": criteria
                }
            
            # 4. AI Summary of top results
            top_results = recommendations[:5]
            summary_prompt = f"""
            Summarize concisely why these {len(top_results)} candidates match the recruiter's query: "{prompt}"
            Keep it to 2-3 sentences max. Highlight the best matches first.
            Data: {json.dumps(top_results, default=str)}
            """
            
            ai_summary = await recruiter_service._call_ai(summary_prompt, "Explain candidate matches concisely.")
            
            if not ai_summary:
                ai_summary = f"Found {len(recommendations)} qualified candidates matching your criteria."
            
            print(f"✅ AI Summary: {ai_summary}")
            
            return {
                "text": ai_summary,
                "data_type": "candidate_list",
                "data_results": recommendations[:10],  # Return top 10
                "criteria": criteria,
                "total_count": len(recommendations)
            }
        
        # Non-search queries
        print(f"⚠️ Non-search query detected")
        return {
            "text": "🤖 I can help you search for candidates. Try queries like: 'Find sales candidates in Mumbai' or 'Show me developers in Bangalore with 5+ years'",
            "data_type": "none",
            "data_results": []
        }

    except Exception as e:
        error_msg = str(e)
        print(f"❌ ERROR in AI Intent: {error_msg}")
        import traceback
        traceback.print_exc()
        
        return {
            "text": f"⚠️ Processing error: {error_msg}. Please try again or rephrase your query.",
            "data_type": "error",
            "data_results": []
        }
