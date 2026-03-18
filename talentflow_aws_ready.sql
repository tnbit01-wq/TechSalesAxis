--
-- PostgreSQL database dump
--

\restrict 81LaEqsamR4P1EWiqt1azV66bhBDDbXSdmEAwo9tVBEeoa0J7jGD79gjQXvKfqo

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.9

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: account_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.account_status AS ENUM (
    'Active',
    'Restricted',
    'Suspended',
    'Blocked'
);


--
-- Name: application_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.application_status AS ENUM (
    'recommended',
    'applied',
    'invited',
    'shortlisted',
    'interview_scheduled',
    'rejected',
    'offered',
    'closed'
);


--
-- Name: assessment_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.assessment_status AS ENUM (
    'not_started',
    'in_progress',
    'completed',
    'disqualified'
);


--
-- Name: company_size_band; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.company_size_band AS ENUM (
    '1-10',
    '11-50',
    '51-200',
    '201-500',
    '501-1000',
    '1000+'
);


--
-- Name: employment_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.employment_status AS ENUM (
    'Employed',
    'Unemployed',
    'Student'
);


--
-- Name: experience_band; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.experience_band AS ENUM (
    'fresher',
    'mid',
    'senior',
    'leadership'
);


--
-- Name: interview_format; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.interview_format AS ENUM (
    'virtual',
    'onsite'
);


--
-- Name: interview_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.interview_status AS ENUM (
    'pending_confirmation',
    'scheduled',
    'completed',
    'cancelled'
);


--
-- Name: job_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.job_status AS ENUM (
    'active',
    'paused',
    'closed'
);


--
-- Name: job_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.job_type AS ENUM (
    'remote',
    'hybrid',
    'onsite'
);


--
-- Name: profile_strength; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.profile_strength AS ENUM (
    'Low',
    'Moderate',
    'Strong',
    'Elite'
);


--
-- Name: report_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.report_status AS ENUM (
    'pending',
    'under_review',
    'resolved',
    'dismissed'
);


--
-- Name: sales_model_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.sales_model_type AS ENUM (
    'Inbound',
    'Outbound',
    'Hybrid'
);


--
-- Name: target_market; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.target_market AS ENUM (
    'SMB',
    'Mid-market',
    'Enterprise'
);


--
-- Name: user_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_role AS ENUM (
    'candidate',
    'recruiter',
    'admin'
);


--
-- Name: calculate_profile_completion(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_profile_completion() RETURNS trigger
    LANGUAGE plpgsql
    AS $$

DECLARE

    score INTEGER := 0;

BEGIN

    IF NEW.full_name IS NOT NULL AND NEW.full_name != '' THEN score := score + 10; END IF;

    IF NEW.profile_photo_url IS NOT NULL THEN score := score + 15; END IF;

    IF NEW.bio IS NOT NULL AND length(NEW.bio) > 20 THEN score := score + 15; END IF;

    IF NEW.experience_history != '[]'::jsonb THEN score := score + 30; END IF;

    IF NEW.education_history != '[]'::jsonb THEN score := score + 20; END IF;

    IF NEW.identity_verified = true THEN score := score + 10; END IF;

    

    NEW.completion_score := score;

    RETURN NEW;

END;

$$;


--
-- Name: handle_new_candidate_settings(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_candidate_settings() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$

BEGIN

    INSERT INTO public.candidate_settings (user_id)

    VALUES (new.id)

    ON CONFLICT (user_id) DO NOTHING;

    RETURN new;

END;

$$;


--
-- Name: initialize_recruiter_settings(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.initialize_recruiter_settings() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$

BEGIN

    INSERT INTO public.recruiter_settings (user_id)

    VALUES (NEW.user_id)

    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;

END;

$$;


--
-- Name: is_authenticated_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_authenticated_user() RETURNS boolean
    LANGUAGE sql STABLE
    AS $$

  SELECT public.uid() IS NOT NULL;

$$;


--
-- Name: protect_job_ownership_and_log(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_job_ownership_and_log() RETURNS trigger
    LANGUAGE plpgsql
    AS $$

DECLARE

    job_owner_id UUID;

BEGIN

    -- Get the recruiter who originally posted this job

    SELECT recruiter_id INTO job_owner_id FROM jobs WHERE id = NEW.job_id;



    -- GUARDRAIL: Only the owner (or the system) can change statuses

    IF (OLD.status IS DISTINCT FROM NEW.status) AND (public.uid() IS NOT NULL) THEN

        IF (public.uid() != job_owner_id) THEN

            RAISE EXCEPTION 'Permission Denied: Only the recruiter who posted this job can move candidates in the pipeline.';

        END IF;

        

        -- Log the change to history

        INSERT INTO job_application_status_history (application_id, old_status, new_status, changed_by, reason)

        VALUES (NEW.id, OLD.status, NEW.status, public.uid(), NEW.feedback);

    END IF;



    RETURN NEW;

END;

$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$

BEGIN

    NEW.updated_at = NOW();

    RETURN NEW;

END;

$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: assessment_questions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assessment_questions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    category text NOT NULL,
    driver text NOT NULL,
    experience_band text NOT NULL,
    difficulty text NOT NULL,
    question_text text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    evaluation_rubric text
);


--
-- Name: COLUMN assessment_questions.evaluation_rubric; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.assessment_questions.evaluation_rubric IS 'Guidance for the AI on what constitutes a high-quality (score 6) answer based on intent and logic.';


--
-- Name: assessment_responses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assessment_responses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    candidate_id uuid,
    question_id uuid,
    category text NOT NULL,
    driver text,
    difficulty text,
    raw_answer text,
    score integer,
    evaluation_metadata jsonb DEFAULT '{}'::jsonb,
    is_skipped boolean DEFAULT false,
    tab_switches integer DEFAULT 0,
    time_taken_seconds integer,
    created_at timestamp with time zone DEFAULT now(),
    question_text text,
    CONSTRAINT assessment_responses_score_check CHECK (((score >= 0) AND (score <= 6)))
);


--
-- Name: assessment_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assessment_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    candidate_id uuid,
    experience_band text NOT NULL,
    status text DEFAULT 'started'::text,
    total_budget integer,
    current_step integer DEFAULT 1,
    overall_score double precision DEFAULT 0.0,
    component_scores jsonb DEFAULT '{}'::jsonb,
    driver_confidence jsonb DEFAULT '{}'::jsonb,
    started_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone,
    warning_count integer DEFAULT 0
);


--
-- Name: blocked_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.blocked_users (
    user_id uuid NOT NULL,
    reason text,
    blocked_at timestamp with time zone DEFAULT now()
);


--
-- Name: candidate_job_sync; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.candidate_job_sync (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    candidate_id uuid,
    job_id uuid,
    overall_match_score double precision,
    match_explanation text,
    missing_critical_skills text[],
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: candidate_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.candidate_profiles (
    user_id uuid NOT NULL,
    experience public.experience_band NOT NULL,
    location text,
    assessment_status public.assessment_status DEFAULT 'not_started'::public.assessment_status,
    created_at timestamp with time zone DEFAULT now(),
    skills text[],
    onboarding_step text DEFAULT 'INITIAL'::text,
    final_profile_score integer,
    job_type public.job_type DEFAULT 'onsite'::public.job_type,
    career_interests text[] DEFAULT '{}'::text[],
    learning_interests text[] DEFAULT '{}'::text[],
    social_links jsonb DEFAULT '{}'::jsonb,
    full_name text,
    phone_number text,
    profile_strength public.profile_strength DEFAULT 'Low'::public.profile_strength,
    completion_score integer DEFAULT 0,
    "current_role" text,
    years_of_experience integer,
    updated_at timestamp with time zone DEFAULT now(),
    profile_photo_url text,
    bio text,
    primary_industry_focus text,
    current_employment_status public.employment_status,
    key_responsibilities text,
    major_achievements text,
    linkedin_url text,
    portfolio_url text,
    learning_links jsonb DEFAULT '[]'::jsonb,
    terms_accepted boolean DEFAULT false,
    account_status public.account_status DEFAULT 'Active'::public.account_status,
    gender text,
    birthdate date,
    qualification_held text,
    graduation_year integer,
    referral text,
    resume_path text,
    target_role text,
    long_term_goal text,
    education_history jsonb DEFAULT '[]'::jsonb,
    experience_history jsonb DEFAULT '[]'::jsonb,
    projects jsonb DEFAULT '[]'::jsonb,
    certifications text[] DEFAULT '{}'::text[],
    career_gap_report jsonb DEFAULT '{}'::jsonb,
    professional_summary text,
    gpa_score numeric(3,2),
    graduation_status text,
    last_resume_parse_at timestamp with time zone,
    ai_extraction_confidence double precision DEFAULT 0.0,
    identity_verified boolean DEFAULT false,
    identity_proof_path text,
    expected_salary bigint,
    location_tier text
);


--
-- Name: COLUMN candidate_profiles.education_history; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.candidate_profiles.education_history IS 'Array of {institute, degree, year_passing, gpa_or_pcnt}';


--
-- Name: COLUMN candidate_profiles.experience_history; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.candidate_profiles.experience_history IS 'Array of {role, company, tenure_years, achievements, start_date, end_date}';


--
-- Name: COLUMN candidate_profiles.career_gap_report; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.candidate_profiles.career_gap_report IS 'Detailed audit of career gaps (>6mo for experienced, >12mo for freshers)';


--
-- Name: candidate_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.candidate_settings (
    user_id uuid NOT NULL,
    email_notifications boolean DEFAULT true,
    web_notifications boolean DEFAULT true,
    mobile_notifications boolean DEFAULT false,
    is_public boolean DEFAULT true,
    language text DEFAULT 'en'::text,
    timezone text DEFAULT 'UTC'::text,
    job_alert_frequency text DEFAULT 'instant'::text,
    minimum_salary_threshold integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: career_gps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.career_gps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    candidate_id uuid NOT NULL,
    target_role text NOT NULL,
    current_status text DEFAULT 'active'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT career_gps_current_status_check CHECK ((current_status = ANY (ARRAY['active'::text, 'archived'::text])))
);


--
-- Name: career_milestones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.career_milestones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    gps_id uuid NOT NULL,
    step_order integer NOT NULL,
    title text NOT NULL,
    description text,
    skills_to_acquire text[] DEFAULT '{}'::text[],
    learning_actions jsonb DEFAULT '[]'::jsonb,
    status text DEFAULT 'not-started'::text,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    verification_url text,
    proof_attachment_path text,
    CONSTRAINT career_milestones_status_check CHECK ((status = ANY (ARRAY['not-started'::text, 'in-progress'::text, 'completed'::text])))
);


--
-- Name: chat_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    thread_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    text text NOT NULL,
    is_read boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: chat_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message_id uuid,
    reporter_id uuid,
    thread_id uuid,
    reason text NOT NULL,
    status public.report_status DEFAULT 'pending'::public.report_status,
    admin_notes text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: chat_threads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_threads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    candidate_id uuid NOT NULL,
    recruiter_id uuid NOT NULL,
    is_active boolean DEFAULT false,
    last_message_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: companies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.companies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    registration_number text,
    website text,
    location text,
    created_at timestamp with time zone DEFAULT now(),
    description text,
    profile_score integer DEFAULT 0,
    industry_category text,
    size_band public.company_size_band,
    sales_model public.sales_model_type,
    target_market public.target_market,
    visibility_tier text DEFAULT 'Low'::text,
    verification_status text DEFAULT 'Under Review'::text,
    domain text,
    hiring_focus_areas text[] DEFAULT '{}'::text[],
    avg_deal_size_range text,
    candidate_feedback_score double precision DEFAULT 0.0,
    successful_hires_count integer DEFAULT 0,
    updated_at timestamp with time zone DEFAULT now(),
    logo_url text,
    brand_colors jsonb DEFAULT '{"primary": "#2563eb", "secondary": "#64748b"}'::jsonb,
    life_at_photo_urls text[] DEFAULT '{}'::text[]
);


--
-- Name: follows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.follows (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    follower_id uuid,
    following_id uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: interview_slots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.interview_slots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    interview_id uuid,
    start_time timestamp with time zone NOT NULL,
    end_time timestamp with time zone NOT NULL,
    is_selected boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: interviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.interviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_id uuid,
    candidate_id uuid,
    recruiter_id uuid,
    application_id uuid,
    status public.interview_status DEFAULT 'pending_confirmation'::public.interview_status,
    round_name text NOT NULL,
    round_number integer DEFAULT 1,
    format public.interview_format DEFAULT 'virtual'::public.interview_format,
    meeting_link text,
    location text,
    interviewer_names text[] DEFAULT '{}'::text[],
    feedback text,
    cancellation_reason text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: job_application_status_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_application_status_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    application_id uuid NOT NULL,
    old_status text,
    new_status text NOT NULL,
    changed_by uuid NOT NULL,
    reason text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: job_applications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_applications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_id uuid,
    candidate_id uuid,
    status public.application_status DEFAULT 'applied'::public.application_status,
    feedback text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    invitation_message text
);


--
-- Name: job_views; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_views (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_id uuid,
    candidate_id uuid,
    viewer_ip text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid,
    recruiter_id uuid,
    title text NOT NULL,
    description text NOT NULL,
    experience_band public.experience_band NOT NULL,
    location text,
    job_type public.job_type DEFAULT 'onsite'::public.job_type,
    skills_required text[],
    salary_range text,
    status public.job_status DEFAULT 'active'::public.job_status,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    is_ai_generated boolean DEFAULT false,
    closed_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb,
    requirements text[] DEFAULT '{}'::text[],
    number_of_positions integer DEFAULT 1
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    type text NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    is_read boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: post_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.post_comments (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    user_id uuid,
    post_id uuid,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: post_likes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.post_likes (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    user_id uuid,
    post_id uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.posts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    content text NOT NULL,
    media_urls text[] DEFAULT '{}'::text[] NOT NULL,
    type text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: profile_analytics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profile_analytics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    candidate_id uuid,
    recruiter_id uuid,
    event_type text,
    job_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    metadata jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT profile_analytics_event_type_check CHECK ((event_type = ANY (ARRAY['profile_view'::text, 'shortlist_add'::text, 'invite_sent'::text])))
);


--
-- Name: profile_matches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profile_matches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    candidate_id uuid,
    recruiter_id uuid,
    match_score integer DEFAULT 0,
    reasoning_text text,
    candidate_token text,
    recruiter_token text,
    match_type text DEFAULT 'culture_fit'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: profile_scores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profile_scores (
    user_id uuid NOT NULL,
    resume_score integer,
    behavioral_score integer,
    psychometric_score integer,
    skills_score integer,
    reference_score integer,
    final_score integer,
    calculated_at timestamp with time zone DEFAULT now()
);


--
-- Name: recruiter_assessment_questions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recruiter_assessment_questions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    category text NOT NULL,
    driver text NOT NULL,
    question_text text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: recruiter_assessment_responses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recruiter_assessment_responses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    question_text text NOT NULL,
    answer_text text NOT NULL,
    category text NOT NULL,
    relevance_score integer,
    specificity_score integer,
    clarity_score integer,
    ownership_score integer,
    average_score numeric(3,2),
    created_at timestamp with time zone DEFAULT now(),
    evaluation_metadata jsonb DEFAULT '{}'::jsonb
);


--
-- Name: recruiter_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recruiter_profiles (
    user_id uuid NOT NULL,
    company_id uuid,
    assessment_status public.assessment_status DEFAULT 'not_started'::public.assessment_status,
    created_at timestamp with time zone DEFAULT now(),
    onboarding_step text DEFAULT 'REGISTRATION'::text,
    warning_count integer DEFAULT 0,
    full_name text,
    job_title text,
    phone_number text,
    linkedin_url text,
    completion_score integer DEFAULT 0,
    updated_at timestamp with time zone DEFAULT now(),
    terms_accepted boolean DEFAULT false,
    account_status public.account_status DEFAULT 'Active'::public.account_status,
    bio text,
    team_role text DEFAULT 'recruiter'::text,
    is_admin boolean DEFAULT false,
    identity_proof_path text,
    identity_verified boolean DEFAULT false,
    professional_persona jsonb DEFAULT '{}'::jsonb
);


--
-- Name: recruiter_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recruiter_settings (
    user_id uuid NOT NULL,
    email_notifications boolean DEFAULT true,
    web_notifications boolean DEFAULT true,
    mobile_notifications boolean DEFAULT false,
    profile_visibility text DEFAULT 'public'::text,
    language text DEFAULT 'en'::text,
    timezone text DEFAULT 'UTC'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    ghost_mode boolean DEFAULT false
);


--
-- Name: resume_data; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.resume_data (
    user_id uuid NOT NULL,
    raw_text text,
    timeline jsonb,
    career_gaps jsonb,
    achievements text[],
    skills text[],
    education jsonb,
    parsed_at timestamp with time zone DEFAULT now(),
    raw_education jsonb,
    raw_experience jsonb,
    raw_projects jsonb
);


--
-- Name: saved_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.saved_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    candidate_id uuid,
    job_id uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: skill_catalog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.skill_catalog (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    experience_band text NOT NULL,
    occurrence_count bigint DEFAULT 1,
    is_verified boolean DEFAULT true,
    last_seen_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: team_invitations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_invitations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid,
    inviter_id uuid,
    email text NOT NULL,
    status text DEFAULT 'pending'::text,
    created_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone DEFAULT (now() + '7 days'::interval)
);


--
-- Name: user_pinned_posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_pinned_posts (
    user_id uuid NOT NULL,
    post_id uuid NOT NULL,
    pinned_at timestamp with time zone DEFAULT now()
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid NOT NULL,
    role public.user_role NOT NULL,
    email text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Data for Name: assessment_questions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.assessment_questions (id, category, driver, experience_band, difficulty, question_text, created_at, evaluation_rubric) FROM stdin;
8b60c04d-b9f3-4c0e-8eae-059443d8a454	behavioral	resilience	fresher	low	What does resilience mean to you?	2026-02-09 06:54:42.710979+00	\N
9fbb2ff7-0166-4cc2-81ed-e83e4006da2f	behavioral	resilience	fresher	low	How do you stay motivated after a setback?	2026-02-09 06:54:42.710979+00	\N
1bbe28c0-045e-41a9-86ef-bca89523fd81	behavioral	resilience	fresher	low	Describe a time you faced a small failure.	2026-02-09 06:54:42.710979+00	\N
97b001d7-6c83-41c0-9996-151d4eb441f3	behavioral	resilience	fresher	low	How do you handle criticism as a fresher?	2026-02-09 06:54:42.710979+00	\N
617f41a9-7751-43ca-98d7-76a988fe8402	behavioral	resilience	fresher	low	How do you stay calm under pressure?	2026-02-09 06:54:42.710979+00	\N
9de2d468-1ce2-4177-8644-1f2c1365a267	behavioral	resilience	fresher	low	How do you react when you make a mistake for the first time?	2026-02-09 06:54:42.710979+00	\N
d74c0324-9956-4c5b-b93c-89bba1e56430	behavioral	resilience	fresher	low	Tell me about a time you felt nervous but still completed a task.	2026-02-09 06:54:42.710979+00	\N
a1783acf-f5f0-4857-9a1f-956ac35476ac	behavioral	resilience	fresher	low	How do you stay positive when learning something difficult?	2026-02-09 06:54:42.710979+00	\N
6a80f814-62e0-48c6-82d2-fe2f587bbf42	behavioral	resilience	fresher	low	How do you handle stress during exams or evaluations?	2026-02-09 06:54:42.710979+00	\N
16b31cf8-e8f1-44b7-a9dd-d9939c0e3e61	behavioral	resilience	fresher	low	Describe a time you had to repeat an effort to succeed.	2026-02-09 06:54:42.710979+00	\N
3d645304-d360-492e-9066-95f75366fa86	behavioral	resilience	fresher	low	How do you deal with feeling overwhelmed?	2026-02-09 06:54:42.710979+00	\N
18660d96-3e7e-4dd7-8034-4e0d4034e4ae	behavioral	resilience	fresher	low	Tell me about a time you did not understand something immediately.	2026-02-09 06:54:42.710979+00	\N
f0bbc754-7b34-4162-ab42-4dbabfbe60b2	behavioral	resilience	fresher	low	How do you respond when your effort is not immediately recognized?	2026-02-09 06:54:42.710979+00	\N
5da9494b-f347-43d8-af7b-fcee650c776c	behavioral	resilience	fresher	low	Describe a time you had to manage disappointment.	2026-02-09 06:54:42.710979+00	\N
198c7246-84d6-4c7f-b6ce-342834217aa0	behavioral	resilience	fresher	low	How do you stay committed to learning when it feels difficult?	2026-02-09 06:54:42.710979+00	\N
23bb7658-540b-4bc6-abd6-854a21fd7a6c	behavioral	resilience	fresher	low	Tell me about a time you had to be patient to see results.	2026-02-09 06:54:42.710979+00	\N
38b4396e-ad79-4986-944a-5b5fbef53eab	behavioral	resilience	fresher	low	How do you handle uncertainty as a fresher?	2026-02-09 06:54:42.710979+00	\N
25b8e67f-0ec8-4dd6-9231-80da9073d9bb	behavioral	resilience	fresher	low	Describe a time you improved after receiving feedback.	2026-02-09 06:54:42.710979+00	\N
ea721364-1def-45dc-9f1b-f6e4f5bbd0c5	behavioral	resilience	fresher	low	How do you manage pressure when deadlines are close?	2026-02-09 06:54:42.710979+00	\N
673570dd-f45a-49d1-bf3f-dac804e2bcb5	behavioral	resilience	fresher	low	Tell me about a time you had to restart after a mistake.	2026-02-09 06:54:42.710979+00	\N
c9624b9e-41a8-4f13-8806-eafe112d88ed	behavioral	resilience	fresher	low	How do you motivate yourself during slow progress?	2026-02-09 06:54:42.710979+00	\N
9ed7fea8-0aae-45ca-97ed-830660460db8	behavioral	resilience	fresher	low	Describe a time you stayed calm despite confusion.	2026-02-09 06:54:42.710979+00	\N
0d110ae9-fee0-4423-9e4c-0e0eb97721c8	behavioral	resilience	fresher	low	How do you respond when learning feels overwhelming?	2026-02-09 06:54:42.710979+00	\N
c4017b22-8c6a-4f32-a84c-b95870412af4	behavioral	resilience	fresher	low	Tell me about a time you had to push yourself to continue.	2026-02-09 06:54:42.710979+00	\N
cb76f5e5-88a2-4fef-8bed-652e7b556fe4	behavioral	resilience	fresher	low	How does resilience help you grow as a fresher?	2026-02-09 06:54:42.710979+00	\N
e1424ac3-75f0-4c9e-af05-e789c2a7459d	behavioral	resilience	fresher	medium	Describe a situation where you had to keep trying despite difficulties.	2026-02-09 06:54:55.03361+00	\N
483be1fc-0037-488f-b9b3-8ea82d339e4d	behavioral	resilience	fresher	medium	How do you respond when things do not go as planned?	2026-02-09 06:54:55.03361+00	\N
12ab1344-7f0e-4ef3-a76d-5b2617d04651	behavioral	resilience	fresher	medium	Tell me about a time you balanced studies and pressure.	2026-02-09 06:54:55.03361+00	\N
e9f537e6-e158-4a5b-8ba6-77e99cea317e	behavioral	resilience	fresher	medium	How do you handle repeated mistakes?	2026-02-09 06:54:55.03361+00	\N
945f1369-b3c6-4501-8236-ad6017344011	behavioral	resilience	fresher	medium	Describe a time you stayed committed despite low confidence.	2026-02-09 06:54:55.03361+00	\N
88fc4300-2bd2-4938-84c1-a77af5d13717	behavioral	resilience	fresher	medium	Describe a time you had to keep trying even when progress was slow.	2026-02-09 06:54:55.03361+00	\N
6e3a6208-5651-4888-9727-b2f0d57b95b8	behavioral	resilience	fresher	medium	How do you respond when you feel discouraged after a mistake?	2026-02-09 06:54:55.03361+00	\N
745af857-9a91-4d9b-8e4b-db01bef8b1fe	behavioral	resilience	fresher	medium	Tell me about a time you managed pressure while learning something new.	2026-02-09 06:54:55.03361+00	\N
12baa7a9-50b4-4ee9-8d28-31035b3c351b	behavioral	resilience	fresher	medium	How do you stay consistent when tasks become repetitive or difficult?	2026-02-09 06:54:55.03361+00	\N
74f8ad14-32f3-4c5a-998a-a9514ac90926	behavioral	resilience	fresher	medium	Describe a time you had to recover after a poor performance.	2026-02-09 06:54:55.03361+00	\N
1294c3e3-7c2d-4eb6-99eb-11e53dfe9a9f	behavioral	resilience	fresher	medium	How do you manage stress when expectations feel high?	2026-02-09 06:54:55.03361+00	\N
6a9f4354-a5a9-40ba-b166-c8a65bf3330f	behavioral	resilience	fresher	medium	Tell me about a time you had to repeat effort to succeed.	2026-02-09 06:54:55.03361+00	\N
1c976e4b-cc02-4648-bd0b-0af59ca0df49	behavioral	resilience	fresher	medium	How do you handle feedback that highlights your weaknesses?	2026-02-09 06:54:55.03361+00	\N
5c8854ff-3013-41a6-b783-858f83182d9a	behavioral	resilience	fresher	medium	Describe a time when you felt unsure but continued anyway.	2026-02-09 06:54:55.03361+00	\N
c57bdd54-27a2-4f6a-9725-eca19dda5185	behavioral	resilience	fresher	medium	How do you deal with emotional ups and downs during learning?	2026-02-09 06:54:55.03361+00	\N
aaa762df-abf3-4460-8f5e-2012a0fc7313	behavioral	resilience	fresher	medium	Tell me about a time you had to stay patient for results.	2026-02-09 06:54:55.03361+00	\N
14e119dc-8842-4ed2-a586-a175d275a6fe	behavioral	resilience	fresher	medium	How do you react when things take longer than expected?	2026-02-09 06:54:55.03361+00	\N
835ed5cb-b417-486e-951f-72879e777704	behavioral	resilience	fresher	medium	Describe a time you pushed yourself beyond comfort.	2026-02-09 06:54:55.03361+00	\N
c06c1838-520b-43c2-bf23-897b0fb97aec	behavioral	resilience	fresher	medium	How do you stay focused when confidence is low?	2026-02-09 06:54:55.03361+00	\N
a470dddf-b546-4821-9e45-3422a6620806	behavioral	resilience	fresher	medium	Tell me about a time you had to handle pressure without support.	2026-02-09 06:54:55.03361+00	\N
4d2fa9bc-746f-4fc8-9a51-a6a61419eafe	behavioral	resilience	fresher	medium	How do you maintain effort when results are unclear?	2026-02-09 06:54:55.03361+00	\N
a202d41d-8b79-49bb-aa48-2c77afdde2e2	behavioral	resilience	fresher	medium	Describe a time when patience helped you improve.	2026-02-09 06:54:55.03361+00	\N
e8b628e7-a836-4055-9db7-156e211f7913	behavioral	resilience	fresher	medium	How do you respond when challenges repeat?	2026-02-09 06:54:55.03361+00	\N
bbcd680b-fbae-4291-b710-11b3b683cf9a	behavioral	resilience	fresher	medium	Tell me about a time you had to rebuild confidence.	2026-02-09 06:54:55.03361+00	\N
8a973479-7c60-4062-914a-ec4c93f2ae73	behavioral	resilience	fresher	medium	How does resilience help you manage learning pressure as a fresher?	2026-02-09 06:54:55.03361+00	\N
e5d40809-9540-4b12-93ce-691bb782dfdb	behavioral	resilience	fresher	high	Describe a time you failed but did not give up.	2026-02-09 06:55:01.421441+00	\N
3c44fede-f938-4128-a95f-40748b4e4dac	behavioral	resilience	fresher	low	Tell me about a small goal you struggled to achieve.	2026-02-13 09:33:54.735129+00	Score 6: Honesty about the struggle. Candidate explains the obstacle clearly and demonstrates the effort used to overcome it.
47eff3e4-130e-4f66-a590-a58e3c508798	behavioral	resilience	fresher	high	How do you recover emotionally from disappointment?	2026-02-09 06:55:01.421441+00	\N
c24f8c3d-f138-4e1d-9877-08247bd026c6	behavioral	resilience	fresher	high	Tell me about a situation where you faced continuous challenges.	2026-02-09 06:55:01.421441+00	\N
f46c0d89-7221-4f13-ba63-7bfb36e801b9	behavioral	resilience	fresher	high	How do you handle situations where results take time?	2026-02-09 06:55:01.421441+00	\N
c1019203-97d7-4a3b-ae80-6b7bf6d5edae	behavioral	resilience	fresher	high	Why is resilience important for your early career?	2026-02-09 06:55:01.421441+00	\N
b81adb93-d970-4865-854b-1e78d5c7c6f4	behavioral	resilience	fresher	high	Describe a situation where you felt overwhelmed but still completed your responsibility.	2026-02-09 06:55:01.421441+00	\N
732f40bf-6a2a-4df0-a4b2-c609c9d4601b	behavioral	resilience	fresher	high	Tell me about a time when repeated failure tested your confidence.	2026-02-09 06:55:01.421441+00	\N
84126196-d156-43d3-9655-cd60712c78e2	behavioral	resilience	fresher	high	How did you cope when your best effort did not give expected results?	2026-02-09 06:55:01.421441+00	\N
1e24a784-ef50-49c9-8cbc-f115c8d2ab18	behavioral	resilience	fresher	high	Describe a time you had to continue despite emotional stress.	2026-02-09 06:55:01.421441+00	\N
706a6335-b03c-4c62-a9be-0748136fd08a	behavioral	resilience	fresher	high	Tell me about a challenge that took longer than expected to overcome.	2026-02-09 06:55:01.421441+00	\N
a67e5a13-2a82-4e69-a117-249fb8a651a1	behavioral	resilience	fresher	high	How did you respond when you doubted your own ability?	2026-02-09 06:55:01.421441+00	\N
fb262c73-e2de-480e-8e0c-c9cf4212dd46	behavioral	resilience	fresher	high	Describe a situation where pressure affected your emotions.	2026-02-09 06:55:01.421441+00	\N
5e658784-b38c-4f2f-afb9-905716f4e0ed	behavioral	resilience	fresher	high	How did you handle failure without external support?	2026-02-09 06:55:01.421441+00	\N
8f845cd8-a809-4002-8aaa-a4069da6ee56	behavioral	resilience	fresher	high	Tell me about a time you had to stay focused during uncertainty.	2026-02-09 06:55:01.421441+00	\N
1e3da182-a444-4545-bace-f80053cced28	behavioral	resilience	fresher	high	Describe a moment when quitting felt easier than continuing.	2026-02-09 06:55:01.421441+00	\N
274ca33e-5d2f-411f-bfff-79b7e2838280	behavioral	resilience	fresher	high	How did you manage stress during critical learning phases?	2026-02-09 06:55:01.421441+00	\N
f37b82e3-21c9-4bf3-93e8-01e179d4df37	behavioral	resilience	fresher	high	Tell me about a time when emotional control was difficult.	2026-02-09 06:55:01.421441+00	\N
d18beafd-3e97-4099-835f-263682b62895	behavioral	resilience	fresher	high	How did you react when effort was not recognized?	2026-02-09 06:55:01.421441+00	\N
aa09c381-24e1-42fb-9f3c-43af9a80f42f	behavioral	resilience	fresher	high	Describe a time when patience was difficult to maintain.	2026-02-09 06:55:01.421441+00	\N
a1e0050e-7766-4c6c-b7c8-efd29be6ded8	behavioral	resilience	fresher	high	How did you rebuild motivation after emotional exhaustion?	2026-02-09 06:55:01.421441+00	\N
bac13b7b-d09b-45ec-a10a-46727941716c	behavioral	resilience	fresher	high	Tell me about a time you had to stay disciplined without immediate results.	2026-02-09 06:55:01.421441+00	\N
cee75c80-9ab8-4a05-a632-2410606e1a15	behavioral	resilience	fresher	high	How did you handle continuous pressure without losing focus?	2026-02-09 06:55:01.421441+00	\N
d77b0d34-f3ed-409c-ae4a-6b74e160085a	behavioral	resilience	fresher	high	Describe a situation where emotional resilience helped you succeed.	2026-02-09 06:55:01.421441+00	\N
7ca22adc-c49d-497f-bfd0-e79b36905802	behavioral	resilience	fresher	high	How did you stay mentally strong during repeated challenges?	2026-02-09 06:55:01.421441+00	\N
eeaeb9ae-e6f9-4e83-9b51-9150c8e5c2bb	behavioral	resilience	fresher	high	Why is resilience critical for freshers facing early career pressure?	2026-02-09 06:55:01.421441+00	\N
03280c1e-1595-4d39-86a8-63c63d22fbde	behavioral	communication	fresher	low	Why is communication important in a workplace?	2026-02-09 06:58:16.685768+00	\N
9e3a2335-8f3f-469f-b56d-693fc877b2e4	behavioral	communication	fresher	low	How do you usually communicate in a team?	2026-02-09 06:58:16.685768+00	\N
8283bde6-d036-41c4-ab21-9af79ef53ce8	behavioral	communication	fresher	low	Describe a time you explained something clearly.	2026-02-09 06:58:16.685768+00	\N
b6b1fa1e-7a2f-473c-9b0c-27260c52f7e9	behavioral	communication	fresher	low	How do you ensure others understand your message?	2026-02-09 06:58:16.685768+00	\N
346ded84-d8d8-4755-97f4-28b1c12ae44d	behavioral	communication	fresher	low	How do you listen during conversations?	2026-02-09 06:58:16.685768+00	\N
08681a30-6c50-45b0-9ca1-4ea2039d7ba7	behavioral	communication	fresher	low	How do you usually share updates with others?	2026-02-09 06:58:16.685768+00	\N
82eca926-8661-4252-81ee-28ffd3f18081	behavioral	communication	fresher	low	How do you explain your ideas to someone new?	2026-02-09 06:58:16.685768+00	\N
4794b181-90e0-4d6e-99c8-26d8cc6fa6b5	behavioral	communication	fresher	low	How do you respond when someone asks for clarification?	2026-02-09 06:58:16.685768+00	\N
a994b3cd-8e9d-4bf9-9b04-c2a8c264b8be	behavioral	communication	fresher	low	How do you communicate during group discussions?	2026-02-09 06:58:16.685768+00	\N
d9c2a1f9-3f0f-4745-9898-71bfbb07ee0f	behavioral	communication	fresher	low	How do you make sure your message is understood?	2026-02-09 06:58:16.685768+00	\N
842f5baf-3fd4-4ba5-9fbc-4063f52e9ef7	behavioral	communication	fresher	low	How do you talk to someone senior or experienced?	2026-02-09 06:58:16.685768+00	\N
e1d9431f-b9b8-4e3d-9542-9aef7cc13591	behavioral	communication	fresher	low	How do you communicate when you are unsure?	2026-02-09 06:58:16.685768+00	\N
a9bd9f21-b6ea-4212-a39e-0e67c2feb330	behavioral	communication	fresher	low	How do you listen actively during conversations?	2026-02-09 06:58:16.685768+00	\N
70b7cd28-633d-45ad-b982-d72bd49f1158	behavioral	communication	fresher	low	How do you express your thoughts clearly?	2026-02-09 06:58:16.685768+00	\N
04e4043f-0ecd-4506-8603-010c239edb24	behavioral	communication	fresher	low	How do you communicate instructions to others?	2026-02-09 06:58:16.685768+00	\N
fadd3e93-2bbe-46a2-a66a-6580b28ba85e	behavioral	communication	fresher	low	How do you react when someone misunderstands you?	2026-02-09 06:58:16.685768+00	\N
aa749ae9-2c4a-4d80-a415-01e79fc024ee	behavioral	communication	fresher	low	How do you communicate in a learning environment?	2026-02-09 06:58:16.685768+00	\N
d4a4d841-b3dc-494c-8706-6e9e471328eb	behavioral	communication	fresher	low	How do you share feedback with peers?	2026-02-09 06:58:16.685768+00	\N
121a1131-0f76-4160-bf0b-eeddeebe842f	behavioral	communication	fresher	low	How do you communicate when working on a task together?	2026-02-09 06:58:16.685768+00	\N
b7d5f36e-2068-4045-91c6-77a391068d7f	behavioral	communication	fresher	low	How do you handle simple disagreements?	2026-02-09 06:58:16.685768+00	\N
cd99afd3-f129-4b35-97f3-2f74c84acfba	behavioral	communication	fresher	low	How do you communicate when giving updates?	2026-02-09 06:58:16.685768+00	\N
8b4f26a2-5feb-4178-9e5b-a080d0d4abf6	behavioral	communication	fresher	low	How do you adjust your communication with different people?	2026-02-09 06:58:16.685768+00	\N
5e8da2db-d793-4494-874f-4f2c2725d680	behavioral	communication	fresher	low	How do you communicate when you make a mistake?	2026-02-09 06:58:16.685768+00	\N
127b015f-cbd0-4804-9353-6ab3a46e03ce	behavioral	communication	fresher	low	How do you ask for help when needed?	2026-02-09 06:58:16.685768+00	\N
d50f4aa0-3cf9-464c-bce7-c05ff24aabf4	behavioral	communication	fresher	low	Why is communication important for freshers?	2026-02-09 06:58:16.685768+00	\N
1c602320-d97a-4602-9181-122e2ec680c5	behavioral	communication	fresher	medium	Describe a situation where you had to explain a difficult topic.	2026-02-09 06:58:38.233056+00	\N
948b6efa-9311-4b42-b502-e40a070d3762	behavioral	communication	fresher	medium	How do you handle misunderstandings?	2026-02-09 06:58:38.233056+00	\N
ecdfd30c-e455-4805-b7d7-19c337d3ffd7	behavioral	communication	fresher	medium	Describe a time you asked questions to understand better.	2026-02-09 06:58:38.233056+00	\N
ef3d3beb-3e7c-4c11-a108-f86c2fa19956	behavioral	communication	fresher	medium	How do you communicate when you are unsure about something?	2026-02-09 06:58:38.233056+00	\N
0a24cde9-2378-4baa-afba-aecf7fcac434	behavioral	communication	fresher	medium	How do you adjust your communication style with different people?	2026-02-09 06:58:38.233056+00	\N
27b21f2b-0efc-4022-8a90-634c87fa60fc	behavioral	communication	fresher	medium	Describe a time when you had to clearly explain your point to avoid confusion.	2026-02-09 06:58:38.233056+00	\N
06651683-8ed7-413b-b225-6c2cb4678855	behavioral	communication	fresher	medium	How do you communicate when working on a group task?	2026-02-09 06:58:38.233056+00	\N
9c92969b-ab69-47d3-9453-dba02f15dd6c	behavioral	communication	fresher	medium	Describe a situation where you had to ask for clarification.	2026-02-09 06:58:38.233056+00	\N
76c206f3-5a87-4161-bfbc-32226ad74392	behavioral	communication	fresher	medium	How do you ensure your message is not misunderstood?	2026-02-09 06:58:38.233056+00	\N
2652faad-8d0d-4be3-8b5c-d901273f7318	behavioral	communication	fresher	medium	Tell me about a time you had to listen carefully to respond well.	2026-02-09 06:58:38.233056+00	\N
e9422ec8-b8da-4bc4-9379-6bee7e38e555	behavioral	communication	fresher	medium	How do you communicate when you disagree politely?	2026-02-09 06:58:38.233056+00	\N
e9418eee-a213-4fd0-a890-b2842b963029	behavioral	communication	fresher	medium	Describe a time you had to communicate instructions clearly.	2026-02-09 06:58:38.233056+00	\N
93c14dad-fd88-462d-a714-4f298a942eaf	behavioral	communication	fresher	medium	How do you communicate in situations where you feel nervous?	2026-02-09 06:58:38.233056+00	\N
fb134533-4fe8-400a-a1ae-3697774e9e20	behavioral	communication	fresher	medium	Tell me about a time you had to communicate in writing.	2026-02-09 06:58:38.233056+00	\N
2883c51e-85a1-4690-9779-cce52ca97572	behavioral	communication	fresher	medium	How do you handle feedback during communication?	2026-02-09 06:58:38.233056+00	\N
d6366273-7d7c-42b1-903b-c9a4a5d42029	behavioral	communication	fresher	medium	Describe a time when you had to explain something to a new person.	2026-02-09 06:58:38.233056+00	\N
1820598e-969f-495b-8a28-5ed87cbb4e65	behavioral	communication	fresher	medium	How do you communicate when tasks are unclear?	2026-02-09 06:58:38.233056+00	\N
2193c78f-2dd6-4499-b412-212dcd4b3c7d	behavioral	communication	fresher	medium	Tell me about a time you helped someone understand better.	2026-02-09 06:58:38.233056+00	\N
f52e7a0b-06fc-4c90-9969-8af18e66a313	behavioral	communication	fresher	medium	How do you ensure effective communication in virtual settings?	2026-02-09 06:58:38.233056+00	\N
38506493-1538-49ad-bb4a-94cf4351071c	behavioral	communication	fresher	medium	Describe a situation where you had to repeat information.	2026-02-09 06:58:38.233056+00	\N
dba97e7e-bf80-455f-bef3-fb0fe56cf555	behavioral	communication	fresher	medium	How do you communicate with someone who speaks less?	2026-02-09 06:58:38.233056+00	\N
85faf7c3-f0ea-49b5-8694-a292b2c42313	behavioral	communication	fresher	medium	Tell me about a time when communication helped complete a task.	2026-02-09 06:58:38.233056+00	\N
fe5d76ea-0405-41d6-ae8a-a7bb2feeada8	behavioral	communication	fresher	medium	How do you communicate when you are unsure of the answer?	2026-02-09 06:58:38.233056+00	\N
e167402a-b7ca-49cf-af7d-f0cb1e7a5692	behavioral	communication	fresher	medium	Describe a time you had to summarize information.	2026-02-09 06:58:38.233056+00	\N
628d8045-43e0-4759-a506-20ff7bb7ccbd	behavioral	communication	fresher	medium	How do you improve your communication skills as a fresher?	2026-02-09 06:58:38.233056+00	\N
c3a2de74-48dc-44f4-bdcb-1c6aaa924630	behavioral	communication	fresher	high	Describe a situation where poor communication caused a problem. How did you fix it?	2026-02-09 06:59:24.781173+00	\N
05598b2f-4ebe-4351-9669-af27e84c2789	behavioral	communication	fresher	high	How do you handle communicating under pressure?	2026-02-09 06:59:24.781173+00	\N
db49da08-f8ec-411b-a6b0-512cd12c9a03	behavioral	communication	fresher	high	Tell me about a time you had to communicate bad news.	2026-02-09 06:59:24.781173+00	\N
e97e1662-3e7c-4108-b70e-18dd7ae0af94	behavioral	communication	fresher	high	How do you communicate with someone who disagrees with you?	2026-02-09 06:59:24.781173+00	\N
1e153629-a914-4338-97b1-31e343928d41	behavioral	communication	fresher	high	Why is effective communication important in your early career?	2026-02-09 06:59:24.781173+00	\N
d62c0b9a-6543-4124-99db-257a9e5b4a23	behavioral	communication	fresher	high	Describe a time when your message was misunderstood. How did you correct it?	2026-02-09 06:59:24.781173+00	\N
4bd13593-f3b5-4a83-8899-039d070dad5b	behavioral	communication	fresher	high	Tell me about a time you struggled to express your thoughts clearly.	2026-02-09 06:59:24.781173+00	\N
3745c291-7c25-4cee-bc17-7247cd3eda90	behavioral	communication	fresher	high	Describe a situation where you had to communicate with someone senior.	2026-02-09 06:59:24.781173+00	\N
ab96c5ca-4fd9-4613-aa06-b122bb0df6f3	behavioral	communication	fresher	high	How did you handle a situation where you were nervous to speak?	2026-02-09 06:59:24.781173+00	\N
ac577a9e-3dc3-46a5-b38b-b287e1e7d733	behavioral	communication	fresher	high	Tell me about a time you had to explain yourself after making a mistake.	2026-02-09 06:59:24.781173+00	\N
0905be09-4b6d-4a3d-88e1-15c8f55c2ff1	behavioral	communication	fresher	high	Describe a time when you had to repeat information multiple times.	2026-02-09 06:59:24.781173+00	\N
8eb6f250-2e58-4f9e-984e-6b8b076a2a8a	behavioral	communication	fresher	high	How did you communicate when you were unsure of the correct answer?	2026-02-09 06:59:24.781173+00	\N
3d9c8718-efba-40ce-9b2c-e22c6c816ebe	behavioral	communication	fresher	high	Tell me about a time you had to listen carefully to avoid a mistake.	2026-02-09 06:59:24.781173+00	\N
491730fb-b833-4679-b785-99d4f055e49d	behavioral	communication	fresher	high	Describe a situation where you had to communicate despite stress.	2026-02-09 06:59:24.781173+00	\N
d4ec3576-5f47-47a1-b7c1-2cef18649a37	behavioral	communication	fresher	high	How did you manage a conversation where others were not listening?	2026-02-09 06:59:24.781173+00	\N
328df4a1-0083-4371-8e11-834248dc34b5	behavioral	communication	fresher	high	Tell me about a time you had to ask for help clearly.	2026-02-09 06:59:24.781173+00	\N
340444d0-90ea-42e5-898d-95669480f432	behavioral	communication	fresher	high	Describe a time when you had to explain technical information simply.	2026-02-09 06:59:24.781173+00	\N
0575c228-857b-443d-8333-4b94a356fcbf	behavioral	communication	fresher	high	How did you handle feedback that was difficult to hear?	2026-02-09 06:59:24.781173+00	\N
f9942157-7815-457d-b536-c5dce9b151fd	behavioral	communication	fresher	high	Tell me about a time you had to communicate expectations clearly.	2026-02-09 06:59:24.781173+00	\N
5e74c194-2f7f-4bac-8e6a-c71b477530af	behavioral	communication	fresher	high	Describe a situation where silence helped communication.	2026-02-09 06:59:24.781173+00	\N
57ac4d5d-2fd6-4ed3-8e87-a57135403c95	behavioral	communication	fresher	high	How did you manage communication when you lacked confidence?	2026-02-09 06:59:24.781173+00	\N
1b0f66fa-e7e6-4702-bc08-333199c6024e	behavioral	communication	fresher	high	Tell me about a time you had to clarify assumptions.	2026-02-09 06:59:24.781173+00	\N
dc6e34fe-87f8-4d13-acc1-a24070164b7b	behavioral	communication	fresher	high	Describe a time you adjusted your tone to suit the situation.	2026-02-09 06:59:24.781173+00	\N
f02c482e-2d25-46e3-a948-708592463c53	behavioral	communication	fresher	high	How did you handle a conversation where you felt ignored?	2026-02-09 06:59:24.781173+00	\N
ad229df5-0181-4c59-bde7-5240d0bf788a	behavioral	communication	fresher	high	Why is handling difficult conversations important as a fresher?	2026-02-09 06:59:24.781173+00	\N
83f8b1db-d566-475d-b1f9-ac1389f96e24	behavioral	adaptability	fresher	low	What does adaptability mean to you?	2026-02-09 07:01:57.452308+00	\N
6049d549-608b-4d8c-affa-cf36b50b17b4	behavioral	adaptability	fresher	low	How do you react to changes in routine?	2026-02-09 07:01:57.452308+00	\N
6f9dfbb0-7194-4661-8df5-cbd24d83d00e	behavioral	adaptability	fresher	low	Describe a time you learned something new quickly.	2026-02-09 07:01:57.452308+00	\N
710f2053-f112-4250-b8a7-13d2a7cfe998	behavioral	adaptability	fresher	low	How do you handle new environments?	2026-02-09 07:01:57.452308+00	\N
12208bf2-f680-41b6-a52e-005edeb35395	behavioral	adaptability	fresher	low	How do you feel about learning new tools or skills?	2026-02-09 07:01:57.452308+00	\N
2a00bf1e-145d-481b-aab2-f304db07e206	behavioral	adaptability	fresher	low	How do you feel when plans change suddenly?	2026-02-09 07:01:57.452308+00	\N
0eccf90e-b85e-4d7e-a092-1cb7fd27910d	behavioral	adaptability	fresher	low	How do you respond when you are asked to try a new method?	2026-02-09 07:01:57.452308+00	\N
97a62998-ab9e-4114-b702-23ee0a7e0450	behavioral	adaptability	fresher	low	Describe how you adapt when instructions are unclear.	2026-02-09 07:01:57.452308+00	\N
f6a24352-02e5-4d0f-93de-c90dfd1233a6	behavioral	adaptability	fresher	low	How do you adjust when working with new people?	2026-02-09 07:01:57.452308+00	\N
233e8468-d2ec-4781-b059-ab12257dac4b	behavioral	adaptability	fresher	low	How do you handle changes in learning topics or subjects?	2026-02-09 07:01:57.452308+00	\N
c2313773-7f67-48a8-be58-60bc916510f0	behavioral	adaptability	fresher	low	Describe a time you had to change your study approach.	2026-02-09 07:01:57.452308+00	\N
4c660818-3807-406c-bda2-7774510ba0ef	behavioral	adaptability	fresher	low	How do you react when you receive new responsibilities?	2026-02-09 07:01:57.452308+00	\N
ddd2f0ea-de9a-41ff-8060-a18386c9aad5	behavioral	adaptability	fresher	low	How do you adapt to different teaching or working styles?	2026-02-09 07:01:57.452308+00	\N
0a760c00-9601-4893-9921-af62972482f5	behavioral	adaptability	fresher	low	Describe how you handle unfamiliar tasks.	2026-02-09 07:01:57.452308+00	\N
dd2ad875-9204-4859-85d7-3f9b10152e07	behavioral	adaptability	fresher	low	How do you react when tools or software change?	2026-02-09 07:01:57.452308+00	\N
4c3fc42a-e930-4849-9085-ca35dd653b52	behavioral	adaptability	fresher	low	Describe a time you adjusted after making a mistake.	2026-02-09 07:01:57.452308+00	\N
3fb6566c-74be-414b-a55d-7ae175acdc59	behavioral	adaptability	fresher	low	How do you adapt when expectations change?	2026-02-09 07:01:57.452308+00	\N
7fa6f4a6-2d7d-4dff-a4a0-59c11ff42274	behavioral	adaptability	fresher	low	How do you handle changes in deadlines?	2026-02-09 07:01:57.452308+00	\N
deeba50e-b799-4224-8597-a2ad0ff2dcbb	behavioral	adaptability	fresher	low	Describe how you adapt to feedback.	2026-02-09 07:01:57.452308+00	\N
a0491e51-a4ba-4c8b-86f4-70ab98b84e3e	behavioral	adaptability	fresher	low	How do you handle learning under time pressure?	2026-02-09 07:01:57.452308+00	\N
d2ab666e-560d-4605-858e-9355e80def98	behavioral	adaptability	fresher	low	How do you adapt when rules or guidelines change?	2026-02-09 07:01:57.452308+00	\N
b2f19148-2ec4-447e-a88b-24602e5d88da	behavioral	adaptability	fresher	low	Describe how you respond to unexpected challenges.	2026-02-09 07:01:57.452308+00	\N
37148952-6e81-412e-aeda-ea4b4212fc8f	behavioral	adaptability	fresher	low	How do you adjust when working without prior experience?	2026-02-09 07:01:57.452308+00	\N
1b4ef17b-c28c-4914-9474-6f46246fbb57	behavioral	adaptability	fresher	low	How do you handle changes in your daily schedule?	2026-02-09 07:01:57.452308+00	\N
82123ced-f586-4a3d-b55c-da5354e8711e	behavioral	adaptability	fresher	low	Why is adaptability important for a fresher?	2026-02-09 07:01:57.452308+00	\N
eaeddb5a-9ee4-462a-b43a-2870755b441a	behavioral	adaptability	fresher	medium	Describe a situation where you had to adjust to a sudden change.	2026-02-09 07:02:25.634625+00	\N
685629df-08d5-4191-a07e-9583ae446d40	behavioral	adaptability	fresher	medium	How do you manage tasks when requirements change?	2026-02-09 07:02:25.634625+00	\N
2d209fc0-9ff9-4944-95f2-f1275ffa18a0	behavioral	adaptability	fresher	medium	Tell me about a time you worked outside your comfort zone.	2026-02-09 07:02:25.634625+00	\N
1caef3bf-7bb2-4e4d-8d86-f9630e392b7e	behavioral	adaptability	fresher	medium	How do you handle unfamiliar tasks?	2026-02-09 07:02:25.634625+00	\N
e5f957a6-6903-4395-9be9-d4b5809f6240	behavioral	adaptability	fresher	medium	Describe a time you had to change your approach to succeed.	2026-02-09 07:02:25.634625+00	\N
4c2762d0-d847-41a3-bf99-74f85bb6be42	behavioral	adaptability	fresher	medium	Describe a time you had to adjust to new instructions midway through a task.	2026-02-09 07:02:25.634625+00	\N
662dd477-15e3-4252-b373-c08749e95acb	behavioral	adaptability	fresher	medium	How do you handle changes in project requirements after work has started?	2026-02-09 07:02:25.634625+00	\N
5ce39e2b-cf2b-47f0-b98b-569d8ab6fed0	behavioral	adaptability	fresher	medium	Tell me about a time you had to learn a new concept quickly to keep up.	2026-02-09 07:02:25.634625+00	\N
8215e1c3-2830-4610-86d9-78af6715d9d5	behavioral	adaptability	fresher	medium	How do you adapt when you receive feedback that changes your task direction?	2026-02-09 07:02:25.634625+00	\N
c949b17b-b0f0-4101-aa02-39915388e53e	behavioral	adaptability	fresher	medium	Describe a situation where you had to multitask due to sudden changes.	2026-02-09 07:02:25.634625+00	\N
e3302153-c2c9-477b-b909-0bd1042b64b1	behavioral	adaptability	fresher	medium	How do you respond when assigned a task outside your usual role?	2026-02-09 07:02:25.634625+00	\N
7d690440-b81a-467b-9e8d-1744062cb7b6	behavioral	adaptability	fresher	medium	Tell me about a time you had to change your working style to fit a team.	2026-02-09 07:02:25.634625+00	\N
f50940fb-5f95-4a6b-877b-b353c99d735c	behavioral	adaptability	fresher	medium	How do you handle learning a new tool with limited guidance?	2026-02-09 07:02:25.634625+00	\N
42c557d1-9414-4242-8ba1-4f0e6d33e9fa	behavioral	adaptability	fresher	medium	Describe a time you had to revise your plan due to unexpected issues.	2026-02-09 07:02:25.634625+00	\N
35991a12-1cc6-41cc-af23-8a563574c549	behavioral	adaptability	fresher	medium	How do you adapt when working with people who have different styles?	2026-02-09 07:02:25.634625+00	\N
d2049837-bf85-4c83-950a-5294b1ed5df9	behavioral	adaptability	fresher	medium	Tell me about a time you had to learn from a mistake and change your approach.	2026-02-09 07:02:25.634625+00	\N
2c2e02e4-6cab-4b35-ab89-38c2aae437a8	behavioral	adaptability	fresher	medium	How do you handle uncertainty in new tasks?	2026-02-09 07:02:25.634625+00	\N
f24a627b-1420-42a8-b283-80cfa4509a06	behavioral	adaptability	fresher	medium	Describe a situation where you had to adapt due to time constraints.	2026-02-09 07:02:25.634625+00	\N
29cba82e-e764-4234-8239-7c602aac415d	behavioral	adaptability	fresher	medium	How do you respond when your initial solution does not work?	2026-02-09 07:02:25.634625+00	\N
7681de4d-574d-4299-a58e-4490f5aa2f11	behavioral	adaptability	fresher	medium	Tell me about a time you had to quickly understand a new process.	2026-02-09 07:02:25.634625+00	\N
339f7990-710b-416a-a400-61411d6bed5d	behavioral	adaptability	fresher	medium	How do you adapt when expectations are not clearly defined?	2026-02-09 07:02:25.634625+00	\N
7804926b-c037-470e-adeb-bfab043fe387	behavioral	adaptability	fresher	medium	Describe a time you had to switch tasks unexpectedly.	2026-02-09 07:02:25.634625+00	\N
3b60035e-4b79-421a-b311-b7c145d7e021	behavioral	adaptability	fresher	medium	How do you handle working in unfamiliar conditions?	2026-02-09 07:02:25.634625+00	\N
f16ddc96-c85a-49c1-a4db-fcc60671804d	behavioral	adaptability	fresher	high	Tell me about a time you stayed resilient despite uncertainty.	2026-02-09 07:03:04.618813+00	\N
511e77e3-4f54-4400-9e60-6a31e6e4416d	behavioral	adaptability	fresher	medium	Tell me about a time you had to adapt to feedback from multiple people.	2026-02-09 07:02:25.634625+00	\N
212f4f6f-588d-4508-afdc-bcfa02b64471	behavioral	adaptability	fresher	medium	Why is adaptability important for you as a fresher?	2026-02-09 07:02:25.634625+00	\N
6b6fc448-e200-4cb1-a48d-97ed38bf403a	behavioral	adaptability	fresher	high	Describe a time when you struggled with change but adapted.	2026-02-09 07:03:04.618813+00	\N
986a59bd-532d-4ad8-81c5-29d9f5f5efaf	behavioral	adaptability	fresher	high	How do you respond when you receive last-minute changes?	2026-02-09 07:03:04.618813+00	\N
9105d058-ffe1-4197-bb26-95949fcc3096	behavioral	adaptability	fresher	high	Tell me about a situation where you had to learn quickly to keep up.	2026-02-09 07:03:04.618813+00	\N
d5381dab-c574-4585-a6a1-4e098f7af92a	behavioral	adaptability	fresher	high	How do you handle situations where you feel unprepared?	2026-02-09 07:03:04.618813+00	\N
33bb20f9-ff77-4384-af03-a922974837ff	behavioral	adaptability	fresher	high	Why is adaptability important in your early career?	2026-02-09 07:03:04.618813+00	\N
a2d7a947-9ce9-4cb4-a98b-257f579a1968	behavioral	adaptability	fresher	high	Describe a situation where repeated failure tested your patience.	2026-02-09 07:03:04.618813+00	\N
97b0072b-4b5e-4f42-b2c7-d6da805a098b	behavioral	adaptability	fresher	high	Tell me about a time when you felt overwhelmed but continued working.	2026-02-09 07:03:04.618813+00	\N
2e6e8a08-6317-4e46-a8b8-278d309703be	behavioral	adaptability	fresher	high	Describe a situation where results were delayed but you stayed committed.	2026-02-09 07:03:04.618813+00	\N
7018cb9a-d3a9-460f-8e0c-bb5c0f6ab164	behavioral	adaptability	fresher	high	Tell me about a time you struggled emotionally but stayed productive.	2026-02-09 07:03:04.618813+00	\N
492727ca-f66e-4171-820c-dd507c589156	behavioral	adaptability	fresher	high	Describe a time when learning something difficult tested your confidence.	2026-02-09 07:03:04.618813+00	\N
eb79bae4-aea5-47f1-87d2-9f2bb05d064d	behavioral	adaptability	fresher	high	Describe a time you had to restart after making mistakes.	2026-02-09 07:03:04.618813+00	\N
00c40754-106a-4816-9754-438477627a13	behavioral	adaptability	fresher	high	Tell me about a situation where criticism initially discouraged you.	2026-02-09 07:03:04.618813+00	\N
4afa9463-8004-4f12-91d7-badfc76cb67a	behavioral	adaptability	fresher	high	Describe a time when pressure affected your performance. How did you recover?	2026-02-09 07:03:04.618813+00	\N
e46ab259-3ab2-40b5-85fe-0d6d03f62fac	behavioral	adaptability	fresher	high	Tell me about a time when failure motivated you to work harder.	2026-02-09 07:03:04.618813+00	\N
263ba387-eb7f-46f7-9f8e-bcc58c60cb3b	behavioral	adaptability	fresher	high	Describe a situation where you had to stay calm despite confusion.	2026-02-09 07:03:04.618813+00	\N
c90869bf-fa32-40be-a330-44fd11ad49f8	behavioral	adaptability	fresher	high	Tell me about a time you faced rejection but continued improving.	2026-02-09 07:03:04.618813+00	\N
8005128e-7701-42c9-a04d-8726f4fd9a2c	behavioral	adaptability	fresher	high	Describe a time when fatigue challenged your commitment.	2026-02-09 07:03:04.618813+00	\N
26b82f24-09e1-4620-86d3-4e5ad74cbb45	behavioral	adaptability	fresher	high	Tell me about a time you had to repeat efforts to succeed.	2026-02-09 07:03:04.618813+00	\N
94991bfb-d0a8-4797-b6a1-249e7bfc3f30	behavioral	adaptability	fresher	high	Describe a situation where mistakes slowed you down.	2026-02-09 07:03:04.618813+00	\N
92bdf928-bb81-4831-8ee3-97b05a8a1bbd	behavioral	adaptability	fresher	high	Tell me about a time when confidence dropped but effort remained high.	2026-02-09 07:03:04.618813+00	\N
c29677f7-5f24-43e6-94b5-28612cb3e075	behavioral	adaptability	fresher	high	Describe a situation where pressure forced you to adapt quickly.	2026-02-09 07:03:04.618813+00	\N
58e3597b-b851-4efb-a523-55f269992e53	behavioral	adaptability	fresher	high	Describe a time when you had to learn from repeated feedback.	2026-02-09 07:03:04.618813+00	\N
3fba5854-1c9c-4505-bffc-dc717388b302	behavioral	adaptability	fresher	high	Tell me about a time when stress tested your discipline.	2026-02-09 07:03:04.618813+00	\N
7fa8e87e-608e-4746-ba27-4e96d2183482	behavioral	adaptability	fresher	high	Describe a situation where resilience helped you finish what you started.	2026-02-09 07:03:04.618813+00	\N
88c8d236-d6c1-4686-82df-feb8974a1a27	behavioral	resilience	mid	low	What does resilience mean in your professional role?	2026-02-09 07:06:21.276619+00	\N
e82d4885-eecd-4007-9cb1-998edf222cc0	behavioral	resilience	mid	low	How do you stay motivated after a work setback?	2026-02-09 07:06:21.276619+00	\N
e2d2c164-e9bf-4db0-bb1a-c00bfcee48d4	behavioral	resilience	mid	low	Describe a time you handled work pressure effectively.	2026-02-09 07:06:21.276619+00	\N
662087e3-e44b-48d6-b3dd-14dfec4ece1b	behavioral	resilience	mid	low	How do you react to constructive criticism?	2026-02-09 07:06:21.276619+00	\N
1224ebc8-406f-4bf7-938f-b7a0edfd33f4	behavioral	resilience	mid	low	How do you maintain performance during repetitive challenges?	2026-02-09 07:06:21.276619+00	\N
ded34768-643a-49b2-bcc2-f241f49f20eb	behavioral	resilience	mid	low	What does resilience mean in your current role?	2026-02-09 07:06:21.276619+00	\N
9e49fc8c-9e01-4386-b17b-75972ae6131b	behavioral	resilience	mid	low	How do you stay positive during routine work challenges?	2026-02-09 07:06:21.276619+00	\N
922c0c33-f410-4dad-819c-20a9421e0630	behavioral	resilience	mid	low	Describe how you handle small work-related setbacks.	2026-02-09 07:06:21.276619+00	\N
665022bb-9a35-4391-af63-6a744177efb2	behavioral	resilience	mid	low	How do you remain productive under mild pressure?	2026-02-09 07:06:21.276619+00	\N
17c0c727-1175-4565-a088-ad845b559a95	behavioral	resilience	mid	low	How do you respond to constructive feedback?	2026-02-09 07:06:21.276619+00	\N
be01a71e-3e96-4446-a526-48bd8f6b45f0	behavioral	resilience	mid	low	How do you stay consistent during repetitive tasks?	2026-02-09 07:06:21.276619+00	\N
168af417-a5ff-4af2-9aa9-5000b95ddd58	behavioral	resilience	mid	low	Describe how you manage stress in day-to-day work.	2026-02-09 07:06:21.276619+00	\N
5b906249-b7b3-4f7c-b444-bb1fca4d8adc	behavioral	resilience	mid	low	How do you stay motivated during slow progress?	2026-02-09 07:06:21.276619+00	\N
7293bdc0-fd69-4aa2-8797-6ade3aaca7f6	behavioral	resilience	mid	low	How do you handle minor mistakes at work?	2026-02-09 07:06:21.276619+00	\N
257d01ef-28b1-4cec-b7d9-b92b962758ce	behavioral	resilience	mid	low	Describe how you adapt when things donÔÇÖt go as planned.	2026-02-09 07:06:21.276619+00	\N
457d5796-53ab-45e2-9063-7e110dc4e8c2	behavioral	resilience	mid	low	How do you maintain confidence after a minor failure?	2026-02-09 07:06:21.276619+00	\N
96266f3a-5d97-4369-b646-b19311fd375e	behavioral	resilience	mid	low	How do you deal with workload pressure?	2026-02-09 07:06:21.276619+00	\N
ebf0923a-3cbe-4a7b-95fa-3656aadcae3c	behavioral	resilience	mid	low	Describe how you stay calm during challenging situations.	2026-02-09 07:06:21.276619+00	\N
95d6b57e-5fc2-4892-aa32-9e9e9392fde1	behavioral	resilience	mid	low	How do you keep learning after facing difficulties?	2026-02-09 07:06:21.276619+00	\N
e63962a0-16fe-455b-a2e9-f4139b0cc737	behavioral	resilience	mid	low	How do you stay committed during routine challenges?	2026-02-09 07:06:21.276619+00	\N
3c108c7c-9f7e-481d-a1f6-a7a0ec3dde16	behavioral	resilience	mid	low	Describe how you bounce back after a bad day at work.	2026-02-09 07:06:21.276619+00	\N
effbd449-c951-4ce5-8933-fe6fdcdf9635	behavioral	resilience	mid	low	How do you manage emotional reactions at work?	2026-02-09 07:06:21.276619+00	\N
b74b6554-de26-4da8-90a2-13f372ccd44b	behavioral	resilience	mid	low	How do you maintain performance during challenging weeks?	2026-02-09 07:06:21.276619+00	\N
7582b374-6fef-460a-9d2a-869eea421e6c	behavioral	resilience	mid	low	How do you stay resilient when tasks take longer than expected?	2026-02-09 07:06:21.276619+00	\N
24eba2b2-bcaf-4e1d-a7e7-0ba4628955fd	behavioral	resilience	mid	low	Why is resilience important for your professional growth?	2026-02-09 07:06:21.276619+00	\N
9838a3e9-c862-4585-aa1f-3ea55f9d4436	behavioral	resilience	mid	medium	Describe a time you faced continuous work challenges.	2026-02-09 07:06:54.408735+00	\N
8f1718b2-93e7-40dd-a67c-e9541779d737	behavioral	resilience	mid	medium	How do you recover after a professional failure?	2026-02-09 07:06:54.408735+00	\N
2ed0bf20-41cd-4969-908f-0ed91bbbb8cb	behavioral	resilience	mid	medium	Tell me about a time you had to stay persistent to complete a task.	2026-02-09 07:06:54.408735+00	\N
b8f339a9-82e6-4f4e-9c21-448844114551	behavioral	resilience	mid	medium	How do you manage stress during demanding periods?	2026-02-09 07:06:54.408735+00	\N
0ffa134c-f969-451c-b8fd-9047e8513505	behavioral	resilience	mid	medium	Describe a time you balanced multiple pressures successfully.	2026-02-09 07:06:54.408735+00	\N
09ee9d3f-5655-4a17-8a02-1b075adcbcaa	behavioral	resilience	mid	medium	Describe a time when work demands increased suddenly. How did you handle it?	2026-02-09 07:06:54.408735+00	\N
221bb1a2-86e5-4c62-b830-91449c0a3ef7	behavioral	resilience	mid	medium	How do you stay consistent when progress feels slow?	2026-02-09 07:06:54.408735+00	\N
4588d9ae-149e-4e41-85a4-940639c9f689	behavioral	resilience	mid	medium	Describe a time you had to recover quickly after a mistake.	2026-02-09 07:06:54.408735+00	\N
eb6c4954-8c08-4fea-be40-31844ff9a75e	behavioral	resilience	mid	medium	How do you manage resilience when deadlines overlap?	2026-02-09 07:06:54.408735+00	\N
26ca1180-7fb3-4252-aa65-c07c53601c69	behavioral	resilience	mid	medium	Tell me about a time you had to push yourself to complete a task.	2026-02-09 07:06:54.408735+00	\N
5a6c86f6-c6e3-460d-bb4b-cd2467bba072	behavioral	resilience	mid	medium	How do you respond when repeated feedback highlights the same issue?	2026-02-09 07:06:54.408735+00	\N
bf675096-2306-4071-b9b1-58c1d080ebba	behavioral	resilience	mid	medium	Describe a time when expectations were unclear but you still delivered.	2026-02-09 07:06:54.408735+00	\N
4482d7fd-b402-445a-a27d-eedee2b8dc3f	behavioral	resilience	mid	medium	How do you stay resilient during repetitive or monotonous work?	2026-02-09 07:06:54.408735+00	\N
625025a1-5108-4080-994b-7eb03f9cdf70	behavioral	resilience	mid	medium	Tell me about a time you had to manage pressure without external support.	2026-02-09 07:06:54.408735+00	\N
ecd1c40f-0b1e-4606-adca-26a3fbe480ab	behavioral	resilience	mid	medium	How do you handle setbacks while working on long-term tasks?	2026-02-09 07:06:54.408735+00	\N
1163e7b8-9da0-47cf-a4fb-b34635f33597	behavioral	resilience	mid	medium	Describe a time when your confidence was challenged at work.	2026-02-09 07:06:54.408735+00	\N
1040f6fa-70b6-4634-822d-c10d64243a8d	behavioral	resilience	mid	medium	How do you stay composed during stressful discussions?	2026-02-09 07:06:54.408735+00	\N
47ba6ed0-8684-45bb-98ac-b517433a2f96	behavioral	resilience	mid	medium	Tell me about a time you had to continue despite low motivation.	2026-02-09 07:06:54.408735+00	\N
9de3afb6-8141-4c89-80d9-ffc573b0c8e6	behavioral	resilience	mid	medium	How do you react when plans fail unexpectedly?	2026-02-09 07:06:54.408735+00	\N
210b1ac3-c322-4e16-98ee-2e6948545b91	behavioral	resilience	mid	medium	Describe a time you had to stay patient to achieve results.	2026-02-09 07:06:54.408735+00	\N
4b71a2a4-52d8-4cdc-84da-71b1ea94bdce	behavioral	resilience	mid	medium	How do you manage emotional stress caused by work pressure?	2026-02-09 07:06:54.408735+00	\N
51e87919-b647-43ef-a67e-b75aba0326e2	behavioral	resilience	mid	medium	Tell me about a time when you had to adapt after repeated feedback.	2026-02-09 07:06:54.408735+00	\N
4a763099-3ed0-454e-920a-15f9ce5f9f43	behavioral	resilience	mid	medium	How do you stay resilient when tasks become mentally exhausting?	2026-02-09 07:06:54.408735+00	\N
13644d2e-a96e-4439-924b-77e45933b934	behavioral	resilience	mid	medium	Describe a situation where you had to rebuild momentum after delays.	2026-02-09 07:06:54.408735+00	\N
6848736e-a6fa-40ae-b442-64039e6f7006	behavioral	resilience	mid	medium	Why is resilience important at the mid-level stage of your career?	2026-02-09 07:06:54.408735+00	\N
935be6c2-5dc3-4e3a-a9c6-43d6f3465553	behavioral	resilience	mid	high	Describe a major setback and how you overcame it.	2026-02-09 07:07:13.823911+00	\N
16637e44-d4ed-4dc7-a3f4-bda49fcca5bb	behavioral	resilience	mid	high	How do you maintain resilience during prolonged uncertainty?	2026-02-09 07:07:13.823911+00	\N
9e8f2742-eff9-4773-9326-d85a3f3953ac	behavioral	resilience	mid	high	Tell me about a time you had to push through fatigue or burnout.	2026-02-09 07:07:13.823911+00	\N
2c950e5c-61bb-43de-bedc-d0b5f59a34ba	behavioral	resilience	mid	high	How do you sustain performance after repeated failures?	2026-02-09 07:07:13.823911+00	\N
1e277fd1-03ad-4c20-922a-fe7326bf8d57	behavioral	resilience	mid	high	Why is resilience critical at the mid-level stage of your career?	2026-02-09 07:07:13.823911+00	\N
8a2fcad6-c88d-453f-bc30-6c3d35de2d3d	behavioral	resilience	mid	high	Describe a situation where prolonged pressure tested your resilience.	2026-02-09 07:07:13.823911+00	\N
72c2c989-e8b8-4338-bc00-55d35a8df0ce	behavioral	resilience	mid	high	Tell me about a time you had to recover after repeated setbacks.	2026-02-09 07:07:13.823911+00	\N
2c81bebe-e6df-4046-9e01-ed105ff5a90f	behavioral	resilience	mid	high	Describe a situation where failure impacted your confidence at work.	2026-02-09 07:07:13.823911+00	\N
d6e1cbb1-4d4e-49b5-b53e-a193ed2ce347	behavioral	resilience	mid	high	Tell me about a time when results were delayed but you stayed committed.	2026-02-09 07:07:13.823911+00	\N
45ec5cb8-4672-49e9-a46d-0f8e30a91fdc	behavioral	resilience	mid	high	Describe a time when you had to manage emotional stress professionally.	2026-02-09 07:07:13.823911+00	\N
c50a717c-d906-4de8-9d0e-4ec6a440fd74	behavioral	resilience	mid	high	Tell me about a situation where workload intensity tested your discipline.	2026-02-09 07:07:13.823911+00	\N
8223295c-1f86-4942-9e46-95c4f4491b03	behavioral	resilience	mid	high	Describe a time you had to push through fatigue to meet commitments.	2026-02-09 07:07:13.823911+00	\N
91aa48c1-66d3-4328-8356-02e2543e9bbe	behavioral	resilience	mid	high	Tell me about a time when criticism challenged your motivation.	2026-02-09 07:07:13.823911+00	\N
a7075cd0-2e92-4afb-b12e-8fe9bb27d85a	behavioral	resilience	mid	high	Describe a situation where uncertainty affected project execution.	2026-02-09 07:07:13.823911+00	\N
ac9de0b0-22de-4908-95d9-5f20ed40ac67	behavioral	resilience	mid	high	Tell me about a time you had to restart work after errors were identified.	2026-02-09 07:07:13.823911+00	\N
1f705922-5a6f-4d47-a932-9756dc0bedee	behavioral	resilience	mid	high	Describe a time when multiple responsibilities tested your resilience.	2026-02-09 07:07:13.823911+00	\N
78b85048-fe67-4d92-9a36-25cbda67849b	behavioral	resilience	mid	high	Tell me about a situation where pressure affected decision-making.	2026-02-09 07:07:13.823911+00	\N
4b819b02-e462-4cc6-a254-493a5fb77219	behavioral	resilience	mid	high	Describe a time when continuous feedback required constant adjustment.	2026-02-09 07:07:13.823911+00	\N
0347b3e5-d333-4901-8069-0ca6aeccca06	behavioral	resilience	mid	high	Tell me about a time when stress lasted longer than expected.	2026-02-09 07:07:13.823911+00	\N
04b81fc0-539b-403b-b9b5-0efa0bf1b278	behavioral	resilience	mid	high	Describe a situation where performance dipped but recovery followed.	2026-02-09 07:07:13.823911+00	\N
37b9d8c7-8cd1-4ab1-99af-ec9111417041	behavioral	resilience	mid	high	Tell me about a time when workload imbalance tested your persistence.	2026-02-09 07:07:13.823911+00	\N
b146a37b-23bd-4c6e-bab4-992b98df6e8a	behavioral	resilience	mid	high	Describe a situation where deadlines changed unexpectedly.	2026-02-09 07:07:13.823911+00	\N
35dbf841-b8fa-472f-8670-1ef69be0ff15	behavioral	resilience	mid	high	Tell me about a time when failure strengthened your resilience.	2026-02-09 07:07:13.823911+00	\N
42eddf86-1005-4351-9506-ef92803fe69a	behavioral	resilience	mid	high	Describe a time you had to maintain morale during tough phases.	2026-02-09 07:07:13.823911+00	\N
0b162c97-3fe3-42ac-8ef6-794b00136ebf	behavioral	resilience	mid	high	Describe a situation where resilience helped you deliver under constraints.	2026-02-09 07:07:13.823911+00	\N
e04f936b-2d16-4745-80e4-9286e172b750	behavioral	communication	mid	low	Why is effective communication important in your role?	2026-02-09 07:09:17.706045+00	\N
80b42712-43e8-46d1-93c2-2b17b26571b8	behavioral	communication	mid	low	How do you usually communicate with your team?	2026-02-09 07:09:17.706045+00	\N
0ca79e2f-1319-41d7-b35b-eb14fca6d255	behavioral	communication	mid	low	Describe a time you explained a task clearly to someone.	2026-02-09 07:09:17.706045+00	\N
b7e09bc6-e3cf-4d1a-b4c1-6e14edacb674	behavioral	communication	mid	low	How do you ensure clarity in your messages?	2026-02-09 07:09:17.706045+00	\N
2428bdbe-6d7a-45a6-9f28-47be7de9974f	behavioral	communication	mid	low	How do you listen during professional conversations?	2026-02-09 07:09:17.706045+00	\N
ecc4a858-0627-403e-bbbb-f9394cd17b2d	behavioral	communication	mid	low	Why is clear communication important in your daily work?	2026-02-09 07:09:17.706045+00	\N
74ccc3e3-43bf-4faf-abc6-cf4d51f31c9e	behavioral	communication	mid	low	How do you usually share updates with your team?	2026-02-09 07:09:17.706045+00	\N
307ca145-39f4-460c-ac05-353d78abdf72	behavioral	communication	mid	low	Describe how you explain tasks to others.	2026-02-09 07:09:17.706045+00	\N
a4b9010f-b403-4262-9992-f345f9a89c2e	behavioral	communication	mid	low	How do you ensure your message is understood correctly?	2026-02-09 07:09:17.706045+00	\N
fb29fdc0-98c7-41f0-9a0b-3403e5aa3cb8	behavioral	communication	mid	low	How do you communicate when giving status updates?	2026-02-09 07:09:17.706045+00	\N
a247feba-1783-4230-834f-0fd80e27ea3c	behavioral	communication	mid	low	Describe how you listen during team discussions.	2026-02-09 07:09:17.706045+00	\N
0b059053-8ae0-414b-8ca6-34db8b0f62b6	behavioral	communication	mid	low	How do you communicate when you need help?	2026-02-09 07:09:17.706045+00	\N
da8bc7ce-f18d-4648-90f5-a308804cd13b	behavioral	communication	mid	low	Describe a time you shared information clearly.	2026-02-09 07:09:17.706045+00	\N
0ad47369-ce9b-4f8f-92f6-20fa62399d18	behavioral	communication	mid	low	How do you communicate expectations to others?	2026-02-09 07:09:17.706045+00	\N
5583546f-eed4-477e-9fae-a22c99df6f96	behavioral	communication	mid	low	How do you adjust your communication when speaking to seniors or peers?	2026-02-09 07:09:17.706045+00	\N
14972c80-ec31-445d-a9f8-3229b3dcb5b2	behavioral	communication	mid	low	Describe how you handle simple misunderstandings.	2026-02-09 07:09:17.706045+00	\N
fe92f0b2-4510-4c7a-95a1-6c86b51770f3	behavioral	communication	mid	low	How do you communicate ideas in meetings?	2026-02-09 07:09:17.706045+00	\N
94504c6d-dbbf-4c61-b0a5-38cb13df11ca	behavioral	communication	mid	low	How do you respond when someone asks for clarification?	2026-02-09 07:09:17.706045+00	\N
c40863b6-de39-4a7f-a4af-66ffc7f1c291	behavioral	communication	mid	low	Describe how you communicate progress on assigned work.	2026-02-09 07:09:17.706045+00	\N
337ba32e-00f4-4716-bf01-9abd96d33d0e	behavioral	communication	mid	low	How do you ensure politeness in professional communication?	2026-02-09 07:09:17.706045+00	\N
e0fc3f13-7c16-447b-8fb6-ce711348c02c	behavioral	communication	mid	low	How do you communicate when tasks are delayed?	2026-02-09 07:09:17.706045+00	\N
9bd4cf9a-4a33-4cf5-b5e5-43952780fa87	behavioral	communication	mid	low	Describe how you ask questions at work.	2026-02-09 07:09:17.706045+00	\N
82a2825c-6029-406b-853a-56a4a6ce49b6	behavioral	communication	mid	low	How do you communicate instructions to teammates?	2026-02-09 07:09:17.706045+00	\N
6eed6e7c-c1c0-4acc-9efc-8e029d99d884	behavioral	communication	mid	low	How do you handle basic feedback conversations?	2026-02-09 07:09:17.706045+00	\N
d8a91457-961f-43e2-8ea9-eb6c791839d8	behavioral	communication	mid	low	Why is communication important for your growth at mid-level?	2026-02-09 07:09:17.706045+00	\N
088b0321-6ce3-40bc-8682-0be3cd500104	behavioral	communication	mid	medium	Describe a situation where you had to explain a complex idea.	2026-02-09 07:09:41.290094+00	\N
52664eda-8cdf-4d83-b60c-cc4b9a64de90	behavioral	communication	mid	medium	How do you handle misunderstandings at work?	2026-02-09 07:09:41.290094+00	\N
7e4b7b23-4358-4323-bc74-44911e366c2f	behavioral	communication	mid	medium	Tell me about a time you had to ask questions to avoid errors.	2026-02-09 07:09:41.290094+00	\N
2dce700a-60b2-4617-9e66-4d9d6daad01c	behavioral	communication	mid	medium	How do you adapt your communication style to different stakeholders?	2026-02-09 07:09:41.290094+00	\N
07995d53-35b2-4ff5-a32f-def3925f3dfd	behavioral	communication	mid	medium	Describe a time when clear communication improved results.	2026-02-09 07:09:41.290094+00	\N
34e82d2b-3240-49c8-b327-87a8a81086e4	behavioral	communication	mid	medium	Describe a time you had to clarify unclear instructions.	2026-02-09 07:09:41.290094+00	\N
d37d32e8-df8b-4585-9b2c-9164b349f84f	behavioral	communication	mid	medium	How do you communicate progress updates to stakeholders?	2026-02-09 07:09:41.290094+00	\N
358dd30f-6d64-4eaf-a3a6-7d35c862625c	behavioral	communication	mid	medium	Tell me about a time you had to explain a delay.	2026-02-09 07:09:41.290094+00	\N
8aea7596-3d44-4edd-bb7a-3da926be9079	behavioral	communication	mid	medium	How do you ensure alignment during cross-team communication?	2026-02-09 07:09:41.290094+00	\N
f2a50432-96e9-4b58-8676-2a943fa8ecd9	behavioral	communication	mid	medium	Describe a time you resolved confusion through communication.	2026-02-09 07:09:41.290094+00	\N
6a86fce5-7367-4d7c-8124-54e01a3a6d3b	behavioral	communication	mid	medium	How do you handle communicating changes in plans?	2026-02-09 07:09:41.290094+00	\N
23b049ad-583c-4a67-b4fd-9b27706a3ba0	behavioral	communication	mid	medium	Describe a time you had to persuade someone using communication.	2026-02-09 07:09:41.290094+00	\N
0341546a-209a-4994-a2b4-e784d2d4980d	behavioral	communication	mid	medium	How do you ensure your message is understood correctly?	2026-02-09 07:09:41.290094+00	\N
2402b21c-ae59-4868-bf0c-b763b41397fa	behavioral	communication	mid	high	How do you communicate when emotions run high in discussions?	2026-02-09 07:10:07.515393+00	\N
c2549932-5653-416b-9096-1c0139cd489b	behavioral	communication	mid	medium	Tell me about a time you had to communicate with a difficult person.	2026-02-09 07:09:41.290094+00	\N
d1a47132-d729-4d05-9349-f05b553239f7	behavioral	communication	mid	medium	How do you adapt communication when working with seniors?	2026-02-09 07:09:41.290094+00	\N
369b093e-790d-41fd-b060-041109eae705	behavioral	communication	mid	medium	Describe a time you gave constructive feedback.	2026-02-09 07:09:41.290094+00	\N
37be472a-ce3e-448b-a0dc-b33a92c1b898	behavioral	communication	mid	medium	How do you communicate expectations within a team?	2026-02-09 07:09:41.290094+00	\N
70730a66-5ced-4109-b595-9c3133b29f63	behavioral	communication	mid	medium	Tell me about a time you prevented errors through communication.	2026-02-09 07:09:41.290094+00	\N
a9bca579-d7eb-42a5-a1c0-7613603c9836	behavioral	communication	mid	medium	How do you manage communication during tight deadlines?	2026-02-09 07:09:41.290094+00	\N
618c1b34-c822-4eff-8310-73b83f5d7835	behavioral	communication	mid	medium	Describe a time you aligned multiple people through communication.	2026-02-09 07:09:41.290094+00	\N
0d27eeca-fc64-4fab-84fc-70690ceeb2b3	behavioral	communication	mid	medium	How do you communicate when information is incomplete?	2026-02-09 07:09:41.290094+00	\N
fced9666-715d-4d1f-8365-175a4b9c1d04	behavioral	communication	mid	medium	Tell me about a time you had to explain technical information simply.	2026-02-09 07:09:41.290094+00	\N
d904b654-cbda-4466-8007-5e2a4cbe9754	behavioral	communication	mid	medium	How do you ensure transparency in team communication?	2026-02-09 07:09:41.290094+00	\N
477bef60-7ddf-4c18-9a41-d3ffceaae036	behavioral	communication	mid	medium	Describe a time communication helped avoid conflict.	2026-02-09 07:09:41.290094+00	\N
91f93718-7fae-4765-ba3d-bf1b681d7e6f	behavioral	communication	mid	medium	Why is communication a key skill at the mid-level stage?	2026-02-09 07:09:41.290094+00	\N
f55cd60e-5107-4268-8b2e-531cbf154f88	behavioral	communication	mid	high	Describe a situation where poor communication caused an issue. How did you fix it?	2026-02-09 07:10:07.515393+00	\N
57ad8b84-e423-4cf0-9e62-acc1476cdc0b	behavioral	communication	mid	high	How do you communicate under pressure or tight deadlines?	2026-02-09 07:10:07.515393+00	\N
844af93e-2f34-4c8c-8145-eddb9efbc82e	behavioral	communication	mid	high	Tell me about a time you had to communicate bad news professionally.	2026-02-09 07:10:07.515393+00	\N
d1ef5ce4-3a15-4b85-94f1-6375b9fe492a	behavioral	communication	mid	high	How do you handle communication with someone who disagrees with you?	2026-02-09 07:10:07.515393+00	\N
532443a4-d869-4fcd-86fa-2680569b0864	behavioral	communication	mid	high	Why is strong communication critical at the mid-level stage of your career?	2026-02-09 07:10:07.515393+00	\N
3d076eeb-caa2-4469-84c7-2ff61f7ea7ed	behavioral	communication	mid	high	Describe a time when miscommunication impacted a project outcome.	2026-02-09 07:10:07.515393+00	\N
919135aa-5826-419d-9085-ea49d0347375	behavioral	communication	mid	high	How do you communicate complex decisions to multiple stakeholders?	2026-02-09 07:10:07.515393+00	\N
5e624426-e347-4a2f-af81-3eae76275f35	behavioral	communication	mid	high	Tell me about a time when your message was misunderstood. How did you correct it?	2026-02-09 07:10:07.515393+00	\N
fc9d857c-bbaf-4752-b64a-ef2ac8a0c4df	behavioral	communication	mid	high	How do you ensure alignment when teams have conflicting priorities?	2026-02-09 07:10:07.515393+00	\N
d2b12768-4f16-4dab-bf71-2bec7c726201	behavioral	communication	mid	high	Describe a time you had to influence without authority.	2026-02-09 07:10:07.515393+00	\N
0ca146ed-a2b1-487a-8275-583a46719e37	behavioral	communication	mid	high	Tell me about a time you had to challenge a decision respectfully.	2026-02-09 07:10:07.515393+00	\N
89d5aaf1-e221-47b1-9563-3771154f86f4	behavioral	communication	mid	high	How do you handle communication breakdowns in cross-functional teams?	2026-02-09 07:10:07.515393+00	\N
f29133ad-71f0-4ef7-83b6-1b1a8cd407b6	behavioral	communication	mid	high	Describe a situation where active listening changed an outcome.	2026-02-09 07:10:07.515393+00	\N
cfd518e1-1e3b-4d24-912e-99d6aaeb07ba	behavioral	communication	mid	high	How do you communicate risks to leadership?	2026-02-09 07:10:07.515393+00	\N
e79f4756-9789-4389-a3a1-7b9d9bfae7cb	behavioral	communication	mid	high	Tell me about a time when written communication was critical.	2026-02-09 07:10:07.515393+00	\N
45fb4d7e-0c3f-4b60-9434-b08cb3e51198	behavioral	communication	mid	high	How do you manage communication during organizational change?	2026-02-09 07:10:07.515393+00	\N
f566eb0f-02fa-4955-b5f6-e4d480c69639	behavioral	communication	mid	high	Describe a time when silence or lack of communication caused risk.	2026-02-09 07:10:07.515393+00	\N
48ab59e0-7ed8-47ac-98ff-65a7db93f2ff	behavioral	communication	mid	high	How do you tailor communication for senior vs. junior stakeholders?	2026-02-09 07:10:07.515393+00	\N
3cf40ee6-0e87-48e2-9cf3-7c63147768cb	behavioral	communication	mid	high	Tell me about a time you had to communicate across cultures.	2026-02-09 07:10:07.515393+00	\N
92ea4ec4-bac3-4835-b372-5676bded326c	behavioral	communication	mid	high	How do you ensure accountability through communication?	2026-02-09 07:10:07.515393+00	\N
deea8c21-092e-4eff-b1c2-cf47f811e697	behavioral	communication	mid	high	Describe a time when feedback was not well received.	2026-02-09 07:10:07.515393+00	\N
5a6d3a9d-087f-48e4-bc19-738928d6c7f2	behavioral	communication	mid	high	How do you communicate priorities when everything feels urgent?	2026-02-09 07:10:07.515393+00	\N
1068efbf-30bb-42e4-8eb7-4af4b8e74bd2	behavioral	communication	mid	high	Tell me about a time when communication helped prevent failure.	2026-02-09 07:10:07.515393+00	\N
ef35f7cb-7941-45a5-8d67-fded2c04f173	behavioral	communication	mid	high	How do you evaluate the effectiveness of your communication?	2026-02-09 07:10:07.515393+00	\N
508b0006-db4c-4b3f-b56f-a13bb1d53c1a	behavioral	adaptability	mid	low	What does adaptability mean in your role?	2026-02-09 07:12:41.58148+00	\N
61268008-300a-4022-aca7-ad090511738f	behavioral	adaptability	mid	low	How do you react when priorities change at work?	2026-02-09 07:12:41.58148+00	\N
491e67d6-c887-4da9-8693-f1f97891e05c	behavioral	adaptability	mid	low	Describe a time you learned a new skill quickly.	2026-02-09 07:12:41.58148+00	\N
ad2f20f6-cca3-4569-b0a9-f7f263b2e3ca	behavioral	adaptability	mid	low	How do you handle changes in work processes?	2026-02-09 07:12:41.58148+00	\N
40ffe755-2818-4c88-90b8-9d976cf9e4bc	behavioral	adaptability	mid	low	How comfortable are you working with new tools or systems?	2026-02-09 07:12:41.58148+00	\N
e31aaa08-7ac0-450d-bbc5-8c11ab59674c	behavioral	adaptability	mid	low	Describe a time when you had to adapt to conflicting priorities from multiple stakeholders.	2026-02-09 07:12:41.58148+00	\N
3d4248ab-8c56-4e4e-b797-8af092bb3111	behavioral	adaptability	mid	low	Tell me about a situation where frequent changes disrupted your original plan. How did you respond?	2026-02-09 07:12:41.58148+00	\N
3c0595ed-6841-40e5-a6e9-900bef1f93eb	behavioral	adaptability	mid	low	Describe a time you had to adapt quickly with limited information.	2026-02-09 07:12:41.58148+00	\N
4939b2e5-afb3-4354-b163-fdc1975e9846	behavioral	adaptability	mid	low	How have you handled adapting to a new manager or leadership style?	2026-02-09 07:12:41.58148+00	\N
46ac514b-cc76-42a6-a394-c0e3d42388ed	behavioral	adaptability	mid	low	Describe a situation where you had to unlearn an old way of working.	2026-02-09 07:12:41.58148+00	\N
bce979bb-2f2b-4be3-b3b0-025206c22164	behavioral	adaptability	mid	low	Tell me about a time you had to adapt to a major tool or system migration.	2026-02-09 07:12:41.58148+00	\N
8b234334-7c54-43e0-81a4-8adf9cf2634e	behavioral	adaptability	mid	low	Describe a time when adapting late caused risk. How did you handle it?	2026-02-09 07:12:41.58148+00	\N
ebb405ab-7574-477a-98d6-1387fd2ce95d	behavioral	adaptability	mid	low	How do you adapt when business goals shift mid-execution?	2026-02-09 07:12:41.58148+00	\N
dd13980d-65a7-4213-9f3e-a509639a9d79	behavioral	adaptability	mid	low	Describe a time you had to adapt to cross-functional ways of working.	2026-02-09 07:12:41.58148+00	\N
6d61494d-80ec-4352-8f37-1464d8807c2e	behavioral	adaptability	mid	low	Tell me about a time adaptability helped you recover from a mistake.	2026-02-09 07:12:41.58148+00	\N
33e4988a-f090-4366-9ccf-855ef4de7070	behavioral	adaptability	mid	low	Describe a situation where you had to adapt under tight deadlines.	2026-02-09 07:12:41.58148+00	\N
8116fb57-32f1-44e3-bdd5-9e32bd13d879	behavioral	adaptability	mid	low	How do you adapt when your role responsibilities expand unexpectedly?	2026-02-09 07:12:41.58148+00	\N
96bd104f-e12e-4776-b108-3fb26ba3db1e	behavioral	adaptability	mid	low	Describe a time when adapting improved overall team performance.	2026-02-09 07:12:41.58148+00	\N
a2c63a2a-efaf-47cc-bc5f-3c252741670e	behavioral	adaptability	mid	low	How do you adapt when feedback contradicts your original approach?	2026-02-09 07:12:41.58148+00	\N
4eb1eeb4-00ad-4657-aa52-b6ea3ce6e6e8	behavioral	adaptability	mid	low	Tell me about a time adaptability helped you manage uncertainty.	2026-02-09 07:12:41.58148+00	\N
c0fe7c90-a5b8-4001-802c-e7f2d8b1d9b7	behavioral	adaptability	mid	low	Describe a time when adapting your communication style was critical.	2026-02-09 07:12:41.58148+00	\N
2e972f2a-4bc8-4743-be12-0f45e394e7a8	behavioral	adaptability	mid	low	How do you adapt when expectations are unclear?	2026-02-09 07:12:41.58148+00	\N
e2810a81-5b35-4d98-b2ef-8bc96dea5b04	behavioral	adaptability	mid	low	Describe a time you had to adapt to organizational change.	2026-02-09 07:12:41.58148+00	\N
f7b0a1b5-f568-436e-9a6e-e3f386312c33	behavioral	adaptability	mid	low	How do you adapt when initial plans fail?	2026-02-09 07:12:41.58148+00	\N
5bf676c5-b90a-491b-8ef4-482bec10f626	behavioral	adaptability	mid	low	Why is adaptability critical at the mid-level stage of your career?	2026-02-09 07:12:41.58148+00	\N
ee34b92a-ee21-4eb1-9197-b599ffdf7a63	behavioral	adaptability	mid	medium	Describe a situation where you had to adapt to a sudden change.	2026-02-09 07:13:01.651642+00	\N
c40691db-d7d0-42c8-bb10-738943c7317e	behavioral	adaptability	mid	medium	How do you manage work when requirements change frequently?	2026-02-09 07:13:01.651642+00	\N
6a67078c-b2d0-4719-b8ce-9d49d2a1cdc4	behavioral	adaptability	mid	medium	Tell me about a time you worked outside your comfort zone.	2026-02-09 07:13:01.651642+00	\N
a8321cbb-fda5-4c74-9d57-ff96e0c4c086	behavioral	adaptability	mid	medium	How do you adapt when working with new team members?	2026-02-09 07:13:01.651642+00	\N
f4b04e72-5e31-4be2-ac1d-f92210e82697	behavioral	adaptability	mid	medium	Describe a time you changed your approach to achieve better results.	2026-02-09 07:13:01.651642+00	\N
8bf0e5ec-2e4a-4489-9cef-476282779327	behavioral	adaptability	mid	medium	Describe a time you had to adjust your work style to meet team needs.	2026-02-09 07:13:01.651642+00	\N
7bca70c5-52e9-4cdd-8a89-d6ffcebea0b5	behavioral	adaptability	mid	medium	How do you adapt when project priorities shift suddenly?	2026-02-09 07:13:01.651642+00	\N
eabb8935-3d8d-4b77-864d-460a9217fff3	behavioral	adaptability	mid	medium	Tell me about a time you had to learn a new process quickly.	2026-02-09 07:13:01.651642+00	\N
1ba8d795-9f94-448e-bf77-f7a0fe167d7f	behavioral	adaptability	mid	medium	How do you adjust when working under a new manager?	2026-02-09 07:13:01.651642+00	\N
307ca5ac-fc8a-42b9-98cb-ed3ca326fd74	behavioral	adaptability	mid	medium	Describe a time when you had to change your approach mid-task.	2026-02-09 07:13:01.651642+00	\N
020f569d-af77-48cf-9002-c42c07fd29c7	behavioral	adaptability	mid	medium	How do you handle frequent changes in requirements?	2026-02-09 07:13:01.651642+00	\N
0ee02139-2d9a-47c0-97bd-153a4314f4d7	behavioral	adaptability	mid	medium	Describe a situation where you had to work outside your comfort zone.	2026-02-09 07:13:01.651642+00	\N
8df737bf-29ef-4de1-baeb-8500159756e7	behavioral	adaptability	mid	medium	How do you adapt when timelines become tighter than expected?	2026-02-09 07:13:01.651642+00	\N
cd97d703-7e7c-4cff-ac4b-09424b155ada	behavioral	adaptability	mid	medium	Tell me about a time you had to adjust due to limited resources.	2026-02-09 07:13:01.651642+00	\N
c2910dab-ed94-4ac9-9791-fc95b055d83a	behavioral	adaptability	mid	medium	How do you adapt when working with cross-functional teams?	2026-02-09 07:13:01.651642+00	\N
f66fb882-e49d-4df8-bfba-f0c35a05450c	behavioral	adaptability	mid	medium	Describe a time you struggled with change but adapted successfully.	2026-02-09 07:13:01.651642+00	\N
7a52ec19-d7a8-46d9-9b1f-a33b60900c70	behavioral	adaptability	mid	medium	How do you respond to last-minute changes or urgent requests?	2026-02-09 07:13:01.651642+00	\N
af60ecd4-ec7e-4d9b-9206-465e13983990	behavioral	adaptability	mid	medium	Tell me about a time you had to learn quickly to meet expectations.	2026-02-09 07:13:01.651642+00	\N
15fcb560-6b95-46b6-9b47-b01251089117	behavioral	adaptability	mid	medium	How do you adapt when facing uncertainty or incomplete information?	2026-02-09 07:13:01.651642+00	\N
cf21da86-5191-48af-8281-8b163f7badad	behavioral	adaptability	mid	medium	Describe a time when flexibility helped you succeed.	2026-02-09 07:13:01.651642+00	\N
078b5df3-eba3-4f4c-9dc1-17932ec63e2c	behavioral	adaptability	mid	medium	How do you handle feedback that requires changing your approach?	2026-02-09 07:13:01.651642+00	\N
fe8f8bd7-013d-441c-9752-7ba117facd9f	behavioral	adaptability	mid	medium	Tell me about a time you adapted to a new tool or system.	2026-02-09 07:13:01.651642+00	\N
d7120cc9-2f97-45ad-be0d-5f229e7065ff	behavioral	adaptability	mid	medium	How do you adapt when expectations are unclear?	2026-02-09 07:13:01.651642+00	\N
58af3f19-e7d2-487b-b139-0e2fec91aecb	behavioral	adaptability	mid	medium	Describe a situation where adaptability improved your performance.	2026-02-09 07:13:01.651642+00	\N
e49520c9-df5b-4c08-acf1-d7a65587ee5a	behavioral	adaptability	mid	medium	Why is adaptability essential for mid-level professionals?	2026-02-09 07:13:01.651642+00	\N
94228684-036d-40cc-b1b1-06d9e7a67627	behavioral	adaptability	mid	high	Describe a time you struggled with change but adapted successfully.	2026-02-09 07:13:17.33069+00	\N
3ded275b-d1e5-487b-8733-805f82f0ec9e	behavioral	adaptability	mid	high	How do you respond to last-minute changes or urgent requests?	2026-02-09 07:13:17.33069+00	\N
4e0098e4-358b-4263-8fea-c51333bb6a0b	behavioral	adaptability	mid	high	Tell me about a time you had to learn quickly to keep up with expectations.	2026-02-09 07:13:17.33069+00	\N
b3d336b9-30ce-4865-9495-a27a56e7fa67	behavioral	adaptability	mid	high	How do you adapt when facing uncertainty or incomplete information?	2026-02-09 07:13:17.33069+00	\N
73b47ff9-ca46-4a4f-9d85-24cca5ac77c0	behavioral	adaptability	mid	high	Why is adaptability critical at the mid-level stage of your career?	2026-02-09 07:13:17.33069+00	\N
0ed406fa-ae8e-4fd8-bf76-1fddc623677b	behavioral	adaptability	mid	high	Describe a time when adapting quickly prevented a project failure.	2026-02-09 07:13:17.33069+00	\N
183851b2-b67e-429a-acdc-e376c63f18c2	behavioral	adaptability	mid	high	How have you adapted when business priorities conflicted with team goals?	2026-02-09 07:13:17.33069+00	\N
05061253-7fc1-47af-b60a-a996b1da28b6	behavioral	adaptability	mid	high	Tell me about a time you had to change direction after significant effort was already invested.	2026-02-09 07:13:17.33069+00	\N
2005eed1-849c-4af2-823e-d8d51e8d5da2	behavioral	adaptability	mid	high	Describe a situation where adaptability was tested under high pressure.	2026-02-09 07:13:17.33069+00	\N
1e1dd135-4e37-40ab-a0d3-7a1127e8e44c	behavioral	adaptability	mid	high	How do you adapt when stakeholder expectations keep changing?	2026-02-09 07:13:17.33069+00	\N
81cf5a8c-8c88-4897-b857-0be0275ae4e6	behavioral	adaptability	mid	high	Describe a time you had to adapt your communication style to resolve conflict.	2026-02-09 07:13:17.33069+00	\N
c6c4f592-6d24-401b-abf2-cac7000846c2	behavioral	adaptability	mid	high	How do you adapt when decisions must be made with incomplete data?	2026-02-09 07:13:17.33069+00	\N
39158fcb-7a05-4ed1-80e9-587d3bc86066	behavioral	adaptability	mid	high	Tell me about a time adaptability helped you manage uncertainty.	2026-02-09 07:13:17.33069+00	\N
06a05a50-d518-4c3d-8ae1-7705c83c6528	behavioral	adaptability	mid	high	Describe a situation where adapting late caused challenges. What did you learn?	2026-02-09 07:13:17.33069+00	\N
9a364b85-5bc9-4248-a05e-ab4423586047	behavioral	adaptability	mid	high	How do you adapt when organizational change impacts your role directly?	2026-02-09 07:13:17.33069+00	\N
5f4dccc5-ac12-42a5-b538-efc4a286d51c	behavioral	adaptability	mid	high	Describe a time you had to unlearn something to adapt effectively.	2026-02-09 07:13:17.33069+00	\N
b2fccaa3-0a72-4b35-8746-664e45699c40	behavioral	adaptability	mid	high	How do you adapt when managing multiple changes simultaneously?	2026-02-09 07:13:17.33069+00	\N
334b19a6-1c85-420a-a666-d9faed0f8fd6	behavioral	adaptability	mid	high	Tell me about a time you adapted to feedback that challenged your assumptions.	2026-02-09 07:13:17.33069+00	\N
744414f0-b1b5-4784-92b6-01fd1dcd80c8	behavioral	adaptability	mid	high	How do you adapt when innovation requires risk-taking?	2026-02-09 07:13:17.33069+00	\N
87123277-7733-4886-9b2f-19f661a12005	behavioral	adaptability	mid	high	Describe a time you adapted to a new working model or process.	2026-02-09 07:13:17.33069+00	\N
0040d17e-1f0f-448f-9441-00546fbdcb98	behavioral	adaptability	mid	high	How do you adapt when performance expectations increase suddenly?	2026-02-09 07:13:17.33069+00	\N
df791b93-3799-4903-a0a1-eed381ae739a	behavioral	adaptability	mid	high	Tell me about a time adaptability helped you recover from a mistake.	2026-02-09 07:13:17.33069+00	\N
fd1772db-3c77-4a94-a9af-478ed5dde1b7	behavioral	adaptability	mid	high	How do you adapt when collaboration styles differ across teams?	2026-02-09 07:13:17.33069+00	\N
92b22ea6-42a1-4a64-bee6-cf955a597beb	behavioral	resilience	senior	low	How do you prevent stress from affecting your decisions?	2026-02-09 07:17:23.81474+00	\N
2ff77340-a7c5-4dc1-8941-582888cc4ec2	behavioral	adaptability	mid	high	Describe a situation where adaptability improved long-term results.	2026-02-09 07:13:17.33069+00	\N
947b6782-bea5-4b15-a9a0-41c1cda1f28a	behavioral	adaptability	mid	high	Why is adaptability a critical differentiator at the mid-level stage?	2026-02-09 07:13:17.33069+00	\N
1f4a591a-4da8-4694-8afe-d271ab528d66	behavioral	resilience	senior	low	What does resilience mean to you as a senior professional?	2026-02-09 07:17:23.81474+00	\N
7bc35a93-ae8b-402f-98eb-f181f665ca95	behavioral	resilience	senior	low	How do you stay motivated during prolonged work pressure?	2026-02-09 07:17:23.81474+00	\N
bc3a1e66-2d4d-4fa2-b909-db63aa240110	behavioral	resilience	senior	low	How do you handle setbacks in projects?	2026-02-09 07:17:23.81474+00	\N
23f67a22-0d90-4db7-ba11-5a26597291a2	behavioral	resilience	senior	low	How do you maintain consistency during repeated challenges?	2026-02-09 07:17:23.81474+00	\N
7e341407-0a28-4a34-9642-0f6ccdf98a4a	behavioral	resilience	senior	low	How do you respond to constructive criticism at a senior level?	2026-02-09 07:17:23.81474+00	\N
856ded4b-a311-412f-a19d-7177e39bdf3a	behavioral	resilience	senior	low	What does resilience mean in your current role?	2026-02-09 07:17:23.81474+00	\N
52c51fdb-b9cb-4e7f-b4d4-16fd48c22b56	behavioral	resilience	senior	low	How do you remain calm during daily work pressures?	2026-02-09 07:17:23.81474+00	\N
a874d4d2-5a33-43f3-8930-9200f2ba5e74	behavioral	resilience	senior	low	How do you handle minor setbacks at work?	2026-02-09 07:17:23.81474+00	\N
79e29d89-8795-4534-95f2-cd73ef53979c	behavioral	resilience	senior	low	How do you stay motivated during repetitive challenges?	2026-02-09 07:17:23.81474+00	\N
b2a5e2bf-6108-4704-8862-37348c277d3e	behavioral	resilience	senior	low	How do you manage stress in a senior role?	2026-02-09 07:17:23.81474+00	\N
90ef0889-f460-4f42-a383-4973c8d6f350	behavioral	resilience	senior	low	Describe how experience helps you handle challenges.	2026-02-09 07:17:23.81474+00	\N
39e379c7-7f64-4218-b0df-e6195815c106	behavioral	resilience	senior	low	How do you stay focused during demanding workdays?	2026-02-09 07:17:23.81474+00	\N
2c0797bc-9964-47b0-9924-7b2c3ef8600b	behavioral	resilience	senior	low	How do you react when plans do not go as expected?	2026-02-09 07:17:23.81474+00	\N
9fc37155-c1a0-405a-9fc2-03bf1352bb39	behavioral	resilience	senior	low	How do you maintain confidence during challenges?	2026-02-09 07:17:23.81474+00	\N
6613a6f0-6b88-4cd0-be58-019126eaa950	behavioral	resilience	senior	low	How do you handle pressure from multiple responsibilities?	2026-02-09 07:17:23.81474+00	\N
56becee9-a81f-474d-9cd5-6c3f1fd514e7	behavioral	resilience	senior	low	How do you recover quickly from small work disruptions?	2026-02-09 07:17:23.81474+00	\N
ac875623-6dd5-42f8-8786-dc778500fd9d	behavioral	resilience	senior	low	How do you stay resilient during routine operational issues?	2026-02-09 07:17:23.81474+00	\N
893c158a-1a88-4995-a4a9-fe56092f1459	behavioral	resilience	senior	low	How do you balance pressure and performance expectations?	2026-02-09 07:17:23.81474+00	\N
6e59d664-9713-41d8-9b5d-7560eb675c78	behavioral	resilience	senior	low	How do you remain steady during team-related challenges?	2026-02-09 07:17:23.81474+00	\N
dc899e6a-f1c4-458e-bb11-aded1e4c91d8	behavioral	resilience	senior	low	How do you deal with work pressure without losing effectiveness?	2026-02-09 07:17:23.81474+00	\N
68cc59b2-1268-4c28-98c5-4dc72c564940	behavioral	resilience	senior	low	How does resilience help you support your team?	2026-02-09 07:17:23.81474+00	\N
6e1a9cec-9580-4618-a93f-c8d1ee070db7	behavioral	resilience	senior	low	How do you stay consistent during ongoing responsibilities?	2026-02-09 07:17:23.81474+00	\N
a2eac513-5e1f-46ff-83c7-e74c25e740e7	behavioral	resilience	senior	low	How do you maintain resilience during routine performance reviews?	2026-02-09 07:17:23.81474+00	\N
cfb577b5-0919-48bc-a545-a46a06f1eb10	behavioral	resilience	senior	low	Why is resilience important at a senior professional level?	2026-02-09 07:17:23.81474+00	\N
49270967-b0b2-48b4-a217-00f69f00b786	behavioral	resilience	senior	medium	Describe a time you faced sustained challenges over a long period.	2026-02-09 07:17:45.672974+00	\N
ab0d3d4d-2842-43a5-88a5-b1d4f2fa3fc5	behavioral	resilience	senior	medium	How do you recover after a significant professional failure?	2026-02-09 07:17:45.672974+00	\N
0873e2bf-b958-49ff-ab5b-c0dbf88cfee5	behavioral	resilience	senior	medium	Tell me about a time you demonstrated persistence to achieve results.	2026-02-09 07:17:45.672974+00	\N
900196a1-2102-44c4-a0a0-35691f659b79	behavioral	resilience	senior	medium	How do you manage stress during high-stakes situations?	2026-02-09 07:17:45.672974+00	\N
24030514-7e66-441f-a416-ef9244556bc7	behavioral	resilience	senior	medium	Describe a time you balanced multiple critical pressures successfully.	2026-02-09 07:17:45.672974+00	\N
e6a36acd-6228-4fde-b162-704df16820a6	behavioral	resilience	senior	medium	How do you stay resilient when projects face repeated delays?	2026-02-09 07:17:45.672974+00	\N
79a49075-82b1-4719-ad94-4965edf7cf9d	behavioral	resilience	senior	medium	Describe a time you had to recover momentum after a slowdown.	2026-02-09 07:17:45.672974+00	\N
f7f186c4-931e-4279-9285-02b95da82276	behavioral	resilience	senior	medium	How do you maintain resilience during extended decision uncertainty?	2026-02-09 07:17:45.672974+00	\N
d6b684db-9dd2-4202-9ca1-bdb958696ea7	behavioral	resilience	senior	medium	Describe a time you had to remain resilient while managing conflicting priorities.	2026-02-09 07:17:45.672974+00	\N
12d54e76-ec52-4f7e-8029-40496acda0cc	behavioral	resilience	senior	medium	How do you handle resilience when outcomes are outside your control?	2026-02-09 07:17:45.672974+00	\N
cdeb3704-7540-4562-9b24-dfa573e1e9c4	behavioral	resilience	senior	medium	Tell me about a time you had to stay resilient while supporting others.	2026-02-09 07:17:45.672974+00	\N
641e5beb-9a1c-4f45-854c-592e8ffcc538	behavioral	resilience	senior	medium	How do you rebuild confidence after a missed target?	2026-02-09 07:17:45.672974+00	\N
488af593-a168-4c16-8829-1fdaf6c9beda	behavioral	resilience	senior	medium	Describe a situation where resilience helped you prevent escalation.	2026-02-09 07:17:45.672974+00	\N
e404feea-9568-44b0-82b9-51acce963418	behavioral	resilience	senior	medium	How do you maintain resilience during workload spikes?	2026-02-09 07:17:45.672974+00	\N
da4d9858-e450-4ee6-84da-ae8ac425a3d2	behavioral	resilience	senior	medium	Tell me about a time resilience helped you make a tough decision.	2026-02-09 07:17:45.672974+00	\N
534929f5-f36f-445f-9397-04cf2f2f788f	behavioral	resilience	senior	medium	How do you stay resilient during repeated feedback cycles?	2026-02-09 07:17:45.672974+00	\N
3b4fff56-9294-46ff-a385-a6fdddd69a86	behavioral	resilience	senior	medium	Describe a time you had to recover from reduced team morale.	2026-02-09 07:17:45.672974+00	\N
b3069dcf-5611-49b5-8f8e-9932b7a329ca	behavioral	resilience	senior	medium	How do you remain resilient when progress is slow?	2026-02-09 07:17:45.672974+00	\N
7a00001a-e85b-47df-8a43-e8c6f4112b62	behavioral	resilience	senior	medium	Tell me about a time resilience helped you manage expectations upward.	2026-02-09 07:17:45.672974+00	\N
85b76c70-a08a-41cf-84c0-63e1afa46203	behavioral	communication	senior	low	How do you communicate priorities to your team?	2026-02-09 07:20:13.482421+00	\N
b3c599e5-bd7d-4d5a-b82c-573832bfb676	behavioral	resilience	senior	medium	How do you prevent frustration from impacting performance?	2026-02-09 07:17:45.672974+00	\N
796c98a7-5ba4-41c9-9487-49e6fe651e18	behavioral	resilience	senior	medium	Describe a time you had to stay resilient amid changing leadership direction.	2026-02-09 07:17:45.672974+00	\N
daee0c8e-cca3-4c4c-b61f-19b80aaa2386	behavioral	resilience	senior	medium	How do you sustain resilience during long transformation initiatives?	2026-02-09 07:17:45.672974+00	\N
f8c7f8af-ff04-419b-ac28-8844c01d986b	behavioral	resilience	senior	medium	Tell me about a time resilience helped you handle ambiguity.	2026-02-09 07:17:45.672974+00	\N
4c3c25b0-348e-4bca-9a95-55d73092ca13	behavioral	resilience	senior	medium	How do you remain resilient while balancing delivery and people concerns?	2026-02-09 07:17:45.672974+00	\N
3e7c2c60-ea3d-426a-ac08-a24182e99ec0	behavioral	resilience	senior	medium	Why is resilience essential at your senior career stage?	2026-02-09 07:17:45.672974+00	\N
bffd25cc-c163-4cd0-8852-adc62f3b08f5	behavioral	resilience	senior	high	Describe a major setback that tested your leadership resilience.	2026-02-09 07:18:01.142761+00	\N
f14403ae-f66f-4e98-b7e7-40fcc18da055	behavioral	resilience	senior	high	How do you remain resilient during prolonged uncertainty or change?	2026-02-09 07:18:01.142761+00	\N
af1e5b01-5de4-4d7e-8ead-29346113a14a	behavioral	resilience	senior	high	Tell me about a time you pushed through burnout while ensuring results.	2026-02-09 07:18:01.142761+00	\N
49f33393-2c40-4bc4-8e46-7bdbaba7a7e0	behavioral	resilience	senior	high	How do you sustain performance after repeated failures or losses?	2026-02-09 07:18:01.142761+00	\N
21a4ed8e-2913-436e-95bf-f2331eecb12c	behavioral	resilience	senior	high	Why is resilience critical at the senior stage of your career?	2026-02-09 07:18:01.142761+00	\N
7049a6f3-53c8-41db-8330-1a1db7cba4df	behavioral	resilience	senior	high	Describe a time when a long-term initiative failed despite strong planning. How did you respond?	2026-02-09 07:18:01.142761+00	\N
1fddd1f9-7f98-4b40-a138-2e2d4343e707	behavioral	resilience	senior	high	How do you remain resilient when business results consistently fall short of expectations?	2026-02-09 07:18:01.142761+00	\N
fe1e58cb-1000-4440-a16a-143d46eb85e6	behavioral	resilience	senior	high	Tell me about a time when leadership decisions were challenged repeatedly. How did you cope?	2026-02-09 07:18:01.142761+00	\N
232d936e-4c9f-416c-814c-d56aa59e7c9d	behavioral	resilience	senior	high	Describe how you handled prolonged organizational uncertainty.	2026-02-09 07:18:01.142761+00	\N
99bf0b7b-7fab-436d-a2c2-726bb8d5f935	behavioral	resilience	senior	high	How do you recover personally after a major leadership mistake?	2026-02-09 07:18:01.142761+00	\N
7f411b6d-750d-4073-9fe2-087bca831988	behavioral	resilience	senior	high	Tell me about a time you had to lead through repeated failures.	2026-02-09 07:18:01.142761+00	\N
81a45fc7-d9f3-401b-b17e-1f78a86cc237	behavioral	resilience	senior	high	How do you sustain performance during sustained workload pressure?	2026-02-09 07:18:01.142761+00	\N
ab83eaff-286c-44c8-83a2-5ac7c04c1d23	behavioral	resilience	senior	high	Describe a situation where external factors severely impacted outcomes. How did you respond?	2026-02-09 07:18:01.142761+00	\N
ffe67e2e-671c-4df0-ae0a-40beb22eb737	behavioral	resilience	senior	high	How do you stay resilient when stakeholders lose confidence?	2026-02-09 07:18:01.142761+00	\N
bb1560ff-1369-48d6-b172-2791eca7e7d2	behavioral	resilience	senior	high	Tell me about a time you had to make tough decisions under emotional pressure.	2026-02-09 07:18:01.142761+00	\N
5551d58a-f646-4220-903e-886c950fcc5f	behavioral	resilience	senior	high	How do you remain resilient after losing a key client or opportunity?	2026-02-09 07:18:01.142761+00	\N
239199bc-4d91-410a-9fee-cc460157fa75	behavioral	resilience	senior	high	Describe a time you had to absorb organizational pressure without passing it to your team.	2026-02-09 07:18:01.142761+00	\N
cd5d057f-8dd2-482a-9062-341c0b0b2d44	behavioral	resilience	senior	high	How do you handle burnout risks while maintaining leadership effectiveness?	2026-02-09 07:18:01.142761+00	\N
373c84f4-e55a-4a70-849e-c45930228925	behavioral	resilience	senior	high	Tell me about a time you had to rebuild momentum after a major slowdown.	2026-02-09 07:18:01.142761+00	\N
e9c3f5c7-870d-490d-9cd7-ff3ac0691106	behavioral	resilience	senior	high	How do you sustain confidence during repeated high-risk decisions?	2026-02-09 07:18:01.142761+00	\N
c12e1b16-0023-44fb-a7ab-bc193e04624e	behavioral	resilience	senior	high	Describe a situation where resilience directly impacted business survival.	2026-02-09 07:18:01.142761+00	\N
7d2293a1-80f9-4413-ad64-475d54726c7a	behavioral	resilience	senior	high	How do you manage personal setbacks while leading others?	2026-02-09 07:18:01.142761+00	\N
1e8a19e2-6d36-4d76-bca0-b84774d1508c	behavioral	resilience	senior	high	Tell me about a time resilience helped you retain top talent.	2026-02-09 07:18:01.142761+00	\N
55cacfaa-58e2-46e2-854a-add6e9180c4d	behavioral	resilience	senior	high	How do you maintain resilience when progress is slow and invisible?	2026-02-09 07:18:01.142761+00	\N
8a98069b-e3e5-48d0-9a40-b933e0c1bc12	behavioral	resilience	senior	high	Why is resilience a strategic capability for senior professionals?	2026-02-09 07:18:01.142761+00	\N
fb3a3765-fbf7-4642-a5ac-a8358dc33066	behavioral	communication	senior	low	Why is effective communication important at a senior level?	2026-02-09 07:20:13.482421+00	\N
14d6e1ad-03a9-44a8-9b85-a15dea3209c7	behavioral	communication	senior	low	How do you ensure clarity when communicating with teams?	2026-02-09 07:20:13.482421+00	\N
e38b33b0-746c-480f-b6b1-0f8e8549de5a	behavioral	communication	senior	low	Describe your communication style with peers.	2026-02-09 07:20:13.482421+00	\N
79b7f28f-cb5c-4d81-902c-7065484fabab	behavioral	communication	senior	low	How do you listen during senior-level discussions?	2026-02-09 07:20:13.482421+00	\N
baf95c1e-26fd-4ee1-a4a3-29ee21149872	behavioral	communication	senior	low	How do you communicate expectations to your team?	2026-02-09 07:20:13.482421+00	\N
b0487079-0a79-4c9f-91c4-66bfe7ad88ba	behavioral	communication	senior	low	How do you ensure clear communication with your team?	2026-02-09 07:20:13.482421+00	\N
6b75816e-487c-42ba-b61c-e49c4caf7ac7	behavioral	communication	senior	low	How do you usually communicate expectations to your team?	2026-02-09 07:20:13.482421+00	\N
a54e7b2e-9dd3-4e9c-8841-e6657cc86811	behavioral	communication	senior	low	Why is communication important in a leadership role?	2026-02-09 07:20:13.482421+00	\N
a541c889-4ac1-4f5a-8431-c63c3700a9d3	behavioral	communication	senior	low	How do you keep stakeholders informed?	2026-02-09 07:20:13.482421+00	\N
1b314108-7875-4c21-93a7-7229056bed67	behavioral	communication	senior	low	How do you encourage open communication in your team?	2026-02-09 07:20:13.482421+00	\N
1326023f-99f6-4644-a9e5-6c66386ce888	behavioral	communication	senior	low	How do you adjust communication for different team members?	2026-02-09 07:20:13.482421+00	\N
0b02740e-86bf-4893-a3a3-f77067efc7bf	behavioral	communication	senior	low	How do you ensure your messages are understood correctly?	2026-02-09 07:20:13.482421+00	\N
8e2be325-4251-471a-ae0b-b4388be0c5e1	behavioral	communication	senior	low	How do you handle routine communication with senior stakeholders?	2026-02-09 07:20:13.482421+00	\N
a1df62bf-50dc-4fbf-8376-32abebee6d2f	behavioral	communication	senior	low	How do you communicate during regular team meetings?	2026-02-09 07:20:13.482421+00	\N
08db0c4a-0011-46ad-8623-673e557bf102	behavioral	communication	senior	low	How do you ensure transparency in communication?	2026-02-09 07:20:13.482421+00	\N
100da9a6-62f3-4be0-956a-960c674d14d6	behavioral	communication	senior	low	How do you communicate changes to your team?	2026-02-09 07:20:13.482421+00	\N
1aa6137b-30a6-489e-b4c2-1a4857bf6db9	behavioral	communication	senior	low	How do you communicate progress on work?	2026-02-09 07:20:13.482421+00	\N
c14d3476-9600-4566-a9ad-d392cd9ada36	behavioral	communication	senior	low	How do you listen during team discussions?	2026-02-09 07:20:13.482421+00	\N
ce47413c-d771-4174-950b-b72fbc70b2cf	behavioral	communication	senior	low	How do you ensure consistent communication across teams?	2026-02-09 07:20:13.482421+00	\N
e4a90a7e-2237-4792-bfac-f04f0b358266	behavioral	communication	senior	low	How do you communicate expectations during project execution?	2026-02-09 07:20:13.482421+00	\N
41328db6-3872-47b1-9c33-324d6118ef57	behavioral	communication	senior	low	How do you communicate decisions to your team?	2026-02-09 07:20:13.482421+00	\N
fc0c2742-18c7-4a55-b2ee-b16ec3b22e24	behavioral	communication	senior	low	How do you communicate feedback to team members?	2026-02-09 07:20:13.482421+00	\N
218ca5b9-e23b-4406-8d84-b328da5de345	behavioral	communication	senior	low	How do you manage communication in cross-functional work?	2026-02-09 07:20:13.482421+00	\N
b170bdd0-6faa-49be-9760-b27538234dae	behavioral	communication	senior	low	How does effective communication support your leadership effectiveness?	2026-02-09 07:20:13.482421+00	\N
6196ef3f-98b3-4a81-b44f-0358a78818b7	behavioral	communication	senior	medium	Describe a time you explained a complex issue to senior stakeholders.	2026-02-09 07:20:13.482421+00	\N
7e285470-2fc1-4fe8-8f0c-04935937708c	behavioral	communication	senior	medium	How do you handle misunderstandings between teams?	2026-02-09 07:20:13.482421+00	\N
fac16a0e-a017-467e-99ef-e78d09b0ce58	behavioral	communication	senior	medium	How do you adapt communication for different audiences?	2026-02-09 07:20:13.482421+00	\N
d46cf2aa-a9db-4e56-b6d5-2fbc32ed8aaa	behavioral	communication	senior	medium	Describe a time clear communication prevented a major issue.	2026-02-09 07:20:13.482421+00	\N
dea58096-a574-4f0f-89c4-6179abe1bae3	behavioral	communication	senior	medium	How do you ensure transparency in ongoing communication?	2026-02-09 07:20:13.482421+00	\N
40d1e638-c937-418e-b52f-5b2aa958b98d	behavioral	communication	senior	medium	How do you ensure alignment when communicating strategic goals?	2026-02-09 07:20:13.482421+00	\N
c59e3a5a-b8cb-4712-ac44-027ca61ca815	behavioral	communication	senior	medium	Describe a time you had to communicate expectations across teams.	2026-02-09 07:20:13.482421+00	\N
553a0324-2c5a-49bb-a82d-34f2f6770b67	behavioral	communication	senior	medium	How do you communicate progress to senior stakeholders?	2026-02-09 07:20:13.482421+00	\N
bf36bd30-4903-4711-8968-1f680a88fdc7	behavioral	communication	senior	medium	Describe how you handle difficult conversations at work.	2026-02-09 07:20:13.482421+00	\N
4a81a810-40b4-4200-8078-01a170ab5f98	behavioral	communication	senior	medium	How do you ensure your message is not misunderstood?	2026-02-09 07:20:13.482421+00	\N
2a1e16e6-5773-451c-b547-7307c863779c	behavioral	communication	senior	medium	Tell me about a time you had to influence without authority.	2026-02-09 07:20:13.482421+00	\N
f8ef80d7-04a9-4c71-913c-cecae85e97d0	behavioral	communication	senior	medium	How do you communicate during organizational change?	2026-02-09 07:20:13.482421+00	\N
ad5bf39e-b2ac-425c-86e3-c252a18a1b5c	behavioral	communication	senior	medium	Describe a time when you had to simplify complex information.	2026-02-09 07:20:13.482421+00	\N
7e4bf4d0-2bd1-456b-8fd7-98ab6d44a183	behavioral	communication	senior	medium	How do you adapt communication across cultures or teams?	2026-02-09 07:20:13.482421+00	\N
12a66536-03b1-46e8-ab24-836a4e2bc88c	behavioral	communication	senior	medium	How do you manage communication during tight deadlines?	2026-02-09 07:20:13.482421+00	\N
504233ed-43c7-48c7-b098-61a6f9642771	behavioral	communication	senior	medium	Describe a time you had to realign a team through communication.	2026-02-09 07:20:13.482421+00	\N
a8576f70-520a-4a71-9477-4f13dd04dd94	behavioral	communication	senior	medium	How do you handle feedback conversations with peers?	2026-02-09 07:20:13.482421+00	\N
418445da-cddf-4c10-826b-d1aab5892481	behavioral	communication	senior	medium	Tell me about a time communication helped resolve a conflict.	2026-02-09 07:20:13.482421+00	\N
74d187e6-127a-4a7a-b900-84e99f90e574	behavioral	communication	senior	medium	How do you communicate risks to leadership?	2026-02-09 07:20:13.482421+00	\N
70df5467-32e7-49f4-ba52-02116bb451bb	behavioral	communication	senior	medium	Describe a time when communication improved team performance.	2026-02-09 07:20:13.482421+00	\N
0bb6e968-f929-44bc-98f2-0bdeb69f39ec	behavioral	communication	senior	medium	How do you ensure consistency in recurring communications?	2026-02-09 07:20:13.482421+00	\N
aa9ff3c1-fb7e-479e-999a-cfd04d850289	behavioral	communication	senior	medium	How do you communicate decisions that may be unpopular?	2026-02-09 07:20:13.482421+00	\N
170b18f9-c655-45ad-9628-7756b044d7a2	behavioral	communication	senior	medium	Describe a time you improved communication processes.	2026-02-09 07:20:13.482421+00	\N
fe592da4-7563-4dc0-9bcc-043b77cf9ec3	behavioral	communication	senior	medium	How do you balance listening and speaking in discussions?	2026-02-09 07:20:13.482421+00	\N
2f00319d-f741-4614-a6aa-b4662349490f	behavioral	communication	senior	medium	Why is communication a critical skill at the senior level?	2026-02-09 07:20:13.482421+00	\N
82801575-2d0e-43fa-9923-f57a55aaa2dd	behavioral	communication	senior	high	Describe a situation where poor communication led to a setback. How did you resolve it?	2026-02-09 07:20:13.482421+00	\N
de3e2f11-8a61-4c9b-b66b-262b5bcbbe5a	behavioral	communication	senior	high	How do you communicate effectively under high pressure or crisis situations?	2026-02-09 07:20:13.482421+00	\N
1fc442bb-48c8-4f49-a33e-1aae1abcf6bd	behavioral	communication	senior	high	Tell me about a time you had to deliver difficult or unpopular information.	2026-02-09 07:20:13.482421+00	\N
bc1a9ed1-d89d-40c7-9781-81cc3f7692d7	behavioral	communication	senior	high	How do you handle communication when stakeholders strongly disagree?	2026-02-09 07:20:13.482421+00	\N
b6ccbba2-f034-449d-8191-3922fad6af74	behavioral	communication	senior	high	Why is strong communication critical at the senior stage of your career?	2026-02-09 07:20:13.482421+00	\N
f66079d4-83ca-4fb4-8b11-a9c4a1e81b0a	behavioral	communication	senior	high	Describe a time when miscommunication at a senior level created risk. How did you address it?	2026-02-09 07:20:13.482421+00	\N
1dedfc42-3ce4-47e7-9406-3b77bc47ea3e	behavioral	communication	senior	high	How do you communicate when senior stakeholders have conflicting expectations?	2026-02-09 07:20:13.482421+00	\N
016d4063-39dc-4986-ab64-54383d996618	behavioral	communication	senior	high	Describe a situation where your communication influenced executive decision-making?	2026-02-09 07:20:13.482421+00	\N
3f8031a6-1328-4797-8a94-452f7b429851	behavioral	communication	senior	high	How do you communicate sensitive information without causing panic?	2026-02-09 07:20:13.482421+00	\N
1a79fda2-39cb-4c7b-8eb2-265e2d833a72	behavioral	communication	senior	high	Describe a time when communication failure required recovery at a senior level.	2026-02-09 07:20:13.482421+00	\N
3b8e763c-d42e-4dbe-8f54-1e3c52569568	behavioral	communication	senior	high	Tell me about a time you had to lead through repeated failures.	2026-02-09 07:20:13.482421+00	\N
593f779b-357c-471c-a87e-2fc7ae6c347a	behavioral	communication	senior	high	How do you ensure consistent messaging across leadership teams?	2026-02-09 07:20:13.482421+00	\N
00a217c4-67d2-48bf-a4a7-0dbeba380e76	behavioral	communication	senior	high	Describe a time when you had to communicate ambiguity honestly.	2026-02-09 07:20:13.482421+00	\N
0a9e5dad-fac1-4013-8423-8d686b5372a2	behavioral	communication	senior	high	How do you tailor communication for board-level stakeholders?	2026-02-09 07:20:13.482421+00	\N
d7466f97-9004-4e47-94ac-53243a913b52	behavioral	communication	senior	high	Describe a time you had to push back using communication alone.	2026-02-09 07:20:13.482421+00	\N
c73f4c32-657a-4863-8582-70ff3cb6cadc	behavioral	communication	senior	high	How do you handle communication breakdowns across functions?	2026-02-09 07:20:13.482421+00	\N
465b2ea5-c011-4daa-ad97-ef26434a2563	behavioral	communication	senior	high	Describe a situation where communication prevented reputational damage.	2026-02-09 07:20:13.482421+00	\N
22537dcc-80f2-49fe-a922-3694c4fd350d	behavioral	communication	senior	high	How do you communicate priorities during organizational change?	2026-02-09 07:20:13.482421+00	\N
6b1c2d71-bf47-4008-938c-5472493c9860	behavioral	communication	senior	high	Describe a time when listening was more important than speaking.	2026-02-09 07:20:13.482421+00	\N
daf7a70d-231f-4b93-b7c6-2eb5e717b588	behavioral	communication	senior	high	How do you communicate trade-offs to senior stakeholders?	2026-02-09 07:20:13.482421+00	\N
ddd73eef-aa09-4d0e-9949-21ea66bdce64	behavioral	communication	senior	high	Describe a time your communication resolved a leadership conflict.	2026-02-09 07:20:13.482421+00	\N
2e7c9bd0-75d1-4345-8c81-d12d04383c1c	behavioral	communication	senior	high	How do you communicate accountability without demotivating teams?	2026-02-09 07:20:13.482421+00	\N
27ad6755-8b27-4970-b59c-32509cddf356	behavioral	communication	senior	high	Describe a situation where over-communication was necessary.	2026-02-09 07:20:13.482421+00	\N
5cb9a1fb-8914-419c-9b26-2824da560402	behavioral	communication	senior	high	How do you ensure communication credibility at senior levels?	2026-02-09 07:20:13.482421+00	\N
8dba70bb-20c2-4f69-9ae5-a674eda872d1	behavioral	communication	senior	high	Why is advanced communication a differentiator at senior levels?	2026-02-09 07:20:13.482421+00	\N
1c4d7a54-d67b-43f7-8e43-18e6bd2d9379	behavioral	adaptability	senior	low	What does adaptability mean in a senior role?	2026-02-09 07:22:42.788285+00	\N
2b690290-00ca-4e5d-aea8-4f1acfec9338	behavioral	adaptability	senior	low	How do you respond to changes in strategy or direction?	2026-02-09 07:22:42.788285+00	\N
af4b1e89-e289-4d7a-aeb4-42ef3c66251f	behavioral	adaptability	senior	low	How comfortable are you working with new tools or technologies?	2026-02-09 07:22:42.788285+00	\N
b09b0e51-21b8-4b27-b3cd-a00c4ec1d193	behavioral	adaptability	senior	low	How do you handle changes in work processes?	2026-02-09 07:22:42.788285+00	\N
766b140a-6244-4107-bd63-49d6202b5fc3	behavioral	adaptability	senior	low	How do you stay flexible while maintaining performance?	2026-02-09 07:22:42.788285+00	\N
b7d52a00-28d4-44df-b27b-147d559bbee2	behavioral	adaptability	senior	low	What does adaptability mean in your daily leadership role?	2026-02-09 07:22:42.788285+00	\N
b4eeb154-20d3-4ff9-97ac-48451170ca90	behavioral	adaptability	senior	low	How do you react when work priorities change unexpectedly?	2026-02-09 07:22:42.788285+00	\N
7e49bca1-cf33-4127-8100-96fad5c21ae5	behavioral	adaptability	senior	low	How comfortable are you adapting to new organizational processes?	2026-02-09 07:22:42.788285+00	\N
2414dbb6-b928-4639-b1ba-8f428eb2d33c	behavioral	adaptability	senior	low	How do you handle new responsibilities added to your role?	2026-02-09 07:22:42.788285+00	\N
e394c00f-4e99-456a-ac6d-d554704524cc	behavioral	adaptability	senior	low	How do you adapt when leadership expectations evolve?	2026-02-09 07:22:42.788285+00	\N
0dde336e-8312-43f1-82d8-f72400b47ac4	behavioral	adaptability	senior	low	How do you respond to changes in team structure?	2026-02-09 07:22:42.788285+00	\N
f20acfaf-d2dd-4040-a6d7-781ab057c7c9	behavioral	adaptability	senior	low	How do you stay effective when tools or systems change?	2026-02-09 07:22:42.788285+00	\N
a3d87a87-dbc0-4725-8b76-215bac976fba	behavioral	adaptability	senior	low	How do you adjust your plans when timelines shift?	2026-02-09 07:22:42.788285+00	\N
3daac2af-810e-4eb4-aa81-f4687906f0c8	behavioral	adaptability	senior	low	How do you adapt your working style with different teams?	2026-02-09 07:22:42.788285+00	\N
1250fd51-f298-4520-b0e2-18a8250b2500	behavioral	adaptability	senior	low	How do you manage changes in project scope?	2026-02-09 07:22:42.788285+00	\N
109bc34b-4307-4d46-918a-69ee2c7cda06	behavioral	adaptability	senior	low	How do you stay adaptable while maintaining performance standards?	2026-02-09 07:22:42.788285+00	\N
738ba6e4-3378-4a7d-a321-2bf03b465883	behavioral	adaptability	senior	low	How do you respond to feedback that requires change?	2026-02-09 07:22:42.788285+00	\N
fd108a6f-17fa-4bfa-bc2b-b13f736658c2	behavioral	adaptability	senior	low	How do you adapt when business goals shift?	2026-02-09 07:22:42.788285+00	\N
47aa8638-81f0-44da-9054-30b62fa58119	behavioral	adaptability	senior	low	How do you adjust decision-making when conditions change?	2026-02-09 07:22:42.788285+00	\N
de12f7b1-93c3-443c-b661-d95a7cc81bc8	behavioral	adaptability	senior	low	How do you adapt when priorities compete?	2026-02-09 07:22:42.788285+00	\N
b4241327-3286-4085-895c-bde4c897be82	behavioral	adaptability	senior	low	How do you handle unexpected changes in leadership direction?	2026-02-09 07:22:42.788285+00	\N
87995980-b959-4e0e-9041-ce54c7eace3c	behavioral	adaptability	senior	low	How do you remain adaptable during continuous change?	2026-02-09 07:22:42.788285+00	\N
5dfaacd0-1844-461b-8cb1-6c205ab7b90e	behavioral	adaptability	senior	low	How do you adapt when stakeholder expectations evolve?	2026-02-09 07:22:42.788285+00	\N
f2183476-b1d2-4853-8ff4-811c3f266972	behavioral	adaptability	senior	low	How do you handle ambiguity in evolving situations?	2026-02-09 07:22:42.788285+00	\N
cbcffe4c-22b7-4799-b3f3-1879f4e94bca	behavioral	adaptability	senior	low	Why is adaptability important at the senior professional level?	2026-02-09 07:22:42.788285+00	\N
d1ea582a-dca5-465e-add9-bd3fd5a34b69	behavioral	adaptability	senior	medium	Describe a time you had to adapt to a major organizational change.	2026-02-09 07:22:42.788285+00	\N
28b882ca-2c42-40d8-ab4d-7db1e782c686	behavioral	adaptability	senior	medium	How do you manage frequent changes in requirements or scope?	2026-02-09 07:22:42.788285+00	\N
1b87fe31-392c-4732-8442-31d91b6934c7	behavioral	adaptability	senior	medium	Tell me about a time you worked outside your comfort zone to deliver results.	2026-02-09 07:22:42.788285+00	\N
7e30d50d-b978-4b8b-b12f-b60cb3da177b	behavioral	adaptability	senior	medium	How do you adapt when working with new teams or leaders?	2026-02-09 07:22:42.788285+00	\N
6ab72657-6422-4c17-9792-3ce29b1a072a	behavioral	adaptability	senior	medium	Describe a time you changed your approach to improve outcomes.	2026-02-09 07:22:42.788285+00	\N
8af9c882-fd80-4808-b2ed-87c59afc9211	behavioral	adaptability	senior	medium	How do you adapt when business priorities change mid-quarter?	2026-02-09 07:22:42.788285+00	\N
4d3119a0-2f51-40cc-9cf4-4a36d285b1c6	behavioral	adaptability	senior	medium	Describe a time you adjusted strategy due to market changes.	2026-02-09 07:22:42.788285+00	\N
056adfe1-1143-4762-b2a3-5def12396469	behavioral	adaptability	senior	medium	How do you handle changes driven by senior leadership decisions?	2026-02-09 07:22:42.788285+00	\N
3ee9646d-1a4e-4d19-807f-79c7fc50ea95	behavioral	adaptability	senior	medium	Tell me about a time you adapted to new performance expectations.	2026-02-09 07:22:42.788285+00	\N
1e5fe3cc-cc9b-42c3-831b-cd76c4ba3493	behavioral	adaptability	senior	medium	How do you adapt your leadership style during organizational change?	2026-02-09 07:22:42.788285+00	\N
57c6b81b-7fca-4e13-b600-98325b468bd2	behavioral	adaptability	senior	medium	Describe a situation where you had to adapt without full information.	2026-02-09 07:22:42.788285+00	\N
49efd717-f6eb-47d3-a53b-86498fe776ad	behavioral	adaptability	senior	medium	How do you manage scope changes without impacting delivery?	2026-02-09 07:22:42.788285+00	\N
ebbcd3e7-6a70-49ba-9d24-156f44e65cdd	behavioral	adaptability	senior	medium	Tell me about a time you adapted to a new business model.	2026-02-09 07:22:42.788285+00	\N
ad861079-66b0-437a-9b10-e9fe17106db4	behavioral	adaptability	senior	medium	How do you adapt when customer expectations evolve?	2026-02-09 07:22:42.788285+00	\N
2490dd54-a024-4e85-a963-cd4d16fdf965	behavioral	adaptability	senior	medium	Describe a time you had to unlearn an old approach.	2026-02-09 07:22:42.788285+00	\N
9be64c04-de17-4980-b687-d9fb69618f89	behavioral	adaptability	senior	medium	How do you adapt during cross-functional collaboration challenges?	2026-02-09 07:22:42.788285+00	\N
7db23b66-6e5b-4331-95e2-d42c7ec8b9ba	behavioral	adaptability	senior	medium	Describe a time you adapted to a new technology implementation.	2026-02-09 07:22:42.788285+00	\N
abde3d7a-189b-4d78-a71f-87dfb4adc039	behavioral	adaptability	senior	medium	How do you adapt plans when execution risks increase?	2026-02-09 07:22:42.788285+00	\N
5d9210e7-a668-451a-a6ef-d34742f67968	behavioral	adaptability	senior	medium	Tell me about a time you adapted to cultural differences in teams.	2026-02-09 07:22:42.788285+00	\N
e42d9d2f-09e5-4149-b196-c8b0e10f7518	behavioral	adaptability	senior	medium	How do you adapt when timelines are compressed unexpectedly?	2026-02-09 07:22:42.788285+00	\N
71ca5ed2-12cd-4c6d-9ac9-fe1ea31bc61b	behavioral	adaptability	senior	medium	Describe a time you adapted to shifting stakeholder priorities.	2026-02-09 07:22:42.788285+00	\N
6f591d75-9a96-4742-af20-c110c4bbe2d8	behavioral	adaptability	senior	medium	How do you adapt during organizational restructuring?	2026-02-09 07:22:42.788285+00	\N
53c13207-06bf-4c81-8d4d-e3aa44eee57d	behavioral	adaptability	senior	medium	Tell me about a time adaptability helped you prevent failure.	2026-02-09 07:22:42.788285+00	\N
da8e1dbc-60db-4a38-9af9-a0f4e590d63b	behavioral	adaptability	senior	medium	How do you adapt your decision-making style during uncertainty?	2026-02-09 07:22:42.788285+00	\N
3d77af5b-c1d5-4874-b41e-c7a591366954	behavioral	adaptability	senior	medium	Why is adaptability essential at the senior stage of your career?	2026-02-09 07:22:42.788285+00	\N
942580f8-d93c-4c7f-ba67-c72aa3b03523	behavioral	adaptability	senior	high	Describe a situation where you initially resisted change but later adapted successfully.	2026-02-09 07:22:42.788285+00	\N
3f763702-9b21-4404-bff3-54e3fc5749fc	behavioral	adaptability	senior	high	How do you handle last-minute changes in high-stakes situations?	2026-02-09 07:22:42.788285+00	\N
90b97164-c7b0-4f32-a471-26358f96f306	behavioral	adaptability	senior	high	Tell me about a time you had to learn rapidly to keep up with evolving expectations.	2026-02-09 07:22:42.788285+00	\N
46999f96-7d06-4889-b3fc-7f54b7b28fcf	behavioral	adaptability	senior	high	How do you adapt when facing uncertainty or incomplete information?	2026-02-09 07:22:42.788285+00	\N
616971c6-55ea-4288-9a6d-1b254ef99247	behavioral	adaptability	senior	high	Why is adaptability critical at the senior stage of your career?	2026-02-09 07:22:42.788285+00	\N
ecada831-8cb4-4a8b-b8e5-021b38582295	behavioral	adaptability	senior	high	Describe a situation where rapid business change forced you to rethink your strategy.	2026-02-09 07:22:42.788285+00	\N
d1314ee8-3bc2-4e20-9adb-b0d4afe856c2	behavioral	adaptability	senior	high	Tell me about a time you had to adapt leadership style during organizational uncertainty.	2026-02-09 07:22:42.788285+00	\N
f719fa9a-6882-4cae-b12c-5ebc8778349d	behavioral	adaptability	senior	high	Describe how you adapted when a long-term plan suddenly became irrelevant.	2026-02-09 07:22:42.788285+00	\N
5eb2de00-3c05-40f6-a445-9acb7dd08785	behavioral	adaptability	senior	high	How have you handled resistance from teams during major change initiatives?	2026-02-09 07:22:42.788285+00	\N
37e041b1-177b-4ab5-a3ad-7ec2147c05ba	behavioral	adaptability	senior	high	Describe a time you had to adapt with incomplete or conflicting information.	2026-02-09 07:22:42.788285+00	\N
2a30d7d1-bd30-4dd8-9345-3c13d937b5d6	behavioral	adaptability	senior	high	Tell me about a situation where external market forces required rapid adaptation.	2026-02-09 07:22:42.788285+00	\N
d2b2635f-a99e-427e-a412-6f649dbe45de	behavioral	adaptability	senior	high	How do you adapt decision-making speed during crisis situations?	2026-02-09 07:22:42.788285+00	\N
bed291c3-5a09-4606-a9bc-4d9f46b11b54	behavioral	adaptability	senior	high	Describe a time when adapting quickly helped prevent a major failure.	2026-02-09 07:22:42.788285+00	\N
6937e588-5b7b-4ac0-a56c-cfed4be803af	behavioral	adaptability	senior	high	How do you balance adaptability with organizational stability?	2026-02-09 07:22:42.788285+00	\N
d93220d3-e991-4d55-b5ba-906535ab86d7	behavioral	adaptability	senior	high	Describe a time you adapted goals due to shifting leadership priorities.	2026-02-09 07:22:42.788285+00	\N
8d7daf8e-514d-4b82-8208-09afd7c749d5	behavioral	adaptability	senior	high	Tell me about adapting to cultural differences in senior roles.	2026-02-09 07:22:42.788285+00	\N
4cb63cec-7cd7-4651-96f3-9adb8df782c8	behavioral	adaptability	senior	high	Describe a time you had to abandon a successful approach due to change.	2026-02-09 07:22:42.788285+00	\N
2cb8523b-12ed-431e-880b-f6f73ca7d6f8	behavioral	adaptability	senior	high	How do you adapt when multiple changes occur simultaneously?	2026-02-09 07:22:42.788285+00	\N
d842056e-6e15-42d7-b711-97416c2d8e71	behavioral	adaptability	senior	high	Tell me about adapting strategy during long-term uncertainty.	2026-02-09 07:22:42.788285+00	\N
90b08fec-29b4-4212-876f-d33d2cca23ca	behavioral	adaptability	senior	high	Describe a time you adapted after receiving difficult feedback.	2026-02-09 07:22:42.788285+00	\N
ffe9535b-7897-4d30-a5ae-aa601770c5e6	behavioral	adaptability	senior	high	How do you adapt while leading teams through uncertainty?	2026-02-09 07:22:42.788285+00	\N
d6a9e716-1eba-429b-b333-6e05cd828ab2	behavioral	adaptability	senior	high	Describe a time you had to pivot mid-execution.	2026-02-09 07:22:42.788285+00	\N
e364c14a-dd19-4c4d-b9d7-75dc9f08d480	behavioral	adaptability	senior	high	How do you adapt leadership decisions under pressure?	2026-02-09 07:22:42.788285+00	\N
6ffeea2c-59b4-4c76-ae4e-d0dd299c67c4	behavioral	adaptability	senior	high	Tell me about adapting when organizational values were tested.	2026-02-09 07:22:42.788285+00	\N
02f29c19-663e-47d4-ae26-480f16bad2c9	behavioral	adaptability	senior	high	Why is adaptability a defining competency for senior professionals?	2026-02-09 07:22:42.788285+00	\N
3fdc190b-94a2-402e-ba2e-9cfe3955f8eb	behavioral	resilience	leadership	low	What does resilience mean to you as a senior leader?	2026-02-09 07:25:32.430679+00	\N
29e89099-90a4-41e0-a91b-1c940d4a4ea5	behavioral	resilience	leadership	low	How do you personally stay resilient during high-pressure roles?	2026-02-09 07:25:32.430679+00	\N
4625f5d5-7b18-4f94-be4f-3ac886977c15	behavioral	resilience	leadership	low	How do you respond to setbacks at an organizational level?	2026-02-09 07:25:32.430679+00	\N
9d353a3e-a5ad-4cd1-aa9d-5ed138277196	behavioral	resilience	leadership	low	How do you maintain consistency during extended periods of uncertainty?	2026-02-09 07:25:32.430679+00	\N
88ebac02-3431-4a85-ad36-4902126a4fa4	behavioral	resilience	leadership	low	How do you react to feedback at an executive level?	2026-02-09 07:25:32.430679+00	\N
a5959d19-297d-4c13-ad26-8fd85840eaf9	behavioral	resilience	leadership	low	What does resilience mean to you at this stage of your career?	2026-02-09 07:25:32.430679+00	\N
75a05aff-83d1-49df-8ac0-69c7f6ea4a24	behavioral	resilience	leadership	low	How do you stay calm during everyday work pressures?	2026-02-09 07:25:32.430679+00	\N
1ee0038e-4d96-4b32-9fde-927c8dce9c59	behavioral	resilience	leadership	low	How do you handle routine setbacks at work?	2026-02-09 07:25:32.430679+00	\N
8e18cdc2-a695-48ae-934a-9ebba3de8046	behavioral	resilience	leadership	low	How do you maintain motivation during long-term responsibilities?	2026-02-09 07:25:32.430679+00	\N
5fe599b8-641c-414d-8950-025b42f74066	behavioral	resilience	leadership	low	How do you manage stress built up over years of work?	2026-02-09 07:25:32.430679+00	\N
c423bf25-8d41-4e33-9059-92788e273f14	behavioral	resilience	leadership	low	How do you respond to minor failures at a senior level?	2026-02-09 07:25:32.430679+00	\N
37c5aa05-9069-4e14-a105-0aaf2624154c	behavioral	resilience	leadership	low	How do you maintain focus during repetitive challenges?	2026-02-09 07:25:32.430679+00	\N
01c25a4c-d2df-4211-a0b7-0c4d2d905dfb	behavioral	resilience	leadership	low	How do you keep resilience strong during long projects?	2026-02-09 07:25:32.430679+00	\N
e83d1695-9a07-4ff0-9f75-c11d7ae51ca4	behavioral	resilience	leadership	low	How do you react when plans do not work as expected?	2026-02-09 07:25:32.430679+00	\N
699d125c-2934-46e9-9357-fa46f5ae600b	behavioral	resilience	leadership	low	How do you remain resilient during routine organizational changes?	2026-02-09 07:25:32.430679+00	\N
8c56da43-faf9-4b67-aa65-1f6cdc4c6281	behavioral	resilience	leadership	low	How do you manage emotional reactions at work?	2026-02-09 07:25:32.430679+00	\N
98160037-9e2c-42fc-a071-a6a6903370ef	behavioral	resilience	leadership	low	How do you stay consistent despite daily challenges?	2026-02-09 07:25:32.430679+00	\N
28909491-8757-4f81-8641-ae9458fd4eb2	behavioral	resilience	leadership	low	How do you handle criticism that is minor or routine?	2026-02-09 07:25:32.430679+00	\N
ab37b683-2745-463f-abac-f797ebd21d8d	behavioral	resilience	leadership	low	How do you maintain confidence after small setbacks?	2026-02-09 07:25:32.430679+00	\N
0291074a-2d96-4233-827f-c245724551c6	behavioral	resilience	leadership	low	How do you stay resilient during routine decision-making pressure?	2026-02-09 07:25:32.430679+00	\N
71c24758-c48f-4279-a84f-015ae2a4f37a	behavioral	resilience	leadership	low	How do you sustain energy over long working years?	2026-02-09 07:25:32.430679+00	\N
e88a6ecb-a5a8-43f9-ac9e-ff9ef38be202	behavioral	resilience	leadership	low	How do you stay resilient when progress feels slow?	2026-02-09 07:25:32.430679+00	\N
6d181695-367a-467d-b22c-232df6facec6	behavioral	resilience	leadership	low	How do you manage routine pressure without burnout?	2026-02-09 07:25:32.430679+00	\N
01534360-a7a7-4d50-a1be-43cc26126eea	behavioral	resilience	leadership	low	How do you maintain resilience while supporting others?	2026-02-09 07:25:32.430679+00	\N
b715ceda-3103-46a2-89a1-cbf009716635	behavioral	resilience	leadership	low	Why is resilience still important after many years of experience?	2026-02-09 07:25:32.430679+00	\N
709b561a-6d07-4270-a273-d59bc5425333	behavioral	resilience	leadership	medium	Describe a time you led through sustained organizational pressure.	2026-02-09 07:25:32.430679+00	\N
52b86f45-0753-431d-a35d-923ad71befc5	behavioral	resilience	leadership	medium	How do you recover after a major business failure or loss?	2026-02-09 07:25:32.430679+00	\N
c0f58e61-62e0-4516-8a64-e6d72ca49507	behavioral	resilience	leadership	medium	Tell me about a time resilience directly influenced a major decision.	2026-02-09 07:25:32.430679+00	\N
94cb373e-96c2-464a-afe2-f6a9f2b69a21	behavioral	resilience	leadership	medium	How do you help senior teams remain resilient during change?	2026-02-09 07:25:32.430679+00	\N
22db9889-ce7f-4ee2-af65-571294cc1839	behavioral	resilience	leadership	medium	How do you manage stress during prolonged transformation initiatives?	2026-02-09 07:25:32.430679+00	\N
1dafa5be-a873-4332-858c-fc2a60161908	behavioral	resilience	leadership	medium	How do you stay resilient when long-term goals face delays?	2026-02-09 07:25:32.430679+00	\N
162a06d1-fa2a-46f3-a2e7-d34b7fbc7f09	behavioral	resilience	leadership	medium	Describe a time when plans failed despite preparation.	2026-02-09 07:25:32.430679+00	\N
f61d8f2d-96aa-4212-9be9-674d8f425a2b	behavioral	resilience	leadership	medium	How do you maintain resilience during repeated organizational changes?	2026-02-09 07:25:32.430679+00	\N
816cd2ca-d244-41bb-ba29-5a082d0e0677	behavioral	resilience	leadership	medium	Tell me about a time you had to rebuild confidence after a setback.	2026-02-09 07:25:32.430679+00	\N
3e7c8704-e419-4438-958d-4b21e665ed22	behavioral	resilience	leadership	medium	How do you remain resilient when facing leadership criticism?	2026-02-09 07:25:32.430679+00	\N
8f057854-1f68-4d69-9d62-4a5d862be6ae	behavioral	resilience	leadership	medium	Describe a time when outcomes did not meet expectations.	2026-02-09 07:25:32.430679+00	\N
877c301b-0880-4558-97f7-7fe0f0d408b5	behavioral	resilience	leadership	medium	How do you stay resilient during extended uncertainty?	2026-02-09 07:25:32.430679+00	\N
6045221f-0e11-46cd-b8a5-d4529e5f51ee	behavioral	resilience	leadership	medium	Tell me about a time when pressure impacted team morale.	2026-02-09 07:25:32.430679+00	\N
a05120ab-824e-4df2-b54f-c1b4c372aea1	behavioral	resilience	leadership	medium	How do you recover after losing stakeholder trust?	2026-02-09 07:25:32.430679+00	\N
563197ee-8f32-4ffd-a613-f810512ac332	behavioral	resilience	leadership	medium	Describe a time when resilience helped you sustain performance.	2026-02-09 07:25:32.430679+00	\N
bf780417-9f88-4571-a6f6-f332b9340739	behavioral	resilience	leadership	medium	How do you stay resilient when responsibilities increase suddenly?	2026-02-09 07:25:32.430679+00	\N
baec8de0-b01d-42e2-a32c-d91182380139	behavioral	resilience	leadership	medium	Tell me about a time when you had to restart a stalled initiative.	2026-02-09 07:25:32.430679+00	\N
265280d7-46e9-4c32-afad-497d8515aa1b	behavioral	resilience	leadership	medium	How do you manage emotional strain during setbacks?	2026-02-09 07:25:32.430679+00	\N
29129225-ef70-4bb5-a304-6cffb718e585	behavioral	resilience	leadership	medium	Describe a time you had to persevere without immediate support.	2026-02-09 07:25:32.430679+00	\N
25afa1b9-67ce-4ac2-9ac3-ac3f87b0741a	behavioral	resilience	leadership	medium	How do you handle failure at a strategic level?	2026-02-09 07:25:32.430679+00	\N
bbb88085-65fb-48c1-88a1-0a94eb116f53	behavioral	resilience	leadership	medium	Tell me about a time you sustained resilience during slow progress.	2026-02-09 07:25:32.430679+00	\N
28f1b3f4-650d-4240-a56e-4a706119c0ad	behavioral	resilience	leadership	medium	How do you remain resilient when outcomes are uncertain?	2026-02-09 07:25:32.430679+00	\N
280c4f4d-f1d1-4098-9799-23bc317290ff	behavioral	resilience	leadership	medium	Describe a time resilience influenced leadership decisions.	2026-02-09 07:25:32.430679+00	\N
134c9c24-d2cc-4a55-8651-ff1b57311b09	behavioral	resilience	leadership	medium	How do you sustain resilience during high accountability roles?	2026-02-09 07:25:32.430679+00	\N
bd6408a5-8a01-4065-94b5-24aed3dbe0e7	behavioral	resilience	leadership	medium	Why is resilience essential at an executive level?	2026-02-09 07:25:32.430679+00	\N
e9e36124-a90d-4cd8-a331-942e72cb780c	behavioral	resilience	leadership	high	Describe a crisis that tested your leadership resilience.	2026-02-09 07:25:32.430679+00	\N
2cef1d83-5eb0-41f5-b15d-a4c240524028	behavioral	resilience	leadership	high	How do you remain resilient during prolonged uncertainty or market volatility?	2026-02-09 07:25:32.430679+00	\N
539893b1-05b8-4cee-b1da-96d090d21da9	behavioral	resilience	leadership	high	Tell me about a time you faced burnout at scale and still delivered results.	2026-02-09 07:25:32.430679+00	\N
b9a4acde-6582-4346-bc53-cd89fb579a67	behavioral	resilience	leadership	high	How do you sustain resilience after repeated failures or downturns?	2026-02-09 07:25:32.430679+00	\N
00e680e5-5f29-477b-bdcb-2c17581fe1d9	behavioral	resilience	leadership	high	Why is resilience a defining trait for executive leadership?	2026-02-09 07:25:32.430679+00	\N
a7589958-f174-4876-a9b6-232970be046f	behavioral	resilience	leadership	high	Describe a time when prolonged uncertainty tested your leadership resilience.	2026-02-09 07:25:32.430679+00	\N
9f145341-ec1c-469c-8adb-1e034cb27fb7	behavioral	resilience	leadership	high	Tell me about a high-stakes failure that required sustained resilience.	2026-02-09 07:25:32.430679+00	\N
2985cbeb-12cf-4ec8-92f0-4136d34bd2f7	behavioral	resilience	leadership	high	How did you remain resilient while leading through organizational restructuring?	2026-02-09 07:25:32.430679+00	\N
fb15e6d1-00ac-4f25-b422-d619f2a10468	behavioral	resilience	leadership	high	Describe a time when repeated setbacks challenged your confidence.	2026-02-09 07:25:32.430679+00	\N
ca67addf-ecab-4f8e-b679-fc40e9e05ab0	behavioral	resilience	leadership	high	How do you sustain resilience when outcomes are delayed for long periods?	2026-02-09 07:25:32.430679+00	\N
6bb2d8fe-31bd-4368-9e70-c728268b4f15	behavioral	resilience	leadership	high	Tell me about a crisis where emotional resilience was as important as strategy.	2026-02-09 07:25:32.430679+00	\N
e04619f4-c380-429e-b7de-41838cf67279	behavioral	resilience	leadership	high	Describe how you handled burnout across senior leadership layers.	2026-02-09 07:25:32.430679+00	\N
afec938d-57bb-4cb6-aa58-d77eadd22656	behavioral	resilience	leadership	high	How do you maintain resilience after public or visible failures?	2026-02-09 07:25:32.430679+00	\N
6f3a80bc-7005-4044-9139-155ac525eee5	behavioral	resilience	leadership	high	Tell me about a time resilience influenced a tough people decision.	2026-02-09 07:25:32.430679+00	\N
1d80f884-3f55-4b8c-b6f8-b87c8be0db25	behavioral	resilience	leadership	high	How do you remain resilient during long-term transformation programs?	2026-02-09 07:25:32.430679+00	\N
fb83a7c9-17bf-44ef-b52f-3dc03f14535a	behavioral	resilience	leadership	high	Describe a time when resilience helped you protect organizational culture.	2026-02-09 07:25:32.430679+00	\N
26ca6e99-0f40-4b1e-882e-309144df01d2	behavioral	resilience	leadership	high	How do you stay resilient when facing resistance from senior stakeholders?	2026-02-09 07:25:32.430679+00	\N
6ab78544-4402-4985-9839-29a9c6858d7e	behavioral	resilience	leadership	high	Tell me about a time you had to reset strategy after failure.	2026-02-09 07:25:32.430679+00	\N
224fc7fd-ca7c-44e3-87c6-3db36419cf9c	behavioral	resilience	leadership	high	How do you maintain resilience under continuous executive pressure?	2026-02-09 07:25:32.430679+00	\N
38d276e0-950a-45d3-9ddc-1fc1d1a90ad6	behavioral	resilience	leadership	high	Describe a time when resilience helped you lead through ambiguity.	2026-02-09 07:25:32.430679+00	\N
67da4cdd-4414-452b-b1ac-dbf8f8887d72	behavioral	resilience	leadership	high	How do you sustain resilience while making unpopular decisions?	2026-02-09 07:25:32.430679+00	\N
38062bd9-27fa-4ba3-bc2c-94a4231cd06c	behavioral	resilience	leadership	high	Tell me about a time resilience prevented reactive leadership.	2026-02-09 07:25:32.430679+00	\N
aa4311c2-98e5-4abb-a25e-7c3538887467	behavioral	resilience	leadership	high	How do you rebuild resilience after organizational losses?	2026-02-09 07:25:32.430679+00	\N
89677a34-db12-43c6-bbfa-b2b7cd7a9a71	behavioral	resilience	leadership	high	Describe a situation where resilience guided ethical leadership.	2026-02-09 07:25:32.430679+00	\N
c7a5acee-349e-4bfc-9dac-b3bca1cd1f39	behavioral	resilience	leadership	high	Why is resilience non-negotiable at the executive level?	2026-02-09 07:25:32.430679+00	\N
16f508f0-b918-4e7b-a6af-1b4b8a85380e	behavioral	communication	leadership	low	How do you define effective communication as a senior leader?	2026-02-09 07:27:53.006422+00	\N
bbe5239a-2c9c-4782-b828-a1eeaedd7a10	behavioral	communication	leadership	low	How do you ensure clarity when communicating strategic direction?	2026-02-09 07:27:53.006422+00	\N
818888df-206f-46b3-b2c7-83c8405f8f95	behavioral	communication	leadership	low	Describe your communication style with leadership teams?	2026-02-09 07:27:53.006422+00	\N
9c106a8e-b09d-48ed-a1de-0cc4e8eb624a	behavioral	communication	leadership	low	How do you listen during executive-level discussions?	2026-02-09 07:27:53.006422+00	\N
62f88b85-0ce2-451c-919e-0e2b6480594b	behavioral	communication	leadership	low	How do you communicate expectations to senior leaders?	2026-02-09 07:27:53.006422+00	\N
2726f3c4-1631-440f-b72f-0d6cb29ca24a	behavioral	communication	leadership	low	Why is communication important in senior leadership roles?	2026-02-09 07:27:53.006422+00	\N
15ebc8b6-720a-4b92-afa2-433ebcae8099	behavioral	communication	leadership	low	How do you usually communicate organizational goals?	2026-02-09 07:27:53.006422+00	\N
1de63410-3f39-4f5b-9baf-c930ce542eab	behavioral	communication	leadership	low	How do you ensure your messages are understood clearly?	2026-02-09 07:27:53.006422+00	\N
442a3a28-475b-4666-bc24-fae1e819dcd1	behavioral	communication	leadership	low	How do you usually communicate with cross-functional teams?	2026-02-09 07:27:53.006422+00	\N
0bf6564a-cc03-47a9-b982-639e83a5b8e8	behavioral	communication	leadership	low	How do you communicate expectations to teams?	2026-02-09 07:27:53.006422+00	\N
ccdf3ea1-4c04-44ca-81f5-152cd9ac6c75	behavioral	communication	leadership	low	Describe how you share updates with senior stakeholders.	2026-02-09 07:27:53.006422+00	\N
9179710c-5cf9-4952-aeb6-14163859d566	behavioral	communication	leadership	low	How do you adapt communication for different audiences?	2026-02-09 07:27:53.006422+00	\N
51c1b48d-b223-4730-b35c-5e3d0643c6ae	behavioral	communication	leadership	low	How do you encourage open communication in teams?	2026-02-09 07:27:53.006422+00	\N
faa383bf-256e-4501-b038-05fff925c5d2	behavioral	communication	leadership	low	How do you handle routine communication with leadership peers?	2026-02-09 07:27:53.006422+00	\N
1ebecbb1-acd3-4651-9f5f-31440f24fb9e	behavioral	communication	leadership	low	How do you ensure consistency in communication?	2026-02-09 07:27:53.006422+00	\N
da69955b-e14e-486f-bbb0-ace7715db1dd	behavioral	communication	leadership	low	How do you communicate progress on initiatives?	2026-02-09 07:27:53.006422+00	\N
9b3568d5-f4bb-48cd-af6c-8d5d7f9e3d45	behavioral	communication	leadership	low	How do you listen during leadership discussions?	2026-02-09 07:27:53.006422+00	\N
29b5c8c5-7068-46d7-8c92-8868961c03b0	behavioral	communication	leadership	low	How do you communicate priorities during planning cycles?	2026-02-09 07:27:53.006422+00	\N
737ca49c-2c07-416a-8aa1-a37befc04a66	behavioral	communication	leadership	low	How do you ensure transparency in daily communication?	2026-02-09 07:27:53.006422+00	\N
a56931a4-b4cd-4fb3-ac16-e55ae902c397	behavioral	communication	leadership	low	How do you communicate decisions clearly?	2026-02-09 07:27:53.006422+00	\N
81b698f1-5953-4445-b6aa-edfa1c890c77	behavioral	communication	leadership	low	How do you reinforce key messages over time?	2026-02-09 07:27:53.006422+00	\N
d355ce42-d672-47b0-8bb2-36a4b123e3c4	behavioral	communication	leadership	low	How do you communicate vision at a high level?	2026-02-09 07:27:53.006422+00	\N
f774a259-ad34-43e2-820a-4d133679e378	behavioral	communication	leadership	low	How do you manage communication during routine operations?	2026-02-09 07:27:53.006422+00	\N
41106e1e-b546-4650-9f8a-a8f067a13ec5	behavioral	communication	leadership	low	How do you communicate accountability within teams?	2026-02-09 07:27:53.006422+00	\N
2334fda3-9021-4a56-98c7-894a4bc73932	behavioral	communication	leadership	low	Why is strong communication essential at an executive level?	2026-02-09 07:27:53.006422+00	\N
faa4207f-81f5-417f-8240-4a1a22eb1d7b	behavioral	communication	leadership	medium	Describe a time you communicated complex change to the organization.	2026-02-09 07:27:53.006422+00	\N
698132dd-18e1-4f8e-a312-0ad5f66b9e02	behavioral	communication	leadership	medium	How do you handle communication gaps between senior teams?	2026-02-09 07:27:53.006422+00	\N
bd222736-fc2a-4342-b3f5-4e71a778ac22	behavioral	communication	leadership	medium	How do you adapt communication for different executive audiences?	2026-02-09 07:27:53.006422+00	\N
d6c2da30-83a0-4cb9-aa9b-dc3893c37211	behavioral	communication	leadership	medium	Describe a time your communication prevented a major risk.	2026-02-09 07:27:53.006422+00	\N
9fd613b7-fc34-41f4-b416-7ac8264c2a7f	behavioral	communication	leadership	medium	How do you ensure transparency during uncertainty?	2026-02-09 07:27:53.006422+00	\N
82170a71-7d6a-4dee-b07a-cc03bedc6e80	behavioral	communication	leadership	medium	How do you ensure your message is understood across different leadership levels?	2026-02-09 07:27:53.006422+00	\N
3929815f-0a7a-4a12-accd-f88efdef5c42	behavioral	communication	leadership	medium	Describe a time you had to influence a decision through communication.	2026-02-09 07:27:53.006422+00	\N
7cc1f620-185f-482e-b2d2-6a5b6ae4e92f	behavioral	communication	leadership	medium	How do you manage communication during organizational ambiguity?	2026-02-09 07:27:53.006422+00	\N
d3ee5f93-0c06-443d-99c4-32df2301ae94	behavioral	communication	leadership	medium	Describe how you communicate priorities during competing demands.	2026-02-09 07:27:53.006422+00	\N
cdec752a-bced-42bc-a709-0a98bbe67cb7	behavioral	communication	leadership	medium	How do you ensure alignment after key leadership meetings?	2026-02-09 07:27:53.006422+00	\N
86d8e33e-e095-46b4-baee-4d530cea6fec	behavioral	communication	leadership	medium	Describe a time you had to simplify complex information.	2026-02-09 07:27:53.006422+00	\N
5bd3df4d-4b82-45fc-ac5a-8e4300700367	behavioral	communication	leadership	medium	How do you communicate when opinions differ strongly?	2026-02-09 07:27:53.006422+00	\N
a38a8286-e6ca-48cd-bdf6-d6d615e12c6f	behavioral	communication	leadership	medium	Describe a situation where communication helped accelerate execution.	2026-02-09 07:27:53.006422+00	\N
0e13eec5-200e-49fc-9fde-eaf13a9be8ec	behavioral	communication	leadership	medium	How do you communicate risks without creating panic?	2026-02-09 07:27:53.006422+00	\N
66ba4cc4-f415-4fd3-92b1-e8160c9866f2	behavioral	communication	leadership	medium	Describe how you handle sensitive conversations with senior stakeholders.	2026-02-09 07:27:53.006422+00	\N
f544c8d7-6164-453f-ad72-1e49311ef611	behavioral	communication	leadership	medium	How do you maintain consistency in messaging across teams?	2026-02-09 07:27:53.006422+00	\N
2760bfc6-8119-4cdc-9129-2d96ce31fe57	behavioral	communication	leadership	medium	Describe a time communication helped resolve resistance.	2026-02-09 07:27:53.006422+00	\N
51b07776-41e7-4cc7-af10-959b16581cea	behavioral	communication	leadership	medium	How do you communicate expectations during transformation initiatives?	2026-02-09 07:27:53.006422+00	\N
dcb9a323-09dd-4197-ae89-c9e18ffd4c5d	behavioral	communication	leadership	medium	Describe how you balance transparency with confidentiality.	2026-02-09 07:27:53.006422+00	\N
eed361eb-a054-4c95-963b-3d42aab29e64	behavioral	communication	leadership	medium	How do you adapt communication during organizational restructuring?	2026-02-09 07:27:53.006422+00	\N
898b5705-917f-46af-9709-5f98f2860236	behavioral	communication	leadership	medium	Describe a time communication improved cross-functional collaboration.	2026-02-09 07:27:53.006422+00	\N
1c071cab-1276-42f3-a4b0-37d953a3c652	behavioral	communication	leadership	medium	How do you ensure follow-through after critical communications?	2026-02-09 07:27:53.006422+00	\N
b26dddf2-c13d-49fb-a68b-a4b35dea691b	behavioral	communication	leadership	medium	Describe how communication supports leadership credibility.	2026-02-09 07:27:53.006422+00	\N
929b436b-6ac5-421e-874b-65b3004b2c13	behavioral	communication	leadership	medium	How do you communicate strategic priorities during market uncertainty?	2026-02-09 07:27:53.006422+00	\N
1bfe0c20-45d0-46f2-bde2-a62ff6cfa5f9	behavioral	communication	leadership	medium	Why is communication a critical capability at the executive level?	2026-02-09 07:27:53.006422+00	\N
aa3c31dc-0bab-48e7-86cd-5766e6c57433	behavioral	communication	leadership	high	Describe a situation where communication failure impacted the business. How did you recover?	2026-02-09 07:27:53.006422+00	\N
04468b27-ca43-4f5f-a5e3-f9a8b1335dc4	behavioral	communication	leadership	high	How do you ensure consistency when multiple leaders communicate externally?	2026-02-09 07:27:53.006422+00	\N
b59e81d3-4742-4942-b264-1cc1c656c2a0	behavioral	communication	leadership	high	How do you communicate effectively during crises or high-stakes situations?	2026-02-09 07:27:53.006422+00	\N
89772d93-35ac-410c-a7c7-4a8f07abf362	behavioral	communication	leadership	high	Tell me about a time you delivered difficult or unpopular decisions.	2026-02-09 07:27:53.006422+00	\N
dd08ba04-621b-458b-81b5-fa434ea73ab9	behavioral	communication	leadership	high	How do you manage communication when executives strongly disagree?	2026-02-09 07:27:53.006422+00	\N
392d3639-74c8-445c-9527-9bdba30b04bb	behavioral	communication	leadership	high	Why is communication a defining capability for executive leadership?	2026-02-09 07:27:53.006422+00	\N
3e97c98e-8c70-490b-92d1-299bd84424c8	behavioral	communication	leadership	high	Describe a situation where miscommunication at the leadership level caused business impact. How did you address it?	2026-02-09 07:27:53.006422+00	\N
3786f206-996f-4055-a8fa-37bb861202a2	behavioral	communication	leadership	high	How do you communicate difficult trade-offs to executives when no option is ideal?	2026-02-09 07:27:53.006422+00	\N
142bd370-e9dc-4210-af46-e0b6e87c82bd	behavioral	communication	leadership	high	Tell me about a time you had to challenge senior leadership respectfully.	2026-02-09 07:27:53.006422+00	\N
b394780f-97c7-4f99-82cd-fd35901a23db	behavioral	communication	leadership	high	How do you communicate when strategic direction keeps changing?	2026-02-09 07:27:53.006422+00	\N
1b967577-3946-4832-accf-69194bdcdaa8	behavioral	communication	leadership	high	Describe a time when communication failure caused reputational risk.	2026-02-09 07:27:53.006422+00	\N
730d1cde-6a60-45d1-bbe8-ebead96a4517	behavioral	communication	leadership	high	How do you handle communication when data conflicts with executive intuition?	2026-02-09 07:27:53.006422+00	\N
71e4add6-f0a1-4412-afa4-db5e47333ee4	behavioral	communication	leadership	high	Tell me about a time you had to communicate failure to the board.	2026-02-09 07:27:53.006422+00	\N
c2bcefa4-eb23-4171-8da2-bfb978fac8f5	behavioral	communication	leadership	high	How do you manage communication across cultures at an executive level?	2026-02-09 07:27:53.006422+00	\N
e1a94797-c6da-4e4d-9a59-b96e57f31d9b	behavioral	communication	leadership	high	Describe a time when silence was more effective than speaking.	2026-02-09 07:27:53.006422+00	\N
9d84908a-ea59-4afa-be8e-ca9c69e24ef3	behavioral	communication	leadership	high	How do you communicate accountability without demotivating senior leaders?	2026-02-09 07:27:53.006422+00	\N
7a413352-a42b-4b50-8556-2e6c6d5b3ed2	behavioral	communication	leadership	high	Describe a time when communication overload reduced effectiveness. How did you fix it?	2026-02-09 07:27:53.006422+00	\N
950f60c0-064d-4235-be61-23687a085399	behavioral	communication	leadership	high	How do you communicate uncertainty without creating panic?	2026-02-09 07:27:53.006422+00	\N
659e1301-3da5-4f90-b81d-dd895d236eca	behavioral	communication	leadership	high	Tell me about a time you had to de-escalate a conflict through communication.	2026-02-09 07:27:53.006422+00	\N
a8126eda-7592-4345-bacb-db4c9c0051f5	behavioral	communication	leadership	high	How do you communicate when you disagree with board directives?	2026-02-09 07:27:53.006422+00	\N
af140387-e262-4e97-af42-a738e63894a1	behavioral	communication	leadership	high	Describe a time when communication directly influenced organizational culture.	2026-02-09 07:27:53.006422+00	\N
0bad88b9-f451-44d1-b5d0-543ebea29798	behavioral	communication	leadership	high	How do you communicate when decisions are unpopular but necessary?	2026-02-09 07:27:53.006422+00	\N
e54bf21e-1332-4177-9ab8-3e059bb31ce5	behavioral	communication	leadership	high	Tell me about a time when indirect communication caused failure.	2026-02-09 07:27:53.006422+00	\N
dea107e8-6c73-4d39-89da-cb75807e9139	behavioral	communication	leadership	high	Describe a time communication saved a failing initiative.	2026-02-09 07:27:53.006422+00	\N
09dfabb1-4af1-4172-9d20-4806eda2d5de	behavioral	communication	leadership	high	Why is communication mastery critical for executive leadership?	2026-02-09 07:27:53.006422+00	\N
012f5ba0-10ed-4e5c-a73c-4e55c666306c	behavioral	adaptability	leadership	low	What does adaptability mean to you as an executive leader?	2026-02-09 07:29:22.547066+00	\N
ae1be038-9627-417c-bf10-c474f46e6019	behavioral	adaptability	leadership	low	How do you react when organizational priorities shift unexpectedly?	2026-02-09 07:29:22.547066+00	\N
16e2ff39-6507-4ff8-8454-b30f3e5a5ac4	behavioral	adaptability	leadership	low	How comfortable are you leading change initiatives?	2026-02-09 07:29:22.547066+00	\N
5d5de527-c086-4fc5-a7c5-c17d2dfffa2c	behavioral	adaptability	leadership	low	How do you handle changes in market or customer expectations?	2026-02-09 07:29:22.547066+00	\N
5422101c-a824-466e-99ac-7d579f782de0	behavioral	adaptability	leadership	low	How do you balance adaptability with operational stability?	2026-02-09 07:29:22.547066+00	\N
08d3d60d-ce33-44a3-b022-b4d2bd1da97d	behavioral	adaptability	leadership	low	What does adaptability mean to you at an executive level?	2026-02-09 07:29:22.547066+00	\N
e8258800-d36d-458e-aa07-6cddda6d7299	behavioral	adaptability	leadership	low	How do you generally respond to change in your organization?	2026-02-09 07:29:22.547066+00	\N
e377cfb3-ee0e-4900-b1a4-979480b06906	behavioral	adaptability	leadership	low	How comfortable are you adapting your leadership style when needed?	2026-02-09 07:29:22.547066+00	\N
90c29d14-d18a-409e-be05-bb49848fc7ac	behavioral	adaptability	leadership	low	How do you adapt when business priorities change?	2026-02-09 07:29:22.547066+00	\N
686d6bd8-8105-4673-a003-69635ce5a3bc	behavioral	adaptability	leadership	low	How do you stay flexible without compromising results?	2026-02-09 07:29:22.547066+00	\N
accc571e-1bbc-43c2-b80b-63384c86fff6	behavioral	adaptability	leadership	low	Describe how you adapt to new organizational structures.	2026-02-09 07:29:22.547066+00	\N
287afc6c-2b78-41ac-a599-ea608e012407	behavioral	adaptability	leadership	low	How do you handle changes in leadership above you?	2026-02-09 07:29:22.547066+00	\N
d3a444de-7af9-4f56-840b-ecd155d4aef7	behavioral	adaptability	leadership	low	How do you adapt when market conditions shift?	2026-02-09 07:29:22.547066+00	\N
f2b5e9ae-6b4a-4ab7-9e4d-0eec32267095	behavioral	adaptability	leadership	low	How do you approach learning new business models or practices?	2026-02-09 07:29:22.547066+00	\N
65b40564-8ce3-4560-bc2e-6a7e78a34063	behavioral	adaptability	leadership	low	How do you adapt when customer expectations evolve?	2026-02-09 07:29:22.547066+00	\N
7b5ba1ee-0214-4b6c-b3af-e3d616ed7208	behavioral	adaptability	leadership	low	How do you handle gradual changes versus sudden changes?	2026-02-09 07:29:22.547066+00	\N
2ed3f2f7-2945-4f5b-a91c-f48380a4ef16	behavioral	adaptability	leadership	low	How do you adapt your decision-making when information changes?	2026-02-09 07:29:22.547066+00	\N
5956e4f1-e517-4d38-922e-a2548ea27930	behavioral	adaptability	leadership	low	How do you ensure adaptability within your teams?	2026-02-09 07:29:22.547066+00	\N
09d3d6e6-f1d5-46a4-9797-4810e3bdd55d	behavioral	adaptability	leadership	low	How do you respond when long-standing processes need change?	2026-02-09 07:29:22.547066+00	\N
ddfb3463-b8f8-4d8d-bd4d-0e97e7efd7f9	behavioral	adaptability	leadership	low	How do you adapt communication during change initiatives?	2026-02-09 07:29:22.547066+00	\N
95b43273-b3ac-43d3-b06b-b67a3838e732	behavioral	adaptability	leadership	low	How do you stay open to new ideas at a senior level?	2026-02-09 07:29:22.547066+00	\N
2a94e9cb-92e6-43d7-adb7-8ea306e7a862	behavioral	adaptability	leadership	low	How do you adapt when working with younger or more diverse teams?	2026-02-09 07:29:22.547066+00	\N
93fafc06-403c-4657-8e93-3b0aaf8a9a18	behavioral	adaptability	leadership	low	How do you manage adaptability without causing confusion?	2026-02-09 07:29:22.547066+00	\N
b3aaf232-afc3-4ba7-851f-7a41f4367858	behavioral	adaptability	leadership	low	How do you adapt during long-term transformations?	2026-02-09 07:29:22.547066+00	\N
0f71c1da-cd12-43d1-b2dc-b468e0e1ae7a	behavioral	adaptability	leadership	low	Why is adaptability essential for senior leadership today?	2026-02-09 07:29:22.547066+00	\N
c47b3d64-06c4-4e5f-8c38-6d13dc96a340	behavioral	adaptability	leadership	medium	Describe a time you adapted strategy due to major external change.	2026-02-09 07:29:22.547066+00	\N
5a975be7-7367-42d8-be3f-82dd71eb85ae	behavioral	adaptability	leadership	medium	How do you manage frequent change without losing team confidence?	2026-02-09 07:29:22.547066+00	\N
442e347b-6e85-4af1-adab-d1b2ba3b25c6	behavioral	adaptability	leadership	medium	Tell me about a time you had to adapt to new leadership or board expectations.	2026-02-09 07:29:22.547066+00	\N
6e07c3af-4fe6-4d1a-9b4a-37c5fd5a050c	behavioral	adaptability	leadership	medium	How do you adapt your leadership style across different cultures or regions?	2026-02-09 07:29:22.547066+00	\N
00a984a6-826e-420e-b69d-7f6a94d89a80	behavioral	adaptability	leadership	medium	Describe a time you changed direction to protect long-term business value.	2026-02-09 07:29:22.547066+00	\N
456dfd79-8668-41e2-8f74-fc8723b216f5	behavioral	adaptability	leadership	medium	Describe a time you had to adapt strategy due to changing market conditions.	2026-02-09 07:29:22.547066+00	\N
44b7fc36-d0ee-4cf3-a88d-3c3bc056e556	behavioral	adaptability	leadership	medium	How do you adapt when business goals shift mid-cycle?	2026-02-09 07:29:22.547066+00	\N
a6536581-fd15-4a7e-ad31-783185c18783	behavioral	adaptability	leadership	medium	Tell me about a time you had to adapt to regulatory or policy changes.	2026-02-09 07:29:22.547066+00	\N
aebe7298-3a3e-4f53-bd8c-deefd4a45a14	behavioral	adaptability	leadership	medium	How do you adapt leadership approach during organizational restructuring?	2026-02-09 07:29:22.547066+00	\N
1fe776b4-8950-4c65-9835-0ad6ea2e3c71	behavioral	adaptability	leadership	medium	Describe a situation where adaptability helped you manage uncertainty.	2026-02-09 07:29:22.547066+00	\N
64b3a7ed-47e6-405e-916e-3ffd46c1ccee	behavioral	adaptability	leadership	medium	How do you adapt when stakeholder expectations evolve?	2026-02-09 07:29:22.547066+00	\N
5e64d5dc-71cb-43ea-80cb-02801b7620c0	behavioral	adaptability	leadership	medium	Tell me about a time you adapted execution plans to meet constraints.	2026-02-09 07:29:22.547066+00	\N
6e249094-3735-4205-ba4d-bfd1feaefeaa	behavioral	adaptability	leadership	medium	How do you adapt when working across diverse functions?	2026-02-09 07:29:22.547066+00	\N
c75633dc-7419-4256-b8d3-99737332d021	behavioral	adaptability	leadership	medium	Describe a time you adapted to rapid technology changes.	2026-02-09 07:29:22.547066+00	\N
ab43addb-04bb-4bd4-b333-8b3e8434de03	behavioral	adaptability	leadership	medium	How do you adapt decision-making when data is incomplete?	2026-02-09 07:29:22.547066+00	\N
fa8ef59f-c1cf-45ce-8c57-8938af816b96	behavioral	adaptability	leadership	medium	Tell me about a time adaptability improved business outcomes.	2026-02-09 07:29:22.547066+00	\N
71572fcc-efad-471e-b694-79f4f230b5c9	behavioral	adaptability	leadership	medium	How do you adapt communication during periods of change?	2026-02-09 07:29:22.547066+00	\N
fac9b224-84d5-4f64-ae55-97348ef89463	behavioral	adaptability	leadership	medium	Describe a time you adapted priorities to protect business value.	2026-02-09 07:29:22.547066+00	\N
fae79923-0596-44e6-bc2c-3dbaf2371fbd	behavioral	adaptability	leadership	medium	How do you adapt when teams resist change?	2026-02-09 07:29:22.547066+00	\N
9ee4ca96-7052-4919-a084-492a29789d4f	behavioral	adaptability	leadership	medium	Tell me about a time adaptability helped manage risk.	2026-02-09 07:29:22.547066+00	\N
c40b8b46-000a-4c6f-9cbf-29ea6b53c8f4	behavioral	adaptability	leadership	medium	How do you adapt plans when assumptions prove incorrect?	2026-02-09 07:29:22.547066+00	\N
6254f1bc-7389-4da1-a8d0-eba1b7a27b68	behavioral	adaptability	leadership	medium	Describe how adaptability supports leadership credibility.	2026-02-09 07:29:22.547066+00	\N
3e73f09e-e986-41df-8ad8-ceda49331e59	behavioral	adaptability	leadership	medium	How do you adapt when scaling operations or teams?	2026-02-09 07:29:22.547066+00	\N
48f77b1d-f0f4-4019-b5f2-76c2b0938d64	behavioral	adaptability	leadership	medium	Tell me about a time you balanced adaptability with consistency.	2026-02-09 07:29:22.547066+00	\N
60203eeb-c7ba-4cb1-bd6b-65c8194b429b	behavioral	adaptability	leadership	medium	Why is adaptability critical for sustained senior leadership success?	2026-02-09 07:29:22.547066+00	\N
609d7472-1b25-452f-bbf3-f680941d0817	behavioral	adaptability	leadership	high	Describe a situation where initial resistance to change existed and how you adapted.	2026-02-09 07:29:22.547066+00	\N
fc436e86-ee4f-472b-8452-10d2f20966d7	behavioral	adaptability	leadership	high	How do you adapt during prolonged uncertainty or disruption?	2026-02-09 07:29:22.547066+00	\N
533eed5c-3e21-4ac4-920c-0e93dcb51339	behavioral	adaptability	leadership	high	Tell me about a time you led adaptation during a large-scale transformation.	2026-02-09 07:29:22.547066+00	\N
e9da5073-f6ef-4ed8-9afe-648c4ed2f723	behavioral	adaptability	leadership	high	How do you adapt decision-making with incomplete or changing information?	2026-02-09 07:29:22.547066+00	\N
78b07df2-bcb4-4cb8-81ec-ac7d4bf45f12	behavioral	adaptability	leadership	high	Why is adaptability a defining trait for executive leadership?	2026-02-09 07:29:22.547066+00	\N
1f0c1811-00bf-4881-87b3-9ce9c98f7c5f	behavioral	adaptability	leadership	high	Describe a time when a long-term strategy became irrelevant suddenly. How did you adapt?	2026-02-09 07:29:22.547066+00	\N
d828f6f5-b8db-41d7-b4b9-e0791f11bc8c	behavioral	adaptability	leadership	high	How do you adapt when your expertise becomes outdated due to industry change?	2026-02-09 07:29:22.547066+00	\N
f937543a-588f-4ab6-8d89-7e0b4bffca54	behavioral	adaptability	leadership	high	Tell me about a time you had to abandon a successful model to stay competitive.	2026-02-09 07:29:22.547066+00	\N
9c8eb38d-b023-46cf-8d5d-35603ba67095	behavioral	adaptability	leadership	high	How do you adapt leadership style during organizational restructuring?	2026-02-09 07:29:22.547066+00	\N
0ca6e400-1243-46cc-b5d6-54d1d7ebce44	behavioral	adaptability	leadership	high	Describe a situation where adaptability conflicted with operational stability.	2026-02-09 07:29:22.547066+00	\N
28adc4a0-a5f7-446c-a4e6-1efb5b3e8eda	behavioral	adaptability	leadership	high	How do you adapt decision-making speed in volatile environments?	2026-02-09 07:29:22.547066+00	\N
f08704c5-d362-4993-85b5-b0324f6379c7	behavioral	adaptability	leadership	high	Tell me about a time you adapted strategy due to regulatory change.	2026-02-09 07:29:22.547066+00	\N
995c4d5d-5da7-4c83-8ec9-33b728ebfb1b	behavioral	adaptability	leadership	high	How do you adapt when stakeholders resist necessary change?	2026-02-09 07:29:22.547066+00	\N
cad9c6d9-8ecb-4199-929e-3c092cfe910d	behavioral	adaptability	leadership	high	Describe a time when global factors forced rapid adaptation.	2026-02-09 07:29:22.547066+00	\N
dfe76871-2c67-4d27-9a7c-8d728f1fc86d	behavioral	adaptability	leadership	high	How do you adapt when data is contradictory or incomplete?	2026-02-09 07:29:22.547066+00	\N
8a06ad1c-e2c8-4c55-abc8-a5f25395f6b6	behavioral	adaptability	leadership	high	Tell me about a time you adapted culture during rapid growth.	2026-02-09 07:29:22.547066+00	\N
20e92e9b-416c-4b76-8513-fc5af2a97639	behavioral	adaptability	leadership	high	How do you adapt priorities during overlapping crises?	2026-02-09 07:29:22.547066+00	\N
d0486c1c-ce2a-4461-9c17-2cd49147e593	behavioral	adaptability	leadership	high	Describe a time you adapted without formal authority.	2026-02-09 07:29:22.547066+00	\N
f6b1f9a0-414b-4d85-bce4-be90856f47f1	behavioral	adaptability	leadership	high	How do you adapt talent strategy during business transformation?	2026-02-09 07:29:22.547066+00	\N
db312ac2-73e2-4c86-b122-12384b4a8d92	behavioral	adaptability	leadership	high	Tell me about a time you adapted metrics to reflect new realities.	2026-02-09 07:29:22.547066+00	\N
3f15d2a1-f0c0-4a38-be23-917fd3c47467	behavioral	adaptability	leadership	high	How do you adapt communication during prolonged uncertainty?	2026-02-09 07:29:22.547066+00	\N
2e3e8834-5fea-4c51-93bd-30b2bd50a094	behavioral	adaptability	leadership	high	Describe a time adaptability prevented organizational decline.	2026-02-09 07:29:22.547066+00	\N
57dbe0c3-a6a9-4c75-9790-fef6736e5a07	behavioral	adaptability	leadership	high	How do you adapt when innovation fails repeatedly?	2026-02-09 07:29:22.547066+00	\N
a931282f-729e-475d-be2f-11dc947b4746	behavioral	adaptability	leadership	high	Tell me about adapting leadership during digital transformation.	2026-02-09 07:29:22.547066+00	\N
17881239-1494-4c05-9d25-5216f66d0fdc	behavioral	adaptability	leadership	high	How do you ensure adaptability does not dilute strategic focus?	2026-02-09 07:29:22.547066+00	\N
252d6c0c-b3fd-4437-b59f-95e60acb8679	psychometric	growth_potential	fresher	low	How do you feel about learning new skills at work?	2026-02-09 07:44:18.868181+00	\N
bc405a66-7083-40a0-8880-06e674a84d55	psychometric	growth_potential	fresher	low	How do you usually respond when you are given a new task?	2026-02-09 07:44:18.868181+00	\N
4ab4a1f7-5083-4f56-a070-25660b3407ea	psychometric	growth_potential	fresher	low	Do you like receiving feedback? Why?	2026-02-09 07:44:18.868181+00	\N
d29f0b2c-4b2b-448b-ab58-662cbec6c983	psychometric	growth_potential	fresher	low	How do you handle topics you do not understand initially?	2026-02-09 07:44:18.868181+00	\N
0cb648b2-37df-497b-939d-74f11a7bf4fa	psychometric	growth_potential	fresher	low	How important is learning for your early career?	2026-02-09 07:44:18.868181+00	\N
4376335d-dcab-4627-9fdf-13ab1e4c5574	psychometric	growth_potential	fresher	low	Describe a situation where you had to learn something completely unfamiliar under time pressure.	2026-02-09 07:44:18.868181+00	\N
55e65d7e-9583-4ce3-9397-13c1d6b15b60	psychometric	growth_potential	fresher	low	How do you react when you realize your existing knowledge is insufficient for a task?	2026-02-09 07:44:18.868181+00	\N
94340b6e-5006-419a-95fb-f808a9251059	psychometric	growth_potential	fresher	low	Tell me about a time you had to unlearn something to learn a better approach.	2026-02-09 07:44:18.868181+00	\N
32a24ecf-1247-42f6-8398-bdeaa0b63e1d	psychometric	growth_potential	fresher	low	How do you handle learning when instructions are unclear or incomplete?	2026-02-09 07:44:18.868181+00	\N
91ddf197-64e5-4b08-8be5-c5935f3f062c	psychometric	growth_potential	fresher	low	Describe a time you failed initially but improved by learning differently.	2026-02-09 07:44:18.868181+00	\N
123b052f-ea85-4100-80f5-bcd4b4ea3588	psychometric	growth_potential	fresher	low	How do you prioritize what to learn when everything feels new?	2026-02-09 07:44:18.868181+00	\N
519f8395-5633-409d-a2fb-c701d030087c	psychometric	growth_potential	fresher	low	Tell me about a time you learned from observing others.	2026-02-09 07:44:18.868181+00	\N
7f785751-520e-4adf-b115-d7ea41827d8a	psychometric	growth_potential	fresher	low	How do you respond when feedback challenges your confidence?	2026-02-09 07:44:18.868181+00	\N
800bd07a-ec5e-4b63-bf4d-91bb05af3518	psychometric	growth_potential	fresher	low	Describe a time you had to learn while simultaneously delivering results.	2026-02-09 07:44:18.868181+00	\N
f26eef84-27d0-47e4-92c6-1be7ba0d77f7	psychometric	growth_potential	fresher	low	How do you handle mistakes during the learning process?	2026-02-09 07:44:18.868181+00	\N
c4de1368-d984-453d-a216-3b4c6807248f	psychometric	growth_potential	fresher	low	Tell me about a time you had to learn without formal training.	2026-02-09 07:44:18.868181+00	\N
b3f60541-e8f6-4b04-b0d6-a9461c099289	psychometric	growth_potential	fresher	low	How do you stay motivated when learning feels overwhelming?	2026-02-09 07:44:18.868181+00	\N
0a512c10-39f5-451f-9669-01430c336d0e	psychometric	growth_potential	fresher	low	Describe a time you had to apply learning immediately.	2026-02-09 07:44:18.868181+00	\N
4b426247-2298-4ac4-a2b5-4e902e3e880d	psychometric	growth_potential	fresher	low	How do you adapt when learning methods that worked before no longer help?	2026-02-09 07:44:18.868181+00	\N
c7eb2212-de6d-403e-92ad-ae138b6c2655	psychometric	growth_potential	fresher	low	Tell me about a situation where curiosity helped you learn faster.	2026-02-09 07:44:18.868181+00	\N
35ab0f09-0429-4c1d-8c5f-9eb1c9fee9bf	psychometric	growth_potential	fresher	low	How do you learn from people more experienced than you?	2026-02-09 07:44:18.868181+00	\N
d5b92f23-2c04-45de-97f4-07a390bc3935	psychometric	growth_potential	fresher	low	Describe a time you struggled to understand something complex.	2026-02-09 07:44:18.868181+00	\N
465f89da-bcbb-467a-830a-be253849455f	psychometric	growth_potential	fresher	low	How do you track your own learning progress?	2026-02-09 07:44:18.868181+00	\N
36ddc1a7-76b4-42d2-a85e-1ae295cfccd1	psychometric	growth_potential	fresher	low	Tell me about a time learning changed your perspective.	2026-02-09 07:44:18.868181+00	\N
5a1ffbd9-c0bd-4b4e-a39a-15a24e48cd57	psychometric	growth_potential	fresher	low	Why is learning agility critical for your future career growth?	2026-02-09 07:44:18.868181+00	\N
368feda1-a503-48eb-8a85-f2915f331a2d	psychometric	growth_potential	fresher	medium	Describe a time you had to learn something quickly.	2026-02-09 07:44:18.868181+00	\N
fc84455d-fbc3-4c90-a3e3-0d5129c15e40	psychometric	growth_potential	fresher	medium	How do you manage learning when you make mistakes?	2026-02-09 07:44:18.868181+00	\N
79046257-43de-4218-b17a-517f3232c082	psychometric	growth_potential	fresher	medium	How do you balance learning with completing tasks?	2026-02-09 07:44:18.868181+00	\N
465e2148-0789-4b8c-9f41-9b2557457244	psychometric	growth_potential	fresher	medium	How do you approach unfamiliar topics or tools?	2026-02-09 07:44:18.868181+00	\N
f1bd10ca-8851-4fe4-9eed-90f6f676785f	psychometric	growth_potential	fresher	medium	How do you improve yourself after receiving feedback?	2026-02-09 07:44:18.868181+00	\N
18d8cd48-f4dd-4028-879a-53a853db453a	psychometric	growth_potential	fresher	medium	Describe a situation where you had to learn a new concept independently.	2026-02-09 07:44:18.868181+00	\N
af283866-18ce-40e8-b62b-ba49ce80e567	psychometric	growth_potential	fresher	medium	How do you respond when assigned a task beyond your current knowledge?	2026-02-09 07:44:18.868181+00	\N
7f6c6ae0-3492-432b-a68e-bf35e2b02ddc	psychometric	growth_potential	fresher	medium	Tell me about a time you learned from a mistake.	2026-02-09 07:44:18.868181+00	\N
b58ec3ff-24e0-477b-bb03-b069fce8f0fb	psychometric	growth_potential	fresher	medium	How do you keep yourself updated with new knowledge or skills?	2026-02-09 07:44:18.868181+00	\N
2704d30c-e49e-4667-acb7-f407543e9ec7	psychometric	growth_potential	fresher	medium	Describe how you approach learning a difficult topic.	2026-02-09 07:44:18.868181+00	\N
846e8fdb-00e8-4670-a3e9-19892c27cd96	psychometric	growth_potential	fresher	medium	How do you manage learning under time pressure?	2026-02-09 07:44:18.868181+00	\N
af5d5a9a-0f8d-4398-a04f-5c053575371b	psychometric	growth_potential	fresher	medium	Tell me about a time you quickly adapted to new instructions.	2026-02-09 07:44:18.868181+00	\N
c41be706-e979-4a7b-9fea-f072c48285ba	psychometric	growth_potential	fresher	medium	How do you ensure learning does not impact task completion?	2026-02-09 07:44:18.868181+00	\N
cd51ffb9-46c9-4837-960f-2ba550ee5e42	psychometric	growth_potential	fresher	medium	Describe a time you learned something outside your role.	2026-02-09 07:44:18.868181+00	\N
95ddd5b0-b525-4a5e-a96d-6cd2f378e464	psychometric	growth_potential	fresher	medium	How do you handle feedback related to learning gaps?	2026-02-09 07:44:18.868181+00	\N
8ab2c81e-ec84-4e03-b095-809cb0ccf8af	psychometric	growth_potential	fresher	medium	Tell me about a time you learned by observing others.	2026-02-09 07:44:18.868181+00	\N
ff721a70-fb02-404d-8bc3-7de668c9ea74	psychometric	growth_potential	fresher	medium	How do you stay motivated to learn new things?	2026-02-09 07:44:18.868181+00	\N
d9af4377-4824-44a0-9b6d-4114787a5591	psychometric	growth_potential	fresher	medium	Describe how you prepare yourself for unfamiliar responsibilities.	2026-02-09 07:44:18.868181+00	\N
7ea11896-5d1d-421f-a7a0-f647dcb621c3	psychometric	growth_potential	fresher	medium	How do you reflect on your learning progress?	2026-02-09 07:44:18.868181+00	\N
ce58aa2b-c291-4a6e-8afd-751e607df7ec	psychometric	growth_potential	fresher	medium	Tell me about a time you applied learning immediately.	2026-02-09 07:44:18.868181+00	\N
cf1d9728-e8c5-46a2-b9b5-91af498fce65	psychometric	growth_potential	fresher	medium	How do you approach learning multiple topics at once?	2026-02-09 07:44:18.868181+00	\N
ce200763-0cd6-4ceb-9dde-2ab9645cc915	psychometric	growth_potential	fresher	medium	Describe how curiosity helps your learning.	2026-02-09 07:44:18.868181+00	\N
c32a3b09-5868-4c17-a64d-f727bce6c25a	psychometric	growth_potential	fresher	medium	How do you learn when guidance is limited?	2026-02-09 07:44:18.868181+00	\N
809295a8-e867-4297-886f-63161500df9d	psychometric	growth_potential	fresher	medium	Tell me about a time you learned under supervision.	2026-02-09 07:44:18.868181+00	\N
aa21ac15-9996-45c7-98ec-4f35462ce930	psychometric	growth_potential	fresher	medium	Why is learning agility important for freshers?	2026-02-09 07:44:18.868181+00	\N
fd0763f6-d4d6-404d-ad85-212575d09624	psychometric	growth_potential	fresher	high	Describe a situation where learning was challenging but necessary.	2026-02-09 07:44:18.868181+00	\N
adc9e06c-6c51-453e-86ed-1b754a7986c0	psychometric	growth_potential	fresher	high	How do you react when your learning pace is slower than others?	2026-02-09 07:44:18.868181+00	\N
bbac744f-c22d-4352-8d93-10d2c028c57c	psychometric	growth_potential	fresher	high	Tell me about a time you had to relearn something differently.	2026-02-09 07:44:18.868181+00	\N
cc105c1e-62fc-4097-999f-7ada49fd14d5	psychometric	growth_potential	fresher	high	How do you keep learning when results are not immediate?	2026-02-09 07:44:18.868181+00	\N
8be3bac9-770b-4df0-9169-3f28e1c1529c	psychometric	growth_potential	fresher	high	Why is learning agility important for your growth potential?	2026-02-09 07:44:18.868181+00	\N
2ac9d0f4-f723-4cc9-b5df-efa32eb5f46c	psychometric	growth_potential	fresher	high	Describe a time when you had to learn something complex under time pressure.	2026-02-09 07:44:18.868181+00	\N
638395aa-84c5-4423-a88a-00b14c5ee74d	psychometric	growth_potential	fresher	high	How do you respond when you are expected to learn without clear guidance?	2026-02-09 07:44:18.868181+00	\N
4841e9b7-902e-4f34-bfac-0867b0e962bb	psychometric	growth_potential	fresher	high	Tell me about a situation where your first learning approach failed.	2026-02-09 07:44:18.868181+00	\N
32a28947-14e1-4485-90dc-dd79659ab41c	psychometric	growth_potential	fresher	high	How do you handle learning topics that feel overwhelming?	2026-02-09 07:44:18.868181+00	\N
bc1d08b6-8e90-4ebd-92d0-3febcb7e0504	psychometric	growth_potential	fresher	high	Describe a time when you had to unlearn something you learned incorrectly.	2026-02-09 07:44:18.868181+00	\N
e1fb5548-d419-4371-b80f-4afcdfb9e38c	psychometric	growth_potential	fresher	high	How do you continue learning when feedback is negative?	2026-02-09 07:44:18.868181+00	\N
6e6feb19-f4db-412b-ad30-8c1bde184827	psychometric	growth_potential	fresher	high	Tell me about a time you had to learn faster than you were comfortable with.	2026-02-09 07:44:18.868181+00	\N
7ea003f3-3c56-4922-9bd6-0f6bb0d5c534	psychometric	growth_potential	fresher	high	How do you manage learning alongside performance expectations?	2026-02-09 07:44:18.868181+00	\N
188b6f58-e158-410a-a413-7962919fcbac	psychometric	growth_potential	fresher	high	Describe a time when you had to learn from someone more experienced.	2026-02-09 07:44:18.868181+00	\N
ebdb6972-0dd4-4d95-a8ff-19e5773b3efc	psychometric	growth_potential	fresher	high	How do you react when you donÔÇÖt understand something even after trying?	2026-02-09 07:44:18.868181+00	\N
c4209331-1908-4bb1-916d-dc7af913502b	psychometric	growth_potential	fresher	high	Tell me about a time you learned from your mistakes repeatedly.	2026-02-09 07:44:18.868181+00	\N
b044b5db-3dca-4ea0-a3a8-4665d50d5d96	psychometric	growth_potential	fresher	high	How do you stay motivated during slow learning progress?	2026-02-09 07:44:18.868181+00	\N
2098d783-dfc0-4193-a59e-4f14748d5970	psychometric	growth_potential	fresher	high	Describe a time you learned without formal training.	2026-02-09 07:44:18.868181+00	\N
bd07bbaf-eb0c-41c6-a63c-852178af5b03	psychometric	growth_potential	fresher	high	How do you adapt when learning expectations change suddenly?	2026-02-09 07:44:18.868181+00	\N
de87fdd7-f46c-424c-9c53-92ccb1b25182	psychometric	growth_potential	fresher	high	Tell me about a time learning required extra effort beyond normal hours.	2026-02-09 07:44:18.868181+00	\N
1e6b88cb-3836-4d36-9a28-832471ecb990	psychometric	growth_potential	fresher	high	How do you deal with confusion during learning?	2026-02-09 07:44:18.868181+00	\N
ab1a4209-926a-47f3-81ea-12fde2f586a9	psychometric	growth_potential	fresher	high	Describe a time you applied learning immediately.	2026-02-09 07:44:18.868181+00	\N
7ae695df-d125-4299-904b-edc9f5ec8171	psychometric	growth_potential	fresher	high	How do you respond when learning feels repetitive or boring?	2026-02-09 07:44:18.868181+00	\N
afd38507-8783-4775-9796-9708736dbafa	psychometric	growth_potential	fresher	high	Tell me about a time you learned despite low confidence.	2026-02-09 07:44:18.868181+00	\N
7ceb0c3a-c096-41c9-8fad-ee98877e6a5e	psychometric	growth_potential	fresher	high	Why does learning agility define your growth potential as a fresher?	2026-02-09 07:44:18.868181+00	\N
144b6031-b3d8-4282-9928-55ee116463b1	psychometric	sales_dna	fresher	low	How comfortable are you talking to new people?	2026-02-09 07:47:31.45916+00	\N
dfc2e412-a1a8-4116-b2a2-5aeafbeea595	psychometric	sales_dna	fresher	low	Do you like working with clear rules and instructions?	2026-02-09 07:47:31.45916+00	\N
f0e044a5-7644-4ca5-afcb-367756beda54	psychometric	sales_dna	fresher	low	How do you usually introduce yourself to others?	2026-02-09 07:47:31.45916+00	\N
3227136e-8dde-4d94-be07-8c1a752db11b	psychometric	sales_dna	fresher	low	How do you feel about following schedules and deadlines?	2026-02-09 07:47:31.45916+00	\N
401bc298-3c69-4069-a18b-60005a69d0ec	psychometric	sales_dna	fresher	low	Do you enjoy working in a people-facing role like sales?	2026-02-09 07:47:31.45916+00	\N
4d2c355c-d87f-4b26-8a12-dec4bebf558a	psychometric	sales_dna	fresher	low	How comfortable are you talking to new people? (Self-Assessment)	2026-02-09 07:47:31.45916+00	\N
d33ecdd3-f28a-4603-8908-5f627b031d82	psychometric	sales_dna	fresher	low	How do you introduce yourself in a new group or team?	2026-02-09 07:47:31.45916+00	\N
7411eb0b-1425-4c38-a25b-b6596cef8e2e	psychometric	sales_dna	fresher	low	How do you usually participate in group discussions?	2026-02-09 07:47:31.45916+00	\N
a30f339a-9ab3-4313-8f01-690a5c964fe3	psychometric	sales_dna	fresher	low	How do you stay organized while completing tasks?	2026-02-09 07:47:31.45916+00	\N
47799cc3-99ac-41b9-b401-2b08df2553a9	psychometric	sales_dna	fresher	low	How do you ensure you complete tasks on time?	2026-02-09 07:47:31.45916+00	\N
2d8f4f58-af6d-4f26-9110-e70269d00644	psychometric	sales_dna	fresher	low	How do you react when asked to speak in front of others?	2026-02-09 07:47:31.45916+00	\N
831e7371-8320-45d5-b7ea-ca8aef0dffa6	psychometric	sales_dna	fresher	low	How do you handle routine or repetitive tasks?	2026-02-09 07:47:31.45916+00	\N
b8adaf43-8086-44ed-be3e-12cd3e5cb10c	psychometric	sales_dna	fresher	low	How do you respond when someone asks for your help?	2026-02-09 07:47:31.45916+00	\N
63faf126-def2-4e1c-a4a1-c3a91cc3cf86	psychometric	sales_dna	fresher	low	How do you prepare before starting a new task?	2026-02-09 07:47:31.45916+00	\N
6000a9c3-3c8a-4046-af63-25509942573a	psychometric	sales_dna	fresher	low	How do you feel about interacting with customers or clients?	2026-02-09 07:47:31.45916+00	\N
3cb9b51c-99cb-45f9-b7f2-323f156c5114	psychometric	sales_dna	fresher	low	How do you manage small responsibilities assigned to you?	2026-02-09 07:47:31.45916+00	\N
40537437-c27d-41ff-9c93-3aaae6da5ba1	psychometric	sales_dna	fresher	low	How do you behave when working in a team?	2026-02-09 07:47:31.45916+00	\N
ba2e2685-836b-491c-90ab-52cc9ad13e23	psychometric	sales_dna	fresher	low	How do you keep track of your daily tasks?	2026-02-09 07:47:31.45916+00	\N
1a82937f-22d1-41be-be92-43703d34211a	psychometric	sales_dna	fresher	low	How do you respond when you are given clear instructions?	2026-02-09 07:47:31.45916+00	\N
8653b1e2-5295-48ae-a8e8-3b44bb7f096e	psychometric	sales_dna	fresher	low	How do you feel about meeting new people regularly?	2026-02-09 07:47:31.45916+00	\N
ba93880e-dc8e-4549-bf36-6af676d178bc	psychometric	sales_dna	fresher	low	How do you ensure quality in your work?	2026-02-09 07:47:31.45916+00	\N
20fe8b53-31df-455f-b57f-8621441157d5	psychometric	sales_dna	fresher	low	How do you react when given feedback on simple tasks?	2026-02-09 07:47:31.45916+00	\N
fdc6f122-a956-4d86-be81-bea93fe20dcc	psychometric	sales_dna	fresher	low	How do you manage your time during the day?	2026-02-09 07:47:31.45916+00	\N
22a65415-f692-4d20-9c38-11793245a0eb	psychometric	sales_dna	fresher	low	How do you feel about taking initiative in small tasks?	2026-02-09 07:47:31.45916+00	\N
19e22bcd-9350-4997-95d3-1e76759c8d30	psychometric	sales_dna	fresher	low	Why are extraversion and conscientiousness important for a sales role?	2026-02-09 07:47:31.45916+00	\N
db2c27b1-86b9-418e-aae3-a7cbeac29eb8	psychometric	sales_dna	fresher	medium	How do you handle situations where you need to talk to many people in a day?	2026-02-09 07:47:31.45916+00	\N
e83eb61d-d731-4175-870f-8d4f05511806	psychometric	sales_dna	fresher	medium	How do you ensure tasks are completed accurately?	2026-02-09 07:47:31.45916+00	\N
16abdb73-3872-48e6-bed5-45afcfa2f8a6	psychometric	sales_dna	fresher	medium	Describe how you balance talking and listening in conversations.	2026-02-09 07:47:31.45916+00	\N
f3eb37ca-ce3c-4522-b878-b5f176c881d1	psychometric	sales_dna	fresher	medium	How do you stay disciplined while learning sales tasks?	2026-02-09 07:47:31.45916+00	\N
ea74440b-3404-49ab-ab0b-412269944d09	psychometric	sales_dna	fresher	medium	How do you respond when given responsibility for a small task?	2026-02-09 07:47:31.45916+00	\N
92ec1a51-3c7c-42cc-87f5-2284a053240e	psychometric	sales_dna	fresher	medium	How do you prepare yourself before speaking to a new customer?	2026-02-09 07:47:31.45916+00	\N
77a49997-4024-49d0-85fa-9bc3ae282732	psychometric	sales_dna	fresher	medium	How do you ensure you follow instructions given by your senior?	2026-02-09 07:47:31.45916+00	\N
e7ca1891-5970-4f6f-83c7-e0150e7c9365	psychometric	sales_dna	fresher	medium	How do you stay confident when talking to someone experienced?	2026-02-09 07:47:31.45916+00	\N
1b589a72-5d41-4037-8ebd-db8902885af9	psychometric	sales_dna	fresher	medium	How do you handle repetitive sales-related tasks?	2026-02-09 07:47:31.45916+00	\N
dc061c86-e6d2-49df-849c-b4af81eabe61	psychometric	sales_dna	fresher	medium	How do you ensure timely completion of assigned work?	2026-02-09 07:47:31.45916+00	\N
8cd1fa2b-46a7-4302-9398-6b1f0a72a284	psychometric	sales_dna	fresher	medium	How do you react when asked to speak in front of a small group?	2026-02-09 07:47:31.45916+00	\N
b01683a5-ecc2-4131-995e-c0b5ce4a1077	psychometric	sales_dna	fresher	medium	How do you make sure customer-related information is accurate?	2026-02-09 07:47:31.45916+00	\N
6718f45f-fb1c-4aa3-93e5-d08fafbb59a5	psychometric	sales_dna	fresher	medium	How do you balance being friendly and professional in sales?	2026-02-09 07:47:31.45916+00	\N
7c726e0c-89d6-447c-82e4-212b63bc8d13	psychometric	sales_dna	fresher	medium	How do you stay organized during multiple small tasks?	2026-02-09 07:47:31.45916+00	\N
ded0bab9-748c-4768-96f0-fc9dcc54d532	psychometric	sales_dna	fresher	medium	How do you respond when corrected for a mistake?	2026-02-09 07:47:31.45916+00	\N
b12a82ee-1300-4787-b685-92667f789015	psychometric	sales_dna	fresher	medium	How do you ensure consistency in your daily work?	2026-02-09 07:47:31.45916+00	\N
f2ae8403-4d19-4bd8-b11d-266dfdb4260e	psychometric	sales_dna	fresher	medium	How do you handle a situation where you need to explain something clearly?	2026-02-09 07:47:31.45916+00	\N
4982db13-50f2-442d-8997-adafd42058a6	psychometric	sales_dna	fresher	medium	How do you stay focused during long conversations?	2026-02-09 07:47:31.45916+00	\N
fa6fff46-edba-4afe-8713-af2cb9406d6b	psychometric	sales_dna	fresher	medium	How do you manage tasks when given limited supervision?	2026-02-09 07:47:31.45916+00	\N
4fc4d54b-078f-4469-b240-00a6f19dc9e0	psychometric	sales_dna	fresher	medium	How do you maintain quality while working quickly?	2026-02-09 07:47:31.45916+00	\N
29e9f1eb-7b3f-4404-8bd5-16bd0df2135c	psychometric	sales_dna	fresher	medium	How do you prepare for routine customer interactions?	2026-02-09 07:47:31.45916+00	\N
4bace75a-aa86-4af9-abd7-cb363bbc89a0	psychometric	sales_dna	fresher	medium	How do you handle responsibility for tracking small details?	2026-02-09 07:47:31.45916+00	\N
d88488ae-c837-4eea-b271-dde9ec44fa1c	psychometric	sales_dna	fresher	medium	How do you ensure discipline in daily sales learning?	2026-02-09 07:47:31.45916+00	\N
3090f909-b367-4479-a16c-19da271a235b	psychometric	sales_dna	fresher	medium	How do you manage interactions when you feel tired?	2026-02-09 07:47:31.45916+00	\N
16521026-7449-4b60-9049-7807c38fd01b	psychometric	sales_dna	fresher	medium	How do you show reliability in small responsibilities?	2026-02-09 07:47:31.45916+00	\N
aa32038c-082f-4313-b978-d1859024f3aa	psychometric	sales_dna	fresher	high	Describe a situation where you had to interact confidently while staying disciplined.	2026-02-09 07:47:31.45916+00	\N
c3e3ff7f-54ae-4f46-8ad0-4315cfbc4d19	psychometric	sales_dna	fresher	high	How do you manage talking to people while following strict processes?	2026-02-09 07:47:31.45916+00	\N
95e40706-53be-4225-a73c-77b538dac04b	psychometric	sales_dna	fresher	high	How do you handle responsibility when supervision is minimal?	2026-02-09 07:47:31.45916+00	\N
38fb275c-df2f-4136-b65b-7129609caeff	psychometric	sales_dna	fresher	high	Tell me about a time you stayed organized while handling social interactions.	2026-02-09 07:47:31.45916+00	\N
2ac1400b-ea9d-4f51-8762-fd0803ecbe99	psychometric	sales_dna	fresher	high	How do you stay energetic while completing repetitive sales-related tasks?	2026-02-09 07:47:31.45916+00	\N
c8b4c43b-dd61-4cc8-98ce-811aade05dd7	psychometric	sales_dna	fresher	high	Why are extraversion and conscientiousness important for a fresher in sales?	2026-02-09 07:47:31.45916+00	\N
948351e9-1a48-4b69-aaa1-f07bb441ae14	psychometric	sales_dna	fresher	high	Describe a situation where you had to stay confident while handling strict accountability.	2026-02-09 07:47:31.45916+00	\N
8339e8ef-ae69-4463-be88-ce577e04bd82	psychometric	sales_dna	fresher	high	How do you maintain enthusiasm when tasks require high attention to detail?	2026-02-09 07:47:31.45916+00	\N
15afeb76-1682-489e-8358-1a3ac6022ab6	psychometric	sales_dna	fresher	high	Tell me about a time you had to communicate proactively while following rules strictly.	2026-02-09 07:47:31.45916+00	\N
976961db-c03f-45ab-9bab-5b1a2e506c4b	psychometric	sales_dna	fresher	high	How do you balance social interaction with task discipline in sales-related work?	2026-02-09 07:47:31.45916+00	\N
90efc55f-d3f4-41c9-a6b6-c6de732eda0e	psychometric	sales_dna	fresher	high	Describe a time when following a process was more important than speed.	2026-02-09 07:47:31.45916+00	\N
a99528ee-686d-4d7f-8a30-72a9e18e7575	psychometric	sales_dna	fresher	high	How do you stay confident when correcting your own mistakes?	2026-02-09 07:47:31.45916+00	\N
784a4a2f-abfb-4599-a176-e62ef678936a	psychometric	sales_dna	fresher	high	Tell me about a situation where accuracy mattered more than persuasion.	2026-02-09 07:47:31.45916+00	\N
99a58526-39b8-4820-9bc4-52bd6fcee603	psychometric	sales_dna	fresher	high	How do you manage energy during repetitive but people-facing tasks?	2026-02-09 07:47:31.45916+00	\N
9f64cbdd-ece7-4a92-95e4-4c8a6c826abf	psychometric	sales_dna	fresher	high	Describe a time you had to be assertive while respecting boundaries.	2026-02-09 07:47:31.45916+00	\N
28a32310-047c-453f-bf80-a1559f17b301	psychometric	sales_dna	fresher	high	How do you ensure reliability when handling small but critical tasks?	2026-02-09 07:47:31.45916+00	\N
22b64cf2-e663-48b1-92c9-3d00707db60a	psychometric	sales_dna	fresher	high	Tell me about a time you had to stay organized while interacting with multiple people.	2026-02-09 07:47:31.45916+00	\N
d841cba0-da2d-405d-88a7-ee0f7e0d23f5	psychometric	sales_dna	fresher	high	How do you respond when enthusiasm conflicts with procedure?	2026-02-09 07:47:31.45916+00	\N
1d5104d3-3a0e-4a37-93a6-5b45efd6b95e	psychometric	sales_dna	fresher	high	Describe a situation where preparation improved your confidence.	2026-02-09 07:47:31.45916+00	\N
18e2a0ac-5b1c-4198-9e08-126a5aeef421	psychometric	sales_dna	fresher	high	How do you stay disciplined when tasks feel monotonous?	2026-02-09 07:47:31.45916+00	\N
5296a763-59d3-4407-8969-5eb7de452206	psychometric	sales_dna	fresher	high	How do you ensure professionalism in informal conversations?	2026-02-09 07:47:31.45916+00	\N
548ac828-f3d7-4aa7-a616-71183ef445be	psychometric	sales_dna	fresher	high	Tell me about a time discipline helped you build trust.	2026-02-09 07:47:31.45916+00	\N
32765bb3-c524-46e4-851c-5af62d2a370e	psychometric	sales_dna	fresher	high	Describe a time you had to slow down to maintain quality.	2026-02-09 07:47:31.45916+00	\N
6b3242bd-5902-4fb5-afc6-0d5e9270dbdf	psychometric	sales_dna	fresher	high	How do you balance friendliness with task completion?	2026-02-09 07:47:31.45916+00	\N
a3437db2-7959-449d-8c75-1e077aed1279	psychometric	sales_dna	fresher	high	Why is Sales DNA important even at a fresher level?	2026-02-09 07:47:31.45916+00	\N
3a5d8787-ace8-4016-904c-8adc6e826c63	psychometric	burnout_risk	mid	low	How do you usually feel after a busy workday?	2026-02-09 07:51:25.589923+00	\N
8f7e38f4-f92f-4de8-b93c-8984c2a5a474	psychometric	burnout_risk	mid	low	How do you manage your daily workload?	2026-02-09 07:51:25.589923+00	\N
f8efbc8c-398f-4a6a-a564-f36c0bca412a	psychometric	burnout_risk	mid	low	How comfortable are you taking breaks during work?	2026-02-09 07:51:25.589923+00	\N
05129ffe-0d3d-475c-8c18-9976b2e3759f	psychometric	burnout_risk	mid	low	How do you feel about balancing work and personal life?	2026-02-09 07:51:25.589923+00	\N
8aeb88d8-b5d8-4b97-be64-900673475b05	psychometric	burnout_risk	mid	low	How do you usually react to extended working hours?	2026-02-09 07:51:25.589923+00	\N
e13226ef-1a89-4ee9-bcc9-b38a5508be9d	psychometric	burnout_risk	mid	low	How do you usually feel at the end of a regular workday?	2026-02-09 07:51:25.589923+00	\N
800770d4-091a-415c-a320-90e2c208c4e2	psychometric	burnout_risk	mid	low	How do you manage your workload on a daily basis?	2026-02-09 07:51:25.589923+00	\N
a1422c7a-b686-4139-a888-18a789d3fb52	psychometric	burnout_risk	mid	low	How comfortable are you taking short breaks during work? (Self-Care)	2026-02-09 07:51:25.589923+00	\N
d9aae315-4f90-4f47-84a2-131333b181f1	psychometric	burnout_risk	mid	low	How do you feel about your current work-life balance?	2026-02-09 07:51:25.589923+00	\N
788017ea-9df4-4d89-ab26-fe42687c6ff3	psychometric	burnout_risk	mid	low	How do you respond when work becomes slightly overwhelming?	2026-02-09 07:51:25.589923+00	\N
0ebb240e-867e-4e6e-a327-ca6ee427b392	psychometric	burnout_risk	mid	low	How often do you feel mentally exhausted at work?	2026-02-09 07:51:25.589923+00	\N
79326581-e133-4648-8878-778ef46cdf16	psychometric	burnout_risk	mid	low	How do you usually start your workday?	2026-02-09 07:51:25.589923+00	\N
76379bfd-aa33-4b55-bd18-88aaf2f5277b	psychometric	burnout_risk	mid	low	How do you handle working for long hours occasionally?	2026-02-09 07:51:25.589923+00	\N
20e560ec-8fbb-4386-824b-dc188d414fdc	psychometric	burnout_risk	mid	low	How do you react when deadlines are close?	2026-02-09 07:51:25.589923+00	\N
e4422fdd-3cc7-4b27-b173-cc8c6ac2fc9a	psychometric	burnout_risk	mid	low	How do you feel about asking for help at work?	2026-02-09 07:51:25.589923+00	\N
3f10c666-cb28-4696-ae20-cd23be35c319	psychometric	burnout_risk	mid	low	How do you usually manage stress during busy weeks?	2026-02-09 07:51:25.589923+00	\N
a346f777-e4b6-47b7-92e0-dca80fe1803e	psychometric	burnout_risk	mid	low	How do you maintain motivation during repetitive work?	2026-02-09 07:51:25.589923+00	\N
ff3902f7-9a22-44eb-8d93-dc87eedce066	psychometric	burnout_risk	mid	low	How do you feel when workload increases temporarily?	2026-02-09 07:51:25.589923+00	\N
79f66830-db4c-4981-bf4a-0f34ef91f901	psychometric	burnout_risk	mid	low	How do you disconnect from work after office hours?	2026-02-09 07:51:25.589923+00	\N
6b189069-4546-4101-abd7-a3dff4eeb00c	psychometric	burnout_risk	mid	low	How do you monitor your own energy levels at work?	2026-02-09 07:51:25.589923+00	\N
1bf87005-f056-437c-a6f9-abfe1dbe6cda	psychometric	burnout_risk	mid	low	How do you usually feel about your current responsibilities?	2026-02-09 07:51:25.589923+00	\N
b00d2222-1a58-49a1-97e6-a4bbc5e760ea	psychometric	burnout_risk	mid	low	How do you handle minor work-related stress?	2026-02-09 07:51:25.589923+00	\N
04886802-09a6-4991-84d6-e463222694d3	psychometric	burnout_risk	mid	low	How do you feel about taking time off when required?	2026-02-09 07:51:25.589923+00	\N
13021e5e-a4e1-4750-b2c2-e9a4c4c4f45a	psychometric	burnout_risk	mid	low	How do you usually react to feedback related to workload or stress?	2026-02-09 07:51:25.589923+00	\N
261c1d21-66a6-4070-9fe9-68a7654cf6fc	psychometric	burnout_risk	mid	low	How do you ensure you do not overextend yourself at work?	2026-02-09 07:51:25.589923+00	\N
480cae80-fd0f-43d4-8282-5543010a98c3	psychometric	burnout_risk	mid	medium	Describe how you handle periods of high workload.	2026-02-09 07:51:25.589923+00	\N
8bdd7aaf-643b-4c3d-84e1-e4e8d0097b9a	psychometric	burnout_risk	mid	medium	How do you notice early signs of stress or burnout?	2026-02-09 07:51:25.589923+00	\N
4fe57b89-de6c-4229-920d-3a89b4eebdad	psychometric	burnout_risk	mid	medium	How do you manage stress during demanding projects?	2026-02-09 07:51:25.589923+00	\N
886330b2-c0dd-4c04-9419-1a8b719b4ad5	psychometric	burnout_risk	mid	medium	How do you respond when work pressure continues for long periods?	2026-02-09 07:51:25.589923+00	\N
a7d09e16-80c1-4bd3-ba52-0a0dda71c9a3	psychometric	burnout_risk	mid	medium	How do you maintain motivation during repetitive work cycles?	2026-02-09 07:51:25.589923+00	\N
0b21f085-060d-486c-8ee7-1134b8889f45	psychometric	burnout_risk	mid	medium	Describe a time when prolonged pressure affected your well-being. How did you manage it?	2026-02-09 07:51:25.589923+00	\N
7a31dc87-b0ff-44f6-9cb6-b12fea373781	psychometric	burnout_risk	mid	medium	How do you respond when burnout symptoms persist despite effort?	2026-02-09 07:51:25.589923+00	\N
f5f4f5ba-8bc1-4b49-b56f-3a3e02808296	psychometric	burnout_risk	mid	medium	Tell me about a time when high responsibility led to emotional exhaustion.	2026-02-09 07:51:25.589923+00	\N
5be6d7d6-06a4-4606-a033-9c181f901d12	psychometric	burnout_risk	mid	medium	How do you manage burnout risk during long periods of uncertainty?	2026-02-09 07:51:25.589923+00	\N
3e3a0550-861e-4b79-b73c-73a4109a007d	psychometric	burnout_risk	mid	medium	Describe a situation where performance expectations became overwhelming.	2026-02-09 07:51:25.589923+00	\N
b33442d6-a2fe-4eb1-8920-f019d3dd742b	psychometric	burnout_risk	mid	medium	How do you handle burnout risk when recovery time is limited?	2026-02-09 07:51:25.589923+00	\N
8e5884a2-baf1-4727-afaf-4dc260ade564	psychometric	burnout_risk	mid	medium	How do you recognize when resilience turns into unhealthy endurance?	2026-02-09 07:51:25.589923+00	\N
bc8a2efa-e2ce-4aef-9590-a6bca1613c26	psychometric	burnout_risk	mid	medium	Describe a time when stress affected your decision-making.	2026-02-09 07:51:25.589923+00	\N
b537b6c5-c4e7-466a-a7fe-81c5135c0ca8	psychometric	burnout_risk	mid	medium	How do you prevent burnout while meeting aggressive timelines?	2026-02-09 07:51:25.589923+00	\N
af999e3f-fa15-4ce4-83d3-87a0074efd5e	psychometric	growth_potential	mid	high	How do you build learning habits that last?	2026-02-09 07:54:36.607221+00	\N
cfaa65d6-1b34-476d-9aa8-6fdaec489777	psychometric	burnout_risk	mid	medium	How do you cope with mental fatigue that impacts motivation?	2026-02-09 07:51:25.589923+00	\N
74844a2a-0670-4ed8-92fd-0aa068338fc7	psychometric	burnout_risk	mid	medium	Describe how continuous multitasking affected your stress levels.	2026-02-09 07:51:25.589923+00	\N
d515c997-f024-468b-a1a1-19eb3d60b320	psychometric	burnout_risk	mid	medium	How do you manage emotional burnout from repeated failures?	2026-02-09 07:51:25.589923+00	\N
52b8ec10-95a5-401d-92fa-046aaff78d74	psychometric	burnout_risk	mid	medium	How do you respond when stress begins to affect health?	2026-02-09 07:51:25.589923+00	\N
55ff9ca5-25ac-4109-8178-14f6323eebc0	psychometric	burnout_risk	mid	medium	Describe a time you ignored burnout signs and learned from it.	2026-02-09 07:51:25.589923+00	\N
eba8dd23-fc45-4562-9227-9758f88c63dc	psychometric	burnout_risk	mid	medium	How do you manage burnout risk during career transitions?	2026-02-09 07:51:25.589923+00	\N
6fa70c59-c2aa-4eb4-83b9-062236267732	psychometric	burnout_risk	mid	medium	How do you handle stress when responsibilities increase suddenly?	2026-02-09 07:51:25.589923+00	\N
b147835e-508a-4d0a-958a-6984e1e98157	psychometric	burnout_risk	mid	medium	How do you sustain performance without sacrificing mental health?	2026-02-09 07:51:25.589923+00	\N
b2bbd46b-36fd-4661-b9c4-35daf533a691	psychometric	burnout_risk	mid	medium	Describe how burnout risk changed as your role evolved.	2026-02-09 07:51:25.589923+00	\N
e62544f0-0a3f-4dca-9263-6dc75b030547	psychometric	burnout_risk	mid	medium	How do you evaluate whether workload is becoming unsustainable?	2026-02-09 07:51:25.589923+00	\N
70cd6ca9-4d1a-4843-91e8-ea0d2ee7d655	psychometric	burnout_risk	mid	medium	Why is burnout self-regulation critical at the mid-career stage?	2026-02-09 07:51:25.589923+00	\N
a411b974-c175-4026-8fb2-867bbfd9256d	psychometric	burnout_risk	mid	high	Describe a time when you felt close to burnout and how you handled it.	2026-02-09 07:51:25.589923+00	\N
55ff1b62-687b-4b9a-8260-d3c0bcb03015	psychometric	burnout_risk	mid	high	How do you prevent burnout when responsibilities keep increasing?	2026-02-09 07:51:25.589923+00	\N
ad874530-afb0-493c-9f98-a117d5e4358b	psychometric	burnout_risk	mid	high	Tell me about a situation where stress affected your performance and how you recovered.	2026-02-09 07:51:25.589923+00	\N
9d97af5c-bad1-48d5-a8bd-2bc9d4be1cfb	psychometric	burnout_risk	mid	high	How do you continue performing when mental or emotional fatigue builds up?	2026-02-09 07:51:25.589923+00	\N
205d8fd4-85d7-493b-85f6-588a7b114324	psychometric	burnout_risk	mid	high	Why is burnout awareness important at the mid-level stage of your career?	2026-02-09 07:51:25.589923+00	\N
00113a06-9ffe-441c-b66c-ade5b8a3d955	psychometric	burnout_risk	mid	high	Describe a situation where you had to stay confident while handling strict accountability.	2026-02-09 07:51:25.589923+00	\N
0738f5b4-b37e-4bd2-85ee-4b1fe7e66cc1	psychometric	burnout_risk	mid	high	How do you maintain enthusiasm when tasks require high attention to detail?	2026-02-09 07:51:25.589923+00	\N
1ed942f6-3af1-422f-a67e-e13c410edcb7	psychometric	burnout_risk	mid	high	Tell me about a time you had to communicate proactively while following rules strictly.	2026-02-09 07:51:25.589923+00	\N
09855643-1a3a-49b7-b082-5794a66c8842	psychometric	burnout_risk	mid	high	How do you balance social interaction with task discipline in sales-related work?	2026-02-09 07:51:25.589923+00	\N
7264c733-b15a-44f1-8b37-45dc6f37b9f8	psychometric	burnout_risk	mid	high	Describe a time when following a process was more important than speed.	2026-02-09 07:51:25.589923+00	\N
7c270dc1-1471-4699-abe0-dcb7f58c6fa9	psychometric	burnout_risk	mid	high	How do you stay confident when correcting your own mistakes?	2026-02-09 07:51:25.589923+00	\N
e1c352f6-598e-4d51-b19d-88a3d53eecbf	psychometric	burnout_risk	mid	high	Tell me about a situation where accuracy mattered more than persuasion.	2026-02-09 07:51:25.589923+00	\N
a0c36068-c3a1-49c1-9c8a-a53b703eb928	psychometric	burnout_risk	mid	high	How do you manage energy during repetitive but people-facing tasks?	2026-02-09 07:51:25.589923+00	\N
c53b2376-cb70-4c68-8a48-199a35f75cff	psychometric	burnout_risk	mid	high	Describe a time you had to be assertive while respecting boundaries.	2026-02-09 07:51:25.589923+00	\N
82794963-9685-4a70-9072-ff27c57efc15	psychometric	burnout_risk	mid	high	How do you ensure reliability when handling small but critical tasks?	2026-02-09 07:51:25.589923+00	\N
fe4c15f4-7b2e-44ca-8082-314d666d30dd	psychometric	burnout_risk	mid	high	Tell me about a time you had to stay organized while interacting with multiple people.	2026-02-09 07:51:25.589923+00	\N
da4fa5f6-f4ee-47c3-8081-48abe66d8b42	psychometric	burnout_risk	mid	high	How do you respond when enthusiasm conflicts with procedure?	2026-02-09 07:51:25.589923+00	\N
b1dec57c-86ef-4fda-9a2e-502902615981	psychometric	burnout_risk	mid	high	Describe a situation where preparation improved your confidence.	2026-02-09 07:51:25.589923+00	\N
064e568d-24c2-40dd-8f90-cc5644780789	psychometric	burnout_risk	mid	high	How do you stay disciplined when tasks feel monotonous?	2026-02-09 07:51:25.589923+00	\N
ce4a75a9-5601-4974-b795-35e0458f078c	psychometric	burnout_risk	mid	high	How do you ensure professionalism in informal conversations?	2026-02-09 07:51:25.589923+00	\N
e96e7813-182e-4851-8e6d-99773fa54ce0	psychometric	burnout_risk	mid	high	Tell me about a time discipline helped you build trust.	2026-02-09 07:51:25.589923+00	\N
d4804806-a54d-4bee-a39b-979df538f5d1	psychometric	burnout_risk	mid	high	How do you handle responsibility when supervision is minimal?	2026-02-09 07:51:25.589923+00	\N
297e2ac6-504d-4aa2-abb0-ba5eee8e60e9	psychometric	burnout_risk	mid	high	Describe a time you had to slow down to maintain quality.	2026-02-09 07:51:25.589923+00	\N
c4f0e3ce-091e-4e04-b07a-59e97f7af26d	psychometric	burnout_risk	mid	high	How do you balance friendliness with task completion?	2026-02-09 07:51:25.589923+00	\N
07db907e-9bd1-436d-a46a-d13b899ba316	psychometric	burnout_risk	mid	high	Why is burnout self-regulation critical for mid-level professionals?	2026-02-09 07:51:25.589923+00	\N
7a8fc68b-a838-4dc6-901c-e139eb26b44e	psychometric	growth_potential	mid	low	How important is personal growth in your current role?	2026-02-09 07:54:36.607221+00	\N
7d48a16e-c61a-4cf6-bed2-39854f39db9e	psychometric	growth_potential	mid	low	How do you usually respond to new challenges at work?	2026-02-09 07:54:36.607221+00	\N
62dee5a3-4200-4348-a1a9-e88391057bdc	psychometric	growth_potential	mid	low	How comfortable are you stepping outside your comfort zone?	2026-02-09 07:54:36.607221+00	\N
df94cbc9-6945-4bdd-9890-3cc4be0f38f5	psychometric	growth_potential	mid	low	How do you feel about taking on additional responsibilities?	2026-02-09 07:54:36.607221+00	\N
dc87df06-3851-4f80-8f89-9d7ce4221424	psychometric	growth_potential	mid	low	How do you stay motivated to improve at work?	2026-02-09 07:54:36.607221+00	\N
b775bdc0-896c-4de7-a5f6-b3412a723bad	psychometric	growth_potential	mid	low	How do you feel about learning new skills at work?	2026-02-09 07:54:36.607221+00	\N
aa3fbb9a-82f2-42bd-ae05-dc2c7883c712	psychometric	growth_potential	mid	low	How do you usually approach a new responsibility?	2026-02-09 07:54:36.607221+00	\N
faeaa0be-7574-43c7-830f-8fd7e7519467	psychometric	growth_potential	mid	low	How do you respond when assigned an unfamiliar task?	2026-02-09 07:54:36.607221+00	\N
d7a3155e-bb53-4e08-a28d-703faf83fe4c	psychometric	growth_potential	mid	low	How do you improve after receiving feedback?	2026-02-09 07:54:36.607221+00	\N
7d97bffc-be9b-4056-8026-4ecee7c53d16	psychometric	growth_potential	mid	low	How do you keep yourself updated with new knowledge at work?	2026-02-09 07:54:36.607221+00	\N
b0ac2c45-7d96-438c-8c2b-e11ce514b623	psychometric	growth_potential	mid	low	How do you handle mistakes while learning something new?	2026-02-09 07:54:36.607221+00	\N
288ff418-8189-4a64-8151-e254e6d27973	psychometric	growth_potential	mid	low	How do you manage learning alongside regular work tasks?	2026-02-09 07:54:36.607221+00	\N
2a9523cd-82db-4a50-b3e8-90d2e36e3b6c	psychometric	growth_potential	mid	low	How open are you to learning from colleagues or seniors?	2026-02-09 07:54:36.607221+00	\N
95db5737-7131-40c5-9188-3d4f3d3e5512	psychometric	growth_potential	mid	low	How do you handle changes that require new learning?	2026-02-09 07:54:36.607221+00	\N
28209c9b-ec53-44a2-8b3d-18165bdac437	psychometric	growth_potential	mid	low	How do you motivate yourself to keep learning at work?	2026-02-09 07:54:36.607221+00	\N
9da45a74-ca56-4e2a-9b85-289310c3d2ce	psychometric	growth_potential	mid	low	How do you apply new learning to your job role?	2026-02-09 07:54:36.607221+00	\N
504b2df3-6915-4464-99bb-99306e60e6a5	psychometric	growth_potential	mid	low	How do you respond to learning something outside your comfort zone?	2026-02-09 07:54:36.607221+00	\N
a68bb3de-3d94-494f-a6cb-f286c464ec88	psychometric	growth_potential	mid	low	How do you keep learning when work becomes repetitive?	2026-02-09 07:54:36.607221+00	\N
29607e84-016f-474f-92cf-760bc86cb1fa	psychometric	growth_potential	mid	low	How do you handle skill gaps in your role?	2026-02-09 07:54:36.607221+00	\N
ab159998-2853-43ac-81f3-ec6b431b31f1	psychometric	growth_potential	mid	low	How do you react when learning takes longer than expected?	2026-02-09 07:54:36.607221+00	\N
30b9fd15-8474-4e3d-9ce5-7aefc0e76319	psychometric	growth_potential	mid	low	How do you ensure continuous growth in your role?	2026-02-09 07:54:36.607221+00	\N
f2a7940c-9a61-4ece-824d-5675a446d826	psychometric	growth_potential	mid	low	How do you handle learning pressure at work?	2026-02-09 07:54:36.607221+00	\N
98716c80-8fa6-4750-816c-892a326d41f3	psychometric	growth_potential	mid	low	How do you stay curious in your professional role?	2026-02-09 07:54:36.607221+00	\N
1638a508-feff-4e66-93ca-f3c6cc3b7aed	psychometric	growth_potential	mid	low	How do you measure your learning progress?	2026-02-09 07:54:36.607221+00	\N
0b58166f-1bbd-4e71-aab7-acccffea10cb	psychometric	growth_potential	mid	low	Why is growth potential important at the mid-level stage of your career?	2026-02-09 07:54:36.607221+00	\N
6430603a-6012-4001-aa7e-aa15e82cf0c7	psychometric	growth_potential	mid	medium	Describe a time you proactively worked on self-improvement.	2026-02-09 07:54:36.607221+00	\N
791f3692-5c07-4673-878f-58045abf0fb9	psychometric	growth_potential	mid	medium	How do you handle feedback aimed at improving your performance?	2026-02-09 07:54:36.607221+00	\N
7345d023-4893-4dda-9029-fd7de7cc187a	psychometric	growth_potential	mid	medium	How do you balance current performance with preparing for future roles?	2026-02-09 07:54:36.607221+00	\N
85eb5844-891f-45b6-a9a2-916577b74de6	psychometric	growth_potential	mid	medium	How do you approach tasks that stretch your abilities?	2026-02-09 07:54:36.607221+00	\N
24ee7d7f-9eb2-4bee-9af6-3fa1b6262744	psychometric	growth_potential	mid	medium	How do you ensure continuous development in your role?	2026-02-09 07:54:36.607221+00	\N
d5631154-048a-4d52-886a-3b26cf3dd5b2	psychometric	growth_potential	mid	medium	How do you approach learning a new responsibility at work?	2026-02-09 07:54:36.607221+00	\N
c32963b4-458d-457f-ab51-57b4224f1fca	psychometric	growth_potential	mid	medium	How do you handle situations where you need to upgrade your skills quickly?	2026-02-09 07:54:36.607221+00	\N
80e7c114-7978-4866-8f17-b5abf903b558	psychometric	growth_potential	mid	medium	Describe a time when learning helped you improve performance.	2026-02-09 07:54:36.607221+00	\N
f31ee431-08c4-48fe-bf2a-16bc7f3e6ca4	psychometric	growth_potential	mid	medium	How do you respond when your role expectations increase?	2026-02-09 07:54:36.607221+00	\N
2f8585c6-aebc-4078-83d5-b83e8d8c03f7	psychometric	growth_potential	mid	medium	How do you ensure continuous improvement in your role?	2026-02-09 07:54:36.607221+00	\N
3954963c-1d51-4324-93bd-55e7b7b239fc	psychometric	growth_potential	mid	medium	Describe how you learn from challenging tasks.	2026-02-09 07:54:36.607221+00	\N
9f284d07-0801-4e42-b3bc-dc0478b2a860	psychometric	growth_potential	mid	medium	How do you react when feedback highlights skill gaps?	2026-02-09 07:54:36.607221+00	\N
a5a2bd73-c2f3-4860-9596-5f902607a370	psychometric	growth_potential	mid	medium	How do you balance daily work with learning new skills?	2026-02-09 07:54:36.607221+00	\N
236b7f29-0b55-467c-a2a7-767ea3a89fc9	psychometric	growth_potential	mid	medium	Tell me about a time you proactively learned something new.	2026-02-09 07:54:36.607221+00	\N
87aff0dd-d16d-4117-8dbf-d0159040bc2b	psychometric	growth_potential	mid	medium	How do you handle learning when outcomes are uncertain?	2026-02-09 07:54:36.607221+00	\N
a0521d8b-da0e-404e-9992-4a869987b76a	psychometric	growth_potential	mid	medium	How do you adapt your learning style as responsibilities grow?	2026-02-09 07:54:36.607221+00	\N
43f4c202-8ca4-4297-a4ff-df536664b39f	psychometric	growth_potential	mid	medium	Describe a situation where learning improved your confidence.	2026-02-09 07:54:36.607221+00	\N
b9b718bf-87ba-46a2-8d47-5e376f2d3d9e	psychometric	growth_potential	mid	medium	How do you stay motivated to keep learning at mid-level roles?	2026-02-09 07:54:36.607221+00	\N
4ac6a5fe-2946-468f-9416-8e62c8b0c31a	psychometric	growth_potential	mid	medium	How do you respond when learning requires extra effort?	2026-02-09 07:54:36.607221+00	\N
af800d24-aef4-48f6-859a-061a319a7462	psychometric	growth_potential	mid	medium	How do you learn from mistakes at work?	2026-02-09 07:54:36.607221+00	\N
560ffd6e-ae31-429b-a09c-3ed44a4035b3	psychometric	growth_potential	mid	medium	How do you prepare yourself for future growth opportunities?	2026-02-09 07:54:36.607221+00	\N
df5e1d56-a41e-48f8-8f2c-6fdb8f17092a	psychometric	growth_potential	mid	medium	How do you respond to learning outside your comfort zone?	2026-02-09 07:54:36.607221+00	\N
a5975a66-cb4b-440e-80d0-201409861d2f	psychometric	growth_potential	mid	medium	Describe how learning helps you take on larger responsibilities.	2026-02-09 07:54:36.607221+00	\N
b6359353-4edf-4831-86d6-23f37a706660	psychometric	growth_potential	mid	medium	How do you ensure learning translates into performance?	2026-02-09 07:54:36.607221+00	\N
c756a6cb-8fb5-4b3d-bd9b-b3f9365918f6	psychometric	growth_potential	mid	medium	Why is growth potential important at the mid-level stage?	2026-02-09 07:54:36.607221+00	\N
b7e98b0b-642a-4c9e-be82-8cd907eabd0e	psychometric	growth_potential	mid	high	Describe a situation where growth required sustained effort over time.	2026-02-09 07:54:36.607221+00	\N
e0bcfc49-820f-4935-bf65-ec767dfaa487	psychometric	growth_potential	mid	high	How do you respond when growth opportunities come with risk or uncertainty?	2026-02-09 07:54:36.607221+00	\N
e01094e1-6411-4bf6-9f6a-c38c7b751436	psychometric	growth_potential	mid	high	Tell me about a time when you had to change your mindset to grow professionally.	2026-02-09 07:54:36.607221+00	\N
55811e14-4ef1-4f28-9559-97d2fc78ac9b	psychometric	growth_potential	mid	high	How do you continue growing when progress feels slow?	2026-02-09 07:54:36.607221+00	\N
c13bd41f-1468-4fd4-98bc-95a257f7fab7	psychometric	growth_potential	mid	high	Why is growth potential important at the mid-level stage of your career?	2026-02-09 07:54:36.607221+00	\N
63bdc401-78d7-4356-b3f1-78a9f50f1705	psychometric	growth_potential	mid	high	Describe a time when rapid learning was critical to your success.	2026-02-09 07:54:36.607221+00	\N
6503300f-a970-4b2b-b30c-27281875c4a0	psychometric	growth_potential	mid	high	How do you continue learning when your role becomes increasingly complex?	2026-02-09 07:54:36.607221+00	\N
5ab6c534-3bc7-4b70-b8fb-10af65434860	psychometric	growth_potential	mid	high	Tell me about a time you had to unlearn an old method to grow.	2026-02-09 07:54:36.607221+00	\N
68014a7d-a567-47b2-b61f-ca9218fc710d	psychometric	growth_potential	mid	high	How do you handle learning when there is no clear guidance?	2026-02-09 07:54:36.607221+00	\N
0a56a576-eeff-4b6a-b03d-f9652b4952bb	psychometric	growth_potential	mid	high	Describe a situation where learning directly impacted a key decision.	2026-02-09 07:54:36.607221+00	\N
ef4f79de-2c15-4637-a248-aac0a329a648	psychometric	growth_potential	mid	high	How do you stay committed to learning during high-pressure situations?	2026-02-09 07:54:36.607221+00	\N
a529c255-5acc-4160-9c0b-e0b18563c85d	psychometric	growth_potential	mid	high	Tell me about a time learning helped you recover from a failure.	2026-02-09 07:54:36.607221+00	\N
04f40c8c-92e8-4d56-a582-cdd4959ff580	psychometric	growth_potential	mid	high	How do you evaluate what skills to learn next?	2026-02-09 07:54:36.607221+00	\N
fa480266-29e0-4a5b-85f0-a42c8d11656c	psychometric	growth_potential	mid	high	Describe a time when learning required sustained effort.	2026-02-09 07:54:36.607221+00	\N
fbd82e2f-0f1e-43e1-b9ef-7eaa737b731e	psychometric	growth_potential	mid	high	How do you adapt your learning approach after setbacks?	2026-02-09 07:54:36.607221+00	\N
396873af-4ab6-40da-a6db-6578a9481893	psychometric	growth_potential	mid	high	How do you ensure learning keeps pace with role expansion?	2026-02-09 07:54:36.607221+00	\N
55692977-5389-4321-99fc-92e31994be66	psychometric	growth_potential	mid	high	Describe a time when learning changed your perspective.	2026-02-09 07:54:36.607221+00	\N
adfa3e68-54aa-4d67-83eb-12f03bd8c221	psychometric	growth_potential	mid	high	How do you remain learning-focused despite competing priorities?	2026-02-09 07:54:36.607221+00	\N
36f3258a-df7c-4a1d-8895-ff85468bed4e	psychometric	growth_potential	mid	high	Describe how learning prepares you for future roles.	2026-02-09 07:54:36.607221+00	\N
a25f09b7-a4a7-47d6-b404-c63d32379993	psychometric	growth_potential	mid	high	How do you respond when learning challenges your confidence?	2026-02-09 07:54:36.607221+00	\N
bf5e44c0-6877-4421-a023-65d2c1652f08	psychometric	growth_potential	mid	high	How do you handle learning failures without losing momentum?	2026-02-09 07:54:36.607221+00	\N
d8dc6844-f361-4bb4-9895-3df82d44319b	psychometric	growth_potential	mid	high	How does learning agility help you manage change?	2026-02-09 07:54:36.607221+00	\N
414e6e1a-2c27-4577-8d6b-52defb196777	psychometric	growth_potential	mid	high	Describe a time learning influenced team effectiveness.	2026-02-09 07:54:36.607221+00	\N
44eccdec-e8db-4c7a-9866-6cb6cecb9d0f	psychometric	growth_potential	mid	high	Why is growth potential critical at the mid-level stage?	2026-02-09 07:54:36.607221+00	\N
890ec6d4-01fe-443d-9f0d-61398c9926db	psychometric	sales_dna	mid	low	How comfortable are you initiating conversations with customers?	2026-02-09 07:58:25.712595+00	\N
b33367eb-f9ac-4df2-ad42-299a1ef316b1	psychometric	sales_dna	mid	low	How important is discipline in a sales role?	2026-02-09 07:58:25.712595+00	\N
920ec2de-53d1-497b-b321-52f36c5c7fb0	psychometric	sales_dna	mid	low	How do you usually prepare before customer interactions?	2026-02-09 07:58:25.712595+00	\N
174664c5-d9ee-4408-a2d4-5f574d75cd35	psychometric	sales_dna	mid	low	How do you feel about following sales processes?	2026-02-09 07:58:25.712595+00	\N
35a2d466-1b4b-4f3f-9016-bf3401c4c66b	psychometric	sales_dna	mid	low	Do you enjoy working toward targets and goals?	2026-02-09 07:58:25.712595+00	\N
39fd3d5c-e51d-44c5-9751-e10f3d44f4df	psychometric	sales_dna	mid	low	How comfortable are you starting conversations with new customers?	2026-02-09 07:58:25.712595+00	\N
ffa64823-06c4-4074-960e-27f7d683862f	psychometric	sales_dna	mid	low	How do you ensure consistency in your daily sales activities?	2026-02-09 07:58:25.712595+00	\N
1336d6f6-0604-4a83-b3b3-f88bff7e27e1	psychometric	sales_dna	mid	low	How do you manage multiple follow-ups with prospects?	2026-02-09 07:58:25.712595+00	\N
eb05bf20-a0dc-452a-a030-48e5ec745a14	psychometric	sales_dna	mid	low	How comfortable are you working with targets and goals?	2026-02-09 07:58:25.712595+00	\N
f8d532f5-384d-438b-9e89-3d35b947f968	psychometric	sales_dna	mid	low	How do you maintain accuracy in sales documentation or CRM updates?	2026-02-09 07:58:25.712595+00	\N
c055a05e-3d32-4c44-aa0e-b4877a7cdc7d	psychometric	sales_dna	mid	low	How do you balance talking and listening during sales conversations?	2026-02-09 07:58:25.712595+00	\N
e3977c15-c371-4317-9ea6-38549e624835	psychometric	sales_dna	mid	low	How do you handle repetitive sales tasks?	2026-02-09 07:58:25.712595+00	\N
15df3c63-17b7-4774-b528-4797fee8ad31	psychometric	sales_dna	mid	low	How do you respond when assigned responsibility for a key lead?	2026-02-09 07:58:25.712595+00	\N
ca5409e2-cf1a-4bf7-b4c8-ee7c29c36592	psychometric	sales_dna	mid	low	How do you stay organized in your sales role?	2026-02-09 07:58:25.712595+00	\N
a0cf7a5e-6d93-4329-8c03-32dfe2185231	psychometric	sales_dna	mid	low	How do you handle customer interactions throughout the day?	2026-02-09 07:58:25.712595+00	\N
24281d3f-38fa-4294-8241-246539834f1e	psychometric	sales_dna	mid	low	How do you ensure commitments made to customers are met?	2026-02-09 07:58:25.712595+00	\N
4dcaf246-d075-4f81-8b02-67bf938806ec	psychometric	sales_dna	mid	low	How do you feel about structured sales processes?	2026-02-09 07:58:25.712595+00	\N
5580c2b5-8bd3-4e44-a885-dd73212bcc6d	psychometric	sales_dna	mid	low	How do you stay disciplined when motivation is low?	2026-02-09 07:58:25.712595+00	\N
0d0e3be2-cbba-4104-967a-518dce3ecce8	psychometric	sales_dna	mid	low	How do you manage time during a busy sales day?	2026-02-09 07:58:25.712595+00	\N
8897d3e5-2939-4d76-92fb-1dbbb06e4428	psychometric	sales_dna	mid	low	How do you approach relationship building with customers?	2026-02-09 07:58:25.712595+00	\N
31a61647-45f5-42a5-9a85-c13643af843d	psychometric	sales_dna	mid	low	How do you ensure quality in your sales work?	2026-02-09 07:58:25.712595+00	\N
ff70ed0d-6f12-4c12-b8a3-d4eb569bf9b3	psychometric	sales_dna	mid	low	How do you respond to routine sales feedback?	2026-02-09 07:58:25.712595+00	\N
e897eb1c-fb51-4920-acc7-7cc41fae30e7	psychometric	sales_dna	mid	low	How do you stay focused during long sales cycles?	2026-02-09 07:58:25.712595+00	\N
3116ee0d-b3bb-48a7-8d43-1c738b50aa4c	psychometric	sales_dna	mid	low	How do you handle responsibility without close supervision?	2026-02-09 07:58:25.712595+00	\N
314c3b8b-401d-4098-8581-9f59d182f96d	psychometric	sales_dna	mid	low	Why is Sales DNA important at the mid-level stage?	2026-02-09 07:58:25.712595+00	\N
fa276c20-277a-4750-871a-43da306c85ce	psychometric	sales_dna	mid	medium	How do you balance being talkative and listening to customers?	2026-02-09 07:58:25.712595+00	\N
11eb463d-b426-4b0d-beab-fad04c91731b	psychometric	sales_dna	mid	medium	How do you ensure accuracy in sales-related tasks?	2026-02-09 07:58:25.712595+00	\N
9b23f4bc-9d27-4cb9-b1d6-586c821ef722	psychometric	sales_dna	mid	medium	How do you stay consistent with follow-ups?	2026-02-09 07:58:25.712595+00	\N
b86d2a93-b00b-4ac0-ae71-a41a6c417cd0	psychometric	sales_dna	mid	medium	How do you handle days with heavy customer interaction?	2026-02-09 07:58:25.712595+00	\N
bc952802-2b58-4e31-a487-2b707157561e	psychometric	sales_dna	mid	medium	How do you take ownership of assigned sales responsibilities?	2026-02-09 07:58:25.712595+00	\N
2acbd49c-f519-472c-911f-2927c7cce9a5	psychometric	sales_dna	mid	medium	How do you maintain customer engagement over multiple interactions?	2026-02-09 07:58:25.712595+00	\N
4aab9a69-6992-4004-a20c-bf1f9b4cef64	psychometric	sales_dna	mid	medium	How do you stay disciplined while managing multiple opportunities?	2026-02-09 07:58:25.712595+00	\N
60750059-017f-44ee-a7cd-6ce5bb515528	psychometric	sales_dna	mid	medium	How do you balance relationship building with meeting targets?	2026-02-09 07:58:25.712595+00	\N
da14f23f-e263-4a73-b76d-03eef2a9a732	psychometric	sales_dna	mid	medium	How do you handle accountability for deals that stall?	2026-02-09 07:58:25.712595+00	\N
cfec348a-0965-4b0c-b6ea-5b334cf8a2c6	psychometric	sales_dna	mid	medium	How do you ensure accuracy while working under sales pressure?	2026-02-09 07:58:25.712595+00	\N
c08850ad-5451-4b47-a025-f00f7d371106	psychometric	sales_dna	mid	medium	How do you adapt your communication style for different prospects?	2026-02-09 07:58:25.712595+00	\N
f2ed222e-db2b-4392-a998-d1b8dcabee2b	psychometric	sales_dna	mid	medium	How do you stay consistent during long sales cycles?	2026-02-09 07:58:25.712595+00	\N
848d22e8-c4d9-4c38-8d13-1f2e000d24c6	psychometric	sales_dna	mid	medium	How do you respond to customer objections professionally?	2026-02-09 07:58:25.712595+00	\N
620b4c83-d4c1-4a72-9a87-e7429c4b7773	psychometric	sales_dna	mid	medium	How do you maintain ownership across the sales process?	2026-02-09 07:58:25.712595+00	\N
81ace8e1-6af1-4c82-971d-8d752f261373	psychometric	sales_dna	mid	medium	How do you manage your pipeline to avoid last-minute surprises?	2026-02-09 07:58:25.712595+00	\N
12a3ff36-c83f-4ecc-b2ae-8eeb01bfebbb	psychometric	sales_dna	mid	medium	How do you handle competing priorities in sales execution?	2026-02-09 07:58:25.712595+00	\N
94c7126e-f893-491f-8e81-b635fa31b88a	psychometric	sales_dna	mid	medium	How do you maintain motivation during slow sales periods?	2026-02-09 07:58:25.712595+00	\N
bf564f6d-1f5f-4f45-8b47-64980e6c3112	psychometric	sales_dna	mid	medium	How do you ensure follow-through after customer meetings?	2026-02-09 07:58:25.712595+00	\N
ca7a4823-3c49-49d9-ab59-bca4a81beb55	psychometric	sales_dna	mid	medium	How do you stay organized while handling relationship-driven sales?	2026-02-09 07:58:25.712595+00	\N
aab2be33-9b85-43f9-9825-bf199e7749b4	psychometric	sales_dna	mid	medium	How do you balance speed and quality in sales execution?	2026-02-09 07:58:25.712595+00	\N
db8743ad-b6e5-4352-9bcf-8ca803ce5b25	psychometric	sales_dna	mid	medium	How do you ensure reliability in customer commitments?	2026-02-09 07:58:25.712595+00	\N
b21cfa50-e863-428a-948e-c1cfa4d7c22d	psychometric	sales_dna	mid	medium	How do you improve your sales effectiveness over time?	2026-02-09 07:58:25.712595+00	\N
73360f5d-5362-4984-881d-71878a834865	psychometric	sales_dna	mid	medium	How do you stay professional in emotionally charged customer situations?	2026-02-09 07:58:25.712595+00	\N
f886aa6e-923c-400f-90a6-45c310472e50	psychometric	sales_dna	mid	medium	How do you ensure discipline without close supervision?	2026-02-09 07:58:25.712595+00	\N
799980f8-7891-457d-86ef-726d51db0239	psychometric	sales_dna	mid	medium	Why is Sales DNA critical at the mid-level stage?	2026-02-09 07:58:25.712595+00	\N
ac9e60e9-e1c3-4a10-8313-eb8272741530	psychometric	sales_dna	mid	high	Describe a situation where you had to be confident with customers while strictly following sales processes.	2026-02-09 07:58:25.712595+00	\N
c9017cc0-bbff-4adf-8711-2b5506663148	psychometric	sales_dna	mid	high	How do you manage high customer interaction without compromising task accuracy?	2026-02-09 07:58:25.712595+00	\N
a7c5e386-f56e-44e2-b235-c49cfcc03276	psychometric	sales_dna	mid	high	Tell me about a time you stayed organized while handling multiple sales conversations.	2026-02-09 07:58:25.712595+00	\N
71fed9b8-bb61-42cf-8bab-de892ae9f994	psychometric	sales_dna	mid	high	How do you maintain energy and discipline during repetitive sales cycles?	2026-02-09 07:58:25.712595+00	\N
d2f4da89-309f-41bb-a0d8-cdda009675ca	psychometric	sales_dna	mid	high	Why are extraversion and conscientiousness critical for mid-level sales success?	2026-02-09 07:58:25.712595+00	\N
a3224dc4-c8b6-4441-9853-1f6a0ba77b2c	psychometric	sales_dna	mid	high	Describe a situation where you had to drive a deal despite strong internal and external resistance.	2026-02-09 07:58:25.712595+00	\N
772127f4-0f9f-40bc-8f95-ebee6eba9774	psychometric	sales_dna	mid	high	How do you maintain sales discipline when targets are at risk?	2026-02-09 07:58:25.712595+00	\N
1cb81f4d-4106-4c07-8d92-9257dc4c3890	psychometric	sales_dna	mid	high	Tell me about a time you balanced relationship trust with strict compliance.	2026-02-09 07:58:25.712595+00	\N
8c45282c-543e-473f-8dba-7ed37f4dae77	psychometric	sales_dna	mid	high	Describe a situation where your follow-through directly impacted revenue.	2026-02-09 07:58:25.712595+00	\N
dfd76d03-fe9e-4d65-9d19-e4b93b7be592	psychometric	sales_dna	mid	high	How do you stay effective when managing emotionally demanding customers?	2026-02-09 07:58:25.712595+00	\N
dcb7b35a-597c-4930-be79-ebd18b28d425	psychometric	sales_dna	mid	high	Describe a time you had to choose quality over speed in sales execution.	2026-02-09 07:58:25.712595+00	\N
5d77f275-ac6f-4fe4-9f45-7e93dd732a7e	psychometric	sales_dna	mid	high	How do you maintain ownership across long, uncertain sales cycles?	2026-02-09 07:58:25.712595+00	\N
40beeb46-2592-4433-bda8-4b091d4c98ff	psychometric	sales_dna	mid	high	Tell me about a time discipline helped you recover a weak pipeline.	2026-02-09 07:58:25.712595+00	\N
947aba24-8abf-4cf0-aef5-8eba78459f74	psychometric	sales_dna	mid	high	How do you ensure accountability when outcomes depend on others?	2026-02-09 07:58:25.712595+00	\N
36fbcfde-1118-4320-9ecf-871c7499b67c	psychometric	sales_dna	mid	high	Describe a time when discipline prevented a potential sales failure.	2026-02-09 07:58:25.712595+00	\N
8c6933c9-daa5-409b-b26c-c3b547724672	psychometric	sales_dna	mid	high	How do you manage confidence without over-promising?	2026-02-09 07:58:25.712595+00	\N
6f5ced8b-c363-4c51-8f6f-4de095451c81	psychometric	sales_dna	mid	high	Describe a time you had to re-engage a disengaged prospect.	2026-02-09 07:58:25.712595+00	\N
34e84ba8-56f5-4650-ac92-90b89952907c	psychometric	sales_dna	mid	high	How do you handle pressure without compromising accuracy?	2026-02-09 07:58:25.712595+00	\N
81a7fd45-9711-48a3-a89f-4264318d6af6	psychometric	sales_dna	mid	high	Tell me about a time your planning prevented last-minute escalation.	2026-02-09 07:58:25.712595+00	\N
a999995d-7102-43d1-972e-702b15841a26	psychometric	sales_dna	mid	high	How do you maintain consistency when motivation fluctuates?	2026-02-09 07:58:25.712595+00	\N
449ccc98-c525-4e1b-9ce4-18e091cf2119	psychometric	sales_dna	mid	high	Describe a time you had to say no to protect long-term sales value.	2026-02-09 07:58:25.712595+00	\N
ab4ccf95-562c-43ac-8c63-d031aa3095de	psychometric	sales_dna	mid	high	How do you ensure follow-ups donÔÇÖt become mechanical?	2026-02-09 07:58:25.712595+00	\N
4f52f40d-c360-49a4-83ab-a9b8d27a1da3	psychometric	sales_dna	mid	high	Tell me about a time discipline helped you manage sales complexity.	2026-02-09 07:58:25.712595+00	\N
34d7f603-bc83-47fa-8b95-bf57093fc270	psychometric	sales_dna	mid	high	How do you keep accountability high without micromanagement?	2026-02-09 07:58:25.712595+00	\N
edbc7c27-05c0-48fb-8b1f-28818b6791c9	psychometric	sales_dna	mid	high	Why does Sales DNA become more critical at mid-level experience?	2026-02-09 07:58:25.712595+00	\N
96b1a28a-fbc8-42e4-ac14-07fbd5c96674	psychometric	burnout_risk	senior	low	How do you usually feel after handling multiple responsibilities in a day?	2026-02-09 08:00:44.062037+00	\N
b351ec76-e04a-492d-ba7c-c21a9b90d04a	psychometric	burnout_risk	senior	low	How do you manage your workload at a senior level?	2026-02-09 08:00:44.062037+00	\N
8a124a1d-08cf-4825-aba7-828bd5adc3c4	psychometric	burnout_risk	senior	low	How comfortable are you setting boundaries at work?	2026-02-09 08:00:44.062037+00	\N
8cfbedd6-fc21-453f-81e8-90a06de303d3	psychometric	burnout_risk	senior	low	How do you view work-life balance at this stage of your career?	2026-02-09 08:00:44.062037+00	\N
a4657b36-fa8f-493f-928b-857a4221e3ab	psychometric	burnout_risk	senior	low	How do you react to extended periods of high pressure?	2026-02-09 08:00:44.062037+00	\N
779fb6ec-f35d-4f13-90ef-ff96edd21cc6	psychometric	burnout_risk	senior	low	How do you usually feel at the end of a busy workday?	2026-02-09 08:00:44.062037+00	\N
aed43483-d00d-4149-942e-4e5f164e5a29	psychometric	burnout_risk	senior	low	How do you manage your workload on a regular basis?	2026-02-09 08:00:44.062037+00	\N
2bbd0559-74c1-4ddf-b04c-f73f9682e0de	psychometric	burnout_risk	senior	low	How comfortable are you taking breaks during work hours?	2026-02-09 08:00:44.062037+00	\N
0b62f492-7a15-4677-845a-3527ec409a48	psychometric	burnout_risk	senior	low	How do you respond to extended working hours?	2026-02-09 08:00:44.062037+00	\N
74efbd6c-fa8c-42d8-be85-ea4671c0971f	psychometric	burnout_risk	senior	low	How do you balance work responsibilities and personal time?	2026-02-09 08:00:44.062037+00	\N
a0ef7f50-4e9c-4d8e-9d29-39906eb5c797	psychometric	burnout_risk	senior	low	How do you handle periods of high workload?	2026-02-09 08:00:44.062037+00	\N
0df341a9-c92c-4274-bf0f-1813a0bfb512	psychometric	burnout_risk	senior	low	How do you notice early signs of stress or fatigue?	2026-02-09 08:00:44.062037+00	\N
e56abc34-25aa-44c5-a157-ac2add8f04c6	psychometric	burnout_risk	senior	low	How do you manage stress during demanding projects?	2026-02-09 08:00:44.062037+00	\N
754fc816-b6c8-4683-b21a-752deb56918a	psychometric	burnout_risk	senior	low	How do you respond when pressure continues for long periods?	2026-02-09 08:00:44.062037+00	\N
5ad16f5b-4a43-47f3-9b4b-1db515621ed7	psychometric	burnout_risk	senior	low	How do you maintain motivation during repetitive work cycles?	2026-02-09 08:00:44.062037+00	\N
8a417d84-c29c-4016-909d-1282f9a530dc	psychometric	burnout_risk	senior	low	How do you ensure you do not overcommit at work?	2026-02-09 08:00:44.062037+00	\N
31f93ef8-dd7f-4280-8ffd-99e889ce0c2c	psychometric	burnout_risk	senior	low	How do you recharge after intense work phases?	2026-02-09 08:00:44.062037+00	\N
559306d1-247c-429a-b4a0-aff96314de28	psychometric	burnout_risk	senior	low	How do you communicate when workload becomes overwhelming?	2026-02-09 08:00:44.062037+00	\N
a76b1602-dc30-40fa-b53b-f3c2252795b4	psychometric	burnout_risk	senior	low	How do you maintain consistency without exhaustion?	2026-02-09 08:00:44.062037+00	\N
fed6594d-03e9-4e16-b315-88aaf9758d9f	psychometric	burnout_risk	senior	low	How do you manage emotional stress from work responsibilities?	2026-02-09 08:00:44.062037+00	\N
50c87910-4936-46bb-8c4e-41f90f23bb8b	psychometric	burnout_risk	senior	low	How do you handle multiple responsibilities at once?	2026-02-09 08:00:44.062037+00	\N
49b590ef-9521-4429-b922-cf5e63d470d0	psychometric	burnout_risk	senior	low	How do you ensure long-term sustainability in your role?	2026-02-09 08:00:44.062037+00	\N
8029c411-c25e-44af-92e8-46f8f1cffd68	psychometric	burnout_risk	senior	low	How do you respond when you feel mentally drained?	2026-02-09 08:00:44.062037+00	\N
7776a31b-4be4-4a56-a799-fce2cb629f98	psychometric	burnout_risk	senior	low	How do you prevent stress from affecting performance?	2026-02-09 08:00:44.062037+00	\N
013e7d94-017e-4a18-ba75-f6fc40d6eaa6	psychometric	burnout_risk	senior	low	Why is burnout awareness important at your career stage?	2026-02-09 08:00:44.062037+00	\N
fb27690d-dcb4-4e32-81a7-4e5cfab2f88e	psychometric	burnout_risk	senior	medium	How do you handle prolonged high workloads without burning out?	2026-02-09 08:00:44.062037+00	\N
d1e158c2-5411-44f2-a40d-50f7f6c30654	psychometric	burnout_risk	senior	medium	How do you recognize early signs of burnout in yourself?	2026-02-09 08:00:44.062037+00	\N
24ccb030-7c46-4147-8f70-5671e5758fff	psychometric	burnout_risk	senior	medium	How do you manage stress during critical business phases?	2026-02-09 08:00:44.062037+00	\N
8cc07ebb-14b4-4d7e-9e40-43811a664860	psychometric	burnout_risk	senior	medium	How do you balance leadership responsibilities with personal well-being?	2026-02-09 08:00:44.062037+00	\N
4429d4f4-dedb-4e37-a84d-b8dd1b458431	psychometric	burnout_risk	senior	medium	How do you maintain motivation during repetitive or long-term initiatives?	2026-02-09 08:00:44.062037+00	\N
ddee0473-55a6-40c3-a356-37df2124ad38	psychometric	burnout_risk	senior	medium	Describe a time when sustained workload began affecting your energy.	2026-02-09 08:00:44.062037+00	\N
5b77e9aa-dad2-40e9-8d60-7ad21bf7c3c7	psychometric	burnout_risk	senior	medium	How do you manage emotional stress during long projects?	2026-02-09 08:00:44.062037+00	\N
147252dd-1b44-4b7e-b51f-029622c4c415	psychometric	burnout_risk	senior	medium	Describe how pressure has impacted your motivation over time.	2026-02-09 08:00:44.062037+00	\N
18ebe274-72e7-43c8-9622-155c1674697c	psychometric	burnout_risk	senior	medium	How do you identify when work stress becomes unhealthy?	2026-02-09 08:00:44.062037+00	\N
fb0b1863-d003-460c-92b4-4d24baa7cd43	psychometric	burnout_risk	senior	medium	Describe a time when you had to reset boundaries to avoid burnout.	2026-02-09 08:00:44.062037+00	\N
d6f4512c-7a67-4961-ae7d-9a9ee2d04da8	psychometric	burnout_risk	senior	medium	How do you recover after intense delivery phases?	2026-02-09 08:00:44.062037+00	\N
ae3efcd3-e0ba-46ea-9184-9853adf153d3	psychometric	burnout_risk	senior	medium	How do you handle continuous responsibility without exhaustion?	2026-02-09 08:00:44.062037+00	\N
ff199494-96ce-4892-8e7a-8e6c06dffe3b	psychometric	burnout_risk	senior	medium	Describe a time stress affected your decision-making.	2026-02-09 08:00:44.062037+00	\N
12cae077-26d9-498b-ba8a-f733f5aa9f34	psychometric	burnout_risk	senior	medium	How do you manage mental fatigue over long periods?	2026-02-09 08:00:44.062037+00	\N
68813e49-ea0f-47d0-a980-7407d0e09a2d	psychometric	burnout_risk	senior	medium	How do you prevent burnout while maintaining performance?	2026-02-09 08:00:44.062037+00	\N
c152c943-1de3-41ad-a2ae-3f0d2250ba7a	psychometric	burnout_risk	senior	medium	Describe a time you felt mentally overloaded.	2026-02-09 08:00:44.062037+00	\N
363f097f-21e4-469d-aeb3-eb1ece5efb3c	psychometric	burnout_risk	senior	medium	How do you maintain emotional balance under pressure?	2026-02-09 08:00:44.062037+00	\N
531e969d-c748-4af7-b100-7015bd9cdbce	psychometric	burnout_risk	senior	medium	Describe how workload creep affected you.	2026-02-09 08:00:44.062037+00	\N
07230845-76d1-4710-b62c-d8cfdb4ab17d	psychometric	burnout_risk	senior	medium	How do you manage expectations to reduce burnout risk?	2026-02-09 08:00:44.062037+00	\N
c14dd3f5-e673-4766-a935-e60daaeacab4	psychometric	burnout_risk	senior	medium	How do you handle pressure without compromising health?	2026-02-09 08:00:44.062037+00	\N
b3b69e2f-52c4-4380-9f86-be840f811894	psychometric	burnout_risk	senior	medium	Describe a time burnout risk influenced your planning.	2026-02-09 08:00:44.062037+00	\N
6d85c0d1-dd38-41fb-9cac-268c87506e05	psychometric	burnout_risk	senior	medium	How do you manage long-term stress accumulation?	2026-02-09 08:00:44.062037+00	\N
1db7d5f9-cec6-4975-a6fb-f65eb54c8560	psychometric	burnout_risk	senior	medium	Describe how fatigue changed your work behavior.	2026-02-09 08:00:44.062037+00	\N
3986d9a4-adfe-45f7-a55e-a598386c4edc	psychometric	burnout_risk	senior	medium	How do you prevent emotional exhaustion in leadership roles?	2026-02-09 08:00:44.062037+00	\N
39deb464-5481-497e-abbb-3561dbeda1c8	psychometric	burnout_risk	senior	medium	Why is burnout risk management critical at your experience level?	2026-02-09 08:00:44.062037+00	\N
b5b0b2d2-e981-485f-a9b5-409a80b71047	psychometric	burnout_risk	senior	high	Describe a time when you were close to burnout and how you managed it.	2026-02-09 08:00:44.062037+00	\N
45b00a84-cd45-4e53-90ce-a246fc4f7506	psychometric	burnout_risk	senior	high	How do you prevent burnout when organizational demands keep increasing?	2026-02-09 08:00:44.062037+00	\N
0a3dbe65-eb8d-4c8d-b197-b1b779d686ff	psychometric	burnout_risk	senior	high	Tell me about a situation where stress impacted your leadership effectiveness and how you recovered.	2026-02-09 08:00:44.062037+00	\N
b3daab18-5f54-4696-9c36-43dafaa67e4a	psychometric	burnout_risk	senior	high	How do you continue leading effectively when mental or emotional fatigue builds up?	2026-02-09 08:00:44.062037+00	\N
8f1416e7-7d10-4623-a364-278b96d8703c	psychometric	burnout_risk	senior	high	Why is burnout awareness critical at the senior stage of your career?	2026-02-09 08:00:44.062037+00	\N
e4964231-e019-42ee-8b81-3b936537513d	psychometric	burnout_risk	senior	high	Describe a period when prolonged pressure threatened your long-term performance.	2026-02-09 08:00:44.062037+00	\N
260de915-ed68-4414-b225-61573f0295de	psychometric	burnout_risk	senior	high	How have you handled chronic stress without sacrificing leadership effectiveness?	2026-02-09 08:00:44.062037+00	\N
5522a80e-8edd-4ea9-a82c-8c81da7a976c	psychometric	burnout_risk	senior	high	Describe a time when burnout risk affected your strategic judgment.	2026-02-09 08:00:44.062037+00	\N
db60916d-3a91-4654-8833-1c5b0d69350d	psychometric	burnout_risk	senior	high	How do you sustain output during extended high-intensity phases?	2026-02-09 08:00:44.062037+00	\N
8c142c68-cdef-4930-8be2-872b5c56670d	psychometric	burnout_risk	senior	high	Describe how leadership responsibility increased burnout risk.	2026-02-09 08:00:44.062037+00	\N
553c398c-9ece-4897-aae6-50fe52c26f45	psychometric	burnout_risk	senior	high	How do you detect burnout risk before performance declines?	2026-02-09 08:00:44.062037+00	\N
22b564b8-da92-4526-aa6c-34f1103a44fc	psychometric	burnout_risk	senior	high	Describe a time exhaustion influenced your leadership behavior.	2026-02-09 08:00:44.062037+00	\N
4a21eec5-4cd5-46ab-ba84-8f75af9a8e76	psychometric	burnout_risk	senior	high	How do you manage emotional fatigue at scale?	2026-02-09 08:00:44.062037+00	\N
b49d747a-95a7-48e0-8d43-899a0a4097b4	psychometric	burnout_risk	senior	high	Describe how prolonged stress affected your cognitive performance.	2026-02-09 08:00:44.062037+00	\N
ad4c207c-2714-4d38-a43f-3d9ae5a44fb8	psychometric	burnout_risk	senior	high	How do you protect long-term energy while meeting aggressive goals?	2026-02-09 08:00:44.062037+00	\N
df2a3ed3-4836-4f98-959f-5841d2a0ec14	psychometric	burnout_risk	senior	high	Describe a time burnout risk forced a leadership reset.	2026-02-09 08:00:44.062037+00	\N
13286676-69d4-436f-a0b7-5eac2be375d9	psychometric	burnout_risk	senior	high	How do you manage stress when recovery time is limited?	2026-02-09 08:00:44.062037+00	\N
fd1df266-0097-4e57-9f31-15007ce6f12b	psychometric	burnout_risk	senior	high	Describe a time when ignoring stress signals led to impact.	2026-02-09 08:00:44.062037+00	\N
588f08d8-670b-4f82-bf53-3cf2f3311468	psychometric	burnout_risk	senior	high	How do you maintain judgment quality under exhaustion?	2026-02-09 08:00:44.062037+00	\N
4bd17a42-1842-4763-972c-57eb24f86a4d	psychometric	burnout_risk	senior	high	Describe burnout risk during a transformation phase.	2026-02-09 08:00:44.062037+00	\N
1f1ae34a-9fa2-401d-993a-7f69aea4d8f2	psychometric	burnout_risk	senior	high	How do you prevent cumulative burnout across years?	2026-02-09 08:00:44.062037+00	\N
0115ea5d-4b01-4673-8f72-674c57c437de	psychometric	burnout_risk	senior	high	Describe how burnout risk influenced people decisions.	2026-02-09 08:00:44.062037+00	\N
d2e8ad8e-aa43-4040-b38f-a22bf462e130	psychometric	burnout_risk	senior	high	How do you manage burnout risk during constant change?	2026-02-09 08:00:44.062037+00	\N
da3877b3-3e27-4bc9-9577-59b65fa504c7	psychometric	burnout_risk	senior	high	Describe a time burnout risk altered delivery timelines.	2026-02-09 08:00:44.062037+00	\N
f7a09c3f-bb7a-4f8c-b39e-d38d8e8eec77	psychometric	burnout_risk	senior	high	Why is burnout risk management critical at your experience level?	2026-02-09 08:00:44.062037+00	\N
f41b895d-beed-41a4-98f8-944a6bce1cd8	psychometric	growth_potential	senior	low	How important is continuous growth at the senior stage of your career?	2026-02-09 08:02:54.672273+00	\N
a92c35ce-c044-4efa-95a1-dbeee433b71b	psychometric	growth_potential	senior	low	How do you approach new challenges at work?	2026-02-09 08:02:54.672273+00	\N
002f5b34-9029-447f-a3b7-825199e5da50	psychometric	growth_potential	senior	low	How comfortable are you learning new skills or domains?	2026-02-09 08:02:54.672273+00	\N
77886da9-9076-431b-8ddd-a80c9069ac31	psychometric	growth_potential	senior	low	How do you feel about taking on expanded responsibilities?	2026-02-09 08:02:54.672273+00	\N
a97a3b10-9dff-4832-a1e5-e30bd059d6c8	psychometric	growth_potential	senior	low	How do you stay motivated to improve continuously?	2026-02-09 08:02:54.672273+00	\N
90612196-6277-4497-9bc4-56a328448414	psychometric	growth_potential	senior	low	How important is continuous learning in your current role?	2026-02-09 08:02:54.672273+00	\N
6ed9389c-bcaa-4371-8292-adc5a172152d	psychometric	growth_potential	senior	low	How do you usually respond to new learning opportunities at work?	2026-02-09 08:02:54.672273+00	\N
cc08efb3-53be-48b7-8773-1e90ec6f07ee	psychometric	growth_potential	senior	low	How comfortable are you learning new skills at this stage of your career?	2026-02-09 08:02:54.672273+00	\N
e45b02a3-a7ab-4250-9201-cf7f045350f4	psychometric	growth_potential	senior	low	How do you usually improve an existing skill?	2026-02-09 08:02:54.672273+00	\N
f8c707fb-5c6f-4f9a-8e29-5d6fff00b851	psychometric	growth_potential	senior	low	How do you stay motivated to grow professionally?	2026-02-09 08:02:54.672273+00	\N
be5792e7-5395-4db8-a8e8-a728e30b9ed6	psychometric	growth_potential	senior	low	How do you approach learning something outside your expertise?	2026-02-09 08:02:54.672273+00	\N
de344cc7-df77-4121-856d-053cd5da20d2	psychometric	growth_potential	senior	low	How do you handle feedback related to skill gaps?	2026-02-09 08:02:54.672273+00	\N
4232c341-733a-49e3-a225-2b9812ce143a	psychometric	growth_potential	senior	low	How do you balance learning with daily responsibilities?	2026-02-09 08:02:54.672273+00	\N
092f7ce2-60df-4ed6-8f55-cb8a522f150e	psychometric	growth_potential	senior	low	How do you keep yourself updated with industry knowledge?	2026-02-09 08:02:54.672273+00	\N
00d43d5c-782d-4818-8be4-83addad2845c	psychometric	growth_potential	senior	low	How do you usually set learning goals for yourself?	2026-02-09 08:02:54.672273+00	\N
7cd99e33-945c-428f-89d0-4e29c994337a	psychometric	growth_potential	senior	low	How open are you to changing your working style to grow?	2026-02-09 08:02:54.672273+00	\N
1e769deb-0821-4f14-982b-59321ba1d73d	psychometric	growth_potential	senior	low	How do you react when learning feels slow?	2026-02-09 08:02:54.672273+00	\N
02713929-d4a8-4f36-af18-3c9fd3b43275	psychometric	growth_potential	senior	low	How do you use past experience to accelerate learning?	2026-02-09 08:02:54.672273+00	\N
c26c7cab-7997-46ce-85e5-78b56859775f	psychometric	growth_potential	senior	low	How do you ensure learning translates into performance?	2026-02-09 08:02:54.672273+00	\N
319bfb19-7b06-425f-80c9-7158f0643956	psychometric	growth_potential	senior	low	How do you grow beyond your current role expectations?	2026-02-09 08:02:54.672273+00	\N
f3750d63-e581-4b50-99ab-4b0b08b9ffc3	psychometric	growth_potential	senior	low	How do you maintain a growth mindset at mid-career?	2026-02-09 08:02:54.672273+00	\N
df6bca4d-0a97-4676-b563-408c5d9fa078	psychometric	growth_potential	senior	low	How do you prioritize learning among multiple demands?	2026-02-09 08:02:54.672273+00	\N
037ec652-d442-41f9-afc1-2ad1ce3989b3	psychometric	growth_potential	senior	low	How do you measure your professional growth?	2026-02-09 08:02:54.672273+00	\N
6ecfb232-4372-4f69-a0e7-b6863ac2ec6f	psychometric	growth_potential	senior	low	How do you encourage learning within your team?	2026-02-09 08:02:54.672273+00	\N
c354aa31-3702-435d-993f-231508f3b9ba	psychometric	growth_potential	senior	low	Why is growth potential important at this career stage?	2026-02-09 08:02:54.672273+00	\N
d0e82c2f-50a0-4275-8b3f-8d049a905b38	psychometric	growth_potential	senior	medium	Describe a time you proactively worked on developing new capabilities.	2026-02-09 08:02:54.672273+00	\N
805fce40-84e4-4f9a-89fd-37115820280e	psychometric	growth_potential	senior	medium	How do you handle feedback aimed at improving your leadership effectiveness?	2026-02-09 08:02:54.672273+00	\N
6c1c90da-9ad5-4486-a268-abdf52207a25	psychometric	growth_potential	senior	medium	How do you balance delivering results with preparing for future roles?	2026-02-09 08:02:54.672273+00	\N
9cecfab9-68af-46a6-9ad3-406d92b8e94e	psychometric	growth_potential	senior	medium	How do you approach responsibilities that stretch your capabilities?	2026-02-09 08:02:54.672273+00	\N
ced8dca4-9a54-42af-832e-9e21995295e1	psychometric	growth_potential	senior	medium	How do you ensure continuous development at a senior level?	2026-02-09 08:02:54.672273+00	\N
974f3db7-f738-4ffd-bd8b-c332223886e3	psychometric	growth_potential	senior	medium	How do you ensure continuous growth in a stable role?	2026-02-09 08:02:54.672273+00	\N
7a493a73-7979-42d4-9caf-4131d9276a7f	psychometric	growth_potential	senior	medium	How do you approach learning when role expectations increase?	2026-02-09 08:02:54.672273+00	\N
3182f7f0-946f-4d3b-8e63-be5de31eee0d	psychometric	growth_potential	senior	medium	How do you develop skills beyond your current job scope?	2026-02-09 08:02:54.672273+00	\N
9c385516-5b20-4e16-86a6-775e04dfeae1	psychometric	growth_potential	senior	medium	How do you respond when learning requires unlearning old habits?	2026-02-09 08:02:54.672273+00	\N
8d61377a-a288-4bd6-8b02-f5d9260b4b0b	psychometric	growth_potential	senior	medium	How do you stay relevant as your role evolves?	2026-02-09 08:02:54.672273+00	\N
52b3d5c4-6ffb-45a8-b9b9-b1e926197778	psychometric	growth_potential	senior	medium	How do you manage learning alongside increasing responsibilities?	2026-02-09 08:02:54.672273+00	\N
67470eee-0345-40e5-93b6-1d3d6b1bba96	psychometric	growth_potential	senior	medium	How do you evaluate which skills to develop next?	2026-02-09 08:02:54.672273+00	\N
484b960d-180e-4cda-a0b7-51112b6d3ccf	psychometric	growth_potential	senior	medium	How do you maintain a learning mindset during routine work?	2026-02-09 08:02:54.672273+00	\N
fd86501e-2fd0-4179-a668-7208ba501f23	psychometric	growth_potential	senior	medium	How do you convert learning into measurable performance gains?	2026-02-09 08:02:54.672273+00	\N
a2c7c172-bd69-47a7-afe9-317ef3196ced	psychometric	growth_potential	senior	medium	How do you grow while managing expectations from stakeholders?	2026-02-09 08:02:54.672273+00	\N
3ebf8f25-df2a-43c7-863f-9153940be826	psychometric	growth_potential	senior	medium	How do you stay motivated to learn after initial career success?	2026-02-09 08:02:54.672273+00	\N
cc490095-ab0f-4047-adbc-58525cda4c28	psychometric	growth_potential	senior	medium	How do you adapt learning strategies as complexity increases?	2026-02-09 08:02:54.672273+00	\N
fa825f23-07a6-4cfd-baae-328e55961321	psychometric	growth_potential	senior	medium	How do you ensure learning aligns with long-term career direction?	2026-02-09 08:02:54.672273+00	\N
1cadd98d-3952-440b-b9ca-96dd4f199f52	psychometric	growth_potential	senior	medium	How do you respond when learning requires sustained effort?	2026-02-09 08:02:54.672273+00	\N
6a601658-9809-49cc-9b64-1d2b646a918b	psychometric	growth_potential	senior	medium	How do you leverage feedback for long-term growth?	2026-02-09 08:02:54.672273+00	\N
2157c0f8-5f66-4d0e-bde5-781878e280ce	psychometric	growth_potential	senior	medium	How do you keep learning relevant across changing roles?	2026-02-09 08:02:54.672273+00	\N
12fa1200-f5f5-470b-ba64-b0958f28fe62	psychometric	growth_potential	senior	medium	How do you encourage your own development without formal training?	2026-02-09 08:02:54.672273+00	\N
1ea2d0d0-dc4c-4d8d-bf9f-f343ca17e226	psychometric	sales_dna	senior	low	How do you typically respond to pressure in sales targets?	2026-02-09 08:05:03.184306+00	\N
d463ba73-1edd-48be-91f3-4e12a86334d1	psychometric	growth_potential	senior	medium	How do you ensure growth despite workload pressure?	2026-02-09 08:02:54.672273+00	\N
806377e5-57b3-4abb-9585-9aea569ccd5b	psychometric	growth_potential	senior	medium	How do you measure your growth over the past few years?	2026-02-09 08:02:54.672273+00	\N
093cdf71-6b1e-42a1-948e-8972f6231372	psychometric	growth_potential	senior	medium	Why is growth potential important at the 5ÔÇô10 year stage?	2026-02-09 08:02:54.672273+00	\N
21a1ea49-5884-4c93-9f64-305919f5a058	psychometric	growth_potential	senior	high	Describe a situation where sustained effort was required for professional growth.	2026-02-09 08:02:54.672273+00	\N
8addbf6a-0b94-4836-aef1-c46510e55dc0	psychometric	growth_potential	senior	high	How do you pursue growth when opportunities involve uncertainty or risk?	2026-02-09 08:02:54.672273+00	\N
3a216902-a11a-47b7-8328-d5d511c575a5	psychometric	growth_potential	senior	high	Tell me about a time you had to change your mindset to continue growing.	2026-02-09 08:02:54.672273+00	\N
5545bed1-7f73-43d5-ad6f-6e6a9209b25e	psychometric	growth_potential	senior	high	How do you continue growing when progress feels slow or incremental?	2026-02-09 08:02:54.672273+00	\N
f6ea7244-6075-4549-bc62-f5e6999124e0	psychometric	growth_potential	senior	high	Why is growth potential critical at the senior stage of your career?	2026-02-09 08:02:54.672273+00	\N
042dfd15-db2c-4b7b-9d6e-eaf92b25c84f	psychometric	growth_potential	senior	high	Describe a time when your growth required redefining your professional identity.	2026-02-09 08:02:54.672273+00	\N
2d8ae1f6-7609-458e-a479-763422dd40d0	psychometric	growth_potential	senior	high	How do you grow when success creates comfort and resistance to change?	2026-02-09 08:02:54.672273+00	\N
b5ec359f-f88c-4f0b-8791-41dd39e95b85	psychometric	growth_potential	senior	high	Describe how you handle growth in highly ambiguous environments.	2026-02-09 08:02:54.672273+00	\N
76d5258e-0954-425b-b14b-e99e125f37b4	psychometric	growth_potential	senior	high	How do you ensure growth when learning outcomes are not immediately visible?	2026-02-09 08:02:54.672273+00	\N
25acf516-aab1-4c3b-8dcb-ee40ad604461	psychometric	growth_potential	senior	high	How do you grow when feedback challenges your self-perception?	2026-02-09 08:02:54.672273+00	\N
66e1d4c7-c5fc-4f98-96e0-f9a43948f4e2	psychometric	growth_potential	senior	high	Describe a situation where growth required letting go of expertise.	2026-02-09 08:02:54.672273+00	\N
680b1293-32a6-4074-a7ae-b549a7d9778a	psychometric	growth_potential	senior	high	How do you grow while managing high expectations from multiple stakeholders?	2026-02-09 08:02:54.672273+00	\N
6f31152b-41df-46d6-a25c-ec1879e0a819	psychometric	growth_potential	senior	high	How do you continue growing after mastering your current role?	2026-02-09 08:02:54.672273+00	\N
317eaefa-4945-4c4d-b454-6375926aab9b	psychometric	growth_potential	senior	high	Describe how you grow when resources for learning are limited.	2026-02-09 08:02:54.672273+00	\N
47d3304a-8ce7-422a-9412-5fac74f1d5c0	psychometric	growth_potential	senior	high	How do you grow without formal role changes or promotions?	2026-02-09 08:02:54.672273+00	\N
7aab753a-b7b3-4f1b-ad11-f3d2203e176d	psychometric	growth_potential	senior	high	How do you handle growth when failure becomes frequent?	2026-02-09 08:02:54.672273+00	\N
90a7a36d-8323-4260-8c85-de10219dc40a	psychometric	growth_potential	senior	high	How do you grow while managing personal limitations?	2026-02-09 08:02:54.672273+00	\N
b9bf2474-236a-4225-bede-74fdd6be0d43	psychometric	growth_potential	senior	high	Describe growth driven by organizational change rather than choice.	2026-02-09 08:02:54.672273+00	\N
d89b76a6-6c68-495a-8883-2bba453bbdd3	psychometric	growth_potential	senior	high	How do you sustain growth across long career phases?	2026-02-09 08:02:54.672273+00	\N
09ef13c7-5db1-4344-9a96-2fa8c3128169	psychometric	growth_potential	senior	high	How do you grow when learning conflicts with delivery pressure?	2026-02-09 08:02:54.672273+00	\N
864c3fa7-7bde-4b4c-aeb1-b2b1962d548f	psychometric	growth_potential	senior	high	How do you grow when your expertise becomes obsolete?	2026-02-09 08:02:54.672273+00	\N
1b79ee7e-867f-46e8-b074-506cda131aa3	psychometric	growth_potential	senior	high	How do you grow while mentoring others?	2026-02-09 08:02:54.672273+00	\N
1bc8afdf-ecd0-44eb-bc2c-551a815a001c	psychometric	growth_potential	senior	high	How do you handle growth when learning creates discomfort or fear?	2026-02-09 08:02:54.672273+00	\N
c453bde9-1c8a-4acd-bac5-bb149ddba2bb	psychometric	growth_potential	senior	high	How do you evaluate whether growth efforts are meaningful?	2026-02-09 08:02:54.672273+00	\N
e7fb14d7-a026-49db-bb96-aeb8a71cfd3a	psychometric	growth_potential	senior	high	Why is growth potential critical at the 5ÔÇô10 year career stage?	2026-02-09 08:02:54.672273+00	\N
aabfcb93-365f-4e3d-8fc7-bd2f17dddb2d	psychometric	sales_dna	senior	low	How important is discipline in senior-level sales roles?	2026-02-09 08:05:03.184306+00	\N
252261fb-f102-4a82-9429-1d5ca9c805ee	psychometric	sales_dna	senior	low	How do you ensure accuracy in forecasts and commitments?	2026-02-09 08:05:03.184306+00	\N
cce7d4d7-ca8b-4356-a743-6960d8ad6d75	psychometric	sales_dna	senior	low	How do you handle routine sales responsibilities?	2026-02-09 08:05:03.184306+00	\N
92218e9c-8a46-4359-8e7c-93b2df4f024b	psychometric	sales_dna	senior	low	How do you stay composed during difficult customer conversations?	2026-02-09 08:05:03.184306+00	\N
4614821a-dd09-42c9-bfe7-fa3d3ce3fea3	psychometric	sales_dna	senior	low	How do you stay consistent in your sales responsibilities?	2026-02-09 08:05:03.184306+00	\N
a6343508-0a26-43be-8bc6-45078ee95506	psychometric	sales_dna	senior	low	How do you remain calm when deals take longer than expected?	2026-02-09 08:05:03.184306+00	\N
331ce4cf-8dd2-456b-8a8f-f0dbdede67e6	psychometric	sales_dna	senior	low	How do you ensure accuracy in sales documentation and follow-ups?	2026-02-09 08:05:03.184306+00	\N
e1abd7c9-2ef3-4333-9766-a879c73439c7	psychometric	sales_dna	senior	low	How do you handle sales pressure without losing focus?	2026-02-09 08:05:03.184306+00	\N
ce1f3df7-3a55-4d8a-b9cb-faabdeea89a5	psychometric	sales_dna	senior	low	How do you maintain professionalism during difficult customer interactions?	2026-02-09 08:05:03.184306+00	\N
58a0506e-91c4-4dcd-8109-fa78476eba53	psychometric	sales_dna	senior	low	How do you ensure sales targets are met consistently?	2026-02-09 08:05:03.184306+00	\N
f3ffafc9-4c9f-4b4f-9fce-2e650da49466	psychometric	sales_dna	senior	low	How do you stay emotionally balanced after a lost deal?	2026-02-09 08:05:03.184306+00	\N
de81b30c-2023-4506-8466-d7e18cf4fe54	psychometric	sales_dna	senior	low	How do you manage repetitive sales tasks without losing discipline?	2026-02-09 08:05:03.184306+00	\N
500d73ef-1803-49c5-b9d2-dc2537826a5d	psychometric	sales_dna	senior	low	How do you respond when customers delay decisions repeatedly?	2026-02-09 08:05:03.184306+00	\N
690321c3-00a8-462d-9ddf-b56fd2c891a9	psychometric	sales_dna	senior	low	How do you ensure compliance with sales processes?	2026-02-09 08:05:03.184306+00	\N
85b7f162-d460-4e59-8316-807fdd41922a	psychometric	sales_dna	senior	low	How do you maintain steady performance during market fluctuations?	2026-02-09 08:05:03.184306+00	\N
00ba80fe-2aa1-4ab7-b13d-3fe69679c27a	psychometric	sales_dna	senior	low	How do you stay organized with multiple client accounts?	2026-02-09 08:05:03.184306+00	\N
00ccd45f-62c5-4566-a40e-8c8977781cdb	psychometric	sales_dna	senior	low	How do you handle rejection without emotional impact?	2026-02-09 08:05:03.184306+00	\N
cd99559d-d60f-4a12-a32f-e8ccb03f5e67	psychometric	sales_dna	senior	low	How do you maintain attention to detail under pressure?	2026-02-09 08:05:03.184306+00	\N
fc9eaf76-9a68-4672-8690-ad92bc7239d5	psychometric	sales_dna	senior	low	How do you ensure reliability in long sales cycles?	2026-02-09 08:05:03.184306+00	\N
ae7d16c8-8bac-4f01-9aa8-294c903447dd	psychometric	sales_dna	senior	low	How do you handle unexpected changes in sales strategy?	2026-02-09 08:05:03.184306+00	\N
91945374-a7de-40c9-adc8-a09c8d30d3cb	psychometric	sales_dna	senior	low	How do you keep yourself accountable for sales commitments?	2026-02-09 08:05:03.184306+00	\N
aa300b27-834c-436e-a4c6-ad1ce25bf779	psychometric	sales_dna	senior	low	How do you stay composed during tough negotiations?	2026-02-09 08:05:03.184306+00	\N
0ca037a7-7d54-4619-af45-e712e4bd57e7	psychometric	sales_dna	senior	low	How do you maintain work discipline during low motivation phases?	2026-02-09 08:05:03.184306+00	\N
008746a3-1848-4e0a-940d-3cf6f4328499	psychometric	sales_dna	senior	low	Why are conscientiousness and emotional stability important in sales at this stage?	2026-02-09 08:05:03.184306+00	\N
63800efb-bf40-4a95-b442-c4b30f41f9f8	psychometric	sales_dna	senior	medium	How do you balance attention to detail with high-volume sales activities?	2026-02-09 08:05:03.184306+00	\N
0d0cb8cb-7c62-4095-9823-81253a2058d3	psychometric	sales_dna	senior	medium	How do you maintain emotional stability during prolonged sales cycles?	2026-02-09 08:05:03.184306+00	\N
3f4c6a22-f069-424b-9f79-9276625e59d1	psychometric	sales_dna	senior	medium	How do you ensure follow-through on complex sales commitments?	2026-02-09 08:05:03.184306+00	\N
3c4c0bd5-d88f-4216-86e6-0f20cc1972df	psychometric	sales_dna	senior	medium	How do you handle rejection or deal delays emotionally?	2026-02-09 08:05:03.184306+00	\N
1e28bfa0-b8ee-4439-a0b1-b0236dad5f23	psychometric	sales_dna	senior	medium	How do you maintain consistency across quarters with fluctuating results?	2026-02-09 08:05:03.184306+00	\N
03b71900-c033-4cf1-b294-7e414bb9d1ef	psychometric	sales_dna	senior	medium	How do you maintain consistency in your sales performance over time?	2026-02-09 08:05:03.184306+00	\N
3567f01e-fbe3-4012-b02d-856d645d1800	psychometric	sales_dna	senior	medium	How do you stay calm when sales results fluctuate unexpectedly?	2026-02-09 08:05:03.184306+00	\N
29b00c98-1781-460a-9723-dd68bb19fb00	psychometric	sales_dna	senior	medium	Describe how you manage deadlines and commitments in sales.	2026-02-09 08:05:03.184306+00	\N
0476a606-44b6-4c80-8026-2614330c2849	psychometric	sales_dna	senior	medium	How do you respond emotionally after losing an important deal?	2026-02-09 08:05:03.184306+00	\N
be3701d4-02c2-41bf-91a3-e69418b37892	psychometric	sales_dna	senior	medium	How do you ensure accuracy in forecasting and reporting?	2026-02-09 08:05:03.184306+00	\N
51c1e8b3-2498-433c-bf62-71075e00b9c9	psychometric	sales_dna	senior	medium	How do you handle pressure during end-of-quarter targets?	2026-02-09 08:05:03.184306+00	\N
9f2aac1d-1d69-47d4-baf2-edca7abf5ea5	psychometric	sales_dna	senior	medium	Describe how you stay organized in complex sales cycles.	2026-02-09 08:05:03.184306+00	\N
b78c5220-f9ce-466d-9b9b-f608c0b2e43a	psychometric	sales_dna	senior	medium	How do you control emotions during difficult customer interactions?	2026-02-09 08:05:03.184306+00	\N
d19ec925-baad-4cd5-a086-fca24dc81eee	psychometric	sales_dna	senior	medium	How do you maintain discipline in routine sales activities?	2026-02-09 08:05:03.184306+00	\N
a3b2da0e-e882-41ee-a9e5-35f51b9e0b60	psychometric	sales_dna	senior	medium	How do you react when customers delay decisions repeatedly?	2026-02-09 08:05:03.184306+00	\N
4ddcb8ae-81f0-4c5f-96d6-583f1e53e706	psychometric	sales_dna	senior	medium	Describe how you balance urgency with accuracy in sales.	2026-02-09 08:05:03.184306+00	\N
339011de-32e6-45f4-9023-c48c99219c75	psychometric	sales_dna	senior	medium	How do you stay emotionally steady during competitive pressure?	2026-02-09 08:05:03.184306+00	\N
57423fc9-a1fa-4bab-9149-0910475e4895	psychometric	sales_dna	senior	medium	How do you ensure follow-through after customer commitments?	2026-02-09 08:05:03.184306+00	\N
fddb06fc-aca2-43a9-8c66-bcd7801657df	psychometric	sales_dna	senior	medium	How do you manage stress during prolonged sales cycles?	2026-02-09 08:05:03.184306+00	\N
69bc2973-b542-401d-8a61-fd71dd6b4250	psychometric	sales_dna	senior	medium	How do you recover emotionally after repeated rejections?	2026-02-09 08:05:03.184306+00	\N
27809bfd-bbbf-4103-a945-b0e81e167558	psychometric	sales_dna	senior	medium	How do you ensure reliability across multiple accounts?	2026-02-09 08:05:03.184306+00	\N
90db0816-c3c4-4a40-91f4-ac2208022e90	psychometric	sales_dna	senior	medium	How do you handle emotionally charged negotiations?	2026-02-09 08:05:03.184306+00	\N
8e7a4f30-21ee-4a65-8c92-9f86c0e2a491	psychometric	sales_dna	senior	medium	How do you prevent small mistakes from escalating in sales processes?	2026-02-09 08:05:03.184306+00	\N
434449c4-7c82-4c70-ab6a-a381731e60e1	behavioral	resilience	fresher	low	What do you do when something doesnÔÇÖt go according to plan?	2026-02-13 09:33:54.735129+00	Score 6: Candidate shows flexibility and emotional control. They should describe a "pivot" moment where they looked for an alternative solution.
e4b58cc4-bba0-4e73-9372-bb04c39584e5	psychometric	sales_dna	senior	medium	How do you stay focused during long sales negotiations?	2026-02-09 08:05:03.184306+00	\N
90a829e7-e95e-4a99-b8fa-b3166852dedb	psychometric	sales_dna	senior	medium	Why are conscientiousness and emotional stability critical for mid-level sales roles?	2026-02-09 08:05:03.184306+00	\N
3d23c1b2-def1-4e80-b0f2-95b97b2b1701	psychometric	sales_dna	senior	high	Describe a time when strong discipline helped you succeed under intense sales pressure.	2026-02-09 08:05:03.184306+00	\N
f51406b4-73c4-431c-b14c-3215f27e32a6	psychometric	sales_dna	senior	high	How do you manage emotional stress while handling high-value or high-risk deals?	2026-02-09 08:05:03.184306+00	\N
d25e2e9e-30f9-4ccd-8494-f0ee7ffa125b	psychometric	sales_dna	senior	high	Tell me about a situation where your attention to detail prevented a major sales issue.	2026-02-09 08:05:03.184306+00	\N
390157a7-4974-4ce4-aa54-184ae7365d7c	psychometric	sales_dna	senior	high	How do you remain emotionally stable during repeated losses or setbacks?	2026-02-09 08:05:03.184306+00	\N
b423b2a8-5f45-43a3-a3fc-28ecf37a6c32	psychometric	sales_dna	senior	high	Why are conscientiousness and emotional stability critical for senior-level sales success?	2026-02-09 08:05:03.184306+00	\N
539410c0-8058-4efa-beb4-a1de9f905993	psychometric	sales_dna	senior	high	How do you maintain performance consistency during prolonged sales pressure?	2026-02-09 08:05:03.184306+00	\N
bb00cdc4-3a46-4268-a8a5-61b9587caaba	psychometric	sales_dna	senior	high	Describe a time you remained calm while a deal was at high risk.	2026-02-09 08:05:03.184306+00	\N
c7e36ea9-b6f8-4045-8c86-c5ed8a20b8b6	psychometric	sales_dna	senior	high	How do you stay disciplined when sales outcomes are uncertain?	2026-02-09 08:05:03.184306+00	\N
ea262432-7790-4b96-b988-9a783f2e1b8b	psychometric	sales_dna	senior	high	Describe how you handle rejection without losing focus.	2026-02-09 08:05:03.184306+00	\N
0bd3f911-08c9-4e9f-9e1d-f7d48269a163	psychometric	sales_dna	senior	high	How do you ensure accuracy when managing complex sales pipelines?	2026-02-09 08:05:03.184306+00	\N
744651cd-c8b0-4d28-b8bd-5bf6b4649b05	psychometric	sales_dna	senior	high	Describe a situation where emotional stability helped close a deal.	2026-02-09 08:05:03.184306+00	\N
9e5da84d-c78b-49bc-a03d-07419510dbec	psychometric	sales_dna	senior	high	How do you manage multiple deadlines without becoming overwhelmed?	2026-02-09 08:05:03.184306+00	\N
d3b5f467-4d3e-44fa-a887-b440e5a9d50c	psychometric	sales_dna	senior	high	How do you stay professional when a client behaves unpredictably?	2026-02-09 08:05:03.184306+00	\N
0ebb140b-0be3-460a-9d62-38659f6a6ca3	psychometric	burnout_risk	leadership	low	How do you view work-life balance at an executive stage?	2026-02-09 08:06:49.107471+00	\N
e1cffe4f-f608-47d6-950b-847696f1d4cc	psychometric	sales_dna	senior	high	Describe how you recover emotionally after losing a major deal.	2026-02-09 08:05:03.184306+00	\N
60daf483-1122-4238-b221-70cdf67bad45	psychometric	sales_dna	senior	high	How do you maintain ethical discipline under quota pressure?	2026-02-09 08:05:03.184306+00	\N
d33d5899-83a6-43f0-adc2-664701ad2d87	psychometric	sales_dna	senior	high	How do you ensure follow-through after verbal client commitments?	2026-02-09 08:05:03.184306+00	\N
b48a6ac3-7d76-4f40-aa4b-3c2623db7e47	psychometric	sales_dna	senior	high	Describe a time emotional restraint prevented escalation.	2026-02-09 08:05:03.184306+00	\N
a2ff29cf-fe8f-4100-8279-e32bbc0d8e99	psychometric	sales_dna	senior	high	How do you avoid burnout while maintaining sales rigor?	2026-02-09 08:05:03.184306+00	\N
563bba92-e229-4256-9037-f992146079e9	psychometric	sales_dna	senior	high	Describe how conscientiousness improves your forecasting accuracy.	2026-02-09 08:05:03.184306+00	\N
be7b6fe6-e181-4ed4-8c49-d6234d49c57c	psychometric	sales_dna	senior	high	How do you remain composed during aggressive negotiations?	2026-02-09 08:05:03.184306+00	\N
46169aaa-897f-4390-833b-f1ef24626261	psychometric	sales_dna	senior	high	How do you ensure reliability when managing long sales cycles?	2026-02-09 08:05:03.184306+00	\N
297b6d43-7c29-4ab7-a6bf-37dc75c61e97	psychometric	sales_dna	senior	high	How do you manage stress without letting it affect client interactions?	2026-02-09 08:05:03.184306+00	\N
26eb4c42-b645-4a50-a286-aca3dee310ef	psychometric	sales_dna	senior	high	Describe how discipline supports trust in client relationships.	2026-02-09 08:05:03.184306+00	\N
92cbc85f-9f52-4fce-aad9-9dacdef3ab07	psychometric	sales_dna	senior	high	How do you prevent emotional highs and lows from impacting performance?	2026-02-09 08:05:03.184306+00	\N
1e7e79c4-cfab-49f2-8e64-dadd4b863e62	psychometric	sales_dna	senior	high	Why are conscientiousness and emotional stability critical for mid-level sales success?	2026-02-09 08:05:03.184306+00	\N
55bc3221-c33b-4389-803a-4cd3ebd7e2ae	psychometric	burnout_risk	leadership	low	How do you generally feel after managing executive-level responsibilities daily?	2026-02-09 08:06:49.107471+00	\N
5d07b0b8-bcd2-41f4-901a-dfc128318673	psychometric	burnout_risk	leadership	low	How do you manage workload at a leadership level?	2026-02-09 08:06:49.107471+00	\N
86473b0f-e207-4ae9-8490-6c0d442b2748	psychometric	burnout_risk	leadership	low	How comfortable are you setting boundaries despite senior responsibilities?	2026-02-09 08:06:49.107471+00	\N
c61930cf-da36-4362-9bbb-f6f3e7977c42	psychometric	burnout_risk	leadership	low	How do you respond to prolonged periods of organizational pressure?	2026-02-09 08:06:49.107471+00	\N
32d84cf6-fa8c-4616-80f2-f2d58b25496f	psychometric	burnout_risk	leadership	low	How do you usually feel at the end of a long workday?	2026-02-09 08:06:49.107471+00	\N
5e3c6925-b66d-4211-b0e1-b68fbe37953e	psychometric	burnout_risk	leadership	low	How do you manage your energy during busy weeks?	2026-02-09 08:06:49.107471+00	\N
44f65ad9-3c8d-4099-a811-b18a7959b615	psychometric	burnout_risk	leadership	low	How comfortable are you taking breaks during work?	2026-02-09 08:06:49.107471+00	\N
f90e6496-0ac8-4b0f-a22e-2ac8c7b3e276	psychometric	burnout_risk	leadership	low	How do you usually react to increased workload?	2026-02-09 08:06:49.107471+00	\N
faf3e82f-6732-4701-b3d5-ba3a2f8879ac	psychometric	burnout_risk	leadership	low	How do you maintain workÔÇôlife balance?	2026-02-09 08:06:49.107471+00	\N
b82c3dff-853b-4c22-8862-ea7a769da0de	psychometric	burnout_risk	leadership	low	How do you notice early signs of stress?	2026-02-09 08:06:49.107471+00	\N
c5c8089f-7b41-4941-9de2-e8b9551f4942	psychometric	burnout_risk	leadership	low	How do you usually handle tight deadlines?	2026-02-09 08:06:49.107471+00	\N
52e28dcc-93e8-4229-9af2-afc8f87dc5d3	psychometric	burnout_risk	leadership	low	How do you recharge after stressful work periods?	2026-02-09 08:06:49.107471+00	\N
3e4d1f49-0b66-4117-8375-309ac666f107	psychometric	burnout_risk	leadership	low	How do you manage multiple responsibilities without feeling overwhelmed?	2026-02-09 08:06:49.107471+00	\N
ddb3b669-9a9a-443b-ad5d-1b7eb3c0a5e0	psychometric	burnout_risk	leadership	low	How do you feel about saying no to extra work when needed?	2026-02-09 08:06:49.107471+00	\N
b480356c-734b-4ddd-81b8-a265a6f96a3f	psychometric	burnout_risk	leadership	low	How do you maintain motivation during routine work?	2026-02-09 08:06:49.107471+00	\N
7cedceba-ef65-4a56-b789-a3833f9e06f4	psychometric	burnout_risk	leadership	low	How do you respond when stress lasts longer than expected?	2026-02-09 08:06:49.107471+00	\N
a417015d-8cb8-40ce-ba58-a8e1d6701252	psychometric	burnout_risk	leadership	low	How do you keep work pressure from affecting personal life?	2026-02-09 08:06:49.107471+00	\N
05e0eaa2-b6b5-432e-b80a-b6f466d2ffc7	psychometric	burnout_risk	leadership	low	How do you stay productive without overworking?	2026-02-09 08:06:49.107471+00	\N
5d1854e6-20cf-4c57-abe6-44a33186fffb	psychometric	burnout_risk	leadership	low	How do you usually handle mental fatigue?	2026-02-09 08:06:49.107471+00	\N
2a85d493-bd65-4685-a8cf-700cb269e3e3	psychometric	burnout_risk	leadership	low	How do you plan work to avoid burnout?	2026-02-09 08:06:49.107471+00	\N
73fc5fd8-fe27-4c28-9578-edc1e8c9209f	psychometric	burnout_risk	leadership	low	How do you respond when work becomes emotionally draining?	2026-02-09 08:06:49.107471+00	\N
cc89da8c-7052-4bba-9aac-7bd4d8e5b24a	psychometric	burnout_risk	leadership	low	How do you protect long-term health at work?	2026-02-09 08:06:49.107471+00	\N
1afe8c4c-99ad-4b3a-9b2f-1217654deffb	psychometric	burnout_risk	leadership	low	How do you avoid burnout during peak business cycles?	2026-02-09 08:06:49.107471+00	\N
a592db2e-930e-4a6a-b940-9e5af1ab5cf9	psychometric	burnout_risk	leadership	low	Why is burnout awareness important at senior stages?	2026-02-09 08:06:49.107471+00	\N
c1cff2d8-554b-49fb-9c48-59dc5810acff	psychometric	burnout_risk	leadership	medium	How do you sustain performance during extended high-pressure phases?	2026-02-09 08:06:49.107471+00	\N
386f5d47-ea58-4fd2-8ee5-609044d94fb4	psychometric	burnout_risk	leadership	medium	How do you recognize early burnout indicators at an executive level?	2026-02-09 08:06:49.107471+00	\N
73f093b4-c3ef-4e44-8456-770c02309c33	psychometric	burnout_risk	leadership	medium	How do you manage stress during major organizational transitions?	2026-02-09 08:06:49.107471+00	\N
27899361-0fd6-4f97-8da8-76dacbdd3eb0	psychometric	burnout_risk	leadership	medium	How do you balance leadership accountability with personal health?	2026-02-09 08:06:49.107471+00	\N
fc2442ce-926f-4b76-9fb7-0c5082ad6050	psychometric	burnout_risk	leadership	medium	How do you maintain motivation during long-term transformation initiatives?	2026-02-09 08:06:49.107471+00	\N
5800d46f-bc5f-4d3f-8436-ff33e36235b9	psychometric	burnout_risk	leadership	medium	How do you recognize early signs of burnout in yourself?	2026-02-09 08:06:49.107471+00	\N
c1ccec13-824b-4428-8a11-f79207cde007	psychometric	burnout_risk	leadership	medium	How do you manage workload when responsibilities continue to expand?	2026-02-09 08:06:49.107471+00	\N
f405f263-2078-4578-8dbc-9e77aa83b70b	psychometric	burnout_risk	leadership	medium	How do you respond when work pressure becomes constant rather than temporary?	2026-02-09 08:06:49.107471+00	\N
b511cb62-d305-44c3-b538-e4b0a72cf50c	psychometric	burnout_risk	leadership	medium	How do you maintain energy across long work cycles?	2026-02-09 08:06:49.107471+00	\N
b8bb4453-82b6-4904-a69c-d1e83781130b	behavioral	resilience	fresher	low	Share an example of a time you felt disappointed. What did you do next?	2026-02-13 09:33:54.735129+00	Score 6: Emotional maturity. Candidate acknowledges the feeling but emphasizes the "next step" or the recovery process.
e70f14f3-5243-4637-baf3-3983a435d5ca	psychometric	burnout_risk	leadership	medium	How do you handle emotional fatigue from prolonged responsibility?	2026-02-09 08:06:49.107471+00	\N
4176947c-e8ca-4318-b354-ac4e3550c194	psychometric	burnout_risk	leadership	medium	How do you prevent burnout while meeting high expectations?	2026-02-09 08:06:49.107471+00	\N
d7c0b2de-050a-4ba9-b448-d1552f66a1c5	psychometric	burnout_risk	leadership	medium	How do you react when you feel mentally drained but work continues?	2026-02-09 08:06:49.107471+00	\N
efe997d6-6157-4689-8a24-9252877a874c	psychometric	burnout_risk	leadership	medium	How do you balance ambition with personal well-being?	2026-02-09 08:06:49.107471+00	\N
52fa7bc3-7f54-4581-b13f-4fb946508390	psychometric	burnout_risk	leadership	medium	How do you manage stress during prolonged high-stakes projects?	2026-02-09 08:06:49.107471+00	\N
4bfe6bf3-4156-4e7d-a308-2c0aec6af0cb	psychometric	burnout_risk	leadership	medium	How do you know when to slow down professionally?	2026-02-09 08:06:49.107471+00	\N
59468a0a-d403-4af8-bd1b-ba5ca1b6355c	psychometric	burnout_risk	leadership	medium	How do you recover after an intense work phase?	2026-02-09 08:06:49.107471+00	\N
44e141ec-8c0e-4893-bc1c-72ffb8d4d472	psychometric	burnout_risk	leadership	medium	How do you manage burnout risk when leading others?	2026-02-09 08:06:49.107471+00	\N
f31bbf37-318d-4486-a8a8-d97f31127cc5	psychometric	burnout_risk	leadership	medium	How do you handle pressure without internalizing stress?	2026-02-09 08:06:49.107471+00	\N
4136084b-90a7-4804-84c1-93f7f5d5b072	psychometric	burnout_risk	leadership	medium	How do you deal with fatigue caused by decision overload?	2026-02-09 08:06:49.107471+00	\N
c4f3dda8-5cc3-4f20-8f56-647aa67d7ea6	psychometric	burnout_risk	leadership	medium	How do you maintain motivation during long periods of pressure?	2026-02-09 08:06:49.107471+00	\N
88af639f-fdf2-4d11-846b-91d19f945b2b	psychometric	burnout_risk	leadership	medium	How do you avoid burnout during periods of organizational change?	2026-02-09 08:06:49.107471+00	\N
fc9f4d2f-cd00-4d3e-b691-8c41ebeb7eaa	psychometric	burnout_risk	leadership	medium	How do you handle exhaustion without compromising outcomes?	2026-02-09 08:06:49.107471+00	\N
7dd8524d-260f-43ee-8fbf-d841b842bf02	psychometric	burnout_risk	leadership	medium	How do you ensure burnout does not become normalized?	2026-02-09 08:06:49.107471+00	\N
8078a316-ddc0-46a4-8df6-e4c8d2472558	psychometric	burnout_risk	leadership	medium	How do you evaluate your burnout risk over time?	2026-02-09 08:06:49.107471+00	\N
0882ca0c-9f13-4364-bad2-a69046a63c74	psychometric	burnout_risk	leadership	medium	Why is burnout management critical at the 10+ year career stage?	2026-02-09 08:06:49.107471+00	\N
649712bf-7bc6-43d2-af1c-3385ea74ddcf	psychometric	burnout_risk	leadership	high	Describe a time when you were at high risk of burnout and how you managed it.	2026-02-09 08:06:49.107471+00	\N
2b44c4df-899c-428f-98a8-37a8d6408a40	psychometric	burnout_risk	leadership	high	How do you prevent burnout when executive demands continue to escalate?	2026-02-09 08:06:49.107471+00	\N
4a197490-82df-45ef-8b03-99ae7df0a602	psychometric	burnout_risk	leadership	high	Tell me about a situation where stress affected your leadership judgment and how you corrected it.	2026-02-09 08:06:49.107471+00	\N
3ce87083-cae3-44aa-8f7c-405a87a7e424	psychometric	burnout_risk	leadership	high	How do you continue leading effectively when mental and emotional fatigue accumulate?	2026-02-09 08:06:49.107471+00	\N
0b66bd88-4883-4f47-a2e1-1ee7f5ca9792	psychometric	burnout_risk	leadership	high	Why is burnout awareness critical for leaders with 10+ years of experience?	2026-02-09 08:06:49.107471+00	\N
7e95f077-cbc5-4ed8-bfba-386f2e8d134a	psychometric	burnout_risk	leadership	high	Describe a time when prolonged responsibility affected your well-being. How did you respond?	2026-02-09 08:06:49.107471+00	\N
c9d42e28-999e-4182-beb2-944079ad96ca	psychometric	burnout_risk	leadership	high	How do you detect burnout when performance remains high?	2026-02-09 08:06:49.107471+00	\N
8ea562c2-85a9-4501-aca1-f518a11e518e	psychometric	burnout_risk	leadership	high	How do you manage burnout risk when your identity is strongly tied to work?	2026-02-09 08:06:49.107471+00	\N
c3cfeab7-d4e0-4d27-ba6a-5c073810409d	psychometric	burnout_risk	leadership	high	Describe how decision fatigue contributes to burnout at senior levels.	2026-02-09 08:06:49.107471+00	\N
01528f7d-2371-4414-b387-0ab5cd46b64b	psychometric	burnout_risk	leadership	high	How do you prevent burnout when you are seen as indispensable?	2026-02-09 08:06:49.107471+00	\N
039e07df-6bd9-4a21-a3bb-92fc18b4e478	psychometric	burnout_risk	leadership	high	How do you manage emotional exhaustion from long-term people leadership?	2026-02-09 08:06:49.107471+00	\N
acce0083-8dcd-4971-babc-3d0db508f0e4	psychometric	growth_potential	leadership	low	How do you approach learning new business models or markets?	2026-02-09 08:14:18.893463+00	\N
fbaf94e6-38e4-445e-b57c-ffe91d07c7d3	psychometric	burnout_risk	leadership	high	Describe a situation where burnout risk conflicted with business urgency.	2026-02-09 08:06:49.107471+00	\N
50bb5726-bee9-499b-b53f-bf68878690f0	psychometric	burnout_risk	leadership	high	How do you respond when burnout symptoms are normalized in leadership culture?	2026-02-09 08:06:49.107471+00	\N
9f2c01a4-ec43-455a-97d9-0b5d3ff4086a	psychometric	burnout_risk	leadership	high	How do you manage burnout risk during continuous transformation cycles?	2026-02-09 08:06:49.107471+00	\N
f215b929-0d5b-425c-9543-fd8dff76873f	psychometric	burnout_risk	leadership	high	How do you differentiate commitment from overextension?	2026-02-09 08:06:49.107471+00	\N
84421c58-30d8-44a8-bda5-a87dc2da955a	psychometric	burnout_risk	leadership	high	How do you address burnout risk after repeated organizational crises?	2026-02-09 08:06:49.107471+00	\N
922f03cc-853d-42b3-b7f6-ceced75579b1	psychometric	burnout_risk	leadership	high	How do you manage burnout risk when accountability is high and shared support is low?	2026-02-09 08:06:49.107471+00	\N
b2b24a09-4b00-4c29-b247-53aea722be06	psychometric	burnout_risk	leadership	high	How do you handle burnout risk when success reinforces unhealthy patterns?	2026-02-09 08:06:49.107471+00	\N
a4696e43-c3a2-4b94-b041-02e076fc8a94	psychometric	burnout_risk	leadership	high	How do you manage burnout risk while mentoring others through stress?	2026-02-09 08:06:49.107471+00	\N
24e6e38d-2329-44cd-a98e-262834a9891b	psychometric	burnout_risk	leadership	high	How do you respond when burnout affects strategic thinking?	2026-02-09 08:06:49.107471+00	\N
232962ba-6991-4383-86d7-f6a377aa30b0	psychometric	burnout_risk	leadership	high	How do you handle burnout risk during mergers or large-scale change?	2026-02-09 08:06:49.107471+00	\N
6f683b47-c413-425d-b509-d2e627c7a7d4	psychometric	burnout_risk	leadership	high	How do you recognize burnout masked as cynicism or detachment?	2026-02-09 08:06:49.107471+00	\N
c4586dde-865f-405f-b83b-873cd2ba201d	psychometric	burnout_risk	leadership	high	How do you manage burnout risk when work meaning starts eroding?	2026-02-09 08:06:49.107471+00	\N
ff6c044d-f9b3-4ab6-ac71-ef2943695b89	psychometric	burnout_risk	leadership	high	How do you ensure burnout does not silently accumulate over years?	2026-02-09 08:06:49.107471+00	\N
024a6262-c076-476c-95d1-c5ed6180bc93	psychometric	burnout_risk	leadership	high	Why is burnout mastery a critical executive capability?	2026-02-09 08:06:49.107471+00	\N
ff4f1b8c-a4fe-410b-80ca-9ff34bb9cd5e	psychometric	sales_dna	leadership	low	How comfortable are you engaging with senior customers or stakeholders?	2026-02-09 08:11:13.565581+00	\N
19c3e821-743c-4671-80d0-315faa32552c	psychometric	sales_dna	leadership	low	How do you usually react to pressure in high-level sales discussions?	2026-02-09 08:11:13.565581+00	\N
70f50067-40f2-4e4e-ba03-2e87f8453ea7	psychometric	sales_dna	leadership	low	How important is emotional control in senior sales roles?	2026-02-09 08:11:13.565581+00	\N
6de507e3-fe08-4aed-837c-30e987437feb	psychometric	sales_dna	leadership	low	How do you feel about leading conversations in large meetings?	2026-02-09 08:11:13.565581+00	\N
8c41a65d-2536-4d0b-bf21-72f8f294caca	psychometric	sales_dna	leadership	low	How do you maintain energy in people-facing roles over time?	2026-02-09 08:11:13.565581+00	\N
ecdf66ac-b3b9-46c2-aa54-5dee996d6136	psychometric	sales_dna	leadership	low	How comfortable are you interacting with customers daily?	2026-02-09 08:11:13.565581+00	\N
5eac9300-6802-4c5d-8f42-2f31b7850423	psychometric	sales_dna	leadership	low	How do you stay calm when a customer is upset?	2026-02-09 08:11:13.565581+00	\N
f62e6ca1-41d8-41f5-91f9-cac4f03a999e	psychometric	sales_dna	leadership	low	How do you feel about starting conversations with new people?	2026-02-09 08:11:13.565581+00	\N
b5e49df0-fd62-4949-a8a3-cb3cd57bf84d	psychometric	sales_dna	leadership	low	How do you respond when a sales conversation does not go well?	2026-02-09 08:11:13.565581+00	\N
8f42514b-a6a7-45e5-a622-fc3e05e1c153	psychometric	sales_dna	leadership	low	How do you maintain energy during repeated customer interactions?	2026-02-09 08:11:13.565581+00	\N
66e1e24d-09df-4e55-8036-17795ae2cf50	psychometric	sales_dna	leadership	low	How do you handle pressure during sales targets or deadlines?	2026-02-09 08:11:13.565581+00	\N
3b5fd37e-22e9-41e3-90ca-7a17d21a3da8	psychometric	sales_dna	leadership	low	How comfortable are you speaking in group discussions or meetings?	2026-02-09 08:11:13.565581+00	\N
dc977c90-8ebe-403c-bd41-e0f977851fd9	psychometric	sales_dna	leadership	low	How do you manage emotional reactions after losing a sale?	2026-02-09 08:11:13.565581+00	\N
e06f661a-67b1-4554-9aa1-e23987683095	psychometric	sales_dna	leadership	low	How do you stay positive during slow sales periods?	2026-02-09 08:11:13.565581+00	\N
e20345e7-1060-4275-956f-4621483c886c	psychometric	sales_dna	leadership	low	How do you feel about receiving feedback from customers or managers?	2026-02-09 08:11:13.565581+00	\N
eb41ba6c-8847-4314-837d-b8c06b80fa8c	psychometric	sales_dna	leadership	low	How do you keep conversations friendly while remaining professional?	2026-02-09 08:11:13.565581+00	\N
793d0d23-1c19-42a1-b913-db30b9a5a65c	psychometric	sales_dna	leadership	low	How do you react when customers say ÔÇ£noÔÇØ?	2026-02-09 08:11:13.565581+00	\N
8723d819-16f1-473b-bad7-cb8204493148	psychometric	sales_dna	leadership	low	How do you ensure consistency in customer interactions?	2026-02-09 08:11:13.565581+00	\N
3940c9e3-4747-477e-8e90-109d5bfa42f1	psychometric	sales_dna	leadership	low	How do you feel about networking or social selling?	2026-02-09 08:11:13.565581+00	\N
0de0f0ca-a82c-4aae-86df-63e7a94519d8	psychometric	sales_dna	leadership	low	How do you handle emotionally demanding customers?	2026-02-09 08:11:13.565581+00	\N
97e9c492-3cfc-46fe-b1e5-1dfb14aa1f7a	psychometric	sales_dna	leadership	low	How do you maintain confidence during challenging sales conversations?	2026-02-09 08:11:13.565581+00	\N
b8f7dc64-36fd-4fc2-b4b4-7e339f2d8f35	psychometric	sales_dna	leadership	low	How do you stay engaged after multiple customer calls?	2026-02-09 08:11:13.565581+00	\N
1f4f3e2a-5b6a-4b31-885a-855acc72339f	psychometric	sales_dna	leadership	low	How do you manage mood changes during demanding sales days?	2026-02-09 08:11:13.565581+00	\N
85b5933a-f3df-425c-b395-b9528e45c84e	psychometric	sales_dna	leadership	low	How do you feel about representing your company publicly?	2026-02-09 08:11:13.565581+00	\N
e48c33f9-9dcb-4954-862f-405f0f70ced7	psychometric	sales_dna	leadership	low	Why are emotional stability and extraversion important in sales?	2026-02-09 08:11:13.565581+00	\N
52138085-6beb-4109-9574-ef3ec6f9617a	psychometric	sales_dna	leadership	medium	How do you balance assertiveness with emotional stability in negotiations?	2026-02-09 08:11:13.565581+00	\N
9b476389-1bc8-4547-a39f-bc0f48107986	psychometric	sales_dna	leadership	medium	How do you handle rejection or stalled deals at a senior level?	2026-02-09 08:11:13.565581+00	\N
e07222d7-f954-4f51-860b-725ad5041863	psychometric	sales_dna	leadership	medium	How do you manage emotions during long and complex sales cycles?	2026-02-09 08:11:13.565581+00	\N
6238fbc9-1c73-4247-9475-86803030e652	psychometric	sales_dna	leadership	medium	How do you adapt communication style across different customer personalities?	2026-02-09 08:11:13.565581+00	\N
9db1810c-fd26-427b-9bff-70401f33c8bc	psychometric	sales_dna	leadership	medium	How do you sustain motivation when results fluctuate?	2026-02-09 08:11:13.565581+00	\N
1c0a35e6-0d83-4e71-94af-996981037e30	psychometric	sales_dna	leadership	medium	How do you remain composed during high-stakes sales negotiations?	2026-02-09 08:11:13.565581+00	\N
994b04d4-5990-4471-a1cc-d99d548c837d	psychometric	sales_dna	leadership	medium	How do you manage rejection without losing enthusiasm for selling?	2026-02-09 08:11:13.565581+00	\N
c9f110aa-7691-4546-97fe-6c5397b5d09d	psychometric	sales_dna	leadership	medium	How do you project confidence during uncertainty with clients?	2026-02-09 08:11:13.565581+00	\N
29978e86-d208-4f60-989e-72ac9d636748	psychometric	sales_dna	leadership	medium	How do you balance assertiveness with emotional intelligence in sales conversations?	2026-02-09 08:11:13.565581+00	\N
39ef76f0-6a08-4921-aab8-9a239d9cc8ec	psychometric	sales_dna	leadership	medium	How do you stay socially engaged after emotionally draining client interactions?	2026-02-09 08:11:13.565581+00	\N
fe00e978-8e4f-4792-be99-22d4ee56531a	psychometric	sales_dna	leadership	medium	How do you handle emotionally charged objections from senior stakeholders?	2026-02-09 08:11:13.565581+00	\N
11874315-9d0f-4577-9229-64007d12d0a2	psychometric	sales_dna	leadership	medium	How do you maintain emotional balance during aggressive sales targets?	2026-02-09 08:11:13.565581+00	\N
349c30f6-d603-4e8f-8351-bd61923223fc	psychometric	sales_dna	leadership	medium	How do you remain persuasive without becoming emotionally reactive?	2026-02-09 08:11:13.565581+00	\N
3bf738dd-ffc2-4490-adf8-2191e2563cb9	psychometric	sales_dna	leadership	medium	How do you sustain extraverted energy in long sales cycles?	2026-02-09 08:11:13.565581+00	\N
7209bb75-3d7f-46ea-b5b6-83d51db3619e	psychometric	sales_dna	leadership	medium	How do you influence clients without emotional overinvestment?	2026-02-09 08:11:13.565581+00	\N
3b004e3d-d6a5-40df-a1a1-3e37053c5fd7	psychometric	sales_dna	leadership	medium	How do you regulate emotions after losing a critical deal?	2026-02-09 08:11:13.565581+00	\N
a78d1a21-88b7-4d1b-88c5-a9d6528e7830	psychometric	sales_dna	leadership	medium	How do you manage confidence without appearing aggressive?	2026-02-09 08:11:13.565581+00	\N
54278059-6391-49ab-bc19-1c137f799fc8	psychometric	sales_dna	leadership	medium	How do you stay socially proactive during repeated setbacks?	2026-02-09 08:11:13.565581+00	\N
40615572-a841-4401-925f-f66bdf0cd729	psychometric	sales_dna	leadership	medium	How do you maintain composure when clients challenge your credibility?	2026-02-09 08:11:13.565581+00	\N
217377f1-d11f-4d46-b083-14de9e2f7fca	psychometric	sales_dna	leadership	medium	How do you regulate emotions while leading high-energy sales teams?	2026-02-09 08:11:13.565581+00	\N
68dab5eb-05ec-4647-b2cb-497a1f3b63d5	psychometric	sales_dna	leadership	medium	How do you manage emotional fluctuations during volatile markets?	2026-02-09 08:11:13.565581+00	\N
6e5d31bf-4211-44ba-9f9e-949df37ec631	psychometric	sales_dna	leadership	medium	How do you stay outwardly positive without suppressing emotions?	2026-02-09 08:11:13.565581+00	\N
8e31ffce-6755-40fe-b292-12b018794a37	psychometric	sales_dna	leadership	medium	How do you maintain influence without emotional dependency on outcomes?	2026-02-09 08:11:13.565581+00	\N
2928f00d-042c-409a-8e17-2c297e023f01	psychometric	sales_dna	leadership	medium	How do you sustain charisma without emotional exhaustion?	2026-02-09 08:11:13.565581+00	\N
e1da227d-c271-4e6a-a19c-e1a0a602389c	psychometric	sales_dna	leadership	medium	Why is emotional stability critical for senior sales professionals?	2026-02-09 08:11:13.565581+00	\N
a404ec7f-f288-4e59-a053-a8c08ed9d90d	psychometric	sales_dna	leadership	high	Describe a situation where emotional stability helped you close a complex deal.	2026-02-09 08:11:13.565581+00	\N
9e80675a-8184-47ee-9201-dc289e77b486	psychometric	sales_dna	leadership	high	How do you manage high emotional pressure while leading large sales teams?	2026-02-09 08:11:13.565581+00	\N
3a83dded-6f69-48a7-a010-60c9bcd1442c	psychometric	sales_dna	leadership	high	Tell me about a time extraversion helped influence a difficult customer decision.	2026-02-09 08:11:13.565581+00	\N
efe6de33-2d99-4466-8d86-93f335bc0f0c	psychometric	sales_dna	leadership	high	How do you remain emotionally stable during repeated losses or market downturns?	2026-02-09 08:11:13.565581+00	\N
dfac5061-5f8b-44b3-9dca-eb9511ae3b4e	psychometric	sales_dna	leadership	high	Why are emotional stability and extraversion critical for 10+ year sales leaders?	2026-02-09 08:11:13.565581+00	\N
3955881d-0bbc-45b3-8ea4-f413946a174f	psychometric	sales_dna	leadership	high	How comfortable are you interacting with new clients regularly?	2026-02-09 08:11:13.565581+00	\N
2c83e632-7516-4c5f-888c-c196422d95ad	psychometric	sales_dna	leadership	high	How do you remain calm during difficult customer conversations?	2026-02-09 08:11:13.565581+00	\N
417dba36-47c2-441e-a996-9235f00e9ba4	psychometric	sales_dna	leadership	high	How do you usually start conversations with potential customers?	2026-02-09 08:11:13.565581+00	\N
43106f94-b40a-4768-b96c-d0b72bba5381	psychometric	sales_dna	leadership	high	How do you handle rejection in sales situations?	2026-02-09 08:11:13.565581+00	\N
e10f7c4f-e4c2-46f2-b1b3-5b8dac1df091	psychometric	sales_dna	leadership	high	How do you maintain positive energy throughout the sales day?	2026-02-09 08:11:13.565581+00	\N
73bdcccf-e99e-4e3f-a403-14124d8ab4f8	psychometric	sales_dna	leadership	high	How do you stay confident when sales targets are challenging?	2026-02-09 08:11:13.565581+00	\N
8138948a-43e1-4ca8-9ecc-2cfe0a821da5	behavioral	resilience	fresher	low	How do you usually react when you receive criticism?	2026-02-13 09:33:54.735129+00	Score 6: Candidate demonstrates an open mindset, views criticism as feedback for growth, and mentions a specific example of how they processed feedback effectively.
41df71b8-037e-4878-b266-1447f73b37f2	psychometric	sales_dna	leadership	high	How do you balance talking and listening during sales discussions?	2026-02-09 08:11:13.565581+00	\N
f517daec-608f-4e76-83c5-3d2f77138186	psychometric	sales_dna	leadership	high	How do you manage emotions when deals are delayed?	2026-02-09 08:11:13.565581+00	\N
f27b1475-7add-436b-acbd-32cc8355085e	psychometric	sales_dna	leadership	high	How do you stay approachable to customers under pressure?	2026-02-09 08:11:13.565581+00	\N
9923c5f1-845d-46e8-9abd-fd72c070133a	psychometric	sales_dna	leadership	high	How do you maintain consistency in customer interactions?	2026-02-09 08:11:13.565581+00	\N
2074ba95-e7bf-43a8-9df5-1e4a70d37793	psychometric	sales_dna	leadership	high	Describe how you maintain board-level influence during market volatility.	2026-02-09 08:11:13.565581+00	\N
7ea9febc-87a3-4469-a729-a7e066e334fa	psychometric	sales_dna	leadership	high	How do you regulate social energy while overseeing global sales partnerships?	2026-02-09 08:11:13.565581+00	\N
e904b3ad-0da1-4113-912d-ecdf42aa9bfe	psychometric	sales_dna	leadership	high	How do you project authority without being abrasive in high-stakes conflicts?	2026-02-09 08:11:13.565581+00	\N
114975f4-4da3-43c1-84d2-5136997f264c	psychometric	sales_dna	leadership	high	Describe how you recover from an executive-level deal loss.	2026-02-09 08:11:13.565581+00	\N
2ef6b0db-2557-4ae5-a564-4b2cd6cd3549	psychometric	sales_dna	leadership	high	How do you maintain charisma while delivering difficult strategic changes?	2026-02-09 08:11:13.565581+00	\N
610cf054-a552-41ec-9edd-c2732e631810	psychometric	sales_dna	leadership	high	Describe how you leverage extraversion to build multi-year client alliances.	2026-02-09 08:11:13.565581+00	\N
f89ea5f8-1097-42da-985c-5a725fad619f	psychometric	sales_dna	leadership	high	How do you manage the emotional impact of high-profile sales failures?	2026-02-09 08:11:13.565581+00	\N
0dd4d71f-7c7b-45c0-be51-a85dd420f59b	psychometric	sales_dna	leadership	high	How do you stay socially proactive when entering new global markets?	2026-02-09 08:11:13.565581+00	\N
fc31f9b2-2c0e-4921-9958-e462274f2629	psychometric	sales_dna	leadership	high	Why is the synergy of stability and extraversion vital for executive sales performance?	2026-02-09 08:11:13.565581+00	\N
d653b656-decf-4865-8183-481b3180b3f1	psychometric	growth_potential	leadership	low	How important is strategic learning at an executive level?	2026-02-09 08:14:18.893463+00	\N
c47916d5-1f5f-4217-b21f-f5e33a579a3e	psychometric	growth_potential	leadership	low	How comfortable are you challenging your existing assumptions?	2026-02-09 08:14:18.893463+00	\N
138ba390-4d62-4ffb-bdb4-80f5ccbce0f9	psychometric	growth_potential	leadership	low	How do you stay informed about industry or strategic changes?	2026-02-09 08:14:18.893463+00	\N
88265fa8-c896-41ef-ad87-1297b493dc00	psychometric	growth_potential	leadership	low	How do you integrate learning into daily leadership decisions?	2026-02-09 08:14:18.893463+00	\N
2de6e2f2-3c50-4af7-8cbb-09de1847641e	psychometric	growth_potential	leadership	low	How do you stay curious in your current leadership role?	2026-02-09 08:14:18.893463+00	\N
04f5a8d8-b3d6-4ff8-af6d-e9033cf37baa	psychometric	growth_potential	leadership	low	How do you evaluate the quality of information you consume?	2026-02-09 08:14:18.893463+00	\N
90e223c7-f48e-44c6-88ea-f57ea719f087	psychometric	growth_potential	leadership	low	How do you share new insights with your core team?	2026-02-09 08:14:18.893463+00	\N
513ca956-cc9f-40ed-b4f8-97fb90b60066	psychometric	growth_potential	leadership	low	Why is it important to learn from other industries at your level?	2026-02-09 08:14:18.893463+00	\N
162d655f-b3a8-41a5-b4ac-938a7ad85be8	psychometric	growth_potential	leadership	low	How do you handle information that contradicts your current strategy?	2026-02-09 08:14:18.893463+00	\N
7adaa20c-1b2d-453d-a807-258d497faac6	psychometric	growth_potential	leadership	low	How do you make time for professional development in a busy schedule?	2026-02-09 08:14:18.893463+00	\N
643d180d-5b79-4ac9-8363-03f2daf53569	psychometric	growth_potential	leadership	low	How do you identify skills that will be relevant 3 years from now?	2026-02-09 08:14:18.893463+00	\N
434cdb0f-aa20-44df-8ede-1907e7ca5361	psychometric	growth_potential	leadership	low	How do you respond to new technological trends in your sector?	2026-02-09 08:14:18.893463+00	\N
440fab77-1556-41e9-92ae-a93fd08950ae	psychometric	growth_potential	leadership	low	How do you encourage your peers to share their learnings?	2026-02-09 08:14:18.893463+00	\N
2ae3b5cb-6cd6-4b91-8d23-6a2f6ed35b52	psychometric	growth_potential	leadership	low	How do you use past failures to improve current operations?	2026-02-09 08:14:18.893463+00	\N
183a4a7e-3dec-4758-8114-81b1be0e55df	psychometric	growth_potential	leadership	low	How do you determine which strategic topics require deep study?	2026-02-09 08:14:18.893463+00	\N
0b18c5ce-3797-49d3-90ae-3e8c41e13bb8	psychometric	growth_potential	leadership	low	How do you feel about learning from younger colleagues or experts?	2026-02-09 08:14:18.893463+00	\N
b9d88bb4-5aee-48cc-a8e5-d8feaa0a5ad3	psychometric	growth_potential	leadership	low	How do you stay objective when reviewing market data?	2026-02-09 08:14:18.893463+00	\N
8781cb72-6589-4cb9-9de4-4238013692f6	psychometric	growth_potential	leadership	low	How do you use industry networking for strategic learning?	2026-02-09 08:14:18.893463+00	\N
f77b4835-0de9-46a6-abd6-c6204aee0af1	psychometric	growth_potential	leadership	low	How do you measure the value of the time you spend learning?	2026-02-09 08:14:18.893463+00	\N
6dcd8794-3716-4928-82ad-c8915ffaa162	psychometric	growth_potential	leadership	low	How do you keep your strategic knowledge updated?	2026-02-09 08:14:18.893463+00	\N
e5cd1ff9-fe77-4c14-bf06-a62b524323c6	behavioral	resilience	fresher	low	Describe a time when you had to try again after failing the first time.	2026-02-13 09:33:54.735129+00	Score 6: Focus on persistence. Candidate should explain why the goal was important and what specific adjustment they made during the second attempt.
cf734dc3-f04b-411b-b2ac-1d7ab880cfcf	psychometric	growth_potential	leadership	low	Why is learning agility important for executive leadership?	2026-02-09 08:14:18.893463+00	\N
92ad53bc-8f11-4a56-bfc5-bca61df047ef	psychometric	growth_potential	leadership	low	How do you select mentors or advisors for your own growth?	2026-02-09 08:14:18.893463+00	\N
c6554633-862e-47d6-a44b-1a4487b2dfc5	psychometric	growth_potential	leadership	low	How do you simplify complex new concepts for your organization?	2026-02-09 08:14:18.893463+00	\N
99e700f9-ca4b-416b-9b53-833041b89849	psychometric	growth_potential	leadership	low	How do you apply theoretical learning to real-world business problems?	2026-02-09 08:14:18.893463+00	\N
c4e20660-717a-40dc-a369-0a2d4ff47519	psychometric	growth_potential	leadership	medium	Describe a time you learned from a strategic success or failure.	2026-02-09 08:14:18.893463+00	\N
35fba944-1401-445a-9b4c-71c0030cb83b	psychometric	growth_potential	leadership	medium	How do you ensure continuous strategic learning despite experience?	2026-02-09 08:14:18.893463+00	\N
ec21f0de-c4e2-451c-a78d-f7ea44727a69	psychometric	growth_potential	leadership	medium	How do you translate learning into organizational capability?	2026-02-09 08:14:18.893463+00	\N
975dd955-a95d-4f0d-a843-0b68bc3695a9	psychometric	growth_potential	leadership	medium	How do you learn strategically during uncertainty or disruption?	2026-02-09 08:14:18.893463+00	\N
95474f8f-4a7a-4c69-848c-ec3076670a0d	psychometric	growth_potential	leadership	medium	How do you balance learning and execution at a senior level?	2026-02-09 08:14:18.893463+00	\N
e59b565f-28b6-49cd-9341-455a05834cb8	psychometric	growth_potential	leadership	medium	How do you foster a culture of strategic curiosity in your leadership team?	2026-02-09 08:14:18.893463+00	\N
a1eb1c9a-60d6-4e7b-8794-d53784fcb938	psychometric	growth_potential	leadership	medium	Describe your process for benchmarking your organization against global leaders.	2026-02-09 08:14:18.893463+00	\N
d0d98707-64a8-4b95-a997-266e46e6d6d1	psychometric	growth_potential	leadership	medium	How do you decide which strategies or habits to retire?	2026-02-09 08:14:18.893463+00	\N
8e1cfa0e-9726-47c2-a369-07bcd5bc2db3	psychometric	growth_potential	leadership	medium	How do you use scenario analysis to drive strategic learning?	2026-02-09 08:14:18.893463+00	\N
53bc8b70-8b31-4bf3-99aa-87b1b37c3f6b	psychometric	growth_potential	leadership	medium	How do you ensure your strategic insights are data-driven?	2026-02-09 08:14:18.893463+00	\N
f1770ba1-75c7-4105-9786-63388435144e	psychometric	growth_potential	leadership	medium	How do you manage the "expert's trap" where your experience limits your learning?	2026-02-09 08:14:18.893463+00	\N
c5c5d18c-77b4-4355-b938-b22816f36df4	psychometric	growth_potential	leadership	medium	How do you synthesize conflicting views from different stakeholders to learn?	2026-02-09 08:14:18.893463+00	\N
80fb64f4-177e-4d65-a360-ef35d03fb196	psychometric	growth_potential	leadership	medium	How do you leverage strategic failures as organizational learning assets?	2026-02-09 08:14:18.893463+00	\N
6fb56766-74b2-4bd4-93c4-a260372f8af5	psychometric	growth_potential	leadership	medium	How do you evaluate the strategic impact of emerging competitors?	2026-02-09 08:14:18.893463+00	\N
c91bc2e5-abe7-4022-a80e-49bd5897ae9c	psychometric	growth_potential	leadership	medium	How do you decide when to pivot your strategy based on new information?	2026-02-09 08:14:18.893463+00	\N
ebd6bdd3-052e-4f4c-a6d7-d6ebdda6bdf4	psychometric	growth_potential	leadership	medium	How do you balance "depth" and "breadth" in your strategic learning?	2026-02-09 08:14:18.893463+00	\N
225283bf-62e1-472b-9b76-ce92d6d9ce51	psychometric	growth_potential	leadership	medium	How do you integrate feedback from the market into your long-term vision?	2026-02-09 08:14:18.893463+00	\N
c5fdb3bf-9669-48a3-ac88-4654ccbdd3c6	psychometric	growth_potential	leadership	medium	How do you ensure your learning keeps pace with digital transformation?	2026-02-09 08:14:18.893463+00	\N
d62d4d47-0faa-4d18-9b24-f755460dacc8	psychometric	growth_potential	leadership	medium	How do you challenge the status quo without disrupting performance?	2026-02-09 08:14:18.893463+00	\N
4d8eade8-cb74-457b-b95f-0034f1f92d5e	psychometric	growth_potential	leadership	medium	How do you prioritize learning in areas where you have minimal expertise?	2026-02-09 08:14:18.893463+00	\N
87b8b16e-3b3a-4433-acb3-cb76833598f5	psychometric	growth_potential	leadership	medium	How do you use peer coaching to enhance your strategic foresight?	2026-02-09 08:14:18.893463+00	\N
083018ef-9887-471d-bb0d-0771a2a17aff	psychometric	growth_potential	leadership	medium	How do you evaluate the strategic relevance of new educational resources?	2026-02-09 08:14:18.893463+00	\N
ed4cc7f2-57c3-4126-99b6-70d7001705cd	psychometric	growth_potential	leadership	medium	How do you manage intellectual humility during high-stakes decisions?	2026-02-09 08:14:18.893463+00	\N
b12f64db-b4a4-456b-8fd4-63ec37c885dd	psychometric	growth_potential	leadership	medium	How do you adapt your learning strategy as your organization scales?	2026-02-09 08:14:18.893463+00	\N
732ddcc4-59f4-4ca8-882b-bb702dcd898f	psychometric	growth_potential	leadership	medium	How do you synthesize global market trends for regional strategic learning?	2026-02-09 08:14:18.893463+00	\N
51b7ba30-58d7-4781-be68-a5d28ab86e1e	psychometric	growth_potential	leadership	high	Describe a situation where strategic learning significantly changed your leadership approach.	2026-02-09 08:14:18.893463+00	\N
1beb50ac-7831-47fb-8bc6-432919e89b27	psychometric	growth_potential	leadership	high	How do you pursue strategic learning when outcomes are uncertain or delayed?	2026-02-09 08:14:18.893463+00	\N
a22bf79a-7323-4c4b-a900-94497b8f31bb	psychometric	growth_potential	leadership	high	Tell me about a time you unlearned an outdated strategy to drive growth.	2026-02-09 08:14:18.893463+00	\N
daec513e-dfb3-4a26-b063-067f7745b05d	psychometric	growth_potential	leadership	high	How do you sustain strategic learning during prolonged success?	2026-02-09 08:14:18.893463+00	\N
5b23234b-ee57-4550-8248-0b8152584aef	psychometric	growth_potential	leadership	high	Why is strategic learning critical for leaders with 10+ years of experience?	2026-02-09 08:14:18.893463+00	\N
14f76dcb-412c-41c8-a0e4-de0a3bc8b54c	psychometric	growth_potential	leadership	high	Describe a time you had to pivot your entire business model based on strategic learning.	2026-02-09 08:14:18.893463+00	\N
dd9c2907-5f10-43b4-8693-1c5a1d7aee10	psychometric	growth_potential	leadership	high	How do you handle the cognitive dissonance when your successful strategy becomes obsolete?	2026-02-09 08:14:18.893463+00	\N
e4d617b2-57eb-4be9-bdac-1dc3fb80eeda	psychometric	growth_potential	leadership	high	How do you drive organizational unlearning to prepare for radical change?	2026-02-09 08:14:18.893463+00	\N
2a802175-8dfa-46f0-ae91-e5d3c444c6cc	psychometric	growth_potential	leadership	high	Describe your framework for evaluating the long-term potential of disruptive technologies.	2026-02-09 08:14:18.893463+00	\N
a5a75f66-e451-4129-9e22-22f74362414c	psychometric	growth_potential	leadership	high	How do you maintain a "day one" mindset after decades of leadership?	2026-02-09 08:14:18.893463+00	\N
22a48772-bc89-4a0d-9b78-399265553f22	psychometric	growth_potential	leadership	high	How do you influence the board's strategy using evidence-based learning?	2026-02-09 08:14:18.893463+00	\N
6a72dfcf-6042-4377-aa54-12bced379778	psychometric	growth_potential	leadership	high	Describe a time you anticipated a market shift before it became mainstream.	2026-02-09 08:14:18.893463+00	\N
54b41354-b4a5-4157-a8a8-b239a6131803	psychometric	growth_potential	leadership	high	How do you manage the risk of "over-learning" or reacting too quickly to noise?	2026-02-09 08:14:18.893463+00	\N
e411cae6-7812-4592-9b2f-16d35bf738ee	psychometric	growth_potential	leadership	high	How do you unlearn leadership habits that no longer serve a large-scale organization?	2026-02-09 08:14:18.893463+00	\N
55017bfb-a180-429e-914f-f09d289f0839	psychometric	growth_potential	leadership	high	How do you ensure your strategic learning encompasses global and geopolitical shifts?	2026-02-09 08:14:18.893463+00	\N
e9d04eae-3015-4231-9e57-35cd7c853a54	psychometric	growth_potential	leadership	high	Describe a time you lead your team through a period of extreme strategic ambiguity.	2026-02-09 08:14:18.893463+00	\N
5c3f1dab-4319-4577-a4f2-d3b9a1933ece	psychometric	growth_potential	leadership	high	How do you utilize "red teaming" to test and learn from strategic vulnerabilities?	2026-02-09 08:14:18.893463+00	\N
6a60a9a1-d2c3-4bdf-a5ae-0c53d3c9ba9d	psychometric	growth_potential	leadership	high	How do you evaluate the cognitive diverse perspectives when refining global strategy?	2026-02-09 08:14:18.893463+00	\N
cb78b337-56c0-4ac1-96a9-e77c8b226519	psychometric	growth_potential	leadership	high	Describe your approach to learning from high-consequence strategic failures.	2026-02-09 08:14:18.893463+00	\N
15a34ffa-9da9-44b0-9435-f65c35a180a3	psychometric	growth_potential	leadership	high	How do you integrate ethics and sustainability into your growth potential framework?	2026-02-09 08:14:18.893463+00	\N
db4c9306-170d-445e-8147-8bfb0650e007	psychometric	growth_potential	leadership	high	How do you ensure your strategic learning stays ahead of industry disruption?	2026-02-09 08:14:18.893463+00	\N
b19293dc-7a14-48dd-a8a4-76e91e55356a	psychometric	growth_potential	leadership	high	Describe how your personal learning goals align with organizational transformation.	2026-02-09 08:14:18.893463+00	\N
6845f1d6-b8eb-49b3-b3a7-b8748c1337e6	psychometric	growth_potential	leadership	high	How do you use strategic experiments to learn without over-committing resources?	2026-02-09 08:14:18.893463+00	\N
0a6ba502-0057-41d4-a46e-bb8c10a5fd1f	psychometric	growth_potential	leadership	high	How do you maintain cross-functional learning paths at an executive level?	2026-02-09 08:14:18.893463+00	\N
c3525909-2b06-4707-8d10-302ecb7bcad2	psychometric	growth_potential	leadership	high	Why is the ability to unlearn more critical than learning at senior stages?	2026-02-09 08:14:18.893463+00	\N
46c8dd95-8025-47e5-91e6-9b4d6df7132b	behavioral	resilience	fresher	low	Tell me about a time you did not succeed in something you wanted.	2026-02-13 09:33:54.735129+00	Score 6: Candidate identifies a specific instance of failure, expresses honest disappointment, and clearly states what they did to move forward without blaming others.
91ac39b6-bd4c-4ffe-b0fd-854c59e086ac	behavioral	resilience	fresher	low	How do you stay motivated during difficult tasks?	2026-02-13 09:33:54.735129+00	Score 6: Self-regulation. Candidate identifies a personal strategy (breaking tasks down, focus on the end goal, etc.) rather than just waiting for external help.
82ac3c30-bbf2-4c49-8912-a1e07cdea7b0	behavioral	resilience	fresher	low	Have you ever faced rejection? How did it make you feel?	2026-02-13 09:33:54.735129+00	Score 6: Vulnerability and resilience. Candidate admits the feeling of rejection but shows how they used it as a learning point for future attempts.
f6a6fa45-eb52-43f8-adf9-b94cd3d8ac86	behavioral	resilience	fresher	low	Describe a time when you wanted to quit but didnÔÇÖt.	2026-02-13 09:33:54.735129+00	Score 6: Grit. Candidate explains the source of the fatigue and the specific reason or motivation that kept them going.
610a6bc9-2b03-4f70-81d1-1145a08c2b02	behavioral	resilience	fresher	low	What do you do when your effort is not appreciated?	2026-02-13 09:33:54.735129+00	Score 6: Professionalism. Candidate shows internal validation and the ability to continue performing high-quality work regardless of external praise.
a132e2d6-5336-4a7d-8581-03827f435bbf	behavioral	resilience	fresher	medium	Tell me about a time you failed because of your own mistake. What did you learn?	2026-02-13 09:33:54.735129+00	Score 6: High ownership score. Candidate admits the mistake without excuses and provides a concrete "lesson learned" that they have applied since.
4a909775-5db9-4c86-8d20-92765670968d	behavioral	resilience	fresher	medium	Describe a situation where repeated attempts were required to succeed.	2026-02-13 09:33:54.735129+00	Score 6: Process focus. Candidate details the incremental improvements made during each attempt and the stamina required to finish.
ea53750a-e2fe-4a5c-bc5f-d2f55c584077	behavioral	resilience	fresher	medium	When you miss a deadline, how do you handle it?	2026-02-13 09:33:54.735129+00	Score 6: Accountability and communication. Candidate mentions early warning to stakeholders, taking responsibility, and a plan to prevent a recurrence.
795a8f3d-5f54-4829-ad73-00f2794afda5	behavioral	resilience	fresher	medium	Tell me about a time when you felt overwhelmed but had to continue.	2026-02-13 09:33:54.735129+00	Score 6: Stress management. Candidate identifies how they prioritized tasks and managed their mental state to complete the objective.
8984d0e1-ed78-460d-8f0e-ef445dd28bd4	behavioral	resilience	fresher	medium	Describe a situation where you received tough feedback. How did you respond?	2026-02-13 09:33:54.735129+00	Score 6: Behavioral pivot. Candidate explains how they suppressed defensiveness, asked clarifying questions, and changed their actions based on the feedback.
6412e71d-60ee-44f2-b7f9-e57008ae6d93	behavioral	resilience	fresher	medium	Share an example of how you improved after a setback.	2026-02-13 09:33:54.735129+00	Score 6: Growth trajectory. Focus on the DeltaÔÇöthe measurable difference in performance before and after the setback.
a66e10c2-f62b-4b82-9884-41abfde9f61d	behavioral	resilience	fresher	medium	Tell me about a time when others doubted your ability. What happened?	2026-02-13 09:33:54.735129+00	Score 6: Internal strength. Candidate demonstrates how they relied on evidence and hard work to prove their capability rather than engaging in conflict.
5ac05e27-78a3-4af3-a3ff-f885275d1063	behavioral	resilience	fresher	medium	How do you deal with losing in a competitive environment?	2026-02-13 09:33:54.735129+00	Score 6: Sportsmanship and analysis. Candidate shows respect for the winner and an analytical approach to why they lost and how to improve.
5a8c5667-aeb5-4287-bdc5-dea2b8169b2c	behavioral	resilience	fresher	medium	Describe a situation where you had to remain calm under pressure.	2026-02-13 09:33:54.735129+00	Score 6: Composure. Candidate describes a high-stakes moment and the specific technique (breathing, listing, etc.) used to maintain logical thinking.
5d0382ae-fc54-47fc-be9d-633a1cac3418	behavioral	resilience	fresher	medium	Tell me about a time you had to stay focused despite distractions or discouragement.	2026-02-13 09:33:54.735129+00	Score 6: Focus control. Candidate defines the distraction and the cognitive strategy used to maintain the "deep work" required for the task.
a332583b-511a-4ddf-ba9b-739a63b15881	behavioral	resilience	fresher	high	Tell me about a failure that changed how you approach challenges today.	2026-02-13 09:33:54.735129+00	Score 6: Philosophical growth. Candidate links a past failure to a current, permanent strategy for handling difficulty.
e8683199-b8a9-40f4-b162-bad80d7f19be	behavioral	resilience	fresher	high	Describe a situation where you were unfairly criticized. How did you respond?	2026-02-13 09:33:54.735129+00	Score 6: Emotional intelligence. Candidate demonstrates the ability to separate pride from productivity and how they handled the unfairness with professional poise.
6a3beba4-1a98-4f66-aa14-de4d3f14ffd1	behavioral	resilience	fresher	high	When do you decide to persist versus step back from something?	2026-02-13 09:33:54.735129+00	Score 6: Judgment. Candidate provides a logical framework for evaluating ROI vs. sunk cost, showing they don't just persist blindly.
b5764818-ae9a-41bf-8acd-57fc3295fba4	behavioral	resilience	fresher	high	Tell me about a long-term goal that required sustained effort despite setbacks.	2026-02-13 09:33:54.735129+00	Score 6: Long-arc resilience. Focus on the ability to maintain vision over months or years, managing "micro-failures" along the way.
490f7efd-18b3-4d00-8873-e6b4a9c4bf24	behavioral	resilience	fresher	high	Describe a time when your confidence was shaken. How did you rebuild it?	2026-02-13 09:33:54.735129+00	Score 6: Self-reconstruction. Candidate describes the internal work (self-talk, skill building, seeking mentorship) used to return to a high-performance state.
dfb71cb8-6979-425d-b719-2ae50b0b0092	behavioral	resilience	fresher	high	Have you ever experienced burnout or mental fatigue? How did you manage it?	2026-02-13 09:33:54.735129+00	Score 6: Self-awareness. Candidate recognizes early signs of burnout and describes a proactive system for recovery and future prevention.
7fc95d7c-85fc-4916-b161-ee3090b99816	behavioral	resilience	fresher	high	Tell me about a time when external circumstances made success difficult.	2026-02-13 09:33:54.735129+00	Score 6: Externalities. Candidate shows they didn't use circumstances as an excuse, but worked around them or found a creative path to the goal.
c9ff4be8-eab8-42f1-a21a-d1ca2381e863	behavioral	resilience	fresher	high	Describe how you handle situations where results are outside your control.	2026-02-13 09:33:54.735129+00	Score 6: Acceptance and focus. Candidate identifies that they focus only on their "circle of influence" (inputs) when the outputs are volatile.
8e8b66f4-4109-4afe-8958-b6245cfeef79	behavioral	resilience	fresher	high	What is the biggest personal setback youÔÇÖve faced, and what did it teach you?	2026-02-13 09:33:54.735129+00	Score 6: Transformative learning. A deep, reflective answer that shows the setback was a catalyst for a significant positive change in character.
525c98bb-ffeb-4538-8049-974dd2b9d605	behavioral	resilience	fresher	high	Tell me about a time when you had to motivate yourself without external encouragement.	2026-02-13 09:33:54.735129+00	Score 6: Intrinsic motivation. Candidate clearly defines their "Why" and how it sustained them when there was no validation from others.
4456ba85-cc28-4c42-ba51-6c9d611f1373	behavioral	communication	fresher	low	Tell me about a time you had to explain something to a classmate or friend.	2026-02-13 09:33:54.735129+00	Score 6: Clarity. Candidate breaks down a concept into simple steps and mentions checking if the listener understood.
0aff2131-8b7e-4a2b-a2e7-853a36d500a3	behavioral	communication	fresher	low	How do you make sure someone understands what you are saying?	2026-02-13 09:33:54.735129+00	Score 6: Feedback loop. Candidate mentions asking clarifying questions or requesting the person to repeat the instruction in their own words.
c24e4c9d-e0c7-4b58-81ce-5154c5a8e852	behavioral	communication	fresher	low	Describe a time when you asked a question to clarify something.	2026-02-13 09:33:54.735129+00	Score 6: Active listening. Candidate shows they were attentive enough to spot an ambiguity and brave enough to ask for clarification early.
ca4eacb0-427b-48ec-8407-ec99da838b3c	behavioral	communication	fresher	low	Tell me about a presentation you gave. How did you prepare?	2026-02-13 09:33:54.735129+00	Score 6: Preparation. Focus on structure, practice, and considering what the audience needed to know.
aab09eac-4cf5-47b6-a0c7-d55d52589599	behavioral	communication	fresher	low	How do you handle situations when someone interrupts you while speaking?	2026-02-13 09:33:54.735129+00	Score 6: Poise. Candidate shows they can respectfully finish their thought or pause and reintegrate without becoming defensive or aggressive.
1c050db1-b526-4db7-814d-bffe21d92676	behavioral	communication	fresher	low	Describe a time when you worked in a group discussion.	2026-02-13 09:33:54.735129+00	Score 6: Participation and balance. Candidate shows they can contribute their own ideas while also actively listening to and acknowledging others' points.
e48a845c-e81a-4b9c-a379-d1a71f669637	behavioral	communication	fresher	low	How do you adjust your language when speaking to seniors vs peers?	2026-02-13 09:33:54.735129+00	Score 6: Awareness. Candidate recognizes the need for higher formality and brevity with seniors, and more collaborative/informal tone with peers.
2ec2377a-78e5-44a5-acc1-aa1eb3eee28f	behavioral	communication	fresher	low	Tell me about a time when you had to give instructions to someone.	2026-02-13 09:33:54.735129+00	Score 6: Instruction quality. Check for step-by-step logic and the inclusion of a "reason why" to help the other person perform the task.
2af0479f-2dae-4621-a80a-2ab5426312db	behavioral	communication	fresher	low	What do you do if someone doesnÔÇÖt agree with you?	2026-02-13 09:33:54.735129+00	Score 6: Respectful inquiry. Candidate mentions trying to understand the other person's perspective before trying to re-explain their own.
4d9a6d39-455a-44f8-8cf1-26e3fbb928ae	behavioral	communication	fresher	low	Describe a situation where clear communication helped avoid confusion.	2026-02-13 09:33:54.735129+00	Score 6: Outcome focus. Candidate describes a "pre-emptive" strike of clarity (like a summary email or a quick chat) that prevented a mistake.
a635b982-fb91-433b-b14b-d37821787014	behavioral	communication	fresher	medium	Tell me about a time you had to convince someone to support your idea.	2026-02-13 09:33:54.735129+00	Score 6: Persuasion with evidence. Candidate shows they used data, logic, or a benefit-to-the-other-person approach rather than just repeating their opinion.
172866b7-0a5b-46c4-add1-0c2d65a00aab	behavioral	communication	fresher	medium	Describe a situation where there was a misunderstanding. How did you resolve it?	2026-02-13 09:33:54.735129+00	Score 6: Resolution. Candidate takes partial responsibility for the gap, focuses on "clarifying the future" rather than "blaming the past."
eb25269b-8cc3-48ae-8f27-2d6d908c4f9b	behavioral	communication	fresher	medium	How do you handle disagreement during a team discussion?	2026-02-13 09:33:54.735129+00	Score 6: Collaborative de-escalation. Candidate uses "I" statements, seeks common ground, and focuses on the team objective over being right.
020bfc86-d991-4be9-be7c-0348ead473f9	behavioral	communication	fresher	medium	Tell me about a time when you had to simplify a complex topic.	2026-02-13 09:33:54.735129+00	Score 6: Abstraction skill. Candidate uses analogies or removes jargon to make a difficult concept accessible to a non-expert.
52a1e1d5-894d-489a-92dd-49d70494252a	behavioral	communication	fresher	medium	Describe how you handle receiving negative feedback in front of others.	2026-02-13 09:33:54.735129+00	Score 6: Professional dignity. Candidate shows they can remain calm, acknowledge the feedback, and request a private follow-up if needed to avoid public conflict.
fb6a1821-b271-40fd-b19f-c7de99cbd907	behavioral	communication	fresher	medium	Tell me about a time when you had to communicate under time pressure.	2026-02-13 09:33:54.735129+00	Score 6: Efficiency. Candidate demonstrates the ability to strip away non-essential info and provide a high-signal "bottom line up front" (BLUF) message.
8360706f-15ae-438b-b087-95a3576aaf6f	behavioral	communication	fresher	medium	How do you ensure active listening during conversations?	2026-02-13 09:33:54.735129+00	Score 6: Technique. Candidate mentions summarizing, nodding, removing distractions, and asking follow-up questions that prove they were listening.
064897ee-4619-400a-ba3d-563c691f4aa2	behavioral	communication	fresher	medium	Describe a time when your communication style caused confusion.	2026-02-13 09:33:54.735129+00	Score 6: Self-correction. Candidate identifies their own error (e.g., being too detailed), explains how they noticed the confusion, and how they corrected it.
6ff7316e-3114-47d3-92e2-2c1c2a67e1c4	behavioral	communication	fresher	medium	Tell me about a time when you had to communicate bad news.	2026-02-13 09:33:54.735129+00	Score 6: Empathy and solution. Candidate delivers the direct truth with kindness and immediately provides a potential next step or support.
103f86d3-a82f-4813-9c98-d481eda701ef	behavioral	communication	fresher	medium	How do you structure your thoughts before speaking in an important discussion?	2026-02-13 09:33:54.735129+00	Score 6: Intentionality. Candidate mentions mental bullet points, a beginning-middle-end structure, or focusing on the "Target Outcome" of the speech.
98c30d3b-dbc9-4035-ac34-bc1b993da6a9	behavioral	communication	fresher	high	Tell me about a time when your message was misunderstood despite your effort. Why do you think that happened?	2026-02-13 09:33:54.735129+00	Score 6: Deep analysis. Candidate looks at cultural, medium, or noise-related factors and proposes a structural change to their communication strategy.
7f7ff616-7e9e-4451-8518-b7901d835ca1	behavioral	communication	fresher	high	Describe a situation where you had to influence someone who strongly disagreed with you.	2026-02-13 09:33:54.735129+00	Score 6: Influence strategy. Candidate shows they built rapport first, mapped the other person's objections, and adjusted their message to align with the other's values.
e18c19ba-3d0e-45f1-8961-d5567002cab2	behavioral	communication	fresher	high	How do you handle communication with someone who is emotionally upset?	2026-02-13 09:33:54.735129+00	Score 6: De-escalation and empathy. Candidate shows they prioritize "lowering the temperature" and listening over "Winning the argument" or logic-bombing.
acc44e3e-f30f-40c5-ae74-b96a4c0633fa	behavioral	communication	fresher	high	Tell me about a time when you had to adjust your communication style mid-conversation.	2026-02-13 09:33:54.735129+00	Score 6: Adaptive intelligence. Candidate describes reading non-verbal cues (boredom, confusion) and immediately changing their tone or level of detail.
fa5da977-363d-4720-9b88-197d3ba9d2d2	behavioral	communication	fresher	high	Describe a situation where listening was more important than speaking.	2026-02-13 09:33:54.735129+00	Score 6: Strategic silence. Candidate explains how withholding their opinion allowed them to gather crucial data that changed the eventual solution.
5c3d3696-1acf-4659-bc97-29e63aa6f361	behavioral	communication	fresher	high	Have you ever had to challenge someone respectfully? What approach did you use?	2026-02-13 09:33:54.735129+00	Score 6: Constructive conflict. Focus on challenging the *idea* not the *person*, using evidence-based questions rather than statements.
17bdf66e-3797-4a1a-bf4d-b3309ba4d453	behavioral	communication	fresher	high	Tell me about a time when your non-verbal communication impacted the outcome.	2026-02-13 09:33:54.735129+00	Score 6: Body language awareness. Candidate understands how their tone, eye contact, or posture either reinforced or undermined their verbal message.
c6b6b7d2-1d6b-4cbc-862b-3361e6f1aa71	behavioral	communication	fresher	high	How do you balance confidence and humility when presenting ideas?	2026-02-13 09:33:54.735129+00	Score 6: Nuance. Candidate explains they are confident in the *research/logic* but humble about the *outcome/implementation*, inviting others to improve the plan.
33710e0e-d81b-4b66-b874-5b245057e590	behavioral	communication	fresher	high	Describe a time when you had to speak up even though you were nervous.	2026-02-13 09:33:54.735129+00	Score 6: Courage. Candidate demonstrates that their commitment to the group outcome or the truth was stronger than their personal fear.
8c1993d5-144a-4e1e-b56c-abd5c6c4b444	behavioral	communication	fresher	high	If a team conflict arises due to miscommunication, how would you resolve it?	2026-02-13 09:33:54.735129+00	Score 6: Mediation. Focus on bringing parties together, establishing shared definitions, and creating a "communication contract" to prevent the next conflict.
2e980dfe-3e45-4583-975f-f728ada7d5e6	behavioral	adaptability	fresher	low	Tell me about a time when your plans changed unexpectedly.	2026-02-13 09:33:54.735129+00	Score 6: Ease of shift. Candidate shows they didn't waste time complaining but immediately asked, "What is the new priority?"
8609f412-2fa9-4d60-80a7-99c43e420097	behavioral	adaptability	fresher	low	How do you react when you are given a new task at the last minute?	2026-02-13 09:33:54.735129+00	Score 6: Positivity and throughput. Candidate mentions clarifying the urgency and then integrating the new task into their workflow without panic.
22858cd0-811c-4ad0-9d5d-0d6abcbc7a07	behavioral	adaptability	fresher	low	Describe a time when you had to adjust to a new schedule.	2026-02-13 09:33:54.735129+00	Score 6: Habit adjustment. Candidate shows they modified their personal routine or preparation style to accommodate the change effectively.
387e6b83-14eb-4698-8749-c57bcd51b637	behavioral	adaptability	fresher	low	Tell me about a time you had to learn something new for a project.	2026-02-13 09:33:54.735129+00	Score 6: Learning speed. Candidate identifies the tool/skill and the specific, fast-track learning method they used (tutorials, peer shadowing, etc.).
9e0fee00-788d-4d02-a299-a4699792a96f	behavioral	adaptability	fresher	low	How do you handle working with different types of people?	2026-02-13 09:33:54.735129+00	Score 6: Social flexibility. Candidate avoids generalizations and mentions looking for the strengths in diverse working styles.
b2f2e7fa-fdab-4873-baaf-5d0829b5551f	behavioral	adaptability	fresher	low	Describe a situation where you had to follow new rules or instructions.	2026-02-13 09:33:54.735129+00	Score 6: Compliance and logic. Candidate shows they can adopt a new process quickly while understanding why the change was made.
92b10590-4e67-4510-86cb-21c5ed78447b	behavioral	adaptability	fresher	low	Tell me about a time when you had to step out of your comfort zone.	2026-02-13 09:33:54.735129+00	Score 6: Risk-taking. Candidate defines the "fear factor" and explains why they decided the goal was worth the discomfort.
eadf379d-1cbe-4fe1-a48c-d5bac07a957a	behavioral	adaptability	fresher	low	How do you respond when your routine is disrupted?	2026-02-13 09:33:54.735129+00	Score 6: Recovery. Candidate shows they have a "fallback" system allowing them to stay productive despite the interruption.
87de3e54-775c-48a9-9aa5-f55d1b7d92cc	behavioral	adaptability	fresher	low	Describe a time when you had to multitask.	2026-02-13 09:33:54.735129+00	Score 6: Task switching. Candidate shows how they kept track of multiple threads without letting any "drop," demonstrating structured attention.
0220c2d2-7e9a-45b1-b4aa-93fe3735020a	behavioral	adaptability	fresher	low	Tell me about a time when you had to quickly understand a new topic.	2026-02-13 09:33:54.735129+00	Score 6: Synthesis. Candidate explains how they identified the "core principles" of a new topic to get up to speed within hours or days.
3c5b842a-9b25-4af8-8429-d549e2037fed	behavioral	adaptability	fresher	medium	Tell me about a time when a project requirement changed midway. What did you do?	2026-02-13 09:33:54.735129+00	Score 6: Pivot efficiency. Candidate demonstrates discarding the old work without emotional attachment and moving rapidly to the new direction.
7d68b47f-9f3b-41ce-9f53-ab290ce74136	behavioral	adaptability	fresher	medium	Describe a situation where you had to take on a responsibility outside your usual role.	2026-02-13 09:33:54.735129+00	Score 6: Extension. Candidate shows curiosity and a "can-do" attitude, doing their own research to master the unexpected duty.
1767f485-bf58-475d-8f6a-f988c07709ef	behavioral	adaptability	fresher	medium	How do you manage when priorities shift suddenly?	2026-02-13 09:33:54.735129+00	Score 6: Triage skill. Candidate explains how they re-negotiate deadlines or communicate with stakeholders about what will be delayed and why.
78a64663-2a95-42dd-9ab4-972ca22680aa	behavioral	adaptability	fresher	medium	Tell me about a time when you had to learn a new tool or software quickly.	2026-02-13 09:33:54.735129+00	Score 6: Depth of learning. Candidate mentions not just using the tool, but discovering a feature or shortcut that improved the project outcome.
baefdace-73cf-418a-96a1-98ff3bda0228	behavioral	adaptability	fresher	medium	Describe a time when you had to work with someone whose style was very different from yours.	2026-02-13 09:33:54.735129+00	Score 6: Style bridging. Candidate shows they adjusted their own style to mesh with the other person, creating a more effective partnership.
a379d821-bbeb-4a2d-bf92-3c946a5aacfd	behavioral	adaptability	fresher	medium	Tell me about a situation where you had limited information but still had to act.	2026-02-13 09:33:54.735129+00	Score 6: Decision-making. Candidate explains how they used the 20% of info they had to make a 100% effort, maintaining a "bias for action."
d88f58ab-b63b-431b-85fc-dbe91c40c713	behavioral	adaptability	fresher	medium	How do you handle uncertainty when expectations are unclear?	2026-02-13 09:33:54.735129+00	Score 6: Proactivity. Candidate doesn't wait for ordersÔÇöthey propose a direction and ask for verification, "creating clarity from chaos."
0cd08f5f-f831-48de-be48-62c5cb35ecdf	behavioral	adaptability	fresher	medium	Describe a time when you had to adapt after receiving critical feedback.	2026-02-13 09:33:54.735129+00	Score 6: Applied change. Focus on the actual change in behavior that persisted months after the feedback was given.
d264ac25-01d0-48ab-a107-4d1286d64caf	behavioral	adaptability	fresher	medium	Tell me about a time when you had to switch strategies to complete a task.	2026-02-13 09:33:54.735129+00	Score 6: Solution-oriented thinking. Candidate recognizes why Strategy A was failing and documents the logical reason for moving to Strategy B.
b090cf75-6aa9-4618-8205-2f98a962a490	behavioral	adaptability	fresher	medium	How do you respond when your original solution does not work?	2026-02-13 09:33:54.735129+00	Score 6: Humility and iteration. Candidate shows they aren't "married to their ideas" and can rapidly test a second hypothesis.
858ab6f3-287d-4237-a031-bf1032d4e3ce	behavioral	adaptability	fresher	high	Tell me about a time when you had to make a decision without full information.	2026-02-13 09:33:54.735129+00	Score 6: Calculated risk. Candidate explains their "assumption-based reasoning" and how they built a safety net while moving forward.
c85fda04-8015-42f0-899b-d076d1fb410d	behavioral	adaptability	fresher	high	Describe a situation where multiple unexpected challenges occurred at once.	2026-02-13 09:33:54.735129+00	Score 6: Crisis management. Focus on the ability to remain calm, segment the problems, and solve them sequentially without becoming paralyzed.
19bd7965-6302-4b44-954e-1135feb50427	behavioral	adaptability	fresher	high	How do you approach situations where there is no clear right answer?	2026-02-13 09:33:54.735129+00	Score 6: Ambiguity tolerance. Candidate provides a framework (logic, values, or outcome-based) they use to navigate "Gray areas."
7d21c1af-4d2c-4a46-9acc-c2b2affc4b5b	behavioral	adaptability	fresher	high	Tell me about a time when you had to unlearn something to learn a better way.	2026-02-13 09:33:54.735129+00	Score 6: Ego dissolution. Candidate shows the ability to let go of "how we've always done it" to adopt a more efficient, modern method.
89329d60-432c-4f74-b127-a0b56ffbcbb5	behavioral	adaptability	fresher	high	Describe a time when your assumptions were proven wrong. How did you adjust?	2026-02-13 09:33:54.735129+00	Score 6: Intellectual honesty. Candidate demonstrates the ability to pivot immediately upon finding new data that contradicts their belief.
2102b4f4-d1a8-45bf-ac4e-bf221d4538e3	behavioral	adaptability	fresher	high	How do you handle working in an environment where expectations keep changing?	2026-02-13 09:33:54.735129+00	Score 6: Systemized flexibility. Candidate mentions building "flexible systems"ÔÇötools or habits that can handle high volatility without breaking.
19e4c447-bda1-4e2b-a757-c28a11af53bf	behavioral	adaptability	fresher	high	Tell me about a time when you had to manage both academic and personal challenges simultaneously.	2026-02-13 09:33:54.735129+00	Score 6: Resilience integration. Focus on the ability to maintain performance levels across different life domains during a storm.
b3235278-2d4b-4432-b6ea-25bdd5fe380e	behavioral	adaptability	fresher	high	Describe a situation where you had to adapt your working style to succeed in a team.	2026-02-13 09:33:54.735129+00	Score 6: Group-centric adaptation. Candidate shows they consciously suppressed a personal preference for the sake of the team's higher efficiency.
d06bdffe-5f94-453e-80db-172082859b00	behavioral	adaptability	fresher	high	Tell me about a time when you took initiative during uncertainty.	2026-02-13 09:33:54.735129+00	Score 6: Leadership in flux. Candidate describes a moment where they stepped into a vacuum of direction and provided a roadmap for others.
055defad-ddef-4c66-8498-f73cd04cb3a5	behavioral	adaptability	fresher	high	If assigned to a completely unfamiliar domain tomorrow, how would you approach it?	2026-02-13 09:33:54.735129+00	Score 6: First Principles thinking. Candidate doesn't panic; they describe a structured "onboarding plan" involving research, mental models, and seeking experts.
7965ca87-e665-4d51-b34f-da7e4ab5b8d5	behavioral	resilience	mid	low	Tell me about a time you missed a target. What did you do next?	2026-02-13 09:38:22.506024+00	Score 6: Candidate takes immediate ownership without blaming external factors. They detail an analytical post-mortem and the corrective actions taken to prevent a recurrence.
5c20c1b7-c72b-4e4e-80f0-2f254af1a8e8	behavioral	resilience	mid	low	How do you handle rejection from clients or stakeholders?	2026-02-13 09:38:22.506024+00	Score 6: Candidate views rejection as an information-gathering exercise. They describe a specific method for uncovering the "Why" and staying professionally engaged for future opportunities.
21f45319-6dfe-4476-b406-0f3a3c5f3284	behavioral	resilience	mid	low	Describe a time when your effort did not immediately produce results.	2026-02-13 09:38:22.506024+00	Score 6: Focus on "Deep Work" and patience. Candidate explains their system for tracking progress through secondary metrics (lagging vs leading indicators).
2296fba7-3f75-45cb-baf1-59ad5ff7ebea	behavioral	resilience	mid	low	Tell me about a challenging week at work and how you handled it.	2026-02-13 09:38:22.506024+00	Score 6: Stress management and prioritization. Candidate describes how they segmented high-value tasks and maintained personal wellbeing to sustain performance.
f1285b4e-593b-4e44-94b3-f8ad27e0c014	behavioral	resilience	mid	low	How do you stay motivated during slow business periods?	2026-02-13 09:38:22.506024+00	Score 6: Proactive self-starting. Candidate mentions specific productive activities (upskilling, pipeline cleanup, internal projects) used during downtime point.
fdb652a1-51b3-4640-8c7c-9481648cf634	behavioral	resilience	mid	low	Describe a time when you faced negative feedback from a manager.	2026-02-13 09:38:22.506024+00	Score 6: Professional maturity. Candidate demonstrates the ability to separate ego from the goal, asking clarifying questions and documenting an improvement plan.
927e6070-7094-4792-be9d-99398ee74c8b	behavioral	resilience	mid	low	What do you do when a client says ÔÇ£noÔÇØ?	2026-02-13 09:38:22.506024+00	Score 6: Strategic persistence. Candidate describes qualifying the "No"ÔÇöis it permanent or temporary? They show a method for keeping the relationship warm.
e1f2fe49-4b24-4fb4-9c5e-759895704470	behavioral	resilience	mid	low	Tell me about a time when you had to restart a task due to errors.	2026-02-13 09:38:22.506024+00	Score 6: Accountability and speed. Candidate explains the error, acknowledges the lost time, and details a more efficient "v2" process to catch up.
1fe0925d-0536-475a-8e82-9a932fdc72b6	behavioral	resilience	mid	low	How do you manage stress during peak workload?	2026-02-13 09:38:22.506024+00	Score 6: Systematic organization. Candidate mentions tools/methods (Time-blocking, Eisenhower matrix) used to maintain logic under pressure.
02cd6416-5845-49ab-aae0-371b8cb33266	behavioral	resilience	mid	low	Describe a situation where persistence helped you succeed.	2026-02-13 09:38:22.506024+00	Score 6: Goal orientation. Focus on the long-arc effort and the specific moment they could have quit but chose a new creative angle instead.
9b16dd23-7339-4f66-927e-c72078531b6c	behavioral	resilience	mid	medium	Tell me about a deal or project that failed despite your effort.	2026-02-13 09:38:22.506024+00	Score 6: High-level reflection. Candidate identifies the "uncontrollables" while still finding one personal behavior they would change for next time.
ad4c7f5d-c452-4468-80a9-a850d1979a28	behavioral	resilience	mid	medium	Describe a time when repeated objections tested your patience.	2026-02-13 09:38:22.506024+00	Score 6: Composure. Candidate shows they maintained professional standards and used curiosity to understand the root of the objections rather than getting defensive.
cabdb7f9-48e0-4867-bc99-99d30c98fb60	behavioral	resilience	mid	medium	How do you recover after losing an important opportunity?	2026-02-13 09:38:22.506024+00	Score 6: Resilience cycle. Candidate describes a brief "cool-down" followed by an objective analysis of the loss and immediate focus on the next target.
40bf31f6-8c16-4950-9764-60e686be2d0d	behavioral	resilience	mid	medium	Tell me about a time when you had to maintain performance despite personal challenges.	2026-02-13 09:38:22.506024+00	Score 6: Resilience integration. Focus on the ability to compartmentalize effectively while maintaining honest communication with the team if necessary.
1333c5ac-2a61-4b15-a6fe-4f0e9689c1fd	behavioral	resilience	mid	medium	Describe a time when you faced unfair criticism at work.	2026-02-13 09:38:22.506024+00	Score 6: Conflict management. Candidate shows they addressed the unfairness through evidence-based discussion or high performance, rather than toxic behavior.
d4ae5fff-2a4c-484b-a927-7a7d99669c13	behavioral	resilience	mid	medium	How do you prevent burnout during demanding periods?	2026-02-13 09:38:22.506024+00	Score 6: Self-awareness. Candidate defines their early warning signs of stress and the specific boundaries or recovery habits they use to stay at 100%.
f61c851a-9531-4ff2-ac4e-45062b68b3e9	behavioral	resilience	mid	medium	Tell me about a time when your confidence was impacted professionally.	2026-02-13 09:38:22.506024+00	Score 6: Self-reconstruction. Candidate describes the specific "win" or mentorship they sought to rebuild their professional self-esteem.
a3f1e437-2917-43c5-8106-687fe20abb54	behavioral	resilience	mid	medium	Describe a situation where you had to manage disappointment within your team.	2026-02-13 09:38:22.506024+00	Score 6: Leadership potential. Candidate shows they acknowledged the team's feelings but pivoted the group rapidly toward a shared future goal.
673121af-9c60-4b63-82fe-8ee2edda424a	behavioral	resilience	mid	medium	How do you balance persistence without becoming pushy?	2026-02-13 09:38:22.506024+00	Score 6: Sales EQ. Candidate describes the difference between "repetition" and "adding value" at each point of follow-up.
7105dfbf-1580-454f-b239-2576f17376ff	behavioral	resilience	mid	medium	Tell me about a time when resilience directly impacted business results.	2026-02-13 09:38:22.506024+00	Score 6: ROI focus. A clear story where refusing to give up on a "lost cause" (with a logical reason) led to a measurable financial or project success.
72dfe839-694b-4fb6-8621-cf41ba598c08	behavioral	resilience	mid	high	Tell me about a prolonged period of underperformance. What changed?	2026-02-13 09:38:22.506024+00	Score 6: Transformative ownership. Candidate recognizes a flawed pattern in their own work and describes a structural change in their methodology to fix it.
890b9c29-d115-40ce-ad6b-58d75bb16980	behavioral	resilience	mid	high	Describe a time when external factors (market, policy, competition) affected your results.	2026-02-13 09:38:22.506024+00	Score 6: Strategic Pivot. Candidate shows they didn't just survive the external change, but adapted their offering/strategy to find a new advantage within the new reality.
3975e930-8a06-495b-89d4-d8a4b4e1b577	behavioral	resilience	mid	high	When do you decide to walk away from an opportunity instead of persisting?	2026-02-13 09:38:22.506024+00	Score 6: Strategic judgment. Focus on the analytical framework (Opportunity Cost, ROI, Ideal Customer Profile) used to make the "hard call" to quit.
cad081bc-ac6b-4a40-bd2c-89f4201192ad	behavioral	resilience	mid	high	Tell me about a time when you had to motivate others despite setbacks.	2026-02-13 09:38:22.506024+00	Score 6: Infectious resilience. Candidate demonstrates how they projected confidence and provided a roadmap that suppressed the team's collective fear.
597979f8-a58c-4604-93ab-a445396124f8	behavioral	resilience	mid	high	Describe a situation where resilience required emotional control rather than action.	2026-02-13 09:38:22.506024+00	Score 6: Sophisticated composure. Focus on the "waiting game"ÔÇöstaying firm and not overreacting during a volatile or high-stakes period of inaction.
4aa26328-968a-485b-a6f5-87fea02b1863	behavioral	resilience	mid	high	How do you handle losing to a strong competitor repeatedly?	2026-02-13 09:38:22.506024+00	Score 6: Competitive intelligence. Candidate uses the losses to map the competitor's strengths and identifies a specific "Blue Ocean" or niche to win back market share.
9583abf7-dad9-41f3-ba65-256ccf30a665	behavioral	resilience	mid	high	Tell me about a high-pressure situation where staying calm changed the outcome.	2026-02-13 09:38:22.506024+00	Score 6: Critical impact. Describes a specific incident (negotiation, crisis) where their refusal to panic allowed for a logical solution others missed.
c6644bdf-bf71-4935-a11e-34342102aa3d	behavioral	resilience	mid	high	Describe how you rebuild trust after a mistake.	2026-02-13 09:38:22.506024+00	Score 6: Trust repair. Focus on immediate disclosure, fixing the error at personal cost, and consistent follow-through over the subsequent months.
3418de8a-f618-4f27-9ebd-727fd3e0b670	behavioral	resilience	mid	high	Tell me about a time when you faced resistance from multiple stakeholders.	2026-02-13 09:38:22.506024+00	Score 6: Stakeholder management. Candidate shows they identified individual motivations and used "resilient diplomacy" to find a common path forward.
46106166-144b-4c9d-82f0-d305bd2c75f5	behavioral	resilience	mid	high	What have failures taught you about your working style over the years?	2026-02-13 09:38:22.506024+00	Score 6: Meta-learning. Deeply reflective answer showing how they have evolved from a "effort-only" mindset to a "result-and-process" mindset.
95ac72af-8ad2-4993-a5dc-1b762144593c	behavioral	communication	mid	low	Tell me about a time you explained a product or idea to a client.	2026-02-13 09:38:22.506024+00	Score 6: Feature-to-Benefit transformation. Candidate shows they didn't just list specs but explained the specific value to the listener.
6a11d6ab-22f7-4ffe-875c-08160b84956f	behavioral	communication	mid	low	How do you ensure your message is clearly understood?	2026-02-13 09:38:22.506024+00	Score 6: Active verification. Candidate mentions requesting confirmation of key details or setting clear "Next Steps" that the other party agrees to.
7643d8c5-2827-47fc-be27-e609ff47ce9f	behavioral	communication	mid	low	Describe a time when you had to present in front of a small group.	2026-02-13 09:38:22.506024+00	Score 6: Presence and structure. Focus on opening with a hook, maintaining eye contact, and managing a Q&A session effectively.
89e67fd4-f0ae-4eb7-8bcc-967223bd9f1a	behavioral	communication	mid	low	Tell me about a time when you clarified a misunderstanding.	2026-02-13 09:38:22.506024+00	Score 6: De-escalation. Candidate describes noticing a misalignment and using neutral language to bridge the gap before the issue intensified.
047e5b48-8ba5-4038-8392-ff99d719936e	behavioral	communication	mid	low	How do you adapt your communication style for different people?	2026-02-13 09:38:22.506024+00	Score 6: Person-centricity. Candidate identifies different types (Analytical vs Expressive) and social cues they use to adjust their tone and pace.
5d12356d-760b-440f-ad71-84799cc8aa11	behavioral	communication	mid	low	Describe a time when you had to provide instructions to a colleague.	2026-02-13 09:38:22.506024+00	Score 6: Delegatory clarity. Focus on providing the Goal, the Resources, and the Deadline, along with a "Why" to ensure commitment.
99081be6-bc83-48e6-a3d5-1a793a55e24e	behavioral	communication	mid	low	Tell me about a successful conversation that helped move a project forward.	2026-02-13 09:38:22.506024+00	Score 6: Outcome focus. Identifies a specific "blocker" that was removed through targeted communication rather than just formal progress updates.
4e2162aa-2b7a-4883-b11a-dcfa3f8f2428	behavioral	communication	mid	low	How do you handle interruptions during meetings?	2026-02-13 09:38:22.506024+00	Score 6: Polite firmess. Candidate shows they can hold the floor or acknowledge the interruption while maintaining the primary agenda.
98195733-a6ce-4873-8a76-dfe51ef563d9	behavioral	communication	mid	low	Describe a time when written communication was critical.	2026-02-13 09:38:22.506024+00	Score 6: Written impact. Focus on brevity, formatting (bullets, bolding), and ensuring the "Call to Action" was unmistakable.
cd9dfc78-eeba-4758-8729-8dcff4597b49	behavioral	communication	mid	low	Tell me about a time when good communication avoided a problem.	2026-02-13 09:38:22.506024+00	Score 6: Predictive communication. Candidate describes sounding an early alarm about a potential risk, allowing the team to adjust before it became a crisis.
ea9c470b-a1c9-4df3-bf41-6e331b685eb3	behavioral	communication	mid	medium	Tell me about a time you had to handle a client objection.	2026-02-13 09:38:22.506024+00	Score 6: Consultative handling. Candidate describes listening fully, empathizing, and then using evidence or a "Yes, and" approach to resolve the concern.
2163d628-09df-48c7-9e94-b0b1fdf4ad93	behavioral	communication	mid	medium	Describe a situation where you had to persuade someone who was hesitant.	2026-02-13 09:38:22.506024+00	Score 6: Persuasion strategy. Candidate identifies the source of the hesitation (fear, cost, timing) and provides a specific reassurance or data point that moved them.
423fc35d-6a90-46c5-928e-75df44f19121	behavioral	communication	mid	medium	How do you uncover a clientÔÇÖs real needs beyond what they initially state?	2026-02-13 09:38:22.506024+00	Score 6: Probing mastery. Candidate mentions "The 5 Whys" or open-ended discovery questions used to find the emotional or structural root of the need.
da9a0df0-2981-461e-a90a-58ff3c832e25	behavioral	communication	mid	medium	Tell me about a time when you had to communicate under pressure.	2026-02-13 09:38:22.506024+00	Score 6: High-signal brevity. Candidate shows the ability to deliver crucial information clearly despite high stakes or time constraints.
526175ea-b9ae-4d34-9225-c7a3f507a26d	behavioral	communication	mid	medium	Describe a negotiation where maintaining the relationship was important.	2026-02-13 09:38:22.506024+00	Score 6: Win-Win mindset. Candidate explains how they balanced their own objectives with a genuine concern for the other party's long-term satisfaction.
8aa65e0a-69b5-494d-b289-beed55a9c3e1	behavioral	communication	mid	medium	Tell me about a time when you had to simplify a complex solution.	2026-02-13 09:38:22.506024+00	Score 6: Bridge building. Focus on removing jargon and using analogies that relevant stakeholders (like Finance or IT) can immediately grasp.
1d648441-9fab-40ab-8ce9-25626ee37681	behavioral	communication	mid	medium	How do you manage disagreement in professional discussions?	2026-02-13 09:38:22.506024+00	Score 6: Logical de-escalation. Candidate shows they focus on "What is right" rather than "Who is right," using objective data to settle the dispute.
ce8cfde7-aeb3-4ec6-b2a1-fa036bd3080e	behavioral	communication	mid	medium	Describe a situation where you had to influence cross-functional teams.	2026-02-13 09:38:22.506024+00	Score 6: Matrix influence. Candidate shows they understood the "language" of other departments (Sales vs Engineering) and tailored their message to align goals.
11d6f88b-c9a0-481e-813e-ab5430a3d2eb	behavioral	communication	mid	medium	Tell me about a time when active listening changed the outcome.	2026-02-13 09:38:22.506024+00	Score 6: Detail detection. Candidate describes hearing a "minor comment" that changed their entire understanding of the client's problem.
86da4dd6-384d-4581-9296-91dc7d6ec1aa	behavioral	communication	mid	medium	How do you handle communication breakdown within a team?	2026-02-13 09:38:22.506024+00	Score 6: Restorative communication. Identifies a specific gap (culture, tool, process) and proposes a structured solution like a daily huddle or a shared tracker.
30ff5726-9f7c-417c-9216-2eb048eb66d6	behavioral	communication	mid	high	Tell me about a time when you had to influence multiple stakeholders with different priorities.	2026-02-13 09:38:22.506024+00	Score 6: Consensus building. Candidate describes mapping stakeholder interests and finding a "common denominator" that allowed all parties to say "Yes."
56141135-7ee5-40e1-bc29-d8ee79714a57	behavioral	communication	mid	high	Describe a situation where your communication prevented a major escalation.	2026-02-13 09:38:22.506024+00	Score 6: Strategic de-escalation. Focus on early detection of a risk and the specific "diplomatic" conversation that lowered the temperature.
75713fb4-5948-4b13-a89f-28abfa159808	behavioral	communication	mid	high	How do you tailor your messaging for senior leadership vs operational teams?	2026-02-13 09:38:22.506024+00	Score 6: Altitude adjustment. Candidate understands that leaders want "Outcome/Risk" while operations want "Process/Detail," and shows how they adapt the same data for both.
b958760b-cefb-45e3-bda2-11ce85eb9322	behavioral	communication	mid	high	Tell me about a time when you had to deliver difficult news to a client.	2026-02-13 09:38:22.506024+00	Score 6: Radical transparency. Candidate shows they delivered the news directly, with empathy, and with a concrete plan for recovery/assistance.
b9b362b1-c434-4542-a334-a02b87506b81	behavioral	communication	mid	high	Describe a time when miscommunication caused business impact. What did you learn?	2026-02-13 09:38:22.506024+00	Score 6: Systemic root cause analysis. Candidate identifies not just a personal error, but a flaw in the "Communication Channel" and how they fixed the process.
06eb0a31-d0ed-47d3-9173-b30d3930fd28	behavioral	communication	mid	high	Tell me about a negotiation where you had to balance firmness and flexibility.	2026-02-13 09:38:22.506024+00	Score 6: Trade-off logic. Candidate demonstrates and explains their "Walk-away point" and where they were willing to give to gain a larger concession.
006bff02-28bd-4487-8d90-5a44e3841154	behavioral	communication	mid	high	How do you handle emotionally charged conversations?	2026-02-13 09:38:22.506024+00	Score 6: Emotional intelligence. Candidate prioritizes acknowledging the emotion first to clear the path for a logical discussion afterward.
1751e09e-4e63-4bad-be07-41b4eb7062b4	behavioral	communication	mid	high	Describe a time when your communication style had to change mid-discussion.	2026-02-13 09:38:22.506024+00	Score 6: Real-time adaptivity. Candidate describes reading non-verbal "Resistance" and shifting from "Advocacy" to "Inquiry" to find the hidden objection.
6d40f46c-1bd8-41f5-8003-2cdf3e6bc7af	behavioral	communication	mid	high	Tell me about a time when you had to rebuild trust through communication.	2026-02-13 09:38:22.506024+00	Score 6: Accountability. Focus on the long-term consistency of messaging: Admit > Apologize > Act > Update consistently.
63d176a8-0bb1-4310-a3b7-8efe708f411f	behavioral	communication	mid	high	How do you ensure alignment when multiple stakeholders are involved?	2026-02-13 09:38:22.506024+00	Score 6: Governance. Mentions specific tools like RACI charts, shared briefs, or summary emails sent immediately after meetings to lock in alignment.
334d0279-1a6b-460a-94ec-1047d2cbbacb	behavioral	adaptability	mid	low	Tell me about adapting to a new manager.	2026-02-13 09:38:22.506024+00	Score 6: Relationship agility. Candidate shows they proactively scheduled a "working style discovery" chat to align expectations early.
2601c9c2-1366-44ab-834b-cfe6e67f9b20	behavioral	adaptability	mid	low	Describe adjusting to new company policies.	2026-02-13 09:38:22.506024+00	Score 6: Pragmatism. Candidate shows they moved from "skeptical" to "compliant" by finding the organizational logic behind the new policy.
9941bc9f-27b9-4fca-a080-f0c6a107159d	behavioral	adaptability	mid	low	How do you handle sudden client requests?	2026-02-13 09:38:22.506024+00	Score 6: Agility and triage. Candidate shows how they paused their routine, assessed the priority, and fulfilled the request without dropping other balls.
a593aa52-4bda-46b6-9bae-27da4b292df6	behavioral	adaptability	mid	low	Tell me about switching between projects.	2026-02-13 09:38:22.506024+00	Score 6: Context switching. Candidate mentions specific methods (Notes, Trello, ritualized transitions) used to maintain focus during rapid project changes.
5206c761-39a2-44de-a679-de6d4e15d2f1	behavioral	adaptability	mid	low	Describe adapting to new tools or software.	2026-02-13 09:38:22.506024+00	Score 6: Tech curiosity. Candidate shows they didn't just learn the basics but looked for advanced shortcuts to maintain their previous productivity levels.
9fe10337-4401-4a3d-95cb-5acc968117e4	behavioral	adaptability	mid	low	Tell me about handling workload changes.	2026-02-13 09:38:22.506024+00	Score 6: Scalability. Candidate describes how they adjusted their personal pace or requested specific temporary help when the volume increased.
b5176d66-5538-4220-9590-a98e212a4ac2	behavioral	adaptability	mid	low	How do you respond to last-minute changes in meetings?	2026-02-13 09:38:22.506024+00	Score 6: Mental flexibility. Candidate shows they can pivot their preparation on the fly to address the new agenda without visible frustration.
8f026dda-2365-44ba-b7b6-992bca8c2064	behavioral	adaptability	mid	low	Describe adapting to remote or hybrid work.	2026-02-13 09:38:22.506024+00	Score 6: Discipline and tool usage. Focus on proactive communication (Slack/Zoom) and setting clear "availability boundaries" to stay effective.
88bb04f2-6d70-4489-aca2-7f246a51f4de	behavioral	adaptability	mid	low	Tell me about working with cross-functional teams.	2026-02-13 09:38:22.506024+00	Score 6: Goal alignment. Candidate understands they are part of a larger machine and shows how they adjusted their own deliverables to help the other team succeed.
9fa0a869-aba1-49f5-9022-af291851e2e2	behavioral	adaptability	mid	low	How do you manage unexpected travel or schedule changes?	2026-02-13 09:38:22.506024+00	Score 6: Resourcefulness. Candidate describes handling the logistics calmly while ensuring work output remained stable during the disruption.
73bff2fa-a393-41f8-b2b9-0ce80e1d6e10	behavioral	adaptability	mid	medium	Tell me about pivoting strategy mid-project.	2026-02-13 09:38:22.506024+00	Score 6: Decisiveness. Candidate explains the "data signal" that forced the pivot and the logical process of discarding the old plan for a better one.
d461398d-e268-43ee-a7c6-940a200d1e8d	behavioral	adaptability	mid	medium	Describe responding to competitive pressure.	2026-02-13 09:38:22.506024+00	Score 6: Tactical agility. Candidate avoids panic and describes analyzing the competitor's move before adjusting their own selling points or strategy.
47740768-f456-422b-ac34-63a61eb61ad2	behavioral	adaptability	mid	medium	How do you adjust when targets change?	2026-02-13 09:38:22.506024+00	Score 6: Goal resilience. Candidate shows they immediately recalculated their effort-to-output ratio to meet the new, harder target.
072dcd06-e300-4519-9ec7-9776357fa631	behavioral	adaptability	mid	medium	Tell me about adapting after losing a key client.	2026-02-13 09:38:22.506024+00	Score 6: Resilience and redirection. Candidate describes a brief post-loss analysis followed by an immediate pivot to high-value prospects in the pipeline.
f1d438a1-5994-491f-a1f2-b952a9f9897d	behavioral	adaptability	mid	medium	Describe working in ambiguous project scopes.	2026-02-13 09:38:22.506024+00	Score 6: Uncertainty tolerance. Candidate shows they created a "V1 prototype" or a "working draft" to force clarification rather than waiting for perfect info.
b9c6c134-e5af-469f-8c36-5769efb56f7b	behavioral	adaptability	mid	medium	Tell me about adapting to organizational restructuring.	2026-02-13 09:38:22.506024+00	Score 6: Corporate agility. Candidate focuses on where they could add most value in the "new world" rather than mourning the old structure.
92da3e31-f734-474f-9fba-48a883e01ecb	behavioral	adaptability	mid	medium	How do you respond when leadership direction shifts?	2026-02-13 09:38:22.506024+00	Score 6: Professional alignment. Candidate seeks to understand the "Higher Why" and translates it into actionable tasks for their own role.
fb9062fe-80dd-42fa-bf54-ddf34117d888	behavioral	adaptability	mid	medium	Describe switching between different client personas.	2026-02-13 09:38:22.506024+00	Score 6: Empathy agility. Candidate demonstrates and explains their "mental prep" for shifting from a CEO-level conversation to a Technical-level conversation.
93dbcb81-3c92-4125-92e1-40af36ca0ca2	behavioral	adaptability	mid	medium	Tell me about adapting to new sales methodologies.	2026-02-13 09:38:22.506024+00	Score 6: Unlearning capability. Candidate describes letting go of an old, comfortable habit to master a more effective modern technique (e.g. Challenger vs Solution).
8c94a7d4-6dfe-42fb-9d8c-cc8e1705d80c	behavioral	adaptability	mid	medium	How do you manage rapid market changes?	2026-02-13 09:38:22.506024+00	Score 6: Environment sensing. Candidate mentions sources (news, network) they monitor to stay ahead of the curve and adjust their talk-track accordingly.
3097e7c3-aa71-4474-b258-3179348a902c	behavioral	adaptability	mid	high	Tell me about leading adaptation during major change.	2026-02-13 09:38:22.506024+00	Score 6: Change leadership. Focus on how they modeled the new behavior for others and provided emotional support while maintaining performance standards.
7476c8d3-7f8e-4f17-a261-3a8f8ea638eb	behavioral	adaptability	mid	high	Describe managing uncertainty during economic downturn.	2026-02-13 09:38:22.506024+00	Score 6: Crisis agility. Candidate shows how they "tightened the ship"ÔÇöfocusing only on high-certainty activities and managing resources with extreme care.
dc7e0b2e-2511-4725-b498-b2bb1a6a0552	behavioral	adaptability	mid	high	How do you handle conflicting priorities from different leaders?	2026-02-13 09:38:22.506024+00	Score 6: Decision-making. Candidate describes a "Priority Matrix" conversation where they brought all leaders together to resolve the conflict logically.
102e7104-df70-44e4-99e7-856065c9106d	behavioral	adaptability	mid	high	Tell me about pivoting a failing strategy.	2026-02-13 09:38:22.506024+00	Score 6: Analytical courage. Candidate identifies the "Sunk Cost" fallacy and describes the evidence they used to kill a project and start a better one.
1e8bdb56-b94c-4119-b2b1-ac19d4f17c25	behavioral	adaptability	mid	high	Describe adapting to cultural differences in business.	2026-02-13 09:38:22.506024+00	Score 6: Cultural intelligence (CQ). Candidate mentions researching norms and adjusting their negotiation style to ensure a respectful and successful outcome.
38372b40-12da-40ad-a12a-4822f56e7e1c	behavioral	adaptability	mid	high	How do you make decisions when data is incomplete?	2026-02-13 09:38:22.506024+00	Score 6: Heuristic judgment. Candidate explains their "Probability-based" decision framework and how they built in "reversibility" in case the decision was wrong.
542d87a4-6111-457c-97d4-21ecb87652a0	behavioral	adaptability	mid	high	Tell me about handling digital transformation changes.	2026-02-13 09:38:22.506024+00	Score 6: Future orientation. Candidate shows they didn't just adopt the new tech, but became an internal "power user" or trainer to help the transformation succeed.
9280741b-0a1a-4fb4-86db-efc229c29538	behavioral	adaptability	mid	high	Describe adapting to performance under resource constraints.	2026-02-13 09:38:22.506024+00	Score 6: Frugal innovation. Focus on the creative "workaround" or process hack used to achieve the target without the usual budget or headcount.
bcf3641c-8ff2-4429-8bc8-35671e9754f2	behavioral	adaptability	mid	high	How do you manage innovation while maintaining stability?	2026-02-13 09:38:22.506024+00	Score 6: Balanced agility. Candidate describes an "Experimentation budget" (of time/resources) used to test new ideas while keeping the core business safe.
ad21ff37-bb5c-4255-9009-3abdbce38203	behavioral	adaptability	mid	high	Tell me about balancing short-term needs with long-term strategy.	2026-02-13 09:38:22.506024+00	Score 6: Strategic harmony. Candidate shows they can make a "short-term sacrifice" for a "long-term gain," justifying it through future-value or outcome modeling.
21368e26-d2e5-435d-83ef-0b34ad408208	behavioral	resilience	senior	low	Tell me about a time you missed a significant target. What did you do next?	2026-02-13 09:44:11.140319+00	Score 6: Candidate demonstrates radical accountability. They detail an objective root-cause analysis and how they communicated the shortfall early to buy-in for a recovery plan.
db312b54-7aab-4ee3-b50b-6776f8a6fb5d	behavioral	senior	senior	low	Describe a situation where a project didnÔÇÖt deliver expected results.	2026-02-13 09:44:11.140319+00	Score 6: Focus on data-driven recovery. Candidate explains the gap between expectations and reality and the specific strategic adjustment made to salvaged value.
5b455cb5-b7cc-4e38-a91d-e63b75934ab3	behavioral	resilience	senior	low	How do you manage stress during high-performance periods?	2026-02-13 09:44:11.140319+00	Score 6: Executive presence. Candidate describes a system for delegation, technical compartmentalization, and maintaining a clear vision for the team despite pressure.
af06ae0c-a34e-4f3b-bc30-b9508f2a9b22	behavioral	resilience	senior	low	Tell me about a challenging quarter and how you handled it.	2026-02-13 09:44:11.140319+00	Score 6: Strategic endurance. Candidate shows how they maintained pipeline health and team morale over a 90-day period of volatility.
8cc03e93-5fc2-4ab1-8d9d-dc394380230a	behavioral	resilience	senior	low	Describe a time when you had to manage repeated objections from clients.	2026-02-13 09:44:11.140319+00	Score 6: Persistence through insight. Candidate shows they didn't just "push harder" but changed their discovery process to address the root systemic objection.
f6b09c8e-5047-49bf-87e0-39ded83a7a72	behavioral	resilience	senior	low	How do you stay motivated during long sales cycles?	2026-02-13 09:44:11.140319+00	Score 6: Momentum management. Candidate defines how they create "micro-wins" and maintain stakeholder engagement over 6ÔÇô12 month periods.
52b03301-8619-4b9e-84a2-98c143d0ac79	behavioral	resilience	senior	low	Tell me about a time when you had to recover from a mistake.	2026-02-13 09:44:11.140319+00	Score 6: Professional integrity. Focus on immediate disclosure to leadership, a cost-saving fix, and a process change to automate the error out of the system.
384fc476-22b3-4000-8de7-bb245a4b86fb	behavioral	resilience	senior	low	Describe a time when workload pressure tested you.	2026-02-13 09:44:11.140319+00	Score 6: Operational priority. Candidate describes using advanced prioritization (Paretto principle, etc.) to ensure high-impact results despite constraint.
f1a613a2-8c1e-4d39-92b0-f0469f2ba498	behavioral	resilience	senior	low	How do you respond when performance feedback is critical?	2026-02-13 09:44:11.140319+00	Score 6: Growth mindset. Candidate describes suppressing defensiveness, extracting the "truth" from the feedback, and a measurable shift in leadership behavior.
751d3a2d-fb31-4cc4-aaab-5879786bdd46	behavioral	resilience	senior	low	Tell me about a time when persistence helped close a difficult opportunity.	2026-02-13 09:44:11.140319+00	Score 6: Creative persistence. Candidate identifies a "deadlock" and the specific, non-obvious angle they used to re-open and close the discussion.
b4a552f7-6456-4d3b-a6d6-bcbe5b38460d	behavioral	resilience	senior	medium	Tell me about a high-value deal that collapsed late in the cycle.	2026-02-13 09:44:11.140319+00	Score 6: Emotional maturity. Candidate describes the logical post-mortem, maintaining the relationship for the next cycle, and how they prevented it from affecting other active deals.
50911e67-6b03-47ad-8931-20bc3bd217c9	behavioral	resilience	senior	medium	Describe a time when external market conditions impacted your results.	2026-02-13 09:44:11.140319+00	Score 6: Agility and ownership. Candidate shows they recognized the shift early and pivoted their positioning to find new relevance in the changed market.
a3961b52-9814-4ecc-8ea9-bd2fb9ef1a8b	behavioral	resilience	senior	medium	How do you rebuild momentum after losing a strategic account?	2026-02-13 09:44:11.140319+00	Score 6: Resourcefulness. Candidate describes a structured plan to replace the revenue/impact via diversification or aggressive territory expansion.
7e6cbc08-b256-4a3a-a3ac-5654455809e0	behavioral	resilience	senior	medium	Tell me about a time when leadership pressure affected your confidence.	2026-02-13 09:44:11.140319+00	Score 6: Self-regulation. Candidate describes how they managed the internal state and relied on their track record/data to communicate a logical timeline back to leadership.
31e12f24-90a9-4b65-bee2-f18caeb44b1c	behavioral	resilience	senior	medium	Describe a situation where you had to keep your team motivated during setbacks.	2026-02-13 09:44:11.140319+00	Score 6: Visionary resilience. Candidate demonstrates how they provided transparent context while giving the team a concrete "re-entry plan" to follow.
64a112dc-4d61-4ad2-91ff-8bf4e2e95c12	behavioral	resilience	senior	medium	How do you handle long periods without visible results?	2026-02-13 09:44:11.140319+00	Score 6: Leading indicators. Candidate focus on the "inputs" they controlled and how they verified their strategy was correct despite the delay in outcome.
4128afd3-637f-41e0-96a8-e88b0ff0d2c1	behavioral	resilience	senior	medium	Tell me about a time when you faced resistance from multiple stakeholders.	2026-02-13 09:44:11.140319+00	Score 6: Political resilience. Focus on identifying individual win-conditions and slowly moving a complex web of decision-makers toward one goal.
0613c360-3ea2-4723-815f-b037c5c83a91	behavioral	resilience	senior	medium	Describe a professional setback that changed your working approach.	2026-02-13 09:44:11.140319+00	Score 6: Structural evolution. A deep reflection on a failure that forced them to adopt a more scalable or risk-aware methodology.
8267b9a8-10ef-4516-bb81-bbc5f4098e84	behavioral	resilience	senior	medium	When do you decide to disengage from an opportunity rather than persist?	2026-02-13 09:44:11.140319+00	Score 6: Strategic abandonment. Focus on the "Opportunity Cost" calculation and the courage to stop wasting company resources on a low-win-rate path.
869a3c33-ff90-4571-b9cc-591cbfc71f7c	behavioral	resilience	senior	medium	Tell me about a time when emotional control was critical to maintaining performance.	2026-02-13 09:44:11.140319+00	Score 6: Composure. Describes a moment where reacting emotionally would have cost a deal or a team member, and how they stayed logical instead.
2b93c008-e643-4363-8d92-815840f9d82f	behavioral	resilience	senior	high	Tell me about a prolonged downturn in performance and how you turned it around.	2026-02-13 09:44:11.140319+00	Score 6: Turnaround leadership. Candidate identifies a systemic issue (market fit, process, skill gap) and describes the 6-month journey of fixing it.
f720ca4e-1887-451c-bffe-e82c83dcdeed	behavioral	resilience	senior	high	Describe a time when your strategic judgment was questioned.	2026-02-13 09:44:11.140319+00	Score 6: Conviction with evidence. Candidate shows they stood by a data-backed plan despite doubt, or had the humility to adjust when the data proved the doubters right.
668f6f0e-7413-4bca-89de-82149780c0ee	behavioral	resilience	senior	high	How do you handle repeated failure in a new market or territory?	2026-02-13 09:44:11.140319+00	Score 6: Iterative learning. Candidate describes "failing fast"ÔÇöusing each loss to build a more localized, accurate blueprint for success.
670824bc-41d6-43d2-83c3-db2f34cc58bf	behavioral	resilience	senior	high	Tell me about a time when your credibility was at risk.	2026-02-13 09:44:11.140319+00	Score 6: Radical candor. Focus on radical honesty, fixing the fallout personally, and using the crisis as a way to demonstrate higher reliability.
41535d64-deb8-4a10-abf3-3219916fb11c	behavioral	resilience	senior	high	Describe a period of burnout and how you managed it.	2026-02-13 09:44:11.140319+00	Score 6: Sustainable performance. Candidate identifies the structural causes of the burnout (not just "working hard") and the system changes they made to their leadership style to prevent it.
6ff07ab3-a020-4013-ac60-eb3f3578cede	behavioral	resilience	senior	high	How do you sustain resilience across multi-year sales cycles?	2026-02-13 09:44:11.140319+00	Score 6: Strategic stamina. Candidate describes managing multiple interpersonal relationships and technical hurdles over years without losing focus or quality.
3b6fd4fb-9d81-40a8-be3b-db9cbf509e2e	behavioral	communication	senior	high	How do you communicate unpopular decisions?	2026-02-13 09:44:11.140319+00	Score 6: Logical courage. Candidate shows they prioritized the "Outcome for the many" over "Likability by the few," providing the full rationale behind the decision.
a6624b10-b92e-4088-9402-a2b4e3305fdd	behavioral	resilience	senior	high	Tell me about a time when you had to lead through organizational instability.	2026-02-13 09:44:11.140319+00	Score 6: Stability anchor. Candidate demonstrates how they acted as a "buffer" for their team, maintaining focus on the mission while navigating the chaos of a re-org or acquisition.
c1fe1182-8202-4649-a9fc-83fee69ce058	behavioral	resilience	senior	high	Describe a failure that reshaped your leadership style.	2026-02-13 09:44:11.140319+00	Score 6: Ego dissolution. Candidate shows a fundamental shift from "Individual Hero" to "Team Enabler" as a result of a major project loss.
a106184a-a68c-4dc5-aeab-e85ee393544c	behavioral	resilience	senior	high	How do you differentiate between temporary setbacks and systemic problems?	2026-02-13 09:44:11.140319+00	Score 6: Analytical framework. Candidate describes the specific thresholds or metrics they use to decide if a strategy needs "more time" or a "total overhaul."
583b4579-1ff3-4f5c-8a76-9879e6786650	behavioral	resilience	senior	high	Tell me about a time when resilience meant stepping back instead of pushing forward.	2026-02-13 09:44:11.140319+00	Score 6: Advanced wisdom. Focus on the maturity to recognize when a team or strategy is at a breaking point and the decision to "regroup" to win later.
0dab873a-5d46-433f-b1ba-1dedbf17be5b	behavioral	communication	senior	low	Tell me about presenting to mid-level management.	2026-02-13 09:44:11.140319+00	Score 6: Audience alignment. Candidate shows they translated technical or day-to-day data into "Strategic KPIs" that mid-level managers care about.
0dbb790a-cf6f-42c1-8e20-95b6e28650aa	behavioral	communication	senior	low	Describe resolving a communication breakdown.	2026-02-13 09:44:11.140319+00	Score 6: Restoration. Candidate identifies the "noise" in the system (wrong channel, lack of context) and describes the specific meeting/tool used to clear it up.
c0277168-11aa-4983-bc1e-8e7d7e078ed8	behavioral	communication	senior	low	How do you manage objections professionally?	2026-02-13 09:44:11.140319+00	Score 6: Consultative composure. Candidate describes "isolating the objection" and using evidence to address it without becoming defensive.
c617fc75-c17b-4f32-a60a-5804b9cde1c1	behavioral	communication	senior	low	Tell me about explaining strategy to your team.	2026-02-13 09:44:11.140319+00	Score 6: Translation. Focus on breaking a large corporate goal into "Actionable Steps" for the team, ensuring every member knows their "Why."
d04e90c6-1396-4cb2-80f5-b9d94c313bef	behavioral	communication	senior	low	Describe maintaining clarity in complex discussions.	2026-02-13 09:44:11.140319+00	Score 6: Facilitation. Candidate describes using summaries, visual aids, or frequent "alignment checks" to ensure everyone is on the same page.
fee4029d-ea8a-4e23-9786-e164b2ad224f	behavioral	communication	senior	low	Tell me about communicating performance feedback.	2026-02-13 09:44:11.140319+00	Score 6: Constructive impact. Candidate shows they used a "Feedback Loop" approachÔÇöidentifying the gap but focusing 80% of the conversation on the solution.
adddf0b7-43d1-4378-aa8a-5c0e0171495a	behavioral	communication	senior	low	How do you ensure alignment across departments?	2026-02-13 09:44:11.140319+00	Score 6: Boundary spanning. Mentions specific mechanisms (cross-functional syncs, shared docs) used to ensure no one is working in a silo.
01ce65c0-0982-41fc-a414-8727690c910b	behavioral	communication	senior	low	Describe handling a dissatisfied client.	2026-02-13 09:44:11.140319+00	Score 6: De-escalation. Candidate demonstrates active listening to the frustration before moving into a "Solution Partner" mode.
b12a267b-4ac3-489c-9ee9-cee10d9a9740	behavioral	communication	senior	low	Tell me about maintaining credibility in discussions.	2026-02-13 09:44:11.140319+00	Score 6: Evidence-based authority. Candidate shows how they use data, external benchmarks, or direct experience to ground their arguments in reality.
c0b6f62e-a029-429b-be43-539ec535c1d1	behavioral	communication	senior	low	How do you adjust tone in sensitive conversations?	2026-02-13 09:44:11.140319+00	Score 6: Empathy logic. Candidate describes reading the emotional context and intentionally choosing a slower pace or more collaborative language.
db358ffd-c2c2-463e-bdff-4a0288224db1	behavioral	communication	senior	medium	Tell me about influencing senior stakeholders.	2026-02-13 09:44:11.140319+00	Score 6: Executive alignment. Candidate speaks about "Business Case" language (ROI, Risk, Opportunity Cost) used to convince C-level or VPs.
a1a7f2b8-6438-47b2-9dd2-cfaa31da7add	behavioral	communication	senior	medium	Describe a high-stakes negotiation.	2026-02-13 09:44:11.140319+00	Score 6: Strategic trade-offs. Candidate details the planning phase, their walk-away points, and the "Value Expansion" they used to close the deal.
405f36c9-9ec2-49ca-bd69-22374efe7802	behavioral	communication	senior	medium	How do you communicate long-term strategy?	2026-02-13 09:44:11.140319+00	Score 6: Narrative skill. Candidate shows they can paint a compelling future while grounding it in immediate, achievable milestones.
dc3ad909-6b97-452b-8086-b9130176a7cd	behavioral	communication	senior	medium	Tell me about managing communication during change.	2026-02-13 09:44:11.140319+00	Score 6: Constant cadence. Focus on the frequency and transparency of messaging to reduce the "rumor mill" and maintain team buy-in during a shift.
aee4c9a2-8f18-4df2-aa83-bd0f98df7d8d	behavioral	communication	senior	medium	Describe preventing escalation through communication.	2026-02-13 09:44:11.140319+00	Score 6: Proactive diplomacy. Candidate identifies a potential fallout and has the "hard conversation" early to resolve it before it reaches leadership.
fac5181a-d74f-495c-9dd0-5863452a0cd0	behavioral	communication	senior	medium	Tell me about aligning multiple decision-makers.	2026-02-13 09:44:11.140319+00	Score 6: Consensus orchestration. Candidate describes identifying the "silent objector" and addressing their concerns privately to ensure a smooth public rollout.
435260df-4e09-45e6-add5-f6b1abf641f1	behavioral	communication	senior	medium	How do you balance transparency and diplomacy?	2026-02-13 09:44:11.140319+00	Score 6: Professional nuance. Candidate shows they can deliver the "Whole Truth" in a way that is constructive rather than destructive to the business.
97bbb1d5-209d-4591-aec2-73d714898040	behavioral	communication	senior	medium	Describe persuading resistant stakeholders.	2026-02-13 09:44:11.140319+00	Score 6: Objection mapping. Candidate illustrates how they used the stakeholder's own goals to show how the new strategy would help *them* succeed.
199d1f50-a325-496d-8aab-6c46ec76d63f	behavioral	communication	senior	medium	Tell me about rebuilding damaged relationships.	2026-02-13 09:44:11.140319+00	Score 6: Trust recovery. Focus on the long-term consistency of actions matching words, and a specific "apology-plus-solution" moment.
09e95ae5-6ca5-4e51-b7b1-860fa8e8efd4	behavioral	communication	senior	medium	How do you communicate during uncertain situations?	2026-02-13 09:44:11.140319+00	Score 6: Stability in communication. Candidate shows they communicated "What we know" and "When we will know more," providing a sense of control despite the fog.
12ddfe4a-71c9-4c17-8935-35f7e4a1f844	behavioral	communication	senior	high	Tell me about influencing without formal authority.	2026-02-13 09:44:11.140319+00	Score 6: Social capital. Candidate explains how they used rapport, expertise, and reciprocity to move a project forward using others over whom they had no rank.
90de695a-7a4e-4c94-9b48-c0e9be31bfe8	behavioral	communication	senior	high	Describe handling board-level discussions.	2026-02-13 09:44:11.140319+00	Score 6: High-altitude impact. Focus on brevity, presenting "Strategic Options" rather than "Updates," and the ability to defend a position under pressure.
ad672f69-25e2-4cca-875f-a0b5276b6b3e	behavioral	communication	senior	high	Tell me about managing communication in crisis.	2026-02-13 09:44:11.140319+00	Score 6: Crisis coordination. Candidate describes acting as a single, calm source of truth, managing stakeholder anxiety while directing technical recovery.
8b0bf49b-23c3-452e-b996-85fa3161667e	behavioral	communication	senior	high	Describe defending a strategy under scrutiny.	2026-02-13 09:44:11.140319+00	Score 6: Fact-based resilience. Candidate shows they welcomed the scrutiny and used it to prove the strategy's depth, rather than becoming defensive.
48720be8-9d72-4733-8ff0-7cc578fb273d	behavioral	communication	senior	high	How do you handle media or public-facing communication?	2026-02-13 09:44:11.140319+00	Score 6: Narrative control. Candidate shows they can stay "On-Message" while addressing difficult questions, protecting the company's reputation.
742d4a92-a8b8-437f-82c9-604a5a5f8977	behavioral	communication	senior	high	Tell me about influencing across cultures.	2026-02-13 09:44:11.140319+00	Score 6: Cultural intelligence. Candidate describes researching and adjusting their tone, pacing, and relationship-building style for global effectiveness.
16835323-dab9-493c-b8d5-13d782f6b244	behavioral	communication	senior	high	Describe resolving political tension through communication.	2026-02-13 09:44:11.140319+00	Score 6: Neutral mediation. Candidate shows they acted as a "Bridge," identifying the ego-drivers and moving everyone back to the project goal.
0c3f69dc-4088-41dd-a341-1557e57b67b3	behavioral	communication	senior	high	How do you mentor others in advanced communication?	2026-02-13 09:44:11.140319+00	Score 6: Multiplier effect. Candidate demonstrates they can teach others how to read a room, handle objections, or structure a high-stakes pitch.
24ccdcd5-4e02-4370-ad26-ce47d52a0bc0	behavioral	communication	senior	high	Tell me about shaping organizational narrative.	2026-02-13 09:44:11.140319+00	Score 6: Visionary impact. Focus on how they helped define "Who we are" and "How we work," influencing the collective identity of the business.
d3ace522-9d7b-47c9-b8dd-d2c58158e8b1	behavioral	adaptability	senior	low	Tell me about adjusting to new senior leadership.	2026-02-13 09:44:11.140319+00	Score 6: Strategic alignment. Candidate shows they proactively studied the new leader's priorities and adjusted their own department's roadmap to match.
dabfeef4-9643-40b8-aae2-269ab96863eb	behavioral	adaptability	senior	low	Describe adapting to client expectation changes.	2026-02-13 09:44:11.140319+00	Score 6: Client agility. Candidate describes re-negotiating the scope and resources to meet the new expectation while protecting their team's output.
b32f0c34-4c1c-4427-9254-1fe407c8f151	behavioral	adaptability	senior	low	How do you handle mid-cycle target revisions?	2026-02-13 09:44:11.140319+00	Score 6: Tactical pivot. Candidate shows they immediately recalculated their lead-gen or activity metrics to hit the harder target without panic.
064b422b-17b8-47e4-a1b8-385bafb14d9f	behavioral	adaptability	senior	low	Tell me about managing evolving team dynamics.	2026-02-13 09:44:11.140319+00	Score 6: Social adaptivity. Candidate describes how they changed their leadership style (e.g., from hands-on to coaching) as the team matured.
473eb689-1754-4cad-b07f-1159e6e58159	behavioral	adaptability	senior	low	Describe adapting to regulatory changes.	2026-02-13 09:44:11.140319+00	Score 6: Compliance agility. Candidate shows they viewed the new regulation as a "New Constraint" and worked within it to find a competitive advantage.
585aaeee-9a2e-4b55-b982-3c5d17ff112f	behavioral	adaptability	senior	low	Tell me about shifting account strategies.	2026-02-13 09:44:11.140319+00	Score 6: Hypothesis testing. Candidate describes the "Pivot Point" where a strategy wasn't working and the logical step into a new market or messaging.
30fc9d9e-9ce0-41b9-99fc-4559b8cbbaaf	behavioral	adaptability	senior	low	How do you respond to internal process changes?	2026-02-13 09:44:11.140319+00	Score 6: Process pragmatism. Candidate demonstrates they adopted the new system quickly and became an early advocate to help others move faster.
0afa9cc3-42b4-4df4-a832-73f90538ae64	behavioral	adaptability	senior	low	Describe adapting during high-growth phases.	2026-02-13 09:44:11.140319+00	Score 6: Scalability mindset. Candidate shows they recognized when old, manual processes were breaking and pivoted to automated or delegatory systems.
31ad7048-8fa5-4231-b000-635c60ec8f8d	behavioral	adaptability	senior	low	Tell me about entering a new territory or market.	2026-02-13 09:44:11.140319+00	Score 6: Learning agility. Focus on the rapid research phase and how they unlearned their previous assumptions to fit the new territory's reality.
2b1af62d-4812-4832-9e3a-febdcd9f0380	behavioral	adaptability	senior	low	How do you handle working across different industries?	2026-02-13 09:44:11.140319+00	Score 6: Domain agility. Candidate shows they can extract "Universal Principles" from one industry and apply them creatively to another.
72c55149-6259-48ab-b75e-1fbbf2b3781d	behavioral	adaptability	senior	medium	Tell me about pivoting during market disruption.	2026-02-13 09:44:11.140319+00	Score 6: Disruption response. Candidate describes a "Defense-to-Offense" shiftÔÇöfinding an opportunity in a crisis that competitors missed.
367b0965-3021-4e93-b478-bf2f00a6ecfa	behavioral	adaptability	senior	medium	Describe adapting to long enterprise sales cycles.	2026-02-13 09:44:11.140319+00	Score 6: Stakeholder adaptivity. Candidate demonstrates they changed their communication and multi-threaded their approach as the deal complexity increased.
7dbf1c71-a474-4af0-9aa8-9c162ba55b71	behavioral	adaptability	senior	medium	How do you respond to aggressive competitors?	2026-02-13 09:44:11.140319+00	Score 6: Competitive pivot. Candidate shows they didn't just "Discount," but adapted their value prop to highlight the competitor's newly discovered weakness.
8aa8f91b-6f17-4095-917e-4f8d1a9c075a	behavioral	adaptability	senior	medium	Tell me about restructuring a failing account plan.	2026-02-13 09:44:11.140319+00	Score 6: Root-cause pivot. Candidate identifies why the previous plan failed (wrong person, wrong message) and details the total redesign of the account.
5f3f941e-9ed1-4b16-b621-e59d1affe4c5	behavioral	adaptability	senior	medium	Describe managing change fatigue within your team.	2026-02-13 09:44:11.140319+00	Score 6: Empathetic adaptivity. Candidate describes slowing down non-essential changes and focusing the team on "Meaningful Progress" to restore morale.
f1a0e661-9574-4f7d-a2dc-fe40c082ce11	behavioral	adaptability	senior	medium	Tell me about adapting to new pricing models.	2026-02-13 09:44:11.140319+00	Score 6: Value-sell adaptivity. Candidate shows they discarded old "Feature-based" selling to adopt a "Value-based" conversation required by the new model.
e8716d6d-8f6b-4454-8826-9f25fdac47e7	behavioral	adaptability	senior	medium	How do you handle technological disruption?	2026-02-13 09:44:11.140319+00	Score 6: Digital agility. Candidate shows they embraced a disruptive tool (like AI or a new CRM) to leapfrog a previous manual bottle-neck.
f78c137a-2aea-4bd2-a99c-612d3f969980	behavioral	adaptability	senior	medium	Describe adjusting strategy after data insights.	2026-02-13 09:44:11.140319+00	Score 6: Data-led humility. Candidate shows they were willing to kill a "Pet Project" when the data surfaced a more effective alternative.
2077f9ea-1324-4485-bd72-75701bb5ba3d	behavioral	adaptability	senior	medium	Tell me about adapting to shifting buyer behavior.	2026-02-13 09:44:11.140319+00	Score 6: Buyer-journey agility. Candidate describes moving from "Cold Outreach" to "Content/Social Selling" as they noticed the market becoming more research-heavy.
9ed0fc44-e3a7-49b0-a358-c6411d3efea1	behavioral	adaptability	senior	medium	How do you maintain agility while scaling operations?	2026-02-13 09:44:11.140319+00	Score 6: Balanced growth. Candidate shows they built "Agile Guardrails"ÔÇöprocesses that allow for freedom and speed without losing total control across a larger team.
5049910c-057b-40cd-91bf-1dd25ed5eb57	behavioral	adaptability	senior	high	Tell me about leading change across multiple teams.	2026-02-13 09:44:11.140319+00	Score 6: Cross-departmental orchestration. Focus on how they unified different cultures and incentives around a single, massive shift in direction.
fc15a353-ea23-42ee-80a4-f828b72fb866	behavioral	adaptability	senior	high	Describe adapting during merger or acquisition.	2026-02-13 09:44:11.140319+00	Score 6: Integration agility. Candidate shows they looked for the "Best of Both" cultures and adapted their own team's workflow to accelerate the merger.
fb8ce46a-5834-4a68-8316-d15ed60b1b75	behavioral	adaptability	senior	high	How do you respond to systemic business failure?	2026-02-13 09:44:11.140319+00	Score 6: Survival-to-Success shift. Candidate describes a "Triage" moment where they cut failing branches to save the trunk and grow in a new, healthier direction.
039f758a-5c56-4c9a-b20c-8a53d90f5ef8	behavioral	adaptability	senior	high	Tell me about redesigning strategy due to industry shifts.	2026-02-13 09:44:11.140319+00	Score 6: Visionary pivot. Candidate describes a fundamental change in "Business Model" (e.g., product-to-service) to remain relevant for the next decade.
e60c3fd9-9508-49ec-8e94-c7d8d9f3b60c	behavioral	adaptability	senior	high	Describe managing global market changes.	2026-02-13 09:44:11.140319+00	Score 6: Geo-political adaptivity. Candidate shows they anticipated a macro shift (trade war, currency shift) and hedged their territory strategy accordingly.
7a7a3a6b-a604-42a0-aba4-7c2c9e73539b	behavioral	adaptability	senior	high	How do you adapt leadership style over time?	2026-02-13 09:44:11.140319+00	Score 6: Personal evolution. Candidate describes moving from "Command-and-Control" to "Servant-Leadership" as they learned to scale through others.
f7e0db42-464a-4842-8d39-ed8e02f84a41	behavioral	adaptability	senior	high	Tell me about making unpopular but necessary adjustments.	2026-02-13 09:44:11.140319+00	Score 6: Conviction-based agility. Candidate shows they prioritized the long-term survival of the business over immediate personal comfort or team popularity.
66c805f9-83bf-4ea1-aef0-c9c4f38e2a93	behavioral	adaptability	senior	high	Describe adapting to geopolitical or macroeconomic risks.	2026-02-13 09:44:11.140319+00	Score 6: Macro-flexibility. Candidate demonstrates they had "Plan B and C" ready for when the external world changed beyond their control.
99964d54-6367-4f8d-ac2b-83f2a978664b	behavioral	adaptability	senior	high	How do you handle cultural transformation initiatives?	2026-02-13 09:44:11.140319+00	Score 6: Identity adaptivity. Focus on how they helped a "Legacy" team adopt a "Modern/Agile" mindset through consistent modeling and small, rapid wins.
f67bb174-13a9-4d9f-a973-304d795ce8e3	behavioral	adaptability	senior	high	Tell me about future-proofing your business strategy.	2026-02-13 09:44:11.140319+00	Score 6: Anticipatory agility. Candidate describes investing time/resources in "Horizon 2 and 3" activities while the current "Horizon 1" was still successful.
ee66c983-c0d8-4728-a14b-6e17fcbd185c	behavioral	resilience	leadership	low	Tell me about a time when you faced significant business pressure.	2026-02-13 09:47:32.107158+00	Score 6: Candidate demonstrates executive presence. They describe a moment of high stakes where they maintained a focus on core objectives while managing a multitude of internal and external stressors.
ccf15bfd-aa89-4230-a6e4-eb9be99ea545	behavioral	resilience	leadership	low	Describe how you handle high-stakes negotiations that donÔÇÖt go as planned.	2026-02-13 09:47:32.107158+00	Score 6: Strategic flexibility. Candidate explains how they managed the fallout without losing long-term leverage, showing the ability to pivot to a "Plan B" without emotional volatility.
587383d9-e274-404a-8304-f556b887f775	behavioral	resilience	leadership	low	How do you maintain composure during board-level discussions?	2026-02-13 09:47:32.107158+00	Score 6: Professional poise. Focus on active listening, delivering data-backed rebuttals calmly, and the ability to handle aggressive cross-examination from board members.
19cbb590-be07-4122-869f-be821f987655	behavioral	resilience	leadership	low	Tell me about a time when quarterly results were below expectations.	2026-02-13 09:47:32.107158+00	Score 6: Radical accountability. Candidate shows they took full ownership, provided a clear explanation for the variance, and led the immediate corrective action plan.
2d31c4b8-b527-4d4f-a6ab-88fb5216c964	behavioral	resilience	leadership	low	Describe how you manage stress during major transitions.	2026-02-13 09:47:32.107158+00	Score 6: Operational stability. Candidate describes a system for self-regulation and ensuring that their personal stress did not leak into the teamÔÇÖs performance or morale.
5f06b8b3-8041-4ac1-95d1-323aba4dfcb7	behavioral	resilience	leadership	low	How do you recover after losing a large enterprise client?	2026-02-13 09:47:32.107158+00	Score 6: Resilience as a business process. Candidate describes the post-mortem, the steps to secure the remaining portfolio, and the immediate pivot to the high-value pipeline.
152ff39a-137f-4753-9615-c82745158d54	behavioral	resilience	leadership	low	Tell me about a time when a strategic initiative failed.	2026-02-13 09:47:32.107158+00	Score 6: Learning agility. Focus on the ability to extract systemic insights from the failure and how they applied those insights to prevent similar losses in the future.
2c7a4ad9-0167-4deb-b7c6-504f9df4b62e	behavioral	resilience	leadership	low	Describe how you manage resilience during industry uncertainty.	2026-02-13 09:47:32.107158+00	Score 6: Visionary endurance. Candidate shows they maintained a "horizon focus," looking past the current volatility to keep the organization aligned with long-term goals.
7ab08a2c-bf5d-44d5-824e-3e63bbd8f7fc	behavioral	resilience	leadership	low	How do you stay motivated after years in high-pressure roles?	2026-02-13 09:47:32.107158+00	Score 6: Sustainable leadership. Candidate describes their personal system for avoiding cynicism and maintaining a high-performance output through purpose and self-awareness.
4f12a0c5-ea96-4605-940b-a94a690b36a3	behavioral	resilience	leadership	low	Tell me about a time when you had to manage disappointment at a senior level.	2026-02-13 09:47:32.107158+00	Score 6: Executive maturity. Candidate shows they acknowledged the disappointment but moved rapidly to "Scenario Planning" to find the next path forward.
59379a7d-bc7d-404b-8e64-1a7a51f41e49	behavioral	resilience	leadership	medium	Tell me about a strategic decision that did not deliver expected outcomes.	2026-02-13 09:47:32.107158+00	Score 6: Logic-based pivot. Candidate describes the initial data, the reason for the shortfall, and the non-defensive way they adjusted the strategy mid-course.
a23e094d-c2bb-4df4-aac8-85b0bb0c3b11	behavioral	resilience	leadership	medium	Describe a time when shareholders or senior leaders challenged your results.	2026-02-13 09:47:32.107158+00	Score 6: Conviction with evidence. Candidate shows they defended their position with data while remaining open to valid criticism and adjusting where necessary.
7769ed8c-818d-484e-98f9-52a88703d585	behavioral	resilience	leadership	medium	How do you manage resilience when leading large teams through uncertainty?	2026-02-13 09:47:32.107158+00	Score 6: Organizational stewardship. Candidate demonstrates how they acted as a "Shield" for the team, maintaining focus on execution while navigating corporate fog.
36d6f211-2fa0-4941-a91b-1449aeda8440	behavioral	resilience	leadership	medium	Tell me about a time when you had to absorb pressure to protect your team.	2026-02-13 09:47:32.107158+00	Score 6: Servant leadership. Describes a situation where they took heat from executive levels to give their team the space and psychological safety required to fix an issue.
e0e493fa-7f4b-42cd-8e11-4497a01a4959	behavioral	resilience	leadership	medium	Describe how you handle public or visible professional setbacks.	2026-02-13 09:47:32.107158+00	Score 6: Narrative control. Candidate shows they addressed the setback transparently and provided a clear "Next Steps" roadmap that restored confidence.
c27f2601-c0e2-4cb9-b7bb-1b07298158f4	behavioral	resilience	leadership	medium	How do you rebuild organizational confidence after a failed initiative?	2026-02-13 09:47:32.107158+00	Score 6: Restorative leadership. Candidate describes specific communication strategies and early "mini-wins" used to shift the organizational energy back to positive momentum.
ba7a7937-626f-427a-9c63-ddaae1cad0a6	behavioral	resilience	leadership	medium	Tell me about a time when long-term strategy conflicted with short-term results.	2026-02-13 09:47:32.107158+00	Score 6: Strategic harmony. Candidate explains the trade-off calculation and how they justified a short-term hit to ensure the long-term health of the business.
2df48deb-5c23-412a-bc5e-4743d4e297ef	behavioral	resilience	leadership	medium	Describe how you manage emotional fatigue in senior leadership roles.	2026-02-13 09:47:32.107158+00	Score 6: Emotional intelligence (EQ). Candidate identifies the signs of executive burnout and the specific habits or delegate structures they use to maintain consistent clarity.
19c78843-960f-43bb-9ba2-4890e24f19e1	behavioral	resilience	leadership	medium	When do you pivot versus persist at an executive level?	2026-02-13 09:47:32.107158+00	Score 6: Decision framework. Candidate describes the specific KPIs or market signals they use to distinguish between "hard work required" and a "flawed strategy."
969d7857-94fb-4554-9011-9e0864bf9440	behavioral	resilience	leadership	medium	Tell me about a time when you had to defend your strategy despite criticism.	2026-02-13 09:47:32.107158+00	Score 6: Resilient authority. Candidate demonstrates they stood by a vision that they knew was correct, using future-value modeling to bring critics on board.
184f31d7-8194-46e4-b733-8d8ac4c7c97d	behavioral	resilience	leadership	high	Tell me about a defining professional setback in your career.	2026-02-13 09:47:32.107158+00	Score 6: Transformative resilience. A deep, reflective answer showing how a major loss led to a fundamental improvement in their leadership philosophy or business ethics.
08c74019-e20f-49b6-b4ee-8bf8f86de05c	behavioral	resilience	leadership	high	Describe a time when your leadership credibility was severely tested.	2026-02-13 09:47:32.107158+00	Score 6: Integrity under fire. Candidate shows they restored trust through extreme transparency and consistent delivery, rather than through PR or blameshifting.
d30ca742-14ea-4bc4-b97a-32ba748bffa6	behavioral	resilience	leadership	high	How do you navigate resilience during economic downturns?	2026-02-13 09:47:32.107158+00	Score 6: Frugal innovation. Candidate describes the "Tough Calls" (layoffs, budget cuts) made with empathy and the strategic redirection used to survive the cycle.
2407d388-1b2f-43e5-829e-94ff1f6a0a50	behavioral	resilience	leadership	high	Tell me about a situation where you had to make a difficult decision knowing it would impact morale.	2026-02-13 09:47:32.107158+00	Score 6: Principled pragmatism. Candidate shows they explained the "Hard Why" to the organization and provided a path for the team to reclaim their morale through success.
8cd44bc0-a3bc-4e75-ae78-3eca55d56e7d	behavioral	resilience	leadership	high	Describe a time when stepping back was more resilient than pushing forward.	2026-02-13 09:47:32.107158+00	Score 6: Strategic temperance. Focus on the wisdom to admit a plan was wrong or the market was ready to shift, and the decision to regroup for a more intelligent future effort.
36c34718-ccdc-4709-b972-6b47c4458de5	behavioral	resilience	leadership	high	How do you prevent cynicism after years of competitive pressure?	2026-02-13 09:47:32.107158+00	Score 6: Purpose-driven leadership. Candidate identifies their personal "Mission" and how it scales beyond simple financial metrics to keep them energized.
6420968b-3000-467e-890d-898c411735ae	behavioral	resilience	leadership	high	Tell me about a strategic risk that failed and what you learned.	2026-02-13 09:47:32.107158+00	Score 6: Risk management meta-learning. Candidate describes how they revised their Entire Risk Assessment Framework based on the post-mortem of a failed bold bet.
f8cc1344-15ef-4e71-9ad0-b5c975267905	behavioral	resilience	leadership	high	How do you sustain long-term personal and organizational resilience?	2026-02-13 09:47:32.107158+00	Score 6: Cultural resilience. Candidate shows how they have baked resilience into the company culture (e.g., blameless post-mortems, experimentation budgets).
37f8fd74-13e4-4d3b-8d9b-352bc241d4b2	behavioral	resilience	leadership	high	Describe how you mentor others in developing resilience.	2026-02-13 09:47:32.107158+00	Score 6: Resilience multiplier. Candidate demonstrates an ability to teach younger leaders how to separate their self-worth from business outcomes and focus on process.
4c6c2a82-12da-4bb1-a189-b0b23bda858f	behavioral	resilience	leadership	high	What has been the toughest leadership moment in your career, and how did you handle it?	2026-02-13 09:47:32.107158+00	Score 6: Ultimate maturity. A specific, high-stakes story that showcases the convergence of logic, empathy, and decisive action under extreme conditions.
4d30efda-b44d-46e5-a84b-aa40e6594c37	behavioral	communication	leadership	low	Tell me about communicating vision to your team.	2026-02-13 09:47:32.107158+00	Score 6: Narrative translation. Candidate shows they turned a high-level strategic goal into an inspiring, relatable mission that every team member personally bought into.
df1c5d58-0aa9-4c51-825d-e4cedc16beda	behavioral	communication	leadership	low	Describe presenting to senior executives.	2026-02-13 09:47:32.107158+00	Score 6: Executive brevity. Focus on leading with the "Bottom Line," addressing risks upfront, and providing clear options for decision-making.
43b6cd20-c525-42a7-8173-6273e8dcee89	behavioral	communication	leadership	low	How do you simplify complex strategy?	2026-02-13 09:47:32.107158+00	Score 6: Clarity of thought. Candidate describes using analogies, visual frameworks, or "The Rule of Three" to ensure the strategy is memorable and actionable.
3833fbf1-6efa-43b8-9783-9e9bed65fbd2	behavioral	communication	leadership	low	Tell me about leading a large team meeting.	2026-02-13 09:47:32.107158+00	Score 6: Engagement orchestration. Candidate shows they can hold the attention of a large group while ensuring key voices are heard and alignment is confirmed.
f47636f9-a5e3-4399-a693-05abb8f0dfd9	behavioral	communication	leadership	low	Describe delivering quarterly performance updates.	2026-02-13 09:47:32.107158+00	Score 6: Strategic reporting. Candidate shows they didn't just read numbers, but told the "Story of the Quarter," connecting results to future strategy.
d037c22b-c465-44d0-9ebb-7f27a24d4e44	behavioral	communication	leadership	low	How do you manage difficult conversations?	2026-02-13 09:47:32.107158+00	Score 6: De-escalation. Focus on using neutral language, focusing on behaviors over personality, and reaching a collaborative forward-looking agreement.
30436ad5-afda-42ff-9565-b848d296de16	behavioral	communication	leadership	low	Tell me about aligning leadership teams.	2026-02-13 09:47:32.107158+00	Score 6: Horizontal influence. Candidate describes identifying the incentives of other departments and finding the "Common Ground" that allows them to collaborate.
fddc6822-fd6a-4d82-b6e6-c1eca7b10dcf	behavioral	communication	leadership	low	Describe managing stakeholder expectations.	2026-02-13 09:47:32.107158+00	Score 6: Scope discipline. Candidate shows they communicated boundaries early and honestly, preventing future disappointment by managing current reality.
5caf1aa8-6f9d-40c8-8a8f-9d0948efe223	behavioral	communication	leadership	low	How do you communicate across global teams?	2026-02-13 09:47:32.107158+00	Score 6: Cultural and logisitical agility. Candidate describes adjusting for time-zones, language nuances, and digital communication norms to ensure inclusivity.
454e2ba0-612b-4886-b8f8-8b0d9fa86808	behavioral	communication	leadership	low	Tell me about maintaining executive presence.	2026-02-13 09:47:32.107158+00	Score 6: Confidence and composure. Candidate explains their method for projecting calm authority in high-stakes environments through preparation and body language.
feb2542b-3280-4916-b232-9914ecdb28a9	behavioral	communication	leadership	medium	Tell me about leading communication during major change.	2026-02-13 09:47:32.107158+00	Score 6: Change management. Candidate describes a "Communication Cadence" that suppressed rumors and provided a sense of stability during a transition.
d2a5b28b-e034-430d-8ac9-28d1af7522c6	behavioral	communication	leadership	medium	Describe influencing C-level stakeholders.	2026-02-13 09:47:32.107158+00	Score 6: Strategic alignment. Candidate speaks about "Business Case" logic and how they tied their proposal to the CEO/CFO's top priorities.
e48bbd0c-8277-4f5c-90f3-ca6e1f399f3a	behavioral	communication	leadership	medium	How do you manage communication in mergers/acquisitions?	2026-02-13 09:47:32.107158+00	Score 6: Integration empathy. Focus on the balance between "Company Needs" and "Cultural Anxiety," and how they kept both teams productive through the shift.
8039f62a-61a1-4a40-bf93-05154dc334da	behavioral	communication	leadership	medium	Tell me about communicating during economic downturn.	2026-02-13 09:47:32.107158+00	Score 6: Radical transparency. Candidate shows they delivered the hard facts without sugar-coating, while providing a clear "Survival and Success" roadmap.
f15488ce-2d3a-45c6-bb91-de76b31346b9	behavioral	communication	leadership	medium	Describe handling high-visibility failures.	2026-02-13 09:47:32.107158+00	Score 6: Reputational repair. Candidate shows how they addressed the failure publicly (internal or external), took ownership, and defined the resolution.
a5ec29eb-0efa-4cb0-bea5-1b23a8870225	behavioral	communication	leadership	medium	How do you balance optimism and realism?	2026-02-13 09:47:32.107158+00	Score 6: The Stockdale Paradox. Candidate shows they can acknowledge the brutal facts of a situation while maintaining an unwavering belief in the ultimate victory.
edf36b53-d408-4a75-8098-f6cba16201ce	behavioral	communication	leadership	medium	Tell me about managing reputation risks.	2026-02-13 09:47:32.107158+00	Score 6: Proactive crisis communication. Candidate explains how they detected a risk early and used targeted communication to "Neutralize" the issue before it escalated.
55e75349-1178-4ff8-a293-c31c34b6f65d	behavioral	communication	leadership	medium	Describe communicating controversial decisions.	2026-02-13 09:47:32.107158+00	Score 6: Rational courage. Candidate shows they prioritized "Organizational Health" over popularity, explaining the logic so that even dissenters understood the decision.
6b488d79-22b0-42b4-9d7c-f12605fdb7de	behavioral	communication	leadership	medium	How do you ensure leadership alignment?	2026-02-13 09:47:32.107158+00	Score 6: Governance. Mentions use of "Steering Committees" or "Shared KPIs" that force communication and alignment across the top level of the company.
a78f561b-f6a0-4559-be4a-6046612164bf	behavioral	communication	leadership	medium	Tell me about communicating long-term transformation.	2026-02-13 09:47:32.107158+00	Score 6: Endurance messaging. Candidate describes how they kept the "Transformation Story" alive over months/years, preventing change fatigue through consistent updates.
ef15ac97-1244-469d-8f09-044829bd08f8	behavioral	communication	leadership	high	Tell me about shaping company-wide narrative.	2026-02-13 09:47:32.107158+00	Score 6: Cultural architect. Candidate describes how they helped define the "Core Identity" of the company and used it to drive performance across thousands of people.
4030fc33-1602-4908-8ab7-5d23f105ca15	behavioral	communication	leadership	high	Describe defending strategy under public scrutiny.	2026-02-13 09:47:32.107158+00	Score 6: External presence. Focus on the ability to remain calm and logical during media inquiries, investor calls, or industry conferences.
30954301-6bfb-4471-a04b-dd101bcf7413	behavioral	communication	leadership	high	How do you influence board-level decision-making?	2026-02-13 09:47:32.107158+00	Score 6: Political stewardship. Candidate describes the "Pre-meeting" workÔÇöaligning individual board members privately before the final vote.
5b549898-eadd-450e-95e4-30647877fa93	behavioral	communication	leadership	high	Tell me about communicating during corporate crisis.	2026-02-13 09:47:32.107158+00	Score 6: Crisis Commander. Candidate describes acting as a single, calm source of truth during a PR disaster or operational collapse.
426a6e57-f265-44b9-85ee-08057b96d8d1	behavioral	communication	leadership	high	Describe leading communication across international markets.	2026-02-13 09:47:32.107158+00	Score 6: Global CQ. Candidate shows they adjusted the brand story or corporate message to resonate with vastly different cultural and market realities.
a99eaee7-32ad-4b09-9d4f-50a2615495bb	behavioral	communication	leadership	high	How do you rebuild trust after large-scale failure?	2026-02-13 09:47:32.107158+00	Score 6: Accountability and consistency. Focus on the long-term (12+ month) communication plan used to prove through actions that the company had changed.
67d797bf-d86b-440e-8acd-c775b305c5c0	behavioral	communication	leadership	high	Tell me about managing communication with investors.	2026-02-13 09:47:32.107158+00	Score 6: Financial narrative. Candidate explains how they communicated "Value" rather than just "Profits," managing market expectations through strategic honesty.
e07b0ad1-b43a-44db-9a60-b23ad27efba6	behavioral	communication	leadership	high	Describe aligning diverse executive opinions.	2026-02-13 09:47:32.107158+00	Score 6: Radical facilitation. Candidate describes a moment where they brought together a fractured C-Suite and forced a logical consensus for the good of the company.
221248fb-2eb4-4843-8f06-4344d3dd099f	behavioral	communication	leadership	high	How do you sustain credibility over decades?	2026-02-13 09:47:32.107158+00	Score 6: Legacy integrity. Candidate shows how they maintained a consistent "Do-as-I-say" track record across multiple companies and roles.
accb2b8f-e1e1-443f-a2c1-d11fbcdc906b	behavioral	communication	leadership	high	Tell me about mentoring future leaders in executive communication.	2026-02-13 09:47:32.107158+00	Score 6: Mentorship multiplier. Candidate demonstrates they can teach the nuance of things like "Presence," "Brevity," and "Strategic Diplomacy" to the next generation.
0b481ed1-7f2f-470a-8a25-86cbd7ef8b13	behavioral	adaptability	leadership	low	Tell me about adapting to board-level expectations.	2026-02-13 09:47:32.107158+00	Score 6: Stakeholder agility. Candidate shows they adjusted their reporting style and strategic focus to align with a new board mandate or a shift in investor sentiment.
e3cb76d0-61b2-4366-bd5c-dc2a2eadca81	behavioral	adaptability	leadership	low	Describe adjusting long-term vision due to market trends.	2026-02-13 09:47:32.107158+00	Score 6: Visionary pivot. Candidate explains the market signal they noticed and how they updated the 3-year roadmap to ensure future relevance.
a3d0ee00-fab0-4343-aeeb-719641ff34b1	behavioral	adaptability	leadership	low	How do you respond to leadership transitions?	2026-02-13 09:47:32.107158+00	Score 6: Continuity with change. Candidate shows they maintained department stability while proactively looking for ways to support the new leader's agenda.
c3faf0d1-ec35-4190-a5c6-256ede00da32	behavioral	adaptability	leadership	low	Tell me about managing evolving stakeholder demands.	2026-02-13 09:47:32.107158+00	Score 6: Priority triage. Candidate describes how they re-negotiated the "Strategic Order of Operations" when new, high-priority demands entered the picture.
7d3b04d1-9fa4-4ecc-a62c-7578a98ac80a	behavioral	adaptability	leadership	low	Describe adapting during rapid growth phases.	2026-02-13 09:47:32.107158+00	Score 6: Scalability. Candidate shows they identified which parts of the organization were "Breaking" under the weight of growth and pivoted to more mature processes.
0e13d9fe-9520-4489-8de5-198001e56a8c	behavioral	adaptability	leadership	low	How do you respond to declining revenue periods?	2026-02-13 09:47:32.107158+00	Score 6: Adaptive frugality. Candidate describes shifting from "Growth mode" to "Efficiency mode" without losing the long-term strategic intent.
d61c4cef-c0c5-4627-9768-24f72ca80eed	behavioral	adaptability	leadership	low	Tell me about navigating organizational restructuring.	2026-02-13 09:47:32.107158+00	Score 6: Structural agility. Candidate shows they focused on where they could add the most value in the "New World" rather than clinging to their old title or department.
c8129b23-1855-4cc2-8cdb-625a72c10983	behavioral	adaptability	leadership	low	Describe adjusting executive priorities.	2026-02-13 09:47:32.107158+00	Score 6: Strategic focus. Candidate shows they can kill a "Pet Project" to allocate resources to a newly discovered, higher-impact opportunity.
beaf244f-51f1-4250-8eb1-ae0c2de774f2	behavioral	adaptability	leadership	low	How do you adapt across global markets?	2026-02-13 09:47:32.107158+00	Score 6: Global-local balance. Candidate describes adjusting the "Talk track" or "Go-to-Market" strategy to fit local cultural norms while maintaining global brand standards.
1e2f735f-3b45-4689-87a9-b2c977495f55	behavioral	adaptability	leadership	low	Tell me about responding to emerging technologies.	2026-02-13 09:47:32.107158+00	Score 6: Tech curiosity. Candidate shows they didn't just ignore a new trend but created a small "Task Force" to experiment with it (e.g., AI integration).
7b0a383e-52df-42b1-9522-8eb1147a3ea2	behavioral	adaptability	leadership	medium	Tell me about leading transformation initiatives.	2026-02-13 09:47:32.107158+00	Score 6: Holistic transformation. Candidate describes changing not just the "Tech" but the "People" and "Process" to ensure the transformation stuck.
6e7491ce-517c-489d-bc99-57d00f4d3c22	behavioral	adaptability	leadership	medium	Describe adapting strategy during crisis.	2026-02-13 09:47:32.107158+00	Score 6: Crisis agility. Candidate shows they threw away the "Yearly Plan" to focus on the "Survival Plan" while identifying an opportunity the crisis created.
d92e9d7f-eff3-4060-97b7-2b6b0ddd19dd	behavioral	adaptability	leadership	medium	How do you manage large-scale digital disruption?	2026-02-13 09:47:32.107158+00	Score 6: Digital evolution. Candidate describes how they dismantled a legacy manual process to adopt a disruptive technology that gave them a 10x speed advantage.
63d104be-cd74-4be1-937a-044c417d28e3	behavioral	adaptability	leadership	medium	Tell me about pivoting corporate direction.	2026-02-13 09:47:32.107158+00	Score 6: Decisive pivot. Candidate explains the data that forced the pivot and the logical communication used to bring the whole organization along.
fb49a892-2e15-4c92-992d-b9b7c45088c9	behavioral	adaptability	leadership	medium	Describe adapting to investor expectations.	2026-02-13 09:47:32.107158+00	Score 6: Capital agility. Candidate shows they adjusted the business model (e.g. from Growth to Profitability) to meet the changing requirements of the capital markets.
0a405856-f573-46d2-84c9-7dc96264310a	behavioral	adaptability	leadership	medium	How do you manage strategic uncertainty?	2026-02-13 09:47:32.107158+00	Score 6: Scenario planning. Candidate describes creating multiple "If-Then" pathways rather than relying on a single, fragile 5-year plan.
e432f7c6-c75b-4aa6-aa3b-14c0a1312199	behavioral	adaptability	leadership	medium	Tell me about balancing innovation and operational control.	2026-02-13 09:47:32.107158+00	Score 6: Ambidextrous leadership. Candidate shows they created a "Safe Zone" for new ideas that didn't threaten the stable core of the business.
ddea67b4-bc8f-4efd-8b42-02de2bbf8534	behavioral	adaptability	leadership	medium	Describe adapting governance models.	2026-02-13 09:47:32.107158+00	Score 6: Governance agility. Candidate shows they realized the current decision-making process was too slow and redesigned it to be more agile/decentralized.
0064eb1b-9d93-4847-b16e-8b357117b042	behavioral	adaptability	leadership	medium	How do you adjust leadership approach across generations?	2026-02-13 09:47:32.107158+00	Score 6: Generational empathy. Candidate describes how they changed their communication and management style to resonate with Gen Z vs Boomers without losing authority.
bfa37769-37e7-4ceb-999c-c7209ce09634	behavioral	adaptability	leadership	medium	Tell me about building an agile organization.	2026-02-13 09:47:32.107158+00	Score 6: Cultural agility. Candidate describes the specific policies (e.g. cross-functional squads, fail-fast budgets) they introduced to increase organizational speed.
f1d0ecb2-9c61-46e2-abe5-7fb9728a7cb6	behavioral	adaptability	leadership	high	Tell me about redefining your companyÔÇÖs direction.	2026-02-13 09:47:32.107158+00	Score 6: Foundational shift. A massive story where the candidate recognized the industry was moving and successfully steered a large organization into a new category.
70c40862-0041-4e89-8159-1e429f33c3a1	behavioral	adaptability	leadership	high	Describe leading adaptation during industry collapse.	2026-02-13 09:47:32.107158+00	Score 6: Survival-to-Pivot. Focus on the cold logic used to exit a dying market and the visionary luck/skill used to enter a growing one simultaneously.
3ae6d799-a755-4dce-9a38-3cfa750ed77c	behavioral	adaptability	leadership	high	How do you make decisions when long-term future is unclear?	2026-02-13 09:47:32.107158+00	Score 6: Decision-making. Candidate explains their heuristic for "Making the least-wrong decision" and building in "Reversibility" into every strategic bet.
3c38918a-1169-41fb-a418-26ea80569b7d	behavioral	adaptability	leadership	high	Tell me about navigating global economic crises.	2026-02-13 09:47:32.107158+00	Score 6: Macro-agility. Candidate shows they anticipated the shift (inflation, supply chain collapse) and had the organization hedged/ready before the impact.
c0e9c5cf-f8aa-4d64-ad21-c461101acf64	behavioral	adaptability	leadership	high	Describe reshaping culture to match future strategy.	2026-02-13 09:47:32.107158+00	Score 6: Identity architect. Candidate shows they changed the "Core Values" of the company to drive a new set of behaviors required for a new strategy.
b75d2b2c-f14d-46ea-891d-d2c7179df23a	behavioral	adaptability	leadership	high	How do you handle radical transformation resistance?	2026-02-13 09:47:32.107158+00	Score 6: Change physics. Candidate describes identifying the "Inertia" in the company and the specific leverage points used to break it and move forward.
5f831f96-50e6-44ea-b502-20721dc1857e	behavioral	adaptability	leadership	high	Tell me about exiting a legacy model to adopt innovation.	2026-02-13 09:47:32.107158+00	Score 6: Cannibalization logic. Candidate shows they were willing to "Kill their own product" to launch a better, future-proof version, despite hitting short-term revenue.
706aa127-8c8f-49d2-9ef0-cca369aff0cc	behavioral	adaptability	leadership	high	Describe sustaining adaptability across decades.	2026-02-13 09:47:32.107158+00	Score 6: Lifelong learning. Candidate describes their personal system for staying relevant as the world shifted from Analog to Digital to AI, and how they apply that to leadership.
97b5374f-9db8-4318-8d07-878a10dd95b7	behavioral	adaptability	leadership	high	How do you build succession-ready adaptive leaders?	2026-02-13 09:47:32.107158+00	Score 6: Multiplier effect. Candidate demonstrates they have a system for identifying "Adaptive Potential" in their directs and coaching it into "Adaptive Leadership."
50e4e261-420d-4ef1-81ae-a6c77b054287	behavioral	adaptability	leadership	high	Tell me about your toughest strategic pivot.	2026-02-13 09:47:32.107158+00	Score 6: Ultimate agility. A high-stakes, high-emotions story where they turned a potential corporate "Dead End" into a new, thriving 10-year growth path.
fa8d3d72-a541-4895-8d3e-a60cf6be0848	psychometric	burnout_risk	fresher	low	Tell me about adjusting to your new role.	2026-02-13 10:05:59.865704+00	Score 6: Candidate shows structured adaptation. They identify specific learning methods and show a healthy awareness of their own capacity during the transition.
5f1e5487-0e95-41cb-a327-34a3e0bc000c	psychometric	burnout_risk	fresher	low	Describe handling stress during your first few months.	2026-02-13 10:05:59.865704+00	Score 6: Proactive stress management. Candidate describes identifying stressors early and seeking support or using organizational tools to maintain balance.
92a48519-9eed-49af-9ba5-848f37b3ab66	psychometric	burnout_risk	fresher	low	How do you manage feeling overwhelmed by new responsibilities?	2026-02-13 10:05:59.865704+00	Score 6: Prioritization logic. Candidate describes breaking down large tasks into smaller, manageable steps and asking for clarification rather than panicking.
d0b1e80c-e400-4c93-a70e-307b40e3c623	psychometric	burnout_risk	fresher	low	Tell me about balancing learning with performance expectations.	2026-02-13 10:05:59.865704+00	Score 6: Sustainable growth. Candidate shows they understand that learning is part of performance at this stage and allocates time for both without sacrificing quality.
9f2a8ae2-ce95-4f2d-8578-84950c7d87c8	psychometric	burnout_risk	fresher	low	Describe a time when workload felt heavy.	2026-02-13 10:05:59.865704+00	Score 6: Workload management. Focus on transparency with management and using time-blocking or list-making to navigate the peak period.
c30a104d-5c8e-4905-948a-f019e9c670b5	psychometric	burnout_risk	fresher	low	How do you recover after a busy week?	2026-02-13 10:05:59.865704+00	Score 6: Self-awareness. Candidate describes specific, healthy recovery habits that allow them to return to work on Monday at 100% capacity.
8bc8b5df-91dd-4c16-9ce8-b770b50c9413	psychometric	burnout_risk	fresher	low	Tell me about managing mistakes early in your role.	2026-02-13 10:05:59.865704+00	Score 6: Accountability and recovery. They admit the mistake, fix it, and show an absence of toxic self-criticism that leads to burnout.
04f95ba6-cae8-48f1-8c96-fab7c7adae86	psychometric	burnout_risk	fresher	low	Describe maintaining motivation during repetitive tasks.	2026-02-13 10:05:59.865704+00	Score 6: Process engagement. Candidate finds value in the "basics" and explains how they stay focused on the larger goal despite the routine nature of the task.
2b6ace83-ff48-4ae3-a7c0-7d21486459b4	psychometric	burnout_risk	fresher	low	How do you handle pressure to prove yourself?	2026-02-13 10:05:59.865704+00	Score 6: Reality-based confidence. Candidate focuses on incremental wins and building evidence of their value rather than over-extending to the point of exhaustion.
4b064169-0211-4e8e-857f-574c6e15686c	psychometric	burnout_risk	fresher	low	Tell me about managing nervousness at work.	2026-02-13 10:05:59.865704+00	Score 6: Emotional regulation. Candidate recognizes the feeling as natural and describes using preparation as a tool to channel that energy into performance.
f1d1465a-f000-451e-963d-0a5d4f30d043	psychometric	burnout_risk	fresher	medium	Tell me about a time when stress began affecting your focus.	2026-02-13 10:05:59.865704+00	Score 6: Early detection. Candidate describes noticing the drop in focus and taking a deliberate "reset" or adjusting their workflow before a failure occurred.
11beefe2-2619-49c5-88de-c295ee479e53	psychometric	burnout_risk	fresher	medium	Describe handling emotional reactions to critical feedback.	2026-02-13 10:05:59.865704+00	Score 6: Professional maturity. Candidate shows they can separate their "Identity" from the "Output," processing the feedback logically rather than taking it as a personal attack.
3980087c-a529-45c4-8918-ebbb3528f8bd	psychometric	burnout_risk	fresher	medium	How do you prevent work stress from affecting personal life?	2026-02-13 10:05:59.865704+00	Score 6: Boundary setting. Candidate describes clear psychological or physical transitions they use to "switch off" and protect their long-term mental health.
e0964289-a00a-4359-a929-677c6fb394bd	psychometric	burnout_risk	fresher	medium	Tell me about managing self-doubt under pressure.	2026-02-13 10:05:59.865704+00	Score 6: Evidence-led logic. Candidate describes countering self-doubt by looking at their past achievements or seeking objective confirmation from peers/mentors.
073086c9-0ecd-4335-b536-5a0ac6bfc604	psychometric	burnout_risk	fresher	medium	Describe a period when enthusiasm declined.	2026-02-13 10:05:59.865704+00	Score 6: Re-alignment. Candidate identifies why the enthusiasm dipped (burnout, lack of challenge) and describes the proactive step taken to find new meaning in the work.
291e36c7-7574-4640-92f1-bb230262318f	psychometric	burnout_risk	fresher	medium	How do you handle continuous performance expectations?	2026-02-13 10:05:59.865704+00	Score 6: Pace management. Candidate shows they understand that performance is a marathon, not a sprint, and describes a sustainable daily rhythm.
405a16c3-44b2-442d-90f3-9067dda354e0	psychometric	burnout_risk	fresher	medium	Tell me about recovering from mental exhaustion.	2026-02-13 10:05:59.865704+00	Score 6: Strategic recovery. Candidate identifies the root cause of the exhaustion and describes a structural change to their work/rest cycle to prevent recurrence.
98835e9c-20e8-41de-a69b-bf76552d7eb7	psychometric	burnout_risk	fresher	medium	Describe balancing multiple deadlines.	2026-02-13 10:05:59.865704+00	Score 6: Triage mastery. Candidate explains the logic used to decide what gets done first and how they communicated realistic timelines to stakeholders.
298c8bc2-dbd1-4e2a-abbc-5fe0860e57b9	psychometric	burnout_risk	fresher	medium	How do you stay engaged during high-pressure phases?	2026-02-13 10:05:59.865704+00	Score 6: Resilience integration. Focus on "stress-testing" their own systems and finding pride in their ability to maintain quality under load.
76220b84-861c-470f-81f4-6403d10eb54a	psychometric	burnout_risk	fresher	medium	Tell me about managing frustration at work.	2026-02-13 10:05:59.865704+00	Score 6: Constructive venting. Candidate describes noticing the frustration and choosing a professional path (problem-solving) rather than toxic complaining.
c2ba295d-ebaf-4477-a058-15f79d1fa7d7	psychometric	burnout_risk	fresher	hard	Tell me about a time you felt emotionally detached from work.	2026-02-13 10:05:59.865704+00	Score 6: Honest reflection and reconnection. Candidate recognizes the detachment as a warning sign and describes the specific re-engagement strategy they used.
97f18c97-99e0-4740-8b57-179f49543066	psychometric	burnout_risk	fresher	hard	Describe facing persistent stress over an extended period.	2026-02-13 10:05:59.865704+00	Score 6: Chronic stress management. Candidate shows how they maintained performance standards without compromising their long-term health through systemic changes.
216f1995-dece-47fe-aeda-b8c9bc1f20a8	psychometric	burnout_risk	fresher	hard	How do you handle burnout symptoms early in your career?	2026-02-13 10:05:59.865704+00	Score 6: Radical self-honesty. Candidate describes identifying the symptoms and having a "hard conversation" with themselves or management to adjust the trajectory.
0b8da42d-5111-4490-8b72-ee3cecdac20c	psychometric	burnout_risk	fresher	hard	Tell me about avoiding tasks due to overwhelm.	2026-02-13 10:05:59.865704+00	Score 6: Ownership of the "Block." Candidate admits the avoidance, identifies the fear/stress behind it, and describes how they pushed through it with a new approach.
e6f6782a-9abd-46bf-98f8-4f88e72481cc	psychometric	burnout_risk	fresher	hard	Describe a period when work impacted your well-being.	2026-02-13 10:05:59.865704+00	Score 6: Holistic recovery. Candidate describes the trade-offs they had to make to restore their health while still meeting their core professional obligations.
f9186fe8-1a7e-4889-b45a-3999d918fea7	psychometric	burnout_risk	fresher	hard	How do you respond when motivation significantly drops?	2026-02-13 10:05:59.865704+00	Score 6: Discipline-over-Motivation. Candidate explains how they rely on their systems and professional standards to maintain output during "low" periods.
326b44a8-17f9-4d3f-b3c6-55d8ff1d93f8	psychometric	burnout_risk	fresher	hard	Tell me about questioning your career direction due to pressure.	2026-02-13 10:05:59.865704+00	Score 6: Strategic clarity. Candidate shows they used the pressure to clarify what they truly value in a career, leading to a more committed and resilient professional path.
4de59a7f-6fc1-46c7-af5a-a9cfc2ebd544	psychometric	burnout_risk	fresher	hard	Describe maintaining performance despite exhaustion.	2026-02-13 10:05:59.865704+00	Score 6: Critical efficiency. Candidate describes how they stripped away non-essentials to ensure that the most important work was done at a high standard despite low energy.
2ab6acd1-e604-4e35-be2c-b29f1af0c9ba	psychometric	burnout_risk	fresher	hard	How do you rebuild resilience after sustained stress?	2026-02-13 10:05:59.865704+00	Score 6: Post-traumatic growth. Candidate describes what they learned about their "breaking point" and the new boundaries they set to become stronger for the future.
4c8ac8f6-7e92-4f1d-99e9-8d85524591e3	psychometric	burnout_risk	fresher	hard	Tell me about your toughest period of emotional strain so far.	2026-02-13 10:05:59.865704+00	Score 6: Integration of experience. Candidate shares a vulnerable but professional account of the strain and, most importantly, the logical "way out" they engineered.
a52cd624-526d-4dbe-b268-7d50d39e5d29	psychometric	growth_potential	fresher	low	Tell me about learning a new skill in your current role.	2026-02-13 10:05:59.865704+00	Score 6: Self-directed learning. Candidate shows they didn't just wait to be taught, but used resources (videos, docs, peers) to accelerate their mastery.
f0ce1e36-aa8d-4c4c-b6e3-bebb05cc343f	psychometric	growth_potential	fresher	low	Describe how you respond to feedback.	2026-02-13 10:05:59.865704+00	Score 6: Immediate application. Candidate shows they greeted feedback with curiosity and immediately tested the new approach to see the result.
ca7009ed-c02f-4c24-880c-246899509a0c	psychometric	growth_potential	fresher	low	How do you approach tasks that are new to you?	2026-02-13 10:05:59.865704+00	Score 6: Structured curiosity. Candidate describes an initial research phase followed by a "safe experiment" or asking specific, high-quality questions.
cc4651fa-243d-431b-bfc7-206cc51aeb43	psychometric	growth_potential	fresher	low	Tell me about stepping outside your comfort zone.	2026-02-13 10:05:59.865704+00	Score 6: Calculated risk-taking. Candidate describes a moment of discomfort and the specific logic they used to push through it for the sake of learning.
b8ab21c5-887a-4d59-a06e-d994199a1e45	psychometric	growth_potential	fresher	low	Describe setting goals for your development.	2026-02-13 10:05:59.865704+00	Score 6: SMART orientation. Candidate describes goals that are specific, measurable, and tied to their role's future needs.
55cf8a22-f512-454f-9d9b-9534ea89fef2	psychometric	growth_potential	fresher	low	How do you handle mistakes while learning?	2026-02-13 10:05:59.865704+00	Score 6: Iterative mindset. Candidate explains how they documented the mistake to ensure it became a permanent "lesson learned" for them and their team.
261aa536-8a0d-48a1-83e3-64d9c0a1f099	psychometric	growth_potential	fresher	low	Tell me about improving yourself after receiving guidance.	2026-02-13 10:05:59.865704+00	Score 6: Measurable change. Candidate provides a before-and-after example of their performance following a specific piece of guidance.
78637cdb-06d6-4416-950f-d271c6382453	psychometric	growth_potential	fresher	low	Describe staying motivated while building new competencies.	2026-02-13 10:05:59.865704+00	Score 6: Progress tracking. Candidate shows they stay motivated by tracking their own incremental progress rather than comparing themselves to senior experts.
6d26a02a-d296-40e6-91b3-c40a9d37b0ec	psychometric	growth_potential	fresher	low	How do you prioritize learning alongside performance?	2026-02-13 10:05:59.865704+00	Score 6: Strategic integration. Candidate describes finding ways to learn *through* their tasks, treating every assignment as a training opportunity.
99de2262-953a-4218-b7bf-29119470066e	psychometric	growth_potential	fresher	low	Tell me about taking initiative early in your role.	2026-02-13 10:05:59.865704+00	Score 6: Early value addition. Candidate describes noticing a small gap and filling it without being asked, showing an owner's mindset from day one.
85ebf1cf-8b78-4af3-8163-05291df86f57	psychometric	growth_potential	fresher	medium	Tell me about actively seeking opportunities to grow beyond assigned tasks.	2026-02-13 10:05:59.865704+00	Score 6: Expansion mindset. Candidate describes volunteering for a project specifically because it required a skill they didn't yet have.
d180fb49-d07a-418e-9d1a-69be336a4e22	psychometric	growth_potential	fresher	medium	Describe adapting quickly to a new system or process.	2026-02-13 10:05:59.865704+00	Score 6: Learning velocity. Candidate explains how they mapped the new logic to their old knowledge to become a "power user" faster than expected.
d9e66e4e-4aa3-421a-848c-af39f8825ab1	psychometric	growth_potential	fresher	medium	How do you create a plan for personal development?	2026-02-13 10:05:59.865704+00	Score 6: Outcome-based planning. Candidate shows they have a structured map for their career, including the specific skills and mentors they need next.
6bd38119-03cf-4c47-83a3-1a3bfe0d30a5	psychometric	growth_potential	fresher	medium	Tell me about overcoming a steep learning curve.	2026-02-13 10:05:59.865704+00	Score 6: Persistence and resources. Candidate describes a time they were out of their depth and the specific "learning sprints" used to catch up.
e8664429-a677-4593-8fcc-7004d7b03ceb	psychometric	growth_potential	fresher	medium	Describe applying feedback to produce measurable improvement.	2026-02-13 10:05:59.865704+00	Score 6: ROI of feedback. Candidate can point to a specific metric (speed, accuracy, revenue) that improved directly because of a feedback-based change.
45e357e3-f674-4a4a-be70-b4f94624c400	psychometric	growth_potential	fresher	medium	How do you handle setbacks during skill-building?	2026-02-13 10:05:59.865704+00	Score 6: Analysis-led recovery. Candidate treats a skill-building plateau as a data signal to change their learning method rather than a reason to quit.
31da3ea9-8000-40ea-a196-4c66062b7f4b	psychometric	growth_potential	fresher	medium	Tell me about balancing short-term performance with long-term growth.	2026-02-13 10:05:59.865704+00	Score 6: Strategic time-management. Candidate makes the "hard call" to spend time on a long-term skill that will pay off later, while maintaining today's output.
0dd76d2e-afee-4e79-8087-db2f4420f8d1	psychometric	growth_potential	fresher	medium	Describe learning something complex under time pressure.	2026-02-13 10:05:59.865704+00	Score 6: High-pressure cognition. Candidate explains how they identified the "80/20" of the new complex topic to become functional and useful immediately.
82eea762-b82d-4613-a1eb-5c0cebb3d379	psychometric	growth_potential	fresher	medium	How do you track your own progress?	2026-02-13 10:05:59.865704+00	Score 6: Self-audit. Candidate describes a system (log, dashboard, peer-check) they use to verify they are actually getting better every month.
77256184-ab3c-4ea7-8128-59334b7e3fdb	psychometric	growth_potential	fresher	medium	Tell me about taking ownership of your learning journey.	2026-02-13 10:05:59.865704+00	Score 6: Radical autonomy. Candidate shows they don't wait for "Company Training"ÔÇöthey find the books, courses, and experts required to move forward.
25548d45-89f2-4e70-bc03-c1472fe90089	psychometric	growth_potential	fresher	hard	Tell me about deliberately pursuing growth beyond role expectations.	2026-02-13 10:05:59.865704+00	Score 6: Future-role orientation. Candidate describes mastering skills for the *next* level while still excelling at their current level.
af1dddde-e29a-42b0-991b-56b79885c147	psychometric	growth_potential	fresher	hard	Describe identifying and addressing your own developmental gaps.	2026-02-13 10:05:59.865704+00	Score 6: Intellectual honesty. Candidate identifies a "weakness" they noticed before anyone else did and describes the 3-month plan they used to turn it into a strength.
36bc0eb7-e663-4357-8781-5806b72a7b7c	psychometric	growth_potential	fresher	hard	How do you prepare for future responsibilities not yet assigned?	2026-02-13 10:05:59.865704+00	Score 6: Anticipatory learning. Candidate describes researching industry trends and building competencies that the *company* will need in 12 months.
d47b8ce6-63f8-4131-80ff-38622f29dbe0	psychometric	growth_potential	fresher	hard	Tell me about converting failure into structured learning.	2026-02-13 10:05:59.865704+00	Score 6: Alchemy of failure. Candidate takes a major professional "dark moment" and explains the specific, high-level business lesson they extracted from it.
86a96e6d-7c23-47fc-b187-46c3012f38e1	psychometric	growth_potential	fresher	hard	Describe building long-term career competencies early on.	2026-02-13 10:05:59.865704+00	Score 6: Foundational focus. Candidate shows they are prioritizing "High-Value" skills (leadership, logic, negotiation) over simple tactical "how-to" knowledge.
6c2ea11d-48d6-46b6-9ce3-aa1728ce5f08	psychometric	growth_potential	fresher	hard	How do you sustain growth when progress feels slow?	2026-02-13 10:05:59.865704+00	Score 6: Grit-led growth. Candidate explains their philosophy of "incremental gains" and how they maintain momentum during the "boring" phases of mastery.
d85dd5aa-a78b-4af0-af03-8ace9a7a4b64	psychometric	growth_potential	fresher	hard	Tell me about proactively seeking uncomfortable feedback.	2026-02-13 10:05:59.865704+00	Score 6: Ego-less growth. Candidate admits to asking a critic "What am I doing that most holds me back?" and describes the radical change they made as a result.
36379ec6-b095-46f0-a7bf-c202d6fd0bfe	psychometric	growth_potential	fresher	hard	Describe aligning personal growth with organizational direction.	2026-02-13 10:05:59.865704+00	Score 6: Strategic synergy. Candidate explains how their personal learning path is intentionally designed to solve specific company problems.
631b6de9-3e9b-4544-8414-25c0b1294a09	psychometric	growth_potential	fresher	hard	How do you future-proof your skills?	2026-02-13 10:05:59.865704+00	Score 6: Meta-learning. Candidate describes how they "learn how to learn" so they can adapt regardless of how the industry or technology shifts.
a818517d-94e2-47da-b728-83b9c9f8fef7	psychometric	growth_potential	fresher	hard	Tell me about demonstrating resilience during intense learning phases.	2026-02-13 10:05:59.865704+00	Score 6: Sustained intensity. Candidate describes a multi-month period of high-difficulty learning and how they maintained their well-being and performance throughout.
c85b0b71-4e84-4171-9475-3c7d42fe1458	psychometric	sales_dna	fresher	low	Tell me about persuading someone to accept your idea.	2026-02-13 10:05:59.865704+00	Score 6: Benefit-led persuasion. Candidate shows they focused on *why* it helped the other person, rather than just why they wanted it.
bc32b2b6-eace-451e-be4f-5039451ef336	psychometric	sales_dna	fresher	low	Describe approaching a new person to build rapport.	2026-02-13 10:05:59.865704+00	Score 6: Relationship curiosity. Candidate describes using open-ended questions and active listening to find common ground quickly.
ad4dcc1e-3af8-4597-b734-4dadcfae7a76	psychometric	sales_dna	fresher	low	How do you handle rejection?	2026-02-13 10:05:59.865704+00	Score 6: Impersonal resilience. Candidate views rejection as a "No for now" or an "incorrect fit" rather than a personal failure.
95a7c029-023c-46f2-b058-05d7b7092d78	psychometric	sales_dna	fresher	low	Tell me about achieving a target or goal.	2026-02-13 10:05:59.865704+00	Score 6: Goal obsession. Candidate describes the plan they made to hit the target and the extra effort they put in when they were behind.
8397ff04-a83e-4a30-9272-52ac217e9718	psychometric	sales_dna	fresher	low	Describe staying motivated during repetitive outreach.	2026-02-13 10:05:59.865704+00	Score 6: Activity logic. Candidate understands that "Sales is a numbers game" and finds motivation in the activity metrics themselves.
df4faea7-110e-4d44-888d-4ea21024366c	psychometric	sales_dna	fresher	low	How do you prepare before presenting an idea?	2026-02-13 10:05:59.865704+00	Score 6: Audience research. Candidate describes anticipating objections and tailoring their message to the specific needs of the listener.
ddb1e912-8414-4a8b-9634-3f4e43b3121e	psychometric	sales_dna	fresher	low	Tell me about convincing someone who was hesitant.	2026-02-13 10:05:59.865704+00	Score 6: Empathy and evidence. Candidate shows they listened to the hesitation and provided the one specific data point or reassurance that resolved it.
9c86d727-bdab-4b26-89eb-978d6abc0f76	psychometric	sales_dna	fresher	low	Describe maintaining confidence during discussions.	2026-02-13 10:05:59.865704+00	Score 6: Knowledge-based authority. Candidate shows that their confidence comes from being prepared and truly believing in the value of their proposal.
fb56b871-8548-4c62-ab3f-c8a7a810468f	psychometric	sales_dna	fresher	low	How do you respond when someone challenges your proposal?	2026-02-13 10:05:59.865704+00	Score 6: Collaborative defense. Candidate treats the challenge as an opportunity to clarify the value, rather than a fight to be won.
85fb7bba-4d9d-4434-851b-5353c2ee98ab	psychometric	sales_dna	fresher	low	Tell me about following up to secure commitment.	2026-02-13 10:05:59.865704+00	Score 6: Systematic persistence. Candidate describes the specific follow-up sequence they used to ensure the idea didn't die due to inaction.
7a71aef8-c51f-4b93-ab1d-70815cf57661	psychometric	sales_dna	fresher	medium	Tell me about handling objections during a discussion.	2026-02-13 10:05:59.865704+00	Score 6: Consultative handling. Candidate describes the "Listen > Empathize > Propose" loop to handle objections without being pushy.
a8b99810-d3c9-420f-9f01-e6bb82f5e016	psychometric	sales_dna	fresher	medium	Describe staying persistent after multiple rejections.	2026-02-13 10:05:59.865704+00	Score 6: Optimistic stamina. Candidate shows they maintained the same "High Energy" for the 10th person as they did for the 1st person.
44f95141-f93c-413b-b640-33814d3e8ae2	psychometric	sales_dna	fresher	medium	How do you adapt your communication style for different personalities?	2026-02-13 10:05:59.865704+00	Score 6: Social agility. Candidate describes reading cues (Analytical, Expressive, etc.) and adjusting their pace and tone to match.
c177e7e5-f1d9-44ac-87ab-290fa77d9bcd	psychometric	sales_dna	fresher	medium	Tell me about taking ownership when a result was not achieved.	2026-02-13 10:05:59.865704+00	Score 6: Radical accountability. Candidate doesn't blame "The Market" or "The Leads"ÔÇöthey look at their own activity and pitch to find the fix.
2d2263a3-bdbc-4b44-885a-d9ac59e4c742	psychometric	sales_dna	fresher	medium	Describe influencing a decision without formal authority.	2026-02-13 10:05:59.865704+00	Score 6: Logical influence. Candidate describes building an "Alliance of Value" to convince others that the decision was in their own best interest.
86b3a567-12c7-46b5-897a-7c03101901d4	psychometric	sales_dna	fresher	medium	How do you maintain energy during high-target periods?	2026-02-13 10:05:59.865704+00	Score 6: Strategic enthusiasm. Candidate describes creating a "Winning Environment" for themselves to stay focused and productive under load.
2712f6c0-cdb1-4114-a7b5-d9b81215dcad	psychometric	sales_dna	fresher	medium	Tell me about identifying an opportunity others overlooked.	2026-02-13 10:05:59.865704+00	Score 6: Consultative discovery. Candidate describes hearing a "hidden need" in a casual conversation and turning it into a formal proposal.
7b740862-e0c5-46cd-9780-692bbc843b71	psychometric	sales_dna	fresher	medium	Describe managing performance pressure.	2026-02-13 10:05:59.865704+00	Score 6: Activity-to-Outcome focus. Candidate manages the pressure by doubling down on the *actions* they control rather than worrying about the outcome they don't.
bf137e3a-b012-4d2a-b0ea-de8085afe567	psychometric	sales_dna	fresher	medium	How do you build trust quickly with new contacts?	2026-02-13 10:05:59.865704+00	Score 6: Integrity-led rapport. Candidate shows they prioritize honesty and "doing what they say" from the very first minute of the relationship.
15666eda-9e8d-4d15-a345-a071fd19f27b	psychometric	sales_dna	fresher	medium	Tell me about learning from a lost opportunity.	2026-02-13 10:05:59.865704+00	Score 6: Loss analysis. Candidate describes a specific behavior they changed in their *next* pitch because of the one they just lost.
590f7b34-ff7f-4656-bdb2-81a534702a77	psychometric	sales_dna	fresher	hard	Tell me about thriving in a highly competitive environment.	2026-02-13 10:05:59.865704+00	Score 6: Competitive resilience. Candidate finds energy in the competition and uses it to drive their own standards higher without becoming toxic.
762f0de1-9e04-489e-9507-925f1eb3a5b6	psychometric	sales_dna	fresher	hard	Describe turning a firm ÔÇ£noÔÇØ into a potential opportunity.	2026-02-13 10:05:59.865704+00	Score 6: Strategic inquiry. Candidate shows how they qualified the "No" to understand the constraint, leading to a modified proposal that was a "Yes."
cec8c9bb-3c2d-4795-aded-4dbdc87ed753	psychometric	sales_dna	fresher	hard	How do you strategically influence both logic and emotion?	2026-02-13 10:05:59.865704+00	Score 6: Holistic persuasion. Candidate describes using "Social Proof" for emotion and "CBA/ROI" for logic to close the gap.
91315e9b-76d7-4d2c-9dc5-cc00e219e2ae	psychometric	sales_dna	fresher	hard	Tell me about negotiating while protecting value.	2026-02-13 10:05:59.865704+00	Score 6: Value-first negotiation. Candidate shows they were willing to trade "terms" for "price," ensuring the company's margin was protected.
254db92f-826f-406c-ac43-f7efbdfeb4fd	psychometric	sales_dna	fresher	hard	Describe maintaining high performance during consecutive setbacks.	2026-02-13 10:05:59.865704+00	Score 6: Resilience cycle. Candidate explains how they "reset" after each loss to ensure the next prospect received their best possible performance.
cdd2adb4-863e-4139-9a3f-c858ff1370c6	psychometric	sales_dna	fresher	hard	How do you sustain momentum during long sales cycles?	2026-02-13 10:05:59.865704+00	Score 6: Multi-threading influence. Candidate describes engaging multiple people in an organization to ensure the "deal" stays alive even if one person goes silent.
ff9dcc33-0fc1-4b54-a572-9357e15b0d17	psychometric	sales_dna	fresher	hard	Tell me about recovering confidence after a major rejection.	2026-02-13 10:05:59.865704+00	Score 6: Self-rebuilding. Candidate described an objective post-mortem that proved the loss wasn't a failure of their talent, but a specific process gap they have now fixed.
ebd4461b-e670-44ae-a384-14f73beaf622	psychometric	sales_dna	fresher	hard	Describe balancing relationship-building with revenue focus.	2026-02-13 10:05:59.865704+00	Score 6: Commercial empathy. Candidate shows they can have a "warm" relationship while still being firm on the revenue requirements of the deal.
14739ebf-f1ec-4612-b152-5526da93b550	psychometric	sales_dna	fresher	hard	How do you ensure consistent follow-through until closure?	2026-02-13 10:05:59.865704+00	Score 6: CRM discipline. Candidate explains their methodical "Tickler" system and why they never let a lead go cold due to purely administrative reasons.
76f9e6e9-84b6-4831-817b-c5ddc322ebe1	psychometric	sales_dna	fresher	hard	Tell me about your toughest closing experience.	2026-02-13 10:05:59.865704+00	Score 6: Closing persistence. A story of high-stakes deadlock and the specific "Value Bridge" they built to finally secure the commitment.
77bfe007-e154-4130-8c58-1cdb5b7e0c2b	psychometric	burnout_risk	mid	low	Reflect on times you feel consistently tired after workdays. How do you manage your energy?	2026-02-13 10:11:10.265317+00	Score 6: Candidate shows self-awareness. They identify energy drains and describe a proactive system for physical or mental replenishment.
71821959-e8ba-41ce-ba72-7ced9c5d5a8f	psychometric	burnout_risk	mid	low	How do you handle a workload that feels heavier than in your early career years?	2026-02-13 10:11:10.265317+00	Score 6: Operational maturity. Candidate describes using improved efficiency, delegation, or tool-usage to handle the increased load rather than just working longer hours.
950c00d9-847f-4f62-a847-5d1b6c251645	psychometric	burnout_risk	mid	low	Describe your approach to maintaining work-life balance as your responsibilities grow.	2026-02-13 10:11:10.265317+00	Score 6: Boundary logic. Candidate explains high-level prioritization and the use of rituals or schedules to protect personal time.
41ee3f2d-e5bf-4293-a2f0-263cf668bac4	psychometric	burnout_risk	mid	low	How do you process the ongoing pressure to perform at a high level?	2026-02-13 10:11:10.265317+00	Score 6: Professional perspective. Candidate describes viewing pressure as a manageable component of the role rather than a personal crisis.
b30186a3-20c0-4405-92ca-9a7a3f77fc84	psychometric	burnout_risk	mid	low	Tell me about managing stress during peak business periods.	2026-02-13 10:11:10.265317+00	Score 6: Peak-load management. Candidate describes a specific "Survival Mode" protocol that maintains performance while preventing long-term exhaustion.
72006860-03ca-4383-b47a-f609a1ca9400	psychometric	burnout_risk	mid	low	How do you successfully disconnect from work responsibilities after hours?	2026-02-13 10:11:10.265317+00	Score 6: Cognitive switching. Candidate shares a technique for "mentally punching out" to ensure deep rest.
39e95091-dd5f-46f9-b942-1792a7fec06a	psychometric	burnout_risk	mid	low	How do you stay energized when handling day-to-day routine responsibilities?	2026-02-13 10:11:10.265317+00	Score 6: Process engagement. Candidate identifies the "Higher Why" in routine tasks to maintain focus and prevent boredom-induced fatigue.
a3cfe462-6a12-4f2e-ae80-2c6ff327fd4c	psychometric	burnout_risk	mid	low	Describe how you maintain steady motivation despite fluctuations in workload.	2026-02-13 10:11:10.265317+00	Score 6: Internal locus of control. Candidate describes relying on their own standards of excellence rather than external excitement.
94006421-ecec-44d0-b3a7-5a66c9957429	psychometric	burnout_risk	mid	low	How do you ensure you have enough time for personal recovery?	2026-02-13 10:11:10.265317+00	Score 6: Strategic rest. Candidate treats recovery as a non-negotiable part of their high-performance system.
96377c60-b250-48d9-af04-68fa0d33cb14	psychometric	burnout_risk	mid	low	Reflect on times when fatigue impacts your enthusiasm. What is your response?	2026-02-13 10:11:10.265317+00	Score 6: Resilience cycle. Candidate describes identifying early signs of fatigue and taking a "micro-break" or adjusting their pace to recover early.
0187d227-f925-4f1a-bdf7-687ba90e8db7	psychometric	burnout_risk	mid	medium	How do you manage the mental strain of sustained performance expectations?	2026-02-13 10:11:10.265317+00	Score 6: Sustainable pace. Candidate describes breaking the year into "sprints" and "recovery zones" to maintain a high average output.
32f64c99-e24d-4010-99f0-121a212e5566	psychometric	burnout_risk	mid	medium	Tell me about managing emotional exhaustion during consecutive busy days.	2026-02-13 10:11:10.265317+00	Score 6: EQ and composure. Candidate shows they can monitor their own emotional temperature and use logic to stay professional under strain.
96d50816-a858-43d9-b5d4-6acda1666cb3	psychometric	burnout_risk	mid	medium	How do you handle moments when increased responsibilities feel overwhelming?	2026-02-13 10:11:10.265317+00	Score 6: Resourcefulness. Candidate describes "Triaging" the responsibilities and communicating with leadership to align on realistic priorities.
3a0413fd-901e-403e-b14e-85b6c21ac9a6	psychometric	burnout_risk	mid	medium	How do you maintain your drive when recognition does not match your effort invested?	2026-02-13 10:11:10.265317+00	Score 6: Intrinsic motivation. Candidate finds satisfaction in the work quality and the skill-building itself, rather than relying solely on external praise.
a24f4f23-77ea-41eb-b140-318c2282f9c3	psychometric	burnout_risk	mid	medium	How do you maintain your patience in high-pressure situations?	2026-02-13 10:11:10.265317+00	Score 6: Sophisticated composure. Candidate describes a "mental pause" technique that allows them to choose a logical response over an emotional reaction.
78a39c32-6216-4ff3-b6de-1609bda0aeff	psychometric	burnout_risk	mid	medium	Tell me about maintaining productivity when work stress is high.	2026-02-13 10:11:10.265317+00	Score 6: Signal-vs-Noise. Candidate describes focusing on "high-leverage" tasks and using rigid systems to stay productive despite the background stress.
27afac5b-b286-495c-85d0-9de721a23a09	psychometric	burnout_risk	mid	medium	How do you manage professional commitments that interfere with personal priorities?	2026-02-13 10:11:10.265317+00	Score 6: Conflict resolution. Candidate describes a fair and transparent negotiation with stakeholders to find a win-win that respects both spheres.
49d9333a-b009-463c-98d1-a48de89635f9	psychometric	burnout_risk	mid	medium	How do you prevent mental fatigue from reducing your problem-solving ability?	2026-02-13 10:11:10.265317+00	Score 6: Cognitive conservation. Candidate describes taking "brain breaks" or switching to less intensive tasks to allow their creative logic to recover.
ef38cdab-ef9c-4118-b2a0-955702d9699a	psychometric	burnout_risk	mid	medium	Describe staying motivated when your work outcomes feel repetitive.	2026-02-13 10:11:10.265317+00	Score 6: Continuous improvement. Candidate challenges themselves to "beat their own record" or find a new innovation in the repetitive task.
5cacc451-76a0-4a63-a828-18d5c7206314	psychometric	burnout_risk	mid	medium	Tell me about managing multiple competing priorities without burning out.	2026-02-13 10:11:10.265317+00	Score 6: Multi-project management. Candidate describes a visual or logical system for managing the mental load of several high-stakes projects.
5035b75d-d154-41c6-add4-9cd13a027acb	psychometric	burnout_risk	mid	hard	How do you prevent chronic stress from impacting your engagement with work?	2026-02-13 10:11:10.265317+00	Score 6: Engaged resilience. Candidate describes a system for monitoring their "engagement levels" and taking strategic action to re-align with the mission.
a1e43178-6133-4a7b-b70f-1757e96eb670	psychometric	burnout_risk	mid	hard	Reflect on how your emotional resilience has evolved since you started your career.	2026-02-13 10:11:10.265317+00	Score 6: Growth reflection. Candidate identifies specific "resilience skills" (e.g., detachment, prioritization) they have learned to deploy under heavy stress.
391b10f6-fbba-413d-a95d-9f1d402f7054	psychometric	burnout_risk	mid	hard	How do you address burnout symptoms while still maintaining your performance?	2026-02-13 10:11:10.265317+00	Score 6: Radical ownership. Candidate describes early interventionÔÇöadjusting their workflow or workload *before* performance drops significantly.
267e6a72-9880-4052-9641-dc4da9537a14	psychometric	burnout_risk	mid	hard	Tell me about managing work demands that create long-term exhaustion.	2026-02-13 10:11:10.265317+00	Score 6: Structural change. Candidate describes a moment they realized a working style was unsustainable and the systemic change they made to fix it.
3f4e578f-4ee8-4c29-ae02-cbd6de183968	psychometric	burnout_risk	mid	hard	How do you handle feeling trapped between high expectations and limited resources?	2026-02-13 10:11:10.265317+00	Score 6: Frugal innovation. Candidate describes the logic of "doing less to achieve more" by focusing purely on ROI-positive activities.
8363dd4f-4ce4-4f22-a6ac-6fe50a3b4793	psychometric	burnout_risk	mid	hard	Describe how you maintain professional growth despite constant pressure.	2026-02-13 10:11:10.265317+00	Score 6: Growth endurance. Candidate shows they continue to upskill *even when busy*, viewing growth as the solution to the pressure.
10d75c71-6aff-4840-b451-3ec4ebab9f7f	psychometric	burnout_risk	mid	hard	How do you protect your personal relationships from the impact of work stress?	2026-02-13 10:11:10.265317+00	Score 6: Holistic health. Candidate describes have a "hard wall" between work behavior and personal interactions to ensure high-quality rest.
0781f2b4-2cbe-4e51-8a52-29bbaa40c679	psychometric	burnout_risk	mid	hard	How do you ensure fatigue doesnÔÇÖt influence the quality of your decision-making?	2026-02-13 10:11:10.265317+00	Score 6: Process guardrails. Candidate describes using checklists, peer-reviews, or a "wait-24-hours" rule for decision-making when tired.
35190896-68c0-4fac-b176-cf5b671ae123	psychometric	burnout_risk	mid	hard	How do you rebuild a sense of accomplishment during periods of heavy effort?	2026-02-13 10:11:10.265317+00	Score 6: Achievement mapping. Candidate describes tracking their own wins and the impact they have, even when the final goal is still far off.
3e9e2461-c893-40a6-be59-65059280bf7a	psychometric	burnout_risk	mid	hard	How do you evaluate if a workload intensity is sustainable in the long term?	2026-02-13 10:11:10.265317+00	Score 6: Future-oriented logic. Candidate describes the specific health and performance metrics they use to "check the engine" of their own career.
0f50fa1b-0ca5-4a59-ac13-d394d40388c5	psychometric	growth_potential	mid	low	Tell me about expanding your role responsibilities.	2026-02-13 10:11:10.265317+00	Score 6: Proactive expansion. Candidate describes taking on a task specifically because it aligned with a desired future skill.
1229ad58-01e3-49aa-a4ef-acbf1d2e2734	psychometric	growth_potential	mid	low	Describe learning a new capability to improve performance.	2026-02-13 10:11:10.265317+00	Score 6: Learning ROI. Candidate identifies a bottleneck in their work and the specific skill they learned to clear it.
2efa9b81-d645-40c6-9e50-2c5bb7887733	psychometric	growth_potential	mid	low	How do you respond to evolving job expectations?	2026-02-13 10:11:10.265317+00	Score 6: Agility. Candidate describes greeting new expectations with curiosity rather than resistance, and a plan to master the new requirements.
b4029212-afd2-40de-bf60-086698b97c9f	psychometric	growth_potential	mid	low	Tell me about volunteering for new challenges.	2026-02-13 10:11:10.265317+00	Score 6: Fearless learning. Candidate describes a time they "raised their hand" for a task they weren't 100% ready for, in order to grow.
0bc1de4c-5bed-4738-9c01-b3de0dbc8d06	psychometric	growth_potential	mid	low	Describe improving performance through self-initiative.	2026-02-13 10:11:10.265317+00	Score 6: Owner mindset. Candidate describes a improvement they made to a process or result that wasn't part of their formal job description.
5bfdac38-59ef-442e-a4c6-560152e5cb51	psychometric	growth_potential	mid	low	How do you maintain curiosity in your role?	2026-02-13 10:11:10.265317+00	Score 6: Intellectural engagement. Candidate describes specific habits (reading, networking, questioning) they use to stay "mentally fresh."
f83f7590-5426-412a-a4b4-877d7d16a07b	psychometric	growth_potential	mid	low	Tell me about taking feedback constructively.	2026-02-13 10:11:10.265317+00	Score 6: Rapid application. Candidate describes a specific piece of feedback and the measurable performance gain that resulted from implementing it.
337f5913-e310-4c5a-80a0-cf95f20d520d	psychometric	growth_potential	mid	low	Describe developing expertise in your domain.	2026-02-13 10:11:10.265317+00	Score 6: Depth orientation. Candidate shows they aren't just learning the "what" but the "why" and "how" of their industry.
8fd75d26-31c1-44ca-8feb-09b5d35fd9ab	psychometric	growth_potential	mid	low	How do you stay motivated to grow professionally?	2026-02-13 10:11:10.265317+00	Score 6: Vision alignment. Candidate describes how their current growth is a specific stepping stone to their 5-year career goal.
24f0f61d-c25c-46db-a985-0a928cd45b22	psychometric	growth_potential	mid	low	Tell me about setting mid-term career goals.	2026-02-13 10:11:10.265317+00	Score 6: Strategic planning. Candidate describes a goal for the next 2-3 years and the specific milestones they are currently hitting.
2738819d-22e8-4b3d-af65-07971d0110ab	psychometric	growth_potential	mid	medium	Tell me about adapting to significant changes in your role.	2026-02-13 10:11:10.265317+00	Score 6: Transition agility. Candidate describes the "unlearning and relearning" process they went through to stay effective during a role shift.
3ca7c65a-aea7-48e0-9622-67b3d64ae551	psychometric	growth_potential	mid	medium	Describe upskilling to remain relevant in your field.	2026-02-13 10:11:10.265317+00	Score 6: Future-proofing. Candidate identifies a technology or market shift and the specific training/course they completed to prepare.
69aae4fb-3319-4b31-8469-4796faf1b37d	psychometric	growth_potential	mid	medium	How do you evaluate your strengths and improvement areas?	2026-02-13 10:11:10.265317+00	Score 6: Analytical self-awareness. Candidate describes using data, peer feedback, or self-audits to find their "skills gaps."
902f6a11-9764-43df-8ebe-58651e873f4b	psychometric	growth_potential	mid	medium	Tell me about leading a task outside your comfort zone.	2026-02-13 10:11:10.265317+00	Score 6: Courageous leadership. Candidate describes handling the uncertainty and using their core logic to drive a result in unfamiliar territory.
a1ec3788-efbe-4d45-b303-5682404f8a9a	psychometric	growth_potential	mid	medium	Describe pursuing certifications or structured learning.	2026-02-13 10:11:10.265317+00	Score 6: Discipline. Candidate shows they can commit to a long-term learning path outside of normal working hours.
9a828a5e-028b-4917-9fc6-4f5c6321cd93	psychometric	growth_potential	mid	medium	How do you handle plateaus in your development?	2026-02-13 10:11:10.265317+00	Score 6: Persistence. Candidate describes a time they felt "stuck" and the specific change in method or mentorship they sought to break through.
e62045aa-7c5a-4767-94a9-fafe6bb38adf	psychometric	growth_potential	mid	medium	Tell me about expanding your influence beyond your formal role.	2026-02-13 10:11:10.265317+00	Score 6: Matrix impact. Candidate describes how they helped another department or colleague, building social capital and knowledge.
5e6ca7c1-c10e-4c72-8a59-cabe59b5a65c	psychometric	growth_potential	mid	medium	Describe building competencies for leadership readiness.	2026-02-13 10:11:10.265317+00	Score 6: Anticipatory lead. Candidate describes learning how to coach others or manage projects before they were given a formal leadership title.
a505c172-46f9-4f71-a2fa-ff16015f7911	psychometric	growth_potential	mid	medium	How do you align growth efforts with career aspirations?	2026-02-13 10:11:10.265317+00	Score 6: Goal synergy. Candidate explains how every new skill they learn is a deliberate addition to their "Career Stack."
84a44e9f-7cb3-40b3-bb4b-5634022694af	psychometric	growth_potential	mid	medium	Tell me about learning from cross-functional exposure.	2026-02-13 10:11:10.265317+00	Score 6: Holistic business logic. Candidate describes what they learned about "The Big Picture" by working with a completely different department.
7dc4c9e4-827f-4aa3-ad70-ee1d98a4471f	psychometric	growth_potential	mid	hard	Tell me about redefining your career direction intentionally.	2026-02-13 10:11:10.265317+00	Score 6: Strategic pivot. Candidate describes a moment they realized they were on the "wrong path" and the logical steps they took to re-steer toward a higher-potential future.
2109c0dd-b28c-47f0-a849-0715cfc0c915	psychometric	growth_potential	mid	hard	Describe developing strategic thinking capabilities.	2026-02-13 10:11:10.265317+00	Score 6: Cognitive expansion. Candidate describes moving from "Doing" to "Planning"ÔÇöunderstanding the market and competitive landscape in a new way.
7dcdc9ce-c447-4c0f-892d-eb309068b81e	psychometric	growth_potential	mid	hard	How do you prepare for roles beyond your current level?	2026-02-13 10:11:10.265317+00	Score 6: Gap analysis. Candidate describes the specific leadership or technical skills they are building *now* to be ready for a promotion in 12 months.
102053bf-d49f-4639-b563-6c0f69864e41	psychometric	growth_potential	mid	hard	Tell me about mentoring others while growing yourself.	2026-02-13 10:11:10.265317+00	Score 6: Multiplier mindset. Candidate shows they can teach what they are still learning, cementing their own knowledge while helping the team.
0c7e20fa-e5f2-46b2-b5c3-4df325f3befb	psychometric	growth_potential	mid	hard	Describe transforming weaknesses into strengths.	2026-02-13 10:11:10.265317+00	Score 6: Radical transformation. A story of a "natural weakness" that they fixed through intense, systematic effort and discipline.
48032c8a-6415-4607-bb29-25f5de21a9b5	psychometric	growth_potential	mid	hard	How do you sustain adaptability in dynamic environments?	2026-02-13 10:11:10.265317+00	Score 6: Environment sensing. Candidate describes their personal system for "monitoring change" and adjusting their skills every quarter.
a0ed7b6d-89d9-403c-9b79-3bdeca7f6f8a	psychometric	growth_potential	mid	hard	Tell me about navigating growth during organizational shifts.	2026-02-13 10:11:10.265317+00	Score 6: Chaos agility. Candidate shows how they turned a re-org or acquisition into an opportunity to learn a new part of the business.
9e09dc01-bdb3-4da7-9fe3-da955c4a03eb	psychometric	growth_potential	mid	hard	Describe building long-term value rather than short-term gains.	2026-02-13 10:11:10.265317+00	Score 6: Integrity focus. Candidate describes a time they sacrificed an easy win for a longer-term structural improvement in their skills or the company.
6593e578-e376-4750-b23f-21497c665652	psychometric	growth_potential	mid	hard	How do you maintain relevance in competitive environments?	2026-02-13 10:11:10.265317+00	Score 6: Competitive learning. Candidate treats the high standards of their peers as a benchmark to push their own growth further.
c483fdcd-f99a-4999-a518-e16ac6208564	psychometric	growth_potential	mid	hard	Tell me about your toughest growth acceleration phase.	2026-02-13 10:11:10.265317+00	Score 6: High-intensity learning. A story of massive, rapid skill acquisition under pressure and how they managed the stress of the "learning curve."
f280a070-aff1-4410-a297-4e414ce68c4b	psychometric	sales_dna	mid	low	Tell me about consistently achieving sales targets.	2026-02-13 10:11:10.265317+00	Score 6: Systematic delivery. Candidate explains their "Math of Sales"ÔÇöhow many leads/calls they need to guarantee the outcome every single time.
55cf1d3f-11b2-455f-9790-bf1a11bf313d	psychometric	sales_dna	mid	low	Describe building long-term client relationships.	2026-02-13 10:11:10.265317+00	Score 6: Advisor mindset. Candidate describes moving from "Salesperson" to "Trusted Partner," focusing on the client's business results over years.
de5a2617-34b2-4138-923d-39a0f7b45acc	psychometric	sales_dna	mid	low	How do you handle initial resistance from prospects?	2026-02-13 10:11:10.265317+00	Score 6: Curiosity over defense. Candidate describes using discovery questions to find the logic behind the resistance rather than pushing back.
511201f2-bd5b-496f-8404-d1dc938ddb2d	psychometric	sales_dna	mid	low	Tell me about staying disciplined in follow-ups.	2026-02-13 10:11:10.265317+00	Score 6: CRM mastery. Candidate explains their methodology for ensures no opportunity "falls through the cracks" during a 6-month cycle.
861f7b47-e175-49b9-affe-b2a7e6dc1932	psychometric	sales_dna	mid	low	Describe managing a competitive sales environment.	2026-02-13 10:11:10.265317+00	Score 6: Healthy competition. Candidate thrives in the pressure of the leaderboard and uses it to sharpen their own tactical standards.
4b7bcf88-04f4-4bff-80b2-6d5d5aaa2d7b	psychometric	sales_dna	mid	low	How do you prepare before important client interactions?	2026-02-13 10:11:10.265317+00	Score 6: Strategic intelligence. Candidate describes researching the client's industry, competitors, and annual reports before the call.
47995a8c-af21-4d65-b203-3060904bffdd	psychometric	sales_dna	mid	low	Tell me about maintaining motivation during slow quarters.	2026-02-13 10:11:10.265317+00	Score 6: Pipeline hygiene. Candidate describes using slow periods to "clean the deck" and build a massive base for the next quarter.
aeee5390-4482-471e-8af8-ec9a139dcfe4	psychometric	sales_dna	mid	low	Describe handling performance reviews tied to revenue.	2026-02-13 10:11:10.265317+00	Score 6: Data ownership. Candidate treats the review as a technical discussion of "Inputs vs Outputs" and creates a concrete plan for improvement.
ef65d9ab-fc5b-464e-9f19-acd44ce6d6c3	psychometric	sales_dna	mid	low	How do you manage stress during high-pressure sales cycles?	2026-02-13 10:11:10.265317+00	Score 6: Composure. Candidate shows they can maintain a "helpful tonality" with clients even when they are behind on their quota.
37e49073-a766-4bdc-bb60-453e247c3fe8	psychometric	sales_dna	mid	low	Tell me about building credibility with clients.	2026-02-13 10:11:10.265317+00	Score 6: Evidence-based selling. Candidate describes using case-studies, logic, and deep product knowledge to overcome skepticism.
d4aa1c76-4905-47f2-b040-b19d3155a5de	psychometric	sales_dna	mid	medium	Tell me about handling complex objections.	2026-02-13 10:11:10.265317+00	Score 6: Sophisticated redirection. Candidate identifies the "unspoken objection" and addresses the business impact of *not* solving the problem.
30e92ecb-415e-41c1-b738-b282a231ebcc	psychometric	sales_dna	mid	medium	Describe negotiating win-win agreements.	2026-02-13 10:11:10.265317+00	Score 6: Value expansion. Candidate explains how they traded low-cost items (e.g., training) for high-value items (e.g., contract length) to protect margin.
80557dca-d64a-416e-b887-6b51ad70a851	psychometric	sales_dna	mid	medium	How do you manage pipeline uncertainty?	2026-02-13 10:11:10.265317+00	Score 6: Probability logic. Candidate shows they run their pipeline based on "weighted value" and always have a "Plan B" segment of leads.
fd3c2aaf-d385-4b60-8194-c783c11c1dd1	psychometric	sales_dna	mid	medium	Tell me about influencing multi-stakeholder decisions.	2026-02-13 10:11:10.265317+00	Score 6: Stakeholder mapping. Candidate describes finding the "Technical Buyer" vs "Financial Buyer" and tailoring the message to both.
c381af5e-af1b-4bee-9582-251a52ecf922	psychometric	sales_dna	mid	medium	Describe recovering from a missed quarterly target.	2026-02-13 10:11:10.265317+00	Score 6: Resilience and redirection. Candidate describes a logical post-mortem of the miss and the immediate activity surge used to bridge the gap next time.
bdce1721-edc4-4340-91f0-7fe508d8a11f	psychometric	sales_dna	mid	medium	How do you prioritize high-value opportunities?	2026-02-13 10:11:10.265317+00	Score 6: ROI focus. Candidate describes their "Ideal Customer Profile" and why they walk away from small, low-margin deals to focus on big wins.
3b080bde-cfef-4d35-a022-b26f1f630990	psychometric	sales_dna	mid	medium	Tell me about adapting strategy mid-cycle.	2026-02-13 10:11:10.265317+00	Score 6: Tactical agility. Candidate describes noticing a change in the market and pivoting their talk-track or offer to stay competitive.
d3799966-2130-4573-adc7-535be98823c5	psychometric	sales_dna	mid	medium	Describe maintaining resilience in volatile markets.	2026-02-13 10:11:10.265317+00	Score 6: Emotional stability. Candidate shows they don't panic during market dips but focus on where the "pockets of value" still exist.
9bbd908d-f1d2-49e8-8ef9-5ac956c82540	psychometric	sales_dna	mid	medium	How do you differentiate yourself from competitors?	2026-02-13 10:11:10.265317+00	Score 6: Value-prop mastery. Candidate describes selling the "Unique Outcome" the client gets, making price a secondary consideration.
9b2ba504-5383-42a1-b95a-5e55ad8d9381	psychometric	sales_dna	mid	medium	Tell me about managing long and uncertain deal cycles.	2026-02-13 10:11:10.265317+00	Score 6: Endurance influence. Candidate describes "Multi-threading"ÔÇöbuilding relationships with 3+ people in the client company to ensure the deal survives.
b864b5c1-0898-4fb9-b9d4-c16a49d3e413	psychometric	sales_dna	mid	hard	Tell me about turning around a declining territory or segment.	2026-02-13 10:11:10.265317+00	Score 6: Territory leadership. Candidate explains the systemic fixes (messaging, outreach, activity) they used to bring a failing segment back to growth.
6e663827-2c3b-4cae-ae04-5cbc872745a9	psychometric	sales_dna	mid	hard	Describe managing sustained rejection without performance drop.	2026-02-13 10:11:10.265317+00	Score 6: Professional detachment. Candidate describes viewing each "No" as one step closer to a "Yes," maintaining the exact same energy for months.
59e82375-ff31-4d4d-8fce-85e8bf3497b0	psychometric	sales_dna	mid	hard	How do you sustain confidence under extreme performance pressure?	2026-02-13 10:11:10.265317+00	Score 6: Logic-over-Fear. Candidate manages their own state by focusing on their verified "activity ratios" rather than the mounting pressure.
99486f8f-7721-483d-b1b5-01fbeebf7de8	psychometric	sales_dna	mid	hard	Tell me about leading high-stakes negotiations.	2026-02-13 10:11:10.265317+00	Score 6: Master negotiator. Candidate describes the "walk-away point," the trade-offs, and the specific moment they moved the client from "interest" to "commitment."
f282df9a-fb38-43c0-8103-d59ec368fe3d	psychometric	sales_dna	mid	hard	Describe navigating aggressive competitive environments.	2026-02-13 10:11:10.265317+00	Score 6: Competitive IQ. Candidate shows how they used a competitor's aggressive price-cutting as a reason to highlight their own superior "total cost of ownership."
15f21b09-92a8-4bdb-8cd1-76e14f4faf35	psychometric	sales_dna	mid	hard	How do you maintain emotional control in tense negotiations?	2026-02-13 10:11:10.265317+00	Score 6: Tactical silence. Candidate describes using silence and de-escalation language to regain control of a room during a conflict.
c171f9cd-1e97-4821-bf5b-5742f582e6e1	psychometric	sales_dna	mid	hard	Tell me about strategically upselling or cross-selling.	2026-02-13 10:11:10.265317+00	Score 6: Relationship expansion. Candidate describes finding a new pain point in an *existing* happy client and building a new case for more revenue.
57bc0fe8-f202-4179-a35c-acb7fccffd52	psychometric	sales_dna	mid	hard	Describe balancing short-term wins with long-term account value.	2026-02-13 10:11:10.265317+00	Score 6: Strategic integrity. Candidate shows they would rather lose a small deal today than compromise the client's trust for a major deal next year.
b555c56a-43ff-4d47-bdbc-2da09035fdd3	psychometric	sales_dna	mid	hard	How do you maintain accountability for pipeline gaps?	2026-02-13 10:11:10.265317+00	Score 6: Ownership. Candidate admits when they took their "foot off the gas" and describes the massive volume of activity they initiated to fix the gap.
126b135e-3b50-4416-9fee-55c3b6a3d010	psychometric	sales_dna	mid	hard	Tell me about your toughest revenue turnaround.	2026-02-13 10:11:10.265317+00	Score 6: Grit-led success. A story of a "lost cause" client or territory that they rebuilt through pure persistence and a total strategy redesign.
d12563e6-c3b8-4499-9917-c6fc650a6de2	psychometric	burnout_risk	senior	low	Tell me about handling leadership-related pressure.	2026-02-13 10:13:31.420347+00	Score 6: Perspective and composure. Candidate describes viewing pressure as a function of the role and uses professional detachment to stay objective.
4531a306-ae40-4b8b-8f0e-579921e0ca55	psychometric	burnout_risk	senior	low	Describe managing workload complexity.	2026-02-13 10:13:31.420347+00	Score 6: Strategic prioritization. Candidate explains how they categorize tasks by ROI and impact, delegating or deferring low-value complexity.
af9cfab1-2e26-40e6-ac1c-758d21074bd9	psychometric	burnout_risk	senior	low	How do you maintain energy during extended projects?	2026-02-13 10:13:31.420347+00	Score 6: Pacing logic. Candidate describes breaking long-term initiatives into "energy phases" and building in recovery windows to prevent depletion.
bdbd8066-0e6a-40c8-968d-ce347c637dad	psychometric	burnout_risk	senior	low	Tell me about balancing strategy and execution.	2026-02-13 10:13:31.420347+00	Score 6: Balanced workflow. Candidate shows they protect "thinking time" for strategy while maintaining systems for execution oversight.
37242abc-153e-465e-953f-f454c6ba2dad	psychometric	burnout_risk	senior	low	Describe coping with accountability stress.	2026-02-13 10:13:31.420347+00	Score 6: Ownership maturity. Candidate views accountability as a professional standard and uses data/processes to ensure outcomes rather than worrying.
c33c2906-ccad-4822-b73e-d63c4b53288b	psychometric	burnout_risk	senior	low	How do you manage fatigue during continuous demand cycles?	2026-02-13 10:13:31.420347+00	Score 6: Structural resilience. Candidate describes a specific lifestyle or professional system (e.g., deep-work blocks) that makes constant demand manageable.
c0df5c10-9a49-4699-be1c-0a3e73a2eebd	psychometric	burnout_risk	senior	low	Tell me about staying composed under responsibility.	2026-02-13 10:13:31.420347+00	Score 6: Emotional stability. Candidate shares a technique for maintaining a "steady hand" for their team even when metrics are under pressure.
7e71d916-d70e-47a1-a849-897c6f3520d7	psychometric	burnout_risk	senior	low	Describe maintaining performance consistency.	2026-02-13 10:13:31.420347+00	Score 6: Process-driven output. Candidate relies on robust professional habits and standard operating procedures rather than fluctuating motivation.
9a3e11d4-0243-46b7-8ede-846e4c0ee4cd	psychometric	burnout_risk	senior	low	How do you recover from high-demand quarters?	2026-02-13 10:13:31.420347+00	Score 6: Strategic reset. Candidate describes a formal "debrief and recharge" process that clears the mental slate for the next cycle.
b0b1c618-17bf-4962-9894-91b5686995af	psychometric	burnout_risk	senior	low	Tell me about balancing professional intensity with personal life.	2026-02-13 10:13:31.420347+00	Score 6: Boundary leadership. Candidate explains how they set clear expectations with both family and work stakeholders to maintain a high-performance lifestyle.
23ef64f6-b876-4702-b140-370340103cd9	psychometric	burnout_risk	senior	medium	Tell me about decision fatigue during high-responsibility periods.	2026-02-13 10:13:31.420347+00	Score 6: Cognitive management. Candidate identifies when their decision quality is dropping and uses "pre-decided rules" or sleep-proxies to mitigate risk.
9ed14cc8-b6fe-4968-a56a-16bf06b0b005	psychometric	burnout_risk	senior	medium	Describe managing emotional exhaustion while leading others.	2026-02-13 10:13:31.420347+00	Score 6: EQ and role-modeling. Candidate describes setting healthy emotional boundaries to stay supportive of others without absorbing their stress.
c086c1ac-3f8e-43d1-9c3b-41e76f8dab19	psychometric	burnout_risk	senior	medium	How do you prevent stress from impacting leadership effectiveness?	2026-02-13 10:13:31.420347+00	Score 6: Shielding logic. Candidate explains how they process their own stress privately to ensure their team sees a calm, logical version of leadership.
dbb86a46-3cb2-4701-a81a-5290f1a25bec	psychometric	burnout_risk	senior	medium	Tell me about handling cumulative accountability.	2026-02-13 10:13:31.420347+00	Score 6: Scaling shoulders. Candidate describes the transition of being responsible for many people/outcomes and how they upgraded their mental "RAM" to handle the load.
a288596d-89ed-4c33-9849-722ba869d76b	psychometric	burnout_risk	senior	medium	Describe maintaining clarity under complexity.	2026-02-13 10:13:31.420347+00	Score 6: Simplification skill. Candidate describes using frameworks or models to strip away noise and focus on the "lead indicators" that matter most.
dba8978d-536b-4e87-b5e9-859959eddbba	psychometric	burnout_risk	senior	medium	How do you sustain resilience across multiple years of pressure?	2026-02-13 10:13:31.420347+00	Score 6: Longitudinal health. Candidate shares a multi-year philosophy on career longevity, treating themselves as a "high-performance asset" that requires maintenance.
f3b60d5a-8cc4-4ae3-8e73-c50b50c1c835	psychometric	burnout_risk	senior	medium	Tell me about navigating prolonged organizational change.	2026-02-13 10:13:31.420347+00	Score 6: Change endurance. Candidate describes keeping themselves (and others) focused on the long-term mission even when the mid-term path is chaotic.
91496c62-3fc5-404b-bbdf-77e0ccd8ddbc	psychometric	burnout_risk	senior	medium	Describe managing performance expectations from multiple stakeholders.	2026-02-13 10:13:31.420347+00	Score 6: Conflict orchestration. Candidate describes aligning diverse stakeholders to a single reality, preventing the "pulling in ten directions" fatigue.
fc74fc9e-9ebc-41c0-b067-ce08ff4f31ec	psychometric	burnout_risk	senior	medium	How do you protect engagement during strategic transitions?	2026-02-13 10:13:31.420347+00	Score 6: Mission re-alignment. Candidate describes finding the "New Value" in a transition to stay personally excited and professionally committed.
f8e1b1b1-86cb-455e-bb84-f57a88ae51c9	psychometric	burnout_risk	senior	medium	Tell me about stress affecting long-term motivation.	2026-02-13 10:13:31.420347+00	Score 6: Self-correction. Candidate describes a time motivation dipped and the specific "values-audit" they performed to reconnect to their career purpose.
8088e0f9-d798-4112-b31b-fbc57ed9734b	psychometric	burnout_risk	senior	hard	Tell me about emotional detachment as a coping mechanism.	2026-02-13 10:13:31.420347+00	Score 6: Professional stoicism. Candidate explains how to use objectivity to protect peace of mind without losing empathy or operational care.
42b98ec0-7e44-47a9-a839-2e2e1f56b821	psychometric	burnout_risk	senior	hard	Describe managing chronic burnout symptoms.	2026-02-13 10:13:31.420347+00	Score 6: radical intervention. Candidate describes recognizing deep signs of exhaustion and making a high-stakes change (e.g., sabbatical or role-restructure) to save their career.
e218aacf-0d7b-417e-9b52-282ac80f821c	psychometric	burnout_risk	senior	hard	How do you sustain leadership under sustained strain?	2026-02-13 10:13:31.420347+00	Score 6: Endurance leadership. Candidate shares their system for leading a team through a multi-month or multi-year "siege" without breaking the culture or themselves.
3716a0ac-c839-42dc-b746-bed626f3d66b	psychometric	burnout_risk	senior	hard	Tell me about pressure impacting career satisfaction.	2026-02-13 10:13:31.420347+00	Score 6: Philosophical maturity. Candidate shows they can differentiate between "hard days" and a "wrong career," using pressure as data for better alignment.
0af7f734-a220-4248-be39-5cc844961814	psychometric	burnout_risk	senior	hard	Describe recovering from extended exhaustion cycles.	2026-02-13 10:13:31.420347+00	Score 6: Deep recovery. Candidate describes the "re-entry" process after burnoutÔÇölearning to work with a new set of sustainable boundaries.
dec1b9db-613c-4ae5-9fc6-a3e35bb1e955	psychometric	burnout_risk	senior	hard	How do you prevent cumulative stress from reducing effectiveness?	2026-02-13 10:13:31.420347+00	Score 6: Systems upgrade. Candidate describes a moment they realized "old ways" wouldn't work at their new level of stress and the structural upgrade they made to their workflow.
838305af-7e54-4fc9-a808-ea74e8f654f8	psychometric	burnout_risk	senior	hard	Tell me about the most exhausting phase of your mid-career.	2026-02-13 10:13:31.420347+00	Score 6: Grit and Growth. Candidate shares a "war story" where they pushed TO the limit, survived, and built a better system to ensure they never have to push that way again.
4622eb53-1e32-426e-937f-fabd1b539531	psychometric	burnout_risk	senior	hard	Describe balancing ambition with well-being.	2026-02-13 10:13:31.420347+00	Score 6: Optimal performance logic. Candidate argues that well-being *is* the fuel for ambition, not an alternative to it, and provides evidence of this balance.
ce6eb613-b660-47c6-a733-1c9a71706426	psychometric	burnout_risk	senior	hard	How do you manage persistent high expectations?	2026-02-13 10:13:31.420347+00	Score 6: Expectation management. Candidate describes defining "what success looks like" clearly with leadership to ensure expectations remain challenging but grounded in reality.
1d81b19e-7a62-47e5-9997-9007038a8945	psychometric	burnout_risk	senior	hard	Tell me about safeguarding long-term resilience.	2026-02-13 10:13:31.420347+00	Score 6: Future-proofing health. Candidate describes their "Board of Directors"ÔÇömentors, routines, and habitsÔÇöthat protect their professional longevity.
79c30dcc-97ff-4489-ae83-0345c9112c3d	psychometric	growth_potential	senior	low	Tell me about expanding into broader responsibilities.	2026-02-13 10:13:31.420347+00	Score 6: Generalist evolution. Candidate describes moving from "Doing" to "Overseeing," showing a desire to understand the whole business engine.
2e37d2b0-316a-4f13-988b-7ef6b3667ada	psychometric	growth_potential	senior	low	Describe strengthening leadership capabilities.	2026-02-13 10:13:31.420347+00	Score 6: Deliberate practice. Candidate identifies a specific leadership soft-skill (e.g., coaching) and describes the intentional steps they took to master it.
ba4ba3bf-a876-45a7-b9c3-e140d69c27da	psychometric	growth_potential	senior	low	How do you adapt to evolving strategic expectations?	2026-02-13 10:13:31.420347+00	Score 6: Strategic agility. Candidate describes greeting a shift in business direction with curiosity and immediate tactical adjustment.
edd318b4-ba52-4961-b9d4-beb711ee8696	psychometric	growth_potential	senior	low	Tell me about investing in professional development.	2026-02-13 10:13:31.420347+00	Score 6: ROI-based learning. Candidate explains how they choose what to learn based on where the market is going, not just curiosity.
b49561a5-ace1-47d7-a2a8-fab1ba3f63d3	psychometric	growth_potential	senior	low	Describe learning from challenging assignments.	2026-02-13 10:13:31.420347+00	Score 6: Post-mortem logic. Candidate shows they extract the "Universal Principles" from a hard project to use in all future scenarios.
d0541307-9e91-4fc5-8c69-98456a67eb67	psychometric	growth_potential	senior	low	How do you balance execution with skill-building?	2026-02-13 10:13:31.420347+00	Score 6: Integrated growth. Candidate describes "learning on the job"ÔÇöturning everyday puzzles into opportunities to research better methods.
7d07803d-482a-431b-b594-9bd37aa47afe	psychometric	growth_potential	senior	low	Tell me about developing domain authority.	2026-02-13 10:13:31.420347+00	Score 6: Thought leadership. Candidate describes sharing their knowledge (via mentoring, writing, or speaking) to solidify their own expertise.
8b5a2d89-3cd9-4abd-86b0-9df7797039dd	psychometric	growth_potential	senior	low	Describe improving through peer feedback.	2026-02-13 10:13:31.420347+00	Score 6: Vulnerability as a tool. Candidate shares a moment a peer pointed out a blind spot and how they "fixed the engine" of their professional behavior.
9ce3ed56-6b2d-4e86-a470-0d090543acd0	psychometric	growth_potential	senior	low	How do you remain growth-oriented mid-career?	2026-02-13 10:13:31.420347+00	Score 6: Combatting stagnation. Candidate describes their plan to avoid the "Comfort Zone" by constantly seeking mentors who are 2 levels above them.
4c5b7bd7-365c-4645-bc16-d9dc9fb3548a	psychometric	growth_potential	senior	low	Tell me about broadening your impact.	2026-02-13 10:13:31.420347+00	Score 6: Multiplier effect. Candidate describes moving from personal wins to "Team Wins" or "Department Wins" as their primary metric of growth.
037c75f1-4a53-4f2a-9c5d-0bce928aff5e	psychometric	growth_potential	senior	medium	Tell me about transitioning from operational to strategic roles.	2026-02-13 10:13:31.420347+00	Score 6: Cognitive shift. Candidate explains the difficulty of letting go of the "details" to focus on the "directions" and how they mastered that transition.
0f4ce03c-51e1-4e31-bd61-c1188ede931b	psychometric	growth_potential	senior	medium	Describe developing cross-functional leadership skills.	2026-02-13 10:13:31.420347+00	Score 6: Matrix influence. Candidate describes learning the "languages" of other departments (Sales, Product, Finance) to lead without formal authority.
7af3ce5f-c28d-4d93-8f44-49498e2f1163	psychometric	growth_potential	senior	medium	How do you identify future capability gaps?	2026-02-13 10:13:31.420347+00	Score 6: Predictive analysis. Candidate identifies a coming trend in their industry and the specific skills they are building *now* to stay relevant in 3 years.
683f16a3-9dec-4558-addc-1ba65fd6e403	psychometric	growth_potential	senior	medium	Tell me about reinventing yourself professionally.	2026-02-13 10:13:31.420347+00	Score 6: Identity agility. Candidate describes a major pivot in their career style or focus that required a complete "reset" of their professional habits.
edc75f2c-9ebd-476b-a161-e51f362ae162	psychometric	growth_potential	senior	medium	Describe navigating complexity to enhance competence.	2026-02-13 10:13:31.420347+00	Score 6: Complexity mastery. Candidate describes a project so complex it "forced" them to develop a new level of mental organization and leadership.
b8f6b593-1747-4bf0-af8b-1b1216942a39	psychometric	growth_potential	senior	medium	How do you foster innovation in your own growth?	2026-02-13 10:13:31.420347+00	Score 6: Experimental mindset. Candidate describes trying out new tools or methodologies in a low-stakes environment to see what works before adopting them.
39d11d64-b1b1-4d9b-a799-7ba14ba3c631	psychometric	growth_potential	senior	medium	Tell me about learning during high-pressure phases.	2026-02-13 10:13:31.420347+00	Score 6: Under-fire growth. Candidate shows they can acquire a new skill *while* delivery is at its peak, using need as the mother of invention.
1b013ca9-5f7a-4486-85f5-017db01e0c49	psychometric	growth_potential	senior	medium	Describe preparing for senior leadership responsibilities.	2026-02-13 10:13:31.420347+00	Score 6: Succession preparedness. Candidate describes shadowing leaders or taking on "Acting" roles to test their readiness for the next level.
72b7062d-943c-40a8-853e-855fbfbad68f	psychometric	growth_potential	senior	medium	How do you ensure continuous adaptability?	2026-02-13 10:13:31.420347+00	Score 6: Curiosity habit. Candidate treats "being wrong" as an opportunity to update their internal model, rather than a failure.
a7c1bb66-c765-403d-9532-6f05c4277cf4	psychometric	growth_potential	senior	medium	Tell me about aligning growth with long-term organizational vision.	2026-02-13 10:13:31.420347+00	Score 6: Enterprise alignment. Candidate shows they grow in ways that make the *company* more valuable, not just their own resume.
71455f70-82d4-4840-98f9-7c2d6390ad44	psychometric	growth_potential	senior	hard	Tell me about redefining your professional identity mid-career.	2026-02-13 10:13:31.420347+00	Score 6: Core transformation. Candidate describes moving from "The Specialist" to "The Visionary," and the psychological work required to change their self-image.
75faf44c-34b3-4984-a1c5-6d08c2f83d63	psychometric	growth_potential	senior	hard	Describe leading transformation while upgrading your own skills.	2026-02-13 10:13:31.420347+00	Score 6: Dual-track leadership. A story of overhauling a team/process *while* simultaneously learning the tech or strategy needed to do it.
8a191d4f-d366-453b-b0cf-347c5a3d2f9b	psychometric	growth_potential	senior	hard	How do you future-proof your leadership capabilities?	2026-02-13 10:13:31.420347+00	Score 6: Antifragile growth. Candidate builds skills that are valuable *across* industriesÔÇölike AI integration, emotional intelligence, or complex system design.
b17080a5-4e20-4090-bff9-29818ecbfd0c	psychometric	growth_potential	senior	hard	Tell me about navigating growth in uncertain environments.	2026-02-13 10:13:31.420347+00	Score 6: Uncertainty logic. Candidate describes growing by *embracing* chaosÔÇötaking on the projects nobody else wants because that's where the learning is.
e64f6c75-ccad-42af-9257-86a836eb9e57	psychometric	growth_potential	senior	hard	Describe building succession-ready competencies.	2026-02-13 10:13:31.420347+00	Score 6: Legacy focus. Candidate believes growth isn't complete until they have trained someone else to do their job better than they can.
47d001ec-4238-41c3-959e-cde19e24a759	psychometric	growth_potential	senior	hard	How do you maintain learning agility despite experience?	2026-02-13 10:13:31.420347+00	Score 6: Beginner's mind. Candidate describes how they intentionally "empty the cup" to learn a new trend from a junior colleague or a fresh source.
d3287931-3d92-4538-bda8-2cc0cbd1181c	psychometric	growth_potential	senior	hard	Tell me about evolving from specialist to strategic leader.	2026-02-13 10:13:31.420347+00	Score 6: Vertical leap. Candidate explains the moment they realized their "technical brilliance" was a bottleneck and shifted to "strategic enablement."
1779f184-3e72-4027-bfce-d65553b56299	psychometric	growth_potential	senior	hard	Describe managing stagnation risk proactively.	2026-02-13 10:13:31.420347+00	Score 6: Defensive growth. Candidate describes their "Stagnation Alarm"ÔÇöthe metrics they track to know if they have been in one place too long.
568a3cc2-3435-4461-b348-f6455a21165a	psychometric	growth_potential	senior	hard	How do you balance mastery with reinvention?	2026-02-13 10:13:31.420347+00	Score 6: Dynamic equilibrium. Candidate describes how they harvest the fruits of their mastery while simultaneously planting the seeds of their next reinvention.
859f950d-ca62-48f2-b2b2-3da614f5880e	psychometric	growth_potential	senior	hard	Tell me about your most significant growth pivot.	2026-02-13 10:13:31.420347+00	Score 6: Radical redirection. A story of a "clean break" from a comfortable path into a new, harder, but ultimately higher-ceiling opportunity.
9fd9a300-1661-4825-a6d1-6b4734798865	psychometric	sales_dna	senior	low	Tell me about managing key accounts successfully.	2026-02-13 10:13:31.420347+00	Score 6: Portfolio management. Candidate describes a system for "Account Health" that looks at revenue, advocacy, and future growth opportunities.
c8f20f76-d7cb-4c63-bc62-2c6ccfea4001	psychometric	sales_dna	senior	low	Describe mentoring junior sales team members.	2026-02-13 10:13:31.420347+00	Score 6: Force multiplier. Candidate shows they can break down their "intuitive" skills into teachable processes for the next generation.
1222f6ef-fb0a-4654-baaf-9f19d1f446e7	psychometric	sales_dna	senior	low	How do you maintain performance consistency over years?	2026-02-13 10:13:31.420347+00	Score 6: Discipline over Talent. Candidate attributes their long-term success to a rigid sales daily-discipline rather than "lightning strikes."
dea78726-786a-4419-8fe3-1ba43398eb44	psychometric	sales_dna	senior	low	Tell me about handling high-value clients.	2026-02-13 10:13:31.420347+00	Score 6: High-stakes composure. Candidate treats $1M deals with the same process-rigor as $10k deals, refusing to let the numbers cloud their judgment.
afdb4d5a-a16b-47b1-a0fe-cadf8eb44544	psychometric	sales_dna	senior	low	Describe adapting to evolving customer expectations.	2026-02-13 10:13:31.420347+00	Score 6: Customer-centric agility. Candidate describes "listening for the change" and updating their value-proposition before the client even realizes they need it.
1ce28104-0130-412c-bc4b-0b29b4571219	psychometric	sales_dna	senior	low	How do you manage pressure from revenue goals?	2026-02-13 10:13:31.420347+00	Score 6: Data-led calm. Candidate manages pressure by looking at their "Sales Funnel Math"ÔÇöknowing that if they hit the inputs, the output is inevitable.
29113a7e-8dbf-430a-a8c3-c4b2c817c8db	psychometric	sales_dna	senior	low	Tell me about building strategic client partnerships.	2026-02-13 10:13:31.420347+00	Score 6: Trusted advisor. Candidate describes being invited into the client's "inner circle" for planning, showing they are seen as a business partner, not a vendor.
126f21b9-0ba1-41a1-bed1-10dfc33f5d63	psychometric	sales_dna	senior	low	Describe responding to increased competition.	2026-02-13 10:13:31.420347+00	Score 6: Differentiation logic. Candidate describes leaning into their "Unique Moat" rather than entering a race-to-the-bottom on price.
0486895b-f6fe-4721-ad6e-5a951bd26b7c	psychometric	sales_dna	senior	low	How do you maintain motivation after years in sales?	2026-02-13 10:13:31.420347+00	Score 6: Mastery motivation. Candidate finds joy in the *craft*ÔÇöthe subtle psychology and complex negotiationÔÇörather than just the commission check.
c806af07-de7c-4406-bd20-9fbb18dcac8b	psychometric	sales_dna	senior	low	Tell me about sustaining credibility in your market.	2026-02-13 10:13:31.420347+00	Score 6: Reputation management. Candidate describes a long-term approach where they would rather lose a deal than compromise their integrity/reputation.
52f352a5-8e1d-4b3a-a6dd-77d11013e8b2	psychometric	sales_dna	senior	medium	Tell me about managing enterprise-level negotiations.	2026-02-13 10:13:31.420347+00	Score 6: Complexity orchestration. Candidate describes managing a 6-month negotiation with Legal, Procurement, IT, and Finance, keeping all aligned.
65a36fcd-884e-4127-a1ac-b8c7680f4ea5	psychometric	sales_dna	senior	medium	Describe influencing C-level decision-makers.	2026-02-13 10:13:31.420347+00	Score 6: Executive presence. Candidate describes speaking the language of "Risk, Growth, and ROI" to earn the respect of a CEO or CFO.
60f7064a-d96d-4960-8445-dacbbdf581f5	psychometric	sales_dna	senior	medium	How do you align sales strategy with organizational goals?	2026-02-13 10:13:31.420347+00	Score 6: Strategic synergy. Candidate shows they don't just chase revenue, but the *right* revenue that fits the company's long-term product roadmap.
fd2e7016-0f9c-4165-8099-6ad6f54929a8	psychometric	sales_dna	senior	medium	Tell me about handling long enterprise sales cycles.	2026-02-13 10:13:31.420347+00	Score 6: Momentum maintenance. Candidate describes the "mid-cycle check-ins" and mini-wins used to keep a 12-month deal from stalling.
a945ce8b-3dca-4baf-a2ed-ec3a0f8469cc	psychometric	sales_dna	senior	medium	Describe leading by example in target-driven environments.	2026-02-13 10:13:31.420347+00	Score 6: Cultural leadership. Candidate describes how their work ethic and transparent methodology set the standard for the rest of the sales floor.
4d3daa96-e719-4cf0-b02e-adc5e60e63f7	psychometric	sales_dna	senior	medium	How do you maintain resilience during industry downturns?	2026-02-13 10:13:31.420347+00	Score 6: Adaptability. Candidate describes "turning the ship" to target recession-proof industries or pivoting the message to "Efficiency" rather than "Growth."
d2c24fdf-02ca-4647-8ff7-09ddee7a45d8	psychometric	sales_dna	senior	medium	Tell me about repositioning value during price objections.	2026-02-13 10:13:31.420347+00	Score 6: Value-to-Cost ratio. Candidate flips the price objection by calculating the "Cost of Inaction" for the clientÔÇömaking the price look cheap by comparison.
22318276-c88f-4e74-9b69-72ce8af1e801	psychometric	sales_dna	senior	medium	Describe balancing relationship depth with revenue accountability.	2026-02-13 10:13:31.420347+00	Score 6: Professional boundaries. Candidate shows they can maintain a deep relationship while still being firm on "Closing" and "Contract terms."
e2d6b15b-c081-4dee-acc6-5f4239145bf7	psychometric	sales_dna	senior	medium	How do you handle complex multi-layered objections?	2026-02-13 10:13:31.420347+00	Score 6: Systematic deconstruction. Candidate describes breaking a "No" into its component parts (Technical, Financial, Political) and solving each one individually.
65adcd7d-488f-41d7-b32e-271dcfd75916	psychometric	sales_dna	senior	medium	Tell me about adapting to market disruptions.	2026-02-13 10:13:31.420347+00	Score 6: Trend exploitation. Candidate identifies a disruption (like AI or a new regulation) and describes how they used it as a "New Hook" for their sales outreach.
7b71ca7a-b2ef-4b77-8241-80c1c1a35afe	psychometric	sales_dna	senior	hard	Tell me about rebuilding revenue after a major market shift.	2026-02-13 10:13:31.420347+00	Score 6: Strategic turnaround. A story of a territory that "died" due to market changes and how they rebuilt the pipeline from zero with a new strategy.
93a2c1da-5077-4be2-ad82-a5ad16b5c65f	psychometric	sales_dna	senior	hard	Describe leading large-scale sales transformations.	2026-02-13 10:13:31.420347+00	Score 6: Change management. Candidate describes moving a whole team/region from "Order Taking" to "Consultative Selling" and the friction they overcame.
be51d43b-8339-49db-a1af-bf7c5a55438d	psychometric	sales_dna	senior	hard	How do you sustain drive despite long-term pressure?	2026-02-13 10:13:31.420347+00	Score 6: Intrinsic fire. Candidate describes a "Why" that is bigger than moneyÔÇösuch as building a legacy or truly solving client problems.
04593785-0461-4cae-8fc3-30d1c2452323	psychometric	sales_dna	senior	hard	Tell me about influencing strategic partnerships.	2026-02-13 10:13:31.420347+00	Score 6: Ecosystem selling. Candidate describes building an alliance with a partner company to create a "2+2=5" offering for a major enterprise.
d728ee06-2936-467a-ad40-7bf44c6fb5c5	psychometric	sales_dna	senior	hard	Describe managing reputation during revenue setbacks.	2026-02-13 10:13:31.420347+00	Score 6: Integrity under fire. Candidate describes a time they missed a target but kept the trust of their clients and leadership through total transparency.
68543cea-c0e3-41ed-ad04-a912a28fce13	psychometric	sales_dna	senior	hard	How do you navigate high-risk, high-reward deals?	2026-02-13 10:13:31.420347+00	Score 6: Risk mitigation. Candidate describes the "Safety Nets" they build into a "whale" deal to ensure that even if it fails, the business survives.
74a3f763-db51-43b5-aa7d-30319545037d	psychometric	sales_dna	senior	hard	Tell me about creating demand in saturated markets.	2026-02-13 10:13:31.420347+00	Score 6: Blue Ocean thinking. Candidate describes finding a "hidden niche" or a "new angle" in a market where everyone already has a solution.
414b6930-1dc7-44a5-88ae-540b922ca0c5	psychometric	sales_dna	senior	hard	Describe sustaining elite performance across multiple cycles.	2026-02-13 10:13:31.420347+00	Score 6: Mastery endurance. Candidate describes the "Maintenance Mode" of an elite salesperson who stays at the top of the leaderboard for 5+ years straight.
8bba713f-ebfd-40da-85f2-58ad80b66e71	psychometric	sales_dna	senior	hard	How do you prevent burnout in high-intensity sales roles?	2026-02-13 10:13:31.420347+00	Score 6: Professional sustainability. Candidate share their "Sales Life" philosophyÔÇöhow they work intensely for 45 mins then check out, protecting their mental energy.
d5394ad4-a953-4407-8243-df3a92ebaaaf	psychometric	sales_dna	senior	hard	Tell me about your most challenging strategic win.	2026-02-13 10:13:31.420347+00	Score 6: Masterclass in Influence. A story of a "Lost Cause" client where they used 12 months of strategy, patience, and logic to finally close the deal.
4b309ca7-e191-443e-b230-55dfb1db58a3	psychometric	burnout_risk	leadership	low	Tell me about sustaining energy across long-term responsibilities.	2026-02-13 10:18:59.796689+00	Score 6: Masterful pacing. Candidate describes energy as a strategic resource managed through delegation, discipline, and intentional recovery cycles.
8d80a5d2-c16f-4697-be75-e5e8434fea67	psychometric	burnout_risk	leadership	low	Describe handling pressure at senior levels.	2026-02-13 10:18:59.796689+00	Score 6: Executive composure. Candidate views pressure as a systemic constant and explains techniques for maintaining personal and team stability under fire.
1cb1629b-19c7-434e-820a-4086adcb0c42	psychometric	burnout_risk	leadership	low	How do you maintain balance under high accountability?	2026-02-13 10:18:59.796689+00	Score 6: Integrated life-design. Candidate describes clear boundaries and prioritizes well-being as a requirement for high-level decision making.
93ffd403-e41b-466f-bcd6-86ac8bf9beab	psychometric	burnout_risk	leadership	low	Tell me about managing fatigue over time.	2026-02-13 10:18:59.796689+00	Score 6: Longitudinal health mindset. Candidate describes proactive monitoring of their mental and physical energy to prevent "slow-leak" exhaustion.
dc5c8d71-2b09-409c-ba95-b68373b60f60	psychometric	burnout_risk	leadership	low	Describe coping with organizational demands.	2026-02-13 10:18:59.796689+00	Score 6: Strategic filter. Candidate explains how they distinguish between "urgent noise" and "critical impact" to protect their mental bandwidth.
2b25f576-e655-4ae0-b048-eb71054483c1	psychometric	burnout_risk	leadership	low	How do you stay engaged after years of responsibility?	2026-02-13 10:18:59.796689+00	Score 6: Mission-driven persistence. Candidate connects their daily effort to a legacy or long-term vision that keeps the work intrinsically meaningful.
cdfaa559-be34-4c37-9d23-0bc4a550b2fc	psychometric	burnout_risk	leadership	low	Tell me about managing leadership stress.	2026-02-13 10:18:59.796689+00	Score 6: Role-modeling resilience. Candidate describes processing stress in a way that doesn't leak into the organization, maintaining a calm environment.
48b941e2-97ea-435e-9dda-7ac09ce57938	psychometric	burnout_risk	leadership	low	Describe maintaining clarity during complex decisions.	2026-02-13 10:18:59.796689+00	Score 6: Mental simplification. Candidate uses frameworks or advisors to strip away noise and focus on the fundamental logic of the decision.
7b730d90-440a-4dc8-aeff-722dd721e93f	psychometric	burnout_risk	leadership	low	How do you recover after prolonged high-stakes cycles?	2026-02-13 10:18:59.796689+00	Score 6: Ritualized recovery. Candidate has a defined process for "switching off"ÔÇöensuring deep rest to return with full cognitive capacity.
25543822-c9bd-4d95-9925-776704855e06	psychometric	burnout_risk	leadership	low	Tell me about balancing legacy and performance expectations.	2026-02-13 10:18:59.796689+00	Score 6: Sage perspective. Candidate shows they can deliver current results without compromising the long-term health or culture of the organization.
729ad456-bba9-4d1c-92f0-76b72e6220ec	psychometric	burnout_risk	leadership	medium	Tell me about cumulative stress across your career.	2026-02-13 10:18:59.796689+00	Score 6: Narrative wisdom. Candidate describes how they learned from past stress-peaks to build a "resilience engine" that handles 10x the load today.
4570a895-6d1c-4001-a9d7-3746ea43cb75	psychometric	burnout_risk	leadership	medium	Describe navigating emotional resilience fluctuations.	2026-02-13 10:18:59.796689+00	Score 6: EQ self-governance. Candidate recognizes their own emotional "weather" and adjusts their leadership intensity or visibility accordingly.
7ae22ce3-1a5e-489d-8829-4c58d001d8d1	psychometric	burnout_risk	leadership	medium	How do you prevent accountability from becoming isolating?	2026-02-13 10:18:59.796689+00	Score 6: Mentorship and peer networks. Candidate describes building a "safe harbor" of peers or mentors to share the mental load of top-level responsibility.
9b5d0f4b-2a5b-4d03-ab3a-65df3f784c9c	psychometric	burnout_risk	leadership	medium	Tell me about managing sustained strategic pressure.	2026-02-13 10:18:59.796689+00	Score 6: Endurance logic. Candidate describes viewing strategy as a marathon, using data and small wins to maintain momentum through years-long projects.
6f77b114-0ed9-4cea-adff-6fca82999e30	psychometric	burnout_risk	leadership	medium	Describe maintaining enthusiasm after decades of performance.	2026-02-13 10:18:59.796689+00	Score 6: Constant reinvention. Candidate stays fresh by seeking new problems to solve or new technologies to master, preventing role-stagnation.
d047d1d9-ddaf-49f2-9d36-a9936d01d334	psychometric	burnout_risk	leadership	medium	How do you protect well-being under long-term expectations?	2026-02-13 10:18:59.796689+00	Score 6: Sustainable high-performance. Candidate argues that well-being is the *enabler* of expectations, showing evidence of a balanced lifestyle.
d0ed87af-a86a-4bc0-b36a-22c187ac9ccd	psychometric	burnout_risk	leadership	medium	Tell me about handling decision fatigue at senior levels.	2026-02-13 10:18:59.796689+00	Score 6: Decision architecture. Candidate limits low-stakes decisions (delegation) to save their cognitive energy for the 5-10 choices that define the year.
8c5950ed-f5d4-4c86-b486-aceceb03e98e	psychometric	burnout_risk	leadership	medium	Describe staying adaptable despite accumulated stress.	2026-02-13 10:18:59.796689+00	Score 6: Anti-fragility. Candidate shows how stress has made them *more* adaptable, using past crises as a library of responses for new challenges.
365157fd-1919-44bc-98f4-56fab762e745	psychometric	burnout_risk	leadership	medium	How do you maintain engagement in high-responsibility roles?	2026-02-13 10:18:59.796689+00	Score 6: Multiplier mindset. Candidate finds engagement in seeing their *organization* grow, moving beyond personal ego toward collective success.
b570b23d-d169-4f80-a39e-c476d47e4c41	psychometric	burnout_risk	leadership	medium	Tell me about managing long-term professional strain.	2026-02-13 10:18:59.796689+00	Score 6: Philosophical detachment. Candidate uses a high-level perspective to keep strain in context, preventing it from overwhelming their personal identity.
7d1f1f53-da00-4bbc-a296-461b8adbb97c	psychometric	burnout_risk	leadership	hard	Tell me about experiencing burnout at a senior stage.	2026-02-13 10:18:59.796689+00	Score 6: Radical candor and recovery. A vulnerable account of reaching the limit and the systemic changes made to their leadership philosophy to return stronger.
42067bd0-0b57-485d-b913-c562a9d0eeb5	psychometric	burnout_risk	leadership	hard	Describe handling emotional detachment from prolonged responsibility.	2026-02-13 10:18:59.796689+00	Score 6: Intentional reconnection. Candidate recognizes when they are "going on autopilot" and describes active steps to reconnect with people and purpose.
ade57d09-f79a-4953-9308-51fd5ec56d0d	psychometric	burnout_risk	leadership	hard	How do you sustain identity and purpose under continuous pressure?	2026-02-13 10:18:59.796689+00	Score 6: Core values alignment. Candidate has a "North Star" that is independent of their job title, allowing them to remain stable even when work is chaotic.
a4099909-c3a2-4145-a272-4adebd91422f	psychometric	burnout_risk	leadership	hard	Tell me about navigating chronic high-performance expectations.	2026-02-13 10:18:59.796689+00	Score 6: Expectation negotiation. Candidate describes the art of "managing up" to ensure expectations are ambitious but realistic for the organization's health.
c86ad597-0f3d-460b-96ce-973984af19b9	psychometric	burnout_risk	leadership	hard	Describe rebuilding resilience after long-term exhaustion.	2026-02-13 10:18:59.796689+00	Score 6: Structural redesign. Candidate shares a moment of exhaustion that led to a "total reboot" of their operating systemÔÇönew routines, new delegation, new mindset.
746a6116-7d5e-4f66-a1fd-b342cc3d3e21	psychometric	burnout_risk	leadership	hard	How do you prevent career fatigue from affecting strategic thinking?	2026-02-13 10:18:59.796689+00	Score 6: Cognitive conservation. Candidate describes taking "strategy retreats" or sabbaticals to refresh their vision, ensuring they don't lead from a place of depletion.
459d47fb-429c-4b57-b247-4a0401f9f877	psychometric	burnout_risk	leadership	hard	Tell me about your most challenging extended pressure cycle.	2026-02-13 10:18:59.796689+00	Score 6: Grit-led legacy. A story of a multi-year crisis (e.g., turnaround or merger) where they held the line and the personal cost they managed to pay and recover from.
a81ffe1c-c483-486d-aacc-34786f3bf000	psychometric	burnout_risk	leadership	hard	Describe coping with declining energy while maintaining standards.	2026-02-13 10:18:59.796689+00	Score 6: Efficiency mastery. Candidate describes working "less but better"ÔÇöusing their 20 years of experience to solve in 1 hour what used to take 10.
f070b914-a8bb-405c-9e91-162f13228de3	psychometric	burnout_risk	leadership	hard	How do you ensure long-term engagement despite cumulative stress?	2026-02-13 10:18:59.796689+00	Score 6: Future-oriented logic. Candidate treats the organization as a living entity they are nurturing, finding energy in the growth of the next generation of leaders.
6de1fa29-926e-49f2-890d-31187583cb0f	psychometric	burnout_risk	leadership	hard	Tell me about safeguarding well-being across decades of leadership.	2026-02-13 10:18:59.796689+00	Score 6: Holistic longevity. Candidate describes their "Life Portfolio"ÔÇöensuring health, family, and hobbies are weighted alongside career for total stability.
e2f84c1e-0a85-4de9-9437-1ccc83659a3b	psychometric	growth_potential	leadership	low	Tell me about sustaining growth across decades of experience.	2026-02-13 10:18:59.796689+00	Score 6: Compound learning. Candidate treats growth as a daily habit, describing how they integrate new information into their existing deep wisdom.
7ff1a8a2-07b9-4c8a-8b93-edb9737ffcf6	psychometric	growth_potential	leadership	low	Describe adapting to industry evolution.	2026-02-13 10:18:59.796689+00	Score 6: Trend sensitivity. Candidate describes a recent shift in their industry and exactly how they updated their mental model to stay ahead of it.
5e483b1a-cdda-45f8-bc89-1a4ca5d2d562	psychometric	growth_potential	leadership	low	How do you maintain curiosity at senior levels?	2026-02-13 10:18:59.796689+00	Score 6: Open-minded exploration. Candidate describes seeking out "anti-experience"ÔÇötalking to startups or junior explorers to challenge their own assumptions.
8d90fe7d-4c90-4e08-9411-12a0f0edfcc1	psychometric	growth_potential	leadership	low	Tell me about expanding your leadership impact.	2026-02-13 10:18:59.796689+00	Score 6: Influence expansion. Candidate describes moving from leading a function to leading an ecosystem, showing a desire to solve larger societal or industry problems.
260c1088-6c9f-4c7e-b05d-4e6e582f6eb2	psychometric	growth_potential	leadership	low	Describe investing in long-term capability building.	2026-02-13 10:18:59.796689+00	Score 6: Strategic upskilling. Candidate identifies a skill (e.g., AI ethics or Geopolitics) they are building *now* for relevance in the 2030s.
70dc78a2-6705-490a-a0d5-ee2c5d1662c5	psychometric	growth_potential	leadership	low	How do you remain relevant in changing markets?	2026-02-13 10:18:59.796689+00	Score 6: Dynamic adaptation. Candidate treats their relevance as a "perpetual beta," constantly auditing and updating their skill set.
36398ad7-8a0f-4c15-b563-de757f1e25fd	psychometric	growth_potential	leadership	low	Tell me about mentoring while continuing to grow.	2026-02-13 10:18:59.796689+00	Score 6: Reciprocal learning. Candidate describes a "reverse mentoring" scenario where they learn from the youth while providing the wisdom of experience.
b7e00d9a-57dc-4e38-8dbe-f37ae1255376	psychometric	growth_potential	leadership	low	Describe adapting to technological disruption.	2026-02-13 10:18:59.796689+00	Score 6: Rapid tech adoption. Candidate shows they aren't resistant to new tools but are leading the charge in learning how to leverage them for the business.
03d8b330-536d-4e52-ae98-5163d43dc261	psychometric	growth_potential	leadership	low	How do you stay open to new perspectives?	2026-02-13 10:18:59.796689+00	Score 6: Intellectual humility. Candidate admits what they don't know and describes creating "dissenting groups" in meetings to hear alternative views.
2132626d-287e-4ce6-9889-4a97fa2cb824	psychometric	growth_potential	leadership	low	Tell me about broadening strategic influence.	2026-02-13 10:18:59.796689+00	Score 6: Ecosystem leadership. Candidate describes acting as a thought leader outside their company, influencing industry standards or policy.
3ab4c950-5bdd-4179-be5b-422d0eca6199	psychometric	growth_potential	leadership	medium	Tell me about reshaping your leadership style over time.	2026-02-13 10:18:59.796689+00	Score 6: Style evolution. Candidate describes a specific shift (e.g., from Command to Empowerment) prompted by a changing work world and their own self-reflection.
d7b155ab-f057-4fe6-b54a-1b2c43949904	psychometric	growth_potential	leadership	medium	Describe sustaining innovation despite experience depth.	2026-02-13 10:18:59.796689+00	Score 6: Destructive curiosity. Candidate shows they are willing to "kill" their own successful legacy models to make room for a new, better innovative approach.
82a85769-bf78-452b-aa24-cfa717ae5b85	psychometric	growth_potential	leadership	medium	How do you identify emerging competencies required for the future?	2026-02-13 10:18:59.796689+00	Score 6: Environmental scanning. Candidate describes using cross-industry analogies to predict what their field will need in 5 years.
17b73233-8603-4c69-a3e7-732d80616f6f	psychometric	growth_potential	leadership	medium	Tell me about leading while simultaneously learning.	2026-02-13 10:18:59.796689+00	Score 6: Vulnerable leadership. Candidate describes leading a project in a field they were still learning, relying on their core logic while upskilling daily.
4eba89c4-3bc9-464f-a701-a44e7c04cd97	psychometric	growth_potential	leadership	medium	Describe staying agile during economic or market disruption.	2026-02-13 10:18:59.796689+00	Score 6: Crisis agility. Candidate shows how they used a downturn as a "learning laboratory" to find new efficiencies and growth vectors.
99b05f86-f243-4fd6-b85f-4c207e28f7ff	psychometric	growth_potential	leadership	medium	How do you challenge established thinking patterns?	2026-02-13 10:18:59.796689+00	Score 6: First-principles thinking. Candidate describes a time they asked "Why?" until the legacy logic broke, leading to a major breakthrough.
c9f5060c-1e1e-448a-9d03-cf778a68d9ee	psychometric	growth_potential	leadership	medium	Tell me about evolving beyond legacy success models.	2026-02-13 10:18:59.796689+00	Score 6: Post-legacy mindset. Candidate admits that what worked in 2010 won't work in 2026 and describes the process of "unlearning."
c2e71ed9-df75-41f5-b9e3-192a57e85510	psychometric	growth_potential	leadership	medium	Describe balancing legacy wisdom with new-age adaptability.	2026-02-13 10:18:59.796689+00	Score 6: Hybrid intelligence. Candidate explains when to use "Timeless Principles" and when to use "Modern Methods," showing a nuanced middle ground.
46b2f5af-af53-412c-bbb9-d7f3cb3a96ab	psychometric	growth_potential	leadership	medium	How do you prepare the next generation while upgrading yourself?	2026-02-13 10:18:59.796689+00	Score 6: Parallel growth. Candidate describes a growth culture where they grow *with* their team, sharing lessons and failures in real-time.
3d66a9fd-a6bd-45cd-8b39-6fbc87043735	psychometric	growth_potential	leadership	medium	Tell me about reinventing strategic priorities.	2026-02-13 10:18:59.796689+00	Score 6: Strategic pivot logic. Candidate describes the data and "gut feel" process they used to realize the old strategy was dead and a new path was needed.
6dbffb93-840b-4b02-afd6-84848c3c8277	psychometric	growth_potential	leadership	hard	Tell me about redefining your long-term strategic direction.	2026-02-13 10:18:59.796689+00	Score 6: Visionary pivot. A story of shifting a whole company or career in a new direction based on a deep insight into the future, despite high risk.
2525db73-6e60-4912-b7f1-cea10f8da57f	psychometric	growth_potential	leadership	hard	Describe leading adaptation during industry shifts.	2026-02-13 10:18:59.796689+00	Score 6: Industry-level leadership. Candidate describes how they guided not just their team, but their clients and patterns through a tectonic shift (e.g., Cloud or AI).
0e348c1b-0968-4dec-9b80-f367e6ec34ae	psychometric	growth_potential	leadership	hard	How do you make growth decisions when the long-term future is unclear?	2026-02-13 10:18:59.796689+00	Score 6: Probabilistic growth. Candidate uses "Small Bets" and rapid feedback loops to learn their way into the future rather than gambling.
a4c7a232-b0bb-45a4-b575-d376a739e9da	psychometric	growth_potential	leadership	hard	Tell me about navigating transformation while sustaining relevance.	2026-02-13 10:18:59.796689+00	Score 6: Ship-steadying. Candidate shows they can keep the current engine running (relevance) while simultaneously building the next engine (transformation).
52daadcd-55ba-4179-be0b-d717a025c357	psychometric	growth_potential	leadership	hard	Describe reshaping organizational culture to align with future strategy.	2026-02-13 10:18:59.796689+00	Score 6: Cultural architect. Candidate describes the difficult psychological work of changing "How we do things" to enable a new growth path.
ba94b228-1283-49c2-8c95-5a0f55c60307	psychometric	growth_potential	leadership	hard	How do you handle resistance while driving innovation?	2026-02-13 10:18:59.796689+00	Score 6: Empathetic influence. Candidate treats resistance as data, addressing the "fear of loss" to bring people along on the growth journey.
fef60193-c2ba-43b9-be08-343c02431eae	psychometric	growth_potential	leadership	hard	Tell me about exiting a legacy approach to adopt emerging models.	2026-02-13 10:18:59.796689+00	Score 6: Courageous exit. A story of walking away from a profitable but "stagnant" path to go all-in on an emerging, higher-potential future.
bbb9a251-0988-4e76-ac20-775169e7bd8e	psychometric	growth_potential	leadership	hard	Describe sustaining adaptability across decades.	2026-02-13 10:18:59.796689+00	Score 6: Longitudinal Agility. Candidate portrays adaptability not as a skill but as a *state of being* maintained through constant curiosity and travel/exposure.
8210580a-db35-41d3-9466-9a47a5f56600	psychometric	growth_potential	leadership	hard	How do you build succession-ready leaders while evolving yourself?	2026-02-13 10:18:59.796689+00	Score 6: Generative leadership. Candidate believes their greatest growth is in creating leaders who are smarter and more agile than themselves.
a2e03128-dc16-4722-8ed8-3a060caafda1	psychometric	growth_potential	leadership	hard	Tell me about your toughest strategic growth pivot.	2026-02-13 10:18:59.796689+00	Score 6: Masterclass in Strategy. A deep-dive into a high-stakes moment where they were wrong, realized it, and steered into a new success.
96ece211-ed55-4826-bd67-4362659b42cc	psychometric	sales_dna	leadership	low	Tell me about sustaining high performance across decades.	2026-02-13 10:18:59.796689+00	Score 6: Revenue resilience. Candidate describes a system-based approach to sales that survives market cycles and personal fluctuations.
eba08440-daa9-4240-9fd0-91258f259dcf	psychometric	sales_dna	leadership	low	Describe maintaining strong client networks long-term.	2026-02-13 10:18:59.796689+00	Score 6: Social capital logic. Candidate treats relationships as "multi-year investments," focusing on value provided outside of the transaction.
5566c895-55dc-4e5c-8ead-b9cf80093e85	psychometric	sales_dna	leadership	low	How do you adapt to changing buyer behavior?	2026-02-13 10:18:59.796689+00	Score 6: Psychological agility. Candidate recognizes the shift (e.g., from Logic-based to Outcome-based) and modifies their storytelling accordingly.
da72fb67-08dd-4f73-8191-a5497e4a1e1c	psychometric	sales_dna	leadership	low	Tell me about mentoring future sales leaders.	2026-02-13 10:18:59.796689+00	Score 6: Talent architecture. Candidate describes identifying "The Sales Spark" in others and building a process to scale it across a team.
fd543233-8c4c-4bf4-a6b0-e21cf1e7cf1e	psychometric	sales_dna	leadership	low	Describe balancing legacy clients with new acquisition.	2026-02-13 10:18:59.796689+00	Score 6: Portfolio logic. Candidate manages their "Hunter" and "Farmer" activities with mathematical precision to ensure both growth and stability.
6f480042-fde9-45ec-83ae-edc7ce3161d8	psychometric	sales_dna	leadership	low	How do you stay competitive in evolving markets?	2026-02-13 10:18:59.796689+00	Score 6: Competitive intelligence. Candidate describes a habit of studying not just their product, but the *entire value chain* to find a superior angle.
b2097796-4aea-442e-92e9-1601138f3aa0	psychometric	sales_dna	leadership	low	Tell me about managing long-term revenue accountability.	2026-02-13 10:18:59.796689+00	Score 6: Enterprise ownership. Candidate treats the P&L as their own, showing a deep sense of responsibility to the company's bottom line.
a81137ee-f78b-4c03-add8-62037e2dd62a	psychometric	sales_dna	leadership	low	Describe sustaining motivation at senior levels.	2026-02-13 10:18:59.796689+00	Score 6: Purpose-led revenue. Candidate finds motivation in "Solving the Industry Problem" rather than just hitting a number.
15747740-ced4-417a-8579-453023eb4bf6	psychometric	sales_dna	leadership	low	How do you maintain strategic influence in sales discussions?	2026-02-13 10:18:59.796689+00	Score 6: Peer-of-the-CEO. Candidate described being seen as a strategic advisor who happens to sell a solution, rather than a vendor.
3e41db7d-26e7-4f13-ac8d-a092caeace0b	psychometric	sales_dna	leadership	low	Tell me about evolving your selling style over time.	2026-02-13 10:18:59.796689+00	Score 6: Style maturity. Candidate describes moving from "Persuasion" to "Facilitation"ÔÇöhelping the client navigate their own internal complexity to buy.
8c7027cc-faab-4c47-b977-00b5e99b720d	psychometric	sales_dna	leadership	medium	Tell me about reshaping sales strategy during economic shifts.	2026-02-13 10:18:59.796689+00	Score 6: Strategic redirection. Candidate describes a time they moved a whole team from "Growth" to "Risk Mitigation" (or vice versa) to match the economy.
368d8ea9-7649-4623-95cd-9578ce49ca52	psychometric	sales_dna	leadership	medium	Describe influencing board-level revenue discussions.	2026-02-13 10:18:59.796689+00	Score 6: Executive communication. Candidate explains how they translate "Sales Activity" into "Shareholder Value" for Board members.
f250511e-c0cc-4abb-8391-98ea48d67be8	psychometric	sales_dna	leadership	medium	How do you align long-term growth with short-term revenue goals?	2026-02-13 10:18:59.796689+00	Score 6: Ambiguity management. Candidate describes the "Balancing Act" of hitting the quarter while investing in the 2-year ecosystem.
8f743e17-289f-4f9e-906f-8f7aab907f97	psychometric	sales_dna	leadership	medium	Tell me about navigating large-scale account transitions.	2026-02-13 10:18:59.796689+00	Score 6: Multi-national orchestration. Candidate describes managing a "Global Account" through a change in leadership or merger, protecting the revenue.
2b953182-e2a9-4046-81fe-ac0d74e36c56	psychometric	sales_dna	leadership	medium	Describe managing sustained high-stakes negotiations.	2026-02-13 10:18:59.796689+00	Score 6: Master negotiator. Candidate describes a multi-month negotiation with extreme pressure, showing how they maintained logic and "Walk-away" points.
8048c9ca-dea5-498e-a962-5965e4ff2814	psychometric	sales_dna	leadership	medium	How do you build succession-ready sales teams?	2026-02-13 10:18:59.796689+00	Score 6: Legacy sales management. Candidate hires and trains for *adaptability* and *values*, ensuring the team thrives even after they leave.
05f7ef65-56e5-49b6-956f-536082edfd10	psychometric	sales_dna	leadership	medium	Tell me about maintaining resilience during global downturns.	2026-02-13 10:18:59.796689+00	Score 6: Composure under crisis. Candidate describes holding their team and clients together during a period where "nobody is buying," finding the pivot.
098dfabd-9fe2-4b0b-919f-3ba5740a69a5	psychometric	sales_dna	leadership	medium	Describe repositioning offerings during industry change.	2026-02-13 10:18:59.796689+00	Score 6: Value-prop innovation. Candidate shows they can find the "New Pain" in a changing industry and map their solution to it faster than competitors.
9e80d6f4-4345-436d-b678-ccb3c66924bf	psychometric	sales_dna	leadership	medium	How do you sustain authority in competitive ecosystems?	2026-02-13 10:18:59.796689+00	Score 6: Thought leadership. Candidate builds authority by contributing to the category, not just their company, becoming a "Go-to expert" for the niche.
ac80b835-53ac-4bd6-80ab-678a975aa68d	psychometric	sales_dna	leadership	medium	Tell me about adapting to digital transformation in sales.	2026-02-13 10:18:59.796689+00	Score 6: Digital native mindset. Candidate describes moving from "Face-to-Face" to "Data-Led, Multi-Channel" selling without losing the human touch.
637918d3-9975-442f-a5d4-a3a8c775e7e9	psychometric	sales_dna	leadership	hard	Tell me about redefining revenue strategy in uncertain markets.	2026-02-13 10:18:59.796689+00	Score 6: Strategic foresight. A story of making a "contrarian bet" on a revenue source that others ignored, which became the primary growth driver.
0f47c78d-49e8-41ce-b3c5-6e53279222c4	psychometric	sales_dna	leadership	hard	Describe leading sales adaptation during industry collapse.	2026-02-13 10:18:59.796689+00	Score 6: Crisis leadership. A "War Story" of keeping a revenue engine alive while an industry was being disrupted or regulated out of existence.
b3c27550-b19e-4ae5-9aa6-41bad7dd524e	psychometric	sales_dna	leadership	hard	How do you make high-risk revenue decisions when the future is unclear?	2026-02-13 10:18:59.796689+00	Score 6: Risk-Intelligence. Candidate describes the logical framework they use to "Bet the farm" on a new territory or model while protecting the base.
5b649bf9-cd4a-4209-8996-a8949c585ade	psychometric	sales_dna	leadership	hard	Tell me about navigating global economic crises in sales leadership.	2026-02-13 10:18:59.796689+00	Score 6: Global resilience. Candidate describes managing revenue across multiple timezones and currencies during a systemic shock (e.g., 2008 or 2020).
df2a3b81-12b5-4d7b-87f9-b8f7dd52588b	psychometric	sales_dna	leadership	hard	Describe reshaping sales culture to align with future strategy.	2026-02-13 10:18:59.796689+00	Score 6: Cultural catalyst. Candidate describes the "Pain and Gain" of changing a team's core motivation (e.g., from commission-focused to customer-success-focused).
f01a435d-5b97-4b5f-b52c-02ff585571b3	psychometric	sales_dna	leadership	hard	How do you handle radical transformation resistance in sales teams?	2026-02-13 10:18:59.796689+00	Score 6: Influence and resolve. Candidate describes "Managing out" the legacy mindset while "Scaling up" the new-age performers during a transition.
7a15d41f-9fce-4c08-afb2-2d98f6156361	psychometric	sales_dna	leadership	hard	Tell me about exiting a legacy sales model to adopt innovation.	2026-02-13 10:18:59.796689+00	Score 6: Creative destruction. A story of shutting down a high-revenue but "poisonous" sales tactic to build a more sustainable, high-integrity future.
556013c4-c17b-485c-8485-614a8b42cda6	psychometric	sales_dna	leadership	hard	Describe sustaining adaptability across decades in revenue roles.	2026-02-13 10:18:59.796689+00	Score 6: Longitudinal Agility. Candidate portrays their career as a series of "successful deaths" and "pivotal births"ÔÇöconstantly evolving with the market.
15e296ff-ee7c-4db2-a185-21c4ad34f836	psychometric	sales_dna	leadership	hard	How do you build succession-ready adaptive sales leaders?	2026-02-13 10:18:59.796689+00	Score 6: Mentorship legacy. Candidate believes their success is measured by the number of their proteges who are now VPs of Sales at other elite companies.
608c377f-569b-4c15-976b-d2adf9bf75a6	psychometric	sales_dna	leadership	hard	Tell me about your toughest strategic revenue pivot.	2026-02-13 10:18:59.796689+00	Score 6: Masterclass in Turnaround. A deep-dive into a total revenue failure that they analyzed, pivoted, and turned into a massive success through logic and grit.
\.


--
-- Data for Name: assessment_responses; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.assessment_responses (id, candidate_id, question_id, category, driver, difficulty, raw_answer, score, evaluation_metadata, is_skipped, tab_switches, time_taken_seconds, created_at, question_text) FROM stdin;
68bda1d7-b1f0-44b8-9383-421f3fe94eb7	a951825b-e862-430d-b0e7-5fa29f95f7a2	79326581-e133-4648-8878-778ef46cdf16	psychometric	burnout_risk	low	I start my day by checking into the goals i have set for the day.	2	{"id": "79326581-e133-4648-8878-778ef46cdf16", "text": "How do you usually start your workday?", "driver": "burnout_risk", "category": "psychometric", "evaluator": "AUDITOR_V3", "framework": "STAR", "reasoning": "The candidate provides a vague response about starting their day by checking goals, but lacks specific details or a structured approach that aligns with the STAR framework. There is no clear Situation, Task, Action, or Result outlined, making it difficult to assess their workflow or outcomes.", "difficulty": "low"}	f	0	\N	2026-03-03 11:21:51.090122+00	How do you usually start your workday?
6f28b10e-4ba5-4122-9653-ef53b6a764bf	a951825b-e862-430d-b0e7-5fa29f95f7a2	\N	skill	Client Engagement & Requirement Gathering	high	I proceed with clam and composed way. By keeping clam and thinking what we can do can help us in those situations	2	{"text": "A key client demands a last-minute change to their project scope, jeopardizing the timeline and budget. The client is frustrated and insists on immediate solutions. How would you proceed?", "driver": "Client Engagement & Requirement Gathering", "category": "skill", "evaluator": "AUDITOR_V3", "framework": "STAR", "reasoning": "The candidate provided a vague response that lacks specific examples or metrics to demonstrate their approach to handling the situation. While they mentioned staying calm and thinking through solutions, there is no clear structure or evidence of a logical workflow, nor did they outline specific actions taken or outcomes achieved. The response does not adequately follow the STAR framework, as it lacks details on the Situation, Task, Action, and Result.", "difficulty": "high"}	f	0	\N	2026-03-03 11:22:58.174306+00	A key client demands a last-minute change to their project scope, jeopardizing the timeline and budget. The client is frustrated and insists on immediate solutions. How would you proceed?
d389ee45-84d1-4bf0-a221-446085d4459d	a951825b-e862-430d-b0e7-5fa29f95f7a2	ded34768-643a-49b2-bcc2-f241f49f20eb	behavioral	resilience	low	It means how we work in pressure	2	{"id": "ded34768-643a-49b2-bcc2-f241f49f20eb", "text": "What does resilience mean in your current role?", "driver": "resilience", "category": "behavioral", "evaluator": "AUDITOR_V3", "framework": "None", "reasoning": "The candidate's response is vague and lacks specific examples or metrics that demonstrate their understanding of resilience in a professional context. While they mention working under pressure, they do not provide a structured response using the STAR framework, nor do they illustrate how they have applied resilience in a practical situation.", "difficulty": "low"}	f	0	\N	2026-03-03 11:23:27.061577+00	What does resilience mean in your current role?
2ce0a08c-aad3-4a94-a5f3-c4fe260be422	a951825b-e862-430d-b0e7-5fa29f95f7a2	3f10c666-cb28-4696-ae20-cd23be35c319	psychometric	burnout_risk	low	I will take frequent breaks and work, rather than working continously which will exaust and bring more stress	4	{"id": "3f10c666-cb28-4696-ae20-cd23be35c319", "text": "How do you usually manage stress during busy weeks?", "driver": "burnout_risk", "category": "psychometric", "evaluator": "AUDITOR_V3", "framework": "STAR", "reasoning": "The candidate provides a logical workflow for managing stress by taking frequent breaks, which demonstrates an understanding of stress management techniques. However, the response lacks specific metrics or outcomes that would indicate the effectiveness of this approach. The answer is proficient but does not fully utilize the STAR framework, as it does not provide a clear Situation, Task, Action, and Result.", "difficulty": "low"}	f	0	\N	2026-03-03 11:24:25.115688+00	How do you usually manage stress during busy weeks?
8bb0ed86-24bf-48fb-a438-20d73565d39b	a951825b-e862-430d-b0e7-5fa29f95f7a2	257d01ef-28b1-4cec-b7d9-b92b962758ce	behavioral	resilience	low	I stay clam and re structure the plan and figure out where i went wrong and improve that in new plan.	4	{"id": "257d01ef-28b1-4cec-b7d9-b92b962758ce", "text": "Describe how you adapt when things donÔÇÖt go as planned.", "driver": "resilience", "category": "behavioral", "evaluator": "AUDITOR_V3", "framework": "STAR", "reasoning": "The candidate demonstrates a proficient understanding of adapting to unexpected situations by outlining a logical workflow. They mention staying calm, restructuring the plan, and identifying areas for improvement. However, the response lacks specific metrics or detailed outcomes that would enhance the evaluation of their adaptability. Overall, the candidate shows a solid approach but does not fully utilize the STAR framework to provide a comprehensive answer.", "difficulty": "low"}	f	0	\N	2026-03-03 11:25:08.446251+00	Describe how you adapt when things donÔÇÖt go as planned.
b323ed3c-62d7-4ab1-9b63-98e3883e66ca	a951825b-e862-430d-b0e7-5fa29f95f7a2	79f66830-db4c-4981-bf4a-0f34ef91f901	psychometric	burnout_risk	low	I disconnect from work after office by involving my self in other activities which will make me relife and also help to work fresh for next days.	2	{"id": "79f66830-db4c-4981-bf4a-0f34ef91f901", "text": "How do you disconnect from work after office hours?", "driver": "burnout_risk", "category": "psychometric", "evaluator": "AUDITOR_V3", "framework": "STAR", "reasoning": "The candidate provides a vague response without specific examples or metrics to illustrate how they disconnect from work. The answer lacks a clear structure following the STAR framework, as it does not specify a Situation, Task, Action, or Result. The mention of 'other activities' is too general and does not demonstrate a concrete strategy or outcome.", "difficulty": "low"}	f	0	\N	2026-03-03 11:26:16.071271+00	How do you disconnect from work after office hours?
ac804e58-39a9-4618-8afd-fcf4b71e2318	a951825b-e862-430d-b0e7-5fa29f95f7a2	\N	skill	MEDDIC / MEDDPICC Methodology	high	I will explain them how important our role and explain what are the current market demands and confess them that we are not demanding and we are geniune.	4	{"text": "A potential client expresses interest but hesitates due to budget constraints. They have a critical need for your solution, which aligns with their strategic goals. Using the MEDDPICC framework, how would you proceed to address their concerns and close the deal? How would you proceed?", "driver": "MEDDIC / MEDDPICC Methodology", "category": "skill", "evaluator": "AUDITOR_V3", "framework": "STAR", "reasoning": "The candidate demonstrates a logical workflow by acknowledging the client's budget concerns and emphasizing the importance of the service. However, the response lacks specific metrics or clear outcomes that would strengthen their argument. While they mention being genuine and understanding market demands, they do not provide a structured approach using the MEDDPICC framework to address the client's hesitations effectively.", "difficulty": "high"}	f	0	\N	2026-03-03 11:27:55.585636+00	A potential client expresses interest but hesitates due to budget constraints. They have a critical need for your solution, which aligns with their strategic goals. Using the MEDDPICC framework, how would you proceed to address their concerns and close the deal? How would you proceed?
8f62880f-8963-4a61-a053-9f3969a85689	a951825b-e862-430d-b0e7-5fa29f95f7a2	17c0c727-1175-4565-a088-ad845b559a95	behavioral	resilience	low	I will take feedback as input and work on them to get better.	2	{"id": "17c0c727-1175-4565-a088-ad845b559a95", "text": "How do you respond to constructive feedback?", "driver": "resilience", "category": "behavioral", "evaluator": "AUDITOR_V3", "framework": "None", "reasoning": "The candidate's response is vague and lacks specific examples or metrics that demonstrate how they have effectively utilized feedback in the past. There is no clear structure indicating a situation, task, action, and result (STAR) framework. The response is theoretical and does not provide evidence of a systematic approach to receiving and implementing feedback.", "difficulty": "low"}	f	0	\N	2026-03-03 11:28:22.986415+00	How do you respond to constructive feedback?
4ff1fab4-9196-46b6-89f4-ba3d786e05c5	a951825b-e862-430d-b0e7-5fa29f95f7a2	b74b6554-de26-4da8-90a2-13f372ccd44b	resume	resilience	low	By keep tracking of ever single task	2	{"id": "b74b6554-de26-4da8-90a2-13f372ccd44b", "text": "How do you maintain performance during challenging weeks?", "driver": "resilience", "category": "resume", "evaluator": "AUDITOR_V3", "framework": "STAR", "reasoning": "The candidate's response is vague and lacks specific examples or metrics to demonstrate how tracking tasks contributes to maintaining performance during challenging weeks. There is no clear structure following the STAR framework, as there is no situation, task, action, or result provided.", "difficulty": "low"}	f	0	\N	2026-03-03 11:28:49.147647+00	How do you maintain performance during challenging weeks?
5beafd82-6ac4-49c4-8e61-0ad1ddbc2b43	a951825b-e862-430d-b0e7-5fa29f95f7a2	96266f3a-5d97-4369-b646-b19311fd375e	resume	resilience	low	By being clam and fixing things	2	{"id": "96266f3a-5d97-4369-b646-b19311fd375e", "text": "How do you deal with workload pressure?", "driver": "resilience", "category": "resume", "evaluator": "AUDITOR_V3", "framework": "STAR", "reasoning": "The candidate's response lacks specific details and does not follow the STAR framework effectively. While they mention being 'calm' and 'fixing things', there are no clear examples of a Situation, Task, Action, or Result. The response is vague and does not provide evidence of how they handle workload pressure in a concrete manner.", "difficulty": "low"}	f	0	\N	2026-03-03 11:29:33.837193+00	How do you deal with workload pressure?
\.


--
-- Data for Name: assessment_sessions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.assessment_sessions (id, candidate_id, experience_band, status, total_budget, current_step, overall_score, component_scores, driver_confidence, started_at, completed_at, warning_count) FROM stdin;
2f23bc02-8e8a-4794-aed3-e04b91a45040	a951825b-e862-430d-b0e7-5fa29f95f7a2	mid	completed	10	11	41	{"skill": 50, "resume": 33, "behavioral": 44, "psychometric": 44}	{}	2026-03-03 11:21:08.43034+00	2026-03-06 06:09:58.169058+00	0
\.


--
-- Data for Name: blocked_users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.blocked_users (user_id, reason, blocked_at) FROM stdin;
\.


--
-- Data for Name: candidate_job_sync; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.candidate_job_sync (id, candidate_id, job_id, overall_match_score, match_explanation, missing_critical_skills, created_at) FROM stdin;
\.


--
-- Data for Name: candidate_profiles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.candidate_profiles (user_id, experience, location, assessment_status, created_at, skills, onboarding_step, final_profile_score, job_type, career_interests, learning_interests, social_links, full_name, phone_number, profile_strength, completion_score, "current_role", years_of_experience, updated_at, profile_photo_url, bio, primary_industry_focus, current_employment_status, key_responsibilities, major_achievements, linkedin_url, portfolio_url, learning_links, terms_accepted, account_status, gender, birthdate, qualification_held, graduation_year, referral, resume_path, target_role, long_term_goal, education_history, experience_history, projects, certifications, career_gap_report, professional_summary, gpa_score, graduation_status, last_resume_parse_at, ai_extraction_confidence, identity_verified, identity_proof_path, expected_salary, location_tier) FROM stdin;
a951825b-e862-430d-b0e7-5fa29f95f7a2	mid	Mysore	completed	2026-03-03 11:19:11.581422+00	{"SaaS Product Demoing","MEDDIC / MEDDPICC Methodology","Client Engagement & Requirement Gathering"}	COMPLETED	41	onsite	{SaaS,Cybersecurity}	{}	{}	MithunKaveriappa M K	988095790	Low	20	Senior Account Executive	\N	2026-03-03 11:35:36.177883+00	\N		SaaS	\N	\N	\N	https://www.linkedin.com/in/mithunmk13/	\N	[]	t	Active	Male	2001-01-13	MCA	2024	Friend	resumes/a951825b-e862-430d-b0e7-5fa29f95f7a2-1772536758011.pdf	Enterprise account executive	Lead a global sales divison.	[]	[]	[]	{}	{}	\N	\N	\N	\N	0	t	id-proofs/a951825b-e862-430d-b0e7-5fa29f95f7a2-1772536857383.pdf	200000	Tier 2
\.


--
-- Data for Name: candidate_settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.candidate_settings (user_id, email_notifications, web_notifications, mobile_notifications, is_public, language, timezone, job_alert_frequency, minimum_salary_threshold, created_at, updated_at) FROM stdin;
1666db26-badd-49a1-a54f-bcdd6b4798a6	t	t	f	t	en	UTC	instant	0	2026-03-04 08:52:27.101099+00	2026-03-04 08:52:27.101099+00
1a3df2b8-348d-4fe8-b8cd-af9ce068c68f	t	t	f	t	en	UTC	instant	0	2026-03-04 08:52:27.101099+00	2026-03-04 08:52:27.101099+00
6e172507-b7fc-48d3-ae10-10e29257f876	t	t	f	t	en	UTC	instant	0	2026-03-04 08:52:27.101099+00	2026-03-04 08:52:27.101099+00
b6c8ff41-a96a-4af7-b3be-e050fcdd7e24	t	t	f	t	en	UTC	instant	0	2026-03-04 08:52:27.101099+00	2026-03-04 08:52:27.101099+00
e4154a4d-939f-450d-a000-6c21f8d378a7	t	t	f	t	en	UTC	instant	0	2026-03-04 08:52:27.101099+00	2026-03-04 08:52:27.101099+00
eaad8850-3e5f-41f3-9f73-e6f6155bcb91	t	t	f	t	en	UTC	instant	0	2026-03-04 08:52:27.101099+00	2026-03-04 08:52:27.101099+00
c7a57afc-b16c-4135-837c-75eb2aab5348	t	t	f	t	en	UTC	instant	0	2026-03-04 08:52:27.101099+00	2026-03-04 08:52:27.101099+00
4a97fe8b-881a-4925-95c0-3496c700e93b	t	t	f	t	en	UTC	instant	0	2026-03-04 08:52:27.101099+00	2026-03-04 08:52:27.101099+00
8622864c-0f25-4ce9-90b1-a83ac5a569e0	t	t	f	t	en	UTC	instant	0	2026-03-04 08:52:27.101099+00	2026-03-04 08:52:27.101099+00
c32e36c5-f2ed-40ba-a0a2-7819b7721290	t	t	f	t	en	UTC	instant	0	2026-03-04 08:52:27.101099+00	2026-03-04 08:52:27.101099+00
0ed87797-ba2c-49c7-b764-2c43df267724	t	t	f	t	en	UTC	instant	0	2026-03-04 08:52:27.101099+00	2026-03-04 08:52:27.101099+00
a951825b-e862-430d-b0e7-5fa29f95f7a2	f	f	f	t	en	UTC	instant	0	2026-03-04 08:52:27.101099+00	2026-03-04 08:52:27.101099+00
\.


--
-- Data for Name: career_gps; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.career_gps (id, candidate_id, target_role, current_status, created_at, updated_at) FROM stdin;
7220f77d-c620-4757-ae13-e477936d8fd7	a951825b-e862-430d-b0e7-5fa29f95f7a2	Enterprise Account Executive	active	2026-03-03 11:31:55.502542+00	2026-03-03 11:31:55.502542+00
\.


--
-- Data for Name: career_milestones; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.career_milestones (id, gps_id, step_order, title, description, skills_to_acquire, learning_actions, status, completed_at, created_at, verification_url, proof_attachment_path) FROM stdin;
a7eb1bd1-66f7-4039-81cf-2e9225bf6874	7220f77d-c620-4757-ae13-e477936d8fd7	2	Enterprise Account Executive	Develop skills to engage large enterprises and solve their complex IT challenges.	{"Multi-threaded Stakeholder Management","Advanced MEDDPICC"}	[{"url": "https://trailhead.salesforce.com/en/content/learn/modules/advanced-medpdicc", "title": "Salesforce: Advanced MEDDPICC Selling", "platform": "Salesforce Trailhead"}, {"url": "https://academy.hubspot.com/courses/building-a-sales-strategy", "title": "HubSpot: Building a Sales Strategy", "platform": "HubSpot Academy"}]	not-started	\N	2026-03-03 11:31:55.59233+00	\N	\N
4f8b75c2-6c86-4fb4-af28-6ad686ce5be5	7220f77d-c620-4757-ae13-e477936d8fd7	3	Sales Manager	Lead a team of sales professionals, driving performance through strategy and coaching.	{"Coaching and Development","Performance Management"}	[{"url": "https://trailhead.salesforce.com/en/content/learn/modules/coaching-feedback", "title": "Salesforce: Coaching & Feedback", "platform": "Salesforce Trailhead"}, {"url": "https://academy.hubspot.com/courses/sales-management-training", "title": "HubSpot: Sales Management Training", "platform": "HubSpot Academy"}]	not-started	\N	2026-03-03 11:31:55.59233+00	\N	\N
801bce58-552b-43e3-8d46-150c844f0f17	7220f77d-c620-4757-ae13-e477936d8fd7	1	Mid-Market Account Executive	Focus on mastering the art of navigating complex sales processes in mid-market accounts.	{"Advanced Negotiation Skills","Customer-centric Selling"}	[{"url": "https://trailhead.salesforce.com/en/content/learn/modules/negotiation-fundamentals", "title": "Salesforce: Negotiation Fundamentals", "platform": "Salesforce Trailhead"}, {"url": "https://academy.hubspot.com/courses/inbound-sales", "title": "HubSpot: Inbound Sales Certification", "platform": "HubSpot Academy"}]	completed	2026-03-06 06:08:47.813967+00	2026-03-03 11:31:55.59233+00	\N	\N
e31c84c5-4a73-4f25-a4c3-a9e83e44a52f	7220f77d-c620-4757-ae13-e477936d8fd7	4	Director of Sales	Steer the sales direction while collaborating with cross-functional teams for market strategy.	{"Strategic Thinking","Market Analysis"}	[{"url": "https://trailhead.salesforce.com/en/content/learn/modules/strategic-selling", "title": "Salesforce: Strategic Selling", "platform": "Salesforce Trailhead"}, {"url": "https://academy.hubspot.com/courses/sales-enablement", "title": "HubSpot: Sales Enablement Certification", "platform": "HubSpot Academy"}]	not-started	\N	2026-03-03 11:31:55.59233+00	\N	\N
a297d5ef-733e-4492-87a9-f4d245646a21	7220f77d-c620-4757-ae13-e477936d8fd7	5	Vice President of Sales	Oversee the entire sales organization and formulate strategies for global outreach.	{"Global Sales Leadership","Advanced Sales Metrics Analysis"}	[{"url": "https://trailhead.salesforce.com/en/content/learn/modules/advanced-sales-leadership", "title": "Salesforce: Advanced Sales Leadership", "platform": "Salesforce Trailhead"}, {"url": "https://academy.hubspot.com/courses/sales-metrics-and-kpis", "title": "HubSpot: Sales Metrics & KPIs", "platform": "HubSpot Academy"}]	not-started	\N	2026-03-03 11:31:55.59233+00	\N	\N
\.


--
-- Data for Name: chat_messages; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.chat_messages (id, thread_id, sender_id, text, is_read, created_at) FROM stdin;
\.


--
-- Data for Name: chat_reports; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.chat_reports (id, message_id, reporter_id, thread_id, reason, status, admin_notes, created_at) FROM stdin;
\.


--
-- Data for Name: chat_threads; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.chat_threads (id, candidate_id, recruiter_id, is_active, last_message_at, created_at) FROM stdin;
08a5e791-793c-49f9-900c-5c844d76ab02	a951825b-e862-430d-b0e7-5fa29f95f7a2	0ed87797-ba2c-49c7-b764-2c43df267724	t	2026-03-04 05:00:23.097957+00	2026-03-04 05:00:23.097957+00
\.


--
-- Data for Name: companies; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.companies (id, name, registration_number, website, location, created_at, description, profile_score, industry_category, size_band, sales_model, target_market, visibility_tier, verification_status, domain, hiring_focus_areas, avg_deal_size_range, candidate_feedback_score, successful_hires_count, updated_at, logo_url, brand_colors, life_at_photo_urls) FROM stdin;
9c58a67f-cac2-4221-8403-c5389daaa2c9	Infomaze Elite Pvt Ltd	29ABCDE1234F1Z1	https://www.infomazeelite.com/	Mysore	2026-03-03 08:58:50.538847+00	Infomaze is a premier offshore software development company with over 20 years of experience delivering high-performance web and mobile business applications. We offer a comprehensive suite of services including AI automation, cloud migration, and custom software solutions tailored to industries such as healthcare, telecom, and print. Our mission is to serve as a trusted IT partner, helping global businesses improve operational efficiency through strategic technology implementation and dedicated expert development teams.	50	SaaS	11-50	Hybrid	Mid-market	Low	Under Review	\N	\N	< $10k	0	0	2026-03-03 08:58:50.538847+00	https://snzqqjrmthqdezozgvsp.supabase.co/storage/v1/object/public/company-logos/0ed87797-ba2c-49c7-b764-2c43df267724/logo-1772529231154.png	{"primary": "#0f172a", "secondary": "#1e293b"}	{https://snzqqjrmthqdezozgvsp.supabase.co/storage/v1/object/public/company-assets/0ed87797-ba2c-49c7-b764-2c43df267724/life-1772529241779-0.jpg,https://snzqqjrmthqdezozgvsp.supabase.co/storage/v1/object/public/company-assets/0ed87797-ba2c-49c7-b764-2c43df267724/life-1772529252121-0.jpg,https://snzqqjrmthqdezozgvsp.supabase.co/storage/v1/object/public/company-assets/0ed87797-ba2c-49c7-b764-2c43df267724/life-1772529290189-0.jpg}
\.


--
-- Data for Name: follows; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.follows (id, follower_id, following_id, created_at) FROM stdin;
\.


--
-- Data for Name: interview_slots; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.interview_slots (id, interview_id, start_time, end_time, is_selected, created_at) FROM stdin;
\.


--
-- Data for Name: interviews; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.interviews (id, job_id, candidate_id, recruiter_id, application_id, status, round_name, round_number, format, meeting_link, location, interviewer_names, feedback, cancellation_reason, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: job_application_status_history; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.job_application_status_history (id, application_id, old_status, new_status, changed_by, reason, created_at) FROM stdin;
2488fffb-b3f9-4a93-b9b3-4b532183e7b8	b72a0dbd-bbf6-4ad5-b3ed-b1c673941b09	\N	invited	0ed87797-ba2c-49c7-b764-2c43df267724	Invitation: Hi MithunKaveriappa M K,\n\nI saw your profile and was impressed by your experience. I think you'd be a great fit for our Sales Development Representative (SDR) - AI SaaS role. We are looking for someone with your background to join our team.\n\nYou can find the full job description attached to this invitation. Let me know if you'd be interested in discussing this further!	2026-03-04 05:00:22.842835+00
\.


--
-- Data for Name: job_applications; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.job_applications (id, job_id, candidate_id, status, feedback, created_at, updated_at, invitation_message) FROM stdin;
b72a0dbd-bbf6-4ad5-b3ed-b1c673941b09	1b23c92d-a10b-4a0e-9623-e5fb97d3290f	a951825b-e862-430d-b0e7-5fa29f95f7a2	invited	\N	2026-03-04 05:00:22.71058+00	2026-03-04 05:00:22.71058+00	Hi MithunKaveriappa M K,\n\nI saw your profile and was impressed by your experience. I think you'd be a great fit for our Sales Development Representative (SDR) - AI SaaS role. We are looking for someone with your background to join our team.\n\nYou can find the full job description attached to this invitation. Let me know if you'd be interested in discussing this further!
\.


--
-- Data for Name: job_views; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.job_views (id, job_id, candidate_id, viewer_ip, user_agent, created_at) FROM stdin;
\.


--
-- Data for Name: jobs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.jobs (id, company_id, recruiter_id, title, description, experience_band, location, job_type, skills_required, salary_range, status, created_at, updated_at, is_ai_generated, closed_at, metadata, requirements, number_of_positions) FROM stdin;
1b23c92d-a10b-4a0e-9623-e5fb97d3290f	9c58a67f-cac2-4221-8403-c5389daaa2c9	0ed87797-ba2c-49c7-b764-2c43df267724	Sales Development Representative (SDR) - AI SaaS	We are seeking a driven Sales Development Representative (SDR) to join our dynamic team focused on our cutting-edge AI-SaaS platform. In this hybrid role based in Bangalore, you will be pivotal in driving outbound prospecting efforts targeting mid-market accounts. Your mission is to engage potential clients through value-based selling techniques, effectively communicating the transformative power of our AI solutions. By generating qualified leads, you will directly contribute to our companyÔÇÖs Annual Recurring Revenue (ARR) and pipeline growth. We value a proactive approach and a hunger for success, as you will be instrumental in expanding our market presence and establishing long-term relationships with clients. Join us in shaping the future of technology sales in the AI sector.	mid	Banglore	hybrid	{"Proficiency in HubSpot or similar CRM tools.","Understanding of cloud concepts and AI technologies.","Familiarity with sales methodologies such as MEDDPICC and Challenger Sale.","Strong prospecting and communication skills."}	Ôé╣600,000-Ôé╣900,000 + OTE	active	2026-03-03 10:42:22.667613+00	2026-03-03 16:12:38.616989+00	t	\N	{}	{"Minimum 2-4 years of experience in a sales development or similar role within the SaaS industry.","Proven track record of exceeding quota, with a minimum of $1.5M ARR generated.","Experience in outbound prospecting and lead generation for mid-market accounts."}	1
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.notifications (id, user_id, type, title, message, metadata, is_read, created_at) FROM stdin;
1e8c63d4-71cc-402d-ae09-35733193e3c8	a951825b-e862-430d-b0e7-5fa29f95f7a2	ASSESSMENT_COMPLETED	Assessment Finalized	Evaluation complete. Your high-trust score of 41% has been logged to your secure profile.	{"score": 41}	f	2026-03-04 05:55:19.343155+00
ac615d69-378f-478b-8b74-ab98e28700a5	a951825b-e862-430d-b0e7-5fa29f95f7a2	ASSESSMENT_COMPLETED	Assessment Finalized	Evaluation complete. Your high-trust score of 41% has been logged to your secure profile.	{"score": 41}	f	2026-03-04 05:55:21.360481+00
7891403d-25f2-4b88-af63-2738d6f816f3	a951825b-e862-430d-b0e7-5fa29f95f7a2	ASSESSMENT_COMPLETED	Assessment Finalized	Evaluation complete. Your high-trust score of 41% has been logged to your secure profile.	{"score": 41}	f	2026-03-05 04:43:33.497535+00
9a67093f-60c7-4143-b082-6ca66a7b66f9	a951825b-e862-430d-b0e7-5fa29f95f7a2	ASSESSMENT_COMPLETED	Assessment Finalized	Evaluation complete. Your high-trust score of 41% has been logged to your secure profile.	{"score": 41}	f	2026-03-05 04:43:34.380039+00
ea7ab659-f6bd-4aaa-8128-333a5168a864	a951825b-e862-430d-b0e7-5fa29f95f7a2	system	Milestone Completed! ­ƒÜÇ	Congratulations! You've unlocked the 'Mid-Market Account Executive' milestone in your Career GPS.	{"action": "gps_update", "milestone_id": "801bce58-552b-43e3-8d46-150c844f0f17"}	f	2026-03-05 08:50:35.704798+00
1e6a3edc-92f2-4657-8895-00d705c81829	a951825b-e862-430d-b0e7-5fa29f95f7a2	ASSESSMENT_COMPLETED	Assessment Finalized	Evaluation complete. Your high-trust score of 41% has been logged to your secure profile.	{"score": 41}	f	2026-03-05 09:08:20.819842+00
925acdd5-4dcb-4619-926f-29dc852ab816	a951825b-e862-430d-b0e7-5fa29f95f7a2	ASSESSMENT_COMPLETED	Assessment Finalized	Evaluation complete. Your high-trust score of 41% has been logged to your secure profile.	{"score": 41}	f	2026-03-05 09:08:21.828089+00
0a17beb3-e29d-4a34-9044-4c82fcc6dd76	a951825b-e862-430d-b0e7-5fa29f95f7a2	ASSESSMENT_COMPLETED	Assessment Finalized	Evaluation complete. Your high-trust score of 41% has been logged to your secure profile.	{"score": 41}	f	2026-03-06 04:38:35.919218+00
853e805e-f6af-40af-8002-ab8db3c44db8	a951825b-e862-430d-b0e7-5fa29f95f7a2	ASSESSMENT_COMPLETED	Assessment Finalized	Evaluation complete. Your high-trust score of 41% has been logged to your secure profile.	{"score": 41}	f	2026-03-06 04:38:36.815312+00
8ea7391b-3aa4-4515-bb84-0f1a6dd11c6b	a951825b-e862-430d-b0e7-5fa29f95f7a2	ASSESSMENT_COMPLETED	Assessment Finalized	Evaluation complete. Your high-trust score of 41% has been logged to your secure profile.	{"score": 41}	f	2026-03-06 04:49:37.261443+00
f100ef86-2356-423c-a02d-01518799683e	a951825b-e862-430d-b0e7-5fa29f95f7a2	ASSESSMENT_COMPLETED	Assessment Finalized	Evaluation complete. Your high-trust score of 41% has been logged to your secure profile.	{"score": 41}	f	2026-03-06 04:49:38.158877+00
b78ee1f5-7cc1-4a85-b7df-d8d9ae780031	a951825b-e862-430d-b0e7-5fa29f95f7a2	ASSESSMENT_COMPLETED	Assessment Finalized	Evaluation complete. Your high-trust score of 41% has been logged to your secure profile.	{"score": 41}	f	2026-03-06 04:52:19.284234+00
cd9e6ed7-e0f3-4776-94c9-dec2665f68ac	a951825b-e862-430d-b0e7-5fa29f95f7a2	ASSESSMENT_COMPLETED	Assessment Finalized	Evaluation complete. Your high-trust score of 41% has been logged to your secure profile.	{"score": 41}	f	2026-03-06 04:52:20.238125+00
6940cf05-3706-4107-a387-cc50cf877101	a951825b-e862-430d-b0e7-5fa29f95f7a2	ASSESSMENT_COMPLETED	Assessment Finalized	Evaluation complete. Your high-trust score of 41% has been logged to your secure profile.	{"score": 41}	f	2026-03-06 04:53:08.624139+00
34c2bde3-fb70-412b-9c55-1739a78a3a1a	a951825b-e862-430d-b0e7-5fa29f95f7a2	ASSESSMENT_COMPLETED	Assessment Finalized	Evaluation complete. Your high-trust score of 41% has been logged to your secure profile.	{"score": 41}	f	2026-03-06 04:53:11.149541+00
db32231a-3a67-49f8-b777-98510020237a	a951825b-e862-430d-b0e7-5fa29f95f7a2	ASSESSMENT_COMPLETED	Assessment Finalized	Evaluation complete. Your high-trust score of 41% has been logged to your secure profile.	{"score": 41}	f	2026-03-06 04:53:36.720186+00
6a35b7aa-52a5-4e97-8016-7303e72b7032	a951825b-e862-430d-b0e7-5fa29f95f7a2	ASSESSMENT_COMPLETED	Assessment Finalized	Evaluation complete. Your high-trust score of 41% has been logged to your secure profile.	{"score": 41}	f	2026-03-06 04:53:37.99335+00
c3fdeac0-3338-4180-9321-240512a6f8c7	a951825b-e862-430d-b0e7-5fa29f95f7a2	ASSESSMENT_COMPLETED	Assessment Finalized	Evaluation complete. Your high-trust score of 41% has been logged to your secure profile.	{"score": 41}	f	2026-03-06 05:22:33.233924+00
1f7d9ea9-2a96-442e-9254-4c31fed4cdcc	a951825b-e862-430d-b0e7-5fa29f95f7a2	ASSESSMENT_COMPLETED	Assessment Finalized	Evaluation complete. Your high-trust score of 41% has been logged to your secure profile.	{"score": 41}	f	2026-03-06 05:22:34.070297+00
9cc0056a-f631-41d7-bd42-245afedbe5c5	a951825b-e862-430d-b0e7-5fa29f95f7a2	ASSESSMENT_COMPLETED	Assessment Finalized	Evaluation complete. Your high-trust score of 41% has been logged to your secure profile.	{"score": 41}	f	2026-03-06 05:28:41.848438+00
2412a2d6-5931-417a-8423-c30f8321cd21	a951825b-e862-430d-b0e7-5fa29f95f7a2	ASSESSMENT_COMPLETED	Assessment Finalized	Evaluation complete. Your high-trust score of 41% has been logged to your secure profile.	{"score": 41}	f	2026-03-06 05:28:42.818382+00
9539454a-4a70-4b24-951a-a23cd248640a	a951825b-e862-430d-b0e7-5fa29f95f7a2	ASSESSMENT_COMPLETED	Assessment Finalized	Evaluation complete. Your high-trust score of 41% has been logged to your secure profile.	{"score": 41}	f	2026-03-06 06:07:21.040175+00
52fcf56b-cc68-4a42-bdbf-faef91a2499f	a951825b-e862-430d-b0e7-5fa29f95f7a2	ASSESSMENT_COMPLETED	Assessment Finalized	Evaluation complete. Your high-trust score of 41% has been logged to your secure profile.	{"score": 41}	f	2026-03-06 06:07:22.469481+00
0c9e38ea-9ea3-447a-8612-ca579e1262c2	a951825b-e862-430d-b0e7-5fa29f95f7a2	system	Milestone Completed! ­ƒÜÇ	Congratulations! You've unlocked the 'Mid-Market Account Executive' milestone in your Career GPS.	{"action": "gps_update", "milestone_id": "801bce58-552b-43e3-8d46-150c844f0f17"}	f	2026-03-06 06:08:47.709001+00
858d9315-9646-4418-96ec-fd64d57c4a4e	a951825b-e862-430d-b0e7-5fa29f95f7a2	ASSESSMENT_COMPLETED	Assessment Finalized	Evaluation complete. Your high-trust score of 41% has been logged to your secure profile.	{"score": 41}	f	2026-03-06 06:09:56.747968+00
bbdd97a7-9652-427b-9b9d-d45b53d2699a	a951825b-e862-430d-b0e7-5fa29f95f7a2	ASSESSMENT_COMPLETED	Assessment Finalized	Evaluation complete. Your high-trust score of 41% has been logged to your secure profile.	{"score": 41}	f	2026-03-06 06:09:57.781352+00
\.


--
-- Data for Name: post_comments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.post_comments (id, user_id, post_id, content, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: post_likes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.post_likes (id, user_id, post_id, created_at) FROM stdin;
ec634bf1-f7f0-4b26-8159-3a28ebcacf29	0ed87797-ba2c-49c7-b764-2c43df267724	9326d800-f612-4927-8806-50ab4c1a0995	2026-03-04 06:30:14.114391+00
4438b5f3-9ae7-4ae0-96ee-a557ca979dd6	a951825b-e862-430d-b0e7-5fa29f95f7a2	ecaed6d5-5957-49e4-9880-ccfe07097203	2026-03-04 06:30:59.294151+00
\.


--
-- Data for Name: posts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.posts (id, user_id, content, media_urls, type, created_at, updated_at) FROM stdin;
ecaed6d5-5957-49e4-9880-ccfe07097203	0ed87797-ba2c-49c7-b764-2c43df267724	Coming soon...	{https://snzqqjrmthqdezozgvsp.supabase.co/storage/v1/object/public/community-media/0ed87797-ba2c-49c7-b764-2c43df267724/1772603970333-i3p1y.jpg}	post	2026-03-04 05:59:30.709084+00	2026-03-04 05:59:30.709084+00
3306fe7b-a62e-4984-af77-422f3131e60e	a951825b-e862-430d-b0e7-5fa29f95f7a2	Explore	{https://snzqqjrmthqdezozgvsp.supabase.co/storage/v1/object/public/community-media/a951825b-e862-430d-b0e7-5fa29f95f7a2/1772604060954-h3kp3.jpg}	post	2026-03-04 06:01:01.568213+00	2026-03-04 06:01:01.568213+00
9326d800-f612-4927-8806-50ab4c1a0995	a951825b-e862-430d-b0e7-5fa29f95f7a2	To Do List	{https://snzqqjrmthqdezozgvsp.supabase.co/storage/v1/object/public/community-media/a951825b-e862-430d-b0e7-5fa29f95f7a2/1772604094118-1rhfm.jpg}	post	2026-03-04 06:01:34.400579+00	2026-03-04 06:01:34.400579+00
\.


--
-- Data for Name: profile_analytics; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.profile_analytics (id, candidate_id, recruiter_id, event_type, job_id, created_at, metadata) FROM stdin;
\.


--
-- Data for Name: profile_matches; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.profile_matches (id, candidate_id, recruiter_id, match_score, reasoning_text, candidate_token, recruiter_token, match_type, created_at, updated_at) FROM stdin;
362a3081-4bb4-4a09-bda2-ab338d1fad39	a951825b-e862-430d-b0e7-5fa29f95f7a2	0ed87797-ba2c-49c7-b764-2c43df267724	92	The candidate loves learning and growing, which is exactly what the company wants.	\N	\N	profile_matching	2026-03-05 09:33:15.594495+00	2026-03-05 09:33:15.594495+00
\.


--
-- Data for Name: profile_scores; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.profile_scores (user_id, resume_score, behavioral_score, psychometric_score, skills_score, reference_score, final_score, calculated_at) FROM stdin;
a951825b-e862-430d-b0e7-5fa29f95f7a2	33	44	44	50	\N	41	2026-03-03 11:29:34.713239+00
\.


--
-- Data for Name: recruiter_assessment_questions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.recruiter_assessment_questions (id, category, driver, question_text, created_at) FROM stdin;
e91ba6c7-c22b-430f-afcf-4f5fca0af6bf	recruiter_intent	Strategic Intent	What is the primary reason your company is growing right now?	2026-02-13 10:29:04.829146+00
6700c7b2-3c1e-44cc-a403-ee2f05a259b0	recruiter_intent	Strategic Intent	What long-term vision is guiding your companyÔÇÖs current expansion decisions?	2026-02-13 10:29:04.829146+00
a2ae96f8-0d2e-4786-b0b8-8efe1d3e19bf	recruiter_intent	Strategic Intent	What problem in the market is your company fundamentally trying to solve?	2026-02-13 10:29:04.829146+00
2d9c7e6e-19b9-4a00-8fcd-22ae323e7dea	recruiter_intent	Strategic Intent	What must your company achieve in the next 12 months to consider it a successful year?	2026-02-13 10:29:04.829146+00
91fc408e-96b6-4176-bb4d-905615aee694	recruiter_intent	Strategic Intent	Why does your company exist beyond generating revenue?	2026-02-13 10:29:04.829146+00
9f3e73fd-ad61-4827-aa1b-da6666fa0d68	recruiter_intent	Strategic Intent	What makes your companyÔÇÖs direction different from competitors in your space?	2026-02-13 10:29:04.829146+00
e4fe465d-d3c7-4be1-adf3-ff7fc470299c	recruiter_intent	Strategic Intent	What internal shift or milestone triggered your current hiring activity?	2026-02-13 10:29:04.829146+00
d62f711a-b392-4f37-ac0a-39ad3988e20d	recruiter_intent	Universal DNA	What are three non-negotiable traits required to succeed in your company culture?	2026-02-13 10:29:04.829146+00
001b8940-8a0b-4d12-8c91-ab6dbac04b9a	recruiter_intent	Universal DNA	Why are those traits critical for survival in your environment?	2026-02-13 10:29:04.829146+00
f6ac80a0-1d8f-4208-84fd-c662d91b90a7	recruiter_intent	Universal DNA	What behaviours are rewarded most strongly inside your company?	2026-02-13 10:29:04.829146+00
ae7d298e-8cfb-4609-8a02-65baf2a110bc	recruiter_intent	Universal DNA	What behaviours are not tolerated in your company, regardless of performance?	2026-02-13 10:29:04.829146+00
3f59f42a-4981-4df5-a88b-7bbcc6080832	recruiter_intent	Universal DNA	What type of mindset thrives in your company?	2026-02-13 10:29:04.829146+00
99c7c068-a9da-4002-9625-4fd2ff1d93d5	recruiter_intent	Universal DNA	What type of mindset struggles in your company?	2026-02-13 10:29:04.829146+00
a714ef52-ebad-4530-a8ea-340ca1b90c47	recruiter_intent	Universal DNA	How would you describe your companyÔÇÖs operating philosophy in one sentence?	2026-02-13 10:29:04.829146+00
ced718bc-468c-4160-b14e-86475e4c7140	recruiter_intent	Strategic Intent	When facing uncertainty, what principle guides major decisions?	2026-02-13 10:29:04.829146+00
52c72b75-63eb-447e-896b-4f393a421cd0	recruiter_intent	Strategic Intent	How does your company balance speed versus perfection?	2026-02-13 10:29:04.829146+00
2d9a456b-f094-4c00-a186-527e498ff780	recruiter_intent	Strategic Intent	How are strategic priorities decided internally?	2026-02-13 10:29:04.829146+00
8ab9429f-7e8c-424b-93e1-c38afed7a60f	recruiter_intent	Universal DNA	What defines a ÔÇ£top performerÔÇØ in your companyÔÇÖs culture?	2026-02-13 10:29:04.829146+00
593e047d-caf4-4f06-b2e0-68948fed301d	recruiter_intent	Universal DNA	What company value is most tested during challenging periods?	2026-02-13 10:29:04.829146+00
98399c82-918f-49b1-bead-5cdbb98c88e2	recruiter_intent	Strategic Intent	What has been the most important strategic lesson your company has learned recently?	2026-02-13 10:29:04.829146+00
cf20deba-eb42-46f7-9fe5-d93593c19f32	recruiter_intent	Strategic Intent	What internal capability is most critical for your companyÔÇÖs long-term survival?	2026-02-13 10:29:04.829146+00
a71b6a04-9c39-461c-828d-f00f6b6a5e26	recruiter_intent	Strategic Intent	What kind of growth does your company prioritize: revenue, market share, innovation, stability, or something else?	2026-02-13 10:29:04.829146+00
f2d8289b-258a-403b-9995-cd2f05c0c931	recruiter_intent	Strategic Intent	What trade-offs is your company willing to make to achieve its goals?	2026-02-13 10:29:04.829146+00
e3b7f419-4464-4f19-baf8-1f2ad2ee02e6	recruiter_intent	Strategic Intent	What does success look like for your company three years from now?	2026-02-13 10:29:04.829146+00
57671504-a60b-49c6-9994-b5ab5640a439	recruiter_intent	Universal DNA	If someone joins your company, what must they emotionally and professionally align with to thrive?	2026-02-13 10:29:04.829146+00
298b670c-ce31-41e2-a4a5-29864d096e37	recruiter_icp	Ideal Profile	What defines an ideal candidate in your company?	2026-02-13 10:29:04.829146+00
f141a70b-91c1-4097-bdfa-6073a46fe946	recruiter_icp	Ideal Profile	What separates a top performer from an average performer in your environment?	2026-02-13 10:29:04.829146+00
10e0e025-d350-42a6-a4f1-f3f2c02c00db	recruiter_icp	Ideal Profile	What past experiences tend to predict success in your company?	2026-02-13 10:29:04.829146+00
0aef90cc-0115-415e-a10c-030be2006047	recruiter_icp	Ideal Profile	What practical skills are truly essential versus simply ÔÇ£nice to haveÔÇØ?	2026-02-13 10:29:04.829146+00
3e1a7959-5218-4194-99db-e7147c98301f	recruiter_icp	Ideal Profile	What level of autonomy do you expect from someone joining your company?	2026-02-13 10:29:04.829146+00
b4af3704-dfaf-4a9a-adbf-64ace1e85898	recruiter_icp	Ideal Profile	How do you distinguish between potential and proven ability?	2026-02-13 10:29:04.829146+00
f3834d86-9d6e-44f8-9048-08977748e691	recruiter_icp	Ideal Profile	What type of professional background aligns best with your companyÔÇÖs pace and expectations?	2026-02-13 10:29:04.829146+00
f84aa69c-cd7c-4511-a495-7d2bb29562c2	recruiter_icp	Ideal Profile	What behaviours indicate someone will succeed long-term in your organization?	2026-02-13 10:29:04.829146+00
081bcf07-076a-450e-869e-3a23acb2416c	recruiter_icp	Ideal Profile	What common hiring mistakes do companies in your industry often make?	2026-02-13 10:29:04.829146+00
de150b4e-679d-4c88-a04f-b5375cc40fb2	recruiter_icp	Ideal Profile	What unrealistic expectations do candidates sometimes have about working in your company?	2026-02-13 10:29:04.829146+00
53be0f3b-03a3-4703-91b3-49718c19b40d	recruiter_icp	Ideal Profile	What kind of learning curve should someone realistically expect in the first few months?	2026-02-13 10:29:04.829146+00
ee1dfe9a-763a-4e86-83d9-c7bd368ef7d3	recruiter_icp	Ideal Profile	What performance standards are non-negotiable in your company?	2026-02-13 10:29:04.829146+00
9fd6b16a-00b6-45d4-8ecf-7a5876f3ba29	recruiter_icp	Ideal Profile	What mindset is required to operate effectively in your company?	2026-02-13 10:29:04.829146+00
29cbc824-6614-44de-a9f8-ec8c094f5cab	recruiter_icp	Ideal Profile	How do you evaluate whether someone can handle pressure or ambiguity?	2026-02-13 10:29:04.829146+00
d7405a1a-289c-480b-bb88-01c75a716a13	recruiter_icp	Ideal Profile	What communication style works best in your organization?	2026-02-13 10:29:04.829146+00
4528a5d8-c6a6-41e3-9c23-2c70cc7cc977	recruiter_icp	Ideal Profile	What level of accountability do you expect from someone you hire?	2026-02-13 10:29:04.829146+00
d7a8d48a-7e8f-40c4-b2c5-719e4c5a1234	recruiter_icp	Ideal Profile	What early indicators tell you that someone is likely to become a high-impact contributor?	2026-02-13 10:29:04.829146+00
5e41d0d2-7763-42dc-9cbb-220a3c56d5aa	recruiter_icp	Ideal Profile	What professional habits differentiate strong contributors in your company?	2026-02-13 10:29:04.829146+00
d18e9e71-14fe-4415-80f0-cba1bb67a853	recruiter_icp	Ideal Profile	What kind of candidate would look strong on paper but struggle in your environment?	2026-02-13 10:29:04.829146+00
6c52a78f-95cb-407d-8600-6bdbb0901681	recruiter_icp	Ideal Profile	How important is cultural alignment compared to technical capability?	2026-02-13 10:29:04.829146+00
b92c2b28-6c09-4bcf-81c1-15043f1bcda0	recruiter_icp	Ideal Profile	What evidence do you look for to confirm someone can deliver results?	2026-02-13 10:29:04.829146+00
bc811bbe-fb20-4c9f-ac57-99f66a1a03c8	recruiter_icp	Ideal Profile	What type of work ethic aligns best with your company standards?	2026-02-13 10:29:04.829146+00
5d70a627-ef8e-4971-a403-002f72fa7c69	recruiter_icp	Ideal Profile	How do you assess whether someone can collaborate effectively within your culture?	2026-02-13 10:29:04.829146+00
38d754b2-4ae1-48c1-944f-0b54dcb5a298	recruiter_icp	Ideal Profile	What growth potential do you expect from someone over their first year?	2026-02-13 10:29:04.829146+00
211e2e3f-3242-442a-9f4a-b79fd07f4393	recruiter_icp	Ideal Profile	If you had to describe your ideal hire in three defining characteristics, what would they be?	2026-02-13 10:29:04.829146+00
e05c84aa-87a4-460c-be3a-cadfd0fd1559	recruiter_ethics	Ethics & Fairness	How do you ensure fairness in your hiring decisions?	2026-02-13 10:29:04.829146+00
d0738eac-2204-4b41-9877-759c9aa84c08	recruiter_ethics	Ethics & Fairness	What steps do you take to prevent bias during candidate evaluation?	2026-02-13 10:29:04.829146+00
422a5ca1-fae5-4453-a105-89b1e78763f8	recruiter_ethics	Ethics & Fairness	How do you communicate expectations clearly to candidates during the hiring process?	2026-02-13 10:29:04.829146+00
e1896ece-1854-4b84-be75-1bf13489eaf9	recruiter_ethics	Ethics & Fairness	What does a transparent hiring process look like in your company?	2026-02-13 10:29:04.829146+00
f1af14cc-64c2-460d-b644-aa04d2e290b1	recruiter_ethics	Ethics & Fairness	How do you decide which candidate moves forward at each stage?	2026-02-13 10:29:04.829146+00
e40f4c3a-973c-45db-b719-a3e7259baff5	recruiter_ethics	Ethics & Fairness	What criteria are used to evaluate candidates consistently?	2026-02-13 10:29:04.829146+00
11e23fec-3977-4a89-ae0d-73805cd82882	recruiter_ethics	Ethics & Fairness	How do you ensure candidates are treated respectfully throughout the process?	2026-02-13 10:29:04.829146+00
514a3443-39f3-4277-ac3b-a3db81e24b51	recruiter_ethics	Ethics & Fairness	What is your approach to providing feedback to candidates?	2026-02-13 10:29:04.829146+00
cf977032-602a-4cc2-8657-4f1bf41330c7	recruiter_ethics	Ethics & Fairness	How do you handle disagreements internally about a hiring decision?	2026-02-13 10:29:04.829146+00
63f818b8-e1fc-4846-b42a-7ed8b8e47d9c	recruiter_ethics	Ethics & Fairness	What safeguards exist to prevent ÔÇ£gut feelingÔÇØ decisions?	2026-02-13 10:29:04.829146+00
91172966-aea6-4f26-9af6-63a173b2ad02	recruiter_ethics	Ethics & Fairness	How do you communicate timelines and next steps to candidates?	2026-02-13 10:29:04.829146+00
8ab0ba11-584f-406f-843e-4f076d23bc8c	recruiter_ethics	Ethics & Fairness	What happens if a candidate is not selected ÔÇö how is that communicated?	2026-02-13 10:29:04.829146+00
ebbf7c0c-aae3-4c92-9eb3-7a3834f7b614	recruiter_ethics	Ethics & Fairness	How do you ensure all candidates are evaluated against the same standards?	2026-02-13 10:29:04.829146+00
a8233ce5-8afd-49e5-95fb-13479a2b6a3a	recruiter_ethics	Ethics & Fairness	What documentation or structure supports your hiring decisions?	2026-02-13 10:29:04.829146+00
ff88fb9d-cc00-4206-af1d-54a8b0b352ff	recruiter_ethics	Ethics & Fairness	How do you balance speed with fairness in hiring?	2026-02-13 10:29:04.829146+00
f698b065-7a93-423f-bb3d-1d356d2be123	recruiter_ethics	Ethics & Fairness	How do you handle confidential candidate information?	2026-02-13 10:29:04.829146+00
24528ee3-5e77-40d3-9013-dececf25b105	recruiter_ethics	Ethics & Fairness	What ethical principles guide your hiring practices?	2026-02-13 10:29:04.829146+00
00c482b0-fa30-42cb-8675-2d0f972fbbda	recruiter_ethics	Ethics & Fairness	How do you measure whether your hiring process is effective and fair?	2026-02-13 10:29:04.829146+00
27ea1544-65e2-4936-bebf-f7c9b90fb925	recruiter_ethics	Ethics & Fairness	How do you ensure equal opportunity regardless of background?	2026-02-13 10:29:04.829146+00
6f2f9d52-e88f-4ea1-8142-d7d58fd714ce	recruiter_ethics	Ethics & Fairness	What actions would you take if you discovered bias in your hiring process?	2026-02-13 10:29:04.829146+00
b20bca24-b94c-4c55-8e24-0d8d8fe0aeed	recruiter_ethics	Ethics & Fairness	How do you align hiring decisions with company values?	2026-02-13 10:29:04.829146+00
cf5c1ebe-5c7f-4776-b9d5-49f1eadc4088	recruiter_ethics	Ethics & Fairness	What does professionalism in hiring mean to you?	2026-02-13 10:29:04.829146+00
e0acb196-4bfa-4c5f-9109-3964ed981961	recruiter_ethics	Ethics & Fairness	How do you set realistic expectations about compensation and growth?	2026-02-13 10:29:04.829146+00
e3c45f2a-8afb-4288-ae58-c107183b6a1a	recruiter_ethics	Ethics & Fairness	How do you ensure candidates understand the evaluation criteria?	2026-02-13 10:29:04.829146+00
955125c2-db14-4dc0-9ca4-ed4aa1202fb0	recruiter_ethics	Ethics & Fairness	What accountability mechanisms exist if a hiring decision is later questioned?	2026-02-13 10:29:04.829146+00
9f3e8f5b-eb5c-4623-a349-19c0691d80d5	recruiter_cvp	Value Proposition	Why should a strong candidate choose your company over competitors?	2026-02-13 10:29:04.829146+00
dca6be41-678c-4e0e-894f-b68d6f8bd9a9	recruiter_cvp	Value Proposition	What long-term growth opportunities does your company offer?	2026-02-13 10:29:04.829146+00
0569fa2f-7519-4f73-980b-fbb89c682f86	recruiter_cvp	Value Proposition	What kind of professional development can someone expect in your company?	2026-02-13 10:29:04.829146+00
b2f81119-f921-4ae0-a224-0580436400a1	recruiter_cvp	Value Proposition	How does your company support skill expansion and continuous learning?	2026-02-13 10:29:04.829146+00
67da49e7-69f5-4521-8491-131793e5c3ba	recruiter_cvp	Value Proposition	What meaningful impact can someone have by joining your organization?	2026-02-13 10:29:04.829146+00
9248eba7-fe5b-438d-bc01-2932648b31ec	recruiter_cvp	Value Proposition	What exposure to leadership or strategic decisions does your company provide?	2026-02-13 10:29:04.829146+00
d2063875-d80d-4d77-894d-39a678ef4097	recruiter_cvp	Value Proposition	How does your company help individuals grow beyond their current capabilities?	2026-02-13 10:29:04.829146+00
59fb7114-ff71-4027-a67c-e339e2579654	recruiter_cvp	Value Proposition	What type of challenges can someone expect in your environment?	2026-02-13 10:29:04.829146+00
8f871a87-5f79-498a-9604-73df34b28a71	recruiter_cvp	Value Proposition	What makes your company a valuable place for career progression?	2026-02-13 10:29:04.829146+00
3060b1b4-7b52-4743-b7eb-26f6c0af42d2	recruiter_cvp	Value Proposition	How does your company recognize and reward strong performance?	2026-02-13 10:29:04.829146+00
4c2235b7-8006-4a03-ac05-3527f23ef46a	recruiter_cvp	Value Proposition	What differentiates your work environment from others in your industry?	2026-02-13 10:29:04.829146+00
4511c622-d00c-4b8f-91ce-d8c8561947a7	recruiter_cvp	Value Proposition	What kind of mentorship or guidance is available internally?	2026-02-13 10:29:04.829146+00
b2a2fd32-46d9-4353-ab2f-c1b9e3879363	recruiter_cvp	Value Proposition	How does your company support long-term career development?	2026-02-13 10:29:04.829146+00
6653b7aa-f120-497a-abd6-0f2d2611386e	recruiter_cvp	Value Proposition	What internal mobility or advancement opportunities exist?	2026-02-13 10:29:04.829146+00
d0ae6485-96dc-478d-9247-72600e86e904	recruiter_cvp	Value Proposition	What type of projects or initiatives provide meaningful learning experiences?	2026-02-13 10:29:04.829146+00
212b42ed-8a62-4a13-91ea-5f398a0dc04b	recruiter_cvp	Value Proposition	How does your company foster innovation or creative contribution?	2026-02-13 10:29:04.829146+00
d6a1392f-8ad5-4fc5-ab61-70de52622178	recruiter_cvp	Value Proposition	What cultural strengths make your company attractive to ambitious professionals?	2026-02-13 10:29:04.829146+00
cd76c081-91e8-4a83-a59c-8a042e041faa	recruiter_cvp	Value Proposition	How does your company ensure employees feel valued?	2026-02-13 10:29:04.829146+00
543249e7-4ab3-4ff9-b053-d99f52e51265	recruiter_cvp	Value Proposition	What kind of professional network exposure does your company provide?	2026-02-13 10:29:04.829146+00
1ea2148f-cc60-4ad0-913f-73872be3e2c1	recruiter_cvp	Value Proposition	How does your company balance performance expectations with personal development?	2026-02-13 10:29:04.829146+00
42b6ddbf-0e0a-47f7-a12b-75c05d82f236	recruiter_cvp	Value Proposition	What makes your company a place where people build lasting careers?	2026-02-13 10:29:04.829146+00
78db74ad-7e06-4926-b099-130ede2d0cd9	recruiter_cvp	Value Proposition	What kind of autonomy does someone gain over time in your organization?	2026-02-13 10:29:04.829146+00
25fd595c-13d4-4558-8aa2-84c5844fb892	recruiter_cvp	Value Proposition	How does your company invest in employee capability building?	2026-02-13 10:29:04.829146+00
e7bcd156-6054-4f54-a87d-b96069d7e06c	recruiter_cvp	Value Proposition	What long-term value does someone gain from spending several years at your company?	2026-02-13 10:29:04.829146+00
2a95bd5c-aca7-4cd4-a3e6-ff9181150212	recruiter_cvp	Value Proposition	If someone leaves your company after a few years, what should they have gained professionally?	2026-02-13 10:29:04.829146+00
47b377eb-7072-4dd5-bd05-a5260146c489	recruiter_ownership	Decision-Making	Who ultimately owns hiring decisions in your company?	2026-02-13 10:29:04.829146+00
a864903e-ad6f-4d3e-9097-cf47ac2c0f39	recruiter_ownership	Decision-Making	How are final decisions made when multiple stakeholders are involved?	2026-02-13 10:29:04.829146+00
53c9227d-36c1-4feb-81c0-1b3af36a6379	recruiter_ownership	Decision-Making	What prevents hiring decisions from becoming delayed or bureaucratic?	2026-02-13 10:29:04.829146+00
42e72d0e-67db-49f0-9ee1-aae1f2ce374b	recruiter_ownership	Decision-Making	How do you ensure accountability in the hiring process?	2026-02-13 10:29:04.829146+00
60a60711-9288-4766-bfc2-cae4011d0b7a	recruiter_ownership	Decision-Making	What is your expected timeline from initial conversation to final decision?	2026-02-13 10:29:04.829146+00
ae865540-ca98-4ba4-9db5-45c360f31e15	recruiter_ownership	Decision-Making	How do you handle situations where decision-makers disagree?	2026-02-13 10:29:04.829146+00
2673a96d-dca6-4964-8168-2c5f6a3b58ed	recruiter_ownership	Decision-Making	What level of authority do hiring managers have in your company?	2026-02-13 10:29:04.829146+00
0e7de9d1-8331-45fe-b90c-2fc653aaf656	recruiter_ownership	Decision-Making	How do you prevent indecision during the hiring process?	2026-02-13 10:29:04.829146+00
452dc7e0-d599-4c31-87aa-4d7347c7cde1	recruiter_ownership	Decision-Making	What happens if a hiring decision turns out to be incorrect?	2026-02-13 10:29:04.829146+00
d6286475-255f-4c2d-80fb-a0f5a0329eef	recruiter_ownership	Decision-Making	How do you ensure follow-through after a hiring decision is made?	2026-02-13 10:29:04.829146+00
af6b06cd-a866-4773-bcb3-7eb4f58228be	recruiter_ownership	Decision-Making	What signals internally that a decision must be made quickly?	2026-02-13 10:29:04.829146+00
b2080a83-ba5b-4281-aa8d-43d6dc765068	recruiter_ownership	Decision-Making	How does your company balance speed and thoroughness in decision-making?	2026-02-13 10:29:04.829146+00
3fd38e8c-0556-414d-b330-b9b4261640ed	recruiter_ownership	Decision-Making	Who is responsible for communicating the final outcome to candidates?	2026-02-13 10:29:04.829146+00
1b47e7ec-68aa-42af-9063-f39240c9cfb8	recruiter_ownership	Decision-Making	How do you track accountability for hiring outcomes?	2026-02-13 10:29:04.829146+00
5c533b03-ec71-48fc-a55e-629a1bef2bed	recruiter_ownership	Decision-Making	What escalation process exists if hiring stalls?	2026-02-13 10:29:04.829146+00
18b3f59e-fcfb-4655-b23f-2c4391574391	recruiter_ownership	Decision-Making	How transparent is the decision-making chain in your organization?	2026-02-13 10:29:04.829146+00
62bbbb12-3d57-4dd0-a0c6-5cb385641f03	recruiter_ownership	Decision-Making	How do you define ownership within your company culture?	2026-02-13 10:29:04.829146+00
f6ffc06c-eb59-4a0b-bb04-918d0ab1194a	recruiter_ownership	Decision-Making	What distinguishes a decisive leader in your organization?	2026-02-13 10:29:04.829146+00
acf9d71b-1cc7-4cec-aa3b-905ff139605b	recruiter_ownership	Decision-Making	How are responsibilities clearly assigned during hiring?	2026-02-13 10:29:04.829146+00
57759f3a-ec5d-411d-903a-6f00dda7ee70	recruiter_ownership	Decision-Making	How do you prevent responsibility from becoming diffused across teams?	2026-02-13 10:29:04.829146+00
d111aa1c-b2c7-4c0c-9089-66d1666d5637	recruiter_ownership	Decision-Making	What role does data play in your hiring decisions?	2026-02-13 10:29:04.829146+00
9c7b1097-cabe-4563-a721-28bddb5cb02a	recruiter_ownership	Decision-Making	How does your company handle risk when making hiring choices?	2026-02-13 10:29:04.829146+00
b344af75-0184-4253-8c0b-34eaebe27075	recruiter_ownership	Decision-Making	What internal metric defines a successful hiring decision?	2026-02-13 10:29:04.829146+00
7ebd2ee6-5e3c-4d36-a313-e3aeb1fa2f04	recruiter_ownership	Decision-Making	How do you ensure alignment between leadership and hiring decisions?	2026-02-13 10:29:04.829146+00
f6b9b5b4-f738-4c23-a5b9-666dbe778512	recruiter_ownership	Decision-Making	When a difficult hiring call must be made, what principle guides the final decision?	2026-02-13 10:29:04.829146+00
\.


--
-- Data for Name: recruiter_assessment_responses; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.recruiter_assessment_responses (id, user_id, question_text, answer_text, category, relevance_score, specificity_score, clarity_score, ownership_score, average_score, created_at, evaluation_metadata) FROM stdin;
00aa6970-d63e-4091-9c7e-fdf414f95d76	0ed87797-ba2c-49c7-b764-2c43df267724	What makes your companyÔÇÖs direction different from competitors in your space?	Our companys direction is different from competitors, because we give the candidate clear picture of what we are working on and whom we are working to and also they will be the face of the company, they will get recognition and appriciation for their work which will motivate them to work and grow. We provide them a learning opportunity apart from their fields so that they can learn things they are interested.	recruiter_intent	3	3	3	3	3.00	2026-03-03 09:03:15.071117+00	{}
374aa500-706b-4918-839e-d69d2cf40fa7	0ed87797-ba2c-49c7-b764-2c43df267724	What early indicators tell you that someone is likely to become a high-impact contributor?	The early indicator we consider is trust, attitude and behaviour. these three are most important for a person to grow and succed. Only if they can grow then they can contribute to our growth.	recruiter_icp	3	3	3	3	3.00	2026-03-03 09:04:49.464188+00	{}
1297896b-3384-44cf-bd9d-bc5d6264c979	0ed87797-ba2c-49c7-b764-2c43df267724	What actions would you take if you discovered bias in your hiring process?	We have a structured hiring process and we will keep track of the each step in and hiring also we verify it whether it is followed or not.	recruiter_ethics	3	3	3	3	3.00	2026-03-03 09:06:01.776395+00	{}
e680cc55-d58a-4b12-a87e-446688ff2aee	0ed87797-ba2c-49c7-b764-2c43df267724	What cultural strengths make your company attractive to ambitious professionals?	Adaptiveness, activelistening, learning attitude, and growing mindset	recruiter_cvp	3	3	3	3	3.00	2026-03-03 09:06:55.544292+00	{}
f1e05d8f-3e34-4a87-90e8-6859122676b0	0ed87797-ba2c-49c7-b764-2c43df267724	How are final decisions made when multiple stakeholders are involved?	Hiring managers and senior managers	recruiter_ownership	3	3	3	3	3.00	2026-03-03 09:07:39.214378+00	{}
\.


--
-- Data for Name: recruiter_profiles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.recruiter_profiles (user_id, company_id, assessment_status, created_at, onboarding_step, warning_count, full_name, job_title, phone_number, linkedin_url, completion_score, updated_at, terms_accepted, account_status, bio, team_role, is_admin, identity_proof_path, identity_verified, professional_persona) FROM stdin;
0ed87797-ba2c-49c7-b764-2c43df267724	9c58a67f-cac2-4221-8403-c5389daaa2c9	completed	2026-03-03 08:58:14.616245+00	COMPLETED	0	Prathap J	Recruiter	9880957981	https://www.linkedin.com/in/mithunmk13/	100	2026-03-03 08:58:14.616245+00	f	Active		admin	f	\N	f	{}
\.


--
-- Data for Name: recruiter_settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.recruiter_settings (user_id, email_notifications, web_notifications, mobile_notifications, profile_visibility, language, timezone, created_at, updated_at, ghost_mode) FROM stdin;
0ed87797-ba2c-49c7-b764-2c43df267724	f	f	f	public	en	UTC	2026-03-03 08:58:14.616245+00	2026-03-04 08:53:57.249427+00	f
\.


--
-- Data for Name: resume_data; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.resume_data (user_id, raw_text, timeline, career_gaps, achievements, skills, education, parsed_at, raw_education, raw_experience, raw_projects) FROM stdin;
a951825b-e862-430d-b0e7-5fa29f95f7a2	--- Page 1 ---\nGOKULA KANNAN N\n\nPh.no: +91 9042716020 | Mail - kannangokul312@gmail.com | LinkedIn\n\nLocation: Madurai, Tamil Nadu, India.\n\nObjective\nCloud-focused Business Development professional with 4+ years of experience in IT\nservices, client acquisition, pre-sales, and solution selling. Strong exposure to cloud\nfundamentals and SaaS solutions, currently expanding hands-on knowledge in AWS, Linux,\nDocker, and DevOps tools to bridge business and technology for scalable solutions. Actively\nexploring opportunities in cloud-aligned business development, pre-sales, and customer\nsuccess roles where I can contribute immediately and continue learning.\n\nKey Skills\nÔÇó Client Engagement & Requirement Gathering\nÔÇó Cloud Solutions Awareness (AWS, SaaS)\nÔÇó Pre-Sales Support & Proposal Drafting\nÔÇó Revenue & Target Achievement\nÔÇó Collaboration with Technical Teams\nÔÇó AWS Basics, Linux Fundamentals\nÔÇó Git/GitHub & Docker (Learning)\nÔÇó SaaS Platforms: Office 365, Teams, SharePoint\n\nProfessional Experience\n\nSenior Business Development Executive\nPlurance Technologies Pvt Ltd ÔÇô Madurai | Dec 2024 ÔÇô Present\n\nÔÇó Supported the sales team by managing client communication and coordinating order\n requirements.\nÔÇó Prepared detailed business proposals and quotations to address client needs.\nÔÇó Handled customer queries and provided timely solutions, ensuring satisfaction.\nÔÇó Collaborated with cross-functional teams to streamline order processing and reporting.\n\nSenior Business Development Executive\nClarisco Solutions ÔÇô Madurai | Jul 2023 ÔÇô May 2024\n\nÔÇó Coordinated with clients and internal teams to prepare quotations and proposals.\nÔÇó Responded to customer inquiries, ensuring prompt and accurate communication.\n--- Page 2 ---\nÔÇó Tracked sales leads, maintained reports, and supported decision-making with data\n insights.\nÔÇó Assisted the sales team in scheduling meetings and preparing client presentations.\n\nBusiness Development Executive\nWeAlwin Technologies ÔÇô Madurai | Mar 2022 ÔÇô Jul 2023\n\nÔÇó Handled customer queries and coordinated order requirements from initiation to\n delivery.\nÔÇó Prepared quotations and proposals, securing new client partnerships.\nÔÇó Supported the sales team in daily operations, improving efficiency and client\n engagement.\nÔÇó Maintained sales documentation and reports for management review.\n\nEducation\nÔÇó MBA ÔÇô Business Administration, Madurai Kamaraj University (2022 ÔÇô 2024)\nÔÇó B.E. ÔÇô Computer Science & Engineering, Sethu Institute of Technology (2016 ÔÇô 2020)\n\nTechnical Exposure\nÔÇó Cloud: AWS (EC2, S3, IAM ÔÇô basics)\nÔÇó Linux Fundamentals\nÔÇó Git & GitHub\nÔÇó Docker Basics\nÔÇó CI/CD Concepts (Jenkins / GitHub Actions ÔÇô learning)\n\nAwards\nBest Outstanding Performer Award\nThe Deal Maker Award\n\nLanguages\nTamil (Native)\nEnglish (Professional)	\N	\N	\N	\N	\N	2026-03-03 11:19:20.27099+00	\N	\N	\N
\.


--
-- Data for Name: saved_jobs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.saved_jobs (id, candidate_id, job_id, created_at) FROM stdin;
da6dcbda-a1e5-4f8b-a636-cad105a10882	a951825b-e862-430d-b0e7-5fa29f95f7a2	1b23c92d-a10b-4a0e-9623-e5fb97d3290f	2026-03-06 05:39:20.87793+00
\.


--
-- Data for Name: skill_catalog; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.skill_catalog (id, name, experience_band, occurrence_count, is_verified, last_seen_at, created_at) FROM stdin;
3dc684e6-8d5e-4969-972f-9d1d8ef55717	Cold Outbound (Email/Phone)	fresher	1	t	2026-02-28 07:47:28.878187+00	2026-02-28 07:47:28.878187+00
bd87e645-2e2c-4f87-8e14-6b586de0fb40	Lead Research & Sourcing	fresher	1	t	2026-02-28 07:47:28.878187+00	2026-02-28 07:47:28.878187+00
effd9423-ebd0-48d6-9297-07d674637f5b	LinkedIn Sales Navigator	fresher	1	t	2026-02-28 07:47:28.878187+00	2026-02-28 07:47:28.878187+00
84f4e380-6704-423e-9cf6-d33a51a39595	CRM Hygiene (Salesforce/HubSpot)	fresher	1	t	2026-02-28 07:47:28.878187+00	2026-02-28 07:47:28.878187+00
10a253f9-ba10-4416-a76b-bc41f079e200	Objection Handling	fresher	1	t	2026-02-28 07:47:28.878187+00	2026-02-28 07:47:28.878187+00
9ba2e251-36cb-431f-8e3b-2c7ec6ab2cf8	Discovery Call Basics	fresher	1	t	2026-02-28 07:47:28.878187+00	2026-02-28 07:47:28.878187+00
94b149c0-6141-4215-8ec4-444214ad78cd	Time Management	fresher	1	t	2026-02-28 07:47:28.878187+00	2026-02-28 07:47:28.878187+00
9d4bc5c4-c188-43ee-8ea4-6eca4803bd87	Ideal Customer Profile Identification	fresher	1	t	2026-02-28 07:47:28.878187+00	2026-02-28 07:47:28.878187+00
9d0c6b77-bd64-47ab-a394-edad2d2c7cf6	BDR/SDR Workflow	fresher	1	t	2026-02-28 07:47:28.878187+00	2026-02-28 07:47:28.878187+00
6d2ebd58-9b48-40bb-a565-5e1b718939d3	Active Listening	fresher	1	t	2026-02-28 07:47:28.878187+00	2026-02-28 07:47:28.878187+00
2692f3c5-6172-434c-9fb3-36564df221fd	SaaS Product Demoing	mid	1	t	2026-02-28 07:47:28.878187+00	2026-02-28 07:47:28.878187+00
d6d5e749-d3ed-4bc1-bc2e-ddf689e96ac3	MEDDIC / MEDDPICC Methodology	mid	1	t	2026-02-28 07:47:28.878187+00	2026-02-28 07:47:28.878187+00
4e9bc68e-3981-49ec-bcd6-21a637d7d443	Solution Selling	mid	1	t	2026-02-28 07:47:28.878187+00	2026-02-28 07:47:28.878187+00
fbb90d1c-bb4c-4fcb-a507-6311d982c409	Pipeline Forecasting	mid	1	t	2026-02-28 07:47:28.878187+00	2026-02-28 07:47:28.878187+00
cf17a1fc-59b2-453c-b1c9-7de4d8bd15a7	ROI & Business Case Mapping	mid	1	t	2026-02-28 07:47:28.878187+00	2026-02-28 07:47:28.878187+00
2740dbba-b101-4feb-ac69-8d366c2b2409	Multi-threading	mid	1	t	2026-02-28 07:47:28.878187+00	2026-02-28 07:47:28.878187+00
e5517de5-fffc-4701-9160-746e974336fd	Contract Negotiation	mid	1	t	2026-02-28 07:47:28.878187+00	2026-02-28 07:47:28.878187+00
80b21084-9886-4412-ad45-7630dd28f78a	Account Mapping	mid	1	t	2026-02-28 07:47:28.878187+00	2026-02-28 07:47:28.878187+00
c7ac72c4-20e0-4570-8bad-585ec0806deb	Gap Analysis	mid	1	t	2026-02-28 07:47:28.878187+00	2026-02-28 07:47:28.878187+00
7f1e386f-ae20-405e-a933-50482f6e86d1	Competitive Intelligence	mid	1	t	2026-02-28 07:47:28.878187+00	2026-02-28 07:47:28.878187+00
3bdaea1e-d242-400d-b3ef-18625bbd48ec	Enterprise Account Planning	senior	1	t	2026-02-28 07:47:28.878187+00	2026-02-28 07:47:28.878187+00
6a5a1e92-9c76-4d25-ba7a-01a7b5f37ab0	C-Suite Stakeholder Management	senior	1	t	2026-02-28 07:47:28.878187+00	2026-02-28 07:47:28.878187+00
f979a39b-1efb-4873-8d29-cc7277f78dbe	Complex Deal Orchestration	senior	1	t	2026-02-28 07:47:28.878187+00	2026-02-28 07:47:28.878187+00
df349e6e-c92f-4aca-a43e-038edff5047a	Strategic Global Partnerships	senior	1	t	2026-02-28 07:47:28.878187+00	2026-02-28 07:47:28.878187+00
6d362d85-90e0-4dbc-876c-1600778ac2bb	TCO (Total Cost of Ownership) Modeling	senior	1	t	2026-02-28 07:47:28.878187+00	2026-02-28 07:47:28.878187+00
0153cb6c-5f73-4e81-80a2-7fffd7305dc5	Territory Management & Strategy	senior	1	t	2026-02-28 07:47:28.878187+00	2026-02-28 07:47:28.878187+00
8a6499e6-4ef7-463f-ab69-a30f6997ed27	Value-Based Selling	senior	1	t	2026-02-28 07:47:28.878187+00	2026-02-28 07:47:28.878187+00
43ac79d6-7ef4-4eca-95f2-18f3b101c7cc	Sales Engineering Collaboration	senior	1	t	2026-02-28 07:47:28.878187+00	2026-02-28 07:47:28.878187+00
9a790100-bbcb-487f-b94a-f4b0e02d05e0	Change Management Selling	senior	1	t	2026-02-28 07:47:28.878187+00	2026-02-28 07:47:28.878187+00
56f435bc-2001-4bbe-9c7a-65fac9e83315	Account-Based Marketing (ABM)	senior	1	t	2026-02-28 07:47:28.878187+00	2026-02-28 07:47:28.878187+00
4a2418bf-ea8c-4505-bc47-88f0a74de96a	GTM (Go-to-Market) Strategy	leadership	1	t	2026-02-28 07:47:28.878187+00	2026-02-28 07:47:28.878187+00
52414431-554d-45f5-aeda-860004916ddd	Revenue Operations (RevOps)	leadership	1	t	2026-02-28 07:47:28.878187+00	2026-02-28 07:47:28.878187+00
f2578778-fa3e-4651-8ee7-f3146ae4c332	Sales Playbook Development	leadership	1	t	2026-02-28 07:47:28.878187+00	2026-02-28 07:47:28.878187+00
a9b592a0-bb6e-442b-b702-29cb0716a940	Compensation Plan Design	leadership	1	t	2026-02-28 07:47:28.878187+00	2026-02-28 07:47:28.878187+00
1951df9f-c743-4127-b7b1-981ebde20561	Sales Recruitment & Training	leadership	1	t	2026-02-28 07:47:28.878187+00	2026-02-28 07:47:28.878187+00
694ef9fb-6bd6-446f-8dc7-691c8e0622ee	P&L Responsibility	leadership	1	t	2026-02-28 07:47:28.878187+00	2026-02-28 07:47:28.878187+00
c4d17f3e-4ab8-40a2-a147-2aff0b394006	Executive Relationship Building	leadership	1	t	2026-02-28 07:47:28.878187+00	2026-02-28 07:47:28.878187+00
41c01c76-5750-45c6-91df-78fb782e2522	Sales Mentorship & Coaching	leadership	1	t	2026-02-28 07:47:28.878187+00	2026-02-28 07:47:28.878187+00
4f483dd2-2195-4248-b5c0-c55fb6f7b852	Sales Tech Stack Optimization	leadership	1	t	2026-02-28 07:47:28.878187+00	2026-02-28 07:47:28.878187+00
d68ae4d1-294c-478b-bd07-e72ef989f330	Scaling High-Performance Teams	leadership	1	t	2026-02-28 07:47:28.878187+00	2026-02-28 07:47:28.878187+00
e7b03bff-b6a9-4923-bd8a-b4440fa1958e	Cold calling/Outbond	senior	1	t	2026-03-02 05:57:52.377849+00	2026-03-02 05:57:52.377849+00
af9e12d1-8de7-418d-8b5d-1c27eb46c57f	Market research expertise	senior	1	t	2026-03-02 05:57:52.487603+00	2026-03-02 05:57:52.487603+00
e9867d4a-0597-42d7-98e0-6ef66945c041	CRM	senior	1	t	2026-03-02 05:57:52.569851+00	2026-03-02 05:57:52.569851+00
ceccdb29-0737-401b-bff0-94fe9d76b13a	Email Drafting	senior	1	t	2026-03-02 05:57:52.67099+00	2026-03-02 05:57:52.67099+00
3a348389-893f-4a9b-82b8-c9659a5c4dd8	Negotiation	senior	1	t	2026-03-02 05:57:52.752696+00	2026-03-02 05:57:52.752696+00
02e0dedf-e7ad-44ad-8568-fc60cf6ad6cc	Client relationship management	senior	1	t	2026-03-02 05:57:52.839674+00	2026-03-02 05:57:52.839674+00
ee4baeec-31f2-4ce8-8cdb-e481ae0db4d6	Client management	senior	1	t	2026-03-02 05:57:52.924634+00	2026-03-02 05:57:52.924634+00
b691a282-f442-4ad9-bb05-342698eb9a4f	Strategic sales planning	senior	1	t	2026-03-02 05:57:53.005679+00	2026-03-02 05:57:53.005679+00
96fb57cc-4c56-4c90-8372-3d0afd7abe32	Understanding IT roles and technologies	senior	1	t	2026-03-02 05:57:53.089257+00	2026-03-02 05:57:53.089257+00
40984f8d-45e3-4ae6-b752-b6a3c59c70fa	Lead generation	senior	1	t	2026-03-02 05:57:53.168393+00	2026-03-02 05:57:53.168393+00
8a988338-e752-4ca0-a0dd-1e31ffa01ccb	Client Engagement & Requirement Gathering	mid	1	t	2026-03-02 06:44:14.54957+00	2026-03-02 06:44:14.54957+00
fd19c040-4160-4fac-9751-ec1202661c12	Cloud Solutions Awareness (AWS, SaaS)	mid	1	t	2026-03-02 06:44:14.670875+00	2026-03-02 06:44:14.670875+00
aaae0ef3-c327-47f8-962b-50f2876c9707	Pre-Sales Support & Proposal Drafting	mid	1	t	2026-03-02 06:44:14.76755+00	2026-03-02 06:44:14.76755+00
5d8b8834-c027-4fa0-b755-e46e204bc9f1	Revenue & Target Achievement	mid	1	t	2026-03-02 06:44:14.874029+00	2026-03-02 06:44:14.874029+00
0a2554fd-daa5-481e-99e9-3e9ec36d85dc	Collaboration with Technical Teams	mid	1	t	2026-03-02 06:44:14.968696+00	2026-03-02 06:44:14.968696+00
52b16297-af87-4de7-b9d9-09eaa05cd2d4	AWS Basics	mid	1	t	2026-03-02 06:44:15.06975+00	2026-03-02 06:44:15.06975+00
e03e4ab4-6e6e-404b-b870-863680016aa3	Linux Fundamentals	mid	1	t	2026-03-02 06:44:15.156356+00	2026-03-02 06:44:15.156356+00
d705d3fa-898f-4afa-8028-f1b2e1a87ee3	Git/GitHub	mid	1	t	2026-03-02 06:44:15.242365+00	2026-03-02 06:44:15.242365+00
405756b2-bd79-4957-b113-c7e75a952144	Docker	mid	1	t	2026-03-02 06:44:15.326956+00	2026-03-02 06:44:15.326956+00
fc7a619f-3b54-465a-9ec5-80081bdb7651	SaaS Platforms: Office 365, Teams, SharePoint	mid	1	t	2026-03-02 06:44:15.411866+00	2026-03-02 06:44:15.411866+00
\.


--
-- Data for Name: team_invitations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.team_invitations (id, company_id, inviter_id, email, status, created_at, expires_at) FROM stdin;
\.


--
-- Data for Name: user_pinned_posts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_pinned_posts (user_id, post_id, pinned_at) FROM stdin;
a951825b-e862-430d-b0e7-5fa29f95f7a2	9326d800-f612-4927-8806-50ab4c1a0995	2026-03-04 06:01:52.923154+00
a951825b-e862-430d-b0e7-5fa29f95f7a2	ecaed6d5-5957-49e4-9880-ccfe07097203	2026-03-04 06:01:58.981922+00
0ed87797-ba2c-49c7-b764-2c43df267724	3306fe7b-a62e-4984-af77-422f3131e60e	2026-03-04 06:03:14.508403+00
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, role, email, created_at) FROM stdin;
1666db26-badd-49a1-a54f-bcdd6b4798a6	recruiter	recruiter@talentcore.io	2026-02-24 19:50:59.972847+00
4a97fe8b-881a-4925-95c0-3496c700e93b	recruiter	anusha.hm@aitsp.in	2026-02-25 05:03:47.296796+00
b6c8ff41-a96a-4af7-b3be-e050fcdd7e24	candidate	anu239157@gmail.com	2026-02-25 05:41:30.293629+00
a951825b-e862-430d-b0e7-5fa29f95f7a2	candidate	mithunkaveriappa13@gmail.com	2026-02-24 17:26:24.832542+00
1a3df2b8-348d-4fe8-b8cd-af9ce068c68f	recruiter	santhosh@aitsp.in	2026-02-25 12:05:53.050423+00
0ed87797-ba2c-49c7-b764-2c43df267724	recruiter	prathap.j@aitsp.in	2026-02-26 05:38:28.592834+00
c7a57afc-b16c-4135-837c-75eb2aab5348	candidate	mithunkaveriappa.mk@gmail.com	2026-02-26 06:57:07.852624+00
e4154a4d-939f-450d-a000-6c21f8d378a7	candidate	aitspaap@gmail.com	2026-02-26 11:34:41.496204+00
eaad8850-3e5f-41f3-9f73-e6f6155bcb91	candidate	nagmak5055@gmail.com	2026-02-27 10:02:51.894036+00
8622864c-0f25-4ce9-90b1-a83ac5a569e0	candidate	aitsprecruitment@gmail.com	2026-02-28 05:07:59.45928+00
c32e36c5-f2ed-40ba-a0a2-7819b7721290	candidate	mithunmk374@gmail.com	2026-03-02 04:58:36.710824+00
d9729c41-46da-4560-99b9-f0012f5f5cb3	admin	admin@talentflow.com	2026-03-06 08:48:46.764213+00
\.


--
-- Name: assessment_questions assessment_questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessment_questions
    ADD CONSTRAINT assessment_questions_pkey PRIMARY KEY (id);


--
-- Name: assessment_responses assessment_responses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessment_responses
    ADD CONSTRAINT assessment_responses_pkey PRIMARY KEY (id);


--
-- Name: assessment_sessions assessment_sessions_candidate_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessment_sessions
    ADD CONSTRAINT assessment_sessions_candidate_id_key UNIQUE (candidate_id);


--
-- Name: assessment_sessions assessment_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessment_sessions
    ADD CONSTRAINT assessment_sessions_pkey PRIMARY KEY (id);


--
-- Name: blocked_users blocked_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blocked_users
    ADD CONSTRAINT blocked_users_pkey PRIMARY KEY (user_id);


--
-- Name: candidate_job_sync candidate_job_sync_candidate_id_job_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidate_job_sync
    ADD CONSTRAINT candidate_job_sync_candidate_id_job_id_key UNIQUE (candidate_id, job_id);


--
-- Name: candidate_job_sync candidate_job_sync_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidate_job_sync
    ADD CONSTRAINT candidate_job_sync_pkey PRIMARY KEY (id);


--
-- Name: candidate_profiles candidate_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidate_profiles
    ADD CONSTRAINT candidate_profiles_pkey PRIMARY KEY (user_id);


--
-- Name: candidate_settings candidate_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidate_settings
    ADD CONSTRAINT candidate_settings_pkey PRIMARY KEY (user_id);


--
-- Name: career_gps career_gps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.career_gps
    ADD CONSTRAINT career_gps_pkey PRIMARY KEY (id);


--
-- Name: career_milestones career_milestones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.career_milestones
    ADD CONSTRAINT career_milestones_pkey PRIMARY KEY (id);


--
-- Name: chat_messages chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_pkey PRIMARY KEY (id);


--
-- Name: chat_reports chat_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_reports
    ADD CONSTRAINT chat_reports_pkey PRIMARY KEY (id);


--
-- Name: chat_threads chat_threads_candidate_id_recruiter_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_threads
    ADD CONSTRAINT chat_threads_candidate_id_recruiter_id_key UNIQUE (candidate_id, recruiter_id);


--
-- Name: chat_threads chat_threads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_threads
    ADD CONSTRAINT chat_threads_pkey PRIMARY KEY (id);


--
-- Name: companies companies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_pkey PRIMARY KEY (id);


--
-- Name: companies companies_registration_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_registration_number_key UNIQUE (registration_number);


--
-- Name: follows follows_follower_id_following_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.follows
    ADD CONSTRAINT follows_follower_id_following_id_key UNIQUE (follower_id, following_id);


--
-- Name: follows follows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.follows
    ADD CONSTRAINT follows_pkey PRIMARY KEY (id);


--
-- Name: interview_slots interview_slots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interview_slots
    ADD CONSTRAINT interview_slots_pkey PRIMARY KEY (id);


--
-- Name: interviews interviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interviews
    ADD CONSTRAINT interviews_pkey PRIMARY KEY (id);


--
-- Name: job_application_status_history job_application_status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_application_status_history
    ADD CONSTRAINT job_application_status_history_pkey PRIMARY KEY (id);


--
-- Name: job_applications job_applications_job_id_candidate_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_applications
    ADD CONSTRAINT job_applications_job_id_candidate_id_key UNIQUE (job_id, candidate_id);


--
-- Name: job_applications job_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_applications
    ADD CONSTRAINT job_applications_pkey PRIMARY KEY (id);


--
-- Name: job_views job_views_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_views
    ADD CONSTRAINT job_views_pkey PRIMARY KEY (id);


--
-- Name: jobs jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: post_comments post_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_comments
    ADD CONSTRAINT post_comments_pkey PRIMARY KEY (id);


--
-- Name: post_likes post_likes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_likes
    ADD CONSTRAINT post_likes_pkey PRIMARY KEY (id);


--
-- Name: post_likes post_likes_user_id_post_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_likes
    ADD CONSTRAINT post_likes_user_id_post_id_key UNIQUE (user_id, post_id);


--
-- Name: posts posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_pkey PRIMARY KEY (id);


--
-- Name: profile_analytics profile_analytics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_analytics
    ADD CONSTRAINT profile_analytics_pkey PRIMARY KEY (id);


--
-- Name: profile_matches profile_matches_candidate_id_recruiter_id_match_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_matches
    ADD CONSTRAINT profile_matches_candidate_id_recruiter_id_match_type_key UNIQUE (candidate_id, recruiter_id, match_type);


--
-- Name: profile_matches profile_matches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_matches
    ADD CONSTRAINT profile_matches_pkey PRIMARY KEY (id);


--
-- Name: profile_scores profile_scores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_scores
    ADD CONSTRAINT profile_scores_pkey PRIMARY KEY (user_id);


--
-- Name: recruiter_assessment_questions recruiter_assessment_questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recruiter_assessment_questions
    ADD CONSTRAINT recruiter_assessment_questions_pkey PRIMARY KEY (id);


--
-- Name: recruiter_assessment_responses recruiter_assessment_responses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recruiter_assessment_responses
    ADD CONSTRAINT recruiter_assessment_responses_pkey PRIMARY KEY (id);


--
-- Name: recruiter_profiles recruiter_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recruiter_profiles
    ADD CONSTRAINT recruiter_profiles_pkey PRIMARY KEY (user_id);


--
-- Name: recruiter_settings recruiter_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recruiter_settings
    ADD CONSTRAINT recruiter_settings_pkey PRIMARY KEY (user_id);


--
-- Name: resume_data resume_data_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resume_data
    ADD CONSTRAINT resume_data_pkey PRIMARY KEY (user_id);


--
-- Name: saved_jobs saved_jobs_candidate_id_job_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_jobs
    ADD CONSTRAINT saved_jobs_candidate_id_job_id_key UNIQUE (candidate_id, job_id);


--
-- Name: saved_jobs saved_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_jobs
    ADD CONSTRAINT saved_jobs_pkey PRIMARY KEY (id);


--
-- Name: skill_catalog skill_catalog_name_experience_band_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skill_catalog
    ADD CONSTRAINT skill_catalog_name_experience_band_key UNIQUE (name, experience_band);


--
-- Name: skill_catalog skill_catalog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skill_catalog
    ADD CONSTRAINT skill_catalog_pkey PRIMARY KEY (id);


--
-- Name: team_invitations team_invitations_company_id_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_invitations
    ADD CONSTRAINT team_invitations_company_id_email_key UNIQUE (company_id, email);


--
-- Name: team_invitations team_invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_invitations
    ADD CONSTRAINT team_invitations_pkey PRIMARY KEY (id);


--
-- Name: user_pinned_posts user_pinned_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_pinned_posts
    ADD CONSTRAINT user_pinned_posts_pkey PRIMARY KEY (user_id, post_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_candidate_certs; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_candidate_certs ON public.candidate_profiles USING gin (certifications);


--
-- Name: idx_candidate_pool_filter; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_candidate_pool_filter ON public.candidate_profiles USING btree (assessment_status, experience);


--
-- Name: idx_candidate_skills; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_candidate_skills ON public.candidate_profiles USING gin (skills);


--
-- Name: idx_chat_messages_thread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_messages_thread ON public.chat_messages USING btree (thread_id);


--
-- Name: idx_chat_threads_candidate; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_threads_candidate ON public.chat_threads USING btree (candidate_id);


--
-- Name: idx_chat_threads_recruiter; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_threads_recruiter ON public.chat_threads USING btree (recruiter_id);


--
-- Name: idx_follows_follower; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_follows_follower ON public.follows USING btree (follower_id);


--
-- Name: idx_follows_following; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_follows_following ON public.follows USING btree (following_id);


--
-- Name: idx_interview_slots_interview_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_interview_slots_interview_id ON public.interview_slots USING btree (interview_id);


--
-- Name: idx_interviews_application_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_interviews_application_id ON public.interviews USING btree (application_id);


--
-- Name: idx_interviews_candidate_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_interviews_candidate_id ON public.interviews USING btree (candidate_id);


--
-- Name: idx_interviews_job_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_interviews_job_id ON public.interviews USING btree (job_id);


--
-- Name: idx_job_applications_candidate_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_job_applications_candidate_id ON public.job_applications USING btree (candidate_id);


--
-- Name: idx_job_applications_job_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_job_applications_job_id ON public.job_applications USING btree (job_id);


--
-- Name: idx_job_skills; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_job_skills ON public.jobs USING gin (skills_required);


--
-- Name: idx_job_views_job_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_job_views_job_id ON public.job_views USING btree (job_id);


--
-- Name: idx_jobs_company_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_jobs_company_id ON public.jobs USING btree (company_id);


--
-- Name: idx_milestones_verification; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_milestones_verification ON public.career_milestones USING btree (verification_url) WHERE (verification_url IS NOT NULL);


--
-- Name: idx_pinned_posts_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pinned_posts_user ON public.user_pinned_posts USING btree (user_id);


--
-- Name: idx_post_comments_post_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_post_comments_post_id ON public.post_comments USING btree (post_id);


--
-- Name: idx_post_likes_post_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_post_likes_post_id ON public.post_likes USING btree (post_id);


--
-- Name: idx_profile_matches_candidate; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profile_matches_candidate ON public.profile_matches USING btree (candidate_id);


--
-- Name: idx_profile_matches_recruiter; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profile_matches_recruiter ON public.profile_matches USING btree (recruiter_id);


--
-- Name: idx_profile_verified; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profile_verified ON public.candidate_profiles USING btree (identity_verified);


--
-- Name: idx_recruiter_responses_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_recruiter_responses_user ON public.recruiter_assessment_responses USING btree (user_id);


--
-- Name: idx_skill_catalog_band; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_skill_catalog_band ON public.skill_catalog USING btree (experience_band);


--
-- Name: recruiter_profiles tr_initialize_recruiter_settings; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tr_initialize_recruiter_settings AFTER INSERT ON public.recruiter_profiles FOR EACH ROW EXECUTE FUNCTION public.initialize_recruiter_settings();


--
-- Name: candidate_profiles tr_refresh_completion_score; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tr_refresh_completion_score BEFORE INSERT OR UPDATE ON public.candidate_profiles FOR EACH ROW EXECUTE FUNCTION public.calculate_profile_completion();


--
-- Name: profile_matches tr_update_profile_matches_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tr_update_profile_matches_timestamp BEFORE UPDATE ON public.profile_matches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: recruiter_settings tr_update_recruiter_settings_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tr_update_recruiter_settings_timestamp BEFORE UPDATE ON public.recruiter_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: job_applications trg_protect_and_log_applications; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_protect_and_log_applications BEFORE UPDATE ON public.job_applications FOR EACH ROW EXECUTE FUNCTION public.protect_job_ownership_and_log();


--
-- Name: assessment_responses assessment_responses_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessment_responses
    ADD CONSTRAINT assessment_responses_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: assessment_responses assessment_responses_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessment_responses
    ADD CONSTRAINT assessment_responses_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.assessment_questions(id);


--
-- Name: assessment_sessions assessment_sessions_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessment_sessions
    ADD CONSTRAINT assessment_sessions_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: blocked_users blocked_users_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blocked_users
    ADD CONSTRAINT blocked_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: candidate_job_sync candidate_job_sync_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidate_job_sync
    ADD CONSTRAINT candidate_job_sync_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: candidate_job_sync candidate_job_sync_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidate_job_sync
    ADD CONSTRAINT candidate_job_sync_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE;


--
-- Name: candidate_profiles candidate_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidate_profiles
    ADD CONSTRAINT candidate_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: candidate_settings candidate_settings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidate_settings
    ADD CONSTRAINT candidate_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: career_gps career_gps_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.career_gps
    ADD CONSTRAINT career_gps_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.candidate_profiles(user_id) ON DELETE CASCADE;


--
-- Name: career_milestones career_milestones_gps_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.career_milestones
    ADD CONSTRAINT career_milestones_gps_id_fkey FOREIGN KEY (gps_id) REFERENCES public.career_gps(id) ON DELETE CASCADE;


--
-- Name: chat_messages chat_messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id);


--
-- Name: chat_messages chat_messages_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.chat_threads(id) ON DELETE CASCADE;


--
-- Name: chat_reports chat_reports_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_reports
    ADD CONSTRAINT chat_reports_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.chat_messages(id) ON DELETE SET NULL;


--
-- Name: chat_reports chat_reports_reporter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_reports
    ADD CONSTRAINT chat_reports_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: chat_reports chat_reports_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_reports
    ADD CONSTRAINT chat_reports_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.chat_threads(id) ON DELETE CASCADE;


--
-- Name: chat_threads chat_threads_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_threads
    ADD CONSTRAINT chat_threads_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.candidate_profiles(user_id) ON DELETE CASCADE;


--
-- Name: chat_threads chat_threads_recruiter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_threads
    ADD CONSTRAINT chat_threads_recruiter_id_fkey FOREIGN KEY (recruiter_id) REFERENCES public.recruiter_profiles(user_id) ON DELETE CASCADE;


--
-- Name: follows follows_follower_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.follows
    ADD CONSTRAINT follows_follower_id_fkey FOREIGN KEY (follower_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: follows follows_following_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.follows
    ADD CONSTRAINT follows_following_id_fkey FOREIGN KEY (following_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: interview_slots interview_slots_interview_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interview_slots
    ADD CONSTRAINT interview_slots_interview_id_fkey FOREIGN KEY (interview_id) REFERENCES public.interviews(id) ON DELETE CASCADE;


--
-- Name: interviews interviews_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interviews
    ADD CONSTRAINT interviews_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.job_applications(id) ON DELETE CASCADE;


--
-- Name: interviews interviews_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interviews
    ADD CONSTRAINT interviews_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: interviews interviews_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interviews
    ADD CONSTRAINT interviews_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE;


--
-- Name: interviews interviews_recruiter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interviews
    ADD CONSTRAINT interviews_recruiter_id_fkey FOREIGN KEY (recruiter_id) REFERENCES public.recruiter_profiles(user_id) ON DELETE CASCADE;


--
-- Name: job_application_status_history job_application_status_history_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_application_status_history
    ADD CONSTRAINT job_application_status_history_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.job_applications(id) ON DELETE CASCADE;


--
-- Name: job_application_status_history job_application_status_history_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_application_status_history
    ADD CONSTRAINT job_application_status_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id);


--
-- Name: job_applications job_applications_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_applications
    ADD CONSTRAINT job_applications_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.candidate_profiles(user_id) ON DELETE CASCADE;


--
-- Name: job_applications job_applications_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_applications
    ADD CONSTRAINT job_applications_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE;


--
-- Name: job_views job_views_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_views
    ADD CONSTRAINT job_views_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: job_views job_views_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_views
    ADD CONSTRAINT job_views_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE;


--
-- Name: jobs jobs_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: jobs jobs_recruiter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_recruiter_id_fkey FOREIGN KEY (recruiter_id) REFERENCES public.recruiter_profiles(user_id);


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: post_comments post_comments_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_comments
    ADD CONSTRAINT post_comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;


--
-- Name: post_comments post_comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_comments
    ADD CONSTRAINT post_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: post_likes post_likes_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_likes
    ADD CONSTRAINT post_likes_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;


--
-- Name: post_likes post_likes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_likes
    ADD CONSTRAINT post_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: posts posts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: profile_analytics profile_analytics_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_analytics
    ADD CONSTRAINT profile_analytics_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: profile_analytics profile_analytics_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_analytics
    ADD CONSTRAINT profile_analytics_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE;


--
-- Name: profile_analytics profile_analytics_recruiter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_analytics
    ADD CONSTRAINT profile_analytics_recruiter_id_fkey FOREIGN KEY (recruiter_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: profile_matches profile_matches_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_matches
    ADD CONSTRAINT profile_matches_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: profile_matches profile_matches_recruiter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_matches
    ADD CONSTRAINT profile_matches_recruiter_id_fkey FOREIGN KEY (recruiter_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: profile_scores profile_scores_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_scores
    ADD CONSTRAINT profile_scores_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: recruiter_assessment_responses recruiter_assessment_responses_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recruiter_assessment_responses
    ADD CONSTRAINT recruiter_assessment_responses_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: recruiter_profiles recruiter_profiles_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recruiter_profiles
    ADD CONSTRAINT recruiter_profiles_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: recruiter_profiles recruiter_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recruiter_profiles
    ADD CONSTRAINT recruiter_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: recruiter_settings recruiter_settings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recruiter_settings
    ADD CONSTRAINT recruiter_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.recruiter_profiles(user_id) ON DELETE CASCADE;


--
-- Name: resume_data resume_data_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resume_data
    ADD CONSTRAINT resume_data_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: saved_jobs saved_jobs_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_jobs
    ADD CONSTRAINT saved_jobs_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.candidate_profiles(user_id) ON DELETE CASCADE;


--
-- Name: saved_jobs saved_jobs_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_jobs
    ADD CONSTRAINT saved_jobs_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE;


--
-- Name: team_invitations team_invitations_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_invitations
    ADD CONSTRAINT team_invitations_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: team_invitations team_invitations_inviter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_invitations
    ADD CONSTRAINT team_invitations_inviter_id_fkey FOREIGN KEY (inviter_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: user_pinned_posts user_pinned_posts_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_pinned_posts
    ADD CONSTRAINT user_pinned_posts_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;


--
-- Name: user_pinned_posts user_pinned_posts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_pinned_posts
    ADD CONSTRAINT user_pinned_posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: assessment_questions Allow authenticated read access to questions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated read access to questions" ON public.assessment_questions FOR SELECT TO authenticated USING (true);


--
-- Name: skill_catalog Allow public select for skill_catalog; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public select for skill_catalog" ON public.skill_catalog FOR SELECT USING (true);


--
-- Name: blocked_users Allow users to check their own blocked status; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow users to check their own blocked status" ON public.blocked_users FOR SELECT TO authenticated USING ((public.uid() = user_id));


--
-- Name: jobs Anyone can view active jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view active jobs" ON public.jobs FOR SELECT USING ((status = 'active'::public.job_status));


--
-- Name: posts Anyone can view posts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view posts" ON public.posts FOR SELECT USING (true);


--
-- Name: companies Authenticated users can view company info; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view company info" ON public.companies FOR SELECT USING ((public.uid() IS NOT NULL));


--
-- Name: candidate_profiles Candidate can read own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Candidate can read own profile" ON public.candidate_profiles FOR SELECT USING ((user_id = public.uid()));


--
-- Name: job_applications Candidates can apply for jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Candidates can apply for jobs" ON public.job_applications FOR INSERT WITH CHECK ((public.uid() = candidate_id));


--
-- Name: job_applications Candidates can manage own applications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Candidates can manage own applications" ON public.job_applications USING ((candidate_id = public.uid()));


--
-- Name: profile_analytics Candidates can read own analytics; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Candidates can read own analytics" ON public.profile_analytics FOR SELECT USING ((candidate_id = public.uid()));


--
-- Name: interview_slots Candidates can select slots; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Candidates can select slots" ON public.interview_slots FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.interviews
  WHERE ((interviews.id = interview_slots.interview_id) AND (interviews.candidate_id = public.uid())))));


--
-- Name: interviews Candidates can update interview slot selection; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Candidates can update interview slot selection" ON public.interviews FOR UPDATE USING ((public.uid() = candidate_id));


--
-- Name: jobs Candidates can view active jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Candidates can view active jobs" ON public.jobs FOR SELECT USING ((status = 'active'::public.job_status));


--
-- Name: profile_analytics Candidates can view own analytics; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Candidates can view own analytics" ON public.profile_analytics FOR SELECT USING ((candidate_id = public.uid()));


--
-- Name: job_applications Candidates can view own applications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Candidates can view own applications" ON public.job_applications FOR SELECT USING ((public.uid() = candidate_id));


--
-- Name: candidate_job_sync Candidates can view own sync insights; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Candidates can view own sync insights" ON public.candidate_job_sync FOR SELECT USING ((candidate_id = public.uid()));


--
-- Name: interviews Candidates can view their interviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Candidates can view their interviews" ON public.interviews FOR SELECT USING ((public.uid() = candidate_id));


--
-- Name: posts Public can view posts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can view posts" ON public.posts FOR SELECT USING (true);


--
-- Name: post_comments Public comments can be viewed by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public comments can be viewed by everyone" ON public.post_comments FOR SELECT USING (true);


--
-- Name: follows Public following info; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public following info" ON public.follows FOR SELECT USING (true);


--
-- Name: post_likes Public likes can be viewed by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public likes can be viewed by everyone" ON public.post_likes FOR SELECT USING (true);


--
-- Name: blocked_users Read access for blocked status check; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Read access for blocked status check" ON public.blocked_users FOR SELECT TO authenticated USING (true);


--
-- Name: companies Recruiter can read own company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Recruiter can read own company" ON public.companies FOR SELECT USING ((id IN ( SELECT recruiter_profiles.company_id
   FROM public.recruiter_profiles
  WHERE (recruiter_profiles.user_id = public.uid()))));


--
-- Name: recruiter_profiles Recruiter can read own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Recruiter can read own profile" ON public.recruiter_profiles FOR SELECT USING ((user_id = public.uid()));


--
-- Name: interviews Recruiters can create interviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Recruiters can create interviews" ON public.interviews FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.recruiter_profiles
  WHERE (recruiter_profiles.user_id = public.uid()))));


--
-- Name: profile_analytics Recruiters can insert analytics; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Recruiters can insert analytics" ON public.profile_analytics FOR INSERT WITH CHECK ((public.uid() IS NOT NULL));


--
-- Name: interview_slots Recruiters can manage slots; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Recruiters can manage slots" ON public.interview_slots USING ((EXISTS ( SELECT 1
   FROM public.interviews
  WHERE ((interviews.id = interview_slots.interview_id) AND (interviews.recruiter_id = public.uid())))));


--
-- Name: jobs Recruiters can manage their company jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Recruiters can manage their company jobs" ON public.jobs USING ((company_id IN ( SELECT recruiter_profiles.company_id
   FROM public.recruiter_profiles
  WHERE (recruiter_profiles.user_id = public.uid()))));


--
-- Name: jobs Recruiters can manage their own jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Recruiters can manage their own jobs" ON public.jobs USING ((public.uid() = recruiter_id));


--
-- Name: job_applications Recruiters can update application status; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Recruiters can update application status" ON public.job_applications FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.jobs
  WHERE ((jobs.id = job_applications.job_id) AND (jobs.recruiter_id = public.uid())))));


--
-- Name: interviews Recruiters can update their interviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Recruiters can update their interviews" ON public.interviews FOR UPDATE USING (((public.uid() = recruiter_id) OR (EXISTS ( SELECT 1
   FROM public.jobs
  WHERE ((jobs.id = interviews.job_id) AND (jobs.recruiter_id = public.uid()))))));


--
-- Name: recruiter_assessment_questions Recruiters can view assessment questions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Recruiters can view assessment questions" ON public.recruiter_assessment_questions FOR SELECT USING ((public.role() = 'authenticated'::text));


--
-- Name: candidate_profiles Recruiters can view completed candidate profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Recruiters can view completed candidate profiles" ON public.candidate_profiles FOR SELECT TO authenticated USING (((EXISTS ( SELECT 1
   FROM public.recruiter_profiles
  WHERE ((recruiter_profiles.user_id = public.uid()) AND (recruiter_profiles.account_status = 'Active'::public.account_status)))) AND (assessment_status = 'completed'::public.assessment_status)));


--
-- Name: interviews Recruiters can view their interviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Recruiters can view their interviews" ON public.interviews FOR SELECT USING (((public.uid() = recruiter_id) OR (EXISTS ( SELECT 1
   FROM public.jobs
  WHERE ((jobs.id = interviews.job_id) AND (jobs.recruiter_id = public.uid()))))));


--
-- Name: profile_scores Recruiters can view trust signals from profile_scores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Recruiters can view trust signals from profile_scores" ON public.profile_scores FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.recruiter_profiles
  WHERE (recruiter_profiles.user_id = public.uid()))));


--
-- Name: candidate_profiles Recruiters view applicant profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Recruiters view applicant profiles" ON public.candidate_profiles FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.job_applications
     JOIN public.jobs ON ((job_applications.job_id = jobs.id)))
  WHERE ((job_applications.candidate_id = candidate_profiles.user_id) AND (jobs.recruiter_id = public.uid())))));


--
-- Name: job_applications Recruiters view applicants for their jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Recruiters view applicants for their jobs" ON public.job_applications FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.jobs
  WHERE ((jobs.id = job_applications.job_id) AND (jobs.recruiter_id = public.uid())))));


--
-- Name: profile_scores User can read own profile score; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "User can read own profile score" ON public.profile_scores FOR SELECT USING ((user_id = public.uid()));


--
-- Name: blocked_users Users can check their own blocked status; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can check their own blocked status" ON public.blocked_users FOR SELECT USING ((public.uid() = user_id));


--
-- Name: posts Users can create their own posts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own posts" ON public.posts FOR INSERT WITH CHECK ((public.uid() = user_id));


--
-- Name: posts Users can delete their own posts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own posts" ON public.posts FOR DELETE USING ((public.uid() = user_id));


--
-- Name: follows Users can follow others; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can follow others" ON public.follows FOR INSERT WITH CHECK ((public.uid() = follower_id));


--
-- Name: candidate_profiles Users can manage own candidate profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own candidate profile" ON public.candidate_profiles USING ((user_id = public.uid())) WITH CHECK ((user_id = public.uid()));


--
-- Name: notifications Users can manage own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own notifications" ON public.notifications USING ((user_id = public.uid()));


--
-- Name: posts Users can manage own posts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own posts" ON public.posts USING ((user_id = public.uid()));


--
-- Name: recruiter_profiles Users can manage own recruiter profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own recruiter profile" ON public.recruiter_profiles USING ((user_id = public.uid())) WITH CHECK ((user_id = public.uid()));


--
-- Name: saved_jobs Users can manage own saved jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own saved jobs" ON public.saved_jobs USING ((candidate_id = public.uid()));


--
-- Name: post_comments Users can manage their own comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their own comments" ON public.post_comments USING ((public.uid() = user_id));


--
-- Name: post_likes Users can manage their own likes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their own likes" ON public.post_likes USING ((public.uid() = user_id));


--
-- Name: assessment_responses Users can manage their own responses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their own responses" ON public.assessment_responses TO authenticated USING ((public.uid() = candidate_id)) WITH CHECK ((public.uid() = candidate_id));


--
-- Name: resume_data Users can manage their own resume data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their own resume data" ON public.resume_data USING ((public.uid() = user_id));


--
-- Name: assessment_sessions Users can manage their own session; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their own session" ON public.assessment_sessions TO authenticated USING ((public.uid() = candidate_id)) WITH CHECK ((public.uid() = candidate_id));


--
-- Name: user_pinned_posts Users can pin their own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can pin their own" ON public.user_pinned_posts FOR INSERT WITH CHECK ((public.uid() = user_id));


--
-- Name: follows Users can see who follows them; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can see who follows them" ON public.follows FOR SELECT USING ((public.uid() = following_id));


--
-- Name: follows Users can see who they follow; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can see who they follow" ON public.follows FOR SELECT USING ((public.uid() = follower_id));


--
-- Name: follows Users can unfollow others; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can unfollow others" ON public.follows FOR DELETE USING ((public.uid() = follower_id));


--
-- Name: user_pinned_posts Users can unpin their own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can unpin their own" ON public.user_pinned_posts FOR DELETE USING ((public.uid() = user_id));


--
-- Name: candidate_settings Users can update their own candidate settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own candidate settings" ON public.candidate_settings FOR UPDATE USING ((public.uid() = user_id));


--
-- Name: posts Users can update their own posts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own posts" ON public.posts FOR UPDATE USING ((public.uid() = user_id));


--
-- Name: candidate_settings Users can view their own candidate settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own candidate settings" ON public.candidate_settings FOR SELECT USING ((public.uid() = user_id));


--
-- Name: user_pinned_posts Users can view their own pins; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own pins" ON public.user_pinned_posts FOR SELECT USING ((public.uid() = user_id));


--
-- Name: interview_slots Viewable slots; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Viewable slots" ON public.interview_slots FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.interviews
  WHERE ((interviews.id = interview_slots.interview_id) AND ((interviews.candidate_id = public.uid()) OR (interviews.recruiter_id = public.uid()))))));


--
-- Name: team_invitations admin_manage_invites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_manage_invites ON public.team_invitations USING ((EXISTS ( SELECT 1
   FROM public.recruiter_profiles
  WHERE ((recruiter_profiles.user_id = public.uid()) AND (recruiter_profiles.is_admin = true) AND (recruiter_profiles.company_id = team_invitations.company_id)))));


--
-- Name: job_views anyone_can_log_view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anyone_can_log_view ON public.job_views FOR INSERT WITH CHECK (true);


--
-- Name: assessment_questions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.assessment_questions ENABLE ROW LEVEL SECURITY;

--
-- Name: assessment_responses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.assessment_responses ENABLE ROW LEVEL SECURITY;

--
-- Name: assessment_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.assessment_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: blocked_users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

--
-- Name: candidate_job_sync; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.candidate_job_sync ENABLE ROW LEVEL SECURITY;

--
-- Name: candidate_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.candidate_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: candidate_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.candidate_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: career_gps; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.career_gps ENABLE ROW LEVEL SECURITY;

--
-- Name: career_milestones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.career_milestones ENABLE ROW LEVEL SECURITY;

--
-- Name: companies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

--
-- Name: follows; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

--
-- Name: interview_slots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.interview_slots ENABLE ROW LEVEL SECURITY;

--
-- Name: interviews; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;

--
-- Name: team_invitations invitee_view_invites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY invitee_view_invites ON public.team_invitations FOR SELECT USING ((email = (( SELECT users.email
   FROM public.users
  WHERE (users.id = public.uid())))::text));


--
-- Name: job_applications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;

--
-- Name: job_views; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.job_views ENABLE ROW LEVEL SECURITY;

--
-- Name: jobs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: post_comments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

--
-- Name: post_likes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;

--
-- Name: posts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

--
-- Name: profile_analytics; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profile_analytics ENABLE ROW LEVEL SECURITY;

--
-- Name: profile_scores; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profile_scores ENABLE ROW LEVEL SECURITY;

--
-- Name: recruiter_assessment_questions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.recruiter_assessment_questions ENABLE ROW LEVEL SECURITY;

--
-- Name: recruiter_assessment_responses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.recruiter_assessment_responses ENABLE ROW LEVEL SECURITY;

--
-- Name: recruiter_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.recruiter_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: resume_data; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.resume_data ENABLE ROW LEVEL SECURITY;

--
-- Name: saved_jobs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.saved_jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: skill_catalog; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.skill_catalog ENABLE ROW LEVEL SECURITY;

--
-- Name: team_invitations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;

--
-- Name: career_gps tf_candidate_gps_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tf_candidate_gps_access ON public.career_gps USING ((candidate_id = public.uid()));


--
-- Name: career_milestones tf_candidate_milestone_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tf_candidate_milestone_access ON public.career_milestones USING ((EXISTS ( SELECT 1
   FROM public.career_gps
  WHERE ((career_gps.id = career_milestones.gps_id) AND (career_gps.candidate_id = public.uid())))));


--
-- Name: user_pinned_posts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_pinned_posts ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict 81LaEqsamR4P1EWiqt1azV66bhBDDbXSdmEAwo9tVBEeoa0J7jGD79gjQXvKfqo

