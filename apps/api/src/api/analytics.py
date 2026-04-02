"""Analytics API endpoints for TALENTFLOW."""
from fastapi import APIRouter, HTTPException, Request, Depends
from sqlalchemy.orm import Session
from uuid import UUID
from typing import List, Dict, Optional
from src.core.dependencies import get_db, get_current_user
from src.services.analytics_service import AnalyticsService
from src.core.models import Job, ProfileAnalytics

router = APIRouter(tags=["analytics"], prefix="/analytics")


# Job View Endpoints

@router.post("/jobs/{job_id}/view")
def log_job_view(
    job_id: UUID,
    request: Request,
    db: Session = Depends(get_db)
):
    """Log a candidate viewing a job posting - No auth required for analytics."""
    # Extract user info from request headers if available
    auth_header = request.headers.get("authorization", "")
    candidate_id = None
    
    if auth_header and auth_header.startswith("Bearer "):
        # If we have auth, try to decode it (but don't fail if we don't)
        try:
            from src.core.auth_utils import decode_access_token
            token = auth_header.split(" ")[1]
            payload = decode_access_token(token)
            candidate_id = payload.get("sub")
        except Exception as decode_err:
            print(f"⚠️  Could not decode auth token: {decode_err}")
    
    viewer_ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "unknown")
    user_agent = request.headers.get("user-agent", "unknown")
    
    try:
        print(f"📊 Analytics: Logging job view - job_id={job_id}, candidate_id={candidate_id}")
        view = AnalyticsService.log_job_view(
            db=db,
            job_id=job_id,
            candidate_id=candidate_id,
            viewer_ip=viewer_ip,
            user_agent=user_agent
        )
        print(f"✅ Job view logged successfully: {view.id}")
        return {
            "status": "success",
            "message": "Job view logged",
            "view_id": str(view.id)
        }
    except Exception as e:
        print(f"❌ Failed to log job view: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/jobs/{job_id}/stats")
def get_job_view_stats(
    job_id: UUID,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get job view statistics for a specific job."""
    try:
        # Verify the job belongs to the recruiter
        job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        
        if str(job.recruiter_id) != user.get("sub"):
            raise HTTPException(status_code=403, detail="Unauthorized")
        
        stats = AnalyticsService.get_job_view_stats(db=db, job_id=job_id)
        return {
            "job_id": str(job_id),
            "stats": stats
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Profile Analytics Endpoints

@router.post("/profile/event")
def log_profile_event(
    candidate_id: UUID,
    event_type: str,
    job_id: UUID = None,
    metadata: Dict = None,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Log a profile analytics event (used by recruiters viewing candidate profiles)."""
    recruiter_id = user.get("sub")
    
    try:
        event = AnalyticsService.log_profile_analytics(
            db=db,
            candidate_id=candidate_id,
            recruiter_id=recruiter_id,
            event_type=event_type,
            job_id=job_id,
            metadata=metadata
        )
        return {
            "status": "success",
            "message": f"{event_type} event logged",
            "event_id": str(event.id)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/profile/{candidate_id}/analytics")
def get_candidate_profile_analytics(
    candidate_id: UUID,
    days: int = 30,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get analytics for a candidate's profile (for the candidate themselves)."""
    # Verify the candidate is viewing their own profile
    if str(candidate_id) != user.get("sub"):
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    try:
        analytics = AnalyticsService.get_candidate_profile_analytics(
            db=db,
            candidate_id=candidate_id,
            days=days
        )
        return {
            "candidate_id": str(candidate_id),
            "period_days": days,
            "analytics": analytics
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/recruiter/activities")
def get_recruiter_analytics(
    days: int = 30,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get analytics for a recruiter's activities."""
    recruiter_id = user.get("sub")
    
    try:
        analytics = AnalyticsService.get_recruiter_profile_analytics(
            db=db,
            recruiter_id=recruiter_id,
            days=days
        )
        return {
            "recruiter_id": recruiter_id,
            "period_days": days,
            "analytics": analytics
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Candidate-Job Sync/Match Endpoints

@router.post("/sync/candidate-job-match")
def sync_candidate_job_match(
    candidate_id: UUID,
    job_id: UUID,
    match_score: float,
    match_explanation: str = "",
    missing_skills: List[str] = None,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create or update a candidate-job match sync record."""
    # Only allow if user is admin or the candidate themselves
    user_id = user.get("sub")
    if str(candidate_id) != user_id and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    try:
        sync = AnalyticsService.sync_candidate_job_matches(
            db=db,
            candidate_id=candidate_id,
            job_id=job_id,
            match_score=match_score,
            match_explanation=match_explanation,
            missing_skills=missing_skills
        )
        return {
            "status": "success",
            "message": "Match sync updated",
            "sync_id": str(sync.id),
            "match_score": float(sync.overall_match_score)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/candidate/{candidate_id}/matched-jobs")
def get_candidate_matched_jobs(
    candidate_id: UUID,
    min_match_score: float = 0.0,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all matched jobs for a candidate."""
    # Allow if fetching for self or if admin/recruiter with permission
    user_id = user.get("sub")
    if str(candidate_id) != user_id and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    try:
        matched_jobs = AnalyticsService.get_matched_jobs_for_candidate(
            db=db,
            candidate_id=candidate_id,
            min_match_score=min_match_score
        )
        return {
            "candidate_id": str(candidate_id),
            "total_matches": len(matched_jobs),
            "matches": matched_jobs
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/batch/sync-job-matches")
def batch_sync_job_matches(
    job_id: UUID,
    matches: List[Dict],
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Batch sync matches for all candidates for a specific job."""
    # Only recruiters can perform batch operations
    if user.get("role") != "recruiter":
        raise HTTPException(status_code=403, detail="Only recruiters can perform batch operations")
    
    try:
        results = AnalyticsService.batch_sync_job_matches(
            db=db,
            job_id=job_id,
            matches_data=matches
        )
        return {
            "status": "success",
            "job_id": str(job_id),
            "syncs_created": len(results),
            "message": f"Synced {len(results)} candidate-job matches"
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
