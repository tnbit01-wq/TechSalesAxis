from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from src.core.dependencies import get_current_user
from src.core.database import get_db
from src.core.models import CandidateProfile, User, Job, JobApplication, SavedJob, ResumeData, Company
from src.services.s3_service import S3Service
from pydantic import BaseModel
from datetime import datetime
from src.services.resume_service import ResumeService
from src.services.candidate_service import CandidateService
from src.services.notification_service import NotificationService
from src.utils.pdf_generator import PDFGenerator
from src.schemas.candidate import CandidateProfileUpdate, CandidateStats, CandidateJobResponse, JobApplicationResponse, JobApplicationDetailResponse
from src.core.config import GOOGLE_API_KEY, OPENAI_API_KEY
from typing import List, Optional

router = APIRouter(prefix="/candidate", tags=["candidate"])

class ExperienceBandUpdate(BaseModel):
    experience: str

class ResumeUpdate(BaseModel):
    resume_path: Optional[str] = None
    resume_url: Optional[str] = None
    url: Optional[str] = None
    path: Optional[str] = None

class SkillsUpdate(BaseModel):
    skills: list[str]

class StepUpdate(BaseModel):
    step: str

class CandidateSettingsUpdate(BaseModel):
    email_notifications: Optional[bool] = None
    web_notifications: Optional[bool] = None
    mobile_notifications: Optional[bool] = None
    is_public: Optional[bool] = None
    language: Optional[str] = None
    timezone: Optional[str] = None
    job_alert_frequency: Optional[str] = None
    minimum_salary_threshold: Optional[int] = None

class EducationData(BaseModel):
    degree: str
    institution: str
    year: str
    field: Optional[str] = None
    gpa: Optional[str] = None

class ExperienceData(BaseModel):
    role: str
    company: str
    location: Optional[str] = "Remote"
    start: str
    end: str
    description: Optional[str] = None
    key_achievements: Optional[List[str]] = []

class GenerateResumeRequest(BaseModel):
    full_name: str
    phone: str
    location: str
    bio: str
    education: List[EducationData]
    timeline: List[ExperienceData]
    skills: List[str]
    linkedin: Optional[str] = None
    portfolio: Optional[str] = None
    template: str = "professional"

class CandidateJobResponse(BaseModel):
    id: str
    title: str
    description: str
    experience_band: str
    location: Optional[str] = None
    salary_range: Optional[str] = None
    job_type: str
    company_name: str
    company_website: Optional[str] = None
    created_at: datetime
    has_applied: bool = False
    is_saved: bool = False

@router.get("/profile")
async def get_profile(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user_id = user["sub"]
    try:
        # Join with users table for email consistency
        profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == user_id).first()
        if not profile:
            return None
        
        # Convert to dict for response consistency
        profile_data = {c.name: getattr(profile, c.name) for c in profile.__table__.columns}
        
        # Add email from User table
        user_record = db.query(User).filter(User.id == user_id).first()
        profile_data["email"] = user_record.email if user_record else user.get("email")
            
        # Add Signed URL for Profile Photo & Resume (S3)
        if profile_data.get("profile_photo_url"):
            profile_data["profile_photo_url"] = S3Service.get_signed_url(profile_data["profile_photo_url"])

        if profile_data.get("resume_path"):
            profile_data["resume_path"] = S3Service.get_signed_url(profile_data["resume_path"])
                
        return profile_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/profile")
