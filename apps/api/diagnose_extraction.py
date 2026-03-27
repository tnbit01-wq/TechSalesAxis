"""
Diagnostic tool to check resume extraction for specific user
Queries extraction output and compares with expected data
mithunkaveriappa13@gmail.com
"""
import json
import os
from pathlib import Path
from src.services.comprehensive_extractor import ComprehensiveResumeExtractor

print("[*] Resume Extraction Diagnostic Tool")
print("="*80)
print()

# Since direct DB access is restricted by VPC, we'll:
# 1. Show what extraction methods produce
# 2. Check ResumeService code for issues
# 3. Show what SHOULD be stored in database

# For demonstration, let's test with a realistic resume
sample_resume_text = """
MITHUN KAVERIAPPA
Bangalore, India
mithunkaveriappa13@gmail.com
+91-9876543210 | LinkedIn: linkedin.com/in/mithun-k | Portfolio: mithundev.io

PROFESSIONAL SUMMARY
Experienced Software Engineer with 6+ years of expertise in full-stack development, cloud architecture, and team leadership. Proven track record of delivering high-impact solutions in fast-paced environments. Currently seeking Senior/Lead positions focused on mentoring and technical strategy.

EXPERIENCE

Senior Software Engineer | TechCorp India Pvt Ltd | Bangalore
June 2023 - Present (2 years 9 months)
• Led development of microservices architecture serving 5M+ users
• Mentored team of 8 engineers, improving code quality by 40%
• Implemented CI/CD pipeline reducing deployment time by 65%
• Technologies: Python, FastAPI, PostgreSQL, AWS, Kubernetes, Docker

Software Engineer | StartupXYZ | Bangalore  
January 2021 - May 2023 (2 years 5 months)
• Built REST APIs handling 100k+ requests/day
• Optimized database queries reducing latency by 50%
• Implemented real-time notification system using WebSockets
• Technologies: Node.js, React, PostgreSQL, Redis, AWS

Junior Developer | WebAgency Co | Bangalore
July 2019 - December 2020 (1 year 6 months)
• Developed client-facing web applications
• Participated in Agile development with 2-week sprints
• Fixed 200+ bugs and improved application performance
• Technologies: JavaScript, Vue.js, MongoDB

EDUCATION

Master of Technology (M.Tech) - Computer Science
Indian Institute of Technology (IIT) Bombay | Graduated: 2019
CGPA: 8.2/10

Bachelor of Technology (B.Tech) - Information Technology  
Visvesvaraya Technological University (VTU) Bangalore | Graduated: 2017
CGPA: 8.5/10

TECHNICAL SKILLS
Languages: Python, JavaScript, Java, C++, SQL
Frontend: React, Vue.js, HTML5, CSS3, Tailwind CSS
Backend: FastAPI, Django, Node.js/Express, Spring Boot
Databases: PostgreSQL, MongoDB, Redis, Elasticsearch
Cloud: AWS (EC2, S3, Lambda, RDS), Azure, GCP
DevOps: Docker, Kubernetes, CI/CD, GitHub Actions, Jenkins
Tools & Platforms: Git, JIRA, Jenkins, Datadog, Slack

CERTIFICATIONS
AWS Certified Solutions Architect - Professional | 2023
Certified Kubernetes Administrator (CKA) | 2022
Google Cloud Associate Cloud Engineer | 2021

PROJECTS & ACHIEVEMENTS
Mobile Payment Platform
Architected microservices for payment processing handling $10M+ monthly transactions
• Led team of 5, reduced transaction processing time from 5s to 1s
• Result: 99.95% uptime, handled Black Friday traffic spike of 10x

AI-Powered Recommendation Engine  
Built ML-powered personalization system increasing user engagement by 35%
• Implemented feature engineering pipeline processing 1M+ events/day
• Results: 3% increase in conversion rate, $2M+ revenue impact

LANGUAGES
English: Fluent | Hindi: Native | Kannada: Conversational
"""

print("[1] TESTING COMPREHENSIVE EXTRACTOR")
print("-"*80)

extractor = ComprehensiveResumeExtractor()
result = extractor.extract_all(sample_resume_text)

print("\n[EXTRACTED DATA]:\n")

