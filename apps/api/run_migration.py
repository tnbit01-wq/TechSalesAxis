import os
import sys
from dotenv import load_dotenv
from supabase import create_client

def run():
    load_dotenv()
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    supabase = create_client(url, key)
    
    sql_path = '../../infra/scripts/skill_catalog_schema.sql'
    with open(sql_path, 'r') as f:
        sql = f.read()
        
    statements = [s.strip() for s in sql.split(';') if s.strip()]
    for s in statements:
        try:
            res = supabase.rpc('exec_sql', {'sql_query': s}).execute()
            print(f"Executed OK: {s[:40]}")
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    run()
