"""
Admin API endpoints for unified candidate management and AI-powered matching.

Features:
- Get all candidates across all batches in unified view
- AI-powered natural language matching prompts
- Advanced filtering and search across candidate pool
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session
import json
from typing import List, Optional, Dict, Any
from datetime import datetime
import requests

from src.core.database import get_db
from src.core.models import BulkUpload, BulkUploadFile, CandidateProfile, User
from src.api.auth import get_current_user
import logging

router = APIRouter(prefix="/admin", tags=["admin"])
logger = logging.getLogger(__name__)

@router.get("/unified-candidates")
async def get_unified_candidates(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all candidates from all bulk upload batches in unified view.
    Combines both parsed data and shadow profiles.
    """
    try:
        # Get all BulkUploadFile records with successfully parsed data
        files = db.query(BulkUploadFile, BulkUpload).join(
            BulkUpload, BulkUploadFile.bulk_upload_id == BulkUpload.id
        ).filter(
            BulkUploadFile.parsing_status == 'parsed'
        ).all()

        candidates = []
        for file, batch in files:
            parsed_data = file.parsed_data or {}
            candidates.append({
                "id": str(file.id),
                "batch_id": str(batch.id),
                "batch_name": batch.batch_name or "Unnamed Batch",
                "file_name": file.original_filename,
                "name": file.extracted_name or "-",
                "email": file.extracted_email or "-",
                "phone": file.extracted_phone or "-",
                "location": file.extracted_location or "-",
                "current_role": file.extracted_current_role or "-",
                "years_experience": file.extracted_years_experience or 0,
                "highest_education": parsed_data.get("highest_education", ""),
                "skills": parsed_data.get("skills", []),
                "status": file.parsing_status,
                "is_shadow": True,
            })

        return {
            "status": "success",
            "candidates": candidates,
            "total": len(candidates)
        }
    except Exception as e:
        logger.error(f"Error fetching unified candidates: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch candidates")


