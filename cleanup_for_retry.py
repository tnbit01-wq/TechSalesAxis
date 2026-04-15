import os
import psycopg2
from dotenv import load_dotenv

root_env = os.path.join("C:\\Users\\Admin\\Desktop\\Projects\\TALENTFLOW", ".env")
load_dotenv(root_env)
db_url = os.getenv("DATABASE_URL")
email = "mithunkaveriappa.mk@gmail.com"

try:
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    cur.execute("DELETE FROM users WHERE email = %s", (email,))
    count = cur.rowcount
    conn.commit()
    cur.close()
    conn.close()
    print(f"CLEANUP_SUCCESS: Deleted {count} records for {email}")
except Exception as e:
    print(f"ERROR: {e}")
