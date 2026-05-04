# Side-by-Side Comparison: What Candidate Said vs. What's Stored in Database

**Candidate:** Manushi Bhandari (tnbit01@gmail.com)  
**User ID:** 4643c9d2-6f82-4fac-b484-4d7358a7563a  
**Onboarding Date:** May 2-3, 2026  
**Status:** Data Verification Complete

---

## COMPLETE ANSWER vs. STORAGE MATRIX

### **Question 1: Employment Status**
| Aspect | Details |
|--------|---------|
| **What They Answered** | "I'm currently employed" |
| **Stored Location** | `candidate_profiles.current_employment_status` |
| **Value in DB** | "Employed" |
| **Match Status** | ✅ **CORRECT** |
| **Grade** | A |

---

### **Question 2: What Brings You to Explore Opportunities?**
| Aspect | Details |
|--------|---------|
| **What They Answered** | "Career transition" |
| **Should Be Stored** | `candidate_profiles.job_search_motivation` OR `career_readiness_metadata` |
| **Actual Storage Location** | Attempted: `job_search_mode` |
| **Value in DB** | "exploring" |
| **Match Status** | ❌ **INCORRECT FIELD & VALUE** |
| **Issue** | "Exploring" is generic; doesn't capture "career transition" intent |
| **Data Lost** | YES - The "career transition" reason is completely lost |
| **Grade** | F |

**Details:**
```json
{
  "candidate_said": "Career transition",
  "field_used": "job_search_mode",
  "value_stored": "exploring",
  "field_should_exist": "job_search_motivation",
  "recommendation": "Add dedicated field for job search reason"
}
```

---

### **Question 3: Timeline?**
| Aspect | Details |
|--------|---------|
| **What They Answered** | "Immediately available" |
| **Should Be Stored In** | `notice_period_days` (0), `availability_date` (today), `role_urgency_level` (immediate) |
| **Value in DB - notice_period_days** | NULL (empty) |
| **Value in DB - availability_date** | NULL (empty) |
| **Value in DB - role_urgency_level** | "passive" |
| **Match Status** | ❌ **CRITICAL MISMATCH** |
| **Issue** | Fields exist but not populated; urgency level shows "passive" which contradicts immediate availability |
| **Data Lost** | YES - Candidate's urgency information is lost |
| **Grade** | F |

**Details:**
```json
{
  "candidate_said": "Immediately available",
  "notice_period_days": {
    "expected": 0,
    "actual": null,
    "status": "MISSING"
  },
  "availability_date": {
    "expected": "2026-05-02 or 2026-05-03",
    "actual": null,
    "status": "MISSING"
  },
  "role_urgency_level": {
    "expected": "immediate",
    "actual": "passive",
    "status": "CONTRADICTS ANSWER"
  }
}
```

---

### **Question 4: Work Location/Arrangement Preferences**
| Aspect | Details |
|--------|---------|
| **What They Answered** | "Open to all" (selected from: Remote only, On-site/Office, Hybrid, **Open to all**) |
| **Should Be Stored** | `work_arrangement_preference` (new field needed) OR `job_type` as "flexible" |
| **Actual Storage Location** | `job_type` |
| **Value in DB** | "onsite" |
| **Match Status** | ❌ **COMPLETELY WRONG** |
| **Issue** | Candidate said they're open to ALL arrangements, but DB shows only "onsite" - this EXCLUDES remote and hybrid jobs |
| **Impact** | HIGH - Candidate will not see remote opportunities despite being open to them |
| **Data Lost** | YES - Flexibility preference is lost; stored as restrictive |
| **Grade** | F |

**Details:**
```json
{
  "candidate_said": "Open to all",
  "available_options": ["Remote only", "On-site/Office", "Hybrid", "Open to all"],
  "value_stored": "onsite",
  "expected_value": ["remote", "onsite", "hybrid"] OR "flexible" OR "all",
  "critical_issue": "Candidate EXCLUDED from remote matching despite saying 'open to all'",
  "recommendation": "Add work_arrangement_preference field with array or multi-select"
}
```

---

