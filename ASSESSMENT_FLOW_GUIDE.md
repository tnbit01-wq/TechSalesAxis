# Assessment Flow - Complete Guide

**Version:** 1.0  
**Last Updated:** April 2, 2026  
**Audience:** Candidates, Recruiters, Developers

---

## 📋 Table of Contents

1. [Assessment System Overview](#assessment-system-overview)
2. [Candidate Assessment Flow](#candidate-assessment-flow)
3. [Recruiter Assessment Flow](#recruiter-assessment-flow)
4. [Assessment Types & Levels](#assessment-types--levels)
5. [Scoring Algorithm](#scoring-algorithm)
6. [Candidate Scoring Guidance](#candidate-scoring-guidance)
7. [Anti-Cheat Mechanisms](#anti-cheat-mechanisms)
8. [Technical Implementation](#technical-implementation)
9. [Database Schema](#database-schema)
10. [API Reference](#api-reference)

---

## 🎯 Assessment System Overview

### Purpose
TalentFlow's assessment system is designed to:
1. **Verify Skills** - Objectively test candidate technical abilities
2. **Generate Trust** - Build candidate trust scores on platform
3. **Power Matching** - Assessment scores improve job recommendations
4. **Prevent Fraud** - Anti-cheat enforcement ensures validity

### Assessment Stats
- **Levels:** 4 (FRESHER, MID, SENIOR, LEADERSHIP)
- **Question Count:** 6-16 per assessment (adaptive, not fixed)
- **Scoring:** AI-powered (Gemini + Groq fallback)
- **Duration:** 15-45 minutes
- **Re-attempts:** Allowed after 30 days
- **Anti-Cheat:** Tab-switch detection (ban at 3+ violations)

---

## 👤 Candidate Assessment Flow

### Stage 1: Assessment Initiation

#### User Entry Points
1. **Dashboard:** "Take Your Assessment" button
2. **Onboarding:** Required during profile setup
3. **Trust Score:** "Improve your score by taking assessment"
4. **Job Application:** Optional "Increase match with assessment"

#### Level Selection
```
System determines level based on:
  1. Candidate's experience (auto-detect):
     - 0-1 years → FRESHER
     - 1-5 years → MID
     - 5+ years → SENIOR
     - 3+ in leadership role → LEADERSHIP
  
  2. Candidate can override and choose different level:
     "I want to assess myself at MID level instead"
```

#### Assessment Start Flow
```
Click "Take Assessment"
  ↓
Choose level (or accept recommendation)
  ↓
Review instructions:
  "This assessment evaluates your technical skills through
   a series of questions. You will have 30 minutes.
   Answers are evaluated by AI. Do not switch tabs!"
  ↓
Click "Accept Terms" checkbox:
  ☑ "I understand the anti-cheat policy"
  ☑ "I will not switch tabs"
  ↓
Click "Start Assessment"
  ↓
Pre-assessment check:
  - User must not have ongoing assessment
  - User must not have taken same level in last 30 days
  ↓
Timer starts: 30 minutes
```

### Stage 2: Question Serving & Answering

#### Question Types

**1. Multiple Choice (MCQ)**
```
Question: "Which design pattern improves code reusability?"

A) Singleton Pattern
B) Factory Pattern
C) Observer Pattern
D) All of the above

[Select Answer] [Next]
```

**2. Coding Problem**
```
Question: "Write a function to reverse a string without using built-in functions"

Language: [Python ▼]

def reverse_string(s):
    # Your code here
    pass

[Run Tests] [Submit] [Next]
```

**3. Short Answer**
```
Question: "Explain the difference between async and await in JavaScript"

[Text Area:
_________________________________________________
_________________________________________________]

[Submit] [Next]
```

#### Adaptive Difficulty Algorithm

```
ALGORITHM adaptive_difficulty(score_so_far, questions_answered)

IF questions_answered < 6:
    Return RANDOM_QUESTION (always start with random)
    
ELSE IF score_so_far >= 80:
    Return HARD_QUESTION (only if doing well)
    
ELSE IF score_so_far <= 40:
    Return EASY_QUESTION
    
ELSE:
    Return MEDIUM_QUESTION

IF questions_answered >= 16:
    END_ASSESSMENT
ELIF questions_answered >= 6 AND score_stable:
    END_ASSESSMENT (if confident)
ELSE:
    Continue
```

#### Example Assessment Journey

```
Question 1 (MEDIUM): Multi-choice about Design Patterns
User answers: CORRECT → Score: 100/100
↓
Question 2 (MEDIUM→HARD): Coding problem
User answers: CORRECT → Score: 100/100
↓
Question 3 (HARD): Advanced system design
User answers: INCORRECT → Score: 66/100
↓
Question 4 (HARD→MEDIUM): Back to medium difficulty
User answers: CORRECT → Score: 75/100
↓
Question 5 (MEDIUM): Moderate question
User answers: CORRECT → Score: 80/100
↓
[Continue until 16 questions or score stabilizes]
↓
Final Score: 78/100
```

### Stage 3: AI Evaluation

#### Evaluation Process for Each Answer

```
1. ANSWER SUBMISSION
   Candidate clicks "Submit"
   ↓

2. BACKEND RECEIVES ANSWER
   Backend service gets:
   - question_id
   - candidate_answer
   - time_spent
   
   3. AI EVALUATION (Gemini API)
   ↓
   Prompt to Gemini:
   "Question: {question_text}
    Correct Answer: {correct_answer}
    Candidate's Answer: {candidate_answer}
    Please score this 0-100 and explain"
   
   ↓
   
   4. SCORE CALCULATION
   Gemini returns: {score: 85, explanation: "..."}
   
   ↓
   
   5. STORE IN DATABASE
   INSERT INTO assessment_responses
   (assessment_id, question_id, candidate_answer, 
    ai_score, evaluation_reason, answered_at)
   
   ↓
   
   6. DIFFICULTY ADJUSTMENT
   Calculate running_score
   Determine next question difficulty
   
   ↓
   
   7. SEND NEXT QUESTION
   Return next question to frontend
```

### Stage 4: Assessment Completion

#### Completion Triggers
```
COMPLETED WHEN:
  1. Questions_submitted >= 16, OR
  2. Questions_submitted >= 6 AND score variance < 5 points over last 3 Qs, OR
  3. Timer reached 30 minutes (auto-submit)
```

#### Result Calculation

```
FINAL_SCORE = AVG(all_question_scores)

TRUST_SCORE_COMPONENT = 40 points (max)
  = (final_score / 100) * 40
  
Example:
  final_score: 78
  trust_component: (78/100) * 40 = 31.2 points
```

#### Results Display

```
┌─────────────────────────────────────┐
│ 🎉 Assessment Complete!             │
├─────────────────────────────────────┤
│ Your Score: 78/100                  │
│ Level: MID                          │
│ Questions Answered: 12              │
│ Time Spent: 23 minutes              │
│                                     │
│ Performance: ⭐⭐⭐⭐☆ (4/5)      │
│                                     │
│ Breakdown:                          │
│ • Technical Knowledge: 80/100       │
│ • Problem Solving: 75/100          │
│ • Code Quality: 78/100             │
│                                     │
│ Strengths:                          │
│ ✓ Strong in OOP concepts           │
│ ✓ Good problem decomposition       │
│                                     │
│ Areas to Improve:                   │
│ • Performance optimization         │
│ • Advanced design patterns         │
│                                     │
│ Impact on Trust Score:              │
│ Previous: 65/100                    │
│ Current:  73/100 (+8 points)      │
│ 📈 Great improvement!              │
│                                     │
│ [Download Report] [View Insights]  │
│ [Share with Recruiters]            │
└─────────────────────────────────────┘
```

#### Generated PDF Report
The system auto-generates a professional PDF report containing:
- Assessment details (level, date, score)
- Question-by-question breakdown
- Strengths identified
- Recommended learning areas
- Score certification (valid for 6 months)

### Stage 5: Post-Assessment

#### Immediate Actions
1. **Trust Score Updated**
   - Previous: 65
   - New: 73 (assessment gave +8 points)
   
2. **Recommendations Recalculated**
   - AI re-scores all recommendations
   - New jobs might appear
   - Match percentages may increase
   
3. **Certificate Generated**
   - Certificate valid: 6 months
   - Can be shared with recruiters

#### Re-attempt Policy
```
RETAKE_ALLOWED IF:
  - last_assessment_date < NOW - 30_days
  - same_level (FRESHER, MID, SENIOR, LEADERSHIP)

RETAKE_BLOCKED IF:
  - Attempt made in last 30 days
  - Different level can be attempted immediately
  
EXAMPLE:
  Took FRESHER level on Apr 1
  Can't retake FRESHER until May 1
  CAN take MID level on Apr 2 if desired
```

---

## 👨💼 Recruiter Assessment Flow

### Recruiter-Generated Assessments

Recruiters can create custom assessments for candidates after shortlisting.

#### Custom Assessment Features
- **Question Types:** Limited to MCQ initially
- **Duration:** 15-60 minutes
- **Topic:** Job-specific (Python, React, etc.)
- **Custom Scoring:** Recruiter can set pass/fail threshold
- **Distribution:** Send to multiple candidates

#### Recruiter Custom Assessment Flow

```
1. ASSESSMENT CREATION
   Recruiter creates assessment:
   - Title: "Senior Python Developer Assessment"
   - Description: "FastAPI + PostgreSQL focus"
   - Duration: 30 minutes
   - Pass threshold: 70%
   - Questions: 10
   ↓

2. QUESTION BUILDING
   Add questions:
   Q1: "What is WSGI in Python?" → Add answers
   Q2: "Async/await difference?" → Add answers
   Q3: "PostgreSQL transaction?" → Add answers
   ...
   ↓

3. CANDIDATE ASSIGNMENT
   Select candidates: Candidate A, B, C
   ↓
   Send invitation to each
   Candidates receive notification:
   "XYZ Company sent you an assessment"
   ↓

4. CANDIDATE TAKES ASSESSMENT
   Candidate clicks link
   Takes assessment
   Answers submitted
   ↓

5. AUTO-SCORING
   Each answer scored by recruiter's rules
   (or can be manually scored)
   ↓

6. RESULTS TO RECRUITER
   Recruiter sees scores
   - Candidate A: 85% (PASS)
   - Candidate B: 65% (FAIL)
   - Candidate C: 78% (PASS)
```

### Recruiter Assessment Questions API

```
POST /recruiter/assessments - Create assessment
POST /recruiter/assessments/{id}/questions - Add question
POST /recruiter/assessments/{id}/send - Send to candidates
GET /recruiter/assessments/{id}/results - View results
PUT /recruiter/assessments/{id}/score - Manual scoring
```

---

## 📊 Assessment Types & Levels

### 1. FRESHER Level
**Target:** 0-1 years of experience

**Topics:**
- Programming fundamentals
- Data structures basics
- OOP concepts
- Simple problem solving

**Question Count:** 8-12  
**Average Duration:** 20 minutes  
**Difficulty:** ⭐⭐ (Easy-Medium)

**Example Questions:**
- "What is inheritance in OOP?"
- "Write a function to find even numbers"
- "Difference between list and array?"

### 2. MID Level
**Target:** 1-5 years of experience

**Topics:**
- Design patterns
- System design basics
- Performance optimization
- Advanced OOP
- Testing strategies

**Question Count:** 10-14  
**Average Duration:** 25 minutes  
**Difficulty:** ⭐⭐⭐ (Medium)

**Example Questions:**
- "Explain MVC architecture"
- "Design a URL shortener system"
- "How to optimize N+1 queries?"

### 3. SENIOR Level
**Target:** 5+ years of experience

**Topics:**
- System architecture
- Scalability patterns
- Advanced algorithms
- Performance tuning
- Team leadership (soft)

**Question Count:** 12-16  
**Average Duration:** 35 minutes  
**Difficulty:** ⭐⭐⭐⭐ (Hard)

**Example Questions:**
- "Design a distributed cache system"
- "How to handle 1M concurrent users?"
- "Microservices vs monolith trade-offs?"

### 4. LEADERSHIP Level
**Target:** 3+ years in leadership role

**Topics:**
- Team management
- Strategic thinking
- Stakeholder management
- Technical decision-making
- Organizational growth

**Question Count:** 6-10  
**Average Duration:** 20 minutes  
**Difficulty:** ⭐⭐⭐⭐⭐ (Very Hard - Subjective)

**Example Questions:**
- "How would you handle a low-performing team?"
- "Prioritize: technical debt vs new features?"
- "Scale team from 5 to 50 engineers - strategy?"

---

## 🧮 Scoring Algorithm

### Component Scores

```
FINAL_SCORE = AVERAGE(question_scores)
  
Each question scored 0-100 by AI:
  - 90-100: Excellent
  - 80-89:  Good
  - 70-79:  Satisfactory
  - 60-69:  Needs Improvement
  - 0-59:   Poor
```

### Trust Score Impact

```
TRUST_SCORE_COMPONENT = 40% (max from assessment)

Breakdown:
  Score 0-30   → +0-5 points (15-20%)
  Score 30-50  → +5-10 points (20-30%)
  Score 50-70  → +10-25 points (30-50%)
  Score 70-85  → +25-35 points (50-85%)
  Score 85-100 → +35-40 points (85-100%)
```

### Pass/Fail Threshold
```
DEFAULT THRESHOLDS:
  FRESHER: 50% (passes with 50+)
  MID:     60%
  SENIOR:  70%
  LEADERSHIP: 65% (qualitative)

Recruiter can set custom thresholds for company assessments.
```

---

## � Candidate Scoring Guidance

### How Scoring Works: The 4 Dimensions

Each answer is automatically evaluated by AI on these dimensions (each 0-6, then averaged to 0-100):

1. **Relevance (0-6)**: Did you actually address the question?
   - ❌ Off-topic rambling = low score
   - ✅ Direct, focused response = high score

2. **Specificity (0-6)**: Do you have concrete details?
   - ❌ "I did marketing stuff and it went well" = low
   - ✅ "Led campaign reaching 500K users, 3.2% CTR (vs 1.8% baseline), $200K revenue" = high

3. **Clarity (0-6)**: Is it well-organized and easy to follow?
   - ❌ Rambling thoughts = low
   - ✅ Clear structure (situation → action → result) = high

4. **Ownership (0-6)**: Do you show mastery and accountability?
   - ❌ "The team decided..." = low ownership
   - ✅ "I identified, proposed, led implementation, mentored others" = high ownership

### Score Tiers & Visibility Impact

| Tier | Score | Visibility | Match Bonus | Status |
|------|-------|-----------|------------|--------|
| 🏆 Top Talent | 80-100 | Featured in "Top Talent" | +5 points | Highly trusted |
| ⭐ Strong | 70-79 | Visible in all searches | Standard | Competitive |
| 📈 Developing | 60-69 | Limited reach | None | Needs refinement |
| ⚠️ Growing | <60 | Very limited | None | Early stage |

### How to Maximize Your Score (80+)

#### For Resume/Background Questions
- Use **STAR framework**: Situation → Task → Action → Result
- Include **metrics**: "3.2% CTR", "92% improvement", "$2M revenue"
- Show **progression**: "I identified... → I proposed... → I implemented... → team adopted..."
- Prove **impact**: Business outcomes, user growth, cost savings
- Mention **learning**: "I had to learn [technology] to solve this"
- Note **adoption**: "Team now uses this standard approach"

**Example (Low Score 40-50):**
```
"I was a software developer for 3 years. I worked on backend APIs.
We improved the system and it helped the company."
```

**Example (High Score 85-95):**
```
SITUATION: API responses were slow (2.3s), hurting user retention.

TASK: As tech lead, improve performance without disrupting production.

ACTION:
- Profiled codebase → found N+1 queries (45% of latency)
- Implemented connection pooling + caching (learned Redis architecture)
- Mentored 2 juniors through phased rollout

RESULT:
- 92% improvement: 2.3s → 180ms
- 34% increase in session duration → $2.1M new revenue
- Optimization became team standard (prevented regressions)
- Earned "Tech Excellence" award
```

#### For Technical/Case Study Questions
- Discuss **scalability**: "For 1M users, I'd..."
- Address **trade-offs**: "More complex BUT prevents data loss"
- Think **production-ready**: Failure scenarios, monitoring, SLAs
- Name **real technologies**: Kafka, Redis, PostgreSQL replicas
- Show **seniority**: Own the design, defend choices, acknowledge constraints

**Dimension Scoring in Case Studies:**
- Relevance: Does solution answer the question? (Not just "use a database")
- Specificity: Names real tech, discusses components, mentions numbers
- Clarity: Architecture is well-structured and explained logically
- Ownership: Shows you've thought through complexity, not just surface-level

#### For Behavioral Questions
- Use **STAR structure**: Situation → Task → Action → Result
- Show **emotional intelligence**: Respect authority, consider others' views
- **Quantify results**: "3x faster" not "it went better"
- Show **reflection**: "I learned..." and "I've applied this to..."
- Demonstrate **relationships**: How did people respond? Did they grow?

**Tips:**
- Lead with evidence, not arguments
- Respect hierarchy while sharing your perspective
- Show how you learned from the experience
- Connect back to team/company outcomes

#### For Personality/Psychometric Questions
- Be **specific + authentic**: Give concrete examples
- Show **self-awareness**: Acknowledge strengths AND limitations
- Explain **value**: Why is your style an asset to the team?
- Provide **proof**: Colleague feedback, project outcomes
- Connect **to outcomes**: How does your style create value?

**Example (Low Score 40-50):**
```
"I like working with teams. I'm also good at independent work.
I handle stress well and I'm motivated by interesting problems."
```

**Example (High Score 85-95):**
```
I thrive on BOTH collaboration and autonomy:

COLLABORATION IS MY STRENGTH:
- Led 3 cross-team projects ($2M revenue this year)
- People come to me for complex problems
- Feedback: "You make people think differently"

BUT I ALSO NEED AUTONOMY:
- Solo research (built recommendation engine with ML/LLMs)
- Deep technical dives (redesigned search system in 2 weeks)

KEY SELF-AWARENESS:
I know WHEN to use each:
- Complex collaborative problems? Element
- Deep technical work? Autonomous + document/share
- Colleagues say: "Knows when to collaborate vs go solo"

WORK ENVIRONMENT I THRIVE IN:
- Teams valuing both styles (trust, space for collaboration)
- Psychological safety (contributions valued)
- Clear ownership (I own the result)

THIS MATTERS BECAUSE:
Makes me reliable in ambiguous situations:
- If critical and unclear → I do it alone
- If someone struggles → I collaborate to help them learn
- If expertise needed → I build it, then teach
```

### Feedback After Assessment

After completing the assessment, you'll receive:

1. **Score Breakdown**
   - Overall score (0-100) and tier
   - Score by question type
   - Comparison to your level (FRESHER/MID/SENIOR/LEADERSHIP benchmark)

2. **Detailed Feedback**
   - Strengths: What you did well
   - Areas to improve: Where you lost points
   - Specific examples: What higher-scoring answers look like

3. **Recruiter Visibility**
   - Your tier determines visibility to recruiters
   - Top Talent (80+) gets featured positioning
   - Score shown in your profile

4. **Retake Option**
   - Can retake after 30 days
   - Can choose different level
   - Improvements shown in trend over time

---

## �🛡️ Anti-Cheat Mechanisms

### Tab-Switch Detection

```
DETECTION METHOD:
  window.addEventListener('blur')
  window.addEventListener('focus')
  document.addEventListener('visibilitychange')

When candidate switches tab:
  1. FIRST SWITCH: Warning notification
     "Detected tab switch. Please stay on assessment window.
      2 more violations will end the session."
  
  2. SECOND SWITCH: Stronger warning
     "Second violation. One more will auto-submit."
  
  3. THIRD SWITCH: Auto-submission
     "Assessment ended due to anti-cheat violation.
      Last answer saved. You can retake after 7 days
      instead of 30 days as a courtesy."
      
     Assessment marked: COMPLETED_WITH_VIOLATION
```

### Other Anti-Cheat Features

1. **Screenshot Prevention**
   - Disable screenshot tools
   - Disable print screen key
   - Browser DevTools access restricted

2. **Copy-Paste Disabled**
   - Disable Ctrl+C, Ctrl+V
   - Disable right-click
   - Prevents code copying from external sources

3. **Developer Tools Disabled**
   - F12 (Inspector) blocked
   - Ctrl+Shift+I (Tools) blocked
   - Keyboard shortcuts monitored

4. **Webcam Monitoring** (Optional Future)
   - Could add webcam tracking
   - Detect if looking away
   - Detect additional people in frame

5. **Time Tracking**
   - Each question times how long to answer
   - Anomalies flagged (too fast = guessing, too slow = research)
   - Not auto-fail, but noted in report

### Violation Handling

```
MINOR VIOLATION (Tab switch 1-2×):
  - Logged in assessment_violations table
  - Warning shown to candidate
  - Assessment continues
  - Noted in final report: "Anti-cheat warning: X violations"
  
MAJOR VIOLATION (3+ violations):
  - Assessment marked: COMPLETED_WITH_VIOLATION
  - Score still calculated but flagged
  - Cannot use for job matching
  - Candidate can retake in 7 days (not 30)
  - Recruiter sees: 🚩 "This assessment had violations"
```

---

## ⚙️ Technical Implementation

### Backend Architecture

```
FastAPI Application
  │
  ├─ assessment.py (routes)
  │  ├─ POST /assessment/start
  │  ├─ POST /assessment/answer/{question_id}
  │  ├─ POST /assessment/submit
  │  ├─ GET /assessment/results/{id}
  │  └─ POST /assessment/retake
  │
  ├─ assessment_service.py (business logic)
  │  ├─ start_assessment()
  │  ├─ evaluate_answer() [calls Gemini]
  │  ├─ calculate_final_score()
  │  ├─ generate_report()
  │  └─ get_next_question()
  │
  └─ models/assessment.py (database models)
     ├─ Assessment
     ├─ AssessmentResponse
     └─ AssessmentResult
```

### Gemini API Integration

```python
# Pseudocode
def evaluate_answer(question_text, candidate_answer, correct_answer):
    prompt = f"""
    Question: {question_text}
    Correct Answer: {correct_answer}
    Candidate's Answer: {candidate_answer}
    
    Score the candidate's answer 0-100.
    Return JSON: {{"score": 85, "reasoning": "..."}}
    """
    
    response = gemini_client.generate_content(prompt)
    return parse_json(response)
```

### Frontend Implementation (React)

```typescript
// Assessment Component Flow
function AssessmentFlow() {
  const [assessment, setAssessment] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [violations, setViolations] = useState(0);

  useEffect(() => {
    // Tab-switch detection
    const handleVisibilityChange = () => {
      if (document.hidden) {
        recordViolation();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const submitAnswer = async () => {
    const response = await api.post('/assessment/answer', {
      assessment_id: assessment.id,
      question_id: currentQuestion.id,
      answer: userAnswer,
    });
    
    setCurrentQuestion(response.next_question);
  };

  // ... render UI
}
```

---

## 🗄️ Database Schema

### Table: assessments
```sql
CREATE TABLE assessments (
    id UUID PRIMARY KEY,
    candidate_id UUID NOT NULL,
    level VARCHAR (50),  -- FRESHER, MID, SENIOR, LEADERSHIP
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    status VARCHAR(50),  -- IN_PROGRESS, COMPLETED, COMPLETED_WITH_VIOLATION
    total_score DECIMAL,
    time_spent_seconds INT,
    violation_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### Table: assessment_responses
```sql
CREATE TABLE assessment_responses (
    id UUID PRIMARY KEY,
    assessment_id UUID NOT NULL REFERENCES assessments(id),
    question_id UUID NOT NULL,
    candidate_answer TEXT,
    ai_score DECIMAL,  -- 0-100
    evaluation_reason TEXT,  -- Why AI gave this score
    question_sequence INT,  -- 1st, 2nd, 3rd question, etc.
    answered_at TIMESTAMP,
    FOREIGN KEY (assessment_id) REFERENCES assessments(id)
);
```

### Table: assessment_results
```sql
CREATE TABLE assessment_results (
    id UUID PRIMARY KEY,
    assessment_id UUID NOT NULL UNIQUE REFERENCES assessments(id),
    final_score DECIMAL,  -- Average of all question scores
    strengths TEXT[],  -- Array of strengths
    weaknesses TEXT[],  -- Array of weaknesses
    report_pdf_url VARCHAR,  -- S3 URL to PDF report
    valid_until TIMESTAMP,  -- Certificate validity (6 months)
    created_at TIMESTAMP DEFAULT NOW()
);
```

### Table: assessment_questions
```sql
CREATE TABLE assessment_questions (
    id UUID PRIMARY KEY,
    question_text TEXT NOT NULL,
    level VARCHAR(50),  -- FRESHER, MID, SENIOR, LEADERSHIP
    question_type VARCHAR(50),  -- MCQ, CODING, SHORT_ANSWER
    correct_answer TEXT,
    options JSONB,  -- For MCQ: ["Option A", "Option B", ...]
    difficulty INT,  -- 1-10 scale
    topic_tags VARCHAR[] -- ["OOP", "Design Patterns"]
);
```

### Table: assessment_violations
```sql
CREATE TABLE assessment_violations (
    id UUID PRIMARY KEY,
    assessment_id UUID NOT NULL REFERENCES assessments(id),
    violation_type VARCHAR(50),  -- TAB_SWITCH, SCREENSHOT
    detected_at TIMESTAMP,
    severity VARCHAR(50)  -- MINOR, MAJOR
);
```

---

## 📡 API Reference

### 1. Start Assessment

**Endpoint:** `POST /assessment/start`

**Request:**
```json
{
  "level": "MID"  // Optional, auto-detects if not provided
}
```

**Response:**
```json
{
  "assessment_id": "uuid-xxx",
  "level": "MID",
  "question_count": 12,
  "time_limit": 1800,  // seconds (30 minutes)
  "first_question": {
    "id": "q-123",
    "text": "What is design pattern?",
    "type": "MCQ",
    "options": ["A", "B", "C", "D"]
  }
}
```

### 2. Submit Answer

**Endpoint:** `POST /assessment/answer/{question_id}`

**Request:**
```json
{
  "assessment_id": "uuid-xxx",
  "answer": "Option B"
}
```

**Response:**
```json
{
  "score_for_this": 85,
  "next_question": { /* question object */ },
  "assessment_status": "IN_PROGRESS",
  "questions_remaining": 8
}
```

### 3. Submit Assessment

**Endpoint:** `POST /assessment/submit`

**Request:**
```json
{
  "assessment_id": "uuid-xxx"
}
```

**Response:**
```json
{
  "final_score": 78,
  "status": "COMPLETED",
  "performance": "Good",
  "report_url": "s3://...",
  "trust_score_impact": +8
}
```

### 4. Get Results

**Endpoint:** `GET /assessment/results/{assessment_id}`

**Response:**
```json
{
  "assessment_id": "uuid-xxx",
  "final_score": 78,
  "level": "MID",
  "duration": 1520,  // seconds
  "strengths": ["OOP", "Problem Solving"],
  "weaknesses": ["Performance Optimization"],
  "report_pdf": "https://...",
  "valid_until": "2026-10-02",
  "violation_count": 0
}
```

### 5. Retake Assessment

**Endpoint:** `POST /assessment/retake`

**Request:**
```json
{
  "level": "MID"
}
```

**Response:**
```json
{
  "allowed": true,
  "next_available_date": "2026-05-02",  // If retake not ready
  "assessment_id": "uuid-new"
}
```

---

## 📋 Conclusion

The assessment system is designed to:
- ✅ **Verify** candidate skills objectively
- ✅ **Power** recommendations with assessment data
- ✅ **Build** trust through transparency
- ✅ **Prevent** fraud with anti-cheat
- ✅ **Scale** with AI evaluation (Gemini)

Both candidates and recruiters benefit from this robust, fair assessment platform.
