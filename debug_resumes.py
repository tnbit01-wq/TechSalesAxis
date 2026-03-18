import os
import sys
from sqlalchemy import create_engine, text

# Set up paths
sys.path.append(os.path.abspath(os.path.join(os.getcwd(), "apps", "api", "src")))

from core.config import DATABASE_URL

engine = create_engine(DATABASE_URL.strip().strip('"'))

def run():
    with engine.connect() as conn:
        res = conn.execute(text("SELECT user_id, full_name, resume_path FROM candidate_profiles WHERE resume_path IS NOT NULL LIMIT 10"))
        print("RESUMES_START")
        for r in res.fetchall():
            print(f"User: {r[0]}, Name: {r[1]}, Path: {r[2]}")
        print("RESUMES_END")

if __name__ == "__main__":
    run()
