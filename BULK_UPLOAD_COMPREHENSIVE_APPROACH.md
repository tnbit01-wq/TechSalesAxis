# Bulk Resume Upload Feature - Comprehensive Approach

**Status:** Strategy & Planning Phase  
**Target User:** Internal Company Recruiters Only  
**Complexity Level:** HIGH - Multi-layered with duplicate handling & candidate linking

---

## 1. COMPLETE SYSTEM ARCHITECTURE

### 1.1 User Roles & Access Control

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER ROLE HIERARCHY                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ADMIN (Your Company)                                          │
│  ├─ Bulk upload resumes                                        │
│  ├─ Access to extracted data (raw + structured)                │
│  ├─ View duplicate detection dashboard                         │
│  ├─ Link candidates to existing accounts                       │
│  ├─ Create new candidate accounts from uploads                 │
│  ├─ Dedicated "Bulk Upload Manager" interface                  │
│  └─ Download processed data (CSV/JSON)                         │
│                                                                 │
│  EXTERNAL RECRUITER (Partner Companies)                        │
│  ├─ Can upload single resumes                                  │
│  ├─ Their candidates appear in /talent-pool                    │
│  ├─ Limited view (no extraction details)                       │
│  ├─ Can't see other recruiters' data                           │
│  └─ No duplicate management tools                              │
│                                                                 │
│  CANDIDATE                                                      │
│  ├─ Can view own profile                                       │
│  ├─ Match with job postings                                    │
│  └─ (May or may not be pre-registered)                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Data Flow Architecture

```
BULK UPLOAD FLOW (Admin/Internal Only)
═══════════════════════════════════════════════════════════════

        ┌──────────────────────────┐
        │  Admin Upload Interface  │
        │  (Drag & Drop / Browse)  │
        └──────────────┬───────────┘
                       │
                       ▼
        ┌──────────────────────────┐
        │  File Validation Layer   │
        │  - File type check       │
        │  - File size limit       │
        │  - Virus scan (optional) │
        └──────────────┬───────────┘
                       │
                       ▼
        ┌──────────────────────────┐
        │  Batch Processing Queue  │
        │  - Create upload job     │
        │  - Store metadata        │
        │  - Schedule async work   │
        └──────────────┬───────────┘
                       │
                       ▼
        ┌──────────────────────────┐
        │  Resume Extraction       │
        │  - Parse each resume     │
        │  - Extract structured    │
        │    data (name, email,    │
        │    phone, experience)    │
        └──────────────┬───────────┘
                       │
                       ▼
        ┌──────────────────────────┐
        │ DUPLICATE DETECTION 🔑   │
        │ - Name + Email match     │
        │ - Fuzzy Name match       │
        │ - Phone number match     │
        │ - Similarity scoring     │
        │ Flag duplicates for      │
        │   admin review           │
        └──────────────┬───────────┘
                       │
                       ▼
        ┌──────────────────────────┐
        │  Candidate Linking 🔑    │
        │ - Match with existing    │
        │   candidate accounts     │
        │ - Flag unregistered      │
        │   candidates             │
        │ - Flag conflicts         │
        └──────────────┬───────────┘
                       │
                       ▼
        ┌──────────────────────────┐
        │  Bulk Upload Dashboard   │
        │  - Show extraction       │
        │    summary               │
        │  - Flag duplicates       │
        │  - Flag unregistered     │
        │  - Allow admin review    │
        │    & corrections         │
        └──────────────┬───────────┘
                       │
         ┌─────────────┴─────────────┐
         │                           │
         ▼                           ▼
    APPROVE & IMPORT          REJECT & CONTACT
    - Create new candidates   - Send feedback
    - Link to accounts        - Allow reupload
    - Store raw files         - Quarantine files
    - Update talent pool      
    (if applicable)           
```

### 1.3 External Recruiter Flow (Unchanged)

```
SINGLE RESUME UPLOAD (External Recruiters)
═══════════════════════════════════════════════════════════════

Upload (existing flow)
        ↓
   Extract Data
        ↓
   Create/Link Candidate
        ↓
   Show in Talent Pool at:
   /dashboard/recruiter/talent-pool
   (No bulk features, no duplicate dashboard)
```

---

## 2. DUPLICATE DETECTION STRATEGY

### 2.1 Duplicate Definition Hierarchy

