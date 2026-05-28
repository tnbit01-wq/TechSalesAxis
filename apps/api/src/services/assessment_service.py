import json
import random
import asyncio
import httpx
import time
import logging
import os
import statistics
from typing import List, Dict, Optional, Any
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func
from src.core.database import SessionLocal
from src.core.models import CandidateProfile, AssessmentSession, AssessmentQuestion, AssessmentResponse, ResumeData, ProfileScore
from src.services.notification_service import NotificationService
from src.core.config import OPENAI_API_KEY

logger = logging.getLogger(__name__)

class AssessmentService:
    def __init__(self):
        self._client = httpx.AsyncClient(timeout=30.0)
        self.openai_key = OPENAI_API_KEY
        # Try to load calibration mapping if present
        self.calibration = None
        try:
            workspace_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
            cal_path = os.path.join(workspace_root, "calibration.json")
            if os.path.exists(cal_path):
                with open(cal_path, "r", encoding="utf-8") as f:
                    self.calibration = json.load(f)
        except Exception:
            self.calibration = None

    async def _call_ai_robust(self, prompt: str, system_message: str = "You are a professional assessment auditor.") -> Optional[str]:
        """Call OpenAI GPT-4o for assessment evaluation."""
        if not self.openai_key:
            logger.debug("No OpenAI API key configured")
            return None

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
                logger.error(f"OpenAI Assessment Failed ({response.status_code}): {response.text}")
                return None
        except Exception as oai_e:
            logger.error(f"OpenAI Assessment Exception: {str(oai_e)}")
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

        # Stop when the planned number of questions has already been answered.
        if total_answered >= session.total_budget:
            return None

        # Determine exact per-category targets using largest-remainder apportionment.
        # This keeps total targets equal to total_budget and preserves configured weightage.
        target_dist = distribution.get(session.experience_band, distribution["mid"])
        target_counts = self._allocate_category_targets(session.total_budget, target_dist)

        category_deficit = {
            category: target_counts[category] - answered_count.get(category, 0)
            for category in target_dist
        }

        # Resume is a required weighted category, so try it before any other category can
        # consume the next turn. This prevents seeded behavioral/skill questions from
        # starving resume questions when resume still has remaining quota.
        if self._should_force_resume_question(category_deficit, target_counts, answered_count):
            resume_q = self._try_generate_resume_question(user_id, db)
            if resume_q:
                resume_q["is_ai_evaluated"] = True
                return resume_q
        
        # Select from the category with the largest normalized deficit so smaller weighted
        # categories like resume still get scheduled on time instead of being starved by raw counts.
        preferred_category = self._pick_preferred_category(category_deficit, target_counts)
        
        # Get IDs of questions already answered
        answered_ids = db.query(AssessmentResponse.question_id).filter(AssessmentResponse.candidate_id == user_id).all()
        answered_ids = [str(r[0]) for r in answered_ids if r[0] is not None]  # Filter out None values from dynamic questions
        
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
                if alt_cat == "resume" and resume_answered_count < resume_target_count:
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

    def _allocate_category_targets(self, total_budget: int, target_dist: Dict[str, float]) -> Dict[str, int]:
        """Convert fractional category weights into exact integer targets that sum to total_budget."""
        if total_budget <= 0:
            return {category: 0 for category in target_dist}

        raw_targets = {
            category: total_budget * percentage
            for category, percentage in target_dist.items()
        }
        target_counts = {
            category: int(raw_targets[category])
            for category in target_dist
        }
        assigned = sum(target_counts.values())
        remaining_slots = total_budget - assigned

        if remaining_slots > 0:
            ordered_remainders = sorted(
                target_dist.keys(),
                key=lambda c: (raw_targets[c] - target_counts[c]),
                reverse=True,
            )
            for category in ordered_remainders[:remaining_slots]:
                target_counts[category] += 1

        return target_counts

    def _pick_preferred_category(self, category_deficit: Dict[str, int], target_counts: Dict[str, int]) -> str:
        """Choose the next category using normalized deficit so small weighted categories are not starved."""
        return max(
            category_deficit,
            key=lambda category: (
                category_deficit[category] / max(target_counts.get(category, 1), 1),
                -target_counts.get(category, 1),
            ),
        )

    def _should_force_resume_question(
        self,
        category_deficit: Dict[str, int],
        target_counts: Dict[str, int],
        answered_count: Dict[str, int],
    ) -> bool:
        """Return True when resume still has quota left and should be tried before other categories."""
        resume_deficit = category_deficit.get("resume", 0)
        resume_target_count = target_counts.get("resume", 0)
        resume_answered_count = answered_count.get("resume", 0)
        return resume_deficit > 0 and resume_answered_count < resume_target_count

    def _try_generate_resume_question(self, user_id: str, db: Session) -> Optional[Dict]:
        """Generate a resume question from parsed resume data without relying on fixed sentence templates."""
        try:
            profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == user_id).first()
            resume = db.query(ResumeData).filter(ResumeData.user_id == user_id).first()
            
            if not profile and not resume:
                return None

            current_role = profile.dominant_role if profile and profile.dominant_role else profile.current_role if profile else None
            primary_pattern = profile.primary_career_pattern if profile and profile.primary_career_pattern else "Unknown"
            yoe = profile.total_relevant_years if profile and profile.total_relevant_years > 0 else profile.years_of_experience if profile else 0
            achievements = resume.achievements if resume and resume.achievements else []
            career_gaps = resume.career_gaps if resume and resume.career_gaps else {}
            experience_history = profile.experience_history if profile and profile.experience_history else {}

            resume_signals = {
                "current_role": current_role or "unknown",
                "primary_pattern": primary_pattern or "unknown",
                "years_of_experience": yoe or 0,
                "achievements": achievements[:3] if isinstance(achievements, list) else achievements,
                "career_gaps": career_gaps,
                "experience_history_size": len(experience_history) if isinstance(experience_history, (list, dict)) else 0
            }

            generation_prompt = f"""
Generate ONE original resume-based interview question for a Tech Sales recruitment assessment.

Resume signals:
- current role: {resume_signals['current_role']}
- primary career pattern: {resume_signals['primary_pattern']}
- years of relevant experience: {resume_signals['years_of_experience']}
- top achievements: {json.dumps(resume_signals['achievements'], ensure_ascii=False)}
- career gaps: {json.dumps(resume_signals['career_gaps'], ensure_ascii=False)}
- experience history size: {resume_signals['experience_history_size']}

Requirements:
- The question must be based on the resume signals above.
- Do not reuse a fixed sentence template.
- Do not ask the same kind of question every time.
- Vary the angle naturally: growth, transition, impact, gap explanation, role depth, leadership, or execution.
- Do not penalize candidates for writing style, grammar, or long resumes.
- Make the question fair even if the resume data is sparse.
- Keep it to 1 or 2 sentences.
- It should feel like a real interview question, not a canned template.

Return JSON only with these keys:
{{
  "question_text": "...",
  "question_style": "...",
  "driver": "...",
  "focus_area": "..."
}}
"""

            generated = self._run_coroutine_sync(
                self._call_ai_robust(
                    generation_prompt,
                    "You generate original, resume-specific interview questions. Never reuse a fixed template."
                )
            )

            if generated:
                try:
                    cleaned = generated.replace("```json", "").replace("```", "").strip()
                    payload = json.loads(cleaned)
                    question_text = str(payload.get("question_text", "")).strip()
                    if question_text:
                        return {
                            "id": f"dynamic_resume_{user_id}_{int(time.time() * 1000)}",
                            "text": question_text,
                            "category": "resume",
                            "driver": str(payload.get("driver", "resume_narrative")),
                            "difficulty": "medium",
                            "question_style": str(payload.get("question_style", "resume_dynamic")),
                            "focus_area": payload.get("focus_area"),
                            "resume_signals": resume_signals,
                            "prompt_text": question_text,
                            "template_id": "llm_dynamic"
                        }
                except Exception as parse_error:
                    logger.debug(f"Dynamic resume generation parse failed: {parse_error}")

            # Fallback synthesis when LLM is unavailable
            rnd = random.Random(abs(hash(str(resume_signals))) + int(time.time()) % 997)
            angles = []
            if current_role and current_role != "None":
                angles.append(f"how you have grown from {current_role} into your current scope")
            if primary_pattern and primary_pattern != "Unknown":
                angles.append(f"what draws you to the {primary_pattern} path and how it shows up in your work")
            if career_gaps and isinstance(career_gaps, dict) and career_gaps.get("gaps"):
                angles.append("how you explain and use a career gap constructively")
            if achievements:
                top_achievement = achievements[0] if isinstance(achievements, list) else achievements
                angles.append(f"the context, action, and impact behind {top_achievement}")
            if not angles:
                angles = ["a complex professional challenge that shows your judgment and impact"]

            angle = rnd.choice(angles)
            question_text = (
                f"Tell us about {angle}. What was the context, what did you personally do, and what measurable result or learning followed?"
            )

            return {
                "id": f"dynamic_resume_{user_id}_{int(time.time() * 1000)}",
                "text": question_text,
                "category": "resume",
                "driver": "resume_dynamic",
                "difficulty": "medium",
                "question_style": "resume_dynamic",
                "focus_area": rnd.choice(["growth", "impact", "transition", "gap_explanation", "role_depth"]),
                "resume_signals": resume_signals,
                "prompt_text": question_text,
                "template_id": "rule_based_fallback"
            }
        
        except Exception as e:
            logger.error(f"Resume question generation failed: {str(e)}")
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
            cleaned_skills = []
            seen_skills = set()
            for raw_skill in skills:
                skill_name = str(raw_skill).strip()
                if not skill_name:
                    continue
                normalized_skill = self._normalize_skill_key(skill_name)
                if normalized_skill in seen_skills:
                    continue
                seen_skills.add(normalized_skill)
                cleaned_skills.append(skill_name)
            skills = cleaned_skills
            
            if not skills:
                # Fallback to Skill Catalog to avoid blocking the assessment
                from src.core.models import SkillCatalog
                catalog_skills = db.query(SkillCatalog).filter(
                    SkillCatalog.experience_band == experience_band
                ).limit(10).all()
                if catalog_skills:
                    for catalog_skill in catalog_skills:
                        skill_name = str(catalog_skill.name).strip()
                        if skill_name:
                            skills.append(skill_name)
            
            if not skills:
                return None
            
            # Get responses to avoid duplicate skill questions
            responses = db.query(AssessmentResponse).filter(
                AssessmentResponse.candidate_id == user_id,
                AssessmentResponse.category == "skill"
            ).all()
            tested_skills = set()
            for response in responses:
                metadata = response.evaluation_metadata or {}
                if isinstance(metadata, dict):
                    stored_skill = metadata.get("skill_name")
                    if stored_skill:
                        tested_skills.add(self._normalize_skill_key(str(stored_skill)))
                if response.driver and response.driver.startswith("skill_application_"):
                    tested_skills.add(self._normalize_skill_key(response.driver.replace("skill_application_", "").replace("_", " ")))
            
            # Get untested skill (or random if all tested)
            available_skills = [s for s in skills if self._normalize_skill_key(s) not in tested_skills]
            skill = random.choice(available_skills if available_skills else skills)

            skill_type = self._infer_skill_question_type(skill)
            skill_payload = self._build_skill_question_prompt(skill, skill_type, experience_band)
            question_text = skill_payload["question_text"]
            
            return {
                "id": f"dynamic_skill_{user_id}_{skill}_{int(asyncio.get_event_loop().time())}",
                "text": question_text,
                "category": "skill",
                "driver": skill_payload["driver"],
                "difficulty": experience_band,
                "skill_name": skill,
                "skill_type": skill_type,
                "question_style": skill_payload["question_style"],
                "template_id": skill_payload.get("template_id"),
                "slots": skill_payload.get("slots"),
                "prompt_text": question_text
            }
        
        except Exception as e:
            logger.error(f"Skill question generation failed: {str(e)}")
            return None

    def _normalize_skill_key(self, skill_name: str) -> str:
        import re
        normalized = re.sub(r"[^a-z0-9]+", " ", str(skill_name).lower()).strip()
        return normalized

    def _run_coroutine_sync(self, coroutine):
        """Run an async coroutine from sync code when no event loop is active."""
        try:
            asyncio.get_running_loop()
            return None
        except RuntimeError:
            try:
                return asyncio.run(coroutine)
            except Exception:
                return None

    def _compose_dynamic_skill_question_text(self, skill_name: str, skill_type: str, experience_band: str) -> Dict[str, str]:
        """Fallback generator that composes a skill-specific question without a single static template."""
        normalized = self._normalize_skill_key(skill_name)
        skill_label = skill_name.strip()
        level_map = {
            "fresher": "basic execution and clear thinking",
            "mid": "independent execution and trade-off handling",
            "senior": "scale, risk, and decision quality",
            "leadership": "strategy, stakeholder alignment, and business impact"
        }
        level_focus = level_map.get(experience_band, level_map["mid"])

        skill_signals = {
            "technical": {
                "angles": [
                    f"how you would apply {skill_label} to solve a live customer problem",
                    f"how {skill_label} changes the design of a solution for a buyer-facing use case",
                    f"how you would avoid failure modes while using {skill_label} in a production workflow"
                ],
                "drivers": ["implementation_depth", "decision_quality", "risk_awareness"]
            },
            "business": {
                "angles": [
                    f"how {skill_label} helps you move a deal, unblock a stakeholder, or influence a decision",
                    f"how you use {skill_label} to create measurable pipeline or revenue impact",
                    f"how {skill_label} changes your approach when a customer pushes back"
                ],
                "drivers": ["commercial_judgment", "stakeholder_handling", "outcome_orientation"]
            },
            "general": {
                "angles": [
                    f"how you would demonstrate {skill_label} through a real work situation",
                    f"how {skill_label} affects the way you plan, communicate, or execute",
                    f"how you would show evidence that {skill_label} is working in practice"
                ],
                "drivers": ["practical_application", "clarity", "evidence"]
            }
        }

        profile = skill_signals.get(skill_type, skill_signals["general"])
        rnd = random.Random(abs(hash(normalized)) + len(normalized) + int(time.time()) % 997)
        angle = rnd.choice(profile["angles"])
        driver = rnd.choice(profile["drivers"])

        sentence_frames = {
            "technical": [
                f"Walk me through how you would use {skill_label} in a {level_focus} situation to solve a customer-facing problem.",
                f"If {skill_label} were the deciding factor in a live implementation, how would you apply it and what would you watch out for?",
                f"Describe a time or hypothetical case where {skill_label} would materially change the outcome of a technical sales decision."
            ],
            "business": [
                f"How would you use {skill_label} to influence a customer, move a deal, or improve commercial results in a {level_focus} context?",
                f"Give an example of how {skill_label} changes your approach when the business outcome matters more than the process itself.",
                f"When {skill_label} is the key skill, what does good execution look like in a real sales or stakeholder situation?"
            ],
            "general": [
                f"Tell me about a real work situation where {skill_label} would matter, and explain how you would handle it.",
                f"How would you demonstrate {skill_label} when the pressure is on and the work needs a clear outcome?",
                f"What would strong use of {skill_label} look like in a practical team or client scenario?"
            ]
        }
        frame = rnd.choice(sentence_frames.get(skill_type, sentence_frames["general"]))

        question_text = (
            f"{frame} Why is that the best approach for a {level_focus} candidate, and what result would show it worked?"
        )

        return {
            "question_text": question_text,
            "driver": f"skill_application_{normalized.replace(' ', '_')}",
            "question_style": f"dynamic_{skill_type}",
            "template_id": "llm_dynamic_fallback",
            "slots": {
                "skill_focus": level_focus,
                "driver": driver,
                "angle": angle
            }
        }

    def _infer_skill_question_type(self, skill_name: str) -> str:
        normalized = self._normalize_skill_key(skill_name)

        technical_terms = [
            "python", "java", "javascript", "typescript", "react", "next js", "node", "sql",
            "api", "backend", "frontend", "aws", "docker", "kubernetes", "linux", "data",
            "analytics", "ml", "machine learning", "testing", "devops", "salesforce"
        ]
        business_terms = [
            "sales", "marketing", "communication", "negotiation", "account", "customer",
            "operations", "project", "product", "strategy", "leadership", "management",
            "hiring", "recruitment", "stakeholder", "partnership"
        ]

        if any(term in normalized for term in technical_terms):
            return "technical"
        if any(term in normalized for term in business_terms):
            return "business"
        return "general"

    def _build_skill_question_prompt(self, skill_name: str, skill_type: str, experience_band: str) -> Dict[str, str]:
        """Generate a skill question dynamically instead of applying a fixed template."""
        skill_label = skill_name.strip()
        normalized_skill = self._normalize_skill_key(skill_name)

        skill_context = {
            "technical": "Apply the skill to a realistic technical or product-adjacent scenario.",
            "business": "Apply the skill to a sales, customer, or commercial scenario.",
            "general": "Apply the skill to a real workplace decision or execution scenario."
        }.get(skill_type, "Apply the skill to a real workplace decision or execution scenario.")

        experience_context = {
            "fresher": "Keep it focused on fundamentals and clear reasoning.",
            "mid": "Ask for practical execution and trade-offs.",
            "senior": "Ask for decision quality, risk handling, and impact.",
            "leadership": "Ask for strategy, stakeholder alignment, and business outcome."
        }.get(experience_band, "Ask for practical execution and trade-offs.")

        generation_prompt = f"""
Generate ONE original interview question for a Tech Sales recruitment assessment.

Skill: {skill_label}
Skill category: {skill_type}
Experience band: {experience_band}

Requirements:
- The question must be genuinely based on the skill above, not a reused generic template.
- Do not start with a fixed phrase like 'Scenario:' or 'Describe a situation'.
- Do not follow a repeated sentence structure.
- Make the question specific to the skill, and vary the scenario naturally.
- Keep it to 1 or 2 sentences.
- It should fit a candidate with this experience level: {experience_context}
- It should reflect this evaluation focus: {skill_context}
- It should feel like a real interview question for a Tech Sales role.

Return JSON only with these keys:
{{
  "question_text": "...",
  "question_style": "...",
  "driver": "...",
  "scenario_type": "...",
  "focus_area": "..."
}}

Question style should be short and practical, for example: technical_case, business_case, objection_handling, discovery, demo_execution, integration_reasoning.
"""

        generated = self._run_coroutine_sync(
            self._call_ai_robust(
                generation_prompt,
                "You generate original, skill-specific interview questions. Never reuse a fixed template."
            )
        )

        if generated:
            try:
                cleaned = generated.replace("```json", "").replace("```", "").strip()
                payload = json.loads(cleaned)
                question_text = str(payload.get("question_text", "")).strip()
                if question_text:
                    return {
                        "question_text": question_text,
                        "driver": str(payload.get("driver", f"skill_application_{normalized_skill.replace(' ', '_')}")),
                        "question_style": str(payload.get("question_style", skill_type or "dynamic")),
                        "template_id": "llm_dynamic",
                        "slots": {
                            "scenario_type": payload.get("scenario_type"),
                            "focus_area": payload.get("focus_area"),
                            "generation_mode": "llm"
                        }
                    }
            except Exception as parse_error:
                logger.debug(f"Dynamic skill generation parse failed: {parse_error}")

        # Fallback to non-static synthesis if the model is unavailable or returns invalid JSON
        fallback = self._compose_dynamic_skill_question_text(skill_label, skill_type, experience_band)
        fallback["slots"] = {
            **fallback.get("slots", {}),
            "generation_mode": "rule_based"
        }
        return fallback

    def _normalize_evaluation_score(self, raw_score: Any) -> int:
        try:
            score_val = float(raw_score)
        except (ValueError, TypeError):
            return 0

        if score_val < 0:
            score_val = 0

        # If AI returns a 0-6 scale, normalize to 0-100
        if score_val <= 6:
            score_val = score_val * 16.6667

        score_val = max(0, min(100, score_val))
        return int(round(score_val))

    def _calibrate_score(self, score: int) -> int:
        """Apply calibration mapping if available."""
        try:
            if self.calibration and isinstance(self.calibration, dict):
                # Support linear mapping: {"slope": x, "intercept": y}
                slope = float(self.calibration.get("slope", 1.0))
                intercept = float(self.calibration.get("intercept", 0.0))
                calibrated = slope * float(score) + intercept
                return int(max(0, min(100, round(calibrated))))
        except Exception:
            pass
        return int(max(0, min(100, int(round(score)))))

    async def _ensemble_evaluate(self, question, answer: str, attempts: int = 3) -> Dict[str, Any]:
        """Run multiple prompt variants and aggregate numeric subscores by median."""
        prompts = []
        base_context = "You are a professional assessment auditor. Score answers on a 0-100 scale."

        # Build three prompt variants with small wording differences
        for i in range(attempts):
            if i == 0:
                variant = f"Variant 1 - standard.\n{base_context}"
            elif i == 1:
                variant = f"Variant 2 - emphasize evidence.\n{base_context} Please pay special attention to specific metrics or outcomes."
            else:
                variant = f"Variant 3 - emphasize ownership and clarity.\n{base_context} Prioritize personal ownership and clarity of steps."
            prompts.append(variant)

        collected = []
        raws = []
        for system_msg in prompts:
            try:
                # Use same user prompt structure as in submit_answer but with different system messages
                user_prompt = f"Task: Score this candidate answer using an objective rubric. Provide numeric subscores.\nQuestion: {question.question_text}\nAnswer: {answer}"
                ai_raw = await self._call_ai_robust(user_prompt, system_msg)
                raws.append(ai_raw)
                if not ai_raw:
                    collected.append(None)
                    continue

                clean_json = ai_raw.replace('```json', '').replace('```', '').strip()
                eval_data = json.loads(clean_json)

                # Extract subscores if possible
                subs = eval_data.get("subscores")
                if isinstance(subs, dict):
                    normalized_subs = {}
                    for k in ["relevance", "evidence", "ownership", "clarity"]:
                        try:
                            v = subs.get(k, 0)
                            v = float(v)
                            v = max(0, min(100, v))
                            normalized_subs[k] = int(round(v))
                        except Exception:
                            normalized_subs[k] = 0
                    overall = int(round(sum(normalized_subs.values()) / len(normalized_subs)))
                    collected.append({"subscores": normalized_subs, "score": overall, "driver_scores": eval_data.get("driver_scores", {question.driver: overall}), "raw": ai_raw, "rationale": eval_data.get("rationale", eval_data.get("reasoning", ""))})
                else:
                    # Try single score field
                    sc = self._normalize_evaluation_score(eval_data.get("score", 0))
                    collected.append({"subscores": None, "score": sc, "driver_scores": eval_data.get("driver_scores", {question.driver: sc}), "raw": ai_raw, "rationale": eval_data.get("rationale", eval_data.get("reasoning", ""))})
            except Exception as e:
                collected.append(None)

        # Replace failed entries with fallback evaluations
        for idx, item in enumerate(collected):
            if not item:
                fb = self._fallback_evaluation(answer, question.driver if question else "none")
                collected[idx] = {"subscores": fb.get("subscores"), "score": fb.get("score"), "driver_scores": fb.get("driver_scores"), "raw": None, "rationale": fb.get("reasoning")}

        # Aggregate by median for each subscore and overall
        scores = [c["score"] for c in collected if c and isinstance(c.get("score"), (int, float))]
        median_score = int(round(statistics.median(scores))) if scores else 0

        # Aggregate subscores if available
        subs_lists = {"relevance": [], "evidence": [], "ownership": [], "clarity": []}
        for c in collected:
            ss = c.get("subscores")
            if isinstance(ss, dict):
                for k in subs_lists.keys():
                    subs_lists[k].append(int(ss.get(k, 0)))

        final_subs = None
        if any(subs_lists.values()):
            final_subs = {k: int(round(statistics.median(v))) if v else 0 for k, v in subs_lists.items()}
            median_score = int(round(sum(final_subs.values()) / len(final_subs)))

        # Choose rationale from response closest to median
        rationale = ""
        best_raw = None
        try:
            closest = min(collected, key=lambda c: abs(c.get("score", 0) - median_score))
            rationale = closest.get("rationale") or ""
            best_raw = closest.get("raw")
        except Exception:
            pass

        # Log high variance cases for audit
        try:
            if len(scores) >= 2 and (max(scores) - min(scores)) > 30:
                logger.warning("High ensemble variance in evaluation", extra={"question_id": getattr(question, 'id', None), "scores": scores, "collected_raw": raws})
        except Exception:
            pass

        # Apply calibration
        median_score = self._calibrate_score(median_score)
        if final_subs:
            final_subs = {k: self._calibrate_score(v) for k, v in final_subs.items()}

        return {"score": median_score, "subscores": final_subs, "reasoning": rationale, "driver_scores": collected[0].get("driver_scores") if collected else {question.driver: median_score}, "raw_responses": raws, "rubric_type": "ensemble"}

    def _fallback_evaluation(self, answer: str, driver: str) -> Dict[str, Any]:
        text = (answer or "").strip()
        if not text:
            return {
                "score": 0,
                "reasoning": "Empty response.",
                "driver_scores": {driver: 0},
                "rubric_type": "fallback",
                "subscores": {"relevance": 0, "evidence": 0, "ownership": 0, "clarity": 0}
            }

        # Structural heuristics
        sentences = [s for s in text.split('.') if s.strip()]
        word_count = len(text.split())
        has_numbers = any(char.isdigit() for char in text)
        has_steps = any(tok in text.lower() for tok in ["1.", "2.", "first", "second", "step"]) or len(sentences) >= 3
        ownership_signals = any(w in text.lower() for w in ["i ", "we ", "led ", "implemented", "owned "])
        outcome_signals = any(w in text.lower() for w in ["result", "improved", "increased", "reduced", "saved", "%", "roi"]) or has_numbers

        # Base scoring rules
        relevance = 30 if word_count < 20 else 60 if word_count < 50 else 75
        evidence = 50 if has_numbers or (word_count > 40 and has_steps) else 30
        ownership = 50 if ownership_signals else 20
        clarity = 60 if len(sentences) >= 2 and word_count > 20 else 35

        # Boosts
        if has_steps:
            relevance = min(100, relevance + 10)
            clarity = min(100, clarity + 10)
        if outcome_signals:
            evidence = min(100, evidence + 15)

        # Compose final
        subs = {
            "relevance": int(relevance),
            "evidence": int(evidence),
            "ownership": int(ownership),
            "clarity": int(clarity)
        }
        score = int(round(sum(subs.values()) / len(subs)))

        return {
            "score": score,
            "reasoning": "Fallback structural heuristic applied.",
            "driver_scores": {driver: score},
            "rubric_type": "fallback",
            "subscores": subs
        }

    async def submit_answer(self, user_id: str, question_id: str, answer: str, db: Session, is_skipped: bool = False, metadata: Optional[Dict[str, Any]] = None):
        session = db.query(AssessmentSession).filter(AssessmentSession.candidate_id == user_id).first()
        if not session:
            session = self.get_or_create_session(user_id, db)

        submitted_metadata = metadata if isinstance(metadata, dict) else {}

        # Check if this is a dynamic question (not a real UUID in database)
        question = None
        is_dynamic_question = False
        
        if isinstance(question_id, str) and (question_id.startswith("dynamic_resume_") or question_id.startswith("dynamic_skill_")):
            # This is a dynamically generated question, construct it without DB lookup
            is_dynamic_question = True
            if question_id.startswith("dynamic_resume_"):
                question_text = submitted_metadata.get("prompt_text") or submitted_metadata.get("text") or submitted_metadata.get("question_text") or submitted_metadata.get("prompt") or "Dynamic resume question"
                question = type('Question', (), {
                    'id': question_id,
                    'question_text': question_text,
                    'category': 'resume',
                    'driver': submitted_metadata.get('driver', 'dynamic_resume'),
                    'difficulty': submitted_metadata.get('difficulty', 'medium'),
                    'experience_band': session.experience_band,
                    'skill_name': submitted_metadata.get('skill_name'),
                    'skill_type': submitted_metadata.get('skill_type'),
                    'focus_area': submitted_metadata.get('focus_area'),
                    'resume_signals': submitted_metadata.get('resume_signals', {}),
                    'evaluation_rubric': None
                })()
            elif question_id.startswith("dynamic_skill_"):
                question_text = submitted_metadata.get("prompt_text") or submitted_metadata.get("text") or submitted_metadata.get("question_text") or submitted_metadata.get("prompt") or "Dynamic skill question"
                question = type('Question', (), {
                    'id': question_id,
                    'question_text': question_text,
                    'category': 'skill',
                    'driver': submitted_metadata.get('driver', 'dynamic_skill'),
                    'difficulty': submitted_metadata.get('difficulty', session.experience_band),
                    'experience_band': session.experience_band,
                    'skill_name': submitted_metadata.get('skill_name'),
                    'skill_type': submitted_metadata.get('skill_type', 'general'),
                    'template_id': submitted_metadata.get('template_id'),
                    'slots': submitted_metadata.get('slots', {}),
                    'evaluation_rubric': None
                })()
        else:
            # Try to fetch from database
            try:
                question = db.query(AssessmentQuestion).filter(AssessmentQuestion.id == question_id).first()
            except Exception as e:
                # If UUID conversion fails, treat as dynamic
                logger.error(f"Failed to query question {question_id}: {str(e)}")
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
            category_context = {
                "resume": "Validate claims and depth of experience.",
                "skill": "Evaluate technical application and problem-solving.",
                "behavioral": "Evaluate soft skills, transparency, and accountability.",
                "psychometric": "Evaluate logical reasoning and decision-making patterns."
            }

            skill_focus = ""
            resume_focus = ""
            resume_style_guardrails = ""
            if question.category == "resume":
                resume_signals = getattr(question, "resume_signals", {}) or {}
                focus_area = getattr(question, "focus_area", None)
                if focus_area:
                    resume_focus = f"Focus Area: {focus_area}\n"
                if resume_signals:
                    resume_focus += f"Resume Signals: {json.dumps(resume_signals, ensure_ascii=False)}\n"
                resume_style_guardrails = (
                    "Resume scoring rules: prioritize factual grounding, chronology, ownership, and impact. "
                    "Do not penalize the candidate for writing style, grammar, verbosity, or resume formatting. "
                    "If the question is about a gap, assess the explanation and context, not the mere existence of the gap.\n"
                )
            if question.category == "skill":
                skill_name = getattr(question, "skill_name", None)
                skill_type = getattr(question, "skill_type", None)
                if skill_name:
                    skill_focus = f"Skill Focus: {skill_name}\n"
                if skill_type:
                    skill_focus += f"Question Type: {skill_type}\n"

            prompt = f"""
Task: Score this candidate answer using an objective rubric.
Question: {question.question_text}
Answer: {answer}

Context: {category_context.get(question.category, "Professional assessment.")}
{skill_focus}Experience Band: {question.experience_band}
Difficulty: {question.difficulty}

Use the following evaluation dimensions:
1. Relevance: directly answers the prompt.
2. Evidence: provides examples, metrics, or clear reasoning.
3. Ownership: shows personal accountability.
4. Clarity: answer is coherent and well-structured.

Return exactly one JSON object with the keys:
{{"score": integer 0-100, "reasoning": "short explanation", "driver_scores": {{"{question.driver}": integer}}}}

Important:
- Use a 0-100 scoring scale.
- Do not use 0-6, 1-6, or 1-10 scales.
- Do not include markdown fences or extra text outside the JSON object.
"""

            # Stronger: require subscores for auditability and compute overall from them.
            prompt = f"""
Task: Score this candidate answer using an objective rubric. Provide numeric subscores.
Question: {question.question_text}
Answer: {answer}

Context: {category_context.get(question.category, "Professional assessment.")}
{resume_focus}{skill_focus}{resume_style_guardrails}Experience Band: {question.experience_band}
Difficulty: {question.difficulty}

Use the following evaluation dimensions and return numeric subscores 0-100:
1. Relevance: directly answers the prompt.
2. Evidence: provides examples, metrics, or clear reasoning.
3. Ownership: shows personal accountability.
4. Clarity: answer is coherent and well-structured.

Return exactly one JSON object with these keys:
{{"score": integer 0-100, "subscores": {{"relevance": int, "evidence": int, "ownership": int, "clarity": int}}, "rationale": "short explanation", "driver_scores": {{"{question.driver}": integer}}}}

Notes:
- The overall "score" should be the average of the four subscores (0-100).
- If you provide both "score" and "subscores", ensure "score" equals the mean of subscores.
- Do not include any text outside the JSON object.
"""

            try:
                ai_raw = await self._call_ai_robust(
                    prompt,
                    "You are a professional assessment auditor. Score answers on a 0-100 scale."
                )
                if ai_raw:
                    clean_json = ai_raw.replace('```json', '').replace('```', '').strip()
                    eval_data = json.loads(clean_json)
                    score_val = self._normalize_evaluation_score(eval_data.get("score", 0))

                    evaluation_result["score"] = score_val
                    evaluation_result["reasoning"] = eval_data.get("reasoning", "No reasoning provided.")
                    evaluation_result["driver_scores"] = eval_data.get("driver_scores", {question.driver: score_val})
                    evaluation_result["rubric_type"] = "ai_standard"
                    if question.category == "skill":
                        evaluation_result["skill_name"] = getattr(question, "skill_name", None)
                        evaluation_result["skill_type"] = getattr(question, "skill_type", None)
                        # Include template metadata for auditing
                        evaluation_result["template_id"] = getattr(question, "template_id", None)
                        evaluation_result["slots"] = getattr(question, "slots", {})

                    if score_val <= 10:
                        logger.debug(
                            "Low AI evaluation score",
                            extra={
                                "question_id": question_id,
                                "category": question.category,
                                "raw_response": ai_raw,
                                "normalized_score": score_val
                            }
                        )
            except Exception as e:
                logger.error(f"AI evaluation failed for question {question_id}: {str(e)}")
                evaluation_result = self._fallback_evaluation(answer, question.driver if question else "none")
        elif is_skipped:
            evaluation_result["score"] = 0
            evaluation_result["reasoning"] = f"Candidate skipped a {question.difficulty if question else 'medium'} question. Penalty applied."
            evaluation_result["driver_scores"] = {question.driver if question else "none": 0, "grit": -skip_penalty}
            evaluation_result["subscores"] = {"relevance": 0, "evidence": 0, "ownership": 0, "clarity": 0}
        
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
        
        # Auto-complete session after the last planned question has been answered.
        # current_step starts at 1, so completion should happen only after it advances past the budget.
        if session.current_step > session.total_budget:
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
                    profile.final_profile_score = int(avg_score)
                    profile.assessment_status = "completed"
                    if avg_score >= 90:
                        profile.profile_strength = "Elite"
                    elif avg_score >= 75:
                        profile.profile_strength = "Strong"
                    elif avg_score >= 50:
                        profile.profile_strength = "Moderate"
                    else:
                        profile.profile_strength = "Low"

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