async def update_profile(
    request: CandidateProfileUpdate,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user_id = user["sub"]
    try:
        # 0. Check Integrity Lock
        profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == user_id).first()
        if not profile:
             return {"status": "error", "detail": "Profile not found"}
        
        is_completed = profile.assessment_status == "completed"

        # 1. Update Profile Fields
        update_data = request.model_dump(exclude_unset=True, by_alias=True)
        
        # AI Location Tiering System
        if "location" in update_data and update_data["location"]:
            loc = update_data["location"].lower()
            tier1 = ['bangalore', 'bengaluru', 'mumbai', 'delhi', 'hyderabad', 'chennai', 'kolkata', 'pune', 'ahmedabad']
            tier2 = ['jaipur', 'lucknow', 'nagpur', 'indore', 'kochi', 'madurai', 'coimbatore', 'chandigarh', 'mysore', 'surat']
            if any(city in loc for city in tier1):
                update_data["location_tier"] = "Tier 1"
            elif any(city in loc for city in tier2):
                update_data["location_tier"] = "Tier 2"
            else:
                update_data["location_tier"] = "Tier 3"
        
        # SILENT PROTECTION: If assessment is completed, we don't allow changing seniority signals.
        if is_completed:
            for field in ["experience", "years_of_experience"]:
                if field in update_data:
                    # Log for debugging, but strip from update
                    # print(f"DEBUG: Stripping locked field {field} from profile update.")
                    update_data.pop(field)
        
        # 2. Update Profile Fields
        for key, value in update_data.items():
            # Ensure ARRAY fields get a list even if a string is provided
            if key in ["career_interests", "learning_interests"] and isinstance(value, str):
                value = [s.strip() for s in value.split(",") if s.strip()]
            setattr(profile, key, value)
        
        # 3. Recalculate Completion Score
        from ..services.candidate_service import CandidateService
        profile_dict = {c.name: getattr(profile, c.name) for c in profile.__table__.columns}
        completion_score = CandidateService.calculate_completion_score(profile_dict)
        
        profile.completion_score = completion_score
        profile.updated_at = datetime.now()
        
        db.commit()
        db.refresh(profile)
        
        return {"status": "profile_updated", "completion_score": completion_score}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/latest-application")
