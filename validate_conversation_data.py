#!/usr/bin/env python3
"""
Validate conversational onboarding data for Mithunmk
Check if database matches what was discussed in conversation
"""
import os
import sys
from pathlib import Path
from datetime import datetime

# Add apps/api to path
sys.path.insert(0, str(Path(__file__).parent / "apps" / "api"))

from dotenv import load_dotenv
load_dotenv()

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from src.core.models import ConversationalOnboardingSession, CandidateProfile, User

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)
db = Session()

print("\n" + "="*120)
print("CONVERSATIONAL ONBOARDING DATA VALIDATION")
print("="*120)

# Find Mithunmk's records - search by email or candidate profile name
print("\n[STEP 1] Searching for Mithunmk in the system...")

# First try to find in candidate profiles
candidates = db.query(CandidateProfile).filter(
    CandidateProfile.full_name.ilike('%Mithunmk%')
).all()

if candidates:
    users = [db.query(User).filter(User.id == c.user_id).first() for c in candidates]
    users = [u for u in users if u]
else:
    # Try email search
    users = db.query(User).filter(User.email.ilike('%mithunmk%')).all()

if not users:
    print("❌ No user found matching 'Mithunmk' in name or email")
    # Try to get all recent conversational sessions
    print("\n[FALLBACK] Getting recent conversational sessions (last 10)...")
    recent_sessions = db.query(ConversationalOnboardingSession).order_by(
        ConversationalOnboardingSession.created_at.desc()
    ).limit(10).all()
    
    if recent_sessions:
        print(f"Found {len(recent_sessions)} recent sessions")
        for idx, session in enumerate(recent_sessions, 1):
            print(f"\n  {idx}. Session ID: {session.id}")
            print(f"     Candidate ID: {session.candidate_id}")
            print(f"     Created: {session.created_at}")
            print(f"     Stage: {session.current_stage}")
            
            # Get candidate profile
            candidate = db.query(CandidateProfile).filter(
                CandidateProfile.user_id == session.candidate_id
            ).first()
            if candidate:
                print(f"     Candidate Name: {candidate.full_name}")
    else:
        print("❌ No recent sessions found")
    sys.exit(1)

print(f"✅ Found {len(users)} user(s)\n")

for user in users:
    if not user:
        print("⚠️ Skipping null user")
        continue
        
    print(f"\n{'='*120}")
    print(f"USER: {user.email}")
    print(f"{'='*120}")

