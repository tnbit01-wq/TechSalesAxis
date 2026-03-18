import psycopg2
import os

DATABASE_URL = "postgresql://postgres:tX6v2KraCehQkZR@talentflow-db.cjymcuai297y.ap-southeast-2.rds.amazonaws.com:5432/talentflow"

def check_table():
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        cur.execute("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'candidate_settings')")
        exists = cur.fetchone()[0]
        print(f"candidate_settings table exists: {exists}")
        
        if not exists:
            print("Creating candidate_settings table...")
            cur.execute("""
                CREATE TABLE candidate_settings (
                    user_id VARCHAR(255) PRIMARY KEY,
                    email_notifications BOOLEAN DEFAULT TRUE,
                    sms_notifications BOOLEAN DEFAULT FALSE,
                    profile_visibility VARCHAR(50) DEFAULT 'public',
                    matching_alerts BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            conn.commit()
            print("Table created successfully.")
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_table()
