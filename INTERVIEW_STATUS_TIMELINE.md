# Interview Flow: Visual Timeline & Status Transitions

## Interview Lifecycle: Actual vs Expected

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ACTUAL SYSTEM BEHAVIOR (Current Buggy State)                           │
└─────────────────────────────────────────────────────────────────────────┘

Step 1: Propose Interview
  ├─ Recruiter creates interview proposal
  └─ interview.status = "pending_confirmation"
     ├─ recruiter_joined_at = null
     └─ candidate_joined_at = null

                           ↓

Step 2: Candidate Confirms Slot
  ├─ Candidate selects preferred time
  └─ interview.status = "scheduled"
     ├─ recruiter_joined_at = null
     └─ candidate_joined_at = null

                           ↓

Step 3: Recruiter Clicks "Join Session"
  ├─ POST /interviews/{id}/join-event (role: recruiter)
  └─ interview.status = "scheduled"  ← STAYS SAME!
     ├─ recruiter_joined_at = 2024-04-17 10:30:45.123  ✓ SET
     └─ candidate_joined_at = null
     └─ Notification: "Recruiter is waiting"

  🎯 UI Shows: "Scheduled Transmission" (blue)
  ❌ WRONG! Should show: "Live: Interview in Progress"

                           ↓

Step 4: Candidate Clicks "Join Session"  
  ├─ POST /interviews/{id}/join-event (role: candidate)
  └─ interview.status = "scheduled"  ← STAYS SAME!
     ├─ recruiter_joined_at = 2024-04-17 10:30:45.123
     └─ candidate_joined_at = 2024-04-17 10:31:12.456  ✓ SET
     └─ Notification: "Candidate is waiting"

  🎯 UI Shows: "Scheduled Transmission" (blue)
  ❌ WRONG! Should show: "Live: Interview in Progress"

                           ↓

Step 5: Recruiter Submits Feedback
  ├─ POST /interviews/{id}/feedback { feedback: "...", next_status: "offered" }
  └─ interview.status = "completed"  ← FINALLY CHANGES!
     ├─ interview.feedback = "Great communication skills"
     └─ application.status = "offered"

  ✓ UI Shows: Interview in "Historical Archives" section
  ✓ CORRECT! This part works.


┌─────────────────────────────────────────────────────────────────────────┐
│ EXPECTED SYSTEM BEHAVIOR (What Should Happen)                          │
└─────────────────────────────────────────────────────────────────────────┘

The ONLY difference should be that the UI correctly detects both have joined
by checking the timestamps, not by looking for a non-existent "in_progress"
status.

Status stays "scheduled" → "completed" (correct)
BUT UI should use timestamps to know when both are joined (currently broken)
```

---

## State Matrix: What Exists vs What Gets Checked

```
┌──────────────────────────────┬─────────────────┬──────────────────┐
│ UI Element                   │ Currently Checks│ Should Check      │
├──────────────────────────────┼─────────────────┼──────────────────┤
│ Status Badge Color           │ status="in_prog"│ both_joined       │
│ Pulse Indicator (🟢)         │ status="in_prog"│ both_joined       │
│ Status Text                  │ status="in_prog"│ both_joined       │
│ Join Button Label            │ status="in_prog"│ both_joined       │
│ Feedback Button              │ status="sched"  │ status="sched" OR │
│                              │                 │ recruiter_joined  │
├──────────────────────────────┼─────────────────┼──────────────────┤
│ API Actually Returns         │ Never returns   │ Always returns    │
│                              │ "in_progress"   │ timestamps        │
└──────────────────────────────┴─────────────────┴──────────────────┘

where:
  both_joined = recruiter_joined_at && candidate_joined_at
  recruiter_joined = !!recruiter_joined_at
