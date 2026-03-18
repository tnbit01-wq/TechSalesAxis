
import asyncio
import os
import sys

# Ensure backend root is in path
sys.path.append(os.path.join(os.getcwd(), "apps", "api"))

from src.core.supabase import async_supabase as supabase

async def check_user_data(user_id):
    print(f"--- DATA AUDIT FOR USER: {user_id} ---")
    
    # 1. Check resume_data table
    try:
        res_data = await supabase.table("resume_data").select("*").eq("user_id", user_id).execute()
        if res_data.data:
            print("\n[+] TABLE: resume_data")
            row = res_data.data[0]
            print(f" - Extraction status: SUCCESS")
            print(f" - Skills count: {len(row.get('skills', []) or [])}")
            print(f" - Raw Experience count: {len(row.get('raw_experience', []) or [])}")
            print(f" - Raw Education count: {len(row.get('raw_education', []) or [])}")
            print(f" - Raw Text size: {len(row.get('raw_text', '') or '')} chars")
            print(f" - Career Gaps: {row.get('career_gaps')}")
        else:
            print("\n[-] TABLE: resume_data (NO ENTRY FOUND)")
    except Exception as e:
        print(f"\n[!] Error reading resume_data: {e}")

    # 2. Check candidate_profiles table
    try:
        prof_data = await supabase.table("candidate_profiles").select("*").eq("user_id", user_id).execute()
        if prof_data.data:
            print("\n[+] TABLE: candidate_profiles")
            p = prof_data.data[0]
            print(f" - Location: {p.get('location')}")
            print(f" - Current Role: {p.get('current_role')}")
            print(f" - Current Company: {p.get('current_company_name')}")
            print(f" - Years of Exp: {p.get('years_of_experience')}")
            print(f" - Experience Band: {p.get('experience')}")
            print(f" - Skills Length: {len(p.get('skills', []) or [])}")
            print(f" - Education History Count: {len(p.get('education_history', []) or [])}")
            print(f" - Experience History Count: {len(p.get('experience_history', []) or [])}")
            print(f" - AI Confidence: {p.get('ai_extraction_confidence')}")
            print(f" - Status: {p.get('assessment_status')}")
            
            print("\n[DEBUG] SPECIFIC FIELD CHECK:")
            print(f" - Skills Array: {p.get('skills')}")
        else:
            print("\n[-] TABLE: candidate_profiles (NO ENTRY FOUND)")
    except Exception as e:
        print(f"\n[!] Error reading candidate_profiles: {e}")

if __name__ == '__main__':
    asyncio.run(check_user_data('c32e36c5-f2ed-40ba-a0a2-7819b7721290'))
