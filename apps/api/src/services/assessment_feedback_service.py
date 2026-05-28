"""
Assessment Feedback & Retake Management Service
Provides detailed feedback, improvement recommendations, and retake eligibility tracking
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Any

import httpx
from sqlalchemy.orm import Session
from sqlalchemy import func
from src.core.models import (
    CandidateProfile, AssessmentSession, AssessmentResponse, 
    ProfileScore, AssessmentFeedback, AssessmentRetakeEligibility
)
from src.core.database import SessionLocal
from src.core.config import OPENAI_API_KEY


logger = logging.getLogger(__name__)


class AssessmentFeedbackService:
    """Provides comprehensive feedback and recommendations for assessment scores"""

    def __init__(self):
        self.openai_key = OPENAI_API_KEY
        self._client = httpx.AsyncClient(timeout=30.0)

    async def _call_ai_robust(self, prompt: str, system_message: str = "You are a professional assessment coach.") -> Optional[str]:
        if not self.openai_key:
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
                        {"role": "user", "content": prompt},
                    ],
                    "temperature": 0.4,
                },
            )
            if response.status_code == 200:
                data = response.json()
                return data["choices"][0]["message"]["content"].strip()
            logger.error("OpenAI feedback generation failed (%s): %s", response.status_code, response.text)
        except Exception as exc:
            logger.error("OpenAI feedback generation exception: %s", exc)
        return None

    def _run_coroutine_sync(self, coroutine):
        try:
            asyncio.get_running_loop()
            return None
        except RuntimeError:
            try:
                return asyncio.run(coroutine)
            except Exception:
                return None
    
    async def generate_feedback_report_async(self, user_id: str, db: Session, session_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Generate and persist a detailed category-level feedback report.
        """
        profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == user_id).first()
        profile_score = db.query(ProfileScore).filter(ProfileScore.user_id == user_id).first()
        
        if not profile_score:
            return {"error": "No assessment completed yet"}

        profile = profile or CandidateProfile(user_id=user_id)

        latest_session = None
        if session_id:
            latest_session = db.query(AssessmentSession).filter(
                AssessmentSession.candidate_id == user_id,
                AssessmentSession.id == session_id,
                AssessmentSession.status == "completed"
            ).first()
        if not latest_session:
            latest_session = db.query(AssessmentSession).filter(
                AssessmentSession.candidate_id == user_id,
                AssessmentSession.status == "completed"
            ).order_by(AssessmentSession.completed_at.desc()).first()

        existing_feedback = None
        if latest_session:
            existing_feedback = db.query(AssessmentFeedback).filter(
                AssessmentFeedback.candidate_id == user_id,
                AssessmentFeedback.session_id == latest_session.id
            ).order_by(AssessmentFeedback.generated_at.desc()).first()
        
        final_score = profile_score.final_score or 0
        
        # Determine tier
        tier = self._get_score_tier(final_score)
        
        # Get category breakdown with insights
        category_breakdown = self._analyze_category_performance(user_id, profile_score, db)
        category_response_summary = self._build_category_response_summary(user_id, db)

        llm_feedback = await self._generate_llm_feedback_report(
            user_id=user_id,
            final_score=final_score,
            tier=tier,
            category_breakdown=category_breakdown,
            category_response_summary=category_response_summary,
            profile=profile,
            db=db,
        )
        if not llm_feedback:
            llm_feedback = self._build_fallback_feedback_report(
                user_id=user_id,
                final_score=final_score,
                tier=tier,
                category_breakdown=category_breakdown,
                profile=profile,
                db=db,
            )
        
        strengths = llm_feedback.get("strengths") or self._identify_strengths(user_id, category_breakdown, db)
        improvement_areas = llm_feedback.get("improvement_areas") or self._identify_improvements(user_id, category_breakdown, db)
        recommendations = llm_feedback.get("recommendations") or self._generate_recommendations(
            user_id,
            tier,
            improvement_areas,
            profile.years_of_experience or 0,
            db,
        )
        
        # Check retake eligibility
        retake_status = self._check_retake_eligibility(user_id, db)
        report = {
            "overall_tier": tier,
            "final_score": int(final_score),
            "score_explanation": self._get_tier_explanation(tier, final_score),
            "category_breakdown": category_breakdown,
            "strengths": strengths,
            "improvement_areas": improvement_areas,
            "recommendations": recommendations,
            "retake_eligibility": retake_status,
            "visibility_impact": self._get_visibility_impact(tier, final_score),
            "next_steps": self._get_next_steps(tier, final_score),
            "generated_at": datetime.now().isoformat(),
            "llm_feedback": llm_feedback,
        }

        if latest_session:
            if existing_feedback:
                existing_feedback.feedback_report = report
                existing_feedback.strengths = strengths
                existing_feedback.improvement_areas = improvement_areas
                existing_feedback.recommendations = recommendations
                existing_feedback.tier = tier
                existing_feedback.final_score = int(final_score)
                existing_feedback.generated_at = datetime.now()
                db.add(existing_feedback)
            else:
                db.add(AssessmentFeedback(
                    candidate_id=user_id,
                    session_id=latest_session.id,
                    feedback_report=report,
                    strengths=strengths,
                    improvement_areas=improvement_areas,
                    recommendations=recommendations,
                    tier=tier,
                    final_score=int(final_score),
                    generated_at=datetime.now(),
                ))
            db.commit()

        return report

    def generate_feedback_report(self, user_id: str, db: Session, session_id: Optional[str] = None) -> Dict[str, Any]:
        report = self._run_coroutine_sync(self.generate_feedback_report_async(user_id, db, session_id=session_id))
        if report:
            return report
        return {"error": "Failed to generate feedback report"}

    def _build_category_response_summary(self, user_id: str, db: Session) -> Dict[str, Any]:
        responses = db.query(AssessmentResponse).filter(AssessmentResponse.candidate_id == user_id).all()
        summary: Dict[str, Any] = {}

        for category in ["resume", "skill", "behavioral", "psychometric"]:
            category_responses = [r for r in responses if (r.category or "").lower() == category]
            scores = [int(r.score or 0) for r in category_responses if r.score is not None]
            low_reasonings = []
            high_reasonings = []
            for response in category_responses:
                meta = response.evaluation_metadata or {}
                reason = meta.get("reasoning") or meta.get("rationale") or ""
                if not reason:
                    continue
                if (response.score or 0) < 60 and len(low_reasonings) < 3:
                    low_reasonings.append(reason)
                elif (response.score or 0) >= 75 and len(high_reasonings) < 2:
                    high_reasonings.append(reason)

            summary[category] = {
                "response_count": len(category_responses),
                "avg_score": int(round(sum(scores) / len(scores))) if scores else None,
                "min_score": min(scores) if scores else None,
                "max_score": max(scores) if scores else None,
                "low_reasonings": low_reasonings,
                "high_reasonings": high_reasonings,
            }

        return summary

    async def _generate_llm_feedback_report(
        self,
        user_id: str,
        final_score: int,
        tier: str,
        category_breakdown: Dict[str, Any],
        category_response_summary: Dict[str, Any],
        profile: CandidateProfile,
        db: Session,
    ) -> Optional[Dict[str, Any]]:
        prompt = f"""
Create a category-level assessment feedback report for a Tech Sales candidate.

Important constraints:
- Focus on category patterns, not on individual question wording.
- Do not mention exact question text.
- Use the stored evaluation reasoning and category scores to give practical coaching.
- Make the output engaging, concise, and action-oriented.
- The retake window is 30 days, so include a useful 30-day improvement plan.

Candidate context:
- final_score: {final_score}
- tier: {tier}
- years_of_experience: {profile.years_of_experience or 0}
- current_role: {profile.current_role or "unknown"}
- target_role: {profile.target_role or "unknown"}

Category breakdown:
{json.dumps(category_breakdown, ensure_ascii=False)}

Category response summary:
{json.dumps(category_response_summary, ensure_ascii=False)}

Return VALID JSON only with this shape:
{{
  "overall_summary": "short coaching summary",
  "strengths": ["..."],
  "improvement_areas": ["..."],
  "recommendations": ["..."],
  "category_feedback": {{
    "resume": {{"summary": "...", "next_move": "...", "practice": "..."}},
    "skill": {{"summary": "...", "next_move": "...", "practice": "..."}},
    "behavioral": {{"summary": "...", "next_move": "...", "practice": "..."}},
    "psychometric": {{"summary": "...", "next_move": "...", "practice": "..."}}
  }},
  "30_day_plan": ["week 1 ...", "week 2 ...", "week 3 ...", "week 4 ..."],
  "retake_strategy": "...",
  "engagement_hook": "short motivating line"
}}
"""

        ai_out = await self._call_ai_robust(
            prompt,
            "You are an expert candidate coach. Return strict JSON only.",
        )
        if not ai_out:
            return None

        try:
            cleaned = ai_out.replace("```json", "").replace("```", "").strip()
            parsed = json.loads(cleaned)
            if isinstance(parsed, dict):
                return parsed
        except Exception as exc:
            logger.debug("Failed to parse LLM feedback JSON: %s", exc)
        return None

    def _build_fallback_feedback_report(
        self,
        user_id: str,
        final_score: int,
        tier: str,
        category_breakdown: Dict[str, Any],
        profile: CandidateProfile,
        db: Session,
    ) -> Dict[str, Any]:
        profile = profile or CandidateProfile(user_id=user_id)
        improvements = self._identify_improvements(user_id, category_breakdown, db)
        strengths = self._identify_strengths(user_id, category_breakdown, db)
        recommendations = self._generate_recommendations(
            user_id,
            tier,
            improvements,
            profile.years_of_experience or 0,
            db,
        )
        return {
            "overall_summary": self._get_tier_explanation(tier, final_score),
            "strengths": strengths,
            "improvement_areas": improvements,
            "recommendations": recommendations,
            "category_feedback": {
                "resume": {"summary": self._get_category_insight("resume", category_breakdown.get("resume", {}).get("score") or 0, category_breakdown.get("resume", {}).get("tier", tier)), "next_move": "Quantify achievements and clarify career progression.", "practice": "Rewrite 3 resume bullets with metrics."},
                "skill": {"summary": self._get_category_insight("skills", category_breakdown.get("skills", {}).get("score") or 0, category_breakdown.get("skills", {}).get("tier", tier)), "next_move": "Explain trade-offs and decision steps more clearly.", "practice": "Practice 2 scenario answers out loud."},
                "behavioral": {"summary": self._get_category_insight("behavioral", category_breakdown.get("behavioral", {}).get("score") or 0, category_breakdown.get("behavioral", {}).get("tier", tier)), "next_move": "Use STAR and show ownership.", "practice": "Draft 2 STAR stories for conflict and impact."},
                "psychometric": {"summary": self._get_category_insight("psychometric", category_breakdown.get("psychometric", {}).get("score") or 0, category_breakdown.get("psychometric", {}).get("tier", tier)), "next_move": "Show consistency in your motivations and working style.", "practice": "Write a short self-profile of strengths and work style."},
            },
            "30_day_plan": [
                "Week 1: Fix the weakest category with 3 focused drills.",
                "Week 2: Rewrite or rehearse responses using the STAR structure.",
                "Week 3: Do 2 timed practice sessions and review the reasoning.",
                "Week 4: Revisit weak areas and prepare for the retake window.",
            ],
            "retake_strategy": "Use the 30-day window to improve the lowest category first; the retake should show clearer reasoning, stronger evidence, and better ownership.",
            "engagement_hook": "Small improvements in the weakest category can move your overall score faster than trying to fix everything at once.",
        }
    
    def _get_score_tier(self, score: int) -> str:
        """Map score to tier"""
        if score >= 80:
            return "Top"
        elif score >= 70:
            return "Strong"
        elif score >= 60:
            return "Developing"
        else:
            return "Growing"
    
    def _analyze_category_performance(self, user_id: str, profile_score: ProfileScore, db: Session) -> Dict:
        """Analyze performance by category"""
        category_info = {
            "resume": {
                "score": profile_score.resume_score,
                "label": "Resume/Background",
                "description": "How well you articulate your work experience and achievements"
            },
            "skills": {
                "score": profile_score.skills_score,
                "label": "Technical Skills",
                "description": "Depth of technical knowledge and problem-solving ability"
            },
            "behavioral": {
                "score": profile_score.behavioral_score,
                "label": "Behavioral",
                "description": "How you handle situations, collaborate, and lead"
            },
            "psychometric": {
                "score": profile_score.psychometric_score,
                "label": "Personality Fit",
                "description": "Your work style, values, and team compatibility"
            }
        }
        
        breakdown = {}
        for category, info in category_info.items():
            score = info["score"] or 0
            tier = self._get_score_tier(score)
            
            breakdown[category] = {
                "score": int(score) if score else None,
                "tier": tier,
                "label": info["label"],
                "description": info["description"],
                "insight": self._get_category_insight(category, score, tier),
                "comparison": self._get_comparison_message(category, score, user_id, db)
            }
        
        return breakdown
    
    def _get_category_insight(self, category: str, score: int, tier: str) -> str:
        """Generate category-specific insight"""
        if score is None:
            return f"No {category} score yet"
        
        insights = {
            "resume": {
                "Top": "Excellent at articulating achievements with specific metrics and impact",
                "Strong": "Good communication of work experience with meaningful details",
                "Developing": "Try including more specific examples and measurable outcomes",
                "Growing": "Focus on quantifiable achievements and clear career progression"
            },
            "skills": {
                "Top": "Demonstrates advanced technical thinking with architectural understanding",
                "Strong": "Good technical knowledge with practical problem-solving ability",
                "Developing": "Consider showing more depth in technical solutions and trade-offs",
                "Growing": "Work on explaining technical approaches and their implications"
            },
            "behavioral": {
                "Top": "Excellent interpersonal skills and leadership demonstrated in examples",
                "Strong": "Good collaboration and problem-solving in team situations",
                "Developing": "Share more examples of handling challenges and team dynamics",
                "Growing": "Practice thinking through behavioral situations using STAR framework"
            },
            "psychometric": {
                "Top": "Excellent self-awareness and cultural fit alignment",
                "Strong": "Good work style clarity and values alignment",
                "Developing": "Reflect more on your work style preferences and strengths",
                "Growing": "Focus on understanding your natural working style and strengths"
            }
        }
        
        return insights.get(category, {}).get(tier, "Continue improving in this area")
    
    def _get_comparison_message(self, category: str, score: int, user_id: str, db: Session) -> Optional[str]:
        """Get peer comparison message (anonymized)"""
        if score is None:
            return None
        
        # Get percentile for this category (without revealing other candidates)
        similar_scores = db.query(ProfileScore).filter(
            ProfileScore.user_id != user_id
            # Only compare with similar experience level for fairness
        ).count()
        
        if similar_scores == 0:
            return None
        
        # Simple percentile calculation
        better_than = db.query(ProfileScore).filter(
            getattr(ProfileScore, f"{category}_score") > score,
            ProfileScore.user_id != user_id
        ).count()
        
        percentile = int(100 * (1 - better_than / similar_scores)) if similar_scores > 0 else 50
        
        if percentile >= 80:
            return f"Top {100-percentile}% in {category}"
        elif percentile >= 60:
            return f"Above average in {category}"
        elif percentile >= 40:
            return f"At par with peers in {category}"
        else:
            return f"Below average in {category} - opportunity to improve"
    
    def _identify_strengths(self, user_id: str, category_breakdown: Dict, db: Session) -> List[str]:
        """Identify top strengths based on performance"""
        strengths = []
        
        for category, data in category_breakdown.items():
            if data["score"] and data["score"] >= 75:
                strengths.append(f"Strong {data['label']} communication")
        
        # Add response analysis
        responses = db.query(AssessmentResponse).filter(
            AssessmentResponse.candidate_id == user_id,
            AssessmentResponse.score >= 80
        ).all()
        
        if responses:
            if len(responses) >= 3:
                strengths.append("Consistent high-quality responses")
            strengths.append(f"Strong performance on {responses[0].category} questions")
        
        # If no numerical strengths, look at patterns
        if not strengths:
            avg_score = sum([data["score"] or 0 for data in category_breakdown.values()]) / len(category_breakdown)
            if avg_score >= 60:
                strengths.append("Solid foundational assessment performance")
        
        return strengths[:3]  # Top 3 strengths
    
    def _identify_improvements(self, user_id: str, category_breakdown: Dict, db: Session) -> List[str]:
        """Identify areas for improvement"""
        improvements = []
        
        # Find lowest scoring categories
        sorted_categories = sorted(
            category_breakdown.items(), 
            key=lambda x: x[1]["score"] or 0
        )
        
        for category, data in sorted_categories[:2]:  # Top 2 improvement areas
            if data["score"] and data["score"] < 70:
                improvements.append(f"{data['label']}: Currently at {data['score']}. Target 75+")
        
        # Find common weak answers
        weak_responses = db.query(AssessmentResponse).filter(
            AssessmentResponse.candidate_id == user_id,
            AssessmentResponse.score < 60
        ).all()
        
        if weak_responses:
            most_common_driver = max(
                set([r.driver for r in weak_responses]),
                key=lambda x: [r.driver for r in weak_responses].count(x)
            )
            improvements.append(f"Focus on {most_common_driver} - multiple lower scores here")
        
        return improvements[:3]  # Top 3 improvement areas
    
    def _generate_recommendations(
        self, 
        user_id: str, 
        tier: str, 
        improvement_areas: List[str],
        years_of_experience: int,
        db: Session
    ) -> List[str]:
        """Generate personalized recommendations"""
        recommendations = []
        
        # Tier-based recommendations
        tier_recs = {
            "Top": [
                "Maintain this high standard - you're a top candidate",
                "Consider mentoring others in your strong areas",
                "Share your assessment insights in interviews"
            ],
            "Strong": [
                "You're competitive - focus on the improvement areas to reach 'Top' tier",
                "One area at 75+ will significantly boost your visibility",
                "Practice STAR format for behavioral questions to gain 5-10 points"
            ],
            "Developing": [
                "You need to reach 70+ to unlock 'Strong' tier visibility",
                "Focus on adding specific metrics and examples to your answers",
                "Re-take after 30 days - the practice will help significantly"
            ],
            "Growing": [
                "Assess score under 60 limits visibility - focus on reaching 70+",
                "Use your retake opportunity to practice and improve",
                "Work on structuring answers with clear Situation, Task, Action, Result"
            ]
        }
        
        recommendations.extend(tier_recs.get(tier, []))
        
        # Experience-based recommendations
        if years_of_experience <= 2:
            recommendations.append("As a fresher, focus on behavioral and psychometric fit - these carry 70% weight")
        elif years_of_experience <= 5:
            recommendations.append("For mid-level, technical depth (30% weight) is increasingly important - show advanced problem-solving")
        else:
            recommendations.append("As a senior/leader, architectural thinking and strategic impact matter most - emphasize systems-level improvements")
        
        # Add specific improvement recommendations
        if improvement_areas:
            recommendations.append(f"Priority: Improve '{improvement_areas[0]}' - this will have the biggest impact on your score")
        
        return recommendations
    
    def _check_retake_eligibility(self, user_id: str, db: Session) -> Dict[str, Any]:
        """Check if candidate is eligible to retake assessment"""
        
        # Get most recent session
        session = db.query(AssessmentSession).filter(
            AssessmentSession.candidate_id == user_id,
            AssessmentSession.status == "completed"
        ).order_by(AssessmentSession.completed_at.desc()).first()
        
        if not session or not session.completed_at:
            return {
                "eligible": True,
                "reason": "You haven't completed an assessment yet",
                "retake_type": "initial"
            }
        
        # Check for existing retake eligibility record
        retake_record = db.query(AssessmentRetakeEligibility).filter(
            AssessmentRetakeEligibility.candidate_id == user_id
        ).first()
        
        if not retake_record:
            # Create eligibility record
            eligible_after = session.completed_at + timedelta(days=30)
            retake_record = AssessmentRetakeEligibility(
                candidate_id=user_id,
                last_completed_at=session.completed_at,
                eligible_after=eligible_after,
                retake_count=0
            )
            db.add(retake_record)
            db.commit()
            db.refresh(retake_record)
        
        now = datetime.now(timezone.utc)
        eligible_after = retake_record.eligible_after
        if eligible_after and eligible_after.tzinfo is None:
            eligible_after = eligible_after.replace(tzinfo=timezone.utc)

        eligible = now >= eligible_after
        days_remaining = (eligible_after - now).days if not eligible else 0
        
        return {
            "eligible": eligible,
            "eligible_after": eligible_after.isoformat(),
            "days_remaining": max(0, days_remaining),
            "retake_count": retake_record.retake_count,
            "reason": "Ready to retake!" if eligible else f"You can retake in {days_remaining} days"
        }
    
    def _get_tier_explanation(self, tier: str, score: int) -> str:
        """Get explanation of what the tier means"""
        explanations = {
            "Top": f"Excellent! Your score of {score} is in the top tier. You'll receive priority visibility from recruiters and a +5 bonus in recommendation rankings.",
            "Strong": f"Great! Your score of {score} shows solid competency. You'll receive good visibility and competitive opportunities match recommendations.",
            "Developing": f"Your score of {score} shows promise but needs refinement. Improving to 70+ will significantly boost your visibility and opportunities.",
            "Growing": f"Your score of {score} indicates a good start. Focus on reaching 60+ to unlock full visibility and take advantage of retake opportunities after 30 days."
        }
        return explanations.get(tier, "Assessment completed")
    
    def _get_visibility_impact(self, tier: str, score: int) -> str:
        """Explain what visibility tier means for opportunities"""
        impacts = {
            "Top": f"You'll appear in 'Top Talent' recommendations and get +5 bonus in recruiter matches. Maximum visibility.",
            "Strong": f"You'll appear in standard recruiter searches and recommendations. High visibility for relevant roles.",
            "Developing": f"You'll appear in searches but with limited reach. Improve to 70+ to increase visibility.",
            "Growing": f"Very limited visibility currently. Reach 60+ to unlock full candidate visibility."
        }
        return impacts.get(tier, "Standard visibility")
    
    def _get_next_steps(self, tier: str, score: int) -> List[str]:
        """Get personalized next steps"""
        steps = []
        
        if tier == "Top":
            steps = [
                "Complete your profile fully to enhance recruiter interest",
                "Apply to roles that align with your 'Top' tier positioning",
                "Update your availability and salary expectations"
            ]
        elif tier == "Strong":
            steps = [
                "Aim for one category to reach 80+ to move to 'Top' tier",
                "Complete your profile - it multiplies the value of a strong score",
                "Apply to competitive roles matching your expertise"
            ]
        elif tier == "Developing":
            steps = [
                "Reach 70+ by your retake opportunity to unlock better visibility",
                "Review the improvement recommendations above",
                "Apply to growing/junior focused opportunities while improving"
            ]
        else:  # Growing
            steps = [
                "Plan your retake in 30 days - it's crucial for visibility",
                "Review STAR framework guide and retake tips for each category",
                "Complete your profile to build other trust signals",
                "Apply selectively to opportunities that match experience level"
            ]
        
        if score < 70:
            steps.append(f"Remember: You can retake in 30 days to improve from {score} to your target")
        
        return steps


