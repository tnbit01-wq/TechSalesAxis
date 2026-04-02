"""API endpoints for profile matches (company culture fit recommendations)."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from uuid import UUID
from src.core.database import get_db
from src.core.auth import get_current_user
from src.services.profile_matches_service import ProfileMatchesService

router = APIRouter(prefix="/recommendations", tags=["recommendations"])


@router.get("/companies")
def get_company_recommendations(
    limit: int = Query(10, ge=1, le=50),
    offset: int = Query(0, ge=0),
    min_score: float = Query(50, ge=0, le=100),
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get company culture fit recommendations for the authenticated candidate.
    
    Calculates match scores based on:
    - Industry alignment (30 pts)
    - Company size fit (20 pts)
    - Location match (20 pts)
    - Company growth (15 pts)
    - Culture factors (15 pts)
    
    Returns top matches with explanations and improvement areas.
    """
    try:
        candidate_id = UUID(user.get("sub"))
        
        print(f"[API] Getting company recommendations")
        print(f"[API] Candidate: {candidate_id}")
        print(f"[API] Limit: {limit}, Offset: {offset}, Min Score: {min_score}")
        
        result = ProfileMatchesService.get_company_matches(
            db=db,
            candidate_id=candidate_id,
            limit=limit,
            offset=offset,
            min_score=min_score
        )
        
        print(f"[API] ✓ Found {result['count']} matches")
        return result
    
    except Exception as e:
        print(f"[API] ✗ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/companies/{company_id}/match-details")
def get_company_match_details(
    company_id: UUID,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get detailed match breakdown for a specific company.
    
    Returns:
    - Overall match score
    - Individual component scores
    - Strength areas
    - Improvement areas
    - Candidate vs company comparison
    """
    try:
        candidate_id = UUID(user.get("sub"))
        
        print(f"[API] Getting match details")
        print(f"[API] Candidate: {candidate_id}")
        print(f"[API] Company: {company_id}")
        
        result = ProfileMatchesService.get_company_match_details(
            db=db,
            candidate_id=candidate_id,
            company_id=company_id
        )
        
        if "error" in result:
            raise HTTPException(status_code=404, detail=result["error"])
        
        print(f"[API] ✓ Match score: {result.get('match_score')}%")
        return result
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"[API] ✗ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/companies/summary")
def get_company_recommendations_summary(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get a summary of company recommendations for dashboard display.
    
    Returns:
    - Total number of potential matches
    - Top 3 recommendations
    - Count by match tier (excellent, strong, good, potential)
    """
    try:
        candidate_id = UUID(user.get("sub"))
        
        print(f"[API] Getting company recommendations summary")
        print(f"[API] Candidate: {candidate_id}")
        
        # Get recommendations with different score thresholds
        all_matches = ProfileMatchesService.get_company_matches(
            db=db,
            candidate_id=candidate_id,
            limit=100,
            offset=0,
            min_score=50.0
        )
        
        # Categorize by score
        excellent = [m for m in all_matches["matches"] if m["match_score"] >= 85]
        strong = [m for m in all_matches["matches"] if 70 <= m["match_score"] < 85]
        good = [m for m in all_matches["matches"] if 60 <= m["match_score"] < 70]
        potential = [m for m in all_matches["matches"] if 50 <= m["match_score"] < 60]
        
        # Get top 3
        top_3 = all_matches["matches"][:3]
        
        return {
            "status": "success",
            "summary": {
                "excellent_matches": len(excellent),
                "strong_matches": len(strong),
                "good_matches": len(good),
                "potential_matches": len(potential),
                "total_matches": len(all_matches["matches"])
            },
            "top_recommendations": top_3
        }
    
    except Exception as e:
        print(f"[API] ✗ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
