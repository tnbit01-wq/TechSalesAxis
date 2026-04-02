from fastapi import APIRouter, Depends, HTTPException, Body
from typing import List, Optional
from src.core.dependencies import get_current_user, get_db
from ..services.chat_service import ChatService
from ..services.notification_service import NotificationService
from sqlalchemy.orm import Session
from src.core.models import JobApplication, ChatThread, Job, Company, RecruiterProfile, ChatMessage

router = APIRouter(prefix="/chat", tags=["Chat"])

async def check_chat_permission(recruiter_id: str, candidate_id: str, db: Session):
    """
    Enforces status-based chat restrictions.
    Messaging is only allowed if the candidate is Shortlisted, Interviewing, or Offered.
    """
    # Check if recruiter's company has ANY application for this candidate in an advanced stage
    profile = db.query(RecruiterProfile).filter(RecruiterProfile.user_id == recruiter_id).first()
    if not profile or not profile.company_id:
        return False

    res = db.query(JobApplication).join(Job, JobApplication.job_id == Job.id)\
        .filter(
            JobApplication.candidate_id == candidate_id,
            JobApplication.status.in_(["shortlisted", "interview_scheduled", "offered"]),
            Job.company_id == profile.company_id
        ).all()
    
    return len(res) > 0

@router.post("/send")
async def send_message(
    content: str = Body(..., embed=True),
    thread_id: Optional[str] = Body(None),
    candidate_id: Optional[str] = Body(None),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Sends a message with lifecycle-based restrictions.
    """
    user_id = current_user.get("sub")
    role = current_user.get("role")

    # 1. Identify Target Thread or Create One
    target_thread_id = thread_id
    
    # If no thread_id, we need to find or create one using candidate_id/user_id
    if not target_thread_id:
        if role == "recruiter":
            if not candidate_id:
                raise HTTPException(status_code=400, detail="Recruiters must provide a candidate_id to initiate chat.")
            target_candidate_id = candidate_id
            target_recruiter_id = user_id
        else:
            # Candidate sending message - must have a thread_id from UI
            raise HTTPException(status_code=400, detail="Thread ID required for candidates.")

        # Get/Create thread
        thread_data = ChatService.get_or_create_thread(db, target_recruiter_id, target_candidate_id)
        target_thread_id = thread_data["id"]

    # 2. Status-Based Guardrail for Recruiters (Verify Permission)
    if role == "recruiter":
        # Identify candidate_id from thread if not provided
        check_candidate_id = candidate_id
        if not check_candidate_id:
            thread = db.query(ChatThread).filter(ChatThread.id == target_thread_id).first()
            if thread:
                check_candidate_id = str(thread.candidate_id)
        
        if check_candidate_id:
            has_permission = await check_chat_permission(user_id, check_candidate_id, db)
            if not has_permission:
                # Check if it's already an active thread (authorized previously)
                thread = db.query(ChatThread).filter(ChatThread.id == target_thread_id).first()
                if not thread or not thread.is_active:
                    raise HTTPException(
                        status_code=403, 
                        detail="Messaging restricted. You must shortlist the candidate or schedule an interview before initiating chat."
                    )
    
    # 3. Send Message
    try:
        message = ChatService.send_message(db, target_thread_id, user_id, content)
        return {"status": "success", "message": message}
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))

@router.get("/threads")
async def get_threads(
    show_archived: bool = False,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns chat threads for the logged-in user.
    """
    user_id = current_user.get("sub")
    role = current_user.get("role")
    threads = ChatService.get_user_threads(db, user_id, role, show_archived=show_archived)
    return threads

@router.get("/messages/{thread_id}")
async def get_messages(thread_id: str, limit: int = 50, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Returns message history for a thread.
    """
    messages = ChatService.get_thread_messages(db, thread_id, limit)
    return messages

@router.post("/report")
async def report_message(
    message_id: str = Body(..., embed=True),
    reason: str = Body(..., embed=True),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Reports a message for abuse.
    """
    user_id = current_user.get("sub")
    report = ChatService.report_message(db, message_id, user_id, reason)
    return {"status": "reported", "report_id": report["id"]}

@router.post("/thread")
async def create_thread(
    candidate_id: str = Body(..., embed=True),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user.get("sub")
    role = current_user.get("role")
    if role != "recruiter":
        raise HTTPException(status_code=403, detail="Only recruiters can create threads")
    return ChatService.get_or_create_thread(db, user_id, candidate_id)

@router.post("/archive/{thread_id}")
async def archive_thread(
    thread_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user.get("sub")
    role = current_user.get("role")
    thread = db.query(ChatThread).filter(ChatThread.id == thread_id).first()
    
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
        
    if role == "recruiter" and str(thread.recruiter_id) == str(user_id):
        thread.recruiter_archived = True
    elif role == "candidate" and str(thread.candidate_id) == str(user_id):
        thread.candidate_archived = True
    else:
        raise HTTPException(status_code=403, detail="Unauthorized to archive this thread")
        
    db.commit()
    return {"status": "archived"}

@router.post("/restore/{thread_id}")
async def restore_thread(
    thread_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user.get("sub")
    role = current_user.get("role")
    thread = db.query(ChatThread).filter(ChatThread.id == thread_id).first()
    
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
        
    if role == "recruiter" and str(thread.recruiter_id) == str(user_id):
        thread.recruiter_archived = False
    elif role == "candidate" and str(thread.candidate_id) == str(user_id):
        thread.candidate_archived = False
    else:
        raise HTTPException(status_code=403, detail="Unauthorized to restore this thread")
        
    db.commit()
    return {"status": "restored"}

@router.post("/delete/{thread_id}")
async def delete_thread(
    thread_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user.get("id") or current_user.get("sub")
    thread = db.query(ChatThread).filter(ChatThread.id == thread_id).first()
    if not thread or user_id not in {str(thread.recruiter_id), str(thread.candidate_id)}:
        raise HTTPException(status_code=404, detail="Thread not found")
    db.query(ChatMessage).filter(ChatMessage.thread_id == thread.id).delete()
    db.delete(thread)
    db.commit()
    return {"status": "deleted"}
