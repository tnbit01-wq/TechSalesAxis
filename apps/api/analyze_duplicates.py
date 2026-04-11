"""
DATABASE ANALYSIS - Understanding Current Duplicate Detection Issue

STEP 1: Analyze existing database structure and data
"""

import os
import sys
from pathlib import Path

# Add apps/api to path
api_path = Path(__file__).parent
sys.path.insert(0, str(api_path))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Get DB connection
DB_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/talentflow_dev"
)

print("=" * 80)
print("DATABASE ANALYSIS - DUPLICATE DETECTION")
print("=" * 80)

try:
    engine = create_engine(DB_URL)
    Session = sessionmaker(bind=engine)
    db = Session()
    print(f"\n✅ Connected to database\n")
except Exception as e:
    print(f"\n❌ Failed to connect to database: {e}")
    print(f"   Connection string: {DB_URL}")
    sys.exit(1)

# ANALYSIS STEP 1: Check shadow profiles
print("=" * 80)
print("STEP 1: SHADOW PROFILES (Created from bulk uploads)")
print("=" * 80)

try:
    result = db.execute(text("""
        SELECT 
            cp.user_id,
            u.email,
            cp.full_name,
            cp.phone_number,
            cp.is_shadow_profile,
            COUNT(*) as profile_count,
            cp.created_at
        FROM candidate_profiles cp
        JOIN users u ON u.id = cp.user_id
        WHERE cp.is_shadow_profile = true
        GROUP BY cp.user_id, u.email, cp.full_name, cp.phone_number, cp.is_shadow_profile, cp.created_at
        LIMIT 10
    """)).fetchall()
    
    if result:
        print(f"\n✅ Found {len(result)} shadow profiles:\n")
        for row in result:
            user_id, email, name, phone, is_shadow, count, created_at = row
            print(f"   ID: {str(user_id)[:8]}...")
            print(f"   Name: {name}")
            print(f"   Email: {email}")
            print(f"   Phone: {phone}")
            print(f"   Shadow: {is_shadow}")
            print(f"   Created: {created_at}\n")
    else:
        print(f"⚠️  No shadow profiles found")
except Exception as e:
    print(f"❌ Error: {e}")

# ANALYSIS STEP 2: Check for potential duplicates (same phone, different email)
print("\n" + "=" * 80)
print("STEP 2: POTENTIAL DUPLICATES (Same phone, Different email)")
print("=" * 80)

try:
    result = db.execute(text("""
        SELECT 
            cp.phone_number,
            u.email,
            cp.full_name,
            cp.is_shadow_profile,
            COUNT(*) as account_count
        FROM candidate_profiles cp
        JOIN users u ON u.id = cp.user_id
        WHERE cp.phone_number IS NOT NULL 
        AND cp.phone_number != ''
        AND REGEXP_REPLACE(cp.phone_number, '\\D', '') != ''
        GROUP BY cp.phone_number, u.email, cp.full_name, cp.is_shadow_profile
        HAVING COUNT(*) > 1
        LIMIT 5
    """)).fetchall()
    
    if result:
        print(f"\n⚠️  Found {len(result)} phone numbers with multiple accounts:\n")
        for row in result:
            phone, email, name, is_shadow, count = row
            print(f"   Phone: {phone}")
            print(f"   Accounts: {count}")
            print(f"   Primary Email: {email}")
            print(f"   Name: {name}")
            print(f"   Shadow: {is_shadow}\n")
    else:
        print(f"✅ No duplicate phones found (good!)")
except Exception as e:
    print(f"❌ Error: {e}")

# ANALYSIS STEP 3: Check bulk upload matches
print("\n" + "=" * 80)
print("STEP 3: BULK UPLOAD MATCHES (Understanding current detection)")
print("=" * 80)