### **Question 5: Experience Band**
| Aspect | Details |
|--------|---------|
| **What They Answered** | "Mid-level (1-5 years)" (selected from: Fresher, **Mid-level**, Senior, Leadership) |
| **Should Be Stored** | `candidate_profiles.experience` = "mid", `candidate_profiles.years_of_experience` = 1-5 |
| **Value in DB - experience** | "mid" |
| **Value in DB - years_of_experience** | 4 |
| **Match Status** | ✅ **CORRECT** |
| **Grade** | A |

**Details:**
```json
{
  "candidate_said": "Mid-level (1-5 years)",
  "stored": {
    "experience": "mid",
    "years_of_experience": 4
  },
  "status": "MATCHES"
}
```

---

### **Question 6: Resume Upload & Skills Confirmation**
| Aspect | Details |
|--------|---------|
| **What They Did** | Uploaded "ResumeManushiBhandari.pdf" and confirmed 8 AI-identified skills |
| **Skills Identified & Confirmed** | 8 total skills listed below |
| **Stored Location** | `candidate_profiles.resume_uploaded`, `candidate_profiles.resume_path`, `candidate_profiles.skills` |
| **Match Status** | ✅ **CORRECT** |
| **Grade** | A |

**Skills Stored:**
```json
{
  "count": 8,
  "skills": [
    "Tools: Freshdesk, Chargebee, Slack, Zoom, Google Workspace, Crisp, Callhippo, Keka",
    "Client Communication And Stakeholder Management",
    "Customer Onboarding And Training",
    "Data Analysis Using Excel",
    "Partner Development And Relationship Management",
    "Retention And Upsell Strategy",
    "ROI & Business Case Mapping",
    "MEDDIC / MEDDPICC Methodology"
  ],
  "resume_path": "resumes/4643c9d2-6f82-4fac-b484-4d7358a7563a/65f79960-217e-4432-9a32-02cb4ff5c41c-ResumeManushiBhandari.pdf",
  "resume_uploaded": true,
  "parsed_at": "2026-05-03 08:16:23.593149+00:00",
  "status": "ALL CORRECT"
}
```

---

### **Question 7: Career Fit Assessment**
| Aspect | Details |
|--------|---------|
| **Assessment Given** | **82% Fit Score** for Sales Professional role |
| **Strengths Identified** | Client Communication, Stakeholder Management, Retention & Upsell Strategy |
| **Focus Areas** | Advanced SaaS Sales Techniques (high), Enterprise Software Sales (medium) |
| **Readiness Timeline** | 6-8 weeks |
| **Should Store** | `final_profile_score` = 82, `profile_strength` = appropriate level, role fit category |
| **Actual Storage** | |
| **Value in DB - final_profile_score** | NULL (empty) ❌ |
| **Value in DB - completion_score** | 81 |
| **Value in DB - profile_strength** | "Low" ⚠️ |
| **Match Status** | ⚠️ **PARTIAL & CONTRADICTORY** |
| **Issue** | Profile strength shows "Low" but fit score is 82% - these contradict each other |
| **Data Lost** | YES - The role fit category "Sales Professional" is not stored anywhere |
| **Grade** | D |

**Details:**
```json
{
  "career_fit_score_given": 82,
  "role_category": "Sales Professional",
  "storage": {
    "final_profile_score": {
      "expected": 82,
      "actual": null,
      "status": "NULL - NOT STORED"
    },
    "completion_score": {
      "expected": 82,
      "actual": 81,
      "status": "CLOSE BUT NOT EXACT"
    },
    "profile_strength": {
      "expected": "High" or "Strong",
      "actual": "Low",
      "status": "CONTRADICTS 82% SCORE"
    },
    "fit_category": {
      "expected": "Sales Professional",
      "actual": null,
      "status": "NO FIELD EXISTS"
    }
  },
  "critical_issue": "Profile appears 'Low' strength despite 82% career fit - confusing for candidate"
}
```

---

