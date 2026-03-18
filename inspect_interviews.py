import psycopg2
import os

db_url = "postgresql://postgres:tX6v2KraCehQkZR@talentflow-db.cjymcuai297y.ap-southeast-2.rds.amazonaws.com:5432/talentflow"

try:
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    # 1. Get recent applications with status interview_scheduled or shortlisted
    cur.execute("""
        SELECT a.id, a.status, j.title, c.full_name
        FROM job_applications a
        JOIN jobs j ON a.job_id = j.id
        JOIN candidate_profiles c ON a.candidate_id = c.user_id
        WHERE a.status IN ('interview_scheduled', 'shortlisted')
        ORDER BY a.created_at DESC
        LIMIT 5
    """)
    apps = cur.fetchall()
    print("--- RECENT APPLICATIONS ---")
    for app in apps:
        print(f"AppID: {app[0]}, Status: {app[1]}, Job: {app[2]}, Candidate: {app[3]}")
        
        # 2. Get interviews for this application
        cur.execute("SELECT id, status, meeting_link, round_name FROM interviews WHERE application_id = %s", (app[0],))
        interviews = cur.fetchall()
        for i in interviews:
            print(f"  -> InterviewID: {i[0]}, Status: {i[1]}, Round: {i[3]}, Link: {i[2]}")
            
            # 3. Get slots for this interview
            cur.execute("SELECT id, start_time, end_time, is_selected, status FROM interview_slots WHERE interview_id = %s", (i[0],))
            slots = cur.fetchall()
            for s in slots:
                print(f"     * SlotID: {s[0]}, Start: {s[1]}, End: {s[2]}, Selected: {s[3]}, Status: {s[4]}")
    
    cur.close()
    conn.close()
except Exception as e:
    print(f"ERROR: {e}")
