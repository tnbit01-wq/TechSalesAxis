from fastapi import APIRouter, Depends, HTTPException
from src.core.dependencies import get_current_user, get_db
from src.core.models import Notification
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from sqlalchemy.orm import Session

router = APIRouter(prefix="/notifications", tags=["notifications"])

class NotificationResponse(BaseModel):
    id: str
    user_id: str
    type: Optional[str]
    title: str
    message: str
    metadata: dict = {}
    is_read: bool = False
    created_at: datetime

    class Config:
        from_attributes = True

@router.get("", response_model=List[NotificationResponse])
async def get_notifications(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    user_id = user["sub"]
    try:
        notifications = db.query(Notification)\
            .filter(Notification.user_id == user_id)\
            .order_by(Notification.created_at.desc())\
            .limit(50)\
            .all()
        
        results = []
        for n in notifications:
            n_dict = {
                "id": str(n.id),
                "user_id": str(n.user_id),
                "type": n.notification_type,
                "title": n.title,
                "message": n.message,
                "metadata": n.metadata_ or {},
                "is_read": n.is_read,
                "created_at": n.created_at
            }
            results.append(n_dict)
            
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/{notification_id}/read")
async def mark_as_read(notification_id: str, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    user_id = user["sub"]
    try:
        notification = db.query(Notification).filter(
            Notification.id == notification_id,
            Notification.user_id == user_id
        ).first()
        if notification:
            notification.is_read = True
            db.commit()
        return {"status": "success"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/read-all")
async def mark_all_as_read(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    user_id = user["sub"]
    try:
        db.query(Notification).filter(
            Notification.user_id == user_id,
            Notification.is_read == False
        ).update({"is_read": True})
        db.commit()
        return {"status": "success"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

class BulkDeleteRequest(BaseModel):
    notification_ids: List[str]

@router.delete("/bulk")
async def bulk_delete_notifications(
    request: BulkDeleteRequest, 
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user_id = user["sub"]
    try:
        db.query(Notification).filter(
            Notification.id.in_(request.notification_ids),
            Notification.user_id == user_id
        ).delete(synchronize_session=False)
        db.commit()
        return {"status": "success", "count": len(request.notification_ids)}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{notification_id}")
async def delete_notification(notification_id: str, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    user_id = user["sub"]
    try:
        db.query(Notification).filter(
            Notification.id == notification_id,
            Notification.user_id == user_id
        ).delete()
        db.commit()
        return {"status": "success"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
