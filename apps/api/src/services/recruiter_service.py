from src.core.database import db_engine, SessionLocal
from src.core.models import (
    User, RecruiterProfile, Company, Job, JobApplication, 
    ProfileScore, ResumeData, JobApplicationHistory, ChatThread, ProfileMatch, CandidateProfile,
    RecruiterAssessmentResponse, AssessmentResponse, BlockedUser, RecruiterSetting
)
from src.models.invitation import TeamInvitation
from src.services.s3_service import S3Service
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, text, desc, and_
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
            if not website_url.startswith(('http://', 'https://')):
                website_url = 'https://' + website_url
            async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                response = await client.get(website_url)
                response.raise_for_status()
            soup = BeautifulSoup(response.text, 'html.parser')
            for script in soup(["script", "style"]):
                script.decompose()
            clean_text = '\n'.join([line.strip() for line in soup.get_text().splitlines() if line.strip()])[:2000]
            prompt = f"Extract a professional 2-3 sentence bio for a recruiter from this text:\n{clean_text}\nReturn ONLY the bio."
            bio = await self._call_ai(prompt, "You are an elite company biographer.")
            return bio.replace('"', '').replace('**', '').strip() if bio else ""
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
        AI-powered High-Precision Candidate Recommendation Engine.
        Matches on: Skills (60%), Experience (20%), Salary Alignment (10%), Location Preference (10%).
        """
        db = SessionLocal()
        try:
            # 1. Get recruiter's job/company profile context
            # If job_id or context provided, use it. Otherwise use generic company context.
            target_job = None
            if params.get("job_id"):
                target_job = db.query(Job).filter(Job.id == params["job_id"]).first()
            
            # 2. Base query: Candidates with completed profiles
            query = db.query(CandidateProfile).filter(
                CandidateProfile.assessment_status == 'completed'
            )
            
            # 3. Dynamic Filters (User-Driven)
            if params.get("location"):
                query = query.filter(CandidateProfile.location.ilike(f"%{params['location']}%"))
            
            if params.get("experience_band") and params["experience_band"] != "all":
                # Map years to band for strict filtering if requested (Updated Protocol: 0-1, 1-5, 5-10, 10+)
                if params["experience_band"] == "fresher":
                    query = query.filter(CandidateProfile.years_of_experience <= 1)
                elif params["experience_band"] == "mid":
                    query = query.filter(and_(CandidateProfile.years_of_experience > 1, CandidateProfile.years_of_experience <= 5))
                elif params["experience_band"] == "senior":
                    query = query.filter(and_(CandidateProfile.years_of_experience > 5, CandidateProfile.years_of_experience <= 10))
                elif params["experience_band"] == "leadership":
                    query = query.filter(CandidateProfile.years_of_experience > 10)

            # 4. Fetch candidates for ranking
            candidates = query.limit(100).all()
            
            # 5. Precision Scoring Logic
            results = []
            
            # Target requirements from Job context if available
            target_skills = set(target_job.skills_required if target_job and target_job.skills_required else (params.get("required_skills") or []))
            target_exp_band = target_job.experience_band if target_job else params.get("experience_band")
            
            # Estimated target salary parsing (e.g. "$100k - $150k" -> 150000)
            target_max_salary = 0
            if target_job and target_job.salary_range:
                nums = re.findall(r"\d+", target_job.salary_range.replace(",","").replace("k","000"))
                if nums: target_max_salary = max(map(int, nums))
            elif params.get("max_salary"):
                try: target_max_salary = float(params["max_salary"])
                except: pass

            for c in candidates:
                base_score = 50 # Start from baseline
                reasoning_steps = []

                # A. Skill Matching (Weight: 60%)
                c_skills = set(c.skills or [])
                if target_skills:
                    overlap = c_skills.intersection(target_skills)
                    match_ratio = len(overlap) / len(target_skills) if target_skills else 0
                    skill_bonus = int(match_ratio * 40)
                    base_score += skill_bonus
                    if overlap: reasoning_steps.append(f"Matched {len(overlap)} core skills")

                # B. Experience Alignment (Weight: 20%)
                years = c.years_of_experience or 0
                exp_status = "mid"
                if years <= 1: exp_status = "fresher"
                elif years > 10: exp_status = "leadership"
                elif years > 5: exp_status = "senior"

                if target_exp_band and target_exp_band.lower() == exp_status:
                    base_score += 15
                    reasoning_steps.append("Experience band matches role")
                elif target_exp_band:
                    # Partial match for adjacent bands
                    base_score += 5
                
                # C. Salary Alignment (Weight: 10%)
                if target_max_salary > 0 and c.expected_salary:
                    if c.expected_salary <= target_max_salary:
                        base_score += 10
                        reasoning_steps.append("Within salary expectations")
                    elif c.expected_salary <= target_max_salary * 1.15: # 15% buffer
                        base_score += 5
                        reasoning_steps.append("Slightly above salary range")

                # D. Assessment Performance (Bonus)
                if (c.final_profile_score or 0) > 80:
                    base_score += 5
                    reasoning_steps.append("Verified High-Trust candidate")

                # Normalize and Caps
                match_score = min(99, base_score)
                reasoning = " | ".join(reasoning_steps) if reasoning_steps else "Aligned with IT Sales profile."

                results.append({
                    "user_id": str(c.user_id),
                    "full_name": c.full_name or "Anonymous Talent",
                    "current_role": c.current_role or "Sales Professional",
                    "experience": exp_status,
                    "years_of_experience": years,
                    "culture_match_score": match_score,
                    "match_reasoning": reasoning,
                    "skills": c.skills or [],
                    "profile_photo_url": c.profile_photo_url,
                    "resume_path": S3Service.get_signed_url(c.resume_path) if c.resume_path else None,
                    "identity_verified": c.identity_verified or False,
                    "profile_strength": c.profile_strength or "Medium",
                    "expected_salary": float(c.expected_salary or 0)
                })
            
            # Sort by score
            results.sort(key=lambda x: x["culture_match_score"], reverse=True)
            return results
        finally:
            db.close()

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