```

---

## Data Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│ Backend: apps/api/src/services/interview_service.py                 │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  POST /interviews/{id}/join-event                                    │
│  ├─ role = "recruiter" or "candidate"                               │
│  ├─ Validates join window (15m before start, 5m after)             │
│  ├─ Updates interview.recruiter_joined_at OR                        │
│  │  interview.candidate_joined_at = datetime.utcnow()              │
│  ├─ Sends notification to other party                              │
│  ├─ db.commit()                                                     │
│  └─ Returns: { "status": "success" }                               │
│                                                                      │
│  ⚠️ NOTE: interview.status NOT CHANGED                              │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────────┐
│ API Response: GET /interviews/my                                      │
├──────────────────────────────────────────────────────────────────────┤
│ {                                                                    │
│   id: "int_123",                                                    │
│   status: "scheduled",           ← Still "scheduled"               │
│   recruiter_joined_at: "2024-04-17T10:30:45.123Z",                 │
│   candidate_joined_at: null,                                        │
│   meeting_link: "https://meet.jitsi.org/...",                       │
│   ...                                                               │
│ }                                                                    │
└──────────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────────┐
│ Frontend: apps/web/src/app/.../applications/page.tsx                │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Polling: setInterval(fetchApplications, 60000)                    │
│  │                                                                   │
│  ├─ GET /recruiter/applications/pipeline                           │
│  ├─ GET /interviews/my                                              │
│  │                                                                   │
│  └─ Merges interviews into each application                         │
│     appsData.interviews = interviewData.filter(                    │
│       i => i.application_id === app.id                             │
│     )                                                               │
│                                                                      │
│  Data CORRECT ✓ - timestamps are present                           │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────────┐
│ Frontend: apps/web/src/components/CandidateProfileModal.tsx         │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  const activeInterview = interviews.find(                           │
│    i => i.status === "scheduled" ||                                │
│         i.status === "pending_confirmation" ||                     │
│         i.status === "in_progress"  ← ❌ NEVER EXISTS               │
│  )                                                                   │
│                                                                      │
│  activeInterview.status === "in_progress"  ← ❌ ALWAYS FALSE        │
│                                                                      │
│  ✓ activeInterview.recruiter_joined_at  ← ✓ TRUE (but not checked) │
│  ✓ activeInterview.candidate_joined_at  ← ✗ null (not both joined) │
│                                                                      │
│  Display Logic Bug:                                                 │
│  • Status Badge: shows blue instead of emerald                     │
│  • Pulse Icon: clock instead of pulse                              │
│  • Join Button: "Join Session" instead of "Return to Live"        │
│  • Feedback Button: works by accident (status coincidentally       │
│                     still "scheduled")                             │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Timeline: One Recruiter, One Candidate

```
Time    Recruiter's View          Candidate's View          Interview Object
────    ────────────────          ────────────────          ────────────────

10:00   "Join in 15 minutes"      "Waiting for interview"   status: "scheduled"
        Join button: LOCKED       (Joins at 10:20)          recruiter: null
                                                             candidate: null

10:15   "Join available now"      "Waiting for interview"   status: "scheduled"
        Join button: ENABLED                                recruiter: null
                                                             candidate: null

10:20   ✓ Recruiter Joins         "Recruiter has joined"    status: "scheduled"
        Sees interview live                                  recruiter: 10:20:45 ✓
        (WRONG - still shows      Join button: ENABLED      candidate: null
         "Scheduled", should 
         show "Live")

10:25   "Return to Meeting"       ✓ Candidate Joins         status: "scheduled"
        (WRONG - still says       Now interviewing...       recruiter: 10:20:45
         "Scheduled")             (WRONG - shows            candidate: 10:25:12 ✓
                                   "Scheduled", should
        Feedback button READY     show "Live")

10:35   Submits Feedback          Interview ends            status: "completed"
        "Offered"                 Notification: "You were   recruiter: 10:20:45
                                  offered position!"        candidate: 10:25:12
        Interview moves to                                  feedback: "Great
        Historical Archives                                 communicator..."

10:40   Views offer details       Views offer details       Can view feedback
        Selects salary option     Selects terms             Application status:
                                                             "offered"
```

---

## Bug Reproduction Steps

```
1. Recruiter opens Candidate Profile Modal
   └─ Tab: "Interview Info"
   └─ Active Interview card shown
      └─ Status Badge: "✓ Confirmed" (blue with green border)
      └─ Status Text: "Scheduled Transmission"
      └─ Icon: Clock ⏰ (blue)
      └─ Timestamp: "17 April, 10:20 AM IST"

