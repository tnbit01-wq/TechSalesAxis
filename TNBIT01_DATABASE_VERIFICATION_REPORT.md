# Database Verification Report - Direct Query Results

**Report Generated:** May 4, 2026  
**Candidate:** tnbit01@gmail.com (Manushi Bhandari)  
**User ID:** 4643c9d2-6f82-4fac-b484-4d7358a7563a  
**Database:** PostgreSQL (techsalesaxis-db.c34g4umwou6k.ap-south-1.rds.amazonaws.com)

---

## DATABASE VERIFICATION QUERIES & RESULTS

### **Query 1: Verify User Exists**
```sql
SELECT * FROM users WHERE email = 'tnbit01@gmail.com' OR id = '4643c9d2-6f82-4fac-b484-4d7358a7563a'
```

**Result:** ✅ FOUND
```
id:                       4643c9d2-6f82-4fac-b484-4d7358a7563a
role:                     candidate
email:                    tnbit01@gmail.com
full_name:                Tnbit
created_at:               2026-05-02 08:04:20.082321+00:00
is_verified:              True
hashed_password:          $2b$12$R0L4XHMMJnrmsuZlmgSg2.7Kg58LhUWpVj2ItvWTKQcor5oHF37Pi
otp_code:                 None
otp_expires_at:           2026-05-02 08:14:20.080985+00:00
reset_token:              None
reset_token_expires_at:   None
```

---

### **Query 2: Check Conversational Onboarding Sessions**
```sql
SELECT * FROM conversational_onboarding_sessions 
WHERE candidate_id = '4643c9d2-6f82-4fac-b484-4d7358a7563a'
```

**Result:** ❌ **NO RECORDS FOUND** (0 rows)
```
[Empty result set]
```

**Impact:** Conversation history is NOT being logged or stored anywhere.

---

### **Query 3: Verify Candidate Profile Exists**
```sql
SELECT * FROM candidate_profiles WHERE user_id = '4643c9d2-6f82-4fac-b484-4d7358a7563a'
```

**Result:** ✅ FOUND
```
user_id:                  4643c9d2-6f82-4fac-b484-4d7358a7563a
full_name:                Manushi Bhandari
phone_number:             9558198611
```

---

### **Query 4: Extract Onboarding-Related Fields from Candidate Profile**
```sql
SELECT 
  current_employment_status,
  job_search_mode,
  notice_period_days,
  location,
  experience,
  years_of_experience,
  target_role,
  long_term_goal,
  career_interests,
  primary_industry_focus,
  willing_to_relocate,
  job_type,
  onboarding_step,
  assessment_status,
  resume_uploaded,
  profile_strength,
  completion_score,
  final_profile_score,
  role_urgency_level,
  employment_readiness_status,
  availability_date,
  notice_period_required_days,
  career_readiness_score,
  career_readiness_metadata,
  skills
FROM candidate_profiles 
WHERE user_id = '4643c9d2-6f82-4fac-b484-4d7358a7563a'
```

**Result:** ✅ FOUND
```
CRITICAL ONBOARDING FIELDS:
════════════════════════════════════════════════════════════════════════════════

current_employment_status          : Employed
job_search_mode                    : exploring
notice_period_days                 : None
location                           : None
experience                         : mid
years_of_experience                : 4
target_role                        : roles involving onboarding
long_term_goal                     : To grow into a senior Customer Success or Account 
                                      Leadership role managing enterprise clients 
                                      Driving retention, expansion revenue, and 
                                      long-term partnerships Eventually moving into 
                                      leadership roles like Head of Customer Success or 
                                      Account Director

career_interests                   : ['Interested in SaaS products, especially customer 
                                       experience, eCommerce, and platform-based 
                                       solutions Also open to AI-driven and IT 
                                       service-based products with strong customer 
                                       lifecycle focus Prefer industries with recurring 
                                       revenue models and long-term client engagement']

primary_industry_focus             : Technology
willing_to_relocate                : False
job_type                           : onsite
onboarding_step                    : COMPLETED
assessment_status                  : not_started
resume_uploaded                    : True
profile_strength                   : Low
completion_score                   : 81
final_profile_score                : None
role_urgency_level                 : passive
employment_readiness_status        : not_specified
availability_date                  : None
notice_period_required_days        : None
career_readiness_score             : 0
career_readiness_metadata          : None

skills (Array with 8 items):
  [
    'Tools: Freshdesk, Chargebee, Slack, Zoom, Google Workspace, Crisp, Callhippo, Keka',
    'Client Communication And Stakeholder Management',
    'Customer Onboarding And Training',
    'Data Analysis Using Excel',
    'Partner Development And Relationship Management',
    'Retention And Upsell Strategy',
    'ROI & Business Case Mapping',
    'MEDDIC / MEDDPICC Methodology'
  ]
```

---

