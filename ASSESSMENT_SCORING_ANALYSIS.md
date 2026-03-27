# TALENTFLOW Assessment Scoring System - Complete Analysis

## Executive Summary

TALENTFLOW uses an **AI-driven assessment scoring system** that measures candidates across 5 dimensions on a **0-100 scale**. Scores are calculated using multi-dimensional AI grading (0-6 scale per dimension) that are normalized to 0-100, with category-specific breakdowns that vary by candidate seniority.

---

## 1. Score Structure Overview

### Core Metrics

| Metric | Scale | Purpose |
|--------|-------|---------|
| **final_score** | 0-100 | Overall assessment score (composite) |
| **resume_score** | 0-100 | Resume quality & consistency |
| **skills_score** | 0-100 | Technical depth (case studies) |
| **behavioral_score** | 0-100 | Soft skills (Resilience, Adaptability) |
| **psychometric_score** | 0-100 | Character drivers (Growth, Stability) |
| **reference_score** | 0-100 | Reference verification |
| **completion_score** | 0-100 | Profile field completeness (separate) |

### Database Model
**Location**: `apps/api/src/core/models.py` (Line 192-200)

```python
class ProfileScore(Base):
    __tablename__ = 'profile_scores'
    user_id = Column(UUID)                    # PK Foreign Key
    resume_score = Column(Integer)            # nullable int (0-100)
    behavioral_score = Column(Integer)        # nullable int (0-100)
    psychometric_score = Column(Integer)      # nullable int (0-100)
    skills_score = Column(Integer)            # nullable int (0-100)
    reference_score = Column(Integer)         # nullable int (0-100)
    final_score = Column(Integer)             # composite normalized score
    calculated_at = Column(DateTime)          # timestamp of calculation
```

---

## 2. How Final Scores Are Calculated

### Step 1: Response-Level Scoring (0-6 Scale)
Each answer is evaluated by Gemini 1.5 Flash on **4 independent dimensions**:

```
Relevance        (0-6)  → Does it address the question?
Specificity      (0-6)  → Are there concrete examples/data?
Clarity          (0-6)  → Is it well-organized/coherent?
Ownership        (0-6)  → Shows accountability & initiative?
```

**Average per response** = $(Dimension_1 + Dimension_2 + Dimension_3 + Dimension_4) / 4$

### Step 2: Category Scoring
Responses are grouped by category (resume, skill, behavioral, psychometric):

$$\text{category\_score} = \text{AVERAGE of all response scores in that category}$$

### Step 3: Normalization
Raw 0-6 scale converted to 0-100:

$$\text{normalized\_score} = \frac{\text{category\_sc ore}}{6} \times 100$$

**Example**: If average response score = 4.5/6
- Normalized = $(4.5 / 6) \times 100 = 75$

### Step 4: Final Score Aggregation
```python
# From assessment_service.py (submit_answer method)
all_responses = db.query(AssessmentResponse)\
    .filter(AssessmentResponse.candidate_id == user_id).all()

avg_score = sum(r.score for r in all_responses) / len(all_responses)

# Normalize to 0-100
profile_score.final_score = int((avg_score / 6) * 100)
```

**Final Score** = Unweighted average of all response scores (normalized)

### Step 5: Category Breakdown Update
When assessment completes, individual category scores are stored:

```python
category_scores = db.query(
    AssessmentResponse.category,
    func.avg(AssessmentResponse.score).label('avg_score')
).filter(
    AssessmentResponse.candidate_id == user_id
).group_by(AssessmentResponse.category).all()

category_score_map = {
    "resume": "resume_score",
    "skill": "skills_score",
    "behavioral": "behavioral_score",
    "psychometric": "psychometric_score"
}

for category, avg_score_val in category_scores:
    score_field = category_score_map.get(category)
    if score_field:
        setattr(profile_score, score_field, int(avg_score_val))
```

---

## 3. Category Weight Distribution (Seniority-Based)

The assessment scales questions (8-16) and adjusts category distribution by experience:

