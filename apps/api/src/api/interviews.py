from fastapi import APIRouter, Depends, HTTPException, Request, Query
from fastapi.responses import RedirectResponse, HTMLResponse
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
    req: Request,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Candidate confirms one of the slots."""
    if user.get("role") != "candidate":
        raise HTTPException(status_code=403, detail="Only candidates can confirm slots")
    
    try:
        base_url = str(req.base_url).rstrip("/")
        return await interview_service.confirm_slot(user["sub"], request.slot_id, db, base_url=base_url)
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


@router.get("/{interview_id}/join-email")
async def join_meeting_from_email(
    interview_id: str,
    role: str,
    json_mode: bool = Query(False, alias="json"),
    db: Session = Depends(get_db)
):
    """Public redirect link for joining meetings directly from email, logging the join event."""
    from src.core.models import Interview, InterviewSlot
    from datetime import datetime, timedelta
    import uuid
    
    # Run dynamic expiration check
    interview_service.check_and_update_expired_interviews(db)
    
    interview = db.query(Interview).filter(Interview.id == interview_id).first()
    if not interview:
        if json_mode:
            raise HTTPException(status_code=404, detail="Interview record not found.")
        return HTMLResponse(
            content="""
            <!DOCTYPE html>
            <html>
            <head><title>Interview Not Found</title></head>
            <body style="font-family: Arial, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background: #F8FAFC;">
                <div style="background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); text-align: center;">
                    <h2 style="color: #EF4444;">Interview Not Found</h2>
                    <p style="color: #64748B;">The requested interview record could not be found.</p>
                </div>
            </body>
            </html>
            """,
            status_code=404
        )
        
    # Check if interview is in a closed state
    if interview.status in ["completed", "cancelled", "not_conducted", "no_show"]:
        if json_mode:
            raise HTTPException(status_code=400, detail=f"This interview room has been closed. Status: {interview.status.replace('_', ' ').title()}")
        status_label = interview.status.replace("_", " ").title()
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>Meeting Room Closed</title>
            <style>
                body {{ font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #F8FAFC; color: #1E293B; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }}
                .card {{ background: white; padding: 40px; border-radius: 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); text-align: center; max-width: 450px; border: 1px solid #E2E8F0; }}
                h1 {{ color: #64748B; margin-top: 0; font-size: 24px; font-weight: 800; }}
                p {{ color: #64748B; font-size: 14px; line-height: 1.6; margin-bottom: 24px; }}
                .status-badge {{ background-color: #F1F5F9; color: #475569; padding: 6px 12px; border-radius: 9999px; font-weight: bold; font-size: 12px; display: inline-block; margin-bottom: 20px; text-transform: uppercase; letter-spacing: 0.5px; }}
                .btn {{ background-color: #0F172A; color: white; padding: 12px 24px; border-radius: 12px; text-decoration: none; font-weight: bold; font-size: 13px; display: inline-block; transition: background 0.2s; }}
                .btn:hover {{ background-color: #1E293B; }}
            </style>
        </head>
        <body>
            <div class="card">
                <h1>Meeting Room Closed</h1>
                <div class="status-badge">Status: {status_label}</div>
                <p>This interview room has been closed. It is no longer open for active participants to join.</p>
                <a href="https://www.techsalesaxis.com" class="btn">Go to Homepage</a>
            </div>
        </body>
        </html>
        """
        return HTMLResponse(content=html_content, status_code=400)
        
    # Check if slot time has expired
    slot = db.query(InterviewSlot).filter(
        InterviewSlot.interview_id == interview.id,
        InterviewSlot.is_selected == True
    ).first()
    
    if slot:
        now_utc = datetime.utcnow()
        # Ensure timezone-naive comparison in UTC
        slot_start_utc = slot.start_time.replace(tzinfo=None)
        slot_end_utc = slot.end_time.replace(tzinfo=None)
        
        # Check if the scheduled end time has passed
        if now_utc > slot_end_utc:
            if json_mode:
                raise HTTPException(status_code=400, detail="This interview session has already ended.")
            html_content = """
            <!DOCTYPE html>
            <html>
            <head>
                <title>Meeting Link Expired</title>
                <style>
                    body { font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #F8FAFC; color: #1E293B; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                    .card { background: white; padding: 40px; border-radius: 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); text-align: center; max-width: 450px; border: 1px solid #E2E8F0; }
                    h1 { color: #E11D48; margin-top: 0; font-size: 24px; font-weight: 800; }
                    p { color: #64748B; font-size: 14px; line-height: 1.6; margin-bottom: 24px; }
                    .btn { background-color: #0F172A; color: white; padding: 12px 24px; border-radius: 12px; text-decoration: none; font-weight: bold; font-size: 13px; display: inline-block; transition: background 0.2s; }
                    .btn:hover { background-color: #1E293B; }
                </style>
            </head>
            <body>
                <div class="card">
                    <h1>Meeting Link Expired</h1>
                    <p>This interview session has already ended. Access to this meeting room is no longer permitted.</p>
                    <a href="https://www.techsalesaxis.com" class="btn">Go to Homepage</a>
                </div>
            </body>
            </html>
            """
            return HTMLResponse(content=html_content, status_code=400)
            
        # Check if locked (joining more than 15 minutes early)
        allowed_start_utc = slot_start_utc - timedelta(minutes=15)
        if now_utc < allowed_start_utc:
            import pytz
            ist = pytz.timezone('Asia/Kolkata')
            start_ist = slot.start_time.replace(tzinfo=pytz.UTC).astimezone(ist) if slot.start_time.tzinfo else pytz.UTC.localize(slot.start_time).astimezone(ist)
            start_str = start_ist.strftime('%d %b %Y, %I:%M %p IST')
            
            if json_mode:
                raise HTTPException(status_code=400, detail=f"This interview room is not open yet. You can join starting 15 minutes before the scheduled time. Scheduled Time: {start_str}")
            
            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <title>Meeting Room Locked</title>
                <style>
                    body {{ font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #F8FAFC; color: #1E293B; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }}
                    .card {{ background: white; padding: 40px; border-radius: 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); text-align: center; max-width: 450px; border: 1px solid #E2E8F0; }}
                    h1 {{ color: #FF8A00; margin-top: 0; font-size: 24px; font-weight: 800; }}
                    p {{ color: #64748B; font-size: 14px; line-height: 1.6; margin-bottom: 24px; }}
                    .btn {{ background-color: #0F172A; color: white; padding: 12px 24px; border-radius: 12px; text-decoration: none; font-weight: bold; font-size: 13px; display: inline-block; transition: background 0.2s; }}
                    .btn:hover {{ background-color: #1E293B; }}
                </style>
            </head>
            <body>
                <div class="card">
                    <h1>Meeting Room Locked</h1>
                    <p>This interview room is not open yet. You can join starting 15 minutes before the scheduled time.</p>
                    <p><strong>Scheduled Time:</strong><br/>{start_str}</p>
                    <a href="https://www.techsalesaxis.com" class="btn">Go to Homepage</a>
                </div>
            </body>
            </html>
            """
            return HTMLResponse(content=html_content, status_code=400)
            
    # Log the join timestamp
    if role == "candidate":
        interview.candidate_joined_at = datetime.utcnow()
    elif role == "recruiter":
        interview.recruiter_joined_at = datetime.utcnow()
    else:
        return HTMLResponse(content="<h2>Invalid role specified</h2>", status_code=400)
        
    # Notify the other party
    try:
        from src.services.notification_service import NotificationService
        target_id = interview.recruiter_id if role == "candidate" else interview.candidate_id
        sender_label = "Candidate" if role == "candidate" else "Recruiter"
        
        NotificationService.create_notification(
            user_id=target_id,
            type="USER_JOINED_MEETING",
            title=f"{sender_label} Joined Call",
            message=f"The {sender_label.lower()} has joined the interview room via email link.",
            metadata={
                "interview_id": str(interview.id),
                "role": role,
                "action": "JOIN_STREAMS"
            },
            db=db
        )
    except Exception as e:
        print(f"Error creating notification for join-email: {e}")
        
    db.commit()
    
    # Ensure a meeting link exists
    meeting_link = interview.meeting_link
    if not meeting_link:
        room_id = f"tf-{uuid.uuid4().hex[:8]}"
        meeting_link = f"https://meet.jit.si/{room_id}"
        interview.meeting_link = meeting_link
        db.commit()
        
    if json_mode:
        return {"meeting_link": meeting_link}
    return RedirectResponse(url=meeting_link)

