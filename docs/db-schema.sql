-- =========================================
-- TalentFlow Database Schema
-- Authoritative Schema Definition (Updated Feb 2026)
-- =========================================

-- ---------- ENUM TYPES ----------

CREATE TYPE user_role AS ENUM (
  'candidate',
  'recruiter',
  'admin'
);

CREATE TYPE experience_band AS ENUM (
  'fresher',
  'mid',
  'senior',
  'leadership'
);

CREATE TYPE assessment_status AS ENUM (
  'not_started',
  'in_progress',
  'completed',
  'disqualified'
);

CREATE TYPE employment_status AS ENUM (
  'Employed', 
  'Unemployed', 
  'Student'
);

CREATE TYPE company_size_band AS ENUM (
  '1-10', 
  '11-50', 
  '51-200', 
  '201-500', 
  '501-1000', 
  '1000+'
);

CREATE TYPE sales_model_type AS ENUM (
  'Inbound', 
  'Outbound', 
  'Hybrid'
);

CREATE TYPE target_market AS ENUM (
  'SMB', 
  'Mid-market', 
  'Enterprise'
);

CREATE TYPE account_status AS ENUM (
  'Active', 
  'Restricted', 
  'Suspended', 
  'Blocked'
);

CREATE TYPE profile_strength AS ENUM (
  'Low', 
  'Moderate', 
  'Strong', 
  'Elite'
);

CREATE TYPE job_type AS ENUM (
  'remote', 
  'hybrid', 
  'onsite'
);

CREATE TYPE job_status AS ENUM (
  'active', 
  'closed', 
  'paused'
);

CREATE TYPE application_status AS ENUM (
  'recommended',
  'applied', 
  'invited',
  'shortlisted', 
  'interview_scheduled',
  'rejected', 
  'offered', 
  'closed'
);

CREATE TYPE interview_status AS ENUM (
  'pending_confirmation',
  'scheduled',
  'cancelled',
  'completed'
);

CREATE TYPE interview_format AS ENUM (
  'virtual',
  'onsite'
);

CREATE TYPE report_status AS ENUM (
  'pending',
  'under_review',
  'resolved',
  'dismissed'
);

-- ---------- USERS ----------

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role user_role NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ---------- COMPANIES ----------

