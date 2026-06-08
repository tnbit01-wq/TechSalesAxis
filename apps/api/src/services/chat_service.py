from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from src.core.database import SessionLocal
from src.core.models import ChatThread, ChatMessage, AssessmentSession, RecruiterProfile, JobApplication, Job, ChatReport, CandidateProfile
from sqlalchemy import or_, and_, desc
from src.services.s3_service import S3Service
from src.core.config import S3_BUCKET_NAME, AWS_REGION

def get_s3_url_with_fallback(file_path: Optional[str]) -> Optional[str]:
    """Get S3 URL with fallback to public URL if signed URL fails."""
    if not file_path:
        return None
    
    # Try to get signed URL first
    signed_url = S3Service.get_signed_url(file_path)
    if signed_url:
        return signed_url
    
    # Fallback to public S3 URL if signed URL fails
    if not file_path.startswith("http"):
        return f"https://{S3_BUCKET_NAME}.s3.{AWS_REGION}.amazonaws.com/{file_path}"
    
    return file_path

class ChatService:
    @staticmethod
    def get_or_create_thread(db: Session, recruiter_id: str, candidate_id: str) -> dict:
        """
        Retrieves an existing thread or creates a new one for the recruiter-candidate pair.
        """
        try:
            # Check for existing thread
            thread = db.query(ChatThread).filter(
                ChatThread.recruiter_id == recruiter_id,
                ChatThread.candidate_id == candidate_id
            ).first()

            if thread:
                if not thread.is_active:
                    thread.is_active = True
                    db.commit()
                return {
                    "id": str(thread.id),
                    "candidate_id": str(thread.candidate_id),
                    "recruiter_id": str(thread.recruiter_id),
                    "is_active": thread.is_active,
                    "last_message_at": thread.last_message_at.isoformat() if thread.last_message_at else None,
                    "created_at": thread.created_at.isoformat() if thread.created_at else None
                }

            # Create new thread
            new_thread = ChatThread(
                recruiter_id=recruiter_id,
                candidate_id=candidate_id,
                is_active=True
            )
            db.add(new_thread)
            db.commit()
            db.refresh(new_thread)
            return {
                "id": str(new_thread.id),
                "candidate_id": str(new_thread.candidate_id),
                "recruiter_id": str(new_thread.recruiter_id),
                "is_active": new_thread.is_active,
                "last_message_at": new_thread.last_message_at.isoformat() if new_thread.last_message_at else None,
                "created_at": new_thread.created_at.isoformat() if new_thread.created_at else None
            }
        except Exception as e:
            db.rollback()
            raise e

    @staticmethod
    async def send_message(db: Session, thread_id: str, sender_id: str, content: str) -> dict:
        """
        Sends a message within a thread.
        Includes a gate check for Behavioral and Psychometric assessment completion.
        """
        try:
            # 1. Fetch thread and candidate status
            thread = db.query(ChatThread).filter(ChatThread.id == thread_id).first()
            if not thread:
                raise ValueError("Thread not found")
            
            if not thread.is_active:
                raise ValueError("Cannot send message to an inactive thread.")

            candidate_id = thread.candidate_id
            recruiter_id = thread.recruiter_id

            # AI Safety Filter
            is_appropriate = True
            from src.services.recruiter_service import recruiter_service
            if recruiter_service.openai_key:
                safety_prompt = f"""
                Analyze the following chat message to determine if it is appropriate for a professional recruitment platform.
                Look for slurs, profanity, hate speech, spam, harassment, explicit sexual content, or general abuse.
                
                Message: "{content}"
                
                Respond with ONLY one word: "APPROPRIATE" or "INAPPROPRIATE".
                """
                try:
                    safety_result = await recruiter_service._call_ai(
                        safety_prompt,
                        "You are a professional chat moderator. Classify messages as APPROPRIATE or INAPPROPRIATE."
                    )
                    if "INAPPROPRIATE" in (safety_result or "").upper():
                        is_appropriate = False
                        print(f"DEBUG: Safety filter flagged message as INAPPROPRIATE: {content}")
                except Exception as safety_err:
                    print(f"ERROR running safety filter: {safety_err}")
            else:
                # Rule-based fallback check if OpenAI is not available
                lower_content = content.lower()
                inappropriate_keywords = [
                    "abuse", "harass", "fuck", "shit", "bitch", "asshole", "bastard", "nigger", "faggot", "retard",
                    "cunt", "dick", "pussy", "slut", "whore", "spam", "scam", "crypto double", "send money to", "cash prize"
                ]
                if any(kw in lower_content for kw in inappropriate_keywords):
                    is_appropriate = False
                    print(f"DEBUG: Safety filter flagged message via fallback keywords: {content}")

            if not is_appropriate:
                # Auto-report
                other_party_id = thread.candidate_id if sender_id == thread.recruiter_id else thread.recruiter_id
                try:
                    report = ChatReport(
                        reporter_id=other_party_id,
                        reported_id=sender_id,
                        reason=f"System Auto-Report: Inappropriate content blocked. Message: '{content}'"
                    )
                    db.add(report)
                    db.commit()
                except Exception as rep_err:
                    db.rollback()
                    print(f"ERROR saving auto-report: {rep_err}")
                
                raise ValueError("Message blocked: inappropriate content detected.")

            # 2. Gate Check: Behavioral & Psychometric scores must be >= 50 (DNA Gate)
            session = db.query(AssessmentSession).filter(AssessmentSession.candidate_id == candidate_id).first()
            
            dna_unlocked = False
            if session:
                if session.status == "completed":
                    scores = session.component_scores or {}
                    beh_score = scores.get("behavioral", 0)
                    psy_score = scores.get("psychometric", 0)
                    if beh_score >= 50 and psy_score >= 50:
                        dna_unlocked = True

            # 3. Contextual Status Check (Status Gate)
            recruiter = db.query(RecruiterProfile).filter(RecruiterProfile.user_id == recruiter_id).first()
            if not recruiter:
                raise ValueError("Recruiter context not found")
            company_id = recruiter.company_id

            # Fetch applications linked to this company
            unlocked_statuses = ['shortlisted', 'invited', 'interview_scheduled', 'offered', 'recommended']
            
            valid_apps = db.query(JobApplication).join(Job, JobApplication.job_id == Job.id)\
                .filter(
                    JobApplication.candidate_id == candidate_id,
                    Job.company_id == company_id,
                    JobApplication.status.in_(unlocked_statuses)
                ).all()

            context_unlocked = len(valid_apps) > 0

            # 4. Final Unlock Logic (OR)
            # If the recruiter is sending the message, or has already initiated contact in this thread, it is unlocked.
            recruiter_initiated = (sender_id == recruiter_id) or (
                db.query(ChatMessage).filter(
                    ChatMessage.thread_id == thread_id,
                    ChatMessage.sender_id == recruiter_id
                ).first() is not None
            )

            if recruiter_initiated:
                context_unlocked = True

            if not (dna_unlocked or context_unlocked):
                raise ValueError("Chat Locked: Communications unlock when Candidate DNA Score >= 50 OR Application is Shortlisted/Invited.")

            # 5. Classify candidate's first response to recruiter
            if sender_id == candidate_id:
                candidate_msg_count = db.query(ChatMessage).filter(
                    ChatMessage.thread_id == thread_id,
                    ChatMessage.sender_id == candidate_id
                ).count()

                recruiter_msg_count = db.query(ChatMessage).filter(
                    ChatMessage.thread_id == thread_id,
                    ChatMessage.sender_id == recruiter_id
                ).count()

                if candidate_msg_count == 0 and recruiter_msg_count > 0:
                    is_positive = True
                    from src.services.recruiter_service import recruiter_service
                    if recruiter_service.openai_key:
                        classification_prompt = f"""
                        Analyze the following message from a candidate in response to a recruiter's job invite.
                        Determine if the reply is positive (expressing interest, open to connect, scheduling a chat, interested) or negative (expressing disinterest, busy, already accepted another offer, rejecting the invite, no thanks).
                        
                        Candidate reply: "{content}"
                        
                        Respond with ONLY one word: "POSITIVE" or "NEGATIVE".
                        """
                        try:
                            result_text = await recruiter_service._call_ai(
                                classification_prompt,
                                "You are a recruitment classifier. Classify candidate responses as POSITIVE or NEGATIVE."
                            )
                            if "NEGATIVE" in (result_text or "").upper():
                                is_positive = False
                                print(f"DEBUG: Classified candidate reply as NEGATIVE: {content}")
                            else:
                                print(f"DEBUG: Classified candidate reply as POSITIVE: {content}")
                        except Exception as e:
                            print(f"ERROR classifying candidate response: {e}")
                    else:
                        # Fallback to simple keyword check
                        lower_content = content.lower()
                        negative_keywords = ["not interested", "no thanks", "reject", "decline", "busy", "unable", "cannot", "sorry", "accepted another", "no, thank you"]
                        if any(kw in lower_content for kw in negative_keywords):
                            is_positive = False
                            print(f"DEBUG: Classified candidate reply as NEGATIVE via keywords: {content}")

                    if not is_positive:
                        thread.is_active = False
                        # Set any active job applications linked to this company to 'rejected'
                        try:
                            if company_id:
                                active_apps = db.query(JobApplication).join(Job, JobApplication.job_id == Job.id)\
                                    .filter(
                                        JobApplication.candidate_id == candidate_id,
                                        Job.company_id == company_id,
                                        JobApplication.status.in_(['applied', 'shortlisted', 'interview_scheduled', 'recommended', 'invited', 'pending'])
                                    ).all()
                                for app in active_apps:
                                    app.status = 'rejected'
                                print(f"DEBUG: Set {len(active_apps)} applications to rejected due to candidate negative reply.")
                        except Exception as app_err:
                            print(f"ERROR setting applications to rejected: {app_err}")


            # Insert message
            new_msg = ChatMessage(
                thread_id=thread_id,
                sender_id=sender_id,
                text=content
            )
            db.add(new_msg)
            
            # Update thread's last_message_at
            thread.last_message_at = datetime.utcnow()
            
            db.commit()
            db.refresh(new_msg)
            
            # Explicitly construct the response to avoid UUID serialization issues
            m_dict = {
                "id": str(new_msg.id),
                "thread_id": str(new_msg.thread_id),
                "sender_id": str(new_msg.sender_id),
                "text": new_msg.text,
                "created_at": new_msg.created_at.isoformat() if new_msg.created_at else None,
                "is_read": new_msg.is_read
            }
            return m_dict
        except Exception as e:
            db.rollback()
            raise e

    @staticmethod
    def get_thread_messages(db: Session, thread_id: str, limit: int = 50) -> List[dict]:
        """
        Retrieves message history for a thread.
        """
        try:
            messages = db.query(ChatMessage)\
                .filter(ChatMessage.thread_id == thread_id)\
                .order_by(desc(ChatMessage.created_at))\
                .limit(limit)\
                .all()
            
            results = []
            for m in messages:
                m_dict = {
                    "id": str(m.id),
                    "thread_id": str(m.thread_id),
                    "sender_id": str(m.sender_id),
                    "text": m.text,
                    "created_at": m.created_at.isoformat() if m.created_at else None,
                    "is_read": m.is_read
                }
                results.append(m_dict)
            return sorted(results, key=lambda x: x["created_at"])
        except Exception as e:
            raise e

    @staticmethod
    def get_user_threads(db: Session, user_id: str, role: str, show_archived: bool = False) -> List[dict]:
        """
        Retrieves threads for a user (candidate or recruiter).
        Filters by user-specific archive flag.
        """
        try:
            is_recruiter = (role == "recruiter")
            id_filter = ChatThread.recruiter_id == user_id if is_recruiter else ChatThread.candidate_id == user_id
            
            # Use user-specific archive flag
            archive_filter = ChatThread.recruiter_archived == show_archived if is_recruiter else ChatThread.candidate_archived == show_archived
            
            threads = db.query(ChatThread).filter(
                id_filter,
                archive_filter
            ).order_by(desc(ChatThread.last_message_at)).all()
            
            results = []
            for t in threads:
                t_dict = {
                    "id": str(t.id),
                    "candidate_id": str(t.candidate_id),
                    "recruiter_id": str(t.recruiter_id),
                    "last_message_at": t.last_message_at.isoformat() if t.last_message_at else None,
                    "is_active": t.is_active,
                    "recruiter_archived": t.recruiter_archived,
                    "candidate_archived": t.candidate_archived,
                    "created_at": t.created_at.isoformat() if t.created_at else None
                }
                
                # Fetch profile data to match frontend Thread interface
                candidate = db.query(CandidateProfile).filter(CandidateProfile.user_id == t.candidate_id).first()
                recruiter = db.query(RecruiterProfile).filter(RecruiterProfile.user_id == t.recruiter_id).first()
                
                if candidate:
                    photo_url = get_s3_url_with_fallback(getattr(candidate, "profile_photo_url", None))
                    if not photo_url:
                        safe_name = (candidate.full_name or "User").replace(" ", "%20")
                        photo_url = f"https://api.dicebear.com/7.x/avataaars/svg?seed={safe_name}"
                    t_dict["candidate_profiles"] = {
                        "full_name": candidate.full_name,
                        "profile_photo_url": photo_url
                    }
                
                if recruiter:
                    t_dict["recruiter_profiles"] = {
                        "full_name": recruiter.full_name,
                        "company_id": str(recruiter.company_id) if recruiter.company_id else None
                    }
                
                results.append(t_dict)
                
            return results
        except Exception as e:
            raise e

    @staticmethod
    def report_message(db: Session, message_id: str, user_id: str, reason: str) -> dict:
        """
        Reports a message for abuse.
        """
        try:
            msg = db.query(ChatMessage).filter(ChatMessage.id == message_id).first()
            if not msg:
                raise ValueError("Message not found")
            report = ChatReport(
                reporter_id=user_id,
                reported_id=msg.sender_id,
                reason=reason
            )
            db.add(report)
            db.commit()
            db.refresh(report)
            return {
                "id": str(report.id),
                "reporter_id": str(report.reporter_id),
                "reported_id": str(report.reported_id),
                "reason": report.reason,
                "created_at": report.created_at.isoformat() if report.created_at else None
            }
        except Exception as e:
            db.rollback()
            raise e

