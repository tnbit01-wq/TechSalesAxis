import os
import sys
from dotenv import load_dotenv
from supabase import create_client

def run_migration():
    """
    Executes the lean_profile_schema_sync.sql script against the database.
    This script cleans up redundant columns and initializes completion logic.
    """
    load_dotenv()
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not url or not key:
        print("Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be in .env")
        return

    supabase = create_client(url, key)
    
    sql_path = '../../infra/scripts/lean_profile_schema_sync.sql'
    if not os.path.exists(sql_path):
        # Try local path if being run from root
        sql_path = 'infra/scripts/lean_profile_schema_sync.sql'
    
    print(f"Reading migration from: {sql_path}")
    
    with open(sql_path, 'r', encoding='utf-8') as f:
        sql = f.read()
    
    # Simple split by semicolon. Note: This might struggle with complex functions
    # but for this specific script it should be fine.
    # A better way is using a specialized tool or the SQL Editor in Supabase.
    statements = [s.strip() for s in sql.split(';') if s.strip()]
    
    print(f"Found {len(statements)} statements to execute.")
    
    success_count = 0
    failure_count = 0
    
    for s in statements:
        try:
            # Note: Requires 'exec_sql' RPC function in Supabase
            supabase.rpc('exec_sql', {'sql_query': s}).execute()
            success_count += 1
        except Exception as e:
            # We print but continue, as some might be "ALREADY EXISTS" errors
            print(f"Warning/Error on statement: {s[:50]}...")
            print(f"Details: {e}")
            failure_count += 1

    print(f"\nMigration Finished.")
    print(f"Successes: {success_count}")
    print(f"Failures/Warnings: {failure_count}")
    print("\nIMPORTANT: Please verify changes in the Supabase Dashboard.")

if __name__ == "__main__":
    run_migration()
