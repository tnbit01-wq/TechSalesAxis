import psycopg2
from datetime import datetime
import pytz

db_url = "postgresql://postgres:tX6v2KraCehQkZR@talentflow-db.cjymcuai297y.ap-southeast-2.rds.amazonaws.com:5432/talentflow"

def check_time():
    try:
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        
        # 1. Get DB Current Time
        cur.execute("SELECT CURRENT_TIMESTAMP, now();")
        db_times = cur.fetchone()
        print(f"DATABASE RELATIVE NOW: {db_times[0]}")
        
        # 2. Get the latest confirmed slot
        cur.execute("""
            SELECT s.id, s.start_time, s.end_time, s.is_selected, i.status, a.status as app_status
            FROM interview_slots s
            JOIN interviews i ON s.interview_id = i.id
            JOIN job_applications a ON i.application_id = a.id
            WHERE s.is_selected = True OR i.status = 'scheduled'
            ORDER BY i.created_at DESC
            LIMIT 3;
        """)
        slots = cur.fetchall()
        print("\n--- LATEST RELEVANT SLOTS ---")
        for s in slots:
            print(f"SlotID: {s[0]}")
            print(f"  Start: {s[1]}")
            print(f"  End:   {s[2]}")
            print(f"  IsSelected: {s[3]}")
            print(f"  InterviewStatus: {s[4]}")
            print(f"  AppStatus: {s[5]}")
            
        cur.close()
        conn.close()
    except Exception as e:
        print(f"TIME CHECK ERROR: {e}")

if __name__ == "__main__":
    check_time()
