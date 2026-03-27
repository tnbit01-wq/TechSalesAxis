-- =========================================================================================
-- TALENTFLOW MASTER AUTHORITATIVE DATABASE SCHEMA
-- Generated: February 2026
-- This document encapsulates the entire live production environment in order of creation.
-- =========================================================================================

-- ---------- EXTENSIONS ----------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------- ENUM TYPES ----------

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('candidate', 'recruiter', 'admin');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE experience_band AS ENUM ('fresher', 'mid', 'senior', 'leadership');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE assessment_status AS ENUM ('not_started', 'in_progress', 'completed', 'disqualified');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE employment_status AS ENUM ('Employed', 'Unemployed', 'Student');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE company_size_band AS ENUM ('1-10', '11-50', '51-200', '201-500', '501-1000', '1000+');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE sales_model_type AS ENUM ('Inbound', 'Outbound', 'Hybrid');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE target_market AS ENUM ('SMB', 'Mid-market', 'Enterprise');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE account_status AS ENUM ('Active', 'Restricted', 'Suspended', 'Blocked');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE profile_strength AS ENUM ('Low', 'Moderate', 'Strong', 'Elite');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE job_type AS ENUM ('remote', 'hybrid', 'onsite');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE job_status AS ENUM ('active', 'closed', 'paused');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE application_status AS ENUM ('recommended', 'applied', 'invited', 'shortlisted', 'interview_scheduled', 'rejected', 'offered', 'closed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE interview_status AS ENUM ('pending_confirmation', 'scheduled', 'cancelled', 'completed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE interview_format AS ENUM ('virtual', 'onsite');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE report_status AS ENUM ('pending', 'under_review', 'resolved', 'dismissed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ---------- TRIGGER FUNCTIONS ----------

-- Updated At Trigger Function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recruiter Settings Initialization
CREATE OR REPLACE FUNCTION public.initialize_recruiter_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.recruiter_settings (user_id)
  VALUES (NEW.user_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Application Tracking Functions
CREATE OR REPLACE FUNCTION log_application_status_change()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO job_application_status_history (
    application_id, old_status, new_status, changed_by
  ) VALUES (
    NEW.id, OLD.status, NEW.status, auth.uid()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------- TABLES (ORDERED BY DEPENDENCY) ----------

-- 1. USERS
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role user_role NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. COMPANIES
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  registration_number TEXT UNIQUE,
  website TEXT,
  domain TEXT,
  location TEXT,
  description TEXT,
  industry_category TEXT,
  size_band company_size_band,
  sales_model sales_model_type,
  target_market target_market,
  hiring_focus_areas TEXT[] DEFAULT '{}',
  avg_deal_size_range TEXT,
  profile_score INTEGER DEFAULT 0,
  candidate_feedback_score FLOAT DEFAULT 0.0,
  successful_hires_count INTEGER DEFAULT 0,
  visibility_tier TEXT DEFAULT 'Low',
  verification_status TEXT DEFAULT 'Under Review',
  logo_url TEXT,
  brand_colors JSONB,
  life_at_photo_urls TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. RECRUITER PROFILES
CREATE TABLE IF NOT EXISTS recruiter_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  full_name TEXT,
  phone_number TEXT,
  job_title TEXT,
  department TEXT,
  onboarding_step TEXT DEFAULT 'PERSONAL',
  credits INTEGER DEFAULT 0,
  completion_score INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. CANDIDATE PROFILES
CREATE TABLE IF NOT EXISTS candidate_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone_number TEXT,
  profile_photo_url TEXT,
  bio TEXT,
  experience experience_band NOT NULL,
  location TEXT,
  "current_role" TEXT,
  years_of_experience INTEGER,
  primary_industry_focus TEXT,
  current_employment_status employment_status,
  current_company_name TEXT,
  previous_companies TEXT[] DEFAULT '{}',
  key_responsibilities TEXT,
  major_achievements TEXT,
  resume_uploaded BOOLEAN DEFAULT false,
  assessment_status assessment_status DEFAULT 'not_started',
  skills TEXT[], 
  sales_metrics JSONB DEFAULT '{}',
  crm_tools TEXT[] DEFAULT '{}',
  sales_methodologies TEXT[] DEFAULT '{}',
  product_domain_expertise TEXT[] DEFAULT '{}',
  target_market_exposure TEXT,
  linkedin_url TEXT,
  portfolio_url TEXT,
  learning_links JSONB DEFAULT '[]',
  career_interests TEXT[] DEFAULT '{}',
  learning_interests TEXT[] DEFAULT '{}',
  job_type job_type DEFAULT 'onsite',
  social_links JSONB DEFAULT '{}',
  onboarding_step TEXT DEFAULT 'INITIAL',
  profile_strength profile_strength DEFAULT 'Low',
  completion_score INTEGER DEFAULT 0,
  final_profile_score INTEGER,
  identity_verified BOOLEAN DEFAULT false,
  identity_proof_path TEXT,
  terms_accepted BOOLEAN DEFAULT false,
  account_status account_status DEFAULT 'Active',
  gender TEXT,
  birthdate DATE,
  university TEXT,
  qualification_held TEXT,
  graduation_year INTEGER,
  referral TEXT,
  resume_url TEXT,
  resume_path TEXT,
  target_role TEXT,
  long_term_goal TEXT,
  education_history JSONB DEFAULT '[]',
  experience_history JSONB DEFAULT '[]',
  projects JSONB DEFAULT '[]',
  certifications TEXT[] DEFAULT '{}',
  career_gap_report JSONB DEFAULT '{}',
  professional_summary TEXT,
  gpa_score DECIMAL(3,2),
  graduation_status TEXT,
  last_resume_parse_at TIMESTAMPTZ,
  ai_extraction_confidence DECIMAL(5,4),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. ASSESSMENT QUESTIONS BANK
CREATE TABLE IF NOT EXISTS assessment_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL, 
    driver TEXT NOT NULL,
    experience_band experience_band NOT NULL,
    difficulty TEXT NOT NULL, 
    question_text TEXT NOT NULL,
    evaluation_rubric TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. RECRUITER ASSESSMENT QUESTIONS BANK
CREATE TABLE IF NOT EXISTS recruiter_assessment_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL, 
    driver TEXT NOT NULL,
    question_text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. JOBS
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  recruiter_id UUID REFERENCES recruiter_profiles(user_id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  requirements TEXT[] DEFAULT '{}',
  skills_required TEXT[] DEFAULT '{}',
  experience_band experience_band NOT NULL,
  job_type job_type DEFAULT 'onsite',
  location TEXT,
  salary_range TEXT,
  number_of_positions INTEGER DEFAULT 1,
  status job_status DEFAULT 'active',
  is_ai_generated BOOLEAN DEFAULT false,
  closed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 8. JOB APPLICATIONS
CREATE TABLE IF NOT EXISTS job_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES candidate_profiles(user_id) ON DELETE CASCADE,
  status application_status DEFAULT 'applied',
  feedback TEXT,
  invitation_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(job_id, candidate_id)
);

-- 9. ASSESSMENT SESSIONS
CREATE TABLE IF NOT EXISTS assessment_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    experience_band experience_band NOT NULL,
    status TEXT DEFAULT 'started',
    total_budget INTEGER, 
    current_step INTEGER DEFAULT 1,
    warning_count INTEGER DEFAULT 0,
    overall_score FLOAT DEFAULT 0.0,
    component_scores JSONB DEFAULT '{}',
    driver_confidence JSONB DEFAULT '{}',
    started_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ
);

-- 10. ASSESSMENT RESPONSES
CREATE TABLE IF NOT EXISTS assessment_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    question_id UUID REFERENCES assessment_questions(id),
    question_text TEXT,
    category TEXT NOT NULL,
    driver TEXT,
    difficulty TEXT,
    raw_answer TEXT,
    score INTEGER CHECK (score >= 0 AND score <= 6),
    evaluation_metadata JSONB DEFAULT '{}',
    is_skipped BOOLEAN DEFAULT false,
    tab_switches INTEGER DEFAULT 0,
    time_taken_seconds INTEGER,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 11. RECRUITER ASSESSMENT RESPONSES
CREATE TABLE IF NOT EXISTS recruiter_assessment_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    answer_text TEXT NOT NULL,
    category TEXT NOT NULL,
    relevance_score INTEGER,
    specificity_score INTEGER,
    clarity_score INTEGER,
    ownership_score INTEGER,
    average_score DECIMAL(5,2),
    evaluation_metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 12. RECRUITER SETTINGS
CREATE TABLE IF NOT EXISTS recruiter_settings (
  user_id UUID PRIMARY KEY REFERENCES recruiter_profiles(user_id) ON DELETE CASCADE,
  email_notifications BOOLEAN DEFAULT true,
  web_notifications BOOLEAN DEFAULT true,
  mobile_notifications BOOLEAN DEFAULT false,
  profile_visibility TEXT DEFAULT 'public',
  language TEXT DEFAULT 'en',
  timezone TEXT DEFAULT 'UTC',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 13. RESUME DATA (PARSED)
CREATE TABLE IF NOT EXISTS resume_data (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  raw_text TEXT,
  timeline JSONB, 
  career_gaps JSONB,
  achievements TEXT[],
  skills TEXT[],
  education JSONB,
  raw_education JSONB,
  raw_experience JSONB,
  raw_projects JSONB,
  parsed_at TIMESTAMPTZ DEFAULT now()
);

-- 14. PROFILE SCORES
CREATE TABLE IF NOT EXISTS profile_scores (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  resume_score INTEGER,
  behavioral_score INTEGER,
  psychometric_score INTEGER,
  skills_score INTEGER,
  reference_score INTEGER,
  final_score INTEGER,
  calculated_at TIMESTAMPTZ DEFAULT now()
);

-- 15. SAVED JOBS
CREATE TABLE IF NOT EXISTS saved_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidate_profiles(user_id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(candidate_id, job_id)
);

-- 16. POSTS
CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  media_url TEXT,
  media_type TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 17. USER PINNED POSTS
CREATE TABLE IF NOT EXISTS user_pinned_posts (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  pinned_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

-- 18. FOLLOWS
CREATE TABLE IF NOT EXISTS follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(follower_id, following_id)
);

-- 19. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 20. CHAT THREADS
CREATE TABLE IF NOT EXISTS chat_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recruiter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT false,
  last_message_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(candidate_id, recruiter_id)
);

-- 21. CHAT MESSAGES
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id),
  text TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 22. CHAT REPORTS
CREATE TABLE IF NOT EXISTS chat_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
  reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  thread_id UUID NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status report_status DEFAULT 'pending',
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 23. INTERVIEWS
CREATE TABLE IF NOT EXISTS interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES candidate_profiles(user_id) ON DELETE CASCADE,
  recruiter_id UUID REFERENCES recruiter_profiles(user_id) ON DELETE SET NULL,
  application_id UUID NOT NULL REFERENCES job_applications(id) ON DELETE CASCADE,
  status interview_status DEFAULT 'scheduled',
  round_name TEXT,
  round_number INTEGER DEFAULT 1,
  format interview_format DEFAULT 'virtual',
  meeting_link TEXT,
  location TEXT,
  interviewer_names TEXT[] DEFAULT '{}',
  feedback TEXT,
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 24. INTERVIEW SLOTS
CREATE TABLE IF NOT EXISTS interview_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  is_selected BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 25. JOB APPLICATION STATUS HISTORY
CREATE TABLE IF NOT EXISTS job_application_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES job_applications(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by UUID REFERENCES users(id),
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 26. TEAM INVITATIONS
CREATE TABLE IF NOT EXISTS team_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  inviter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ
);

-- 27. BLOCKED USERS
CREATE TABLE IF NOT EXISTS blocked_users (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  blocked_at TIMESTAMPTZ DEFAULT now()
);

-- 28. CAREER GPS
CREATE TABLE IF NOT EXISTS career_gps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_role TEXT,
  current_status TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 29. CAREER MILESTONES
CREATE TABLE IF NOT EXISTS career_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gps_id UUID NOT NULL REFERENCES career_gps(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  skills_to_acquire TEXT[] DEFAULT '{}',
  learning_actions JSONB DEFAULT '[]',
  status TEXT DEFAULT 'not_started',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 30. JOB VIEWS
CREATE TABLE IF NOT EXISTS job_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  candidate_id UUID REFERENCES users(id) ON DELETE SET NULL,
  viewer_ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 31. PROFILE ANALYTICS
CREATE TABLE IF NOT EXISTS profile_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recruiter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT, 
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 32. CANDIDATE JOB SYNC
CREATE TABLE IF NOT EXISTS candidate_job_sync (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  overall_match_score DOUBLE PRECISION,
  match_explanation TEXT,
  missing_critical_skills TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ---------- INDEXES ----------

CREATE INDEX IF NOT EXISTS idx_jobs_company_id ON jobs(company_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_job_id ON job_applications(job_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_candidate_id ON job_applications(candidate_id);
CREATE INDEX IF NOT EXISTS idx_candidate_skills ON candidate_profiles USING GIN (skills);
CREATE INDEX IF NOT EXISTS idx_candidate_certs ON candidate_profiles USING GIN (certifications);
CREATE INDEX IF NOT EXISTS idx_interviews_job_id ON interviews(job_id);
CREATE INDEX IF NOT EXISTS idx_interviews_candidate_id ON interviews(candidate_id);
CREATE INDEX IF NOT EXISTS idx_interviews_application_id ON interviews(application_id);
CREATE INDEX IF NOT EXISTS idx_interview_slots_interview_id ON interview_slots(interview_id);
CREATE INDEX IF NOT EXISTS idx_status_history_app_id ON job_application_status_history(application_id);
CREATE INDEX IF NOT EXISTS idx_pinned_posts_user ON user_pinned_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_thread ON chat_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_chat_threads_candidate ON chat_threads(candidate_id);
CREATE INDEX IF NOT EXISTS idx_chat_threads_recruiter ON chat_threads(recruiter_id);
CREATE INDEX IF NOT EXISTS idx_job_views_job_id ON job_views(job_id);
CREATE INDEX IF NOT EXISTS idx_recruiter_responses_user ON recruiter_assessment_responses(user_id);

-- ---------- TRIGGERS ----------

DO $$ BEGIN
    CREATE TRIGGER tr_update_recruiter_settings_timestamp
    BEFORE UPDATE ON recruiter_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TRIGGER tr_initialize_recruiter_settings
    AFTER INSERT ON recruiter_profiles
    FOR EACH ROW EXECUTE FUNCTION initialize_recruiter_settings();
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TRIGGER tr_log_application_status_change
    AFTER UPDATE OF status ON job_applications
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION log_application_status_change();
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ---------- SECURITY & RLS POLICIES ----------

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE recruiter_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE recruiter_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE recruiter_assessment_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE recruiter_assessment_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_application_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE resume_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_pinned_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_gps ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_job_sync ENABLE ROW LEVEL SECURITY;

-- POLICIES

-- Users
CREATE POLICY "Users can read own record" ON users FOR SELECT USING (id = auth.uid());

-- Companies
CREATE POLICY "Companies are viewable by all authenticated users" ON companies FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Recruiters can update own company" ON companies FOR UPDATE USING (id IN (SELECT company_id FROM recruiter_profiles WHERE user_id = auth.uid()));

-- Candidate Profiles
CREATE POLICY "Candidate can read own profile" ON candidate_profiles FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Candidate can update own profile" ON candidate_profiles FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Recruiters can view profiles of applicants" ON candidate_profiles FOR SELECT USING (EXISTS (SELECT 1 FROM job_applications JOIN jobs ON job_applications.job_id = jobs.id WHERE job_applications.candidate_id = candidate_profiles.user_id AND jobs.recruiter_id = auth.uid()));
CREATE POLICY "Recruiters can view completed candidate profiles" ON candidate_profiles FOR SELECT USING (EXISTS (SELECT 1 FROM recruiter_profiles WHERE user_id = auth.uid()) AND assessment_status = 'completed');

-- Jobs
CREATE POLICY "Anyone can view active jobs" ON jobs FOR SELECT USING (status = 'active');
CREATE POLICY "Recruiters can manage their own jobs" ON jobs FOR ALL USING (auth.uid() = recruiter_id);

-- Job Applications
CREATE POLICY "Candidates can apply for jobs" ON job_applications FOR INSERT WITH CHECK (auth.uid() = candidate_id);
CREATE POLICY "Candidates can view own applications" ON job_applications FOR SELECT USING (auth.uid() = candidate_id);
CREATE POLICY "Recruiters view applicants for their jobs" ON job_applications FOR SELECT USING (EXISTS (SELECT 1 FROM jobs WHERE jobs.id = job_applications.job_id AND jobs.recruiter_id = auth.uid()));

-- Chat
CREATE POLICY "Users can view own threads" ON chat_threads FOR SELECT USING (auth.uid() = candidate_id OR auth.uid() = recruiter_id);
CREATE POLICY "Users can view message history" ON chat_messages FOR SELECT USING (EXISTS (SELECT 1 FROM chat_threads WHERE chat_threads.id = chat_messages.thread_id AND (chat_threads.candidate_id = auth.uid() OR chat_threads.recruiter_id = auth.uid())));
CREATE POLICY "Users can send messages" ON chat_messages FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM chat_threads WHERE chat_threads.id = chat_messages.thread_id AND chat_threads.is_active = true AND (chat_threads.candidate_id = auth.uid() OR chat_threads.recruiter_id = auth.uid())) AND (auth.uid() = sender_id));

-- Realtime
-- AWS RDS Realtime not supported - use application-level polling for real-time features
-- For chat and notifications, use WebSockets via FastAPI with periodic database polling
