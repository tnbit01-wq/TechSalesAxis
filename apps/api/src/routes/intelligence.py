"""
AI Intelligence Routes
Expose AI-powered personalization endpoints for the onboarding flow
"""

from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Any
import logging
from datetime import datetime

from src.core.database import SessionLocal, get_db
from src.core.models import CandidateProfile
from src.services.ai_intelligence_service import get_ai_intelligence_service
from src.core.auth import verify_token

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/intelligence", tags=["AI Intelligence"])

# ============================================================================
# REQUEST/RESPONSE MODELS
# ============================================================================

class CareerReadinessAnswers(BaseModel):
    employment_status: Optional[str] = None
    job_search_mode: Optional[str] = None
    timeline: Optional[str] = None
    salary_expectation: Optional[str] = None
    preferences: Optional[List[str]] = None
    step: int = Field(default=1, description="Current step (1-5)")

class SkillExtractionRequest(BaseModel):
    bio_text: str
    experience_band: str

class CareerFitRequest(BaseModel):
    target_role: Optional[str] = None
    include_full_analysis: bool = False

class PersonalizedRecommendationsRequest(BaseModel):
    career_stage: str
    include_timeline: bool = True

class ConversationalOnboardingRequest(BaseModel):
    user_message: str = Field(..., description="Natural language input from candidate (e.g., 'I work as a developer...')")
    conversation_history: Optional[List[Dict[str, str]]] = Field(default=None, description="Previous messages in this conversation [{user: '...', assistant: '...'}]")

# ============================================================================
# ENDPOINTS
# ============================================================================

@router.post("/onboarding/conversational")
async def process_conversational_onboarding(
    request: ConversationalOnboardingRequest,
    authorization: str = Header(None),
    db = Depends(get_db)
):
    """
    Process natural language input for onboarding (CHAT-BASED, INTELLIGENT)
    
    Instead of asking rigid form questions, this endpoint:
    1. Understands natural language from candidates
    2. Extracts career readiness info (employment, urgency, timeline, etc.)
    3. Tracks what we know vs. what's missing
    4. Asks ONLY critical missing information in conversational way
    5. Maintains context across conversation
    
    The flow is INTELLIGENT and NATURAL - not form-based.
    
    Example:
    User: "I'm a developer with 5 years experience, currently working at TCS, but I'm looking to move into tech sales"
    Response: {
        "extracted_info": {
            "employment_status": "employed",
            "current_role": "Developer",
            "years_experience": 5
        },
        "completeness_score": 0.6,
        "missing_critical_fields": ["job_search_mode", "notice_period_days"],
        "next_question": "How serious are you about making this move? Are you just exploring...",
        "confidence": 0.88
    }
    
    Returns:
    {
        "status": "analyzed",
        "extracted_info": {...},
        "completeness_score": 0-1,
        "missing_critical_fields": [...],
        "next_question": "What should I ask next?",
        "conversation_flow": "natural",
        "confidence": 0-1,
        "user_sentiment": "positive|neutral|concerned"
    }
    """
    try:
        user_id = await verify_token(authorization)
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        ai_service = get_ai_intelligence_service()
        
        # Process the natural language message
        result = await ai_service.process_conversational_onboarding(
            user_message=request.user_message,
            conversation_history=request.conversation_history
        )
        
        logger.info(f"[INTELLIGENCE] Conversational onboarding for {user_id} - completeness: {result.get('completeness_score', 0)}")
        
        return {
            "status": "success",
            "data": result,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"[INTELLIGENCE] Error in conversational onboarding: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/career-readiness/adaptive-question")