async def get_latest_application(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user_id = user["sub"]
    try:
        # Fetching latest application with Job and Company info
        from src.core.models import Company
        application = db.query(JobApplication)\
            .filter(JobApplication.candidate_id == user_id)\
            .order_by(JobApplication.created_at.desc())\
            .first()
        
        if not application:
            return None
            
        job = db.query(Job).filter(Job.id == application.job_id).first()
        company = db.query(Company).filter(Company.id == job.company_id).first() if job else None

        # Format for consistency
        res_data = {c.name: getattr(application, c.name) for c in application.__table__.columns}
        if job:
            job_data = {c.name: getattr(job, c.name) for c in job.__table__.columns}
            if company:
                job_data["companies"] = {c.name: getattr(company, c.name) for c in company.__table__.columns}
            res_data["jobs"] = job_data
            
        return res_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/stats", response_model=CandidateStats)
async def get_stats(user: dict = Depends(get_current_user)):
    user_id = user["sub"]
    try:
        return await CandidateService.get_candidate_stats(user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/experience")
async def update_experience(
    request: ExperienceBandUpdate,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user_id = user["sub"]
    
    valid_bands = ["fresher", "mid", "senior", "leadership"]
    if request.experience not in valid_bands:
        raise HTTPException(status_code=400, detail="Invalid experience band")
    
    try:
        # Check integrity lock
        profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == user_id).first()
        if profile and profile.assessment_status == "completed":
             raise HTTPException(status_code=403, detail="Experience band is locked after assessment completion.")

        if not profile:
             profile = CandidateProfile(user_id=user_id, experience=request.experience)
             db.add(profile)
        else:
            profile.experience = request.experience

        db.commit()
        return {"status": "updated"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/step")
async def update_step(
    request: StepUpdate,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user_id = user["sub"]
    try:
        profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == user_id).first()
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")
        
        profile.onboarding_step = request.step
        db.commit()
        return {"status": "step_updated"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/settings")
async def get_settings(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user_id = user["sub"]
    try:
        from sqlalchemy import text
        res = db.execute(text("SELECT * FROM candidate_settings WHERE user_id = :uid"), {"uid": user_id}).fetchone()
        
        if not res:
            # AUTO-INITIALIZE if missing
            db.execute(text("INSERT INTO candidate_settings (user_id) VALUES (:uid)"), {"uid": user_id})
            db.commit()
            res = db.execute(text("SELECT * FROM candidate_settings WHERE user_id = :uid"), {"uid": user_id}).fetchone()
        
        return dict(res._mapping)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/settings")
async def update_settings(
    request: CandidateSettingsUpdate,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user_id = user["sub"]
    try:
        from sqlalchemy import text
        update_data = request.model_dump(exclude_unset=True)
        if not update_data:
            return {"status": "no_changes"}
            
        set_clause = ", ".join([f"{k} = :{k}" for k in update_data.keys()])
        update_data["uid"] = user_id
        
        db.execute(text(f"UPDATE candidate_settings SET {set_clause} WHERE user_id = :uid"), update_data)
        db.commit()
        return {"status": "settings_updated"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/resume")
async def update_resume(
    request: ResumeUpdate,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user_id = user["sub"]
    
    # Handle frontend sending empty strings or nulls
    # SUPPORT: Accept 'resume_path', 'resume_url', 'url', or 'path'
    incoming_data = request.model_dump()
    resume_path = (
        incoming_data.get("resume_path") or 
        incoming_data.get("resume_url") or 
        incoming_data.get("url") or 
        incoming_data.get("path")
    )
    
    if not resume_path:
        # LOG FOR DEBUGGING
        print(f"DEBUG: Received Resume Request Body: {incoming_data}")
        raise HTTPException(status_code=400, detail="Resume path is required")

    # CLEANUP PATH: If frontend sends a full URL, we extract the relative S3 key.
    if resume_path.startswith("http"):
        from src.core.config import S3_BUCKET_NAME
        try:
            if ".com/" in resume_path:
                resume_path = resume_path.split(".com/")[1].split("?")[0]
            elif f"{S3_BUCKET_NAME}/" in resume_path:
                resume_path = resume_path.split(f"{S3_BUCKET_NAME}/")[1].split("?")[0]
        except Exception as e:
            print(f"DEBUG: Error extracting path from URL {resume_path}: {e}")

    # ENSURE SUB-FOLDER: Resumes MUST be in the resumes/ subfolder
    if not resume_path.startswith("resumes/"):
        resume_path = f"resumes/{resume_path}"

    try:
        profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == user_id).first()
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")
            
        profile.resume_uploaded = True
        profile.resume_path = resume_path
        profile.onboarding_step = "AWAITING_SKILLS"
        
        db.commit()
        
        # 2. Fire-and-forget: Processing happens in background
        # Check for API keys (OpenAI is primary, Google is fallback)
        has_api_key = OPENAI_API_KEY or GOOGLE_API_KEY
        
        if has_api_key:
            # Use sync wrapper for BackgroundTasks
            background_tasks.add_task(
                ResumeService.parse_resume_sync, 
                user_id, 
                resume_path, 
                GOOGLE_API_KEY
            )
            return {
                "status": "processing", 
                "message": "Resume linked successfully. AI extraction is running in the background.",
                "resume_path": resume_path
            }
        
        return {
            "status": "resume_linked", 
            "parsed": False, 
            "message": "Resume uploaded but parsing skipped (missing API keys - configure OPENAI_API_KEY or GOOGLE_API_KEY)",
            "resume_path": resume_path
        }
    except Exception as e:
        db.rollback()
        print(f"Resume Upload Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate-resume")
async def generate_resume(
    request: GenerateResumeRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user_id = user["sub"]
    
    try:
        # 1. Prepare data for PDF
        resume_data_dict = request.model_dump()
        
        # 2. Generate PDF using our utility
        pdf_content = PDFGenerator.generate_resume_pdf(resume_data_dict, request.template)
        
        # 3. Upload to AWS S3
        file_path = f"resumes/{user_id}-generated.pdf"
        S3Service.upload_file(pdf_content, file_path, "application/pdf")
        
        # 4. Update Profile (High-Fidelity Sync)
        profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == user_id).first()
        if not profile:
             raise HTTPException(status_code=404, detail="Profile not found")
        
        profile.resume_uploaded = True
        profile.resume_path = file_path
        profile.full_name = request.full_name
        profile.phone_number = request.phone
        profile.location = request.location
        profile.professional_summary = request.bio # Note: Make sure professional_summary is in model
        profile.bio = request.bio
        profile.linkedin_url = request.linkedin
        profile.portfolio_url = request.portfolio
        profile.skills = request.skills
        profile.education_history = [e.model_dump() for e in request.education]
        profile.experience_history = [ex.model_dump() for ex in request.timeline]
        profile.current_role = request.timeline[0].role if request.timeline else None
        profile.last_resume_parse_at = datetime.now()
        profile.ai_extraction_confidence = 1.0

        # 5. Store forensic data in resume_data table
        resume_rec = db.query(ResumeData).filter(ResumeData.user_id == user_id).first()
        if not resume_rec:
            resume_rec = ResumeData(user_id=user_id)
            db.add(resume_rec)
        
        resume_rec.raw_text = f"User built resume manually.\nSummary: {request.bio}"
        resume_rec.raw_education = [e.model_dump() for e in request.education]
        resume_rec.raw_experience = [ex.model_dump() for ex in request.timeline]
        resume_rec.skills = request.skills
        resume_rec.parsed_at = datetime.now()
        
        db.commit()
        return {"status": "resume_generated", "path": file_path}
    except Exception as e:
        db.rollback()
        print(f"Resume Generation Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/suggested-skills")
async def get_suggested_skills(band: str, db: Session = Depends(get_db)):
    """Fetches high-signal skills from the Evolutionary Skill Library."""
    try:
        from sqlalchemy import text
        res = db.execute(text("SELECT name FROM skill_catalog WHERE experience_band = :band AND is_verified = TRUE ORDER BY occurrence_count DESC LIMIT 15"), {"band": band}).fetchall()
        
        if not res:
            return {"skills": CandidateService.get_default_skills(band)}
            
        return {"skills": [s[0] for s in res]}
    except Exception as e:
        print(f"Error fetching skills: {e}")
        return {"skills": []}

@router.post("/skills")
async def update_skills(
    request: SkillsUpdate,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user_id = user["sub"]
    
    try:
        profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == user_id).first()
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")
            
        profile.skills = request.skills
        profile.onboarding_step = "AWAITING_ID"
        
        db.commit()
        return {"status": "skills_updated", "next": "id_verification"}
    except Exception as e:
        db.rollback()
        print(f"Update Skills Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

from src.services.id_verification_service import IDVerificationService

class IDVerifyRequest(BaseModel):
    id_path: Optional[str] = None
    id_url: Optional[str] = None
    path: Optional[str] = None
    url: Optional[str] = None

@router.post("/verify-id")
async def verify_id(
    request: IDVerifyRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user_id = user["sub"]
    # Handle frontend sending empty strings or nulls
    # SUPPORT: Accept 'id_path', 'path', 'url', 'id_url'
    incoming_data = request.model_dump()
    id_path = (
        incoming_data.get("id_path") or 
        incoming_data.get("id_url") or 
        incoming_data.get("url") or 
        incoming_data.get("path")
    )
    
    if not id_path:
        # LOG FOR DEBUGGING
        print(f"DEBUG: Received ID Verify Request Body: {incoming_data}")
        raise HTTPException(status_code=400, detail="ID document path is required")

    # CLEANUP PATH: If frontend sends a full URL, we extract the relative S3 key.
    # The verifier service expects the S3 key, not the full URL.
    if id_path.startswith("http"):
        from src.core.config import S3_BUCKET_NAME
        try:
            # Common patterns: bucket.s3.region.amazonaws.com/key or s3.region.amazonaws.com/bucket/key
            if ".com/" in id_path:
                id_path = id_path.split(".com/")[1].split("?")[0]
            elif f"{S3_BUCKET_NAME}/" in id_path:
                id_path = id_path.split(f"{S3_BUCKET_NAME}/")[1].split("?")[0]
        except Exception as e:
            print(f"DEBUG: Error extracting path from URL {id_path}: {e}")

    try:
        # Step 1: Run AI-based Document Verification
        verification_result = await IDVerificationService.verify_id_document(user_id, id_path)
        
        profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == user_id).first()
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")

        if not verification_result.get("verified"):
            # Mark as unverified and why (for UI feedback)
            reason = verification_result.get("reason", "Unknown verification error.")
            profile.identity_verified = False
            profile.identity_proof_path = id_path
            profile.onboarding_step = "AWAITING_ID"
            db.commit()
            
            raise HTTPException(status_code=400, detail=f"Identity rejection: {reason}")

        # Step 2: Update Profile for success
        profile.identity_verified = True
        profile.identity_proof_path = id_path
        profile.onboarding_step = "AWAITING_TC"
        db.commit()
        
        return {
            "status": "success", 
            "id_verified": True, 
            "doc_type": verification_result.get("document_type"),
            "path": id_path
        }
    except HTTPException as h_err:
        raise h_err
    except Exception as e:
        db.rollback()
        print(f"VERIFY ID ERROR: {e}")
        raise HTTPException(status_code=500, detail="Internal processing error during verification.")

@router.post("/accept-tc")
async def accept_tc(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user_id = user["sub"]
    try:
        profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == user_id).first()
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")
            
        profile.terms_accepted = True
        profile.onboarding_step = "COMPLETED"
        profile.assessment_status = "not_started"
        
        db.commit()

        NotificationService.create_notification(
            user_id=user_id,
            type="ONBOARDING_COMPLETED",
            title="Profile Synchronized",
            message="Your high-trust profile is now fully active. You can now transmit signals to enterprise recruiters."
        )
        return {"status": "tc_accepted"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

# --- JOB DISCOVERY & APPLICATIONS ---

@router.get("/jobs", response_model=List[CandidateJobResponse])
async def list_jobs(user: dict = Depends(get_current_user)):
    """Fetch available jobs for the candidate."""
    return await CandidateService.list_available_jobs(user["sub"])

@router.post("/jobs/{job_id}/apply")
async def apply_to_job(job_id: str, user: dict = Depends(get_current_user)):
    """Apply for a job."""
    return await CandidateService.apply_to_job(user["sub"], job_id)

@router.post("/jobs/{job_id}/save")
async def save_job(job_id: str, user: dict = Depends(get_current_user)):
    """Save/Pin a job."""
    return await CandidateService.save_job(user["sub"], job_id)

@router.delete("/jobs/{job_id}/unsave")
async def unsave_job(job_id: str, user: dict = Depends(get_current_user)):
    """Unsave/Unpin a job."""
    return await CandidateService.unsave_job(user["sub"], job_id)

@router.get("/applications", response_model=List[JobApplicationResponse])
async def list_applications(user: dict = Depends(get_current_user)):
    """Fetch jobs user has applied to."""
    return await CandidateService.get_my_applications(user["sub"])

@router.get("/applications/{application_id}", response_model=JobApplicationDetailResponse)
async def get_application_detail(
    application_id: str,
    user: dict = Depends(get_current_user)
):
    """Fetch specific application detail."""
    detail = await CandidateService.get_application_detail(user["sub"], application_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Application not found")
    return detail

@router.get("/recommended-jobs")
async def get_recommended_jobs(
    filter_type: str = "role_match",
    location: Optional[str] = None,
    experience_band: Optional[str] = None,
    min_salary: Optional[float] = None,
    max_salary: Optional[float] = None,
    user: dict = Depends(get_current_user)
):
    """
    Get personalized job recommendations for the candidate.
    
    Filter types:
    - role_match (default): Find lateral moves or promotions based on current role
    - skills_focus: Leverage specialized skills for premium compensation
    - opportunity_explorer: Discover unexpected opportunities via career path analysis
    
    Returns: Ranked jobs with match scores and reasoning
    """
    try:
        result = await CandidateService.get_recommended_jobs(
            user_id=user["sub"],
            filter_type=filter_type,
            location=location,
            experience_band=experience_band,
            min_salary=min_salary,
            max_salary=max_salary,
            exclude_applied=True,
            limit=150
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/recommended-companies")
async def get_recommended_companies(
    filter_type: str = "culture_fit",
    industry: Optional[List[str]] = None,
    company_size: Optional[str] = None,
    location: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    """
    Get personalized company recommendations for the candidate.
    
    Filter types:
    - culture_fit (default): Companies aligned with candidate's values & work style
    - hiring_intent: Companies actively hiring for the candidate's profile
    - growth_hub: High-growth companies that are breakout opportunities
    
    Returns: Ranked companies with match scores and hiring signals
    """
    try:
        result = await CandidateService.get_recommended_companies(
            user_id=user["sub"],
            filter_type=filter_type,
            industry=industry,
            company_size=company_size,
            location=location,
            exclude_applied=True,
            limit=100
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/recommendations")
async def get_candidate_recommendations(
    filter_type: str = "culture_fit",
    location: Optional[str] = None,
    min_salary: Optional[int] = None,
    user: dict = Depends(get_current_user)
):
    """Fetch recommended companies/recruiters for the candidate with location/salary filtering."""
    from src.services.recruiter_service import recruiter_service
    return await recruiter_service.get_candidate_recommendations_for_candidate(
        user["sub"], 
        filter_type=filter_type,
        location=location,
        min_salary=min_salary
    )

@router.get("/job-recommendations")
async def get_job_recommendations(
    priority: str = "skills",
    location: Optional[str] = None,
    min_salary: Optional[int] = None,
    user: dict = Depends(get_current_user)
):
    """Specific matching for jobs with priority weighting."""
    from src.services.recruiter_service import recruiter_service
    return await recruiter_service.get_job_recommendations(
        user["sub"], 
        priority=priority,
        location=location,
        min_salary=min_salary
    )
