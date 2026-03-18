import os
import psycopg2

def select_slot():
    db_url = "postgresql://postgres:tX6v2KraCehQkZR@talentflow-db.cjymcuai297y.ap-southeast-2.rds.amazonaws.com:5432/talentflow"
    try:
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        
        # 1. Select the slot
        print("Selecting slot for interview e331d915-2aee-4a70-9f95-59216d08146c...")
        cur.execute("""
            UPDATE interview_slots 
            SET is_selected = true 
            WHERE interview_id = 'e331d915-2aee-4a70-9f95-59216d08146c'
            AND start_time = '2026-03-16 15:00:00+05:30';
        """)
        
        # 2. Add a test meeting link
        print("Adding test meeting link...")
        cur.execute("""
            UPDATE interviews 
            SET meeting_link = 'https://meet.google.com/test-meeting',
                status = 'scheduled'
            WHERE id = 'e331d915-2aee-4a70-9f95-59216d08146c';
        """)
        
        # 3. Adjust time to "NOW" so button is active
        # Current IST is around 3:00 PM. Let's set start to now - 1 hour, end to now + 24 hours
        print("Adjusting time window to BROAD ACTIVE status...")
        cur.execute("""
            UPDATE interview_slots 
            SET start_time = current_timestamp - interval '1 hour',
                end_time = current_timestamp + interval '24 hours'
            WHERE interview_id = 'e331d915-2aee-4a70-9f95-59216d08146c'
            AND is_selected = true;
        """)
        
        conn.commit()
        print("SUCCESS: Slot selected, Link added, and Time window shifted to ACTIVE.")
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    select_slot()
