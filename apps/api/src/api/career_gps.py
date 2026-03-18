from fastapi import APIRouter, Depends, HTTPException
from src.core.dependencies import get_current_user
from src.core.database import get_db
from sqlalchemy.orm import Session
from src.core.models import CareerGPS, CareerMilestone
from pydantic import BaseModel
from src.services.career_gps_service import CareerGPSService
from src.services.notification_service import NotificationService
from typing import List, Optional, Union

router = APIRouter(prefix="/candidate/career-gps", tags=["career_gps"])

class GPSInput(BaseModel):
    target_role: str
    career_interests: Union[str, List[str]]
    long_term_goal: str
    learning_interests: Optional[str] = None

class MilestoneUpdate(BaseModel):
    status: str

@router.get("/")
def get_gps_path(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    user_id = user["sub"]
    try:
        # Fetch GPS parent and milestones
        gps = db.query(CareerGPS).filter(CareerGPS.candidate_id == user_id).first()
        
        if not gps:
            return {"status": "no_gps_found"}
            
        milestones = db.query(CareerMilestone)\
            .filter(CareerMilestone.gps_id == gps.id)\
            .order_by(CareerMilestone.step_order.asc())\
            .all()
        
        return {
            "status": "active",
            "gps": {
                "id": str(gps.id),
                "candidate_id": str(gps.candidate_id),
                "target_role": gps.target_role,
                "current_status": gps.current_status
            },
            "milestones": [{
                "id": str(m.id),
                "gps_id": str(m.gps_id),
                "step_order": m.step_order,
                "title": m.title,
                "description": m.description,
                "skills_to_acquire": m.skills_to_acquire,
                "learning_actions": m.learning_actions,
                "status": m.status,
                "completed_at": m.completed_at.isoformat() if m.completed_at else None
            } for m in milestones]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate")
async def generate_gps(request: GPSInput, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    user_id = user["sub"]
    try:
        result = await CareerGPSService.generate_gps(user_id, request.model_dump(), db)
        return result
    except Exception as e:
        err_msg = str(e)
        if "QUOTA_EXCEEDED" in err_msg:
            raise HTTPException(
                status_code=429, 
                detail="Your AI quota for today has been reached. Please try again tomorrow."
            )
        if "AI_TIMEOUT" in err_msg:
            raise HTTPException(status_code=504, detail="AI generation took too long. Please try again.")
            
        raise HTTPException(status_code=500, detail=err_msg)

@router.patch("/milestone/{milestone_id}")
def update_milestone_status(
    milestone_id: str, 
    request: MilestoneUpdate, 
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user_id = user["sub"]
    try:
        # Verify ownership (via GPS ID and candidate ID relation)
        milestone = db.query(CareerMilestone).filter(CareerMilestone.id == milestone_id).first()
            
        if not milestone:
            raise HTTPException(status_code=404, detail="Milestone not found")
            
        gps = db.query(CareerGPS).filter(CareerGPS.id == milestone.gps_id).first()
            
        if not gps or str(gps.candidate_id) != str(user_id):
            raise HTTPException(status_code=403, detail="Unauthorized access")

        milestone.status = request.status
        if request.status == "completed":
            from sqlalchemy import func
            milestone.completed_at = func.now()
            
            # 3. Trigger Notification
            NotificationService.create_notification(
                user_id=user_id,
                type="system",
                title="Milestone Completed! 🚀",
                message=f"Congratulations! You've unlocked the '{milestone.title}' milestone in your Career GPS.",
                metadata={"milestone_id": milestone_id, "action": "gps_update"}
            )
        else:
            milestone.completed_at = None
            
        db.commit()
        
        return {"status": "updated", "new_status": request.status}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
