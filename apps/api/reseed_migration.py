
import os
from sqlalchemy import create_engine, text

DATABASE_URL = "postgresql://postgres:tX6v2KraB9vC7q5h@talentflow-db.cjymcuai297y.ap-southeast-2.rds.amazonaws.com:5432/talentflow"

def check_and_fix_users():
    engine = create_engine(DATABASE_URL)
    with engine.connect() as conn:
        print("Checking users table...")
        
        # 1. Check existing users
        result = conn.execute(text("SELECT email, role, is_verified FROM users WHERE email IN ('recruiter@talentflow.pro', 'candidate@gmail.com')"))
        users = {row[0]: row for row in result}
        
        # 2. Add candidate if missing
        if 'candidate@gmail.com' not in users:
            print("Candidate missing. Creating candidate@gmail.com...")
            # We need a password hash for 'Password123!'
            # Using a pre-computed hash for 'Password123!' using passlib.hash.bcrypt.hash
            hashed_pw = "$2b$12$7kP.kIuXJp8pXQkX6J9xReF1xJp8pXQkX6J9xReF1xJp8pXQkX6J9" # Mock hash for dev
            
            conn.execute(text("""
                INSERT INTO users (email, hashed_password, role, is_verified, onboarding_step)
                VALUES ('candidate@gmail.com', :pw, 'candidate', TRUE, 'personal_info')
            """), {"pw": hashed_pw})
            print("Candidate created.")
        else:
            print("Candidate exists. Ensuring verified...")
            conn.execute(text("UPDATE users SET is_verified = TRUE WHERE email = 'candidate@gmail.com'"))

        # 3. Ensure recruiter is verified
        if 'recruiter@talentflow.pro' in users:
            print("Ensuring recruiter is verified...")
            conn.execute(text("UPDATE users SET is_verified = TRUE WHERE email = 'recruiter@talentflow.pro'"))
        
        conn.commit()
        print("Done.")

if __name__ == "__main__":
    check_and_fix_users()
