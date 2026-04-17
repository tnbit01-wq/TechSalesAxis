# Interview Status Bug: API Response & Data Structure

## Actual API Response from `/interviews/my`

### BEFORE Recruiter Joins

```json
{
  "id": "int_uuid_123",
  "status": "scheduled",
  "round_number": 1,
  "round_name": "Initial Technical Screening",
  "job_id": "job_uuid_456",
  "recruiter_id": "recruiter_uuid_789",
  "candidate_id": "candidate_uuid_101",
  "application_id": "app_uuid_202",
  "meeting_link": "https://meet.jitsi.org/talentflow-int_uuid_123",
  "feedback": null,
  "recruiter_joined_at": null,           ← ✓ NULL = Not joined yet
  "candidate_joined_at": null,           ← ✓ NULL = Not joined yet
  "created_at": "2024-04-17T09:00:00Z",
  "updated_at": "2024-04-17T09:00:00Z",
  "interview_slots": [
    {
      "id": "slot_uuid",
      "interview_id": "int_uuid_123",
      "start_time": "2024-04-17T10:20:00Z",
      "end_time": "2024-04-17T11:20:00Z",
      "is_selected": true,
      "created_at": "2024-04-17T09:00:00Z"
    }
  ]
}
```

**Frontend sees:**
```typescript
activeInterview.status = "scheduled"  ✓
activeInterview.recruiter_joined_at = null  ✓ (Available but not checked!)
activeInterview.candidate_joined_at = null  ✓ (Available but not checked!)
activeInterview.status === "in_progress" = false  (because "in_progress" never exists)
```

---

### AFTER Recruiter Clicks "Join Session"

```json
{
  "id": "int_uuid_123",
  "status": "scheduled",                   ← ✓ STILL "scheduled" (NOT changed to "in_progress")
  "round_number": 1,
  "round_name": "Initial Technical Screening",
  "job_id": "job_uuid_456",
  "recruiter_id": "recruiter_uuid_789",
  "candidate_id": "candidate_uuid_101",
  "application_id": "app_uuid_202",
  "meeting_link": "https://meet.jitsi.org/talentflow-int_uuid_123",
  "feedback": null,
  "recruiter_joined_at": "2024-04-17T10:20:45.123Z",  ← ✓ NOW SET!
  "candidate_joined_at": null,                        ← ✓ Still null
  "created_at": "2024-04-17T09:00:00Z",
  "updated_at": "2024-04-17T10:20:45.123Z",
  "interview_slots": [
    {
      "id": "slot_uuid",
      "interview_id": "int_uuid_123",
      "start_time": "2024-04-17T10:20:00Z",
      "end_time": "2024-04-17T11:20:00Z",
      "is_selected": true,
      "created_at": "2024-04-17T09:00:00Z"
    }
  ]
}
```

**Frontend sees:**
```typescript
activeInterview.status = "scheduled"  ✓ (Correct - status doesn't change)
activeInterview.recruiter_joined_at = "2024-04-17T10:20:45.123Z"  ✓ (Available!)
activeInterview.candidate_joined_at = null  ✓ (Available!)
activeInterview.status === "in_progress" = false  ❌ WRONG! Should show live indicator
```

**Bug manifest:** UI still shows blue "Scheduled" badge even though recruiter has joined

---

### AFTER Candidate Also Joins

```json
{
  "id": "int_uuid_123",
  "status": "scheduled",                   ← ✓ STILL "scheduled"
  "round_number": 1,
  "round_name": "Initial Technical Screening",
  "job_id": "job_uuid_456",
  "recruiter_id": "recruiter_uuid_789",
  "candidate_id": "candidate_uuid_101",
  "application_id": "app_uuid_202",
  "meeting_link": "https://meet.jitsi.org/talentflow-int_uuid_123",
  "feedback": null,
  "recruiter_joined_at": "2024-04-17T10:20:45.123Z",  ← ✓ SET
  "candidate_joined_at": "2024-04-17T10:25:12.456Z",  ← ✓ NOW ALSO SET!
  "created_at": "2024-04-17T09:00:00Z",
  "updated_at": "2024-04-17T10:25:12.456Z",
  "interview_slots": [
    {
      "id": "slot_uuid",
      "interview_id": "int_uuid_123",
      "start_time": "2024-04-17T10:20:00Z",
      "end_time": "2024-04-17T11:20:00Z",
      "is_selected": true,
      "created_at": "2024-04-17T09:00:00Z"
    }
  ]
}
```

**Frontend sees:**
```typescript
activeInterview.status = "scheduled"  ✓ (Still correct)
activeInterview.recruiter_joined_at = "2024-04-17T10:20:45.123Z"  ✓
activeInterview.candidate_joined_at = "2024-04-17T10:25:12.456Z"  ✓
activeInterview.status === "in_progress" = false  ❌ STILL WRONG!
```

