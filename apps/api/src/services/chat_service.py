from typing import List, Optional
from datetime import datetime
from src.core.database import SessionLocal
from src.core.models import ChatThread, ChatMessage, AssessmentSession, RecruiterProfile, JobApplication, Job, ChatReport, CandidateProfile
from sqlalchemy import or_, and_, desc

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
    def send_message(db: Session, thread_id: str, sender_id: str, content: str) -> dict:
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
            recruiter_id = thread.recruiter_id
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
            if not (dna_unlocked or context_unlocked):
                # Check if it's the first message from a recruiter (allow initial contact if invited)
                # But here we stick to the provided logic
                raise ValueError("Chat Locked: Communications unlock when Candidate DNA Score >= 50 OR Application is Shortlisted/Invited.")

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
    def get_user_threads(db: Session, user_id: str, role: str) -> List[dict]:
        """
        Retrieves all active threads for a user (candidate or recruiter).
        """
        try:
            field_filter = ChatThread.recruiter_id == user_id if role == "recruiter" else ChatThread.candidate_id == user_id
            
            threads = db.query(ChatThread).filter(
                field_filter,
                ChatThread.is_active == True
            ).order_by(desc(ChatThread.last_message_at)).all()
            
            results = []
            for t in threads:
                t_dict = {
                    "id": str(t.id),
                    "candidate_id": str(t.candidate_id),
                    "recruiter_id": str(t.recruiter_id),
                    "last_message_at": t.last_message_at.isoformat() if t.last_message_at else None,
                    "is_active": t.is_active,
                    "created_at": t.created_at.isoformat() if t.created_at else None
                }
                
                # Fetch profile data to match frontend Thread interface
                candidate = db.query(CandidateProfile).filter(CandidateProfile.user_id == t.candidate_id).first()
                recruiter = db.query(RecruiterProfile).filter(RecruiterProfile.user_id == t.recruiter_id).first()
                
                if candidate:
                    t_dict["candidate_profiles"] = {
                        "full_name": candidate.full_name,
                        "profile_photo_url": getattr(candidate, "profile_photo_url", None)
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
            report = ChatReport(
                message_id=message_id,
                reporter_id=user_id,
                reason=reason
            )
            db.add(report)
            db.commit()
            db.refresh(report)
            return {c.name: getattr(report, c.name) for c in report.__table__.columns}
        except Exception as e:
            db.rollback()
            raise e
            
            threads = db.query(ChatThread)\
                .filter(field_filter)\
                .order_by(desc(ChatThread.last_message_at))\
                .all()
            
            results = []
            for t in threads:
                t_dict = {c.name: getattr(t, c.name) for c in t.__table__.columns}
                t_dict["id"] = str(t_dict["id"])
                
                # Fetch other party info
                if role == "recruiter":
                    other = db.query(CandidateProfile).filter(CandidateProfile.user_id == t.candidate_id).first()
                    if other:
                        t_dict["candidate_profiles"] = {
                            "full_name": other.full_name,
                            "avatar_url": getattr(other, "profile_photo_url", None)
                        }
                else:
                    other = db.query(RecruiterProfile).filter(RecruiterProfile.user_id == t.recruiter_id).first()
                    if other:
                        t_dict["recruiter_profiles"] = {
                            "full_name": other.full_name,
                            "company_id": str(other.company_id) if other.company_id else None
                        }
                
                results.append(t_dict)
            return results
        finally:
            db.close()

    @staticmethod
    def report_message(message_id: str, reporter_id: str, reason: str) -> dict:
        """
        Reports a message for moderation.
        """
        db = SessionLocal()
        try:
            msg = db.query(ChatMessage).filter(ChatMessage.id == message_id).first()
            if not msg:
                 raise ValueError("Message not found")
                 
            report = ChatReport(
                reporter_id=reporter_id,
                reported_user_id=msg.sender_id,
                thread_id=msg.thread_id,
                reason=reason,
                status="pending"
            )
            db.add(report)
            db.commit()
            db.refresh(report)
            return {"id": str(report.id), "status": report.status}
        finally:
            db.close()
