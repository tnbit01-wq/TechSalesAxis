from core.database import db_engine
from sqlalchemy import text

def status():
    with db_engine.connect() as conn:
        # Candidate 
        conn.execute(text("UPDATE candidate_profiles SET assessment_status = 'completed' WHERE user_id = '9d8bf4c3-69cf-4a24-8155-cee8f2652f49'"))
        # Recruiter
        conn.execute(text("UPDATE recruiter_profiles SET assessment_status = 'completed' WHERE user_id = 'dc465bc1-6b0a-ae48-8cde-e54f77c4f1e1'"))
        conn.commit()
        print("STATUS UPDATED TO COMPLETED")

if __name__ == "__main__":
    status()
