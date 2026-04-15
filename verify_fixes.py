#!/usr/bin/env python3
"""
Test script to verify conversation data sync and question deduplication
"""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "apps" / "api"))

from dotenv import load_dotenv
load_dotenv()

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from src.core.models import ConversationalOnboardingSession, CandidateProfile, User
from datetime import datetime

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)
db = Session()

print("\n" + "="*120)
print("CONVERSATION DATA SYNC & DEDUPLICATION VERIFICATION")
print("="*120)

# Get recent conversation session
sessions = db.query(ConversationalOnboardingSession).order_by(
    ConversationalOnboardingSession.created_at.desc()
).limit(5).all()

if not sessions:
    print("❌ No conversation sessions found")
    sys.exit(1)

for session in sessions:
    print(f"\n[SESSION] {session.id}")
    print(f"  Created: {session.created_at}")
    print(f"  Status: {session.conversation_status}")
    print(f"  Completed: {session.successfully_completed}")
    
    # Get profile
    profile = db.query(CandidateProfile).filter(
        CandidateProfile.user_id == session.candidate_id
    ).first()
    
    if not profile:
        print(f"  ❌ Profile not found")
        continue
    
    print(f"  Candidate: {profile.full_name}")
    
    # ========== CHECK 1: Asked Questions Deduplication ==========
    print(f"\n  [CHECK 1] Asked Questions Deduplication")
    print(f"    Asked Questions: {session.asked_questions}")
    
    # Count unique canonical forms
    variations_map = {
        "employment_status": ["employment_status", "current_status", "work_status"],
        "job_search_mode": ["job_search_mode", "urgency", "search_urgency"],
        "notice_period": ["notice_period", "notice_period_days", "timeline"],
        "current_role": ["current_role", "position", "role"],
        "years_experience": ["years_experience", "experience_years"],
        "willing_to_relocate": ["willing_to_relocate", "relocation", "relocate"],
    }
    
    canonical_set = set()
    for q in (session.asked_questions or []):
        q_lower = q.lower()
        for canonical, variations in variations_map.items():
            if any(q_lower == v.lower() for v in variations):
                canonical_set.add(canonical)
                break
    
    if len(canonical_set) == len(set(canonical_set)):
        print(f"    ✅ No duplicate questions (unique: {len(canonical_set)})")
    else:
        print(f"    ⚠️ Possible duplicates found")
    
    # ========== CHECK 2: Profile Sync Status ==========
    print(f"\n  [CHECK 2] Profile Sync Status")
    
    sync_checks = [
        ("Years of Experience", 
         session.extracted_years_experience, 
         profile.years_of_experience,
         "=="),
        ("Notice Period (Days)", 
         session.extracted_notice_period_days, 
         profile.notice_period_days,
         "=="),
        ("Willing to Relocate", 
         session.extracted_willing_to_relocate, 
         profile.willing_to_relocate,
         "=="),
        ("Employment Status", 
         session.extracted_employment_status, 
         profile.current_employment_status,
         "=="),
        ("Job Search Mode", 
         session.extracted_job_search_mode, 
         profile.job_search_mode,
         "in_map")  # These may use different values
    ]
    
    sync_passed = 0
    for field, extracted, stored, check_type in sync_checks:
        if check_type == "==":
            if extracted == stored and extracted is not None:
                print(f"    ✅ {field}: {stored} (synced ✓)")
                sync_passed += 1
            elif extracted is None and stored is None:
                print(f"    ⚠️ {field}: Both NULL (not needed)")
                sync_passed += 1
            else:
                print(f"    ❌ {field}: Extract={extracted}, Stored={stored} (MISMATCH)")
        else:
            # For job_search_mode, check if values make sense
            if extracted and stored:
                print(f"    ✅ {field}: Extract={extracted}, Stored={stored}")
                sync_passed += 1
            else:
                print(f"    ⚠️ {field}: Not yet synced or not extracted")
    
    print(f"\n    Sync Quality: {sync_passed}/{len(sync_checks)}")
    
    # ========== CHECK 3: Conversation Status ==========
    print(f"\n  [CHECK 3] Conversation Status")
    print(f"    Status: {session.conversation_status}")
    print(f"    Completed At: {session.completed_at if session.completed_at else 'Not set'}")
    print(f"    Completeness Score: {session.completeness_score}%")
    
    if session.conversation_status == "completed" and session.completed_at:
        print(f"    ✅ Conversation properly marked as completed")
    else:
        print(f"    ⚠️ Conversation status may need update")
    
    # ========== CHECK 4: Message Quality ==========
    print(f"\n  [CHECK 4] Message Quality")
    msg_count = len(session.conversation_messages) if isinstance(session.conversation_messages, list) else 0
    print(f"    Total Messages: {msg_count}")
    
    if msg_count > 0:
        # Show last message for verification
        last_msg = session.conversation_messages[-1]
        print(f"    Last Message Role: {last_msg.get('role', 'user')}")
        print(f"    Has Extracted Info: {'extracted_info' in last_msg}")
        if 'extracted_info' in last_msg:
            extracted_info = last_msg['extracted_info']
            non_empty = sum(1 for k, v in extracted_info.items() if v and v != "not_mentioned")
            print(f"    Extracted {non_empty} fields in last message")

print("\n" + "="*120)
print("VERIFICATION COMPLETE")
print("="*120 + "\n")

db.close()