| Category | Fresher | Mid-Level | Senior | Leadership |
|:---------|:--------|:----------|:-------|:-----------|
| **Resume AI Deep Dive** | 20% (1.6 Qs) | 20% (2 Qs) | 20% (2.6 Qs) | 25% (4 Qs) |
| **Skill Case Study** | 10% (0.8 Qs) | 20% (2 Qs) | 30% (3.9 Qs) | 35% (5.6 Qs) |
| **Behavioral (Seeded)** | 35% (2.8 Qs) | 30% (3 Qs) | 25% (3.25 Qs) | 20% (3.2 Qs) |
| **Psychometric (Seeded)** | 35% (2.8 Qs) | 30% (3 Qs) | 25% (3.25 Qs) | 20% (3.2 Qs) |
| **Total Questions** | **8** | **10** | **13** | **16** |

**Key Point**: These are not weighted multipliers for scoring—they determine question distribution. Final score is the average of all responses regardless of category.

---

## 4. Score Ranges & Interpretation

### Score Bands (Based on Source Code & Frontend)

| Range | Label | Recruiter Signal | Candidate Display | Trust Status |
|:------|:------|:-----------------|:------------------|:-------------|
| **90-100** | Perfect | Exceptional | ⭐ Top | ✅ Very High Trust |
| **80-89** | Excellent | High Quality | ⭐ Top | ✅ High Trust |
| **70-79** | Good | Competent | 📈 Strong | ✅ Trusted |
| **60-69** | Acceptable | Baseline Match | 🔹 Growing | ⚠️ Baseline |
| **40-59** | Developing | Questionable | 🔹 Growing | ⚠️ Low Concern |
| **0-39** | Poor | Disqualifying | ❌ Blocked | 🚫 Very Low Trust |

### Critical Thresholds

```python
# From recruiter.py & recruiter_service.py

# Skill Match Filter (minimum baseline)
is_skill_match = bool(score and (score.final_score or 0) >= 60)

# High-Trust Bonus in Recommendations
if (candidate.final_profile_score or 0) > 80:
    base_score += 5
    reasoning = "Verified High-Trust candidate"

# Candidate Dashboard Tier
tier = "Top" if score >= 85 \
       else "Strong" if score >= 70 \
       else "Growing"

# Low Trust Flag (from scoring-logic.md)
if score < 40:
    flag = "Low Trust"
    # May limit platform features
```

### Dashboard Display Logic
[dashboard/candidate/page.tsx - Line 206-215]

```typescript
const tier = (stats.profile_score ?? 0) >= 85
  ? "Top"
  : (stats.profile_score ?? 0) >= 70
    ? "Strong"
    : "Growing";

// Trending comparison
"Your profile is trending higher than {score}% of candidates"
```

---

## 5. Category Breakdown Details

### Resume Score (0-100)
**Components Evaluated**:
- Experience timeline consistency
- Career gap explanations
- Achievement specificity
- Role-to-role progression logic
- Skills-resume alignment

**Questions Asked**: "Explain your role transition...", "Describe your biggest achievement...", "Address the gap in your CV from..."

**Scoring**: Average of all resume-category responses

### Skills Score (0-100)
**Components Evaluated**:
- Technical depth
- Practical problem-solving
- Decision justification
- Real-world example usage
- Framework/tool knowledge

**Questions Asked**: Scenario-based (e.g., "Your system is slow. What would you investigate first?")

**Scoring**: Average of "skill" category responses, weighted heavily for senior roles (30-35%)

### Behavioral Score (0-100)
**Components Evaluated**:
- Resilience in adversity
- Communication effectiveness
- Teamwork & collaboration
- Adaptability to change
- Emotional stability
- Leadership potential

**Questions**: Seeded from bank of 800+ validated prompts

**Scoring**: Average across behavioral responses (35% for freshers, 20% for leadership)

### Psychometric Score (0-100)
**Components Evaluated**:
- Growth mindset
- Ambition level
- Emotional intelligence
- Risk tolerance
- Cultural fit indicators
- Learning agility

**Questions**: Seeded from validated psychometric bank

**Scoring**: Average of psychometric responses, weighted per seniority