```
DUPLICATE DETECTION LEVELS (Priority Order)
═════════════════════════════════════════════════════════════

LEVEL 1: EXACT MATCH (100% Confidence)
├─ Full name (case-insensitive) + Email (exact)
├─ Result: FLAG AS DUPLICATE OF EXISTING CANDIDATE
└─ Action: Auto-link or ask for manual confirmation

LEVEL 2: STRONG MATCH (95% Confidence)
├─ Exact name + Phone number (exact)
├─ Exact email + Last 4 years of employment
└─ Action: FLAG FOR REVIEW (Ask admin: "Link or Keep Separate?")

LEVEL 3: MODERATE MATCH (80% Confidence)
├─ Fuzzy name match (>85% Levenshtein) + Email domain match
├─ Exact phone + Different name (typo?)
│  └─ Sub-level: Check if recent resume version
├─ Same company + Similar dates + Similar role
└─ Action: FLAG FOR REVIEW (Moderate confidence)

LEVEL 4: SOFT MATCH (70% Confidence)
├─ Last name + First name initial match + Same location
├─ Similar phone (typo in last 2 digits) + Same company
├─ Email prefix (name part) match + Similar position history
└─ Action: ADVISORY ONLY (Show as "May be duplicate")

LEVEL 5: WITHIN BULK UPLOAD (Internal Duplicates)
├─ Multiple resumes from same candidate in upload batch
├─ Same name + email in upload
└─ Action: FLAG & CONSOLIDATE (Ask admin: keep all or merge?)
```

### 2.2 Duplicate Scoring Algorithm

```python
def calculate_duplicate_score(resume1, resume2):
    """
    Returns (confidence_level, match_type, matched_fields)
    """
    score = 0
    matched_fields = []
    
    # Email matching (40 points)
    if resume1['email'].lower() == resume2['email'].lower():
        score += 40
        matched_fields.append('email')
    elif similarity(resume1['email'], resume2['email']) > 0.85:
        score += 20
    
    # Name matching (30 points)
    if fuzzy_match(resume1['name'], resume2['name']) == 100:
        score += 30
        matched_fields.append('name_exact')
    elif fuzzy_match(resume1['name'], resume2['name']) > 85:
        score += 15
        matched_fields.append('name_fuzzy')
    
    # Phone matching (20 points)
    if normalize_phone(resume1['phone']) == normalize_phone(resume2['phone']):
        score += 20
        matched_fields.append('phone')
    
    # Experience matching (10 points)
    if same_company_recent_years(resume1, resume2):
        score += 10
        matched_fields.append('experience')
    
    # Confidence levels
    if score >= 95:
        return ('EXACT_MATCH', score, matched_fields)
    elif score >= 80:
        return ('STRONG_MATCH', score, matched_fields)
    elif score >= 70:
        return ('MODERATE_MATCH', score, matched_fields)
    elif score >= 50:
        return ('SOFT_MATCH', score, matched_fields)
    else:
        return ('NO_MATCH', score, matched_fields)
```

---

## 3. CANDIDATE ACCOUNT LINKING STRATEGY

### 3.1 Pre-Upload Analysis (Before Admin Sees Data)

```
FOR EACH RESUME IN UPLOAD:
═════════════════════════════════════════════════════════════

STEP 1: Extract Candidate Info
├─ Name, Email, Phone
├─ Location, Current Role
└─ Years of Experience

STEP 2: Search Existing Candidates
├─ Query 1: Find by exact email
├─ Query 2: Find by exact phone
├─ Query 3: Find by fuzzy name in same location
├─ Query 4: Find by LinkedIn/portfolio links
└─ Result: 0 or more potential matches

STEP 3: Score & Recommend

Status 1: NOT_REGISTERED (100% New)
├─ No matches found
├─ Action: Create NEW candidate account
├─ Status: PENDING_VERIFICATION
└─ (Admin can verify email later or pre-approve)

Status 2: LIKELY_MATCH (One Clear Match)
├─ Confidence > 90%
├─ Action: AUTO-LINK (or ask confirmation)
├─ Link resume to existing candidate
└─ Update candidate profile with new resume

Status 3: AMBIGUOUS_MATCH (Multiple Possible Matches)
├─ Confidence: 70-89%
├─ Action: ASK ADMIN (Show options)
├─ Admin chooses: Link to X, Link to Y, or Create New
└─ Store admin's decision for future reference

Status 4: DUPLICATE_IN_BATCH (Multiple Resumes, Same Person)
├─ Same person appears 2+ times in upload
├─ Action: FLAG & CONSOLIDATE
├─ Keep latest resume, mark others for reference
└─ Store as resume versions
```

