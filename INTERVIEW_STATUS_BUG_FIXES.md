# Interview Status Bug: Exact Code Fixes

## Problem Code vs Fixed Code

### FIX #1: Status Badge Display (Line 586-590)

#### ❌ BEFORE (Broken)
```typescript
<div className={`p-4 rounded-2xl border ${
  activeInterview.status === "in_progress"  // ← Never true!
    ? "bg-emerald-50 border-emerald-100/50"
    : activeInterview.status === "scheduled" 
      ? "bg-blue-100 border-blue-100/50" 
      : "bg-slate-50 border-slate-100"
}`}>
```

#### ✅ AFTER (Fixed)
```typescript
<div className={`p-4 rounded-2xl border ${
  activeInterview.recruiter_joined_at && activeInterview.candidate_joined_at
    ? "bg-emerald-50 border-emerald-100/50"
    : activeInterview.status === "scheduled" 
      ? "bg-blue-100 border-blue-100/50" 
      : "bg-slate-50 border-slate-100"
}`}>
```

---

### FIX #2: Pulse Indicator (Line 593-595)

#### ❌ BEFORE (Broken)
```typescript
{activeInterview.status === "in_progress" ? (
  <div className="h-4 w-4 rounded-full bg-emerald-500 animate-pulse" />
) : (
  <Clock className={`h-4 w-4 ${activeInterview.status === "scheduled" ? "text-blue-600" : "text-slate-400"}`} />
)}
```

#### ✅ AFTER (Fixed)
```typescript
{activeInterview.recruiter_joined_at && activeInterview.candidate_joined_at ? (
  <div className="h-4 w-4 rounded-full bg-emerald-500 animate-pulse" />
) : (
  <Clock className={`h-4 w-4 ${activeInterview.status === "scheduled" ? "text-blue-600" : "text-slate-400"}`} />
)}
```

---

### FIX #3: Color Styling for Icon (Line 599-602)

#### ❌ BEFORE (Broken)
```typescript
<p className={`text-[9px] font-black uppercase tracking-widest ${
  activeInterview.status === "in_progress" 
    ? "text-emerald-700" 
    : activeInterview.status === "scheduled" 
      ? "text-blue-700" 
      : "text-slate-500"
}`}>
```

#### ✅ AFTER (Fixed)
```typescript
<p className={`text-[9px] font-black uppercase tracking-widest ${
  activeInterview.recruiter_joined_at && activeInterview.candidate_joined_at
    ? "text-emerald-700" 
    : activeInterview.status === "scheduled" 
      ? "text-blue-700" 
      : "text-slate-500"
}`}>
```

---

### FIX #4: Status Label Text (Line 605)

#### ❌ BEFORE (Broken)
```typescript
{activeInterview.status === "in_progress" 
  ? "Live: Interview in Progress" 
  : activeInterview.status === "scheduled" 
    ? "Scheduled Transmission" 
    : "Proposed Slots"}
```

#### ✅ AFTER (Fixed)
```typescript
{activeInterview.recruiter_joined_at && activeInterview.candidate_joined_at
  ? "Live: Interview in Progress" 
  : activeInterview.status === "scheduled" 
    ? "Scheduled Transmission" 
    : "Proposed Slots"}
```

---

### FIX #5: Join Button Label (Line 663)

#### ❌ BEFORE (Broken)
```typescript
{isActive 
  ? activeInterview.status === "in_progress" 
    ? "Return to Live Session" 
    : "Join Session"
  : nowInBrowser < allowedStart 
    ? `Locked: Opens ${Math.round((allowedStart.getTime() - nowInBrowser.getTime()) / 60000)}m Early` 
    : nowInBrowser > end
      ? "Meeting Expired (End Time Passed)"
      : "Late: Window Closed (5m Limit)"}
```

#### ✅ AFTER (Fixed)
```typescript
{isActive 
  ? activeInterview.recruiter_joined_at && activeInterview.candidate_joined_at
    ? "Return to Live Session" 
    : "Join Session"
  : nowInBrowser < allowedStart 
    ? `Locked: Opens ${Math.round((allowedStart.getTime() - nowInBrowser.getTime()) / 60000)}m Early` 
    : nowInBrowser > end
      ? "Meeting Expired (End Time Passed)"
      : "Late: Window Closed (5m Limit)"}
```

---

### FIX #6: Feedback Button Visibility (Line 673)

#### ❌ BEFORE (Fragile - works by accident)
```typescript
{activeInterview.status === "scheduled" && (
  <button
    onClick={() => setShowFeedbackModal(true)}
    className="w-full bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-2xl transition-all active:scale-95"
  >
    Log Evaluation
  </button>
)}
```

