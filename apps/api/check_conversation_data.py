#!/usr/bin/env python3
"""
Check what data was stored for the candidate in the onboarding conversation
"""
import os
import sys
import json
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Load environment
load_dotenv()
db_url = os.getenv("DATABASE_URL")

if not db_url:
    print("ERROR: DATABASE_URL not set in .env")
    sys.exit(1)

# Connect
engine = create_engine(db_url)

user_id = "a951825b-e862-430d-b0e7-5fa29f95f7a2"

print("\n" + "="*80)
print("CANDIDATE PROFILE DATA")
print("="*80)
with engine.connect() as conn:
    result = conn.execute(text("""
        SELECT 
            cp.user_id,
            u.email,
            cp.full_name,
            cp.current_employment_status,
            cp.job_search_mode,
            cp.location,
            cp.experience,
            cp.years_of_experience,
            cp.current_role,
            cp.skills,
            cp.career_interests,
            cp.resume_path,
            cp.onboarding_step,
            cp.assessment_status
        FROM candidate_profiles cp
        LEFT JOIN users u ON cp.user_id = u.id
        WHERE cp.user_id = :user_id
    """), {"user_id": user_id})
    
    profile = result.fetchone()
    if profile:
        print(f"✓ Email: {profile[1]}")
        print(f"✓ Name: {profile[2]}")
        print(f"✓ Employment Status: {profile[3]}")
        print(f"✓ Job Search Mode: {profile[4]}")
        print(f"✓ Location: {profile[5]}")
        print(f"✓ Experience Band: {profile[6]}")
        print(f"✓ Years of Experience: {profile[7]}")
        print(f"✓ Current Role: {profile[8]}")
        print(f"✓ Skills: {profile[9]}")
        print(f"✓ Career Interests: {profile[10]}")
        print(f"✓ Resume Path: {profile[11]}")
        print(f"✓ Onboarding Step: {profile[12]}")
        print(f"✓ Assessment Status: {profile[13]}")
    else:
        print("✗ Profile NOT FOUND!")

print("\n" + "="*80)
print("CAREER READINESS HISTORY (Last 15 entries)")
print("="*80)
with engine.connect() as conn:
    result = conn.execute(text("""
        SELECT 
            step,
            status,
            data,
            created_at
        FROM career_readiness_history
        WHERE user_id = :user_id
        ORDER BY created_at ASC
        LIMIT 15
    """), {"user_id": user_id})
    
    rows = result.fetchall()
    if rows:
        for i, row in enumerate(rows, 1):
            print(f"\n[{i}] Step: {row[0]} | Status: {row[1]}")
            try:
                data = json.loads(row[2]) if isinstance(row[2], str) else row[2]
                print(f"    Data: {json.dumps(data, indent=6)}")
            except:
                print(f"    Data: {row[2]}")
            print(f"    Created: {row[3]}")
    else:
        print("✗ No career readiness history found!")

print("\n" + "="*80)
print("ANALYSIS")
print("="*80)

# Compare with resume
resume_data = {
    "current_role": "Senior Associate – Client Operations / Media Operations / Billing Analyst",
    "years_experience": 8,
    "employment_status": "Employed (as of resume last update)",
    "skills": ["Client Servicing", "Inside Sales", "Lead Conversion", "Customer Communication", "Billing", "Invoicing", "Reporting", "Data Analysis", "CRM"],
    "location": "Goregaon W (Mumbai)",
    "job_search_mode": "Actively exploring - transition to sales/account management"
}

print("\nRESUME DATA (Expected):")
for key, value in resume_data.items():
    print(f"  {key}: {value}")

print("\nTEST OBSERVATIONS FROM CONVERSATION:")
print("  1. ✓ Correctly identified 8+ years experience")
print("  2. ✓ Correctly identified employment status as 'employed'")
print("  3. ✓ Correctly identified job search mode as 'exploring/active'")
print("  4. ✓ Correctly identified 30-day notice period")
print("  5. ✗ ISSUE: Said 'not_mentioned' for background when candidate clearly mentioned client servicing")
print("  6. ✗ ISSUE: Repeated asking employment status multiple times")
print("  7. ✗ ISSUE: Asked years of experience question after already identifying 8+ years")
print("  8. ✗ ISSUE: Conversation flow not tracking what was already asked")
print("  9. ✓ Eventually moved to resume upload")

print("\n" + "="*80)
