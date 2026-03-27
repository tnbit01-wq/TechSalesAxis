#!/usr/bin/env python3
"""Quick inline test of experience extraction."""
import sys
sys.path.insert(0, 'src')
from services.comprehensive_extractor import ComprehensiveResumeExtractor

# Inline sample resume
sample = """MITHUN KAVERIAPPA
Phone: +91-9876543210 | Email: mithun@example.com | LinkedIn: linkedin.com/in/mithun

EXPERIENCE

Senior Software Engineer | TechCorp India Pvt Ltd | Bangalore | Jan 2022 - Present
- Led development of microservices architecture
- Mentored 5 junior developers

Software Engineer | CloudTech Solutions | Bangalore | Jul 2019 - Dec 2021
- Developed REST APIs using Django
- Improved application performance by 40%

Junior Developer | StartupXYZ | Bangalore | Jun 2017 - Jun 2019
- Built frontend using Vue.js
- Fixed 100+ bugs

EDUCATION

M.Tech | Indian Institute of Technology (IIT) Bombay | Graduated: 2019
B.Tech | Visvesvaraya Technological University (VTU) Bangalore | Graduated: 2017

SKILLS

Programming: Python, JavaScript, Java, C++
Web: Django, Vue, REST APIs, MongoDB
Cloud: GCP, AWS, Docker, Kubernetes
Tools: Git, Jenkins, CI/CD, Linux

CERTIFICATIONS

AWS Certified Solutions Architect | 2023
Google Cloud Professional | 2022
Docker Certified Associate | 2020
"""

print("=" * 80)
print("QUICK EXTRACTION TEST")
print("=" * 80)

# Test experience
exp, current, prev = ComprehensiveResumeExtractor.extract_experience(sample)
print(f"\nEXPERIENCE ENTRIES: {len(exp)}")
for i, e in enumerate(exp, 1):
    print(f"  {i}. {e['position']} at {e['company']}")

print(f"\nCURRENT ROLE: {current}")
print(f"PREVIOUS ROLE: {prev}")

# Test education
edu = ComprehensiveResumeExtractor.extract_education(sample)
print(f"\nEDUCATION: {len(edu)} entries")
for e in edu:
    print(f"  - {e['degree']} from {e['institution']} ({e['year']})")

# Test skills
skills = ComprehensiveResumeExtractor.extract_skills(sample)
print(f"\nSKILLS: {len(skills)} skills")
print(f"  Sample: {', '.join(list(skills)[:5])}")

# Test certifications
certs = ComprehensiveResumeExtractor.extract_certifications(sample)
print(f"\nCERTIFICATIONS: {len(certs)} certs")
for c in certs:
    print(f"  - {c['name']} ({c['issuer']}, {c['year']})")

print("\n" + "=" * 80)