### 3.2 Candidate Account Decision Matrix

```
┌─────────────────────────────────────────────────────────────────┐
│         RESUME UPLOAD → CANDIDATE ACCOUNT MAPPING               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ SCENARIO A: Resume belongs to EXISTING REGISTERED CANDIDATE    │
│ ├─ Current status: candidate has account (active user)         │
│ ├─ Found by: email, phone, or name+location match             │
│ ├─ Action: LINK resume to candidate profile                    │
│ ├─ Notification: Send to candidate "New resume version added"  │
│ └─ Impact: Update years_experience, current_role from resume   │
│                                                                 │
│ SCENARIO B: Resume belongs to UNREGISTERED CANDIDATE           │
│ ├─ Current status: candidate does NOT have account             │
│ ├─ Found by: email exists but no account created yet          │
│ ├─ Action: CREATE NEW candidate account                        │
│ ├─ Account Status: PENDING (unverified)                        │
│ ├─ Email Verification: Required before candidate can login     │
│ ├─ Can Search: Auto-matched to jobs, shown in talent pool      │
│ └─ Impact: New candidate in system, awaiting verification      │
│                                                                 │
│ SCENARIO C: Resume is COMPLETELY NEW (no match found)          │
│ ├─ Current status: no existing data                            │
│ ├─ Found by: no results in any query                          │
│ ├─ Action: CREATE NEW candidate account                        │
│ ├─ Account Status: PENDING (inbox only)                        │
│ ├─ Email: Not yet verified                                     │
│ ├─ Notification: "Your resume has been added to talent pool"   │
│ └─ Impact: New candidate, zero engagement, passive mode        │
│                                                                 │
│ SCENARIO D: AMBIGUOUS - Multiple Possible Matches              │
│ ├─ Current status: 2-5 candidates could be this person        │
│ ├─ Confidence level: 70-89% (not high enough to auto-link)    │
│ ├─ Action: ASK ADMIN (Show comparison)                         │
│ ├─ Admin decides: "Link to John Doe" OR "Create new"          │
│ └─ Impact: Admin confirms which candidate this resume is for   │
│                                                                 │
│ SCENARIO E: DUPLICATE WITHIN BATCH                             │
│ ├─ Same person appears multiple times in upload              │
│ ├─ Example: resume_v1.pdf + resume_v2.pdf (same person)      │
│ ├─ Detection: Exact name + email match                         │
│ ├─ Action: CONSOLIDATE (keep latest, version others)          │
│ └─ Impact: 1 candidate, 2 resume versions stored              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. DATA STORAGE & LINKING SCHEMA

### 4.1 New Database Tables Needed

```sql
-- Store bulk upload batches
CREATE TABLE bulk_uploads (
    id UUID PRIMARY KEY,
    admin_id UUID NOT NULL (FK: users),
    company_id UUID NOT NULL,
    upload_date TIMESTAMP DEFAULT NOW(),
    status ENUM('IN_PROGRESS', 'COMPLETED', 'FAILED'),
    total_files INT,
    successfully_processed INT,
    duplicates_flagged INT,
    unregistered_count INT,
    created_candidates INT,
    linked_candidates INT,
    notes TEXT,
    FOREIGN KEY (admin_id) REFERENCES users(id),
    FOREIGN KEY (company_id) REFERENCES companies(id)
);

-- Store individual files in batch
CREATE TABLE bulk_upload_files (
    id UUID PRIMARY KEY,
    bulk_upload_id UUID NOT NULL (FK: bulk_uploads),
    original_filename VARCHAR(255),
    file_path VARCHAR(500),
    file_size INT,
    status ENUM('SUCCESS', 'DUPLICATE', 'ERROR', 'PENDING_REVIEW'),
    extracted_data JSONB, -- Name, email, phone, experience, etc.
    created_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (bulk_upload_id) REFERENCES bulk_uploads(id)
);