CREATE TABLE companies (
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ---------- CANDIDATE PROFILE ----------

CREATE TABLE candidate_profiles (
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
  career_gap_report TEXT,
  professional_summary TEXT,
  gpa_score DECIMAL(3,2),
  graduation_status TEXT,
  last_resume_parse_at TIMESTAMP WITH TIME ZONE,
  ai_extraction_confidence DECIMAL(5,4),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ---------- RECRUITER PROFILE ----------

  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ---------- RECRUITER SETTINGS ----------

CREATE TABLE recruiter_settings (
  user_id UUID PRIMARY KEY REFERENCES recruiter_profiles(user_id) ON DELETE CASCADE,
  email_notifications BOOLEAN DEFAULT true,
  web_notifications BOOLEAN DEFAULT true,
  mobile_notifications BOOLEAN DEFAULT false,
  profile_visibility TEXT DEFAULT 'public',
  language TEXT DEFAULT 'en',
  timezone TEXT DEFAULT 'UTC',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ---------- BLOCKED USERS ----------

CREATE TABLE blocked_users (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  blocked_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ---------- ASSESSMENT QUESTIONS BANK ----------

CREATE TABLE assessment_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL, -- behavioral, psychometric, reference, skill
    driver TEXT NOT NULL,   -- resilience, communication, growth_potential, etc.
    experience_band experience_band NOT NULL,
    difficulty TEXT NOT NULL, -- low, medium, high
    question_text TEXT NOT NULL,
    evaluation_rubric TEXT, -- AI guidance for unbiased scoring
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ---------- RECRUITER ASSESSMENT QUESTIONS BANK ----------

CREATE TABLE recruiter_assessment_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL, -- recruiter_intent, recruiter_icp, recruiter_ethics, recruiter_cvp, recruiter_ownership
    driver TEXT NOT NULL,   -- e.g., Strategic Intent, Universal DNA, Fairness
    question_text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ---------- ASSESSMENT SESSIONS ----------

CREATE TABLE assessment_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    experience_band experience_band NOT NULL,
    status TEXT DEFAULT 'started', -- started, completed
    total_budget INTEGER, 
    current_step INTEGER DEFAULT 1,
    warning_count INTEGER DEFAULT 0,
    overall_score FLOAT DEFAULT 0.0,
    component_scores JSONB DEFAULT '{}', -- {skill: 80, behavioral: 70...}
    driver_confidence JSONB DEFAULT '{}', -- {resilience: 2...}
    started_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ
);

-- ---------- ASSESSMENT RESPONSES ----------

CREATE TABLE assessment_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID REFERENCES users(id) ON DELETE CASCADE,
    question_id UUID REFERENCES assessment_questions(id), -- Null for AI-generated
    question_text TEXT, -- Stores the actual question asked (crucial for AI questions)
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

-- ---------- RECRUITER ASSESSMENT RESPONSES ----------

CREATE TABLE recruiter_assessment_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    answer_text TEXT NOT NULL,
    category TEXT NOT NULL,
    relevance_score INTEGER,
    specificity_score INTEGER,
    clarity_score INTEGER,
    ownership_score INTEGER,
    average_score DECIMAL(5,2),
    evaluation_metadata JSONB DEFAULT '{}', -- Stores AI reasoning
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ---------- RESUME DATA (PARSED) ----------

CREATE TABLE resume_data (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  raw_text TEXT,
  timeline JSONB, -- [ {role, company, start, end} ]
  career_gaps JSONB, -- { count, details }
  achievements TEXT[],
  skills TEXT[],
  education JSONB,
  raw_education TEXT,
  raw_experience TEXT,
  raw_projects TEXT,
  parsed_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ---------- PROFILE SCORES ----------

CREATE TABLE profile_scores (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  resume_score INTEGER,
  behavioral_score INTEGER,
  psychometric_score INTEGER,
  skills_score INTEGER,
  reference_score INTEGER,
  final_score INTEGER,
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ---------- JOBS ----------

CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
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
  closed_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ---------- JOB APPLICATIONS ----------

CREATE TABLE job_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  candidate_id UUID REFERENCES candidate_profiles(user_id) ON DELETE CASCADE,
  status application_status DEFAULT 'applied',
  feedback TEXT,
  invitation_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(job_id, candidate_id)
);

-- ---------- SAVED JOBS ----------

CREATE TABLE saved_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID REFERENCES candidate_profiles(user_id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(candidate_id, job_id)
);

-- ---------- POSTS ----------

  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ---------- USER PINNED POSTS ----------

CREATE TABLE user_pinned_posts (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  pinned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

-- ---------- NOTIFICATIONS ----------

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ---------- FOLLOWS ----------

CREATE TABLE follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID REFERENCES users(id) ON DELETE CASCADE,
  following_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(follower_id, following_id)
);

-- ---------- JOB APPLICATION STATUS HISTORY ----------

CREATE TABLE job_application_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES job_applications(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by UUID REFERENCES users(id),
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ---------- INTERVIEWS ----------

CREATE TABLE interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  candidate_id UUID REFERENCES candidate_profiles(user_id) ON DELETE CASCADE,
  recruiter_id UUID REFERENCES recruiter_profiles(user_id) ON DELETE SET NULL,
  application_id UUID REFERENCES job_applications(id) ON DELETE CASCADE,
  status interview_status DEFAULT 'scheduled',
  round_name TEXT,
  round_number INTEGER DEFAULT 1,
  format interview_format DEFAULT 'video',
  meeting_link TEXT,
  location TEXT,
  interviewer_names TEXT[] DEFAULT '{}',
  feedback TEXT,
  cancellation_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ---------- INTERVIEW SLOTS ----------

CREATE TABLE interview_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID REFERENCES interviews(id) ON DELETE CASCADE,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  is_selected BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ---------- JOB VIEWS ----------

CREATE TABLE job_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  candidate_id UUID REFERENCES candidate_profiles(user_id) ON DELETE SET NULL,
  viewer_ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ---------- TEAM INVITATIONS ----------

CREATE TABLE team_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  inviter_id UUID REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_jobs_company_id ON jobs(company_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_job_id ON job_applications(job_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_candidate_id ON job_applications(candidate_id);

-- Additional Indexes for Performance
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

-- Note: 'trust_score' is a virtual field calculated in the service layer as: 
-- (psychometric_score * 0.6) + (behavioral_score * 0.4) 
-- to protect candidate data while providing trust signals to recruiters.

CREATE TABLE chat_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recruiter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT false,
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(candidate_id, recruiter_id)
);

CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id),
  text TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TYPE report_status AS ENUM ('pending', 'under_review', 'resolved', 'dismissed');

CREATE TABLE chat_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
  reporter_id UUID REFERENCES users(id) ON DELETE CASCADE,
  thread_id UUID REFERENCES chat_threads(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status report_status DEFAULT 'pending',
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ---------- CAREER GPS (PATHAWAYS) ----------

CREATE TABLE career_gps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_role TEXT,
  current_status TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE career_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gps_id UUID NOT NULL REFERENCES career_gps(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  skills_to_acquire TEXT[] DEFAULT '{}',
  learning_actions JSONB DEFAULT '[]',
  status TEXT DEFAULT 'not_started',
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =========================================
-- TRIGGERS & FUNCTIONS
-- =========================================

-- Updated At Trigger Function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to relevant tables
CREATE TRIGGER tr_update_recruiter_settings_timestamp
  BEFORE UPDATE ON recruiter_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Recruiter Settings Initialization
CREATE OR REPLACE FUNCTION public.initialize_recruiter_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.recruiter_settings (user_id)
  VALUES (NEW.user_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tr_initialize_recruiter_settings
  AFTER INSERT ON recruiter_profiles
  FOR EACH ROW EXECUTE FUNCTION initialize_recruiter_settings();

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
$$ LANGUAGE sql;

CREATE TRIGGER tr_log_application_status_change
  AFTER UPDATE OF status ON job_applications
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION log_application_status_change();

-- =========================================
-- SECURITY & RLS POLICIES
-- =========================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE recruiter_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE recruiter_assessment_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE recruiter_assessment_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE resume_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE recruiter_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_pinned_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_application_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_gps ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_milestones ENABLE ROW LEVEL SECURITY;

-- Helper Function
CREATE OR REPLACE FUNCTION is_authenticated_user()
RETURNS BOOLEAN AS $$
  SELECT auth.uid() IS NOT NULL;
$$ LANGUAGE sql STABLE;

-- ---------- POLICIES ----------

-- Users
CREATE POLICY "Users can read own profile" ON users FOR SELECT USING (id = auth.uid());
CREATE POLICY "Users can read own record" ON users FOR SELECT USING (id = auth.uid());

-- Companies
CREATE POLICY "Companies are viewable by all authenticated users" 
ON companies FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Recruiters can update own company" 
ON companies FOR UPDATE 
USING (id IN (SELECT company_id FROM recruiter_profiles WHERE user_id = auth.uid()));

-- Candidate Profiles
CREATE POLICY "Candidate can read own profile" ON candidate_profiles FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Candidate can update own profile" ON candidate_profiles FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Recruiters can view profiles of applicants" 
ON candidate_profiles FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM job_applications 
    JOIN jobs ON job_applications.job_id = jobs.id 
    WHERE job_applications.candidate_id = candidate_profiles.user_id 
    AND jobs.recruiter_id = auth.uid()
  )
);
CREATE POLICY "Recruiters can view completed candidate profiles" 
ON candidate_profiles FOR SELECT 
USING (
  EXISTS (SELECT 1 FROM recruiter_profiles WHERE user_id = auth.uid()) AND
  assessment_status = 'completed'
);

-- Recruiter Profiles
CREATE POLICY "Recruiter can read own profile" ON recruiter_profiles FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Recruiter can update own profile" ON recruiter_profiles FOR UPDATE USING (user_id = auth.uid());

-- Recruiter Settings
CREATE POLICY "Recruiter can manage own settings" ON recruiter_settings FOR ALL USING (user_id = auth.uid());

-- Recruiter Assessment Questions
CREATE POLICY "Recruiters can view assessment questions" ON recruiter_assessment_questions
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- Jobs
CREATE POLICY "Candidates can view active jobs" 
ON jobs FOR SELECT 
USING (status = 'active');

CREATE POLICY "Recruiters can manage their own jobs" 
ON jobs FOR ALL 
USING (auth.uid() = recruiter_id);

-- Job Applications
CREATE POLICY "Candidates can apply for jobs" 
ON job_applications FOR INSERT 
WITH CHECK (auth.uid() = candidate_id);

CREATE POLICY "Candidates can view own applications" 
ON job_applications FOR SELECT 
USING (auth.uid() = candidate_id);

CREATE POLICY "Recruiters view applicants for their jobs"
ON job_applications FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM jobs 
    WHERE jobs.id = job_applications.job_id 
    AND jobs.recruiter_id = auth.uid()
  )
);

CREATE POLICY "Recruiters can update application status" 
ON job_applications FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM jobs 
    WHERE jobs.id = job_applications.job_id 
    AND jobs.recruiter_id = auth.uid()
  )
);

-- Saved Jobs
CREATE POLICY "Users can manage own saved jobs" 
ON saved_jobs FOR ALL 
USING (auth.uid() = candidate_id);

-- Posts
CREATE POLICY "Anyone can view posts" 
ON posts FOR SELECT 
USING (true);

CREATE POLICY "Users can manage own posts" 
ON posts FOR ALL 
USING (auth.uid() = user_id);

-- User Pinned Posts
CREATE POLICY "Users can manage own pinned posts" 
ON user_pinned_posts FOR ALL 
USING (auth.uid() = user_id);

-- Notifications
CREATE POLICY "Users can see own notifications" 
ON notifications FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" 
ON notifications FOR UPDATE 
USING (auth.uid() = user_id);

-- Follows
CREATE POLICY "Users can view follows" 
ON follows FOR SELECT 
USING (true);

CREATE POLICY "Users can manage own follows" 
ON follows FOR ALL 
USING (auth.uid() = follower_id);

-- Chat Threads
CREATE POLICY "Users can view own threads" 
ON chat_threads FOR SELECT 
USING (auth.uid() = candidate_id OR auth.uid() = recruiter_id);

-- Chat Messages
CREATE POLICY "Users can view message history" 
ON chat_messages FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM chat_threads 
    WHERE chat_threads.id = chat_messages.thread_id 
    AND (chat_threads.candidate_id = auth.uid() OR chat_threads.recruiter_id = auth.uid())
  )
);

