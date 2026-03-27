-- BULK UPLOAD FEATURE - DATABASE SCHEMA
-- Author: Implementation Team
-- Date: March 26, 2026
-- Status: Production Ready
-- Purpose: Support internal company bulk resume upload with duplicate detection

-- ============================================================================
-- 1. BULK UPLOADS TABLE (Main tracking for each bulk upload batch)
-- ============================================================================
CREATE TABLE IF NOT EXISTS bulk_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  
  -- Batch metadata
  batch_name TEXT NOT NULL,
  batch_description TEXT,
  source_system TEXT, -- 'internal_hr', 'recruitment_agency', 'headhunter'
  
  -- Processing status
  upload_status TEXT NOT NULL DEFAULT 'uploaded', -- uploaded, processing, completed, failed, partially_failed
  processing_started_at TIMESTAMPTZ,
  processing_completed_at TIMESTAMPTZ,
  
  -- File & parsing metrics
  total_files_uploaded INTEGER NOT NULL DEFAULT 0,
  successfully_parsed INTEGER NOT NULL DEFAULT 0,
  parsing_failed INTEGER NOT NULL DEFAULT 0,
  extraction_confidence_avg DECIMAL(5,4), -- Average extraction confidence
  
  -- Duplicate detection metrics
  total_candidates_found INTEGER NOT NULL DEFAULT 0,
  duplicate_candidates_detected INTEGER NOT NULL DEFAULT 0,
  new_candidates_identified INTEGER NOT NULL DEFAULT 0,
  duplicates_admin_reviewed INTEGER NOT NULL DEFAULT 0,
  duplicates_auto_merged INTEGER NOT NULL DEFAULT 0,
  
  -- Account creation metrics
  shadow_profiles_created INTEGER NOT NULL DEFAULT 0, -- unverified accounts
  verified_accounts_from_bulk INTEGER NOT NULL DEFAULT 0,
  invitations_sent INTEGER NOT NULL DEFAULT 0,
  invitations_opened INTEGER NOT NULL DEFAULT 0,
  account_verifications_completed INTEGER NOT NULL DEFAULT 0,
  
  -- Compliance & security
  virus_scan_enabled BOOLEAN NOT NULL DEFAULT true,
  virus_scan_status TEXT, -- pending, scanning, clean, infected_found
  virus_scan_completed_at TIMESTAMPTZ,
  
  -- Data retention
  data_retention_days INTEGER NOT NULL DEFAULT 90,
  scheduled_deletion_date TIMESTAMPTZ,
  
  -- Audit trail
  processing_notes JSONB DEFAULT '[]', -- [{timestamp, message}]
  error_summary JSONB DEFAULT '[]', -- [{file_name, error_reason, error_type}]
  admin_decisions JSONB DEFAULT '{}', -- {duplicate_resolution_strategy, conflict_decisions}
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_bulk_uploads_admin_id ON bulk_uploads(admin_id);
CREATE INDEX idx_bulk_uploads_status ON bulk_uploads(upload_status);
CREATE INDEX idx_bulk_uploads_created ON bulk_uploads(created_at DESC);

-- ============================================================================
-- 2. BULK UPLOAD FILES TABLE (Individual file tracking)
-- ============================================================================
CREATE TABLE IF NOT EXISTS bulk_upload_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bulk_upload_id UUID NOT NULL REFERENCES bulk_uploads(id) ON DELETE CASCADE,
  
  -- File metadata
  original_filename TEXT NOT NULL,
  file_ext TEXT NOT NULL, -- pdf, doc, docx
  file_size_bytes INTEGER NOT NULL,
  file_hash TEXT UNIQUE NOT NULL, -- SHA-256 hash for deduplication
  file_storage_path TEXT, -- s3://bucket/path or /uploads/path
  
  -- Virus scan status
  virus_scan_status TEXT DEFAULT 'pending', -- pending, scanning, clean, infected
  virus_scan_result JSONB, -- {engine, status, details}
  virus_scan_timestamp TIMESTAMPTZ,
  
  -- Parsing status
  parsing_status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
  parsing_error TEXT,
  parsing_error_details JSONB,
  parsing_confidence DECIMAL(5,4), -- 0-1.0 confidence score
  parsed_at TIMESTAMPTZ,
  
  -- Extracted candidate info (denormalized for quick access)
  extracted_name TEXT,
  extracted_email TEXT,
  extracted_phone TEXT,
  extracted_location TEXT,
  extracted_current_role TEXT,
  extracted_years_experience INTEGER,
  
  -- Candidate matching result
  matched_candidate_id UUID REFERENCES users(id) ON DELETE SET NULL,
  match_confidence DECIMAL(5,4), -- 0-1.0
  match_type TEXT, -- exact, strong, moderate, soft, no_match
  
  -- Raw data stored
  raw_text TEXT, -- Full extracted resume text
  parsed_data JSONB, -- {name, email, phone, skills, education, experience, etc.}
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_bulk_upload_files_bulk_id ON bulk_upload_files(bulk_upload_id);
CREATE INDEX idx_bulk_upload_files_status ON bulk_upload_files(parsing_status);
CREATE INDEX idx_bulk_upload_files_hash ON bulk_upload_files(file_hash);
CREATE INDEX idx_bulk_upload_files_email ON bulk_upload_files(extracted_email);
CREATE INDEX idx_bulk_upload_files_phone ON bulk_upload_files(extracted_phone);

-- ============================================================================
-- 3. BULK UPLOAD CANDIDATE MATCHES TABLE (Duplicate detection results)
-- ============================================================================
CREATE TABLE IF NOT EXISTS bulk_upload_candidate_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bulk_upload_file_id UUID NOT NULL REFERENCES bulk_upload_files(id) ON DELETE CASCADE,
  
  -- Matched candidate info
  matched_candidate_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  candidate_full_name TEXT,
  candidate_email TEXT,
  candidate_phone TEXT,
  
  -- Matching details
  match_type TEXT NOT NULL, -- exact_match, strong_match, moderate_match, soft_match, no_match
  match_confidence DECIMAL(5,4) NOT NULL, -- 0-1.0 (50%-100%)
  match_reason TEXT, -- 'email_exact', 'phone_exact', 'name_similarity_0.92', etc.
  
  -- Matching breakdown (for admin review)
  match_details JSONB NOT NULL, -- 
  -- {
  --   email_match: {matched: true, confidence: 1.0, reason: 'exact'},
  --   phone_match: {matched: true, confidence: 0.95, reason: 'minor_typo'},
  --   name_similarity: {score: 0.88, method: 'levenshtein'},
  --   skills_overlap: {overlap_count: 8, total_new: 5, match_ratio: 0.62},
  --   experience_match: {companies_same: 2, titles_similar: 1, score: 0.65}
  -- }
  
  -- Admin decision
  admin_decision TEXT, -- pending, approved_merge, rejected_duplicate, skip, create_new
  admin_decision_made_by UUID REFERENCES users(id) ON DELETE SET NULL,
  admin_decision_reason TEXT,
  admin_decision_at TIMESTAMPTZ,
  
  -- Merge action result
  merge_status TEXT, -- pending, completed, failed
  merge_completed_at TIMESTAMPTZ,
  merge_action_details JSONB, -- {fields_merged: [...], new_resume_version: ...}
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_bulk_upload_matches_file_id ON bulk_upload_candidate_matches(bulk_upload_file_id);
CREATE INDEX idx_bulk_upload_matches_candidate_id ON bulk_upload_candidate_matches(matched_candidate_user_id);
CREATE INDEX idx_bulk_upload_matches_decision ON bulk_upload_candidate_matches(admin_decision);
CREATE INDEX idx_bulk_upload_matches_confidence ON bulk_upload_candidate_matches(match_confidence DESC);

-- ============================================================================
-- 4. BULK UPLOAD PROCESSING QUEUE TABLE (Async job tracking for job queues)
-- ============================================================================
CREATE TABLE IF NOT EXISTS bulk_upload_processing_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Job info
  bulk_upload_id UUID NOT NULL REFERENCES bulk_uploads(id) ON DELETE CASCADE,
  bulk_upload_file_id UUID REFERENCES bulk_upload_files(id) ON DELETE CASCADE,
  
  job_type TEXT NOT NULL, -- virus_scan, parse_resume, detect_duplicate, create_account, send_invite
  job_status TEXT NOT NULL DEFAULT 'queued', -- queued, processing, completed, failed, retry
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  
  -- Execution details
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  execution_time_seconds INTEGER,
  
  -- Error tracking
  error_message TEXT,
  error_details JSONB,
  
  -- Result stored
  job_result JSONB,
  
  -- Priority & scheduling
  priority INTEGER DEFAULT 50, -- 0-100, higher = more urgent
  scheduled_for TIMESTAMPTZ DEFAULT now(),
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_queue_status ON bulk_upload_processing_queue(job_status);
CREATE INDEX idx_queue_bulk_id ON bulk_upload_processing_queue(bulk_upload_id);
CREATE INDEX idx_queue_scheduled ON bulk_upload_processing_queue(scheduled_for);
CREATE INDEX idx_queue_priority ON bulk_upload_processing_queue(priority DESC, scheduled_for);

-- ============================================================================
-- 5. BULK UPLOAD AUDIT LOG TABLE (Compliance & tracking)
-- ============================================================================
CREATE TABLE IF NOT EXISTS bulk_upload_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bulk_upload_id UUID NOT NULL REFERENCES bulk_uploads(id) ON DELETE CASCADE,
  
  -- Action info
  action_type TEXT NOT NULL, -- upload_started, file_scanned, duplicate_reviewed, account_created, candidate_verified, merge_completed
  actor_type TEXT NOT NULL, -- admin, system, candidate
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  
  -- Changed data
  affected_resource_type TEXT, -- bulk_upload, bulk_upload_file, candidate_profile
  affected_resource_id UUID,
  
  changes_before JSONB,
  changes_after JSONB,
  
  -- Context
  ip_address INET,
  user_agent TEXT,
  action_details TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_audit_bulk_id ON bulk_upload_audit_log(bulk_upload_id);
CREATE INDEX idx_audit_action ON bulk_upload_audit_log(action_type);
CREATE INDEX idx_audit_timestamp ON bulk_upload_audit_log(created_at DESC);

-- ============================================================================
-- 6. ADMIN USERS PERMISSIONS TABLE (Enhanced from existing)
-- ============================================================================
-- NEW: Add columns to existing users/admin_users table
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_role TEXT; -- super_admin, hr_admin, recruiter_manager
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS bulk_upload_permission BOOLEAN DEFAULT false;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS data_export_permission BOOLEAN DEFAULT false;

CREATE TABLE IF NOT EXISTS admin_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Role assignment
  role TEXT NOT NULL, -- super_admin, hr_admin, recruiter_manager
  
  -- Permission flags
  can_bulk_upload BOOLEAN DEFAULT false,
  can_review_duplicates BOOLEAN DEFAULT false,
  can_create_accounts BOOLEAN DEFAULT false,
  can_export_data BOOLEAN DEFAULT false,
  can_manage_admins BOOLEAN DEFAULT false,
  can_delete_data BOOLEAN DEFAULT false,
  
  -- Scope restrictions
  accessible_companies TEXT[] DEFAULT '{}', -- If multi-tenant
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_admin_perms_user_id ON admin_permissions(admin_user_id);
CREATE INDEX idx_admin_perms_role ON admin_permissions(role);

-- ============================================================================
-- 7. BULK UPLOAD CANDIDATE ACCOUNTS TABLE (Linking candidates to bulk batches)
-- ============================================================================
CREATE TABLE IF NOT EXISTS bulk_upload_candidate_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bulk_upload_id UUID NOT NULL REFERENCES bulk_uploads(id) ON DELETE CASCADE,
  candidate_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Account creation method
  creation_method TEXT NOT NULL, -- new_account, existing_account, duplicate_merge
  
  -- Account status in context of bulk upload
  candidate_status TEXT NOT NULL, -- shadow_profile, verification_pending, verified, rejected
  
  -- Invitation status
  invitation_sent_at TIMESTAMPTZ,
  invitation_opened_at TIMESTAMPTZ,
  device_registered_at TIMESTAMPTZ,
  email_verified_at TIMESTAMPTZ,
  
  -- Original source file
  source_file_id UUID REFERENCES bulk_upload_files(id) ON DELETE SET NULL,
  
  -- If merged duplicate
  merged_from_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  merge_details JSONB, -- {fields_merged: [...], new_resume_version_id: ...}
  
  -- Compliance
  consent_given BOOLEAN DEFAULT false,
  consent_timestamp TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_bulk_candidates_bulk_id ON bulk_upload_candidate_accounts(bulk_upload_id);
CREATE INDEX idx_bulk_candidates_user_id ON bulk_upload_candidate_accounts(candidate_user_id);
CREATE INDEX idx_bulk_candidates_status ON bulk_upload_candidate_accounts(candidate_status);

-- ============================================================================
-- 8. UPDATE TRIGGER for candidate_profiles (Mark bulk-uploaded candidates)
-- ============================================================================
-- Add new column to candidate_profiles (if not exists)
-- ALTER TABLE candidate_profiles ADD COLUMN IF NOT EXISTS bulk_upload_source_batch_id UUID REFERENCES bulk_uploads(id);
-- ALTER TABLE candidate_profiles ADD COLUMN IF NOT EXISTS is_bulk_uploaded BOOLEAN DEFAULT false;
-- ALTER TABLE candidate_profiles ADD COLUMN IF NOT EXISTS account_type TEXT DEFAULT 'standard'; -- standard, bulk_uploaded, imported

-- ============================================================================
-- 9. SUMMARY MATERIALIZED VIEW for dashboard reporting
-- ============================================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS bulk_upload_summary AS
SELECT 
  bu.id AS bulk_upload_id,
  bu.batch_name,
  bu.admin_id,
  bu.upload_status,
  bu.total_files_uploaded,
  bu.successfully_parsed,
  bu.parsing_failed,
  COALESCE(bu.extraction_confidence_avg, 0) AS avg_confidence,
  bu.duplicate_candidates_detected,
  bu.new_candidates_identified,
  bu.duplicates_admin_reviewed,
  bu.duplicates_auto_merged,
  bu.shadow_profiles_created,
  bu.verified_accounts_from_bulk,
  bu.invitations_sent,
  bu.invitations_opened,
  bu.account_verifications_completed,
  bu.created_at,
  bu.updated_at,
  (bu.account_verifications_completed::float / NULLIF(bu.shadow_profiles_created, 0)) * 100 AS verification_rate_percent,
  (bu.successfully_parsed::float / NULLIF(bu.total_files_uploaded, 0)) * 100 AS parse_success_rate_percent
FROM bulk_uploads bu;

-- ============================================================================
-- 10. CONSTRAINTS & FOREIGN KEYS
-- ============================================================================

-- Ensure data integrity for duplicate detection
ALTER TABLE bulk_upload_files 
  ADD CONSTRAINT check_parsing_confidence CHECK (parsing_confidence >= 0 AND parsing_confidence <= 1);

ALTER TABLE bulk_upload_candidate_matches 
  ADD CONSTRAINT check_match_confidence CHECK (match_confidence >= 0.5 AND match_confidence <= 1);

-- ============================================================================
-- DOCUMENTATION
-- ============================================================================

/*
BULK UPLOAD WORKFLOW:

1. UPLOAD PHASE
   - Admin uploads .zip or individual .pdf/.doc files
   - Files stored in bulk_uploads & bulk_upload_files
   - Initial scan for duplicates (based on file_hash)

2. VIRUS SCAN PHASE
   - Async job queued (bulk_upload_processing_queue)
   - ClamAV scans each file
   - Result stored in bulk_upload_files.virus_scan_status
   - If infected: flag and skip, move to next file

3. PARSING PHASE
   - Resume text extracted using ComprehensiveResumeExtractor
   - Extracted data: name, email, phone, location, role, years_exp, education, skills
   - Raw text stored in bulk_upload_files.raw_text
   - Parsed data (JSON) stored in bulk_upload_files.parsed_data

4. DUPLICATE DETECTION PHASE
   - Match incoming resume against existing candidates
   - Score calculation:
     * Email exact match: +100%
     * Phone exact match: +90%
     * Name fuzzy match (Levenshtein): +60-85%
     * Skills overlap: +20%
     * Company/title similarity: +20%
   - Results stored in bulk_upload_candidate_matches
   - Scoring breakdown stored for admin review

5. ADMIN REVIEW PHASE
   - Matches >90%: Auto-merge (optional)
   - Matches 70-90%: Flag for admin review
   - Matches <70%: Create new candidate
   - Admin reviews duplicates in admin dashboard
   - Admin decision: approve_merge, reject_duplicate, create_new

6. ACCOUNT CREATION PHASE
   - For new candidates: Create "shadow profile"
     * Status: unverified
     * Permission: view-only until verified
   - For duplicates (merged): Update existing candidate resume
   - Create entry in bulk_upload_candidate_accounts

7. INVITATION PHASE
   - Generate device registration link
   - Send email invitation
   - Track: invitation_sent_at, invitation_opened_at
   - Candidate registers device → Email verification
   - Update: candidate_status = verified

8. COMPLETION PHASE
   - Update bulk_upload final metrics
   - Compress and archive original files (if needed)
   - Schedule deletion per data_retention_days
   - Generate admin report

MANDATORY FIELDS (MUST be present to accept resume):
- Name
- Email
- Phone
- Location
- Experience (years or roles)
- Education (degree or school)
- Current Role
- Job Location

CONFIDENCE SCORING THRESHOLDS:
- >90%: Auto-merge (definite duplicate)
- 70-90%: Flag for review (likely duplicate)
- 50-70%: Soft match (possible duplicate)
- <50%: No match (new candidate)

DATA RETENTION:
- Default: 90 days (configurable per batch)
- Delete original files after retention period
- Keep parsed data indefinitely (for audit)
- Compliance: Include retention timestamp in audit log
*/
