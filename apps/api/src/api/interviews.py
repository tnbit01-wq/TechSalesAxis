from fastapi import APIRouter, Depends, HTTPException
from typing import List
from sqlalchemy.orm import Session
from src.core.dependencies import get_current_user
from src.core.database import get_db
from src.services.interview_service import interview_service
from src.schemas.interview import (
    InterviewProposeRequest, 
    InterviewConfirmRequest, 
    InterviewCancelRequest,
    InterviewFeedbackRequest,
    InterviewResponse
)

router = APIRouter(prefix="/interviews", tags=["interviews"])

@router.post("/propose", response_model=InterviewResponse)
async def propose_interview(
    request: InterviewProposeRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Recruiter proposes an interview with slots."""
    print(f"DEBUG PROPOSE: User {user.get('sub')} (email: {user.get('email')}) has role {user.get('role')}")
    if user.get("role") != "recruiter":
        raise HTTPException(status_code=403, detail="Only recruiters can propose interviews")
    
    try:
        return await interview_service.propose_interview(user["sub"], request, db)
    except ValueError as e:
        print(f"DEBUG PROPOSE ERROR: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/confirm", response_model=dict)
async def confirm_interview(
    request: InterviewConfirmRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Candidate confirms one of the slots."""
    if user.get("role") != "candidate":
        raise HTTPException(status_code=403, detail="Only candidates can confirm slots")
    
    try:
        return await interview_service.confirm_slot(user["sub"], request.slot_id, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{interview_id}/cancel")
async def cancel_interview(
    interview_id: str,
    request: InterviewCancelRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Cancel an interview."""
    try:
        return await interview_service.cancel_interview(
            user["sub"], 
            interview_id, 
            request.reason, 
            user.get("role"),
            db
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{interview_id}/feedback")
async def submit_feedback(
    interview_id: str,
    request: InterviewFeedbackRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Submit feedback and decide on next steps."""
    if user.get("role") != "recruiter":
        raise HTTPException(status_code=403, detail="Only recruiters can submit feedback")
    
    try:
        return await interview_service.submit_feedback(
            user["sub"], 
            interview_id, 
            request.feedback, 
            request.next_status,
            db
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{interview_id}/join-event")
async def register_join(
    interview_id: str,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Notify the other party that a user has joined the meeting."""
    try:
        return await interview_service.register_join_event(
            user["sub"],
            interview_id,
            user.get("role", "candidate"),
            db
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/my", response_model=List[InterviewResponse])
async def get_my_interviews(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Fetch all interviews for the current user."""
    user_id = user["sub"]
    role = user.get("role")
    
    try:
        return await interview_service.get_user_interviews(user_id, role, db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

