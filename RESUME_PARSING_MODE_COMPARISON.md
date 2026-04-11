# RESUME PARSING COMPARISON: Conversational vs Q&A Mode

## Problem Statement
**Resume parsing is working in conversational mode but NOT in general question-and-answer mode. Why?**

---

## Root Cause Analysis

### 1. **Conversational Mode (✅ WORKING)**
**File:** `apps/web/src/app/onboarding/candidate/page.tsx`  
**Flow:**

1. **State Management**: `AWAITING_RESUME` state
   - User is guided through a natural conversational flow
   - Bot asks: "Do you have a resume to upload?"

2. **File Upload Process** (Lines 2359-2422):
   ```typescript
   const endpoint = state === "AWAITING_RESUME" 
     ? "/storage/upload/resume" 
     : "/storage/upload/aadhaar";
   
   // Upload to S3 via storage service
   response = await apiClient.post(endpoint, formData, token);
   const { file_url } = response;
   ```

3. **Resume Processing Trigger** (Lines 2394-2410):
   ```typescript
   console.log("DEBUG: Sending to /candidate/resume payload:", { resume_path: file_url });
   
   await apiClient.post(
     "/candidate/resume",  // ✅ THIS ENDPOINT TRIGGERS PARSING
     { resume_path: file_url },
     token
   );
   ```

4. **Backend Processing** (`apps/api/src/api/candidate.py` lines 315-374):
   - Receives resume path
   - Stores it in `candidate_profiles` table
   - **Adds background task**: `ResumeService.parse_resume_sync()`
   - Returns: `"status": "processing"` with message
   
   ```python
   if has_api_key:
       background_tasks.add_task(
           ResumeService.parse_resume_sync,  # ✅ CRITICAL: Background parsing
           user_id, 
           resume_path, 
           GOOGLE_API_KEY
       )
   ```

**Result**: ✅ Resume parsing happens in background → Data extracted and stored

---

### 2. **Q&A / Assessment Mode (❌ NOT WORKING)**
**File:** `apps/web/src/app/assessment/candidate/page.tsx`  
**Flow:**

1. **State Management**: Assessment flow (NOT onboarding)
   - No `AWAITING_RESUME` state
   - Assessment focuses on **questions and answers**
   - Only handles **Aadhaar/ID upload** for verification (Lines 328-382)

2. **File Upload Handling** (Lines 328-382):
   ```typescript
   const handleAadhaarUpload = async () => {
     setIsUploading(true);
     
     // Only uploads to identity verification, NOT resume parsing
     const formData = new FormData();
     formData.append("file", aadhaarFile);
     
     response = await apiClient.post(
       "/storage/upload/aadhaar",  // ⚠️ NOT /storage/upload/resume
       formData,
       token
     );
   ```

3. **No Resume Processing**:
   - **No `/candidate/resume` endpoint call**
   - **No `ResumeService.parse_resume_sync()` triggered**
   - Assessment page doesn't invoke resume parsing at all

4. **Why It Doesn't Work**:
   - Assessment mode is designed for **questions, answers, and scoring**
   - Not designed as a comprehensive onboarding flow
   - Resume is optional/supplementary in assessment context
   - **Missing integration**: No code path calls the resume parsing endpoint

**Result**: ❌ Resume upload is accepted but never sent to parsing (no `/candidate/resume` call)

---

## Technical Architecture Comparison

### Conversational Onboarding `page.tsx`
```
User Upload → /storage/upload/resume → File saved to S3
       ↓
Frontend stores file_url
       ↓
Frontend calls `/candidate/resume` with file_url
       ↓ (Backend)
API endpoint receives path, triggers:
       ↓
ResumeService.parse_resume_sync() in background
       ↓
Extracts: skills, experience, education, contact info
       ↓
Stores in ResumeData table + updates CandidateProfile
```

### Assessment Mode `page.tsx`
```
User Upload → /storage/upload/aadhaar → File saved to S3
       ↓
Frontend stores file_url
       ↓
❌ NO `/candidate/resume` ENDPOINT CALL
       ↓
❌ NO PARSING TRIGGERED
       ↓
❌ NO DATA EXTRACTED OR STORED
```

---

## Key Differences

| Aspect | Conversational Mode | Q&A / Assessment Mode |
|--------|-------------------|----------------------|
| **File Upload Endpoint** | `/storage/upload/resume` | `/storage/upload/aadhaar` |
| **Resume Processing Trigger** | ✅ `/candidate/resume` | ❌ NOT CALLED |
| **Parser Invoked** | ✅ `ResumeService.parse_resume_sync()` | ❌ NOT INVOKED |
| **Background Processing** | ✅ Yes (BackgroundTasks) | ❌ No |
| **Database Updated** | ✅ ResumeData + CandidateProfile | ❌ Only file stored |
| **Data Extraction** | ✅ Skills, Experience, Education | ❌ None |
| **State Flow** | ✅ Multi-step structured | ⚠️ Linear Q&A |
| **Purpose** | 📝 Comprehensive onboarding | 🎯 Assessment verification |

---

