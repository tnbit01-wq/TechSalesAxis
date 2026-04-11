# Onboarding Flow - Complete Test Guide & Validation

## Overview
This document provides comprehensive testing procedures to validate:
1. All 15+ onboarding steps work correctly
2. Session persistence - logout at any step and resume from same step
3. Input handling - keyboard and mic inputs work across all steps
4. State saving - all state transitions are persisted to database

---

## ✅ Completed Implementation Changes

### 1. **Critical Fix: Career Readiness → Experience Transition**
**File:** `apps/web/src/app/onboarding/candidate/page.tsx` (lines 300-325)
- **Issue Fixed:** When Career Readiness component completes, transition to Experience was NOT saving state
- **Solution:** Added `await saveStep(nextState)` before `setState("AWAITING_EXPERIENCE")`
- **Impact:** Now when user completes Career Readiness and moves to Experience, the step is saved to database

### 2. **All State Transitions Now Persisted**
The following state transitions now all call `saveStep()` before `setState()`:
- ✅ AWAITING_RESUME_CHOICE → AWAITING_RESUME
- ✅ AWAITING_RESUME_CHOICE → AWAITING_MANUAL_BIO
- ✅ AWAITING_RESUME_CHOICE → AWAITING_SKILLS (skip resume)
- ✅ AWAITING_MANUAL_BIO → AWAITING_MANUAL_EDUCATION
- ✅ AWAITING_MANUAL_EDUCATION → AWAITING_MANUAL_EXPERIENCE
- ✅ AWAITING_MANUAL_EXPERIENCE → AWAITING_MANUAL_SKILLS
- ✅ AWAITING_MANUAL_EXPERIENCE → AWAITING_MANUAL_EDUCATION (back)
- ✅ AWAITING_MANUAL_SKILLS → AWAITING_MANUAL_CONTACT
- ✅ AWAITING_MANUAL_SKILLS → AWAITING_MANUAL_EXPERIENCE (back)
- ✅ AWAITING_MANUAL_CONTACT → AWAITING_SKILLS
- ✅ AWAITING_SKILLS → AWAITING_GPS_VISION
- ✅ AWAITING_GPS_VISION → AWAITING_GPS_INTERESTS
- ✅ AWAITING_GPS_INTERESTS → AWAITING_GPS_GOAL
- ✅ AWAITING_GPS_GOAL → AWAITING_ID
- ✅ AWAITING_ID → AWAITING_TC
- ✅ AWAITING_TC → COMPLETED
- ✅ AWAITING_CAREER_READINESS → AWAITING_EXPERIENCE

### 3. **Logout Step Saving**
**File:** Same file (lines 330-345)
- When user types "logout" or "exit", current step is saved before logout
- Implementation: `await apiClient.post("/candidate/step", { step: state }, token)`

### 4. **Input Delegation to Career Readiness**
**File:** `apps/web/src/components/CareerReadinessFlow.tsx`
- Added event listener for "careerReadinessInput" custom event
- Parent form dispatches keyboard/mic input to Career Readiness component

---

## 🧪 Test Plan

### Phase 1: Basic Flow Navigation (5 min)
**Goal:** Verify each step transitions correctly without logout

```
✅ Test 1.1: Fresh Login → Career Readiness Loads
  - Clear browser localStorage
  - Log in with new candidate account
  - Expected: Career Readiness component loads directly (NO welcome message flicker)
  - Verify: No "Welcome back" message on first login
  
✅ Test 1.2: Career Readiness → Experience
  - Answer all 5 Career Readiness questions (e.g., "I'm currently employed")
  - Expected: Transitions to Experience level selection
  - Verify: Message asks about experience band (Fresher/Mid/Senior/Leadership)
  
✅ Test 1.3: Experience → Resume Choice
  - Select an experience band (e.g., "Mid-level")
  - Expected: Transitions to Resume upload/build choice
  - Verify: Message shows upload/build/skip resume options
  
✅ Test 1.4: Resume → Skills Path
  - Select "Skip for Now" on resume choice
  - Expected: Transitions to Skills entry
  - Verify: Message asks for key skills (e.g., SaaS, CRM)
  
✅ Test 1.5: Skills → Career Vision
  - Enter 3-4 skills separated by commas
  - Expected: Transitions to GPS Vision
  - Verify: Message asks for target role
  
✅ Test 1.6: Career Vision Pipeline
  - Enter target role (e.g., "Enterprise AE")
  - Expected: Transitions to GPS Interests
  - Enter interests (e.g., "SaaS, Cloud")
  - Expected: Transitions to GPS Goal
  - Enter long-term goal (e.g., "VP of Sales")
  - Expected: Transitions to ID verification
  
✅ Test 1.7: ID → Terms & Conditions
  - Pick "Skip ID Proof for Now" (or upload)
  - Expected: Transitions to Terms & Conditions
  - Verify: Message shows "Read Terms" and "Accept" options
```

