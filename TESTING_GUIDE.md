# Testing Guide: Conversational Onboarding Fixes

## Quick Summary of What's Fixed

**Issue 1**: Data not saving to database
- Error: `TypeError: Not a boolean value: 'true'`
- **Fixed**: Added type normalization function

**Issue 2**: Questions repeating in conversation
- Error: Same question asked multiple times
- **Fixed**: Enhanced deduplication with variation matching

---

## Test 1: Verify Type Normalization Works

### Command:
```bash
cd c:\Users\Admin\Desktop\Projects\TALENTFLOW
python test_normalize_api.py
```

### Expected Output:
```
1. RAW AI OUTPUT (strings only):
  employment_status: 'employed' (type: str)
  willing_to_relocate: 'true' (type: str)
  years_experience: '8' (type: str)

2. AFTER NORMALIZATION:
  employment_status: employed (type: str)
  willing_to_relocate: True (type: bool)      ✅ String 'true' → boolean True
  years_experience: 8 (type: int)             ✅ String '8' → integer 8

3. EDGE CASES TEST:
  OK: String 'not_mentioned' becomes None
  OK: Extract number from descriptive string
  OK: String 'yes' becomes True
  OK: String 'no' becomes False
```

✅ **Pass Criteria**: All "OK" messages shown

---

## Test 2: End-to-End Test with New Candidate

### Prerequisites:
- Backend running on port 8005
- Frontend running on port 3000
- Test account ready (or create new one)

### Step 1: Start Backend
```bash
cd c:\Users\Admin\Desktop\Projects\TALENTFLOW\apps\api
..\..\.venv\Scripts\python.exe -m uvicorn src.main:app --host 127.0.0.1 --port 8005 --reload
```

Expected: Server starts successfully (no import errors)

### Step 2: Start Frontend (Separate Terminal)
```bash
cd c:\Users\Admin\Desktop\Projects\TALENTFLOW\apps\web
npm run dev
```

Expected: Frontend loads at http://localhost:3000

### Step 3: Create Test Account
- Go to http://localhost:3000/signup
- Create new account with email: `test_conversation_[date]@test.com`
- Note: Use unique email each test

### Step 4: Start Candidate Onboarding
- Go to http://localhost:3000/onboarding/candidate
- You should see conversational flow
- NOT a form with questions - should be natural chat

### Step 5: Go Through Conversation (5+ turns)
Respond to questions naturally:

1. **Turn 1** - Employment Status
   - You: "I'm currently working as a Sales Manager"
   - AI should: Acknowledge and ask about job search urgency
   
2. **Turn 2** - Job Search Mode
   - You: "I'm actively looking for a new role"
   - AI should: Ask about notice period (not employment again)
   
3. **Turn 3** - Notice Period
   - You: "I can join in 30 days, need to give notice"
   - AI should: Ask about relocation or location preference
   
4. **Turn 4** - Relocation
   - You: "Yes, I'm open to relocating for the right opportunity"
   - AI should: Ask about specific interests or skills
   
5. **Turn 5** - Interests
   - You: "I'm most interested in SaaS sales roles with revenue focus"
   - AI should: Confirm conversation and indicate data saved

### Step 6: Check Backend Logs
Look for these messages (ignore order):

✅ **GOOD - Data Saving**:
```
[NORMALIZATION] Extracted data normalized: {...willing_to_relocate: True, years_experience: 8...}
[DB] ✅ Saved ConversationalOnboardingSession for user_id
  total_messages: 1
  asked: ['employment_status']
```

❌ **BAD - Data Not Saving**:
```
[DB] ❌ Error saving ConversationalOnboardingSession: TypeError: Not a boolean value
[SQL: UPDATE conversational_onboarding_sessions SET extracted_willing_to_relocate...
```

### Step 7: Verify Data Persistence
Run diagnostic:
```python
python diagnose_now.py
```

Check output for:
- ✅ `Conversation Session exists`
- ✅ `Total Messages: 5` (or however many turns)
- ✅ Shows extracted data (employment status, notice period, etc.)
- ✅ All fields populated correctly

---

## Test 3: Verify No Question Repetition

### Objective:
Confirm that AI doesn't ask the same question twice in single conversation

### Test Conversation:
1. **Q1**: "What's your employment status?"
   - You: "I'm employed"
   - ✅ Should NOT ask "Can you tell me about your employment?" in next turn

2. **Q2**: "How serious about your tech sales search?"
   - You: "Very serious, actively looking"
   - ✅ Should NOT ask "How urgent is your job search?" (same question)

3. **Q3**: "How much notice do you need?"
   - You: "30 days"
   - ✅ Should NOT ask "When can you join?" as "notice period" variation

4. **Q4**: "Open to relocating?"
   - You: "Absolutely"
   - ✅ Should NOT ask "Are you willing to relocate?" (already asked)