async def get_adaptive_followup_question(
    answers: CareerReadinessAnswers,
    authorization: str = Header(None),
    db = Depends(get_db)
):
    """
    Generate next contextual question for Career Readiness step
    Based on previous answers - makes flow personalized, not generic
    
    Example flow:
    Step 1: "What's your employment status?" → User selects "Employed"
    Step 2: AI generates contextual Q: "Since you're employed, what's holding you back?"
    
    Returns: {question, options, reasoning, personalization_notes}
    """
    print(f"\n[ENDPOINT] POST /intelligence/career-readiness/adaptive-question")
    print(f"[ENDPOINT] Step: {answers.step}, Answers: {answers.employment_status}")
    
    try:
        # Verify auth
        user_id = await verify_token(authorization)
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        # Get AI service
        ai_service = get_ai_intelligence_service()
        
        # Convert to dict
        career_answers = answers.dict(exclude_none=True)
        
        # Generate adaptive question
        result = await ai_service.generate_adaptive_followup_question(
            career_answers=career_answers,
            current_step=answers.step
        )
        
        # Log to database
        logger.info(f"[INTELLIGENCE] Generated adaptive question for {user_id} at step {answers.step}")
        
        return {
            "status": "success",
            "data": result,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"[INTELLIGENCE] Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/skills/extract-from-bio")
async def extract_skills_from_bio(
    request: SkillExtractionRequest,
    authorization: str = Header(None),
    db = Depends(get_db)
):
    """
    Extract skills from free-text bio/experience description
    Auto-fills skills step during manual resume building
    
    Use case: User types bio during AWAITING_MANUAL_BIO step
    → Auto-extract skills for next step
    → User reviews and adds missing ones
    
    Returns: {primary_skills, suggested_skills, confidence_score, analysis, recommendations}
    """
    print(f"\n[ENDPOINT] POST /intelligence/skills/extract-from-bio")
    print(f"[ENDPOINT] Bio length: {len(request.bio_text)}, Band: {request.experience_band}")
    
    try:
        user_id = await verify_token(authorization)
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        ai_service = get_ai_intelligence_service()
        
        # Extract skills
        result = await ai_service.extract_skills_from_bio(
            bio_text=request.bio_text,
            experience_band=request.experience_band,
            email=user_id
        )
        
        logger.info(f"[INTELLIGENCE] Extracted {len(result.get('primary_skills', []))} skills for {user_id}")
        
        return {
            "status": "success",
            "data": result,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"[INTELLIGENCE] Error in skill extraction: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/career-fit/calculate")
async def calculate_career_fit_score(
    request: CareerFitRequest,
    authorization: str = Header(None),
    db = Depends(get_db)
):
    """
    Calculate comprehensive career fit score
    Called during/after onboarding to show personalized career insights
    
    Shows:
    - Job readiness score
    - Skill alignment
    - Experience alignment
    - Specific gaps to address
    - Development timeline
    - Market insights
    
    Option 1: Quick score (30 seconds)
    Option 2: Full analysis (60 seconds)
    
    Returns: {overall_fit_score, job_readiness, gaps, recommendations, timeline}
    """
    print(f"\n[ENDPOINT] POST /intelligence/career-fit/calculate")
    print(f"[ENDPOINT] Target role: {request.target_role}, Full analysis: {request.include_full_analysis}")
    
    try:
        user_id = await verify_token(authorization)
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        # Get candidate profile
        profile = db.query(CandidateProfile).filter(
            CandidateProfile.user_id == user_id
        ).first()
        
        if not profile:
            raise HTTPException(status_code=404, detail="Candidate profile not found")
        
        ai_service = get_ai_intelligence_service()
        
        # Build profile dict
        profile_dict = {
            "user_id": str(profile.user_id),
            "experience": profile.experience,
            "years_of_experience": profile.years_of_experience,
            "skills": profile.skills,
            "education": profile.education_history,
            "target_role": request.target_role or profile.target_role,
            "career_interests": profile.career_interests,
            "long_term_goal": profile.long_term_goal,
            "expected_salary": profile.expected_salary
        }
        
        # Calculate fit
        result = await ai_service.calculate_career_fit(
            candidate_profile=profile_dict,
            target_role=request.target_role
        )
        
        logger.info(f"[INTELLIGENCE] Career fit score for {user_id}: {result.get('overall_fit_score', 0)}/100")
        
        return {
            "status": "success",
            "data": result,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"[INTELLIGENCE] Error in career fit: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/recommendations/personalized")
