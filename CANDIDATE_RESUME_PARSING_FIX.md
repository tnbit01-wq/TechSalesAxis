# Resume Parsing Fix for Candidate Onboarding

## Issue Identified
Resume parsing was not working in the candidate onboarding flow at `localhost:3000/onboarding/candidate`. The frontend could upload resumes, but the parsed data quality issues were preventing proper profile creation.

## Root Cause
The three quality fixes (years_of_experience, phone extraction, IT/Tech filtering) were only implemented in the **bulk upload** parsing path (`parse_resume_file_fastapi()` in `bulk_upload_tasks.py`), but individual candidate resumes use a **different code path** through `ResumeService.parse_resume()` in `resume_service.py`.

### Code Flow Comparison:
- **Bulk Admin Upload**: POST `/bulk-upload/parse` → `parse_resume_file_fastapi()` [HAS FIXES ✓]
- **Individual Candidate Upload**: POST `/candidate/resume` → `ResumeService.parse_resume()` [NO FIXES ❌]

## Solution Implemented

### File Modified: `apps/api/src/services/resume_service.py`

#### Step 1: Added Helper Functions (Lines 1-161)
Imported the three critical utility functions:
- `_extract_phone_number()` (Lines 28-81)
- `_calculate_it_tech_experience()` (Lines 84-161)
- `_postprocess_parsed_data()` (Lines 163-202)

These handle all three quality fixes:
1. **Years of Experience**: Ensures the field exists in parsed JSON
2. **Phone Extraction**: Improved regex supporting 10+ international phone formats
3. **Experience Filtering**: Filters out non-IT experience based on role keywords and skills

#### Step 2: Integrated Postprocessing (5 locations)
Updated all 5 `_store_data()` calls to apply postprocessing before storage:

- **Line 286** (OpenAI path): `parsed_data = _postprocess_parsed_data(parsed_data, text)`
- **Line 324** (Groq/OpenRouter path): `parsed_data = _postprocess_parsed_data(parsed_data, text)`
- **Line 342** (Gemini path): `parsed_data = _postprocess_parsed_data(parsed_data, text)`
- **Line 351** (Gemini recovery): `rec_json = _postprocess_parsed_data(rec_json, text)`
- **Line 360** (NLP fallback): `parsed_data = _postprocess_parsed_data(parsed_data, text)`

## Impact

### Before Fix
- Bulk uploads: ✓ 92% success (46/50 resumes with quality fixes)
- Candidate onboarding: ❌ Poor data quality, parsing issues
- Phone extraction: Inconsistent across code paths
- Experience calculation: No domain filtering for individual uploads

### After Fix  
- Bulk uploads: ✓ 92% success (unchanged, already had fixes)
- Candidate onboarding: ✓ Now applies same quality fixes
- Phone extraction: Consistent across ALL parsing paths
- Experience calculation: Domain-filtered for ALL candidate resumes

## Technical Details

### Fix 1: Years of Experience
```python
if "years_of_experience" not in parsed_data or parsed_data["years_of_experience"] is None:
    # Fallback to relevant_years_experience or default to 0
    parsed_data["years_of_experience"] = calculated_value
```

### Fix 2: Phone Extraction  
Supports formats:
- Indian: `+91 XXXXX XXXXX`, `+91-XXXXXXXXXX`, `91XXXXXXXXXX`
- International: `+1 (XXX) XXX-XXXX`, `+44 XXXX XXXXXX`
- Standard: `(XXX) XXX-XXXX`, `XXXXXXXXXX`

### Fix 3: Experience Filtering
Filters experience based on:
- **Current role keywords** (Developer, Engineer, Sales Engineer, etc.)
- **Skills** (Python, Java, AWS, etc.)
- **Education** (optional additional context)

Returns:
- **0 years** if non-IT role (Teacher, HR, Accountant, etc.)
- **Full years** if IT/Tech role detected
- **50% years** if mixed profile (>5 years with some IT skills)

## Testing

### Unit Test Coverage
- Phone extraction: 10 test cases (various formats)
- IT/Tech filtering: 8 test cases (different roles)
- Postprocessing: 3 integration scenarios

### Verification
- ✓ Syntax: No errors found
- ✓ Imports: All dependencies properly typed
- ✓ Call chain: All 5 parsing paths updated

## Next Steps (User Action)

1. **Test the fix**: Upload a resume through the candidate onboarding UI
   - URL: `http://localhost:3000/onboarding/candidate`
   - Expected: Resume parses with improved quality

2. **Monitor logs**: Check backend logs for:
   - `"IT/Tech role detected"` or `"Non-IT profile"` messages
   - Correct years_of_experience being calculated

3. **Verify data**: Check the candidate profile for:
   - Phone number correctly extracted
   - Years of experience properly filtered
   - Skills properly identified

## Files Affected
1. ✓ `apps/api/src/services/resume_service.py` - MODIFIED
2. ✓ `apps/api/test_resume_service_fixes.py` - CREATED (for testing)

## Deployment Notes
- No database migrations needed
- No environment variable changes required
- Backward compatible - doesn't affect existing data
- Can be deployed independently