### **Question 8: Target Role**
| Aspect | Details |
|--------|---------|
| **What They Answered** | **Three role types mentioned:** |
| | 1. "Targeting Customer Success Manager or Account Manager roles in SaaS/IT with revenue and retention ownership" |
| | 2. "Interested in roles involving onboarding, upsell/cross-sell, and long-term client relationship management" |
| | 3. "Open to transitioning into Account Executive roles with more focus on closing and revenue growth" |
| **Should Store** | `target_role` = structured list of roles, `career_gps.target_role` = same |
| **Actual Storage in candidate_profiles.target_role** | "roles involving onboarding" |
| **Actual Storage in career_gps.target_role** | NO ENTRY (career_gps is completely empty) |
| **Match Status** | ⚠️ **INCOMPLETE & IMPORTANT TABLE MISSING** |
| **Issue** | Only partial answer stored; doesn't capture CSM, Account Manager, or Account Executive roles clearly |
| **Data Lost** | YES - Significant context lost; career_gps table not populated at all |
| **Grade** | D |

**Details:**
```json
{
  "candidate_said": {
    "primary_roles": ["Customer Success Manager", "Account Manager"],
    "context": "SaaS/IT with revenue and retention ownership",
    "secondary_roles": "roles involving onboarding, upsell/cross-sell",
    "tertiary_roles": "Account Executive with closing and revenue focus"
  },
  "stored_in_candidate_profiles": "roles involving onboarding",
  "stored_in_career_gps": "NO ENTRY (TABLE EMPTY)",
  "critical_issue": "Complete career direction table (career_gps) is unused",
  "recommendation": "Populate career_gps table with target_role and current_status"
}
```

---

### **Question 9: Tech Verticals/Interests**
| Aspect | Details |
|--------|---------|
| **What They Answered** | "Interested in SaaS products, especially customer experience, eCommerce, and platform-based solutions. Also open to AI-driven and IT service-based products with strong customer lifecycle focus. Prefer industries with recurring revenue models and long-term client engagement" |
| **Should Store As** | Individual array items: ["SaaS", "Customer Experience", "eCommerce", "Platform Solutions", "AI-driven", "IT Services", "Recurring Revenue Models"] |
| **Actually Stored As** | Single array with one long string |
| **Value in DB** | `career_interests: ["Interested in SaaS products, especially customer experience, eCommerce, and platform-based solutions Also open to AI-driven and IT service-based products with strong customer lifecycle focus Prefer industries with recurring revenue models and long-term client engagement"]` |
| **Match Status** | ❌ **WRONG FORMAT - UNSEARCHABLE** |
| **Issue** | Entire answer is ONE array item instead of individual interests - makes it impossible to search/filter |
| **Impact** | Cannot match candidate with opportunities by specific interests (SaaS, eCommerce, etc.) |
| **Data Lost** | PARTIALLY - Data exists but is unusable for matching |
| **Grade** | F |

**Details:**
```json
{
  "candidate_said_interests": [
    "SaaS products",
    "customer experience",
    "eCommerce",
    "platform-based solutions",
    "AI-driven products",
    "IT service-based products",
    "customer lifecycle focus",
    "recurring revenue models",
    "long-term client engagement"
  ],
  "should_be_stored": [
    "SaaS",
    "Customer Experience",
    "eCommerce",
    "Platform Solutions",
    "AI-driven",
    "IT Services",
    "Recurring Revenue"
  ],
  "actually_stored": {
    "career_interests": [
      "Interested in SaaS products, especially customer experience, eCommerce, and platform-based solutions Also open to AI-driven and IT service-based products with strong customer lifecycle focus Prefer industries with recurring revenue models and long-term client engagement"
    ],
    "primary_industry_focus": "Technology"
  },
  "searchability": "NOT SEARCHABLE - entire string is one item",
  "critical_issue": "To find candidates interested in eCommerce, system cannot query this field effectively"
}
```

---

### **Question 10: Long-Term Career Goal**
| Aspect | Details |
|--------|---------|
| **What They Answered** | "To grow into a senior Customer Success or Account Leadership role managing enterprise clients. Driving retention, expansion revenue, and long-term partnerships. Eventually moving into leadership roles like Head of Customer Success or Account Director." |
| **Should Store** | `candidate_profiles.long_term_goal` = full text |
| **Stored Location** | `candidate_profiles.long_term_goal` |
| **Value in DB** | "To grow into a senior Customer Success or Account Leadership role managing enterprise clients Driving retention, expansion revenue, and long-term partnerships Eventually moving into leadership roles like Head of Customer Success or Account Director" |
| **Match Status** | ✅ **CORRECT** |
| **Grade** | A |