### Phase 2: Session Persistence - Logout & Resume (10 min)
**Goal:** Verify logout saves current step and resume works

```
✅ Test 2.1: Logout at Experience Level
  - Start fresh login, complete Career Readiness
  - At Experience selection, type "logout"
  - Expected: Message "Saving your progress and logging out..."
  - Check Backend: Verify `/candidate/step` endpoint was called
  - Check Database: Query candidate_profiles.onboarding_step = "AWAITING_EXPERIENCE"
  
✅ Test 2.2: Re-login After Logout at Experience
  - Log out (from Test 2.1)
  - Log back in with same account
  - Expected: 
    - Loads directly to Experience selection (NO Career Readiness flicker)
    - Message shows "Let's pick up where we left off"
    - Input area shows Experience selection prompts
  - Verify: No re-doing Career Readiness
  
✅ Test 2.3: Logout at Manual Resume - Bio
  - Complete Career Readiness + Experience
  - At Resume choice, select "Build Manually"
  - At Bio prompt, type "logout"
  - Expected: Saves to "AWAITING_MANUAL_BIO"
  - Re-login and verify resumed at Bio step
  
✅ Test 2.4: Logout at Manual Resume - Education  
  - Complete to Education step, enter education details
  - Type "logout"
  - Expected: Saves to "AWAITING_MANUAL_EDUCATION"
  - Re-login and verify resumed with previous context
  
✅ Test 2.5: Logout at Manual Resume - Experience
  - Complete to Experience step, enter experience
  - Type "logout"  
  - Expected: Saves to "AWAITING_MANUAL_EXPERIENCE"
  - Re-login and verify can continue adding more experience
  
✅ Test 2.6: Logout at Manual Resume - Skills
  - Complete to Skills entry, enter skills
  - Type "logout"
  - Expected: Saves to "AWAITING_MANUAL_SKILLS"
  - Re-login and confirm previous skills are preserved
  
✅ Test 2.7: Logout at Skills Selection
  - Complete manual resume
  - At Skills entry, type "logout"
  - Expected: Saves to "AWAITING_SKILLS"
  - Re-login and verify at Skills step
  
✅ Test 2.8: Logout at GPS Vision/Interests/Goal
  - Complete skills entry
  - At each GPS step (Vision, Interests, Goal), test logout
  - Expected: Each saves correctly ("AWAITING_GPS_VISION", etc.)
  - Re-login and verify resumption
  
✅ Test 2.9: Logout at ID + Terms
  - Complete GPS steps
  - At ID step, logout
  - Expected: Saves to "AWAITING_ID"
  - Re-login and verify at ID step
  - Repeat for Terms & Conditions step
```

### Phase 3: Input Methods (10 min)
**Goal:** Verify keyboard and mic inputs work across all steps

```
✅ Test 3.1: Keyboard Input - Career Readiness
  - At Career Readiness step:
    - Type "I'm currently employed" in input box
    - Press ENTER
  - Expected: Component processes input, moves to next question
  - Verify: No errors in browser console
  
✅ Test 3.2: Keyboard Input - Experience Selection
  - At Experience step:
    - Type "Mid-level" in input box
    - Press ENTER
  - Expected: Selected "mid" band, transitions to Resume
  - Verify: Message confirms selection
  
✅ Test 3.3: Keyboard Input - Resume Choice
  - Type "Upload" → transitions to resume upload
  - Type "Build" → transitions to manual resume
  - Type "Skip" → transitions to skills
  - Expected: All work correctly
  
✅ Test 3.4: Keyboard Input - Manual Resume Flow
  - Type bio, education, experience, skills across manual flow
  - Press ENTER at each step
  - Expected: All inputs are processed and saved in manualResumeData
  - Verify: When completing manual resume, click "Generate Resume" button
  
✅ Test 3.5: Keyboard Input - Skills Entry
  - At Skills step:
    - Type "SaaS Sales, Lead Generation, Negotiation"
    - Press ENTER
  - Expected: All 3 skills added, transitions to GPS Vision
  - Verify: Skills saved to database via /candidate/skills endpoint
  
✅ Test 3.6: Keyboard Input - GPS Vision/Interests/Goal
  - Type target role at Vision step
  - Type interests at Interests step
  - Type goal at Goal step
  - Expected: All processed and saved
  - Verify: Check PATCH requests to /candidate/profile endpoint
  
✅ Test 3.7: Mic Input - Career Readiness (If Configured)
  - Click Mic button during Career Readiness
  - Speak "I'm currently employed"
  - Expected: Transcribed text processed (if mic configured)
  - Note: May be disabled in dev - skip if not needed
  
✅ Test 3.8: Mic Input - Other Steps (If Configured)
  - Test mic at Experience, Skills, and GPS Vision steps
  - Expected: All dispatch to careerReadinessInput event listener
```

