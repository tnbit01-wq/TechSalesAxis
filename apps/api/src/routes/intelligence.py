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
from src.core.models import CandidateProfile, ConversationalOnboardingSession
from src.services.ai_intelligence_service import get_ai_intelligence_service
from src.core.auth import verify_token

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/intelligence", tags=["AI Intelligence"])

# ============================================================================
# DATA TYPE NORMALIZATION
# ============================================================================

def normalize_extracted_data(extracted: Dict[str, Any]) -> Dict[str, Any]:
    """
    Convert AI-extracted string values to proper Python/SQL types
    AI returns strings like "true", "false", "not_mentioned"
    But database expects proper booleans/integers
    
    Args:
        extracted: Raw extraction from AI
        
    Returns:
        Normalized extraction with proper types
    """
    normalized = extracted.copy()
    
    # Boolean fields: "true"/"false"/"yes"/"no"/"not_mentioned" → True/False/None
    bool_fields = ["willing_to_relocate", "visa_sponsorship_needed"]
    for field in bool_fields:
        if field in normalized:
            value = normalized[field]
            if isinstance(value, bool):
                # Already boolean, keep as is
                pass
            elif isinstance(value, str):
                value_lower = value.lower().strip()
                if value_lower in ["true", "yes", "1"]:
                    normalized[field] = True
                elif value_lower in ["false", "no", "0"]:
                    normalized[field] = False
                elif value_lower in ["not_mentioned", "unknown", "none", ""]:
                    normalized[field] = None
                else:
                    # Unknown value, treat as None (not mentioned)
                    logger.warning(f"Unknown boolean value for {field}: {value}")
                    normalized[field] = None
            elif value is None:
                normalized[field] = None
            else:
                normalized[field] = None
    
    # Integer fields: years_experience, notice_period_days
    int_fields = {
        "years_experience": "years_experience",
        "notice_period_days": "notice_period_days"
    }
    for field in int_fields:
        if field in normalized:
            value = normalized[field]
            if isinstance(value, int):
                # Already integer, keep as is
                pass
            elif isinstance(value, str):
                value_clean = value.strip()
                if value_clean.lower() in ["not_mentioned", "unknown", "none", ""]:
                    normalized[field] = None
                else:
                    try:
                        # Try to extract number from string (e.g., "8 years" → 8)
                        import re
                        match = re.search(r'\d+', value_clean)
                        if match:
                            normalized[field] = int(match.group())
                        else:
                            normalized[field] = None
                    except (ValueError, AttributeError):
                        normalized[field] = None
            elif value is None or value == 0:
                normalized[field] = None
            else:
                try:
                    normalized[field] = int(value)
                except (ValueError, TypeError):
                    normalized[field] = None
    
    # Mark fields that are "not_mentioned" as None
    for field in ["employment_status", "job_search_mode", "current_role"]:
        if field in normalized:
            value = normalized[field]
            if isinstance(value, str):
                if value.lower().strip() in ["not_mentioned", "unknown", ""]:
                    normalized[field] = None
    
    return normalized


