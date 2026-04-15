# Conversation Persistence Testing Guide

## ✅ Implementation Complete

All database persistence for conversational onboarding has been implemented. Here's how to verify it's working:

---

## 🚀 Step 1: Start the Backend Server

```bash
cd apps/api
.venv\Scripts\python.exe -m uvicorn src.main:app --reload
```

**Expected Output:**
```
INFO:     Uvicorn running on http://127.0.0.1:8005
INFO:     Application startup complete
```

**If you see ImportError:**
- Check that `apps/api/src/core/config.py` has SMTP variables (should be there)
- Run: `grep "SMTP_HOST" apps/api/src/core/config.py`

---

## 🚀 Step 2: Check Database Schema

Run the verification script to confirm the table exists and is ready:

```bash
# From project root
python verify_conversation_storage.py
```

**Expected Output:**
```
✅ Table 'conversational_onboarding_sessions' EXISTS in database
📈 Total sessions in database: 0
   ⚠️  No sessions found. This is expected on first run.
```

---

## 🚀 Step 3: Test Conversation Persistence

### Option A: Using the Frontend (Recommended)

1. Open: `http://localhost:3000/onboarding/candidate`
2. Go through the conversational onboarding:
   - Answer: "I'm employed and have 8 years sales experience"  
   - Answer: "I'm actively looking for new opportunities"
   - Answer: "I need 30 days notice"
   - Continue answering questions...
3. Watch the backend logs for:
   ```
   [INTELLIGENCE] Processing conversational onboarding...
   [DB] ✅ Saved ConversationalOnboardingSession: session_id=abc-123, total_messages=1
   [DB] ✅ Saved ConversationalOnboardingSession: session_id=abc-123, total_messages=2
   ```

### Option B: Using cURL (For Quick Testing)

```bash
# 1. Get auth token (adjust with real credentials)
curl -X POST http://localhost:8005/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"candidate@test.com","password":"password123"}'

# 2. Send conversation message (use token from step 1)
curl -X POST http://localhost:8005/intelligence/onboarding/conversational \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "user_message": "I have 8 years of sales experience and Im currently employed",
    "conversation_history": [],
    "asked_questions": []
  }'

# Expected response:
{
  "status": "success",
  "data": {
    "acknowledgment": "Thank you for sharing...",
    "next_question": "Are you actively looking...",
    "extracted_info": {
      "years_experience": 8,
      "employment_status": "employed"
    },
    "completeness_score": 0.4,
    "confidence": 0.92
  },
  "timestamp": "2024-01-15T10:30:45.123456",
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "stored": true        # ✅ KEY: Confirms data was saved
}
```

---

## 🔍 Step 4: Verify Data Was Saved

### Option A: Check with Verification Script

```bash
python verify_conversation_storage.py
```

**Expected Output:**
```
✅ Table 'conversational_onboarding_sessions' EXISTS in database
📈 Total sessions in database: 1

📋 Session Details:
-----------------------------------------
🎯 Session ID: 550e8400-e29b-41d4-a716-446655440000
   Candidate: candidate@test.com
   Total Messages: 2
   Asked Questions: ['employment_status', 'years_experience']
   Completeness Score: 45%
   Confidence: 0.92
   Status: in_progress

   📊 Extracted Data:
      - Employment Status: employed
      - Job Search Mode: (not extracted yet)
      - Notice Period: (not extracted yet)
      - Years Experience: 8
      ...

✅ Database storage is working correctly!
✅ 1 session(s) found with conversation data
```

### Option B: Using API Endpoint

```bash
curl http://localhost:8005/intelligence/onboarding/conversational/session \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# Expected response:
{
  "status": "found",
  "data": {
    "session_id": "550e8400-e29b-41d4-a716-446655440000",
    "total_messages": 2,
    "asked_questions": ["employment_status", "years_experience"],
    "completeness_score": 45.0,
    "extracted": {
      "employment_status": "employed",
      "job_search_mode": null,
      "notice_period": null,
      "current_role": null,
      "years_experience": 8.0,
      "willing_to_relocate": null,
      "visa_sponsorship_needed": null
    },
    "conversation_messages": [
      {
        "user": "I have 8 years of sales experience...",
        "assistant": "Thank you for sharing...",
        "timestamp": "2024-01-15T10:30:45.123456",
        "confidence": 0.92,
        "extracted_info": {"years_experience": 8, ...}
      },
      ...
    ]
  }
}
```

### Option C: Direct Database Query

