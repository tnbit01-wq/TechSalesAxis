#!/usr/bin/env python3
"""
Test script for new implementations:
1. Years of experience in JSON
2. Improved phone extraction
3. IT/Tech experience filtering
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.tasks.bulk_upload_tasks import _calculate_it_tech_experience, _extract_phone_number
import json

print("=" * 100)
print("TESTING NEW IMPLEMENTATIONS")
print("=" * 100)

# ============================================================================
# TEST 1: IT/Tech Experience Filtering
# ============================================================================
print("\n[TEST 1] IT/Tech Experience Filtering")
print("-" * 100)

test_cases = [
    # (total_years, current_role, skills, expected_result, description)
    (6, "Software Developer", ["Python", "Java"], 6, "IT Developer - Full experience counted"),
    (16, "Manager - Marketing", ["Management", "Sales"], 0, "Non-IT Manager - Filtered to 0"),
    (3, "Python Developer", ["Python", "JavaScript"], 3, "Junior Developer - Full experience"),
    (10, "Teacher", ["Communication"], 0, "Teacher - Filtered to 0"),
    (5, "Sales Engineer", ["SQL", "Cloud"], 5, "Tech Sales - Full experience counted"),
    (8, "HR Manager", ["Recruitment"], 0, "HR - Non-IT filtered"),
    (4, "Business Development Manager - Tech", ["AWS", "Sales"], 4, "Tech Sales Manager - Counted"),
    (12, "Finance Manager", ["Excel", "Analysis"], 0, "Finance - Filtered despite analysis"),
    (2, "Junior Developer", ["JavaScript", "React"], 2, "Fresher Developer - Counted"),
    (7, "Data Analyst", ["SQL", "Python"], 7, "Data role - Counted"),
]

print(f"\n{'Test Case':<50} {'Expected':<10} {'Got':<10} {'Result'}")
print("-" * 100)

passed = 0
failed = 0

for total_years, role, skills, expected, description in test_cases:
    result = _calculate_it_tech_experience(total_years, role, skills, [])
    status = "✓ PASS" if result == expected else "✗ FAIL"
    
    if result == expected:
        passed += 1
    else:
        failed += 1
    
    print(f"{description:<50} {expected:<10} {result:<10} {status}")

print(f"\nIT/Tech Experience Filter - Passed: {passed}/{len(test_cases)}")

# ============================================================================
# TEST 2: Improved Phone Extraction
# ============================================================================
print("\n[TEST 2] Improved Phone Extraction")
print("-" * 100)

phone_test_cases = [
    ("+91 98765 43210", "9876543210", "Standard Indian format with spaces"),
    ("+91-9876543210", "9876543210", "Indian format with dash"),
    ("+919876543210", "9876543210", "Indian format no space"),
    ("91 9876543210", "9876543210", "91 prefix with space"),
    ("(987) 654-3210", "9876543210", "US format with parentheses"),
    ("Phone: +91 98765 43210", "9876543210", "With 'Phone:' keyword"),
    ("Contact: 9876543210", "9876543210", "With 'Contact:' keyword"),
    ("Mobile +91 9876543210", "9876543210", "With 'Mobile' keyword"),
    ("", None, "Empty string"),
    (None, None, "None input"),
]

print(f"\n{'Test Case':<50} {'Expected':<20} {'Got':<20} {'Result'}")
print("-" * 100)

phone_passed = 0
phone_failed = 0

for phone_text, expected, description in phone_test_cases:
    if phone_text is None:
        result = _extract_phone_number(None)
    else:
        result = _extract_phone_number(phone_text)
    
    # For comparison, normalize both
    exp_digits = ''.join(c for c in (expected or '') if c.isdigit())
    res_digits = ''.join(c for c in (result or '') if c.isdigit())
    
    status = "✓ PASS" if (exp_digits == res_digits) else "✗ FAIL"
    
    if exp_digits == res_digits:
        phone_passed += 1
    else:
        phone_failed += 1
    
    print(f"{description:<50} {str(expected):<20} {str(result):<20} {status}")

print(f"\nPhone Extraction - Passed: {phone_passed}/{len(phone_test_cases)}")

# ============================================================================
# TEST 3: Experience Tier Calculation
# ============================================================================
print("\n[TEST 3] Experience Tier Calculation (Based on IT/Tech Filtered Years)")
print("-" * 100)

def calculate_tier(it_tech_years):
    if it_tech_years < 2:
        return 'fresher'
    elif it_tech_years <= 5:
        return 'mid'
    elif it_tech_years <= 10:
        return 'senior'
    else:
        return 'leadership'

tier_test_cases = [
    (0, "fresher", "No IT/Tech experience"),
    (1, "fresher", "1 year IT/Tech"),
    (2, "mid", "2 years IT/Tech"),
    (5, "mid", "5 years IT/Tech"),
    (6, "senior", "6 years IT/Tech"),
    (10, "senior", "10 years IT/Tech"),
    (11, "leadership", "11 years IT/Tech"),
    (15, "leadership", "15 years IT/Tech"),
]

print(f"\n{'IT/Tech Years':<20} {'Expected Tier':<20} {'Got Tier':<20} {'Result'}")
print("-" * 100)

tier_passed = 0

for years, expected_tier, description in tier_test_cases:
    got_tier = calculate_tier(years)
    status = "✓ PASS" if got_tier == expected_tier else "✗ FAIL"
    
    if got_tier == expected_tier:
        tier_passed += 1
    
    print(f"{description:<20} {expected_tier:<20} {got_tier:<20} {status}")

print(f"\nExperience Tier - Passed: {tier_passed}/{len(tier_test_cases)}")

# ============================================================================
# SUMMARY
# ============================================================================
print("\n" + "=" * 100)
print("SUMMARY")
print("=" * 100)

total_tests = len(test_cases) + len(phone_test_cases) + len(tier_test_cases)
total_passed = passed + phone_passed + tier_passed

print(f"\nIT/Tech Experience Filtering: {passed}/{len(test_cases)} passed")
print(f"Phone Number Extraction: {phone_passed}/{len(phone_test_cases)} passed")
print(f"Experience Tier Calculation: {tier_passed}/{len(tier_test_cases)} passed")
print(f"\nOVERALL: {total_passed}/{total_tests} tests passed")

if total_passed == total_tests:
    print("\n✓ ALL TESTS PASSED! Ready to deploy.")
    sys.exit(0)
else:
    print(f"\n✗ {total_tests - total_passed} TESTS FAILED - Review before deploying.")
    sys.exit(1)
