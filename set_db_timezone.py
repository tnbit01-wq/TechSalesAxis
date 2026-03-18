import os
import psycopg2

def fix_db_timezone():
    db_url = "postgresql://postgres:tX6v2KraCehQkZR@talentflow-db.cjymcuai297y.ap-southeast-2.rds.amazonaws.com:5432/talentflow"
    try:
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        
        print("Checking current timezone...")
        cur.execute("SHOW timezone;")
        print(f"Current System Timezone: {cur.fetchone()[0]}")
        
        print("Setting database-level timezone to 'Asia/Kolkata'...")
        cur.execute("ALTER DATABASE talentflow SET timezone TO 'Asia/Kolkata';")
        conn.commit()
        
        # In the same session, we must manually set it to see it immediately
        cur.execute("SET timezone TO 'Asia/Kolkata';")
        cur.execute("SHOW timezone;")
        print(f"Verified Timezone for this session: {cur.fetchone()[0]}")
        
        print("\nSUCCESS: Database timezone persistent setting updated to Asia/Kolkata.")
        print("NOTE: Existing connections might need to reconnect to pick up the change.")
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    fix_db_timezone()