-- Link uploaded resumes to multiple potential candidates
CREATE TABLE bulk_upload_candidate_matches (
    id UUID PRIMARY KEY,
    bulk_upload_file_id UUID NOT NULL (FK: bulk_upload_files),
    candidate_id UUID NOT NULL (FK: candidate_profiles),
    match_confidence FLOAT (0-100),
    match_type ENUM('EXACT_MATCH', 'STRONG_MATCH', 'MODERATE_MATCH', 'SOFT_MATCH'),
    matched_fields JSONB, -- ['email', 'phone', 'name_fuzzy']
    admin_decision ENUM('LINKED', 'IGNORED', 'PENDING'),
    decided_at TIMESTAMP,
    decided_by UUID (FK: users),
    FOREIGN KEY (bulk_upload_file_id) REFERENCES bulk_upload_files(id),
    FOREIGN KEY (candidate_id) REFERENCES candidate_profiles(id),
    FOREIGN KEY (decided_by) REFERENCES users(id)
);

-- Track newly created candidates from bulk upload
CREATE TABLE bulk_upload_created_candidates (
    id UUID PRIMARY KEY,
    bulk_upload_file_id UUID NOT NULL (FK: bulk_upload_files),
    candidate_id UUID NOT NULL (FK: candidate_profiles),
    account_status ENUM('VERIFIED', 'PENDING', 'UNVERIFIED'),
    device_registration_sent BOOLEAN DEFAULT FALSE,
    email_verification_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (bulk_upload_file_id) REFERENCES bulk_upload_files(id),
    FOREIGN KEY (candidate_id) REFERENCES candidate_profiles(id)
);

