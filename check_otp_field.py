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
    cur.execute("SELECT email, otp_code, otp_expires_at, is_verified FROM users WHERE email = %s", (email,))
    user = cur.fetchone()
    if user:
        print(f"EMAIL: {user[0]}")
        print(f"OTP_CODE: {user[1]}")
        print(f"OTP_EXPIRES_AT: {user[2]}")
        print(f"IS_VERIFIED: {user[3]}")
    else:
        print("USER_NOT_FOUND")
    cur.close()
    conn.close()
except Exception as e:
    print(f"ERROR: {e}")
