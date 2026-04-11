#!/usr/bin/env python3
"""
Comprehensive audit of onboarding data persistence across all tables and columns.
Checks what SHOULD be saved vs what IS actually saved.
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'apps/api'))

from src.core.database import SessionLocal
from src.core.models import CandidateProfile, User
from sqlalchemy import text, inspect

def get_table_columns(model):
    """Get all columns from a model and their current values."""
    mapper = inspect(model)
    columns = {}
    for column in mapper.columns:
        columns[column.name] = column.type
    return columns

def audit_onboarding_data():
    """Run comprehensive data persistence audit."""
    db = SessionLocal()
    
    try:
        print("\n" + "="*80)
        print("TALENTFLOW ONBOARDING DATA PERSISTENCE AUDIT")
        print("="*80)
        
        # Get test user
        test_email = "anu239157@gmail.com"
        user = db.query(User).filter(User.email == test_email).first()
        
        if not user:
            print(f"\n❌ User {test_email} not found!")
            return
        
        profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == user.id).first()
        if not profile:
            print(f"❌ Profile for {test_email} not found!")
            return
        
        print(f"\n✅ User Found: {user.email}")
        print(f"   User ID: {user.id}\n")
        
        # Define expected fields by onboarding stage
        expected_fields = {
            "BASIC_INFO": {
                "full_name": "Name provided during registration",
                "phone_number": "Phone captured in onboarding",
                "location": "Location preference from AWAITING_LOCATION",
                "location_tier": "Auto-calculated from location"
            },
            "EMPLOYMENT_STATUS": {
                "current_employment_status": "Current job status (employed/fresher/etc)",
                "current_role": "Current job title",
            },
            "JOB_SEARCH_MODE": {
                "job_search_mode": "Searching mode (exploring/passive/active)",
                "role_urgency_level": "Urgency (passive/active/urgent_30days/urgent_immediate)"
            },
            "AVAILABILITY": {
                "notice_period_days": "Notice period (0/7/14/30/60/90/180)",
                "notice_period_required_days": "Alias for notice_period_days",
                "availability_date": "Calculated availability date",
                "willing_to_relocate": "Willingness to relocate (boolean)"
            },
            "CAREER_READINESS": {
                "career_readiness_metadata": "JSON: exploration_trigger, visa_needed, salary_flexibility, contract_preference",
                "career_readiness_timestamp": "When career readiness data was saved",
                "career_readiness_score": "0-100 readiness score",
                "employment_readiness_status": "Overall readiness status",
                "job_opportunity_type": "Types of jobs interested in (ARRAY)"
            },
            "EXPERIENCE": {
                "experience": "Band (fresher/mid/senior/leadership)",
                "years_of_experience": "Years of relevant experience"
            },
            "SKILLS": {
                "skills": "ARRAY of skill tags",
            },
            "CAREER_GPS": {
                "target_role": "Target job role",
                "career_interests": "ARRAY of career interests/verticals",
                "long_term_goal": "Long-term career vision",
                "primary_industry_focus": "Primary industry of interest"
            },
            "PROFILE_ENRICHMENT": {
                "gender": "Gender (optional)",
                "birthdate": "Birthdate (optional)",
                "bio": "Professional bio",
                "linkedin_url": "LinkedIn profile URL",
                "portfolio_url": "Portfolio URL"
            },
            "COMPLETION": {
                "onboarding_step": "Current onboarding step",
                "terms_accepted": "T&C acceptance (boolean)",
                "identity_verified": "ID verification (boolean)",
                "resume_uploaded": "Resume upload (boolean)",
                "completion_score": "Profile completion %, 0-100",
                "profile_strength": "Low/Medium/High",
                "assessment_status": "Assessment status (not_started/in_progress/completed)"
            }
        }
        
        # Print all expected fields and their values
        print("\n" + "-"*80)
        print("DATA PERSISTENCE ANALYSIS")
        print("-"*80)
        
        all_missing = []
        total_fields = 0
        populated_fields = 0
        
        for stage, fields in expected_fields.items():
            print(f"\n📋 {stage}")
            print("   " + "-"*76)
            
            stage_missing = []
            for field_name, description in fields.items():
                total_fields += 1
                value = getattr(profile, field_name, None)
                
                # Check if field is populated
                is_populated = value is not None and value != "" and value != [] and value != {}
                
                if is_populated:
                    populated_fields += 1
                    status = "✅"
                else:
                    status = "❌"
                    stage_missing.append(field_name)
                    all_missing.append((stage, field_name))
                
                # Format value for display
                if isinstance(value, str) and len(value) > 50:
                    display_value = value[:47] + "..."
                elif isinstance(value, (list, dict)):
                    display_value = f"{type(value).__name__} ({len(value)} items)"
                else:
                    display_value = repr(value)
                
                print(f"   {status} {field_name:40} = {display_value}")
            
            if stage_missing:
                print(f"   ⚠️  Missing: {', '.join(stage_missing)}")
        
        # Summary
        print("\n" + "="*80)
        print("SUMMARY")
        print("="*80)
        print(f"\n✅ Total Fields Populated: {populated_fields}/{total_fields}")
        print(f"📊 Completion Rate: {(populated_fields/total_fields)*100:.1f}%\n")
        
        if all_missing:
            print(f"⚠️  Missing {len(all_missing)} Fields:\n")
            for stage, field in all_missing:
                print(f"   • {field} ({stage})")
        
        # Check what endpoints are being called
        print("\n" + "-"*80)
        print("EXPECTED API ENDPOINTS & PAYLOADS (FROM FRONTEND)")
        print("-"*80)
        
        endpoints = {
            "POST /candidate/step": "Save current onboarding step",
            "POST /candidate/experience": "Save experience band (fresher/mid/senior/leadership)",
            "POST /candidate/skills": "Save skills array",
            "PATCH /candidate/profile": "Save target_role, career_interests, long_term_goal, full_name, etc",
            "PATCH /candidate/career-readiness": "Save career readiness data ⚠️ ENDPOINT MAY NOT EXIST",
            "POST /candidate/accept-tc": "Mark terms_accepted=True",
            "POST /candidate/generate-resume": "Optional: Generate resume",
        }
        
        print("\nFrontend is calling these endpoints:\n")
        for endpoint, description in endpoints.items():
            marker = "⚠️" if "NOT EXIST" in description else "✅"
            print(f"   {marker} {endpoint}")
            print(f"      → {description}\n")
        
        # Check backend endpoints
        print("\n" + "-"*80)
        print("AVAILABLE BACKEND ENDPOINTS")
        print("-"*80)
        
        backend_endpoints = {
            "PATCH /candidate/profile": "Update profile fields (generic)",
            "PATCH /career-readiness/update": "Update career readiness (if exists)",
            "POST /career-readiness/save": "Save career readiness (POST not PATCH)",
            "POST /candidate/step": "Update onboarding step",
            "POST /candidate/experience": "Save experience band",
            "POST /candidate/skills": "Save skills",
            "POST /candidate/accept-tc": "Accept T&C"
        }
        
        print("\nBackend has these relevant endpoints:\n")
        for endpoint, description in backend_endpoints.items():
            print(f"   ✅ {endpoint}")
            print(f"      → {description}\n")
        
        # Identify gaps
        print("\n" + "="*80)
        print("⚠️  POTENTIAL ISSUES IDENTIFIED")
        print("="*80)
        
        issues = []
        
        # Check if career readiness data exists
        if profile.career_readiness_metadata is None:
            issues.append("❌ career_readiness_metadata is NULL - not being saved during onboarding")
        
        if profile.job_search_mode is None or profile.job_search_mode == "exploring":
            issues.append("⚠️  job_search_mode not properly captured - still at default 'exploring'")
        
        if profile.notice_period_days is None:
            issues.append("❌ notice_period_days is NULL - should be captured with job_search_mode")
        
        if not profile.skills:
            issues.append("❌ skills array is empty - not being populated")
        
        if not profile.career_interests:
            issues.append("❌ career_interests array is empty - not being populated")
        
        if not profile.target_role:
            issues.append("❌ target_role is NULL - Career GPS vision not captured")
        
        if not profile.long_term_goal:
            issues.append("❌ long_term_goal is NULL - Career goal not captured")
        
        if not profile.job_opportunity_type:
            issues.append("⚠️  job_opportunity_type array is empty - job preferences not captured")
        
        if profile.onboarding_step != "COMPLETED":
            issues.append(f"⚠️  Onboarding not completed - currently at: {profile.onboarding_step}")
        
        if not profile.terms_accepted:
            issues.append("⚠️  T&C not marked as accepted")
        
        if issues:
            print("\n")
            for i, issue in enumerate(issues, 1):
                print(f"   {i}. {issue}")
        else:
            print("\n   ✅ No critical issues found!")
        
        print("\n" + "="*80)
        
    except Exception as e:
        print(f"\n❌ Error during audit: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    audit_onboarding_data()
