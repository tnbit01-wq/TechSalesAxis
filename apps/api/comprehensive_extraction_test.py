#!/usr/bin/env python3
"""Comprehensive test of all extraction improvements."""
import sys
sys.path.insert(0, 'src')
from services.comprehensive_extractor import ComprehensiveResumeExtractor

# Comprehensive sample resume with all sections
sample = """MITHUN KAVERIAPPA
Phone: +91-9876543210 | Email: mithun.kav@example.com | LinkedIn: linkedin.com/in/mithun-k

EXPERIENCE

Senior Software Engineer | TechCorp India Pvt Ltd | Bangalore | Jan 2022 - Present
- Led development of microservices architecture managing 3 teams
- Improved application performance by 40% through optimization
- Mentored 5 junior developers

Software Engineer | CloudTech Solutions | Bangalore | Jul 2019 - Dec 2021
- Developed REST APIs using Django and Python
- Built reactive UI components with Vue.js
- Improved data pipeline efficiency by 25%

Junior Developer | StartupXYZ | Bangalore | Jun 2017 - Jun 2019
- Built frontend features using Vue.js
- Fixed 100+ production bugs
- Participated in code reviews

EDUCATION

M.Tech | Indian Institute of Technology (IIT) Bombay | Graduated: 2019
GPA: 8.2/10 | Focus: Software Systems

B.Tech | Visvesvaraya Technological University (VTU) Bangalore | Graduated: 2017
GPA: 7.8/10 | Focus: Computer Science

TECHNICAL SKILLS

Programming Languages: Python, JavaScript, Java, C++, TypeScript
Web Development: Django, Vue.js, React, REST APIs, GraphQL
Databases: MongoDB, PostgreSQL, MySQL, Firebase
Cloud & DevOps: GCP, AWS, Docker, Kubernetes, Jenkins
Tools & Platforms: Git, Linux, Linux, JIRA, CI/CD Pipelines

CERTIFICATIONS

AWS Certified Solutions Architect - Professional | 2023
Google Cloud Professional Data Engineer | 2022
Docker Certified Associate | 2020
Certified Kubernetes Administrator in progress

LANGUAGES

English - Fluent
Kannada - Native
Hindi - Intermediate

"""

def test_extraction():
    """Test all extraction methods."""
    print("=" * 100)
    print("COMPREHENSIVE EXTRACTION TEST - ALL METHODS")
    print("=" * 100)
    
    # Test name extraction
    name = ComprehensiveResumeExtractor.extract_name(sample)
    print(f"\n[NAME] {name}")
    assert name and "MITHUN" in name, f"Name extraction failed: {name}"
    print("✓ PASS: Name extraction")
    
    # Test contact extraction
    contact = ComprehensiveResumeExtractor.extract_contact(sample)
    print(f"\n[CONTACT]")
    for key, value in contact.items():
        if value:
            print(f"  {key}: {value}")
    assert contact.get('email') and contact.get('phone'), f"Contact extraction failed: {contact}"
    print("✓ PASS: Contact extraction")
    
    # Test location extraction
    location = ComprehensiveResumeExtractor.extract_location(sample)
    print(f"\n[LOCATION] {location}")
    assert location and "Bangalore" in location, f"Location extraction failed: {location}"
    print("✓ PASS: Location extraction")
    
    # Test education extraction
    education = ComprehensiveResumeExtractor.extract_education(sample)
    print(f"\n[EDUCATION] {len(education)} entries")
    for edu in education:
        print(f"  - {edu.get('degree')} from {edu.get('institution')} ({edu.get('year')})")
    assert len(education) >= 2, f"Education extraction failed: {education}"
    print("✓ PASS: Education extraction")
    
    # Test experience extraction
    experience, current_role, previous_role = ComprehensiveResumeExtractor.extract_experience(sample)
    print(f"\n[EXPERIENCE] {len(experience)} entries")
    for i, exp in enumerate(experience, 1):
        print(f"  {i}. {exp['position']} at {exp['company']} ({exp.get('start_date')} - {exp.get('end_date')})")
    print(f"  Current Role: {current_role}")
    print(f"  Previous Role: {previous_role}")
    assert len(experience) >= 3, f"Experience extraction failed: {experience}"
    assert current_role and "Senior" in current_role, f"Current role extraction failed: {current_role}"
    print("✓ PASS: Experience extraction")
    
    # Test skills extraction
    skills = ComprehensiveResumeExtractor.extract_skills(sample)
    print(f"\n[SKILLS] {len(skills)} skills extracted")
    print(f"  Sample: {', '.join(list(skills)[:15])}")
    assert len(skills) >= 15, f"Skills extraction failed: only {len(skills)} extracted"
    print("✓ PASS: Skills extraction")
    
    # Test certifications extraction
    certs = ComprehensiveResumeExtractor.extract_certifications(sample)
    print(f"\n[CERTIFICATIONS] {len(certs)} certs")
    for cert in certs:
        print(f"  - {cert['name']} ({cert.get('year')})")
    assert len(certs) >= 3, f"Certifications extraction failed: {certs}"
    print("✓ PASS: Certifications extraction")
    
    # Test extract_all
    print(f"\n[EXTRACT_ALL] Testing full extraction...")
    all_data = ComprehensiveResumeExtractor.extract_all(sample)
    
    # Verify expected fields in extract_all
    expected_fields = ['full_name', 'phone_number', 'location', 'years_of_experience', 
                      'skills', 'education_history', 'experience_history', 'certifications', 'links', 'raw_text']
    for field in expected_fields:
        assert field in all_data, f"Missing field in extract_all: {field}"
        if field != 'raw_text':  # Don't print raw_text
            print(f"  {field}: {str(all_data[field])[:60]}...")
        else:
            print(f"  {field}: {len(all_data[field])} characters")
    
    print("✓ PASS: extract_all working")
    
    print("\n" + "=" * 100)
    print("ALL TESTS PASSED - EXTRACTION SERVICE READY FOR PRODUCTION")
    print("=" * 100)
    
    return all_data

if __name__ == "__main__":
    try:
        data = test_extraction()
        print(f"\nExtraction Summary:")
        print(f"  - Name: {data['full_name']}")
        print(f"  - Experience entries: {len(data['experience_history'])}")
        print(f"  - Education entries: {len(data['education_history'])}")
        print(f"  - Skills: {len(data['skills'])}")
        print(f"  - Certifications: {len(data['certifications'])}")
        sys.exit(0)
    except AssertionError as e:
        print(f"\nTEST FAILED: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\nERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
