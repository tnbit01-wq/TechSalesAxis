from src.core.database import SessionLocal
from sqlalchemy import text
import os

def update_schema():
    db = SessionLocal()
    try:
        print("Adding join timestamp columns to interviews table...")
        db.execute(text("ALTER TABLE interviews ADD COLUMN IF NOT EXISTS candidate_joined_at TIMESTAMP;"))
        db.execute(text("ALTER TABLE interviews ADD COLUMN IF NOT EXISTS recruiter_joined_at TIMESTAMP;"))
        db.commit()
        print("Success: Database schema updated.")
    except Exception as e:
        print(f"Error updating schema: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    update_schema()
