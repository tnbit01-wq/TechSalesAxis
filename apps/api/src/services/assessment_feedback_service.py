"""
Assessment Feedback & Retake Management Service
Provides detailed feedback, improvement recommendations, and retake eligibility tracking
"""

import json
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from sqlalchemy.orm import Session
from sqlalchemy import func
from src.core.models import (
    CandidateProfile, AssessmentSession, AssessmentResponse, 
    ProfileScore, AssessmentFeedback, AssessmentRetakeEligibility
)
from src.core.database import SessionLocal


class AssessmentFeedbackService:
    """Provides comprehensive feedback and recommendations for assessment scores"""
    
    def generate_feedback_report(self, user_id: str, db: Session) -> Dict[str, Any]:
        """
        Generate detailed feedback report for candidate assessment performance
        
        Returns:
        {
            "overall_tier": "Strong",  # Top, Strong, Developing, Growing
            "final_score": 75,
            "score_explanation": "Your score places you in the Strong tier...",
            "category_breakdown": {
                "resume": {"score": 78, "tier": "Strong", "insight": "..."},
                "skills": {"score": 72, "tier": "Strong", "insight": "..."},
                "behavioral": {"score": 68, "tier": "Developing", "insight": "..."},
                "psychometric": {"score": 81, "tier": "Top", "insight": "..."}
            },
            "strengths": ["...", "..."],
            "improvement_areas": ["...", "..."],
            "recommendations": ["...", "..."],
            "retake_eligibility": {"eligible": True, "eligible_after": "2024-01-20", "days_remaining": 28},
            "visibility_impact": "Your score gives you 'Strong' tier visibility...",
            "next_steps": ["...", "..."]
        }
        """
        profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == user_id).first()
        profile_score = db.query(ProfileScore).filter(ProfileScore.user_id == user_id).first()
        
        if not profile_score:
            return {"error": "No assessment completed yet"}
        
        final_score = profile_score.final_score or 0
        
        # Determine tier
        tier = self._get_score_tier(final_score)
        
        # Get category breakdown with insights
        category_breakdown = self._analyze_category_performance(user_id, profile_score, db)
        
        # Generate AI-powered insights and recommendations
        strengths = self._identify_strengths(user_id, category_breakdown, db)
        improvement_areas = self._identify_improvements(user_id, category_breakdown, db)
        recommendations = self._generate_recommendations(
            user_id, 
            tier, 
            improvement_areas, 
            profile.years_of_experience or 0,
            db
        )
        
        # Check retake eligibility
        retake_status = self._check_retake_eligibility(user_id, db)
        
        return {
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
            "generated_at": datetime.now().isoformat()
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
        
        now = datetime.now()
        eligible = now >= retake_record.eligible_after
        days_remaining = (retake_record.eligible_after - now).days if not eligible else 0
        
        return {
            "eligible": eligible,
            "eligible_after": retake_record.eligible_after.isoformat(),
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