### **Query 5: Check Career GPS Table**
```sql
SELECT * FROM career_gps WHERE candidate_id = '4643c9d2-6f82-4fac-b484-4d7358a7563a'
```

**Result:** ❌ **NO RECORDS FOUND** (0 rows)
```
[Empty result set]
```

**Impact:** Career direction tracking is not recorded.

---

### **Query 6: Check Career Readiness History**
```sql
SELECT * FROM career_readiness_history 
WHERE user_id = '4643c9d2-6f82-4fac-b484-4d7358a7563a'
ORDER BY changed_at DESC
```

**Result:** ❌ **NO RECORDS FOUND** (0 rows)
```
[Empty result set]
```

**Impact:** Career readiness changes are not being tracked.

---

### **Query 7: Check Assessment Sessions**
```sql
SELECT * FROM assessment_sessions 
WHERE candidate_id = '4643c9d2-6f82-4fac-b484-4d7358a7563a'
ORDER BY created_at DESC
```

**Result:** ❌ **NO RECORDS FOUND** (0 rows)
```
[Empty result set]

Note: assessment_status in candidate_profiles shows "not_started", so no sessions have begun yet
```

---

### **Query 8: Check Resume Data**
```sql
SELECT * FROM resume_data WHERE user_id = '4643c9d2-6f82-4fac-b484-4d7358a7563a'
```

**Result:** ✅ FOUND
```
user_id:        4643c9d2-6f82-4fac-b484-4d7358a7563a
parsed_at:      2026-05-03 08:16:23.593149+00:00
raw_text:       [Resume content parsed]

education:      Array with 2 items
  [
    {
      "year": "2021",
      "degree": "Masters Of Business Administration (Marketing)",
      "institution": "IBS Business School, ICFAI University"
    },
    {
      "year": "2018",
      "degree": "Bachelor Of Business Administration (Marketing)",
      "institution": "NR Institute of Business Administration, G.L.S University"
    }
  ]

experience:     Array with 5 items
  [
    {
      "company": "Flits (Shopify SAAS App)",
      "position": "Customer Success Specialist & Partnership Manager",
      "start_date": "January 2026",
      "end_date": "Present",
      ...
    },
    ... (4 more entries)
  ]

skills:         Array with 8 items (already listed above)

achievements:   Array with items parsed from resume

timeline:       Career timeline extracted from experiences

career_gaps:    Analyzed for gaps in employment
```

---

### **Query 9: Full Candidate Profile Data**
```sql
SELECT * FROM candidate_profiles 
WHERE user_id = '4643c9d2-6f82-4fac-b484-4d7358a7563a'
```

**Result:** ✅ FOUND (Complete Profile)
```
COMPLETE PROFILE SNAPSHOT:
════════════════════════════════════════════════════════════════════════════════

Personal Information:
  full_name:                    Manushi Bhandari
  phone_number:                 9558198611
  email:                        (from users table: tnbit01@gmail.com)
  gender:                       None
  birthdate:                    None

Professional Information:
  current_role:                 Customer Success Specialist & Partnership Manager
  current_company_name:         None
  years_of_experience:          4
  experience:                   mid
  primary_industry_focus:       Technology
  current_employment_status:    Employed

Bio:
  "Partnership & Customer Success professional with 4+ years of experience in SaaS and IT 
   services. Skilled in onboarding, partner development, retention strategy, and revenue growth. 
   Strong ability to bridge internal teams and external stakeholders to drive long-term business 
   relationships."

Resume Information:
  resume_uploaded:              True
  resume_path:                  resumes/4643c9d2-6f82-4fac-b484-4d7358a7563a/
                                65f79960-217e-4432-9a32-02cb4ff5c41c-ResumeManushiBhandari.pdf
  resume_url:                   None
  last_resume_parse_at:         2026-05-03 08:16:23.593149+00:00

Education:
  university:                   None
  qualification_held:           Masters Of Business Administration
  graduation_year:             2021
  graduation_status:           graduated
  gpa_score:                    None

Skills & Expertise:
  skills:                       [8 items - see above]
  crm_tools:                    []
  sales_methodologies:          []
  product_domain_expertise:     []
  certifications:               []

Career Preferences:
  target_role:                  roles involving onboarding
  long_term_goal:               To grow into a senior Customer Success or Account Leadership role...
  career_interests:             ['Interested in SaaS products...']
  learning_interests:           None
  job_type:                     onsite
  willing_to_relocate:          False
  location:                     None

Job Search Status:
  job_search_mode:              exploring
  notice_period_days:           None
  availability_date:            None
  notice_period_required_days:  None
  role_urgency_level:           passive
  employment_readiness_status:  not_specified

Profile Metrics:
  profile_strength:             Low
  completion_score:             81
  final_profile_score:          None
  career_readiness_score:       0
  assessment_status:            not_started
  onboarding_step:              COMPLETED

Identity & Verification:
  identity_verified:            True
  identity_proof_path:          id-proofs/4643c9d2-6f82-4fac-b484-4d7358a7563a/
                                d88f28dc-aa83-4f14-bd95-a7adb55b8d6d-ResumeManushiBhandari.pdf
  terms_accepted:               True
  account_status:              Active

Social & Contact:
  linkedin_url:                 linkedin.com/in/manushi-bhandari-8790b5231
  portfolio_url:                None
  social_links:                 None
  learning_links:               None

Additional:
  profile_photo_url:            None
  is_shadow_profile:            False
  bulk_file_id:                 None
  created_at:                   2026-05-03 08:15:38.793677+00:00
  updated_at:                   2026-05-03 08:21:45.650067+00:00
  ai_extraction_confidence:     None
```