#### ✅ AFTER (Robust - explicitly check recruiter joined)
```typescript
{(activeInterview.status === "scheduled" || activeInterview.recruiter_joined_at) && (
  <button
    onClick={() => setShowFeedbackModal(true)}
    className="w-full bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-2xl transition-all active:scale-95"
  >
    Log Evaluation
  </button>
)}
```

---

### FIX #7: Active Interview Detection (Line 107)

#### ❌ BEFORE (Unnecessary check)
```typescript
const activeInterview = (interviews || []).find(i => 
  i.status === "scheduled" || i.status === "pending_confirmation" || i.status === "in_progress"
);
```

#### ✅ AFTER (Removed non-existent status)
```typescript
const activeInterview = (interviews || []).find(i => 
  i.status === "scheduled" || i.status === "pending_confirmation"
);
```

**Note:** "in_progress" will never exist in the API response, so removing it prevents false assumptions.

---

## Helper Function (Optional but Recommended)

Add to `apps/web/src/components/CandidateProfileModal.tsx` for consistency:

```typescript
// Add at the top of the component or in a constants file
const isInterviewLive = (interview: any): boolean => {
  return !!(interview?.recruiter_joined_at && interview?.candidate_joined_at);
};

const isRecruiterJoined = (interview: any): boolean => {
  return !!interview?.recruiter_joined_at;
};

const isCandidateJoined = (interview: any): boolean => {
  return !!interview?.candidate_joined_at;
};
```

Then use throughout:

```typescript
// Instead of: activeInterview.status === "in_progress"
// Use: isInterviewLive(activeInterview)

// Instead of: !!activeInterview.recruiter_joined_at
// Use: isRecruiterJoined(activeInterview)

// Instead of: !!activeInterview.candidate_joined_at  
// Use: isCandidateJoined(activeInterview)
```

---

## Why These Fixes Work

| Fix | Reason |
|-----|--------|
| Using `recruiter_joined_at && candidate_joined_at` | These timestamps are ALWAYS set by backend when someone joins - they're the source of truth |
| Checking `recruiter_joined_at` alone | Perfect for "Return to Live Session" logic - only recruiter needs to be joined to return |
| Removing "in_progress" status check | API never returns this value, so checking for it is dead code |
| Adding `\|\| activeInterview.recruiter_joined_at` to feedback button | Ensures button available immediately after recruiter joins, not just during "scheduled" period |

---

## Testing After Fixes

### Scenario 1: Before Interview Time
- [ ] Status shows: "Scheduled Transmission" (blue)
- [ ] Icon: Clock ⏰ (blue)
- [ ] Join Button: Locked (red)
- [ ] Feedback Button: Visible

### Scenario 2: Interview Time Window, Only Recruiter Joined
- [ ] Status shows: "Scheduled Transmission" (blue)
- [ ] Icon: Clock ⏰ (blue)
- [ ] Join Button: "Return to Live Session" (green)
- [ ] Feedback Button: Visible

### Scenario 3: Both Participants Joined
- [ ] Status shows: "Live: Interview in Progress" (emerald) ✓ **NOW WORKS**
- [ ] Icon: Animated pulse 🟢 (emerald) ✓ **NOW WORKS**
- [ ] Join Button: "Return to Live Session" (green)
- [ ] Feedback Button: Visible

### Scenario 4: After Feedback Submitted
- [ ] Status shows: "Conducted" or similar (completed state)
- [ ] Interview moves to "Historical Archives" section
- [ ] Feedback text displays below interview record

---

## Related Code That Already Works Correctly

### InterviewFeedbackModal (Line 33-38) ✓
```typescript
const recruiterAttended = !!recruiterJoinedAt;
const candidateAttended = !!candidateJoinedAt;
```
**Status:** This is already correct! Uses timestamps, not status.

### Timestamp Display in Modal (Line 853)
```typescript
recruiterJoinedAt={activeInterview.recruiter_joined_at}
candidateJoinedAt={activeInterview.candidate_joined_at}
```
**Status:** Correctly passes timestamps for validation.

### Applications Page Polling (Line 179)
```typescript
const interval = setInterval(fetchApplications, 60000);
```
**Status:** Data refresh works correctly - problem is display logic only.

---

## Summary

**Total Changes Required:** 7 locations in CandidateProfileModal.tsx

**Core Concept:** Replace `status === "in_progress"` with timestamp checks `recruiter_joined_at && candidate_joined_at`

**Impact:** Feedback form and "live session" indicators will now display correctly after both participants join.