for user in users:
    print(f"\n{'='*120}")
    print(f"USER: {user.email}")
    print(f"{'='*120}")
    
    # Get candidate profile
    profile = db.query(CandidateProfile).filter(
        CandidateProfile.user_id == user.id
    ).first()
    
    if profile:
        print(f"CANDIDATE: {profile.full_name}")
    
    if not profile:
        print("❌ No candidate profile found for this user")
        continue
    
    # Get conversational sessions
    sessions = db.query(ConversationalOnboardingSession).filter(
        ConversationalOnboardingSession.candidate_id == user.id
    ).order_by(ConversationalOnboardingSession.created_at.desc()).all()
    
    if not sessions:
        print("❌ No conversational sessions found for this user")
        continue
    
    print(f"\n✅ Found {len(sessions)} conversation session(s)\n")
    
    # Analyze the most recent session
    latest_session = sessions[0]
    print(f"[LATEST SESSION ANALYSIS]")
    print(f"  Session ID: {latest_session.id}")
    print(f"  Created: {latest_session.created_at}")
    print(f"  Status: {latest_session.conversation_status}")
    print(f"  Completed: {latest_session.successfully_completed}")
    print(f"  Messages Count: {len(latest_session.conversation_messages) if latest_session.conversation_messages else 0}")
    print(f"  Completeness Score: {latest_session.completeness_score}%")
    
    # Extract Q&A from conversation
    print(f"\n[CONVERSATION ANALYSIS]")
    if latest_session.conversation_messages:
        messages = latest_session.conversation_messages
        for idx, msg in enumerate(messages):
            role = msg.get('role', 'unknown')
            content = msg.get('content', '')[:100] + "..." if len(msg.get('content', '')) > 100 else msg.get('content', '')
            print(f"  {idx+1}. [{role.upper()}]: {content}")
    
    # Check extracted data
    print(f"\n[EXTRACTED PROFILE DATA - What Should Be Stored]")
    print(f"\n  From CONVERSATION, these facts should be extracted:")
    print(f"    1. Years of Experience: 6+ years (in sales and EdTech)")
    print(f"    2. Current Role: Sales & Team Leadership (EdTech)")
    print(f"    3. Current Status: Currently employed, actively searching")
    print(f"    4. Notice Period: 30-60 days (mentioned both)")
    print(f"    5. Willing to Relocate: Yes")
    print(f"    6. Preferred Locations: Mumbai or major metros")
    print(f"    7. Skills: Consultative selling, pipeline management, forecasting, team mentoring, CRM")
    print(f"    8. Target Role: Tech/SaaS sales leadership roles")
    print(f"    9. Key Goals: Revenue ownership, team performance, client engagement, leadership development")
    print(f"   10. Interest Areas: Revenue ownership, structured sales strategies, team scaling")
    
    # Now check what's actually in the profile
    print(f"\n[ACTUAL PROFILE DATA - What's In Database]")
    print(f"\n  candidate_profiles table:")
    print(f"    ✓ years_of_experience: {profile.years_of_experience}")
    print(f"    ✓ current_role: {profile.current_role}")
    print(f"    ✓ current_employment_status: {profile.current_employment_status}")
    print(f"    ✓ notice_period_days: {profile.notice_period_days}")
    print(f"    ✓ willing_to_relocate: {profile.willing_to_relocate}")
    print(f"    ✓ location: {profile.location}")
    print(f"    ✓ target_role: {profile.target_role}")
    print(f"    ✓ skills: {profile.skills}")
    print(f"    ✓ career_interests: {profile.career_interests}")
    print(f"    ✓ long_term_goal: {profile.long_term_goal}")
    print(f"    ✓ key_responsibilities: {profile.key_responsibilities}")
    
    # Validation results
    print(f"\n[VALIDATION RESULTS]")
    validations = []
    
    # Check 1: Years of experience
    if profile.years_of_experience and profile.years_of_experience >= 6:
        validations.append(("✅", "Years of experience", f"Stored: {profile.years_of_experience} years ✓"))
    else:
        validations.append(("❌", "Years of experience", f"Stored: {profile.years_of_experience} (Expected: 6+)"))
    
    # Check 2: Current status
    if profile.current_employment_status and "employ" in profile.current_employment_status.lower():
        validations.append(("✅", "Employment Status", f"Stored: {profile.current_employment_status} ✓"))
    else:
        validations.append(("❌", "Employment Status", f"Stored: {profile.current_employment_status} (Expected: Currently employed)"))
    
    # Check 3: Notice period
    if profile.notice_period_days:
        validations.append(("✅", "Notice Period", f"Stored: {profile.notice_period_days} days ✓"))
    else:
        validations.append(("⚠️", "Notice Period", "NOT STORED (Expected: 30-60 days)"))
    
    # Check 4: Relocation
    if profile.willing_to_relocate is not None:
        validations.append(("✅", "Willing to Relocate", f"Stored: {profile.willing_to_relocate} ✓"))
    else:
        validations.append(("❌", "Willing to Relocate", "NOT STORED (Expected: True)"))
    
    # Check 5: Skills
    if profile.skills and len(profile.skills) > 0:
        validations.append(("✅", "Skills", f"Stored: {len(profile.skills)} skills - {', '.join(profile.skills[:3])}... ✓"))
    else:
        validations.append(("❌", "Skills", "NOT STORED (Expected: Consultative selling, Pipeline management, etc)"))
    
    # Check 6: Target role
    if profile.target_role:
        validations.append(("✅", "Target Role", f"Stored: '{profile.target_role}' ✓"))
    else:
        validations.append(("❌", "Target Role", "NOT STORED (Expected: Tech/SaaS sales leadership)"))
    
    # Check 7: Career interests
    if profile.career_interests and len(profile.career_interests) > 0:
        validations.append(("✅", "Career Interests", f"Stored: {', '.join(profile.career_interests)} ✓"))
    else:
        validations.append(("⚠️", "Career Interests", "NOT STORED (Expected: Revenue ownership, team leadership, etc)"))
    
    # Print validation results
    for status, field, result in validations:
        print(f"  {status} {field:.<30} {result}")
    
    # Summary
    passed = sum(1 for s, _, _ in validations if s == "✅")
    total = len(validations)
    print(f"\n[SUMMARY]")
    print(f"  Validations Passed: {passed}/{total}")
    print(f"  Status: {'✅ DATA EXTRACTION SUCCESSFUL' if passed >= total - 2 else '⚠️ DATA EXTRACTION NEEDS REVIEW' if passed >= total - 4 else '❌ DATA EXTRACTION INCOMPLETE'}")
    
    # Additional data check
    print(f"\n[CONVERSATIONAL_ONBOARDING_SESSIONS TABLE]")
    print(f"  Total sessions: {len(sessions)}")
    print(f"  Latest session status: {latest_session.conversation_status}")
    print(f"  Completion status: {'✅ Completed' if latest_session.successfully_completed else '⏳ In Progress'}")
    print(f"  Asked questions: {latest_session.asked_questions if latest_session.asked_questions else 'Not tracked'}")
    print(f"  Completeness Score: {latest_session.completeness_score}%")
    
    # Show extracted data from conversation
    print(f"\n[EXTRACTED DATA FROM CONVERSATION]")
    print(f"  Employment Status: {latest_session.extracted_employment_status}")
    print(f"  Job Search Mode: {latest_session.extracted_job_search_mode}")
    print(f"  Notice Period (Days): {latest_session.extracted_notice_period_days}")
    print(f"  Current Role: {latest_session.extracted_current_role}")
    print(f"  Years Experience: {latest_session.extracted_years_experience}")
    print(f"  Willing to Relocate: {latest_session.extracted_willing_to_relocate}")
    print(f"  Missing Fields: {latest_session.missing_critical_fields if latest_session.missing_critical_fields else 'None'}")

print("\n" + "="*120)
print("VALIDATION COMPLETE")
print("="*120 + "\n")

db.close()