### Reference Score (0-100)
- Verification of stated achievements
- Background check alignment
- Claims validation
- Reference feedback (if collected)

---

## 6. What Constitutes "Good" vs "Excellent"

### Good Score (70-79)
✅ **Recruiter Perspective**:
- Meets baseline requirements
- Acceptable skill match
- Shows competence
- Suitable for role consideration

✅ **Candidate Perspective**:
- "Strong" tier ranking
- Good profile visibility
- Trending well
- Ready for opportunities

**Implies**: Solid fundamentals, consistent experience, adequate communication

### Excellent Score (80-99)
✅ **Recruiter Perspective**:
- High quality talent
- +5 bonus points in match scoring
- "High-Trust" status
- Top priority for review
- Can bypass some filters

✅ **Candidate Perspective**:
- "Top" tier ranking
- Maximum profile visibility
- Outperforming peers
- Premium opportunities only
- Featured in recommendations

**Implies**: 
- Exceptional clarity & depth
- Strong ownership/accountability
- Excellent examples & specificity
- High resilience/adaptability
- Future-ready skillset

---

## 7. API Endpoints for Viewing Assessment Results

### Candidate Endpoints

#### 1. **GET /candidate/dashboard**
**Returns**: Full candidate stats including assessment results

```json
{
  "profile_score": 82,
  "completion_score": 85,
  "assessment_status": "completed",
  "assessment_results": {
    "overall_score": 82,
    "component_scores": {
      "resume": 78,
      "skill": 85,
      "behavioral": 80,
      "psychometric": 85,
      "reference": null
    },
    "status": "completed",
    "completed_at": "2026-03-20T14:32:00Z"
  }
}
```

**Location**: `apps/web/src/app/dashboard/candidate/page.tsx`

#### 2. **GET /assessment/next**
**Returns**: Session status + current question (or "completed" status)

```json
{
  "status": "completed",
  "current_step": 10,
  "total_budget": 10
}
```

### Recruiter Endpoints

#### 1. **GET /recruiter/applications/pipeline**
**Returns**: Candidate list with scores for an open job

```json
[
  {
    "candidate_id": "uuid",
    "full_name": "Jane Doe",
    "profile_scores": {
      "final_score": 82
    },
    "is_skill_match": true,
    "match_reasoning": "Strong technical depth | Excellent communication"
  }
]
```

**Location**: `apps/api/src/api/recruiter.py` (Line 534-545)

**Logic**:
```python
score = db.query(ProfileScore).filter(
    ProfileScore.user_id == app.candidate_id
).first()

is_skill_match = bool(score and (score.final_score or 0) >= 60)
```

#### 2. **GET /recruiter/candidates/{candidate_id}**
**Returns**: Detailed candidate profile with full assessment breakdown

```json
{
  "user_id": "uuid",
  "full_name": "Jane Doe",
  "resume": { /* resume data */ },
  "profile_scores": {
    "final_score": 82,
    "resume_score": 78,
    "skills_score": 85,
    "behavioral_score": 80,
    "psychometric_score": 85,
    "reference_score": null
  }
}
```

**Location**: `apps/api/src/api/recruiter.py` (Line 703-730)

#### 3. **GET /recruiter/recommended-candidates**
**Returns**: AI-powered recommendations with match scores

Logic: Matches on Skills (60%), Experience (20%), Salary (10%), Location (10%)

```python
# From recruiter_service.py
if (candidate.final_profile_score or 0) > 80:
    base_score += 5
    reasoning.append("Verified High-Trust candidate")
```

---

## 8. Frontend Components for Results Display

### Candidate Dashboard Assessment Section
**Location**: `apps/web/src/app/dashboard/candidate/page.tsx`

#### Main Score Display
- **Large circular progress**: Shows final_score/100 with animated gradient
- **Tier label**: "Top", "Strong", or "Growing" based on thresholds
- **Position statement**: "Your profile is trending higher than X% of candidates"

#### Component Breakdown Cards
5-column grid showing:
1. **Work Style** (behavioral_score)
2. **Skills & Expertise** (skills_score)
3. **Personality & Fit** (psychometric_score)
4. **Resume Quality** (resume_score)
5. **Verification & References** (reference_score)

