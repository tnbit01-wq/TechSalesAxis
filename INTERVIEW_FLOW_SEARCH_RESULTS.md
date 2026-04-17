# Interview Flow Analysis: Codebase Search Results

## Search Results Summary

Based on comprehensive codebase search, here's what was found for each of the user's requests:

---

## 1️⃣ **CandidateProfileModal.tsx** - Feedback/Decision Form Visibility

### Location
📁 `apps/web/src/components/CandidateProfileModal.tsx`

### Conditions That Trigger Feedback Form Display

#### Visibility Condition (Line 673)
```typescript
{activeInterview.status === "scheduled" && (
  <button onClick={() => setShowFeedbackModal(true)}>
    Log Evaluation
  </button>
)}
```

**Current Logic:** Feedback button shows when `status === "scheduled"`

**What Actually Happens:**
- Interview created with status = `"pending_confirmation"`
- When candidate confirms slot → status = `"scheduled"`
- When recruiter clicks "Join Session" → status stays `"scheduled"` ✓
- When candidate joins → status still `"scheduled"` ✓
- Feedback button remains visible throughout ✓

**Why It Works (By Accident):**
The feedback button appears because `status = "scheduled"` throughout the interview lifecycle:
- proposal → pending_confirmation
- confirmation → **"scheduled"**
- after both join → **still "scheduled"** (no "in_progress")
- feedback submitted → "completed"

---

## 2️⃣ **Interview Status Update Logic** - What Changes Status

### File: Backend Interview Service
📁 `apps/api/src/services/interview_service.py`

### Status Transitions Found

#### Line 139: Initial Status
```python
interview.status = InterviewStatus.SCHEDULED
```
**Trigger:** When candidate confirms a proposed slot

#### Line 256: Cancellation
```python
interview.status = "cancelled"
```
**Trigger:** When interview is cancelled by recruiter
**Validation:** Checks user is recruiter owner

#### Line 285: Completion
```python
interview.status = "completed"
```
**Trigger:** When recruiter submits feedback
**Requirements:** 
- Recruiter must have `recruiter_joined_at` set
- Candidate must have `candidate_joined_at` set (unless "no_show" or "not_conducted")

### **CRITICAL FINDING: "in_progress" Status DOES NOT EXIST**

```bash
grep -r "in_progress" apps/api/src/
# Returns 0 matches for status assignments
```

**Proof:** Backend never sets interview status to `"in_progress"` anywhere:
- ✅ Creates with "SCHEDULED"
- ✅ Can be "cancelled"
- ✅ Can be "completed"
- ❌ Never becomes "in_progress"

---

## 3️⃣ **Recruiter Interview View** - After Returning from Jitsi

### UI Flow After Join

#### During Interview (After Recruiter Clicks "Join")

**File:** `apps/web/src/components/CandidateProfileModal.tsx` - Lines 560-675

```typescript
// What displays:

// Header Section (Lines 570-604)
{activeInterview ? (
  <div className="max-w-sm w-full bg-white border border-slate-100 rounded-3xl p-8">
    
    // Status Badge (Lines 576-580)
    <div className="mx-auto w-fit px-3 py-1 rounded-full">
      {activeInterview.status === "scheduled" 
        ? "✓ Confirmed"  ← ✓ SHOWS THIS (still "scheduled")
        : "⏳ Awaiting Candidate"
      }
    </div>
    
    // Status Indicator Box (Lines 586-605)
    <div className={`p-4 rounded-2xl border ${
      activeInterview.status === "in_progress"  ← ❌ CHECKS HERE (NEVER TRUE)
        ? "bg-emerald-50"
        : "bg-blue-100"  ← ✓ SHOWS THIS INSTEAD
    }`}>
      {activeInterview.status === "in_progress" ? (
        <div className="h-4 w-4 rounded-full bg-emerald-500 animate-pulse" />  ← ❌ NEVER SHOWS
      ) : (
        <Clock className="h-4 w-4 text-blue-600" />  ← ✓ SHOWS THIS
      )}
      
      {activeInterview.status === "in_progress" 
        ? "Live: Interview in Progress"  ← ❌ NEVER SHOWS
        : "Scheduled Transmission"  ← ✓ SHOWS THIS
      }
    </div>
    
    // Join Button (Lines 626-673)
    <button
      onClick={() => {
        apiClient.post(`/interviews/${activeInterview.id}/join-event`, { role: "recruiter" });
        window.open(activeInterview.meeting_link, "_blank");
      }}
      className="bg-emerald-600"
    >
      {activeInterview.status === "in_progress" 
        ? "Return to Live Session"  ← ❌ NEVER SHOWS
        : "Join Session"  ← ✓ SHOWS THIS
      }
    </button>
    
    // Feedback Button (Lines 673-679)
    {activeInterview.status === "scheduled" && (
      <button onClick={() => setShowFeedbackModal(true)}>
        Log Evaluation  ← ✓ VISIBLE (coincidentally - status still "scheduled")
      </button>
    )}
  </div>
)}
```

