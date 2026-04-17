# Interview Status Bug: Quick Reference & Line-by-Line Fixes

## TL;DR: The Bug

**File:** `apps/web/src/components/CandidateProfileModal.tsx`  
**Problem:** Checking for `status === "in_progress"` (doesn't exist) instead of using `recruiter_joined_at && candidate_joined_at` timestamps

**Result:** After recruiter joins, UI still shows "Scheduled Transmission" instead of "Live: Interview in Progress"

**Fix:** 7 locations need to replace the status check with timestamp checks

---

## Exact Line Numbers & Required Changes

### ✅ FIX #1 - Line 107: Active Interview Detection
```typescript
// LOCATION: CandidateProfileModal.tsx, Line 107
// CHANGE: Remove non-existent "in_progress" status

❌ BEFORE:
const activeInterview = (interviews || []).find(i => 
  i.status === "scheduled" || i.status === "pending_confirmation" || i.status === "in_progress"
);

✅ AFTER:
const activeInterview = (interviews || []).find(i => 
  i.status === "scheduled" || i.status === "pending_confirmation"
);

// Explanation: "in_progress" status never comes from API, so this check is dead code
// that promotes a false understanding of how the system works
```

---

### ✅ FIX #2 - Line 586: Background Color Styling
```typescript
// LOCATION: CandidateProfileModal.tsx, Lines 586-590
// CHANGE: Check timestamps instead of "in_progress" status

❌ BEFORE:
<div className={`p-4 rounded-2xl border ${
  activeInterview.status === "in_progress"
    ? "bg-emerald-50 border-emerald-100/50"
    : activeInterview.status === "scheduled" 
      ? "bg-blue-100 border-blue-100/50" 
      : "bg-slate-50 border-slate-100"
}`}>

✅ AFTER:
<div className={`p-4 rounded-2xl border ${
  activeInterview.recruiter_joined_at && activeInterview.candidate_joined_at
    ? "bg-emerald-50 border-emerald-100/50"
    : activeInterview.status === "scheduled" 
      ? "bg-blue-100 border-blue-100/50" 
      : "bg-slate-50 border-slate-100"
}`}>

// Impact: Emerald background shows ONLY when both have joined
// Emerald = both timestamps exist
// Blue = scheduled but not both joined yet
// Gray = other status
```

---

### ✅ FIX #3 - Line 593: Pulse Icon Indicator
```typescript
// LOCATION: CandidateProfileModal.tsx, Lines 593-595
// CHANGE: Show animated pulse when both have joined

❌ BEFORE:
{activeInterview.status === "in_progress" ? (
  <div className="h-4 w-4 rounded-full bg-emerald-500 animate-pulse" />
) : (
  <Clock className={`h-4 w-4 ${activeInterview.status === "scheduled" ? "text-blue-600" : "text-slate-400"}`} />
)}

✅ AFTER:
{activeInterview.recruiter_joined_at && activeInterview.candidate_joined_at ? (
  <div className="h-4 w-4 rounded-full bg-emerald-500 animate-pulse" />
) : (
  <Clock className={`h-4 w-4 ${activeInterview.status === "scheduled" ? "text-blue-600" : "text-slate-400"}`} />
)}

// Impact: Animated pulse 🟢 appears when both participants have joined
// Clock ⏰ shows before both join
```

---

### ✅ FIX #4 - Line 599: Text Color Styling  
```typescript
// LOCATION: CandidateProfileModal.tsx, Lines 599-602
// CHANGE: Color text based on timestamps, not status

❌ BEFORE:
<p className={`text-[9px] font-black uppercase tracking-widest ${
  activeInterview.status === "in_progress" 
    ? "text-emerald-700" 
    : activeInterview.status === "scheduled" 
      ? "text-blue-700" 
      : "text-slate-500"
}`}>

✅ AFTER:
<p className={`text-[9px] font-black uppercase tracking-widest ${
  activeInterview.recruiter_joined_at && activeInterview.candidate_joined_at
    ? "text-emerald-700" 
    : activeInterview.status === "scheduled" 
      ? "text-blue-700" 
      : "text-slate-500"
}`}>

// Impact: Green text (emerald-700) when both joined
// Blue text when scheduled but not both joined
// Gray text otherwise
```

---

### ✅ FIX #5 - Line 605: Status Label Text
```typescript
// LOCATION: CandidateProfileModal.tsx, Line 605
// CHANGE: Show "Live" indicator when both have joined

❌ BEFORE:
{activeInterview.status === "in_progress" 
  ? "Live: Interview in Progress" 
  : activeInterview.status === "scheduled" 
    ? "Scheduled Transmission" 
    : "Proposed Slots"}

✅ AFTER:
{activeInterview.recruiter_joined_at && activeInterview.candidate_joined_at
  ? "Live: Interview in Progress" 
  : activeInterview.status === "scheduled" 
    ? "Scheduled Transmission" 
    : "Proposed Slots"}

// Impact: Shows "Live: Interview in Progress" when both timestamps exist
// Shows "Scheduled Transmission" when waiting for interviews to start
// Shows "Proposed Slots" when candidate hasn't confirmed yet
```

---

### ✅ FIX #6 - Line 626: Conditional Render
```typescript
// LOCATION: CandidateProfileModal.tsx, Line 626
// NOTE: This line ALREADY checks status correctly, but includes unnecessary "in_progress"
// CHANGE: Remove "in_progress" from the condition

❌ BEFORE:
{(activeInterview.status === "scheduled" || activeInterview.status === "in_progress") && activeInterview.meeting_link && (() => {

✅ AFTER:
{(activeInterview.status === "scheduled") && activeInterview.meeting_link && (() => {

// Explanation: "in_progress" never exists, so remove it from the compound condition
// The button correctly shows when status is "scheduled" (which it always is until feedback)
```

---

### ✅ FIX #7 - Line 663: Join Button Label
```typescript
// LOCATION: CandidateProfileModal.tsx, Line 663
// CHANGE: Show "Return to Live Session" when recruiter has joined

❌ BEFORE:
{isActive 
  ? activeInterview.status === "in_progress" ? "Return to Live Session" : "Join Session"
  : nowInBrowser < allowedStart 
    ? `Locked: Opens ${Math.round((allowedStart.getTime() - nowInBrowser.getTime()) / 60000)}m Early` 
    : nowInBrowser > end
      ? "Meeting Expired (End Time Passed)"
      : "Late: Window Closed (5m Limit)"}

✅ AFTER:
{isActive 
  ? activeInterview.recruiter_joined_at ? "Return to Live Session" : "Join Session"
  : nowInBrowser < allowedStart 
    ? `Locked: Opens ${Math.round((allowedStart.getTime() - nowInBrowser.getTime()) / 60000)}m Early` 
    : nowInBrowser > end
      ? "Meeting Expired (End Time Passed)"
      : "Late: Window Closed (5m Limit)"}

// Impact: Button says "Return to Live Session" only if recruiter (current user) has joined
// Button says "Join Session" if recruiter hasn't joined yet
// Note: We check recruiter_joined_at, not candidate_joined_at, because the recruiter
//       is the one seeing this button
```

---

### ✅ FIX #8 - Line 673: Feedback Button Visibility
```typescript
// LOCATION: CandidateProfileModal.tsx, Line 673
// CHANGE: Make feedback button more explicitly dependent on recruiter joining

❌ BEFORE:
{activeInterview.status === "scheduled" && (
  <button
    onClick={() => setShowFeedbackModal(true)}
    className="w-full bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-2xl transition-all active:scale-95"
  >
    Log Evaluation
  </button>
)}

✅ AFTER:
{(activeInterview.status === "scheduled" || activeInterview.recruiter_joined_at) && (
  <button
    onClick={() => setShowFeedbackModal(true)}
    className="w-full bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-2xl transition-all active:scale-95"
  >
    Log Evaluation
  </button>
)}

// Explanation: Show button when status is "scheduled" (before interview)
// OR when recruiter_joined_at exists (during/after interview)
// This makes the logic more robust and explicit about when feedback is available
```

---

## Summary Table

| Line | Current Code | Problem | Fixed Code |
|------|--------------|---------|-----------|
| 107 | `\|\| i.status === "in_progress"` | Checking non-existent status | Remove |
| 586 | `status === "in_progress"` | Wrong condition | `recruiter_joined_at && candidate_joined_at` |
| 593 | `status === "in_progress"` | Pulse never shows | `recruiter_joined_at && candidate_joined_at` |
| 599 | `status === "in_progress"` | Text color wrong | `recruiter_joined_at && candidate_joined_at` |
| 605 | `status === "in_progress"` | Label text wrong | `recruiter_joined_at && candidate_joined_at` |
| 626 | `\|\| status === "in_progress"` | Unnecessary condition | Remove |
| 663 | `status === "in_progress"` | Button label wrong | `recruiter_joined_at` |
| 673 | `status === "scheduled"` | Fragile condition | `\|\| recruiter_joined_at` |

---

## Validation After Fixes

### Test Case 1: Interview Scheduled (Before Start Time)
```
Expected:
  ✓ Status Badge: Blue "Confirmed"
  ✓ Icon: Clock ⏰ (blue)
  ✓ Status Text: "Scheduled Transmission"
  ✓ Join Button: Locked/disabled
  ✓ Feedback Button: Visible

Check:
  recruiter_joined_at = null
  candidate_joined_at = null
  status = "scheduled"
```

### Test Case 2: Recruiter Joined (Candidate Not Yet)
```
Expected:
  ✓ Status Badge: Blue "Confirmed" (NOT green yet)
  ✓ Icon: Clock ⏰ (blue)
  ✓ Status Text: "Scheduled Transmission"
  ✓ Join Button: "Return to Live Session" (green)
  ✓ Feedback Button: Visible

Check:
  recruiter_joined_at = "2024-04-17T10:20:45.123Z" ✓
  candidate_joined_at = null
  status = "scheduled"
```

### Test Case 3: Both Joined ⭐ MAIN BUG
```
Expected (AFTER FIX):
  ✓ Status Badge: Emerald "Live" (NOW GREEN!)
  ✓ Icon: Animated Pulse 🟢 (NOW SHOWS!)
  ✓ Status Text: "Live: Interview in Progress" (NOW SHOWS!)
  ✓ Join Button: "Return to Live Session"
  ✓ Feedback Button: Visible

Check:
  recruiter_joined_at = "2024-04-17T10:20:45.123Z" ✓
  candidate_joined_at = "2024-04-17T10:25:12.456Z" ✓
  status = "scheduled" ✓

Before Fix:
  ❌ All above show as "Scheduled" (blue) - THIS IS THE BUG
  
After Fix:
  ✅ All above show as "Live" (green) - FIXED!
```

### Test Case 4: Feedback Submitted
```
Expected:
  ✓ Interview disappears from active interviews
  ✓ Appears in "Historical Archives" section
  ✓ Shows feedback text
  ✓ Shows decision (Offered/Rejected/etc)

Check:
  status = "completed" ✓
  feedback = "..." ✓
  activeInterview filter excludes completed
  completedInterviews filter includes completed
```

---

## Code Comments to Add (Optional but Recommended)

After applying fixes, add comments for clarity:

```typescript
// Line ~586: Explain the emerald state
<div className={`p-4 rounded-2xl border ${
  // Both participants joined = Live interview = Emerald
  activeInterview.recruiter_joined_at && activeInterview.candidate_joined_at
    ? "bg-emerald-50 border-emerald-100/50"
    : // Scheduled but not both joined yet = Blue
      activeInterview.status === "scheduled" 
        ? "bg-blue-100 border-blue-100/50" 
        : "bg-slate-50 border-slate-100"
}`}>

// Line ~663: Explain the button label logic  
{isActive 
  // If recruiter has joined, they can "return" to the session
  ? activeInterview.recruiter_joined_at 
    ? "Return to Live Session" 
    : "Join Session"
  : ...
}

// Line ~673: Explain when feedback is available
{/* Allow feedback when interview is scheduled (before/during) 
    OR when recruiter has joined (during/after) */}
{(activeInterview.status === "scheduled" || activeInterview.recruiter_joined_at) && (
```

---

## Files to Check After Fixes

After making these changes:

1. **No errors in DevTools Console** ✓
2. **Interview card updates when recruiter joins** ✓
3. **Pulse icon appears when both join** ✓
4. **"Live" text appears when both join** ✓
5. **Feedback button visible throughout** ✓
6. **Data persists across page refresh** ✓
7. **All 4 test cases pass** ✓

---

## Additional Notes

### Why These Fixes Are Safe
- ✓ All data (recruiter_joined_at, candidate_joined_at) already comes from API
- ✓ No new API calls needed
- ✓ No database changes needed
- ✓ No backend changes needed
- ✓ Purely frontend display logic fix
- ✓ Changes match what backend actually provides

### Why This Bug Exists
- Likely developer anticipation of "in_progress" status that was never implemented
- Status correctly remains "scheduled" → "completed"
- But UI incorrectly assumes "in_progress" status should exist
- Disconnect between frontend assumptions and backend implementation

### Testing Recommendation
- Test with real interview data, not mock data
- Verify API returns recruiter_joined_at after join endpoint
- Verify polling interval fetches updated data (60s)
- Test across different browsers for styling consistency
