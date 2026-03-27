import re

text = """ PROFESSIONAL EXPERIENCE

| Senior Business Development Consultant | Spectra Management Consultancy Pvt. Ltd. | Pune |
| June 2025 – January 2026 |

EDUCATION

 MBA (Marketing) | RMD Sinhgad College, Pune | 2020
"""

# Test regex patterns
patterns = [
    r'(?:professional\s+)?experience\s*\n{1,2}(.*?)(?=\n{1,2}(?:education|projects|skills))',
    r'PROFESSIONAL\s+EXPERIENCE\s*\n+(.*?)(?=\n{1,2}(?:EDUCATION|PROJECTS|SKILLS))',
    r'(?:professional|work)\s+experience\s*\n+(.*?)(?=\n(?:education|projects|skills|certifications))',
]

for i, pattern in enumerate(patterns):
    print(f"\nPattern {i+1}: {pattern}")
    match = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
    if match:
        print(f"  ✓ MATCHED")
        print(f"  Captured: {match.group(1)[:100] if match.lastindex else 'No capture group'}")
    else:
        print(f"  ❌ NO MATCH")

# Look for job lines
print("\n\nLooking for job lines with pipes:")
for line in text.split('\n'):
    if '|' in line and 'Consultant' in line or 'Manager' in line:
        print(f"  Found: {line}")