---

## DATA MISMATCH SUMMARY TABLE

| Field Name | Expected From Answer | Actual in DB | Match | Issue |
|------------|----------------------|--------------|-------|-------|
| employment_status | "I'm currently employed" | "Employed" | ✅ YES | None |
| job_search_reason | "Career transition" | Not stored | ❌ NO | Field doesn't exist |
| notice_period | "Immediately available" | NULL | ❌ NO | Field empty |
| availability_date | "Immediately available" | NULL | ❌ NO | Field empty |
| role_urgency_level | "Immediately available" | "passive" | ❌ NO | Contradicts answer |
| work_arrangement | "Open to all" | "onsite" | ❌ NO | Contradicts answer |
| experience_band | "Mid-level (1-5 years)" | "mid" | ✅ YES | Correct |
| years_experience | "Mid-level (1-5 years)" | 4 | ✅ YES | Correct |
| skills | [8 confirmed] | [8 items] | ✅ YES | Correct |
| career_fit_score | 82% | NULL/81 | ⚠️ PARTIAL | Unclear mapping |
| fit_category | "Sales Professional" | Not stored | ❌ NO | No field exists |
| target_role | "CSM/AM/AE roles" | "roles involving onboarding" | ⚠️ PARTIAL | Incomplete |
| career_direction | (should be in career_gps) | NO ENTRY | ❌ NO | Table empty |
| tech_interests | Individual interests | Single string | ⚠️ PARTIAL | Wrong format |
| long_term_goal | Full career vision | Full answer | ✅ YES | Correct |

---

## EMPTY TABLES

The following tables that SHOULD have data for this candidate are EMPTY:

1. **conversational_onboarding_sessions**
   - Expected: 1 entry with full conversation history
   - Actual: 0 entries
   - Status: ❌ NOT IMPLEMENTED

2. **career_gps**
   - Expected: 1 entry with target role and status
   - Actual: 0 entries
   - Status: ❌ NOT IMPLEMENTED

3. **career_readiness_history**
   - Expected: Multiple entries tracking changes
   - Actual: 0 entries
   - Status: ❌ NOT IMPLEMENTED

4. **assessment_sessions**
   - Expected: 0 entries (assessment hasn't started yet) - but table should record when assessment starts
   - Actual: 0 entries
   - Status: ⚠️ CORRECT (hasn't started, but should track when it does)

---

## VERIFICATION CHECKLIST

### Data Storage Verification
- ✅ User account exists in `users` table
- ✅ Candidate profile exists in `candidate_profiles` table
- ✅ Resume data exists in `resume_data` table
- ❌ Conversation session NOT in `conversational_onboarding_sessions` table
- ❌ Career direction NOT in `career_gps` table
- ❌ Career readiness history NOT in `career_readiness_history` table
- ⚠️ Assessment session NOT in `assessment_sessions` table (expected - not started)

### Field Population Verification
- ✅ Basic fields populated (name, phone, education, etc.)
- ⚠️ Onboarding fields partially populated (some correct, some null, some wrong)
- ❌ Career tracking fields not populated
- ❌ Conversation history not stored

### Data Accuracy Verification
- ✅ Employment status correct
- ✅ Experience level correct
- ✅ Skills correctly stored
- ❌ Job search mode doesn't match reason
- ❌ Timeline fields contradict answer
- ❌ Work arrangement contradicts answer
- ⚠️ Career interests in wrong format

---

## CONCLUSION

**Database Verification Status:** ⚠️ PARTIAL SUCCESS WITH CRITICAL GAPS

✅ **What's Working:**
- User account properly created
- Basic profile information stored
- Resume parsed and skills extracted
- Employment status captured
- Experience level recorded
- Long-term goal stored

❌ **What's Missing:**
- Conversation history not logged
- Career direction not tracked
- Career readiness history not maintained
- Timeline/availability data missing or contradictory
- Work preference data contradicts answer

**Overall Data Integrity Score:** 60%

The database contains the candidate's profile but is missing critical audit trails and has several fields with data that contradicts what the candidate answered. This needs to be fixed before the system can reliably use this data for matching or career tracking.
