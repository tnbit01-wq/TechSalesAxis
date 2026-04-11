from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
from src.core.dependencies import get_current_user
from src.core.database import get_db
from src.core.models import CandidateProfile, CareerReadinessHistory
from src.schemas.career_readiness import (
    CareerReadinessSaveRequest,
    CareerReadinessResponse,
    CareerReadinessUpdateRequest,
    CareerReadinessMetadataResponse,
    CareerReadinessFilterRequest,
    build_career_readiness_metadata
)
from typing import List, Optional

router = APIRouter(prefix="/career-readiness", tags=["career-readiness"])


@router.post("/save")
async def save_career_readiness(
    request: CareerReadinessSaveRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Save candidate's Career Readiness profile during onboarding.
    This captures: employment status, job search mode, notice period, and preferences.
    """
    user_id = user["sub"]
    try:
        # Get or create candidate profile
        profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == user_id).first()
        
        if not profile:
            print(f"[NEW] Creating new CandidateProfile for user_id: {user_id}")
            # Create new profile if it doesn't exist
            given_name = user.get("given_name", "")
            family_name = user.get("family_name", "")
            full_name = f"{given_name} {family_name}".strip() if given_name or family_name else "Unnamed Candidate"
            
            profile = CandidateProfile(
                user_id=user_id,
                full_name=full_name,
                experience="fresher",  # Default experience level
                onboarding_step="AWAITING_CAREER_READINESS",
            )
            db.add(profile)
            db.flush()  # Flush to generate ID
        
        print(f"[SAVE] Saving career readiness for user_id: {profile.user_id}")
        
        # Calculate availability date
        availability_date = None
        if request.notice_period_days is not None:
            availability_date = datetime.now(timezone.utc) + timedelta(days=request.notice_period_days)
        
        # Build metadata
        metadata = {
            "exploration_trigger": request.exploration_trigger or "initial_onboarding",
            "willing_to_relocate": request.willing_to_relocate,
            "contract_preference": request.contract_preference,
            "visa_sponsorship_needed": request.visa_sponsorship_needed,
            "salary_flexibility": request.salary_flexibility,
            "target_market_segment": request.target_market_segment or "any"
        }
        
        # Update candidate profile with correct field names
        profile.current_employment_status = request.employment_status  # Fixed: was employment_status (doesn't exist)
        profile.job_search_mode = request.job_search_mode
        profile.notice_period_days = request.notice_period_days
        profile.availability_date = availability_date
        profile.willing_to_relocate = request.willing_to_relocate
        profile.career_readiness_timestamp = datetime.now(timezone.utc)
        profile.career_readiness_metadata = metadata
        profile.onboarding_step = "AWAITING_RESUME"  # Move to next step after career readiness
        
        if request.current_company_name:
            profile.current_company_name = request.current_company_name
        
        db.commit()
        db.refresh(profile)
        
        print(f"[SUCCESS] Career readiness saved successfully. Profile updated to step: {profile.onboarding_step}")
        
        return {
            "status": "saved",
            "job_search_mode": profile.job_search_mode,
            "notice_period_days": profile.notice_period_days,
            "availability_date": profile.availability_date.isoformat() if profile.availability_date else None,
            "immediate_joiner": profile.notice_period_days == 0
        }
    
    except HTTPException as he:
        raise he
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to save career readiness: {str(e)}")


@router.get("/current")
async def get_career_readiness(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get candidate's current Career Readiness profile with metadata.
    Includes calculated fields like availability date and revertification status.
    """
    user_id = user["sub"]
    try:
        profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == user_id).first()
        if not profile:
            raise HTTPException(status_code=404, detail="Candidate profile not found")
        
        # Build response
        response = CareerReadinessResponse(
            employment_status=profile.current_employment_status or "Unknown",
            job_search_mode=profile.job_search_mode or "exploring",
            notice_period_days=profile.notice_period_days,
            availability_date=profile.availability_date,
            willing_to_relocate=profile.willing_to_relocate,
            contract_preference=profile.career_readiness_metadata.get("contract_preference", "fulltime") if profile.career_readiness_metadata else "fulltime",
            visa_sponsorship_needed=profile.career_readiness_metadata.get("visa_sponsorship_needed", False) if profile.career_readiness_metadata else False,
            salary_flexibility=profile.career_readiness_metadata.get("salary_flexibility", 0.5) if profile.career_readiness_metadata else 0.5,
            exploration_trigger=profile.career_readiness_metadata.get("exploration_trigger") if profile.career_readiness_metadata else None,
            target_market_segment=profile.career_readiness_metadata.get("target_market_segment") if profile.career_readiness_metadata else "any",
            current_company_name=profile.current_company_name,
            career_readiness_timestamp=profile.career_readiness_timestamp or datetime.now(timezone.utc),
            days_until_revertification=max(0, 15 - ((datetime.now(timezone.utc) - (profile.career_readiness_timestamp or datetime.now(timezone.utc))).days))
        )
        
        return response
    
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch career readiness: {str(e)}")


