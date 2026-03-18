
try:
    from src.core.supabase import supabase
    print("Supabase connection string found.")
    
    # Check if we can reach the DB
    res = supabase.table("recruiter_profiles").select("count", count="exact").limit(1).execute()
    print(f"Database reachable. Row count in recruiter_profiles: {res.count}")
    
    # Check critical tables
    tables = ["companies", "jobs", "job_applications", "recruiter_profiles"]
    for table in tables:
        try:
            supabase.table(table).select("*").limit(1).execute()
            print(f"Table '{table}' exists and is accessible.")
        except Exception as e:
            print(f"Table '{table}' error: {e}")

except Exception as e:
    print(f"Connection check failed: {e}")
