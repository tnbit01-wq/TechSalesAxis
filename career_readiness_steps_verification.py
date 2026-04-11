#!/usr/bin/env python3
"""
Career Readiness Early Onboarding Steps Verification
Focuses on the FIRST STEPS of the new onboarding that collect career readiness data
For user: anu239157@gmail.com
"""

import os
import sys
from datetime import datetime
from dotenv import load_dotenv

# Add API path to sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'apps', 'api', 'src'))

from core.config import DATABASE_URL
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), 'apps', 'api', '.env'))

# Create database engine
engine = create_engine(DATABASE_URL, echo=False)
Session = sessionmaker(bind=engine)

def verify_career_readiness_steps(email: str):
    """Verify career readiness early onboarding data specifically"""
    
    session = Session()
    
    try:
        print("\n" + "="*90)
        print("CAREER READINESS EARLY ONBOARDING STEPS VERIFICATION")
        print("="*90)
        print(f"Email: {email}")
        print(f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("="*90)
        
        # Get user
        user_query = "SELECT id, email, role, created_at FROM users WHERE email = :email"
        user_result = session.execute(text(user_query), {"email": email}).fetchone()
        
        if not user_result:
            print(f"\n❌ User NOT FOUND: {email}")
            return
        
        user_id = user_result[0]
        print(f"\n✅ User Found: {email}")
        print(f"   User ID: {user_id}")
        print(f"   Registered: {user_result[3]}")
        
        # Get career readiness data
        cr_query = """
            SELECT 
                user_id, full_name, phone_number, location,
                -- STEP 1: AWAITING_PREFERENCES DATA
                job_type, willing_to_relocate,
                -- STEP 2: AWAITING_AVAILABILITY DATA
                job_search_mode, notice_period_days, availability_date,
                -- STEP 3: AWAITING_SKILLS DATA
                skills, years_of_experience, current_employment_status, current_role,
                -- STEP 4: AWAITING_TC DATA (Profile completion)
                onboarding_step, terms_accepted, identity_verified,
                -- TIMESTAMPS
                created_at, updated_at,
                -- METADATA
                career_readiness_timestamp
            FROM candidate_profiles 
            WHERE user_id = :user_id
        """
        
        profile = session.execute(text(cr_query), {"user_id": user_id}).fetchone()
        
        if not profile:
            print("❌ Candidate Profile NOT FOUND")
            return
        
        print("\n" + "="*90)
        print("STEP 1: AWAITING_PREFERENCES (Work Location & Relocation)")
        print("="*90)
        
        print(f"\n✅ AWAITING_PREFERENCES Data Collection:")
        print(f"   • Job Type Preference: {profile[4] or '⚠️  MISSING'}")
        print(f"   • Willing to Relocate: {profile[5]}")
        if profile[5] == False:
            print(f"     └─ User is NOT open to relocation (preferred remote/current location)")
        elif profile[5] == True:
            print(f"     └─ User IS open to relocation (flexible on location)")
        
        step1_complete = profile[4] is not None or profile[5] is not None
        print(f"\n   Status: {'✅ COMPLETE' if step1_complete else '❌ INCOMPLETE'}")
        
        # STEP 2
        print("\n" + "="*90)
        print("STEP 2: AWAITING_AVAILABILITY (Job Search Mode & Notice Period)")
        print("="*90)
        
        print(f"\n✅ AWAITING_AVAILABILITY Data Collection:")
        print(f"   • Job Search Mode: {profile[6] or '❌ MISSING'}")
        if profile[6]:
            if profile[6] == "exploring":
                print(f"     └─ 'Exploring' - Open to opportunities, not actively searching")
            elif profile[6] == "passive":
                print(f"     └─ 'Passive' - Interested but not urgently searching")
            elif profile[6] == "active":
                print(f"     └─ 'Active' - Actively job searching right now")
        
        print(f"   • Notice Period (days): {profile[7]}")
        if profile[7] is None:
            print(f"     └─ Not applicable (already available or self-employed)")
        else:
            print(f"     └─ Will be available in {profile[7]} days")
        
        print(f"   • Calculated Availability Date: {profile[8]}")
        if profile[8]:
            print(f"     └─ Auto-calculated from notice period")
        
        step2_complete = profile[6] is not None
        print(f"\n   Status: {'✅ COMPLETE' if step2_complete else '❌ INCOMPLETE'}")
        
        # STEP 3
        print("\n" + "="*90)
        print("STEP 3: AWAITING_SKILLS (Skills & Experience Assessment)")
        print("="*90)
        
        skills = profile[9]
        years = profile[10]
        emp_status = profile[11]
        current = profile[12]
        
        print(f"\n✅ AWAITING_SKILLS Data Collection:")
        print(f"   • Years of Experience: {years or '❌ MISSING'} years")
        print(f"   • Employment Status: {emp_status or '❌ MISSING'}")
        if emp_status:
            print(f"     └─ Status: {emp_status}")
        
        print(f"   • Current Role: {current or '❌ MISSING'}")
        
        print(f"   • Skills Collected: {len(skills) if skills else 0}")
        if skills:
            print(f"     ✅ {len(skills)} skills captured:")
            # Show first 8, then summary
            for i, skill in enumerate(skills[:8], 1):
                print(f"        {i}. {skill}")
            if len(skills) > 8:
                print(f"        ... and {len(skills) - 8} more")
        
        step3_complete = bool(skills) and years is not None and emp_status is not None
        print(f"\n   Status: {'✅ COMPLETE' if step3_complete else '❌ INCOMPLETE'}")
        
        # STEP 4
        print("\n" + "="*90)
        print("STEP 4: AWAITING_TC (Terms & Conditions / Profile Completion)")
        print("="*90)
        
        onboarding_step = profile[13]
        terms = profile[14]
        verified = profile[15]
        
        print(f"\n✅ AWAITING_TC Data Collection:")
        print(f"   • Terms Accepted: {terms}")
        if terms:
            print(f"     └─ User has accepted all terms")
        else:
            print(f"     └─ Terms NOT accepted")
        
        print(f"   • Identity Verified: {verified}")
        if verified:
            print(f"     └─ Identity has been verified")
        else:
            print(f"     └─ Identity NOT verified")
        
        print(f"   • Current Onboarding Step: {onboarding_step}")
        if onboarding_step == "COMPLETED":
            print(f"     └─ ✅ Onboarding COMPLETED (all steps finished)")
        else:
            print(f"     └─ Onboarding in progress at: {onboarding_step}")
        
        step4_complete = terms and verified
        print(f"\n   Status: {'✅ COMPLETE' if step4_complete else '❌ INCOMPLETE'}")
        
        # SUMMARY
        print("\n" + "="*90)
        print("CAREER READINESS STEPS COMPLETENESS SUMMARY")
        print("="*90)
        
        steps = {
            "Step 1: Preferences": step1_complete,
            "Step 2: Availability": step2_complete,
            "Step 3: Skills": step3_complete,
            "Step 4: Terms & Completion": step4_complete,
        }
        
        completed_count = sum(1 for v in steps.values() if v)
        total_steps = len(steps)
        
        print(f"\nCompletion: {completed_count}/{total_steps} (100%)" if completed_count == total_steps else 
              f"\nCompletion: {completed_count}/{total_steps} ({100*completed_count//total_steps}%)")
        
        for step_name, is_complete in steps.items():
            symbol = "✅" if is_complete else "❌"
            print(f"   {symbol} {step_name}")
        
        # PROFILE SUMMARY
        print("\n" + "="*90)
        print("CAREER READINESS PROFILE SUMMARY")
        print("="*90)
        
        print(f"\n👤 User Profile:")
        print(f"   • Name: {profile[1]}")
        print(f"   • Phone: {profile[2]}")
        print(f"   • Location: {profile[3]}")
        
        print(f"\n📊 Career Status:")
        print(f"   • Experience Band: {years} years")
        print(f"   • Current Role: {current}")
        print(f"   • Employment Status: {emp_status}")
        print(f"   • Job Search Mode: {profile[6]}")
        
        print(f"\n🎯 Preferences:")
        print(f"   • Remote/Onsite: {profile[4] or 'Not specified'}")
        print(f"   • Willing to Relocate: {'Yes' if profile[5] else 'No'}")
        if profile[7]:
            print(f"   • Notice Period: {profile[7]} days")
        
        print(f"\n✅ Status:")
        print(f"   • Skills: {len(skills)} captured")
        print(f"   • Terms Accepted: {'Yes' if terms else 'No'}")
        print(f"   • Identity Verified: {'Yes' if verified else 'No'}")
        print(f"   • Onboarding: {onboarding_step}")
        
        print(f"\n⏱️  Timeline:")
        print(f"   • Registered: {profile[16]}")
        print(f"   • Career Readiness Started: {profile[18]}")
        print(f"   • Last Updated: {profile[17]}")
        
        # FINAL ASSESSMENT
        print("\n" + "="*90)
        if completed_count == total_steps and onboarding_step == "COMPLETED":
            print("✅ ALL CAREER READINESS EARLY STEPS SUCCESSFULLY COMPLETED!")
        elif completed_count >= 3:
            print("⚠️  CAREER READINESS STEPS IN PROGRESS (Most data collected)")
        else:
            print("⏳ CAREER READINESS STEPS INCOMPLETE")
        print("="*90 + "\n")
        
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        session.close()

if __name__ == "__main__":
    email = "anu239157@gmail.com"
    verify_career_readiness_steps(email)