**Visual State After Recruiter Joins:**
- ✅ Jitsi window opens in new tab
- ❌ Modal STILL shows "Scheduled Transmission" (blue)
- ❌ Button STILL says "Join Session" (should say "Return to Live Session")
- ✅ "Log Evaluation" button visible

---

## 4️⃣ **Status Polling/Real-Time Updates** - How UI Knows When to Show Feedback

### Polling Implementation

**File:** `apps/web/src/app/dashboard/recruiter/hiring/applications/page.tsx` - Lines 142-181

```typescript
const fetchApplications = useCallback(async () => {
  try {
    const token = awsAuth.getToken();
    
    // Fetch all data in parallel
    const [data, profileData, interviewData] = await Promise.all([
      apiClient.get("/recruiter/applications/pipeline", token),
      apiClient.get("/recruiter/profile", token),
      apiClient.get("/interviews/my", token),  ← ✓ Fetches interview status
    ]);

    // Merge interviews into applications
    const appsData = (data || []).map((app: any) => ({
      ...app,
      interviews: (interviewData || []).filter(
        (i: any) => i.application_id === app.id
      ),
    }));
    
    setApplications(appsData);
  } catch (err) {
    console.error("Failed to fetch applications:", err);
  }
}, [router]);

// Polling Interval
useEffect(() => {
  fetchApplications();
  const interval = setInterval(fetchApplications, 60000);  // ← Every 60 seconds
  return () => clearInterval(interval);
}, [fetchApplications]);
```

### Response Structure
```typescript
GET /interviews/my Response:
{
  "id": "int_123",
  "status": "scheduled",              ← Status value
  "recruiter_joined_at": "2024-...",  ← Timestamp (present after join!)
  "candidate_joined_at": "2024-...",  ← Timestamp (present when candidate joins)
  "feedback": null,
  "meeting_link": "https://...",
  "application_id": "app_123",
}
```

### How UI Determines Visibility

**Current (Buggy) Logic:**
```typescript
// CandidateProfileModal.tsx - Line 107
const activeInterview = interviews.find(i => 
  i.status === "scheduled" || 
  i.status === "pending_confirmation" || 
  i.status === "in_progress"  ← ❌ NEVER MATCHES
);

// Line 586: Status badge color
if (activeInterview.status === "in_progress") {  ← ❌ ALWAYS FALSE
  // Show emerald (live)
} else if (activeInterview.status === "scheduled") {
  // Show blue (scheduled)  ← ✓ EXECUTES HERE
}

// Line 673: Feedback button
if (activeInterview.status === "scheduled") {
  // Show feedback button  ← ✓ WORKS (but wrong reason)
}
```

**What SHOULD Happen:**
```typescript
// Check timestamp data that's ALREADY available
if (activeInterview.recruiter_joined_at && activeInterview.candidate_joined_at) {
  // Show "Live: Interview in Progress"
  // Show animated pulse
  // Show emerald background
} else if (activeInterview.recruiter_joined_at) {
  // Recruiter has joined, candidate hasn't yet
  // Show "Return to Live Session" button
  // Still show feedback button
}
```

---

## 5️⃣ **InterviewFeedbackModal** - Rendering & Visibility

### Component Definition

**File:** `apps/web/src/components/InterviewFeedbackModal.tsx` - Lines 1-150

```typescript
interface InterviewFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  interviewId: string;
  applicationId: string;
  candidateName: string;
  roundName: string;
  recruiterJoinedAt?: string | null;    ← Uses timestamp!
  candidateJoinedAt?: string | null;    ← Uses timestamp!
  onSuccess: () => void;
}

export default function InterviewFeedbackModal({
  isOpen,
  onClose,
  // ... props
  recruiterJoinedAt,
  candidateJoinedAt,
  onSuccess,
}: InterviewFeedbackModalProps) {
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [decision, setDecision] = useState<"offered" | "rejected" | "shortlisted" | "no_show" | "not_conducted" | null>(null);
  
  // ✓ CORRECT: Uses timestamp to verify attendance
  const recruiterAttended = !!recruiterJoinedAt;
  const candidateAttended = !!candidateJoinedAt;
```

### Where It's Rendered

**File:** `apps/web/src/components/CandidateProfileModal.tsx` - Lines 848-861

```typescript
{showFeedbackModal && activeInterview && (
  <InterviewFeedbackModal
    isOpen={showFeedbackModal}
    onClose={() => setShowFeedbackModal(false)}
    interviewId={activeInterview.id}
    applicationId={applicationId}
    candidateName={candidate.full_name}
    roundName={activeInterview.round_name}
    recruiterJoinedAt={activeInterview.recruiter_joined_at}  ← ✓ Passes timestamp
    candidateJoinedAt={activeInterview.candidate_joined_at}  ← ✓ Passes timestamp
    onSuccess={() => {
      setShowFeedbackModal(false);
      if (onRefresh) onRefresh();
    }}
  />
)}
```

### Trigger to Show Modal

**File:** `apps/web/src/components/CandidateProfileModal.tsx` - Line 673

```typescript
<button
  onClick={() => setShowFeedbackModal(true)}  ← Sets showFeedbackModal = true
  className="w-full bg-slate-900..."
>
  Log Evaluation
</button>
```

### Modal Validation Logic

