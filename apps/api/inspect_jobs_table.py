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
        res = conn.execute(text("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'jobs'"))
        columns = res.fetchall()
        print("JOBS_COLUMNS_START")
        for col in columns:
            print(f"{col[0]}:{col[1]}")
        print("JOBS_COLUMNS_END")

if __name__ == "__main__":
    run()