5. **Q5**: "What interests you most?"
   - You: "Client engagement and deal closing"
   - ✅ Should NOT repeat any previous questions

### Expected Flow:
```
Turn 1: Q: Employment Status → You: Employed
Turn 2: Q: Job Urgency (DIFFERENT)
Turn 3: Q: Notice Period (DIFFERENT)
Turn 4: Q: Relocation (DIFFERENT)
Turn 5: Q: Specific Interests (DIFFERENT)
```

### Bad Flow (Would indicate failed fix):
```
Turn 1: Q: Employment Status → You: Employed
Turn 2: Q: Employment Status (REPEATED!) ❌
Turn 3: Q: Are you employed? (REPEATED AGAIN!) ❌
Turn 4: Q: Job Urgency
Turn 5: Q: Job Urgency (REPEATED) ❌
```

### Check Backend Logs:
Look for `asked_questions` growing:
```
Turn 1: asked: ['employment_status']
Turn 2: asked: ['employment_status', 'job_search_mode']
Turn 3: asked: ['employment_status', 'job_search_mode', 'notice_period']
Turn 4: asked: ['employment_status', 'job_search_mode', 'notice_period', 'relocation']
Turn 5: asked: ['employment_status', 'job_search_mode', 'notice_period', 'relocation', 'interests']
```

---

## Test 4: Verify All Field Types Correct in Database

### Command:
```bash
python -c "
import sys
sys.path.insert(0, 'apps/api')
from src.core.models import ConversationalOnboardingSession
from sqlalchemy import inspect

# Verify column types
mapper = inspect(ConversationalOnboardingSession)
for col in mapper.columns:
    if 'extracted' in col.name:
        print(f'{col.name}: {col.type}')
"
```

### Expected Output:
```
extracted_employment_status: TEXT
extracted_job_search_mode: TEXT
extracted_notice_period_days: INTEGER
extracted_current_role: TEXT
extracted_years_experience: INTEGER
extracted_willing_to_relocate: BOOLEAN
extracted_visa_sponsorship_needed: BOOLEAN
extracted_metadata: JSONB
```

---

## Troubleshooting

### Issue: Still seeing "Not a boolean value" error

**Check 1**: Verify normalization function exists
```bash
grep -n "normalize_extracted_data" apps/api/src/routes/intelligence.py
```
Should show multiple matches (function definition + usage)

**Check 2**: Verify it's being called
```bash
grep -n "normalized = normalize_extracted_data" apps/api/src/routes/intelligence.py
```
Should show: `extracted = normalize_extracted_data(extracted)`

**Check 3**: Restart backend
```bash
taskkill /F /IM python.exe
cd apps/api
python -m uvicorn src.main:app --reload
```

---

### Issue: Questions still repeating

**Check 1**: Verify deduplication function enhanced
```bash
grep -n "is_asked" apps/api/src/services/ai_intelligence_service.py
```
Should show function definition

**Check 2**: Check if asked_questions being passed
```bash
grep -n "next_question = await self._generate_intelligent_followup" \
  apps/api/src/services/ai_intelligence_service.py
```
Should show: `next_question = await self._generate_intelligent_followup(extraction, asked_questions)`

**Check 3**: Verify frontend tracking
Frontend should be passing `asked_questions` array in request:
```json
{
  "user_message": "I'm employed",
  "asked_questions": ["employment_status", "job_search_mode"]
}
```

---

### Issue: Data not persisting still

**Check 1**: Backend logs show what's happening
```
If you see: [DB] ❌ Error saving
Then: Type normalization not working or not being called
```

**Check 2**: Verify database connectivity
```bash
python -c "
from src.core.database import SessionLocal
db = SessionLocal()
print('Database connection OK')
db.close()
"
```

**Check 3**: Check conversation session exists
```bash
python diagnose_now.py
# Should show ConversationalOnboardingSession table exists and has entries
```

---

## Success Criteria

### ✅ Test 1 (Type Normalization)
- All tests show "OK"
- Strings convert to booleans and integers

### ✅ Test 2 (End-to-End)
- Can complete 5+ turn conversation
- Backend logs show `[DB] ✅ Saved ConversationalOnboardingSession`
- No errors in logs
- `diagnose_now.py` shows all data saved

### ✅ Test 3 (No Repetition)
- Each turn asks different question
- No repeated questions in single conversation
- `asked_questions` array grows with each turn

### ✅ Test 4 (Database Types)
- All BOOLEAN fields show as BOOLEAN
- All INTEGER fields show as INTEGER
- No type mismatches

---

## What These Fixes Enable

After all tests pass, the system:
- ✅ Properly saves conversation data to database
- ✅ Never loses candidate data due to type errors
- ✅ Asks logical sequence of questions without repetition
- ✅ Extracts and stores correct data types
- ✅ Scales to hundreds of candidates without data loss

**System is ready for production after passing all tests.**
