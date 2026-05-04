# Implementation Verification Checklist

## Quick Reference - All 8 Fixes at a Glance

| # | Issue | Fix | Location | Status |
|---|-------|-----|----------|--------|
| 1 | Job search motivation lost | Extract and store in metadata | intelligence.py, ai_intelligence_service.py | ✅ |
| 2 | Timeline contradictory | Map notice_period → role_urgency_level | intelligence.py (sync) | ✅ |
| 3 | Work arrangement inverted | Store separately in metadata | intelligence.py, ai_intelligence_service.py | ✅ |
| 4 | Career interests malformed | Parse to array items | intelligence.py (sync) | ✅ |
| 5 | Target role incomplete | Extract all roles, store array | intelligence.py, ai_intelligence_service.py | ✅ |
| 6 | Career GPS empty | Create on completion | intelligence.py (sync) | ✅ |
| 7 | Readiness history empty | Create audit records | intelligence.py (sync) | ✅ |
| 8 | Profile strength misaligned | Align with completion_score | intelligence.py (sync) | ✅ |

---

## Verification Test Cases

### Test 1: Basic Conversation Flow
**Endpoint:** `POST /intelligence/onboarding/conversational`

**Request:**
```json
{
  "user_message": "I'm currently employed as a Sales Manager at a SaaS company. I'm transitioning into a Customer Success role. I can join immediately. I'm open to both remote and onsite positions.",
  "conversation_history": [],
  "asked_questions": []
}
```

**Expected Response Fields:**
```json
{
  "status": "success",
  "data": {
    "extracted_info": {
      "employment_status": "employed",
      "job_search_mode": "active",
      "job_search_motivation": "career_transition",  // NEW
      "notice_period_days": 0,
      "current_role": "Sales Manager",
      "years_experience": null,
      "willing_to_relocate": null,
      "visa_sponsorship_needed": null,
      "work_arrangement_preference": ["remote", "onsite"],  // NEW
      "target_roles": ["Customer Success Manager"],  // NEW (array)
      "career_interests": ["SaaS"]  // NEW (array)
    },
    "acknowledgment": "...",
    "next_question": "..."
  },
  "session_id": "..."
}
```

**Expected Database State After Test:**

1. **ConversationalOnboardingSession**
```sql
SELECT extracted_metadata FROM conversational_onboarding_sessions 
WHERE candidate_id = '<user_id>' ORDER BY created_at DESC LIMIT 1;

-- Expected: 
-- {
--   "job_search_motivation": "career_transition",
--   "work_arrangement_preference": ["remote", "onsite"],
--   "target_roles": ["Customer Success Manager"],
--   "career_interests": ["SaaS"]
-- }
```

2. **CandidateProfile**
```sql
SELECT notice_period_days, role_urgency_level, job_search_mode, 
       career_interests, target_role
FROM candidate_profiles WHERE user_id = '<user_id>';

-- Expected:
-- notice_period_days: 0
-- role_urgency_level: "urgent_immediate"  (FIX #2)
-- job_search_mode: "active"
-- career_interests: ["SaaS"]  (FIX #4)
-- target_role: "Customer Success Manager"
```

3. **CareerGPS**
```sql
SELECT target_role, current_status FROM career_gps 
WHERE candidate_id = '<user_id>';

-- Expected:
-- target_role: "Customer Success Manager"
-- current_status: "active"
```

4. **CareerReadinessHistory**
```sql
SELECT reason, old_job_search_mode, new_job_search_mode, 
       old_notice_period_days, new_notice_period_days
FROM career_readiness_history 
WHERE user_id = '<user_id>' 
ORDER BY changed_at DESC LIMIT 1;

-- Expected:
-- reason: "onboarding_conversation_completed"
-- old_notice_period_days: NULL (or previous)
-- new_notice_period_days: 0
```

---

### Test 2: Multiple Target Roles
**Endpoint:** `POST /intelligence/onboarding/conversational`

**Request:**
```json
{
  "user_message": "I'm interested in Customer Success Manager, Account Manager, or Account Executive roles in SaaS companies. I love cloud solutions, AI-driven platforms, and ecommerce.",
  "conversation_history": [],
  "asked_questions": []
}
```

**Expected:**
- `target_roles`: ["Customer Success Manager", "Account Manager", "Account Executive"]
- `career_interests`: ["Cloud solutions", "AI-driven platforms", "ecommerce"]
- `career_readiness_metadata.target_roles_detailed` should have all 3 roles

---

### Test 3: Work Arrangement Preference
**Endpoint:** `POST /intelligence/onboarding/conversational`

**Request:**
```json
{
  "user_message": "I'm open to all work arrangements - remote, onsite, or hybrid is fine for me."
}
```

**Expected:**
- `work_arrangement_preference`: ["remote", "onsite", "hybrid"]
- `candidate_profiles.job_type` should NOT be modified (verify it stays unchanged)

---

### Test 4: Career Interests Parsing
**Endpoint:** `POST /intelligence/onboarding/conversational`

**Request:**
```json
{
  "user_message": "I'm interested in SaaS companies, especially those focused on customer experience, ecommerce platforms, and AI-driven solutions."
}
```

**Expected:**
- `career_interests`: ["SaaS", "Customer experience", "eCommerce", "AI-driven"]
- Stored in DB as array, not as single long string

---

### Test 5: Profile Strength Alignment
**Query after conversation with completeness_score=85:**

```sql
SELECT completion_score, profile_strength FROM candidate_profiles 
WHERE user_id = '<user_id>';

-- Expected:
-- completion_score: 85
-- profile_strength: "Strong"  (was possibly "Low" before fix)
```

---

## Debugging Queries