async def get_personalized_recommendations(
    request: PersonalizedRecommendationsRequest,
    authorization: str = Header(None),
    db = Depends(get_db)
):
    """
    Generate personalized next-step recommendations
    Shown at end of onboarding to guide user's next actions
    
    Includes:
    - This week's action items
    - Skill development plan with resources
    - Interview prep tips
    - Networking suggestions
    - Timeline milestones
    
    Returns: {immediate_actions, skill_development, interview_prep, networking, timeline}
    """
    print(f"\n[ENDPOINT] POST /intelligence/recommendations/personalized")
    print(f"[ENDPOINT] Career stage: {request.career_stage}")
    
    try:
        user_id = await verify_token(authorization)
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        # Get candidate profile
        profile = db.query(CandidateProfile).filter(
            CandidateProfile.user_id == user_id
        ).first()
        
        if not profile:
            raise HTTPException(status_code=404, detail="Candidate profile not found")
        
        ai_service = get_ai_intelligence_service()
        
        # Build current answers
        current_answers = {
            "experience": profile.experience,
            "target_role": profile.target_role,
            "career_interests": profile.career_interests,
            "long_term_goal": profile.long_term_goal
        }
        
        # Generate recommendations
        result = await ai_service.generate_personalized_recommendations(
            career_stage=request.career_stage,
            current_answers=current_answers,
            skills=profile.skills
        )
        
        logger.info(f"[INTELLIGENCE] Generated recommendations for {user_id}")
        
        return {
            "status": "success",
            "data": result,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"[INTELLIGENCE] Error in recommendations: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# NEW: TIER 2 - EXPANDED AI INTELLIGENCE
# ============================================================================

@router.post("/skills/recommend-learning-path")
async def recommend_skills(
    authorization: str = Header(None),
    current_skills: Optional[List[str]] = None,
    target_role: Optional[str] = None,
    experience_band: str = "mid",
    db = Depends(get_db)
):
    """
    Recommend what skills to learn next to reach target role
    
    Returns:
    {
        "current_strengths": [...],
        "skill_gaps": [{skill, importance, effort_weeks}, ...],
        "learning_path": [{phase, duration, resources}, ...],
        "timeline_to_ready": "12 weeks",
        "market_demand": "Very High"
    }
    """
    print(f"\n[ENDPOINT] POST /intelligence/skills/recommend-learning-path")
    
    try:
        user_id = await verify_token(authorization)
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        profile = db.query(CandidateProfile).filter(
            CandidateProfile.user_id == user_id
        ).first()
        
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")
        
        ai_service = get_ai_intelligence_service()
        
        result = await ai_service.recommend_skills_to_learn(
            current_skills=current_skills or profile.skills or [],
            target_role=target_role or profile.target_role or "Next Level",
            experience_band=experience_band,
            years_of_experience=profile.years_of_experience or 0
        )
        
        logger.info(f"[INTELLIGENCE] Skill recommendation generated for {user_id}")
        
        return {
            "status": "success",
            "data": result,
            "timestamp": datetime.utcnow().isoformat()
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"[INTELLIGENCE] Error in skill recommendations: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/career-vision/5-year-path")
async def generate_career_vision(
    authorization: str = Header(None),
    target_role: Optional[str] = None,
    aspirations: Optional[str] = None,
    db = Depends(get_db)
):
    """
    Generate 5-year career progression path with salary and milestone projections
    
    Returns:
    {
        "5_year_path": [{year, role, salary_range, focus}, ...],
        "milestones": [...],
        "skills_per_year": {...},
        "industry_insights": {...}
    }
    """
    print(f"\n[ENDPOINT] POST /intelligence/career-vision/5-year-path")
    
    try:
        user_id = await verify_token(authorization)
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        profile = db.query(CandidateProfile).filter(
            CandidateProfile.user_id == user_id
        ).first()
        
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")
        
        ai_service = get_ai_intelligence_service()
        
        result = await ai_service.generate_career_vision(
            current_role=profile.current_role or "Professional",
            current_experience=profile.years_of_experience or 0,
            industry=profile.primary_industry_focus or "Technology",
            aspirations=aspirations or profile.long_term_goal
        )
        
        logger.info(f"[INTELLIGENCE] 5-year career vision generated for {user_id}")
        
        return {
            "status": "success",
            "data": result,
            "timestamp": datetime.utcnow().isoformat()
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"[INTELLIGENCE] Error in career vision: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/education/validate")
async def validate_education(
    authorization: str = Header(None),
    degree: str = None,
    college: str = None,
    gpa: Optional[float] = None,
    graduation_year: Optional[int] = None,
    db = Depends(get_db)
):
    """
    Validate and analyze educational background
    Provides insights on:
    - Degree strength and relevance
    - College tier ranking
    - Relevant career paths
    - How to leverage education in job search
    
    Returns:
    {
        "validation_status": "valid",
        "degree_strength": "Strong",
        "college_tier": "Tier 1",
        "relevant_roles": [...],
        "recommendations": [...]
    }
    """
    print(f"\n[ENDPOINT] POST /intelligence/education/validate")
    print(f"[ENDPOINT] College: {college}, Degree: {degree}")
    
    try:
        user_id = await verify_token(authorization)
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        ai_service = get_ai_intelligence_service()
        
        result = await ai_service.validate_education(
            degree=degree or "Bachelor's",
            college=college or "Not Specified",
            gpa=gpa,
            graduation_year=graduation_year
        )
        
        logger.info(f"[INTELLIGENCE] Education validated for {user_id}")
        
        return {
            "status": "success",
            "data": result,
            "timestamp": datetime.utcnow().isoformat()
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"[INTELLIGENCE] Error in education validation: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/experience/analyze-timeline")
async def analyze_experience_timeline(
    authorization: str = Header(None),
    experience_entries: List[Dict[str, Any]] = None,
    db = Depends(get_db)
):
    """
    Analyze career timeline for gaps, progression, and strengths
    Detects:
    - Career progression quality
    - Employment gaps
    - Industry transitions
    - Interview talking points
    - Red flags to address
    
    Returns:
    {
        "career_progression": "Strong upward",
        "total_experience_years": 5.5,
        "detected_gaps": [],
        "progression_analysis": {...},
        "interview_talking_points": [...],
        "recommendations": [...]
    }
    """
    print(f"\n[ENDPOINT] POST /intelligence/experience/analyze-timeline")
    print(f"[ENDPOINT] Analyzing {len(experience_entries or [])} experience entries")
    
    try:
        user_id = await verify_token(authorization)
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        if not experience_entries:
            raise HTTPException(status_code=400, detail="No experience entries provided")
        
        ai_service = get_ai_intelligence_service()
        
        result = await ai_service.analyze_experience_timeline(
            experience_entries=experience_entries
        )
        
        logger.info(f"[INTELLIGENCE] Experience timeline analyzed for {user_id}")
        
        return {
            "status": "success",
            "data": result,
            "timestamp": datetime.utcnow().isoformat()
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"[INTELLIGENCE] Error in experience analysis: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# INTERACTIVE ROLE SUGGESTION ENDPOINTS
# ============================================================================

class ResumeAnalysisRequest(BaseModel):
    skills: List[str] = Field(default=[], description="List of candidate skills")
    experience: List[Dict[str, Any]] = Field(default=[], description="Work experience entries")
    education: List[Dict[str, Any]] = Field(default=[], description="Education entries")
    bio: str = Field(default="", description="Professional summary")
    years_of_experience: int = Field(default=0, description="Total years in industry")

@router.post("/resume/suggest-roles")
async def suggest_target_roles(
    request: ResumeAnalysisRequest,
    authorization: str = Header(None),
    db = Depends(get_db)
):
    """
    Analyze resume and suggest 3 target IT tech sales roles
    Shows fit percentage, reasoning, salary, timeline, and required skills
    
    Returns:
    {
        "suggested_roles": [
            {
                "role": "Sales Engineer",
                "fit_percentage": 87,
                "reasoning": "...",
                "market_demand": "Very High 🔥",
                "salary_range": "₹45-60L",
                "key_strengths": [...],
                "skill_gaps": [...],
                "timeline_to_ready": "2-3 months"
            }
        ]
    }
    """
    try:
        user_id = await verify_token(authorization)
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        ai_service = get_ai_intelligence_service()
        
        resume_data = {
            "skills": request.skills,
            "experience": request.experience,
            "education": request.education,
            "bio": request.bio,
            "years_of_experience": request.years_of_experience
        }
        
        result = await ai_service.suggest_target_roles(resume_data)
        
        logger.info(f"[INTELLIGENCE] Suggested roles for {user_id}")
        
        return {
            "status": "success",
            "data": result,
            "timestamp": datetime.utcnow().isoformat()
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"[INTELLIGENCE] Error suggesting roles: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


class SkillRankingRequest(BaseModel):
    available_skills: List[str] = Field(description="Skills candidate has")
    target_role: str = Field(description="Target sales role")

@router.post("/skills/rank-for-role")
async def rank_skills_for_role(
    request: SkillRankingRequest,
    authorization: str = Header(None),
    db = Depends(get_db)
):
    """
    Rank candidate's skills by importance for their target tech sales role
    
    Returns:
    {
        "critical": ["Skill1", "Skill2", ...],
        "important": ["Skill3", ...],
        "good_to_have": ["Skill4", ...]
    }
    """
    try:
        user_id = await verify_token(authorization)
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        ai_service = get_ai_intelligence_service()
        
        result = await ai_service.rank_skills_for_role(
            available_skills=request.available_skills,
            target_role=request.target_role
        )
        
        logger.info(f"[INTELLIGENCE] Ranked skills for {user_id} - {request.target_role}")
        
        return {
            "status": "success",
            "data": result,
            "timestamp": datetime.utcnow().isoformat()
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"[INTELLIGENCE] Error ranking skills: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


class GoalAlignmentRequest(BaseModel):
    target_role: str = Field(description="AI-suggested target role")
    user_vision: str = Field(description="User's stated career vision")
    current_experience: int = Field(default=0, description="Years of experience")

@router.post("/career/check-alignment")
async def check_goal_alignment(
    request: GoalAlignmentRequest,
    authorization: str = Header(None),
    db = Depends(get_db)
):
    """
    Check if user's stated vision aligns with AI-suggested target role
    Suggests optimal path if misaligned
    
    Returns:
    {
        "is_aligned": bool,
        "reasoning": str,
        "timeline_comparison": str,
        "recommendation": str
    }
    """
    try:
        user_id = await verify_token(authorization)
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        ai_service = get_ai_intelligence_service()
        
        result = await ai_service.check_goal_alignment(
            target_role=request.target_role,
            user_vision=request.user_vision,
            current_experience=request.current_experience
        )
        
        logger.info(f"[INTELLIGENCE] Checked alignment for {user_id}")
        
        return {
            "status": "success",
            "data": result,
            "timestamp": datetime.utcnow().isoformat()
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"[INTELLIGENCE] Error checking alignment: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# HEALTH CHECK
# ============================================================================

@router.get("/health")
async def health_check():
    """
    Check if AI Intelligence service is operational
    """
    try:
        service = get_ai_intelligence_service()
        return {
            "status": "healthy",
            "service": "AI Intelligence",
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "service": "AI Intelligence",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }
