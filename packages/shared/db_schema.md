# Database Schema Reference (Authoritative)

Updated: March 25, 2026 (Verified against AWS RDS live database)

## Enums

**user_role:**
- `candidate`
- `recruiter`
- `admin`

**experience_band:**
- `fresher`
- `mid`
- `senior`
- `leadership`

**assessment_status:**
- `not_started`
- `in_progress`
- `completed`
- `disqualified`

**employment_status:**
- `Employed`
- `Unemployed`
- `Student`

**company_size_band:**
- `1-10`
- `11-50`
- `51-200`
- `201-500`
- `501-1000`
- `1000+`

**sales_model_type:**
- `Inbound`
- `Outbound`
- `Hybrid`

**target_market:**
- `SMB`
- `Mid-market`
- `Enterprise`

**account_status:**
- `Active`
- `Restricted`
- `Suspended`
- `Blocked`

**profile_strength:**
- `Low`
- `Moderate`
- `Strong`
- `Elite`

**job_type:**
- `remote`
- `hybrid`
- `onsite`

**job_status:**
- `active`
- `paused`
- `closed`

**application_status:**
- `recommended`
- `applied` 
- `invited`
- `shortlisted` 
- `interview_scheduled`
- `rejected` 
- `offered` 
- `closed`

**interview_status:**
- `pending_confirmation`
- `scheduled`
- `cancelled`
- `completed`

**interview_format:**
- `virtual`
- `onsite`

**report_status:**
- `pending`
- `under_review`
- `resolved`
- `dismissed`

## Tables

### `users`
- `id` (uuid, Primary Key)
- `role` (user_role)
- `email` (text)
- `created_at` (timestamp with time zone)

### `candidate_profiles`
- `user_id` (uuid, Primary Key, Foreign Key -> users.id)
- `full_name` (text)
- `phone_number` (text)
- `profile_photo_url` (text)
- `bio` (text)
- `experience` (experience_band)
- `location` (text)
- `current_role` (text)
- `years_of_experience` (integer)
- `primary_industry_focus` (text)
- `current_employment_status` (employment_status)
- `current_company_name` (text)
- `previous_companies` (text[])
- `key_responsibilities` (text)
- `major_achievements` (text)
- `resume_uploaded` (boolean)
- `assessment_status` (assessment_status)
- `skills` (text[])
- `sales_metrics` (jsonb)
- `crm_tools` (text[])
- `sales_methodologies` (text[])
- `product_domain_expertise` (text[])
- `target_market_exposure` (text)
- `linkedin_url` (text)
- `portfolio_url` (text)
- `learning_links` (jsonb)
- `career_interests` (text[])
- `learning_interests` (text[])
- `job_type` (job_type)
- `social_links` (jsonb)
- `onboarding_step` (text)
- `profile_strength` (profile_strength)
- `completion_score` (integer)
- `final_profile_score` (integer)
- `identity_verified` (boolean)
- `identity_proof_path` (text)
- `terms_accepted` (boolean)
- `account_status` (account_status)
- `gender` (text)
- `birthdate` (date)
- `university` (text)
- `qualification_held` (text)
- `graduation_year` (integer)
- `referral` (text)
- `resume_url` (text)
- `resume_path` (text)
- `target_role` (text)
- `long_term_goal` (text)
- `education_history` (jsonb)
- `experience_history` (jsonb)
- `projects` (jsonb)
- `certifications` (text[])
- `career_gap_report` (text)
- `professional_summary` (text)
- `gpa_score` (numeric)
- `graduation_status` (text)
- `last_resume_parse_at` (timestamp)
- `ai_extraction_confidence` (numeric)
- `created_at` (timestamp with time zone)
- `updated_at` (timestamp with time zone)

### `recruiter_profiles`
- `user_id` (uuid, Primary Key, Foreign Key -> users.id)
- `company_id` (uuid, Foreign Key -> companies.id)
- `full_name` (text)
- `phone_number` (text)
- `job_title` (text)
- `linkedin_url` (text)
- `bio` (text)
- `team_role` (text)
- `is_admin` (boolean)
- `onboarding_step` (text)
- `warning_count` (integer)
- `completion_score` (integer)
- `assessment_status` (assessment_status)
- `terms_accepted` (boolean)
- `account_status` (account_status)
- `created_at` (timestamp with time zone)
- `updated_at` (timestamp with time zone)

### `recruiter_settings`
- `user_id` (uuid, Primary Key, Foreign Key -> recruiter_profiles.user_id)
- `email_notifications` (boolean)
- `web_notifications` (boolean)
- `mobile_notifications` (boolean)
- `profile_visibility` (text)
- `language` (text)
- `timezone` (text)
- `created_at` (timestamp with time zone)
- `updated_at` (timestamp with time zone)

### `companies`
- `id` (uuid, Primary Key)
- `name` (text)
- `registration_number` (text)
- `website` (text)
- `domain` (text)
- `location` (text)
- `description` (text)
- `industry_category` (text)
- `size_band` (company_size_band)
- `sales_model` (sales_model_type)
- `target_market` (target_market)
- `hiring_focus_areas` (text[])
- `avg_deal_size_range` (text)
- `profile_score` (integer)
- `candidate_feedback_score` (double precision)
- `successful_hires_count` (integer)
- `visibility_tier` (text)
- `verification_status` (text)
- `logo_url` (text)
- `brand_colors` (jsonb)
- `life_at_photo_urls` (text[])
- `created_at` (timestamp with time zone)
- `updated_at` (timestamp with time zone)

### `assessment_questions`
- `id` (uuid, Primary Key)
- `category` (text)
- `driver` (text)
- `experience_band` (text)
- `difficulty` (text)
- `question_text` (text)
- `evaluation_rubric` (text)
- `created_at` (timestamp with time zone)

### `assessment_sessions`
- `id` (uuid, Primary Key)
- `candidate_id` (uuid)
- `experience_band` (text)
- `status` (text)
- `total_budget` (integer)
- `current_step` (integer)
- `overall_score` (double precision)
- `component_scores` (jsonb)
- `driver_confidence` (jsonb)
- `started_at` (timestamp with time zone)
- `completed_at` (timestamp with time zone)

### `assessment_responses`
- `id` (uuid, Primary Key)
- `candidate_id` (uuid)
- `question_id` (uuid, Foreign Key -> assessment_questions.id)
- `question_text` (text)
- `category` (text)
- `driver` (text)
- `difficulty` (text)
- `raw_answer` (text)
- `score` (integer)
- `evaluation_metadata` (jsonb)
- `is_skipped` (boolean)
- `tab_switches` (integer)
- `time_taken_seconds` (integer)
- `created_at` (timestamp with time zone)

### `recruiter_assessment_questions`
- `id` (uuid, Primary Key)
- `category` (text)
- `driver` (text)
- `question_text` (text)
- `created_at` (timestamp with time zone)

### `recruiter_assessment_responses`
- `id` (uuid, Primary Key)
- `user_id` (uuid, Foreign Key -> users.id)
- `question_text` (text)
- `answer_text` (text)
- `category` (text)
- `relevance_score` (integer)
- `specificity_score` (integer)
- `clarity_score` (integer)
- `ownership_score` (integer)
- `average_score` (numeric)
- `evaluation_metadata` (jsonb)
- `created_at` (timestamp with time zone)

### `resume_data`
- `user_id` (uuid, Primary Key, Foreign Key -> users.id)
- `raw_text` (text)
- `timeline` (jsonb)
- `career_gaps` (jsonb)
- `achievements` (text[])
- `skills` (text[])
- `education` (jsonb)
- `raw_education` (text)
- `raw_experience` (text)
- `raw_projects` (text)
- `parsed_at` (timestamp with time zone)

### `profile_scores`
- `user_id` (uuid, Primary Key, Foreign Key -> users.id)
- `resume_score` (integer)
- `behavioral_score` (integer)
- `psychometric_score` (integer)
- `skills_score` (integer)
- `reference_score` (integer)
- `final_score` (integer)
- `calculated_at` (timestamp with time zone)

### `jobs`
- `id` (uuid, Primary Key)
- `company_id` (uuid, Foreign Key -> companies.id)
- `recruiter_id` (uuid, Foreign Key -> recruiter_profiles.user_id)
- `title` (text)
- `description` (text)
- `requirements` (text[])
- `skills_required` (text[])
- `experience_band` (experience_band)
- `job_type` (job_type)
- `location` (text)
- `salary_range` (text)
- `number_of_positions` (integer)
- `status` (job_status)
- `is_ai_generated` (boolean)
- `closed_at` (timestamp with time zone)
- `metadata` (jsonb)
- `created_at` (timestamp with time zone)
- `updated_at` (timestamp with time zone)

### `job_applications`
- `id` (uuid, Primary Key)
- `job_id` (uuid, Foreign Key -> jobs.id)
- `candidate_id` (uuid, Foreign Key -> candidate_profiles.user_id)
- `status` (application_status)
- `feedback` (text)
- `invitation_message` (text)
- `created_at` (timestamp with time zone)
- `updated_at` (timestamp with time zone)

### `saved_jobs`
- `id` (uuid, Primary Key)
- `candidate_id` (uuid, Foreign Key -> candidate_profiles.user_id)
- `job_id` (uuid, Foreign Key -> jobs.id)
- `created_at` (timestamp with time zone)

### `posts`
- `id` (uuid, Primary Key)
- `user_id` (uuid, Foreign Key -> users.id)
- `content` (text)
- `media_urls` (text[])
- `type` (text)
- `created_at` (timestamp with time zone)
- `updated_at` (timestamp with time zone)

### `user_pinned_posts`
- `user_id` (uuid, Primary Key, Foreign Key -> users.id)
- `post_id` (uuid, Primary Key, Foreign Key -> posts.id)
- `pinned_at` (timestamp with time zone)

### `notifications`
- `id` (uuid, Primary Key)
- `user_id` (uuid, Foreign Key -> users.id)
- `type` (text)
- `title` (text)
- `message` (text)
- `metadata` (jsonb)
- `is_read` (boolean)
- `created_at` (timestamp with time zone)

### `follows`
- `id` (uuid, Primary Key)
- `follower_id` (uuid, Foreign Key -> users.id)
- `following_id` (uuid, Foreign Key -> users.id)
- `created_at` (timestamp with time zone)

### `blocked_users`
- `user_id` (uuid, Primary Key)
- `reason` (text)
- `blocked_at` (timestamp with time zone)

### `job_application_status_history`
- `id` (uuid, Primary Key)
- `application_id` (uuid, Foreign Key -> job_applications.id)
- `old_status` (text)
- `new_status` (text)
- `changed_by` (uuid, Foreign Key -> users.id)
- `reason` (text)
- `created_at` (timestamp with time zone)

### `interviews`
- `id` (uuid, Primary Key)
- `job_id` (uuid, Foreign Key -> jobs.id)
- `candidate_id` (uuid, Foreign Key -> candidate_profiles.user_id)
- `recruiter_id` (uuid, Foreign Key -> recruiter_profiles.user_id)
- `application_id` (uuid, Foreign Key -> job_applications.id)
- `status` (text)
- `round_name` (text)
- `round_number` (integer)
- `format` (text)
- `meeting_link` (text)
- `location` (text)
- `interviewer_names` (text[])
- `feedback` (text)
- `cancellation_reason` (text)
- `created_at` (timestamp with time zone)
- `updated_at` (timestamp with time zone)

### `interview_slots`
- `id` (uuid, Primary Key)
- `interview_id` (uuid, Foreign Key -> interviews.id)
- `start_time` (timestamp with time zone)
- `end_time` (timestamp with time zone)
- `is_selected` (boolean)
- `created_at` (timestamp with time zone)

### `chat_threads`
- `id` (uuid, Primary Key)
- `candidate_id` (uuid, Foreign Key -> users.id)
- `recruiter_id` (uuid, Foreign Key -> users.id)
- `is_active` (boolean)
- `last_message_at` (timestamp with time zone)
- `created_at` (timestamp with time zone)

### `chat_messages`
- `id` (uuid, Primary Key)
- `thread_id` (uuid, Foreign Key -> chat_threads.id)
- `sender_id` (uuid, Foreign Key -> users.id)
- `text` (text)
- `is_read` (boolean)
- `created_at` (timestamp with time zone)

### `chat_reports`
- `id` (uuid, Primary Key)
- `message_id` (uuid, Foreign Key -> chat_messages.id)
- `reporter_id` (uuid, Foreign Key -> users.id)
- `thread_id` (uuid, Foreign Key -> chat_threads.id)
- `reason` (text)
- `status` (text)
- `admin_notes` (text)
- `created_at` (timestamp with time zone)

### `career_gps`
- `id` (uuid, Primary Key)
- `candidate_id` (uuid, Foreign Key -> users.id)
- `target_role` (text)
- `current_status` (text)
- `created_at` (timestamp with time zone)
- `updated_at` (timestamp with time zone)

