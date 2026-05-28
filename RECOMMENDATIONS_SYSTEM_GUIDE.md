# TechSalesAxis Recommendations System - Complete Guide

## Table of Contents
1. [System Overview](#system-overview)
2. [How Candidate Recommendations Work](#how-candidate-recommendations-work)
3. [How Recruiter Recommendations Work](#how-recruiter-recommendations-work)
4. [Scoring Algorithms](#scoring-algorithms)
5. [Data Models & Storage](#data-models--storage)
6. [API Endpoints](#api-endpoints)
7. [User Interfaces](#user-interfaces)
8. [System Flow](#system-flow)

---

## System Overview

The **TechSalesAxis Recommendations Engine** is a sophisticated matching system that connects candidates with job opportunities, companies, and recruiters. It works bidirectionally:

- **Candidate Perspective**: Personalized job and company recommendations
- **Recruiter Perspective**: AI-powered candidate recommendations for open positions

### Key Principles

1. **Intelligent Matching**: Multi-factor scoring algorithm considering skills, experience, location, culture fit, and more
2. **Bidirectional**: Both candidates and recruiters see recommendations tailored to their needs
3. **Persistent Storage**: Scores stored for analytics and historical tracking
4. **Dynamic Filtering**: Real-time recommendations based on profiles and filters
5. **AI-Enhanced**: Uses AI intelligence service for advanced matching and explanations

---

## How Candidate Recommendations Work

### 1. **Job Recommendations for Candidates**

#### Overview
Candidates receive personalized job recommendations based on their profile, skills, experience level, location preferences, and career interests.

#### Process Flow

```
1. Candidate visits "My Opportunities" → Jobs tab
   ↓
2. Frontend calls: GET /candidate/recommended-jobs
   ↓
3. Backend retrieves:
   - Candidate profile (skills, experience, location, interests)
   - All active jobs not previously applied to
   ↓
4. Recommendation Service calculates match scores for each job
   ↓
5. Jobs scored ≥ 50% minimum threshold returned
   ↓
6. Results stored in candidate_job_sync table
   ↓
7. Frontend displays with match score, reasoning, skills comparison
```

#### Filter Types Available

| Filter Type | Description | Algorithm Focus |
|---|---|---|
| **role_match** (Default) | Lateral moves or promotions based on current role | Experience level + Current role relevance |
| **skills_focus** | Leverage specialized skills for premium compensation | Technical skills match (higher weight) |
| **opportunity_explorer** | Discover unexpected opportunities via career path analysis | Career interests + Growth potential |

#### Example Request
```javascript
GET /candidate/recommended-jobs?filter_type=role_match&location=Bangalore&min_salary=15&max_salary=50

Response:
{
  "total": 24,
  "recommendations": [
    {
      "job_id": "uuid-123",
      "title": "Enterprise Sales Executive",
      "company_name": "TechCorp India",
      "salary_range": "20-30 LPA",
      "match_score": 87,
      "match_reasoning": "Strong match: 90% skills overlap, your level matches, location works well. Missing: CRM expertise",
      "skills_required": ["Enterprise Sales", "SaaS", "B2B"],
      "is_applied": false,
      "is_saved": false
    }
  ]
}
```

### 2. **Company/Recruiter Recommendations for Candidates**

#### Overview
Candidates discover companies and recruiters that are actively hiring for their profile.

#### Process Flow

```
1. Candidate visits "My Opportunities" → Companies tab
   ↓
2. Frontend calls: GET /candidate/recommended-companies
   ↓
3. Backend retrieves:
   - Candidate skills, experience, location, industry interests
   - All companies with active job postings
   ↓
4. Profile Matches Service calculates culture fit score
   ↓
5. Matches filtered by experience band, location, industry
   ↓
6. Top 10-20 recommendations returned
   ↓
7. Display company details + hiring intent signals
```

#### Filter Types Available

| Filter Type | Description | Focus |
|---|---|---|
| **culture_fit** (Default) | Companies aligned with values & work style | Industry alignment + Company values |
| **hiring_intent** | Companies actively hiring for the profile | Open positions + Skills match |
| **growth_hub** | High-growth companies with breakout opportunities | Company trajectory + Growth stage |

#### Culture Fit Scoring Components (100 points)

- **Industry Alignment** (30 pts): Does company industry match candidate's interests?
- **Company Size Fit** (20 pts): Does company size align with career stage?
- **Location Match** (20 pts): Remote/Hybrid/Onsite alignment
- **Company Growth** (15 pts): Growing companies offer more opportunities
- **Culture Factors** (15 pts): Values, mission, work environment

#### Example Request
```javascript
GET /candidate/recommended-companies?filter_type=culture_fit&location=Bangalore&industry=SaaS,Cloud

Response:
{
  "total": 42,
  "recommendations": [
    {
      "company_id": "uuid-456",
      "company_name": "CloudScale Ventures",
      "industry": "SaaS",
      "size": "Scale-up",
      "match_score": 92,
      "match_reasoning": "Perfect industry match (SaaS), great size fit for mid-level, actively hiring 5+ roles",
      "job_openings_count": 5,
      "strength_areas": ["Perfect industry match", "Great size fit"],
      "improvement_areas": []
    }
  ]
}
```

### 3. **Personalized Career Recommendations**

#### Overview
AI-powered next-step recommendations tailored to career stage.

#### Components

```javascript
{
  "immediate_actions": [
    "Study cloud platform basics",
    "Network with IT Sales professionals"
  ],
  "skill_development": {
    "Enterprise Deal Selling": [
      "Resource1: https://...",
      "Resource2: https://..."
    ],
    "Cloud Platform Knowledge": [
      "AWS Fundamentals: https://..."
    ]
  },
  "interview_prep_suggestions": [
    "Practice MEDDIC sales methodology",
    "Learn solution selling"
  ],
  "networking_advice": [
    "Join SalesLoft community",
    "Connect with Sales Engineers"
  ],
  "timeline_milestones": [
    "Week 1: Complete sales methodology course",
    "Week 4: Ready for interviews"
  ]
}
```

---

## How Recruiter Recommendations Work

### 1. **Candidate Discovery & Recommendations**

#### Overview
Recruiters discover top-matched candidates for their open positions using AI-powered matching.

#### Process Flow

```
1. Recruiter visits Intelligence → Recommendations
   ↓
2. Frontend calls: GET /recruiter/recommended-candidates
   ↓
3. Backend retrieves:
   - Recruiter's ICP (Ideal Customer Profile) from assessment
   - All verified candidates + shadow profiles
   - Recruiter's active jobs and required skills
   ↓
4. Filters applied:
   - Experience band (fresher, mid, senior, leadership)
   - Location
   - Salary budget
   - Career readiness status
   ↓
5. Three matching modes applied:
   a) Culture Fit Analysis
   b) Skill Match Analysis
   c) Profile Matching (Holistic AI)
   ↓
6. Candidates scored 0-100
   ↓
7. Grouped into tiers:
   - Elite: 85-100%
   - Strong: 70-84%
   - Potential: 50-69%
   ↓
8. Results displayed with match reasoning, skills, and action buttons
```

### 2. **Matching Modes**

#### Mode 1: Culture Fit (Default)
**Focus**: Behavioral + Recruiter ICP alignment + Skills

**Scoring Breakdown**:
- Recruiter ICP Alignment (40% weight)
- Technical Skills Match (30% weight)
- Experience Band Alignment (20% weight)
- Salary Alignment (10% weight)

**Use Case**: Finding long-term cultural fits

#### Mode 2: Skill Match
**Focus**: Technical expertise with heavy weighting

**Scoring Breakdown**:
- Technical Skills Match (60% weight)
- Experience Level (20% weight)
- Skills Depth (20% weight)

**Use Case**: Urgent hiring needs, technical roles

#### Mode 3: Profile Matching (Expert View)
**Focus**: Holistic master match synthesis

**Scoring Breakdown**:
- Candidate Behavioral DNA vs Recruiter ICP (40% weight)
- Technical Alignment (30% weight)
- Experience Band Match (15% weight)
- Profile Strength & Trust Signals (15% weight)

**Use Case**: Comprehensive talent analysis

### 3. **Data Access Control**

Recruiters can only view candidate personal info under these conditions:

```javascript
// Personal info unlocked if candidate:
const isPersonalInfoAccessible = 
  candidateHasApplied ||
  candidateIsShortlisted ||
  interviewIsScheduled ||
  offerMade ||
  hasRepliedToInvite;

// Otherwise show: A**** L****
```

### 4. **Recruiter Actions on Recommendations**

```
Recommended Candidate Card
├── View Profile
│   └── Opens CandidateProfileModal
│       ├── Resume tab
│       ├── Assessments tab
│       ├── Experience tab
│       └── Skills tab
│
├── Invite to Job
│   └── Opens JobInviteModal
│       ├── Select job
│       ├── Compose message
│       └── Send (creates JobInvite record)
│
└── Save for Later
    └── Updates candidate_job_sync status
```

---

## Scoring Algorithms

### A. Job Matching Score (Candidate → Jobs)

**Overall Score: 0-100 points**

#### Component Scores

**1. Skills Match (40 points max)**
- Calculates percentage overlap between candidate skills and job requirements
- Exact skill name matching (normalized, lowercase)
- Formula: (matching_skills / required_skills) × 40

Example:
```
Candidate skills: ["SaaS Sales", "Enterprise", "Negotiations"]
Job required: ["SaaS Sales", "Enterprise", "Negotiations", "CRM"]
Match: 3/4 = 75% × 40 = 30 points
Missing: ["CRM"]
```

**2. Experience Band Match (25 points max)**
```
Experience Levels: fresher → mid → senior → leadership

Scoring:
- Exact match: 1.0 (25 pts)
- One level diff: 0.6 (15 pts)
- Two+ levels: 0.0 (0 pts)

Example:
- Candidate: mid (2-4 years)
- Job: mid
- Score: 25 pts ✓
```

**3. Location Match (20 points max)**
```
Remote jobs: 1.0 (20 pts) - Always full match
Hybrid jobs: 0.7 (14 pts) - Partial match if different location
Onsite same: 1.0 (20 pts) - Full match
Onsite different: 0.0 (0 pts) - No match
```

**4. Salary Alignment (10 points max)**
```
Experience → Typical Salary Range (India LPA):
- fresher: 0-8 LPA
- mid: 8-25 LPA
- senior: 25-50 LPA
- leadership: 50-200 LPA

Scoring:
- Job salary overlaps with exp range: 1.0 (10 pts)
- Within 50% buffer: 1.0 (10 pts)
- Outside buffer: 0.3 (3 pts)
```

**5. Role Relevance (5 points max)**
```
Match candidate.career_interests against job.title
- Direct match in title: 1.0 (5 pts)
- Not related: 0.3 (1.5 pts)
- No interests stated: 0.5 (2.5 pts default)
```

#### Total Score Calculation
```
Total = (skills_score) + (experience_score) + (location_score) + (salary_score) + (role_score)
      = 40 + 25 + 20 + 10 + 5 = 100 points max
```

#### Quality Tiers
```
85-100: Strong match ✓✓✓
70-84:  Good match ✓✓
50-69:  Moderate match ✓
< 50:   Weak match ✗
```

### B. Culture Fit Score (Candidate → Companies)

**Overall Score: 0-100 points**

#### Component Scores

**1. Industry Alignment (30 points max)**
```
- Exact industry match: 30 pts
- Related/overlapping: 20 pts
- Different industry: 10 pts
- No industry data: 15 pts (default)
```

**2. Company Size Fit (20 points max)**
```
Experience Level vs Company Size Matrix:

Entry Level (0-1 yrs):
- Startup: 15 pts (best)
- Small: 20 pts (best)
- Medium: 10 pts
- Large: 5 pts

Mid Level (2-4 yrs):
- Startup: 10 pts
- Small: 15 pts
- Medium: 20 pts (best)
- Large: 15 pts

Senior (5-8 yrs):
- Startup: 15 pts
- Small: 20 pts (best)
- Medium: 15 pts
- Large: 20 pts (best)

Leadership (8+ yrs):
- Startup: 5 pts
- Small: 15 pts
- Medium: 20 pts (best)
- Large: 20 pts (best)
```

**3. Location Match (20 points max)**
```
- Same location: 20 pts
- Remote company: 20 pts
- Different location/onsite only: 5 pts
```

**4. Company Growth (15 points max)**
```
- High growth (30%+ YoY): 15 pts
- Moderate growth: 10 pts
- Stable: 8 pts
- Declining: 3 pts
```

**5. Culture Factors (15 points max)**
```
Based on available company data:
- Mission alignment: up to 5 pts
- Values alignment: up to 5 pts
- Work culture signals: up to 5 pts
```

---

## Data Models & Storage

### 1. CandidateJobSync Table

Stores job recommendations for candidates.

```sql
CREATE TABLE candidate_job_sync (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id UUID NOT NULL REFERENCES users(id),
  job_id UUID NOT NULL REFERENCES jobs(id),
  overall_match_score NUMERIC DEFAULT 0.0,
  match_explanation TEXT,
  missing_critical_skills TEXT[],
  created_at TIMESTAMP DEFAULT NOW()
);

-- Unique constraint: One record per candidate-job pair
UNIQUE(candidate_id, job_id)
```

**Use**: 
- Store top 10 job recommendations per candidate
- Avoid recalculating on each request
- Track which jobs recommended to which candidates

### 2. CandidateCompanySync Table

Stores company culture fit recommendations for candidates.

```sql
CREATE TABLE candidate_company_sync (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id UUID NOT NULL REFERENCES users(id),
  company_id UUID NOT NULL REFERENCES companies(id),
  overall_match_score NUMERIC DEFAULT 0.0,
  match_explanation TEXT,
  strength_areas TEXT[],
  improvement_areas TEXT[],
  created_at TIMESTAMP DEFAULT NOW()
);

-- Unique constraint: One record per candidate-company pair
UNIQUE(candidate_id, company_id)
```

**Use**:
- Store company recommendations
- Cache culture fit analysis
- Historical tracking of recommendations

### 3. RecruiterAssessmentResponse Table

Recruiter ICP (Ideal Customer Profile) assessment answers.

```sql
CREATE TABLE recruiter_assessment_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  category TEXT NOT NULL,
  question_text TEXT,
  answer_text TEXT,
  average_score INTEGER,
  relevance_score INTEGER,
  specificity_score INTEGER,
  clarity_score INTEGER,
  ownership_score INTEGER,
  evaluation_metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Use**:
- Store recruiter answers about their ideal candidates
- Used in culture fit scoring for recruiter matching
- Behavioral DNA analysis

### 4. ProfileAnalytics Table

Tracks profile views and interactions.

```sql
CREATE TABLE profile_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id UUID NOT NULL REFERENCES users(id),
  recruiter_id UUID NOT NULL REFERENCES users(id),
  event_type TEXT,  -- 'profile_view', 'application_sent', etc.
  job_id UUID REFERENCES jobs(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Use**:
- Track recruiter interest in candidates
- Measure recommendation effectiveness
- Privacy/data access audit trail

### 5. CandidateProfile Relevant Fields

```sql
ALTER TABLE candidate_profiles ADD COLUMN current_company_name TEXT;

Key fields for recommendations:
- full_name
- skills (TEXT array)
- experience (VARCHAR: fresher, mid, senior, leadership)
- years_of_experience (INTEGER)
- location (VARCHAR)
- career_interests (TEXT array)
- primary_industry_focus (VARCHAR)
- assessment_status (VARCHAR)
- is_shadow_profile (BOOLEAN)
```

---

## API Endpoints

### Candidate Endpoints

#### 1. Get Job Recommendations
```
GET /candidate/recommended-jobs
  ?filter_type=role_match|skills_focus|opportunity_explorer
  &location=string (optional)
  &min_salary=number (optional)
  &max_salary=number (optional)
  &limit=number (default: 10, max: 50)

Response:
{
  "total": 24,
  "recommendations": [
    {
      "job_id": "uuid",
      "title": "Enterprise Sales Executive",
      "company_name": "TechCorp",
      "salary_range": "20-30 LPA",
      "match_score": 87,
      "match_reasoning": "Strong match...",
      "skills_required": ["SaaS", "Enterprise"],
      "is_applied": false,
      "is_saved": false
    }
  ]
}
```

#### 2. Get Company Recommendations
```
GET /candidate/recommended-companies
  ?filter_type=culture_fit|hiring_intent|growth_hub
  &location=string (optional)
  &industry=string (optional)
  &company_size=string (optional)
  &limit=number (default: 10, max: 50)

Response:
{
  "total": 42,
  "recommendations": [
    {
      "company_id": "uuid",
      "company_name": "CloudScale",
      "industry": "SaaS",
      "match_score": 92,
      "job_openings_count": 5,
      "strength_areas": ["Perfect industry match"],
      "improvement_areas": []
    }
  ]
}
```

#### 3. Get Personalized Career Recommendations
```
POST /intelligence/recommendations/personalized
Body:
{
  "career_stage": "mid-level|senior|fresher"
}

Response:
{
  "immediate_actions": [string],
  "skill_development": {skill: [resources]},
  "interview_prep_suggestions": [string],
  "networking_advice": [string],
  "timeline_milestones": [string]
}
```

### Recruiter Endpoints

#### 1. Get Recommended Candidates
```
GET /recruiter/recommended-candidates
  ?filter_type=culture_fit|skill_match|profile_matching
  &location=string (optional)
  &experience_band=fresher|mid|senior|leadership (optional)
  &max_salary=number (optional)
  &skills=string (optional, comma-separated)
  &career_readiness=immediate|actively_looking|exploring|passive (optional)

Response:
[
  {
    "user_id": "uuid",
    "full_name": "John Doe",
    "current_role": "Sales Manager",
    "experience": "senior",
    "years_of_experience": 6,
    "culture_match_score": 87,
    "match_reasoning": "Strong behavioral fit...",
    "skills": ["Enterprise Sales", "SaaS"],
    "profile_photo_url": "...",
    "identity_verified": true
  }
]
```

#### 2. Sync Completion Score
```
GET /recruiter/profile/completion-score

Response:
{
  "has_score": true,
  "score": 75,
  "company_name": "TechCorp"
}
```

#### 3. Invite Candidate
```
POST /recruiter/candidate/{candidate_id}/invite
Body:
{
  "job_id": "uuid",
  "message": "We think you'd be great for...",
  "custom_role_title": "Senior Sales Executive" (optional)
}

Response:
{
  "status": "ok",
  "message": "Invitation sent to John Doe"
}
```

### Shared/Utility Endpoints

#### Get Job Recommendations (Alternative)
```
GET /recruiter/job-recommendations
  ?priority=skills|experience|location
  &location=string (optional)
  &min_salary=number (optional)

Response:
[
  {
    "job_id": "uuid",
    "job_title": "Enterprise Sales Executive",
    "company_id": "uuid",
    "location": "Bangalore",
    "match_score": 85,
    "reasoning": "Matches skills: SaaS, Enterprise..."
  }
]
```

---

## User Interfaces

### Candidate: My Opportunities Page

#### Layout
```
┌─────────────────────────────────────────────────────┐
│  My Opportunities                                   │
│  Explore jobs and companies matched to your profile │
│                                                     │
│  [Jobs for you]  [Companies hiring you]             │
└─────────────────────────────────────────────────────┘

LEFT SIDEBAR (320px, sticky):
  Filter Panel
  ├── Recommendation type (dropdown)
  ├── Location (text input)
  ├── Min Salary (number input)
  ├── Max Salary (number input)
  └── [Reset] [Apply Filters]

RIGHT CONTENT (fluid):
  Tab: JOBS
  ├── Job Card 1
  │   ├── Company Logo | Job Title
  │   ├── Company Name • Location
  │   ├── Experience Band | Salary Range
  │   ├── Match Score Badge (87%)
  │   ├── Skills Tags (top 2 + count)
  │   ├── Match Reasoning (truncated)
  │   └── [Save] [Apply]
  │
  ├── Job Card 2
  └── ...

  Tab: COMPANIES
  ├── Company Card 1
  │   ├── Company Logo
  │   ├── Company Name
  │   ├── Industry • Size • Location
  │   ├── Match Score (92%)
  │   ├── Open Positions Count
  │   ├── Match Reasoning
  │   └── [View Roles] [Follow]
  │
  └── ...
```

#### Filter Panel
- **Recommendation Type**: Radio buttons - Role Match, Skills Focus, Opportunity Explorer
- **Location**: Text input with autocomplete
- **Salary Range**: Two number inputs (min/max)
- **Reset Button**: Clears all filters
- **Apply Filters**: Triggers fetch with new params

#### Job Card Components
```
Card Structure:
┌─────────────────────────────────────┐
│ [Logo]  Title          [Match 87%]   │
│ Company • Location     [Saved]       │
│                                       │
│ Experience • Salary                   │
│                                       │
│ Match: 90% skills overlap, ...       │
│ Skills: [SaaS] [Enterprise] [+2]     │
│                                       │
│ [Save Job]    [Apply Now]             │
└─────────────────────────────────────┘
```

#### Match Score Colors
```
85-100%: Green badge - Strong match ✓✓✓
70-84%:  Blue badge - Good match ✓✓
50-69%:  Yellow badge - Moderate match ✓
< 50%:   Gray badge - Weak match ✗
```

### Recruiter: AI Recommendations Page

#### Layout
```
┌─────────────────────────────────────────────────────┐
│  AI Recommendations                                 │
│  Discover the best-matched candidates               │
└─────────────────────────────────────────────────────┘

LEFT SIDEBAR (30%, sticky):
  Filters Panel
  ├── Search Box
  ├── Focus (2 buttons)
  │   ├── [Fit First]
  │   └── [Skills First]
  ├── Experience (dropdown)
  ├── Location (text)
  ├── Budget (number)
  ├── Career Ready (dropdown)
  └── [Apply Filters]

RIGHT CONTENT (70%, scrollable):
  ├── 5 candidates found
  │
  ├── TOP MATCHES (Elite: 85-100%)
  │   ├── Recommended Card 1
  │   │   ├── Avatar | Name | [✓ Verified]
  │   │   ├── Role
  │   │   ├── [Fit 87%] Score Badge
  │   │   ├── Timeline: 6 years | Track: Senior
  │   │   ├── Fit Note: "Strong behavioral fit..."
  │   │   ├── Skills: [SaaS] [Enterprise] [+3]
  │   │   └── [Open Profile] [+ Invite]
  │   │
  │   ├── Recommended Card 2
  │   └── ...
  │
  ├── STRONG MATCHES (70-84%)
  │   └── [cards...]
  │
  └── MORE MATCHES (50-69%)
      └── [cards...]
```

#### Recommended Card Component
```
┌──────────────────────────────────────────┐
│ [Avatar]  Name [✓]                       │
│           Role                    [87%]  │
├──────────────────────────────────────────┤
│ Timeline: 6 years        Track: Senior   │
│                                          │
│ ┌──────────────────────────────────────┐ │
│ │ Fit Note                              │ │
│ │ "Strong behavioral fit, enterprise   │ │
│ │ sales experience matches perfectly"  │ │
│ └──────────────────────────────────────┘ │
│                                          │
│ Skills: [SaaS] [Enterprise] [+3]         │
│                                          │
│ [Open Profile]     [+ Invite] [Save]    │
└──────────────────────────────────────────┘
```

#### Actions on Card
1. **Open Profile**: Loads CandidateProfileModal with full details
2. **+ Invite**: Opens JobInviteModal to send job invitation
3. **Save**: Marks candidate for later review

---

## System Flow

### Complete Candidate Journey

```
START: Candidate completes profile
  │
  ├─→ Skills added
  ├─→ Experience level set
  ├─→ Location entered
  ├─→ Career interests selected
  ├─→ Assessment completed
  │
  └─→ Profile status: VERIFIED
      │
      ↓
  Recommendation Engine Triggers
      │
      ├─→ RecommendationService.get_job_recommendations()
      │   ├─→ Query active jobs not applied to
      │   ├─→ Calculate match score for each
      │   ├─→ Filter by min_score (50%)
      │   ├─→ Store top 10 in candidate_job_sync
      │   └─→ Return paginated results
      │
      ├─→ ProfileMatchesService.get_company_recommendations()
      │   ├─→ Query all companies
      │   ├─→ Calculate culture fit for each
      │   ├─→ Store matches in candidate_company_sync
      │   └─→ Return top results
      │
      └─→ AI Service.generate_personalized_recommendations()
          ├─→ Analyze career stage
          ├─→ Generate immediate actions
          ├─→ Create skill development plan
          └─→ Build interview prep guide

User Action: Visit "My Opportunities"
      │
      ├─→ Frontend: GET /candidate/recommended-jobs
      ├─→ Backend: Fetch from candidate_job_sync
      ├─→ Frontend displays with:
      │   ├─→ Match score
      │   ├─→ Why matched (reasoning)
      │   ├─→ Skills comparison
      │   └─→ [Save] [Apply] buttons
      │
      ├─→ User clicks "Apply"
      │   └─→ Creates JobApplication record
      │
      ├─→ User clicks "Save"
      │   └─→ Updates is_saved flag
      │
      └─→ Continue browsing or filter

END: Candidate applies to matched job
```

### Complete Recruiter Journey

```
START: Recruiter completes company setup
  │
  ├─→ Profile created
  ├─→ Assessment completed (ICP questions)
  ├─→ Jobs posted
  │
  └─→ Profile status: READY FOR MATCHING
      │
      ↓
  Matching System Ready
      │
      ├─→ Recruiter visits "AI Recommendations"
      ├─→ Selects filter mode (Culture Fit / Skill Match)
      ├─→ Applies filters (location, experience, salary)
      │
      ├─→ Frontend: GET /recruiter/recommended-candidates
      │   ├─→ Query candidate_profiles (verified + shadow)
      │   ├─→ Get recruiter ICP from assessment
      │   ├─→ Apply experience/location/salary filters
      │   ├─→ Calculate match scores using selected mode
      │   ├─→ Group into tiers (Elite/Strong/Potential)
      │   └─→ Return top 20-50 candidates
      │
      └─→ Frontend displays in tiers:
          │
          ├─→ TOP MATCHES (85-100%)
          │   └─→ [5-8 candidates with full details]
          │
          ├─→ STRONG MATCHES (70-84%)
          │   └─→ [8-12 candidates]
          │
          └─→ MORE MATCHES (50-69%)
              └─→ [5-10 candidates]

User Action: View Candidate
      │
      ├─→ Click "Open Profile"
      ├─→ POST /analytics/profile/{candidate_id}/view (tracking)
      ├─→ GET /recruiter/candidate/{candidate_id} (full details)
      ├─→ Modal opens with:
      │   ├─→ Resume section
      │   ├─→ Assessment responses
      │   ├─→ Experience timeline
      │   ├─→ Skills breakdown
      │   └─→ Match reasoning
      │
      └─→ Decision point:

User Action: Invite Candidate
      │
      ├─→ Click "+ Invite"
      ├─→ JobInviteModal opens
      ├─→ Select target job
      ├─→ Compose message
      ├─→ POST /recruiter/candidate/{id}/invite
      ├─→ Creates JobInvite record
      ├─→ Toast: "Invitation sent"
      │
      └─→ Candidate receives notification

END: Recruiter connects with matched candidate
```

### Scoring Calculation Timeline

```
Job Recommendation Calculation:

Candidate Profile:
  skills: ["SaaS", "Enterprise", "Negotiations"]
  experience: "mid" (4 years)
  location: "Bangalore"
  career_interests: ["Enterprise Sales"]
  years_of_experience: 4

Job 1: Enterprise Sales Executive
  title: "Enterprise Sales Executive"
  skills_required: ["SaaS", "Enterprise", "Negotiations", "CRM"]
  experience_band: "mid"
  location: "Bangalore"
  job_type: "onsite"
  salary_range: "20-30 LPA"

SCORING:
┌──────────────────────────────────────┐
│ 1. Skills Match                      │
│    Match: 3/4 = 75%                  │
│    Score: 75% × 40 = 30 pts          │
│    Missing: CRM                      │
├──────────────────────────────────────┤
│ 2. Experience Band                   │
│    Candidate: mid (4 years)          │
│    Job: mid                          │
│    Diff: 0 (exact match)             │
│    Score: 1.0 × 25 = 25 pts          │
├──────────────────────────────────────┤
│ 3. Location                          │
│    Same location (Bangalore)         │
│    Score: 1.0 × 20 = 20 pts          │
├──────────────────────────────────────┤
│ 4. Salary Alignment                  │
│    Exp Range: 8-25 LPA (mid level)   │
│    Job Range: 20-30 LPA              │
│    Overlap: YES                      │
│    Score: 1.0 × 10 = 10 pts          │
├──────────────────────────────────────┤
│ 5. Role Relevance                    │
│    Interest: "Enterprise Sales"      │
│    Title: "Enterprise Sales Exec"    │
│    Match: Direct                     │
│    Score: 1.0 × 5 = 5 pts            │
├──────────────────────────────────────┤
│ TOTAL: 30+25+20+10+5 = 90/100        │
│ TIER: Strong Match ✓✓✓               │
│ EXPLANATION: "Strong match: 90%      │
│  skills overlap, your level matches, │
│  location works well. Missing: CRM"  │
└──────────────────────────────────────┘
```

---

## Key Features & Highlights

### 1. **Intelligent Matching**
- Multi-factor scoring across 5+ dimensions
- Normalized comparisons (lowercase, trimmed)
- Fallback scoring for missing data

### 2. **Smart Tiering**
- Candidates grouped by match strength
- Clear visual hierarchy
- Actionable groupings

### 3. **Privacy & Permissions**
- Personal info access tied to application status
- Name blurring for non-connected candidates
- Audit trail in profile_analytics

### 4. **AI Integration**
- Personalized career recommendations
- Behavioral matching (Recruiter ICP)
- Reasoning explanations

### 5. **Performance**
- Cached scores in sync tables
- Pagination support
- Efficient filtering

### 6. **User Experience**
- Real-time search/filter
- Immediate visual feedback
- Clear match scoring explanations
- Action-oriented UI

---

## Error Handling & Edge Cases

### Candidate Scenarios
```
❌ No profile: "Complete your profile to get recommendations"
❌ No skills: Default score 50% (average)
❌ No matches: "No recommendations yet. Adjust filters."
✓ Applied to all: "You've applied to all matching jobs!"
✓ Saved > 10: "10+ More Jobs" button shows in dashboard
```

### Recruiter Scenarios
```
❌ No profile score: Locked view - "Upgrade to unlock recommendations"
❌ No candidates: "No candidates match your filters"
❌ No ICP set: Default culture fit scoring
✓ Invite sent: "Invitation sent to [Name]"
✓ Profile viewed: Tracked in profile_analytics
```

---

## Future Enhancements

1. **Learning Algorithm**: Improve scores based on application outcomes
2. **Skill Gap Analysis**: Detailed learning paths for missing skills
3. **Predictive Matching**: ML-based success prediction
4. **Real-time Sync**: WebSocket updates for new matches
5. **Batch Recommendations**: Scheduled email digests
6. **Community Insights**: Popular matches across platform
7. **Career Path Visualization**: Interactive career trajectory mapping

---

## Conclusion

The TechSalesAxis Recommendations Engine is a sophisticated, bidirectional matching system that:

- **For Candidates**: Discovers relevant jobs and companies tailored to their profile
- **For Recruiters**: Finds top-matched talent quickly and efficiently
- **For Platform**: Drives engagement and successful placements

The system balances **algorithmic precision** with **AI-powered insights**, creating a seamless experience for both job seekers and talent acquisition teams.
