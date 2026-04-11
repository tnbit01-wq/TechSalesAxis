#!/usr/bin/env python3
"""
Comprehensive onboarding data audit for anu239157@gmail.com
Checks all relevant tables and columns to verify complete data storage
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'apps/api'))

from src.core.database import SessionLocal
from src.core.models import (
    User, CandidateProfile, CareerReadinessHistory, 
    JobApplication, SavedJob
)
from sqlalchemy import inspect

def get_table_columns(model_class):
    """Get all columns for a model"""
    mapper = inspect(model_class)
    return [col.key for col in mapper.columns]

def check_onboarding_data_audit(email: str):
    """Comprehensive audit of onboarding data"""
    db = SessionLocal()
    
    try:
        print("\n" + "="*100)
        print(f"COMPREHENSIVE ONBOARDING DATA AUDIT: {email}")
        print("="*100)
        
        # 1. Get user
        user = db.query(User).filter(User.email == email).first()
        if not user:
            print(f"❌ User not found: {email}")
            return
        
        user_id = user.id
        print(f"\n✅ User Found: {user_id}")
        
        # 2. Check CandidateProfile Table
        print("\n" + "-"*100)
        print("TABLE 1: candidate_profiles")
        print("-"*100)
        
        profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == user_id).first()
        if not profile:
            print("❌ No candidate profile found")
            return
        
        # Get all columns and their values
        all_columns = get_table_columns(CandidateProfile)
        
        # Categorize columns
        categories = {
            "Personal Information": [
                "full_name", "phone_number", "bio", "gender", "birthdate",
                "location", "location_tier"
            ],
            "Career Data": [
                "current_role", "years_of_experience", "primary_industry_focus",
                "target_role", "experience", "long_term_goal",
                "major_achievements", "key_responsibilities"
            ],
            "Skills & Interests": [
                "skills", "career_interests", "learning_interests", "certifications"
            ],
            "Career Readiness": [
                "job_search_mode", "notice_period_days", "notice_period_required_days",
                "availability_date", "role_urgency_level", "employment_readiness_status",
                "career_readiness_score", "career_readiness_timestamp", "career_readiness_metadata",
                "willing_to_relocate"
            ],
            "Resume & Documents": [
                "resume_path", "resume_uploaded", "identity_proof_path", "identity_verified",
                "profile_photo_url", "last_resume_parse_at"
            ],
            "Education": [
                "graduation_status", "graduation_year", "gpa_score", "qualification_held",
                "education_history"
            ],
            "Experience & Projects": [
                "experience_history", "projects"
            ],
            "Onboarding Status": [
                "onboarding_step", "terms_accepted", "assessment_status"
            ],
            "Salary & Job Type": [
                "expected_salary", "job_type", "current_employment_status", "job_opportunity_type"
            ],
            "Profile Scores": [
                "ai_extraction_confidence", "completion_score", "profile_strength", "final_profile_score"
            ],
            "Links & Metadata": [
                "linkedin_url", "portfolio_url", "social_links", "learning_links", "referral"
            ],
            "System": [
                "is_shadow_profile", "account_status", "bulk_file_id", "created_at", "updated_at"
            ]
        }
        
        data_matrix = []
        total_filled = 0
        total_columns = 0
        
        for category, cols in categories.items():
            category_filled = 0
            category_total = 0
            
            for col in cols:
                if col not in all_columns:
                    continue
                
                total_columns += 1
                category_total += 1
                
                value = getattr(profile, col, None)
                is_filled = bool(value) if value is not None else False
                
                if is_filled:
                    total_filled += 1
                    category_filled += 1
                
                # Format value for display
                if value is None:
                    display_value = "❌ NULL"
                elif isinstance(value, bool):
                    display_value = f"{'✓' if value else '✗'} {value}"
                elif isinstance(value, list) and len(value) > 0:
                    display_value = f"✓ {len(value)} items"
                elif isinstance(value, dict) and len(value) > 0:
                    display_value = f"✓ {len(value)} keys"
                elif isinstance(value, str) and value.strip():
                    display_value = f"✓ {value[:60]}..." if len(value) > 60 else f"✓ {value}"
                elif isinstance(value, (int, float)):
                    display_value = f"✓ {value}"
                else:
                    display_value = "❌ EMPTY"
                
                data_matrix.append([col, display_value])
            
            if category_total > 0:
                cat_pct = int((category_filled / category_total) * 100)
                print(f"\n  {category}: {category_filled}/{category_total} ({cat_pct}%)")
                for col, val in data_matrix[-category_total:]:
                    print(f"    • {col}: {val}")
        
        overall_pct = int((total_filled / total_columns) * 100) if total_columns > 0 else 0
        print(f"\n  TOTAL: {total_filled}/{total_columns} fields filled ({overall_pct}%)")
        
        # 3. Check CareerReadinessHistory Table
        print("\n" + "-"*100)
        print("TABLE 2: career_readiness_history")
        print("-"*100)
        
        crh_records = db.query(CareerReadinessHistory).filter(
            CareerReadinessHistory.user_id == user_id
        ).order_by(CareerReadinessHistory.created_at.desc()).all() if hasattr(CareerReadinessHistory, 'created_at') else []
        
        if crh_records:
            print(f"✓ Found {len(crh_records)} career readiness records")
            for i, record in enumerate(crh_records[:3], 1):
                print(f"\n  Record {i}:")
                if hasattr(record, 'employment_status'):
                    print(f"    - Employment Status: {record.employment_status}")
                if hasattr(record, 'job_search_mode'):
                    print(f"    - Job Search Mode: {record.job_search_mode}")
                if hasattr(record, 'notice_period_days'):
                    print(f"    - Notice Period: {record.notice_period_days}")
                if hasattr(record, 'created_at'):
                    print(f"    - Created: {record.created_at}")
        else:
            print("⚠️  No career readiness history records found")
            print("   (Note: This table may not be actively populated during onboarding)")
        
        # 4. Check JobApplication Table
        print("\n" + "-"*100)
        print("TABLE 3: job_applications")
        print("-"*100)
        
        job_apps = db.query(JobApplication).filter(JobApplication.candidate_id == user_id).all()
        if job_apps:
            print(f"✓ Found {len(job_apps)} job applications")
            for i, app in enumerate(job_apps[:3], 1):
                print(f"\n  Application {i}:")
                print(f"    - Job ID: {app.job_id}")
                print(f"    - Status: {app.status}")
                print(f"    - Created: {app.created_at}")
        else:
            print("✓ No job applications yet (normal for fresh onboarding)")
        
        # 5. Check SavedJob Table
        print("\n" + "-"*100)
        print("TABLE 4: saved_jobs")
        print("-"*100)
        
        saved_jobs = db.query(SavedJob).filter(SavedJob.candidate_id == user_id).all()
        if saved_jobs:
            print(f"✓ Found {len(saved_jobs)} saved jobs")
        else:
            print("✓ No saved jobs yet (normal for fresh onboarding)")
        
        # 6. Summary & Recommendations
        print("\n" + "="*100)
        print("SUMMARY & RECOMMENDATIONS")
        print("="*100)
        
        issues = []
        
        # Check for missing critical fields
        critical_fields = {
            'full_name': 'Full Name',
            'years_of_experience': 'Years of Experience',
            'experience': 'Experience Band',
            'skills': 'Skills',
            'target_role': 'Target Role',
            'career_interests': 'Career Interests',
            'location': 'Location',
            'terms_accepted': 'Terms Accepted'
        }
        
        print("\n✓ CRITICAL FIELDS STATUS:")
        for field, label in critical_fields.items():
            value = getattr(profile, field, None)
            is_filled = bool(value)
            status = "✓" if is_filled else "❌"
            print(f"  [{status}] {label}")
            if not is_filled:
                issues.append(f"Missing critical field: {label}")
        
        # Check career readiness fields
        print("\n? CAREER READINESS FIELDS (may be optional):")
        cr_fields = {
            'job_search_mode': 'Job Search Mode',
            'notice_period_days': 'Notice Period',
            'employment_readiness_status': 'Readiness Status',
            'career_readiness_score': 'Readiness Score',
            'willing_to_relocate': 'Willing to Relocate'
        }
        
        for field, label in cr_fields.items():
            value = getattr(profile, field, None)
            is_filled = bool(value) if value is not None else False
            status = "✓" if is_filled else "?"
            print(f"  [{status}] {label}: {value}")
        
        # Check resume fields
        print("\n📄 RESUME & DOCUMENT FIELDS:")
        doc_fields = {
            'resume_uploaded': 'Resume Uploaded',
            'identity_verified': 'Identity Verified',
            'profile_photo_url': 'Profile Photo'
        }
        
        for field, label in doc_fields.items():
            value = getattr(profile, field, None)
            is_filled = bool(value)
            status = "✓" if is_filled else "?"
            print(f"  [{status}] {label}: {value}")
        
        if issues:
            print(f"\n⚠️  POTENTIAL ISSUES FOUND:")
            for issue in issues:
                print(f"  - {issue}")
        else:
            print(f"\n✅ NO CRITICAL ISSUES FOUND")
        
        print("\n" + "="*100)
        
    except Exception as e:
        print(f"\n❌ Error during audit: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    email = "anu239157@gmail.com"
    check_onboarding_data_audit(email)
