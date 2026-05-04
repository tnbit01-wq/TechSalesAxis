"""
Verification Script: Check which of the 8 fixes are working for a specific candidate
Candidate ID: 2c878c11-4b03-420d-b5b4-fd48b856d7d9
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
session = Session()

CANDIDATE_ID = "2c878c11-4b03-420d-b5b4-fd48b856d7d9"

print("=" * 80)
print(f"VERIFICATION REPORT: Candidate {CANDIDATE_ID}")
print("=" * 80)
print()

# ============================================================================
# FIX #1: Job Search Motivation
# ============================================================================
print("FIX #1: Job Search Motivation (career_transition captured)")
print("-" * 80)
try:
    query = text("""
        SELECT 
            extracted_metadata->'job_search_motivation' as motivation,
            extracted_metadata
        FROM conversational_onboarding_sessions
        WHERE candidate_id = :candidate_id
        ORDER BY created_at DESC
        LIMIT 1
    """)
    result = session.execute(query, {"candidate_id": CANDIDATE_ID}).first()
    
    if result:
        motivation = result[0]
        full_metadata = result[1]
        
        if motivation:
            print(f"✅ FIXED: job_search_motivation = {motivation}")
            print(f"   Full metadata: {json.dumps(full_metadata, indent=6)}")
        else:
            print(f"❌ NOT FIXED: job_search_motivation is NULL")
            print(f"   Available metadata keys: {list(full_metadata.keys()) if full_metadata else 'None'}")
    else:
        print(f"❌ NOT FIXED: No conversational session found for this candidate")
except Exception as e:
    print(f"❌ ERROR: {str(e)}")

print()

# ============================================================================
# FIX #2: Timeline/Urgency Mapping
# ============================================================================
print("FIX #2: Timeline/Urgency Mapping (notice_period_days → role_urgency_level)")
print("-" * 80)
try:
    query = text("""
        SELECT 
            notice_period_days,
            role_urgency_level
        FROM candidate_profiles
        WHERE user_id = :candidate_id
    """)
    result = session.execute(query, {"candidate_id": CANDIDATE_ID}).first()
    
    if result:
        notice_days = result[0]
        urgency = result[1]
        
        # Validate mapping
        is_correct = False
        if notice_days == 0 and urgency == "urgent_immediate":
            is_correct = True
        elif notice_days and notice_days <= 14 and urgency == "urgent_30days":
            is_correct = True
        elif notice_days and notice_days > 14 and urgency == "active":
            is_correct = True
        
        if is_correct:
            print(f"✅ FIXED: notice_period_days={notice_days} correctly mapped to role_urgency_level='{urgency}'")
        else:
            print(f"❌ PARTIALLY FIXED: notice_period_days={notice_days}, role_urgency_level='{urgency}'")
            print(f"   Expected mapping not matching. Check manual.")
    else:
        print(f"❌ NOT FIXED: No candidate profile found")
except Exception as e:
    print(f"❌ ERROR: {str(e)}")

print()

# ============================================================================
# FIX #3: Work Arrangement Preference
# ============================================================================
print("FIX #3: Work Arrangement Preference (stored separately in metadata)")
print("-" * 80)
try:
    query = text("""
        SELECT 
            career_readiness_metadata->'work_arrangement_preference' as preference,
            job_type
        FROM candidate_profiles
        WHERE user_id = :candidate_id
    """)
    result = session.execute(query, {"candidate_id": CANDIDATE_ID}).first()
    
    if result:
        pref = result[0]
        job_type = result[1]
        
        if pref:
            print(f"✅ FIXED: work_arrangement_preference stored in metadata = {pref}")
            print(f"   job_type (unchanged) = {job_type}")
        else:
            print(f"❌ NOT FIXED: work_arrangement_preference not in metadata")
            print(f"   job_type = {job_type}")
    else:
        print(f"❌ NOT FIXED: No candidate profile found")
except Exception as e:
    print(f"❌ ERROR: {str(e)}")

print()

# ============================================================================
# FIX #4: Career Interests Format
# ============================================================================
print("FIX #4: Career Interests (parsed to array items, not single string)")
print("-" * 80)
try:
    query = text("""
        SELECT 
            career_interests,
            jsonb_array_length(career_interests) as array_length
        FROM candidate_profiles
        WHERE user_id = :candidate_id
    """)
    result = session.execute(query, {"candidate_id": CANDIDATE_ID}).first()
    
    if result:
        interests = result[0]
        array_length = result[1]
        
        if interests and array_length and array_length > 0:
            # Check if it's a single long string (the bug)
            if array_length == 1 and len(str(interests[0])) > 100:
                print(f"❌ NOT FIXED: career_interests is still a single long string")
                print(f"   Value: {interests[0][:100]}...")
            else:
                print(f"✅ FIXED: career_interests properly parsed into {array_length} items")
                print(f"   Items: {interests}")
        else:
            print(f"⚠️  No career_interests found (might be NULL)")
    else:
        print(f"❌ NOT FIXED: No candidate profile found")
except Exception as e:
    print(f"❌ ERROR: {str(e)}")

print()

# ============================================================================
# FIX #5: Target Roles (All Mentioned)
# ============================================================================
print("FIX #5: Target Roles (all mentioned roles stored, not just one)")
print("-" * 80)
try:
    query = text("""
        SELECT 
            target_role,
            career_readiness_metadata->'target_roles_detailed' as roles_detail
        FROM candidate_profiles
        WHERE user_id = :candidate_id
    """)
    result = session.execute(query, {"candidate_id": CANDIDATE_ID}).first()
    
    if result:
        target = result[0]
        detail = result[1]
        
        if detail:
            print(f"✅ FIXED: target_roles_detailed metadata found")
            print(f"   Primary target_role: {target}")
            print(f"   Detailed metadata: {json.dumps(detail, indent=6)}")
        else:
            print(f"⚠️  PARTIAL: target_role set to '{target}', but no detailed roles metadata")
    else:
        print(f"❌ NOT FIXED: No candidate profile found")
except Exception as e:
    print(f"❌ ERROR: {str(e)}")

print()

# ============================================================================
# FIX #6: Career GPS Table
# ============================================================================
print("FIX #6: Career GPS (entry created with target_role and current_status)")
print("-" * 80)
try:
    query = text("""
        SELECT 
            id,
            target_role,
            current_status,
            created_at
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
    print(f"❌ ERROR: {str(e)}")

