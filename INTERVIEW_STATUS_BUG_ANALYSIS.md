# Interview Status Bug: Complete Analysis & Root Cause

## Executive Summary
The interview UI is checking for a status value **"in_progress"** that **DOES NOT EXIST** in the database or API. The status remains "scheduled" throughout the entire interview lifecycle, and the actual join state is tracked via `recruiter_joined_at` and `candidate_joined_at` timestamps. This causes several UI behaviors to never trigger.

---

## 1. Root Cause: Status Values Don't Match Reality

### What the Code Expects
```typescript
// apps/web/src/components/CandidateProfileModal.tsx - Line 107
const activeInterview = (interviews || []).find(i => 
  i.status === "scheduled" || i.status === "pending_confirmation" || i.status === "in_progress"
);
```

### What Actually Exists (from Backend)
```python
# apps/api/src/services/interview_service.py - Lines 139, 256, 285

# Status values in system:
InterviewStatus.SCHEDULED              # Line 139
interview.status = "cancelled"         # Line 256
interview.status = "completed"         # Line 285

# MISSING: "in_progress" status is NEVER set anywhere
```

**Valid Status Values:**
- `pending_confirmation` - Candidate hasn't confirmed slot yet
- `scheduled` - Candidate confirmed, waiting for interview time
- `completed` - Feedback has been submitted
- `cancelled` - Interview was cancelled

**Missing/Non-existent:**
- ❌ `in_progress` - **NEVER CREATED BY BACKEND**

---

## 2. What Happens After Both Participants Join

### The Join Event Flow
```python
# apps/api/src/services/interview_service.py - Lines 346-415
# When recruiter clicks "Join Session"

async def register_join_event(user_id: str, interview_id: str, role: str, db: Session):
    # ... validation ...
    
    # Update Join Timestamps
    if role == "candidate":
        interview.candidate_joined_at = datetime.utcnow()
    else:
        interview.recruiter_joined_at = datetime.utcnow()
    
    # Send notification to other party
    NotificationService.create_notification(...)
    
    db.commit()
    return {"status": "success", "message": f"{target_label} notified of your arrival."}

# ⚠️ NOTE: interview.status is NOT changed!
# Status remains "scheduled" after both join
```

### State After Recruiter Joins
| Field | Value |
|-------|-------|
| `interview.status` | `"scheduled"` ✓ |
| `recruiter_joined_at` | `datetime.utcnow()` ✓ |
| `candidate_joined_at` | `datetime.utcnow()` (already set) ✓ |
| Feedback button visible? | **YES** ✓ |
| "in_progress" status visible? | **NO** (status never changes) ❌ |

---

## 3. Where the Bug Manifests in CandidateProfileModal

### File: `apps/web/src/components/CandidateProfileModal.tsx`

#### Problem 1: Finding Active Interview (Line 107)
```typescript
const activeInterview = (interviews || []).find(i => 
  i.status === "scheduled" || 
  i.status === "pending_confirmation" || 
  i.status === "in_progress"  // ← NEVER MATCHES - This status doesn't exist
);
```
**Issue:** Checking for "in_progress" unnecessarily (future-proofing for non-existent status)

---

#### Problem 2: Status Display Badge (Lines 586-605)
```typescript
// Line 586
const p className={`p-4 rounded-2xl border ${
  activeInterview.status === "in_progress"           // ← NEVER TRUE
    ? "bg-emerald-50 border-emerald-100/50"
    : activeInterview.status === "scheduled" 
      ? "bg-blue-100 border-blue-100/50" 
      : "bg-slate-50 border-slate-100"
}`}>

// Line 593-595: Animated pulse indicator
{activeInterview.status === "in_progress" ? (          // ← NEVER TRUE
  <div className="h-4 w-4 rounded-full bg-emerald-500 animate-pulse" />
) : (
  <Clock className={`h-4 w-4...`} />
)}

// Line 605: Status label
{activeInterview.status === "in_progress" ? "Live: Interview in Progress" : ...}
                                    // ↑ THIS NEVER SHOWS
```

