"""
Verification Script V2: Check which of the 8 fixes are working for a specific candidate
Candidate ID: 2c878c11-4b03-420d-b5b4-fd48b856d7d9
Improved version with better error handling
"""

import os
import json
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

load_dotenv()

DATABASE_URL = os.getenv('DATABASE_URL')
engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)

CANDIDATE_ID = "2c878c11-4b03-420d-b5b4-fd48b856d7d9"

print("=" * 80)
print(f"VERIFICATION REPORT: Candidate {CANDIDATE_ID}")
print("=" * 80)
print()

# ============================================================================
# BASIC INFO
# ============================================================================
print("INITIAL CHECK: Candidate exists?")
print("-" * 80)

session = Session()
try:
    query = text("""
        SELECT user_id, current_employment_status FROM candidate_profiles
        WHERE user_id = :candidate_id
    """)
    result = session.execute(query, {"candidate_id": CANDIDATE_ID}).first()
    
    if result:
        print(f"✅ Candidate profile exists")
        print(f"   User ID: {result[0]}")
        print(f"   Employment Status: {result[1]}")
    else:
        print(f"❌ Candidate profile NOT FOUND")
        session.close()
        exit(1)
except Exception as e:
    print(f"❌ ERROR: {str(e)}")
    session.close()
    exit(1)

session.close()
print()

# ============================================================================
# FIX #1: Job Search Motivation
# ============================================================================
print("FIX #1: Job Search Motivation (career_transition captured)")
print("-" * 80)

session = Session()
try:
    query = text("""
        SELECT extracted_metadata
        FROM conversational_onboarding_sessions
        WHERE candidate_id = :candidate_id
        ORDER BY created_at DESC
        LIMIT 1
    """)
    result = session.execute(query, {"candidate_id": CANDIDATE_ID}).first()
    
    if result and result[0]:
        metadata = result[0]
        if isinstance(metadata, dict) and 'job_search_motivation' in metadata:
            print(f"✅ FIXED: job_search_motivation = {metadata['job_search_motivation']}")
        else:
            print(f"❌ NOT FIXED: No job_search_motivation in metadata")
            print(f"   Available keys: {list(metadata.keys()) if isinstance(metadata, dict) else 'Not a dict'}")
    else:
        print(f"❌ NOT FIXED: No conversational session found")
except Exception as e:
    print(f"⚠️  SKIPPED: {str(e)[:100]}")

session.close()
print()

# ============================================================================
# FIX #2: Timeline/Urgency Mapping
# ============================================================================
print("FIX #2: Timeline/Urgency Mapping (notice_period_days → role_urgency_level)")
print("-" * 80)

session = Session()
try:
    query = text("""
        SELECT notice_period_days, role_urgency_level
        FROM candidate_profiles
        WHERE user_id = :candidate_id
    """)
    result = session.execute(query, {"candidate_id": CANDIDATE_ID}).first()
    
    if result:
        notice_days = result[0]
        urgency = result[1]
        
        # Validate mapping
        is_correct = False
        expected = None
        
        if notice_days == 0:
            expected = "urgent_immediate"
            is_correct = (urgency == expected)
        elif notice_days and notice_days <= 14:
            expected = "urgent_30days"
            is_correct = (urgency == expected)
        elif notice_days and notice_days > 14:
            expected = "active"
            is_correct = (urgency == expected)
        
        if is_correct:
            print(f"✅ FIXED: notice_period_days={notice_days} correctly maps to role_urgency_level='{urgency}'")
        elif notice_days is None:
            print(f"⚠️  PARTIAL: notice_period_days is NULL, cannot verify mapping")
            print(f"   Current role_urgency_level: {urgency}")
        else:
            print(f"❌ NOT FIXED: notice_period_days={notice_days}, role_urgency_level='{urgency}'")
            print(f"   Expected: {expected}")
    else:
        print(f"❌ NOT FIXED: No candidate profile found")
except Exception as e:
    print(f"❌ ERROR: {str(e)[:100]}")

session.close()
print()

# ============================================================================
# FIX #3: Work Arrangement Preference
# ============================================================================
print("FIX #3: Work Arrangement Preference (stored separately in metadata)")
print("-" * 80)

