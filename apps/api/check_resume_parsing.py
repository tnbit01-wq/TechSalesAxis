"""
Resume Parsing Accuracy Diagnostic
Checks resume_data and candidate_profiles for user: c32e36c5-f2ed-40ba-a0a2-7819b7721290
Email: mithunmk374@gmail.com
"""

import os
import sys
sys.path.insert(0, 'src')

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
from uuid import UUID

# Load environment
load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    print("ERROR: DATABASE_URL not set in .env")
    sys.exit(1)

# Create engine and session
engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)
db = Session()

# Import models
from src.core.models import (
    User, CandidateProfile, ResumeData, ProfileScore, JobApplication
)

# User to check
USER_ID = "c32e36c5-f2ed-40ba-a0a2-7819b7721290"
EMAIL = "mithunmk374@gmail.com"

print("=" * 80)
print("RESUME PARSING ACCURACY REPORT")
print("=" * 80)
print(f"\nUser ID: {USER_ID}")
print(f"Email: {EMAIL}")
print("\n" + "=" * 80)

try:
    # 1. Check User existence
    user = db.query(User).filter(User.id == USER_ID).first()
    if not user:
        print(f"\n❌ User not found: {USER_ID}")
        sys.exit(1)
    
    print(f"\n✓ User found:")
    print(f"  Role: {user.role}")
    print(f"  Email: {user.email}")
    print(f"  Created: {user.created_at}")
    
    # 2. Check CandidateProfile
    print(f"\n" + "-" * 80)
    print("CANDIDATE PROFILE DATA")
    print("-" * 80)
    
    candidate = db.query(CandidateProfile).filter(
        CandidateProfile.user_id == USER_ID
    ).first()
    
    if not candidate:
        print("❌ No candidate profile found")
    else:
        print(f"✓ Candidate Profile:")
        print(f"  Full Name: {candidate.full_name}")
        print(f"  Phone: {candidate.phone_number}")
        print(f"  Location: {candidate.location}")
        print(f"  Current Role: {candidate.current_role}")
        print(f"  Years of Experience: {candidate.years_of_experience}")
        print(f"  Target Role: {candidate.target_role}")
        print(f"  Expected Salary: {candidate.expected_salary}")
        print(f"  LinkedIn: {candidate.linkedin_url}")
        print(f"  Portfolio: {candidate.portfolio_url}")
        print(f"  Location Tier: {candidate.location_tier}")
        print(f"  Skills Count: {len(candidate.skills or [])}")
        if candidate.skills:
            print(f"    Skills: {', '.join(list(candidate.skills)[:10])}...")
        print(f"  Education Count: {len(candidate.education_history or [])}")
        if candidate.education_history:
            for edu in candidate.education_history:
                print(f"    - {edu.get('degree')} from {edu.get('institution')} ({edu.get('year')})")
        print(f"  Experience Count: {len(candidate.experience_history or [])}")
        if candidate.experience_history:
            for exp in candidate.experience_history:
                print(f"    - {exp.get('position')} at {exp.get('company')}")
        print(f"  Certifications: {len(candidate.certifications or [])}")
        if candidate.certifications:
            for cert in candidate.certifications:
                print(f"    - {cert.get('name')} ({cert.get('year')})")
    
    # 3. Check ResumeData
    print(f"\n" + "-" * 80)
    print("RESUME DATA TABLE")
    print("-" * 80)
    
    resume = db.query(ResumeData).filter(
        ResumeData.user_id == USER_ID
    ).first()
    
    if not resume:
        print("❌ No resume data found")
    else:
        print(f"✓ Resume Data Found:")
        print(f"  User ID: {resume.user_id}")
        print(f"  Raw Text Length: {len(resume.raw_text or '')} characters")
        print(f"  Skills Extracted: {len(resume.skills or [])}")
        if resume.skills:
            print(f"    {', '.join(resume.skills[:5])}...")
        print(f"  Education Entries: {len(resume.education or [])}")
        print(f"  Experience Entries: {len(resume.timeline or [])}")
        print(f"  Career Gaps: {resume.career_gaps}")
        print(f"  Achievements: {len(resume.achievements or [])} found")
        print(f"  Parsed At: {resume.parsed_at}")
        
        if resume.raw_text:
            print(f"\n  First 300 chars of raw text:")
            print(f"  {resume.raw_text[:300]}...")
    
    # 4. Check ProfileScore
    print(f"\n" + "-" * 80)
    print("PROFILE SCORE")
    print("-" * 80)
    
    score = db.query(ProfileScore).filter(
        ProfileScore.user_id == USER_ID
    ).first()
    
    if not score:
        print("⚠️  No profile score found (assessment may not be completed)")
    else:
        print(f"✓ Profile Score:")
        print(f"  Resume Score: {score.resume_score}")
        print(f"  Behavioral Score: {score.behavioral_score}")
        print(f"  Psychometric Score: {score.psychometric_score}")
        print(f"  Skills Score: {score.skills_score}")
        print(f"  Reference Score: {score.reference_score}")
        print(f"  Final Score: {score.final_score}")
        print(f"  Calculated At: {score.calculated_at}")
    
    # 5. Extraction Accuracy Analysis
    print(f"\n" + "=" * 80)
    print("EXTRACTION ACCURACY ANALYSIS")
    print("=" * 80)
    
    accuracy_report = {
        "Full Name": "✓" if candidate and candidate.full_name else "❌",
        "Phone": "✓" if candidate and candidate.phone_number else "❌",
        "Email": "✓" if user and user.email else "❌",
        "Location": "✓" if candidate and candidate.location else "❌",
        "Current Role": "✓" if candidate and candidate.current_role else "❌",
        "Years of Experience": "✓" if candidate and candidate.years_of_experience and candidate.years_of_experience > 0 else "❌",
        "Skills": "✓" if candidate and candidate.skills and len(candidate.skills) > 5 else "⚠️",
        "Education": "✓" if candidate and candidate.education_history and len(candidate.education_history) > 0 else "❌",
        "Experience History": "✓" if candidate and candidate.experience_history and len(candidate.experience_history) > 0 else "❌",
        "Certifications": "⚠️" if candidate and candidate.certifications and len(candidate.certifications) == 0 else ("✓" if candidate and candidate.certifications else "❌"),
        "Resume Raw Text": "✓" if resume and resume.raw_text else "❌",
        "Profile Score": "✓" if score else "⚠️",
    }
    
    print("\nExtraction Status:")
    for field, status in accuracy_report.items():
        print(f"  {status} {field}")
    
    passed = sum(1 for v in accuracy_report.values() if v == "✓")
    total = len(accuracy_report)
    completion_rate = (passed / total) * 100
    
    print(f"\n📊 Overall Completion: {passed}/{total} ({completion_rate:.1f}%)")
    
    # 6. Suggested Improvements
    print(f"\n" + "=" * 80)
    print("IMPROVEMENT RECOMMENDATIONS")
    print("=" * 80)
    
    improvements = []
    
    if not candidate:
        improvements.append("1. Candidate profile not created - check resume extraction pipeline")
    else:
        if not candidate.full_name:
            improvements.append("1. Name extraction failed - check resume header parsing")
        if not candidate.phone_number:
            improvements.append("2. Phone extraction failed - check contact section parsing")
        if not candidate.location:
            improvements.append("3. Location extraction failed - check location patterns")
        if not candidate.current_role or candidate.current_role == "Unknown":
            improvements.append("4. Current role extraction failed - improve role detection")
        if not candidate.years_of_experience or candidate.years_of_experience == 0:
            improvements.append("5. Years of experience extraction failed - improve year calculation")
        if not candidate.skills or len(candidate.skills) < 5:
            improvements.append("6. Skills extraction incomplete - expand skill keyword database")
        if not candidate.education_history or len(candidate.education_history) == 0:
            improvements.append("7. Education extraction failed - check education section parsing")
        if not candidate.experience_history or len(candidate.experience_history) == 0:
            improvements.append("8. Experience extraction failed - improve job entry parsing")
        if not candidate.certifications or len(candidate.certifications) == 0:
            improvements.append("9. Certifications extraction failed - add certification parsing")
    
    if not resume or not resume.raw_text:
        improvements.append("10. Raw resume text not stored - check storage in resume_data table")
    
    if not score:
        improvements.append("11. Assessment incomplete - user needs to complete assessment for profile score")
    
    if improvements:
        for improvement in improvements:
            print(f"\n⚠️  {improvement}")
    else:
        print("\n✅ All data extracted successfully!")
    
    # 7. Next Steps
    print(f"\n" + "=" * 80)
    print("NEXT STEPS")
    print("=" * 80)
    
    next_steps = [
        "1. Review the extracted data above",
        "2. Compare with original resume content",
        "3. For any ❌ fields, check the extraction service",
        "4. Update extraction patterns if needed",
        "5. Run re-extraction if improvements were made",
    ]
    
    if not score:
        next_steps.append("6. User should complete assessment to generate profile score")
    
    for step in next_steps:
        print(f"\n{step}")

except Exception as e:
    print(f"\n❌ Error: {str(e)}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

finally:
    db.close()

print(f"\n" + "=" * 80)
print("REPORT COMPLETE")
print("=" * 80)
