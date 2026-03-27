# INPUTS NEEDED FOR BULK UPLOAD IMPLEMENTATION

## Phase 1: Clarifications & Configuration

### A. DUPLICATE DETECTION THRESHOLDS
Please specify your preferences:

```
1. FUZZY NAME MATCHING THRESHOLD
   Current: 85% similarity (Levenshtein distance)
   Question: Is this too strict or too lenient?
   Example: "John Smith" vs "Jon Smyth" = ~83% 
   Your preference: [  ] 80% | [  ] 85% | [  ] 90% | [  ] Other: ___

2. EMAIL MATCHING STRATEGY
   Current: Exact match required
   Question: Should we match on email domain if name is similar?
   Example: "john.smith@gmail.com" vs "j.smith@gmail.com" match?
   Your preference: [  ] Exact Only | [  ] Check prefix | [  ] Domain Only

3. PHONE NUMBER TOLERANCE
   Current: Exact match only
   Question: Should we allow typos in phone (e.g., last 2 digits)?
   Example: "+91-9876543210" vs "+91-9876543201" = possible match?
   Your preference: [  ] Exact | [  ] Last 2 digit typo OK | [  ] More lenient

4. CONFIDENCE THRESHOLD FOR AUTO-LINKING
   Current: >95% = Auto-link | 70-95% = Ask Admin
   Question: Should we adjust these breakpoints?
   Your preference: 
      - Auto-link above: [___]% 
      - Ask admin: [___]% to [___]%
      - Flag as soft match: Below [___]%

5. INTERNAL BATCH DUPLICATES
   If same person appears 3 times in ONE upload:
   Your preference: [  ] Keep all | [  ] Keep latest only | [  ] Ask per case
```

---

### B. CANDIDATE ACCOUNT CREATION POLICY

```
1. DEFAULT ACCOUNT CREATION MODE FOR NEW CANDIDATES
   Choose one:
   ○ AUTO-APPROVE (Account immediately active, very fast signup)
   ○ REQUIRE-VERIFICATION (Email verification link, safer)
   ○ MANUAL-REVIEW (Admin approves each, most conservative)
   
   Your choice: [______________________]

2. VERIFICATION EMAIL CONTENT
   Should we customize the email template?
   Default: "Your resume has been added to [Platform]"
   Your version: [______________________]
   
   Include mobile app download link? [  ] Yes | [  ] No
   Include job recommendations? [  ] Yes | [  ] No

3. DEVICE REGISTRATION
   Should candidates also register device (phone)?
   [  ] Yes, send device registration link
   [  ] No, just create account
   [  ] Optional (let admin choose per batch)

4. DUPLICATE=EXISTING CANDIDATE: AUTO-UPDATE PROFILE?
   If resume is for existing candidate:
   ○ Auto-update profile (name, role, years_exp, skills)
   ○ Create new resume version but don't update profile
   ○ Ask admin for each case
   
   Your choice: [______________________]

5. WHAT IF CANDIDATE IS ALREADY REGISTERED?
   If email matches existing active user:
   ○ Just add new resume version (don't notify)
   ○ Send notification "Your profile was updated"
   ○ Ask admin what to do
   
   Your choice: [______________________]
```

---

### C. DATA EXTRACTION PREFERENCES

```
1. WHICH FIELDS ARE CRITICAL?
   Mark required fields:
   [  ] Full Name (required for candidate profile)
   [  ] Email (required for account)
   [  ] Phone (required? or optional if email exists?)
   [  ] Current Role (for job matching)
   [  ] Years of Experience (for seniority matching)
   [  ] Location/City (for geographic filtering)
   [  ] Education (for qualification matching)
   [  ] Skills (for job matching)
   
   If critical field is MISSING: Reject resume or flag for manual entry?
   Your preference: [  ] Reject | [  ] Flag for manual | [  ] Use defaults

2. SKILLS EXTRACTION
   Should we extract skills from resume text?
   [  ] Yes, full extraction
   [  ] Yes, but only from explicit "Skills" section
   [  ] No, leave blank for admin to manually add

3. SHOULD WE STORE ORIGINAL PDF?
   [  ] Yes, store all original resumes (storage cost)
   [  ] No, only extract data and delete originals
   [  ] Yes, but only for matching duplicates (keep for 30 days then delete)

4. EXTRACTION CONFIDENCE SCORE
   When we extract data, we rate confidence (0-100%)
   What's minimum confidence to accept auto-extracted data?
   [  ] 0% (accept everything)
   [  ] 70% (flag if lower than 70%)
   [  ] 90% (strict, flag most as needing review)
```

---

### D. ADMIN INTERFACE PREFERENCES