session = Session()
try:
    query = text("""
        SELECT career_readiness_metadata, job_type
        FROM candidate_profiles
        WHERE user_id = :candidate_id
    """)
    result = session.execute(query, {"candidate_id": CANDIDATE_ID}).first()
    
    if result:
        metadata = result[0]
        job_type = result[1]
        
        if metadata and isinstance(metadata, dict) and 'work_arrangement_preference' in metadata:
            pref = metadata['work_arrangement_preference']
            print(f"✅ FIXED: work_arrangement_preference stored in metadata = {pref}")
            print(f"   job_type (unchanged) = {job_type}")
        else:
            print(f"❌ NOT FIXED: work_arrangement_preference not in metadata")
            print(f"   job_type = {job_type}")
            if metadata and isinstance(metadata, dict):
                print(f"   Available metadata keys: {list(metadata.keys())}")
    else:
        print(f"❌ NOT FIXED: No candidate profile found")
except Exception as e:
    print(f"❌ ERROR: {str(e)[:100]}")

session.close()
print()

# ============================================================================
# FIX #4: Career Interests Format
# ============================================================================
print("FIX #4: Career Interests (parsed to array items, not single string)")
print("-" * 80)

session = Session()
try:
    query = text("""
        SELECT career_interests
        FROM candidate_profiles
        WHERE user_id = :candidate_id
    """)
    result = session.execute(query, {"candidate_id": CANDIDATE_ID}).first()
    
    if result and result[0]:
        interests = result[0]
        
        if isinstance(interests, list) and len(interests) > 0:
            # Check if it's a single long string (the bug)
            if len(interests) == 1 and isinstance(interests[0], str) and len(interests[0]) > 100:
                print(f"❌ NOT FIXED: career_interests is still a single long string")
                print(f"   Length: {len(interests[0])} characters")
                print(f"   Value: {interests[0][:80]}...")
            else:
                print(f"✅ FIXED: career_interests properly parsed into {len(interests)} items")
                print(f"   Items: {interests}")
        else:
            print(f"⚠️  No career_interests found or empty array")
            print(f"   Value: {interests}")
    else:
        print(f"⚠️  No career_interests data")
except Exception as e:
    print(f"❌ ERROR: {str(e)[:100]}")

session.close()
print()

# ============================================================================
# FIX #5: Target Roles (All Mentioned)
# ============================================================================
print("FIX #5: Target Roles (all mentioned roles stored, not just one)")
print("-" * 80)

session = Session()
try:
    query = text("""
        SELECT target_role, career_readiness_metadata
        FROM candidate_profiles
        WHERE user_id = :candidate_id
    """)
    result = session.execute(query, {"candidate_id": CANDIDATE_ID}).first()
    
    if result:
        target = result[0]
        metadata = result[1]
        
        if metadata and isinstance(metadata, dict) and 'target_roles_detailed' in metadata:
            detail = metadata['target_roles_detailed']
            print(f"✅ FIXED: target_roles_detailed metadata found")
            print(f"   Primary target_role: {target}")
            print(f"   Detailed metadata: {json.dumps(detail, indent=6)}")
        else:
            print(f"⚠️  PARTIAL: target_role set to '{target}', but no detailed roles metadata")
            if metadata and isinstance(metadata, dict):
                print(f"   Available metadata keys: {list(metadata.keys())}")
    else:
        print(f"❌ NOT FIXED: No candidate profile found")
except Exception as e:
    print(f"❌ ERROR: {str(e)[:100]}")

session.close()
print()

# ============================================================================
# FIX #6: Career GPS Table
# ============================================================================
print("FIX #6: Career GPS (entry created with target_role and current_status)")
print("-" * 80)

session = Session()
try:
    query = text("""
        SELECT id, target_role, current_status, created_at
        FROM career_gps
        WHERE candidate_id = :candidate_id
    """)
    result = session.execute(query, {"candidate_id": CANDIDATE_ID}).first()
    
    if result:
        gps_id = result[0]
        target_role = result[1]
        current_status = result[2]
        created_at = result[3]
        
        print(f"✅ FIXED: Career GPS entry created")
        print(f"   ID: {gps_id}")
        print(f"   target_role: {target_role}")
        print(f"   current_status: {current_status}")
        print(f"   created_at: {created_at}")
    else:
        print(f"❌ NOT FIXED: No Career GPS entry found for this candidate")
except Exception as e:
    print(f"❌ ERROR: {str(e)[:100]}")

session.close()
print()

# ============================================================================
# FIX #7: Career Readiness History
# ============================================================================
print("FIX #7: Career Readiness History (audit trail created)")
print("-" * 80)

