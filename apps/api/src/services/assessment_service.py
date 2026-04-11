import json
import random
import asyncio
import httpx
import time
from typing import List, Dict, Optional, Any
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func
from src.core.database import SessionLocal
from src.core.models import CandidateProfile, AssessmentSession, AssessmentQuestion, AssessmentResponse, ResumeData, ProfileScore
from src.services.notification_service import NotificationService
from google import genai
from src.core.config import GOOGLE_API_KEY, OPENROUTER_API_KEY, OPENAI_API_KEY

class AssessmentService:
    def __init__(self):
        self._client = httpx.AsyncClient(timeout=30.0)
        self.ai_client = genai.Client(api_key=GOOGLE_API_KEY)
        self.openai_key = OPENAI_API_KEY
        self.model_name = "gemini-2.0-flash"

    async def _call_ai_robust(self, prompt: str, system_message: str = "You are a professional assessment auditor.") -> Optional[str]:
        # 1. Primary OpenAI Call
        if self.openai_key:
            try:
                response = await self._client.post(
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
                        "temperature": 0.4
                    }
                )
                if response.status_code == 200:
                    data = response.json()
                    return data["choices"][0]["message"]["content"].strip()
                else:
                    print(f"DEBUG: OpenAI Assessment Failed ({response.status_code}): {response.text}")
            except Exception as oai_e:
                print(f"DEBUG: OpenAI Assessment Exception: {str(oai_e)}")

        # 2. Secondary Gemini Call
        try:
            response = await asyncio.to_thread(
                self.ai_client.models.generate_content,
                model=self.model_name,
                contents=prompt
            )
            if response and response.text:
                return response.text.strip()
        except Exception as e:
            print(f"DEBUG: Gemini Secondary Failed: {str(e)}. Falling back to OpenRouter...")

        # 3. Tertiary OpenRouter Call
        if OPENROUTER_API_KEY:
            try:
                response = await self._client.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                        "Content-Type": "application/json",
                        "X-Title": "TechSales Axis Business Assessment"
                    },
                    json={
                        "model": "openai/gpt-4o-mini",
                        "messages": [
                            {"role": "system", "content": system_message},
                            {"role": "user", "content": prompt}
                        ],
                        "temperature": 0.3
                    }
                )
                if response.status_code == 200:
                    data = response.json()
                    return data["choices"][0]["message"]["content"].strip()
            except Exception as or_e:
                print(f"DEBUG: OpenRouter Critical Failure: {str(or_e)}")
        return None

    def get_or_create_session(self, user_id: str, db: Session):
        profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == user_id).first()
        resume = db.query(ResumeData).filter(ResumeData.user_id == user_id).first()
        
        # Determine experience band from profile
        band = "fresher"
        if profile:
            # PRIORITIZE EXPLICIT BAND SELECTION (experience column)
            if profile.experience and profile.experience.lower() in ['senior', 'mid', 'leadership', 'fresher']:
                band = profile.experience.lower()
            else:
                # CHECK RESUME DATA IF PROFILE IS EMPTY
                exp_val = profile.years_of_experience
                # If profile has no experience but resume exists, try to infer from resume
                if not exp_val and resume:
                    try:
                        # Use raw_experience from ResumeData instead of deleted structured_data
                        if resume.raw_experience:
                            # Simple heuristic or just keep as is for now
                            pass
                    except:
                        pass

                if isinstance(exp_val, (int, float)):
                    if exp_val > 10: band = "leadership"
                    elif exp_val > 5: band = "senior"
                    elif exp_val > 1: band = "mid"
                    else: band = "fresher"
                elif exp_val: # Handle string case
                    try:
                        # Try to extract number from string like "5 years"
                        import re
                        match = re.search(r'(\d+)', str(exp_val))
                        if match:
                            num = int(match.group(1))
                            if num > 10: band = "leadership"
                            elif num > 5: band = "senior"
                            elif num > 1: band = "mid"
                            else: band = "fresher"
                        else:
                            band = str(exp_val).lower()
                    except:
                        band = "fresher"
        
        # Normalize band
        band = band.lower()
        # Map common variants to valid bands
        if "lead" in band or "director" in band or "vp" in band: band = "leadership"
        elif "senior" in band or "sr" in band: band = "senior"
        elif "mid" in band: band = "mid"
        elif "fresh" in band or "junior" in band or "jr" in band: band = "fresher"

        # Valid bands in DB: ['senior', 'mid', 'leadership', 'fresher']
        valid_bands = ['senior', 'mid', 'leadership', 'fresher']
        if band not in valid_bands:
            band = "fresher"

        session = db.query(AssessmentSession).filter(AssessmentSession.candidate_id == user_id).first()
        if session:
            # Sync band if it changed or profile updated
            if session.experience_band != band and session.current_step <= 1:
                session.experience_band = band
                # Also sync budget if it's a first-step update
                budgets = {"fresher": 8, "mid": 10, "senior": 13, "leadership": 16}
                session.total_budget = budgets.get(band, 8)
            
            # ========== FAST-TRACK QUEUE INITIALIZATION ==========
            # Ensure SLA is set (for existing sessions that may not have it)
            if not session.expected_completion_sla and session.status == 'started':
                from datetime import timedelta
                # Check if candidate qualifies for fast-track
                if profile and profile.career_readiness_score and profile.career_readiness_score >= 80:
                    session.queue_priority = 'fast_track'
                    session.queue_priority_reason = 'career_readiness_high'
                    session.expected_completion_sla = session.started_at + timedelta(hours=4)
                else:
                    session.queue_priority = 'standard'
                    session.expected_completion_sla = session.started_at + timedelta(hours=24)
            
            db.commit()
            return session
            
        budgets = {"fresher": 8, "mid": 10, "senior": 13, "leadership": 16}
        
        # ========== FAST-TRACK QUEUE DETERMINATION (NEW SESSIONS) ==========
        from datetime import timedelta
        queue_priority = 'standard'
        queue_priority_reason = None
        expected_completion_sla = None
        
        # Check if candidate qualifies for fast-track based on career readiness
        if profile and profile.career_readiness_score and profile.career_readiness_score >= 80:
            queue_priority = 'fast_track'
            queue_priority_reason = 'career_readiness_high'
            # Fast-track: 4-hour SLA
            from datetime import datetime
            expected_completion_sla = datetime.utcnow() + timedelta(hours=4)
        else:
            # Standard: 24-hour SLA
            from datetime import datetime
            expected_completion_sla = datetime.utcnow() + timedelta(hours=24)
        
        new_session = AssessmentSession(
            candidate_id=user_id,
            experience_band=band,
            status="started",
            total_budget=budgets.get(band, 8),
            current_step=1,
            queue_priority=queue_priority,
            queue_priority_reason=queue_priority_reason,
            expected_completion_sla=expected_completion_sla
        )
        db.add(new_session)
        db.commit()
        db.refresh(new_session)
        return new_session

    def get_next_question(self, user_id: str, db: Session):
        session = db.query(AssessmentSession).filter(AssessmentSession.candidate_id == user_id).first()
        if not session:
            session = self.get_or_create_session(user_id, db)
        
        # Define category distribution based on experience band (using DATABASE COLUMN NAMES)
        # FIXED: Map to actual DB category values: "resume", "skill", "behavioral", "psychometric"
        distribution = {
            "fresher": {
                "resume": 0.20,
                "skill": 0.10,
                "behavioral": 0.35,
                "psychometric": 0.35
            },
            "mid": {
                "resume": 0.20,
                "skill": 0.20,
                "behavioral": 0.30,
                "psychometric": 0.30
            },
            "senior": {
                "resume": 0.20,
                "skill": 0.30,
                "behavioral": 0.25,
                "psychometric": 0.25
            },
            "leadership": {
                "resume": 0.25,
                "skill": 0.35,
                "behavioral": 0.20,
                "psychometric": 0.20
            }
        }
        
        # Get current distribution of answers
        answered_responses = db.query(
            AssessmentResponse.category,
            func.count(AssessmentResponse.id).label('count')
        ).filter(
            AssessmentResponse.candidate_id == user_id
        ).group_by(AssessmentResponse.category).all()
        
        answered_count = {cat: count for cat, count in answered_responses}
        total_answered = sum(answered_count.values())
        
        # Determine which category needs more questions
        target_dist = distribution.get(session.experience_band, distribution["mid"])
        category_deficit = {}
        
        for category, percentage in target_dist.items():
            target_count = int(session.total_budget * percentage)
            current_count = answered_count.get(category, 0)
            deficit = target_count - current_count
            category_deficit[category] = deficit
        
        # Select from the category with the largest deficit
        preferred_category = max(category_deficit, key=lambda k: category_deficit[k])
        
        # Get IDs of questions already answered
        answered_ids = db.query(AssessmentResponse.question_id).filter(AssessmentResponse.candidate_id == user_id).all()
        answered_ids = [str(r[0]) for r in answered_ids if r[0] is not None]  # Filter out None values from dynamic questions
        
        # Check current counts for resume questions specifically
        resume_answered_count = answered_count.get("resume", 0)
        
        # TRY DYNAMIC GENERATION FIRST FOR RESUME AND SKILL (Interleaved logic)
        # We prioritize Resume questions if the deficit is high and we haven't reached the 3-question cap
        if preferred_category == "resume" and resume_answered_count < 3:
            resume_q = self._try_generate_resume_question(user_id, db)
            if resume_q:
                # Add a flag to indicate this is an AI-evaluated dynamic question
                resume_q["is_ai_evaluated"] = True
                return resume_q
        
        if preferred_category == "skill":
            skill_q = self._try_generate_skill_question(user_id, session.experience_band, db)
            if skill_q:
                skill_q["is_ai_evaluated"] = True 
                return skill_q
        
        # Try to find seeded question from preferred category first
        # FIXED: Match category column correctly
        query = db.query(AssessmentQuestion).filter(
            AssessmentQuestion.experience_band == session.experience_band,
            AssessmentQuestion.category == preferred_category
        )
        
        if answered_ids:
            query = query.filter(~AssessmentQuestion.id.in_(answered_ids))
        
        questions = query.limit(20).all()
        
        # Fallback: if no questions in preferred category, try any category (FIXED: removed experience_band match)
        if not questions:
            query = db.query(AssessmentQuestion).filter(
                AssessmentQuestion.category == preferred_category
            )
            if answered_ids:
                query = query.filter(~AssessmentQuestion.id.in_(answered_ids))
            questions = query.limit(20).all()
        
        # Fallback 2: Try different category with remaining deficit
        if not questions:
            remaining_cats = [cat for cat, deficit in category_deficit.items() if deficit > 0 and cat != preferred_category]
            for alt_cat in sorted(remaining_cats, key=lambda c: category_deficit[c], reverse=True):
                # Try dynamic generation for alternate categories
                if alt_cat == "resume" and resume_answered_count < 3:
                    resume_q = self._try_generate_resume_question(user_id, db)
                    if resume_q:
                        resume_q["is_ai_evaluated"] = True
                        return resume_q
                
                if alt_cat == "skill":
                    skill_q = self._try_generate_skill_question(user_id, session.experience_band, db)
                    if skill_q:
                        skill_q["is_ai_evaluated"] = True
                        return skill_q
                
                # Try seeded questions for this category
                query = db.query(AssessmentQuestion).filter(
                    AssessmentQuestion.category == alt_cat
                )
                if answered_ids:
                    query = query.filter(~AssessmentQuestion.id.in_(answered_ids))
                questions = query.limit(20).all()
                if questions:
                    break
        
        # Final fallback to any available question
        if not questions:
            query = db.query(AssessmentQuestion).filter(
                AssessmentQuestion.experience_band.in_(["fresher", "mid", "senior", "leadership"])
            )
            if answered_ids:
                query = query.filter(~AssessmentQuestion.id.in_(answered_ids))
            questions = query.limit(20).all()

        if not questions:
            return None

        q = random.choice(questions)
        
        # Returning dictionary format that the frontend expects
        return {
            "id": str(q.id),
            "text": q.question_text,
            "category": q.category,
            "driver": q.driver,
            "difficulty": q.difficulty,
            "current_step": session.current_step,
            "total_budget": session.total_budget,
            "is_ai_evaluated": False, # Predefined questions are not AI evaluated per instructions
            "status": "active"
        }

    def _try_generate_resume_question(self, user_id: str, db: Session) -> Optional[Dict]:
        """Generate dynamic resume-based questions about role consistency, career gaps, and achievements.
        
        FIXED Phase 4: Now uses ResumeParserV2 extracted data (dominant_role, tech_sales_years, etc.)
        instead of basic current_role/years_of_experience which may be None.
        """
        try:
            profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == user_id).first()
            resume = db.query(ResumeData).filter(ResumeData.user_id == user_id).first()
            
            if not profile and not resume:
                return None
            
            # FIXED: Use new Phase 2/3 fields from ResumeParserV2 extraction
            # These are more reliable than the basic current_role
            current_role = profile.dominant_role if profile and profile.dominant_role else profile.current_role if profile else None
            primary_pattern = profile.primary_career_pattern if profile and profile.primary_career_pattern else "Unknown"
            
            # Use total relevant years (tech+sales+general) instead of all experience
            yoe = profile.total_relevant_years if profile and profile.total_relevant_years > 0 else profile.years_of_experience if profile else 0
            
            # Get achievements and career info
            achievements = resume.achievements if resume and resume.achievements else []
            career_gaps = resume.career_gaps if resume and resume.career_gaps else {}
            timeline = resume.timeline if resume and resume.timeline else {}
            experience_history = profile.experience_history if profile and profile.experience_history else {}
            
            # Build dynamic question based on resume data
            questions_pool = []
            
            # Question 1: Role Consistency (use dominant role from V2 extraction)
            if current_role and current_role != "None":
                questions_pool.append({
                    "text": f"According to your resume, your most recent role has been {current_role}. Walk us through how you've evolved your responsibilities and impact in this role. Highlight specific milestones or transitions that shaped your expertise.",
                    "driver": "role_continuity"
                })
            
            # Question 1.5: Career Pattern Recognition (new with Phase 2/3)
            if primary_pattern and primary_pattern != "Unknown":
                role_count = len(experience_history) if isinstance(experience_history, (list, dict)) else 1
                questions_pool.append({
                    "text": f"Your career shows a strong pattern in {primary_pattern} ({role_count} roles). Can you describe your philosophy on this career track? What attracts you to this domain, and how do you see your expertise evolving?",
                    "driver": "career_pattern"
                })
            
            # Question 2: Years of Experience & Growth (using correct YOE)
            if yoe and yoe > 0:
                questions_pool.append({
                    "text": f"With {yoe} years of relevant experience in {primary_pattern}, describe a major evolution in your skillset or responsibilities. What challenge drove this growth, and how has it shaped your approach to work?",
                    "driver": "experience_growth"
                })
            
            # Question 2.5: Career Gaps (if gaps detected)
            if career_gaps and isinstance(career_gaps, dict) and career_gaps.get("gaps"):
                questions_pool.append({
                    "text": f"Your resume shows a career gap of {career_gaps.get('gap_duration', 'some time')}. Could you elaborate on what you did during this period and how you stayed current with industry trends?",
                    "driver": "career_gap_narrative"
                })
            
            # Question 3: Achievements Validation (if achievements exist)
            if achievements:
                top_achievement = achievements[0] if isinstance(achievements, list) else achievements
                questions_pool.append({
                    "text": f"One of your key achievements listed is: '{top_achievement}'. Please describe the problem you identified, your approach, and the measurable impact this created for your organization.",
                    "driver": "achievement_validation"
                })
            
            # Question 4: Generic Role Deep Dive (fallback)
            if current_role and current_role != "None":
                questions_pool.append({
                    "text": f"In your role as {current_role}, describe a complex technical or business challenge you faced. Walk us through your problem-solving approach and the outcome.",
                    "driver": "role_deep_dive"
                })
            else:
                # Fallback if no role captured
                questions_pool.append({
                    "text": f"Describe a complex professional challenge you've faced in your {yoe if yoe else ''} years of experience. Walk us through your problem-solving approach and the business impact.",
                    "driver": "general_challenge"
                })
            
            if not questions_pool:
                return None
            
            # Select random question from pool
            selected = random.choice(questions_pool)
            
            return {
                "id": f"dynamic_resume_{user_id}_{int(time.time() * 1000)}",
                "text": selected["text"],
                "category": "resume",
                "driver": selected.get("driver", "role_narrative"),
                "difficulty": "medium"
            }
        
        except Exception as e:
            print(f"DEBUG: Resume question generation failed: {str(e)}")
            import traceback
            traceback.print_exc()
            return None

    def _try_generate_skill_question(self, user_id: str, experience_band: str, db: Session) -> Optional[Dict]:
        """Generate dynamic skill-based case study questions from candidate's profile skills."""
        try:
            profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == user_id).first()
            resume = db.query(ResumeData).filter(ResumeData.user_id == user_id).first()
            
            # Combine skills from Profile (added by user) and ResumeData (extracted by AI)
            skills = []
            
            if profile and profile.skills:
                skills.extend(profile.skills if isinstance(profile.skills, list) else [])
            
            if resume and resume.skills:
                skills.extend(resume.skills if isinstance(resume.skills, list) else [])
            
            # Deduplicate and clean
            skills = list(set([str(s).strip() for s in skills if s]))
            
            if not skills:
                # Fallback to Skill Catalog to avoid blocking the assessment
                from src.core.models import SkillCatalog
                catalog_skills = db.query(SkillCatalog).filter(
                    SkillCatalog.experience_band == experience_band
                ).limit(10).all()
                if catalog_skills:
                    skills = [s.name for s in catalog_skills]
            
            if not skills:
                return None
            
            # Get responses to avoid duplicate skill questions
            responses = db.query(AssessmentResponse).filter(
                AssessmentResponse.candidate_id == user_id,
                AssessmentResponse.category == "skill"
            ).all()
            tested_skills = [r.question_id for r in responses]
            
            # Get untested skill (or random if all tested)
            available_skills = [s for s in skills if s not in tested_skills]
            skill = random.choice(available_skills if available_skills else skills)
            
            # Define difficulty modifiers by experience band
            difficulty_context = {
                "fresher": "You're new to this skill. Design a solution.",
                "mid": "You're moderately experienced. Design a solution under time pressure.",
                "senior": "You're an expert. Design an optimized solution addressing edge cases.",
                "leadership": "You're a technical leader. Design and justify an architectural approach."
            }
            
            context = difficulty_context.get(experience_band, "Design a solution.")
            
            # Build case study question
            scenario = f"You're tasked with implementing a solution using {skill}. {context}"
            question_text = f"{scenario}\n\nProvide your approach including:\n1. Architecture/Design\n2. Implementation considerations\n3. Potential challenges and solutions"
            
            return {
                "id": f"dynamic_skill_{user_id}_{skill}_{int(asyncio.get_event_loop().time())}",
                "text": question_text,
                "category": "skill",
                "driver": f"skill_application_{skill.lower().replace(' ', '_')}",
                "difficulty": experience_band
            }
        
        except Exception as e:
            print(f"DEBUG: Skill question generation failed: {str(e)}")
            return None

    async def submit_answer(self, user_id: str, question_id: str, answer: str, db: Session, is_skipped: bool = False):
        session = db.query(AssessmentSession).filter(AssessmentSession.candidate_id == user_id).first()
        if not session:
            session = self.get_or_create_session(user_id, db)

        # Check if this is a dynamic question (not a real UUID in database)
        question = None
        is_dynamic_question = False
        
        if isinstance(question_id, str) and (question_id.startswith("dynamic_resume_") or question_id.startswith("dynamic_skill_")):
            # This is a dynamically generated question, construct it without DB lookup
            is_dynamic_question = True
            if question_id.startswith("dynamic_resume_"):
                question = type('Question', (), {
                    'id': question_id,
                    'question_text': answer[:100] + "..." if len(answer) > 100 else answer,  # Placeholder
                    'category': 'resume',
                    'driver': 'dynamic_resume',
                    'difficulty': 'medium',
                    'experience_band': session.experience_band,
                    'evaluation_rubric': None
                })()
            elif question_id.startswith("dynamic_skill_"):
                question = type('Question', (), {
                    'id': question_id,
                    'question_text': answer[:100] + "..." if len(answer) > 100 else answer,  # Placeholder
                    'category': 'skill',
                    'driver': 'dynamic_skill',
                    'difficulty': session.experience_band,
                    'experience_band': session.experience_band,
                    'evaluation_rubric': None
                })()
        else:
            # Try to fetch from database
            try:
                question = db.query(AssessmentQuestion).filter(AssessmentQuestion.id == question_id).first()
            except Exception as e:
                # If UUID conversion fails, treat as dynamic
                print(f"DEBUG: Failed to query question {question_id}: {str(e)}")
                question = None
        
        # --- BEHAVIORAL IMPACT OF SKIPPING ---
        # Skipping affects behavioral scores based on difficulty
        skip_penalty = 0
        if is_skipped and question:
            difficulty_map = {"easy": 5, "medium": 12, "hard": 20, "leadership": 25, "senior": 18, "fresher": 5, "mid": 10}
            skip_penalty = difficulty_map.get(question.difficulty.lower(), 10)
        
        # --- AI EVALUATION ENGINE ---
        evaluation_result = {
            "score": 0,
            "reasoning": "Evaluation pending",
            "driver_scores": {},
            "rubric_type": "none"
        }

        if question and not is_skipped:
            # Build evaluation prompt - ALL categories are now AI evaluated
            category_context = {
                "resume": "Validate claims and depth of experience.",
                "skill": "Evaluate technical application and problem-solving.",
                "behavioral": "Evaluate soft skills, transparency, and accountability.",
                "psychometric": "Evaluate logical reasoning and decision-making patterns."
            }
            
            prompt = f"""
            Task: Evaluate the candidate's answer for this {question.category} question.
            Context: {category_context.get(question.category, "Professional assessment.")}
            Question: {question.question_text}
            Candidate Answer: {answer}
            Experience Band: {question.experience_band}
            Difficulty: {question.difficulty}
            
            Criteria:
            1. Relevance: { "Addresses technical constraints" if question.category == 'skill' else "Directly answers the prompt" }
            2. Specificity: { "Includes metrics or clear steps" if question.category in ['resume', 'skill'] else "Clear context provided" }
            3. Ownership: Shows personal accountability.
            
            Return a JSON object with:
            1. "score": integer 0-100 (0 for non-answers or nonsensical text)
            2. "reasoning": concise explanation
            3. "driver_scores": {{ "{question.driver}": score }}
            """
            
            try:
                ai_raw = await self._call_ai_robust(prompt, "You are a strict professional auditor. Use 0 for empty, evasive, or low-quality answers.")
                if ai_raw:
                    clean_json = ai_raw.replace('```json', '').replace('```', '').strip()
                    eval_data = json.loads(clean_json)
                    score_val = eval_data.get("score", 0)
                    
                    try:
                        score_val = int(float(score_val))
                        score_val = max(0, min(100, score_val))
                    except:
                        score_val = 0
                        
                    evaluation_result["score"] = score_val
                    evaluation_result["reasoning"] = eval_data.get("reasoning", "No reasoning provided.")
                    evaluation_result["driver_scores"] = eval_data.get("driver_scores", {question.driver: score_val})
                    evaluation_result["rubric_type"] = "ai_standard"
            except Exception as e:
                # Same strict fallback as before
                word_count = len(answer.split())
                if word_count > 40: evaluation_result["score"] = 70
                elif word_count > 25: evaluation_result["score"] = 50
                elif word_count > 10: evaluation_result["score"] = 25
                else: evaluation_result["score"] = 0
                evaluation_result["reasoning"] = f"Fallback scoring (AI error): {word_count} words."
                evaluation_result["driver_scores"] = {question.driver: evaluation_result["score"]}
                evaluation_result["rubric_type"] = "fallback"
        elif is_skipped:
            evaluation_result["score"] = 0
            evaluation_result["reasoning"] = f"Candidate skipped a {question.difficulty if question else 'medium'} question. Penalty applied to behavioral score."
            evaluation_result["driver_scores"] = {question.driver: 0, "grit": -skip_penalty}
        
        # Final safety check
        evaluation_result["score"] = max(0, min(100, int(evaluation_result["score"])))

        # Store the response
        response = AssessmentResponse(
            candidate_id=user_id,
            question_id=question_id if not is_dynamic_question else None,
            question_text=question.question_text if question else "Unknown Question",
            category=question.category if question else "general",
            driver=question.driver if question else "none",
            difficulty=question.difficulty if question else "medium",
            raw_answer=answer if not is_skipped else "[SKIPPED]",
            score=evaluation_result["score"],
            is_skipped=is_skipped,
            evaluation_metadata=evaluation_result
        )
        db.add(response)
        
        # Update session progress
        session.current_step += 1
        
        # Auto-complete session if budget reached
        if session.current_step >= session.total_budget:
            session.status = "completed"
            session.completed_at = datetime.now()
            
            # Trigger aggregate score calculation
            all_responses = db.query(AssessmentResponse).filter(AssessmentResponse.candidate_id == user_id).all()
            if all_responses:
                avg_score = sum(r.score for r in all_responses) / len(all_responses)
                session.overall_score = avg_score
                
                # Update candidate profile status
                profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == user_id).first()
                if profile:
                    profile.assessment_status = "completed"
                    profile.final_profile_score = int(avg_score)  # Use assessment score as final profile score
                
                # Calculate category-wise scores for ProfileScore breakdown
                from sqlalchemy import func
                category_scores = db.query(
                    AssessmentResponse.category,
                    func.avg(AssessmentResponse.score).label('avg_score')
                ).filter(
                    AssessmentResponse.candidate_id == user_id
                ).group_by(AssessmentResponse.category).all()
                
                # Map database category names to ProfileScore fields
                category_score_map = {
                    "resume": "resume_score",
                    "skill": "skills_score",
                    "behavioral": "behavioral_score",
                    "psychometric": "psychometric_score",
                    "reference": "reference_score"
                }
                
                score_data = {
                    'resume_score': None,
                    'behavioral_score': None,
                    'psychometric_score': None,
                    'skills_score': None,
                    'reference_score': None,
                    'final_score': int(avg_score)
                }
                
                # Map category scores using actual DB category names
                for category, avg_score_val in category_scores:
                    score_field = category_score_map.get(category)
                    if score_field:
                        score_data[score_field] = int(avg_score_val)
                
                # Create or update ProfileScore record
                profile_score = db.query(ProfileScore).filter(ProfileScore.user_id == user_id).first()
                if profile_score:
                    for key, value in score_data.items():
                        setattr(profile_score, key, value)
                else:
                    profile_score = ProfileScore(user_id=user_id, **score_data)
                    db.add(profile_score)
            
        db.commit()
        
        # Return merged data so frontend can update state easily
        return {
            "status": "success",
            "score": evaluation_result["score"],
            "reasoning": evaluation_result.get("reasoning", ""),
            "session_status": session.status,
            "current_step": session.current_step,
            "total_budget": session.total_budget
        }

assessment_service = AssessmentService()