```bash
# Using psql
psql "your-database-url"

# Then run:
SELECT 
  id, 
  candidate_id, 
  total_messages, 
  asked_questions, 
  completeness_score,
  conversation_status
FROM conversational_onboarding_sessions
ORDER BY created_at DESC
LIMIT 5;

# Expected output:
 id | candidate_id | total_messages | asked_questions | completeness_score | conversation_status
----+--------------+----------------+-----------------+--------------------+---------------------
 1  | candidate123 | 2              | {employment_st} | 45.0               | in_progress
```

---

## ✅ What to Verify

### ✅ Checkpoint 1: Backend Loads Without Errors
- [ ] No ImportError when starting uvicorn
- [ ] "Application startup complete" message appears
- Log: Check for `[INTELLIGENCE] Loaded...` and `[DB] Connected...`

### ✅ Checkpoint 2: Conversation Saves to Database
- [ ] Response includes `"stored": true`
- [ ] Response includes `"session_id": "..."`
- [ ] Logs show `[DB] ✅ Saved ConversationalOnboardingSession`

### ✅ Checkpoint 3: Data Retrieves Correctly
- [ ] GET `/onboarding/conversational/session` returns data
- [ ] Session includes extracted fields
- [ ] Conversation messages appear
- [ ] Completeness score shows progress

### ✅ Checkpoint 4: No Duplicate Questions
- [ ] Send multiple messages covering same topics
- [ ] Verify same question doesn't appear in `asked_questions` twice
- [ ] Logs show: `[INTELLIGENCE] Question 'employment_status' already asked, skipping`

---

## 🐛 Troubleshooting

### Issue: "stored": false in Response
**Problem:** Data not saving to database

**Solutions:**
1. Check database connection: `echo $DATABASE_URL` in terminal
2. Check logs for `[DB]` errors
3. Verify table exists: Run `verify_conversation_storage.py`
4. Verify `db.commit()` is being called (it is, at line 170 in intelligence.py)

### Issue: GET Endpoint Returns 404 or "no_session"
**Problem:** No session exists yet

**Solution:**
1. Must complete at least one conversation turn first
2. Use your auth token from Step 3
3. Session is created automatically on first message

### Issue: No Conversation Messages Stored
**Problem:** Messages list is empty even though total_messages shows count

**Solutions:**
1. Check that message format is correct (see code at line 160 in intelligence.py)
2. Verify `conversation_messages` column exists in database
3. Run migration if needed

### Issue: ImportError on SMTP Variables
**Problem:** Still getting import error even after config fix

**Solution:**
1. Verify config.py has all 7 SMTP variables:
   ```bash
   grep -n "SMTP_" apps/api/src/core/config.py
   ```
   Should show 7 lines starting around line 70

2. If missing, they were added in Phase 5 - check git history:
   ```bash
   git log --oneline apps/api/src/core/config.py | head -5
   ```

---

## 📊 Expected Data Flow

```
[Frontend] User fills conversation
    ↓
[API POST /onboarding/conversational]
    ↓
[Load/Create Session] ← Database lookup
    ↓
[Process with AI Service] ← Extract questions & fields
    ↓
[Save Session] ← db.add() + db.commit()
    ├→ conversation_messages.append()
    ├→ asked_questions.update()
    ├→ extracted_employment_status = ...
    ├→ completeness_score = ...
    └→ db.commit() ✅
    ↓
[Return Response] ← includes "stored": true, session_id
    ↓
[User can retrieve] ← GET /onboarding/conversational/session
    └→ All conversation data + extracted fields
```

---

## 🎯 Next Steps After Verification

### If Everything Works ✅
- Begin end-to-end testing with real candidates
- Monitor logs for any edge cases
- Check completeness scores reach 0.8+ for session completion
- Verify extracted fields are accurate

### If Issues Found ❌
- Check error logs: `tail -f logs/talentflow.log`
- Run verification script with verbose error output
- Check database connectivity
- Verify all 6 modified files were saved correctly

---

## 📝 Files Modified in This Solution

1. **`apps/api/src/routes/intelligence.py`**
   - Added `ConversationalOnboardingSession` import
   - Updated POST endpoint to create/save sessions
   - Added GET endpoint to retrieve sessions

2. **`apps/api/src/core/models.py`**
   - Added `asked_questions` column (tracking)

3. **`apps/api/src/core/config.py`**
   - Added 7 SMTP configuration variables (Phase 5)

4. **`apps/api/src/services/ai_intelligence_service.py`**
   - Added question deduplication logic (Phase 3)

5. **`apps/web/src/lib/aiIntelligenceClient.ts`**
   - Pass `asked_questions` to backend (Phase 3)

6. **`apps/web/src/app/onboarding/candidate/page.tsx`**
   - Track and send `asked_questions` in 4 state handlers (Phase 3)

---

## 🚀 Ready to Test!

All implementation is complete. Run through the steps above to verify everything works. Report any issues and we can debug in real-time!
