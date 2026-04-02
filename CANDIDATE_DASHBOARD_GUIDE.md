# Candidate Dashboard Features - Complete Guide

**Version:** 1.0  
**Last Updated:** April 2, 2026  
**Audience:** Candidates, Feature Managers, Developers

---

## 📋 Table of Contents

1. [Dashboard Overview](#dashboard-overview)
2. [Core Features](#core-features)
3. [Each Feature Explained](#each-feature-explained)
4. [Feature Interactions](#feature-interactions)
5. [User Workflows](#user-workflows)

---

## 🏠 Dashboard Overview

### URL
`http://localhost:3000/dashboard/candidate`

### Purpose
Central hub for candidates to:
- View job recommendations
- Manage applications
- Complete assessments
- Chat with recruiters
- Monitor profile progress
- Track career insights

### Dashboard Sections
1. **Profile & Trust Score** - Top banner
2. **Recommended Jobs** - AI-matched opportunities
3. **Applications** - Pending and completed
4. **Messages** - Chat with recruiters
5. **Career Insights** - GPS and analytics
6. **Community** - Posts and networking
7. **Settings** - Profile configuration

---

## ⭐ Core Features

| Feature | Type | Status | Priority |
|---------|------|--------|----------|
| Profile Management | Profile | ✅ Complete | P0 |
| Resume Upload & Parsing | Profile | ✅ Complete | P0 |
| Skill Assessment | Assessment | ✅ Complete | P0 |
| Trust Score | Profile | ✅ Complete | P0 |
| Job Recommendations | Discovery | ✅ Complete | P0 |
| Job Search & Filter | Discovery | ✅ Complete | P0 |
| Apply to Jobs | Engagement | ✅ Complete | P0 |
| Saved Jobs | Engagement | ✅ Complete | P1 |
| Interview Scheduling | Interview | ✅ Complete | P0 |
| Real-time Chat | Communication | ✅ Complete | P0 |
| Notifications | System | ✅ Complete | P1 |
| Career GPS | Insights | ✅ Complete | P2 |
| Profile Analytics | Insights | ✅ Complete | P1 |
| Community Posts | Social | ⚠️ Partial | P3 |
| Settings & Profile | Configuration | ✅ Complete | P1 |

---

## 🎯 Each Feature Explained

### 1. Profile Management

#### What It Does
Candidates can create and maintain their complete professional profile.

#### Components
- **Basic Information** - Name, email, phone, location
- **Professional Summary** - Bio/headline
- **Experience** - Job history with descriptions
- **Skills** - Add/remove professional skills
- **Education** - Degrees and institutions
- **Certifications** - Professional credentials
- **Languages** - Proficiency levels
- **Social Links** - LinkedIn, GitHub, portfolio

#### User Flow
```
Click "Edit Profile"
  ↓
Fill form fields
  ↓
Save changes
  ↓
Fields validated
  ↓
Profile updated in database
  ↓
Profile completion % recalculated
  ↓
Show success message
```

#### Database Tables Used
- `candidates` - Core profile info
- `candidate_experience` - Work history
- `candidate_skills` - Skills list
- `candidate_education` - Education details

#### API Endpoints
- `GET /candidate/profile` - Fetch profile
- `PUT /candidate/profile` - Update profile
- `GET /candidate/profile/completion` - Completion score
- `POST /candidate/experience` - Add experience
- `PUT /candidate/experience/{id}` - Edit experience
- `DELETE /candidate/experience/{id}` - Remove experience
- `POST /candidate/skills` - Add skill
- `DELETE /candidate/skills/{id}` - Remove skill

#### Key Metrics
- Profile completion: 0-100%
- Profile view count
- Recruiter saves
- Last updated

---

### 2. Resume Upload & Parsing

#### What It Does
Candidates upload resumes (PDF/DOCX) which are automatically parsed and structured for better matching.

#### Features
- **File Upload** - Drag & drop or click to upload
- **Format Support** - PDF, DOCX, DOC
- **Automatic Parsing** - AI extracts:
  - Contact information
  - Experience
  - Education
  - Skills
  - Certifications
  - Projects
- **Hosted Resume** - Stored in AWS S3, accessible via CloudFront CDN
- **Resume Versioning** - Keep multiple versions

#### User Flow
```
Click "Upload Resume"
  ↓
Select file (PDF/DOCX)
  ↓
File uploaded to AWS S3
  ↓
Virus scan performed (if available)
  ↓
Gemini API parses content
  ↓
Extracted fields mapped to profile
  ↓
Auto-populate missing fields
  ↓
Show parsing results
  ↓
Candidate can:
     - Accept all fields
     - Edit specific fields
     - Revert to original
  ↓
Save to profile
```

#### Database Tables Used
- `candidates` - resume_url, resume_parsed_at
- `resume_data` - Parsed fields and content

#### API Endpoints
- `POST /candidate/resume/upload` - Upload file
- `GET /candidate/resume` - Get current resume
- `PUT /candidate/resume/parse` - Trigger parsing
- `GET /candidate/resume/parsed-fields` - View extracted data
- `DELETE /candidate/resume` - Delete resume

#### Key Metrics
- Resume upload count
- Last upload date
- Parse success rate
- Field extraction accuracy

---

### 3. Skill Assessment

#### What It Does
AI-powered adaptive assessment that evaluates candidate skills and generates a trust score.

#### Features
- **Multi-Level Assessment** - FRESHER / MID / SENIOR / LEADERSHIP
- **Adaptive Difficulty** - Questions adjust based on answers
- **Duration** - 6-16 questions (adaptive)
- **AI Evaluation** - Gemini/GPT-4o scores responses
- **Anti-Cheat** - Tab-switch detection (auto-ban at 3+ switches)
- **Time Tracking** - Optional time limits per question
- **Results Dashboard** - Detailed feedback
- **PDF Report** - Downloadable assessment certificate

#### User Flow
```
Click "Take Assessment"
  ↓
Select level or auto-detect from profile
  ↓
Review instructions + anti-cheat warning
  ↓
Start assessment
  ↓
Question 1 displayed
  ↓
Candidate answers text/coding question
  ↓
Click "Submit Answer"
  ↓
Backend evaluates with AI
  ↓
Question 2 (adjusted difficulty) shown
  ↓
...repeat until 16 questions or target score met...
  ↓
All answers submitted
  ↓
Calculate final score (0-100)
  ↓
Generate feedback + strengths/weaknesses
  ↓
Store assessment_results
  ↓
Update candidate trust_score
  ↓
Show results page
```

#### Assessment Levels & Questions
| Level | Target Users | Sample Topics |
|-------|-------------|---------------|
| FRESHER | 0-1 years exp | Basic programming, fundamentals |
| MID | 1-5 years exp | Problem-solving, architecture basics |
| SENIOR | 5+ years exp | System design, advanced patterns |
| LEADERSHIP | 3+ in leadership | Team management, strategy |

#### Database Tables Used
- `assessments` - Assessment metadata
- `assessment_responses` - Individual answers
- `assessment_results` - Final score + feedback
- `candidates.trust_score` - Updated score

#### API Endpoints
- `POST /assessment/start` - Begin assessment
- `POST /assessment/answer/{question_id}` - Submit answer
- `POST /assessment/submit` - Complete assessment
- `GET /assessment/results/{id}` - View results
- `PUT /assessment/retake` - Retake assessment
- `GET /assessment/status` - Check current status
- `POST /assessment/report/pdf` - Generate PDF

#### Anti-Cheat Features
- Tab-switch detection (3+ bans candidate)
- Window blur detection
- Screenshot restrictions
- Copy-paste disabled in input fields
- Random question order

#### Key Metrics
- Completion rate: X%
- Average score: 0-100
- Pass rate: % above 70
- Retake frequency
- Top performers: % above 85

---

### 4. Trust Score

#### What It Does
Dynamic score (0-100) representing a candidate's verification and quality on the platform.

#### Components
```
Trust Score = Profile Completeness (30%) 
            + Assessment Score (40%)
            + Experience Verification (15%)
            + Recruiter Interactions (15%)

Total Range: 0-100
```

#### Score Tiers
| Score | Tier | Status | Badge |
|-------|------|--------|-------|
| 85-100 | Elite | Verified Professional | 🟢 |
| 70-84 | Strong | Well-Verified | 🟡 |
| 50-69 | Developing | Partially Verified | 🟠 |
| 0-49 | Starting Out | New to Platform | ⚪ |

#### Factors Contributing to Score
1. **Profile Completeness** (30%)
   - Basic info complete: +10%
   - Experience added: +10%
   - Skills verified: +10%

2. **Assessment Score** (40%)
   - Takes assessment: +10%
   - Score 50+: +15%
   - Score 70+: +30%
   - Score 85+: +40%

3. **Experience Verification** (15%)
   - Years of experience: +5-15% (based on years)
   - Skill-role alignment: +5-10%

4. **Recruiter Interactions** (15%)
   - Application sent: +2% (per app, max 5)
   - Interview completed: +5% (per interview, max 10)
   - Job acceptance: +15%
   - Profile viewed by recruiters: +2% (per 10 views)

#### Display on Dashboard
```
┌─────────────────────────────┐
│   Your Trust Score          │
│                             │
│   ████████░░ 72/100         │
│                             │
│   Strong - Well Verified    │
│                             │
│   Breakdown:                │
│   • Profile: 28/30          │
│   • Assessment: 32/40       │
│   • Experience: 12/15       │
│   • Recruiter: 0/15         │
└─────────────────────────────┘
```

#### User Flow
```
Candidate completes profile
  ↓
Trust score updates (real-time)
  ↓
Takes assessment
  ↓
Trust score increases
  ↓
Gets interviewed
  ↓
Trust score increases
  ↓
Gets hired
  ↓
Trust score reaches peak
```

#### Database Tables Used
- `candidates.trust_score` - Current score
- `candidates.verification_fields` - JSON tracking completion
- `assessment_results.score` - Assessment contribution
- `interview_feedback` - Interview contribution

#### API Endpoints
- `GET /candidate/trust-score` - Get current score
- `GET /candidate/trust-score/breakdown` - Score components
- `GET /candidate/trust-score/recommendations` - How to improve

#### Key Metrics
- Average trust score: 0-100
- Elite candidates: % with score >85
- Improvement trend: Over time

---

### 5. Job Recommendations

#### What It Does
AI-powered recommendations of jobs most likely to match candidate skills, experience, and preferences.

#### Matching Algorithm
```
Match Score (0-100) = 
  Skills Overlap (40%)          +
  Experience Band Match (25%)   +
  Location Compatibility (20%)  +
  Salary Alignment (10%)        +
  Role Relevance (5%)
```

#### Features
- **Smart Ranking** - Top matches first
- **Color Coding** - 🟢 Perfect (85%+), 🟡 Good (70-85%), ⚪ Okay (<70%)
- **Why This Job** - Explanation of match score
- **Missing Skills** - Skills needed but candidate lacks
- **Apply Direct** - One-click apply
- **Save for Later** - Bookmark job
- **Share** - Send to network

#### User Flow
```
Visit Jobs → Recommendations Tab
  ↓
Backend calls recommendation_service.py
  ↓
Calculates match score for each active job
  ↓
Stores in candidate_job_sync table
  ↓
Returns top 20 recommendations
  ↓
Frontend displays:
  - Job title, company
  - Match % (color-coded)
  - Skills match
  - Experience fit
  - Salary range
  - Location
  ↓
Candidate clicks job
  ↓
Details page shows:
  - Full job description
  - Why this match (reasoning)
  - Skills breakdown
  - Company info
  ↓
Candidate can:
  - Apply directly
  - Save job
  - Ask questions (chat)
  - Share with friend
```

#### Display on Dashboard Card
```
┌────────────────────────────────┐
│  ✨ Recommended for You        │
│                                │
│ 1. Senior Backend Developer    │
│    Company X                   │
│    ████████░░ 88/100 🟢         │
│                                │
│ 2. Full Stack Engineer         │
│    Company Y                   │
│    ██████░░░░ 75/100 🟡         │
│                                │
│ 3. DevOps Engineer             │
│    Company Z                   │
│    ████░░░░░░ 65/100 ⚪         │
│                                │
│    [View All Recommendations] │
└────────────────────────────────┘
```

#### Database Tables Used
- `candidate_job_sync` - Match scores and explanations
- `jobs` - Job listings
- `saved_jobs` - Bookmarked opportunities
- `job_applications` - Application history

#### API Endpoints
- `GET /recommendations/jobs` - List recommendations (paginated)
- `GET /recommendations/jobs/{id}/match-details` - Detailed breakdown
- `GET /recommendations/jobs/summary` - Dashboard card data
- `POST /recommendations/jobs/{id}/apply` - Apply directly
- `POST /candidate/saved-jobs` - Save job
- `DELETE /candidate/saved-jobs/{id}` - Remove saved

#### Key Metrics
- Recommendation accuracy: % of recommendations leading to applications
- Click-through rate: % of recommendations clicked
- Application conversion: % applied after viewing

---

### 6. Job Search & Filtering

#### What It Does
Comprehensive job search with advanced filtering and sorting.

#### Features
- **Search by Title** - Job title keyword search
- **Location Filter** - Single/multiple locations
- **Salary Range** - Min/max salary filter
- **Experience Level** - FRESHER/MID/SENIOR/LEADERSHIP
- **Company Filter** - Search by specific companies
- **Skills Filter** - Filter by required skills
- **Job Type** - Full-time, Part-time, Contract
- **Posted Date** - Jobs from last day/week/month
- **Sorting** - By relevance, date, salary, company
- **Saved Views** - Save search filters

#### User Flow
```
Visit /dashboard/candidate/jobs
  ↓
View all active jobs (paginated)
  ↓
Add filters:
  - select location
  - set salary range
  - choose experience level
  - pick skills needed
  ↓
Backend filters jobs in database
  ↓
Results updated dynamically
  ↓
Can save search for later
  ↓
Click job for details
```

#### Filter Dialog
```
┌──────────────────────────────┐
│  🔍 Search & Filter Jobs     │
├──────────────────────────────┤
│ Title: [search box]          │
│                              │
│ Location:                    │
│ ☑ Remote  ☐ Mumbai           │
│ ☐ Bangalore                  │
│                              │
│ Salary Range:                │
│ ₹100k ───●─────────○ ₹50L   │
│                              │
│ Experience Level:            │
│ ☐ Fresher  ☐ Mid             │
│ ☑ Senior   ☑ Leadership       │
│                              │
│ Skills:                      │
│ [+] Add skill                │
│ • Python                     │
│ • React                      │
│                              │
│ Job Type:                    │
│ ☑ Full-time                  │
│ ☐ Part-time                  │
│ ☐ Contract                   │
│                              │
│ Posted:                      │
│ ◉ Any time  ○ Last week      │
│ ○ Last month                 │
│                              │
│ [Apply Filters] [Clear All]  │
└──────────────────────────────┘
```

#### Database Tables Used
- `jobs` - All job listings
- `job_skills` - Required skills for each job
- `saved_searches` - Saved filters

#### API Endpoints
- `GET /candidate/jobs?title=&location=&salary_min=` - Search/filter
- `GET /candidate/saved-searches` - List saved searches
- `POST /candidate/saved-searches` - Save search
- `DELETE /candidate/saved-searches/{id}` - Remove saved

#### Key Metrics
- Search volume per candidate
- Average jobs viewed per session
- Filter usage frequency
- Saved search count

---

### 7. Apply to Jobs

#### What It Does
Submit application to job postings with one-click or full-profile application.

#### Features
- **Quick Apply** - Send profile directly
- **Custom Application** - Add cover letter, answers to questions
- **Application Tracking** - View status of all applications
- **Withdraw Application** - Option to remove application
- **Application History** - View all past applications

#### User Flow
```
View job details
  ↓
Click "Apply" button
  ↓
Choose:
  - Quick Apply (auto-submit profile)
  - Full Application (add cover letter)
  ↓
If Full Application:
  - Write custom message
  - Answer 2-3 recruiter questions
  - Upload portfolio link
  ↓
Review application
  ↓
Click "Submit"
  ↓
Backend creates job_applications record
  ↓
Notification sent to recruiter
  ↓
Chat thread created between candidate & recruiter
  ↓
Application appears in candidate's "Applications" tab
  ↓
Show confirmation to candidate
```

#### Application States
| State | Meaning | Recruiter Can | Candidate Can |
|-------|---------|---|---|
| SUBMITTED | Sent to recruiter | Review, Reject, Ignore | Withdraw |
| SHORTLISTED | Moved to next stage | Send interview proposal | Track |
| INTERVIEW_SCHEDULED | Interview confirmed | Reschedule, Cancel | Confirm, Attend |
| INTERVIEW_COMPLETED | Interview done | Send feedback | View feedback |
| OFFERED | Job offered | Finalize offer | Accept/Reject |
| REJECTED | Application rejected | None | None |
| WITHDRAWN | Candidate withdrew | None | None |

#### database Tables Used
- `job_applications` - Application records
- `job_applications_questions` - Application Q&A

#### API Endpoints
- `POST /candidate/apply` - Submit application
- `GET /candidate/applications` - List applications
- `GET /candidate/applications/{id}` - View single application
- `PUT /candidate/applications/{id}/withdraw` - Withdraw
- `GET /candidate/applications/{id}/status` - Check status

#### Key Metrics
- Applications submitted per candidate
- Application acceptance rate (% shortlisted)
- Application-to-interview conversion rate

---

### 8. Saved Jobs

#### What It Does
Bookmark jobs to review later without immediate commitment.

#### Features
- **Save Button** - Click heart icon to save
- **Saved Jobs List** - View all bookmarks
- **Notes** - Add personal notes to saved jobs
- **Reminders** - Get notification before job closes
- **Sort & Filter** - Sort by date saved, company, salary
- **Quick Apply** - Apply directly from saved list

#### User Flow
```
View job details
  ↓
Click "Save" / heart icon
  ↓
Job added to saved_jobs table
  ↓
Confirmation shown
  ↓
Visit Saved Jobs tab
  ↓
View all saved opportunities
  ↓
Can add notes: "Great for skills development"
  ↓
Can apply when ready
  ↓
Or unsave to remove
```

#### Saved Jobs Interface
```
┌──────────────────────────────┐
│ ❤️ Saved Jobs (12)            │
├──────────────────────────────┤
│ Sort: [Date ▼]  Filter: [All] │
│                              │
│ 1. Senior Backend Developer  │
│    Company X | ₹50-60L       │
│    📍 Bangalore | Remote Ok   │
│    💬 Great backend role     │
│    [Apply Now] [Unsave] [×]  │
│                              │
│ 2. Full Stack Engineer       │
│    Company Y | ₹40-50L       │
│    📍 Mumbai                 │
│    [Apply Now] [Unsave]      │
│                              │
```

#### Database Tables Used
- `saved_jobs` - Bookmarked opportunities

#### API Endpoints
- `POST /candidate/saved-jobs` - Save job
- `GET /candidate/saved-jobs` - List saved
- `DELETE /candidate/saved-jobs/{id}` - Unsave
- `PUT /candidate/saved-jobs/{id}/notes` - Add notes

#### Key Metrics
- Average saved jobs per candidate
- Save-to-apply conversion rate
- Time between save and apply

---

### 9. Interview Scheduling

#### What It Does
Accept, schedule, and conduct virtual interviews via Jitsi Meet.

#### Features
- **Interview Proposals** - Receive invitations from recruiters
- **Scheduling** - Confirm date/time
- **Calendar Integration** - Schedule shows in calendar
- **Jitsi Video URL** - Join video call
- **Interview History** - View past interviews
- **Feedback** - Receive post-interview feedback

#### User Flow
```
Recruiter sends interview proposal
  ↓
Candidate receives notification
  ↓
Click "Review Interview Invite"
  ↓
View:
  - Job title
  - Recruiter name
  - Proposed times (3 options)
  - Interview round (1st, 2nd, final)
  ↓
Click "Confirm"
  ↓
Select preferred time
  ↓
Interview confirmed
  ↓
Backend creates Jitsi meeting link
  ↓
Calendar invite sent
  ↓
Show "Interview Scheduled" in dashboard
  ↓
Day of interview:
  - Reminder notification
  - 1-hour before: "Interview in 1 hour"
  - 5-min before: "Ready to join?"
  ↓
Click "Join Interview"
  ↓
Jitsi Meet video call opens
  ↓
Interview conducted (30-60 mins)
  ↓
Interview ends
  ↓
Post-interview feedback form shown
  ↓
Recruiter receives feedback
```

#### Dashboard Interview Section
```
┌──────────────────────────────┐
│ 📺 Upcoming Interviews (2)   │
├──────────────────────────────┤
│ 1. Amazon - Senior Dev       │
│    📅 Apr 5, 2:00 PM         │
│    ⏱️ In 2 days               │
│    🔴 [Join Interview]        │
│                              │
│ 2. Google - Tech Lead        │
│    📅 Apr 8, 3:30 PM         │
│    ⏱️ In 5 days               │
│    ⚪ [Confirm Time]           │
│                              │
│ Past Interviews (5):          │
│ • Flipkart - Round 1 (PASS)  │
│ • Uber - Round 2 (REJECTED)  │
```

#### Database Tables Used
- `interview_proposals` - Invitations
- `interviews` - Scheduled interviews
- `interview_feedback` - Post-interview notes
- `interview_slots` - Available times

#### API Endpoints
- `GET /candidate/interviews` - List interviews
- `PUT /candidate/interviews/{id}/confirm` - Confirm time
- `GET /candidate/interviews/{id}/jitsi-url` - Get video link
- `POST /candidate/interviews/{id}/feedback` - Submit feedback

#### Key Metrics
- Interview acceptance rate
- Interview completion rate
- Time-to-interview from application

---

### 10. Real-time Chat

#### What It Does
Direct messaging with recruiters for questions, updates, and collaboration.

#### Features
- **New Conversation** - Start chat with recruiter
- **Message Threading** - Organized conversations
- **Notifications** - Real-time message alerts
- **File Sharing** - Attach documents/portfolio
- **Archive Messages** - Hide old chats
- **Search Messages** - Find past messages
- **Typing Indicator** - "User is typing..."

#### User Flow
```
View Recruiter Profile
  ↓
Click "Message" button
  ↓
Chat window opens
  ↓
Type message: "Interested in this role!"
  ↓
Click send
  ↓
Message appears immediately on screen
  ↓
Recruiter receives notification
  ↓
Recruiter types reply
  ↓
"Recruiter is typing..." shown
  ↓
Recruiter sends message
  ↓
Candidate receives notification
  ↓
Message thread continues
  ↓
Can share files/portfolio links

Later:
  - Can archive conversation
  - Can search past messages
  - Can mute notifications
```

#### Chat Interface
```
┌────────────────────────────────┐
│  HR Manager - Amazon           │
├────────────────────────────────┤
│ [Typing indicator area]        │
│                                │
│ Candidate: "Hi! Interested?" ←  │
│ [2:30 PM] ✓✓                   │
│                                │
│ → Recruiter: "Great! Let's ... │
│   [2:45 PM]                    │
│                                │
│ Candidate: "When is interview?"│
│ [3:00 PM] ✓✓                   │
│                                │
│ → Recruiter: "Next week!"      │
│   [3:05 PM]                    │
│                                │
│ ─────────────────────────────  │
│ [Message box] [Attach] [Emoji] │
│ Type message...         [Send] │
└────────────────────────────────┘
```

#### Database Tables Used
- `chat_threads` - Conversations
- `chat_messages` - Individual messages
- `notifications` - Unread indicators

#### API Endpoints
- `GET /chat/threads` - List conversations
- `POST /chat/send` - Send message
- `GET /chat/threads/{id}/messages` - Get message history
- `POST /chat/threads/{id}/archive` - Archive chat
- `DELETE /chat/threads/{id}` - Delete chat

#### Key Metrics
- Average response time
- Chat message volume
- Recruiter engagement rate

---

### 11. Notifications

#### What It Does
Keep candidates informed of important events and opportunities.

#### Types of Notifications
| Event | Trigger | Delivery |
|-------|---------|----------|
| New Job Match | Matching algo finds fit | In-app + Email |
| Interview Invite | Recruiter proposes interview | In-app + SMS |
| Message Received | Recruiter sends message | In-app + Push |
| Application Status | Status changes (shortlisted, etc.) | In-app + Email |
| Profile View | Recruiter views profile | In-app |
| Saved Job Closing | Job expiration soon | In-app + Email |
| Assessment Result | Assessment completed | In-app |
| Offer Received | Job offer made | In-app + Email + SMS |

#### Notification Preferences
```
┌────────────────────────────┐
│ Notification Settings      │
├────────────────────────────┤
│ ☑ New Job Recommendations │
│   ☑ In-app                │
│   ☑ Email                 │
│   ☐ SMS                   │
│                            │
│ ☑ Message Received        │
│   ☑ In-app                │
│   ☑ Email                 │
│   ☑ SMS                   │
│                            │
│ ☑ Interview Invites       │
│   ☑ In-app                │
│   ☑ Email                 │
│   ☑ SMS                   │
│                            │
│ ☐ Application Updates     │
│   ↳ Can't change           │
│                            │
│ ☑ Profile Views           │
│   ☑ In-app (Weekly)       │
│   ☐ Email                 │
│                            │
│      [Save Preferences]    │
└────────────────────────────┘
```

#### Database Tables Used
- `notifications` - Notification records
- `notification_preferences` - User settings

#### API Endpoints
- `GET /notifications` - List notifications
- `PUT /notifications/{id}/read` - Mark as read
- `GET /notifications/preferences` - Get settings
- `PUT /notifications/preferences` - Update settings

#### Key Metrics
- Notification delivery rate
- Email open rate
- Notification click-through rate

---

### 12. Career GPS

#### What It Does
AI-powered career guidance showing salary trends, market insights, and growth opportunities.

#### Features
- **Market Intelligence** - Average salaries by role/location
- **Skill Demand** - Most in-demand skills
- **Career Path** - Suggested progression routes
- **Salary Range** - Salary insights for candidate's profile
- **Peer Comparison** - How candidate compares to similar profiles
- **Growth Opportunities** - Suggested next roles/companies

#### User Flow
```
Visit /dashboard/candidate/gps
  ↓
See career insights personalized for candidate
  ↓
View:
  - Current role: Senior Backend Dev
  - Market avg salary: ₹25-35L
  - Your range: ₹28-32L
  - Peers with you skill: ~3,500 in Mumbai
  ↓
Career progression recommendations:
  - Staff Engineer (5-10 years)
  - Tech Lead (5-8 years)
  - Engineering Manager (6-12 years)
  ↓
Salary projection by next role
  ↓
Most demanded skills in market
  ↓
Top companies hiring for next role
```

#### Career GPS Dashboard Card
```
┌────────────────────────────┐
│ 🧭 Career GPS              │
├────────────────────────────┤
│ Current Role: Senior Dev   │
│ Experience: 4.5 years      │
│                            │
│ Market Salary Insights     │
│ Average: ₹25-35L           │
│ Your estimate: ₹28-32L     │
│ Peers: ~3,500 in Mumbai    │
│                            │
│ Next Growth Roles:         │
│ 1. Staff Engineer (5y)     │
│    Avg: ₹35-50L            │
│ 2. Tech Lead (5y)          │
│    Avg: ₹30-40L            │
│                            │
│ [View Full Insights]       │
└────────────────────────────┘
```

#### Database Tables Used
- `career_gps_data` - Market insights
- `salary_benchmarks` - Salary data by role
- `skill_demand` - Skills in demand

#### API Endpoints
- `GET /career-gps/profile-data` - Personalized insights
- `GET /career-gps/salary-benchmark` - Salary info
- `GET /career-gps/skill-demand` - Trending skills
- `GET /career-gps/career-paths` - Progression routes

#### Key Metrics
- Most viewed career paths
- Salary insight accuracy
- Career pivot frequency

---

### 13. Profile Analytics

#### What It Does
Track how recruiter are viewing candidate's profile and engagement metrics.

#### Metrics Shown
- **Profile Views** - Total views and trend
- **Recruiter Company** - Which companies viewed profile
- **View Source** - How recruiter found profile
- **Recruiter Engagement** - Who's interested
- **Save Rate** - % of viewers who saved
- **Interaction Rate** - % who messaged or applied
- **Time on Profile** - Average viewing duration

#### Analytics Dashboard
```
┌────────────────────────────────┐
│ 📊 Profile Analytics            │
├────────────────────────────────┤
│ Views This Week: 24             │
│ Total Views: 324                │
│ Trend: ↗ +15% vs last week      │
│                                │
│ Top Companies Viewing:          │
│ 1. Amazon             8 views   │
│ 2. Google             6 views   │
│ 3. Microsoft          4 views   │
│                                │
│ Engagement                      │
│ Messages: 5 new                 │
│ Save rate: 25%                  │
│ Application rate: 10%           │
│                                │
│ [View Detailed Report]          │
└────────────────────────────────┘
```

#### Database Tables Used
- `profile_views` - View records
- `profile_view_analytics` - Aggregated data

#### API Endpoints
- `GET /analytics/profile-views` - View statistics
- `GET /analytics/engagement` - Engagement metrics
- `GET /analytics/companies-viewing` - Company insights
- `GET /analytics/time-on-profile` - Duration data

#### Key Metrics
- Average views per candidate per week
- Recruiter company distribution
- Message-to-view conversion rate

---

### 14. Community Posts

#### What It Does
Share thoughts, articles, and network with other professionals.

#### Features
- **Create Post** - Text, links, images
- **Like Posts** - Show appreciation
- **Comment** - Discuss topics
- **Share** - Share with network
- **Follow Users** - Stay updated
- **Feed** - Curated posts relevant to candidate
- **Hashtags** - Discover topics

#### User Flow
```
Visit /dashboard/candidate/community
  ↓
View feed with posts from network
  ↓
Click "Create Post"
  ↓
Write message: "Just completed AWS certification!"
  ↓
Optionally add image/link
  ↓
Add hashtags: #AWS #Cloud
  ↓
Click "Publish"
  ↓
Post appears in feed
  ↓
Other users can:
  - Like (heart)
  - Comment
  - Share
```

#### Community Feed
```
┌────────────────────────────────┐
│ 👥 Community & Network          │
├────────────────────────────────┤
│ [Write a post...]               │
│                                │
│ Rahul Kumar                     │
│ Just completed AWS Solutions   │
│ Architect exam! 🎉             │
│ ❤️ 45  💬 8  🔁 12             │
│                                │
│ Priya Sharma                    │
│ Congratulations! You inspired  │
│ me to start studying too.      │
│                                │
│ John Doe                        │
│ Anyone preparing for CKAD?     │
│ Let's study together!          │
│ ❤️ 12  💬 3  🔁 5              │
│                                │
│ [Load More Posts]              │
└────────────────────────────────┘
```

#### Database Tables Used
- `posts` - Posts content
- `post_likes` - Likes
- `post_comments` - Comments
- `user_follows` - Follower relationships

#### API Endpoints
- `GET /posts/feed` - Get posts
- `POST /posts` - Create post
- `POST /posts/{id}/like` - Like post
- `POST /posts/{id}/comment` - Comment
- `POST /users/{id}/follow` - Follow user

#### Key Metrics
- Monthly active posters
- Average engagement per post
- Comment-to-like ratio

---

## 🔗 Feature Interactions

### Pre-Application Flow
```
Candidate logs in
  ↓
Dashboard shows:
  - Recommended Jobs (based on profile)
  - Trust Score (needs improvement?)
  - Upcoming Interviews (if any)
  - New Messages
  ↓
Candidate reviews recommendations
  ↓
Clicks job
  ↓
Sees match reasons + company info
  ↓
Clicks "Apply"
  ↓
Application submitted
  ↓
System sends notification to recruiter
```

### Interview to Offer Flow
```
Candidate applies  for job
  ↓
Recruiter sends interview proposal (via notification)
  ↓
Candidate confirms time
  ↓
Calendar reminder set
  ↓
Day of: Join Jitsi interview
  ↓
Post-interview: Feedback shared both ways
  ↓
Candidate becomes "Shortlisted"
  ↓
Possibly: Offer extended
```

---

## 👤 User Workflows

### Workflow 1: New Candidate (First 24 hours)
```
1. Sign up → Verify OTP
2. Create basic profile (name, email, location)
3. Add experience (2-3 roles)
4. Skip or take assessment
5. Upload resume
6. View dashboard
7. Browse jobs
8. Save or apply to first job
```

### Workflow 2: Active Job Seeker
```
1. Login daily
2. Review recommendations
3. Check new messages
4. Apply to 2-3 jobs
5. Confirm interview times
6. Attend interviews
7. Follow up via chat
```

### Workflow 3: Trust Score Improvement
```
1. Complete profile (icons, experience in detail)
2. Add all skills
3. Take assessment
4. Through interviews, build track record
5. Get hired (highest trust boost)
6. Refer others (loyalty boost)
```

---

## 🎓 Conclusion

The Candidate Dashboard is designed to:
- ✅ **Empower** candidates with AI-matched opportunities
- ✅ **Build trust** through transparency and verification
- ✅ **Enable** smooth interviews and communication
- ✅ **Inform** through analytics and career guidance
- ✅ **Connect** through community and networking

All features work together to create a seamless, trust-based job search experience.
