"""Debug experience extraction"""
from src.services.comprehensive_extractor import ComprehensiveResumeExtractor

test_resume = """
PROFESSIONAL EXPERIENCE

Senior Software Engineer | TechCorp India Pvt Ltd | Bangalore
June 2023 - Present (2 years 9 months)
• Led development of microservices architecture serving 5M+ users
• Mentored team of 8 engineers, improving code quality by 40%

Software Engineer | StartupXYZ | Bangalore  
January 2021 - May 2023 (2 years 5 months)
• Built REST APIs handling 100k+ requests/day
• Optimized database queries reducing latency by 50%

Junior Developer | WebAgency Co | Bangalore
July 2019 - December 2020 (1 year 6 months)
• Developed client-facing web applications
"""

print("[*] Testing Experience Extraction")
print("="*80)

extractor = ComprehensiveResumeExtractor()
exp_list, current, previous = extractor.extract_experience(test_resume)

print(f"\nCurrent Role: {current}")
print(f"Previous Role: {previous}")
print(f"\nExperience Entries: {len(exp_list)}")

for i, exp in enumerate(exp_list, 1):
    print(f"\nEntry {i}:")
    for key, val in exp.items():
        print(f"  {key}: {val}")

# Debug: Check what the regex is finding
import re

exp_match = re.search(
    r'(?:Professional\s+)?Experience|Work\s+Experience|Employment:(.*?)(?=\n(?:Education|Projects|Skills|Certifications|Languages|$))',
    test_resume,
    re.IGNORECASE | re.DOTALL
)

if exp_match:
    print(f"\n[DEBUG] Found Experience Section:")
    print("="*80)
    print(exp_match.group(1)[:500])
    print("...")
