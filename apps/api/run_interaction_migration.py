import os
from dotenv import load_dotenv
from supabase import create_client

def run_migration():
    load_dotenv()
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    supabase = create_client(url, key)
    
    path = r"c:\Users\mithu\OneDrive\Desktop\Projects\TALENTFLOW\infra\scripts\add_post_interactions.sql"
    with open(path, "r") as f:
        sql = f.read()
    
    try:
        # Try both common names for the SQL RPC
        try:
            res = supabase.rpc("exec_sql", {"sql_query": sql}).execute()
        except:
            res = supabase.rpc("exec_sql", {"sql": sql}).execute()
        print("Migration result:", res)
    except Exception as e:
        print(f"Migration failed: {e}")

if __name__ == "__main__":
    run_migration()
