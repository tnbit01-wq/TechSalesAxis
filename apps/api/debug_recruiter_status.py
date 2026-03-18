import os
import sys
from sqlalchemy import create_engine, text

# Set up paths
sys.path.append(os.path.abspath(os.path.join(os.getcwd(), "src")))

try:
    from core.config import DATABASE_URL
except ImportError:
    DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    print("Error: DATABASE_URL not set.")
    sys.exit(1)

engine = create_engine(DATABASE_URL)

def run():
    with engine.connect() as conn:
        res = conn.execute(text("SELECT assessment_status, onboarding_step, user_id FROM recruiter_profiles"))
        profiles = res.fetchall()
        print("RECRUITER_PROFILES_START")
        for p in profiles:
            print(f"Status: {p[0]}, Step: {p[1]}, User: {p[2]}")
        print("RECRUITER_PROFILES_END")

if __name__ == "__main__":
    run()
