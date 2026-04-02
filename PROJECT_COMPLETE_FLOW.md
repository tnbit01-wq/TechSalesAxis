# TalentFlow: Complete Project Flow & Architecture

**Version:** 1.0  
**Last Updated:** April 2, 2026  
**Status:** Production Ready

---

## 📋 Table of Contents

1. [System Overview](#system-overview)
2. [Technology Stack](#technology-stack)
3. [Architecture Diagram](#architecture-diagram)
4. [Complete User Flows](#complete-user-flows)
5. [Data Flow](#data-flow)
6. [Integration Points](#integration-points)
7. [Deployment Architecture](#deployment-architecture)

---

## 🎯 System Overview

### Project Mission
TalentFlow is an **AI-driven verified talent marketplace** that creates a trust-based hiring ecosystem through:
- ✅ Verified candidates and companies
- ✅ AI-powered skill assessment
- ✅ Resume parsing and structured data extraction
- ✅ Fair hiring with anti-cheat enforcement
- ✅ AI-matched job recommendations
- ✅ Virtual interview scheduling

### Core Stakeholders
1. **Candidates** - Job seekers
2. **Recruiters** - Hiring managers from companies
3. **Admins** - Platform administrators
4. **System** - AI engines and background services

---

## 🏗️ Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Next.js 16 + React 19 + TypeScript + Tailwind CSS 4.0 | Web UI, real-time updates |
| **Backend** | FastAPI (Python) + SQLAlchemy ORM | RESTful API, business logic |
| **Database** | AWS RDS (PostgreSQL) - ap-south-1 (Mumbai) | Primary data store |
| **Authentication** | Custom JWT + AWS Secrets Manager | Secure session management |
| **AI Services** | Google Gemini 1.5 Flash + Groq Llama 3.3 (70B) | Assessment, parsing, recommendations |
| **Storage** | AWS S3 (ap-south-1) + CloudFront CDN | File storage, resume hosting |
| **Email** | AWS SES | OTP, password reset, notifications |
| **Video** | Jitsi Meet (open-source) | Virtual interviews |
| **Job Queue** | Celery + Redis (optional) | Background tasks, bulk processing |
| **Analytics** | Custom ORM tracking | Platform insights |

---

## 🔄 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                           │
├─────────────────────────────────────────────────────────────────┤
│  Next.js Frontend (React + TypeScript)                          │
│  ├─ Candidate Dashboard (Jobs, Profile, Assessment, Chat)      │
│  ├─ Recruiter Dashboard (Talents, Interviews, Analytics)       │
│  └─ Admin Dashboard (Users, Bulk Uploads, Settings)            │
└────────────┬────────────────────────────────────────────────────┘
             │ HTTP/HTTPS
┌────────────▼────────────────────────────────────────────────────┐
│                    API GATEWAY LAYER                            │
├─────────────────────────────────────────────────────────────────┤
│  FastAPI Server (Python)                                        │
│  ├─ Auth Routes (login, signup, OTP, password)                 │
│  ├─ Candidate Routes (profile, jobs, recommendations)          │
│  ├─ Recruiter Routes (talents, interviews, jobs)               │
│  ├─ Assessment Routes (questions, answers, results)            │
│  ├─ Chat & Notifications Routes                                │
│  ├─ Admin Routes (dashboard, user management)                  │
│  └─ Bulk Upload Routes (parsing, validation, sync)             │
└────────────┬────────────────────────────────────────────────────┘
             │
    ┌────────┴────────┐
    │                 │
┌───▼────┐       ┌───▼──────────────┐
│  S3    │       │  PostgreSQL RDS  │
│(Files) │       │  (Data Store)    │
└────────┘       └──────┬───────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
┌───────▼────┐  ┌──────▼────┐  ┌──────▼────┐
│  Gemini    │  │   Groq    │  │ AWS SES   │
│  AI Engine │  │LLM (Auth) │  │  (Email)  │
└────────────┘  └───────────┘  └────────────┘

        ┌─────────────────────────┐
        │   Jitsi Meet Video      │
        │  (Interview Scheduling) │
        └─────────────────────────┘
```

---

## 🔀 Complete User Flows

### Flow 1: Candidate Registration & Onboarding

```
1. SIGNUP FLOW
   ↓
   Candidate visits /signup
   ↓
   Enter email → Click signup
   ↓
   OTP sent via AWS SES
   ↓
   Candidate enters OTP → Verify
   ↓
   Redirect to /auth/candidate/login
   ↓

2. LOGIN & PROFILE SETUP
   ↓
   Enter email/password → Login
   ↓
   JWT token generated
   ↓
   Redirect to /dashboard/candidate
   ↓
   Complete profile: name, skills, experience, location
   ↓
   Upload resume (PDF/DOCX)
   ↓
   Resume parsing: Extract fields using Gemini
   ↓
   Data stored in resume_data table
   ↓
   Profile completion score calculated
   ↓
   Candidate enters dashboard
```

#### Database Objects Created:
- `users` - Basic auth details
- `candidates` - Profile info
- `candidate_experience` - Work history
- `candidate_skills` - Skills list
- `resume_data` - Extracted resume fields

### Flow 2: Candidate Assessment & Trust Score

```
1. ASSESSMENT INITIATION
   ↓
   Candidate clicks "Take Assessment"
   ↓
   System selects level: FRESHER/MID/SENIOR/LEADERSHIP
   ↓
   Check if retake allowed (based on last_attempt)
   ↓

2. ADAPTIVE ASSESSMENT (6-16 questions)
   ↓
   Question 1 → Candidate answers
   ↓
   Backend scores answer (AI evaluation)
   ↓
   Difficulty calculation: adjust next question difficulty
   ↓
   Repeat until: 16 questions or threshold met
   ↓
   Tab-switch detection: auto-ban if 3+ switches
   ↓

3. ASSESSMENT COMPLETION
   ↓
   Calculate final score (0-100)
   ↓
   Generate Trust Score with feedback
   ↓
   Store assessment results
   ↓
   Generate PDF report if requested
   ↓
   Update candidate_profile.trust_score
   ↓
   Display results + strengths/weaknesses
```

#### Database Objects Created:
- `assessments` - Assessment metadata
- `assessment_responses` - Candidate answers
- `assessment_results` - Final scores and feedback

### Flow 3: Job Search & Recommendations

```
1. JOB DISCOVERY
   ↓
   Candidate views /dashboard/candidate/jobs
   ↓
   Frontend calls GET /candidate/jobs
   ↓
   Backend returns paginated jobs with:
     - Matching score (0-100)
     - Match breakdown
     - Company info
   ↓

2. RECOMMENDATION ENGINE
   ↓
   Backend (recommendation_service.py) calculates:
     - Skills overlap: 40%
     - Experience band match: 25%
     - Location compatibility: 20%
     - Salary alignment: 10%
     - Role relevance: 5%
   ↓
   Score stored in candidate_job_sync table
   ↓
   Color-coded: 🟢 85%+, 🟡 70-85%, ⚪ <70%
   ↓

3. JOB INTERACTION
   ↓
   Candidate clicks job → View details
   ↓
   Option to: Save, Apply, or Share
   ↓
   Save job: INSERT into saved_jobs
   ↓
   Apply to job: 
      - Create job_applications record
      - Send notification to recruiter
      - Update analytics
   ↓
```

#### Database Objects Modified:
- `candidate_job_sync` - Recommendation scores
- `saved_jobs` - Bookmarked opportunities
- `job_applications` - Applications sent

---

### Flow 4: Recruiter Talent Search & Hiring

```
1. RECRUITER LOGIN
   ↓
   Recruiter enters credentials → Login
   ↓
   JWT token generated
   ↓
   Redirect to /dashboard/recruiter
   ↓

2. TALENT DISCOVERY
   ↓
   Recruiter visits /dashboard/recruiter/intelligence/recommendations
   ↓
   Backend serves candidates with matching scores
   ↓
   Three filter modes:
      a) Culture Fit - Company ICP alignment
      b) Skills Match - Job requirement coverage
      c) Expert View - AI-powered insights
   ↓

3. CANDIDATE RANKING
   ↓
   Candidates grouped by score tier:
      - Elite: 85%+
      - Strong: 60-84%
      - Potential: <60%
   ↓
   Each candidate shows:
      - Profile + photo
      - Skills match %
      - Experience match
      - Location
      - Trust score
      - Match reasoning
   ↓

4. CANDIDATE ENGAGEMENT
   ↓
   Recruiter selects candidate
   ↓
   Option: View full profile, Send invite, Message
   ↓
   Send invite:
      - Create interview_proposal record
      - Send notification to candidate
      - Message appears in chat
   ↓
   Candidate accepts/rejects via dashboard
   ↓

5. INTERVIEW SCHEDULING
   ↓
   Recruiter proposes interview date/time
   ↓
   Candidate confirms via /dashboard/candidate/interviews
   ↓
   Jitsi Meet link generated
   ↓
   Interview scheduled in calendar
   ↓
   Both parties join at scheduled time
   ↓

6. FEEDBACK & ANALYTICS
   ↓
   Post-interview feedback stored
   ↓
   Analytics updated:
      - View count
      - Application rate
      - Hire percentage
   ↓
```

#### Database Objects Created:
- `job_applications` - Applications from candidates
- `interview_proposals` - Interview invitations
- `interview_feedback` - Post-interview notes
- `recruiter_views` - Analytics tracking

### Flow 5: Bulk Upload & Resume Parsing

```
1. ADMIN BULK UPLOAD
   ↓
   Admin visits /admin/bulk-upload
   ↓
   Click "Upload" → Select CSV + resumes (ZIP)
   ↓
   Frontend calls POST /api/v1/bulk-upload/initialize
   ↓

2. BACKEND PROCESSING
   ↓
   Extract resume files
   ↓
   Virus scan each file (ClamAV if available)
   ↓
   Parse resume metadata
   ↓
   For each entry:
      - Email validation
      - Resume extraction using Gemini
      - Skill normalization
      - Experience mapping
   ↓

3. DUPLICATE DETECTION
   ↓
   Hash each resume file
   ↓
   Check against existing hashes
   ↓
   Flag duplicates for admin review
   ↓
   Variants on potential duplicates:
      - Same person, different resume
      - Completely new candidate
   ↓

4. AUTO-INVITATION
   ↓
   Create candidate profiles
   ↓
   Auto-generate passwords (email for access)
   ↓
   Send OTP + login link via AWS SES
   ↓
   Candidates login and complete profile
   ↓

5. COMPLETION & ANALYTICS
   ↓
   Upload status: COMPLETED
   ↓
   Admin sees:
      - Total uploaded: N
      - Processed: N
      - Duplicates: N
      - Failed: N
   ↓
   Download processed data
   ↓
```

#### Database Objects Created:
- `bulk_uploads` - Upload metadata
- `bulk_upload_items` - Individual entries
- `candidates` - Auto-created profiles
- `resume_data` - Parsed resume fields

### Flow 6: Chat & Real-time Messaging

```
1. MESSAGE INITIATION
   ↓
   Candidate/Recruiter opens chat
   ↓
   Click on conversation or "New Message"
   ↓

2. MESSAGE SENDING
   ↓
   Type message → Click send
   ↓
   Frontend calls POST /chat/send
   ↓
   Backend:
      - Creates chat_messages record
      - Creates/Updates chat_thread
      - Sends real-time notification
   ↓
   Frontend receives message immediately
   ↓

3. THREAD MANAGEMENT
   ↓
   Conversation groups messages by participants
   ↓
   Options: Archive, Mute, Delete
   ↓
   Archive: Messages hidden but not deleted
   ↓
   Delete: Permanently removed
   ↓

4. NOTIFICATIONS
   ↓
   Real-time socket notification sent
   ↓
   If recipient offline: Queue in notifications table
   ↓
   Show unread count badge
   ↓
```

#### Database Objects Used:
- `chat_threads` - Conversations
- `chat_messages` - Individual messages
- `notifications` - In-app alerts

### Flow 7: Admin Dashboard & User Management

```
1. ADMIN LOGIN
   ↓
   Admin credentials (special role: 'admin')
   ↓
   Redirect to /admin/dashboard
   ↓

2. USER MANAGEMENT
   ↓
   View all users (candidates + recruiters)
   ↓
   Search by email, name
   ↓
   Actions: View profile, Suspend, Delete
   ↓

3. BULK UPLOAD MANAGEMENT
   ↓
   View all uploads
   ↓
   Filter by: Status, Date, Source
   ↓
   Review duplicates for each upload
   ↓
   Approve/Reject duplicates
   ↓

4. SETTINGS & CONFIGURATION
   ↓
   Update platform settings
   ↓
   Configure assessment levels
   ↓
   Manage trust score thresholds
   ↓

5. ANALYTICS & REPORTING
   ↓
   View dashboard stats:
      - Total users
      - Active sessions
      - Jobs posted
      - Applications pending
      - Assessment completion rate
   ↓
```

#### Database Objects Managed:
- `users` - All accounts
- `bulk_uploads` - Upload status
- `platform_settings` - Configuration

---

## 📊 Data Flow

### Synchronous Flow (Real-time)
```
Frontend Request 
   → API Gateway (FastAPI)
   → Route Handler
   → Service Layer (Business Logic)
   → Database Query
   → Response
   → Frontend Display
   (Average: 100-500ms)
```

### Asynchronous Flow (Background)
```
Frontend Triggers Event
   → API accepts request
   → Job queued (Celery/Redis)
   → Returns acknowledgment
   → Background worker processes:
      - Resume parsing
      - Email sending
      - Recommendation calculation
   → Result stored in DB
   → Frontend polls for completion
   (Average: 5-60 seconds)
```

### Real-time Chat Flow
```
Sender Types Message
   → POST /chat/send
   → Message saved to DB
   → WebSocket event emitted
   → Recipient receives instantly
   → Show in UI immediately
```

---

## 🔗 Integration Points

### External APIs
1. **Google Gemini API**
   - Resume parsing
   - Assessment question generation
   - Recommendation scoring
   - Candidate feedback generation

2. **Groq API (LLama 3.3 70B)**
   - Fallback AI for assessments
   - Context-aware ICP extraction

3. **AWS Services**
   - **RDS PostgreSQL** - Database
   - **S3** - File storage (resumes, profiles)
   - **CloudFront** - CDN for files
   - **SES** - Email (OTP, notifications)
   - **Secrets Manager** - JWT secret, API keys

4. **Jitsi Meet**
   - Video interview hosting
   - No authentication needed (open-source)
   - Self-hosted or SaaS option

### Internal Integrations
1. **Resume Parser** → Candidate Profile → Matching Engine
2. **Assessment Results** → Trust Score → Job Recommendations
3. **Job Applications** → Notifications → Chat
4. **Analytics** → Dashboard Stats → Platform KPIs

---

## 🚀 Deployment Architecture

### Production Setup (AWS)

```
┌─────────────────┐
│  CloudFront     │ ← CDN for frontend + S3 files
└────────┬────────┘
         │
┌────────▼────────────────┐
│   AWS ALB / Route 53    │ ← Domain routing
└────────┬────────────────┘
         │
    ┌────┴────┐
    │          │
┌───▼──┐  ┌───▼──────┐
│ ECS  │  │ ECS      │
│ Next │  │ FastAPI  │ ← Docker containers
└──────┘  └───┬──────┘
             │
    ┌────────┴────────┐
    │                 │
┌───▼──────┐   ┌─────▼────┐
│ RDS      │   │ S3        │
│PostgreSQL│   │ (Storage) │
└──────────┘   └───────────┘
```

### Local Development Setup
```
Project Root
├── apps/api/          (FastAPI backend)
├── apps/web/          (Next.js frontend)
├── packages/shared/   (Shared types)
├── .env               (Local configuration)
└── .venv/             (Python virtual env)

Start:
Terminal 1: uvicorn src.main:app --reload (Port 8005)
Terminal 2: npm run dev (Port 3000)
```

---

## 🔐 Security Features

1. **Authentication** - JWT with refresh tokens
2. **Authorization** - Role-based access control (RBAC)
3. **Password Security** - Hashed with salt
4. **Resume Security** - Virus scanning, encrypted in transit
5. **Anti-Cheat** - Tab-switch detection in assessments
6. **Rate Limiting** - OTP attempts limited
7. **CORS** - Restricted to trusted origins
8. **SQL Injection** - SQLAlchemy ORM protection
9. **XSS Protection** - React escaping by default

---

## 📈 Performance Optimization

1. **Database Indexing** - Frequent query fields indexed
2. **Caching** - JWT tokens cached in memory
3. **CDN** - Static assets via CloudFront
4. **Lazy Loading** - Components loaded on demand
5. **Pagination** - Large result sets paginated
6. **Debouncing** - Search/filter requests debounced
7. **Compression** - Gzip for API responses

---

## 🔍 Monitoring & Logging

- **API Logs** - Request/response logged to stdout
- **Database Logs** - Query performance monitored
- **Error Tracking** - Exceptions logged with traceback
- **User Analytics** - Events tracked in analytics tables
- **Performance Metrics** - Response times monitored

---

## 📝 Conclusion

TalentFlow is a **comprehensive, production-ready AI-powered recruitment platform** with:
- ✅ Multi-role support (candidate, recruiter, admin)
- ✅ AI-driven matching and assessment
- ✅ Real-time chat and notifications
- ✅ Bulk import with intelligent parsing
- ✅ Analytics and insights
- ✅ Enterprise-grade security

All components are integrated, tested, and ready for scaling.