-- Link resume files (actual storage)
CREATE TABLE bulk_upload_resumes (
    id UUID PRIMARY KEY,
    bulk_upload_file_id UUID NOT NULL (FK: bulk_upload_files),
    candidate_id UUID (FK: candidate_profiles),
    raw_file_path VARCHAR(500),
    resume_data JSONB, -- Extracted: name, email, phone, experience, skills, etc.
    extraction_accuracy FLOAT, -- Confidence score
    uploaded_by_admin_id UUID NOT NULL (FK: users),
    created_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (bulk_upload_file_id) REFERENCES bulk_upload_files(id),
    FOREIGN KEY (candidate_id) REFERENCES candidate_profiles(id),
    FOREIGN KEY (uploaded_by_admin_id) REFERENCES users(id)
);
```

### 4.2 Updated candidate_profiles Table

```sql
ALTER TABLE candidate_profiles ADD COLUMN (
    -- New fields for bulk upload tracking
    bulk_upload_id UUID (FK: bulk_uploads),
    was_created_from_bulk_upload BOOLEAN DEFAULT FALSE,
    uploaded_by_admin_id UUID (FK: users),
    account_registration_method ENUM('SELF', 'BULK_UPLOAD', 'IMPORTED'),
    
    -- Resume versioning
    resume_versions JSONB, -- [{version: 1, date: ..., file_id: ...}, ...]
    current_resume_file_id UUID,
    
    -- Track if registered or pending
    registration_status ENUM('REGISTERED', 'PENDING_VERIFICATION', 'UNVERIFIED'),
    verification_email_sent_date TIMESTAMP,
    verification_email_opened BOOLEAN DEFAULT FALSE
);
```

---

## 5. ADMIN INTERFACE WORKFLOW

### 5.1 Bulk Upload Manager UI Screen

```
╔═════════════════════════════════════════════════════════════╗
║         BULK UPLOAD MANAGER (Admin Only)                   ║
╠═════════════════════════════════════════════════════════════╣
║                                                             ║
║  [Upload Resumes] [View Uploads] [Settings]                ║
║                                                             ║
║  ┌─────────────────────────────────────────────────────┐   ║
║  │ UPLOAD BATCH 1 - March 26, 2024                     │   ║
║  │ Status: ⏳ PROCESSING (Completed: 45/50 files)     │   ║
║  ├─────────────────────────────────────────────────────┤   ║
║  │                                                     │   ║
║  │ ✅ Successfully Processed: 42 resumes              │   ║
║  │   - New Candidates Created: 28                     │   ║
║  │   - Linked to Existing: 14                         │   ║
║  │                                                     │   ║
║  │ ⚠️  Duplicates Detected: 5 resumes                 │   ║
║  │   [Review Duplicates] → Show options               │   ║
║  │   - Candidate X: 2 resumes (keep both/merge?)      │   ║
║  │   - Candidate Y: 3 resumes                         │   ║
║  │                                                     │   ║
║  │ ❓ Ambiguous Matches: 3 resumes                    │   ║
║  │   [Review Matches] → Make decisions                │   ║
║  │   - Resume: John Smith                             │   ║
║  │     Options: Link to John Smith (90%), OR          │   ║
║  │               Link to Jon Smith (75%), OR           │   ║
║  │               Create New                           │   ║
║  │                                                     │   ║
║  │ ❌ Errors: 2 files                                 │   ║
║  │   [View Errors]                                    │   ║
║  │   - resume_01.doc (Unsupported format)             │   ║
║  │   - resume_02.pdf (Corrupted)                      │   ║
║  │                                                     │   ║
║  │ 🤝 Unregistered Candidates: 12                     │   ║
║  │   [Send Invitations]                               │   ║
║  │   - Send email verification & device registration  │   ║
║  │   - Template: "Your resume has been added..."      │   ║
║  │                                                     │   ║
║  └─────────────────────────────────────────────────────┘   ║
║                                                             ║
║  [View All Files] [Download Report] [Approve & Finalize]  ║
║                                                             ║
╚═════════════════════════════════════════════════════════════╝
```

### 5.2 Duplicate Detection & Resolution

```
╔═════════════════════════════════════════════════════════════╗
║    DUPLICATE DETECTION DASHBOARD                           ║
╠═════════════════════════════════════════════════════════════╣
║                                                             ║
║  Candidate: Priya Sharma ← (Existing Candidate ID: xyz)    ║
║  ─────────────────────────────────────────────────────────  ║
║                                                             ║
║  Newly Uploaded:            vs    Existing:                ║
║  ┌──────────────────┐             ┌──────────────────┐     ║
║  │ priya.sharma@... │────────────│ priya.sharma@... │     ║
║  │ +91-9876543210   │────────────│ +91-9876543210   │     ║
║  │ Exp: 14 years    │             │ Exp: 13 years    │     ║
║  │ Role: Sr Manager │             │ Role: Manager    │     ║
║  │ Upload: 2024-03  │             │ Added: 2023-06   │     ║
║  └──────────────────┘             └──────────────────┘     ║
║                                                             ║
║  Matched Fields: Email ✓ Phone ✓ Name ✓ Similar Exp ✓      ║
║  Confidence: 98% (EXACT MATCH)                             ║
║                                                             ║
║  ┌─────────────────────────────────────────────────────┐   ║
║  │ ACTION OPTIONS:                                     │   ║
║  │ ○ Merge Resumes (Keep newer resume version)        │   ║
║  │   → Updates name, role, years_exp from new resume  │   ║
║  │   → Stores old resume as v1                        │   ║
║  │   → Sends notification: "Profile updated"          │   ║
║  │                                                     │   ║
║  │ ○ Keep Separate (Create duplicate account)         │   ║
║  │   → Creates new candidate profile                  │   ║
║  │   → Stores reference to original                   │   ║
║  │   → Flag suspicious (potential fraud)              │   ║
║  │                                                     │   ║
║  │ ○ Manual Review                                    │   ║
║  │   → Ask admin for decision later                   │   ║
║  │                                                     │   ║
║  └─────────────────────────────────────────────────────┘   ║
║                                                             ║
║  [Cancel] [Merge] [Keep Separate] [Review Later]          ║
║                                                             ║
╚═════════════════════════════════════════════════════════════╝
```

### 5.3 Candidate Account Creation from Bulk Upload

```
╔═════════════════════════════════════════════════════════════╗
║    NEW CANDIDATE ACCOUNT CREATION                          ║
╠═════════════════════════════════════════════════════════════╣
║                                                             ║
║  Resume: Arun Kumar - Senior Developer                     ║
║  Status: ✨ UNREGISTERED (No existing candidate account)   ║
║  ─────────────────────────────────────────────────────────  ║
║                                                             ║
║  EXTRACTED DATA FROM RESUME:                               ║
║  ┌─────────────────────────────────────────────────────┐   ║
║  │ Full Name: Arun Kumar                               │   ║
║  │ Email: arun.kumar@email.com                         │   ║
║  │ Phone: +91-9999999999                               │   ║
║  │ Location: Bangalore, India                          │   ║
║  │ Current Role: Senior Developer                      │   ║
║  │ Years Experience: 8                                 │   ║
║  │ Skills: Python, Django, PostgreSQL, AWS...          │   ║
║  │ Education: B.Tech in CS                             │   ║
║  └─────────────────────────────────────────────────────┘   ║
║                                                             ║
║  CREATE CANDIDATE ACCOUNT?                                 ║
║  ─────────────────────────────────────────────────────────  ║
║                                                             ║
║  Account Creation Method:                                  ║
║  ○ AUTO-APPROVE (Verified - Trust source)                 ║
║    └─ Account Status: REGISTERED (immediately active)     ║
║    └─ Send: Welcome email + Device Registration link      ║
║    └─ Can search & match jobs immediately                 ║
║                                                             ║
║  ○ REQUIRE VERIFICATION (Safer)                           ║
║    └─ Account Status: PENDING_VERIFICATION                 ║
║    └─ Send: Email verification link                       ║
║    └─ Candidate must verify email to activate             ║
║    └─ Visible in talent pool (passive mode)               ║
║                                                             ║
║  ○ MANUAL REVIEW (Most Conservative)                      ║
║    └─ Account Status: PENDING_REVIEW                      ║
║    └─ Added to admin queue                                │
║    └─ Not visible to candidates yet                       │
║                                                             ║
║  Selected: [AUTO-APPROVE]                                  ║
║                                                             ║
║  ┌─────────────────────────────────────────────────────┐   ║
║  │ ☑ Send device registration invitation               │   ║
║  │   (Allow candidate to login from mobile/web)        │   ║
║  │                                                     │   ║
║  │ ☑ Send email verification                          │   ║
║  │   (If not auto-approved)                            │   ║
║  │                                                     │   ║
║  │ ☑ Mark as uploaded by: [Your Company]              │   ║
║  │                                                     │   ║
║  └─────────────────────────────────────────────────────┘   ║
║                                                             ║
║  [Cancel] [Create Account] [Create & Continue] [Batch Op]  ║
║                                                             ║
╚═════════════════════════════════════════════════════════════╝
```

---

## 6. API ENDPOINTS NEEDED

### 6.1 Bulk Upload API

```
POST /api/admin/bulk-upload/start
Query: 
  - company_id (required)
  - upload_type: 'internal' | 'external'