# Required fields in candidate_profiles table
candidate_profile_fields = {
    "full_name": result.get("full_name"),
    "phone_number": result.get("phone_number"),
    "location": result.get("location"),
    "current_role": result.get("current_role"),
    "years_of_experience": result.get("years_of_experience"),
    "experience_band": result.get("experience_band"),
    "skills": result.get("skills", []),
    "education_history": result.get("education_history", []),
    "experience_history": result.get("experience_history", []),
    "certifications": result.get("certifications", []),
}

print("▸ CANDIDATE_PROFILES TABLE FIELDS:")
for field, value in candidate_profile_fields.items():
    if isinstance(value, list):
        print(f"  {field:25} : {len(value)} items")
        if value:
            for i, item in enumerate(value[:2], 1):
                print(f"    [{i}] {item}")
            if len(value) > 2:
                print(f"    ... and {len(value)-2} more")
    elif isinstance(value, dict):
        print(f"  {field:25} : {json.dumps(value, indent=2)}")
    else:
        print(f"  {field:25} : {value}")

print("\n" + "-"*80)
print("\n▸ RESUME_DATA TABLE FIELDS:")

resume_data_fields = {
    "raw_text_length": len(result.get("raw_text", "")),
    "timeline_entries": len(result.get("experience_history", [])),
    "education_entries": len(result.get("education_history", [])),
    "skills": result.get("skills", []),
    "career_gaps": result.get("career_gaps"),
}

for field, value in resume_data_fields.items():
    if isinstance(value, list) and field == "skills":
        print(f"  {field:25} : {len(value)} items - {value[:5]}")
    else:
        print(f"  {field:25} : {value}")

print("\n" + "="*80)
print("\n[2] CHECKING FOR MISSING/INCOMPLETE DATA")
print("-"*80)

issues = []

# Check critical fields
if not result.get("full_name"):
    issues.append("❌ NAME not extracted")
else:
    print(f"✓ Name extracted: {result['full_name']}")

if not result.get("phone_number"):
    issues.append("❌ PHONE not extracted")
else:
    print(f"✓ Phone extracted: {result['phone_number']}")

if not result.get("location"):
    issues.append("❌ LOCATION not extracted")
else:
    print(f"✓ Location extracted: {result['location']}")

if not result.get("years_of_experience"):
    issues.append("❌ YEARS_OF_EXPERIENCE not extracted")
else:
    print(f"✓ Years of experience: {result['years_of_experience']}")

if not result.get("experience_history") or len(result.get("experience_history", [])) == 0:
    issues.append("⚠ EXPERIENCE_HISTORY empty - check extract_experience()")
else:
    print(f"✓ Experience entries: {len(result['experience_history'])}")

if not result.get("education_history") or len(result.get("education_history", [])) == 0:
    issues.append("⚠ EDUCATION_HISTORY empty - check extract_education()")
else:
    print(f"✓ Education entries: {len(result['education_history'])}")

if not result.get("skills") or len(result.get("skills", [])) == 0:
    issues.append("⚠ SKILLS empty - check extract_skills()")
else:
    print(f"✓ Skills found: {len(result['skills'])}")

if not result.get("current_role"):
    issues.append("⚠ CURRENT_ROLE not extracted - check extract_experience()")
else:
    print(f"✓ Current role: {result['current_role']}")

print("\n" + "-"*80)
if issues:
    print("\n[ISSUES FOUND]:")
    for issue in issues:
        print(f"  {issue}")
else:
    print("\n✓ All critical fields extracted successfully!")

print("\n" + "="*80)
print("\n[3] DETAILED FIELD ANALYSIS")
print("-"*80)

print("\nEXPERIENCE HISTORY:")
if result.get("experience_history"):
    for i, exp in enumerate(result["experience_history"], 1):
        print(f"\n  Entry {i}:")
        for key, val in exp.items():
            print(f"    {key}: {val}")
else:
    print("  [EMPTY] - May need to improve extract_experience()")

print("\n\nEDUCATION HISTORY:")
if result.get("education_history"):
    for i, edu in enumerate(result["education_history"], 1):
        print(f"\n  Entry {i}:")
        for key, val in edu.items():
            print(f"    {key}: {val}")
else:
    print("  [EMPTY] - May need to improve extract_education()")

print("\n\nSKILLS:")
if result.get("skills"):
    print(f"  Count: {len(result['skills'])}")
    for i, skill in enumerate(result["skills"][:10], 1):
        print(f"    {i}. {skill}")
    if len(result["skills"]) > 10:
        print(f"    ... and {len(result['skills'])-10} more")
else:
    print("  [EMPTY] - May need to improve extract_skills()")

print("\n" + "="*80)