### Show all extracted data from latest session
```sql
SELECT 
    candidate_id,
    extracted_employment_status,
    extracted_job_search_mode,
    extracted_notice_period_days,
    extracted_current_role,
    extracted_years_experience,
    extracted_willing_to_relocate,
    extracted_metadata,
    completeness_score,
    successfully_completed
FROM conversational_onboarding_sessions
WHERE candidate_id = '<user_id>'
ORDER BY created_at DESC
LIMIT 1;
```

### Show profile after sync
```sql
SELECT 
    user_id,
    current_employment_status,
    job_search_mode,
    notice_period_days,
    role_urgency_level,
    current_role,
    years_of_experience,
    willing_to_relocate,
    career_interests,
    target_role,
    completion_score,
    profile_strength,
    employment_readiness_status,
    career_readiness_metadata
FROM candidate_profiles
WHERE user_id = '<user_id>';
```

### Check career tracking tables
```sql
-- Career GPS
SELECT * FROM career_gps WHERE candidate_id = '<user_id>';

-- Career Readiness History
SELECT * FROM career_readiness_history WHERE user_id = '<user_id>' 
ORDER BY changed_at DESC LIMIT 5;
```

---

## Fix-by-Fix Verification

### Fix #1: Job Search Motivation ✅
**Verify that career_transition is captured:**
```sql
SELECT extracted_metadata->'job_search_motivation' as motivation
FROM conversational_onboarding_sessions
WHERE candidate_id = '<user_id>' AND extracted_metadata ? 'job_search_motivation';
```
**Expected:** `"career_transition"` or `"active_search"` or `"exploring"`

---

### Fix #2: Timeline Mapping ✅
**Verify notice_period maps to role_urgency:**
```sql
SELECT notice_period_days, role_urgency_level
FROM candidate_profiles
WHERE user_id = '<user_id>';

-- Check:
-- IF notice_period_days = 0 THEN role_urgency_level MUST = "urgent_immediate"
-- IF notice_period_days <= 14 THEN role_urgency_level MUST = "urgent_30days"
-- IF notice_period_days > 14 THEN role_urgency_level MUST = "active"
```

---

### Fix #3: Work Arrangement ✅
**Verify preference is stored separately:**
```sql
SELECT extracted_metadata->'work_arrangement_preference' as pref, job_type
FROM candidate_profiles
WHERE user_id = '<user_id>';

-- Verify:
-- work_arrangement_preference can be ["remote", "onsite", "hybrid"]
-- job_type is independently set (not overridden)
```

---

### Fix #4: Career Interests Array ✅
**Verify interests are individual array items:**
```sql
SELECT career_interests FROM candidate_profiles
WHERE user_id = '<user_id>';

-- Should be: ["SaaS", "Customer Experience", "eCommerce", ...]
-- NOT: ["Long string mentioning all interests"]
```

---

### Fix #5: Target Roles ✅
**Verify all roles are stored:**
```sql
SELECT 
    target_role,
    extracted_metadata->'target_roles_detailed' as all_roles
FROM candidate_profiles
WHERE user_id = '<user_id>';

-- Should show:
-- target_role: "Customer Success Manager" (primary)
-- all_roles: {"all_target_roles": [...], "primary": "CSM", "parsed_at": "..."}
```

---

### Fix #6: Career GPS ✅
**Verify career direction tracking:**
```sql
SELECT target_role, current_status FROM career_gps
WHERE candidate_id = '<user_id>';

-- Should have entry with:
-- target_role: populated from candidate profile
-- current_status: from job_search_mode
```

---

### Fix #7: Career Readiness History ✅
**Verify audit trail:**
```sql
SELECT reason, old_notice_period_days, new_notice_period_days, changed_at
FROM career_readiness_history
WHERE user_id = '<user_id>' AND reason = 'onboarding_conversation_completed'
ORDER BY changed_at DESC LIMIT 1;

-- Should show entry with reason = "onboarding_conversation_completed"
```

---

### Fix #8: Profile Strength ✅
**Verify alignment with completion:**
```sql
SELECT completion_score, profile_strength, employment_readiness_status
FROM candidate_profiles
WHERE user_id = '<user_id>';

-- Check mapping:
-- IF completion_score >= 80 THEN profile_strength = "Strong"
-- IF completion_score >= 60 THEN profile_strength = "Medium"
-- IF completion_score < 60 THEN profile_strength = "Low"
-- IF completion_score >= 75 THEN employment_readiness_status = "ready"
```

---

## Common Issues & Solutions

### Issue: extraction_metadata is null
**Solution:** Check that `process_conversational_onboarding` completes successfully. extracted_metadata should be populated after sync.

### Issue: career_interests is still a single long string
**Solution:** Check if fallback parsing is working. Look for logs mentioning "Parsed career_interests from single string".

### Issue: CareerGPS record not created
**Solution:** Check if `successfully_completed` flag is True. CareerGPS only created when conversation completion score > 0.8.

### Issue: role_urgency_level not updated
**Solution:** Verify `sync_conversation_to_profile()` was called. Check logs for "[SYNC]" entries.

---

## Expected File Changes

**Modified Files:**
1. ✅ `apps/api/src/routes/intelligence.py`
   - sync_conversation_to_profile() - Complete rewrite (~500 lines)
   - process_conversational_onboarding() - Enhanced metadata handling
   
2. ✅ `apps/api/src/services/ai_intelligence_service.py`
   - Updated extraction prompt with new fields

**No Database Schema Changes Required** - All new data stored in existing JSONB/ARRAY fields

---

## Success Criteria

✅ All 8 fixes implemented and code syntax validated
✅ No breaking changes to existing flow
✅ No database migrations needed (uses existing fields)
✅ Backward compatible (missing fields set to "not_mentioned")
✅ Ready for end-to-end testing with actual candidate data
