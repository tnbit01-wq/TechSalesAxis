# DUPLICATE DETECTION FIX - STEP BY STEP IMPLEMENTATION PLAN

## Current Database Structure Analysis

### Tables We'll Use (No Schema Changes Needed!)

#### 1. **CandidateProfile** (candidate_profiles table)
```
Columns available:
✅ user_id (UUID) - Primary key linking to User
✅ phone_number (Text) - Single phone per profile
✅ is_shadow_profile (Boolean) - Marks shadow profiles
✅ full_name (Text) - Candidate name
```

#### 2. **BulkUploadFile** (bulk_upload_files table)
```
Columns available:
✅ extracted_email (Text) - Email extracted from resume
✅ extracted_phone (Text) - Phone extracted from resume
✅ extracted_name (Text) - Name extracted from resume
✅ matched_candidate_id (UUID) - FK to User
✅ match_type (Text) - exact, strong, moderate, soft, no_match
✅ match_confidence (Numeric) - Confidence score
✅ parsed_data (JSONB) - Raw extraction data
```

#### 3. **BulkUploadCandidateMatch** (bulk_upload_candidate_matches table)
```
Columns available:
✅ bulk_upload_file_id (UUID) - FK to file
✅ matched_candidate_user_id (UUID) - FK to User
✅ candidate_email (Text) - Email from resume
✅ candidate_phone (Text) - Phone from resume
✅ match_type (Text) - Type of match
✅ match_confidence (Numeric) - Confidence score
✅ match_details (JSONB) - Detailed scoring breakdown
```

#### 4. **User** (users table)
```
Columns available:
✅ id (UUID) - Primary key
✅ email (Text) - UNIQUE email (this is the limitation!)
❌ Note: Can only store ONE email per user (unique constraint)
```

---

## The Problem in Database Terms

```
Scenario: Candidate "John Doe"
├─ Batch 1: Resume with email=john@gmail.com, phone=9167035635
│  └─ Creates: User + CandidateProfile + BulkUploadFile record
│  └─ BulkUploadFile.extracted_email = "john@gmail.com"
│  └─ BulkUploadFile.extracted_phone = "9167035635"
│  └─ CandidateProfile.phone_number = "9167035635"
│
└─ Batch 2: Resume with email=john@outlook.com, phone=9167035635
   └─ Current detection: Email doesn't match → NEW CANDIDATE
   └─ Should detect: Phone MATCHES → SAME CANDIDATE
```

---

## Solution Without Schema Changes

### Key Insight: Use Existing Columns Wisely

We have everything we need:
1. ✅ `BulkUploadFile.extracted_phone` - Phone from new resume
2. ✅ `CandidateProfile.phone_number` - Phone from existing profile
3. ✅ `BulkUploadFile.extracted_email` - Email from new resume
4. ✅ `User.email` - Existing user email

---

## Step-by-Step Implementation

### STEP 1: Modify Duplicate Detector Query
**Location:** `src/services/bulk_upload_duplicate_detector.py`
**Change:** Add phone-based duplicate detection BEFORE checking email

**Current logic (problematic):**
```python
1. Check email → If no match, score lowered
2. Check phone → If no match, score lowered
3. Overall score < 50% → NO MATCH
```

**New logic (fixed):**
```python
1. Check phone FIRST → If exact match → AUTO-DETECTED as duplicate
2. If phone doesn't match, check email + other fields
3. Use combination scoring
```

### STEP 2: Enhance find_best_match() method
**Location:** `src/services/bulk_upload_duplicate_detector.py`
**Method:** `find_best_match()`
**Change:** Prioritize phone matches

```python
def find_best_match(self, new_candidate, existing_candidates):
    # STEP 1: Look for EXACT PHONE MATCH FIRST
    for existing in existing_candidates:
        if self._check_phone_match(new_candidate, existing.get('phone_number')):
            # Found exact phone match → Return as definite duplicate
            return DuplicateMatch(
                matched_candidate_id=existing.get('user_id'),
                match_type="definite_match",
                match_confidence=0.95,
                match_reason="Phone match - Same candidate"
            )
    
    # STEP 2: If no phone match, use existing scoring
    return self._score_all_candidates(new_candidate, existing_candidates)
```

### STEP 3: Get existing candidates properly
**Location:** `src/tasks/bulk_upload_tasks.py`
**Method:** `detect_duplicates()`
**Change:** Query CandidateProfile for existing phone numbers

