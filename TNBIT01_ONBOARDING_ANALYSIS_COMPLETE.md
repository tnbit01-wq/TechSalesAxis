# Comprehensive Onboarding Analysis: tnbit01@gmail.com
**User ID:** 4643c9d2-6f82-4fac-b484-4d7358a7563a  
**Date:** May 4, 2026  
**Status:** Onboarded till Assessment Part

---

## EXECUTIVE SUMMARY - CRITICAL ISSUES FOUND

| Issue | Severity | Details |
|-------|----------|---------|
| Conversational Session Not Recorded | CRITICAL | `conversational_onboarding_sessions` table is EMPTY - no conversation logs stored |
| Job Search Mode Mismatch | HIGH | Candidate answered "Career transition" but DB stores "exploring" |
| Notice Period Missing | HIGH | Candidate answered "Immediately available" but DB field is NULL |
| Location Preference Not Captured | HIGH | Candidate answered "Open to all" but this preference is NOT stored anywhere |
| Career GPS Table Empty | MEDIUM | `career_gps` table has NO entry for this candidate |
| Career Interests Format Issue | MEDIUM | Stored as single long string instead of parsed array |
| Work Arrangement Preference Misalignment | MEDIUM | Candidate said "Open to all" but DB shows `job_type: 'onsite'` |

---

## DETAILED ONBOARDING FLOW ANALYSIS

### **STEP 1: Employment Status**
**What Candidate Answered:**
```
Question: "What's your current employment status?"
Answer: "I'm currently employed"
```

**What Should Be Stored:**
- `candidate_profiles.current_employment_status` = "Employed"
- `candidate_profiles.job_search_mode` = "passive" or "actively_employed"

**What IS Actually Stored:**
- `current_employment_status`: **"Employed"** ✓ CORRECT
- `job_search_mode`: **"exploring"** ✗ INCORRECT (should reflect they are employed, not actively searching)

**Analysis:** ❌ PARTIALLY CORRECT - Employment status is correct, but job_search_mode doesn't properly reflect employed status.

---

### **STEP 2: Job Search Motivation/Reason**
**What Candidate Answered:**
```
Question: "What brings you to explore opportunities right now?"
Answer: "Career transition"
```

**What Should Be Stored:**
- A field tracking the reason for job search (Career transition, Active job search, Explore opportunities, Learning & growth)
- Could be stored as metadata or in a dedicated field