session = Session()
try:
    query = text("""
        SELECT id, reason, old_job_search_mode, new_job_search_mode, 
               old_notice_period_days, new_notice_period_days, changed_at
        FROM career_readiness_history
        WHERE user_id = :candidate_id
        AND reason = 'onboarding_conversation_completed'
        ORDER BY changed_at DESC
        LIMIT 1
    """)
    result = session.execute(query, {"candidate_id": CANDIDATE_ID}).first()
    
    if result:
        history_id = result[0]
        reason = result[1]
        old_mode = result[2]
        new_mode = result[3]
        old_notice = result[4]
        new_notice = result[5]
        changed_at = result[6]
        
        print(f"✅ FIXED: Career Readiness History entry created")
        print(f"   ID: {history_id}")
        print(f"   Reason: {reason}")
        print(f"   job_search_mode: {old_mode} → {new_mode}")
        print(f"   notice_period_days: {old_notice} → {new_notice}")
        print(f"   changed_at: {changed_at}")
    else:
        # Check if any history exists
        query2 = text("""
            SELECT COUNT(*) FROM career_readiness_history
            WHERE user_id = :candidate_id
        """)
        count = session.execute(query2, {"candidate_id": CANDIDATE_ID}).scalar()
        
        if count > 0:
            print(f"⚠️  PARTIAL: {count} history record(s) found, but not from onboarding completion")
        else:
            print(f"❌ NOT FIXED: No Career Readiness History entries found")
except Exception as e:
    print(f"❌ ERROR: {str(e)[:100]}")

session.close()
print()

# ============================================================================
# FIX #8: Profile Strength Alignment
# ============================================================================
print("FIX #8: Profile Strength Alignment (aligned with completion_score)")
print("-" * 80)

session = Session()
try:
    query = text("""
        SELECT completion_score, profile_strength, employment_readiness_status
        FROM candidate_profiles
        WHERE user_id = :candidate_id
    """)
    result = session.execute(query, {"candidate_id": CANDIDATE_ID}).first()
    
    if result:
        score = result[0]
        strength = result[1]
        readiness = result[2]
        
        # Validate alignment
        is_correct = False
        expected_strength = None
        expected_readiness = None
        
        if score and score >= 80:
            expected_strength = "Strong"
            expected_readiness = "ready"
            is_correct = (strength == "Strong")
        elif score and score >= 60:
            expected_strength = "Medium"
            expected_readiness = "developing" if score < 75 else "ready"
            is_correct = (strength == "Medium")
        else:
            expected_strength = "Low"
            is_correct = (strength == "Low")
        
        if is_correct:
            print(f"✅ FIXED: Properly aligned with completion_score")
            print(f"   completion_score: {score}")
            print(f"   profile_strength: {strength}")
            print(f"   employment_readiness_status: {readiness}")
        else:
            print(f"❌ NOT FIXED: Alignment mismatch")
            print(f"   completion_score: {score}")
            print(f"   profile_strength: {strength} (expected: {expected_strength})")
            print(f"   employment_readiness_status: {readiness}")
    else:
        print(f"❌ NOT FIXED: No candidate profile found")
except Exception as e:
    print(f"❌ ERROR: {str(e)[:100]}")

session.close()
print()

# ============================================================================
# SUMMARY
# ============================================================================
print("=" * 80)
print("PROFILE SUMMARY")
print("=" * 80)

session = Session()
try:
    query = text("""
        SELECT 
            current_employment_status,
            job_search_mode,
            notice_period_days,
            years_of_experience,
            current_role,
            target_role,
            completion_score,
            profile_strength,
            skills
        FROM candidate_profiles
        WHERE user_id = :candidate_id
    """)
    result = session.execute(query, {"candidate_id": CANDIDATE_ID}).first()
    
    if result:
        print(f"Employment Status: {result[0]}")
        print(f"Job Search Mode: {result[1]}")
        print(f"Notice Period (days): {result[2]}")
        print(f"Years of Experience: {result[3]}")
        print(f"Current Role: {result[4]}")
        print(f"Target Role: {result[5]}")
        print(f"Completion Score: {result[6]}")
        print(f"Profile Strength: {result[7]}")
        print(f"Skills: {result[8]}")
except Exception as e:
    print(f"ERROR: {str(e)[:100]}")

session.close()
print()
print("=" * 80)
