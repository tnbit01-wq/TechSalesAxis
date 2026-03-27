# 📊 Resume Parsing Analysis - SONAM SHUKLA
## Detailed Report

**User ID:** 8622864c-0f25-4ce9-90b1-a83ac5a569e0  
**Email:** aitsprecruitment@gmail.com  
**Name:** SONAM SHUKLA  
**Date:** March 26, 2026

---

## Executive Summary

**Overall Accuracy: 66.7% (8/12 fields)**

### Issues Identified:

1. **❌ Current Role:** Not extracted (empty)
   - Resume contains: "Business Development & Client Relations" (current) and "Business Sales Manager"
   - Expected: Should extract current role

2. **❌ Experience History:** Not parsed
   - Resume contains: 4 work positions with clear dates
   - Database shows: 0 experience entries (empty)
   - Expected: 4 positions extracted

3. **❌ Certifications:** Not extracted  
   - Resume contains: "ASL Communication Training, DELED – NIOS"
   - Database shows: 0 certifications
   - Expected: Should extract 2 certifications

4. **⚠️ Skills:** Partially extracted
   - Database shows: 12 skills
   - Expected: 15+ skills (missing CRM tools details)

5. **✓ Years of Experience:** WORKING ✓
   - Extracted: 16 years
   - Correct: Yes

---

## Root Cause Analysis

### Issue 1: Current Role NOT Extracted

**Reason:** Experience section parser doesn't match this resume's format

**Current Resume Format:**
```
PROFESSIONAL EXPERIENCE

Business Development & Client Relations – Lasani 3D (Remote)
 2024 – Present

 • Overseeing client communication, proposal coordination...
 • Supporting international clients...

Business Sales Manager – AM Webtech Pvt. Ltd., Indore (Hybrid)
2021 – 2023
```

**Expected Format (by current parser):**
```
PROFESSIONAL EXPERIENCE

| Senior Business Development Consultant | Spectra Management Consultancy | Pune |
| June 2025 – January 2026 |
```

**Problem:** 
- Parser looks for pipe-separated format (`|`)
- This resume uses `–` (dash) separator
- Job title on same line as company
- Format: `Position – Company (Location)` with dates on next line

### Issue 2: Experience History NOT Parsed (Count: 0)

**Same root cause as Issue 1**
- `extract_experience()` method doesn't recognize the format
- Returns empty list instead of 4 jobs

**Jobs in Resume:**
1. Business Development & Client Relations – Lasani 3D (Remote) - 2024–Present
2. Business Sales Manager – AM Webtech Pvt. Ltd., Indore - 2021–2023
3. Associate Sales Executive – XTRIM Global Solutions - 2019–2021
4. English Communication Trainer – CBSE Schools - 2009–2019

### Issue 3: Certifications NOT Extracted (Count: 0)

**Problem Format:**
```
CERTIFICATIONS & TECHNICAL SKILLS

• CRM Tools: Zoho CRM, Salesforce (basic), HubSpot
• Sales Analytics: Excel, Google Sheets, Dashboarding
• Certifications: ASL Communication Training, DELED – NIOS
```

**Issue:**
- Section header is "CERTIFICATIONS & TECHNICAL SKILLS" (not just "CERTIFICATIONS")
- Certifications are under a multi-level structure
- Format: `• Certifications: [cert1], [cert2]` (comma-separated under bullet point)
- Current parser expects different format

---

## Data Extracted Successfully ✓

| Field | Status | Value |
|-------|--------|-------|
| Full Name | ✓ | SONAM SHUKLA |
| Phone | ✓ | +91-9685753893 |
| Email | ✓ | aitsprecruitment@gmail.com |
| Location | ✓ | Indore |
| Years of Experience | ✓ | 16 years |
| Skills | ✓ | 12 skills extracted |
| Education | ✓ | 2 entries (M.A. Clinical Psych, M.A. English) |
| Raw Text | ✓ | 2874 characters stored |
| Bio | ✓ | Summary extracted from profession header |

---

## Data NOT Extracted ❌