class AssessmentRetakeManager:
    """Manages assessment retake eligibility and history"""
    
    def allow_retake(self, user_id: str, db: Session) -> tuple[bool, str]:
        """
        Check if candidate can retake assessment
        Returns: (allowed: bool, message: str)
        """
        retake_record = db.query(AssessmentRetakeEligibility).filter(
            AssessmentRetakeEligibility.candidate_id == user_id
        ).first()
        
        if not retake_record:
            return True, "Eligible for first retake"
        
        now = datetime.now()
        if now >= retake_record.eligible_after:
            return True, f"Eligible for retake #{retake_record.retake_count + 1}"
        else:
            days_left = (retake_record.eligible_after - now).days
            return False, f"Can retake in {days_left} days"
    
    def start_retake_session(self, user_id: str, db: Session) -> Optional[str]:
        """
        Start a new retake session. Returns session_id or error message
        """
        allowed, message = self.allow_retake(user_id, db)
        
        if not allowed:
            return None
        
        # Create new assessment session
        retake_record = db.query(AssessmentRetakeEligibility).filter(
            AssessmentRetakeEligibility.candidate_id == user_id
        ).first()
        
        # Create session (handled by AssessmentService.get_or_create_session)
        # But mark it as a retake
        if retake_record:
            retake_record.retake_count += 1
            retake_record.last_completed_at = datetime.now()
            retake_record.eligible_after = datetime.now() + timedelta(days=30)
            db.commit()
        
        return "retake_session_created"
    
    def get_retake_progress(self, user_id: str, db: Session) -> Dict[str, Any]:
        """Get candidate's retake history and progress"""
        sessions = db.query(AssessmentSession).filter(
            AssessmentSession.candidate_id == user_id,
            AssessmentSession.status == "completed"
        ).order_by(AssessmentSession.completed_at.desc()).all()
        
        retake_record = db.query(AssessmentRetakeEligibility).filter(
            AssessmentRetakeEligibility.candidate_id == user_id
        ).first()
        
        score_history = []
        for i, session in enumerate(sessions):
            profile_score = db.query(ProfileScore).filter(
                ProfileScore.user_id == user_id
            ).order_by(ProfileScore.calculated_at.desc()).offset(i).first()
            
            if profile_score:
                score_history.append({
                    "attempt": i + 1,
                    "score": profile_score.final_score,
                    "completed_at": session.completed_at.isoformat() if session.completed_at else None,
                    "category_breakdown": {
                        "resume": profile_score.resume_score,
                        "skills": profile_score.skills_score,
                        "behavioral": profile_score.behavioral_score,
                        "psychometric": profile_score.psychometric_score
                    }
                })
        
        return {
            "total_attempts": len(sessions),
            "score_history": score_history,
            "improvement": None if len(score_history) < 2 else (
                score_history[0]["score"] - score_history[-1]["score"]
            ),
            "retake_eligibility": retake_record.eligible_after.isoformat() if retake_record else None
        }


assessment_feedback_service = AssessmentFeedbackService()
assessment_retake_manager = AssessmentRetakeManager()
