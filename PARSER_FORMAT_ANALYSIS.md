# Resume Format Comparison & Extraction Issues

## Format Differences

### Resume 1: Prashant Virbhadra Ruikar ✅ (WORKING)
Works with current parser

**Experience Format:**
```
PROFESSIONAL EXPERIENCE

| Senior Business Development Consultant | Spectra Management Consultancy Pvt. Ltd. | Pune |
| June 2025 – January 2026 |

• Drive B2B sales by targeting medium to large enterprises...
• Identify and engage relevant decision-makers...
```

**Result:** ✅ Current Role extracted: "Senior Business Development Consultant"

---

### Resume 2: Sonam Shukla ❌ (NOT WORKING)
Cannot parse with current logic

**Experience Format:**
```
PROFESSIONAL EXPERIENCE

Business Development & Client Relations – Lasani 3D (Remote)
2024 – Present

• Overseeing client communication, proposal coordination...
• Supporting international clients...
```

**Result:** ❌ Current Role: None (not extracted)

---

## Root Causes

### Issue 1: Job Entry Format

**Prashant's Format (WORKS):**
```
| Position | Company | Location |
| Dates |
```
- **Separators:** Pipes (`|`)
- **Structure:** Multiple lines, each starting with `|`
- **Parser handles:** Split by `|`, extract parts

**Sonam's Format (FAILS):**
```
Position – Company (Location)
Dates
```
- **Separators:** Dashes (`–`)
- **Structure:** Title on one line, dates below
- **Parser issue:** Doesn't split by dashes, expects pipes

---

### Issue 2: Certifications Format

**Sonam's Resume:**
```
CERTIFICATIONS & TECHNICAL SKILLS

• Certifications: ASL Communication Training, DELED – NIOS
```

**Parser Issues:**
- Section header is "CERTIFICATIONS & TECHNICAL SKILLS" (parser might not match)
- Certifications are comma-separated after bullet
- No dedicated regex pattern to extract this format

---

## What Needs to Be Fixed

### Fix 1: Make `extract_experience()` Format-Agnostic

**Current logic expects:**
```python
if '|' in line:
    parts = line.split('|')
    position = parts[0]
    company = parts[1]
```

**Needs to handle:**
```
Position – Company (Location)
Dates
```

**Solution:**
```python
# Match "Title – Company" pattern
job_match = re.match(r'([^–]+)\s+–\s+([^(]+)(?:\(([^)]+)\))?', line)
if job_match:
    position = job_match.group(1).strip()
    company = job_match.group(2).strip()
    location = job_match.group(3).strip() if job_match.group(3) else None
```

### Fix 2: Implement Proper Certifications Extraction

**Need to:**
1. Match "CERTIFICATIONS & TECHNICAL SKILLS" or "CERTIFICATIONS"
2. Look for bullet points with "Certifications:" prefix
3. Extract comma-separated values
4. Handle special characters (dashes, etc.)

```python
cert_pattern = r'•\s*Certifications:\s*(.+?)(?=\n•|\n\n|$)'
certs_text = re.search(cert_pattern, section, re.IGNORECASE | re.DOTALL)
if certs_text:
    certs = [c.strip() for c in certs_text.group(1).split(',')]
```

---

## Test Cases for Parser Update

### Test 1: Pipe-Separated Format (Prashant)
```
Input: | Senior Business Development Consultant | Spectra Management Consultancy Pvt. Ltd. | Pune |
Expected Output:
  - Position: "Senior Business Development Consultant"
  - Company: "Spectra Management Consultancy Pvt. Ltd."
  - Location: "Pune"
```

### Test 2: Dash-Separated Format (Sonam)
```
Input: Business Development & Client Relations – Lasani 3D (Remote)
Expected Output:
  - Position: "Business Development & Client Relations"
  - Company: "Lasani 3D"
  - Location: "Remote"
```

### Test 3: Certifications Extraction (Sonam)
```
Input: • Certifications: ASL Communication Training, DELED – NIOS
Expected Output: ["ASL Communication Training", "DELED – NIOS"]
```

---

## Parser Improvements Needed

1. **Make `extract_experience()` handle multiple formats**
   - Pipe-separated (current - Prashant's format)
   - Dash-separated (new - Sonam's format)
   - Bullet point format (if used)

2. **Improve `extract_certifications()`**
   - Support "CERTIFICATIONS & TECHNICAL SKILLS" header
   - Extract from comma-separated list after bullet
   - Handle special characters

3. **Add format detection**
   - Identify which format is used
   - Apply appropriate parser
   - Fall back to alternative patterns

4. **Test with multiple resume formats**
   - Update test suite
   - Validate with real resumes
   - Document format compatibility

---

## Impact Analysis

### Current State:
- **Prashant's resume:** ✅ 83.3% accuracy 
- **Sonam's resume:** ❌ 66.7% accuracy (critical fields missing)

### After Fixes:
- **Expected improvement:** Both should reach ~90%+ accuracy
- **Current blocking issue:** Format incompatibility (not a logic bug)

### Priority:
🔴 **HIGH** - Affects core functionality (role, experience extraction)