```python
# Current (problematic): Gets candidates but might miss phone match
existing_candidates = [dict(cp) for cp in query.all()]

# New (fixed): Explicitly include phone_number in query
existing_candidates = db.execute(select(
    CandidateProfile.user_id,
    CandidateProfile.phone_number,
    CandidateProfile.full_name,
    User.email,
    # ... other fields
)).all()
```

### STEP 4: Store extraction with proper normalization
**Location:** `src/services/comprehensive_extractor.py`
**Change:** Normalize phone before storing in BulkUploadFile

```python
# Already done! Just ensure phone is normalized:
extracted_phone = self._normalize_phone(phone_raw)
# This removes spaces, dashes, etc.
```

---

## Database Queries (Reference)

### Query 1: Find candidates by phone
```sql
SELECT 
    cp.user_id,
    u.email,
    cp.full_name,
    cp.phone_number,
    cp.is_shadow_profile
FROM candidate_profiles cp
JOIN users u ON u.id = cp.user_id
WHERE REGEXP_REPLACE(cp.phone_number, '\\D', '') = ?phone_normalized?
LIMIT 1;
```

### Query 2: Find candidates by email
```sql
SELECT 
    cp.user_id,
    u.email,
    cp.full_name,
    cp.phone_number,
    cp.is_shadow_profile
FROM candidate_profiles cp
JOIN users u ON u.id = cp.user_id
WHERE u.email = ?email?
LIMIT 1;
```

### Query 3: Check for multi-email same person (for future shadow profile linking)
```sql
SELECT 
    cp.phone_number,
    COUNT(DISTINCT u.email) as email_count,
    ARRAY_AGG(DISTINCT u.email) as emails
FROM candidate_profiles cp
JOIN users u ON u.id = cp.user_id
WHERE cp.phone_number IS NOT NULL
GROUP BY cp.phone_number
HAVING COUNT(DISTINCT u.email) > 1;
```

---

## Implementation Order

### ✅ HIGH PRIORITY (Fixes your issue)
1. **Modify `score_duplicate_match()`** in duplicate_detector.py
   - Check phone FIRST, return if match
   - If no phone match, continue with existing logic

2. **Update `find_best_match()`** in duplicate_detector.py
   - Prioritize phone matches
   - Handle case when existing_candidates not provided

3. **Fix `detect_duplicates()` task** in bulk_upload_tasks.py
   - Query existing candidates WITH phone numbers
   - Pass proper candidate data including phone to detector

### ⚠️ IMPORTANT: Database Configuration
Make sure detector gets actual phone numbers from CandidateProfile:
```python
# Extract phone from existing candidate in database
existing_phone = existing_candidate.get('phone_number')  # From CandidateProfile

# Extract phone from new resume
new_phone = new_candidate.phone  # Already normalized
```

---

## No Schema Changes Needed Because:

✅ `CandidateProfile.phone_number` already exists
✅ `BulkUploadFile.extracted_phone` already exists  
✅ `BulkUploadCandidateMatch.candidate_phone` already exists
✅ `BulkUploadCandidateMatch.match_details` (JSONB) can store any scoring info
✅ All linking via ForeignKeys already in place

---

## Testing After Implementation

```sql
-- Test 1: Verify phone normalization
SELECT extracted_phone FROM bulk_upload_files WHERE extracted_email LIKE '%john%';

-- Test 2: Compare with existing phone
SELECT cp.phone_number FROM candidate_profiles WHERE full_name LIKE '%John%';

-- Test 3: Check match scores
SELECT 
    bucm.match_type,
    bucm.match_confidence,
    bucm.match_details->>'phone_match' as phone_matched
FROM bulk_upload_candidate_matches 
WHERE created_at > NOW() - INTERVAL '1 hour';
```

---

## Files to Modify

1. **apps/api/src/services/bulk_upload_duplicate_detector.py**
   - Method: `_check_phone_match()` - Already good, no change
   - Method: `score_duplicate_match()` - Check phone first
   - Method: `find_best_match()` - Prioritize phone
   
2. **apps/api/src/tasks/bulk_upload_tasks.py**
   - Function: `detect_duplicates()` - Get phone from CandidateProfile
   - Query: Ensure CandidateProfile phone is included

3. **No other files need changes!**

---

## What This Fixes

✅ Same person with email B + email C → **DETECTED** (via phone)
✅ Works with existing database schema
✅ No migrations needed
✅ No data loss
✅ Backward compatible

---

## Ready to Implement?

Let me know if you want me to:
1. Show the exact code changes needed
2. Start with Step 1 (modify duplicate detection)
3. Or follow a different order