### Phase 4: Resume Upload Flow (5 min)
**Goal:** Verify resume parsing and transition

```
✅ Test 4.1: Resume Upload - PDF Selection
  - At Resume upload step:
    - Click "Upload PDF" button
    - Select a valid PDF file
  - Expected:
    - File uploads to S3 (check DEBUG logs)
    - Backend triggers parse_resume task
    - Polling starts (up to 20 attempts)
    - Skills extracted and displayed
  - Verify: Check backend logs for parse results
  
✅ Test 4.2: Resume Upload - Data Persistence
  - Verify resume upload saves:
    - file_url in candidate_profiles.resume_url
    - resume_uploaded flag set to TRUE
    - Parsed skills saved to candidate_profiles.skills
  - Use browser DevTools Network tab to verify API calls
  
✅ Test 4.3: Resume Upload - Transition to Skills
  - After resume parsed successfully:
    - Expected: Auto-transitions to Skills entry
    - Suggested skills from resume shown as options
  - Verify: No manual button click needed
```

### Phase 5: Database Verification (5 min)
**Goal:** Verify all states are correctly saved to database

```
✅ Test 5.1: Check Candidate Profile Table
  - Connect to AWS RDS PostgreSQL (ap-south-1)
  - Query: SELECT user_id, email, onboarding_step, resume_uploaded FROM candidate_profiles WHERE email = 'test@example.com'
  - Verify:
    - onboarding_step reflects last step visited
    - resume_uploaded is TRUE if resume sent
    - All timestamps are recent
  
✅ Test 5.2: Check Step History (if logged)
  - Query ResumeData table for parsing logs
  - Verify all resume parsing attempts are recorded
  
✅ Test 5.3: Check Logout Saves
  - After each logout test, verify onboarding_step = expected state
  - Confirm no data loss on logout
```

### Phase 6: Edge Cases & Error Handling (5 min)
**Goal:** Verify error scenarios handled gracefully

```
✅ Test 6.1: Browser Refresh at Each Step
  - At Career Readiness: Refresh page
    - Expected: Stays at Career Readiness (state persisted)
  - At Manual Education: Refresh page
    - Expected: Stays at Manual Education (data preserved)
  - At Skills: Refresh page
    - Expected: Stays at Skills (selected skills shown)
  - Verify: No data loss on refresh
  
✅ Test 6.2: Network Error During Transition
  - With DevTools Network Throttle:
    - At Experience step, select band while throttled
    - Expected: Graceful error message or retry
    - Verify: State doesn't break
  
✅ Test 6.3: Missing Backend Response
  - If saveStep() fails (backend down):
    - Expected: Error logged to console
    - User can still proceed (optimistic UI)
    - Next logout will retry save
  
✅ Test 6.4: Invalid Input Handling
  - At Experience: Type nonsense input (not Fresher/Mid/Senior/Leadership)
    - Expected: Rejected with "I didn't quite catch that"
    - Re-prompts with options
  - At Skills: Type empty input
    - Expected: Validation message or no state change
```

---

## 🔍 Verification Checklist

### Frontend (Browser DevTools)
- [ ] Console: No errors during flow (check for "Failed to save" or API errors)
- [ ] Network tab: 
  - [ ] Each state change triggers POST to `/candidate/step`
  - [ ] Resume upload triggers POST to `/storage/upload/resume`
  - [ ] Skills entry triggers POST to `/candidate/skills`
  - [ ] GPS updates trigger PATCH to `/candidate/profile`