@router.post("/match-candidates-by-prompt")
async def match_candidates_by_prompt(
    request_data: Dict[str, Any],
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    AI-powered candidate matching based on natural language prompt.
    
    Uses semantic understanding to find candidates matching recruiter requirements.
    
    Example prompt:
    "Find sales managers from Mumbai with 5+ years experience in B2B sales,
     strong with Salesforce and Excel, ideally with MBA or equivalent"
    """
    try:
        prompt = request_data.get("prompt", "")
        candidates = request_data.get("from_candidates", [])

        if not prompt or not candidates:
            raise HTTPException(status_code=400, detail="Prompt and candidates required")

        # Parse requirements from natural language prompt
        requirements = _parse_prompt_requirements(prompt)

        # Score candidates against requirements
        matched_candidates = []
        for candidate in candidates:
            score = _calculate_candidate_fit_score(candidate, requirements)
            if score > 0.4:  # Only include candidates with >40% match
                candidate_with_score = candidate.copy()
                candidate_with_score["match_score"] = score
                candidate_with_score["match_reason"] = _generate_match_reason(candidate, requirements, score)
                matched_candidates.append(candidate_with_score)

        # Sort by score descending
        matched_candidates.sort(key=lambda x: x["match_score"], reverse=True)

        return {
            "status": "success",
            "matched_candidates": matched_candidates[:50],  # Top 50 matches
            "total_matched": len(matched_candidates),
            "requirements_parsed": requirements
        }
    except Exception as e:
        logger.error(f"Error in prompt matching: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to process prompt")


def _parse_prompt_requirements(prompt: str) -> Dict[str, Any]:
    """
    Parse natural language requirements from prompt.
    Extracts: locations, roles, experience, skills, education, etc.
    """
    requirements = {
        "locations": [],
        "roles": [],
        "min_experience": None,
        "max_experience": None,
        "required_skills": [],
        "education": [],
        "other_keywords": []
    }

    prompt_lower = prompt.lower()

    # Location extraction
    locations = ["mumbai", "bangalore", "delhi", "pune", "hyderabad", "gurgaon", "noida", 
                 "india", "uk", "us", "europe", "singapore", "australia", "canada"]
    for loc in locations:
        if loc in prompt_lower:
            requirements["locations"].append(loc)

    # Role extraction
    roles = ["sales manager", "sales executive", "account executive", "business development",
             "team lead", "manager", "director", "cto", "developer", "engineer", "analyst"]
    for role in roles:
        if role in prompt_lower:
            requirements["roles"].append(role)

    # Experience extraction (looking for numbers with "years" keyword)
    import re
    exp_patterns = [
        r"(\d+)\+?\s*(?:to|-)?\s*(\d+)?\s*years?",  # e.g., "5-10 years" or "5+ years"
        r"(\d+)\s*plus\s*years?",  # e.g., "5 plus years"
    ]
    for pattern in exp_patterns:
        matches = re.findall(pattern, prompt_lower)
        for match in matches:
            if isinstance(match, tuple):
                min_exp = int(match[0])
                max_exp = int(match[1]) if match[1] else min_exp + 10
                if not requirements["min_experience"] or min_exp < requirements["min_experience"]:
                    requirements["min_experience"] = min_exp
                if not requirements["max_experience"] or max_exp > requirements["max_experience"]:
                    requirements["max_experience"] = max_exp
            else:
                min_exp = int(match)
                if not requirements["min_experience"]:
                    requirements["min_experience"] = min_exp

    # Skills extraction
    common_skills = ["python", "java", "sql", "excel", "salesforce", "crm", "powerpoint", 
                     "ms office", "sales", "leadership", "communication", "project management",
                     "data analysis", "marketing", "operations", "finance", "accounting"]
    for skill in common_skills:
        if skill in prompt_lower:
            requirements["required_skills"].append(skill)

    # Education extraction
    education_keywords = ["mba", "btech", "b.tech", "bachelor", "master", "doctorate", "phd",
                          "ca", "chartered", "b.com", "m.tech", "engineering"]
    for edu in education_keywords:
        if edu in prompt_lower:
            requirements["education"].append(edu)

    return requirements


def _calculate_candidate_fit_score(candidate: Dict[str, Any], requirements: Dict[str, Any]) -> float:
    """
    Calculate how well a candidate matches the requirements.
    Returns score between 0 and 1.
    """
    score = 0.0
    total_weights = 0.0

    # Location matching (Weight: 20%)
    if requirements["locations"]:
        location_weight = 0.2
        candidate_location = candidate.get("location", "").lower()
        location_match = any(loc in candidate_location for loc in requirements["locations"])
        score += location_match * location_weight
        total_weights += location_weight

    # Role matching (Weight: 25%)
    if requirements["roles"]:
        role_weight = 0.25
        candidate_role = candidate.get("current_role", "").lower()
        role_match = sum(1 for role in requirements["roles"] if role in candidate_role) / len(requirements["roles"])
        score += role_match * role_weight
        total_weights += role_weight

    # Experience matching (Weight: 20%)
    if requirements["min_experience"] or requirements["max_experience"]:
        exp_weight = 0.2
        candidate_exp = candidate.get("years_experience", 0)
        
        if requirements["min_experience"] and candidate_exp < requirements["min_experience"]:
            exp_match = candidate_exp / requirements["min_experience"]
        elif requirements["max_experience"] and candidate_exp > requirements["max_experience"]:
            exp_match = requirements["max_experience"] / candidate_exp
        else:
            exp_match = 1.0  # Perfect match
        
        score += min(1.0, max(0.0, exp_match)) * exp_weight
        total_weights += exp_weight

    # Skills matching (Weight: 25%)
    if requirements["required_skills"]:
        skills_weight = 0.25
        candidate_skills = [s.lower() for s in candidate.get("skills", [])]
        
        matched_skills = sum(
            1 for req_skill in requirements["required_skills"]
            if any(req_skill in candidate_skill for candidate_skill in candidate_skills)
        )
        skills_match = matched_skills / len(requirements["required_skills"])
        score += skills_match * skills_weight
        total_weights += skills_weight

    # Education matching (Weight: 10%)
    if requirements["education"]:
        edu_weight = 0.1
        candidate_education = (candidate.get("highest_education", "") or "").lower()
        education_match = any(edu in candidate_education for edu in requirements["education"])
        score += education_match * edu_weight
        total_weights += edu_weight

    # Normalize score
    if total_weights > 0:
        score = score / total_weights
    
    return min(1.0, max(0.0, score))


def _generate_match_reason(candidate: Dict[str, Any], requirements: Dict[str, Any], score: float) -> str:
    """
    Generate human-readable reason for match score.
    """
    reasons = []
    
    # Location match
    if requirements["locations"]:
        candidate_location = candidate.get("location", "").lower()
        if any(loc in candidate_location for loc in requirements["locations"]):
            reasons.append(f"Located in {candidate.get('location', 'Unknown')}")
    
    # Role match  
    if requirements["roles"]:
        candidate_role = candidate.get("current_role", "").lower()
        matched_roles = [role for role in requirements["roles"] if role in candidate_role]
        if matched_roles:
            reasons.append(f"Role: {matched_roles[0]}")
    
    # Experience match
    if requirements["min_experience"]:
        if candidate.get("years_experience", 0) >= requirements["min_experience"]:
            reasons.append(f"{candidate.get('years_experience', 0)}+ years experience")
    
    # Skills match
    if requirements["required_skills"]:
        candidate_skills = [s.lower() for s in candidate.get("skills", [])]
        matched_skills = [
            req_skill for req_skill in requirements["required_skills"]
            if any(req_skill in candidate_skill for candidate_skill in candidate_skills)
        ]
        if matched_skills:
            reasons.append(f"Has {len(matched_skills)} required skills")
    
    confidence = "High" if score > 0.7 else "Medium" if score > 0.5 else "Low"
    return " | ".join(reasons) if reasons else f"{confidence} relevance profile"
