from src.core.database import db_engine, SessionLocal
from src.core.models import (
    User, RecruiterProfile, Company, Job, JobApplication, 
    ProfileScore, ResumeData, JobApplicationHistory, ChatThread, ProfileMatch, CandidateProfile,
    RecruiterAssessmentResponse, AssessmentResponse, BlockedUser, RecruiterSetting
)
from src.models.invitation import TeamInvitation
from src.services.s3_service import S3Service
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, text, desc, and_, or_
import json
import random
import httpx
import asyncio
from bs4 import BeautifulSoup
from typing import List, Dict, Optional, Any
from datetime import datetime
import re
from google import genai
from src.core.config import GOOGLE_API_KEY, OPENROUTER_API_KEY, OPENAI_API_KEY
import uuid

# --- Utility for City Tiering ---
TIER_1_CITIES = ['bangalore', 'bengaluru', 'mumbai', 'delhi', 'hyderabad', 'chennai', 'kolkata', 'pune', 'ahmedabad']
TIER_2_CITIES = ['jaipur', 'lucknow', 'nagpur', 'indore', 'thiruvananthapuram', 'kochi', 'coimbatore', 'madurai', 'mysore', 'chandigarh', 'bhopal', 'surat', 'patna', 'ranchi']

def getCityTier(location: str | None) -> str:
    if not location: return "Tier 3"
    loc = str(location).lower()
    if any(city in loc for city in TIER_1_CITIES): return "Tier 1"
    if any(city in loc for city in TIER_2_CITIES): return "Tier 2"
    return "Tier 3"