- [ ] Local Storage: 
  - [ ] Chat history preserved at each step
  - [ ] Key `tf_onboarding_chat_${userId}` contains messages

### Backend (API Logs)
- [ ] Each state transition logged (check for "[ONBOARDING]" prefix)
- [ ] Resume parsing logged: "[RESUME PARSING] Starting background task"
- [ ] Step saves logged: "POST /candidate/step - Status: 200"
- [ ] No 500 errors during state transitions

### Database (PostgreSQL)
- [ ] `candidate_profiles.onboarding_step` updates correctly
- [ ] `candidate_profiles.resume_url` populated after upload
- [ ] `candidate_profiles.skills` contains extracted skills
- [ ] No duplicate step saves (check timestamps)

---

## 🚀 Test Execution

### Quick Smoke Test (5 min)
1. Fresh login → Career Readiness loads
2. Type response → Advances to Experience
3. Select experience → Advances to Resume choice
4. Skip resume → Advances to Skills
5. Enter skills → Completes onboarding to dashboard
6. **Expected:** All transitions happen with "Loading..." feedback

### Full Validation Suite (45 min)
1. Run Phase 1 (Basic Flow) - 5 min
2. Run Phase 2 (Session Persistence) - 10 min
3. Run Phase 3 (Input Methods) - 10 min
4. Run Phase 4 (Resume Upload) - 5 min
5. Run Phase 5 (Database Verification) - 5 min
6. Run Phase 6 (Edge Cases) - 5 min

### Automated Checks
- [ ] No build errors: `npm run build` in apps/web
- [ ] No TypeScript errors: `npx tsc --noEmit` 
- [ ] No lint errors: `npm run lint` (if available)
- [ ] No backend 500 errors in logs during full flow

---

## 📊 Success Criteria

All of the following must be TRUE:
- ✅ User can complete full onboarding (Career Readiness → TC → Dashboard)
- ✅ Logout at ANY step saves that step to database
- ✅ Re-login resumes from exact same step
- ✅ No state transitions happen without `saveStep()` calls
- ✅ All inputs (keyboard + mic) work across all steps
- ✅ No "Loading..." spinner hangs (should complete or show error in <5s)
- ✅ Database reflects all step changes (last_update timestamp recent)
- ✅ No console errors or warnings related to onboarding
- ✅ Session persists across browser refresh

---

## 🐛 Debugging Guide

### If logout doesn't save step:
1. Check browser console: Should log "POST /candidate/step - Status: 200"
2. Check backend logs: Should show "DEBUG: POST /candidate/step"
3. Verify JWT token valid: awsAuth.getToken() should return value
4. Check database: `SELECT * FROM candidate_profiles WHERE user_id = 'xxx' LIMIT 1`

### If re-login doesn't resume from saved step:
1. Verify step was saved in database (check previous point)
2. Check init() function in page.tsx: Verify it reads profile.onboarding_step
3. Check localStorage: Should contain chat history for that step
4. If localStorage cleared, chat context is lost but state should still load from DB

### If state transition doesn't save:
1. Verify saveStep() was called before setState()
2. Check for errors in try-catch block
3. Verify apiClient.post() is working (test with other endpoints)
4. Check network throttle: High latency may cause timeout

### If inputs not processing:
1. For Career Readiness: Verify event listener added to CareerReadinessFlow.tsx
2. Check careerReadinessInput custom event dispatch in page.tsx
3. Verify input box isn't disabled or read-only
4. Check browser console for event listener errors

---

## 📝 Notes

- **Test User:** Create dedicated test account for repeatability
- **Clear Data:** Use browser DevTools → Application → Storage → Clear All between test runs
- **Monitor Logs:** Keep backend console visible during testing
- **Network Tab:** Watch for failed requests, slow endpoints
- **Timing:** Some timeouts are 1s-based, so fast local testing may show slight delays

---

## ✨ Final Checklist Before Production

- [ ] All 15+ state transitions tested and verified
- [ ] Logout/resume tested at minimum 5 different steps
- [ ] Resume upload tested with real PDF
- [ ] Skills extraction confirmed
- [ ] Database persistence confirmed
- [ ] No console errors or warnings
- [ ] Performance acceptable (<2s per transition)
- [ ] Accessibility: Tab navigation works through input areas
- [ ] Mobile: UI responsive on small screens (if needed)