**File:** `apps/web/src/components/InterviewFeedbackModal.tsx` - Lines 50-120

```typescript
// Attendance validation
{!recruiterAttended && (
  <div className="p-4 bg-amber-50 border border-amber-200">
    <p className="font-black">ATTENDANCE REQUIRED</p>
    <p>You must attend to submit results...</p>
  </div>
)}

// Decision buttons
<button
  onClick={() => setDecision("offered")}
  disabled={!recruiterAttended}  ← ✓ Uses timestamp to validate
  className={decision === "offered" ? "border-emerald-500" : "border-slate-100"}
>
  Make Offer
</button>

// Form submission
const handleSubmit = async () => {
  if (!decision) { setError("Please select a decision."); return; }
  if (decision !== "no_show" && decision !== "not_conducted" && !feedback.trim()) {
    setError("Please provide feedback."); return;
  }

  try {
    const token = awsAuth.getToken();
    await apiClient.post(`/interviews/${interviewId}/feedback`, {
      feedback: feedback.trim(),
      next_status: decision
    }, token);
    
    onSuccess();  ← Refetches interview data
    onClose();
  }
};
```

---

## 6️⃣ **Interview List Refresh Logic** - After Join Event

### Refresh Trigger

**File:** `apps/web/src/app/dashboard/recruiter/hiring/applications/page.tsx` - Line 288

```typescript
// When recruiter joins interview
const [profileModal, setProfileModal] = useState<any>({});

// Modal closure triggers refresh
onClose={() => {
  setProfileModal({ isOpen: false });
  // Page-level refresh still happens on 60-second polling
}}

// When feedback submitted
onRefresh={() => {
  fetchApplications();  ← ✓ Explicit refresh after feedback
}}
```

### Data Refresh After Join

**Manual Refresh Triggered By:**
1. Feedback submission success callback
2. Interview modal closes  
3. Automatic polling every 60 seconds

**Automatic Refresh:**
```typescript
// Line 179: Polling interval
const interval = setInterval(fetchApplications, 60000);

// This fetches fresh interview data every minute:
// - interview.status
// - recruiter_joined_at  ← ✓ Updated after join
// - candidate_joined_at  ← ✓ Updated after join
// - feedback  ← ✓ Updated after submission
```

**Issue:** Data IS being refreshed, but UI doesn't properly respond to join state change

---

## 🎯 Summary: The Missing Link

### What Exists in API Response
```json
{
  "recruiter_joined_at": "2024-04-17T10:20:45.123Z",  ✓
  "candidate_joined_at": "2024-04-17T10:25:12.456Z",  ✓
  "status": "scheduled"  ✓
}
```

### What UI Checks For
```typescript
if (status === "in_progress") {  ❌ NEVER EXISTS
  // Show live indicators
}
```

### Why Status Stays "Scheduled"

**Backend Design (Correct):**
- Status only represents major lifecycle stages:
  - pending_confirmation → scheduled → completed
  - No intermediate "in_progress" stage needed

**Real State Tracked Via:**
- `recruiter_joined_at` timestamp
- `candidate_joined_at` timestamp
- These indicate who is actually in the Jitsi meeting

**Frontend Bug (Incorrect):**
- UI assumes "in_progress" status should exist
- UI ignores available timestamp data
- Result: Shows "Scheduled" even after both join

---

## 🔧 Code Quality Summary

| Component | Status | Notes |
|-----------|--------|-------|
| Backend Join Logic | ✅ Correct | Sets timestamps properly, doesn't change status |
| Feedback Validation | ✅ Correct | Uses timestamps to verify attendance |
| Data Polling | ✅ Correct | Refreshes every 60 seconds |
| Modal Rendering | ✅ Correct | Passes timestamp data properly |
| **UI Display Logic** | ❌ **BROKEN** | **Checks for non-existent "in_progress" status** |

---

## Document References

For complete details, see:
1. **INTERVIEW_STATUS_BUG_ANALYSIS.md** - Complete root cause analysis
2. **INTERVIEW_STATUS_BUG_FIXES.md** - Before/after code examples (7 fixes)
3. **INTERVIEW_STATUS_TIMELINE.md** - Visual flow diagrams
4. **INTERVIEW_STATUS_API_RESPONSE.md** - API response examples
5. **INTERVIEW_STATUS_QUICK_FIX_GUIDE.md** - Quick reference by line number

---

## Key Findings

| Question | Answer |
|----------|--------|
| Where is feedback form displayed? | Line 673, CandidateProfileModal.tsx - visibility depends on `status === "scheduled"` |
| What updates interview status? | Backend on feedback submit - sets status to "completed" (NOT "in_progress") |
| Why doesn't UI show live indicator? | Checks for `status === "in_progress"` which backend never sets |
| How does UI know about join state? | Via `recruiter_joined_at` and `candidate_joined_at` timestamps (available but not used for display) |
| Is data being refreshed? | Yes - polling every 60 seconds fetches latest interview data |
| Why is status still "scheduled" after both join? | By design - backend only changes status to "completed" on feedback submission |
| What's the actual bug? | UI checks for non-existent status instead of using available timestamp data |
