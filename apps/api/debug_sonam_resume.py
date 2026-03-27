"""
Debug Resume Parsing - Check what's being extracted vs what should be
"""

import os
import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.path.insert(0, 'src')

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
from src.core.models import ResumeData
from src.services.comprehensive_extractor import ComprehensiveResumeExtractor

# Load environment
load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

# Create engine and session
engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)
db = Session()

USER_ID = "8622864c-0f25-4ce9-90b1-a83ac5a569e0"

# Get the resume
resume = db.query(ResumeData).filter(ResumeData.user_id == USER_ID).first()

if not resume or not resume.raw_text:
    print("No resume found")
    sys.exit(1)

print("=" * 80)
print("RESUME EXTRACTION DEBUG")
print("=" * 80)

text = resume.raw_text

# Show raw text
print(f"\nRAW TEXT LENGTH: {len(text)} chars\n")
print("=" * 80)
print("FIRST 1000 CHARS:")
print("=" * 80)
print(text[:1000])

print("\n" + "=" * 80)
print("EXTRACTION TEST")
print("=" * 80)

# Test extraction methods
print("\n1. YEARS OF EXPERIENCE EXTRACTION:")
years = ComprehensiveResumeExtractor.extract_experience_years(text)
print(f"   Result: {years}")
print(f"   Expected: 16 or 5")

print("\n2. CURRENT ROLE EXTRACTION:")
exp_list, current_role, previous_role = ComprehensiveResumeExtractor.extract_experience(text)
print(f"   Current Role: {current_role}")
print(f"   Previous Role: {previous_role}")
print(f"   Expected Current: Business Development & Client Relations OR Business Sales Manager")
print(f"   Experience Count: {len(exp_list)}")
if exp_list:
    for i, exp in enumerate(exp_list[:2]):
        print(f"     Job {i+1}: {exp}")

print("\n3. CERTIFICATIONS EXTRACTION:")
certs = ComprehensiveResumeExtractor.extract_certifications(text)
print(f"   Certifications Found: {len(certs)}")
print(f"   Expected: 3-4 (ASL Communication Training, DELED – NIOS)")
for cert in certs:
    print(f"     - {cert}")

print("\n4. SKILLS EXTRACTION:")
skills = ComprehensiveResumeExtractor.extract_skills(text)
print(f"   Skills Found: {len(skills)}")
print(f"   Expected: 15+ skills")
print(f"   Skills: {skills}")

print("\n5. NAME EXTRACTION:")
name = ComprehensiveResumeExtractor.extract_name(text)
print(f"   Name: {name}")
print(f"   Expected: SONAM SHUKLA")

print("\n6. LOCATION EXTRACTION:")
location = ComprehensiveResumeExtractor.extract_location(text)
print(f"   Location: {location}")
print(f"   Expected: Indore, MP or Remote")

print("\n" + "=" * 80)
print("ISSUE ANALYSIS")
print("=" * 80)

# Check for specific keywords
print("\n✓ Keywords found in text:")
keywords = {
    "'Sales Manager'": "Sales Manager" in text,
    "'5+ years'": "5+" in text and "years" in text,
    "'16 years'": "16" in text and "years" in text,
    "'Business Development'": "Business Development" in text,
    "'PROFESSIONAL EXPERIENCE'": "PROFESSIONAL EXPERIENCE" in text,
    "'CERTIFICATIONS'": "CERTIFICATIONS" in text,
    "'CERTIFICATIONS & TECHNICAL SKILLS'": "CERTIFICATIONS & TECHNICAL SKILLS" in text,
    "'ASL Communication'": "ASL" in text,
}

for keyword, found in keywords.items():
    status = "✓" if found else "❌"
    print(f"  {status} {keyword}: {found}")

# Look at the experience section
print("\n" + "-" * 80)
print("EXPERIENCE SECTION ANALYSIS:")
print("-" * 80)

if "PROFESSIONAL EXPERIENCE" in text:
    idx = text.find("PROFESSIONAL EXPERIENCE")
    exp_section = text[idx:idx+1000]
    print(f"\nExperience section found at position {idx}")
    print(f"Content: {exp_section}")
else:
    print("❌ PROFESSIONAL EXPERIENCE section not found")

# Look at the certifications section
print("\n" + "-" * 80)
print("CERTIFICATIONS SECTION ANALYSIS:")
print("-" * 80)

if "CERTIFICATIONS" in text:
    idx = text.find("CERTIFICATIONS")
    cert_section = text[idx:idx+500]
    print(f"\nCertifications section found at position {idx}")
    print(f"Content: {cert_section}")
else:
    print("❌ CERTIFICATIONS section not found")

# Full extract_all test
print("\n" + "=" * 80)
print("FULL EXTRACT_ALL TEST")
print("=" * 80)

full_data = ComprehensiveResumeExtractor.extract_all(text)
print(f"\nExtracted keys: {list(full_data.keys())}")
print(f"\nKey extracted fields:")
print(f"  - current_role: {full_data.get('current_role')}")
print(f"  - years_of_experience: {full_data.get('years_of_experience')}")
print(f"  - full_name: {full_data.get('full_name')}")
print(f"  - location: {full_data.get('location')}")
print(f"  - skills count: {len(full_data.get('skills', []))}")
print(f"  - certifications count: {len(full_data.get('certifications', []))}")
print(f"  - experience_history count: {len(full_data.get('experience_history', []))}")
print(f"  - education_history count: {len(full_data.get('education_history', []))}")

db.close()

print("\n" + "=" * 80)
print("DEBUG COMPLETE")
print("=" * 80)
