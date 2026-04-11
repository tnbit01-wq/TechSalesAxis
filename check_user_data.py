#!/usr/bin/env python3
"""
Quick script to check user onboarding data for anu239157@gmail.com
"""
import sys
import os
from uuid import UUID

# Add the API path to sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'apps/api'))

from src.core.database import SessionLocal
from src.core.models import User, CandidateProfile, CareerReadinessHistory
from sqlalchemy import text

def check_user_data(email: str):
    """Check all data for a user"""
    db = SessionLocal()
    
    try:
        print("\n" + "="*80)
        print(f"CHECKING USER DATA FOR: {email}")
        print("="*80)
        
        # 1. Find user by email
        user = db.query(User).filter(User.email == email).first()
        if not user:
            print(f"❌ User not found with email: {email}")
            return
        
        print(f"\n✅ User Found:")
        print(f"   User ID: {user.id}")
        print(f"   Email: {user.email}")
        print(f"   Created: {user.created_at}")
        
        # 2. Get candidate profile
        profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == user.id).first()
        if not profile:
            print(f"\n❌ No candidate profile found for this user")
            return
        
        print(f"\n✅ Candidate Profile Found:")
        print(f"   Full Name: {profile.full_name}")
        print(f"   Experience Band: {profile.experience}")
        print(f"   Years of Experience: {profile.years_of_experience}")
        print(f"   Current Role: {profile.current_role}")
        print(f"   Location: {profile.location}")
        print(f"   Phone: {profile.phone_number}")
        print(f"   Skills ({len(profile.skills) if profile.skills else 0}): {', '.join(profile.skills[:5]) if profile.skills else 'None'}...")
        print(f"   Onboarding Step: {profile.onboarding_step}")
        print(f"   Terms Accepted: {profile.terms_accepted}")
        
        print(f"\n   Career Readiness Data:")
        print(f"   - Job Search Mode: {profile.job_search_mode}")
        print(f"   - Notice Period Days: {profile.notice_period_days}")
        print(f"   - Willing to Relocate: {profile.willing_to_relocate}")
        print(f"   - Career Readiness Score: {profile.career_readiness_score}")
        print(f"   - Readiness Status: {profile.employment_readiness_status}")
        print(f"   - Readiness Metadata: {profile.career_readiness_metadata}")
        
        print(f"\n   Career GPS Data:")
        print(f"   - Target Role: {profile.target_role}")
        print(f"   - Career Interests: {profile.career_interests}")
        print(f"   - Long Term Goal: {profile.long_term_goal}")
        
        print(f"\n   Profile Status:")
        print(f"   - Updated: {profile.updated_at}")
        print(f"   - Resume Uploaded: {profile.resume_uploaded}")
        print(f"   - Terms Accepted: {profile.terms_accepted}")
        print(f"   - Verified: {profile.identity_verified}")
        
        # 3. Profile completion status
        print(f"\n✅ Profile Completion Analysis:")
        completion_fields = {
            'Full Name': bool(profile.full_name),
            'Phone': bool(profile.phone_number),
            'Experience Band': bool(profile.experience),
            'Skills': profile.skills and len(profile.skills) > 0,
            'Current Role': bool(profile.current_role),
            'Location': bool(profile.location),
            'Target Role': bool(profile.target_role),
            'Career Interests': profile.career_interests and len(profile.career_interests) > 0,
            'Long Term Goal': bool(profile.long_term_goal),
            'Terms Accepted': profile.terms_accepted,
            'Onboarding Complete': profile.onboarding_step == 'COMPLETED',
        }
        
        filled = sum(1 for v in completion_fields.values() if v)
        total = len(completion_fields)
        completion_pct = int((filled / total) * 100)
        
        print(f"   Overall Completion: {completion_pct}% ({filled}/{total} fields)")
        for field, value in completion_fields.items():
            status = "✓" if value else "✗"
            print(f"   [{status}] {field}")
        
        if profile.onboarding_step == 'COMPLETED':
            print(f"\n   ✅ ONBOARDING SUCCESSFULLY COMPLETED!")
        
        print("\n" + "="*80)
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    email = "anu239157@gmail.com"
    check_user_data(email)
