# Database Structure - Complete Reference for Backup & Migration

**Version:** 1.0  
**Last Updated:** April 2, 2026  
**Database:** PostgreSQL 14+  
**Purpose:** System Administration, Backup, Migration, Disaster Recovery

---

## 📋 Table of Contents

1. [Database Overview](#database-overview)
2. [Entity-Relationship Diagram](#entity-relationship-diagram)
3. [User & Authentication Tables](#user--authentication-tables)
4. [Candidate Profile Tables](#candidate-profile-tables)
5. [Recruiter & Company Tables](#recruiter--company-tables)
6. [Job & Application Tables](#job--application-tables)
7. [Assessment Tables](#assessment-tables)
8. [Interview & Video Tables](#interview--video-tables)
9. [Chat & Communication Tables](#chat--communication-tables)
10. [Analytics & Tracking Tables](#analytics--tracking-tables)
11. [Backup & Recovery Procedures](#backup--recovery-procedures)
12. [Migration Procedures](#migration-procedures)

---

## 🗄️ Database Overview

### Basic Information
```
Database Name: talentflow
Database Type: PostgreSQL 14+
Region: ap-south-1 (Mumbai)
Instance Type: AWS RDS
Storage: ~50GB (varies with data)
Connections: Max 100 concurrent
Encoding: UTF8
```

### Connection String Format
```
postgresql://username:password@endpoint:5432/talentflow

Example:
postgresql://postgres:tX6v2KraCehQkZR@talentflow-db.cjymcuai297y.ap-southeast-2.rds.amazonaws.com:5432/talentflow
```

### Table Count: 40+ tables
- Core entities: 15 tables
- Analytics & tracking: 8 tables
- Assessment system: 6 tables
- Communication: 4 tables
- Configuration: 3 tables

---

## 📊 Entity-Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CORE ENTITIES                               │
├─────────────────────────────────────────────────────────────────────┤

                            users (base)
                           /    |    \
                          /     |     \
                  candidates  recruiters  admins
                      |          |
                      |          |
            ┌─────────┴──────┐  │
            │                │  │
    candidate_experience     │  │
    candidate_skills         │  │
    candidate_education      │  companies
    resume_data              │  company_branding
            │                │  company_locations
            └─────────────────┼──┬─────────────
                              │  │
                         ┌────▼──▼────┐
                         │   jobs     │
                         │   posts    │
                         └────┬───────┘
                              │
            ┌─────────────────┼─────────────────┐
            │                 │                 │
      job_applications   interviews      chat_threads
      job_skills      job_matches     chat_messages
            │                 │                 │
      assessment        interview_         notifications
      assessment_       proposals
      responses         interview_
      assessment_       feedback
      results
```

---

## 👤 User & Authentication Tables

### Table: users

**Purpose:** Core user accounts and authentication

**Schema:**
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,  -- CANDIDATE, RECRUITER, ADMIN
    status VARCHAR(50) DEFAULT 'ACTIVE',  -- ACTIVE, SUSPENDED, DELETED, BANNED
    phone_verified BOOLEAN DEFAULT FALSE,
    email_verified BOOLEAN DEFAULT FALSE,
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes:
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);
```

**Relationships:**
- 1-to-1 with candidates
- 1-to-1 with recruiters
- 1-to-many with chat_threads (as sender/receiver)
- 1-to-many with notifications

**Row Count Estimate:** 5,000-50,000 rows

---

## 👨 Candidate Profile Tables

### Table: candidates

**Purpose:** Candidate profile information

**Schema:**
```sql
CREATE TABLE candidates (
    id UUID PRIMARY KEY,
    user_id UUID UNIQUE NOT NULL REFERENCES users(id),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    profile_photo_url VARCHAR(511),
    bio TEXT,
    location VARCHAR(255),
    current_company VARCHAR(255),
    current_title VARCHAR(255),
    years_of_experience DECIMAL(3,1),
    notice_period_days INT,
    preferred_locations VARCHAR[],
    preferred_job_types VARCHAR[],  -- Full-time, Part-time, Contract, etc.
    expected_salary_min BIGINT,
    expected_salary_max BIGINT,
    trust_score DECIMAL(3, 1) DEFAULT 0,  -- 0-100
    profile_completion_percent INT DEFAULT 0,  -- 0-100
    resume_url VARCHAR(511),
    resume_parsed_at TIMESTAMP,
    assessment_level VARCHAR(50),  -- FRESHER, MID, SENIOR, LEADERSHIP
    last_assessment_date TIMESTAMP,
    verification_fields JSONB,  -- Tracks which fields are verified
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes:
CREATE INDEX idx_candidates_user_id ON candidates(user_id);
CREATE INDEX idx_candidates_location ON candidates(location);
CREATE INDEX idx_candidates_trust_score ON candidates(trust_score);
CREATE INDEX idx_candidates_experience ON candidates(years_of_experience);
```

**Relationships:**
- 1-to-1 with users
- 1-to-many with candidate_experience
- 1-to-many with candidate_skills
- 1-to-many with candidate_education
- 1-to-many with resume_data
- 1-to-many with job_applications
- 1-to-many with candidate_job_sync (recommendations)
- 1-to-many with interviews
- 1-to-many with chat_threads

**Row Count Estimate:** 4,000-40,000 rows

---

### Table: candidate_experience

**Purpose:** Work history records

**Schema:**
```sql
CREATE TABLE candidate_experience (
    id UUID PRIMARY KEY,
    candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    job_title VARCHAR(255),
    company_name VARCHAR(255),
    industry VARCHAR(255),
    employment_type VARCHAR(50),  -- Full-time, Part-time, Internship, etc.
    start_date DATE,
    end_date DATE,
    currently_working BOOLEAN DEFAULT FALSE,
    location VARCHAR(255),
    description TEXT,
    skills_used VARCHAR[],  -- Array of skills
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes:
CREATE INDEX idx_candidate_experience_candidate_id ON candidate_experience(candidate_id);
```

**Row Count Estimate:** 6,000-80,000 rows (avg 1.5-2 experiences per candidate)

---

### Table: candidate_skills

**Purpose:** Skills endorsements and proficiency levels

**Schema:**
```sql
CREATE TABLE candidate_skills (
    id UUID PRIMARY KEY,
    candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    skill_name VARCHAR(255),
    proficiency_level VARCHAR(50),  -- BEGINNER, INTERMEDIATE, ADVANCED, EXPERT
    endorsement_count INT DEFAULT 0,
    endorsed_by UUID[],  -- Array of user IDs who endorsed
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes:
CREATE INDEX idx_candidate_skills_candidate_id ON candidate_skills(candidate_id);
CREATE INDEX idx_candidate_skills_skill ON candidate_skills(skill_name);
```

**Row Count Estimate:** 15,000-120,000 rows (avg 3-4 skills per candidate)

---

### Table: candidate_education

**Purpose:** Education history

**Schema:**
```sql
CREATE TABLE candidate_education (
    id UUID PRIMARY KEY,
    candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    institution_name VARCHAR(255),
    degree VARCHAR(255),  -- B.Tech, M.Tech, MBA, etc.
    field_of_study VARCHAR(255),
    start_date DATE,
    end_date DATE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes:
CREATE INDEX idx_candidate_education_candidate_id ON candidate_education(candidate_id);
```

**Row Count Estimate:** 4,500-50,000 rows

---

### Table: resume_data

**Purpose:** Auto-extracted resume field structured data

**Schema:**
```sql
CREATE TABLE resume_data (
    id UUID PRIMARY KEY,
    candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    phone VARCHAR(20),
    email VARCHAR(255),
    name VARCHAR(255),
    summary TEXT,
    skills JSONB,  -- {skill_name: proficiency_level}
    experience JSONB,  -- Array of {title, company, duration}
    education JSONB,  -- Array of {degree, institution}
    certifications JSONB,  -- Array of certs
    languages JSONB,  -- {language: proficiency}
    parsed_at TIMESTAMP,
    confidence_score DECIMAL(3, 1),  -- Parsing accuracy 0-100
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes:
CREATE INDEX idx_resume_data_candidate_id ON resume_data(candidate_id);
```

**Row Count Estimate:** 3,500-40,000 rows

---

## 🏢 Recruiter & Company Tables

### Table: recruiters

**Purpose:** Recruiter/Hiring manager profile

**Schema:**
```sql
CREATE TABLE recruiters (
    id UUID PRIMARY KEY,
    user_id UUID UNIQUE NOT NULL REFERENCES users(id),
    company_id UUID NOT NULL REFERENCES companies(id),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    title VARCHAR(255),  -- HR Manager, CTO, Founder, etc.
    department VARCHAR(255),
    phone VARCHAR(20),
    profile_photo_url VARCHAR(511),
    bio TEXT,
    linkedin_url VARCHAR(511),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes:
CREATE INDEX idx_recruiters_user_id ON recruiters(user_id);
CREATE INDEX idx_recruiters_company_id ON recruiters(company_id);
```

**Row Count Estimate:** 800-10,000 rows

---

### Table: companies

**Purpose:** Company profiles and information

**Schema:**
```sql
CREATE TABLE companies (
    id UUID PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    website VARCHAR(511),
    industry VARCHAR(255),
    company_size VARCHAR(50),  -- Small, Medium, Large, Enterprise
    founded_year INT,
    description TEXT,
    logo_url VARCHAR(511),
    headquarters_location VARCHAR(255),
    total_employees INT,
    company_trust_score DECIMAL(3, 1) DEFAULT 50,  -- 0-100
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes:
CREATE INDEX idx_companies_name ON companies(name);
CREATE INDEX idx_companies_trust_score ON companies(company_trust_score);
```

**Row Count Estimate:** 500-5,000 rows

---

### Table: company_branding

**Purpose:** Company visual branding and culture

**Schema:**
```sql
CREATE TABLE company_branding (
    id UUID PRIMARY KEY,
    company_id UUID UNIQUE NOT NULL REFERENCES companies(id),
    primary_color VARCHAR(7),  -- Hex color
    secondary_color VARCHAR(7),
    tagline VARCHAR(255),
    culture_keywords VARCHAR[],  -- Innovation, Collaboration, Growth
    company_values TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes:
CREATE INDEX idx_company_branding_company_id ON company_branding(company_id);
```

**Row Count Estimate:** 500-5,000 rows

---

### Table: company_locations

**Purpose:** Company office locations

**Schema:**
```sql
CREATE TABLE company_locations (
    id UUID PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    city VARCHAR(255),
    state VARCHAR(255),
    country VARCHAR(255),
    address TEXT,
    remote_friendly BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes:
CREATE INDEX idx_company_locations_company_id ON company_locations(company_id);
CREATE INDEX idx_company_locations_city ON company_locations(city);
```

**Row Count Estimate:** 1,000-15,000 rows

---

## 💼 Job & Application Tables

### Table: jobs

**Purpose:** Job postings

**Schema:**
```sql
CREATE TABLE jobs (
    id UUID PRIMARY KEY,
    recruiter_id UUID NOT NULL REFERENCES recruiters(id),
    company_id UUID NOT NULL REFERENCES companies(id),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    experience_level VARCHAR(50),  -- FRESHER, MID, SENIOR, LEADERSHIP
    job_type VARCHAR(50),  -- Full-time, Part-time, Contract, Remote
    location VARCHAR(255),
    salary_min BIGINT,
    salary_max BIGINT,
    required_skills VARCHAR[],
    department VARCHAR(255),
    report_to_title VARCHAR(255),
    status VARCHAR(50) DEFAULT 'ACTIVE',  -- ACTIVE, CLOSED, DRAFT
    posted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expiration_date TIMESTAMP,
    views_count INT DEFAULT 0,
    applications_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes:
CREATE INDEX idx_jobs_recruiter_id ON jobs(recruiter_id);
CREATE INDEX idx_jobs_company_id ON jobs(company_id);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_location ON jobs(location);
CREATE INDEX idx_jobs_experience_level ON jobs(experience_level);
```

**Row Count Estimate:** 500-10,000 rows

---

### Table: job_applications

**Purpose:** Track candidate applications to jobs

**Schema:**
```sql
CREATE TABLE job_applications (
    id UUID PRIMARY KEY,
    candidate_id UUID NOT NULL REFERENCES candidates(id),
    job_id UUID NOT NULL REFERENCES jobs(id),
    status VARCHAR(50),  -- SUBMITTED, SHORTLISTED, INTERVIEW_SCHEDULED, OFFERED, REJECTED, WITHDRAWN
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    recruiter_notes TEXT,
    match_score DECIMAL(3, 1),  -- 0-100
    custom_answers JSONB,  -- Answers to recruiter questions
    withdrawn_at TIMESTAMP,
    created_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes:
CREATE INDEX idx_job_applications_candidate_id ON job_applications(candidate_id);
CREATE INDEX idx_job_applications_job_id ON job_applications(job_id);
CREATE INDEX idx_job_applications_status ON job_applications(status);
```

**Row Count Estimate:** 5,000-100,000 rows

---

### Table: job_skills

**Purpose:** Required skills for each job

**Schema:**
```sql
CREATE TABLE job_skills (
    id UUID PRIMARY KEY,
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    skill_name VARCHAR(255),
    proficiency_required VARCHAR(50),  -- BEGINNER, INTERMEDIATE, ADVANCED, EXPERT
    is_mandatory BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes:
CREATE INDEX idx_job_skills_job_id ON job_skills(job_id);
CREATE INDEX idx_job_skills_skill ON job_skills(skill_name);
```

**Row Count Estimate:** 2,500-50,000 rows

---

### Table: candidate_job_sync

**Purpose:** AI matching scores between candidates and jobs (recommendations)

**Schema:**
```sql
CREATE TABLE candidate_job_sync (
    id UUID PRIMARY KEY,
    candidate_id UUID NOT NULL REFERENCES candidates(id),
    job_id UUID NOT NULL REFERENCES jobs(id),
    overall_match_score DECIMAL(3, 1),  -- 0-100
    skills_match_score DECIMAL(3, 1),  -- 40% weight
    experience_match_score DECIMAL(3, 1),  -- 25% weight
    location_match_score DECIMAL(3, 1),  -- 20% weight
    salary_match_score DECIMAL(3, 1),  -- 10% weight
    role_relevance_score DECIMAL(3, 1),  -- 5% weight
    match_explanation TEXT,
    missing_critical_skills VARCHAR[],
    last_scored_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes:
CREATE INDEX idx_candidate_job_sync_candidate_id ON candidate_job_sync(candidate_id);
CREATE INDEX idx_candidate_job_sync_job_id ON candidate_job_sync(job_id);
CREATE INDEX idx_candidate_job_sync_score ON candidate_job_sync(overall_match_score DESC);
```

**Row Count Estimate:** 20,000-500,000 rows (large table)

---

## 📝 Assessment Tables

### Table: assessments

**Purpose:** Assessment attempts by candidates

**Schema:**
```sql
CREATE TABLE assessments (
    id UUID PRIMARY KEY,
    candidate_id UUID NOT NULL REFERENCES candidates(id),
    level VARCHAR(50),  -- FRESHER, MID, SENIOR, LEADERSHIP
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    status VARCHAR(50),  -- IN_PROGRESS, COMPLETED, COMPLETED_WITH_VIOLATION, ABANDONED
    total_score DECIMAL(3, 1),  -- 0-100
    time_spent_seconds INT,
    violation_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes:
CREATE INDEX idx_assessments_candidate_id ON assessments(candidate_id);
CREATE INDEX idx_assessments_level ON assessments(level);
CREATE INDEX idx_assessments_status ON assessments(status);
```

**Row Count Estimate:** 3,000-30,000 rows

---

### Table: assessment_responses

**Purpose:** Individual question answers during assessment

**Schema:**
```sql
CREATE TABLE assessment_responses (
    id UUID PRIMARY KEY,
    assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    question_id VARCHAR(255),  -- Reference to question bank
    candidate_answer TEXT,
    ai_score DECIMAL(3, 1),  -- 0-100
    evaluation_reason TEXT,
    question_sequence INT,
    answered_at TIMESTAMP,
    time_spent_seconds INT
);

-- Indexes:
CREATE INDEX idx_assessment_responses_assessment_id ON assessment_responses(assessment_id);
```

**Row Count Estimate:** 40,000-400,000 rows

---

### Table: assessment_results

**Purpose:** Final results for each assessment

**Schema:**
```sql
CREATE TABLE assessment_results (
    id UUID PRIMARY KEY,
    assessment_id UUID UNIQUE NOT NULL REFERENCES assessments(id),
    final_score DECIMAL(3, 1),  -- 0-100
    strengths TEXT[],  -- Array of strength areas
    weaknesses TEXT[],  -- Array of weak areas
    report_pdf_url VARCHAR(511),  -- S3 URL
    valid_until TIMESTAMP,  -- 6 months from completion
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes:
CREATE INDEX idx_assessment_results_assessment_id ON assessment_results(assessment_id);
```

**Row Count Estimate:** 3,000-30,000 rows

---

## 🎥 Interview & Video Tables

### Table: interview_proposals

**Purpose:** Interview invitations sent by recruiters

**Schema:**
```sql
CREATE TABLE interview_proposals (
    id UUID PRIMARY KEY,
    candidate_id UUID NOT NULL REFERENCES candidates(id),
    job_id UUID NOT NULL REFERENCES jobs(id),
    recruiter_id UUID NOT NULL REFERENCES recruiters(id),
    interview_type VARCHAR(50),  -- Phone, Technical, HR, Final
    description TEXT,
    proposed_times TIMESTAMP[],  -- Array of 3 proposed times
    status VARCHAR(50),  -- PROPOSED, ACCEPTED, DECLINED, EXPIRED
    candidate_selected_time TIMESTAMP,
    proposed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

-- Indexes:
CREATE INDEX idx_interview_proposals_candidate_id ON interview_proposals(candidate_id);
CREATE INDEX idx_interview_proposals_status ON interview_proposals(status);
```

**Row Count Estimate:** 5,000-50,000 rows

---

### Table: interviews

**Purpose:** Confirmed interviews with scheduling details

**Schema:**
```sql
CREATE TABLE interviews (
    id UUID PRIMARY KEY,
    candidate_id UUID NOT NULL REFERENCES candidates(id),
    job_id UUID NOT NULL REFERENCES jobs(id),
    recruiter_id UUID NOT NULL REFERENCES recruiters(id),
    interview_type VARCHAR(50),
    scheduled_time TIMESTAMP,
    duration_minutes INT,
    jitsi_url VARCHAR(511),
    status VARCHAR(50),  -- SCHEDULED, COMPLETED, CANCELLED, NO_SHOW
    meeting_room VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

-- Indexes:
CREATE INDEX idx_interviews_candidate_id ON interviews(candidate_id);
CREATE INDEX idx_interviews_scheduled_time ON interviews(scheduled_time);
```

**Row Count Estimate:** 2,000-20,000 rows

---

### Table: interview_feedback

**Purpose:** Post-interview feedback from recruiters

**Schema:**
```sql
CREATE TABLE interview_feedback (
    id UUID PRIMARY KEY,
    interview_id UUID NOT NULL REFERENCES interviews(id),
    recruiter_id UUID NOT NULL REFERENCES recruiters(id),
    communication_score INT,  -- 1-5
    technical_score INT,
    culture_fit_score INT,
    overall_score INT,
    comments TEXT,
    next_step VARCHAR(50),  -- MOVE_FORWARD, REJECT, NEED_MORE_INFO
    created_at TIMESTAMP
);

-- Indexes:
CREATE INDEX idx_interview_feedback_interview_id ON interview_feedback(interview_id);
```

**Row Count Estimate:** 1,500-15,000 rows

---

## 💬 Chat & Communication Tables

### Table: chat_threads

**Purpose:** Conversation threads between users

**Schema:**
```sql
CREATE TABLE chat_threads (
    id UUID PRIMARY KEY,
    participant_1_id UUID NOT NULL REFERENCES users(id),
    participant_2_id UUID NOT NULL REFERENCES users(id),
    last_message_at TIMESTAMP,
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes:
CREATE INDEX idx_chat_threads_participant_1 ON chat_threads(participant_1_id);
CREATE INDEX idx_chat_threads_participant_2 ON chat_threads(participant_2_id);
```

**Row Count Estimate:** 5,000-50,000 rows

---

### Table: chat_messages

**Purpose:** Individual messages in conversations

**Schema:**
```sql
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY,
    chat_thread_id UUID NOT NULL REFERENCES chat_threads(id),
    sender_id UUID NOT NULL REFERENCES users(id),
    message_text TEXT,
    attachment_urls VARCHAR[],
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

-- Indexes:
CREATE INDEX idx_chat_messages_thread_id ON chat_messages(chat_thread_id);
CREATE INDEX idx_chat_messages_sender_id ON chat_messages(sender_id);
CREATE INDEX idx_chat_messages_is_read ON chat_messages(is_read);
```

**Row Count Estimate:** 50,000-500,000 rows (large table)

---

### Table: notifications

**Purpose:** User notifications and alerts

**Schema:**
```sql
CREATE TABLE notifications (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    notification_type VARCHAR(50),  -- JOB_MATCH, MESSAGE, INTERVIEW, APPLICATION_STATUS
    title VARCHAR(255),
    message TEXT,
    related_entity_id UUID,  -- Job ID, User ID, Application ID, etc.
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,
    delivery_channels VARCHAR[],  -- IN_APP, EMAIL, SMS
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes:
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
```

**Row Count Estimate:** 100,000-1,000,000 rows (large table)

---

## 📊 Analytics & Tracking Tables

### Table: profile_views

**Purpose:** Track recruiter profile views

**Schema:**
```sql
CREATE TABLE profile_views (
    id UUID PRIMARY KEY,
    candidate_id UUID NOT NULL REFERENCES candidates(id),
    recruiter_id UUID NOT NULL REFERENCES recruiters(id),
    viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    time_spent_seconds INT,
    source VARCHAR(50)  -- RECOMMENDATION, SEARCH, DIRECT
);

-- Indexes:
CREATE INDEX idx_profile_views_candidate_id ON profile_views(candidate_id);
CREATE INDEX idx_profile_views_recruiter_id ON profile_views(recruiter_id);
CREATE INDEX idx_profile_views_viewed_at ON profile_views(viewed_at);
```

**Row Count Estimate:** 100,000-1,000,000 rows (large table)

---

### Table: job_views

**Purpose:** Track candidate job views and interactions

**Schema:**
```sql
CREATE TABLE job_views (
    id UUID PRIMARY KEY,
    candidate_id UUID NOT NULL REFERENCES candidates(id),
    job_id UUID NOT NULL REFERENCES jobs(id),
    viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    time_spent_seconds INT,
    source VARCHAR(50),  -- RECOMMENDATION, SEARCH, DIRECT
    action_taken VARCHAR(50)  -- SAVE, APPLY, SHARE, NONE
);

-- Indexes:
CREATE INDEX idx_job_views_candidate_id ON job_views(candidate_id);
CREATE INDEX idx_job_views_job_id ON job_views(job_id);
```

**Row Count Estimate:** 200,000-2,000,000 rows (very large table)

---

### Table: posts

**Purpose:** Community posts and social content

**Schema:**
```sql
CREATE TABLE posts (
    id UUID PRIMARY KEY,
    author_id UUID NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    media_urls VARCHAR[],
    likes_count INT DEFAULT 0,
    comments_count INT DEFAULT 0,
    shares_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes:
CREATE INDEX idx_posts_author_id ON posts(author_id);
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);
```

**Row Count Estimate:** 1,000-10,000 rows

---

## 🔄 Backup & Recovery Procedures

### 1. Full Database Backup

```bash
# Using AWS RDS automated backups (recommended)
# Backups run daily and retained for 7 days by default

# Or manual backup using pg_dump:
pg_dump -h endpoint.rds.amazonaws.com \
        -U postgres \
        -d talentflow \
        > talentflow_backup_$(date +%Y%m%d).sql

# Expected file size: 50-200 MB (compressed: 10-50 MB)
```

### 2. Backup Restoration

```bash
# Restore from SQL dump
psql -h endpoint.rds.amazonaws.com \
     -U postgres \
     -d talentflow_restore \
     < talentflow_backup_2026-04-02.sql

# From AWS RDS snapshot:
# 1. AWS Console → RDS → Snapshots
# 2. Right-click snapshot → "Restore to DB Instance"
# 3. Configure new instance details
```

### 3. Point-in-Time Recovery

```bash
# AWS RDS supports PITR (Point-in-Time Recovery)
# 1. AWS Console → RDS → Databases
# 2. Select database → "Restore to point in time"
# 3. Choose timestamp
# 4. Restore creates new database instance
```

### 4. Backup Validation

```sql
-- Check table row counts
SELECT schemaname, tablename, n_live_tup AS row_count
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;

-- Check data integrity
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM candidates;
SELECT COUNT(*) FROM job_applications;
-- Compare with source database
```

---

## 🔀 Migration Procedures

### 1. Pre-Migration Checklist

```
☐ Backup current database
☐ Notify all users (maintenance window)
☐ Stop all API servers
☐ Pause background jobs
☐ Verify migration scripts
☐ Test on staging environment
```

### 2. Schema Migration

```bash
# Using migration scripts in infra/scripts/
cd infra/scripts

# List all migrations
ls -la *.sql

# Run migrations in order:
psql -h endpoint << EOF
  \i add_resume_url.sql
  \i chat_schema.sql
  \i interview_schema.sql
  \i analytics_schema.sql
  -- ... run all in order
EOF
```

### 3. Data Migration Template

```sql
-- Example: Migrate data from old schema to new

BEGIN TRANSACTION;

-- Step 1: Create temporary table
CREATE TABLE candidates_temp AS
SELECT * FROM candidates_old;

-- Step 2: Transform data if needed
UPDATE candidates_temp
SET trust_score = CASE 
    WHEN verification_fields->>'assessment' = 'true' THEN 40
    ELSE 0
END;

-- Step 3: Validate data
SELECT COUNT(*) FROM candidates_temp;
SELECT COUNT(*) FROM candidates_old;
-- Should match

-- Step 4: Copy to production
INSERT INTO candidates
SELECT * FROM candidates_temp
ON CONFLICT (id) DO UPDATE SET
  updated_at = CURRENT_TIMESTAMP;

-- Step 5: Cleanup
DROP TABLE candidates_temp;

COMMIT;
```

### 4. Post-Migration Verification

```sql
-- Verify all tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Check record counts
SELECT 'users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'candidates', COUNT(*) FROM candidates
UNION ALL
SELECT 'job_applications', COUNT(*) FROM job_applications
UNION ALL
SELECT 'chat_messages', COUNT(*) FROM chat_messages;

-- Check for data corruption
SELECT * FROM users WHERE email IS NULL;  -- Should return 0
SELECT * FROM candidates WHERE user_id IS NULL;  -- Should return 0
```

### 5. Post-Migration Steps

```
1. Restart API servers
2. Resume background jobs
3. Monitor system metrics
4. Check error logs
5. Notify users migration complete
6. Keep backup for 30 days
```

---

## 📋 Database Maintenance

### Regular Maintenance Tasks

**Weekly:**
- Run `VACUUM` on large tables
- Check error logs
- Monitor disk space

**Monthly:**
- Run `ANALYZE` on all tables
- Update table statistics
- Check slow query logs
- Review backups

**Quarterly:**
- Test disaster recovery procedures
- Archive old logs
- Review and optimize indexes

### Maintenance Commands

```sql
-- Analyze tables (update stats)
ANALYZE;

-- Vacuum (cleanup dead rows)
VACUUM;

-- Reindex all indexes
REINDEX DATABASE talentflow;

-- Check table sizes
SELECT schemaname, tablename,
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

---

## 🔒 Security Considerations

### Data Protection
- ✅ Encrypt connections (SSL/TLS)
- ✅ Backup encryption at rest
- ✅ Restrict user permissions
- ✅ Audit data access

### Backup Security
- ✅ Store backups securely (AWS S3)
- ✅ Enable S3 encryption
- ✅ Rotate backup retention
- ✅ Test restore procedures

---

## 📞 Support & Resources

- **AWS RDS Documentation:** https://docs.aws.amazon.com/rds/
- **PostgreSQL Docs:** https://www.postgresql.org/docs/
- **pg_dump Reference:** man pg_dump

---

## ✅ Conclusion

This database structure document provides:
- ✅ Complete schema reference
- ✅ Backup procedures
- ✅ Migration guidelines
- ✅ Maintenance tasks
- ✅ Recovery procedures

Use this for system administration, disaster recovery, and capacity planning.
