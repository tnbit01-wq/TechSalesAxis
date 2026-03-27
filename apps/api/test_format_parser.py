"""
Test the new format-agnostic experience parser
"""
import sys
sys.path.insert(0, 'src')

from services.comprehensive_extractor import ComprehensiveResumeExtractor

# Test data - dash-separated format (Sonam's resume format)
test_experience = """
PROFESSIONAL EXPERIENCE

Business Development & Client Relations – Lasani 3D (Remote)
Jun 2024 – Present
Overseeing client communication, proposal coordination, and project follow-ups for architectural visualization and CAD design projects.
Supporting international clients with timely updates, clarifications, and documentation to ensure smooth design workflows.
Collaborating closely with the design team to align client requirements with deliverables, improving turnaround time and client satisfaction.

Business Sales Manager – AM Webtech Pvt. Ltd., Indore (Hybrid)
Feb 2021 – Mar 2023
Managed a distributed sales team and streamlined sales operations remotely.
Negotiated with clients and vendors, resulting in a 30% uplift in business volume.
Strengthened client relations, enhancing retention and lifetime value.

Associate Sales Executive – XTRIM Global Solutions
Jan 2019 – Dec 2020
Researched new market opportunities, generating qualified leads across online platforms.
Built and sustained client relationships, resulting in consistent revenue generation.
"""

print("=" * 80)
print("TESTING DASH-SEPARATED FORMAT PARSER")
print("=" * 80)

# Test extract_experience with the full text
experience_list, current_role, previous_role = ComprehensiveResumeExtractor.extract_experience(test_experience)

print("\n1. EXTRACTED EXPERIENCE:")
for i, exp in enumerate(experience_list, 1):
    print(f"\nJob {i}:")
    print(f"  Position: {exp.get('position')}")
    print(f"  Company: {exp.get('company')}")
    print(f"  Start Date: {exp.get('start_date')}")
    print(f"  End Date: {exp.get('end_date')}")

print(f"\n2. CURRENT ROLE: {current_role}")
print(f"3. PREVIOUS ROLE: {previous_role}")

print("\n" + "=" * 80)
print("EXPECTED vs ACTUAL")
print("=" * 80)

expectations = [
    {
        'position': 'Business Development & Client Relations',
        'company': 'Lasani 3D',
        'start_date': 'Jun 2024',
        'end_date': 'Present'
    },
    {
        'position': 'Business Sales Manager',
        'company': 'AM Webtech Pvt. Ltd.',  # Note: test data includes ", Indore" after company
        'start_date': 'Feb 2021',
        'end_date': 'Mar 2023'
    },
    {
        'position': 'Associate Sales Executive',
        'company': 'XTRIM Global Solutions',
        'start_date': 'Jan 2019',
        'end_date': 'Dec 2020'
    }
]

# NOTE: Accuracy check is lenient - if company includes location after comma, still pass
# because both "AM Webtech Pvt. Ltd." and "AM Webtech Pvt. Ltd., Indore" are acceptable
for i, (expected, actual) in enumerate(zip(expectations, experience_list), 1):
    print(f"\nJob {i}:")
    for key in ['position', 'company', 'start_date', 'end_date']:
        exp_val = expected[key]
        act_val = actual.get(key)
        
        # Special case: if company, allow match even if actual has location appended
        if key == 'company':
            match = (exp_val == act_val) or act_val.startswith(exp_val + ",")
        else:
            match = exp_val == act_val
        
        match_char = "✓" if match else "✗"
        print(f"  {match_char} {key}:")
        print(f"      Expected: {exp_val}")
        print(f"      Actual:   {act_val}")

print("\n" + "=" * 80)
print("ACCURACY CALCULATION")
print("=" * 80)

total_fields = 0
correct_fields = 0

for expected, actual in zip(expectations, experience_list):
    for key in ['position', 'company', 'start_date', 'end_date']:
        total_fields += 1
        exp_val = expected.get(key)
        act_val = actual.get(key)
        
        # Special case: if company, allow match even if actual has location appended
        if key == 'company':
            match = (exp_val == act_val) or (act_val and act_val.startswith(exp_val + ","))
        else:
            match = exp_val == act_val
        
        if match:
            correct_fields += 1

accuracy = (correct_fields / total_fields * 100) if total_fields > 0 else 0
print(f"Fields Correct: {correct_fields}/{total_fields}")
print(f"Accuracy: {accuracy:.1f}%")
print(f"Target: 100% (all fields must match)")

if accuracy == 100:
    print("\n✓ PARSER TEST PASSED!")
else:
    print(f"\n✗ PARSER TEST FAILED - Only {accuracy:.1f}% accurate")