**Expected:** After recruiter joins, show "Live: Interview in Progress" with animated pulse  
**Actual:** Always shows clock icon and "Scheduled Transmission"

---

#### Problem 3: Join Button Label (Line 663)
```typescript
// Line 663
{isActive 
  ? activeInterview.status === "in_progress" ? "Return to Live Session" : "Join Session"
                                       // ↑ NEVER TRUE - Always shows "Join Session"
  : nowInBrowser < allowedStart 
    ? `Locked: Opens ${Math.round(...)}m Early` 
    : ...
}
```

**Issue:** Button always says "Join Session" even if recruiter already joined  
**Should say:** "Return to Live Session" (but never does because status ≠ "in_progress")

---

#### Problem 4: Feedback Button Visibility (Line 673)
```typescript
// Line 673 - This actually WORKS (but for wrong reason)
{activeInterview.status === "scheduled" && (
  <button onClick={() => setShowFeedbackModal(true)}>
    Log Evaluation
  </button>
)}
```

**Why it works:** Status is "scheduled" after both join (not changed to "in_progress")  
**Why it's fragile:** The feedback button should check `recruiter_joined_at` instead of relying on status coincidentally being "scheduled"

---

## 4. Real State Tracking: Timestamps, Not Status

### How to Know if Interview is "Live"
```typescript
// Instead of: activeInterview.status === "in_progress"
// Use timestamps:

const recruiterJoined = !!activeInterview.recruiter_joined_at;
const candidateJoined = !!activeInterview.candidate_joined_at;
const bothJoined = recruiterJoined && candidateJoined;
```

### These Timestamps Are Already Being Used
In `InterviewFeedbackModal` (Line 33-38):
```typescript
const recruiterAttended = !!recruiterJoinedAt;
const candidateAttended = !!candidateJoinedAt;

// Correctly disables feedback decisions if recruiter didn't join
if (!recruiterAttended) {
  // Disable offered, shortlisted, rejected buttons
  // Allow only "Not Conducted"
}
```

**The modal correctly uses timestamps but the parent component doesn't!**

---

## 5. Data Refresh & Polling

### Frontend Polling (apps/web/src/app/dashboard/recruiter/hiring/applications/page.tsx - Lines 176-181)
```typescript
const fetchApplications = useCallback(async () => {
  const [data, profileData, interviewData] = await Promise.all([
    apiClient.get("/recruiter/applications/pipeline", token),
    apiClient.get("/recruiter/profile", token),
    apiClient.get("/interviews/my", token),      // ← Fetches current interview data
  ]);
  
  const appsData = (data || []).map((app: any) => ({
    ...app,
    interviews: (interviewData || []).filter(i => i.application_id === app.id),
  }));
  setApplications(appsData);
}, [router]);

// Poll every 60 seconds
useEffect(() => {
  fetchApplications();
  const interval = setInterval(fetchApplications, 60000);  // ← 60 second refresh
  return () => clearInterval(interval);
}, [fetchApplications]);
```

