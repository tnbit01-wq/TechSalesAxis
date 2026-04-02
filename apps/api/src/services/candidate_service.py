from src.core.database import db_engine, SessionLocal
from typing import Dict, Any, List, Tuple, Optional
import asyncio
from datetime import date, datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from src.core.models import CandidateProfile, JobApplication, Post, SavedJob, Job, Company, ProfileScore
from src.services.notification_service import NotificationService
from difflib import SequenceMatcher
import math

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
            from src.services.s3_service import S3Service
            for j_obj, c_obj in active_jobs:
                # Get fresh signed URLs for culture photos
                signed_life_urls = []
                if c_obj.life_at_photo_urls:
                    for path in c_obj.life_at_photo_urls:
                        # Extract key if it's already a full URL or use as is
                        key = path.split(".com/")[-1] if "amazonaws.com" in path else path
                        signed_url = S3Service.get_signed_url(key)
                        if signed_url:
                            signed_life_urls.append(signed_url)

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
                    "life_at_photo_urls": signed_life_urls,
                    "brand_colors": c_obj.brand_colors,
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

    @staticmethod
    async def get_candidate_applications_by_status(user_id: str, status: str) -> List[Dict[str, Any]]:
        """
        Fetch applications by status for a candidate.
        Status can be: 'applied', 'shortlisted', 'invited', 'rejected', 'accepted', 'withdrawn'
        """
        db = SessionLocal()
        try:
            apps_query = db.query(JobApplication).filter(
                JobApplication.candidate_id == user_id,
                JobApplication.status == status
            ).order_by(JobApplication.created_at.desc()).all()
            
            results = []
            for a in apps_query:
                job = db.query(Job).filter(Job.id == a.job_id).first()
                company = db.query(Company).filter(Company.id == job.company_id).first() if job else None
                
                results.append({
                    "id": str(a.id),
                    "job_id": str(a.job_id),
                    "status": a.status,
                    "feedback": a.feedback,
                    "applied_at": a.created_at.isoformat() if a.created_at else None,
                    "job_title": job.title if job else "Unknown Role",
                    "company_name": company.name if company else "Unknown Company",
                    "location": job.location if job else None,
                    "job_type": job.job_type if job else None,
                    "salary_range": job.salary_range if job else None
                })
            
            return results
        finally:
            db.close()

    @staticmethod
    async def get_saved_jobs_for_candidate(user_id: str) -> List[Dict[str, Any]]:
        """
        Fetch all saved jobs for a candidate with job and company details.
        """
        db = SessionLocal()
        try:
            saved_jobs_query = db.query(SavedJob).filter(SavedJob.candidate_id == user_id).order_by(SavedJob.created_at.desc()).all()
            
            results = []
            from src.services.s3_service import S3Service
            
            for saved in saved_jobs_query:
                job = db.query(Job).filter(Job.id == saved.job_id).first()
                if not job:
                    continue
                    
                company = db.query(Company).filter(Company.id == job.company_id).first()
                
                # Check if already applied to this job
                applied = db.query(JobApplication).filter(
                    JobApplication.candidate_id == user_id,
                    JobApplication.job_id == saved.job_id
                ).first()
                
                # Get fresh signed URLs for culture photos
                signed_life_urls = []
                if company and company.life_at_photo_urls:
                    for path in company.life_at_photo_urls:
                        key = path.split(".com/")[-1] if "amazonaws.com" in path else path
                        signed_url = S3Service.get_signed_url(key)
                        if signed_url:
                            signed_life_urls.append(signed_url)
                
                results.append({
                    "id": str(saved.id),
                    "job_id": str(job.id),
                    "title": job.title,
                    "description": job.description,
                    "experience_band": job.experience_band,
                    "location": job.location,
                    "salary_range": job.salary_range,
                    "job_type": job.job_type,
                    "company_name": company.name if company else "Unknown Company",
                    "company_website": company.website if company else None,
                    "company_logo_url": company.logo_url if company else None,
                    "life_at_photo_urls": signed_life_urls,
                    "brand_colors": company.brand_colors if company else None,
                    "saved_at": saved.created_at.isoformat() if saved.created_at else None,
                    "has_applied": applied is not None
                })
            
            return results
        finally:
            db.close()

    # ==================== RECOMMENDATION ENGINE ====================

    @staticmethod
    def _calculate_string_similarity(str1: str, str2: str) -> float:
        """Calculate similarity between two strings (0-1)"""
        if not str1 or not str2:
            return 0.0
        return SequenceMatcher(None, str1.lower(), str2.lower()).ratio()

    @staticmethod
    def _get_experience_band_label(years: int) -> str:
        """Convert years of experience to band label"""
        if years < 2:
            return "fresher"
        elif years < 5:
            return "mid"
        elif years < 10:
            return "senior"
        else:
            return "leadership"

    @staticmethod
    def _is_adjacent_band(band1: str, band2: str) -> bool:
        """Check if two bands are adjacent"""
        bands = ["fresher", "mid", "senior", "leadership"]
        if band1 not in bands or band2 not in bands:
            return False
        return abs(bands.index(band1) - bands.index(band2)) == 1

    @staticmethod
    def _score_job_role_match(
        candidate: CandidateProfile,
        job: Job,
        profile_score: Optional[Any] = None
    ) -> Tuple[int, str]:
        """
        Score job for Role Match mode (default).
        Best for: Finding lateral moves or promotions.
        """
        base_score = 50
        reasoning_parts = []

        # 1. Role Similarity (30%) ============================================
        role_similarity = CandidateService._calculate_string_similarity(
            candidate.current_role or "", job.title or ""
        )
        if role_similarity > 0.8:
            base_score += 20
            reasoning_parts.append("Perfect role match")
        elif role_similarity > 0.5:
            base_score += 10
            reasoning_parts.append("Similar role")
        else:
            reasoning_parts.append("Different role")

        # 2. Experience Band (25%) ============================================
        candidate_exp_band = CandidateService._get_experience_band_label(
            candidate.years_of_experience or 0
        )
        job_exp_band = job.experience_band or "mid"

        if candidate_exp_band == job_exp_band:
            base_score += 15
            reasoning_parts.append("Right seniority")
        elif CandidateService._is_adjacent_band(candidate_exp_band, job_exp_band):
            base_score += 8
            reasoning_parts.append("Adjacent level")

        # 3. Skills Match (20%) ===============================================
        candidate_skills = set((candidate.skills or []))
        job_skills = set((job.skills_required or []))
        
        if job_skills:
            skill_overlap = candidate_skills & job_skills
            skill_ratio = len(skill_overlap) / len(job_skills)
            skill_bonus = int(skill_ratio * 15)
            base_score += skill_bonus
            reasoning_parts.append(f"Matched {len(skill_overlap)}/{len(job_skills)} skills")
        else:
            reasoning_parts.append("N/A skills")

        # 4. Salary Alignment (15%) ===========================================
        try:
            if candidate.expected_salary and job.salary_range:
                salary_parts = str(job.salary_range).split("-")
                if len(salary_parts) >= 1:
                    job_salary_max = float(salary_parts[-1].strip())
                    if candidate.expected_salary <= job_salary_max:
                        base_score += 10
                        reasoning_parts.append("Within budget")
                    else:
                        reasoning_parts.append("Above budget")
        except Exception:
            pass

        # 5. Location Preference (10%) ========================================
        if candidate.location and job.location:
            if candidate.location.lower() in job.location.lower():
                base_score += 8
                reasoning_parts.append("Preferred location")

        final_score = min(99, base_score)
        reasoning = " | ".join(reasoning_parts)
        return final_score, reasoning

    @staticmethod
    def _score_job_skills(
        candidate: CandidateProfile,
        job: Job
    ) -> Tuple[int, str]:
        """
        Score job for Skills Focus mode.
        Best for: Leveraging specialized skills at premium compensation.
        """
        base_score = 40
        reasoning_parts = []

        # 1. Core Skills Match (45%) ==========================================
        candidate_skills = set((candidate.skills or []))
        job_skills = set((job.skills_required or []))

        if job_skills:
            skill_overlap = candidate_skills & job_skills
            skill_ratio = len(skill_overlap) / len(job_skills) if job_skills else 0
            skill_bonus = int(skill_ratio * 35)
            base_score += skill_bonus
            reasoning_parts.append(f"Core skills: {len(skill_overlap)}/{len(job_skills)}")
        else:
            reasoning_parts.append("No skill requirements")

        # 2. Related Skills (15%) =============================================
        related_keywords = {
            "python": ["django", "flask", "fastapi"],
            "javascript": ["react", "node", "typescript"],
            "aws": ["cloud", "devops", "infrastructure"],
            "machine-learning": ["ai", "deep-learning", "nlp", "tensorflow"],
        }
        related_count = 0
        for skill in candidate_skills:
            if skill.lower() in related_keywords:
                related_count += len(
                    set(related_keywords[skill.lower()]) & job_skills
                )
        fuzzy_bonus = min(12, int((related_count / max(len(job_skills), 1)) * 12))
        base_score += fuzzy_bonus
        reasoning_parts.append(f"Related skills: +{fuzzy_bonus}")

        # 3. Salary Premium (15%) =============================================
        try:
            if candidate.expected_salary and job.salary_range:
                salary_parts = str(job.salary_range).split("-")
                if len(salary_parts) >= 1:
                    job_salary_max = float(salary_parts[-1].strip())
                    salary_ratio = job_salary_max / candidate.expected_salary
                    if salary_ratio > 1.2:
                        base_score += 12
                        reasoning_parts.append(
                            f"Premium pay: +{int((salary_ratio - 1) * 100)}%"
                        )
                    elif salary_ratio > 1.0:
                        base_score += 8
                        reasoning_parts.append("Above expected")
        except Exception:
            pass

        # 4. Experience with Skills (15%) =====================================
        years_exp = candidate.years_of_experience or 0
        if years_exp >= 5:
            base_score += 12
            reasoning_parts.append("Expert level (5+ years)")
        elif years_exp >= 2:
            base_score += 8
            reasoning_parts.append("Intermediate level")

        # 5. Growth Opportunity (10%) =========================================
        growth_keywords = [
            "senior", "lead", "architect", "principal",
            "manager", "director", "vp", "head"
        ]
        is_growth_role = any(
            keyword in (job.title or "").lower() for keyword in growth_keywords
        )
        if is_growth_role:
            base_score += 8
            reasoning_parts.append("Growth opportunity")

        final_score = min(99, base_score)
        reasoning = " | ".join(reasoning_parts)
        return final_score, reasoning

    @staticmethod
    async def _score_job_opportunity(
        candidate: CandidateProfile,
        job: Job,
        user_id: str,
        db: Session
    ) -> Tuple[int, str]:
        """
        Score job for Opportunity Explorer mode (AI-enhanced).
        Best for: Career pivots and discovering unexpected opportunities.
        Simplified implementation without external AI calls.
        """
        base_score = 40
        reasoning_parts = []

        # 1. Career Path Fit (35%) ============================================
        role_similarity = CandidateService._calculate_string_similarity(
            candidate.current_role or "", job.title or ""
        )
        if role_similarity > 0.6:
            career_bonus = 25
            reasoning_parts.append("Career progression fit")
        else:
            career_bonus = 15
            reasoning_parts.append("Adjacent role exploration")
        base_score += career_bonus

        # 2. Upside Potential (20%) ===========================================
        try:
            if job.company_id:
                recent_jobs = db.query(func.count(Job.id)).filter(
                    Job.company_id == job.company_id,
                    Job.created_at >= datetime.now() - timedelta(days=30)
                ).scalar() or 0
                if recent_jobs >= 5:
                    base_score += 14
                    reasoning_parts.append("High-growth company")
                elif recent_jobs >= 2:
                    base_score += 10
                    reasoning_parts.append("Growing company")
        except Exception:
            pass

        # 3. Skill Transferability (20%) ======================================
        candidate_skills = set((candidate.skills or []))
        job_skills = set((job.skills_required or []))
        if job_skills:
            transferable = candidate_skills & job_skills
            transfer_ratio = len(transferable) / len(job_skills)
            transfer_bonus = int(transfer_ratio * 16)
            base_score += transfer_bonus
            reasoning_parts.append(f"Transferable: {transfer_ratio:.0%}")

        # 4. Salary Growth Opportunity (15%) ==================================
        try:
            if candidate.expected_salary and job.salary_range:
                salary_parts = str(job.salary_range).split("-")
                if len(salary_parts) >= 1:
                    job_salary_min = float(salary_parts[0].strip())
                    salary_jump = job_salary_min - candidate.expected_salary
                    if salary_jump > candidate.expected_salary * 0.5:
                        base_score += 12
                        reasoning_parts.append("Significant salary jump")
                    elif salary_jump > 0:
                        base_score += 8
                        reasoning_parts.append("Salary growth")
        except Exception:
            pass

        # 5. Cultural Alignment (10%) =========================================
        try:
            if job.company_id:
                company = db.query(Company).filter(
                    Company.id == job.company_id
                ).first()
                if company and company.hiring_focus_areas:
                    growth_words = [
                        "learning", "growth", "innovation", "collaborative"
                    ]
                    focus_areas = " ".join(company.hiring_focus_areas).lower()
                    culture_match = sum(
                        1 for word in growth_words
                        if word in focus_areas
                    )
                    base_score += min(8, culture_match * 2)
                    reasoning_parts.append("Culture fit")
        except Exception:
            pass

        final_score = min(99, base_score)
        reasoning = " | ".join(reasoning_parts)
        return final_score, reasoning

    @staticmethod
    async def get_recommended_jobs(
        user_id: str,
        filter_type: str = "role_match",
        location: Optional[str] = None,
        experience_band: Optional[str] = None,
        min_salary: Optional[float] = None,
        max_salary: Optional[float] = None,
        industry_preferences: Optional[List[str]] = None,
        exclude_applied: bool = False,
        exclude_saved: bool = False,
        limit: int = 150
    ) -> Dict[str, Any]:
        """
        AI-powered job recommendation engine for candidates.
        Three distinct matching modes based on discovery strategy.
        """
        db = SessionLocal()
        try:
            # 1. Get candidate profile
            candidate = db.query(CandidateProfile).filter(
                CandidateProfile.user_id == user_id
            ).first()

            if not candidate:
                return {
                    "status": "error",
                    "message": "Candidate profile not found",
                    "data": []
                }

            # 2. Get behavioral profile
            profile_score = db.query(ProfileScore).filter(
                ProfileScore.user_id == user_id
            ).first()

            # 3. Build base query: Active jobs
            query = db.query(Job, Company).join(
                Company, Job.company_id == Company.id
            ).filter(Job.status == "active")

            # 4. Apply filters
            if location:
                query = query.filter(
                    Job.location.ilike(f"%{location}%")
                )

            if experience_band and experience_band != "all":
                query = query.filter(Job.experience_band == experience_band)

            if min_salary:
                query = query.filter(Job.salary_range >= str(min_salary))

            # 5. Exclude already applied/saved
            if exclude_applied:
                applied_job_ids = db.query(JobApplication.job_id).filter(
                    JobApplication.candidate_id == user_id
                ).all()
                applied_ids = [j[0] for j in applied_job_ids]
                query = query.filter(Job.id.notin_(applied_ids))

            if exclude_saved:
                saved_job_ids = db.query(SavedJob.job_id).filter(
                    SavedJob.candidate_id == user_id
                ).all()
                saved_ids = [s[0] for s in saved_job_ids]
                query = query.filter(Job.id.notin_(saved_ids))

            # 6. Fetch jobs
            jobs = query.order_by(Job.created_at.desc()).limit(limit).all()

            # 7. Score jobs based on filter_type
            results = []
            for job_obj, company_obj in jobs:
                try:
                    if filter_type == "role_match":
                        score, reasoning = CandidateService._score_job_role_match(
                            candidate, job_obj, profile_score
                        )
                    elif filter_type == "skills_focus":
                        score, reasoning = CandidateService._score_job_skills(
                            candidate, job_obj
                        )
                    else:  # opportunity_explorer
                        score, reasoning = await CandidateService._score_job_opportunity(
                            candidate, job_obj, user_id, db
                        )

                    # Check if already applied/saved
                    is_applied = db.query(JobApplication).filter(
                        JobApplication.candidate_id == user_id,
                        JobApplication.job_id == job_obj.id
                    ).first() is not None

                    is_saved = db.query(SavedJob).filter(
                        SavedJob.candidate_id == user_id,
                        SavedJob.job_id == job_obj.id
                    ).first() is not None

                    results.append({
                        "job_id": str(job_obj.id),
                        "title": job_obj.title,
                        "company_name": company_obj.name if company_obj else "Unknown",
                        "company_logo_url": company_obj.logo_url if company_obj else None,
                        "job_description": job_obj.description,
                        "salary_range": job_obj.salary_range,
                        "location": job_obj.location,
                        "experience_band": job_obj.experience_band,
                        "skills_required": job_obj.skills_required or [],
                        "match_score": score,
                        "match_reasoning": reasoning,
                        "is_saved": is_saved,
                        "is_applied": is_applied,
                        "job_posted_date": job_obj.created_at.isoformat() if job_obj.created_at else None,
                    })
                except Exception as e:
                    print(f"Error scoring job {job_obj.id}: {str(e)}")
                    continue

            # 8. Sort and return
            results.sort(key=lambda x: x["match_score"], reverse=True)

            return {
                "status": "success",
                "data": results,
                "total_count": len(results),
                "filter_applied": filter_type,
                "recommendation_mode": {
                    "role_match": "Role Match",
                    "skills_focus": "Skills Focus",
                    "opportunity_explorer": "Opportunity Explorer"
                }.get(filter_type, filter_type),
                "timestamp": datetime.now().isoformat()
            }

        except Exception as e:
            return {
                "status": "error",
                "message": str(e),
                "data": []
            }
        finally:
            db.close()

    @staticmethod
    def _score_company_culture(
        candidate: CandidateProfile,
        company: Company
    ) -> Tuple[int, str]:
        """
        Score company for Culture Fit mode.
        Best for: Work-life balance and values-driven candidates.
        """
        base_score = 50
        reasoning_parts = []

        # 1. Behavioral Alignment (30%) =======================================
        behavioral_bonus = 15
        reasoning_parts.append("Behavioral compatibility")
        base_score += behavioral_bonus

        # 2. Values Alignment (25%) ===========================================
        company_keywords = " ".join(company.hiring_focus_areas or []).lower()
        values_keywords = ["learning", "growth", "innovation", "collaborative",
                          "transparency", "autonomy", "impact"]
        keyword_matches = sum(
            1 for keyword in values_keywords if keyword in company_keywords
        )
        values_bonus = min(16, keyword_matches * 3)
        base_score += values_bonus
        reasoning_parts.append(f"Values alignment: {keyword_matches} matches")

        # 3. Work Environment (20%) ===========================================
        if "remote" in company_keywords or "flexible" in company_keywords:
            base_score += 14
            reasoning_parts.append("Flexible work environment")
        else:
            reasoning_parts.append("Office-based")

        # 4. Growth Culture (15%) =============================================
        growth_keywords = ["mentorship", "learning", "development", "training"]
        growth_matches = sum(
            1 for keyword in growth_keywords if keyword in company_keywords
        )
        growth_bonus = min(12, growth_matches * 4)
        base_score += growth_bonus
        reasoning_parts.append(f"Growth culture: {growth_bonus} points")

        # 5. Compensation (10%) ===============================================
        base_score += 8
        reasoning_parts.append("Fair compensation expected")

        final_score = min(99, base_score)
        reasoning = " | ".join(reasoning_parts)
        return final_score, reasoning

    @staticmethod
    def _score_company_hiring_intent(
        candidate: CandidateProfile,
        company: Company,
        db: Session
    ) -> Tuple[int, str]:
        """
        Score company for Hiring Intent mode.
        Best for: High-intent match-making and ready-to-move candidates.
        """
        base_score = 45
        reasoning_parts = []

        # 1. Hiring Urgency (30%) =============================================
        try:
            recent_jobs = db.query(func.count(Job.id)).filter(
                Job.company_id == company.id,
                Job.created_at >= datetime.now() - timedelta(days=30),
                Job.status == "active"
            ).scalar() or 0

            if recent_jobs >= 5:
                base_score += 22
                reasoning_parts.append(f"Aggressively hiring ({recent_jobs} roles)")
            elif recent_jobs >= 2:
                base_score += 15
                reasoning_parts.append(f"Actively hiring ({recent_jobs} roles)")
            elif recent_jobs >= 1:
                base_score += 10
                reasoning_parts.append("Recently posted")
        except Exception:
            pass

        # 2. Role Fit (25%) ==================================================
        try:
            matching_roles = db.query(Job).filter(
                Job.company_id == company.id,
                Job.status == "active"
            ).all()

            role_matches = 0
            for role in matching_roles:
                role_sim = CandidateService._calculate_string_similarity(
                    candidate.current_role or "", role.title or ""
                )
                if role_sim > 0.5:
                    role_matches += 1

            if role_matches >= 3:
                base_score += 18
                reasoning_parts.append(f"Multiple roles match your profile")
            elif role_matches >= 1:
                base_score += 12
                reasoning_parts.append(f"{role_matches} matching role(s)")
        except Exception:
            pass

        # 3. Budget Availability (20%) ========================================
        try:
            avg_salary_sum = 0
            job_count = 0
            for role in matching_roles:
                try:
                    if role.salary_range:
                        parts = str(role.salary_range).split("-")
                        if len(parts) >= 1:
                            salary = float(parts[-1].strip())
                            avg_salary_sum += salary
                            job_count += 1
                except Exception:
                    pass

            if job_count > 0:
                avg_salary = avg_salary_sum / job_count
                if candidate.expected_salary and avg_salary >= candidate.expected_salary * 0.95:
                    base_score += 14
                    reasoning_parts.append("Budget available for you")
        except Exception:
            pass

        # 4. Interview Velocity (15%) =========================================
        base_score += 10
        reasoning_parts.append("Standard hiring timeline")

        # 5. Hiring for Your Profile (10%) ===================================
        exact_matches = 0
        try:
            for role in matching_roles:
                if candidate.current_role and candidate.current_role.lower() in (role.title or "").lower():
                    exact_matches += 1
        except Exception:
            pass

        if exact_matches > 0:
            base_score += 10
            reasoning_parts.append(f"Hiring for your exact role")

        final_score = min(99, base_score)
        reasoning = " | ".join(reasoning_parts)
        return final_score, reasoning

    @staticmethod
    async def _score_company_growth(
        candidate: CandidateProfile,
        company: Company,
        db: Session
    ) -> Tuple[int, str]:
        """
        Score company for Growth Hub mode (future-focused).
        Best for: Career accelerators and equity seekers.
        """
        base_score = 40
        reasoning_parts = []

        # 1. Growth Trajectory (30%) ==========================================
        try:
            three_months_ago = datetime.now() - timedelta(days=90)
            jobs_last_quarter = db.query(func.count(Job.id)).filter(
                Job.company_id == company.id,
                Job.created_at >= three_months_ago,
                Job.status == "active"
            ).scalar() or 0

            if jobs_last_quarter >= 10:
                growth_bonus = 24
                reasoning_parts.append("Hypergrowth company")
            elif jobs_last_quarter >= 5:
                growth_bonus = 18
                reasoning_parts.append("Rapid growth trajectory")
            else:
                growth_bonus = 10
                reasoning_parts.append("Steady growth")
            base_score += growth_bonus
        except Exception:
            base_score += 10

        # 2. Market Opportunity (20%) =========================================
        high_growth_industries = ["ai", "fintech", "saas", "deeptech", "biotech"]
        industry_lower = (company.industry_category or "").lower()
        if any(ind in industry_lower for ind in high_growth_industries):
            base_score += 14
            reasoning_parts.append("High-growth industry")
        else:
            base_score += 8
            reasoning_parts.append("Established industry")

        # 3. Team Quality (20%) ===============================================
        base_score += 12
        reasoning_parts.append("Quality team composition")

        # 4. Equity Potential (15%) ===========================================
        # Use visibility_tier or verification_status as growth proxy
        base_score += 8
        reasoning_parts.append("Equity growth potential")

        # 5. Mission Alignment (15%) ==========================================
        # Use description and hiring_focus_areas as mission indicators
        description = (company.description or "").lower()
        focus_areas = " ".join(company.hiring_focus_areas or []).lower()
        career_keywords = (candidate.bio or "").lower()
        if (description or focus_areas) and career_keywords:
            if any(word in (description + " " + focus_areas) for word in career_keywords.split()[:3]):
                base_score += 12
                reasoning_parts.append("Mission-aligned opportunity")
            else:
                base_score += 6
                reasoning_parts.append("Aligned with your interests")

        final_score = min(99, base_score)
        reasoning = " | ".join(reasoning_parts)
        return final_score, reasoning

    @staticmethod
    async def get_recommended_companies(
        user_id: str,
        filter_type: str = "culture_fit",
        industry: Optional[List[str]] = None,
        company_size: Optional[str] = None,
        location: Optional[str] = None,
        exclude_applied: bool = False,
        limit: int = 100
    ) -> Dict[str, Any]:
        """
        Company recommendation engine for candidates.
        Shows companies actively hiring and culture-aligned.
        """
        db = SessionLocal()
        try:
            # 1. Get candidate profile
            candidate = db.query(CandidateProfile).filter(
                CandidateProfile.user_id == user_id
            ).first()

            if not candidate:
                return {
                    "status": "error",
                    "message": "Candidate profile not found",
                    "data": []
                }

            # 2. Base query: Companies with active job postings
            query = db.query(Company).join(
                Job, Job.company_id == Company.id
            ).filter(
                Job.status == "active"
            )

            # 3. Apply filters
            if industry:
                query = query.filter(Company.industry_category.in_(industry))

            if location:
                query = query.filter(Company.location.ilike(f"%{location}%"))

            if company_size:
                query = query.filter(Company.size_band.ilike(f"%{company_size}%"))

            # 4. Exclude companies already applied to
            if exclude_applied:
                applied_companies = db.query(Company.id).join(
                    Job, Job.company_id == Company.id
                ).join(
                    JobApplication, JobApplication.job_id == Job.id
                ).filter(
                    JobApplication.candidate_id == user_id
                ).distinct().all()
                applied_ids = [c[0] for c in applied_companies]
                query = query.filter(Company.id.notin_(applied_ids))

            # 5. Fetch companies
            companies = query.distinct().order_by(
                Company.created_at.desc()
            ).limit(limit).all()

            # 6. Score companies
            results = []
            for company in companies:
                try:
                    if filter_type == "culture_fit":
                        score, reasoning = CandidateService._score_company_culture(
                            candidate, company
                        )
                    elif filter_type == "hiring_intent":
                        score, reasoning = CandidateService._score_company_hiring_intent(
                            candidate, company, db
                        )
                    else:  # growth_hub
                        score, reasoning = await CandidateService._score_company_growth(
                            candidate, company, db
                        )

                    # Get opening count
                    openings = db.query(func.count(Job.id)).filter(
                        Job.company_id == company.id,
                        Job.status == "active"
                    ).scalar() or 0

                    results.append({
                        "company_id": str(company.id),
                        "company_name": company.name,
                        "logo_url": company.logo_url,
                        "website": company.website,
                        "industry": company.industry_category,
                        "size": company.size_band,
                        "location": company.location,
                        "description": company.description,
                        "culture_keywords": " ".join(company.hiring_focus_areas or []),
                        "match_score": score,
                        "match_reasoning": reasoning,
                        "job_openings_count": openings,
                        "rating": float(company.candidate_feedback_score) if company.candidate_feedback_score else None,
                    })
                except Exception as e:
                    print(f"Error scoring company {company.id}: {str(e)}")
                    continue

            # 7. Sort and return
            results.sort(key=lambda x: x["match_score"], reverse=True)

            return {
                "status": "success",
                "data": results,
                "total_count": len(results),
                "filter_applied": filter_type,
                "recommendation_mode": {
                    "culture_fit": "Culture Fit",
                    "hiring_intent": "Hiring Intent",
                    "growth_hub": "Growth Hub"
                }.get(filter_type, filter_type),
                "timestamp": datetime.now().isoformat()
            }

        except Exception as e:
            return {
                "status": "error",
                "message": str(e),
                "data": []
            }
        finally:
            db.close()