Each with:
- Icon representation
- Numeric score (0-100)
- Visual progress bar
- Color coding (grayscale in responsive mode)

#### Status Indicators
- ✅ "Verification Pending" banner if identity not verified
- 🔵 "Live Results" tag
- 📈 Trending comparison

### Assessment Results Section
- Header with "Assessment Results" + Target icon
- Subtitle: "Your scores across key areas" + "Live Results" badge
- Grid layout with responsive design (2 cols mobile, 3 cols tablet, 5 cols desktop)

---

## 9. Scoring Practices & Anti-Cheat

### Question Generation
- **Resume questions**: Dynamically generated by Gemini based on parsed CV
- **Skill questions**: Generated from self-reported skills
- **Behavioral/Psychometric**: Randomly selected from seeded question bank

### AI Auditor Guardrails
```python
# From assessment_service.py (submit_answer method)

evaluation_prompt = """
Grade this response on:
- Clarity: Coherence and organization (0-6)
- Relevance: Addresses the question (0-6)
- Specificity: Concrete examples/data (0-6)
- Ownership: Accountability shown (0-6)

Score Ranges (Lenient):
- 80-100: Clear structure, good depth, addresses well
- 60-79: Reasonable structure, adequate depth
- 40-59: Minimal structure, some depth, partial address
- 20-39: Poor structure, limited detail
- 0-19: Insufficient or irrelevant
"""

# Neutrality Rules:
# - No grammar penalties
# - Logic > Linguistics
# - Brief logical answers > Long flowery ones
```

### Anti-Cheat Enforcement
- **Copy-paste**: Disabled during assessment
- **Tab switching**: 1st = warning, 2nd = permanent block
- **Time limits**: 60-second timer per question
- **Session state**: Tracks visibility & focus
- **Max attempts**: 2-strike rule enforced at user level

---

## 10. Score Persistence & Improvement

### Best Score Wins (MAX Logic)
```python
# From scoring-logic.md

# On retake:
final_score = MAX(new_score, existing_score)

# Example:
# First attempt: 72
# Second attempt: 78
# Stored score: 78

# Reverse scenario:
# First attempt: 85
# Second attempt: 80
# Stored score: 85 (not updated to lower)
```

**Implementation** (Implied in design):
- `AssessmentSession.overall_score` stores each attempt
- `ProfileScore.final_score` only updates if higher
- `CandidateProfile.assessment_status` = "completed"

### Immutability After Completion
- Once session marked `completed`, responses locked for auditing
- Raw answers stored verbatim for human review
- Score cannot degrade over time
- Auditors can examine AI decisions

---

## 11. Feedback & Recommendation Systems

### Current Implementation
✅ **Exists**:
- Score aggregation per component
- Category-level breakdown
- Recruiter match reasoning (skills, experience, culture)
- Recommendation caching system

❌ **Not Yet Implemented**:
- Personalized improvement suggestions per category
- Specific coaching on weaknesses
- Comparative benchmarking messages
- Time-boxed retake guidance
- "Gap analysis" reports

### Recommendation Engine
**Location**: `apps/api/src/services/recruiter_service.py` (get_recommended_candidates)

**Scoring Logic**:
```python
base_score = 0

# A. Skill Matching (60%)
base_score += skill_match_percentage * 0.6

# B. Experience Alignment (20%)
if candidate_years >= role_requirement:
    base_score += 20

# C. Salary Alignment (10%)
if candidate_salary <= role_budget:
    base_score += 10

# D. Assessment Bonus (5% if score > 80)
if (candidate.final_profile_score or 0) > 80:
    base_score += 5
    match_reasoning += "Verified High-Trust candidate"

# E. Location Preference (5%)
if candidate_location in role_locations:
    base_score += 5

# Final
match_score = min(99, base_score)
```

---

## 12. Technical Implementation Summary

