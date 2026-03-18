import os
import sys
from pathlib import Path

# Add project root to sys.path
current_dir = Path(__file__).resolve().parent
sys.path.append(str(current_dir))

from src.core.supabase import db_engine
from sqlalchemy import text

def test_aws_connection():
    print("DEBUG: Testing AWS RDS Connection...")
    try:
        with db_engine.connect() as connection:
            result = connection.execute(text("SELECT count(*) FROM users"))
            count = result.scalar()
            print(f"SUCCESS: Connected to AWS RDS. Found {count} users in the database.")
            
            # Check for a specific table
            result = connection.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' LIMIT 5"))
            tables = [row[0] for row in result]
            print(f"DEBUG: Sample Tables found in AWS: {', '.join(tables)}")
            
    except Exception as e:
        print(f"CRITICAL ERROR: Failed to connect to AWS RDS: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    test_aws_connection()
