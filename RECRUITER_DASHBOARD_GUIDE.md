# Recruiter Dashboard Features - Complete Guide

**Version:** 1.0  
**Last Updated:** April 2, 2026  
**Audience:** Recruiters, Hiring Managers, Developers

---

## 📋 Table of Contents

1. [Dashboard Overview](#dashboard-overview)
2. [Core Features](#core-features)
3. [Each Feature Explained](#each-feature-explained)
4. [Feature Interactions](#feature-interactions)
5. [User Workflows](#user-workflows)

---

## 🏢 Dashboard Overview

### URLs
- Main Dashboard: `http://localhost:3000/dashboard/recruiter`
- Talent Intelligence: `http://localhost:3000/dashboard/recruiter/intelligence/recommendations`
- Hiring Pipeline: `http://localhost:3000/dashboard/recruiter/hiring/jobs`
- Messages: `http://localhost:3000/dashboard/recruiter/messages`
- Analytics: `http://localhost:3000/dashboard/recruiter/analytics`

### Purpose
Central hub for recruiters to:
- Find verified talent
- Post job openings
- Track applications
- Schedule interviews
- Manage team (if admin)
- Monitor hiring pipeline
- View company analytics

### Dashboard Sections
1. **Quick Stats** - Key metrics at a glance
2. **Talent Intelligence** - AI-recommended candidates
3. **Applications** - Incoming applications
4. **Interviews** - Scheduled interviews
5. **Jobs** - Active job postings
6. **Messages** - Chat with candidates
7. **Team Management** - Sub-account management
8. **Analytics** - Hiring insights
9. **Settings** - Company profile and preferences

---

## ⭐ Core Features

| Feature | Type | Status | Priority |
|---------|------|--------|----------|
| Company Profile | Setup | ✅ Complete | P0 |
| Recruiter Profile | Setup | ✅ Complete | P0 |
| Post Job Openings | Hiring | ✅ Complete | P0 |
| AI Talent Recommendations | Discovery | ✅ Complete | P0 |
| Talent Search | Discovery | ✅ Complete | P0 |
| Application Management | Pipeline | ✅ Complete | P0 |
| Interview Scheduling | Interview | ✅ Complete | P0 |
| Real-time Chat | Communication | ✅ Complete | P0 |
| Team Management | Admin | ✅ Complete | P1 |
| Hiring Pipeline | Analytics | ✅ Complete | P1 |
| Company Analytics | Insights | ✅ Complete | P1 |
| Bulk Upload (via Admin) | Setup | ✅ Complete | P0 |
| Candidate Verification | Security | ✅ Complete | P0 |
| Settings & Preferences | Configuration | ✅ Complete | P1 |

---

## 🎯 Each Feature Explained

### 1. Company Profile

#### What It Does
Company information displayed to candidates and used for matching.

#### Components
- **Company Name** - Legal name
- **Industry** - Sector/industry
- **Company Size** - Employee count
- **Founded** - Year established
- **Website** - Official URL
- **Description** - About company
- **Logo** - Company branding
- **Company Branding** - Colors, tagline, culture keywords
- **Location(s)** - Headquarters and offices
- **Culture Keywords** - Values and culture (Innovation, Collaboration, Growth-focused, etc.)

#### User Flow
```
Recruiter logs in for first time
  ↓
Redirect to /onboarding/recruiter
  ↓
Fill company profile:
  - Company name
  - Industry
  - Size
  - Website
  - Description
  - Upload logo
  ↓
Add company branding:
  - Primary color
  - Culture keywords
  - Company tagline
  ↓
Add office locations
  ↓
Complete profile
  ↓
Company profile visible to candidates
  ↓
Used in recommendation matching
```

#### Database Tables Used
- `companies` - Core company info
- `company_branding` - Visual branding
- `company_locations` - Office locations

#### API Endpoints
- `GET /recruiter/company-details` - Get company info
- `PUT /recruiter/company-details` - Update company
- `POST /recruiter/company-branding` - Set branding
- `GET /recruiter/company-branding` - Get branding

#### Key Metrics
- Profile completion: %
- Candidate trust in company: %

---

### 2. Recruiter Profile

#### What It Does
Individual recruiter/hiring manager profile within company.

#### Components
- **Name** - Full name
- **Title** - Position (e.g., HR Manager, CTO)
- **Email** - Work email
- **Phone** - Contact number
- **Department** - HR, Engineering, etc.
- **Bio** - Personal introduction
- **Photo** - Profile picture
- **LinkedIn** - LinkedIn profile URL

#### Database Tables Used
- `recruiters` - Recruiter details

#### API Endpoints
- `GET /recruiter/profile` - Get recruiter info
- `PUT /recruiter/profile` - Update recruiter profile

#### Key Metrics
- Profile completion: %
- Response rate to candidates: %

---

### 3. Post Job Openings

#### What It Does
Create and manage active job listings candidates can apply to.

#### Features
- **Job Title** - Position name
- **Description** - Full job description
- **Requirements** - Skills and experience needed
- **Salary Range** - Min-max salary
- **Location** - Job location(s)
- **Job Type** - Full-time, Part-time, Contract, Remote
- **Experience Level** - FRESHER/MID/SENIOR/LEADERSHIP
- **Department** - Hiring department
- **Report To** - Reporting manager
- **Active/Inactive** - Status toggle
- **Expiration** - Job closing date
- **Recruiter Questions** - Custom Q&A for applicants

#### User Flow
```
Click "Post New Job"
  ↓
Fill job form:
  - Title: "Senior Backend Developer"
  - Description: (textarea)
  - Required skills: Python, FastAPI, PostgreSQL
  - Experience: SENIOR (5+ years)
  - Salary: ₹25-35L
  - Location: Bangalore, Remote OK
  - Job type: Full-time
  ↓
Add recruiter questions (optional):
  - "Why are you interested in our company?"
  - "Tell us about your biggest project"
  - "Expected joining date?"
  ↓
Review job posting
  ↓
Click "Publish"
  ↓
Job becomes active
  ↓
Recommendation engine finds matching candidates
  ↓
Candidates see in their recommendations
```

#### Job Posting Form
```
┌──────────────────────────────────┐
│ Create Job Opening               │
├──────────────────────────────────┤
│ Job Title:       [_______________] │
│ Department:      [HR ▼]          │
│ Report To:       [_______________] │
│                                  │
│ Job Description: [_____________  │
│ (copy-paste or {format}          │
│ template)                        │
│                                  │
│ Experience Level: [SENIOR ▼]     │
│ Job Type: [Full-time ▼]          │
│ Location(s): [_______________]   │
│              +Add location       │
│                                  │
│ Salary Range:                    │
│ From: [₹25L] To: [₹35L]         │
│                                  │
│ Required Skills:                 │
│ [+ Python + C++ + FastAPI]       │
│ [Add more...]                    │
│                                  │
│ Recruiter Questions:             │
│ [✓] "Why our company?"           │
│ [✓] "Your biggest project?"      │
│ [× "Other:________________"]      │
│                                  │
│ Expiration Date: [Apr 30, 2026]  │
│                                  │
│     [Publish] [Save Draft]       │
└──────────────────────────────────┘
```

#### Database Tables Used
- `jobs` - Job metadata
- `job_skills` - Required skills
- `job_applications` - Applications for job
- `recruiter_assessment_questions` - Custom Q&A

#### API Endpoints
- `POST /recruiter/jobs` - Create job
- `GET /recruiter/jobs` - List recruiter's jobs
- `GET /recruiter/jobs/{id}` - Get job details
- `PUT /recruiter/jobs/{id}` - Edit job
- `DELETE /recruiter/jobs/{id}` - Deactivate job
- `GET /recruiter/jobs/{id}/applications` - Get applications

#### Key Metrics
- Jobs posted per month
- Jobs filled per quarter
- Average time-to-hire
- Applications per job

---

### 4. AI Talent Recommendations

#### What It Does
AI-powered candidate recommendations matched to recruiter's ICP (Ideal Customer Profile).

#### Features
- **Three Filter Modes:**
  1. **Culture Fit** - Candidates aligned with company values
  2. **Skills Match** - Candidates with required job skills
  3. **Expert View** - AI-powered insights (special algo)
- **Ranking** - Candidates ranked by match score
- **Tier Grouping** - Grouped by: Elite (85%), Strong (60-85%), Potential (<60%)
- **Shadow Profiles** - Include passive candidates (not actively job-seeking)
- **Match Explanation** - Why is candidate matched
- **Contact Options** - Message, Schedule interview, Send invitation
- **Debounced Filtering** - Smooth 500ms filter updates

#### User Flow
```
Visit /intelligence/recommendations
  ↓
Select filter mode: 
  - Culture Fit / Skills Match / Expert View
  ↓
Optionally filter by:
  - Location
  - Experience level
  - Salary range
  - Skills needed
  ↓
Backend recommendation_service.py calculates scores:
  - For Culture Fit: Company ICP alignment (Gemini)
  - For Skills: Required skills overlap
  - For Expert: Custom AI algorithm
  ↓
Results grouped into tiers:
  - Elite Candidates (85-100)
  - Strong Match (60-85)
  - Potential (Below 60)
  ↓
Each candidate card shows:
  - Name, photo
  - Match % (color-coded)
  - Key skills
  - Experience
  - Location
  - Trust score
  - "Why this match" reasoning
  ↓
Recruiter clicks candidate
  ↓
Full profile opens:
  - Complete experience
  - All skills
  - Assessment score
  - Applications history
  - Interview history
  ↓
Recruiter can:
  - Send message: "Your profile is interesting"
  - Propose interview: "Let's meet next week"
  - Save candidate: Star icon
```

#### Recommendation Candidate Card
```
┌─────────────────────────────────┐
│ Name: Rajesh Kumar              │
│ Title: Senior Backend Dev       │
│ Experience: 5 years             │
│                                 │
│ ████████░░ 88/100 (Culture Fit) │
│                                 │
│ Skills: ✓ Python ✓ FastAPI      │
│         ✓ PostgreSQL ✓ AWS      │
│                                 │
│ 📍 Bangalore (Remote OK)        │
│ 💰 ₹28-32L                      │
│ ⭐ Trust Score: 78/100          │
│                                 │
│ Why This Match:                 │
│ "Excellent FastAPI and Python  │
│  skills. 5 years exp matches   │
│  your requirement. Strong       │
│  culture alignment."            │
│                                 │
│ [Message] [Propose Int.] [★]   │
│ [View Full Profile]             │
└─────────────────────────────────┘
```

#### Database Tables Used
- `candidates` - Candidate profiles
- `candidate_job_sync` - Match scores
- `recruiter_talent_pool` - Saved candidates

#### API Endpoints
- `GET /recruiter/recommendations?mode=culture_fit` - Get recommendations
- `GET /recruiter/recommendations/{id}/match-details` - Detailed breakdown
- `POST /recruiter/candidates/{id}/invite` - Send invite
- `POST /recruiter/candidates/{id}/save` - Save to pool

#### Key Metrics
- % of recommendations leading to applications
- Average recommendation score
- Message response rate from recommended candidates

---

### 5. Talent Search

#### What It Does
Search for specific candidates that don't appear in recommendations.

#### Features
- **Search by Name** - Direct candidate search
- **Advanced Filters:**
  - Skills (multiple)
  - Experience level
  - Location
  - Salary expectation
  - Company (where they worked)
  - Education
  - Trust score range
- **Sort Options** - By relevance, experience, location, salary
- **Save Searches** - Save filter combinations
- **Export Results** - Download candidate list

#### User Flow
```
Click "Search Candidates"
  ↓
Enter search criteria:
  - Name keyword
  - Skills: React, TypeScript
  - Location: Bangalore
  - Experience: 3-5 years
  - Trust Score: 70+
  ↓
Click "Search"
  ↓
Results show matching candidates
  ↓
Can further refine filters
  ↓
Can save this search for later
  ↓
Can export results to CSV
```

#### Search Interface
```
┌──────────────────────────────┐
│ 🔍 Search Candidates         │
├──────────────────────────────┤
│ Name: [_______________]      │
│                              │
│ Skills:                      │
│ [+ React + TypeScript + ...]│
│ [Add more...]                │
│                              │
│ Location: [Bangalore ▼]      │
│                              │
│ Experience: [3-5 years ▼]    │
│                              │
│ Trust Score:                 │
│ ○70-100  ○60-70  ○50-60      │
│                              │
│ Company (worked at):         │
│ [_______________]            │
│                              │
│ Education:                   │
│ ☑ B.Tech/BE  ☐ M.Tech       │
│ ☐ MBA         ☐ BS          │
│                              │
│ Sort by: [Relevance ▼]       │
│                              │
│ [Search] [Save Search]       │
│ [Cancel]                     │
└──────────────────────────────┘
```

#### Database Tables Used
- `candidates` - Searchable profiles
- `candidate_skills` - Skill filtering
- `saved_searches` - Saved filters

#### API Endpoints
- `GET /recruiter/search/candidates?name=&skills=` - Search candidates
- `POST /recruiter/saved-searches` - Save search
- `GET /recruiter/saved-searches` - List saved
- `DELETE /recruiter/saved-searches/{id}` - Remove saved

#### Key Metrics
- Search volume per recruiter
- Click-through rate from search results
- Average time-to-hire from search

---

### 6. Application Management

#### What It Does
Track and manage applications received from candidates.

#### Features
- **Application List** - All applications for recruiter's jobs
- **Status Tracking** - View at each stage
- **Bulk Actions** - Shortlist/reject multiple
- **Search & Filter** - By job, candidate, date, status
- **Scoring** - Match score and fit assessment
- **Scheduling** - Move to interview stage
- **Notes** - Add internal notes to applications
- **Export** - Download application data

#### Application States & Flow
```
SUBMITTED → Recruiter reviews
  ├─ SHORTLISTED → Decided to interview
  │   ├─ INTERVIEW_SCHEDULED → Interview confirmed
  │   │   ├─ INTERVIEW_COMPLETED → Interview done
  │   │   │   ├─ OFFERED → Job offered
  │   │   │   │   ├─ ACCEPTED → Candidate accepted
  │   │   │   │   └─ REJECTED → Candidate rejected
  │   │   │   └─ REJECTED → Not suitable
  │   │   └─ CANCELLED → Interview cancelled
  │   └─ REJECTED → Not progressing
  └─ REJECTED → Does not fit
```

#### Application Card
```
┌────────────────────────────────┐
│ Candidate: Priya Singh          │
│ Applied For: Senior React Dev   │
│ Date: Apr 1, 2026              │
│ Status: 🟡 SHORTLISTED         │
│                                │
│ Match Score: ██████░░ 75%      │
│                                │
│ Quick Info:                    │
│ • Exp: 4 years                 │
│ • Last role: React Developer   │
│ • Trust Score: 82/100          │
│                                │
│ Recruiter Notes:               │
│ "Good React skills, schedule   │
│  tech round"                   │
│                                │
│ [View Full Profile]            │
│ [Schedule Interview]           │
│ [Send Message]                 │
│ [Reject] [Move To...]          │
└────────────────────────────────┘
```

#### Dashboard Applications Summary
```
┌────────────────────────────────────┐
│ 📋 Applications Pipeline            │
├────────────────────────────────────┤
│ Total Applications: 48              │
│                                    │
│ SUBMITTED: 12       [✓→]           │
│ SHORTLISTED: 8      [✓→ Interview] │
│ INTERVIEWS: 4       [✓→ Results]   │
│ OFFERS: 2           [✓→ Accept]    │
│ ACCEPTED: 1         [✓ Complete]   │
│ REJECTED: 21                       │
│ WITHDRAWN: 0                       │
│                                    │
│ [View All Applications]            │
└────────────────────────────────────┘
```

#### Database Tables Used
- `job_applications` - Application records
- `job_applications_questions` - Q&A responses
- `recruiter_notes` - Internal notes

#### API Endpoints
- `GET /recruiter/applications` - List applications
- `GET /recruiter/applications/{id}` - View application
- `PUT /recruiter/applications/{id}/status` - Change status
- `POST /recruiter/applications/{id}/schedule-interview` - Schedule
- `POST /recruiter/applications/{id}/notes` - Add notes
- `POST /recruiter/applications/bulk-reject` - Bulk reject

#### Key Metrics
- Applications per job
- Shortlist rate: % shortlisted
- Offer rate: % that get offers
- Acceptance rate: % offers accepted

---

### 7. Interview Scheduling

#### What It Does
Propose, schedule, and conduct interviews with candidates.

#### Features
- **Interview Proposal** - Send interview invite
- **Time Slot Selection** - Offer 3 time options
- **Calendar Integration** - Interview appears in calendar
- **Jitsi Video Link** - Auto-generated video call
- **Interview Types** - Phone screen, Technical round, HR round, Final
- **Feedback Form** - Post-interview assessment
- **Rescheduling** - Modify interview time if needed
- **Cancellation** - Cancel with reason
- **Interview History** - View all past interviews

#### User Flow
```
View shortlisted candidate
  ↓
Click "Schedule Interview"
  ↓
Select interview type: Technical Round
  ↓
Propose times:
  - Option 1: Apr 5, 2:00 PM
  - Option 2: Apr 6, 3:30 PM
  - Option 3: Apr 7, 10:00 AM
  ↓
Add interview details:
  - Description: "FastAPI assessment"
  - Expected duration: 45 mins
  ↓
Send proposal
  ↓
Candidate receives notification
  ↓
Candidate confirms preferred time
  ↓
Interview scheduled
  ↓
Jitsi link auto-generated
  ↓
Day before: Reminder sent to both
  ↓
Interview day:
  - 1 hour before: Reminder
  - 5 minutes before: "Ready?" notification
  ↓
Recruiter clicks "Join Interview"
  ↓
Jitsi video call opens
  ↓
Candidate joins from their end
  ↓
Interview conducted (45 mins)
  ↓
Interview ends
  ↓
Feedback form shown:
  - Communication: 4/5
  - Technical Skills: 3/5
  - Culture Fit: 4/5
  - Overall: 5/5
  - Add comments
  ↓
Submit feedback
  ↓
Decision: Shortlist for next, Reject, or Offer
```

#### Interview Proposal Modal
```
┌───────────────────────────────┐
│ Propose Interview - Candidate │
├───────────────────────────────┤
│ Type: [Technical Round ▼]     │
│ Description: [_______________]│
│ Duration: [45 mins ▼]         │
│                               │
│ Proposed Times:               │
│ ☐ Apr 5, 2:00 PM             │
│ ☐ Apr 6, 3:30 PM             │
│ ☑ Apr 7, 10:00 AM            │
│                               │
│ [+ Add More Times]            │
│                               │
│ Add Message:                  │
│ "Looking forward to meeting!"|
│ [________________]             │
│                               │
│    [Send Interview Proposal]  │
│    [Cancel]                   │
└───────────────────────────────┘
```

#### Database Tables Used
- `interview_proposals` - Interview invitations
- `interviews` - Confirmed interviews
- `interview_slots` - Available times
- `interview_feedback` - Post-interview assessment

#### API Endpoints
- `POST /recruiter/interviews/propose` - Send proposal
- `GET /recruiter/interviews` - List interviews
- `PUT /recruiter/interviews/{id}/reschedule` - Reschedule
- `PUT /recruiter/interviews/{id}/cancel` - Cancel
- `POST /recruiter/interviews/{id}/feedback` - Add feedback
- `GET /recruiter/interviews/{id}/jitsi-url` - Get video link

#### Key Metrics
- Interview proposal acceptance rate
- Average time from application to interview
- Interview-to-offer ratio

---

### 8. Real-time Chat

#### What It Does
Direct messaging with candidates for questions, updates, and collaboration.

#### Features
- **Message Candidate** - Initiate chat
- **Thread Management** - Organized conversations
- **Real-time Notifications** - Instant message alerts
- **File Sharing** - Share documents, videos
- **Archive Messages** - Hide old chats
- **Message History** - Search past conversations
- **Bulk Messaging** - Send same message to multiple candidates
- **Message Templates** - Pre-written message templates

#### User Flow
```
View candidate profile
  ↓
Click "Message" button
  ↓
Chat window opens
  ↓
Type: "Your experience looks great! Interested in a role?"
  ↓
Send
  ↓
Message queued
  ↓
Candidate receives notification
  ↓
Candidate responds: "Yes, tell me more!"
  ↓
Recruiter sees response instantly
  ↓
Conversation continues naturally
```

#### Chat With Bulk Option
```
┌──────────────────────────────────┐
│ Message Templates (Bulk)          │
├──────────────────────────────────┤
│                                  │
│ Template: "Initial Outreach"     │
│ ─────────────────────────────────│
│ Hi [Name],                       │
│                                  │
│ Your profile caught our eye!     │
│ We have an interesting role      │
│ that matches your skills.        │
│                                  │
│ Would you like to chat?          │
│                                  │
│ [+ Personalize]                  │
│ [Send to 1 selected]             │
│ [Send to 5 selected]             │
│ [Save as Template]               │
│                                  │
│ [Cancel] [Send]                  │
└──────────────────────────────────┘
```

#### Database Tables Used
- `chat_threads` - Conversations
- `chat_messages` - Messages
- `message_templates` - Template library

#### API Endpoints
- `GET /recruiter/chat/threads` - List conversations
- `POST /recruiter/chat/send` - Send message
- `POST /recruiter/chat/send-bulk` - Bulk message
- `GET /recruiter/chat/templates` - List templates
- `POST /recruiter/chat/templates` - Save template

#### Key Metrics
- Average response time from recruiter
- Message engagement rate
- Message-to-interview conversion

---

### 9. Team Management

#### What It Does
Manage sub-accounts for team members if recruiter is company admin.

#### Features
- **Add Team Members** - Invite recruiters to platform
- **Role Assignment** - Admin, Hiring Manager, Recruiter
- **Permission Control** - Who can post jobs, view analytics
- **Activity Monitoring** - See team activity
- **Team Chat** - Internal team communication
- **Deactivate Account** - Remove team member access

#### User Flow (Admin Only)
```
Click "Team Management"
  ↓
View existing team members
  ↓
Click "Add Team Member"
  ↓
Enter:
  - Email: recruiter@company.com
  - Name: John HR Manager
  - Role: Hiring Manager
  ↓
Set permissions:
  - Can post jobs: Yes
  - Can view all candidates: Yes
  - Can manage team: No
  - Can access analytics: Yes
  ↓
Send invite
  ↓
Recruiter receives invite email
  ↓
Clicks email link
  ↓
Sets password
  ↓
From now: Can access company account with role permissions
```

#### Team Member Card
```
┌────────────────────────────────┐
│ John HR Manager                │
│ Role: Hiring Manager           │
│ Email: john@company.com        │
│ Active Status: 🟢 Online       │
│ Last Active: 2 hours ago       │
│                                │
│ Permissions:                   │
│ • Post jobs: ✓                 │
│ • View candidates: ✓           │
│ • Manage analytics: ✓          │
│ • Manage team: ✗               │
│                                │
│ Activity: Posted 5 jobs, 45    │
│ messages sent this week        │
│                                │
│ [Edit] [Deactivate]            │
└────────────────────────────────┘
```

#### Database Tables Used
- `users` - Team member accounts
- `user_roles` - Role assignment
- `user_permissions` - Permission matrix

#### API Endpoints
- `POST /recruiter/team` - Add member
- `GET /recruiter/team` - List team
- `PUT /recruiter/team/{id}` - Edit member
- `DELETE /recruiter/team/{id}` - Deactivate
- `GET /recruiter/team/{id}/activity` - Activity log

#### Key Metrics
- Team member count
- Team utilization: % active each day

---

### 10. Hiring Pipeline Analysis

#### What It Does
Visualize and analyze the complete hiring pipeline from application to hire.

#### Features
- **Pipeline Visualization** - Funnel showing each stage
- **Stage Metrics** - Numbers in each stage
- **Conversion Rates** - % moving to next stage
- **Time Metrics** - Average time in each stage
- **Drop-off Analysis** - Where candidates exit
- **Job Comparison** - Compare metrics across jobs
- **Export Report** - Download pipeline data

#### Pipeline Dashboard
```
┌───────────────────────────────────────────┐
│ 📊 Hiring Pipeline (Senior Dev Role)      │
├───────────────────────────────────────────┤
│                                           │
│ Applied         Shortlisted  Interviews  │
│   50              18 (36%)      8 (44%)  │
│ ████████████     ████           ████    │
│                                           │
│ Offer          Accepted        Rejected  │
│   2 (25%)        1 (50%)         42      │
│   ██             █               ██████ │
│                                           │
│ Statistics:                               │
│ • Avg time to shortlist: 3 days         │
│ • Avg time to interview: 5 days         │
│ • Avg time to offer: 8 days             │
│ • Total cycle time: ~16 days            │
│ • Conversion rate: 2% (applied→hired)   │
│                                           │
│ [View Details] [Export Report]           │
└───────────────────────────────────────────┘
```

#### Database Tables Used
- `job_applications` - All application records
- `interview_feedback` - Interview results

#### API Endpoints
- `GET /recruiter/pipeline/{job_id}` - Pipeline data
- `GET /recruiter/pipeline/analytics` - Detailed metrics
- `GET /recruiter/pipeline/report` - Generate report

#### Key Metrics
- Conversion rates at each stage
- Average cycle time
- Drop-off rate
- Channel effectiveness (where applicants came from)

---

### 11. Company Analytics

#### What It Does
Comprehensive analytics on company hiring performance and candidate pool.

#### Features
- **Company Stats** - Total employees, hiring rate
- **Candidate Reach** - Profile views, messages sent
- **Application Metrics** - Applications received, offer rate
- **Hiring Trend** - Hiring over time
- **Department Insights** - Hiring by department
- **Time-to-Hire** - Average days to fill role
- **Cost-per-Hire** - If applicable
- **Candidate Source** - Where candidates come from

#### Analytics Dashboard
```
┌──────────────────────────────────────┐
│ 📈 Company Analytics (This Month)    │
├──────────────────────────────────────┤
│ Total Applications: 234               │
│ Shortlist Rate: 28%                  │
│ Offer Rate: 15%                      │
│ Acceptance Rate: 67%                 │
│                                      │
│ Hires This Month: 8                  │
│ Avg Time-to-Hire: 18 days            │
│ Open Positions: 12                   │
│                                      │
│ Profile Views: 2,450                 │
│ Candidate Saved Rate: 12%            │
│ Message Sent: 180                    │
│                                      │
│ Top Hiring Departments:              │
│ • Engineering: 5 hires               │
│ • Sales: 2 hires                     │
│ • HR: 1 hire                         │
│                                      │
│ [Detailed Report] [Export]           │
└──────────────────────────────────────┘
```

#### Database Tables Used
- `job_applications` - Application tracking
- `profile_views` - Analytics data
- `interviews` - Interview tracking

#### API Endpoints
- `GET /recruiter/analytics/overview` - Summary stats
- `GET /recruiter/analytics/hiring-trend` - Trend data
- `GET /recruiter/analytics/by-department` - Department breakdown
- `GET /recruiter/analytics/report` - Full report

#### Key Metrics
- Monthly hiring rate
- Hiring effectiveness score
- Cost per hire (if applicable)

---

### 12. Bulk Upload (Admin)

#### What It Does
Admin feature to bulk upload candidate databases (from previous ATS, CSV exports, etc.).

#### Features
- **File Upload** - CSV + resume ZIP
- **Auto-Parsing** - Extract resume data
- **Duplicate Detection** - Flag duplicates
- **Validation** - Check data integrity
- **Import Preview** - Review before import
- **Progress Tracking** - Real-time upload status
- **Auto-Invitation** - Send OTP to candidates
- **Error Reporting** - List any failed imports

#### User Flow (Admin Only)
```
Click "Admin" → "Bulk Upload"
  ↓
Click "Upload Candidates"
  ↓
Select CSV file with candidate data
  ↓
Select ZIP file with resumes
  ↓
Click "Validate & Preview"
  ↓
System processes:
  - Extracts resume files
  - Parses each resume with Gemini
  - Checks for duplicates
  - Validates email format
  ↓
Shows preview:
  - 450 candidates found
  - 12 duplicates (review)
  - 5 invalid email addresses
  ↓
Admin clicks "Import"
  ↓
Backend:
  - Creates candidate profiles
  - Auto-generates passwords
  - Sends OTP + login link via email
  - Stores resume data
  ↓
Real-time progress bar updates
  ↓
Completion: "450 candidates imported successfully"
```

#### Database Tables Used
- `bulk_uploads` - Upload metadata
- `candidates` - Auto-created profiles
- `resume_data` - Parsed resume content

#### API Endpoints
- `POST /admin/bulk-upload/initialize` - Start upload
- `POST /admin/bulk-upload/validate` - Validate data
- `POST /admin/bulk-upload/import` - Import candidates
- `GET /admin/bulk-upload/status` - Check progress
- `GET /admin/bulk-upload/duplicates` - Review duplicates

#### Key Metrics
- Upload success rate
- Time to process uploads
- Duplicate detection accuracy

---

### 13. Candidate Verification & Trust Score

#### What It Does
Verify candidate credentials and trust within the platform.

#### Features
- **Trust Score Display** - 0-100 score
- **Verification Checks** - Email, phone, experience
- **Identity Proof** - View ID verification
- **Assessment Scores** - Skill verification
- **Experience History** - Verify work history
- **Reference Checks** - From other recruiters
- **Warning Flags** - Account-specific alerts

#### Trust Score on Candidate Card
```
┌──────────────────────────────┐
│ Verification Status          │
├──────────────────────────────┤
│ ✓ Email verified (Apr 1)    │
│ ✓ Phone verified (Apr 1)    │
│ ✓ Assessment: 82/100        │
│ ⚠ No identity proof yet     │
│ ? Experience unverified     │
│                              │
│ Overall Trust: 72/100       │
│ ██████░░░░ 72%              │
│                              │
│ Status: VERIFIED            │
│ 🟢 Good to hire              │
└──────────────────────────────┘
```

#### Database Tables Used
- `candidates.trust_score` - Verification score
- `candidate_identity` - ID proof
- `assessment_results` - Skill scores
- `candidate_warnings` - Flags/alerts

#### API Endpoints
- `GET /recruiter/candidates/{id}/trust-score` - Get score
- `GET /recruiter/candidates/{id}/verification` - Verification status

#### Key Metrics
- % of candidates verified
- Average trust score in pool

---

## 🔗 Feature Interactions

### Pre-Application Flow
```
Post job
  ↓
AI finds matching candidates
  ↓
Candidates see in recommendations
  ↓
Candidates apply
  ↓
Recruiter sees applications
```

### Hiring Flow
```
Application received
  ↓
Recruiter shortlists
  ↓
Recruiter proposes interview
  ↓
Candidate confirms time
  ↓
Interview scheduled
  ↓
Both join Jitsi call
  ↓
Recruiter submits feedback
  ↓
Offer decision
  ↓
If accepted: Hire complete
```

### Analytics Flow
```
Recruiter posts job
  ↓
System tracks: job views, profile clicks, applications
  ↓
Recruiter conducts interviews
  ↓
Analytics accumulate
  ↓
In dashboard: Pipeline visualization shows conversion rates
  ↓
Recruiter can export report
```

---

## 👤 User Workflows

### Workflow 1: New Company Onboarding
```
1. Create company account
2. Fill company profile
3. Add company branding
4. Invite team members (optional)
5. Post first job
6. Start searching candidates
7. Extend invites
```

### Workflow 2: Active Hiring Manager
```
1. Login daily
2. Review applications
3. Shortlist promising candidates
4. Schedule interviews
5. Conduct interviews
6. Make offers
7. Track hiring pipeline
```

### Workflow 3: Bulk Hiring (Seasonal)
```
1. (As admin) Upload bulk candidates
2. Review duplicates
3. Send batch invitations
4. Filter for specific roles
5. Mass-screen candidates
6. Pipeline management
```

---

## 🎓 Conclusion

The Recruiter Dashboard is designed to:
- ✅ **Streamline** talent discovery through AI recommendations
- ✅ **Automate** resume parsing and initial screening
- ✅ **Accelerate** hiring through smart scheduling
- ✅ **Improve** decision-making with analytics
- ✅ **Scale** team hiring with bulk import
- ✅ **Enable** collaboration across team members

All features work together to create an efficient, data-driven recruiting experience.