try:
    result = db.execute(text("""
        SELECT 
            bucm.match_type,
            COUNT(*) as count,
            ROUND(AVG(bucm.match_confidence::numeric), 3) as avg_confidence
        FROM bulk_upload_candidate_matches bucm
        GROUP BY bucm.match_type
        ORDER BY count DESC
    """)).fetchall()
    
    if result:
        print(f"\n✅ Match types distribution:\n")
        total = 0
        for row in result:
            match_type, count, avg_conf = row
            total += count
            print(f"   {match_type:<15}: {count:>4} matches | Avg confidence: {avg_conf}")
        print(f"\n   Total: {total} matches")
    else:
        print(f"⚠️  No matches found")
except Exception as e:
    print(f"❌ Error: {e}")

# ANALYSIS STEP 4: Check extracted data from files
print("\n" + "=" * 80)
print("STEP 4: EXTRACTED DATA FROM RESUMES (From bulk_upload_files)")
print("=" * 80)

try:
    result = db.execute(text("""
        SELECT 
            bf.extracted_email,
            bf.extracted_phone,
            bf.extracted_name,
            COUNT(*) as resume_count,
            MAX(bf.parsing_confidence) as max_confidence,
            bf.match_type
        FROM bulk_upload_files bf
        WHERE bf.parsing_status = 'completed'
        GROUP BY bf.extracted_email, bf.extracted_phone, bf.extracted_name, bf.match_type
        HAVING COUNT(*) > 1
        LIMIT 10
    """)).fetchall()
    
    if result:
        print(f"\n🔍 Found resumes with same extracted data:\n")
        for row in result:
            email, phone, name, count, confidence, match_type = row
            print(f"   Email: {email}")
            print(f"   Phone: {phone}")
            print(f"   Name: {name}")
            print(f"   Resumes: {count}")
            print(f"   Max Confidence: {confidence}")
            print(f"   Match Type: {match_type}\n")
    else:
        print(f"✅ No duplicate extracted data found")
except Exception as e:
    print(f"❌ Error: {e}")

# ANALYSIS STEP 5: Check phone field usage
print("\n" + "=" * 80)
print("STEP 5: PHONE FIELD USAGE IN DUPLICATE DETECTION")
print("=" * 80)

try:
    result = db.execute(text("""
        SELECT 
            bucm.match_details->>'phone_match' as phone_check,
            COUNT(*) as count
        FROM bulk_upload_candidate_matches bucm
        WHERE bucm.match_details IS NOT NULL
        GROUP BY bucm.match_details->>'phone_match'
        ORDER BY count DESC
    """)).fetchall()
    
    if result:
        print(f"\n📊 Phone matching in existing duplicates:\n")
        for row in result:
            phone_check, count = row
            print(f"   '{phone_check}': {count} matches")
    else:
        print(f"⚠️  No match_details found to analyze")
except Exception as e:
    print(f"❌ Error: {e}")

# ANALYSIS STEP 6: Check candidate profile phone coverage
print("\n" + "=" * 80)
print("STEP 6: CANDIDATE PROFILE PHONE NUMBER COVERAGE")
print("=" * 80)

try:
    result = db.execute(text("""
        SELECT 
            COUNT(*) as total_profiles,
            COUNT(CASE WHEN phone_number IS NOT NULL THEN 1 END) as with_phone,
            COUNT(CASE WHEN phone_number IS NULL THEN 1 END) as without_phone,
            ROUND(
                COUNT(CASE WHEN phone_number IS NOT NULL THEN 1 END)::numeric / 
                COUNT(*)::numeric * 100, 2
            ) as phone_coverage_percent
        FROM candidate_profiles
    """)).fetchone()
    
    if result:
        total, with_phone, without_phone, coverage = result
        print(f"\n📱 Phone number coverage:\n")
        print(f"   Total profiles: {total}")
        print(f"   With phone: {with_phone}")
        print(f"   Without phone: {without_phone}")
        print(f"   Coverage: {coverage}%")
except Exception as e:
    print(f"❌ Error: {e}")

db.close()

print("\n" + "=" * 80)
print("ANALYSIS COMPLETE")
print("=" * 80)
print("""
NEXT STEPS:
1. Review the data above
2. Identify pattern of duplicate creation
3. Propose fix based on actual data structure
4. Implement only in duplicate detection (no schema changes)
""")
