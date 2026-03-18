
import os
from sqlalchemy import create_engine, text

# AWS RDS Connection details (Direct copy from your env)
DATABASE_URL = "postgresql://postgres:tX6v2KraB9vC7q5h@talentflow-db.cjymcuai297y.ap-southeast-2.rds.amazonaws.com:5432/talentflow"

def fix_users():
    engine = create_engine(DATABASE_URL)
    with engine.connect() as conn:
        print("Connected to AWS RDS...")
        
        # 1. Update verification status
        result = conn.execute(text("""
            UPDATE users 
            SET is_verified = TRUE 
            WHERE email IN ('recruiter@talentflow.pro', 'candidate@gmail.com')
            RETURNING email, is_verified;
        """))
        conn.commit()
        for row in result:
            print(f"Verified user: {row[0]}")

        # 2. Check if recruiter profile exists for the dummy recruiter
        recruiter_id_res = conn.execute(text("SELECT id FROM users WHERE email = 'recruiter@talentflow.pro'"))
        recruiter_id = recruiter_id_res.scalar()
        
        if recruiter_id:
            profile_exists = conn.execute(text("SELECT 1 FROM recruiter_profiles WHERE user_id = :uid"), {"uid": recruiter_id}).scalar()
            if not profile_exists:
                conn.execute(text("""
                    INSERT INTO recruiter_profiles (user_id, onboarding_step)
                    VALUES (:uid, 'completed')
                """), {"uid": recruiter_id})
                conn.commit()
                print("Created recruiter profile for recruiter@talentflow.pro")
            else:
                conn.execute(text("UPDATE recruiter_profiles SET onboarding_step = 'completed' WHERE user_id = :uid"), {"uid": recruiter_id})
                conn.commit()
                print("Updated recruiter profile onboarding to completed")
        
        print("Fix complete.")

if __name__ == "__main__":
    fix_users()
