import os
import logging
from datetime import datetime, timedelta
from src.celery_app import celery_app
from src.core.database import SessionLocal
from src.core.models import User, CandidateProfile, RecruiterProfile, Notification
from src.services.email_service import send_profile_completion_reminder_email
from src.services.notification_service import NotificationService

logger = logging.getLogger(__name__)

@celery_app.task(name="src.tasks.profile_alerts.send_profile_completion_reminders")
def send_profile_completion_reminders():
    """
    Scans user profiles registered 3, 7, and 14 days ago.
    Sends reminder emails if their profile completion is < 85%,
    or if they have pending assessments (candidates).
    """
    logger.info("Starting profile completion and assessment reminder scan...")
    db = SessionLocal()
    try:
        now = datetime.utcnow()
        # Define thresholds (days since created_at)
        thresholds = [3, 7, 14]
        
        for days in thresholds:
            # We look for users created within a window around 'days' ago
            # E.g. between (days) and (days + 1) days ago.
            start_date = now - timedelta(days=days + 1)
            end_date = now - timedelta(days=days)
            
            logger.info(f"Scanning users created between {start_date} and {end_date} ({days} days ago)...")
            
            users = db.query(User).filter(
                User.created_at >= start_date,
                User.created_at < end_date
            ).all()
            
            for user in users:
                # Prevent sending duplicate reminders for the same interval
                notif_type = f"PROFILE_REMINDER_{days}D"
                existing_notif = db.query(Notification).filter(
                    Notification.user_id == user.id,
                    Notification.notification_type == notif_type
                ).first()
                
                if existing_notif:
                    logger.info(f"User {user.email} already received the {days}-day reminder. Skipping.")
                    continue
                
                if user.role == "candidate":
                    profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == user.id).first()
                    if not profile:
                        continue
                        
                    completion = profile.completion_score or 0
                    assessment = (profile.assessment_status or "not_started").strip().lower()
                    
                    # Check if profile is incomplete or assessment pending
                    is_incomplete = completion < 85
                    has_pending_assessment = assessment != "completed"
                    
                    # Gather missing fields
                    missing = []
                    if not profile.phone_number: missing.append("Phone Number")
                    if not profile.resume_path: missing.append("Resume Document")
                    if not profile.skills: missing.append("Skills List")
                    if not profile.linkedin_url: missing.append("LinkedIn URL")
                    if not profile.bio: missing.append("Professional Summary (Bio)")
                    
                    if is_incomplete or has_pending_assessment or missing:
                        logger.info(f"Sending {days}-day reminder to Candidate {user.email} (Completion: {completion}%, Assessment: {assessment})")
                        
                        # Create notification in DB
                        NotificationService.create_notification(
                            user_id=user.id,
                            type=notif_type,
                            title="Complete Your Profile Setup",
                            message=f"Take a moment to complete your profile ({completion}% completed) and stand out to top hiring teams.",
                            db=db
                        )
                        
                        # Send email
                        try:
                            send_profile_completion_reminder_email(
                                recipient=user.email,
                                user_name=profile.full_name or user.full_name or "Candidate",
                                role="candidate",
                                completion_score=completion,
                                missing_fields=missing,
                                has_pending_assessment=has_pending_assessment
                            )
                        except Exception as e:
                            logger.error(f"Failed to send email to {user.email}: {e}")
                            
                elif user.role == "recruiter":
                    profile = db.query(RecruiterProfile).filter(RecruiterProfile.user_id == user.id).first()
                    if not profile:
                        continue
                        
                    completion = profile.completion_score or 0
                    
                    # Check if profile is incomplete
                    is_incomplete = completion < 85
                    
                    # Gather missing fields
                    missing = []
                    if not profile.phone_number: missing.append("Phone Number")
                    if not profile.company_id: missing.append("Company Association")
                    if not profile.linkedin_url: missing.append("LinkedIn URL")
                    if not profile.job_title: missing.append("Job Title")
                    
                    if is_incomplete or missing:
                        logger.info(f"Sending {days}-day reminder to Recruiter {user.email} (Completion: {completion}%)")
                        
                        # Create notification in DB
                        NotificationService.create_notification(
                            user_id=user.id,
                            type=notif_type,
                            title="Complete Your Recruiter Profile",
                            message=f"Complete your recruiter profile ({completion}% completed) to verify your company and connect with elite sales talent.",
                            db=db
                        )
                        
                        # Send email
                        try:
                            send_profile_completion_reminder_email(
                                recipient=user.email,
                                user_name=profile.full_name or user.full_name or "Recruiter",
                                role="recruiter",
                                completion_score=completion,
                                missing_fields=missing,
                                has_pending_assessment=False
                            )
                        except Exception as e:
                            logger.error(f"Failed to send email to {user.email}: {e}")
                            
    except Exception as e:
        logger.error(f"Error executing profile reminders task: {e}")
    finally:
        db.close()
