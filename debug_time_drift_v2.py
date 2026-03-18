import psycopg2
import os
from datetime import datetime, timezone, timedelta

# Hardcoded DB URL from previous script as it was already working
db_url = "postgresql://postgres:tX6v2KraCehQkZR@talentflow-db.cjymcuai297y.ap-southeast-2.rds.amazonaws.com:5432/talentflow"

def check_time():
    try:
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        
        # 1. Get DB Current Time
        cur.execute("SELECT now(), current_setting('TIMEZONE');")
        db_now, db_tz = cur.fetchone()
        print(f"DATABASE NOW: {db_now}")
        print(f"DB CONFIG TZ: {db_tz}")
        
        # 2. Get the latest confirmed slot
        # Using LEFT JOIN to see if there are interviews without slots
        cur.execute("""
            SELECT 
                i.id as interview_id,
                a.candidate_id,
                i.status as interview_status, 
                a.status as app_status,
                s.id as slot_id,
                s.start_time, 
                s.is_selected
            FROM interviews i
            JOIN job_applications a ON i.application_id = a.id
            LEFT JOIN interview_slots s ON s.interview_id = i.id
            WHERE i.status = 'scheduled' OR a.status = 'interview_scheduled'
            ORDER BY i.updated_at DESC
            LIMIT 5;
        """)
        
        rows = cur.fetchall()
        print("\n--- RECENT SCHEDULED INTERVIEWS ---")
        if not rows:
            print("No scheduled interviews found.")
        else:
            for r in rows:
                iid, cid, istat, astat, sid, start, sel = r
                print(f"InterviewID: {iid} | CandidateID: {cid}")
                print(f"  Status: [I: {istat}, A: {astat}]")
                print(f"  SlotID: {sid} | Selected: {sel}")
                print(f"  StartTime: {start}")
                if start and db_now:
                    diff = start - db_now
                    print(f"  Diff (Start - Now): {diff}")
                print("-" * 30)
            
        cur.close()
        conn.close()
    except Exception as e:
        print(f"TIME CHECK ERROR: {e}")

if __name__ == "__main__":
    check_time()