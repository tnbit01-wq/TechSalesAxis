import os
import sys
from sqlalchemy import text
from src.core.database import db_engine, SessionLocal
from src.core.models import Base

def sync_schema():
    """
    Ensure AWS RDS schema matches our SQLAlchemy models.
    This safely adds missing columns for OTP and Password Reset.
    """
    print("--- TALENTFLOW SCHEMA SYNC (AWS RDS) ---")
    
    # 1. Check connection
    try:
        with db_engine.connect() as conn:
            print("âœ… Connected to AWS RDS.")
    except Exception as e:
        print(f"âŒ Connection failed: {str(e)}")
        return

    # 2. Add columns manually if they don't exist
    # (SQLAlchemy Table.create() won't add columns to existing tables)
    commands = [
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS hashed_password TEXT;",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_code VARCHAR(6);",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_expires_at TIMESTAMP;",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255);",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires_at TIMESTAMP;"
    ]

    db = SessionLocal()
    try:
        for cmd in commands:
            try:
                db.execute(text(cmd))
                print(f"âœ… Executed: {cmd}")
            except Exception as cmd_e:
                print(f"âš ï¸ Row skip/error: {str(cmd_e)}")
        
        db.commit()
        print("\n--- SCHEMA SYNC COMPLETE ---")
        print("Your AWS RDS 'users' table is now ready for Email Auth (OTP/Reset).")
    except Exception as e:
        db.rollback()
        print(f"âŒ Sync failed: {str(e)}")
    finally:
        db.close()

if __name__ == "__main__":
    sync_schema()