Body:
  - files[] (multipart, array of PDFs/DOCs)
  - batch_name (optional)
  - description (optional)

Response:
{
  "batch_id": "uuid",
  "status": "PROCESSING",
  "total_files": 50,
  "estimated_completion": "5 minutes",
  "websocket_url": "ws://stream/uploads/uuid" (for real-time updates)
}


GET /api/admin/bulk-upload/:bulk_upload_id/status
Response:
{
  "batch_id": "uuid",
  "status": "IN_PROGRESS", // COMPLETED, FAILED
  "progress": {
    "processed": 45,
    "total": 50,
    "percentage": 90
  },
  "summary": {
    "new_candidates": 28,
    "linked_candidates": 14,
    "duplicates": 5,
    "ambiguous": 3,
    "errors": 2,
    "unregistered": 12
  }
}


GET /api/admin/bulk-upload/:bulk_upload_id/files
Response: List of all processed files with status, extracted data, etc.


POST /api/admin/bulk-upload/:bulk_upload_id/resolve-duplicates
Body:
{
  "decisions": [
    {
      "duplicate_id": "uuid",
      "action": "MERGE", // MERGE | KEEP_SEPARATE | PENDING
      "keep_as_primary": "existing" // existing | uploaded
    }
  ]
}


POST /api/admin/bulk-upload/:bulk_upload_id/resolve-ambiguous
Body:
{
  "decisions": [
    {
      "file_id": "uuid",
      "action": "LINK_TO", // LINK_TO | CREATE_NEW | PENDING
      "target_candidate_id": "uuid" (if LINK_TO)
    }
  ]
}


POST /api/admin/bulk-upload/:bulk_upload_id/create-accounts
Body:
{
  "account_creation_mode": "AUTO_APPROVE", // AUTO_APPROVE | REQUIRE_VERIFICATION | MANUAL_REVIEW
  "send_device_registration": true,
  "send_email_verification": true,
  "batch_create": true // Create all pending candidates at once
}


GET /api/admin/bulk-upload/:bulk_upload_id/report
Response: CSV/JSON report with all candidates, matches, etc.


