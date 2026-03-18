import os
import psycopg2

def debug_slots():
    db_url = "postgresql://postgres:tX6v2KraCehQkZR@talentflow-db.cjymcuai297y.ap-southeast-2.rds.amazonaws.com:5432/talentflow"
    try:
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        
        print("Checking recent slots...")
        cur.execute("""
            SELECT interview_id, start_time, end_time, is_selected, created_at 
            FROM interview_slots 
            ORDER BY created_at DESC 
            LIMIT 10;
        """)
        rows = cur.fetchall()
        print("Interview ID | Start | End | Selected | Created")
        print("-" * 100)
        for row in rows:
            print(f"{row[0]} | {row[1]} | {row[2]} | {row[3]} | {row[4]}")
            
        print("\nChecking interviews table status for recent items...")
        cur.execute("""
            SELECT id, status, updated_at 
            FROM interviews 
            ORDER BY updated_at DESC 
            LIMIT 5;
        """)
        int_rows = cur.fetchall()
        for i_row in int_rows:
            print(f"ID: {i_row[0]}, Status: {i_row[1]}, Updated: {i_row[2]}")
            
        cur.close()
        conn.close()
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    debug_slots()