### `career_milestones`
- `id` (uuid, Primary Key)
- `gps_id` (uuid, Foreign Key -> career_gps.id)
- `step_order` (integer)
- `title` (text)
- `description` (text)
- `skills_to_acquire` (text[])
- `learning_actions` (jsonb)
- `status` (text)
- `completed_at` (timestamp with time zone)
- `created_at` (timestamp with time zone)

### `job_views`
- `id` (uuid, Primary Key)
- `job_id` (uuid, Foreign Key -> jobs.id)
- `candidate_id` (uuid, Foreign Key -> candidate_profiles.user_id)
- `viewer_ip` (text)
- `user_agent` (text)
- `created_at` (timestamp with time zone)

### `team_invitations`
- `id` (uuid, Primary Key)
- `company_id` (uuid, Foreign Key -> companies.id)
- `inviter_id` (uuid, Foreign Key -> users.id)
- `email` (text)
- `status` (text)
- `created_at` (timestamp with time zone)
- `expires_at` (timestamp with time zone)

## Storage Buckets

### `resumes`
- **Purpose**: Stores candidate PDF resumes.
- **RLS**: Restricted to own folder.

### `documents`
- **Purpose**: Identity documents, Aadhaar, etc.

### `id-proofs`
- **Purpose**: Sensitive ID verification documents.

### `avatars`
- **Purpose**: User profile photos.

### `profile_photos`
- **Purpose**: Dedicated bucket for candidate and recruiter profile pictures.

### `company-logos`
- **Purpose**: Company brand logos.

### `company-assets`
- **Purpose**: Company photos, videos and office assets.

### `community-media`
- **Purpose**: Media uploaded in community posts.

## Row Level Security (RLS) Policies

### `users`
- **Individual Access**: Users can read their own record (`id = auth.uid()`).

### `candidate_profiles`
- **Self**: Users can read and update their own profile.
- **Recruiters (Applicant View)**: Recruiters can view profiles of candidates who have applied to their jobs.
- **Recruiters (Discovery View)**: Recruiters can view any profile where `assessment_status` is `completed`.

### `recruiter_profiles`
- **Self**: Recruiters can read and update their own profile.

### `companies`
- **Public/Authenticated**: Viewable by all authenticated users.
- **Recruiters**: Can update their own company's details.

### `jobs`
- **Public/Candidate**: Viewable if `status` is `active`.
- **Recruiter**: Full management access for jobs they created.

### `job_applications`
- **Candidate**: Can insert (apply) and view their own applications.
- **Recruiter**: Can view and update (change status/feedback) for applications to their own jobs.

### `saved_jobs`
- **Candidate**: Full management of their own saved jobs.

### `posts`
- **Public**: Viewable by anyone.
- **Creator**: Can manage (edit/delete) their own posts.

### `follows`
- **Public**: Viewable by anyone.
- **Follower**: Can manage their own follows.

### `notifications`
- **User**: Can view and mark their own notifications as read.

### `resume_data` & `profile_scores`
- **Self**: Users can view their own parsed data and scores.
- **Recruiters**: Viewable if the candidate profile is accessible (via applicants or discovery).

### `assessment_questions`
- **Discovery**: Questions for candidates and recruiters are viewable by authenticated users during sessions.

### `assessment_responses` & `assessment_sessions`
- **Candidate**: Can manage their own specific session and responses.
- **AI Audit**: Restricted access for system processes.

## Trigger & Function Catalog

### Profile Management
- **`initialize_recruiter_settings`**: Automatically creates an entry in `recruiter_settings` when a new `recruiter_profile` is created.
- **`update_updated_at_column`**: Standard trigger function to keep `updated_at` timestamps accurate across all tables.

### Application Lifecycle
- **`validate_application_status_transition`**: Ensures that job applications only move through valid status flows (e.g., cannot move from `rejected` to `shortlisted`).
- **`log_application_status_change`**: Automatically records state changes into `job_application_status_history` for auditing purposes.

## Global Indexing Strategy

- **`idx_candidate_skills`**: GIN index on `candidate_profiles(skills)` for fast hobby/skill-based discovery.
- **`idx_chat_messages_thread`**: Hash/B-tree index on `chat_messages(thread_id)` to speed up message retrieval.
- **`idx_interviews_lookup`**: Indexes on `job_id`, `candidate_id`, and `application_id` to optimize interview scheduling dashboards.
- **`idx_jobs_company`**: B-tree index on `jobs(company_id)` for lightning-fast listings of open roles per company.
- **`idx_application_tracking`**: B-tree index on `job_applications(job_id)` and `job_applications(candidate_id)`.
