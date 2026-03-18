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

# Clean up URL (handling potential quotes or whitespace)
DATABASE_URL = DATABASE_URL.strip().strip('"').strip("'")
if DATABASE_URL.startswith("postgresql://"):
    # SQLAlchemy requires postgresql://
    pass

engine = create_engine(DATABASE_URL)

def run():
    with engine.connect() as conn:
        print("COMPANIES_START")
        res = conn.execute(text("SELECT id, name, profile_score FROM companies WHERE id = '410a51c8-8a7e-4b5d-b778-9ede429bbd78'"))
        for c in res.fetchall():
            print(f"COMPANY: ID={c[0]}, Name={c[1]}, Score={c[2]}")
        print("COMPANIES_END")
        print("COMPANIES_END")

if __name__ == "__main__":
    run()