**Major Bug:** Both participants are in the meeting, but UI shows "Scheduled Transmission" instead of "Live: Interview in Progress"

---

### AFTER Recruiter Submits Feedback

```json
{
  "id": "int_uuid_123",
  "status": "completed",                    ← ✓ NOW CHANGED!
  "round_number": 1,
  "round_name": "Initial Technical Screening",
  "job_id": "job_uuid_456",
  "recruiter_id": "recruiter_uuid_789",
  "candidate_id": "candidate_uuid_101",
  "application_id": "app_uuid_202",
  "meeting_link": "https://meet.jitsi.org/talentflow-int_uuid_123",
  "feedback": "Excellent technical knowledge. Strong communication skills. Recommended for next round.",
  "recruiter_joined_at": "2024-04-17T10:20:45.123Z",
  "candidate_joined_at": "2024-04-17T10:25:12.456Z",
  "created_at": "2024-04-17T09:00:00Z",
  "updated_at": "2024-04-17T10:35:00.789Z",
  "interview_slots": [
    {
      "id": "slot_uuid",
      "interview_id": "int_uuid_123",
      "start_time": "2024-04-17T10:20:00Z",
      "end_time": "2024-04-17T11:20:00Z",
      "is_selected": true,
      "created_at": "2024-04-17T09:00:00Z"
    }
  ]
}
```

**Frontend sees:**
```typescript
activeInterview.status = "completed"  ✓ (Different find filter now)
activeInterview.recruiter_joined_at = "2024-04-17T10:20:45.123Z"  ✓
activeInterview.candidate_joined_at = "2024-04-17T10:25:12.456Z"  ✓
activeInterview.feedback = "Excellent technical knowledge..."  ✓

// Now appears in completedInterviews instead of activeInterview
completedInterviews = [
  { id: "int_uuid_123", status: "completed", feedback: "...", ... }
]
```

---

## Why the Bug Exists: Status Enum Values

### Backend Interview Service (`apps/api/src/services/interview_service.py`)

```python
# Line 139: Create with "SCHEDULED" 
interview.status = InterviewStatus.SCHEDULED

# Line 256: Can be cancelled
interview.status = "cancelled"

# Line 285: Can be completed
interview.status = "completed"

# MISSING: No "in_progress" assignment anywhere!
# git grep -n "in_progress" apps/api/src/
#   (Returns 0 results for status assignment)
```

### Frontend Interview Modal (`apps/web/src/components/CandidateProfileModal.tsx`)

```typescript
// Line 107: Looks for non-existent status
const activeInterview = (interviews || []).find(i => 
  i.status === "scheduled" || 
  i.status === "pending_confirmation" || 
  i.status === "in_progress"  // ← This NEVER comes from API
);

// Lines 586-663: Checks for "in_progress" (6+ times)
// But API never provides this value!
```

---

## Data Transformation: From API to UI

```
┌─────────────────────────────────────────────────────────────┐
│ GET /interviews/my (Raw API Response)                      │
├─────────────────────────────────────────────────────────────┤
│ {                                                           │
│   "id": "int_123",                                          │
│   "status": "scheduled",                                    │
│   "recruiter_joined_at": "2024-04-17T10:20:45.123Z",      │
│   "candidate_joined_at": null,                              │
│ }                                                           │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ ApplicationPage: fetchApplications() - Line 142             │
├─────────────────────────────────────────────────────────────┤
│ const appsData = (data || []).map((app: any) => ({        │
│   ...app,                                                   │
│   interviews: (interviewData || []).filter(                │
│     (i: any) => i.application_id === app.id               │
│   ),                                                        │
│ }));                                                        │
│                                                             │
│ // appsData structure:                                     │
│ {                                                           │
│   id: "app_123",                                            │
│   status: "interview_scheduled",                            │
│   interviews: [                                             │
│     {                                                       │
│       id: "int_123",                                        │
│       status: "scheduled",                                  │
│       recruiter_joined_at: "2024-04-17T10:20:45.123Z",    │
│       candidate_joined_at: null,                            │
│     }                                                       │
│   ],                                                        │
│ }                                                           │
│                                                             │
│ ✓ Data structure correct ✓                                 │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ CandidateProfileModal - Line 107                           │
├─────────────────────────────────────────────────────────────┤
│ const activeInterview = (interviews || []).find(i =>      │
│   i.status === "scheduled" ||                              │
│   i.status === "pending_confirmation" ||                   │
│   i.status === "in_progress"  // ← Data DOESN'T have this │
│ );                                                          │
│                                                             │
│ // activeInterview is found and contains:                 │
│ {                                                           │
│   id: "int_123",                                            │
│   status: "scheduled",      ✓ (MATCHED!)                  │
│   recruiter_joined_at: "2024-04-17T10:20:45.123Z",  ✓    │
│   candidate_joined_at: null,                               │
│ }                                                           │
│                                                             │
│ ✓ activeInterview found ✓                                  │
│ ✓ Data contains timestamps ✓                               │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Display Logic - Line 586                                    │
├─────────────────────────────────────────────────────────────┤
│ if (activeInterview.status === "in_progress") {            │
│   // bg-emerald-50 (green)                                 │
│ } else if (activeInterview.status === "scheduled") {       │
│   // bg-blue-100 (blue)  ← EXECUTES HERE                  │
│ }                                                           │
│                                                             │
│ ❌ Condition 1: FALSE (no "in_progress" in data)          │
│ ✓ Condition 2: TRUE (status IS "scheduled")                │
│                                                             │
│ Result: Shows BLUE background (wrong!)                     │
│ Should: Check if recruiter_joined_at exists (right!)      │
│                                                             │
│ // FIXED VERSION:                                          │
│ if (activeInterview.recruiter_joined_at &&                │
│     activeInterview.candidate_joined_at) {                │
│   // bg-emerald-50 (green)  ← WOULD EXECUTE HERE          │
│ } else if (activeInterview.status === "scheduled") {      │
│   // bg-blue-100 (blue)                                    │
│ }                                                           │
│                                                             │
│ ✓ Result: Shows correct color ✓                           │
└─────────────────────────────────────────────────────────────┘
```

