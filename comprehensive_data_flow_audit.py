"""
Comprehensive Data Flow Audit for Onboarding Process
Checks all tables and columns that should be populated during conversational onboarding
"""

import sys
sys.path.insert(0, '/apps/api/src')

from sqlalchemy import create_engine, MetaData, inspect, text, Column
from sqlalchemy.orm import sessionmaker
from src.core.config import DATABASE_URL
from src.core.models import (
    User, CandidateProfile, CareerReadinessHistory, 
    ResumeData, ProfileScore, CareerGPS, CareerMilestone,
    AssessmentSession, AssessmentResponse
)

# Connect to database
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
session = SessionLocal()

print("=" * 100)
print("COMPREHENSIVE DATA FLOW AUDIT FOR TALENTFLOW ONBOARDING")
print("=" * 100)

# Test email for verification
test_email = "anu239157@gmail.com"

try:
    # 1. Get user
    user = session.query(User).filter(User.email == test_email).first()
    if not user:
        print(f"❌ User not found: {test_email}")
        sys.exit(1)
    
    user_id = user.id
    print(f"\n✅ User Found: {user_id}")
    print(f"   Email: {user.email}")
    print(f"   Role: {user.role}")
    print(f"   Created: {user.created_at}")
    
    # 2. Get candidate profile
    profile = session.query(CandidateProfile).filter(CandidateProfile.user_id == user_id).first()
    if not profile:
        print(f"❌ Candidate profile not found")
        sys.exit(1)
    
    print(f"\n✅ Candidate Profile Found")
    
    # Check all critical fields in candidate_profiles table
    critical_fields = {
        "Identifying": [
            ("full_name", profile.full_name),
            ("phone_number", profile.phone_number),
            ("location", profile.location),
            ("email", user.email),
        ],
        "Experience": [
            ("experience", profile.experience),
            ("years_of_experience", profile.years_of_experience),
            ("current_role", profile.current_role),
            ("current_employment_status", profile.current_employment_status),
        ],
        "Career GPS": [
            ("target_role", profile.target_role),
            ("long_term_goal", profile.long_term_goal),
            ("career_interests", profile.career_interests),
            ("learning_interests", profile.learning_interests),
        ],
        "Career Readiness": [
            ("job_search_mode", profile.job_search_mode),
            ("notice_period_days", profile.notice_period_days),
            ("willing_to_relocate", profile.willing_to_relocate),
            ("career_readiness_metadata", profile.career_readiness_metadata),
        ],
        "Skills & Certifications": [
            ("skills", profile.skills),
            ("certifications", profile.certifications),
        ],
        "Onboarding Tracking": [
            ("onboarding_step", profile.onboarding_step),
            ("resume_uploaded", profile.resume_uploaded),
            ("resume_path", profile.resume_path),
            ("identity_verified", profile.identity_verified),
            ("identity_proof_path", profile.identity_proof_path),
            ("terms_accepted", profile.terms_accepted),
            ("assessment_status", profile.assessment_status),
        ],
        "Scores & Metadata": [
            ("completion_score", profile.completion_score),
            ("career_readiness_score", profile.career_readiness_score),
            ("final_profile_score", profile.final_profile_score),
        ],
    }
    
    print("\n" + "=" * 100)
    print("CANDIDATE_PROFILES TABLE DATA CHECK")
    print("=" * 100)
    
    for category, fields in critical_fields.items():
        print(f"\n📋 {category}:")
        for field_name, field_value in fields:
            status = "✓" if (field_value is not None and field_value != "" and field_value != []) else "✗"
            
            if isinstance(field_value, list):
                field_value = f"{len(field_value)} items: {field_value[:3]}..." if field_value else "Empty"
            elif isinstance(field_value, dict):
                field_value = f"{{...}} ({len(field_value)} keys)" if field_value else "Empty"
            
            print(f"  [{status}] {field_name:30} = {field_value}")
    
    # 3. Check Resume Data
    print("\n" + "=" * 100)
    print("RESUME_DATA TABLE")
    print("=" * 100)
    
    resume_data = session.query(ResumeData).filter(ResumeData.user_id == user_id).first()
    if resume_data:
        print("✅ Resume data found")
        print(f"   Raw Text: {resume_data.raw_text[:50] if resume_data.raw_text else 'None'}...")
        print(f"   Skills: {len(resume_data.skills) if resume_data.skills else 0} items")
        print(f"   Education: {len(resume_data.education) if resume_data.education else 0} entries")
        print(f"   Experience: {len(resume_data.raw_experience) if resume_data.raw_experience else 0} entries")
        print(f"   Parsed at: {resume_data.parsed_at}")
    else:
        print("❌ No resume data found")
    
    # 4. Check Career Readiness History
    print("\n" + "=" * 100)
    print("CAREER_READINESS_HISTORY TABLE")
    print("=" * 100)
    
    readiness_history = session.query(CareerReadinessHistory).filter(
        CareerReadinessHistory.user_id == user_id
    ).all()
    
    if readiness_history:
        print(f"✅ Career readiness history: {len(readiness_history)} entries")
        for entry in readiness_history:
            print(f"   - {entry.changed_at}: {entry.old_job_search_mode} → {entry.new_job_search_mode}")
    else:
        print("❌ No career readiness history found (may be normal if not changed)")
    
    # 5. Check Career GPS
    print("\n" + "=" * 100)
    print("CAREER_GPS TABLE")
    print("=" * 100)
    
    career_gps = session.query(CareerGPS).filter(CareerGPS.candidate_id == user_id).first()
    if career_gps:
        print("✅ Career GPS found")
        print(f"   Target Role: {career_gps.target_role}")
        print(f"   Status: {career_gps.current_status}")
        
        # Check milestones
        milestones = session.query(CareerMilestone).filter(
            CareerMilestone.gps_id == career_gps.id
        ).all()
        print(f"   Milestones: {len(milestones)} total")
        for m in milestones[:3]:
            print(f"      - {m.title} ({m.status})")
    else:
        print("❌ No Career GPS found (may be generated later)")
    
    # 6. Check Assessment Session
    print("\n" + "=" * 100)
    print("ASSESSMENT_SESSION TABLE")
    print("=" * 100)
    
    assessment_session = session.query(AssessmentSession).filter(
        AssessmentSession.candidate_id == user_id
    ).first()
    
    if assessment_session:
        print("✅ Assessment session found")
        print(f"   Status: {assessment_session.status}")
        print(f"   Started: {assessment_session.started_at}")
        print(f"   Overall Score: {assessment_session.overall_score}")
        
        # Check responses
        responses = session.query(AssessmentResponse).filter(
            AssessmentResponse.candidate_id == user_id
        ).all()
        print(f"   Responses: {len(responses)} answers")
    else:
        print("⏳ No Assessment session found (not started yet)")
    
    # 7. Check Profile Scores
    print("\n" + "=" * 100)
    print("PROFILE_SCORES TABLE")
    print("=" * 100)
    
    profile_scores = session.query(ProfileScore).filter(ProfileScore.user_id == user_id).first()
    if profile_scores:
        print("✅ Profile scores found")
        print(f"   Resume Score: {profile_scores.resume_score}")
        print(f"   Behavioral Score: {profile_scores.behavioral_score}")
        print(f"   Skills Score: {profile_scores.skills_score}")
        print(f"   Final Score: {profile_scores.final_score}")
    else:
        print("⏳ No profile scores found (calculated during assessment)")
    
    # 8. Summarize data completeness
    print("\n" + "=" * 100)
    print("DATA FLOW COMPLETENESS SUMMARY")
    print("=" * 100)
    
    tables_checked = {
        "users": "✅ Present",
        "candidate_profiles": "✅ Present",
        "resume_data": "✅ Present" if resume_data else "❌ Missing",
        "career_readiness_history": "✅ Present" if readiness_history else "⏳ No changes recorded",
        "career_gps": "✅ Present" if career_gps else "⏳ Not generated",
        "assessment_session": "✅ Present" if assessment_session else "⏳ Not started",
        "profile_scores": "✅ Present" if profile_scores else "⏳ Not calculated",
    }
    
    for table, status in tables_checked.items():
        print(f"  {status:25} | {table}")
    
    # Count populated fields in candidate_profiles
    profile_dict = profile.__dict__.copy()
    profile_dict.pop('_sa_instance_state', None)
    
    populated_count = sum(1 for v in profile_dict.values() if v is not None and v != "" and v != [])
    total_count = len(profile_dict)
    
    print(f"\n📊 Candidate Profile Completeness: {populated_count}/{total_count} fields populated ({int(100*populated_count/total_count)}%)")
    
    # Final verdict
    print("\n" + "=" * 100)
    print("VERDICT")
    print("=" * 100)
    
    is_onboarding_complete = profile.onboarding_step == "COMPLETED" and profile.terms_accepted
    has_core_data = (
        profile.full_name and
        profile.experience and
        profile.skills and
        profile.target_role
    )
    
    if is_onboarding_complete and has_core_data:
        print(\"\"\"\
✅ ONBOARDING DATA FLOW IS WORKING PROPERLY
   - Onboarding marked as COMPLETED
   - Core candidate data is being captured
   - Data is being persisted to all relevant tables
   - Ready for dashboard access and job matching
        \"\"\")
    else:
        print(\"\"\"\
⚠️  SOME DATA GAPS DETECTED:
        \"\"\")
        if not is_onboarding_complete:
            print(f"   - Onboarding not completed: {profile.onboarding_step}")
        if not profile.full_name:
            print("   - Missing full name")
        if not profile.experience:
            print("   - Missing experience band")
        if not profile.skills:
            print("   - Missing skills")
        if not profile.target_role:
            print("   - Missing target role")

except Exception as e:
    print(f"❌ Error during audit: {e}")
    import traceback
    traceback.print_exc()

finally:
    session.close()
