#!/usr/bin/env python3
"""
Retrospective sync - sync all completed conversations that haven't been synced to profiles yet
"""
import os
import sys
from pathlib import Path
from datetime import datetime

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
print("RETROSPECTIVE CONVERSATION-TO-PROFILE SYNC")
print("="*120)

# Find all conversations that are completed but have data mismatches
sessions = db.query(ConversationalOnboardingSession).filter(
    ConversationalOnboardingSession.successfully_completed == True
).all()

if not sessions:
    print("\n❌ No completed conversations found")
    db.close()
    sys.exit(1)

print(f"\nFound {len(sessions)} completed conversation(s)")

synced_count = 0
failed_count = 0
skipped_count = 0

for session in sessions:
    print(f"\n[SESSION] {session.id}")
    
    # Get profile
    profile = db.query(CandidateProfile).filter(
        CandidateProfile.user_id == session.candidate_id
    ).first()
    
    if not profile:
        print(f"  ❌ Profile not found - SKIPPING")
        skipped_count += 1
        continue
    
    print(f"  Candidate: {profile.full_name}")
    
    try:
        updates_made = False
        
        # 1. Sync Years of Experience
        if session.extracted_years_experience is not None:
            if profile.years_of_experience != session.extracted_years_experience:
                old_val = profile.years_of_experience
                profile.years_of_experience = session.extracted_years_experience
                print(f"    ✅ years_of_experience: {old_val} → {session.extracted_years_experience}")
                updates_made = True
        
        # 2. Sync Notice Period
        if session.extracted_notice_period_days is not None:
            if profile.notice_period_days != session.extracted_notice_period_days:
                old_val = profile.notice_period_days
                profile.notice_period_days = session.extracted_notice_period_days
                print(f"    ✅ notice_period_days: {old_val} → {session.extracted_notice_period_days}")
                updates_made = True
        
        # 3. Sync Willing to Relocate
        if session.extracted_willing_to_relocate is not None:
            if profile.willing_to_relocate != session.extracted_willing_to_relocate:
                old_val = profile.willing_to_relocate
                profile.willing_to_relocate = session.extracted_willing_to_relocate
                print(f"    ✅ willing_to_relocate: {old_val} → {session.extracted_willing_to_relocate}")
                updates_made = True
        
        # 4. Sync Job Search Mode
        if session.extracted_job_search_mode is not None:
            mode_map = {
                "exploring": "exploring",
                "passive": "passive",
                "active": "active",
            }
            mapped_mode = mode_map.get(session.extracted_job_search_mode)
            if mapped_mode and profile.job_search_mode != mapped_mode:
                old_val = profile.job_search_mode
                profile.job_search_mode = mapped_mode
                print(f"    ✅ job_search_mode: {old_val} → {mapped_mode}")
                updates_made = True
        
        # 5. Sync Current Role
        if session.extracted_current_role is not None:
            if profile.current_role != session.extracted_current_role:
                old_val = profile.current_role
                profile.current_role = session.extracted_current_role
                print(f"    ✅ current_role: '{old_val}' → '{session.extracted_current_role}'")
                updates_made = True
        
        # 6. Sync Employment Status - Map to enum values
        if session.extracted_employment_status is not None:
            # Database enum values are: 'Employed', 'Unemployed', 'Student'
            status_map = {
                "employed": "Employed",
                "unemployed": "Unemployed",
                "student": "Student",
                "between_roles": "Unemployed",  # Map "between roles" to unemployed
            }
            extracted_lower = session.extracted_employment_status.lower()
            mapped_status = status_map.get(extracted_lower, session.extracted_employment_status)
            if profile.current_employment_status != mapped_status:
                old_val = profile.current_employment_status
                profile.current_employment_status = mapped_status
                print(f"    ✅ current_employment_status: {old_val} → {mapped_status}")
                updates_made = True
        
        # Update timestamp
        if updates_made:
            profile.updated_at = datetime.utcnow()
            
            # Also update conversation status if needed
            if session.conversation_status != "completed":
                session.conversation_status = "completed"
                session.completed_at = datetime.utcnow()
                print(f"    ✅ conversation_status updated to: completed")
            
            db.commit()
            print(f"  ✅ SYNCED - {5} fields updated")
            synced_count += 1
        else:
            print(f"  ⏭️ SKIPPED - No mismatches found (already synced)")
            skipped_count += 1
        
    except Exception as e:
        print(f"  ❌ ERROR: {str(e)}")
        db.rollback()
        failed_count += 1

print(f"\n" + "="*120)
print(f"SYNC RESULTS")
print(f"="*120)
print(f"  Synced: {synced_count}")
print(f"  Skipped (already synced): {skipped_count}")
print(f"  Failed: {failed_count}")
print(f"  Total: {synced_count + skipped_count + failed_count}")

if synced_count > 0:
    print(f"\n✅ Successfully synced {synced_count} conversation(s) to profiles")
else:
    print(f"\n⚠️ No conversations needed syncing")

print("="*120 + "\n")

db.close()
