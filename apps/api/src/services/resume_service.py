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
from src.services.comprehensive_extractor import ComprehensiveResumeExtractor

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

        # 6. Final Fallback: Comprehensive NLP-based extraction when all AI APIs fail
        print("All AI APIs failed. Using comprehensive NLP-based extraction...")
        parsed_data = ComprehensiveResumeExtractor.extract_all(text)
        await ResumeService._store_data(user_id, text, parsed_data)
        return parsed_data

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
            extracted_skills = []
            
            # 1. Update Candidate Profile
            profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == user_id).first()
            if profile:
                profile.full_name = parsed_data.get("full_name") or parsed_data.get("name")
                profile.phone_number = str(parsed_data.get("phone_number") or parsed_data.get("phone") or "").strip()
                profile.location = parsed_data.get("location")
                profile.bio = parsed_data.get("bio")
                profile.current_role = parsed_data.get("current_role")
                profile.years_of_experience = parsed_data.get("years_of_experience")
                profile.last_resume_parse_at = func.now()
                
                # Normalize experience_band to lowercase enum values
                raw_exp = str(parsed_data.get("experience_band") or "mid").lower()
                if "leader" in raw_exp or "leadership" in raw_exp:
                    profile.experience = "leadership"
                elif "senior" in raw_exp:
                    profile.experience = "senior"
                elif "fresher" in raw_exp or "entry" in raw_exp:
                    profile.experience = "fresher"
                else:
                    profile.experience = "mid"
                
                # Links extraction
                links = parsed_data.get("links") or {}
                if isinstance(links, dict):
                    profile.linkedin_url = links.get("linkedin")
                    profile.portfolio_url = links.get("portfolio")
                
                # Structured data fields (JSONB columns)
                education_history = parsed_data.get("education_history") or parsed_data.get("education") or []
                experience_history = parsed_data.get("experience_history") or parsed_data.get("timeline") or []
                
                profile.education_history = education_history
                profile.experience_history = experience_history
                profile.projects = parsed_data.get("projects") or []
                profile.career_gap_report = parsed_data.get("career_gap_report") or {}
                
                # Major achievements
                achievements_data = parsed_data.get("major_achievements")
                if achievements_data:
                    if isinstance(achievements_data, (list, dict)):
                        profile.major_achievements = json.dumps(achievements_data)
                    else:
                        profile.major_achievements = str(achievements_data)
                
                # Extract skills for profile and catalog
                skills_data = parsed_data.get("skills") or []
                if isinstance(skills_data, list):
                    extracted_skills = skills_data
                elif isinstance(skills_data, dict):
                    # Handle nested skills structure
                    for k in ["technical", "soft", "tools"]:
                        val = skills_data.get(k)
                        if isinstance(val, list): 
                            extracted_skills.extend(val)
                
                # Clean and deduplicate skills
                extracted_skills = list(set([str(s).strip() for s in extracted_skills if s]))
                profile.skills = extracted_skills

            # 2. Update/Upsert Resume Data
            resume = db.query(ResumeData).filter(ResumeData.user_id == user_id).first()
            
            exp_history = parsed_data.get("experience_history") or parsed_data.get("timeline") or []
            edu_history = parsed_data.get("education_history") or parsed_data.get("education") or []
            
            # Achievements handling
            achievements_list_data = parsed_data.get("major_achievements") or []
            achievements = []
            if isinstance(achievements_list_data, list):
                achievements = [str(a) for a in achievements_list_data if a]
            elif achievements_list_data:
                achievements = [str(achievements_list_data)]

            if resume:
                resume.raw_text = text[:30000]
                resume.raw_education = json.dumps(edu_history) if edu_history else "[]"
                resume.raw_experience = json.dumps(exp_history) if exp_history else "[]"
                resume.raw_projects = json.dumps(parsed_data.get("projects") or [])
                resume.timeline = exp_history
                resume.education = edu_history
                resume.career_gaps = parsed_data.get("career_gap_report")
                resume.skills = extracted_skills
                resume.achievements = achievements
                resume.parsed_at = func.now()
            else:
                resume = ResumeData(
                    user_id=user_id,
                    raw_text=text[:30000],
                    raw_education=json.dumps(edu_history) if edu_history else "[]",
                    raw_experience=json.dumps(exp_history) if exp_history else "[]",
                    raw_projects=json.dumps(parsed_data.get("projects") or []),
                    timeline=exp_history,
                    education=edu_history,
                    career_gaps=parsed_data.get("career_gap_report"),
                    skills=extracted_skills,
                    achievements=achievements,
                    parsed_at=func.now()
                )
                db.add(resume)
            
            db.commit()

            # Sync skills to catalog with proper case sensitivity and experience band
            if extracted_skills and profile:
                await ResumeService._sync_to_skill_catalog(extracted_skills, profile.experience)
                
        except Exception as e:
            print(f"Error storing data: {e}")
            import traceback
            traceback.print_exc()
            db.rollback()
        finally:
            db.close()

    @staticmethod
    async def _sync_to_skill_catalog(skills: list, band: str = "mid"):
        """
        Sync extracted skills to skill_catalog (case-sensitive).
        Skills are stored with exact casing and experience band for discovery.
        """
        if not skills: 
            return
        db = SessionLocal()
        try:
            from src.core.models import SkillCatalog
            from sqlalchemy import func
            
            # Normalize band
            valid_bands = ["fresher", "mid", "senior", "leadership"]
            band = band.lower() if band in valid_bands else "mid"
            
            skill_count = 0
            for skill_name in skills:
                name = str(skill_name).strip()
                if not name or len(name) < 2: 
                    continue
                
                # Check if exists for this band (case-sensitive)
                existing = db.query(SkillCatalog).filter(
                    SkillCatalog.name == name,
                    SkillCatalog.experience_band == band
                ).first()
                
                if existing:
                    existing.last_seen_at = func.now()
                    skill_count += 1
                else:
                    new_skill = SkillCatalog(
                        name=name,  # Preserves exact casing
                        experience_band=band,
                        last_seen_at=func.now()
                    )
                    db.add(new_skill)
                    skill_count += 1
            
            db.commit()
            print(f"Synced {skill_count} skills to catalog for band: {band}")
        except Exception as e:
            print(f"Error syncing skills to catalog: {e}")
            db.rollback()
        finally:
            db.close()