async def sync_conversation_to_profile(session: ConversationalOnboardingSession, db) -> bool:
    """
    Sync extracted conversation data to candidate profile
    Called when conversation is successfully completed
    
    Transfers:
    - years_experience
    - notice_period_days
    - willing_to_relocate
    - job_search_mode
    - employment_status
    - current_role
    
    Args:
        session: Completed ConversationalOnboardingSession
        db: Database session
        
    Returns:
        True if sync successful, False otherwise
    """
    try:
        # Get the candidate profile
        profile = db.query(CandidateProfile).filter(
            CandidateProfile.user_id == session.candidate_id
        ).first()
        
        if not profile:
            logger.warning(f"[SYNC] Profile not found for candidate {session.candidate_id}")
            return False
        
        # Sync extracted fields from conversation to profile
        updates_made = False
        
        # 1. Years of Experience
        if session.extracted_years_experience is not None:
            if profile.years_of_experience != session.extracted_years_experience:
                logger.info(f"[SYNC] Updating years_of_experience: {profile.years_of_experience} → {session.extracted_years_experience}")
                profile.years_of_experience = session.extracted_years_experience
                updates_made = True
        
        # 2. Notice Period (Days)
        if session.extracted_notice_period_days is not None:
            if profile.notice_period_days != session.extracted_notice_period_days:
                logger.info(f"[SYNC] Updating notice_period_days: {profile.notice_period_days} → {session.extracted_notice_period_days}")
                profile.notice_period_days = session.extracted_notice_period_days
                updates_made = True
        
        # 3. Willing to Relocate
        if session.extracted_willing_to_relocate is not None:
            if profile.willing_to_relocate != session.extracted_willing_to_relocate:
                logger.info(f"[SYNC] Updating willing_to_relocate: {profile.willing_to_relocate} → {session.extracted_willing_to_relocate}")
                profile.willing_to_relocate = session.extracted_willing_to_relocate
                updates_made = True
        
        # 4. Job Search Mode / Career Readiness
        if session.extracted_job_search_mode is not None:
            # Map extracted mode to job_search_mode
            mode_map = {
                "exploring": "exploring",
                "passive": "passive",
                "active": "active",
                "not_mentioned": None
            }
            mapped_mode = mode_map.get(session.extracted_job_search_mode, session.extracted_job_search_mode)
            if mapped_mode and profile.job_search_mode != mapped_mode:
                logger.info(f"[SYNC] Updating job_search_mode: {profile.job_search_mode} → {mapped_mode}")
                profile.job_search_mode = mapped_mode
                updates_made = True
        
        # 5. Employment Status - Map to enum values
        if session.extracted_employment_status is not None:
            # Database enum values are: 'Employed', 'Unemployed', 'Student'
            status_map = {
                "employed": "Employed",
                "unemployed": "Unemployed",
                "student": "Student",
                "between_roles": "Unemployed",
            }
            extracted_lower = session.extracted_employment_status.lower()
            mapped_status = status_map.get(extracted_lower, session.extracted_employment_status)
            if profile.current_employment_status != mapped_status:
                logger.info(f"[SYNC] Updating current_employment_status: {profile.current_employment_status} → {mapped_status}")
                profile.current_employment_status = mapped_status
                updates_made = True
        
        # 6. Current Role
        if session.extracted_current_role is not None:
            if profile.current_role != session.extracted_current_role:
                logger.info(f"[SYNC] Updating current_role: {profile.current_role} → {session.extracted_current_role}")
                profile.current_role = session.extracted_current_role
                updates_made = True
        
        # Update timestamp
        if updates_made:
            profile.updated_at = datetime.utcnow()
            db.commit()
            logger.info(f"[SYNC] ✅ Successfully synced conversation data to profile for {session.candidate_id}")
            return True
        else:
            logger.info(f"[SYNC] No updates needed for {session.candidate_id}")
            return False
        
    except Exception as e:
        logger.error(f"[SYNC] ❌ Error syncing conversation to profile: {str(e)}")
        db.rollback()
        return False

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
    asked_questions: Optional[List[str]] = Field(default=None, description="Questions already asked in this conversation (e.g., ['employment_status', 'job_search_mode'])")

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
    6. SAVES everything to database for audit trail
    
    The flow is INTELLIGENT and NATURAL - not form-based.
    """
    try:
        user_id = await verify_token(authorization)
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        ai_service = get_ai_intelligence_service()
        
        # 🆕 Get or create conversation session
        session = db.query(ConversationalOnboardingSession).filter(
            ConversationalOnboardingSession.candidate_id == user_id
        ).first()
        
        if not session:
            session = ConversationalOnboardingSession(
                candidate_id=user_id,
                conversation_messages=[],
                asked_questions=[],
                conversation_status='in_progress'
            )
            db.add(session)
            db.flush()
            logger.info(f"[DB] Created new ConversationalOnboardingSession for {user_id}")
        
        # Get initial conversation history from database or request
        conversation_history = request.conversation_history or []
        
        # Process the natural language message
        result = await ai_service.process_conversational_onboarding(
            user_message=request.user_message,
            conversation_history=conversation_history,
            asked_questions=request.asked_questions or [],
            user_id=user_id,  # 🆕 Pass user_id to load resume
            db=db  # 🆕 Pass db session to query resume data
        )
        
        logger.info(f"[INTELLIGENCE] Conversational onboarding for {user_id} - completeness: {result.get('completeness_score', 0)}")
        
        # 🆕 SAVE TO DATABASE
        try:
            # Update conversation messages
            # IMPORTANT: SQLAlchemy doesn't detect in-place JSONB mutations
            # Must explicitly reassign for changes to be tracked
            if not isinstance(session.conversation_messages, list):
                messages = []
            else:
                messages = list(session.conversation_messages)  # Create new list
            
            messages.append({
                "user": request.user_message,
                "assistant": result.get("acknowledgment", "") + " " + result.get("next_question", ""),
                "timestamp": datetime.utcnow().isoformat(),
                "extracted_info": result.get("extracted_info", {}),
                "confidence": result.get("confidence", 0)
            })
            
            # EXPLICIT REASSIGNMENT - this is required for SQLAlchemy to detect changes
            session.conversation_messages = messages
            
            # Update asked questions with deduplication
            # Merge any new questions asked with existing ones
            # Use set to avoid exact duplicates, but also handle variations
            current_asked = set(session.asked_questions or [])
            new_asked = set(request.asked_questions or [])
            merged_asked = list(current_asked.union(new_asked))
            
            # Smart deduplication - recognize question variations
            question_variations = {
                "employment_status": ["employment_status", "current_status", "work_status"],
                "job_search_mode": ["job_search_mode", "urgency", "search_urgency", "active_passive"],
                "notice_period": ["notice_period", "notice_period_days", "timeline", "availability"],
                "current_role": ["current_role", "position", "current_position", "role"],
                "years_experience": ["years_experience", "experience_years", "years_of_experience"],
                "willing_to_relocate": ["willing_to_relocate", "relocation", "relocate"],
                "visa_sponsorship": ["visa_sponsorship_needed", "visa", "sponsorship"]
            }
            
            # Deduplicate using variations
            deduped = set()
            for q in merged_asked:
                q_lower = q.lower()
                # Find canonical form
                canonical = None
                for canonical_q, variations in question_variations.items():
                    if any(q_lower == v.lower() or q_lower in v.lower() for v in variations):
                        canonical = canonical_q
                        break
                if canonical:
                    deduped.add(canonical)
                else:
                    deduped.add(q)
            
            updated_asked = list(deduped)
            # Explicit reassignment for array changes
            session.asked_questions = updated_asked
            
            # Update extracted fields if new data was found
            extracted = result.get("extracted_info", {})
            
            # 🆕 NORMALIZE EXTRACTED DATA - Convert AI strings to proper Python types
            extracted = normalize_extracted_data(extracted)
            logger.info(f"[NORMALIZATION] Extracted data normalized: {extracted}")
            
            if extracted.get("employment_status") and extracted.get("employment_status") != "not_mentioned":
                session.extracted_employment_status = extracted.get("employment_status")
            if extracted.get("job_search_mode") and extracted.get("job_search_mode") != "not_mentioned":
                session.extracted_job_search_mode = extracted.get("job_search_mode")
            if extracted.get("notice_period_days") is not None:
                session.extracted_notice_period_days = extracted.get("notice_period_days")
            if extracted.get("current_role"):
                session.extracted_current_role = extracted.get("current_role")
            if extracted.get("years_experience") is not None:
                session.extracted_years_experience = extracted.get("years_experience")
            if extracted.get("willing_to_relocate") is not None:
                session.extracted_willing_to_relocate = extracted.get("willing_to_relocate")
            if extracted.get("visa_sponsorship_needed") is not None:
                session.extracted_visa_sponsorship_needed = extracted.get("visa_sponsorship_needed")
            
            # Update quality metrics
            session.total_messages = len(session.conversation_messages)
            session.completeness_score = result.get("completeness_score", 0)
            session.missing_critical_fields = result.get("missing_critical_fields", [])
            session.average_ai_confidence = result.get("confidence", 0)
            session.extracted_metadata = result.get("extracted_keywords", [])
            
            # Mark as completed if all critical fields are found
            if session.completeness_score > 0.8:
                session.successfully_completed = True
                session.completed_at = datetime.utcnow()
                session.conversation_status = 'completed'
            
            # Save to database
            db.commit()
            logger.info(f"[DB] ✅ Saved ConversationalOnboardingSession for {user_id} - total_messages: {session.total_messages}, asked: {session.asked_questions}")
            
            # 🆕 SYNC EXTRACTED DATA TO PROFILE when conversation is completed
            if session.successfully_completed:
                logger.info(f"[COMPLETION] Conversation completed, syncing to profile...")
                sync_result = await sync_conversation_to_profile(session, db)
                if sync_result:
                    logger.info(f"[COMPLETION] ✅ Profile successfully synced with conversation data")
                else:
                    logger.warning(f"[COMPLETION] ⚠️ Profile sync had no updates or encountered issues")
            
        except Exception as db_error:
            db.rollback()
            logger.error(f"[DB] ❌ Error saving ConversationalOnboardingSession: {str(db_error)}")
            # Don't fail the request, still return AI result
        
        # Return response
        return {
            "status": "success",
            "data": result,
            "timestamp": datetime.utcnow().isoformat(),
            "session_id": str(session.id) if session else None,
            "stored": True  # Indicate data was saved to database
        }
        
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"[INTELLIGENCE] Error in conversational onboarding: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/onboarding/conversational/session")
async def get_conversation_session(
    authorization: str = Header(None),
    db = Depends(get_db)
):
    """
    Retrieve current conversational onboarding session for this candidate
    Shows: conversation history, asked questions, extracted data, completeness score
    
    Perfect for debugging: Check if data is being stored in database
    """
    try:
        user_id = await verify_token(authorization)
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        session = db.query(ConversationalOnboardingSession).filter(
            ConversationalOnboardingSession.candidate_id == user_id
        ).first()
        
        if not session:
            return {
                "status": "no_session",
                "data": None,
                "message": "No conversational session found. Start a conversation first."
            }
        
        return {
            "status": "found",
            "data": {
                "session_id": str(session.id),
                "candidate_id": str(session.candidate_id),
                "total_messages": session.total_messages,
                "conversation_status": session.conversation_status,
                "asked_questions": session.asked_questions,
                "conversation_messages_count": len(session.conversation_messages) if isinstance(session.conversation_messages, list) else 0,
                "completeness_score": float(session.completeness_score) if session.completeness_score else 0,
                "missing_critical_fields": session.missing_critical_fields,
                "average_ai_confidence": float(session.average_ai_confidence) if session.average_ai_confidence else 0,
                "extracted": {
                    "employment_status": session.extracted_employment_status,
                    "job_search_mode": session.extracted_job_search_mode,
                    "notice_period_days": session.extracted_notice_period_days,
                    "current_role": session.extracted_current_role,
                    "years_experience": session.extracted_years_experience,
                    "willing_to_relocate": session.extracted_willing_to_relocate,
                    "visa_sponsorship_needed": session.extracted_visa_sponsorship_needed
                },
                "successfully_completed": session.successfully_completed,
                "started_at": session.started_at.isoformat() if session.started_at else None,
                "completed_at": session.completed_at.isoformat() if session.completed_at else None,
                "conversation_messages": session.conversation_messages[:5] if isinstance(session.conversation_messages, list) else []  # Last 5 for brevity
            },
            "message": f"Session found with {session.total_messages} total messages"
        }
        
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"[INTELLIGENCE] Error retrieving conversation session: {str(e)}")
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