**What IS Actually Stored:**
- ❌ **NO FIELD EXISTS** for job search reason/motivation
- `job_search_mode`: "exploring" (vague, doesn't capture "career transition" specifically)
- `career_readiness_metadata`: NULL (where it could have been stored)

**Analysis:** ❌ MISSING DATA - The "Career transition" answer is completely lost. The database doesn't have a field to store WHY the candidate is looking for jobs, only WHAT their status is.

**Database Gap:** Need a `job_search_reason` or `job_search_motivation` field in `candidate_profiles`

---

### **STEP 3: Timeline/Availability**
**What Candidate Answered:**
```
Question: "What's your timeline?"
Answer: "Immediately available"
```

**What Should Be Stored:**
- `candidate_profiles.notice_period_days` = 0
- `candidate_profiles.availability_date` = Today or ASAP
- `candidate_profiles.role_urgency_level` = "immediate"

**What IS Actually Stored:**
- `notice_period_days`: **NULL** ✗ EMPTY
- `availability_date`: **NULL** ✗ EMPTY  
- `notice_period_required_days`: **NULL** ✗ EMPTY
- `role_urgency_level`: **"passive"** ✗ CONTRADICTS ANSWER (should be "immediate" or "urgent")

**Analysis:** ❌ CRITICAL DATA LOSS - The "Immediately available" answer is NOT stored. The urgency level shows "passive" which is completely opposite to what they said.

**Database Gap:** Data exists in schema but not being populated during onboarding.

---

### **STEP 4: Work Location/Arrangement Preferences**
**What Candidate Answered:**
```
Question: "Any work location or arrangement preferences?"
Answer: "Open to all"
Options were: Remote only, On-site/Office, Hybrid, Open to all
```

**What Should Be Stored:**
- `candidate_profiles.job_type` = "flexible" or "all"
- Could also be a separate `work_arrangement_preference` field

**What IS Actually Stored:**
- `location`: **NULL** ✗ (This is CURRENT location, not preference)
- `job_type`: **"onsite"** ✗ INCORRECT (should be "all" or "flexible", not just "onsite")
- ❌ **NO field exists for work arrangement preference**

**Analysis:** ❌ CRITICAL DATA MISMATCH - Candidate said "Open to all" but DB shows "onsite". This will likely filter candidate from remote opportunities. The preference is NOT captured.

**Database Gap:** Need dedicated `work_arrangement_preference` field.

---

### **STEP 5: Experience Band**
**What Candidate Answered:**
```
Question: "Which experience band best describes your current level?"
Options: Fresher, Mid-level, Senior, Leadership
Answer: "Mid-level (1-5 years)"
```

**What Should Be Stored:**
- `candidate_profiles.experience` = "mid"
- `candidate_profiles.years_of_experience` = 1-5 (or specific number like 4)

**What IS Actually Stored:**
- `experience`: **"mid"** ✓ CORRECT
- `years_of_experience`: **4** ✓ CORRECT (This came from resume parsing, not directly from onboarding answer)

**Analysis:** ✓ CORRECT - Experience band is properly stored. However, the years_of_experience seems to come from resume parsing, not the explicit answer.

---

### **STEP 6: Resume Upload & Skills Extraction**
**What Candidate Did:**
```
Uploaded: ResumeManushiBhandari.pdf
AI Identified Skills: 8 key skills
Candidate Confirmed: All 8 skills

Confirmed Skills:
1. Tools: Freshdesk, Chargebee, Slack, Zoom, Google Workspace, Crisp, Callhippo, Keka
2. Client Communication And Stakeholder Management
3. Customer Onboarding And Training
4. Data Analysis Using Excel
5. Partner Development And Relationship Management
6. Retention And Upsell Strategy
7. ROI & Business Case Mapping
8. MEDDIC / MEDDPICC Methodology
```

**What Should Be Stored:**
- `candidate_profiles.resume_uploaded` = true
- `candidate_profiles.resume_path` = "resumes/..."
- `candidate_profiles.resume_url` = accessible URL
- `candidate_profiles.skills` = Array of 8 skills
- `resume_data.raw_text` = Full resume text
- `resume_data.parsed_at` = Timestamp

**What IS Actually Stored:**
```
✓ resume_uploaded: true
✓ resume_path: "resumes/4643c9d2-6f82-4fac-b484-4d7358a7563a/65f79960-217e-4432-9a32-02cb4ff5c41c-ResumeManushiBhandari.pdf"
✗ resume_url: NULL (No URL generated)
✓ skills: Array with 8 items (correctly stored)
✓ parsed_at: "2026-05-03 08:16:23.593149+00:00" (Resume was parsed)
```

**Skills Stored:**
```json
[
  "Tools: Freshdesk, Chargebee, Slack, Zoom, Google Workspace, Crisp, Callhippo, Keka",
  "Client Communication And Stakeholder Management",
  "Customer Onboarding And Training",
  "Data Analysis Using Excel",
  "Partner Development And Relationship Management",
  "Retention And Upsell Strategy",
  "ROI & Business Case Mapping",
  "MEDDIC / MEDDPICC Methodology"
]
```

**Analysis:** ✓ CORRECT - All 8 skills properly stored. Resume uploaded and parsed correctly.

---

### **STEP 7: Career Fit Score**
**What Candidate Received:**
```
Career Fit Score: 82%
For Role: Sales Professional

Strengths Identified:
- Client Communication
- Stakeholder Management  
- Retention and Upsell Strategy

Focus Areas:
- Advanced SaaS Sales Techniques (high)
- Enterprise Software Sales (medium)

Ready in: 6-8 weeks
```

**What Should Be Stored:**
- `candidate_profiles.final_profile_score` = 82
- `candidate_profiles.profile_strength` = appropriate level
- `candidate_profiles.completion_score` = 81 (or similar)
- A "fit_category" or "target_role_fit" for "Sales Professional"
- Timestamp and confidence score

**What IS Actually Stored:**
```
✓ final_profile_score: NULL (Not populated - ISSUE!)
✓ completion_score: 81 (Close to 82%)
✓ profile_strength: "Low" (Contradicts 82% fit score - ISSUE!)
✗ fit_category: NO FIELD EXISTS for "Sales Professional"
✗ confidence_score: NO FIELD EXISTS
```

**Analysis:** ⚠️ PARTIALLY STORED - The numeric fit score (82%) is stored as `completion_score: 81`, but:
- `final_profile_score` is NULL (should be 82)
- `profile_strength` shows "Low" which contradicts the 82% fit score
- The role fit category "Sales Professional" is not stored
- No confidence or readiness timeline stored

---

### **STEP 8: Target Role**
**What Candidate Answered:**
```
Question: "What's your target role in IT Tech Sales?"

Answer (provided in onboarding):
"Targeting Customer Success Manager or Account Manager roles in SaaS/IT with revenue and retention ownership
Interested in roles involving onboarding, upsell/cross-sell, and long-term client relationship management
Open to transitioning into Account Executive roles with more focus on closing and revenue growth"
```

**What Should Be Stored:**
- `candidate_profiles.target_role` = "Customer Success Manager / Account Manager"
- `career_gps.target_role` = Same
- Additional details in metadata

**What IS Actually Stored:**
```
✓ target_role: "roles involving onboarding" (PARTIAL - only 1st part captured)
✗ career_gps.target_role: NO ENTRY (career_gps table is completely empty!)
✗ Detailed role options: NOT CAPTURED (CSM/AM/AE roles not parsed)
```

**Analysis:** ⚠️ INCOMPLETE - Only the phrase "roles involving onboarding" is stored. The full context about CSM, Account Manager, and Account Executive roles is lost. **career_gps table has no entry** for this candidate at all.

---

### **STEP 9: Tech Interests/Verticals**
**What Candidate Answered:**
```
Question: "Which specific categories or tech verticals interest you most?"

Answer:
"Interested in SaaS products, especially customer experience, eCommerce, and platform-based solutions
Also open to AI-driven and IT service-based products with strong customer lifecycle focus
Prefer industries with recurring revenue models and long-term client engagement"
```

**What Should Be Stored:**
- `candidate_profiles.career_interests` = ["SaaS", "Customer Experience", "eCommerce", "Platform Solutions", "AI-driven", "IT Services"]
- `candidate_profiles.primary_industry_focus` = "SaaS"
- Additional interests in metadata

**What IS Actually Stored:**
```
✓ primary_industry_focus: "Technology" (Too broad - should be "SaaS")
? career_interests: 
  [
    "Interested in SaaS products, especially customer experience, eCommerce, and platform-based solutions 
     Also open to AI-driven and IT service-based products with strong customer lifecycle focus 
     Prefer industries with recurring revenue models and long-term client engagement"
  ]
```

**Analysis:** ⚠️ INCORRECTLY FORMATTED - The entire answer is stored as a SINGLE string item in an array, instead of being parsed into individual interests:
- Should be: `["SaaS", "Customer Experience", "eCommerce", "Platform Solutions", "AI-driven", "IT Services", "Recurring Revenue Models"]`
- Actually is: `["Interested in SaaS products, especially customer experience..."]` (one long string)

This makes it UNSEARCHABLE and UNUSABLE for filtering or matching.

---

### **STEP 10: Long-Term Career Goal**
**What Candidate Answered:**
```
Question: "What's your ultimate career long-term goal?"

Answer:
"To grow into a senior Customer Success or Account Leadership role managing enterprise clients
Driving retention, expansion revenue, and long-term partnerships
Eventually moving into leadership roles like Head of Customer Success or Account Director"
```

**What Should Be Stored:**
- `candidate_profiles.long_term_goal` = Full answer or structured format
- Timeline/5-year plan in metadata

**What IS Actually Stored:**
```
✓ long_term_goal: 
  "To grow into a senior Customer Success or Account Leadership role managing enterprise clients 
   Driving retention, expansion revenue, and long-term partnerships 
   Eventually moving into leadership roles like Head of Customer Success or Account Director"
```

**Analysis:** ✓ CORRECT - The full long-term goal is properly stored as free text.

---

## CRITICAL DATA FLOW ISSUES

### **Issue 1: Conversational Onboarding Session NOT Created**
**Expected:** `conversational_onboarding_sessions` table should have one entry per candidate onboarding session
**Actual:** **NO ENTRY FOUND**
**Impact:** 
- Conversation history is NOT persisted
- Cannot audit what answers were given
- No record of timestamps or question-answer pairs
- No extraction confidence scores
- This table appears to be unused!

**Location in DB:** 
```sql
SELECT * FROM conversational_onboarding_sessions 
WHERE candidate_id = '4643c9d2-6f82-4fac-b484-4d7358a7563a'
-- Returns: EMPTY (0 rows)
```

---

### **Issue 2: Career GPS Table Not Populated**
**Expected:** `career_gps` table should have one entry with target role and current status
**Actual:** **NO ENTRY FOUND**
**Impact:**
- Career direction tracking is missing
- Cannot measure progress toward goals
- No record of target role selection

**Location in DB:**
```sql
SELECT * FROM career_gps 
WHERE candidate_id = '4643c9d2-6f82-4fac-b484-4d7358a7563a'
-- Returns: EMPTY (0 rows)
```

---

### **Issue 3: Career Readiness Fields Not Populated**
**Expected:** Multiple fields should be filled during onboarding
**Actual:** Most are NULL or have generic values

```
job_search_mode: 'exploring' (should reflect career transition intent)
notice_period_days: NULL (should be 0 for "immediately available")
availability_date: NULL (should be set)
role_urgency_level: 'passive' (should be 'immediate')
employment_readiness_status: 'not_specified' (should be 'ready' or 'immediate')
willing_to_relocate: False (was this even asked?)
```

---

## DATA STORAGE MAPPING MATRIX

| Onboarding Question | Expected Candidate Answer | Expected DB Field | Actual DB Field | Actual Value | Status |
|---|---|---|---|---|---|
| **1. Employment Status** | I'm currently employed | current_employment_status | current_employment_status | "Employed" | ✓ |
| **2. Job Search Reason** | Career transition | job_search_motivation | job_search_mode | "exploring" | ✗ MISMATCH |
| **3. Timeline** | Immediately available | notice_period_days | notice_period_days | NULL | ✗ MISSING |
| **3. Timeline** | Immediately available | role_urgency_level | role_urgency_level | "passive" | ✗ WRONG |
| **4. Work Arrangement** | Open to all | work_arrangement_preference | job_type | "onsite" | ✗ WRONG |
| **5. Experience Band** | Mid-level (1-5 yrs) | experience | experience | "mid" | ✓ |
| **5. Experience Band** | Mid-level (1-5 yrs) | years_of_experience | years_of_experience | 4 | ✓ |
| **6. Resume** | Upload PDF | resume_uploaded | resume_uploaded | true | ✓ |
| **6. Skills** | 8 confirmed skills | skills | skills | [8 items] | ✓ |
| **7. Career Fit** | 82% fit score | final_profile_score | final_profile_score | NULL | ✗ MISSING |
| **7. Fit Category** | Sales Professional | fit_category | N/A | N/A | ✗ NO FIELD |
| **8. Target Role** | CSM/Account Manager roles | target_role | target_role | "roles involving onboarding" | ⚠️ INCOMPLETE |
| **8. Career Direction** | N/A | career_gps.target_role | career_gps.target_role | NO ENTRY | ✗ MISSING |
| **9. Tech Interests** | SaaS, eCommerce, AI | career_interests | career_interests | ["Long string"] | ⚠️ BAD FORMAT |
| **10. Long-term Goal** | Senior CSM/Leadership | long_term_goal | long_term_goal | Full answer | ✓ |

---

## WHAT EACH ONBOARDING STEP SHOULD DO

### **Step 1: Employment Status Question**
- **Purpose:** Understand if candidate is actively employed, between roles, student, or unemployed
- **Expected Behavior:**
  - Store answer in `current_employment_status`
  - Set `job_search_mode` based on employment status (if employed but looking = passive/exploring; if unemployed = urgent)
  - Potentially trigger different question flows based on answer
- **Actual Behavior:** Only stores employment status, doesn't set job_search_mode appropriately
- **Grade:** B- (Partial implementation)

### **Step 2: Job Search Motivation**
- **Purpose:** Understand WHY candidate is looking (active search, career change, learning, etc.)
- **Expected Behavior:**
  - Store motivation/reason in dedicated field
  - Use this to understand urgency and intent
  - Personalize job recommendations based on motivation
- **Actual Behavior:** NO DEDICATED FIELD - answer is LOST
- **Grade:** F (Not implemented)

### **Step 3: Timeline/Availability**
- **Purpose:** Understand when candidate can start and how urgent their search is
- **Expected Behavior:**
  - Store notice period (immediately, 1 month, 2-3 months)
  - Calculate availability date
  - Set urgency level (immediate, soon, flexible)
- **Actual Behavior:** Fields exist but are not being populated during onboarding
- **Grade:** D (Fields exist but not used)

### **Step 4: Work Arrangement Preferences**
- **Purpose:** Understand if candidate wants remote, on-site, hybrid, or is flexible
- **Expected Behavior:**
  - Store as array or enum: [remote, onsite, hybrid, flexible]
  - Use for filtering job recommendations
  - Priority in matching process
- **Actual Behavior:** Stored as single option "onsite" despite candidate saying "open to all"
- **Grade:** F (Incorrectly storing answer)

### **Step 5: Experience Band**
- **Purpose:** Quick qualification of experience level
- **Expected Behavior:**
  - Store band (fresher, mid, senior, leadership)
  - Align with resume data
  - Use for job level filtering
- **Actual Behavior:** Correctly stored
- **Grade:** A (Working correctly)

### **Step 6: Resume Upload & Skills**
- **Purpose:** Get detailed background and extract key competencies
- **Expected Behavior:**
  - Parse resume for all job history
  - Extract skills via AI
  - Store structured data for matching
  - Track parsing confidence
- **Actual Behavior:** Correctly parsing and storing (excluded from analysis per user request)
- **Grade:** A (Working correctly)

### **Step 7: Career Fit Assessment**
- **Purpose:** Show candidate how ready they are and in which role categories
- **Expected Behavior:**
  - Calculate fit score (0-100%)
  - Identify fit category/role type
  - Show strengths and gaps
  - Provide readiness timeline
- **Actual Behavior:** Some data calculated but not all stored; profile_strength contradicts fit score
- **Grade:** C (Partially working, contradictions in data)

### **Step 8: Target Role**
- **Purpose:** Understand candidate's primary career goal and target positions
- **Expected Behavior:**
  - Store structured role preferences
  - Create entry in career_gps table
  - Enable role-based matching and recommendations
- **Actual Behavior:** Partial storage of answer; career_gps table completely empty
- **Grade:** D (Incomplete storage)

### **Step 9: Tech Interests/Verticals**
- **Purpose:** Understand which industries and technologies interest the candidate
- **Expected Behavior:**
  - Parse into individual interests (SaaS, eCommerce, AI, etc.)
  - Store as structured array
  - Use for opportunity filtering
- **Actual Behavior:** Stored as single long string - NOT SEARCHABLE
- **Grade:** F (Incorrectly formatted)

### **Step 10: Long-Term Career Goal**
- **Purpose:** Understand 5-year vision and career trajectory
- **Expected Behavior:**
  - Store as free-form text or structure
  - Use for understanding ambition level
  - Guide in long-term career planning
- **Actual Behavior:** Correctly stored
- **Grade:** A (Working correctly)

---

## DATABASE SCHEMA GAPS IDENTIFIED

| Gap | Location | Should Exist | Impact | Severity |
|-----|----------|--------------|--------|----------|
| `job_search_reason` / `job_search_motivation` | candidate_profiles | YES | Cannot track why candidate is searching | HIGH |
| `work_arrangement_preference` | candidate_profiles | YES | Cannot properly filter for remote/hybrid/onsite | HIGH |
| `fit_category` | candidate_profiles | YES | Cannot track what role type they fit | MEDIUM |
| `ai_fit_score` / `fit_confidence` | candidate_profiles | YES | Only storing profile score, not role fit | MEDIUM |
| `availability_date` | candidate_profiles | YES | Field exists but not populated | HIGH |
| Proper `career_gps` population logic | workflow | REQUIRED | Table is completely unused | CRITICAL |
| `conversational_onboarding_sessions` population | workflow | REQUIRED | Conversation history not persisted | CRITICAL |

---

## ASSESSMENT STATUS

**Current Assessment Status:** `not_started`

The candidate profile shows `assessment_status: "not_started"` even though they've mentioned they're moving into the assessment part of onboarding. This may indicate:
1. Assessment hasn't been triggered yet, OR
2. The status isn't being updated when assessment begins

---

## RECOMMENDATIONS FOR VERIFICATION

### Immediate Checks Needed:
1. **Verify conversation logging:** Check if `conversational_onboarding_sessions` is being written to at all in production
2. **Verify career_gps creation:** Confirm if `career_gps` entries are created during onboarding
3. **Verify job_type logic:** Understand why "Open to all" is being stored as "onsite"
4. **Verify role_urgency_level:** Confirm why "immediately available" is stored as "passive"
5. **Verify final_profile_score:** Confirm if 82% score should be in this field or completion_score
6. **Verify career_interests parsing:** Confirm if interests should be individual array items or one long string

### Data Quality Issues to Address:
1. Profile strength shows "Low" but fit score is 82% - these should align
2. `job_search_mode: "exploring"` doesn't differentiate between actively searching vs. employed + exploring
3. Career interests stored as unsearchable single string
4. Target role is truncated - only first phrase captured

---

## SUMMARY TABLE

```
Total Onboarding Steps: 10 (excluding resume which was explicitly excluded)
Correctly Implemented: 4 (Steps 1, 5, 6, 10)
Partially Implemented: 4 (Steps 2, 3, 4, 8, 9)  ← Actually 5
Completely Missing: 2 (Career GPS table, Conversational session logging)

Data Accuracy: 60% (of stored data matches what was answered)
Data Completeness: 55% (many fields left NULL or generic)
Data Usability: 50% (key fields like career_interests in wrong format)
```

---

## OVERALL ASSESSMENT

**System Status:** ⚠️ FUNCTIONING WITH SIGNIFICANT DATA LOSS

The onboarding flow is operational and captures some data correctly, but has several critical issues:
- Multiple data points are being lost entirely
- Some answers are being stored incorrectly (contradicting what was answered)
- Key tables (`conversational_onboarding_sessions`, `career_gps`) are not being populated
- Data formatting issues make some fields unsearchable for matching

**Critical data loss areas:** Job search reason, timeline/urgency, work arrangement preference, career GPS, conversation history

The system should be reviewed before production use to ensure all candidate answers are properly captured and stored.