CREATE POLICY "Users can send messages" 
ON chat_messages FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM chat_threads 
    WHERE chat_threads.id = chat_messages.thread_id 
    AND chat_threads.is_active = true
    AND (chat_threads.candidate_id = auth.uid() OR chat_threads.recruiter_id = auth.uid())
  )
  AND (auth.uid() = sender_id)
);

-- Chat Reports
CREATE POLICY "Users can file reports" 
ON chat_reports FOR INSERT 
WITH CHECK (auth.uid() = reporter_id);

-- Job Application Status History
CREATE POLICY "Users involved can view history" 
ON job_application_status_history FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM job_applications 
    WHERE job_applications.id = job_application_status_history.application_id 
    AND (job_applications.candidate_id = auth.uid() OR 
         EXISTS (SELECT 1 FROM jobs WHERE jobs.id = job_applications.job_id AND jobs.recruiter_id = auth.uid()))
  )
);

-- Interviews
CREATE POLICY "Users can view their interviews" 
ON interviews FOR SELECT 
USING (candidate_id = auth.uid() OR recruiter_id = auth.uid());

CREATE POLICY "Recruiters can manage interviews" 
ON interviews FOR ALL 
USING (recruiter_id = auth.uid());

-- Interview Slots
CREATE POLICY "Users can view slots for their interviews" 
ON interview_slots FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM interviews 
    WHERE interviews.id = interview_slots.interview_id 
    AND (interviews.candidate_id = auth.uid() OR interviews.recruiter_id = auth.uid())
  )
);

