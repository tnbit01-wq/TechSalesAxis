"""
Force re-extraction of resume data for user
"""

import os
import sys
sys.path.insert(0, 'src')

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
from src.core.models import ResumeData, CandidateProfile
from src.services.comprehensive_extractor import ComprehensiveResumeExtractor

# Load environment
load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

# Create engine and session
engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)

USER_ID = "c32e36c5-f2ed-40ba-a0a2-7819b7721290"

print("=" * 80)
print("RESUME RE-EXTRACTION WITH IMPROVED METHODS")
print("=" * 80)

try:
    db = Session()
    
    # Get the stored resume data
    resume = db.query(ResumeData).filter(ResumeData.user_id == USER_ID).first()
    if not resume or not resume.raw_text:
        print("❌ No resume found")
        sys.exit(1)
    
    print(f"\n✓ Resume found: {len(resume.raw_text)} chars")
    
    # Run extraction with improved methods
    print("\nRunning extraction with improved methods...")
    extracted_data = ComprehensiveResumeExtractor.extract_all(resume.raw_text)
    
    print("\n" + "-" * 80)
    print("EXTRACTED DATA")
    print("-" * 80)
    
    print(f"\n1. Current Role: {extracted_data.get('current_role')}")
    print(f"2. Years of Experience: {extracted_data.get('years_of_experience')}")
    print(f"3. Full Name: {extracted_data.get('full_name')}")
    print(f"4. Location: {extracted_data.get('location')}")
    print(f"5. Experience Band: {extracted_data.get('experience_band')}")
    print(f"6. Skills Count: {len(extracted_data.get('skills', []))}")
    print(f"7. Education Count: {len(extracted_data.get('education_history', []))}")
    print(f"8. Experience Count: {len(extracted_data.get('experience_history', []))}")
    print(f"9. Certifications: {len(extracted_data.get('certifications', []))}")
    
    # Update the database with new extraction
    print("\n" + "-" * 80)
    print("UPDATING DATABASE")
    print("-" * 80)
    
    profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == USER_ID).first()
    if profile:
        print(f"\nBefore update:")
        print(f"  Current Role: {profile.current_role}")
        print(f"  Years of Experience: {profile.years_of_experience}")
        
        # Update fields
        profile.current_role = extracted_data.get('current_role')
        profile.years_of_experience = extracted_data.get('years_of_experience')
        profile.experience_band = extracted_data.get('experience_band')
        
        db.commit()
        
        # Refresh to verify
        db.refresh(profile)
        
        print(f"\nAfter update:")
        print(f"  Current Role: {profile.current_role} ✓")
        print(f"  Years of Experience: {profile.years_of_experience} ✓")
        print(f"  Experience Band: {profile.experience_band}")
    
    db.close()
    
    print("\n" + "=" * 80)
    print("✓ RE-EXTRACTION COMPLETE - DATABASE UPDATED")
    print("=" * 80)

except Exception as e:
    print(f"\n❌ Error: {str(e)}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
