"""
Assessment Feedback & Retake API Routes
Endpoints for candidates to view feedback, recommendations, and manage retakes
"""

from fastapi import APIRouter, Depends, HTTPException, status
from datetime import datetime
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session
from src.core.database import get_db
from src.core.dependencies import get_current_user
from src.services.assessment_feedback_service import AssessmentFeedbackService, AssessmentRetakeManager
from src.services.assessment_service import AssessmentService
from src.core.models import AssessmentSession

router = APIRouter(prefix="/assessment", tags=["Assessment Feedback & Retake"])

feedback_service = AssessmentFeedbackService()
retake_manager = AssessmentRetakeManager()
assessment_service = AssessmentService()


def _build_offline_feedback_report(user_id: str) -> dict:
    return {
        "overall_tier": "Unknown",
        "final_score": None,
        "score_explanation": "Your latest feedback is temporarily unavailable because the database could not be reached.",
        "category_breakdown": {
            "resume": {"score": None, "tier": "Unknown", "label": "Resume/Background", "description": "Unavailable right now", "insight": "Unavailable right now", "comparison": None},
            "skills": {"score": None, "tier": "Unknown", "label": "Technical Skills", "description": "Unavailable right now", "insight": "Unavailable right now", "comparison": None},
            "behavioral": {"score": None, "tier": "Unknown", "label": "Behavioral", "description": "Unavailable right now", "insight": "Unavailable right now", "comparison": None},
            "psychometric": {"score": None, "tier": "Unknown", "label": "Personality Fit", "description": "Unavailable right now", "insight": "Unavailable right now", "comparison": None},
        },
        "strengths": ["Feedback is temporarily unavailable due to a database connection issue."],
        "improvement_areas": ["Please try again shortly once the backend database connection recovers."],
        "recommendations": [
            "Refresh the page and try again in a moment.",
            "If the issue persists, complete another assessment attempt after the backend connection is restored.",
            "Use the next 30 days to review your strongest and weakest areas from your previous attempt."
        ],
        "retake_eligibility": {
            "eligible": False,
            "reason": "Feedback is temporarily unavailable",
            "retake_type": "offline-fallback",
            "days_remaining": None,
            "eligible_after": None,
            "retake_count": None,
        },
        "visibility_impact": "Temporary fallback response while the database is unavailable.",
        "next_steps": [
            "Retry in a few minutes.",
            "Check that the backend database connection has recovered.",
            "If you need immediate guidance, review your last saved feedback or assessment notes."
        ],
        "generated_at": datetime.now().isoformat(),
        "llm_feedback": {
            "overall_summary": "We couldn't load your latest personalized feedback right now.",
            "30_day_plan": [
                "Week 1: Review your previous assessment notes.",
                "Week 2: Rewrite or rehearse your weakest answers.",
                "Week 3: Practice under time pressure.",
                "Week 4: Retake the assessment once the backend is healthy.",
            ],
            "retake_strategy": "Try again after the database connection is restored so personalized feedback can be generated.",
            "engagement_hook": "Your improvement path is still there; this is just a temporary loading issue.",
        },
        "fallback": True,
        "user_id": user_id,
    }