### Assessment Flow
```
1. Candidate takes assessment (8-16 questions based on seniority)
   ↓
2. Each response scored 0-6 on 4 dimensions by Gemini
   ↓
3. Responses stored in AssessmentResponse table
   ↓
4. On completion (current_step >= total_budget):
   - Calculate category averages
   - Normalize to 0-100 (divide by 6, multiply by 100)
   - Update ProfileScore table with category + final scores
   - Update CandidateProfile.assessment_status = "completed"
   - Update CandidateProfile.final_profile_score = int(avg)
   ↓
5. Frontend displays:
   - Profile score circle (animated)
   - Tier rank ("Top"/"Strong"/"Growing")
   - Component breakdown cards
   - Trending comparison
   ↓
6. Recruiters access via:
   - /recruiter/applications/pipeline (live)
   - /recruiter/candidates/{id} (detailed)
   - /recruiter/recommended-candidates (AI match)
```

### Relevant Database Tables
- `profile_scores`: Final computed scores
- `assessment_sessions`: Session state tracking
- `assessment_responses`: Individual answer records
- `candidate_profiles`: Candidate master + assessment_status flag
- `resume_data`: Parsed resume for dynamic questions

---

## 13. Recommendations for Implementation

### Short Term (Immediate)
1. ✅ Current implementation is solid for score calculation
2. Add feedback message templates per score range:
   - 90+: "Exceptional performance - ready for advanced roles"
   - 80-89: "Strong candidate - clear strengths shown"
   - etc.

### Medium Term (Phased)
1. Implement category-specific improvement suggestions
2. Add comparative percentile messaging
3. Create "retake advantage" guidance

### Long Term (Strategic)
1. Predictive career path recommendations based on pattern
2. Skill gap analysis with upskilling suggestions
3. Peer benchmarking dashboard
4. Historical score tracking with trend analysis

---

## 14. Key Files for Reference

| Purpose | File Location | Key Classes/Functions |
|---------|---------------|----------------------|
| **Score Model** | `apps/api/src/core/models.py:192` | `ProfileScore` class |
| **Score Calculation** | `apps/api/src/services/assessment_service.py:577-625` | `submit_answer()` method |
| **Scoring Logic Docs** | Root: `PROJECT_DOCUMENTATION.md` etc. | Scoring formulas & thresholds |
| **Frontend Display** | `apps/web/src/app/dashboard/candidate/page.tsx` | Component breakdown, tier logic |
| **Recruiter API** | `apps/api/src/api/recruiter.py:534-730` | Pipeline & candidate endpoints |
| **Recommendations** | `apps/api/src/services/recruiter_service.py:532-640` | Match scoring algorithm |
| **Candidate Stats** | `apps/web/src/app/dashboard/candidate/page.tsx:23-35` | TypeScript interfaces |

---

## Appendix: Score Calculation Examples

### Example 1: Fresher (Mid-scoring)
```
Assessment: 8 questions
Responses:
  Resume Q1: 3.5/6 → Avg = 3.5
  Skill Q1: 2.5/6 → Avg = 2.5
  Behavioral Q1-2: 3.0, 3.2 → Avg = 3.1
  Psychometric Q1-3: 2.8, 3.5, 3.2 → Avg = 3.17

Category Scores:
  Resume: (3.5/6)*100 = 58
  Skills: (2.5/6)*100 = 42
  Behavioral: (3.1/6)*100 = 52
  Psychometric: (3.17/6)*100 = 53

Final Score:
  avg_all = (3.5+2.5+3.1+3.17)/4 = 3.07
  final = (3.07/6)*100 = 51 → "Growing" tier
```

### Example 2: Senior (High-scoring)
```
Assessment: 13 questions
Average across all responses: 5.1/6

Category Scores:
  Resume: (5.0/6)*100 = 83
  Skills: (5.3/6)*100 = 88
  Behavioral: (5.0/6)*100 = 83
  Psychometric: (5.2/6)*100 = 87

Final Score:
  avg_all = 5.1
  final = (5.1/6)*100 = 85 → "Top" tier → +5 bonus for recruiters
```

---

**Document Generated**: March 2026
**Analysis Based On**: Codebase review of apps/api, apps/web, and implementation docs
**Version**: 1.0
