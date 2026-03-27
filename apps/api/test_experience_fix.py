#!/usr/bin/env python3
"""Quick test for experience extraction fix."""
import sys
sys.path.insert(0, 'src')

from services.comprehensive_extractor import ComprehensiveResumeExtractor
import os

# Check if diagnose_extraction.py exists
if os.path.exists('diagnose_extraction.py'):
    with open('diagnose_extraction.py', 'r') as f:
        content = f.read()
        # Extract the sample resume text from diagnose_extraction.py
        start = content.find('SAMPLE_RESUME = r"""')
        end = content.find('"""', start + 20)
        if start > 0 and end > start:
            sample_resume = content[start+20:end]
            
            print("=" * 80)
            print("TESTING EXPERIENCE EXTRACTION FIX")
            print("=" * 80)
            
            # Test extract_location
            location = ComprehensiveResumeExtractor.extract_location(sample_resume)
            print(f"\n[LOCATION] {location}")
            
            # Test extract_education
            education = ComprehensiveResumeExtractor.extract_education(sample_resume)
            print(f"\n[EDUCATION]")
            for edu in education:
                print(f"  - {edu.get('degree')} from {edu.get('institution')} ({edu.get('year')})")
            
            # Test extract_skills
            skills = ComprehensiveResumeExtractor.extract_skills(sample_resume)
            print(f"\n[SKILLS] {len(skills)} skills found")
            print(f"  Sample: {', '.join(skills[:10])}")
            
            # Test extract_name
            name = ComprehensiveResumeExtractor.extract_name(sample_resume)
            print(f"\n[NAME] {name}")
            
            # Test extract_contact
            contact = ComprehensiveResumeExtractor.extract_contact(sample_resume)
            print(f"\n[CONTACT]")
            for key, value in contact.items():
                if value:
                    print(f"  {key}: {value}")
            
            # Test extract_experience - THE FIX
            experience, current_role, previous_role = ComprehensiveResumeExtractor.extract_experience(sample_resume)
            print(f"\n[EXPERIENCE] {len(experience)} entries found")
            for i, exp in enumerate(experience, 1):
                print(f"  {i}. {exp.get('position')} at {exp.get('company')} ({exp.get('start_date')} - {exp.get('end_date')})")
            
            print(f"\n[CURRENT ROLE] {current_role}")
            print(f"[PREVIOUS ROLE] {previous_role}")
            
            # Test extract_certifications
            certs = ComprehensiveResumeExtractor.extract_certifications(sample_resume)
            print(f"\n[CERTIFICATIONS] {len(certs)} certs found")
            for cert in certs:
                print(f"  - {cert.get('name')} ({cert.get('issuer')}, {cert.get('year')})")
            
            print("\n" + "=" * 80)
            print("TEST COMPLETE")
            print("=" * 80)
        else:
            print("Could not find sample resume in diagnose_extraction.py")
else:
    print("diagnose_extraction.py not found")
