"""
Assessment Feedback & Retake API Routes
Endpoints for candidates to view feedback, recommendations, and manage retakes
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from src.core.database import get_db
from src.core.auth import get_current_user
from src.services.assessment_feedback_service import AssessmentFeedbackService, AssessmentRetakeManager
from src.services.assessment_service import AssessmentService
from src.core.models import User, AssessmentSession

router = APIRouter(prefix="/assessment", tags=["Assessment Feedback & Retake"])

feedback_service = AssessmentFeedbackService()
retake_manager = AssessmentRetakeManager()
assessment_service = AssessmentService()


@router.get("/feedback", summary="Get assessment feedback and recommendations")
async def get_assessment_feedback(
    current_user: User = Depends(get_current_user),
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
        report = feedback_service.generate_feedback_report(str(current_user.id), db)
        
        if "error" in report:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=report["error"]
            )
        
        return {
            "status": "success",
            "data": report
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate feedback: {str(e)}"
        )


@router.get("/retake/eligibility", summary="Check if candidate can retake assessment")
async def check_retake_eligibility(
    current_user: User = Depends(get_current_user),
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
        allowed, message = retake_manager.allow_retake(str(current_user.id), db)
        
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
    current_user: User = Depends(get_current_user),
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
        allowed, message = retake_manager.allow_retake(str(current_user.id), db)
        
        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=message
            )
        
        # Update retake eligibility
        retake_manager.start_retake_session(str(current_user.id), db)
        
        # Create new assessment session (resets questions, keeps history)
        session = assessment_service.get_or_create_session(str(current_user.id), db)
        
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
    current_user: User = Depends(get_current_user),
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
        progress = retake_manager.get_retake_progress(str(current_user.id), db)
        
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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Track when candidate views their feedback (for engagement analytics)
    """
    try:
        from src.core.models import AssessmentFeedback
        from datetime import datetime
        
        feedback = db.query(AssessmentFeedback).filter(
            AssessmentFeedback.candidate_id == current_user.id
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