-- Team Invitations
CREATE POLICY "Recruiters can see invitations for their company" 
ON team_invitations FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM recruiter_profiles 
    WHERE recruiter_profiles.user_id = auth.uid() 
    AND recruiter_profiles.company_id = team_invitations.company_id
  )
);

-- Career GPS
CREATE POLICY "Users can manage own career gps" ON career_gps FOR ALL USING (candidate_id = auth.uid());
CREATE POLICY "Users can manage own career milestones" ON career_milestones FOR ALL USING (
    EXISTS (SELECT 1 FROM career_gps WHERE id = career_milestones.gps_id AND candidate_id = auth.uid())
);

-- Job Views (Usually limited or internal, but let's add basic select for recruiters)
CREATE POLICY "Recruiters can see views for their jobs" 
ON job_views FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM jobs 
    WHERE jobs.id = job_views.job_id 
    AND jobs.recruiter_id = auth.uid()
  )
);

-- Resume Data & Scores
CREATE POLICY "Users can view own resume data" ON resume_data FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can view own scores" ON profile_scores FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Recruiters can view applicant data" 
ON resume_data FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM job_applications 
    JOIN jobs ON job_applications.job_id = jobs.id 
    WHERE job_applications.candidate_id = resume_data.user_id 
    AND jobs.recruiter_id = auth.uid()
  )
);

CREATE POLICY "Recruiters can view applicant scores" 
ON profile_scores FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM job_applications 
    JOIN jobs ON job_applications.job_id = jobs.id 
    WHERE job_applications.candidate_id = profile_scores.user_id 
    AND jobs.recruiter_id = auth.uid()
  )
);

-- Recruiter Assessment Responses
CREATE POLICY "Recruiters can manage own responses" 
ON recruiter_assessment_responses FOR ALL 
USING (user_id = auth.uid());

-- ---------- STORAGE POLICIES ----------

-- Resumes Bucket: Stores candidate PDF resumes.
-- Documents Bucket: Identity documents, Aadhaar, etc.
-- id-proofs Bucket: Sensitive ID verification documents.
-- avatars Bucket: User profile photos.
-- profile_photos Bucket: Dedicated bucket for profile pictures.
-- company-logos Bucket: Company brand logos.
-- company-assets Bucket: Company office assets (photos/videos).
-- community-media Bucket: Social/Feed attachments.

-- Typical RLS Examples:
-- INSERT: (bucket_id = 'resumes' AND auth.uid() IS NOT NULL)
-- SELECT: (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1])
