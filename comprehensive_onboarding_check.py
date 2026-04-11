#!/usr/bin/env python3
"""
Comprehensive Onboarding Data Verification Script
Checks ALL tables and columns created for new onboarding steps
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

def check_user_data(email: str):
    """Check ALL onboarding data for a user across multiple tables"""
    
    session = Session()
    
    try:
        print("\n" + "="*80)
        print("COMPREHENSIVE ONBOARDING DATA VERIFICATION")
        print(f"Email: {email}")
        print(f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("="*80)
        
        # 1. Get user by email
        user_query = """
            SELECT id, email, role, created_at 
            FROM users 
            WHERE email = :email
        """
        user_result = session.execute(text(user_query), {"email": email}).fetchone()
        
        if not user_result:
            print(f"\n❌ User NOT FOUND: {email}")
            return
        
        user_id = user_result[0]
        print(f"\n✅ User Found: {email}")
        print(f"   User ID: {user_id}")
        print(f"   Role: {user_result[2]}")
        print(f"   Created: {user_result[3]}")
        
        # 2. Check candidate_profiles table (PRIMARY TABLE)
        print("\n" + "-"*80)
        print("CANDIDATE PROFILE (candidate_profiles table)")
        print("-"*80)
        
        profile_query = """
            SELECT 
                user_id, full_name, phone_number, location, current_role,
                years_of_experience, experience, skills, current_employment_status,
                employment_readiness_status,
                -- NEW ONBOARDING FIELDS
                target_role, career_interests, long_term_goal,
                job_search_mode, notice_period_days, availability_date, willing_to_relocate,
                career_readiness_metadata, career_readiness_timestamp,
                -- PROFILE COMPLETION
                onboarding_step, terms_accepted, identity_verified,
                created_at, updated_at
            FROM candidate_profiles 
            WHERE user_id = :user_id
        """
        
        profile = session.execute(text(profile_query), {"user_id": user_id}).fetchone()
        
        if not profile:
            print("❌ Candidate Profile NOT FOUND")
            return
        
        print("✅ Candidate Profile Found")
        print(f"\n   Basic Info:")
        print(f"   • Full Name: {profile[1]}")
        print(f"   • Phone: {profile[2]}")
        print(f"   • Location: {profile[3]}")
        print(f"   • Current Role: {profile[4]}")
        print(f"   • Years of Experience: {profile[5]}")
        print(f"   • Experience Band: {profile[6]}")
        
        print(f"\n   Skills & Expertise:")
        skills = profile[7]
        print(f"   • Skills ({len(skills) if skills else 0}): {', '.join(skills[:5]) if skills else 'None'}{'...' if skills and len(skills) > 5 else ''}")
        print(f"   • Employment Status: {profile[8]}")
        
        # NEW ONBOARDING DATA
        print(f"\n   📊 CAREER GPS DATA (NEW ONBOARDING):")
        print(f"   • Target Role: {profile[10] or '❌ MISSING'}")
        print(f"   • Career Interests: {profile[11] or '❌ MISSING'}")
        if profile[11]:
            print(f"     Count: {len(profile[11])} interests")
            for interest in profile[11]:
                print(f"       - {interest}")
        
        print(f"   • Long-term Goal: {(profile[12][:100] + '...') if profile[12] else '❌ MISSING'}")
        
        print(f"\n   📋 CAREER READINESS DATA (NEW ONBOARDING):")
        print(f"   • Job Search Mode: {profile[13] or '❌ MISSING'}")
        print(f"   • Notice Period (days): {profile[14]}")
        print(f"   • Availability Date: {profile[15]}")
        print(f"   • Willing to Relocate: {profile[16]}")
        print(f"   • Career Readiness Metadata: {profile[17] if profile[17] else '❌ MISSING'}")
        print(f"   • Career Readiness Timestamp: {profile[18]}")
        
        print(f"\n   ✔️ ONBOARDING STATUS:")
        print(f"   • Onboarding Step: {profile[19]}")
        print(f"   • Terms Accepted: {profile[20]}")
        print(f"   • Identity Verified: {profile[21]}")
        print(f"   • Profile Created: {profile[22]}")
        print(f"   • Profile Updated: {profile[23]}")
        
        # 3. Check career_gps table
        print("\n" + "-"*80)
        print("CAREER GPS (career_gps table)")
        print("-"*80)
        
        career_gps_query = """
            SELECT id, candidate_id, target_role, current_status, created_at, updated_at
            FROM career_gps 
            WHERE candidate_id = :user_id
        """
        
        career_gps = session.execute(text(career_gps_query), {"user_id": user_id}).fetchall()
        
        if career_gps:
            print(f"✅ Found {len(career_gps)} Career GPS record(s)")
            for gps in career_gps:
                print(f"\n   GPS ID: {gps[0]}")
                print(f"   • Target Role: {gps[2]}")
                print(f"   • Status: {gps[3]}")
                print(f"   • Created: {gps[4]}")
                print(f"   • Updated: {gps[5]}")
        else:
            print("⚠️  No Career GPS records found (might be expected if not in active job search)")
        
        # 4. Check career_milestones table
        print("\n" + "-"*80)
        print("CAREER MILESTONES (career_milestones table)")
        print("-"*80)
        
        if career_gps:
            gps_ids = [gps[0] for gps in career_gps]
            milestones_query = """
                SELECT id, gps_id, step_order, title, status, created_at
                FROM career_milestones 
                WHERE gps_id IN ({})
                ORDER BY step_order
            """.format(",".join([f"'{gid}'" for gid in gps_ids]))
            
            milestones = session.execute(text(milestones_query)).fetchall()
            
            if milestones:
                print(f"✅ Found {len(milestones)} milestone(s)")
                for milestone in milestones:
                    print(f"\n   Step {milestone[2]}: {milestone[3]}")
                    print(f"   • Status: {milestone[4]}")
                    print(f"   • Created: {milestone[5]}")
            else:
                print("⚠️  No milestones found")
        else:
            print("⚠️  No milestones (no Career GPS records)")
        
        # 5. Check career_readiness_history table
        print("\n" + "-"*80)
        print("CAREER READINESS HISTORY (career_readiness_history table)")
        print("-"*80)
        
        history_query = """
            SELECT 
                id, old_job_search_mode, new_job_search_mode, 
                old_notice_period_days, new_notice_period_days,
                changed_at, reason
            FROM career_readiness_history 
            WHERE user_id = :user_id
            ORDER BY changed_at DESC
            LIMIT 10
        """
        
        history = session.execute(text(history_query), {"user_id": user_id}).fetchall()
        
        if history:
            print(f"✅ Found {len(history)} history record(s)")
            for record in history:
                print(f"\n   Change at: {record[5]}")
                print(f"   • Job Search Mode: {record[1]} → {record[2]}")
                if record[3] or record[4]:
                    print(f"   • Notice Period: {record[3]} → {record[4]} days")
                print(f"   • Reason: {record[6]}")
        else:
            print("✅ No history changes (user in initial state)")
        
        # 6. DATA COMPLETENESS ANALYSIS
        print("\n" + "="*80)
        print("DATA COMPLETENESS SUMMARY")
        print("="*80)
        
        completeness_checks = {
            "Profile": bool(profile[1]),  # full_name
            "Contact": bool(profile[2]),  # phone
            "Location": bool(profile[3]),  # location
            "Current Role": bool(profile[4]),  # current_role
            "Experience": bool(profile[5]),  # years_of_experience
            "Skills": bool(profile[7]),  # skills array
            "Target Role": bool(profile[10]),  # target_role
            "Career Interests": bool(profile[11]),  # career_interests
            "Long-term Goal": bool(profile[12]),  # long_term_goal
            "Job Search Mode": bool(profile[13]),  # job_search_mode
            "Terms Accepted": profile[20],  # terms_accepted
            "Identity Verified": profile[21],  # identity_verified
        }
        
        completed = sum(1 for v in completeness_checks.values() if v)
        total = len(completeness_checks)
        
        print(f"\nProfile Completion: {completed}/{total} ({100*completed//total}%)")
        for field, status in completeness_checks.items():
            symbol = "✅" if status else "❌"
            print(f"   {symbol} {field}")
        
        # 7. TABLE STRUCTURE VERIFICATION
        print("\n" + "="*80)
        print("TABLE STRUCTURE VERIFICATION")
        print("="*80)
        
        tables_to_check = [
            ("candidate_profiles", ["target_role", "career_interests", "long_term_goal", 
                                   "job_search_mode", "notice_period_days", "willing_to_relocate", 
                                   "career_readiness_metadata", "career_readiness_timestamp"]),
            ("career_gps", ["id", "candidate_id", "target_role"]),
            ("career_milestones", ["id", "gps_id", "title", "status"]),
            ("career_readiness_history", ["id", "user_id", "new_job_search_mode", "changed_at"]),
        ]
        
        for table_name, expected_columns in tables_to_check:
            columns_query = """
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = :table_name
            """
            existing_columns = [row[0] for row in session.execute(
                text(columns_query), 
                {"table_name": table_name}
            ).fetchall()]
            
            missing = [col for col in expected_columns if col not in existing_columns]
            
            if missing:
                print(f"\n⚠️  {table_name}: Missing columns {missing}")
            else:
                print(f"✅ {table_name}: All expected columns present")
        
        # 8. FINAL STATUS
        print("\n" + "="*80)
        if completed == total and profile[19] == "COMPLETED":
            print("✅ ONBOARDING SUCCESSFULLY COMPLETED!")
        elif completed >= total * 0.8:
            print("⚠️  ONBOARDING IN PROGRESS (80%+ complete)")
        else:
            print("⏳ ONBOARDING INCOMPLETE")
        print("="*80 + "\n")
        
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        session.close()

if __name__ == "__main__":
    email = "anu239157@gmail.com"
    check_user_data(email)