POST /api/admin/bulk-upload/:bulk_upload_id/finalize
Body:
{
  "approve": true, // false to reject entire batch
  "notes": "Approved - candidates will be in talent pool"
}
```

### 6.2 Duplicate Detection API

```
POST /api/admin/duplicate-check/batch
Body:
{
  "candidate_ids": ["uuid1", "uuid2", ...]
}
Response: List of potential duplicates with match scores

POST /api/admin/duplicate-check/manual
Body:
{
  "resume_data": { name, email, phone, ... },
  "existing_candidates": true // Search existing or within batch
}
Response: Top 10 matches with confidence scores
```

---

## 7. ADMIN LOGIN - PERMISSION LAYERS

### 7.1 Admin Role Permission Matrix

```
╔═════════════════════════════════════════════════════════════╗
║              ADMIN ROLE PERMISSIONS                        ║
╠═════════════════════════════════════════════════════════════╣
║                                                             ║
║ PERMISSION          │ super_admin │ hr_admin │ recruiter   ║
║ ─────────────────────┼─────────────┼──────────┼─────────── ║
║ Bulk Upload         │     YES     │   YES    │    NO       ║
║ View All Uploads    │     YES     │   YES    │    NO       ║
║ Resolve Duplicates  │     YES     │   YES    │    NO       ║
║ Create Accounts     │     YES     │   YES    │    NO       ║
║ Send Invitations    │     YES     │   YES    │    NO       ║
║ Access Talent Pool  │     YES     │   YES    │    YES      ║
║ Delete Candidates   │     YES     │   NO     │    NO       ║
║ Download Reports    │     YES     │   YES    │    NO       ║
║ Manage Settings     │     YES     │   NO     │    NO       ║
║                                                             ║
└─────────────────────────────────────────────────────────────┘
```

### 7.2 Admin Login Implementation

```
NEW ROUTES FOR ADMIN:

GET  /admin/login (form)
POST /admin/login (authentication)
     - Username/Email + Password
     - SMS OTP (optional, for security)
     - 2FA Support (recommended)

GET  /admin/dashboard
     - Bulk upload manager
     - Analytics & reports
     - Settings panel

GET  /admin/bulk-uploads
     - List all uploads
     - Filter by date, status, admin

GET  /admin/duplicate-dashboard
     - View all duplicates across system
     - Global duplicate detection

GET  /admin/settings
     - Configure duplicate detection thresholds
     - Set auto-approval policies
     - Email templates
     - Notification settings
```

---

## 8. CANDIDATE POOL INTEGRATION

### 8.1 Changes to /dashboard/recruiter/talent-pool

```
BEFORE (Current):
├─ All single-uploaded candidates (external recruiters)
└─ Basic candidate card view

AFTER (With Bulk Upload):
├─ EXTERNAL UPLOADED (existing flow)
│  └─ Single resumes uploaded by partner recruiters
├─ ADMIN BULK UPLOADED (NEW)
│  └─ Candidates from internal bulk upload batches
│  └─ Mark with "📋 Bulk Uploaded" badge
│  └─ Show upload date & batch ID
├─ REGISTERED CANDIDATES (existing)
│  └─ Self-registered users
└─ Filters:
   ├─ Source: "External", "Bulk Upload", "Self-Registered"
   ├─ Upload Batch: "Batch 1 (2024-03-26)", ...
   ├─ Status: "New", "Reviewed", "Matched"
   └─ Registration: "Verified", "Pending", "Unverified"
```

---

## 9. NOTIFICATION & COMMUNICATION STRATEGY

### 9.1 Email Templates Needed

```
TEMPLATE 1: Candidate Account Created from Bulk Upload
  Subject: "Your Resume Has Been Added to Our Platform"
  Content:
    - Your resume was uploaded by [Company]
    - To activate your account, click here [verification link]
    - View profile & matched jobs

TEMPLATE 2: Account Auto-Approved (Bulk Upload)
  Subject: "Welcome to [Platform]!"
  Content:
    - Account created and ready to use
    - Download mobile app link
    - Start browsing matched jobs

TEMPLATE 3: Duplicate Resolution Notification
  Subject: "Your Profile Has Been Updated"
  Content:
    - New resume version added to profile
    - Changes: role updated, years of experience updated

TEMPLATE 4: Admin Notification (Upload Complete)
  Subject: "Bulk Upload Batch Completed"
  Content:
    - 50 files processed
    - 28 new candidates created
    - 5 duplicates flagged for review
    - Action required links
