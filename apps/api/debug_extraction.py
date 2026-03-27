"""
Debug Resume Parsing - Check what's missing
"""

import os
import sys
import io

# Set stdout to UTF-8 encoding to handle Unicode characters
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

USER_ID = "c32e36c5-f2ed-40ba-a0a2-7819b7721290"

# Get the resume
resume = db.query(ResumeData).filter(ResumeData.user_id == USER_ID).first()

if not resume or not resume.raw_text:
    print("No resume found")
    sys.exit(1)

print("=" * 80)
print("RESUME RAW TEXT")
print("=" * 80)
print(resume.raw_text)
print("\n" + "=" * 80)
print("EXTRACTION TEST")
print("=" * 80)

# Test extraction methods
text = resume.raw_text

print("\n1. YEARS OF EXPERIENCE EXTRACTION:")
years = ComprehensiveResumeExtractor.extract_experience_years(text)
print(f"   Result: {years}")

print("\n2. CURRENT ROLE EXTRACTION:")
exp_list, current_role, previous_role = ComprehensiveResumeExtractor.extract_experience(text)
print(f"   Current Role: {current_role}")
print(f"   Previous Role: {previous_role}")
print(f"   Experience Count: {len(exp_list)}")

print("\n3. CERTIFICATIONS EXTRACTION:")
certs = ComprehensiveResumeExtractor.extract_certifications(text)
print(f"   Certifications Found: {len(certs)}")
for cert in certs:
    print(f"     - {cert}")

print("\n4. SKILLS EXTRACTION:")
skills = ComprehensiveResumeExtractor.extract_skills(text)
print(f"   Skills Found: {len(skills)}")
print(f"   Skills: {skills[:5]}...")

print("\n5. LOCATION EXTRACTION:")
location = ComprehensiveResumeExtractor.extract_location(text)
print(f"   Location: {location}")

print("\n" + "=" * 80)
print("ISSUE ANALYSIS")
print("=" * 80)

# Check if "5+" appears in the text
if "5+" in text.lower():
    print("\n✓ Found '5+' in resume text")
else:
    print("\n❌ '5+' not found in resume text")

# Check for experience word
if "experience" in text.lower():
    print("✓ Found 'experience' keyword")
    # Show context
    idx = text.lower().find("experience")
    context_start = max(0, idx - 50)
    context_end = min(len(text), idx + 100)
    print(f"  Context: ...{text[context_start:context_end]}...")
else:
    print("❌ 'experience' keyword not found")

# Check for certification patterns
if "certification" in text.lower() or "certified" in text.lower():
    print("✓ Found certification keywords")
else:
    print("❌ No certification keywords found")

# Check all sections
print("\n" + "-" * 80)
print("TEXT SECTIONS:")
print("-" * 80)
sections = text.split("---")
for i, section in enumerate(sections):
    print(f"\nSection {i+1} ({len(section)} chars):")
    print(f"{section[:150]}...")

db.close()
