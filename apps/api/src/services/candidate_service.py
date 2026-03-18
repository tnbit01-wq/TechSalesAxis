from src.core.database import db_engine, SessionLocal
from typing import Dict, Any, List
import asyncio
from datetime import date, datetime
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from src.core.models import CandidateProfile, JobApplication, Post, SavedJob, Job, Company
from src.services.notification_service import NotificationService

class CandidateService:
    @staticmethod
    def calculate_completion_score(profile: Dict[str, Any]) -> int:
        """
        Calculates the profile completion score (0-100) based on filled fields.
        Note: The database trigger 'calculate_profile_completion' is the primary 
        source of truth, this method provides a synchronized app-side fallback.
        """
        weights = {
            "full_name": 10,
            "phone_number": 5,
            "bio": 15,
            "current_role": 10,
            "years_of_experience": 5,
            "primary_industry_focus": 5,
            "linkedin_url": 5,
            "portfolio_url": 5,
            "gender": 2,
            "birthdate": 3,
            "referral": 2,
            "location": 5,
            "education_history": 15,
            "experience_history": 20,
            "career_gap_report": 10,
            "identity_verified": 5
        }
        
        total_score = 0
        max_score = sum(weights.values())
        
        for field, weight in weights.items():
            val = profile.get(field)
            if val and (not isinstance(val, (list, dict)) or len(val) > 0):
                total_score += weight
        
        return int((total_score / max_score) * 100)

    @staticmethod
    async def get_candidate_stats(user_id: str) -> Dict[str, Any]:
        """
        Fetches all engagement and profile stats for the candidate.
        Uses RDS (SQLAlchemy) SessionLocal for primary data.
        """
        db: Session = SessionLocal()
        try:
            # 1. Fetch Profile Data (Primary)
            profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == user_id).first()
            
            if not profile:
                return {
                    "applications_count": 0,
                    "daily_applications_count": 0,
                    "shortlisted_count": 0,
                    "invites_received": 0,
                    "posts_count": 0,
                    "saved_jobs_count": 0,
                    "profile_score": 0,
                    "profile_strength": "Low",
                    "completion_score": 0,
                    "assessment_status": "not_started",
                    "identity_verified": False,
                    "terms_accepted": False,
                    "account_status": "Active",
                }
            
            today = date.today()
            
            # 2. Parallel Metrics counts using queries
            count_applications = db.query(func.count(JobApplication.id)).filter(JobApplication.candidate_id == user_id).scalar() or 0
            count_daily = db.query(func.count(JobApplication.id)).filter(
                JobApplication.candidate_id == user_id, 
                func.date(JobApplication.created_at) == today
            ).scalar() or 0
            count_shortlisted = db.query(func.count(JobApplication.id)).filter(
                JobApplication.candidate_id == user_id, 
                JobApplication.status == "shortlisted"
            ).scalar() or 0
            count_invites = db.query(func.count(JobApplication.id)).filter(
                JobApplication.candidate_id == user_id, 
                JobApplication.status == "invited"
            ).scalar() or 0
            count_posts = db.query(func.count(Post.id)).filter(Post.user_id == user_id).scalar() or 0
            count_saved = db.query(func.count(SavedJob.id)).filter(SavedJob.candidate_id == user_id).scalar() or 0

            return {
                "applications_count": count_applications,
                "daily_applications_count": count_daily,
                "shortlisted_count": count_shortlisted,
                "invites_received": count_invites,
                "posts_count": count_posts,
                "saved_jobs_count": count_saved,
                "profile_score": float(profile.final_profile_score) if profile.final_profile_score else 0,
                "profile_strength": profile.profile_strength or "Low",
                "completion_score": profile.completion_score or 0,
                "assessment_status": profile.assessment_status or "not_started",
                "identity_verified": profile.identity_verified or False,
                "terms_accepted": profile.terms_accepted or False,
                "account_status": profile.account_status or "Active",
            }
        finally:
            db.close()

    @staticmethod
    async def list_available_jobs(user_id: str):
        """Fetch active jobs with company info and application status."""
        db = SessionLocal()
        try:
            # 1. Fetch active jobs joined with company data
            active_jobs = db.query(Job, Company).join(Company, Job.company_id == Company.id).filter(Job.status == "active").order_by(Job.created_at.desc()).all()
            
            # 2. Fetch user's applications
            applied_job_ids = {a.job_id for a in db.query(JobApplication.job_id).filter(JobApplication.candidate_id == user_id).all()}

            # 3. Fetch user's saved jobs
            saved_job_ids = {s.job_id for s in db.query(SavedJob.job_id).filter(SavedJob.candidate_id == user_id).all()}
            
            jobs = []
            for j_obj, c_obj in active_jobs:
                jobs.append({
                    "id": str(j_obj.id),
                    "title": j_obj.title,
                    "description": j_obj.description,
                    "experience_band": j_obj.experience_band,
                    "location": j_obj.location,
                    "salary_range": j_obj.salary_range,
                    "job_type": j_obj.job_type,
                    "company_name": c_obj.name or "Unknown Company",
                    "company_website": c_obj.website,
                    "created_at": j_obj.created_at.isoformat() if j_obj.created_at else None,
                    "has_applied": j_obj.id in applied_job_ids,
                    "is_saved": j_obj.id in saved_job_ids
                })
                
            return jobs
        finally:
            db.close()

    @staticmethod
    async def save_job(user_id: str, job_id: str):
        """Save a job for later."""
        db = SessionLocal()
        try:
            # Check if already saved
            existing = db.query(SavedJob).filter(SavedJob.candidate_id == user_id, SavedJob.job_id == job_id).first()
            if existing:
                return {"status": "already_saved"}
            
            new_save = SavedJob(candidate_id=user_id, job_id=job_id)
            db.add(new_save)
            db.commit()
            return {"status": "saved"}
        finally:
            db.close()

    @staticmethod
    async def unsave_job(user_id: str, job_id: str):
        """Unsave a job."""
        db = SessionLocal()
        try:
            db.query(SavedJob).filter(SavedJob.candidate_id == user_id, SavedJob.job_id == job_id).delete()
            db.commit()
            return {"status": "unsaved"}
        finally:
            db.close()

    @staticmethod
    async def apply_to_job(user_id: str, job_id: str):
        """Create a new job application with daily limits."""
        db = SessionLocal()
        try:
            # 1. Check if already applied
            existing = db.query(JobApplication).filter(JobApplication.candidate_id == user_id, JobApplication.job_id == job_id).first()
            if existing:
                return {"status": "already_applied"}
                
            # 2. Enforce Daily Limit (5 applications)
            today = date.today()
            daily_count = db.query(func.count(JobApplication.id)).filter(
                JobApplication.candidate_id == user_id,
                func.date(JobApplication.created_at) == today
            ).scalar() or 0

            if daily_count >= 5:
                return {
                    "status": "limit_reached", 
                    "message": "Daily transmission limit reached (5/5). Your signal buffer will reset tomorrow."
                }

            # 3. Create application
            new_app = JobApplication(
                candidate_id=user_id,
                job_id=job_id,
                status="applied"
            )
            db.add(new_app)
            db.flush() # Get ID before commit

            # 4. Audit Trail: Log initial application
            try:
                db.execute(text("""
                    INSERT INTO job_application_status_history (application_id, new_status, changed_by, reason)
                    VALUES (:app_id, :status, :user_id, :reason)
                """), {
                    "app_id": new_app.id,
                    "status": "applied",
                    "user_id": user_id,
                    "reason": "Initial application by candidate"
                })
            except Exception as e:
                print(f"FAILED TO LOG INITIAL HISTORY: {e}")

            # 5. Trigger Notification
            job_obj = db.query(Job).filter(Job.id == job_id).first()
            job_title = job_obj.title if job_obj else "a job"
            recruiter_id = job_obj.recruiter_id if job_obj else None

            NotificationService.create_notification(
                user_id=user_id,
                type="APPLICATION_SUBMITTED",
                title="Application Sent",
                message=f"Your signal for {job_title} has been successfully transmitted to the recruiter.",
                metadata={"job_id": job_id}
            )

            if recruiter_id:
                NotificationService.create_notification(
                    user_id=recruiter_id,
                    type="NEW_APPLICATION",
                    title=f"New Candidate Alert: {job_title}",
                    message=f"A new candidate has submitted their profile for the {job_title} position.",
                    metadata={"job_id": job_id, "application_id": str(new_app.id)}
                )

            db.commit()
            return {"status": "success", "data": {"id": str(new_app.id)}}
        except Exception as e:
            db.rollback()
            raise e
        finally:
            db.close()

    @staticmethod
    async def get_my_applications(user_id: str):
        """Fetch all jobs the candidate has applied to."""
        db = SessionLocal()
        try:
            apps_query = db.query(JobApplication).filter(JobApplication.candidate_id == user_id).order_by(JobApplication.created_at.desc()).all()
            
            results = []
            for a in apps_query:
                job = db.query(Job).filter(Job.id == a.job_id).first()
                company = db.query(Company).filter(Company.id == job.company_id).first() if job else None
                
                # Fetch interviews (Refactored to select specific columns and ensure types)
                interviews_raw = db.execute(text("""
                    SELECT id, status, round_name, round_number, format, meeting_link, location, interviewer_names 
                    FROM interviews 
                    WHERE application_id = :aid
                """), {"aid": a.id}).fetchall()
                
                interviews = []
                for r in interviews_raw:
                    i_dict = dict(r._mapping)
                    i_dict["id"] = str(i_dict["id"])
                    
                    # Fetch slots for this interview with explicit is_selected check
                    slots_raw = db.execute(text("""
                        SELECT id, start_time, end_time, is_selected, status, created_at 
                        FROM interview_slots 
                        WHERE interview_id = :iid
                        ORDER BY start_time ASC
                    """), {"iid": i_dict["id"]}).fetchall()
                    
                    i_dict["interview_slots"] = []
                    for sr in slots_raw:
                        s_dict = dict(sr._mapping)
                        s_dict["id"] = str(s_dict["id"])
                        s_dict["is_selected"] = bool(s_dict["is_selected"]) # Ensure boolean parity
                        i_dict["interview_slots"].append(s_dict)
                    
                    interviews.append(i_dict)
                
                # Sort interviews by round number descending for active selection
                interviews.sort(key=lambda x: x.get("round_number", 1), reverse=True)
                active_interview = next(
                    (i for i in interviews if i["status"] in ["pending_confirmation", "scheduled"]), 
                    next((i for i in interviews if i["status"] == "completed"), None)
                )

                results.append({
                    "id": str(a.id),
                    "job_id": str(a.job_id),
                    "status": a.status,
                    "feedback": a.feedback,
                    "applied_at": a.created_at or datetime.now(),
                    "job_title": job.title if job else "Unknown Role",
                    "company_name": company.name if company else "Unknown Company",
                    "metadata": getattr(a, "metadata_", {}),
                    "active_interview": active_interview
                })
            return results
        finally:
            db.close()

    @staticmethod
    async def get_application_detail(user_id: str, application_id: str):
        """Fetch full details for a specific application."""
        from uuid import UUID
        db = SessionLocal()
        try:
            # 1. Fetch Application
            a = db.query(JobApplication).filter(
                JobApplication.id == application_id,
                JobApplication.candidate_id == user_id
            ).first()
            if not a:
                return None
            
            # 2. Fetch Job & Company
            job = db.query(Job).filter(Job.id == a.job_id).first()
            company = db.query(Company).filter(Company.id == job.company_id).first() if job else None

            # 3. Fetch Interviews (Same logic as list but more comprehensive)
            interviews_raw = db.execute(text("SELECT * FROM interviews WHERE application_id = :aid"), {"aid": a.id}).fetchall()
            interviews = []
            for r in interviews_raw:
                i_dict = dict(r._mapping)
                # Fetch slots for this interview (ensure correct naming)
                slots_raw = db.execute(text("SELECT * FROM interview_slots WHERE interview_id = :iid"), {"iid": i_dict["id"]}).fetchall()
                i_dict["interview_slots"] = [dict(sr._mapping) for sr in slots_raw]
                
                # Fetch round details if exists
                interviews.append(i_dict)

            # 4. Result Payload
            return {
                "id": str(a.id),
                "job_id": str(a.job_id),
                "status": a.status,
                "feedback": a.feedback,
                "applied_at": a.created_at or datetime.now(),
                "metadata": getattr(a, "metadata_", {}),
                "job": {
                    "id": str(job.id),
                    "title": job.title,
                    "description": job.description,
                    "experience_band": job.experience_band,
                    "job_type": job.job_type,
                    "location": job.location,
                    "salary_range": job.salary_range
                } if job else None,
                "company": {
                    "id": str(company.id),
                    "name": company.name,
                    "logo_url": company.logo_url if company else None,
                    "website": company.website if company else None
                } if company else None,
                "interviews": interviews
            }
        finally:
            db.close()
