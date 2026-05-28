# Career Readiness Storage and Onboarding Data Flow

**Document Date:** May 20, 2026  
**Last Updated:** After schema enhancement and field persistence implementation

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture & Data Flow](#architecture--data-flow)
3. [Onboarding Steps & Field Mapping](#onboarding-steps--field-mapping)
4. [Column Storage Details](#column-storage-details)
5. [Data Persistence Flow](#data-persistence-flow)
6. [Newly Added Fields & Storage](#newly-added-fields--storage)
7. [Calculated/Derived Fields](#calculatederived-fields)
8. [Verification Queries](#verification-queries)

---

## Overview

The **Career Readiness** module captures a candidate's employment status, job search engagement, availability, and preferences during onboarding. This data is critical for:
- **Recruiter filtering**: Finding candidates with matching urgency and timeline
- **Candidate profile completeness**: Tracking profile strength and readiness
- **Job matching**: Aligning candidate availability with job timelines

### Key Improvement (This Update)

Previously, many onboarding fields were collected but **not persisted** to dedicated database columns—they remained in the JSONB `career_readiness_metadata` field. This caused:
- **Missing values**: Fields like `portfolio_url`, `certifications`, `learning_interests` showed as NULL
- **Incorrect derived fields**: `profile_strength` defaulted to 'Low' even with 80%+ profile completion
- **No direct querying**: Recruiters couldn't filter by `dominant_role`, `total_relevant_years`, etc.

**This update:**
- ✅ Persists **21 new optional onboarding fields** to dedicated columns
- ✅ Recalculates `completion_score`, `profile_strength`, and `employment_readiness_status` after save
- ✅ Enables direct SQL queries for recruiter filtering on high-fidelity candidate data

---

## Architecture & Data Flow

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                      CANDIDATE ONBOARDING                           │
│                   (Front-end: React/Next.js)                        │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
        ┌──────────────────────────────────────┐
        │   Career Readiness Flow Component   │
        │   (apps/web/src/app/onboarding/     │
        │    candidate/page.tsx)              │
        │                                      │
        │  Collects:                          │
        │  - Employment status               │
        │  - Job search mode                 │
        │  - Notice period / availability     │
        │  - Work location preferences        │
        │  - Salary expectations              │
        │  - Portfolio, certifications, etc.  │
        └──────────────────┬───────────────────┘
                           │
                           ▼
        ┌──────────────────────────────────────┐
        │   buildCareerReadinessPayload()     │
        │   (Validates & normalizes fields)   │
        └──────────────────┬───────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│              POST /api/v1/candidate/career-readiness/save           │
│                     (FastAPI Endpoint)                              │
│  apps/api/src/api/career_readiness.py → save_career_readiness()   │
└──────────────────────┬──────────────────────────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────────────┐
        │   Request Schema Validation         │
        │ CareerReadinessSaveRequest          │
        │ (apps/api/src/schemas/              │
        │  career_readiness.py)               │
        │                                      │
        │ - Enum validation (employment,     │
        │   job_search_mode, contract)       │
        │ - Range validation (salary_flex)   │
        │ - Field optional/required check     │
        └──────────────────┬───────────────────┘
                           │
                           ▼
        ┌──────────────────────────────────────┐
        │   Persist to CandidateProfile ORM   │
        │                                      │
        │ For each field in request:          │
        │  - Set profile.<field> = value      │
        │  - Store both metadata and          │
        │    dedicated columns                │
        └──────────────────┬───────────────────┘
                           │
                           ▼
        ┌──────────────────────────────────────┐
        │   Recalculate Derived Metrics       │
        │                                      │
        │ 1. completion_score = weighted      │
        │    sum of populated fields          │
        │ 2. profile_strength =               │
        │    mapped from completion_score     │
        │ 3. employment_readiness_status =    │
        │    mapped from completion_score     │
        └──────────────────┬───────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│              candidate_profiles table (PostgreSQL)                  │
│                                                                     │
│  ✓ Primary fields persisted                                        │
│  ✓ Metadata JSONB updated (for backwards compatibility)            │
│  ✓ Derived metrics calculated                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Onboarding Steps & Field Mapping

### Step 1: Employment Status

**User Question:** "What's your current employment situation?"

| Field | Schema Type | Column Name | Storage | Required | Notes |
|-------|-----------|-------------|---------|----------|-------|
| employment_status | Enum | current_employment_status | VARCHAR | ✓ Yes | Values: 'employed', 'between_roles', 'student', 'not_working' |
| current_company_name | String | current_company_name | TEXT | ✗ No | Only if employed |
| between_role_detail | String | between_role_detail | VARCHAR | ✗ No | If between_roles: 'laid_off', 'contract_ended', 'resigned', 'other' |
| between_role_note | String | between_role_note | TEXT | ✗ No | Additional context (e.g., "Contract with Google ended") |

**Storage:**
```sql
UPDATE candidate_profiles
SET current_employment_status = 'employed',
    current_company_name = 'Google',
    between_role_detail = NULL,
    between_role_note = NULL
WHERE user_id = ?;
```

---

### Step 2: Job Search Mode & Motivation

**User Question:** "What brings you to explore opportunities right now?"

| Field | Schema Type | Column Name | Storage | Required | Notes |
|-------|-----------|-------------|---------|----------|-------|
| job_search_mode | Enum | job_search_mode | VARCHAR | ✓ Yes | Values: 'exploring', 'passive', 'active' |
| exploration_trigger | String | career_readiness_metadata | JSONB | ✗ No | Why: 'salary', 'growth', 'escape', 'upskill', 'relocation' |

**Storage:**
```sql
UPDATE candidate_profiles
SET job_search_mode = 'active',
    career_readiness_metadata = jsonb_set(
      COALESCE(career_readiness_metadata, '{}'),
      '{exploration_trigger}',
      '"growth"'
    )
WHERE user_id = ?;
```

---

### Step 3: Timeline & Notice Period

**User Question:** "When can you join? How much notice do you need?"

| Field | Schema Type | Column Name | Storage | Required | Notes |
|-------|-----------|-------------|---------|----------|-------|
| notice_period_days | Integer | notice_period_days | INTEGER | ✓ Yes (if employed) | Allowed values: 0, 7, 14, 30, 60, 90, 180. NULL for students/not_working |
| notice_period_required_days | Integer | notice_period_required_days | INTEGER | ✗ No | Alias field (mirrors notice_period_days for clarity) |
| availability_date | DateTime | availability_date | TIMESTAMPTZ | ✓ Calculated | Derived: NOW() + notice_period_days |
| role_urgency_level | String | role_urgency_level | VARCHAR | ✓ Yes | Derived from notice_period_days: 'passive', 'active', 'urgent_30days', 'urgent_immediate' |
| willing_to_relocate | Boolean | willing_to_relocate | BOOLEAN | ✓ Yes | Default: FALSE |

**Storage:**
```sql
UPDATE candidate_profiles
SET notice_period_days = 0,
    notice_period_required_days = 0,
    availability_date = NOW(),
    role_urgency_level = 'urgent_immediate',  -- Mapped: 0 days → immediate
    willing_to_relocate = TRUE
WHERE user_id = ? AND current_employment_status IN ('employed', 'between_roles');
```

**role_urgency_level Mapping:**
- notice_period_days = 0 → `'urgent_immediate'`
- notice_period_days ≤ 14 → `'urgent_30days'`
- notice_period_days > 14 → `'active'`
- NULL (student/not_working) → `'passive'`

---

### Step 4: Work Preferences & Contract

**User Question:** "What type of role are you looking for?"

| Field | Schema Type | Column Name | Storage | Required | Notes |
|-------|-----------|-------------|---------|----------|-------|
| contract_preference | Enum | contract_preference | VARCHAR | ✓ Yes | Values: 'fulltime', 'contract', 'both' |
| visa_sponsorship_needed | Boolean | visa_sponsorship_needed | BOOLEAN | ✓ Yes | Default: FALSE |
| job_opportunity_type | Array | job_opportunity_type | TEXT[] | ✗ No | E.g., ['Full-time', 'Contract', 'Part-time'] |
| target_market_segment | String | target_market_segment | VARCHAR | ✓ Yes | Values: 'any', 'smb', 'mid_market', 'enterprise' |

**Storage:**
```sql
UPDATE candidate_profiles
SET contract_preference = 'fulltime',
    visa_sponsorship_needed = FALSE,
    job_opportunity_type = ARRAY['Full-time', 'Part-time'],
    target_market_segment = 'mid_market'
WHERE user_id = ?;
```

---

### Step 5: Salary & Financial Expectations

**User Question:** "What are your salary expectations?"

| Field | Schema Type | Column Name | Storage | Type | Required | Notes |
|-------|-----------|-------------|---------|------|----------|-------|
| expected_salary | Numeric | expected_salary | NUMERIC | Currency | ✗ No | Stored as numeric, e.g., 120000.00 |
| current_salary | Numeric | current_salary | NUMERIC | Currency | ✗ No | Only if employed; NULL for students |
| salary_flexibility | Float | career_readiness_metadata | JSONB | 0.0–1.0 | ✓ Yes | 0 = rigid, 1.0 = very flexible |

**Storage:**
```sql
UPDATE candidate_profiles
SET expected_salary = 120000.00,
    current_salary = 100000.00,
    career_readiness_metadata = jsonb_set(
      COALESCE(career_readiness_metadata, '{}'),
      '{salary_flexibility}',
      '0.7'
    )
WHERE user_id = ?;
```

---

### Step 6: Profile & Experience Data (NEW — Previously Not Persisted)

**User Question:** "Tell us about your skills, education, and experience."

These fields are now **persisted to dedicated columns** (previously stuck in JSONB):

| Field | Schema Type | Column Name | Storage | Type | Required | Notes |
|-------|-----------|-------------|---------|------|----------|-------|
| portfolio_url | String | portfolio_url | TEXT | URL | ✗ No | GitHub, portfolio website, etc. |
| linkedin_url | String | linkedin_url | TEXT | URL | ✗ No | (Already existed) |
| social_links | JSONB | social_links | JSONB | Dict | ✗ No | E.g., `{"twitter": "...", "github": "..."}` |
| learning_links | JSONB | learning_links | JSONB | Array/Dict | ✗ No | Udemy, Coursera, portfolio links |
| learning_interests | Array | learning_interests | TEXT[] | Array | ✗ No | E.g., ['AWS', 'Machine Learning', 'Go'] |
| certifications | Array | certifications | TEXT[] | Array | ✗ No | E.g., ['AWS Solutions Architect', 'Google Cloud Associate'] |
| projects | JSONB | projects | JSONB | Array of objects | ✗ No | `[{"name": "...", "description": "...", "link": "..."}]` |
| gpa_score | Numeric | gpa_score | NUMERIC(3,2) | GPA | ✗ No | E.g., 3.85 (only for recent graduates) |
| ai_extraction_confidence | Numeric | ai_extraction_confidence | NUMERIC | 0.0–1.0 | ✗ No | Confidence score from resume extraction |

**Storage:**
```sql
UPDATE candidate_profiles
SET portfolio_url = 'https://github.com/username',
    social_links = '{"twitter": "@username", "github": "username"}'::jsonb,
    learning_links = '["https://udemy.com/...", "https://coursera.org/..."]'::jsonb,
    learning_interests = ARRAY['AWS', 'Kubernetes', 'Python'],
    certifications = ARRAY['AWS Solutions Architect', 'Kubernetes CKA'],
    projects = '[{"name": "Project A", "description": "...", "link": "https://..."}]'::jsonb,
    gpa_score = 3.85,
    ai_extraction_confidence = 0.92
WHERE user_id = ?;
```

---

### Step 7: Experience & Specialization (NEW — Previously Not Persisted)

**User Question:** "What roles have you held? What's your career pattern?"

| Field | Schema Type | Column Name | Storage | Type | Required | Notes |
|-------|-----------|-------------|---------|------|----------|-------|
| tech_sales_years | Integer | tech_sales_years | INTEGER | Years | ✗ No | Time in tech sales specifically |
| tech_years | Integer | tech_years | INTEGER | Years | ✗ No | Total tech/engineering experience |
| sales_years | Integer | sales_years | INTEGER | Years | ✗ No | Total sales/business dev experience |
| total_relevant_years | Integer | total_relevant_years | INTEGER | Years | ✓ Recommended | Sum of all relevant experience |
| dominant_role | String | dominant_role | TEXT | Role | ✗ No | E.g., 'Sales Engineer', 'Solutions Architect', 'Account Executive' |
| primary_career_pattern | String | primary_career_pattern | TEXT | Pattern | ✗ No | E.g., 'steady_progression', 'job_hopping', 'lateral_moves', 'founder' |
| role_frequency | JSONB | role_frequency | JSONB | Dict | ✗ No | `{"frequent_changes": 3, "avg_tenure": 2.5}` |

**Storage:**
```sql
UPDATE candidate_profiles
SET tech_sales_years = 5,
    tech_years = 3,
    sales_years = 7,
    total_relevant_years = 5,
    dominant_role = 'Sales Engineer',
    primary_career_pattern = 'steady_progression',
    role_frequency = '{"frequent_changes": 1, "avg_tenure": 2.5}'::jsonb
WHERE user_id = ?;
```

---

## Column Storage Details

### candidate_profiles Table Schema (Relevant Columns)

```sql
CREATE TABLE candidate_profiles (
  -- Primary & Identity
  user_id UUID NOT NULL UNIQUE,
  full_name VARCHAR(255),
  
  -- Career Readiness Fields (NEW PERSISTENCE)
  current_employment_status VARCHAR(32),        -- 'employed', 'between_roles', 'student', 'not_working'
  current_company_name TEXT,                   -- Company name if employed
  between_role_detail VARCHAR(32),             -- 'laid_off', 'contract_ended', 'resigned', 'other'
  between_role_note TEXT,                      -- Additional context
  
  -- Job Search Engagement
  job_search_mode VARCHAR(32),                 -- 'exploring', 'passive', 'active'
  notice_period_days INTEGER,                  -- 0, 7, 14, 30, 60, 90, 180, NULL
  notice_period_required_days INTEGER,         -- Alias (mirrors notice_period_days)
  availability_date TIMESTAMPTZ,               -- Calculated: NOW() + notice_period_days
  
  -- Timeline & Urgency (CALCULATED)
  role_urgency_level VARCHAR(32),              -- 'passive', 'active', 'urgent_30days', 'urgent_immediate'
  employment_readiness_status VARCHAR(32),    -- 'not_specified', 'ready', 'preparing'
  career_readiness_score NUMERIC(5,2),        -- 0-100 readiness score
  career_readiness_timestamp TIMESTAMPTZ,     -- When profile was last saved
  
  -- Preferences & Constraints
  willing_to_relocate BOOLEAN DEFAULT FALSE,
  contract_preference VARCHAR(32),             -- 'fulltime', 'contract', 'both'
  visa_sponsorship_needed BOOLEAN DEFAULT FALSE,
  job_opportunity_type TEXT[] DEFAULT '{}',   -- ['Full-time', 'Contract', 'Part-time']
  target_market_segment VARCHAR(64),           -- 'any', 'smb', 'mid_market', 'enterprise'
  
  -- Salary (NUMERIC to support currency without scale loss)
  expected_salary NUMERIC,                     -- Amount in local currency
  current_salary NUMERIC,                      -- Amount in local currency
  
  -- Profile & Experience (NEW PERSISTENCE)
  portfolio_url TEXT,
  linkedin_url VARCHAR(511),
  social_links JSONB,                         -- Dict: {"twitter": "...", "github": "..."}
  learning_links JSONB,                       -- Array/Dict of learning platform links
  learning_interests TEXT[],                  -- ['AWS', 'Kubernetes', 'Python']
  certifications TEXT[],                      -- ['AWS Solutions Architect', 'Kubernetes CKA']
  projects JSONB,                             -- Array: [{"name": "...", "description": "...", "link": "..."}]
  gpa_score NUMERIC(3,2),                     -- GPA (e.g., 3.85)
  ai_extraction_confidence NUMERIC(3,2),      -- Confidence from resume extraction (0.0-1.0)
  
  -- Experience & Specialization (NEW PERSISTENCE)
  tech_sales_years INTEGER,                   -- Years in tech sales
  tech_years INTEGER,                         -- Years in tech/engineering
  sales_years INTEGER,                        -- Years in sales/business dev
  total_relevant_years INTEGER,               -- Total relevant experience
  dominant_role TEXT,                         -- Primary role (e.g., 'Sales Engineer')
  primary_career_pattern TEXT,                -- Career pattern (e.g., 'steady_progression')
  role_frequency JSONB,                       -- Frequency analysis dict
  
  -- Completion & Strength (CALCULATED)
  completion_score INTEGER,                   -- 0-100, weighted by populated fields
  profile_strength VARCHAR(32),               -- 'Low', 'Medium', 'Strong' (mapped from completion_score)
  final_profile_score NUMERIC(3,1),           -- Career fit score (from AI)
  
  -- Identity & Terms
  identity_verified BOOLEAN DEFAULT FALSE,
  identity_proof_path TEXT,
  terms_accepted BOOLEAN DEFAULT FALSE,
  account_status VARCHAR(32) DEFAULT 'Active',
  
  -- Metadata & Timestamps
  career_readiness_metadata JSONB,            -- Legacy JSONB (backwards compatibility)
  onboarding_step VARCHAR(64),                -- Current step in onboarding flow
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

---

## Data Persistence Flow

### Request → Response Lifecycle

#### 1. Front-end Constructs Payload

**File:** `apps/web/src/app/onboarding/candidate/page.tsx`

```typescript
// After collecting all career readiness fields, build payload
const buildCareerReadinessPayload = (data: any) => {
  return {
    employment_status: data.employment_status,           // 'employed' | 'between_roles' | 'student' | 'not_working'
    job_search_mode: data.job_search_mode,              // 'exploring' | 'passive' | 'active'
    notice_period_days: data.notice_period_days,        // 0 | 7 | 14 | 30 | 60 | 90 | 180 | null
    willing_to_relocate: data.willing_to_relocate,      // boolean
    contract_preference: data.contract_preference,      // 'fulltime' | 'contract' | 'both'
    visa_sponsorship_needed: data.visa_sponsorship_needed,  // boolean
    salary_flexibility: data.salary_flexibility,        // 0.0 - 1.0
    expected_salary: data.expected_salary,              // numeric or null
    current_salary: data.current_salary,                // numeric or null
    target_market_segment: data.target_market_segment,  // 'any' | 'smb' | 'mid_market' | 'enterprise'
    current_company_name: data.current_company_name,    // string or null
    between_role_detail: data.between_role_detail,      // 'laid_off' | 'contract_ended' | 'resigned' | 'other' | null
    between_role_note: data.between_role_note,          // string or null
    
    // NEW: Profile & Experience Fields (previously not sent)
    portfolio_url: data.portfolio_url,                  // URL or null
    learning_links: data.learning_links,                // Array or null
    learning_interests: data.learning_interests,        // Array or null
    social_links: data.social_links,                    // Dict or null
    certifications: data.certifications,                // Array or null
    projects: data.projects,                            // Array of objects or null
    gpa_score: data.gpa_score,                          // numeric or null
    ai_extraction_confidence: data.ai_extraction_confidence,  // 0.0-1.0 or null
    tech_sales_years: data.tech_sales_years,            // int or null
    tech_years: data.tech_years,                        // int or null
    sales_years: data.sales_years,                      // int or null
    total_relevant_years: data.total_relevant_years,    // int or null
    role_frequency: data.role_frequency,                // dict or null
    dominant_role: data.dominant_role,                  // string or null
    primary_career_pattern: data.primary_career_pattern,  // string or null
    notice_period_required_days: data.notice_period_required_days,  // int or null
    job_opportunity_type: data.job_opportunity_type,    // array or null
  };
};

// Send to backend
await apiClient.post('/api/v1/candidate/career-readiness/save', payload, token);
```

#### 2. Schema Validation (Backend)

**File:** `apps/api/src/schemas/career_readiness.py`

```python
class CareerReadinessSaveRequest(BaseModel):
    """Complete Career Readiness profile"""
    employment_status: EmploymentStatus        # Required enum
    job_search_mode: JobSearchMode             # Required enum
    notice_period_days: Optional[int] = None   # Optional; validates against [0, 7, 14, 30, 60, 90, 180]
    willing_to_relocate: bool                  # Required boolean
    contract_preference: ContractPreference = ContractPreference.FULLTIME  # Required enum
    visa_sponsorship_needed: bool = False      # Optional boolean
    # ... (many more fields)
    
    # NEW: Optional fields for profile & experience
    portfolio_url: Optional[str] = None
    learning_links: Optional[List[str]] = None
    learning_interests: Optional[List[str]] = None
    social_links: Optional[Dict[str, Any]] = None
    certifications: Optional[List[str]] = None
    projects: Optional[List[Dict[str, Any]]] = None
    gpa_score: Optional[float] = None
    ai_extraction_confidence: Optional[float] = None
    tech_sales_years: Optional[int] = None
    tech_years: Optional[int] = None
    sales_years: Optional[int] = None
    total_relevant_years: Optional[int] = None
    role_frequency: Optional[Dict[str, Any]] = None
    dominant_role: Optional[str] = None
    primary_career_pattern: Optional[str] = None
    notice_period_required_days: Optional[int] = None
    job_opportunity_type: Optional[List[str]] = None
```

#### 3. Endpoint Processes & Persists

**File:** `apps/api/src/api/career_readiness.py`

```python
@router.post("/save")
async def save_career_readiness(
    request: CareerReadinessSaveRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Steps:
    1. Get or create CandidateProfile
    2. Calculate availability_date from notice_period_days
    3. Build career_readiness_metadata JSONB
    4. Update profile fields (both primary columns AND metadata)
    5. RECALCULATE completion_score, profile_strength, employment_readiness_status
    6. Commit and return response
    """
    
    user_id = user["sub"]
    profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == user_id).first()
    
    if not profile:
        profile = CandidateProfile(user_id=user_id, full_name=..., onboarding_step="AWAITING_CAREER_READINESS")
        db.add(profile)
        db.flush()
    
    # Calculate availability_date
    availability_date = None
    if request.notice_period_days is not None:
        availability_date = datetime.now(timezone.utc) + timedelta(days=request.notice_period_days)
    
    # Build metadata (backwards compatibility)
    metadata = {
        "exploration_trigger": request.exploration_trigger or "initial_onboarding",
        "willing_to_relocate": request.willing_to_relocate,
        "contract_preference": request.contract_preference,
        "visa_sponsorship_needed": request.visa_sponsorship_needed,
        "salary_flexibility": request.salary_flexibility,
        "expected_salary": request.expected_salary,
        "current_salary": request.current_salary,
        "target_market_segment": request.target_market_segment or "any",
        "between_role_detail": getattr(request, 'between_role_detail', None),
        "between_role_note": getattr(request, 'between_role_note', None),
    }
    
    # ===== PERSIST PRIMARY CAREER READINESS FIELDS =====
    profile.current_employment_status = request.employment_status
    profile.job_search_mode = request.job_search_mode
    profile.notice_period_days = request.notice_period_days
    profile.availability_date = availability_date
    profile.willing_to_relocate = request.willing_to_relocate
    profile.career_readiness_timestamp = datetime.now(timezone.utc)
    profile.career_readiness_metadata = metadata
    profile.contract_preference = request.contract_preference
    profile.visa_sponsorship_needed = request.visa_sponsorship_needed
    profile.target_market_segment = request.target_market_segment or "any"
    
    if request.current_company_name:
        profile.current_company_name = request.current_company_name
    if getattr(request, 'between_role_detail', None):
        profile.between_role_detail = request.between_role_detail
    if getattr(request, 'between_role_note', None):
        profile.between_role_note = request.between_role_note
    
    # ===== NEW: PERSIST PROFILE & EXPERIENCE FIELDS =====
    if getattr(request, 'portfolio_url', None) is not None:
        profile.portfolio_url = request.portfolio_url
    if getattr(request, 'learning_links', None) is not None:
        profile.learning_links = request.learning_links
    if getattr(request, 'learning_interests', None) is not None:
        profile.learning_interests = request.learning_interests
    if getattr(request, 'social_links', None) is not None:
        profile.social_links = request.social_links
    if getattr(request, 'certifications', None) is not None:
        profile.certifications = request.certifications
    if getattr(request, 'projects', None) is not None:
        profile.projects = request.projects
    if getattr(request, 'gpa_score', None) is not None:
        profile.gpa_score = request.gpa_score
    if getattr(request, 'ai_extraction_confidence', None) is not None:
        profile.ai_extraction_confidence = request.ai_extraction_confidence
    if getattr(request, 'tech_sales_years', None) is not None:
        profile.tech_sales_years = request.tech_sales_years
    if getattr(request, 'tech_years', None) is not None:
        profile.tech_years = request.tech_years
    if getattr(request, 'sales_years', None) is not None:
        profile.sales_years = request.sales_years
    if getattr(request, 'total_relevant_years', None) is not None:
        profile.total_relevant_years = request.total_relevant_years
    if getattr(request, 'role_frequency', None) is not None:
        profile.role_frequency = request.role_frequency
    if getattr(request, 'dominant_role', None) is not None:
        profile.dominant_role = request.dominant_role
    if getattr(request, 'primary_career_pattern', None) is not None:
        profile.primary_career_pattern = request.primary_career_pattern
    if getattr(request, 'notice_period_required_days', None) is not None:
        profile.notice_period_required_days = request.notice_period_required_days
    if getattr(request, 'job_opportunity_type', None) is not None:
        profile.job_opportunity_type = request.job_opportunity_type
    
    # Commit initial save
    db.commit()
    db.refresh(profile)
    
    # ===== RECALCULATE DERIVED METRICS =====
    profile_dict = {
        'full_name': profile.full_name,
        'phone_number': profile.phone_number,
        'bio': profile.bio,
        'current_role': profile.current_role,
        'years_of_experience': profile.years_of_experience,
        'primary_industry_focus': profile.primary_industry_focus,
        'linkedin_url': profile.linkedin_url,
        'portfolio_url': profile.portfolio_url,  # NOW POPULATED
        'gender': profile.gender,
        'birthdate': profile.birthdate,
        'referral': profile.referral,
        'location': profile.location,
        'education_history': profile.education_history,
        'experience_history': profile.experience_history,
        'career_gap_report': profile.career_gap_report,
        'identity_verified': profile.identity_verified
    }
    
    # Calculate completion score
    new_completion = CandidateService.calculate_completion_score(profile_dict)
    profile.completion_score = new_completion
    
    # Map completion_score → profile_strength
    if new_completion >= 80:
        profile.profile_strength = 'Strong'
    elif new_completion >= 60:
        profile.profile_strength = 'Medium'
    else:
        profile.profile_strength = 'Low'
    
    # Map completion_score → employment_readiness_status
    if new_completion >= 75:
        profile.employment_readiness_status = 'ready'
    
    # Final commit
    db.commit()
    db.refresh(profile)
    
    return {
        "status": "saved",
        "completion_score": profile.completion_score,
        "profile_strength": profile.profile_strength,
        "employment_readiness_status": profile.employment_readiness_status,
        "onboarding_step": profile.onboarding_step
    }
```

---

## Calculated/Derived Fields

### completion_score (0-100)

**Purpose:** Measure how complete the candidate's profile is.

**Calculation Method:**
Weighted sum of populated fields. If a field exists and is non-empty, add its weight.

**Weight Breakdown:**
- full_name: 10 points
- phone_number: 5 points
- bio: 15 points
- current_role: 10 points
- years_of_experience: 5 points
- primary_industry_focus: 5 points
- linkedin_url: 5 points
- portfolio_url: 5 points (NEW)
- gender: 2 points
- birthdate: 3 points
- referral: 2 points
- location: 5 points
- education_history: 15 points
- experience_history: 20 points
- career_gap_report: 10 points
- identity_verified: 5 points

**Max Total:** 157 points → normalized to 100

**Formula:**
```
completion_score = (sum_of_weights_for_populated_fields / 157) * 100
```

**Example:**
- Candidate has: full_name (10) + current_role (10) + bio (15) + experience_history (20) + location (5) + portfolio_url (5) = 65 points
- Score = (65 / 157) * 100 = **41%**

### profile_strength

**Purpose:** Qualitative assessment of profile completeness for recruiters.

**Mapping:**
- completion_score >= 80 → `'Strong'`
- completion_score >= 60 → `'Medium'`
- completion_score < 60 → `'Low'`

**Updated When:** After every career readiness save (recalculated immediately)

### employment_readiness_status

**Purpose:** Overall career readiness indicator combining completion and career readiness data.

**Mapping:**
- completion_score >= 75 → `'ready'`
- Otherwise → `'not_specified'` (default)
- Future: Can map to 'preparing', 'in_transition', etc., based on more sophisticated logic

**Updated When:** After every career readiness save (recalculated immediately)

### role_urgency_level

**Purpose:** Indicates how urgently a candidate needs/wants a new role.

**Mapping (from notice_period_days):**
- `0` → `'urgent_immediate'` (can join today)
- `1–14` → `'urgent_30days'` (can join within a month)
- `15–90` → `'active'` (needs 1–3 months notice)
- `> 90` OR `NULL` → `'passive'` (passive, exploring, or student)

**Example:**
```sql
-- Candidate who can join immediately
SELECT user_id, notice_period_days, role_urgency_level
FROM candidate_profiles
WHERE notice_period_days = 0;
-- Output: notice_period_days=0, role_urgency_level='urgent_immediate'

-- Candidate needing 2 weeks notice
SELECT user_id, notice_period_days, role_urgency_level
FROM candidate_profiles
WHERE notice_period_days = 14;
-- Output: notice_period_days=14, role_urgency_level='urgent_30days'
```

### availability_date

**Purpose:** Exact date when candidate can join.

**Calculation:**
```
availability_date = CURRENT_TIMESTAMP + INTERVAL '(notice_period_days) days'
```

**Example:**
- Today: 2026-05-20
- notice_period_days: 30
- availability_date: 2026-06-19

---

## Newly Added Fields & Storage

### Why These Fields Were Added

**Problem:** These 21 fields were collected during onboarding but never persisted to the database—they only lived in the JSONB `career_readiness_metadata`. This meant:
- ❌ Recruiter couldn't filter by `dominant_role` or `total_relevant_years`
- ❌ Display showed `portfolio_url = NULL` even though user entered it
- ❌ No direct SQL queries possible; must parse JSONB (slow, inflexible)

**Solution:** Create dedicated columns + persist during save + recalculate metrics.

### The 21 New Fields

| # | Field Name | Type | Column Name | Storage | Use Case |
|----|------------|------|-------------|---------|----------|
| 1 | portfolio_url | String | portfolio_url | TEXT | GitHub, portfolio website link |
| 2 | learning_links | Array | learning_links | JSONB | Udemy, Coursera course links |
| 3 | learning_interests | Array | learning_interests | TEXT[] | Skills candidate wants to learn |
| 4 | social_links | Dict | social_links | JSONB | Twitter, GitHub, LinkedIn handles |
| 5 | certifications | Array | certifications | TEXT[] | Professional certifications |
| 6 | projects | Array | projects | JSONB | Portfolio projects with descriptions |
| 7 | gpa_score | Float | gpa_score | NUMERIC(3,2) | Educational GPA |
| 8 | ai_extraction_confidence | Float | ai_extraction_confidence | NUMERIC(3,2) | Confidence of resume parsing |
| 9 | tech_sales_years | Integer | tech_sales_years | INTEGER | Years in tech sales specifically |
| 10 | tech_years | Integer | tech_years | INTEGER | Total tech/engineering years |
| 11 | sales_years | Integer | sales_years | INTEGER | Total sales/business dev years |
| 12 | total_relevant_years | Integer | total_relevant_years | INTEGER | Sum of relevant experience |
| 13 | role_frequency | Dict | role_frequency | JSONB | Job change frequency analysis |
| 14 | dominant_role | String | dominant_role | TEXT | Primary role (e.g., 'Sales Engineer') |
| 15 | primary_career_pattern | String | primary_career_pattern | TEXT | Pattern type (e.g., 'steady_progression') |
| 16 | notice_period_required_days | Integer | notice_period_required_days | INTEGER | Alias for notice_period_days |
| 17 | job_opportunity_type | Array | job_opportunity_type | TEXT[] | Employment types sought |
| 18 | between_role_detail | String | between_role_detail | VARCHAR | Reason for gap (existing, now populated) |
| 19 | between_role_note | String | between_role_note | TEXT | Additional gap context (existing, now populated) |
| 20 | current_company_name | String | current_company_name | TEXT | Current employer (existing, now populated) |
| 21 | employment_readiness_status | String | employment_readiness_status | VARCHAR | Derived: overall readiness status |

---

## Verification Queries

### Check What's Stored for a Candidate

```sql
SELECT
  user_id,
  full_name,
  current_employment_status,
  current_company_name,
  job_search_mode,
  notice_period_days,
  role_urgency_level,
  availability_date,
  completion_score,
  profile_strength,
  employment_readiness_status,
  portfolio_url,
  learning_interests,
  certifications,
  dominant_role,
  total_relevant_years,
  created_at,
  updated_at
FROM candidate_profiles
WHERE user_id = '12345678-1234-1234-1234-123456789012';
```

### Find Candidates Ready to Hire (Immediate Joiners, Active Search)

```sql
SELECT
  user_id,
  full_name,
  current_role,
  notice_period_days,
  role_urgency_level,
  job_search_mode,
  dominant_role,
  total_relevant_years,
  completion_score,
  profile_strength
FROM candidate_profiles
WHERE role_urgency_level = 'urgent_immediate'
  AND job_search_mode = 'active'
  AND profile_strength IN ('Medium', 'Strong')
ORDER BY completion_score DESC
LIMIT 20;
```

### Find Candidates with Specific Skills (Profile Filter)

```sql
SELECT
  user_id,
  full_name,
  dominant_role,
  total_relevant_years,
  certifications,
  learning_interests,
  portfolio_url,
  profile_strength
FROM candidate_profiles
WHERE 'AWS Solutions Architect' = ANY(certifications)
  AND (learning_interests && ARRAY['Kubernetes', 'Docker'])
  AND employment_readiness_status = 'ready'
ORDER BY total_relevant_years DESC;
```
**Note:** `&&` is PostgreSQL's ARRAY overlap operator.

### Verify Calculated Fields Are Correct

```sql
-- Check a few candidates' completion_score, profile_strength mapping
SELECT
  user_id,
  full_name,
  completion_score,
  profile_strength,
  CASE
    WHEN completion_score >= 80 THEN 'Strong'
    WHEN completion_score >= 60 THEN 'Medium'
    ELSE 'Low'
  END AS expected_strength,
  completion_score >= 80 AND profile_strength = 'Strong' AS correct_strong,
  completion_score >= 60 AND completion_score < 80 AND profile_strength = 'Medium' AS correct_medium,
  completion_score < 60 AND profile_strength = 'Low' AS correct_low
FROM candidate_profiles
ORDER BY updated_at DESC
LIMIT 10;
```

### List All Persisted Fields for a Candidate

```sql
SELECT
  'career_readiness' AS category,
  json_object_keys(
    json_build_object(
      'employment_status', current_employment_status,
      'current_company', current_company_name,
      'job_search_mode', job_search_mode,
      'notice_period', notice_period_days,
      'availability_date', availability_date::text,
      'role_urgency', role_urgency_level,
      'willing_to_relocate', willing_to_relocate,
      'contract_preference', contract_preference,
      'visa_needed', visa_sponsorship_needed,
      'target_market', target_market_segment,
      'expected_salary', expected_salary,
      'current_salary', current_salary
    )
  ) AS persisted_fields
FROM candidate_profiles
WHERE user_id = '12345678-1234-1234-1234-123456789012'
UNION ALL
SELECT
  'profile_data',
  json_object_keys(
    json_build_object(
      'portfolio_url', portfolio_url,
      'learning_links', learning_links::text,
      'learning_interests', array_to_json(learning_interests)::text,
      'social_links', social_links::text,
      'certifications', array_to_json(certifications)::text,
      'projects', projects::text,
      'gpa', gpa_score,
      'ai_confidence', ai_extraction_confidence
    )
  )
FROM candidate_profiles
WHERE user_id = '12345678-1234-1234-1234-123456789012'
UNION ALL
SELECT
  'experience_data',
  json_object_keys(
    json_build_object(
      'tech_sales_years', tech_sales_years,
      'tech_years', tech_years,
      'sales_years', sales_years,
      'total_relevant', total_relevant_years,
      'dominant_role', dominant_role,
      'career_pattern', primary_career_pattern,
      'role_frequency', role_frequency::text,
      'job_opportunity_type', array_to_json(job_opportunity_type)::text
    )
  )
FROM candidate_profiles
WHERE user_id = '12345678-1234-1234-1234-123456789012';
```

### Check career_readiness_metadata (JSONB) for Backwards Compatibility

```sql
SELECT
  user_id,
  full_name,
  career_readiness_metadata->>'exploration_trigger' AS exploration_trigger,
  career_readiness_metadata->>'salary_flexibility' AS salary_flexibility,
  career_readiness_metadata->>'between_role_detail' AS between_role_detail_jsonb,
  between_role_detail AS between_role_detail_column,
  career_readiness_metadata
FROM candidate_profiles
WHERE career_readiness_metadata IS NOT NULL
LIMIT 5;
```

---

## Summary of Changes

| Aspect | Before | After |
|--------|--------|-------|
| **Profile fields persisted** | ~10 primary fields | 30+ fields (21 new added) |
| **Portfolio, certifications storage** | JSONB only (hard to query) | Dedicated columns (direct SQL) |
| **profile_strength value** | Often "Low" (default, stale) | Recalculated from completion_score |
| **completion_score** | Rarely updated | Updated on every career readiness save |
| **Derived metrics** | Manual (error-prone) | Automatic (calculated in backend) |
| **Recruiter filtering** | Limited (job_search_mode only) | Rich (dominant_role, years, certifications, urgency, etc.) |
| **Data consistency** | JSONB & columns could diverge | Unified: metadata + dedicated columns |

---

## How to Use This Documentation

1. **Understanding the flow?** → Read [Architecture & Data Flow](#architecture--data-flow)
2. **Need to query data?** → See [Verification Queries](#verification-queries)
3. **Adding a new field?** → Add to schema, ORM model, and endpoint persistence logic; follow the pattern
4. **Troubleshooting NULL values?** → Check [Column Storage Details](#column-storage-details) and [Data Persistence Flow](#data-persistence-flow)
5. **Recruiter features?** → Refer to filter query examples in [Verification Queries](#verification-queries)

---

**End of Document**
