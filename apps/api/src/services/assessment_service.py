import json
import random
import asyncio
import httpx
from typing import List, Dict, Optional, Any
from datetime import datetime
from sqlalchemy.orm import Session
from src.core.database import SessionLocal
from src.core.models import CandidateProfile, AssessmentSession, AssessmentQuestion, AssessmentResponse, ResumeData
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
                        "X-Title": "TalentFlow Business Assessment"
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
                db.commit()
            return session
            
        budgets = {"fresher": 10, "mid": 12, "senior": 15, "leadership": 18}
        new_session = AssessmentSession(
            candidate_id=user_id,
            experience_band=band,
            status="started",
            total_budget=budgets.get(band, 10),
            current_step=1
        )
        db.add(new_session)
        db.commit()
        db.refresh(new_session)
        return new_session

    def get_next_question(self, user_id: str, db: Session):
        session = db.query(AssessmentSession).filter(AssessmentSession.candidate_id == user_id).first()
        if not session:
            session = self.get_or_create_session(user_id, db)
            
        # Get IDs of questions already answered by this candidate
        answered_ids = db.query(AssessmentResponse.question_id).filter(AssessmentResponse.candidate_id == user_id).all()
        answered_ids = [str(r[0]) for r in answered_ids]
        
        # Find questions for the session's experience band that haven't been answered
        query = db.query(AssessmentQuestion).filter(
            AssessmentQuestion.experience_band == session.experience_band
        )
        
        if answered_ids:
            query = query.filter(~AssessmentQuestion.id.in_(answered_ids))
            
        # Randomize to avoid repeated patterns
        questions = query.limit(20).all()
        if not questions:
            # Fallback: if no more questions in the band, try mid or fresher
            fallback_band = "fresher" if session.experience_band != "fresher" else "mid"
            query = db.query(AssessmentQuestion).filter(AssessmentQuestion.experience_band == fallback_band)
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
            "status": "active"
        }

    async def submit_answer(self, user_id: str, question_id: str, answer: str, db: Session):
        session = db.query(AssessmentSession).filter(AssessmentSession.candidate_id == user_id).first()
        if not session:
            session = self.get_or_create_session(user_id, db)

        question = db.query(AssessmentQuestion).filter(AssessmentQuestion.id == question_id).first()
        
        # --- AI EVALUATION ENGINE ---
        evaluation_result = {
            "score": 0,
            "reasoning": "Manual review pending",
            "driver_scores": {}
        }

        if question:
            prompt = f"""
            Task: Evaluate the following candidate answer for a business assessment.
            Question: {question.question_text}
            Category: {question.category}
            Driver: {question.driver}
            Experience Band: {question.experience_band}
            Candidate Answer: {answer}
            
            Evaluation Rubric: {question.evaluation_rubric}
            
            Return a JSON object with:
            1. "score": integer 0-100
            2. "reasoning": short explanation
            3. "driver_scores": {{ "{question.driver}": score }}
            """
            
            try:
                ai_raw = await self._call_ai_robust(prompt, "You are an expert HR auditor.")
                if ai_raw:
                    # Clean potential markdown
                    clean_json = ai_raw.replace('```json', '').replace('```', '').strip()
                    eval_data = json.loads(clean_json)
                    score_val = eval_data.get("score", 50)
                    # Convert to int if float, and ensure within 0-100
                    try:
                        score_val = int(float(score_val))
                        score_val = max(0, min(100, score_val))
                    except (ValueError, TypeError):
                        score_val = 50
                        
                    evaluation_result["score"] = score_val
                    evaluation_result["reasoning"] = eval_data.get("reasoning", "")
                    evaluation_result["driver_scores"] = eval_data.get("driver_scores", {})
            except Exception as e:
                print(f"DEBUG: AI Evaluation Failed: {str(e)}")
                # Default logic if AI fails
                evaluation_result["score"] = 60 if len(answer) > 30 else 40
            
            # Final safety check before DB insertion
            evaluation_result["score"] = max(0, min(100, int(evaluation_result["score"])))

        # Store the response
        response = AssessmentResponse(
            candidate_id=user_id,
            question_id=question_id,
            question_text=question.question_text if question else "Unknown Question",
            category=question.category if question else "general",
            driver=question.driver if question else "none",
            difficulty=question.difficulty if question else "medium",
            raw_answer=answer,
            score=evaluation_result["score"],
            evaluation_metadata=evaluation_result
        )
        db.add(response)
        
        # Update session progress
        session.current_step += 1
        
        # Auto-complete session if budget reached
        if session.current_step > session.total_budget:
            session.status = "completed"
            session.completed_at = datetime.now()
            
            # Trigger aggregate score calculation (could be background task)
            all_responses = db.query(AssessmentResponse).filter(AssessmentResponse.candidate_id == user_id).all()
            if all_responses:
                avg_score = sum(r.score for r in all_responses) / len(all_responses)
                session.overall_score = avg_score
                
                # Update candidate profile status
                profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == user_id).first()
                if profile:
                    profile.assessment_status = "completed"
                    profile.final_profile_score = (profile.final_profile_score or 0) + int(avg_score * 0.4) # Weighted impact
            
        db.commit()
        
        # Return merged data so frontend can update state easily
        return {
            "status": "success",
            "score": evaluation_result["score"],
            "session_status": session.status,
            "current_step": session.current_step,
            "total_budget": session.total_budget
        }

assessment_service = AssessmentService()