```

---

## 10. SECURITY & DATA PRIVACY

### 10.1 Security Measures

```
AUTHENTICATION:
├─ Admin login with strong password policy
├─ Session timeout (30 minutes for sensitive operations)
├─ IP whitelisting (optional, for admin panel)
├─ Audit logging (all admin actions logged)
└─ 2FA/OTP support (recommended)

FILE SECURITY:
├─ File size limits (10MB per resume)
├─ File type validation (PDF, DOC, DOCX only)
├─ Virus scanning (optional)
├─ Secure file storage (encrypted)
└─ Automatic deletion after processing

DATA PRIVACY:
├─ GDPR compliance (if applicable)
├─ Candidate consent (implicit in bulk upload)
├─ Data retention policy (delete after X months)
├─ Audit trail (who accessed what data)
└─ Right to deletion (candidate can request)
```

---

## 11. ERROR HANDLING & EDGE CASES

### 11.1 Error Scenarios

```
ERROR 1: Corrupted PDF
├─ Detection: PDF parsing fails
├─ User Impact: File marked as "ERROR - Corrupted"
├─ Resolution: Show admin, allow re-upload or skip

ERROR 2: Duplicate Email Address
├─ Detection: Multiple resumes for one email in batch
├─ User Impact: Flag "Internal Duplicate"
├─ Resolution: Ask admin to consolidate

ERROR 3: Candidate Already Registered
├─ Detection: Email matches existing verified candidate
├─ User Impact: Flag "Already Registered"
├─ Resolution: Update existing profile or skip

ERROR 4: Possible Fraud (Same person, multiple batches)
├─ Detection: Same person uploaded 5+ times in 1 day
├─ User Impact: Flag for manual review
├─ Resolution: Ask admin to investigate

ERROR 5: System Overload
├─ Detection: Batch size > 1000 files
├─ User Impact: Queue batch, process in chunks
├─ Resolution: Distribute processing over time
```

---

## 12. WORKFLOW SUMMARY

```
┌─────────────────────────────────────────────────────────────┐
│         COMPLETE BULK UPLOAD WORKFLOW                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 1. ADMIN INITIATES UPLOAD                                  │
│    └─ Visit /admin/bulk-uploads                           │
│    └─ Drag & drop or select 50 PDF files                  │
│    └─ Click "Start Processing"                            │
│                                                             │
│ 2. BACKEND PROCESSING (Async Queue)                        │
│    └─ Validate files (type, size, integrity)              │
│    └─ Extract data from each resume                       │
│    └─ Detect duplicates (within batch & existing DB)      │
│    └─ Match to existing candidates                        │
│    └─ Create/Link candidate accounts                      │
│                                                             │
│ 3. GENERATE ADMIN SUMMARY                                  │
│    └─ 42 successfully processed                           │
│    └─ 5 duplicates detected (ask for decision)            │
│    └─ 3 ambiguous matches (ask for decision)              │
│    └─ 12 new unregistered candidates (send invites)       │
│    └─ 2 errors (corrupted files)                          │
│                                                             │
│ 4. ADMIN MAKES DECISIONS                                   │
│    └─ Review & resolve duplicates                         │
│    └─ Review & resolve ambiguous matches                  │
│    └─ Choose account creation mode (auto/verify/review)   │
│    └─ Send invitations to new candidates                  │
│                                                             │
│ 5. FINALIZATION                                            │
│    └─ Admin clicks "Approve Batch"                         │
│    └─ Candidates appear in talent pool                    │
│    └─ Notifications sent                                  │
│    └─ Download report (CSV/JSON)                          │
│                                                             │
│ 6. ONGOING MANAGEMENT                                      │
│    └─ Track candidate responses                           │
│    └─ Send follow-ups if no response                      │
│    └─ Update candidate status as they engage              │
│    └─ Re-detect duplicates (new uploads)                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## SUMMARY: KEY DIFFERENTIATORS

```
INTERNAL (Your Company) with Bulk Upload:
✅ Upload 100s of resumes in one operation
✅ Auto-extract structured data
✅ Intelligent duplicate detection dashboard
✅ Candidate account linking/creation
✅ Send batch invitations
✅ Track upload batch history
✅ Download processed data

EXTERNAL (Partner Recruiters) - Unchanged:
✅ Upload single resumes (as before)
✅ Auto-extract data
✅ Show in talent pool
❌ No duplicate dashboard
❌ No batch operations
❌ No admin features
```

