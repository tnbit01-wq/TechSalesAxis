
import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase = create_client(url, key)

def test_db():
    print("--- Database Schema Validation ---")
    
    # Check candidate_settings
    try:
        res = supabase.table("candidate_settings").select("*").limit(1).execute()
        print("[OK] candidate_settings table exists.")
    except Exception as e:
        print(f"[FAIL] candidate_settings table: {e}")

    # Check companies branding
    try:
        res = supabase.table("companies").select("logo_url, brand_colors").limit(1).execute()
        print("[OK] companies branding columns exist.")
    except Exception as e:
        print(f"[FAIL] companies branding columns: {e}")

    # Check recruiter_settings ghost_mode
    try:
        res = supabase.table("recruiter_settings").select("ghost_mode").limit(1).execute()
        print("[OK] recruiter_settings.ghost_mode exists.")
    except Exception as e:
        print(f"[FAIL] recruiter_settings.ghost_mode column: {e}")

if __name__ == "__main__":
    test_db()