print()

# ============================================================================
# FIX #7: Career Readiness History
# ============================================================================
print("FIX #7: Career Readiness History (audit trail created)")
print("-" * 80)
try:
    query = text("""
        SELECT 
            id,
            reason,
            old_job_search_mode,
            new_job_search_mode,
            old_notice_period_days,
            new_notice_period_days,
            changed_at
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
    print(f"❌ ERROR: {str(e)}")

print()

# ============================================================================
# FIX #8: Profile Strength Alignment
# ============================================================================
print("FIX #8: Profile Strength Alignment (aligned with completion_score)")
print("-" * 80)
try:
    query = text("""
        SELECT 
            completion_score,
            profile_strength,
            employment_readiness_status
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
            is_correct = (strength == "Strong" and readiness == "ready")
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
    print(f"❌ ERROR: {str(e)}")

print()

# ============================================================================
# ADDITIONAL DIAGNOSTICS
# ============================================================================
print("ADDITIONAL DIAGNOSTICS")
print("-" * 80)
try:
    # Check if onboarding session exists
    query = text("""
        SELECT 
            id,
            successfully_completed,
            completeness_score,
            total_messages
        FROM conversational_onboarding_sessions
        WHERE candidate_id = :candidate_id
        ORDER BY created_at DESC
        LIMIT 1
    """)
    result = session.execute(query, {"candidate_id": CANDIDATE_ID}).first()
    
    if result:
        session_id = result[0]
        completed = result[1]
        completeness = result[2]
        messages = result[3]
        
        print(f"✅ Conversation Session Found:")
        print(f"   ID: {session_id}")
        print(f"   successfully_completed: {completed}")
        print(f"   completeness_score: {completeness}")
        print(f"   total_messages: {messages}")
    else:
        print(f"❌ No conversation session found")
except Exception as e:
    print(f"❌ ERROR: {str(e)}")

print()

# Check profile completeness
try:
    query = text("""
        SELECT 
            current_employment_status,
            job_search_mode,
            notice_period_days,
            years_of_experience,
            current_role,
            skills,
            target_role
        FROM candidate_profiles
        WHERE user_id = :candidate_id
    """)
    result = session.execute(query, {"candidate_id": CANDIDATE_ID}).first()
    
    if result:
        status = result[0]
        mode = result[1]
        notice = result[2]
        years = result[3]
        role = result[4]
        skills = result[5]
        target = result[6]
        
        print(f"✅ Profile Basic Fields:")
        print(f"   Employment Status: {status}")
        print(f"   Job Search Mode: {mode}")
        print(f"   Notice Period (days): {notice}")
        print(f"   Years of Experience: {years}")
        print(f"   Current Role: {role}")
        print(f"   Skills: {skills}")
        print(f"   Target Role: {target}")
    else:
        print(f"❌ No profile found")
except Exception as e:
    print(f"❌ ERROR: {str(e)}")

print()
print("=" * 80)
print("END OF REPORT")
print("=" * 80)

session.close()