## Why It's Broken in Assessment Mode

### Problem 1: Missing Endpoint Call
The assessment page uploads files but **never calls** the `/candidate/resume` endpoint:

**Onboarding** (working):
```typescript
// Line 2396-2400 (conversational page)
const response = await apiClient.post(
  "/candidate/resume",  // ✅ Call made
  { resume_path: file_url },
  token
);
```

**Assessment** (broken):
```typescript
// No equivalent call in assessment/candidate/page.tsx
// File upload ends after S3 upload, no /candidate/resume call
```

### Problem 2: Assessment Endpoint Chain is Incomplete
Assessment has its own API flow that doesn't integrate with resume parsing:

**Assessment API** (`apps/api/src/api/assessment.py`):
- `POST /start` - Start assessment session
- `GET /next` - Get next question
- `POST /submit` - Submit answer
- **❌ NO resume parsing integration**

The assessment service only handles:
- Question generation
- Answer submission
- Scoring
- NOT resume extraction

### Problem 3: Architectural Mismatch
- **Onboarding page**: Designed to collect ALL profile data (resume, skills, education, contact)
- **Assessment page**: Designed for Q&A evaluation only, not data collection
- They serve different purposes → Different data pipelines

---

## Solution Options

### Option 1: Add Resume Parsing to Assessment Mode (Simple)
**Effort**: Low | **Risk**: Low | **Benefit**: High

Add the missing endpoint call to assessment page:

```typescript
// apps/web/src/app/assessment/candidate/page.tsx

const handleResumeUpload = async (file: File) => {
  // ... existing upload code ...
  
  const formData = new FormData();
  formData.append("file", file);
  
  // Step 1: Upload to S3
  const uploadResponse = await apiClient.post(
    "/storage/upload/resume",  // ✅ Use resume endpoint
    formData,
    token
  );
  const { file_url } = uploadResponse;
  
  // Step 2: ✅ ADD THIS - Trigger parsing via /candidate/resume
  const parseResponse = await apiClient.post(
    "/candidate/resume",  // ✅ MISSING CALL - ADD THIS
    { resume_path: file_url },
    token
  );
  
  if (parseResponse.status === "processing") {
    setMessage("Resume uploaded! AI extraction running in background...");
  }
};
```

### Option 2: Consolidate Resume Handling (Medium effort)
Create a shared resume upload component used by both onboarding and assessment:

```typescript
// apps/web/src/components/ResumeUploadHandler.tsx

export const useResumeUpload = () => {
  const handleUpload = async (file: File, token: string) => {
    // 1. Upload to S3
    // 2. Call /candidate/resume   ✅ CENTRALIZED
    // 3. Handle parsing response
    // 4. Update UI state
  };
  
  return { handleUpload };
};
```

### Option 3: Unified Onboarding Flow (Larger effort)
Merge assessment + onboarding into single unified flow with resume parsing as standard step.

---

## Why This Happened

1. **Two Separate Implementations**:
   - Conversational onboarding built first (full resume parsing)
   - Assessment mode added later (focused on Q&A, forgot resume parsing)

2. **Different Code Paths**:
   - Assessment inherits from older codebase
   - Resume parsing logic not migrated to assessment endpoint

3. **Design Intent Mismatch**:
   - Assessment designed as supplementary (identity verification)
   - Not designed as primary onboarding (resume extraction)

4. **NO Integration Between Modes**:
   - Each has its own file upload mechanism
   - No shared resume parsing service call
   - No unified resume extraction pipeline

---

## Verification

### How Conversational Works (Check These Lines)
- **File Upload**: `/apps/web/src/app/onboarding/candidate/page.tsx:2368`
- **Resume Endpoint Call**: `/apps/web/src/app/onboarding/candidate/page.tsx:2396`
- **Backend Processing**: `/apps/api/src/api/candidate.py:315-374`
- **Parser Invocation**: `/apps/api/src/api/candidate.py:364-368` (background_tasks.add_task)

### How Assessment Fails (Check These Lines)
- **File Upload Only**: `/apps/web/src/app/assessment/candidate/page.tsx:328-382`
- **Missing `/candidate/resume` Call**: ❌ NOT FOUND IN ASSESSMENT PAGE
- **No Parser Invoked**: ❌ NOT CALLED

---

## Summary

| Mode | Resume Upload | Resume Parsing | Data Extraction | Status |
|------|---|---|---|---|
| **Conversational** | ✅ `/storage/upload/resume` | ✅ `/candidate/resume` called | ✅ Full extraction | **WORKING** ✅ |
| **Q&A/Assessment** | ✅ `/storage/upload/aadhaar` | ❌ NOT called | ❌ No extraction | **BROKEN** ❌ |

**Root Cause**: Assessment mode uploads files but **never calls the `/candidate/resume` endpoint** that triggers the parsing service.

**Fix**: Add a call to `/candidate/resume` endpoint in assessment mode after file upload.

---

**Recommendation**: Implement Option 1 (Simple) - Add the missing endpoint call to assessment mode. It's a one-line fix with high impact and low risk.
