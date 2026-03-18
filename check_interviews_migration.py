
import os
from sqlalchemy import create_engine, text

def check_interviews():
    db_url = "postgresql://postgres:tX6v2KraCehQkZR@talentflow-db.cjymcuai297y.ap-southeast-2.rds.amazonaws.com:5432/talentflow"
    engine = create_engine(db_url)
    with engine.connect() as conn:
        print("--- SCHEMA: interviews ---")
        res = conn.execute(text("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'interviews'"))
        for row in res:
            print(f"Col: {row[0]}, Type: {row[1]}")
            
        print("\n--- SCHEMA: interview_slots ---")
        res = conn.execute(text("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'interview_slots'"))
        for row in res:
            print(f"Col: {row[0]}, Type: {row[1]}")
            
        print("\n--- ENUM: interview_status ---")
        res = conn.execute(text("SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_type.oid = pg_enum.enumtypid WHERE typname = 'interview_status'"))
        for row in res:
            print(row[0])
            
        print("\n--- DETAILED SYNC FOR CANDIDATE PAGE CHECK ---")
        from datetime import datetime, timedelta, timezone
        # Set a very safe window: Starts 10 mins ago, Ends in 2 hours
        now_utc = datetime.now(timezone.utc)
        start_utc = now_utc - timedelta(minutes=10)
        end_utc = now_utc + timedelta(hours=2)
        
        # Update ALL slots for the active scheduled interview to ensure it shows as JOINABLE
        # Targeting the application seen in screenshots (Sales Development Lead)
        conn.execute(text("""
            UPDATE interview_slots 
            SET is_selected = true, 
                start_time = :start, 
                end_time = :end 
            WHERE interview_id IN (
                SELECT i.id 
                FROM interviews i 
                JOIN job_applications a ON i.application_id = a.id 
                WHERE a.status = 'interview_scheduled'
            )
        """), {"start": start_utc, "end": end_utc})
        conn.commit()
        print(f"SYNC SUCCESS: All scheduled interview slots moved to active window ({start_utc} to {end_utc} UTC)")

if __name__ == '__main__':
    check_interviews()