```
1. BULK UPLOAD PROCESSING MODE
   ○ Real-time (Process as files are uploaded, show progress)
   ○ Batch mode (Wait for all files, review before processing)
   
   Your choice: [______________________]

2. SHOULD ADMIN APPROVE EACH DECISION?
   For 5 duplicates & 3 ambiguous matches in 50-file batch:
   ○ Batch decisions ("Merge all duplicates", "Auto-create for ambiguous")
   ○ One-by-one (Review each duplicate individually)
   ○ Smart defaults (Auto-decide high-confidence, ask for lower-confidence)
   
   Your choice: [______________________]

3. ADMIN DASHBOARD - WHAT REPORTS?
   [  ] CSV export of all candidates + match details
   [  ] JSON export of extracted data
   [  ] PDF summary report
   [  ] Email summary to admin
   [  ] Candidate invitation status report

4. AUDIT LOG - WHAT TO TRACK?
   [  ] Who uploaded what batch
   [  ] Admin decisions made (which duplicates merged)
   [  ] When invitations were sent
   [  ] Who accessed what candidate info
   [  ] When candidates verified emails
```

---

### E. SECURITY & PRIVACY QUESTIONS

```
1. FILE UPLOAD SECURITY
   Virus scanning required? [  ] Yes | [  ] No
   Max file size per resume? [  ] 5MB | [  ] 10MB | [  ] 20MB | [  ] ___MB
   File format allowed? [  ] PDF only | [  ] PDF+DOC | [  ] PDF+DOC+DOCX

2. CANDIDATE CONSENT
   Do candidates need explicit consent for bulk upload?
   (Currently implicit - their resume was uploaded)
   [  ] Implicit is fine
   [  ] Add consent checkbox during account creation
   [  ] Email asking for consent after bulk upload

3. DATA RETENTION
   How long to keep uploaded PDF files?
   [  ] Forever (compliance archive)
   [  ] 1 year then delete
   [  ] 30 days then delete
   [  ] Delete after account verification

4. ACCESS CONTROL
   Who can download/export candidate data?
   [  ] Only super_admin
   [  ] super_admin + hr_admin
   [  ] Anyone with access to bulk upload
   [  ] Limit to data they uploaded

5. COMPANY ISOLATION
   Multiple companies using your platform?
   [  ] Only one company (your company) using bulk upload
   [  ] Multiple companies, need strict data isolation
   
   If multiple, should each see others' candidates?
   [  ] No (compete for same talent pool)
   [  ] Yes (collaborate, shared talent pool)
```

---

### F. TALENT POOL INTEGRATION

```
1. BULK UPLOAD CANDIDATES IN TALENT POOL
   How should they appear?
   [  ] Same as external recruiter uploads (no special marking)
   [  ] Marked as "Bulk Uploaded" with badge/icon
   [  ] Separate section "Internal Uploads"
   [  ] Hidden from external recruiters (internal only view)

2. SHOULD OTHER RECRUITERS SEE THEM?
   If other partner recruiters use /dashboard/recruiter/talent-pool:
   [  ] Should see bulk uploaded candidates
   [  ] Should NOT see internal candidates
   [  ] Should see but with less info (no source tracking)

3. CANDIDATE MATCHING
   Should bulk uploaded candidates automatically match with jobs?
   [  ] Yes, immediately after upload
   [  ] Yes, after email verification
   [  ] Yes, only if they explicitly opt-in
   [  ] No, they need to apply manually

4. NOTIFICATIONS TO CANDIDATES
   What should auto-uploaded candidates receive?
   [  ] Job matching notifications (weekly digest)
   [  ] Immediately notified of first match
   [  ] No automated notifications
   [  ] Custom defined per batch
```

---

### G. EXISTING ADMIN LOGIN STATUS

```
1. CURRENT ADMIN LOGIN STATUS
   You mentioned it's "partially implemented"
   Question: What's already done?
   
   ○ Login form exists
   ○ Authentication works
   ○ Admin dashboard exists but incomplete
   ○ Some permission checks exist
   ○ Other: [______________________]

2. ADMIN USERS IN YOUR SYSTEM
   How many admins do you have?
   [  ] Just you (single admin)
   [  ] 2-5 admins (small team)
   [  ] 5+ admins (need role-based access)
   
   Admin roles needed:
   [  ] Super Admin (all access)
   [  ] HR Admin (bulk upload + recruiter mgmt)
   [  ] Recruiter Manager (approve recruiter signups)
   [  ] Reporting Admin (view-only reports)
   [  ] Other: [______________________]

3. DO YOU ALREADY HAVE ADMIN USERS TABLE?
   [  ] Yes, show me the structure
   [  ] No, need to create from scratch
   [  ] Partial (some columns exist)
   
   Expected schema:
   - id
   - username
   - email
   - password_hash
   - role (super_admin, hr_admin, etc.)
   - company_id (if multi-tenant)
   - created_at
   - last_login
   - status (active/inactive)
```

---

## Phase 2: Database & Technical Details

### H. DATABASE STRUCTURE

```
1. DO YOU HAVE candidate_profiles TABLE?
   [  ] Yes, show me current structure
   [  ] No, will you help me design?
   
   Current fields (if yes):
   [  ] id
   [  ] email
   [  ] name
   [  ] phone
   [  ] current_role
   [  ] years_of_experience
   [  ] Others: [______________________]

2. DO YOU HAVE resume_data TABLE?
   [  ] Yes, current structure
   [  ] No, will you create?
   
   What should it store?
   [  ] Raw resume text
   [  ] Extracted structured data (JSON)
   [  ] Both
   [  ] File path only

3. MULTI-RESUME VERSIONING
   Should one candidate have multiple resume versions?
   [  ] Yes (v1, v2, v3...)
   [  ] No, replace old with new
   [  ] Optional (admin decides)
   
   How to store versions?
   [  ] Separate row per resume
   [  ] JSON array in one row
   [  ] Linked table with version numbers
```

