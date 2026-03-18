import os
from sqlalchemy import text
from src.core.database import db_engine

def migrate():
    # We use raw SQL to add the missing column if it doesn't exist
    # This is safer than rely solely on SQLAlchemy's create_all which doesn't handle migrations
    with db_engine.connect() as conn:
        print("Checking for missing columns in candidate_profiles...")
        
        # Add resume_uploaded if missing
        try:
            conn.execute(text("ALTER TABLE candidate_profiles ADD COLUMN resume_uploaded BOOLEAN DEFAULT FALSE"))
            conn.commit()
            print("Added resume_uploaded column.")
        except Exception as e:
            if "already exists" in str(e).lower():
                print("Column resume_uploaded already exists.")
            else:
                print(f"Error adding resume_uploaded: {e}")

        # Add experience field if missing
        try:
            conn.execute(text("ALTER TABLE candidate_profiles ADD COLUMN experience TEXT"))
            conn.commit()
            print("Added experience column.")
        except Exception as e:
            if "already exists" in str(e).lower():
                print("Column experience already exists.")
            else:
                print(f"Error adding experience: {e}")

if __name__ == "__main__":
    migrate()
