from typing import List, Dict, Optional
from datetime import datetime, timezone, timedelta
import uuid
import pytz
from sqlalchemy.orm import Session
from sqlalchemy import text
from src.core.database import SessionLocal
from src.core.models import JobApplication, Job, Interview, InterviewSlot
from src.schemas.interview import (
    InterviewProposeRequest, 
    InterviewStatus, 
    InterviewFormat
)

class InterviewService:
    @staticmethod
    async def propose_interview(user_id: str, request: InterviewProposeRequest, db: Session):
        # 1. Verify application exists
        app = db.query(JobApplication).filter(JobApplication.id == request.application_id).first()
        if not app:
            raise ValueError("Application not found")
        
        job = db.query(Job).filter(Job.id == app.job_id).first()
        if not job or str(job.recruiter_id) != str(user_id):
            raise ValueError("Unauthorized: You do not manage this job")

        # 2. Create Interview Record
        room_id = f"tf-{uuid.uuid4().hex[:8]}" if request.format == InterviewFormat.VIRTUAL else None
        meeting_link = f"https://meet.jit.si/{room_id}" if room_id else None
        
        new_interview = Interview(
            job_id=app.job_id,
            candidate_id=app.candidate_id,
            recruiter_id=user_id,
            application_id=request.application_id,
            round_name=request.round_name,
            round_number=request.round_number,
            format=request.format,
            location=request.location,
            meeting_link=meeting_link,
            interviewer_names=request.interviewer_names,
            status=InterviewStatus.PENDING
        )
        db.add(new_interview)
        db.flush()

        # 3. Create Slots
        for slot in request.slots:
            new_slot = InterviewSlot(
                interview_id=new_interview.id,
                start_time=slot.start_time,
                end_time=slot.end_time
            )
            db.add(new_slot)

        # 4. Notify Candidate
        from src.services.notification_service import NotificationService
        NotificationService.create_notification(
            user_id=app.candidate_id,
            type="INTERVIEW_PROPOSED",
            title="Interview Invitation",
            message=f"A recruiter has proposed an interview for {job.title}. Please select a time slot.",
            metadata={
                "interview_id": str(new_interview.id),
                "application_id": str(request.application_id),
                "job_title": job.title
            },
            db=db
        )
        
        db.commit()
        db.refresh(new_interview)

        # Explicitly map to dictionary to ensure UUID -> string conversion for the response
        return {
            "id": str(new_interview.id),
            "job_id": str(new_interview.job_id),
            "candidate_id": str(new_interview.candidate_id),
            "recruiter_id": str(new_interview.recruiter_id),
            "application_id": str(new_interview.application_id),
            "status": new_interview.status,
            "round_name": new_interview.round_name,
            "round_number": new_interview.round_number,
            "format": new_interview.format,
            "meeting_link": new_interview.meeting_link,
            "location": new_interview.location,
            "interviewer_names": new_interview.interviewer_names or [],
            "feedback": getattr(new_interview, "feedback", None),
            "cancellation_reason": getattr(new_interview, "cancellation_reason", None),
            "candidate_joined_at": new_interview.candidate_joined_at,
            "recruiter_joined_at": new_interview.recruiter_joined_at,
            "created_at": new_interview.created_at,
            "updated_at": new_interview.updated_at,
            "slots": [
                {
                    "id": str(s.id),
                    "interview_id": str(s.interview_id),
                    "start_time": s.start_time,
                    "end_time": s.end_time,
                    "is_selected": s.is_selected,
                    "status": s.status,
                    "created_at": s.created_at
                } for s in new_interview.slots
            ] if hasattr(new_interview, "slots") else []
        }

    @staticmethod
    async def confirm_slot(user_id: str, slot_id: str, db: Session):
        # 1. Get slot
        slot = db.query(InterviewSlot).filter(InterviewSlot.id == slot_id).first()
        if not slot:
            raise ValueError("Slot not found")
            
        interview = db.query(Interview).filter(Interview.id == slot.interview_id).first()
        if not interview:
            raise ValueError("Interview record not found")
        
        # Verify ownership (candidate must be the one confirming)
        if str(interview.candidate_id) != str(user_id):
            raise ValueError("Unauthorized: This interview is not assigned to you")
        
        # 2. Update Slot selection
        slot.is_selected = True
        slot.status = "selected" 
        print(f"DEBUG CONFIRM: Slot {slot_id} marked as is_selected=True")
        
        # Mark other slots as NOT selected (available/rejected)
        db.query(InterviewSlot).filter(
            InterviewSlot.interview_id == slot.interview_id, 
            InterviewSlot.id != slot_id
        ).update({"is_selected": False, "status": "not_selected"})

        # Update ALL slots to be selected=False first for this interview to be absolutely sure
        db.execute(text("UPDATE interview_slots SET is_selected = False, status = 'not_selected' WHERE interview_id = :iid"), {"iid": slot.interview_id})
        # Then set the correct one
        db.execute(text("UPDATE interview_slots SET is_selected = True, status = 'selected' WHERE id = :sid"), {"sid": slot_id})

        # 3. Update Interview Status
        interview.status = InterviewStatus.SCHEDULED
        print(f"DEBUG CONFIRM: Interview {interview.id} status set to {interview.status}")
        
        # 4. Update Job Application Status
        app = db.query(JobApplication).filter(JobApplication.id == interview.application_id).first()
        if app:
            app.status = "interview_scheduled"
            print(f"DEBUG CONFIRM: Application {app.id} status set to {app.status}")
            # Explicitly set last_interaction_at if it exists (legacy support)
            try:
                if hasattr(app, "last_interaction_at"):
                    app.last_interaction_at = datetime.utcnow()
            except Exception:
                pass
        
        # NEW: Force commit before notifications to ensure UI sees the data
        db.commit()
        db.refresh(slot)
        db.refresh(interview)

        # 5. Notify Recruiter (Critical for smooth flow)
        try:
            from src.services.notification_service import NotificationService
            from src.core.models import User
            import pytz
            
            # Try to get candidate name for a better message
            candidate = db.query(User).filter(User.id == user_id).first()
            candidate_name = candidate.email.split('@')[0] if candidate else "A candidate"
            
            print(f"DEBUG: Notifying recruiter {interview.recruiter_id} about confirmation from {candidate_name}")

            # Convert UTC slot time to IST (Asia/Kolkata)
            ist = pytz.timezone('Asia/Kolkata')
            start_ist = slot.start_time.replace(tzinfo=pytz.UTC).astimezone(ist)
            
            notif = NotificationService.create_notification(
                user_id=interview.recruiter_id,
                type="INTERVIEW_CONFIRMED",
                title="Interview Confirmed",
                message=f"{candidate_name} matches your transmission! {interview.round_name} scheduled for {start_ist.strftime('%d/%m/%Y, %I:%M %p')} IST.",
                metadata={
                    "interview_id": str(interview.id),
                    "slot_id": str(slot.id),
                    "application_id": str(interview.application_id),
                    "start_time": slot.start_time.isoformat()
                },
                db=db
            )
            print(f"DEBUG: Notification creation triggered.")
        except Exception as e:
            print(f"NOTIFICATION ERROR: {e}")
            # Don't fail the whole transaction if notification fails
        
        # Second commit for notification record
        db.commit()
        return {
            "status": "success",
            "message": "Interview slot confirmed",
            "interview_id": str(interview.id),
            "new_status": interview.status
        }

    @staticmethod
    async def get_user_interviews(user_id: str, role: str, db: Session):
        if role == "recruiter":
            interviews = db.query(Interview).filter(Interview.recruiter_id == user_id).all()
        else:
            interviews = db.query(Interview).filter(Interview.candidate_id == user_id).all()
        
        results = []
        for i in interviews:
            results.append({
                "id": str(i.id),
                "job_id": str(i.job_id),
                "candidate_id": str(i.candidate_id),
                "recruiter_id": str(i.recruiter_id),
                "application_id": str(i.application_id),
                "status": i.status,
                "round_name": i.round_name,
                "round_number": i.round_number,
                "format": i.format,
                "meeting_link": i.meeting_link,
                "location": i.location,
                "interviewer_names": i.interviewer_names or [],
                "feedback": getattr(i, "feedback", None),
                "cancellation_reason": getattr(i, "cancellation_reason", None),
                "candidate_joined_at": i.candidate_joined_at,
                "recruiter_joined_at": i.recruiter_joined_at,
                "created_at": i.created_at,
                "updated_at": i.updated_at,
                "slots": [
                    {
                        "id": str(s.id),
                        "interview_id": str(s.interview_id),
                        "start_time": s.start_time,
                        "end_time": s.end_time,
                        "is_selected": s.is_selected,
                        "status": s.status,
                        "created_at": s.created_at
                    } for s in i.slots
                ] if hasattr(i, "slots") else []
            })
        return results

    @staticmethod
    async def cancel_interview(user_id: str, interview_id: str, reason: str, role: str, db: Session):
        interview = db.query(Interview).filter(Interview.id == interview_id).first()
        if not interview:
            raise ValueError("Interview not found")
        
        # Check permissions
        if role == "recruiter" and str(interview.recruiter_id) != str(user_id):
            raise ValueError("Unauthorized")
        if role == "candidate" and str(interview.candidate_id) != str(user_id):
            raise ValueError("Unauthorized")
            
        interview.status = "cancelled"
        # Optional: Log reason
        db.commit()
        return {"status": "cancelled"}

    @staticmethod
    async def submit_feedback(user_id: str, interview_id: str, feedback: str, next_status: str, db: Session):
        interview = db.query(Interview).filter(Interview.id == interview_id).first()
        if not interview or str(interview.recruiter_id) != str(user_id):
            raise ValueError("Unauthorized or interview not found")
        
        # PROOF OF CONDUCT CHECK - FAIR TO BOTH PARTIES
        # Recruiter MUST join to submit any meaningful feedback (Passed/Failed rounds)
        if not interview.recruiter_joined_at:
            if next_status == "not_conducted":
                # Allow "not_conducted" if recruiter didn't show up
                # This stays regardless of whether candidate joined - it logs a technical/absence issue on recruiter's side
                pass
            else:
                # For all other decisions (offered, shortlisted, rejected), recruiter MUST have joined
                raise ValueError("PROTOCOL ERROR: You must join the interview to submit evaluation results. If you couldn't attend, select 'Not Conducted' instead.")
        
        # Candidate must have attended for normal decisions
        if next_status not in ["no_show", "not_conducted"]:
            if not interview.candidate_joined_at:
                raise ValueError("PROTOCOL ERROR: System has no record of the candidate joining. Select 'No Show' if they didn't attend, or 'Not Conducted' if you want to reschedule.")

        # 1. Update Interview Record
        interview.feedback = feedback
        interview.status = "completed"
        interview.updated_at = datetime.utcnow()

        # 2. Update Application Status & Feedback
        app = db.query(JobApplication).filter(JobApplication.id == interview.application_id).first()
        if app:
            # Map frontend decisions to application statuses
            # Decisions: 'offered', 'rejected', 'shortlisted' (for next round), 'no_show', 'not_conducted'
            if next_status == "offered":
                app.status = "offered"
            elif next_status == "rejected":
                app.status = "rejected"
            elif next_status == "shortlisted":
                app.status = "shortlisted" # Back to shortlisted to allow scheduling next round
            elif next_status == "no_show":
                app.status = "rejected"  # No-show is treated as rejection
            elif next_status == "not_conducted":
                app.status = "shortlisted"  # Not conducted returns to shortlisted to reschedule
            
            app.feedback = feedback
            if hasattr(app, "last_interaction_at"):
                app.last_interaction_at = datetime.utcnow()

        # 3. Notify Candidate
        from src.services.notification_service import NotificationService
        status_titles = {
            "offered": "Missions Accomplished: Job Offer Received!",
            "rejected": "Application Update: Project Status",
            "shortlisted": "Round Cleared! Ready for next transmission",
            "no_show": "Interview Status: Candidate No-Show Recorded",
            "not_conducted": "Interview Rescheduled: Technical Issues Resolved"
        }
        
        # Create detailed messages for each decision type
        decision_messages = {
            "offered": f"Great news! You've been offered a position for {interview.round_name}. Detailed feedback: {feedback}",
            "rejected": f"Thank you for interviewing for {interview.round_name}. Feedback: {feedback}",
            "shortlisted": f"Congratulations! You've advanced to {interview.round_name}. Next steps will be shared soon.",
            "no_show": f"Your absence was noted for {interview.round_name}. Please contact the recruiter to reschedule.",
            "not_conducted": f"Your {interview.round_name} interview will be rescheduled due to technical issues. Thank you for your patience."
        }
        
        NotificationService.create_notification(
            user_id=interview.candidate_id,
            type="INTERVIEW_DECISION",
            title=status_titles.get(next_status, "Interview Feedback Logged"),
            message=decision_messages.get(next_status, f"Recruiter has logged feedback for your {interview.round_name}: {feedback}"),
            metadata={
                "interview_id": str(interview.id),
                "application_id": str(interview.application_id),
                "decision": next_status,
                "feedback": feedback,
                "round_name": interview.round_name
            },
            db=db
        )
        
        db.commit()
        return {"status": "feedback_submitted", "next_app_status": app.status if app else None}

    @staticmethod
    async def register_join_event(user_id: str, interview_id: str, role: str, db: Session):
        interview = db.query(Interview).filter(Interview.id == interview_id).first()
        if not interview:
            raise ValueError("Interview not found")
        
        # --- Timezone Integrity Check ---
        ist = pytz.timezone('Asia/Kolkata')
        now_ist = datetime.now(ist)
        
        # Check if the join is within the permitted window (1h before, 4h after)
        slot = db.query(InterviewSlot).filter(
            InterviewSlot.interview_id == interview.id,
            InterviewSlot.is_selected == True
        ).first()
        
        if slot:
            # Ensure slot times are aware
            start_time = slot.start_time
            if start_time.tzinfo is None:
                start_time = pytz.UTC.localize(start_time).astimezone(ist)
            else:
                start_time = start_time.astimezone(ist)
                
            end_time = slot.end_time
            if end_time.tzinfo is None:
                end_time = pytz.UTC.localize(end_time).astimezone(ist)
            else:
                end_time = end_time.astimezone(ist)

            # --- UTC Normalization for Comparison ---
            now_utc = datetime.now(timezone.utc)
            slot_start_utc = slot.start_time.replace(tzinfo=timezone.utc) if slot.start_time.tzinfo is None else slot.start_time.astimezone(timezone.utc)
            slot_end_utc = slot.end_time.replace(tzinfo=timezone.utc) if slot.end_time.tzinfo is None else slot.end_time.astimezone(timezone.utc)

            # PROTOCOL: Join opens exactly 15m before START until exactly 5m AFTER start
            # RELAXED JOIN PROTOCOL: Join opens 15m before START until 5m AFTER start
            # NEW PROTOCOL: Join opens 15m before START until 5m AFTER start
            # ALSO: Cannot join after end_time if start_time + 5m is exceeds end_time, 
            # but if meeting is going and exceeded end time its okay (if they already joined)
            # The constraint is on the "Join" action itself.
            
            allowed_start_utc = slot_start_utc - timedelta(minutes=15)
            # Join remains open until 5m after start OR until the official end time
            # Whichever is earlier? No, user said "cannot join after end time"
            # So: min(start + 5m, end_time)
            allowed_end_utc = min(slot_start_utc + timedelta(minutes=5), slot_end_utc)

            # Log for debugging
            print(f"DEBUG JOIN: User {user_id} ({role}) joining at {now_utc}. Window: {allowed_start_utc} to {allowed_end_utc}")

            if now_utc < allowed_start_utc:
                raise ValueError(f"Wait Protocol Active: You can only join 15 minutes before the start time.")
            
            if now_utc > allowed_end_utc:
                if now_utc > slot_end_utc:
                    raise ValueError("Meeting Expired: The scheduled end time has passed. Joining is no longer permitted.")
                else:
                    raise ValueError("Late Protocol Active: The join window closed 5 minutes after the scheduled start.")

        # Update Join Timestamps
        if role == "candidate":
            interview.candidate_joined_at = datetime.utcnow()
        else:
            interview.recruiter_joined_at = datetime.utcnow()

        # Notify the other party
        target_id = interview.recruiter_id if role == "candidate" else interview.candidate_id
        
        from src.services.notification_service import NotificationService
        # Check if user is candidate or recruiter for custom message
        target_label = "Recruiter" if role == "candidate" else "Candidate"
        sender_label = "Candidate" if role == "candidate" else "Recruiter"

        NotificationService.create_notification(
            user_id=target_id,
            type="USER_JOINED_MEETING",
            title=f"{sender_label} is Waiting",
            message=f"The {sender_label.lower()} has entered the interview room and is waiting for you to join.",
            metadata={
                "interview_id": str(interview.id),
                "role": role,
                "action": "JOIN_STREAMS"
            },
            db=db
        )
        
        db.commit()
        return {"status": "success", "message": f"{target_label} notified of your arrival."}

interview_service = InterviewService()