---

### I. EXTERNAL SYSTEMS INTEGRATION

```
1. FILE STORAGE
   Where should uploaded resumes be stored?
   [  ] Local disk (/public/uploads/...)
   [  ] AWS S3
   [  ] Google Cloud Storage
   [  ] Other: [______________________]

2. EMAIL SERVICE
   For sending invitations & notifications:
   [  ] SendGrid
   [  ] AWS SES
   [  ] Gmail SMTP
   [  ] Other: [______________________]

3. BACKGROUND JOB PROCESSING
   For async batch processing:
   [  ] Bull (Redis queue) - if using Node.js
   [  ] Celery (Python queue) - if using Python
   [  ] Simple SQL polling
   [  ] Other: [______________________]

4. RESUME PARSING LIBRARY
   Should we use existing resume parser?
   [  ] Your ComprehensiveResumeExtractor (Python)
   [  ] Third-party API (pdfparser, etc.)
   [  ] Build new one
   [  ] Your preference: [______________________]
```

---

## Phase 3: Timeline & Priorities

### J. IMPLEMENTATION PRIORITIES

```
1. WHAT FEATURES ARE MOST IMPORTANT?
   Rank 1-5 (1=most important):
   __ Duplicate detection dashboard
   __ Bulk upload interface
   __ Automatic candidate account creation
   __ Email invitations to new candidates
   __ Admin approval workflow
   
2. WHAT CAN WAIT FOR V2?
   [  ] Advanced analytics
   [  ] Resume version history
   [  ] Candidate engagement tracking
   [  ] Bulk download/export reports
   [  ] Integration with ATS system

3. TIMELINE
   When do you need this live?
   [  ] This week
   [  ] This month
   [  ] Next month
   [  ] No rush, build properly

4. TEAM SIZE
   Who will implement?
   [  ] Just you
   [  ] 1-2 developers
   [  ] Larger team
   
   Should I provide:
   [  ] Step-by-step implementation guide
   [  ] Complete code (you review & deploy)
   [  ] Architecture only (you code)
   [  ] Other: [______________________]
```

---

## Summary of Key Questions

**Copy & paste your answers below:**

```
A. Duplicate Detection:
   - Name fuzzy match threshold: _____%
   - Email matching: ○ Exact | ○ Prefix | ○ Other
   - Phone tolerance: ○ Exact | ○ Minor | ○ Other
   - Auto-link threshold: _____%
   - Batch duplicates: ○ Keep all | ○ Latest only | ○ Per case

B. Account Creation:
   - Default mode: ○ Auto-approve | ○ Verify | ○ Manual
   - Override existing profile: ○ Yes | ○ No | ○ Ask
   - Send device registration: ○ Yes | ○ No | ○ Optional

C. Data Extraction:
   - Critical fields: [__________________]
   - Store original PDFs: ○ Yes | ○ No | ○ 30-day temp
   - Min confidence score: _____%

D. Admin:
   - Processing mode: ○ Real-time | ○ Batch
   - Decision granularity: ○ Batch | ○ Individual | ○ Smart defaults
   - Reports needed: ○ CSV | ○ JSON | ○ PDF | ○ Email

E. Security:
   - Virus scanning: ○ Yes | ○ No
   - Max file size: ___MB
   - Data retention: ○ Forever | ○ 1 year | ○ 30 days
   - Company isolation: ○ Multi-tenant | ○ Single company

F. Talent Pool:
   - Bulk candidates visibility: ○ Same as external | ○ Marked | ○ Hidden
   - Automatic matching: ○ Yes | ○ After verify | ○ No
   - Auto-notifications: ○ Yes | ○ No | ○ Custom

G. Admin Login:
   - Current status: [__________________]
   - Admin roles needed: [__________________]

H. Database:
   - candidate_profiles exists: ○ Yes | ○ No
   - resume_data exists: ○ Yes | ○ No
   - Multi-version support: ○ Yes | ○ No

I. External Systems:
   - File storage: ○ Local | ○ S3 | ○ Other: ______
   - Email service: ○ SendGrid | ○ SES | ○ Other: ______
   - Job queue: ○ Bull | ○ Celery | ○ Other: ______

J. Timeline:
   - Priority ranking: [__________________]
   - Needed by: [__________________]
```

---

## Next Steps After You Provide Answers

1. ✅ I'll create detailed **database schema** based on your answers
2. ✅ I'll create **API endpoint specifications** 
3. ✅ I'll create **admin interface mockups** (HTML/React templates)
4. ✅ I'll create **duplicate detection algorithm** (working code)
5. ✅ I'll create **backend implementation guide**
6. ✅ I'll create **frontend implementation guide**
7. ✅ I'll create **admin login improvements** (if needed)

