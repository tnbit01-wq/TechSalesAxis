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
from src.services.enhanced_resume_extractor import EnhancedResumeExtractor, CandidateProfileMapper

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

        # 3. High-Fidelity Path: OpenAI (New Primary) - WITH ENHANCED SCHEMA FOR 100% FIELD COVERAGE
        if openai_key:
            try:
                async with httpx.AsyncClient(timeout=45.0) as client:
                    # Use enhanced prompt with comprehensive schema (35+ fields)
                    prompt = EnhancedResumeExtractor.compile_ai_prompt(text)
                    
                    response = await client.post(
                        "https://api.openai.com/v1/chat/completions",
                        headers={
                            "Authorization": f"Bearer {openai_key}",
                            "Content-Type": "application/json",
                        },
                        json={
                            "model": "gpt-4o",
                            "messages": [
                                {"role": "system", "content": "You are a professional recruitment AI specializing in resume parsing. Return ONLY valid JSON with all fields. For missing data, use null."},
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
            # PostgreSQL hack: remove NUL characters (0x00) which are not allowed in string literals
            if text and "\x00" in text:
                text = text.replace("\x00", "")
                
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
        """
        ENHANCED: Store resume data with 100% field coverage
        Uses CandidateProfileMapper to populate ALL candidate_profiles columns
        """
        db = SessionLocal()
        try:
            # PostgreSQL hack: remove NUL characters (0x00) which are not allowed in string literals
            if text and "\x00" in text:
                text = text.replace("\x00", "")
            
            # Recursively remove NUL characters from parsed_data dict/list
            def _clean_nul(obj):
                if isinstance(obj, str):
                    return obj.replace("\x00", "")
                elif isinstance(obj, dict):
                    return {k: _clean_nul(v) for k, v in obj.items()}
                elif isinstance(obj, list):
                    return [_clean_nul(i) for i in obj]
                return obj
            
            parsed_data = _clean_nul(parsed_data)
            
            # ===== ENHANCED: Use CandidateProfileMapper for ALL field mapping =====
            # This maps 35+ fields automatically instead of manual assignment
            profile_updates = CandidateProfileMapper.map_to_profile(parsed_data)
            
            # ===== Handle additional AI-extracted field enhancements =====
            extracted_skills = []
            skills_raw = parsed_data.get("skills") or []
            
            if isinstance(skills_raw, list):
                extracted_skills = [str(s) for s in skills_raw if s]
            elif isinstance(skills_raw, dict):
                # Handle nested skills structure {technical, soft, tools}  
                for k in ["technical", "soft", "tools"]:
                    val = skills_raw.get(k)
                    if isinstance(val, list):
                        extracted_skills.extend([str(v) for v in val if v])
            
            # Clean and deduplicate skills
            extracted_skills = list(set([str(s).strip().title() for s in extracted_skills if s]))
            profile_updates["skills"] = extracted_skills
            
            # ===== APPLY ALL UPDATES TO CANDIDATE PROFILE =====
            profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == user_id).first()
            if profile:
                # Apply all mapped field updates
                for key, value in profile_updates.items():
                    if hasattr(profile, key) and value is not None:
                        setattr(profile, key, value)
                        print(f"✓ Updated profile.{key}")
                
                print(f"✅ Updated CandidateProfile with {len(profile_updates)} fields")
            
            # ===== STORE RAW RESUME DATA IN resume_data TABLE =====
            def _get_json_field(data, keys):
                """Safely extract JSON field handling both list and stringified formats"""
                for k in keys:
                    val = data.get(k)
                    if val:
                        if isinstance(val, str):
                            try:
                                return json.loads(val)
                            except:
                                continue
                        return val
                return []
            
            resume = db.query(ResumeData).filter(ResumeData.user_id == user_id).first()
            
            education_history = _get_json_field(parsed_data, ["education_history", "education"])
            experience_history = _get_json_field(parsed_data, ["experience_history", "timeline"])
            projects = _get_json_field(parsed_data, ["projects"])
            career_gaps = _get_json_field(parsed_data, ["career_gap_report"])
            
            if resume:
                resume.raw_text = text[:30000]
                resume.raw_education = education_history
                resume.raw_experience = experience_history
                resume.raw_projects = projects
                resume.timeline = experience_history
                resume.education = education_history
                resume.career_gaps = career_gaps
                resume.skills = extracted_skills
                resume.achievements = parsed_data.get("major_achievements")
                resume.parsed_at = func.now()
            else:
                resume = ResumeData(
                    user_id=user_id,
                    raw_text=text[:30000],
                    raw_education=education_history,
                    raw_experience=experience_history,
                    raw_projects=projects,
                    timeline=experience_history,
                    education=education_history,
                    career_gaps=career_gaps,
                    skills=extracted_skills,
                    achievements=parsed_data.get("major_achievements"),
                    parsed_at=func.now()
                )
                db.add(resume)
            
            print(f"✓ ResumeData stored for user {user_id}")
            
            db.commit()
            print(f"✅ All resume data committed successfully")
            
            # ===== SYNC SKILLS TO CATALOG =====
            if extracted_skills and profile:
                await ResumeService._sync_to_skill_catalog(extracted_skills, profile.experience)
                
        except Exception as e:
            print(f"❌ Error storing data: {e}")
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
            
        # Standardize band
        valid_bands = ["fresher", "mid", "senior", "leadership"]
        band = str(band).lower() if str(band).lower() in valid_bands else "mid"
        
        db = SessionLocal()
        try:
            from src.core.models import SkillCatalog
            from sqlalchemy import func
            
            skill_count = 0
            for skill_name in skills:
                name = str(skill_name).strip()
                if not name or len(name) < 2 or len(name) > 100: 
                    continue
                
                # Check if exists for this band (case-sensitive)
                existing = db.query(SkillCatalog).filter(
                    SkillCatalog.name == name,
                    SkillCatalog.experience_band == band
                ).first()
                
                if existing:
                    existing.last_seen_at = func.now()
                else:
                    new_skill = SkillCatalog(
                        name=name,  # Preserves exact casing
                        experience_band=band,
                        last_seen_at=func.now()
                    )
                    db.add(new_skill)
                skill_count += 1
            
            db.commit()
            print(f"DEBUG: Synced {skill_count} skills to catalog for band: {band}")
        except Exception as e:
            print(f"CRITICAL: Skill catalog sync failed: {e}")
            db.rollback()
        finally:
            db.close()
    
    @staticmethod
    def parse_resume_sync(user_id: str, resume_path: str, google_key: str = None):
        """
        Synchronous wrapper for parse_resume() for use with BackgroundTasks
        Must be called from a background task, not from async context
        """
        import asyncio
        try:
            # Run the async function in a new event loop
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            result = loop.run_until_complete(
                ResumeService.parse_resume(user_id, resume_path, google_key)
            )
            loop.close()
            print(f"✅ Resume parsing completed for user {user_id}")
            return result
        except Exception as e:
            print(f"❌ Resume parsing error for user {user_id}: {e}")
            import traceback
            traceback.print_exc()
            return None
