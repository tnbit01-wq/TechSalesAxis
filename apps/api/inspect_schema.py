import requests
import json
import os

SUPABASE_URL = "https://snzqqjrmthqdezozgvsp.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNuenFxanJtdGhxZGV6b3pndnNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzODg0NzksImV4cCI6MjA4NTk2NDQ3OX0.LFEnwa8C53MBODIoumhkKd0EzuYWInbhVPb3jbRd9MA"

def inspect_schema():
    headers = {"apikey": SUPABASE_KEY}
    try:
        r = requests.get(f"{SUPABASE_URL}/rest/v1/", headers=headers)
        r.raise_for_status()
        schema = r.json()
        
        tables = ["recruiter_profiles", "companies", "users", "job_applications", "jobs", "candidate_profiles"]
        for table in tables:
            print(f"\n--- {table} Columns ---")
            props = schema.get("definitions", {}).get(table, {}).get("properties", {})
            for col in sorted(props.keys()):
                print(f" - {col} ({props[col].get('type')})")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    inspect_schema()