@router.get("/metadata")
async def get_career_readiness_metadata(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get extended metadata about candidate's career readiness.
    Includes recruiter visibility, notification frequency, and immediate joiner status.
    """
    user_id = user["sub"]
    try:
        profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == user_id).first()
        if not profile:
            raise HTTPException(status_code=404, detail="Candidate profile not found")
        
        metadata = build_career_readiness_metadata(profile)
        return metadata
    
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch metadata: {str(e)}")


@router.patch("/update")
async def update_career_readiness(
    request: CareerReadinessUpdateRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update any field of Career Readiness profile.
    Can be called anytime from dashboard, stores update history.
    """
    user_id = user["sub"]
    try:
        profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == user_id).first()
        if not profile:
            raise HTTPException(status_code=404, detail="Candidate profile not found")
        
        old_mode = profile.job_search_mode
        old_notice = profile.notice_period_days
        
        # Update fields if provided
        if request.job_search_mode:
            profile.job_search_mode = request.job_search_mode
        
        if request.notice_period_days is not None:
            profile.notice_period_days = request.notice_period_days
            # Recalculate availability date
            profile.availability_date = datetime.now(timezone.utc) + timedelta(days=request.notice_period_days)
        
        if request.willing_to_relocate is not None:
            profile.willing_to_relocate = request.willing_to_relocate
        
        if request.employment_status:
            profile.current_employment_status = request.employment_status
        
        # Always update timestamp
        profile.career_readiness_timestamp = datetime.now(timezone.utc)
        
        db.commit()
        db.refresh(profile)
        
        return {
            "status": "updated",
            "job_search_mode": profile.job_search_mode,
            "notice_period_days": profile.notice_period_days,
            "availability_date": profile.availability_date.isoformat() if profile.availability_date else None,
            "immediate_joiner": profile.notice_period_days == 0,
            "changes": {
                "mode_changed": old_mode != profile.job_search_mode,
                "notice_period_changed": old_notice != profile.notice_period_days
            }
        }
    
    except HTTPException as he:
        raise he
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update career readiness: {str(e)}")


@router.get("/candidates-for-recruiter")
async def get_candidates_for_recruiter(
    filters: CareerReadinessFilterRequest = Depends(),
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = 50,
    offset: int = 0
):
    """
    Recruiter endpoint to find candidates based on Career Readiness filters.
    Supports filtering by:
    - Job search mode (active, passive, exploring)
    - Notice period / availability window
    - Immediate joiners only
    - Relocation willingness
    - Visa sponsorship status
    """
    try:
        query = db.query(CandidateProfile)
        
        # Filter by job search modes
        if filters.job_search_modes:
            query = query.filter(CandidateProfile.job_search_mode.in_(filters.job_search_modes))
        
        # Filter by notice period / availability window
        if filters.max_notice_period_days is not None:
            query = query.filter(CandidateProfile.notice_period_days <= filters.max_notice_period_days)
        
        # Filter for immediate joiners only
        if filters.immediate_joiners_only:
            query = query.filter(CandidateProfile.notice_period_days == 0)
        
        # Filter by relocation
        if filters.willing_to_relocate is not None:
            query = query.filter(CandidateProfile.willing_to_relocate == filters.willing_to_relocate)
        
        # Filter by visa sponsorship
        if filters.visa_sponsorship_required is not None:
            query = query.filter(
                CandidateProfile.career_readiness_metadata['visa_sponsorship_needed'].astext.cast(bool) == filters.visa_sponsorship_required
            )
        
        # Apply pagination
        total_count = query.count()
        candidates = query.order_by(
            CandidateProfile.notice_period_days.asc(),  # Immediate joiners first
            CandidateProfile.job_search_mode.desc()  # Then active, then passive, then exploring
        ).offset(offset).limit(limit).all()
        
        result = []
        for candidate in candidates:
            metadata = build_career_readiness_metadata(candidate)
            result.append({
                "user_id": str(candidate.user_id),
                "full_name": candidate.full_name,
                "current_role": candidate.current_role,
                "location": candidate.location,
                "job_search_mode": candidate.job_search_mode,
                "immediate_joiner": candidate.notice_period_days == 0,
                "notice_period_days": candidate.notice_period_days,
                "availability_date": candidate.availability_date.isoformat() if candidate.availability_date else None,
                "willing_to_relocate": candidate.willing_to_relocate,
                "metadata": metadata.dict()
            })
        
        return {
            "total_count": total_count,
            "limit": limit,
            "offset": offset,
            "candidates": result
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch candidates: {str(e)}")


@router.post("/revertify-prompt")
async def check_revertification_needed(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Check if candidate needs to revertify their Career Readiness status.
    Returns True if >15 days since last update.
    """
    user_id = user["sub"]
    try:
        profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == user_id).first()
        if not profile:
            raise HTTPException(status_code=404, detail="Candidate profile not found")
        
        now = datetime.now(timezone.utc)
        last_update = profile.career_readiness_timestamp or profile.created_at
        
        # Convert naive datetime to aware if needed
        if last_update.tzinfo is None:
            last_update = last_update.replace(tzinfo=timezone.utc)
        
        days_since_update = (now - last_update).days
        needs_revertification = days_since_update > 15
        
        return {
            "needs_revertification": needs_revertification,
            "days_since_update": days_since_update,
            "last_updated": last_update.isoformat()
        }
    
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to check revertification: {str(e)}")
