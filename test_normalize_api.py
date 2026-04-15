#!/usr/bin/env python3
"""
Test the type normalization function for conversational onboarding fixes
"""

import sys
import os

# Add API to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'apps', 'api'))

from src.routes.intelligence import normalize_extracted_data

print("\n" + "="*80)
print("TESTING DATA TYPE NORMALIZATION FOR DATABASE FIXES")
print("="*80)

# Simulate raw AI output
print("\n1. RAW AI OUTPUT (strings only):")
print("-" * 80)

ai_output = {
    "employment_status": "employed",
    "job_search_mode": "active",
    "willing_to_relocate": "true",
    "visa_sponsorship_needed": "false",
    "years_experience": "8",
    "notice_period_days": "30",
    "current_role": "Sales Manager"
}

for key, value in ai_output.items():
    print(f"  {key}: '{value}' (type: {type(value).__name__})")

# Normalize
print("\n2. AFTER NORMALIZATION:")
print("-" * 80)

normalized = normalize_extracted_data(ai_output)

for key, value in normalized.items():
    print(f"  {key}: {value} (type: {type(value).__name__})")

# Test edge cases
print("\n3. EDGE CASES TEST:")
print("-" * 80)

edge_cases = [
    {
        "input": {"willing_to_relocate": "not_mentioned"},
        "expected_willing_to_relocate": None,
        "description": "String 'not_mentioned' becomes None"
    },
    {
        "input": {"years_experience": "8 years in tech sales"},
        "expected_years_experience": 8,
        "description": "Extract number from descriptive string"
    },
    {
        "input": {"willing_to_relocate": "yes"},
        "expected_willing_to_relocate": True,
        "description": "String 'yes' becomes True"
    },
    {
        "input": {"visa_sponsorship_needed": "no"},
        "expected_visa_sponsorship_needed": False,
        "description": "String 'no' becomes False"
    },
]

for test in edge_cases:
    result = normalize_extracted_data(test["input"])
    
    for key, expected in test.items():
        if key.startswith("expected_"):
            field_name = key[9:]  # Remove "expected_" prefix
            actual = result.get(field_name)
            
            if actual == expected:
                print(f"  OK: {test['description']}")
                print(f"      Input: {field_name}='{test['input'].get(field_name)}'")
                print(f"      Output: {field_name}={actual} ({type(actual).__name__})")
            else:
                print(f"  FAIL: {test['description']}")
                print(f"      Expected: {expected}")
                print(f"      Got: {actual}")

print("\n" + "="*80)
print("WHAT THIS FIXES:")
print("="*80)
print("""
Error in backend logs:
  TypeError: Not a boolean value: 'not_mentioned'
  TypeError: Not a boolean value: 'true'

Root cause:
  - Database expects Python booleans (True, False, None)
  - AI returns strings ('true', 'false', 'not_mentioned')
  - SQLAlchemy can't convert string 'true' to boolean

Fix applied:
  - normalize_extracted_data() function converts:
    * 'true'/'yes' -> True (Python boolean)
    * 'false'/'no' -> False (Python boolean)
    * 'not_mentioned' -> None (NULL in database)
    * '8' -> 8 (integer)
    * '8 years' -> 8 (extract number)

Result:
  - Data saves without type errors
  - Conversations persist to database correctly
  - Questions don't repeat (deduplication also fixed)
""")

print("="*80)
print("\n")
