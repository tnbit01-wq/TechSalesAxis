import psycopg2
import os

DATABASE_URL = "postgresql://postgres:tX6v2KraCehQkZR@talentflow-db.cjymcuai297y.ap-southeast-2.rds.amazonaws.com:5432/talentflow"

def check_schema():
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        
        print("--- Interview Slots Columns ---")
        cur.execute("""
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'interview_slots' 
            AND column_name IN ('start_time', 'end_time');
        """)
        for row in cur.fetchall():
            print(row)
            
        print("\n--- Interviews Columns ---")
        cur.execute("""
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'interviews' 
            AND column_name IN ('created_at', 'updated_at');
        """)
        for row in cur.fetchall():
            print(row)
            
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_schema()