class RecruiterService:
    def __init__(self):
        self._client = httpx.AsyncClient(timeout=30.0)
        self.ai_client = genai.Client(api_key=GOOGLE_API_KEY)
        self.openai_key = OPENAI_API_KEY
        self.model_name = 'gemini-2.0-flash'

    async def _call_ai(self, prompt: str, system_message: str = "You are a helpful recruitment assistant.") -> str:
        """
        Unified High-Precision AI Caller (OpenAI Primary + Gemini Secondary + OpenRouter Fallback).
        """
        # 1. Primary OpenAI Call
        if self.openai_key:
            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    response = await client.post(
                        "https://api.openai.com/v1/chat/completions",
                        headers={
                            "Authorization": f"Bearer {self.openai_key}",
                            "Content-Type": "application/json",
                        },
                        json={
                            "model": "gpt-4o",
                            "messages": [
                                {"role": "system", "content": system_message},
                                {"role": "user", "content": prompt}
                            ],
                            "temperature": 0.7
                        }
                    )
                    if response.status_code == 200:
                        data = response.json()
                        return data['choices'][0]['message']['content'].strip()
                    else:
                        print(f"DEBUG: Recruiter OpenAI Failed ({response.status_code}): {response.text}")
            except Exception as oai_e:
                print(f"DEBUG: Recruiter OpenAI Exception: {str(oai_e)}")

        # 2. Secondary Gemini Call
        try:
            import google.generativeai as genai
            from google.generativeai import types
            
            # Use synchronous execute in thread to avoid event loop issues with some versions of the SDK
            def generate():
                return self.ai_client.models.generate_content(
                    model=self.model_name,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=system_message,
                        temperature=0.7,
                    )
                )
            
            response = await asyncio.to_thread(generate)
            if response and response.text:
                return response.text.strip()
        except Exception as e:
            print(f"DEBUG: Recruiter Gemini Secondary Failed: {str(e)}. Falling back to OpenRouter...")

        # 3. Tertiary OpenRouter Call (Async)
        if OPENROUTER_API_KEY:
            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    response = await client.post(
                        "https://openrouter.ai/api/v1/chat/completions",
                        headers={
                            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                            "Content-Type": "application/json",
                            "X-Title": "TechSales Axis"
                        },
                        json={
                            "model": "openai/gpt-4o-mini",
                            "messages": [
                                {"role": "system", "content": system_message},
                                {"role": "user", "content": prompt}
                            ],
                            "temperature": 0.4
                        }
                    )
                    if response.status_code == 200:
                        data = response.json()
                        return data['choices'][0]['message']['content'].strip()
            except Exception as or_e:
                print(f"DEBUG: Recruiter OpenRouter Critical Failure: {str(or_e)}")
        
        return ""

    async def _call_ai_json(self, prompt: str, system_message: str = "You are a helpful recruitment assistant.") -> Dict[str, Any]:
        res_text = await self._call_ai(prompt, system_message)
        if not res_text:
            return {}
        try:
            text = res_text
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0].strip()
            elif "```" in text:
                text = text.split("```")[1].split("```")[0].strip()
            return json.loads(text.strip())
        except Exception as e:
            print(f"DEBUG: Failed to parse AI JSON: {str(e)}")
            return {}

    async def generate_company_bio(self, website_url: str) -> str:
        try:
            if not website_url:
                return ""
                
            if not website_url.startswith(('http://', 'https://')):
                website_url = 'https://' + website_url
            
            print(f"DEBUG: Fetching website: {website_url}")
            
            async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                response = await client.get(website_url)
                response.raise_for_status()
            
            soup = BeautifulSoup(response.text, 'html.parser')
            for script in soup(["script", "style"]):
                script.decompose()
            
            clean_text = '\n'.join([line.strip() for line in soup.get_text().splitlines() if line.strip()])[:2000]
            
            if not clean_text.strip():
                print("DEBUG: No text extracted from website")
                return ""
            
            prompt = f"Extract a professional 2-3 sentence bio for a recruiter from this company website text:\n{clean_text}\nReturn ONLY the bio, no quotes or markdown."
            bio = await self._call_ai(prompt, "You are an elite company biographer. Extract professional company information.")
            
            if bio:
                cleaned = bio.replace('"', '').replace('**', '').strip()
                print(f"DEBUG: Generated bio: {cleaned}")
                return cleaned
            return ""
            
        except httpx.ConnectError as e:
            print(f"DEBUG: Network error connecting to website: {str(e)}")
            return ""
        except httpx.TimeoutException as e:
            print(f"DEBUG: Timeout fetching website: {str(e)}")
            return ""
        except Exception as e:
            print(f"DEBUG: Bio generation failed: {str(e)}")
            return ""

    async def get_or_create_profile(self, user_id: str):
        db = SessionLocal()
        try:
            profile = db.query(RecruiterProfile).options(joinedload(RecruiterProfile.company)).filter(RecruiterProfile.user_id == user_id).first()
            if profile:
                return profile

            # Ensure user entry exists in public.users to avoid FK violation
            user = db.query(User).filter(User.id == user_id).first()
            if not user:
                # If user doesn't exist in our RDS, we can't create a profile.
                # In the AWS-native flow, the user should be created at signup.
                return None

            # Create default profile if not exists
            new_profile = RecruiterProfile(
                user_id=user_id,
                onboarding_step="REGISTRATION",
                assessment_status="not_started"
            )
            db.add(new_profile)
            db.commit()
            db.refresh(new_profile)
            return new_profile
        finally:
            db.close()

    async def update_company_registration(self, user_id: str, registration_number: str):
        db = SessionLocal()
        try:
            # 1. Check if company with this registration exists or create new
            company = db.query(Company).filter(Company.registration_number == registration_number).first()
            
            has_score = False
            is_first_recruiter = False
            if company:
                company_id = company.id
                # Check if this company already has a profile score from another recruiter
                if (company.profile_score or 0) > 0:
                    has_score = True
            else:
                # Create a placeholder company
                company = Company(
                    name="Pending Verification",
                    registration_number=registration_number
                )
                db.add(company)
                db.commit()
                db.refresh(company)
                company_id = company.id
                is_first_recruiter = True

            # 2. Link recruiter to company and advance step
            next_step = "DETAILS"
            next_status = "not_started"
            
            if has_score:
                next_step = "COMPLETED"
                next_status = "completed"
                
            profile = db.query(RecruiterProfile).filter(RecruiterProfile.user_id == user_id).first()
            if profile:
                profile.company_id = company_id
                profile.onboarding_step = next_step
                profile.assessment_status = next_status
                profile.team_role = "admin" if is_first_recruiter else "recruiter"
                db.commit()

            return {
                "status": "ok", 
                "company_id": str(company_id), 
                "onboarding_step": next_step,
                "assessment_status": next_status
            }
        finally:
            db.close()

    async def update_company_details(self, user_id: str, company_id: str, details: Dict):
        db = SessionLocal()
        try:
            # Update company table
            company = db.query(Company).filter(Company.id == company_id).first()
            if company:
                company.name = details.get("name")
                company.website = details.get("website")
                company.location = details.get("location")
                company.description = details.get("description")
                company.industry_category = details.get("industry_category")
                company.sales_model = details.get("sales_model")
                company.target_market = details.get("target_market")
                
                # Sanitize hiring_focus_areas to be a list for PostgreSQL text[]
                hiring_focus = details.get("hiring_focus_areas")
                if hiring_focus is None or hiring_focus == "null":
                    company.hiring_focus_areas = []
                elif isinstance(hiring_focus, str):
                    company.hiring_focus_areas = [hiring_focus]
                else:
                    company.hiring_focus_areas = hiring_focus

                company.avg_deal_size_range = details.get("avg_deal_size_range")

            # Advance recruiter step
            profile = db.query(RecruiterProfile).filter(RecruiterProfile.user_id == user_id).first()
            if profile:
                profile.onboarding_step = "ASSESSMENT_PROMPT"
            
            db.commit()

            # Recalculate and update completion score
            await self.sync_completion_score(user_id)

            return {"status": "ok"}
        finally:
            db.close()

    async def get_applications_pipeline(self, recruiter_id: str):
        db = SessionLocal()
        try:
            profile = db.query(RecruiterProfile).filter(RecruiterProfile.user_id == recruiter_id).first()
            if not profile or not profile.company_id:
                return []
            
            apps = db.query(JobApplication).join(Job).filter(Job.company_id == profile.company_id).order_by(JobApplication.created_at.desc()).all()
            
            pipeline = []
            for app in apps:
                job = db.query(Job).filter(Job.id == app.job_id).first()
                cand = db.query(CandidateProfile).filter(CandidateProfile.user_id == app.candidate_id).first()
                user = db.query(User).filter(User.id == app.candidate_id).first()
                score = db.query(ProfileScore).filter(ProfileScore.user_id == app.candidate_id).first()
                resume = db.query(ResumeData).filter(ResumeData.user_id == app.candidate_id).first()
                
                # Fetch Interviews & Slots for the Recruiter
                interviews_raw = db.execute(text("SELECT * FROM interviews WHERE application_id = :aid"), {"aid": app.id}).fetchall()
                interviews = []
                for r in interviews_raw:
                    i_dict = dict(r._mapping)
                    slots_raw = db.execute(text("SELECT * FROM interview_slots WHERE interview_id = :iid"), {"iid": i_dict["id"]}).fetchall()
                    i_dict["interview_slots"] = [dict(sr._mapping) for sr in slots_raw]
                    interviews.append(i_dict)

                app_dict = {
                    "id": str(app.id),
                    "status": app.status,
                    "created_at": app.created_at.isoformat() if app.created_at else None,
                    "job": {"id": str(job.id), "title": job.title} if job else None,
                    "candidate": {
                        "user_id": str(cand.user_id),
                        "full_name": cand.full_name,
                        "email": user.email if user else None,
                        "resume_url": S3Service.get_signed_url(cand.resume_path) if cand and cand.resume_path else None
                    } if cand else None,
                    "score": score.final_score if score else 0,
                    "interviews": interviews
                }
                pipeline.append(app_dict)
            return pipeline
        finally:
            db.close()

    async def get_recruiter_stats(self, user_id: str):
        db = SessionLocal()
        try:
            profile = db.query(RecruiterProfile).filter(RecruiterProfile.user_id == user_id).first()
            if not profile or not profile.company_id:
                return {"active_jobs_count": 0, "total_hires_count": 0}
            
            active_jobs = db.query(Job).filter(Job.company_id == profile.company_id, Job.status == "active").count()
            total_apps = db.query(JobApplication).join(Job, JobApplication.job_id == Job.id).filter(Job.company_id == profile.company_id).count()
            hires = db.query(JobApplication).join(Job, JobApplication.job_id == Job.id).filter(Job.company_id == profile.company_id, JobApplication.status == "closed").count()
            
            company = db.query(Company).filter(Company.id == profile.company_id).first()
            
            return {
                "active_jobs_count": active_jobs,
                "total_hires_count": hires,
                "total_applications": total_apps,
                "company_quality_score": company.profile_score if company else 0,
                "assessment_status": profile.onboarding_step,
                "completion_score": profile.completion_score
            }
        finally:
            db.close()

    async def sync_completion_score(self, user_id: str):
        db = SessionLocal()
        try:
            profile = db.query(RecruiterProfile).filter(RecruiterProfile.user_id == user_id).first()
            if not profile: return 0
            company = db.query(Company).filter(Company.id == profile.company_id).first()
            
            score = 0
            if profile.full_name: score += 10
            if profile.job_title: score += 10
            if profile.linkedin_url: score += 10
            
            if company:
                if company.name: score += 20
                if company.website: score += 10
                if company.description: score += 20
                if company.logo_url: score += 20
            
            profile.completion_score = min(score, 100)
            db.commit()
            return profile.completion_score
        finally:
            db.close()

    async def get_assessment_questions(self, user_id: str):
        db = SessionLocal()
        try:
            from src.core.models import RecruiterAssessmentQuestion
            import random
            questions = db.query(RecruiterAssessmentQuestion).all()
            if not questions: return []
            selected = random.sample(questions, min(len(questions), 5))
            return [
                {
                    "id": str(q.id),
                    "category": q.category,
                    "driver": q.driver,
                    "question_text": q.question_text
                } for q in selected
            ]
        finally:
            db.close()

    async def evaluate_recruiter_answer(self, user_id: str, question_text: str, answer: str, category: str):
        db = SessionLocal()
        try:
            prompt = f"Evaluate this recruiter response for category {category}:\nQ: {question_text}\nA: {answer}\nReturn score 0-6 and reasoning in JSON format: {{'score': integer, 'reasoning': string}}"
            res = await self._call_ai_json(prompt)
            score = res.get("score", 3)
            
            # Using table column names: answer_text, average_score, evaluation_metadata
            from src.core.models import RecruiterAssessmentResponse
            import uuid
            
            # Since the table uses jsonb for evaluation_metadata, convert dict if needed or use dict directly
            new_res = RecruiterAssessmentResponse(
                id=uuid.uuid4(),
                user_id=uuid.UUID(user_id) if isinstance(user_id, str) else user_id,
                category=category,
                question_text=question_text,
                answer_text=answer,
                average_score=score,
                relevance_score=score,
                specificity_score=score,
                clarity_score=score,
                ownership_score=score,
                evaluation_metadata={"reasoning": res.get("reasoning", "")}
            )
            db.add(new_res)
            db.commit()
            return {"status": "ok", "score": score}
        except Exception as e:
            print(f"ERROR SAVING RECRUITER ANSWER: {str(e)}")
            db.rollback()
            raise e
        finally:
            db.close()

    async def get_assessment_summary(self, user_id: str):
        db = SessionLocal()
        try:
            from src.core.models import RecruiterAssessmentResponse, RecruiterProfile, Company
            responses = db.query(RecruiterAssessmentResponse).filter(RecruiterAssessmentResponse.user_id == user_id).all()
            if not responses: return {"score": 0, "status": "incomplete"}
            
            avg = sum([getattr(r, "average_score", 0) or 0 for r in responses]) / len(responses)
            normalized = int((avg / 6) * 100)
            
            profile = db.query(RecruiterProfile).filter(RecruiterProfile.user_id == user_id).first()
            if profile:
                profile.onboarding_step = "COMPLETED"
                profile.assessment_status = "completed"
                if profile.company_id:
                    company = db.query(Company).filter(Company.id == profile.company_id).first()
                    if company: company.profile_score = normalized
                db.commit()
            return {"score": normalized, "status": "completed"}
        finally:
            db.close()

    async def get_job_recommendations(self, candidate_id: str, priority: str = "skills", location: Optional[str] = None, min_salary: Optional[int] = None):
        db = SessionLocal()
        try:
            # 1. Get Candidate Skills
            resume = db.query(ResumeData).filter(ResumeData.user_id == candidate_id).first()
            candidate_skills = set([s.lower() for s in (resume.skills or [])]) if resume and resume.skills else set()

            # 2. Get active jobs
            query = db.query(Job).filter(Job.status == "active")
            
            if location:
                query = query.filter(Job.location.ilike(f"%{location}%"))
            
            all_jobs = query.all()
            res = []

            for j in all_jobs:
                job_skills = set([s.lower() for s in (j.skills_required or [])])
                
                # Default score
                score = 50
                reasons = []

                if candidate_skills and job_skills:
                    intersection = candidate_skills.intersection(job_skills)
                    match_ratio = len(intersection) / len(job_skills) if job_skills else 0
                    score = int(50 + (match_ratio * 50))
                    if intersection:
                        reasons.append(f"Matches skills: {', '.join(list(intersection)[:3])}")
                
                if not reasons:
                    reasons.append("Matches your professional profile and location interest.")

                # Only recommend if there's some baseline relevance (e.g., score > 60)
                # or if no skills are defined (fallback)
                if score > 60 or not job_skills:
                    res.append({
                        "job_id": str(j.id),
                        "job_title": j.title,
                        "company_id": str(j.company_id),
                        "location": j.location,
                        "match_score": min(score, 99),
                        "reasoning": " | ".join(reasons)
                    })

            # Sort by highest match
            res.sort(key=lambda x: x["match_score"], reverse=True)
            return res[:10]
        finally:
            db.close()

    async def get_candidate_recommendations_for_candidate(self, candidate_id: str, filter_type: str = "all", location: Optional[str] = None, min_salary: Optional[int] = None):
        db = SessionLocal()
        try:
            # 1. Get Candidate Skills
            resume = db.query(ResumeData).filter(ResumeData.user_id == candidate_id).first()
            candidate_skills = set([s.lower() for s in (resume.skills or [])]) if resume and resume.skills else set()

            # 2. Find recruiters whose companies are hiring for these skills
            query = db.query(RecruiterProfile).join(Job, RecruiterProfile.user_id == Job.recruiter_id)\
                      .filter(Job.status == "active")
            
            if location:
                query = query.filter(Job.location.ilike(f"%{location}%"))

            recruiters = query.distinct().limit(20).all()
            res = []

            for r in recruiters:
                comp = db.query(Company).filter(Company.id == r.company_id).first()
                # Find best matching job for this recruiter to justify the recommendation
                best_job = db.query(Job).filter(Job.recruiter_id == r.user_id, Job.status == "active").first()
                
                score = 80 # Default for active hiring managers
                reason = f"Actively hiring for {best_job.title}" if best_job else "Matching recruiter in your industry"

                res.append({
                    "id": str(r.user_id),
                    "full_name": r.full_name or "Talent Acquisition",
                    "job_title": r.job_title or "Recruiter",
                    "company_name": comp.name if comp else "Growth Startup",
                    "company_logo": comp.logo_url if comp else None,
                    "match_score": score,
                    "reasoning": reason
                })
            
            return res[:10]
        finally:
            db.close()

    async def get_recommended_candidates(self, user_id: str, filter_type: str = "culture_fit", params: Dict[str, Any] = {}):
        """
        AI-powered High-Precision Candidate Recommendation Engine - Master Matching Engine.
        
        Three distinct matching modes:
        1. 'culture_fit': Behavioral + ICP Alignment (40% weight) + Skills (30%) + Experience (20%) + Salary (10%)
        2. 'skill_match': Technical expertise focus (60% weight) + Experience (20%) + Skills matching (20%)
        3. 'profile_matching' (Expert View): Holistic Master Match - Synthesis of ALL factors via AI
           - Candidate Behavioral DNA vs Recruiter ICP (40%)
           - Technical Alignment (30%)
           - Experience Band Match (15%)
           - Profile Strength & Trust (15%)
        """
        db = SessionLocal()
        try:
            # 1. Context building
            target_job = None
            if params.get("job_id"):
                target_job = db.query(Job).filter(Job.id == params["job_id"]).first()
            
            # Recruiter assessment data for all AI-matching modes
            recruiter_assessments = None
            recruiter_icp = ""
            
            if filter_type in ["culture_fit", "profile_matching"]:
                recruiter_assessments = db.query(RecruiterAssessmentResponse).filter(
                    RecruiterAssessmentResponse.user_id == user_id
                ).all()
                if recruiter_assessments:
                    recruiter_icp = " | ".join([f"{r.question_text}: {r.answer_text}" for r in recruiter_assessments])
            
            # 2. Base query: Include verified candidates and shadow profiles
            query = db.query(CandidateProfile).filter(
                or_(
                    CandidateProfile.assessment_status == 'completed',
                    CandidateProfile.is_shadow_profile == True
                )
            )
            
            # 3. Dynamic Filters
            if params.get("location"):
                query = query.filter(CandidateProfile.location.ilike(f"%{params['location']}%"))
            
            if params.get("experience_band") and params["experience_band"] != "all":
                if params["experience_band"] == "fresher":
                    query = query.filter(CandidateProfile.years_of_experience <= 1)
                elif params["experience_band"] == "mid":
                    query = query.filter(and_(CandidateProfile.years_of_experience > 1, CandidateProfile.years_of_experience <= 5))
                elif params["experience_band"] == "senior":
                    query = query.filter(and_(CandidateProfile.years_of_experience > 5, CandidateProfile.years_of_experience <= 10))
                elif params["experience_band"] == "leadership":
                    query = query.filter(CandidateProfile.years_of_experience > 10)

            candidates = query.limit(200).all()
            
            # 4. Build target skills from job or active jobs
            target_skills = set(target_job.skills_required if target_job and target_job.skills_required else (params.get("required_skills") or []))
            
            if not target_skills:
                active_jobs = db.query(Job).filter(Job.recruiter_id == user_id, Job.status == "active").all()
                if active_jobs:
                    for job in active_jobs:
                        if job.skills_required:
                            target_skills.update([s.lower() for s in job.skills_required])
                
                if not target_skills:
                    latest_job = db.query(Job).filter(Job.recruiter_id == user_id).order_by(Job.created_at.desc()).first()
                    if latest_job and latest_job.skills_required:
                        target_skills = set([s.lower() for s in latest_job.skills_required])

            target_exp_band = target_job.experience_band if target_job else params.get("experience_band")
            
            target_max_salary = 0
            if target_job and target_job.salary_range:
                nums = re.findall(r"\d+", target_job.salary_range.replace(",","").replace("k","000"))
                if nums: target_max_salary = max(map(int, nums))
            elif params.get("max_salary"):
                try: target_max_salary = float(params["max_salary"])
                except: pass

            # 5. Score candidates according to filter_type
            results = []
            
            for c in candidates:
                is_shadow = getattr(c, 'is_shadow_profile', False)
                
                if filter_type == "profile_matching":
                    # **EXPERT VIEW: Master Match Algorithm**
                    if is_shadow:
                        # Shadow profiles: Use pedigree-based matching
                        score, reasoning = await self._expert_match_score_shadow(c, target_skills, target_exp_band, target_max_salary)
                    else:
                        # Verified candidates: Full assessment analysis
                        score, reasoning = await self._expert_match_score(
                            c, target_skills, target_exp_band, target_max_salary,
                            recruiter_icp=recruiter_icp,
                            recruiter_assessments=recruiter_assessments,
                            user_id=user_id,
                            db=db
                        )
                elif filter_type == "skill_match":
                    # **SKILLS FOCUS**
                    score, reasoning = self._score_skill_match(c, target_skills, target_exp_band, target_max_salary, is_shadow)
                else:
                    # **CULTURE FIT (Default)**
                    score, reasoning = await self._score_culture_fit(
                        c, target_skills, target_exp_band, target_max_salary,
                        is_shadow=is_shadow,
                        recruiter_icp=recruiter_icp,
                        db=db
                    )
                
                results.append({
                    "user_id": str(c.user_id),
                    "full_name": c.full_name or ("Potential Lead" if is_shadow else "Anonymous Talent"),
                    "current_role": c.current_role or "Sales Professional",
                    "experience": self._get_exp_label(c.years_of_experience or 0),
                    "years_of_experience": c.years_of_experience or 0,
                    "culture_match_score": score,
                    "match_reasoning": reasoning,
                    "skills": c.skills or [],
                    "profile_photo_url": c.profile_photo_url,
                    "resume_path": S3Service.get_signed_url(c.resume_path) if c.resume_path else None,
                    "identity_verified": c.identity_verified or False,
                    "profile_strength": "Lead" if is_shadow else (c.profile_strength or "Medium"),
                    "expected_salary": float(c.expected_salary or 0),
                    "is_shadow": is_shadow,
                    "assessment_status": "verified" if not is_shadow else "passive_lead"
                })
            
            results.sort(key=lambda x: x["culture_match_score"], reverse=True)
            return results
        finally:
            db.close()

    async def _expert_match_score(self, candidate, target_skills, target_exp_band, target_max_salary, 
                                   recruiter_icp="", recruiter_assessments=None, user_id="", db=None):
        """
        **MASTER EXPERT VIEW SCORING**
        Holistic synthesis of behavioral DNA, ICP alignment, technical fit, and professional pedigree.
        """
        base_score = 35  # Lower base to allow factors to shine
        reasoning_steps = []
        
        # ==== A. BEHAVIORAL & PSYCHOMETRIC DNA (40% weight) ====
        profile_score = db.query(ProfileScore).filter(ProfileScore.user_id == candidate.user_id).first() if db else None
        behavioral_score = getattr(profile_score, 'behavioral_score', 0) or 0
        psychometric_score = getattr(profile_score, 'psychometric_score', 0) or 0
        
        if behavioral_score > 85:
            base_score += 15
            reasoning_steps.append("Outstanding Behavioral Profile")
        elif behavioral_score > 75:
            base_score += 10
            reasoning_steps.append("Strong Behavioral Fit")
        elif behavioral_score > 60:
            base_score += 5
            reasoning_steps.append("Acceptable Behavior Traits")
        
        if psychometric_score > 80:
            base_score += 10
            reasoning_steps.append("Excellent Psychometric Match")
        elif psychometric_score > 65:
            base_score += 5
            reasoning_steps.append("Solid Psychometric Alignment")
        
        # ==== B. AI ICP ALIGNMENT (15% weight) ====
        if recruiter_icp:
            candidate_data = f"Bio: {candidate.bio} | Role: {candidate.current_role} | Achievements: {candidate.major_achievements}"
            prompt = f"""You are an Expert Recruitment Strategist. Analyze this candidate's fit:
RECRUITER NEEDS: {recruiter_icp}
CANDIDATE: {candidate_data}

Rate ICP alignment on 0-100. Output format: SCORE: [number] | REASON: [one sentence]"""
            
            icp_res = await self._call_ai(prompt, "You are an expert recruiter analyzing ICP fit.")
            if icp_res and "SCORE:" in icp_res:
                try:
                    score_part = icp_res.split("SCORE:")[1].split("|")[0].strip()
                    icp_score = min(100, max(0, int(float(score_part))))
                    base_score += int((icp_score / 100) * 15)
                    reason_part = icp_res.split("REASON:")[1].strip() if "REASON:" in icp_res else ""
                    if reason_part:
                        reasoning_steps.append(f"ICP Match: {reason_part}")
                except:
                    pass
        
        # ==== C. TECHNICAL & SKILLS ALIGNMENT (25% weight) ====
        c_skills = set([s.lower() for s in (candidate.skills or [])])
        if target_skills:
            target_skills_lower = set([s.lower() for s in target_skills])
            overlap = c_skills.intersection(target_skills_lower)
            fuzzy_matches = 0
            
            if len(overlap) < len(target_skills_lower):
                remaining = target_skills_lower - overlap
                for ts in remaining:
                    if any(ts in cs or cs in ts for cs in c_skills):
                        fuzzy_matches += 1
            
            total_matches = len(overlap) + (fuzzy_matches * 0.5)
            match_ratio = total_matches / len(target_skills_lower) if target_skills_lower else 0
            skill_bonus = int(match_ratio * 20)
            base_score += skill_bonus
            
            if overlap:
                reasoning_steps.append(f"Exact Matches: {len(overlap)}")
            if fuzzy_matches:
                reasoning_steps.append(f"Related Skills: {fuzzy_matches}")
        
        # ==== D. EXPERIENCE BAND (10% weight) ====
        years = candidate.years_of_experience or 0
        exp_status = self._get_exp_label(years)
        if target_exp_band and target_exp_band.lower() == exp_status:
            base_score += 8
            reasoning_steps.append("Perfect Experience Band")
        elif target_exp_band:
            base_score += 3
            reasoning_steps.append("Adjacent Experience Level")
        
        # ==== E. PROFILE STRENGTH & TRUST (10% weight) ====
        profile_strength = candidate.final_profile_score or 0
        if profile_strength > 85:
            base_score += 8
            reasoning_steps.append("Elite Profile Quality")
        elif profile_strength > 70:
            base_score += 5
            reasoning_steps.append("Verified High-Trust")
        
        match_score = min(99, base_score)
        reasoning = " | ".join(reasoning_steps) if reasoning_steps else "Professional fit for your organization."
        return match_score, reasoning

    async def _expert_match_score_shadow(self, candidate, target_skills, target_exp_band, target_max_salary):
        """
        EXPERT VIEW for SHADOW PROFILES (passive leads from bulk upload).
        Uses pedigree and role analysis since no assessment data exists.
        """
        base_score = 30  # Lower base for passive leads
        reasoning_steps = []
        
        # Current Role as Proxy for Level
        role = (candidate.current_role or "").lower()
        years = candidate.years_of_experience or 0
        
        # Role sophistication scoring
        if any(kw in role for kw in ["director", "vp", "head", "chief", "founder"]):
            base_score += 15
            reasoning_steps.append("Leadership Background")
        elif any(kw in role for kw in ["manager", "senior", "lead"]):
            base_score += 10
            reasoning_steps.append("Management Experience")
        elif any(kw in role for kw in ["specialist", "engineer", "architect"]):
            base_score += 8
            reasoning_steps.append("Technical Expertise")
        
        # Experience band match
        exp_status = self._get_exp_label(years)
        if target_exp_band and target_exp_band.lower() == exp_status:
            base_score += 10
            reasoning_steps.append(f"Matches {target_exp_band} requirement")
        
        # Skills match (from parsed data if available)
        c_skills = set([s.lower() for s in (candidate.skills or [])])
        if c_skills and target_skills:
            target_skills_lower = set([s.lower() for s in target_skills])
            overlap = c_skills.intersection(target_skills_lower)
            if overlap:
                match_ratio = len(overlap) / len(target_skills_lower)
                skill_bonus = int(match_ratio * 20)
                base_score += skill_bonus
                reasoning_steps.append(f"Has {len(overlap)} key skills")
        
        # Salary alignment
        if candidate.expected_salary and target_max_salary:
            if candidate.expected_salary <= target_max_salary:
                base_score += 5
                reasoning_steps.append("Salary aligned")
        
        match_score = min(99, base_score)
        reasoning = " | ".join(reasoning_steps) if reasoning_steps else "Passive lead with relevant background."
        reasoning += " [Passive Candidate]"
        return match_score, reasoning

    async def _score_culture_fit(self, candidate, target_skills, target_exp_band, target_max_salary, 
                                  is_shadow=False, recruiter_icp="", db=None):
        """Culture Fit Scoring - Behavioral + ICP Focus"""
        base_score = 50
        reasoning_steps = []
        
        if not is_shadow:
            # Behavioral scoring for verified candidates
            profile_score = db.query(ProfileScore).filter(ProfileScore.user_id == candidate.user_id).first() if db else None
            behavioral_score = getattr(profile_score, 'behavioral_score', 0) or 0
            
            if behavioral_score > 80:
                base_score += 20
                reasoning_steps.append("Elite Behavioral Score")
            elif behavioral_score > 60:
                base_score += 10
                reasoning_steps.append("Strong Team Player")
        
        # Skills matching (30% for culture fit)
        c_skills = set([s.lower() for s in (candidate.skills or [])])
        if target_skills:
            target_skills_lower = set([s.lower() for s in target_skills])
            overlap = c_skills.intersection(target_skills_lower)
            match_ratio = len(overlap) / len(target_skills_lower) if target_skills_lower else 0
            skill_bonus = int(match_ratio * 20)
            base_score += skill_bonus
            if overlap:
                reasoning_steps.append(f"Matched {len(overlap)} core skills")
        
        # Experience alignment
        years = candidate.years_of_experience or 0
        exp_status = self._get_exp_label(years)
        if target_exp_band and target_exp_band.lower() == exp_status:
            base_score += 10
            reasoning_steps.append("Experience band matches")
        
        match_score = min(99, base_score)
        reasoning = " | ".join(reasoning_steps) if reasoning_steps else "Good culture alignment."
        return match_score, reasoning

    def _score_skill_match(self, candidate, target_skills, target_exp_band, target_max_salary, is_shadow=False):
        """Skills-focused matching"""
        base_score = 50
        reasoning_steps = []
        
        c_skills = set([s.lower() for s in (candidate.skills or [])])
        if target_skills:
            target_skills_lower = set([s.lower() for s in target_skills])
            overlap = c_skills.intersection(target_skills_lower)
            match_ratio = len(overlap) / len(target_skills_lower) if target_skills_lower else 0
            skill_bonus = int(match_ratio * 40)
            base_score += skill_bonus
            if overlap:
                reasoning_steps.append(f"Matched {len(overlap)} core skills")
        
        years = candidate.years_of_experience or 0
        exp_status = self._get_exp_label(years)
        if target_exp_band and target_exp_band.lower() == exp_status:
            base_score += 10
            reasoning_steps.append("Experience matches")
        
        match_score = min(99, base_score)
        reasoning = " | ".join(reasoning_steps) if reasoning_steps else "Skills aligned with requirements."
        return match_score, reasoning

    def _get_exp_label(self, years: int) -> str:
        """Convert years of experience to experience band label"""
        if years <= 1:
            return "fresher"
        elif years > 10:
            return "leadership"
        elif years > 5:
            return "senior"
        return "mid"

    async def create_job(self, user_id: str, job_data: dict):
        db = SessionLocal()
        try:
            profile = db.query(RecruiterProfile).filter(RecruiterProfile.user_id == user_id).first()
            if not profile or not profile.company_id:
                raise Exception("Recruiter profile or company not found")

            # Handle arrays for text[] in RDS
            def sanitize_array(val):
                if val is None or val == "null" or val == "":
                    return []
                if isinstance(val, str):
                    return [val]
                return list(val)

            new_job = Job(
                company_id=profile.company_id,
                recruiter_id=user_id,
                title=job_data.get("title"),
                description=job_data.get("description"),
                experience_band=job_data.get("experience_band"),
                job_type=job_data.get("job_type"),
                location=job_data.get("location"),
                salary_range=job_data.get("salary_range"),
                number_of_positions=job_data.get("number_of_positions", 1),
                is_ai_generated=job_data.get("is_ai_generated", False),
                requirements=sanitize_array(job_data.get("requirements")),
                skills_required=sanitize_array(job_data.get("skills_required")),
                metadata_=job_data.get("metadata", {}),
                status="active"
            )
            db.add(new_job)
            db.commit()
            db.refresh(new_job)
            return {"id": str(new_job.id), "status": "success"}
        except Exception as e:
            db.rollback()
            print(f"ERROR creating job: {str(e)}")
            raise e
        finally:
            db.close()

    async def get_talent_pool(self):
        db = SessionLocal()
        try:
            candidates = db.query(CandidateProfile).all()
            results = []
            for c in candidates:
                # Basic normalization of experience band
                years = c.years_of_experience or 0
                exp_source = (c.experience or "").lower().strip()
                
                # Normalize common variations to standard bands
                if exp_source in ["fresher", "entry", "intern"]:
                    exp_band = "fresher"
                elif exp_source in ["mid", "intermediate", "associate"]:
                    exp_band = "mid"
                elif exp_source in ["senior", "sr", "expert"]:
                    exp_band = "senior"
                elif exp_source in ["leadership", "mgmt", "management", "director", "vp"]:
                    exp_band = "leadership"
                else:
                    # Fallback based on years if DB value is unknown (Updated Protocol: 0-1, 1-5, 5-10, 10+)
                    exp_band = "leadership" if years >= 10 else "senior" if years >= 5 else "mid" if years >= 1 else "fresher"
                
                results.append({
                    "user_id": str(c.user_id),
                    "full_name": c.full_name or "Unknown Candidate",
                    "experience": exp_band,
                    "years_of_experience": years,
                    "location": c.location or "Remote",
                    "location_tier": c.location_tier or getCityTier(c.location or "Remote"),
                    "expected_salary": float(c.expected_salary) if c.expected_salary else 0.0,
                    "skills": c.skills or [],
                    "target_role": c.target_role,
                    "current_role": c.current_role
                })
            return results
        finally:
            db.close()

    def persist_profile_matches(self, recruiter_id: str, matches: List[Dict]) -> int:
        """
        Persist profile matches to database for caching and analytics.
        This is called after recommendations are generated to cache the results.
        
        Args:
            recruiter_id: UUID of the recruiter
            matches: List of candidate matches with scores and reasoning
        
        Returns:
            Number of matches successfully persisted
        """
        db = SessionLocal()
        try:
            count = 0
            for match in matches:
                try:
                    candidate_id = match.get("user_id") or match.get("candidate_id")
                    if not candidate_id:
                        continue
                    
                    # Check if match already exists
                    existing = db.query(ProfileMatch).filter(
                        ProfileMatch.candidate_id == candidate_id,
                        ProfileMatch.recruiter_id == recruiter_id,
                        ProfileMatch.match_type == "culture_fit"
                    ).first()
                    
                    match_score = int(match.get("culture_match_score", 0))
                    reasoning = match.get("match_reasoning", "")
                    
                    if existing:
                        # Update existing match
                        existing.match_score = match_score
                        existing.reasoning_text = reasoning
                        existing.updated_at = datetime.utcnow()
                    else:
                        # Create new match record
                        new_match = ProfileMatch(
                            candidate_id=candidate_id,
                            recruiter_id=recruiter_id,
                            match_score=match_score,
                            reasoning_text=reasoning,
                            match_type="culture_fit",
                            candidate_token=None,
                            recruiter_token=None
                        )
                        db.add(new_match)
                    
                    count += 1
                except Exception as e:
                    print(f"Error persisting match for candidate {candidate_id}: {str(e)}")
                    continue
            
            db.commit()
            return count
        except Exception as e:
            db.rollback()
            print(f"Error persisting profile matches: {str(e)}")
            return 0
        finally:
            db.close()

recruiter_service = RecruiterService()