2. Recruiter clicks "Join Session"
   └─ Interview time window is open
   └─ Post /interviews/{id}/join-event sent
   └─ Jitsi window opens in new tab
   └─ recruiter_joined_at set in DB ✓

3. [Back in modal - no visible change!]
   └─ Status Badge: STILL "✓ Confirmed" (blue)  ← ❌ WRONG
   └─ Status Text: STILL "Scheduled Transmission"  ← ❌ WRONG  
   └─ Icon: STILL Clock ⏰ (blue)  ← ❌ WRONG
   └─ Join Button: STILL says "Join Session"  ← ❌ WRONG
                   Should say "Return to Live Session"

4. Candidate clicks "Join Session" (from their modal)
   └─ Post /interviews/{id}/join-event sent
   └─ Jitsi window opens
   └─ candidate_joined_at set in DB ✓

5. [Back in recruiter modal - still no change!]
   └─ Status Badge: STILL blue  ← ❌ WRONG
   └─ Status Text: STILL "Scheduled Transmission"  ← ❌ WRONG
   └─ Should show: "Live: Interview in Progress"

6. Recruiter submits feedback
   └─ Interview status finally changes to "completed"
   └─ Now appears in "Historical Archives" section

✓ What SHOULD happen: After step 2, UI should update
                      showing "Live: Interview in Progress"
```

---

## Code Path Comparison

### What Works ✓
```
ApplicationPage
  └─ setInterval(fetchApplications, 60000)
     └─ GET /interviews/my
        └─ Backend returns recruiter_joined_at ✓
           └─ Data is correct ✓

InterviewFeedbackModal  
  └─ Uses recruiterJoinedAt timestamp ✓
     └─ Disables "Offered" button if recruiter didn't join ✓
        └─ Allows "Not Conducted" if recruiter absent ✓

Feedback Submission
  └─ Backend checks recruiter_joined_at ✓
     └─ Sets status = "completed" ✓
        └─ Updates application status ✓
```

### What Doesn't Work ❌
```
CandidateProfileModal
  └─ activeInterview.status === "in_progress"  ❌
     ├─ Line 586: Background color wrong
     ├─ Line 593: Pulse icon never shows
     ├─ Line 599: Text color wrong
     ├─ Line 605: Status label wrong
     ├─ Line 626: Conditional render has extra check
     └─ Line 663: Button label wrong

  └─ Line 673: Feedback button "works by accident"
     └─ Should explicitly check recruiter_joined_at
```

---

## Fix Verification Matrix

After applying fixes, check that:

```
┌────────────────┬──────────────────────┬──────────────┬──────────────┐
│ State          │ Status Badge         │ Icon         │ Join Button  │
├────────────────┼──────────────────────┼──────────────┼──────────────┤
│ Before Join    │ Blue "Confirmed"     │ Clock ⏰     │ "Join Sesion"│
├────────────────┼──────────────────────┼──────────────┼──────────────┤
│ Recruiter Only │ Blue "Confirmed"*    │ Clock ⏰     │ "Return..."  │
│ (FIXED)        │ *was wrong before    │ (fixed)      │ (fixed)      │
├────────────────┼──────────────────────┼──────────────┼──────────────┤
│ Both Joined    │ Emerald "Live"*      │ Pulse 🟢     │ "Return..."  │
│ (FIXED)        │ *was blue before     │ (fixed)      │ (fixed)      │
├────────────────┼──────────────────────┼──────────────┼──────────────┤
│ Feedback Subm. │ Not visible (moved   │ N/A          │ N/A          │
│                │ to Historical)       │              │              │
└────────────────┴──────────────────────┴──────────────┴──────────────┘
```

---

## Key Insight

**The bug is purely a UI display issue.**

The backend and API are working CORRECTLY:
- ✓ Timestamps are set properly
- ✓ Feedback validation works
- ✓ Status transitions work
- ✓ Data polling works

The bug is in the frontend display logic:
- ❌ Checking for non-existent "in_progress" status
- ❌ Not using available timestamp data
- ❌ UI shows wrong visual indicators

**Fix:** Use timestamps instead of non-existent status value.