| Field | Status | Expected | Actual |
|-------|--------|----------|--------|
| **Current Role** | ❌ | "Business Development & Client Relations" OR "Business Sales Manager" | None |
| **Position in Experience** | ❌ | "Business Development & Client Relations", "Business Sales Manager", etc. | All showing "None" |
| **Experience History** | ❌ | 4 positions | 0 positions |
| **Certifications** | ❌ | "ASL Communication Training", "DELED – NIOS" | 0 certifications |
| **Profile Score** | ⚠️ | Assessment results | Not calculated |

---

## What's Working vs What's Not

### ✅ Working Extraction Methods:
- `extract_name()` - Successfully extracts "SONAM SHUKLA"
- `extract_experience_years()` - Successfully extracts 16 years
- `extract_location()` - Successfully extracts "Indore"
- `extract_contact()` - Successfully extracts phone and email
- `extract_education()` - Extracts 2 degrees (but missing degree field)
- `extract_skills()` - Partially working (12/15+ skills)

### ❌ Broken Extraction Methods:
- `extract_experience()` - Returns empty (0 positions)
- `extract_certifications()` - Returns empty (0 certs)
- Current role detection - Depends on extract_experience()

---

## Technical Issues in Parser

### Problem 1: Experience Format Recognition

**Current Parser Regex** (from comprehensive_extractor.py):
```python
# Looks for pipe-separated format:
| Position | Company | Location | Dates |
```

**This Resume Format:**
```
Position – Company (Location)
YYYY – YYYY
```

**Fix Needed:**
Update `extract_experience()` to handle:
- Dash separators (`–`) instead of pipes (`|`)
- Position and company on same line 
- Dates on separate line below
- Format: `Title – Company (Location)`

### Problem 2: Certifications Format Recognition

**Current Parser** (if it exists):
- Likely looks for standalone "CERTIFICATIONS:" section

**This Resume Format:**
```
CERTIFICATIONS & TECHNICAL SKILLS
• Certifications: ASL Communication Training, DELED – NIOS
```

**Fix Needed:**
- Match "CERTIFICATIONS & TECHNICAL SKILLS" header
- Extract comma-separated items after "Certifications:" bullet
- Handle dashes in certification names

### Problem 3: Position Field Missing

**Issue:** Experience entries show `"position": None`
```
- None at Lasani 3D (2024 - Present)
- None at AM Webtech Pvt. Ltd. (2021 - 2023)
```

**Root Cause:** 
- `extract_experience()` returns 0 items
- When 0 items, parser falls back and creates entries with None position, only getting company/dates

---

## Recommendations for Fixes

### High Priority (Critical):

1. **Fix `extract_experience()` method**
   - [ ] Add support for dash-separated format: `Position – Company (Location)`
   - [ ] Make dates line optional (can be on next line)
   - [ ] Improve job title detection (don't require pipe separators)
   - [ ] Test with multiple resume formats

2. **Implement `extract_certifications()` properly**
   - [ ] Match "CERTIFICATIONS & TECHNICAL SKILLS" header
   - [ ] Extract comma-separated certifications after bullet point
   - [ ] Handle special characters in certification names (dashes, etc.)

### Medium Priority (Important):

3. **Improve education parsing**
   - [ ] Extract degree field (Ph.D., M.A., B.Sc., etc.)
   - [ ] Extract field of study

4. **Enhance skills extraction**
   - [ ] Better match for CRM tools
   - [ ] Include full skill names (not just "Excel" but "Sales Analytics")

### Low Priority (Nice to Have):

5. **Extract additional fields**
   - [ ] Languages spoken
   - [ ] Availability status
   - [ ] Expected salary
   - [ ] Target role / objectives

---

## Summary

**Parsing Accuracy Breakdown:**

```
✓ Successfully Extracted:        8 fields (66.7%)
  - Name, Phone, Email, Location
  - Years of Experience
  - Skills (partial), Education (partial)
  - Raw resume text

✗ Failed to Extract:             3 fields (25%)
  - Current Role
  - Experience History (all positions!)
  - Certifications

⚠️ Not Calculated:               1 field (8.3%)
  - Profile Score (requires assessment)
```

---

## Immediate Actions Required

1. **Update extraction service** to handle this resume format
2. **Test with Sonam's resume** after fixes
3. **Re-run extraction** to populate missing fields
4. **Validate against other resume formats** to ensure compatibility

**Status:** ⚠️ **NEEDS FIXES** - Critical parsing issues prevent current role and experience history extraction

