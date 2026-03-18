from src.core.database import SessionLocal
from src.core.models import Notification
from sqlalchemy.orm import Session

class NotificationService:
    @staticmethod
    def create_notification(user_id: str, type: str, title: str, message: str, metadata: dict = None, db: Session = None):
        own_db = False
        if db is None:
            db = SessionLocal()
            own_db = True
        try:
            new_notif = Notification(
                user_id=user_id,
                notification_type=type,
                title=title,
                message=message,
                metadata_=metadata or {}
            )
            db.add(new_notif)
            db.commit()
        except Exception as e:
            print(f"Failed to create notification: {e}")
        finally:
            if own_db: db.close()
