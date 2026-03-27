"""
Test UTF-8 fix for corrupted dash characters
"""
import sys
sys.path.insert(0, 'src')

from services.comprehensive_extractor import ComprehensiveResumeExtractor

# Simulate Sonam's experience section with corrupted UTF-8
corrupted_text = """
PROFESSIONAL EXPERIENCE

Business Development & Client Relations ÔÇô Lasani 3D (Remote)
2024 ÔÇô Present
ÔÇó Overseeing client communication, proposal coordination

Business Sales Manager ÔÇô AM Webtech Pvt. Ltd., Indore (Hybrid)
2021 ÔÇô 2023
ÔÇó Managed distributed sales team

Associate Sales Executive ÔÇô XTRIM Global Solutions
2019 ÔÇô 2021
ÔÇó Research and lead generation

English Communication Trainer ÔÇô CBSE Schools
2009 ÔÇô 2019
ÔÇó Trained students in communication
"""

print("=" * 80)
print("UTF-8 CORRUPTION FIX TEST")
print("=" * 80)

print("\n1. CHECKING FOR CORRUPTED DASH CHARACTERS:")
print(f"   Contains 'ÔÇô': {('ÔÇô' in corrupted_text)}")
print(f"   Contains '–': {('–' in corrupted_text)}")

print("\n2. EXTRACTING EXPERIENCE WITH CORRUPTED TEXT:")
exp_list, current_role, previous_role = ComprehensiveResumeExtractor.extract_experience(corrupted_text)

print(f"   Jobs found: {len(exp_list)}")
print(f"   Current role: {current_role}")
print(f"   Previous role: {previous_role}")

print("\n3. JOB DETAILS:")
for i, job in enumerate(exp_list, 1):
    print(f"\n   Job {i}:")
    print(f"     Position: {job.get('position')}")
    print(f"     Company: {job.get('company')}")
    print(f"     Start: {job.get('start_date')}")
    print(f"     End: {job.get('end_date')}")

print("\n" + "=" * 80)
print("VALIDATION")
print("=" * 80)

# Expected: 4 jobs, all with proper details
expected_jobs = 4
success = True

if len(exp_list) != expected_jobs:
    print(f"❌ FAIL: Expected {expected_jobs} jobs, got {len(exp_list)}")
    success = False
else:
    print(f"✓ Jobs count correct: {len(exp_list)}")

if current_role != "Business Development & Client Relations":
    print(f"❌ FAIL: Current role should be 'Business Development & Client Relations', got '{current_role}'")
    success = False
else:
    print(f"✓ Current role correct: {current_role}")

# Check first job has dates
if exp_list and exp_list[0].get('start_date') is None:
    print(f"❌ FAIL: First job should have start_date")
    success = False
else:
    print(f"✓ First job has dates: {exp_list[0].get('start_date')} – {exp_list[0].get('end_date')}")

if success and len(exp_list) == expected_jobs:
    print("\n✓ UTF-8 FIX WORKING CORRECTLY!")
else:
    print("\n✗ UTF-8 FIX NOT WORKING - NEEDS DEBUGGING")