**Status:** ✓ Data IS being refreshed  
**Issue:** Refreshed data still has status = "scheduled" (correctly, since backend doesn't change it)

---

## 6. The Complete Interview Status Lifecycle

### Timeline: From Proposal to Completion

```
1. Recruiter proposes interview
   └─ Interview created with status = "pending_confirmation"

2. Candidate selects slot
   └─ Interview status = "scheduled"

3. Recruiter clicks "Join Session" (15m before start to 5m after)
   └─ recruiter_joined_at = NOW
   └─ Status still = "scheduled" ✓ (CORRECT - no in_progress status)
   └─ Notification sent to candidate

4. Candidate clicks "Join Session"
   └─ candidate_joined_at = NOW  
   └─ Status still = "scheduled" ✓ (CORRECT)
   └─ Notification sent to recruiter

5. Recruiter submits feedback (any decision: offered, rejected, no_show, etc.)
   └─ interview.feedback = "..."
   └─ interview.status = "completed" ✓
   └─ Application status updated (offered, rejected, shortlisted)

6. Interview marked as completed ✓
```

---

## 7. Bug Impact Summary

| UI Element | Current Behavior | Should Happen After Both Join |
|-----------|------------------|-------------------------------|
| Status Badge | "Scheduled Transmission" | "Live: Interview in Progress" |
| Status Icon | Clock ⏰ | Animated pulse 🟢 |
| Join Button | "Join Session" | "Return to Live Session" |
| Feedback Button | Shows ✓ | Shows ✓ (but for wrong reason) |
| Live Indicator | Never shows | Always shows when both joined |

---

## 8. Required Fixes

### Fix 1: Replace Status Checks with Timestamp Checks

**File:** `apps/web/src/components/CandidateProfileModal.tsx`

**Change:**
```typescript
// FROM (Line 586)
activeInterview.status === "in_progress"

// TO
activeInterview.recruiter_joined_at !== null && activeInterview.candidate_joined_at !== null
```

**Apply to:**
- Line 586: Background color logic
- Line 593: Pulse indicator display  
- Line 599: Color styling
- Line 605: Status label text
- Line 626: Conditional render check (change to include timestamp check)
- Line 663: Button label logic

---

### Fix 2: Improve Feedback Button Visibility

**File:** `apps/web/src/components/CandidateProfileModal.tsx` (Line 673)

**Change:**
```typescript
// FROM: Only shows if status === "scheduled"
{activeInterview.status === "scheduled" && (

// TO: Show if recruiter has joined OR if status is scheduled (before join)
{(activeInterview.status === "scheduled" || activeInterview.recruiter_joined_at) && (
```

This ensures feedback button is available both before and after joining.

---

### Fix 3: Safety Check in InterviewFeedbackModal

The modal already correctly uses timestamps:
```typescript
const recruiterAttended = !!recruiterJoinedAt;
const candidateAttended = !!candidateJoinedAt;
```

**No changes needed** - it's using the right approach.

---

## 9. Why This Bug Exists

1. **Premature Design:** Developer anticipated need for "in_progress" status
2. **API Consistency Gap:** Frontend expects status that backend never provides
3. **Timestamp Usage:** Backend correctly tracks state via timestamps, but frontend ignores them for status display
4. **Functional Fragility:** Feedback button works by accident (status is "scheduled" post-join)

---

## 10. Verification Checklist

After fixing, verify:

- [ ] After both join: Badge shows "Live: Interview in Progress"
- [ ] After both join: Animated pulse icon (🟢) appears
- [ ] After recruiter joins: Button changes to "Return to Live Session"
- [ ] Feedback button visible after recruiter joins
- [ ] No "in_progress" status checks remain in codebase
- [ ] All logic uses timestamps consistently
- [ ] Status polling still works (60s refresh interval)
- [ ] Data persists across page refreshes
- [ ] Candidate sees same live indicator

---

## Code Locations Summary

| Issue | File | Lines |
|-------|------|-------|
| Active interview detection | CandidateProfileModal.tsx | 107 |
| Background color logic | CandidateProfileModal.tsx | 586-590 |
| Pulse indicator | CandidateProfileModal.tsx | 593-595 |
| Color styling | CandidateProfileModal.tsx | 599-602 |
| Status label | CandidateProfileModal.tsx | 605 |
| Conditional render | CandidateProfileModal.tsx | 626 |
| Button label | CandidateProfileModal.tsx | 663 |
| Feedback button | CandidateProfileModal.tsx | 673 |
| Backend join logic | interview_service.py | 346-415 |
| No status change | interview_service.py | (missing!) |
| Status feedback submit | interview_service.py | 282-287 |
| Frontend polling | applications/page.tsx | 142-181 |