@router.get("/feedback", summary="Get assessment feedback and recommendations")
async def get_assessment_feedback(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get comprehensive feedback report for assessment performance
    
    Returns:
    - Overall tier and score
    - Category breakdown with insights
    - Strengths and improvement areas
    - Personalized recommendations
    - Retake eligibility status
    - Next steps for career progression
    """
    try:
        user_id = str(current_user["sub"])
        report = await feedback_service.generate_feedback_report_async(user_id, db)

        if "error" in report:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=report["error"]
            )

        return {
            "status": "success",
            "data": report
        }

    except OperationalError as oe:
        # Database connectivity issues - return a safe fallback payload so the UI can still render
        return {
            "status": "success",
            "data": _build_offline_feedback_report(str(current_user["sub"])),
            "warning": "Database connection error while generating feedback. Showing a fallback report.",
        }
    except Exception as e:
        return {
            "status": "success",
            "data": _build_offline_feedback_report(str(current_user["sub"])),
            "warning": f"Failed to generate personalized feedback. Showing a fallback report: {str(e)}",
        }


@router.post("/feedback/generate", summary="Generate or refresh assessment feedback")
async def generate_assessment_feedback(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Force a fresh LLM-backed feedback report and persist it in assessment_feedback.
    """
    try:
        user_id = str(current_user["sub"])
        report = await feedback_service.generate_feedback_report_async(user_id, db)
        if "error" in report:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=report["error"]
            )

        return {
            "status": "success",
            "data": report
        }
    except OperationalError:
        return {
            "status": "success",
            "data": _build_offline_feedback_report(str(current_user["sub"])),
            "warning": "Database connection error while generating feedback. Showing a fallback report.",
        }
    except HTTPException:
        raise
    except Exception as e:
        return {
            "status": "success",
            "data": _build_offline_feedback_report(str(current_user["sub"])),
            "warning": f"Failed to generate personalized feedback. Showing a fallback report: {str(e)}",
        }


@router.get("/retake/eligibility", summary="Check if candidate can retake assessment")
async def check_retake_eligibility(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Check current retake eligibility status
    
    Returns:
    - Whether candidate can retake now
    - Days until eligible (if not eligible now)
    - Retake count
    - Message explaining status
    """
    try:
        user_id = str(current_user["sub"])
        allowed, message = retake_manager.allow_retake(user_id, db)
        
        return {
            "status": "success",
            "data": {
                "eligible": allowed,
                "message": message,
                "can_retake_now": allowed
            }
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error checking retake eligibility: {str(e)}"
        )


@router.post("/retake/start", summary="Start a new assessment retake")
async def start_retake(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Start a new assessment retake if eligible
    
    Rules:
    - Must wait 30 days after previous completion
    - Creates new assessment session
    - Previous attempts are preserved for progress comparison
    """
    try:
        user_id = str(current_user["sub"])
        allowed, message = retake_manager.allow_retake(user_id, db)
        
        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=message
            )
        
        # Update retake eligibility
        retake_manager.start_retake_session(user_id, db)
        
        # Create new assessment session (resets questions, keeps history)
        session = assessment_service.get_or_create_session(user_id, db)
        
        # Reset session for new attempt
        session.current_step = 0
        session.status = "started"
        session.overall_score = None
        db.commit()
        
        return {
            "status": "success",
            "message": "Retake started successfully",
            "session": {
                "id": str(session.id),
                "experience_band": session.experience_band,
                "total_budget": session.total_budget,
                "current_step": session.current_step
            }
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start retake: {str(e)}"
        )