---

## Summary: What API Returns vs What UI Checks

| Timestamp Field | Present in API? | UI Currently Checks? | UI Should Check? |
|---|---|---|---|
| `recruiter_joined_at` | ✓ Always | ❌ No | ✓ Yes |
| `candidate_joined_at` | ✓ Always | ❌ No | ✓ Yes |
| `status = "in_progress"` | ❌ Never | ✓ Yes (6+ places) | ❌ No |
| `status = "scheduled"` | ✓ Always | ✓ Yes | ✓ Yes |
| `status = "completed"` | ✓ Always | ✓ Yes | ✓ Yes |

---

## Verification: Check API Response Yourself

### Step 1: Open Browser DevTools
```
F12 → Network tab → Filter: /interviews/my
```

### Step 2: Trigger Interview Data Fetch
```
In CandidateProfileModal:
- Scroll to Interview Info tab
- Or: Open Recruiter Dashboard → Applications
```

### Step 3: Inspect Response
```json
{
  "recruiter_joined_at": "2024-04-17T10:20:45.123Z",   ← Present!
  "candidate_joined_at": null,                          ← Present!
  "status": "scheduled"                                 ← NOT "in_progress"
}
```

### Step 4: Compare with Code
```typescript
// CandidateProfileModal.tsx - Line 586
activeInterview.status === "in_progress"  // ← This is what's being checked
                    // ↓
                    // But API returns "scheduled", not "in_progress"
```

This proves the bug!

---

## Real-World Impact

### Recruiter's Experience

1. **Before joining:** "✓ Confirmed" (blue)
2. **After clicking join:** *Modal refreshes, but nothing changes*
   - Still shows "✓ Confirmed" (blue) ← BUG!
   - Button still says "Join Session" ← BUG!
   - Should show: "Live: Interview in Progress" (emerald)

3. **After candidate joins:** *Still nothing changes in modal*
   - Both in Jitsi, but modal shows "Scheduled" ← MAJOR BUG!
   - Can still click "Log Evaluation" ✓ (works by accident)

4. **After feedback:** Interview moves to archives ✓

### Candidate's Experience

1. **Before joining:** "Proposed Slots" or waiting message
2. **After joining:** Should see some indication both are in meeting
   - But there's a separate candidate modal...
   - (Need to check candidate modal too)

### Why It "Works" Despite the Bug

The feedback form button shows on line 673:
```typescript
{activeInterview.status === "scheduled" && (
  <button onClick={() => setShowFeedbackModal(true)}>
    Log Evaluation
  </button>
)}
```

This works ONLY because status stays "scheduled" (doesn't change to "in_progress").
If the system actually set status = "in_progress", this button would disappear!
That's why this is a **fragile coincidence**, not proper design.

---

## The Core Problem (Visualized)

```
╔════════════════════════════════════════════════════════════╗
║ UI EXPECTATION vs REALITY                                 ║
╚════════════════════════════════════════════════════════════╝

UI Developer Thought:
  "I'll check if status === 'in_progress' to detect live interviews"
  └─ Seems logical... but API never provides this!

What Should Have Happened:
  "I'll check if recruiter_joined_at AND candidate_joined_at exist"
  └─ These timestamps are always available in the response

Current Code:
  if (status === "in_progress") {  // ← NEVER TRUE
    show_live_badge()              // ← NEVER EXECUTES
  }

Fixed Code:
  if (recruiter_joined_at && candidate_joined_at) {  // ← CAN BE TRUE
    show_live_badge()                               // ← EXECUTES WHEN NEEDED
  }
```

This is a simple but impactful bug that prevents the UI from showing
the correct state even though all the necessary data is available!
