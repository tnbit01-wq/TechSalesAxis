"""
Test suite for resume service parsing fixes:
1. Years of experience extraction and filtering
2. Phone number extraction 
3. IT/Tech experience domain filtering
"""

import sys
sys.path.insert(0, '/Users/Admin/Desktop/Projects/TALENTFLOW/apps/api')

from src.services.resume_service import (
    _extract_phone_number, 
    _calculate_it_tech_experience, 
    _postprocess_parsed_data
)

def test_phone_extraction():
    """Test phone number extraction with various formats"""
    test_cases = [
        ("Contact: +91 98765 43210", "9876543210"),  # +91 XXXXX XXXXX
        ("Phone: +91-9876543210", "9876543210"),     # +91-XXXXXXXXXX
        ("Mobile +919876543210", "9876543210"),      # +91XXXXXXXXXX
        ("Phone: (555) 123-4567", None),             # Will look for 10 digits
    ]
    
    passed = 0
    for text, expected in test_cases:
        result = _extract_phone_number(text)
        if expected is None or result == expected:
            print(f"  ✓ {text[:30]:<30} → {result}")
            passed += 1
        else:
            print(f"  ✗ {text[:30]:<30} → {result} (expected {expected})")
    
    print(f"Phone extraction: {passed}/{len(test_cases)} passed\n")
    return passed == len(test_cases)


def test_it_tech_experience():
    """Test IT/Tech experience filtering"""
    test_cases = [
        # (total_years, role, skills, education, expected_result)
        (10, "Senior Software Engineer", ["Python", "Java"], [], 10),           # IT role
        (15, "Data Scientist", ["Python", "SQL"], [], 15),                       # IT role
        (10, "Teacher", ["Communication"], [], 0),                              # Non-IT role
        (8, "Sales Executive", ["Negotiation"], [], 0),                         # Non-IT sales
        (10, "Account Executive", ["Python"], [], 10),                          # Has IT skill
        (5, "Consultant", ["Java", "Spring"], [], 5),                           # Mixed with IT skills
        (3, "Junior Developer", ["JavaScript"], [], 3),                         # IT role, short exp
    ]
    
    passed = 0
    for total, role, skills, edu, expected in test_cases:
        result = _calculate_it_tech_experience(total, role, skills, edu)
        if result == expected:
            print(f"  ✓ {role:<30} {total} years → {result} years")
            passed += 1
        else:
            print(f"  ✗ {role:<30} {total} years → {result} (expected {expected})")
    
    print(f"IT/Tech experience filtering: {passed}/{len(test_cases)} passed\n")
    return passed == len(test_cases)


def test_postprocessing():
    """Test complete postprocessing of parsed data"""
    test_cases = [
        {
            "name": "Test 1: IT Developer with valid data",
            "input": {
                "name": "John Doe",
                "phone": "8888777666",
                "years_of_experience": "8",
                "current_role": "Senior Python Developer",
                "skills": ["Python", "Django"]
            },
            "text": "Senior Python Developer for 8 years",
            "checks": {
                "years_of_experience": 8,  # Should be filtered as IT
                "phone": "8888777666"      # Should remain as-is
            }
        },
        {
            "name": "Test 2: Teacher with missing years",
            "input": {
                "name": "Jane Smith",
                "phone": None,
                "years_of_experience": None,
                "current_role": "Teacher",
                "skills": ["Teaching"]
            },
            "text": "Teacher at XYZ School",
            "checks": {
                "years_of_experience": 0,  # Should be filtered as non-IT
                "phone": None              # Should remain None
            }
        },
        {
            "name": "Test 3: Mixed profile with IT skills",
            "input": {
                "name": "Bob Wilson",
                "phone": None,
                "years_of_experience": "12",
                "current_role": "Business Consultant",
                "skills": ["Java", "Spring Boot", "AWS"]
            },
            "text": "Contact: 9999888877\nBusiness consultant with Java experience",
            "checks": {
                "years_of_experience": 12,  # Has IT skills, so count all
                "phone": None               # Pattern not matched
            }
        }
    ]
    
    passed = 0
    for test in test_cases:
        print(f"  {test['name']}")
        result = _postprocess_parsed_data(test["input"].copy(), test["text"])
        
        all_checks_passed = True
        for key, expected_value in test["checks"].items():
            actual_value = result.get(key)
            if actual_value == expected_value:
                print(f"    ✓ {key}: {actual_value}")
            else:
                print(f"    ✗ {key}: {actual_value} (expected {expected_value})")
                all_checks_passed = False
        
        if all_checks_passed:
            passed += 1
            print()
    
    print(f"Postprocessing: {passed}/{len(test_cases)} passed\n")
    return passed == len(test_cases)


if __name__ == "__main__":
    print("=" * 60)
    print("RESUME SERVICE FIXES TEST SUITE")
    print("=" * 60)
    print()
    
    results = []
    
    print("TEST 1: Phone Number Extraction")
    print("-" * 60)
    results.append(test_phone_extraction())
    
    print("TEST 2: IT/Tech Experience Filtering")
    print("-" * 60)
    results.append(test_it_tech_experience())
    
    print("TEST 3: Complete Postprocessing")
    print("-" * 60)
    results.append(test_postprocessing())
    
    print("=" * 60)
    total_passed = sum(results)
    total_tests = len(results)
    print(f"OVERALL: {total_passed}/{total_tests} test groups passed")
    
    if total_passed == total_tests:
        print("All fixes are working correctly!")
    else:
        print("Some tests failed. Review the output above.")
    print("=" * 60)
