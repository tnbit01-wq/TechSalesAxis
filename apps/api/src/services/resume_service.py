import httpx
import boto3
from botocore.exceptions import ClientError
from pypdf import PdfReader
import io
from src.core.database import SessionLocal
from src.core.config import S3_BUCKET_NAME, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION
from src.core.models import CandidateProfile, ResumeData
from sqlalchemy import func
import json
import os
import re
from google import genai
from src.core.config import OPENAI_API_KEY, GOOGLE_API_KEY, OPENROUTER_API_KEY

class ResumeService:
    @staticmethod
    async def parse_resume(user_id: str, resume_path: str, google_key: str = None):
        import time
        overall_start = time.time()
        
        # 0. Check for OpenAI Key (Primary)
        openai_key = OPENAI_API_KEY
        # If google_key passed as param is None, use config
        if not google_key:
            google_key = GOOGLE_API_KEY

        # 1. Download file from AWS S3
        try:
            s3_client = boto3.client(
                's3',
                aws_access_key_id=AWS_ACCESS_KEY_ID,
                aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
                region_name=AWS_REGION
            )
            response = s3_client.get_object(Bucket=S3_BUCKET_NAME, Key=resume_path)
            file_res = response['Body'].read()
        except ClientError as e:
            print(f"S3 download error: {str(e)}")
            return {"error": "Storage download failed (S3)"}
        except Exception as e:
            print(f"General download error: {str(e)}")
            return {"error": "Storage download failed"}
            
        # 2. Extract text
        try:
            reader = PdfReader(io.BytesIO(file_res))
            text = ""
            for i, page in enumerate(reader.pages):
                try:
                    page_text = page.extract_text(extraction_mode="layout") or ""
                except:
                    page_text = page.extract_text() or ""
                text += f"--- Page {i+1} ---\n{page_text}\n"
            text = text.strip()
            import re
            text = re.sub(r'[ \t]+', ' ', text)
            text = re.sub(r'\n\s*\n', '\n\n', text)
            if len(text) < 50:
                text += "\n[Warning: Layout is highly graphical or scanned.]"
        except Exception as e:
            print(f"PDF ERROR: {str(e)}")
            return {"error": f"PDF extraction failed: {str(e)}"}

        await ResumeService._store_initial_text(user_id, text)

        # 3. High-Fidelity Path: OpenAI (New Primary)
        if openai_key:
            try:
                async with httpx.AsyncClient(timeout=45.0) as client:
                    prompt = f"Extract structured resume data. SCHEMA: {{'full_name', 'email', 'phone', 'links': {{'linkedin', 'portfolio'}}, 'location', 'relevant_years_experience', 'experience_band', 'bio', 'skills': {{'technical', 'soft', 'tools'}}, 'timeline', 'career_gap_report', 'education', 'projects', 'major_achievements'}}. Text: {text[:15000]}"
                    
                    response = await client.post(
                        "https://api.openai.com/v1/chat/completions",
                        headers={
                            "Authorization": f"Bearer {openai_key}",
                            "Content-Type": "application/json",
                        },
                        json={
                            "model": "gpt-4o",
                            "messages": [
                                {"role": "system", "content": "You are a professional recruitment AI. Respond only with valid JSON."},
                                {"role": "user", "content": prompt}
                            ],
                            "response_format": { "type": "json_object" },
                            "temperature": 0.2
                        }
                    )
                    if response.status_code == 200:
                        parsed_data = response.json()['choices'][0]['message']['content']
                        parsed_data = json.loads(parsed_data)
                        await ResumeService._store_data(user_id, text, parsed_data)
                        return parsed_data
                    else:
                        print(f"DEBUG: OpenAI Parsing Failed: {response.status_code}")
            except Exception as oai_err:
                print(f"DEBUG: OpenAI Parsing Error: {oai_err}")

        # 4. Fallback Path: Groq/OpenRouter
        groq_key = os.getenv("GROQ_API_KEY")
        if (groq_key and len(groq_key) > 5) or (OPENROUTER_API_KEY and len(OPENROUTER_API_KEY) > 5):
            try:
                if groq_key:
                    from groq import Groq
                    client = Groq(api_key=groq_key)
                    model_choice = "llama-3.3-70b-versatile"
                else:
                    client = httpx.AsyncClient(timeout=30.0)
                    model_choice = "meta-llama/llama-3.3-70b-instruct"

                prompt_content = f"Extract structured resume data. Keys: location, bio, experience_band, years_of_experience, timeline, skills, education. Resume: {text[:10000]}"
                
                if groq_key:
                    completion = client.chat.completions.create(
                        model=model_choice,
                        messages=[{"role": "user", "content": prompt_content}],
                        response_format={"type": "json_object"}
                    )
                    parsed_data = json.loads(completion.choices[0].message.content)
                else:
                    response = await client.post(
                        "https://openrouter.ai/api/v1/chat/completions",
                        headers={"Authorization": f"Bearer {OPENROUTER_API_KEY}"},
                        json={"model": model_choice, "messages": [{"role": "user", "content": prompt_content}]}
                    )
                    content = response.json()['choices'][0]['message']['content']
                    parsed_data = json.loads(content.replace("`json", "").replace("`", "").strip())
                
                await ResumeService._store_data(user_id, text, parsed_data)
                return parsed_data
            except Exception as e:
                print(f"Fallback parsing failed: {str(e)}")

        # 5. Fallback Path: Gemini 
        if google_key:
            try:
                client = genai.Client(api_key=google_key)
                model_name = 'models/gemini-2.0-flash'
                
                prompt = f"Act as an AI Talent Auditor. Extract resume data. SCHEMA: {{'full_name', 'email', 'phone', 'links': {{'linkedin', 'portfolio'}}, 'location', 'relevant_years_experience', 'experience_band', 'bio', 'skills': {{'technical', 'soft', 'tools'}}, 'timeline', 'career_gap_report', 'education', 'projects', 'major_achievements'}}. Text: {text[:15000]}"
                
                response = client.models.generate_content(model=model_name, contents=prompt)
                raw_content = response.text.replace("`json", "").replace("`", "").strip()
                parsed_data = json.loads(raw_content)
                
                await ResumeService._store_data(user_id, text, parsed_data)
                return parsed_data
            except Exception as e:
                print(f"Gemini failed: {str(e)}")
                try:
                    recovery_prompt = "Extract name, email, phone. JSON: {name, email, phone}. Text: " + text[:2000]
                    rec_resp = client.models.generate_content(model='models/gemini-2.0-flash', contents=recovery_prompt)
                    rec_json = json.loads(rec_resp.text.replace("`json","").replace("`","").strip())
                    await ResumeService._store_data(user_id, text, rec_json)
                    return rec_json
                except:
                    pass

        return {"error": "All parsing paths failed"}

    @staticmethod
    async def _store_initial_text(user_id: str, text: str):
        db = SessionLocal()
        try:
            resume = db.query(ResumeData).filter(ResumeData.user_id == user_id).first()
            if resume:
                resume.raw_text = text[:30000]
            else:
                resume = ResumeData(user_id=user_id, raw_text=text[:30000])
                db.add(resume)
            db.commit()
        except Exception as e:
            print(f"Error storing initial text: {e}")
            db.rollback()
        finally:
            db.close()

    @staticmethod
    async def _store_data(user_id: str, text: str, parsed_data: dict):
        db = SessionLocal()
        try:
            # 1. Update Candidate Profile
            profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == user_id).first()
            if profile:
                profile.full_name = parsed_data.get("full_name") or parsed_data.get("name")
                profile.phone_number = parsed_data.get("phone") or parsed_data.get("phone_number")
                profile.location = parsed_data.get("location")
                profile.experience = parsed_data.get("experience_band") or "mid"
                profile.bio = parsed_data.get("bio")
                profile.linkedin_url = parsed_data.get("links", {}).get("linkedin") if isinstance(parsed_data.get("links"), dict) else None
                profile.portfolio_url = parsed_data.get("links", {}).get("portfolio") if isinstance(parsed_data.get("links"), dict) else None
                
                # --- NEW EXTRACTIONS ---
                profile.education_history = parsed_data.get("education")
                profile.experience_history = parsed_data.get("timeline")
                profile.projects = parsed_data.get("projects")
                profile.career_gap_report = parsed_data.get("career_gap_report")
                profile.major_achievements = str(parsed_data.get("major_achievements")) if parsed_data.get("major_achievements") else None
                
                # Current/Target Roles
                timeline = parsed_data.get("timeline") or []
                if timeline and isinstance(timeline, list) and len(timeline) > 0:
                    current = timeline[0]
                    if isinstance(current, dict):
                        profile.current_role = current.get("role")
                
                exp_val = parsed_data.get("relevant_years_experience", 0)
                if exp_val:
                    match = re.search(r"\d+", str(exp_val))
                    profile.years_of_experience = int(match.group()) if match else 0

                # achievements = parsed_data.get("major_achievements") or []
                # profile.major_achievements = achievements if isinstance(achievements, list) else [str(achievements)]
            
            # 2. Update/Upsert Resume Data
            resume = db.query(ResumeData).filter(ResumeData.user_id == user_id).first()
            exp_history = parsed_data.get("timeline") or []
            edu_history = parsed_data.get("education") or []
            achievements = parsed_data.get("major_achievements") or []
            if not isinstance(achievements, list): achievements = [str(achievements)]

            if resume:
                resume.raw_text = text[:15000]
                resume.raw_education = edu_history # Storing as JSON object direct
                resume.raw_experience = exp_history
                resume.raw_projects = parsed_data.get("projects")
                resume.timeline = exp_history
                resume.education = edu_history
                resume.career_gaps = parsed_data.get("career_gap_report")
                resume.skills = parsed_data.get("skills")
                resume.achievements = achievements
                resume.parsed_at = func.now()
            else:
                resume = ResumeData(
                    user_id=user_id,
                    raw_text=text[:15000],
                    raw_education=edu_history,
                    raw_experience=exp_history,
                    raw_projects=parsed_data.get("projects"),
                    timeline=exp_history,
                    education=edu_history,
                    career_gaps=parsed_data.get("career_gap_report"),
                    skills=parsed_data.get("skills"),
                    achievements=achievements
                )
                db.add(resume)
            
            # Sync to candidate_profiles.skills as well
            if profile and skills:
                # Handle dictionary input from AI (e.g. {'technical': [...], 'soft': [...]})
                extracted_skills = []
                if isinstance(skills, dict):
                    for k in ["technical", "soft", "tools"]:
                        if isinstance(skills.get(k), list): 
                            extracted_skills.extend(skills[k])
                elif isinstance(skills, list):
                    extracted_skills = skills
                
                profile.skills = list(set(extracted_skills))
                actual_skills_to_sync = extracted_skills
            else:
                actual_skills_to_sync = []

            db.commit()

            await ResumeService._sync_to_skill_catalog(actual_skills_to_sync, profile.experience if profile else 'mid')
        except Exception as e:
            print(f"Error storing data: {e}")
            db.rollback()
        finally:
            db.close()

    @staticmethod
    async def _sync_to_skill_catalog(skills: list, band: str):
        if not skills: return
        db = SessionLocal()
        try:
            from src.core.models import SkillCatalog
            from sqlalchemy import func
            for skill_name in skills:
                name = skill_name.strip()
                if not name: continue
                
                # Check if exists
                existing = db.query(SkillCatalog).filter(
                    SkillCatalog.name == name,
                    SkillCatalog.experience_band == band
                ).first()
                
                if existing:
                    existing.last_seen_at = func.now()
                else:
                    new_skill = SkillCatalog(
                        name=name,
                        experience_band=band,
                        last_seen_at=func.now()
                    )
                    db.add(new_skill)
            db.commit()
        except Exception as e:
            print(f"Skill Catalog Sync Error: {e}")
            db.rollback()
        finally:
            db.close()