**Details:**
```json
{
  "candidate_said": "To grow into a senior Customer Success or Account Leadership role managing enterprise clients. Driving retention, expansion revenue, and long-term partnerships. Eventually moving into leadership roles like Head of Customer Success or Account Director.",
  "stored": "To grow into a senior Customer Success or Account Leadership role managing enterprise clients Driving retention, expansion revenue, and long-term partnerships Eventually moving into leadership roles like Head of Customer Success or Account Director",
  "status": "MATCHES - CORRECTLY STORED"
}
```

---

## MISSING/BROKEN STORAGE SYSTEMS

### **Missing System 1: Conversational Onboarding Session Logging**
| Item | Status |
|------|--------|
| **Table Name** | `conversational_onboarding_sessions` |
| **Expected Records** | 1 entry for this onboarding session |
| **Actual Records** | 0 (EMPTY) |
| **What Should Be Stored** | All Q&A pairs, timestamps, conversation flow, extracted metadata |
| **Current Status** | ❌ **NOT IMPLEMENTED** |
| **Impact** | No audit trail of what candidate was asked or answered |

---

### **Missing System 2: Career GPS Population**
| Item | Status |
|------|--------|
| **Table Name** | `career_gps` |
| **Expected Records** | 1 entry with target_role and current_status |
| **Actual Records** | 0 (EMPTY) |
| **What Should Store** | Target role: "CSM/Account Manager/Account Executive", Current status: "exploring" |
| **Current Status** | ❌ **TABLE EXISTS BUT NEVER POPULATED** |
| **Impact** | Cannot track career direction or progression |

---

## SUMMARY SCOREBOARD

```
Total Questions: 10
Correctly Answered & Stored: 4 (40%) ✓
  - Employment Status
  - Experience Band  
  - Resume & Skills
  - Long-term Goal

Partially/Incorrectly Stored: 5 (50%) ⚠️
  - Job Search Reason (answer lost)
  - Timeline/Availability (answer contradicted)
  - Work Arrangement (answer inverted)
  - Career Fit Score (contradictory data)
  - Target Role (incomplete, table empty)

Missing/Broken Systems: 1 (10%) ❌
  - Career Interests (format broken - not searchable)

Additional Critical Issues: 2
  - Conversational Session Not Logged
  - Career GPS Table Not Populated

DATA ACCURACY SCORE: 60%
DATA COMPLETENESS SCORE: 55%
DATA USABILITY SCORE: 50%
```

---

## KEY OBSERVATIONS

### What's Working:
1. ✅ Basic profile information capture
2. ✅ Resume parsing and skill extraction
3. ✅ Employment status recording
4. ✅ Experience level classification

### What's Broken:
1. ❌ Career motivation/reason is lost
2. ❌ Timeline information is contradictory
3. ❌ Work arrangement preferences inverted
4. ❌ Conversation history not being logged
5. ❌ Career direction tracking table unused

### Data Quality Issues:
1. ⚠️ Fields exist but aren't being populated (notice_period_days, availability_date)
2. ⚠️ Data contradict answers (job_type vs "open to all", role_urgency_level vs "immediately available")
3. ⚠️ Data format wrong (career_interests as single string vs array)
4. ⚠️ Contradiction between profile_strength ("Low") and fit_score (82%)

### Recommendation Priority:
1. 🔴 HIGH: Fix career_gps table population
2. 🔴 HIGH: Fix conversational session logging  
3. 🔴 HIGH: Fix job_type to reflect "open to all" properly
4. 🔴 HIGH: Fix role_urgency_level for "immediately available" answers
5. 🟡 MEDIUM: Parse career_interests into individual items
6. 🟡 MEDIUM: Add job_search_motivation/reason field
7. 🟡 MEDIUM: Populate notice_period_days and availability_date
8. 🟡 MEDIUM: Align profile_strength with career fit score

---

## CONCLUSION

The onboarding system captures data but has **critical gaps** in how it processes and stores candidate answers. While basic information flows correctly, crucial career-related data points are being lost, contradicted, or stored in unusable formats. This would result in poor job matching and candidate experience issues in production.

**Status: NOT PRODUCTION READY** - Requires fixes before full deployment.
