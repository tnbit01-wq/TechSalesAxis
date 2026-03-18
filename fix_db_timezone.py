import psycopg2
import os

db_url = "postgresql://postgres:tX6v2KraCehQkZR@talentflow-db.cjymcuai297y.ap-southeast-2.rds.amazonaws.com:5432/talentflow"

try:
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    # Set DB timezone
    cur.execute("ALTER DATABASE talentflow SET timezone TO 'Asia/Kolkata';")
    # Also verify current setting
    cur.execute("SHOW timezone;")
    current_tz = cur.fetchone()[0]
    conn.commit()
    print(f"SUCCESS: Database timezone set to Asia/Kolkata. Current session TZ: {current_tz}")
    cur.close()
    conn.close()
except Exception as e:
    print(f"ERROR: {e}")