@router.get("/retake/progress", summary="Get retake history and improvement tracking")
async def get_retake_progress(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get complete retake history showing score progression
    
    Returns:
    - Number of attempts
    - Score history for each attempt
    - Category breakdown for each attempt
    - Overall improvement trend
    - Next retake eligibility date
    """
    try:
        user_id = str(current_user["sub"])
        progress = retake_manager.get_retake_progress(user_id, db)
        
        return {
            "status": "success",
            "data": progress
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get retake progress: {str(e)}"
        )


@router.post("/feedback/mark-viewed", summary="Mark feedback as viewed by candidate")
async def mark_feedback_viewed(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Track when candidate views their feedback (for engagement analytics)
    """
    try:
        from src.core.models import AssessmentFeedback
        from datetime import datetime
        
        user_id = str(current_user["sub"])
        feedback = db.query(AssessmentFeedback).filter(
            AssessmentFeedback.candidate_id == user_id
        ).order_by(AssessmentFeedback.generated_at.desc()).first()
        
        if feedback:
            feedback.viewed_at = datetime.now()
            db.commit()
        
        return {
            "status": "success",
            "message": "Feedback view recorded"
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to record feedback view: {str(e)}"
        )


@router.get("/tips/{category}", summary="Get study tips for specific assessment category")
async def get_study_tips(category: str):
    """
    Get detailed tips for preparing/improving in specific assessment category
    
    Categories: resume, skills, behavioral, psychometric
    """
    
    tips = {
        "resume": {
            "description": "Resume & Background Questions",
            "time_estimate": "5-10 minutes per question",
            "tips": [
                "Include specific metrics (numbers, percentages, time saved, revenue impact)",
                "Use STAR framework: Situation → Task → Action → Result",
                "Quantify achievements: Sales revenue, user growth, cost savings, speed improvements",
                "Show career progression and skill development over time",
                "Explain career gaps with positive context (learning, growth, transitions)"
            ],
            "examples": {
                "weak": "I worked on a project that improved performance",
                "strong": "I identified database bottlenecks (3s → 200ms response time), gaining 40% server load reduction and saving $50K annually. The team adopted this as standard practice."
            },
            "practice": [
                "List your top 5 achievements with metrics",
                "Practice explaining career timeline in 2-3 minutes",
                "Prepare gap explanations if any",
                "Time yourself - clarity matters more than length"
            ]
        },
        
        "skills": {
            "description": "Technical Skills & Case Study Questions",
            "time_estimate": "8-12 minutes per question",
            "tips": [
                "Show architectural/systems thinking, not just syntax knowledge",
                "Discuss trade-offs: performance vs complexity, cost vs speed",
                "Mention scalability, security, and production considerations",
                "Give concrete examples from your experience",
                "Acknowledge multiple valid approaches and explain your choice"
            ],
            "examples": {
                "weak": "I would use a database to store the data",
                "strong": "I'd implement a normalized schema with indexes. For millions of records, I'd use sharding by region for parallel scaling. Add Redis caching for hot data (~50ms queries). Trade-off: complexity vs linear scalability."
            },
            "practice": [
                "Solve 2-3 system design problems step-by-step",
                "Practice explaining your technical decisions",
                "Discuss trade-offs for each solution",
                "Think about production concerns: monitoring, failover, security"
            ]
        },
        
        "behavioral": {
            "description": "Behavioral & Leadership Questions",
            "time_estimate": "4-8 minutes per question",
            "tips": [
                "Use STAR Framework explicitly: Situation, Task, Action, Result",
                "Show self-awareness and growth mindset",
                "Highlight impact on team/organization with metrics",
                "Demonstrate decision-making and problem-solving",
                "Share what you learned and how you applied it",
                "Be authentic and specific"
            ],
            "examples": {
                "weak": "I worked in a team and we solved the problem together",
                "strong": "Situation: Team missed a release due to poor architecture. Task: Fix it in 2 weeks while maintaining releases. Action: Proposed modular approach, got buy-in with data, led implementation, mentored juniors. Result: Shipped in 1.5 weeks, improved deployment speed 3x, team adopted approach."
            },
            "practice": [
                "Prepare 5-7 strong STAR stories from your experience",
                "Practice with common questions: failure, conflict, leadership, learning",
                "Time yourself - 2-3 minutes per story",
                "Get feedback from a mentor"
            ]
        },
        
        "psychometric": {
            "description": "Personality & Work Style Fit",
            "time_estimate": "3-5 minutes per question",
            "tips": [
                "Be authentic - there are no 'wrong' answers",
                "Show self-awareness about your strengths AND limitations",
                "Give specific examples proving your traits",
                "Demonstrate adaptability and growth",
                "Explain why this trait is valuable",
                "Connect to real outcomes"
            ],
            "examples": {
                "weak": "I like working in teams",
                "strong": "I'm collaborative (led 3 cross-team projects → $2M revenue). I also work autonomously (solo deployed ML model). I'm strong in knowing when to collaborate (problem-solving) vs solo (deep work). This balance makes me trusted for ownership and valued in teams."
            },
            "practice": [
                "Reflect on your work style - what energizes you?",
                "Identify 3-5 core traits defining your working style",
                "For each, prepare a specific example with outcomes",
                "Practice explaining your authentic self"
            ]
        }
    }
    
    category_lower = category.lower()
    if category_lower not in tips:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Unknown category: {category}. Valid: resume, skills, behavioral, psychometric"
        )
    
    return {
        "status": "success",
        "category": category_lower,
        "data": tips[category_lower]
    }
