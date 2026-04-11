from fastapi import APIRouter, Depends, HTTPException
from src.core.dependencies import get_current_user
from src.services.assessment_service import assessment_service
from src.core.database import SessionLocal
from src.core.models import BlockedUser, AssessmentSession, CandidateProfile, AssessmentResponse
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from src.core.dependencies import get_db

router = APIRouter()

class AnswerSubmission(BaseModel):
    question_id: Optional[str] = None
    category: str
    answer: str
    difficulty: str
    is_skipped: bool = False
    metadata: dict = {}

@router.post("/start")
async def start_assessment(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    user_id = user["sub"]
    # Check if blocked
    blocked = db.query(BlockedUser).filter(BlockedUser.user_id == user_id).first()
    if blocked:
        raise HTTPException(status_code=403, detail="Your account has been permanently blocked due to security violations.")
    
    # Use await because the service methods are defined with async in some places or we want to remain consistent
    # Actually, the methods in assessment_service.py are NOT async for get_or_create_session
    session = assessment_service.get_or_create_session(user_id, db)
    return session

@router.get("/next")
async def get_next_question(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    user_id = user["sub"]
    # Check if blocked
    blocked = db.query(BlockedUser).filter(BlockedUser.user_id == user_id).first()
    if blocked:
        raise HTTPException(status_code=403, detail="Your account has been permanently blocked.")

    # Check session status first
    session = db.query(AssessmentSession).filter(AssessmentSession.candidate_id == user_id).first()
    if session and session.status == "completed":
        return {"status": "completed", "message": "Assessment already finished."}

    question = assessment_service.get_next_question(user_id, db)
    
    if not question:
        # Check if we should actually be done
        session = db.query(AssessmentSession).filter(AssessmentSession.candidate_id == user_id).first()
        if (session and session.current_step > session.total_budget):
             session.status = "completed"
             db.commit()
             return {"status": "completed", "message": "Assessment finished."}
             
        return {"status": "error", "message": "No more questions available for your experience level."}
        
    return question

@router.post("/submit")
async def submit_answer(submission: AnswerSubmission, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    user_id = user["sub"]
    # Check if blocked
    blocked = db.query(BlockedUser).filter(BlockedUser.user_id == user_id).first()
    if blocked:
        raise HTTPException(status_code=403, detail="Your account has been permanently blocked.")

    result = await assessment_service.submit_answer(
        user_id, 
        submission.question_id,
        submission.answer,
        db,
        is_skipped=submission.is_skipped
    )
    return result

@router.post("/tab-switch")
async def handle_tab_switch(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    user_id = user["sub"]
    
    # 1. Increment switch count in the session
    session = db.query(AssessmentSession).filter(AssessmentSession.candidate_id == user_id).first()
    
    if not session:
         return {"status": "error", "message": "No active session"}
    
    session.warning_count += 1
    db.commit()
    
    if session.warning_count >= 2:
        # BAN USER
        blocked = BlockedUser(
            user_id=user_id,
            reason="Security violation: Multiple tab switches during assessment."
        )
        db.add(blocked)
        
        # Update candidate status
        profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == user_id).first()
        if profile:
            profile.assessment_status = "disqualified"
        
        db.commit()
        
        return {"status": "blocked", "message": "Security violation detected. You have been permanently blocked. Any further access is denied."}
    
    return {"status": "warning", "message": "Final warning: Tab switching is strictly prohibited. Your next attempt will result in a permanent ban."}

@router.get("/results")
async def get_results(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    user_id = user["sub"]
    
    # 1. Fetch current session
    session = db.query(AssessmentSession).filter(AssessmentSession.candidate_id == user_id).first()
    return session

@router.post("/retake")
async def retake_assessment(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    user_id = user["sub"]
    # Check if blocked
    blocked = db.query(BlockedUser).filter(BlockedUser.user_id == user_id).first()
    if blocked:
        raise HTTPException(status_code=403, detail="Your account has been permanently blocked.")
        
    # delete current session and responses
    db.query(AssessmentResponse).filter(AssessmentResponse.candidate_id == user_id).delete()
    db.query(AssessmentSession).filter(AssessmentSession.candidate_id == user_id).delete()
    db.commit()
    
    return assessment_service.get_or_create_session(user_id, db)

# ========== ASSESSMENT QUEUE MANAGEMENT ENDPOINTS ==========

@router.get("/queue/status")
async def get_queue_status(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get the current assessment queue status for the logged-in user"""
    user_id = user["sub"]
    session = db.query(AssessmentSession).filter(AssessmentSession.candidate_id == user_id).first()
    
    if not session:
        return {"queue_priority": "none", "status": "not_started"}
    
    return {
        "queue_priority": session.queue_priority or "standard",
        "queue_priority_reason": session.queue_priority_reason,
        "status": session.status,
        "expected_completion_sla": session.expected_completion_sla.isoformat() if session.expected_completion_sla else None,
        "current_step": session.current_step,
        "total_budget": session.total_budget,
        "started_at": session.started_at.isoformat() if session.started_at else None,
    }

@router.get("/queue/summary")
async def get_queue_summary(db: Session = Depends(get_db)):
    """
    Get overall assessment queue summary (for admin/recruiter dashboards)
    Returns counts of candidates by queue priority and status
    """
    from sqlalchemy import func
    
    # Count by queue priority and status
    summary = db.query(
        AssessmentSession.queue_priority,
        AssessmentSession.status,
        func.count(AssessmentSession.id).label("count")
    ).group_by(
        AssessmentSession.queue_priority,
        AssessmentSession.status
    ).all()
    
    result = {
        "fast_track": {"started": 0, "completed": 0, "total": 0},
        "standard": {"started": 0, "completed": 0, "total": 0}
    }
    
    for row in summary:
        priority = row.queue_priority or "standard"
        status = row.status or "started"
        count = row.count
        
        if priority not in result:
            result[priority] = {"started": 0, "completed": 0, "total": 0}
        
        if status in result[priority]:
            result[priority][status] = count
        else:
            result[priority]["started"] = count
        
        result[priority]["total"] += count
    
    return result

@router.get("/queue/fast-track")
async def get_fast_track_candidates(db: Session = Depends(get_db)):
    """
    Get list of candidates in fast-track queue
    Returns candidates prioritized for urgent review
    """
    from datetime import datetime
    
    fast_track_sessions = db.query(AssessmentSession).filter(
        AssessmentSession.queue_priority == 'fast_track',
        AssessmentSession.status == 'started'
    ).order_by(
        AssessmentSession.expected_completion_sla
    ).all()
    
    candidates = []
    for session in fast_track_sessions:
        profile = db.query(CandidateProfile).filter(
            CandidateProfile.user_id == session.candidate_id
        ).first()
        
        if profile:
            minutes_remaining = None
            if session.expected_completion_sla:
                delta = session.expected_completion_sla - datetime.utcnow()
                minutes_remaining = int(delta.total_seconds() / 60)
            
            candidates.append({
                "user_id": str(session.candidate_id),
                "full_name": profile.full_name,
                "experience_band": session.experience_band,
                "queue_priority_reason": session.queue_priority_reason,
                "career_readiness_score": profile.career_readiness_score,
                "role_urgency_level": profile.role_urgency_level,
                "expected_completion_sla": session.expected_completion_sla.isoformat() if session.expected_completion_sla else None,
                "minutes_remaining": minutes_remaining,
                "started_at": session.started_at.isoformat() if session.started_at else None,
            })
    
    return candidates

