from fastapi import APIRouter, Depends, HTTPException, Query
from src.core.dependencies import get_current_user
from src.services.recruiter_service import recruiter_service
from src.services.s3_service import S3Service
from src.core.database import SessionLocal
import uuid
from src.core.models import RecruiterProfile, Company, User, RecruiterSetting, BlockedUser
from src.models.invitation import TeamInvitation
from src.schemas.recruiter import (
    RecruiterProfileUpdate, 
    CompanyProfileUpdate, 
    RecruiterStats,
    JobCreate,
    JobUpdate,
    JobResponse,
    JobAIPrompt,
    ApplicationStatusUpdate,
    BulkApplicationStatusUpdate,
    JobInviteRequest,
    TeamInviteRequest,
    TeamMemberUpdate,
    RecruiterAccountSettingsUpdate
)
from src.services.id_verification_service import IDVerificationService
from src.services.notification_service import NotificationService
from src.services.s3_service import S3Service
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_

router = APIRouter(prefix="/recruiter", tags=["recruiter"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class RegistrationUpdate(BaseModel):
    registration_number: str

class BioRequest(BaseModel):
    website: str

class CompanyDetailsUpdate(BaseModel):
    company_id: str
    name: str
    website: str
    location: str
    description: str

class RecruiterAnswerSubmission(BaseModel):
    question_text: str
    answer: str
    category: str

def _profile_to_dict(profile: RecruiterProfile | None, company: Company | None = None) -> Dict[str, Any] | None:
    if not profile:
        return None
    payload = {
        "user_id": str(profile.user_id),
        "company_id": str(profile.company_id) if profile.company_id else None,
        "full_name": profile.full_name,
        "job_title": profile.job_title,
        "bio": profile.bio,
        "phone_number": profile.phone_number,
        "linkedin_url": profile.linkedin_url,
        "onboarding_step": profile.onboarding_step,
        "completion_score": profile.completion_score,
        "identity_verified": profile.identity_verified,
        "is_admin": profile.is_admin,
        "account_status": profile.account_status,
        "warning_count": profile.warning_count,
        "terms_accepted": profile.terms_accepted,
        "team_role": profile.team_role,
        "professional_persona": profile.professional_persona,
        "assessment_status": profile.assessment_status,
    }
    if company:
        payload["companies"] = {
            "id": str(company.id),
            "name": company.name,
            "website": company.website,
            "logo_url": company.logo_url,
            "description": company.description,
            "location": company.location,
            "industry_category": company.industry_category,
            "registration_number": company.registration_number,
            "profile_score": company.profile_score or 0,
            "sales_model": company.sales_model,
            "target_market": company.target_market,
            "domain": company.domain,
            "hiring_focus_areas": company.hiring_focus_areas or [],
            "avg_deal_size_range": company.avg_deal_size_range,
            "brand_colors": company.brand_colors or {},
            "logo_url": S3Service.get_signed_url(company.logo_url) if company.logo_url else None,
            "life_at_photo_urls": [S3Service.get_signed_url(u) for u in (company.life_at_photo_urls or [])],
        }
    return payload

@router.post("/registration")
async def update_registration(
    data: RegistrationUpdate,
    user: dict = Depends(get_current_user)
):
    return await recruiter_service.update_company_registration(
        user["sub"],
        data.registration_number,
    )

@router.post("/details")
@router.post("/company-details")
async def update_company_details(
    data: CompanyDetailsUpdate,
    user: dict = Depends(get_current_user)
):
    return await recruiter_service.update_company_details(
        user["sub"],
        data.company_id,
        data.model_dump(),
    )

@router.get("/profile")
async def get_profile(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    user_id = user["sub"]
    blocked = db.query(BlockedUser).filter(BlockedUser.user_id == user_id).first()
    if blocked:
        raise HTTPException(status_code=403, detail="Account blocked")
    profile = await recruiter_service.get_or_create_profile(user_id)
    company = db.query(Company).filter(Company.id == profile.company_id).first() if profile and profile.company_id else None
    return _profile_to_dict(profile, company)

@router.get("/company-status")
async def get_company_status(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    user_id = user["sub"]
    profile = await recruiter_service.get_or_create_profile(user_id)
    company_id = profile.company_id if profile else None
    if not company_id:
        return {"has_score": False, "score": 0}
    company = db.query(Company).filter(Company.id == company_id).first()
    if company and (company.profile_score or 0) > 0:
        return {"has_score": True, "score": company.profile_score, "company_name": company.name}
    return {"has_score": False, "score": 0}

@router.get("/recommended-candidates")
async def get_recommended_candidates(
    filter_type: str = "culture_fit",
    location: Optional[str] = None,
    max_salary: Optional[str] = None,
    skills: Optional[str] = None,
    sales_model: Optional[str] = None,
    target_market: Optional[str] = None,
    experience_band: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    params = {
        "location": location,
        "max_salary": max_salary,
        "required_skills": skills.split(",") if skills else [],
        "sales_model": sales_model,
        "target_market": target_market,
        "experience_band": experience_band
    }
    return await recruiter_service.get_recommended_candidates(user["sub"], filter_type, params)

@router.patch("/profile")
async def update_profile(data: RecruiterProfileUpdate, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    user_id = user["sub"]
    profile = db.query(RecruiterProfile).filter(RecruiterProfile.user_id == user_id).first()
    if not profile: raise HTTPException(status_code=404)
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(profile, k, v)
    db.commit()
    new_score = await recruiter_service.sync_completion_score(user_id)
    return {"status": "ok", "completion_score": new_score}

@router.post("/invite")
async def invite_member(data: TeamInviteRequest, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    user_id = user["sub"]
    prof = await recruiter_service.get_or_create_profile(user_id)
    if not prof or not prof.is_admin:
        raise HTTPException(status_code=403)
    inv = TeamInvitation(company_id=prof.company_id, inviter_id=user_id, email=data.email)
    db.add(inv)
    db.commit()
    return {"status": "invited"}

@router.get("/stats", response_model=RecruiterStats)
async def get_stats(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    stats = await recruiter_service.get_recruiter_stats(user["sub"])
    profile = db.query(RecruiterProfile).filter(RecruiterProfile.user_id == user["sub"]).first()
    company = db.query(Company).filter(Company.id == profile.company_id).first() if profile and profile.company_id else None
    return {
        "active_jobs_count": stats.get("active_jobs_count", 0),
        "total_hires_count": stats.get("total_hires_count", 0),
        "invites_sent_count": 0,
        "pending_applications_count": stats.get("total_applications", 0),
        "response_rate": 0.0,
        "avg_hiring_cycle": None,
        "candidate_feedback_score": float(getattr(company, "candidate_feedback_score", 0) or 0),
        "company_quality_score": stats.get("company_quality_score", 0),
        "visibility_tier": getattr(company, "visibility_tier", None) or "standard",
        "assessment_status": stats.get("assessment_status", "not_started"),
        "verification_status": "verified" if profile and profile.identity_verified else "pending",
        "account_status": getattr(profile, "account_status", "Active") or "Active",
        "completion_score": stats.get("completion_score", 0),
    }

@router.get("/settings")
async def get_settings(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    user_id = user["sub"]
    settings = db.query(RecruiterSetting).filter(RecruiterSetting.user_id == user_id).first()
    if not settings:
        settings = RecruiterSetting(user_id=user_id)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings

@router.patch("/settings")
async def update_settings(data: RecruiterAccountSettingsUpdate, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    user_id = user["sub"]
    settings = db.query(RecruiterSetting).filter(RecruiterSetting.user_id == user_id).first()
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(settings, k, v)
    db.commit()
    return settings

@router.get("/team")
async def get_team(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    user_id = user["sub"]
    prof = await recruiter_service.get_or_create_profile(user_id)
    if not prof or not prof.company_id:
        return []
    members = db.query(RecruiterProfile).options(joinedload(RecruiterProfile.user)).filter(RecruiterProfile.company_id == prof.company_id).all()
    return [{
        "user_id": str(m.user_id),
        "full_name": m.full_name,
        "is_admin": bool(m.is_admin),
        "users": {"email": m.user.email if m.user else None},
        "email": m.user.email if m.user else None,
        "assessment_status": m.assessment_status or "not_started"
    } for m in members]


class AssetUploadRequest(BaseModel):
    file_name: str
    content_type: str
    category: str # 'logo' or 'life'

@router.post('/upload-url')
async def get_upload_url(data: AssetUploadRequest, user: dict = Depends(get_current_user)):
    user_id = user['sub']
    # category can be 'logo', 'life' (photos), or 'banner'
    file_extension = data.file_name.split('.')[-1] if '.' in data.file_name else 'jpg'
    # Ensure unique filename to prevent collisions and caching
    unique_filename = f"{uuid.uuid4()}.{file_extension}"
    file_path = f'recruiter/{user_id}/{data.category}/{unique_filename}'
    
    upload_url = S3Service.get_upload_presigned_url(file_path, data.content_type)
    if not upload_url:
        raise HTTPException(status_code=500, detail="Failed to generate upload URL")
        
    return {'upload_url': upload_url, 'file_path': file_path}

@router.post('/update-branding')
async def update_branding(data: Dict[str, Any], user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    user_id = user['sub']
    profile = db.query(RecruiterProfile).filter(RecruiterProfile.user_id == user_id).first()
    if not profile or not profile.company_id:
        raise HTTPException(status_code=404, detail='Company not found')
    
    company = db.query(Company).filter(Company.id == profile.company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail='Company not found')
    
    if 'logo_url' in data:
        # If it's a signed URL or full URL, we should ideally store the path
        # But for now we just store whatever the frontend sends
        company.logo_url = data['logo_url']
        
    if 'brand_colors' in data:
        company.brand_colors = data['brand_colors']
        
    if 'life_at_photo_urls' in data:
        urls = data['life_at_photo_urls']
        # If it's a JSON string, parse it. If it's already a list, keep it.
        # SQLAlchemy ARRAY(Text) requires a Python list.
        if isinstance(urls, str):
            import json
            try:
                urls = json.loads(urls)
            except:
                urls = [urls]
        
        if not isinstance(urls, list):
            urls = [str(urls)]
            
        company.life_at_photo_urls = urls
        
    db.commit()
    return {'status': 'ok'}

@router.post("/details")
async def update_company_details_legacy(
    data: CompanyDetailsUpdate,
    user: dict = Depends(get_current_user)
):
    return await recruiter_service.update_company_details(
        user["sub"],
        data.company_id,
        data.model_dump(),
    )

@router.post("/generate-bio")
async def generate_bio(data: BioRequest):
    bio = await recruiter_service.generate_company_bio(data.website)
    return {"bio": bio}

@router.get("/assessment-questions")
async def get_assessment_questions(user: dict = Depends(get_current_user)):
    questions = await recruiter_service.get_assessment_questions(user["sub"])
    return questions

@router.post("/submit-answer")
async def submit_answer(data: RecruiterAnswerSubmission, user: dict = Depends(get_current_user)):
    try:
        # Increase timeout for the evaluation as it involves AI
        import asyncio
        return await asyncio.wait_for(
            recruiter_service.evaluate_recruiter_answer(
                user["sub"],
                data.question_text,
                data.answer,
                data.category,
            ),
            timeout=45.0
        )
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="AI Evaluation timed out. Your answer will be processed in the background.")
    except Exception as e:
        print(f"CRITICAL ERROR IN SUBMIT-ANSWER: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/complete-assessment")
async def complete_assessment(user: dict = Depends(get_current_user)):
    return await recruiter_service.get_assessment_summary(user["sub"])

@router.post("/skip-assessment")
async def skip_assessment(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    profile = db.query(RecruiterProfile).filter(RecruiterProfile.user_id == user["sub"]).first()
    if profile:
        profile.onboarding_step = "COMPLETED"
        db.commit()
    return {"status": "skipped"}

@router.post("/tab-switch")
async def track_tab_switch(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Track if recruiter switches tabs during assessment for quality monitoring"""
    user_id = user["sub"]
    profile = db.query(RecruiterProfile).filter(RecruiterProfile.user_id == user_id).first()
    if profile:
        profile.warning_count = (profile.warning_count or 0) + 1
        db.commit()
        print(f"DEBUG: Tab switch tracked for recruiter {user_id}. Warning count: {profile.warning_count}")
    return {"status": "tracked", "warning_count": profile.warning_count if profile else 0}

@router.get("/company")
async def get_company(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    profile = db.query(RecruiterProfile).filter(RecruiterProfile.user_id == user["sub"]).first()
    if not profile or not profile.company_id:
        raise HTTPException(status_code=404, detail="Company not found")
    company = db.query(Company).filter(Company.id == profile.company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return _profile_to_dict(profile, company).get("companies")

@router.patch("/company")
async def patch_company(data: CompanyProfileUpdate, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    profile = db.query(RecruiterProfile).filter(RecruiterProfile.user_id == user["sub"]).first()
    if not profile or not profile.company_id:
        raise HTTPException(status_code=404, detail="Company not found")
    company = db.query(Company).filter(Company.id == profile.company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(company, k, v)
    db.commit()
    db.refresh(company)
    return _profile_to_dict(profile, company).get("companies")

@router.patch("/verify-id")
async def verify_id(data: Dict[str, Any], user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    result = await IDVerificationService.verify_id_document(user["sub"], data.get("id_path"))
    if result.get("verified"):
        profile = db.query(RecruiterProfile).filter(RecruiterProfile.user_id == user["sub"]).first()
        if profile:
            profile.identity_verified = True
            db.commit()
    return {"id_verified": bool(result.get("verified")), "details": result}

@router.post("/verify-id")
async def verify_id_post(data: Dict[str, Any], user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    return await verify_id(data, user, db)

@router.get("/jobs")
async def get_jobs(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    from src.core.models import Job
    profile = db.query(RecruiterProfile).filter(RecruiterProfile.user_id == user["sub"]).first()
    if not profile or not profile.company_id:
        return []
    jobs = db.query(Job).filter(Job.company_id == profile.company_id).order_by(Job.created_at.desc()).all()
    return [{
        "id": str(job.id),
        "company_id": str(job.company_id) if job.company_id else None,
        "title": job.title,
        "description": job.description,
        "experience_band": job.experience_band or "mid",
        "job_type": job.job_type or "onsite",
        "location": job.location,
        "salary_range": job.salary_range,
        "status": job.status or "active",
        "metadata": getattr(job, "metadata_", {}) or {},
        "created_at": job.created_at,
        "updated_at": getattr(job, "created_at", None),
        "is_ai_generated": bool((getattr(job, "metadata_", {}) or {}).get("is_ai_generated", False)),
    } for job in jobs]

@router.post("/jobs")
async def create_job(data: JobCreate, user: dict = Depends(get_current_user)):
    return await recruiter_service.create_job(user["sub"], data.model_dump())

@router.patch("/jobs/{job_id}")
async def update_job(job_id: str, data: JobUpdate, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    from src.core.models import Job
    profile = db.query(RecruiterProfile).filter(RecruiterProfile.user_id == user["sub"]).first()
    job = db.query(Job).filter(Job.id == job_id).first()
    if not profile or not job or job.company_id != profile.company_id:
        raise HTTPException(status_code=404, detail="Job not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        if k == "metadata":
            setattr(job, "metadata_", v)
        else:
            setattr(job, k, v)
    db.commit()
    return {"status": "updated", "id": str(job.id)}

@router.delete("/jobs/{job_id}")
async def delete_job(job_id: str, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    from src.core.models import Job
    profile = db.query(RecruiterProfile).filter(RecruiterProfile.user_id == user["sub"]).first()
    job = db.query(Job).filter(Job.id == job_id).first()
    if not profile or not job or job.company_id != profile.company_id:
        raise HTTPException(status_code=404, detail="Job not found")
    db.delete(job)
    db.commit()
    return {"status": "deleted", "id": job_id}

@router.get("/applications/pipeline")
async def applications_pipeline(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    from src.core.models import JobApplication, Job, CandidateProfile, ResumeData, ProfileScore
    from sqlalchemy import text
    profile = db.query(RecruiterProfile).filter(RecruiterProfile.user_id == user["sub"]).first()
    if not profile or not profile.company_id:
        return []
    apps = db.query(JobApplication).join(Job, JobApplication.job_id == Job.id).filter(Job.company_id == profile.company_id).order_by(JobApplication.created_at.desc()).all()
    results = []
    for app in apps:
        job = db.query(Job).filter(Job.id == app.job_id).first()
        candidate = db.query(CandidateProfile).filter(CandidateProfile.user_id == app.candidate_id).first()
        score = db.query(ProfileScore).filter(ProfileScore.user_id == app.candidate_id).first()
        resume = db.query(ResumeData).filter(ResumeData.user_id == app.candidate_id).first()

        # Fetch Interviews & Slots for the Recruiter
        interviews_raw = db.execute(text("""
            SELECT id, status, round_name, round_number, format, meeting_link, location, interviewer_names, candidate_joined_at, recruiter_joined_at
            FROM interviews 
            WHERE application_id = :aid
        """), {"aid": app.id}).fetchall()
        
        interviews = []
        for r in interviews_raw:
            i_dict = dict(r._mapping)
            i_dict["id"] = str(i_dict["id"])
            
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
                s_dict["is_selected"] = bool(s_dict["is_selected"])
                i_dict["interview_slots"].append(s_dict)
                
            interviews.append(i_dict)

        user_row = db.query(User).filter(User.id == app.candidate_id).first()
        results.append({
            "id": str(app.id),
            "status": app.status,
            "feedback": None,
            "created_at": app.created_at,
            "job_id": str(app.job_id),
            "candidate_id": str(app.candidate_id),
            "jobs": {
                "id": str(job.id) if job else None,
                "title": job.title if job else "Untitled Role",
                "status": job.status if job else "active",
                "location": job.location if job else None,
                "created_at": job.created_at if job else None,
            },
            "candidate_profiles": {
                "user_id": str(candidate.user_id) if candidate else str(app.candidate_id),
                "full_name": candidate.full_name if candidate else "Unknown Candidate",
                "current_role": candidate.current_role if candidate else None,
                "years_of_experience": candidate.years_of_experience if candidate else None,
                "phone_number": candidate.phone_number if candidate else None,
                "location": candidate.location if candidate else None,
                "gender": candidate.gender if candidate else None,
                "birthdate": candidate.birthdate if candidate else None,
                "referral": None,
                "bio": candidate.bio if candidate else None,
                "profile_photo_url": candidate.profile_photo_url if candidate else None,
                "email": user_row.email if user_row else None,
                "resume_path": S3Service.get_signed_url(candidate.resume_path) if candidate and candidate.resume_path else None,
            },
            "resume_data": {
                "timeline": resume.timeline if resume else None,
                "education": resume.education if resume else None,
                "achievements": resume.achievements if resume else [],
                "skills": resume.skills if resume else [],
            } if resume else None,
            "profile_scores": {
                "final_score": score.final_score if score else 0,
            },
            "is_skill_match": bool(score and (score.final_score or 0) >= 60),
            "interviews": interviews,
        })
    return results

@router.post("/applications/bulk-status")
async def bulk_application_status(data: BulkApplicationStatusUpdate, db: Session = Depends(get_db)):
    from src.core.models import JobApplication, Job, ChatThread
    from src.services.notification_service import NotificationService
    
    updated_count = 0
    for application_id in data.application_ids:
        app = db.query(JobApplication).filter(JobApplication.id == application_id).first()
        if app:
            old_status = app.status
            app.status = data.status
            updated_count += 1
            
            # Logic for shortlisting
            if data.status == "shortlisted" and old_status != "shortlisted":
                job = db.query(Job).filter(Job.id == app.job_id).first()
                
                # 1. Open/Create Chat Thread
                chat = db.query(ChatThread).filter(
                    ChatThread.candidate_id == app.candidate_id,
                    ChatThread.recruiter_id == job.recruiter_id
                ).first()
                
                if chat:
                    chat.is_active = True
                else:
                    new_chat = ChatThread(
                        candidate_id=app.candidate_id,
                        recruiter_id=job.recruiter_id,
                        is_active=True
                    )
                    db.add(new_chat)
                
                # 2. Send Notification to Candidate
                NotificationService.create_notification(
                    user_id=app.candidate_id,
                    type="APPLICATION_SHORTLISTED",
                    title="Congratulations! You've been shortlisted",
                    message=f"You have been shortlisted for the {job.title} position. The recruiter can now message you directly.",
                    metadata={
                        "application_id": str(app.id),
                        "job_id": str(job.id),
                        "job_title": job.title
                    },
                    db=db
                )
                
    db.commit()
    return {"status": "updated", "count": updated_count}

@router.get("/talent-pool")
async def talent_pool():
    return await recruiter_service.get_talent_pool()

@router.get("/candidate-pool")
async def candidate_pool(db: Session = Depends(get_db)):
    from src.core.models import CandidateProfile, ResumeData
    candidates = db.query(CandidateProfile).all()
    results = []
    for candidate in candidates:
        resume = db.query(ResumeData).filter(ResumeData.user_id == candidate.user_id).first()
        years = candidate.years_of_experience or 0
        experience = "leadership" if years >= 10 else "senior" if years >= 5 else "mid" if years >= 1 else "fresher"
        results.append({
            "user_id": str(candidate.user_id),
            "full_name": candidate.full_name or "Unknown Candidate",
            "current_role": candidate.current_role,
            "experience": experience,
            "years_of_experience": years,
            "profile_strength": candidate.profile_strength or "Low",
            "identity_verified": bool(candidate.identity_verified),
            "trust_score": candidate.final_profile_score or 0,
            "assessment_status": candidate.assessment_status or "not_started",
            "skills": resume.skills if resume and resume.skills else [],
            "profile_photo_url": candidate.profile_photo_url,
            "resume_path": S3Service.get_signed_url(candidate.resume_path) if candidate.resume_path else None,
        })
    return results

@router.post("/jobs/generate-ai")
async def generate_job_ai(data: JobAIPrompt):
    from src.services.recruiter_service import recruiter_service
    
    # 1. Enhanced prompt to ensure extraction from text
    prompt = f"""
    Analyze the user prompt and generate a professional job description.
    USER PROMPT: "{data.prompt}"
    
    CRITICAL INSTRUCTIONS:
    1. If a location is mentioned in the "USER PROMPT", use it. Otherwise use the provided context location: "{data.location or 'Global'}".
    2. Experience Band context: "{data.experience_band or 'Mid-Level'}".
    3. Calculate a "salary_range" based on the extracted role, location, and experience band using CURRENT 2026 tech sales industry standards.
    4. Provide the extracted location in the "location" field.

    Structure the response as a valid JSON object with:
    - "title": (string)
    - "location": (string, ACTUAL location extracted or context)
    - "description": (string, 2-3 paragraphs about company and role)
    - "requirements": (array of strings, 5-7 key bullets)
    - "skills_required": (array of strings, top 5 technical/soft skills)
    - "job_type": "onsite", "remote", or "hybrid"
    - "salary_range": (string, e.g. "$80k - $120k" or "Market Standard")
    - "currency": (string, e.g. "USD", "AUD", "INR" based on location)
    """
    
    try:
        ai_data = await recruiter_service._call_ai_json(prompt, "You are an elite Tech Sales Recruiter AI specialized in market-accurate job generation.")
        if ai_data and ai_data.get("title"):
            return {
                "title": ai_data.get("title"),
                "description": ai_data.get("description"),
                "requirements": ai_data.get("requirements") or [],
                "skills_required": ai_data.get("skills_required") or [],
                "experience_band": data.experience_band,
                "job_type": ai_data.get("job_type") or "onsite",
                "location": ai_data.get("location") or data.location,
                "salary_range": ai_data.get("salary_range") or "Market Standard",
                "currency": ai_data.get("currency") or "USD"
            }
    except Exception as e:
        print(f"DEBUG: AI Job Generation Failed: {e}")

    # Fallback to template if AI fails
    title = data.prompt.strip()[:80] or "Generated Role"
    return {
        "title": title,
        "description": f"Professional job brief for {title} in {data.location or 'the target market'}.",
        "requirements": ["Strong communication", "Proven track record", "Strategic thinking"],
        "skills_required": ["Sales", "Communication", "Problem Solving"],
        "experience_band": data.experience_band,
        "job_type": "onsite",
        "location": data.location,
        "salary_range": "Competitive",
        "currency": "USD"
    }

@router.post("/check-job-potential")
async def check_job_potential(data: Dict[str, Any], db: Session = Depends(get_db)):
    from src.services.recruiter_service import recruiter_service
    
    # Use the same weighted matching logic from the talent pool
    recommendations = await recruiter_service.get_recommended_candidates(
        skills=data.get("skills"),
        experience_years=data.get("experience_years"),
        location=data.get("location"),
        salary_expectation=data.get("salary_range")
    )
    
    count = len(recommendations)
    return {
        "count": count,
        "message": f"Found {count} highly relevant candidates in our talent pool matching your requirements.",
    }

@router.get("/candidate/{candidate_id}")
async def get_candidate(candidate_id: str, db: Session = Depends(get_db)):
    from src.core.models import CandidateProfile, ResumeData, ProfileScore
    candidate = db.query(CandidateProfile).filter(CandidateProfile.user_id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    resume = db.query(ResumeData).filter(ResumeData.user_id == candidate_id).first()
    score = db.query(ProfileScore).filter(ProfileScore.user_id == candidate_id).first()
    user_row = db.query(User).filter(User.id == candidate_id).first()
    return {
        "user_id": str(candidate.user_id),
        "full_name": candidate.full_name,
        "email": user_row.email if user_row else None,
        "bio": candidate.bio,
        "current_role": candidate.current_role,
        "years_of_experience": candidate.years_of_experience,
        "location": candidate.location,
        "phone_number": candidate.phone_number,
        "profile_photo_url": candidate.profile_photo_url,
        "resume_path": S3Service.get_signed_url(candidate.resume_path) if candidate.resume_path else None,
        "skills": resume.skills if resume else [],
        "resume_data": {
            "timeline": resume.timeline if resume else None,
            "education": resume.education if resume else None,
            "achievements": resume.achievements if resume else [],
            "skills": resume.skills if resume else [],
        } if resume else None,
        "profile_scores": {
            "final_score": score.final_score if score else 0,
        },
    }

@router.post("/candidate/{candidate_id}/invite")
async def invite_candidate(candidate_id: str, data: JobInviteRequest, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    NotificationService.create_notification(
        candidate_id,
        "job_invite",
        "New recruiter interest",
        data.message or "A recruiter invited you to explore a role.",
        {"job_id": data.job_id, "recruiter_id": user["sub"], "custom_role_title": data.custom_role_title},
        db,
    )
    return {"status": "invited"}

@router.patch("/team/{member_id}/role")
async def update_team_role(member_id: str, data: TeamMemberUpdate, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    profile = db.query(RecruiterProfile).filter(RecruiterProfile.user_id == user["sub"]).first()
    if not profile or not profile.is_admin or not profile.company_id:
        raise HTTPException(status_code=403, detail="Admin access required")
    member = db.query(RecruiterProfile).filter(
        RecruiterProfile.user_id == member_id,
        RecruiterProfile.company_id == profile.company_id,
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Team member not found")
    member.is_admin = data.is_admin
    member.team_role = "admin" if data.is_admin else "recruiter"
    db.commit()
    return {"status": "updated", "user_id": member_id, "is_admin": member.is_admin}

@router.delete("/team/{member_id}")
async def remove_team_member(member_id: str, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    profile = db.query(RecruiterProfile).filter(RecruiterProfile.user_id == user["sub"]).first()
    if not profile or not profile.is_admin or not profile.company_id:
        raise HTTPException(status_code=403, detail="Admin access required")
    member = db.query(RecruiterProfile).filter(
        RecruiterProfile.user_id == member_id,
        RecruiterProfile.company_id == profile.company_id,
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Team member not found")
    db.delete(member)
    db.commit()
    return {"status": "removed", "user_id": member_id}

@router.get("/market-insights")
async def market_insights(db: Session = Depends(get_db)):
    from src.core.models import CandidateProfile, ResumeData, Job
    candidates = db.query(CandidateProfile).all()
    resumes = db.query(ResumeData).all()
    jobs = db.query(Job).filter(Job.status == "active").all()

    skill_counts: Dict[str, int] = {}
    for resume in resumes:
        for skill in (resume.skills or [])[:15]:
            skill_counts[skill] = skill_counts.get(skill, 0) + 1

    talent_density = [
        {"skill": skill, "percentage": count}
        for skill, count in sorted(skill_counts.items(), key=lambda item: item[1], reverse=True)[:8]
    ]
    max_count = max([item["percentage"] for item in talent_density], default=1)
    for item in talent_density:
        item["percentage"] = int((item["percentage"] / max_count) * 100) if max_count else 0

    competition_index = []
    for item in talent_density[:6]:
        active_openings = sum(1 for job in jobs if item["skill"].lower() in ((job.description or "") + " " + (job.title or "")).lower())
        competition_index.append({
            "skill": item["skill"],
            "active_openings": active_openings,
        })

    return {
        "market_state": "LIVE",
        "pool_size": len(candidates),
        "talent_density": talent_density or [
            {"skill": "General", "percentage": 100}
        ],
        "competition_index": competition_index or [
            {"skill": "General", "active_openings": len(jobs)}
        ],
    }


@router.post("/profile-matches/persist")
async def persist_profile_matches(
    matches: List[Dict[str, Any]],
    user: dict = Depends(get_current_user)
):
    """
    Persist profile match recommendations to database for caching.
    Call this after fetching recommendations to cache the results.
    
    Args:
        matches: List of candidate matches from recommendations
    
    Returns:
        Number of matches persisted
    """
    recruiter_id = user.get("sub")
    
    try:
        count = recruiter_service.persist_profile_matches(
            recruiter_id=recruiter_id,
            matches=matches
        )
        return {
            "status": "success",
            "message": f"Persisted {count} profile matches",
            "count": count
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

