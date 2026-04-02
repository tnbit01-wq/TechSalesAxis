-- ============================================================================
-- BULK UPLOAD FEATURE - CORRECTED DATABASE SCHEMA
-- Author: GitHub Copilot
-- Date: March 27, 2026
-- Description: Adds tables for Bulk Resume Upload, independent storage for resumes,
-- and Shadow Profiles. Fixes UUID/gen_random_uuid errors and relation issues.
-- ============================================================================

-- Ensure pgcrypto is available for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- DROP TABLES IF THEY EXIST (IN REVERSE ORDER OF DEPENDENCY)
DROP TABLE IF EXISTS bulk_upload_candidate_matches;
DROP TABLE IF EXISTS bulk_upload_files;
DROP TABLE IF EXISTS bulk_uploads;

-- 1. Main Bulk Upload Batches
CREATE TABLE bulk_uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL, -- References users(id) - assuming users table exists
    
    -- Batch metadata
    batch_name TEXT NOT NULL,
    batch_description TEXT,
    source_system TEXT DEFAULT 'internal_hr',
    
    -- Processing status
    upload_status TEXT NOT NULL DEFAULT 'uploaded', -- uploaded, processing, completed, failed
    processing_started_at TIMESTAMP WITH TIME ZONE,
    processing_completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Metrics
    total_files_uploaded INTEGER NOT NULL DEFAULT 0,
    successfully_parsed INTEGER NOT NULL DEFAULT 0,
    parsing_failed INTEGER NOT NULL DEFAULT 0,
    extraction_confidence_avg NUMERIC(5, 4),
    
    -- Duplicate detection metrics
    total_candidates_found INTEGER NOT NULL DEFAULT 0,
    duplicate_candidates_detected INTEGER NOT NULL DEFAULT 0,
    new_candidates_identified INTEGER NOT NULL DEFAULT 0,
    
    -- Account creation metrics
    shadow_profiles_created INTEGER NOT NULL DEFAULT 0,
    invitations_sent INTEGER NOT NULL DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Individual Uploaded Files (Shadow Profiles & Independent Resume Storage)
CREATE TABLE bulk_upload_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bulk_upload_id UUID NOT NULL REFERENCES bulk_uploads(id) ON DELETE CASCADE,
    
    -- File metadata
    original_filename TEXT NOT NULL,
    file_ext TEXT NOT NULL, -- pdf, doc, docx
    file_size_bytes BIGINT,
    file_hash TEXT NOT NULL, -- SHA-256 for deduplication
    
    -- SEPARATE STORAGE: s3 path in the dedicated bucket (talentflow-bulk-resumes)
    file_storage_path TEXT NOT NULL, 
    
    -- Status
    parsing_status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
    parsing_error TEXT,
    parsed_at TIMESTAMP WITH TIME ZONE,
    
    -- Extracted PII & Data (Shadow Profile)
    extracted_name TEXT,
    extracted_email TEXT,
    extracted_phone TEXT,
    extracted_location TEXT,
    extracted_current_role TEXT,
    extracted_years_experience INTEGER DEFAULT 0,
    
    raw_text TEXT,
    parsed_data JSONB, -- Full extraction results
    
    -- Matching link (if we find a match later)
    matched_candidate_id UUID, 
    match_confidence NUMERIC(5, 4),
    match_type TEXT, -- exact, strong, moderate, no_match
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Duplicate Matches (For Admin Review Interface)
CREATE TABLE bulk_upload_candidate_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bulk_upload_file_id UUID NOT NULL REFERENCES bulk_upload_files(id) ON DELETE CASCADE,
    matched_candidate_user_id UUID NOT NULL, -- References users(id)
    
    -- Matching details
    match_type TEXT NOT NULL, -- exact_match, strong_match, moderate_match
    match_confidence NUMERIC(5, 4) NOT NULL,
    match_reason TEXT,
    match_details JSONB,
    
    -- Admin decision
    admin_decision TEXT NOT NULL DEFAULT 'pending', -- pending, approved_merge, rejected_duplicate, skip
    admin_decision_made_by UUID, -- References users(id)
    admin_decision_reason TEXT,
    admin_decision_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Processing Queue (For tracking async tasks)
CREATE TABLE IF NOT EXISTS bulk_upload_processing_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bulk_upload_id UUID NOT NULL REFERENCES bulk_uploads(id) ON DELETE CASCADE,
    bulk_upload_file_id UUID REFERENCES bulk_upload_files(id) ON DELETE CASCADE,
    
    job_type TEXT NOT NULL, -- parse_resume, detect_duplicate, scan_virus
    job_status TEXT NOT NULL DEFAULT 'queued', -- queued, processing, completed, failed
    retry_count INTEGER DEFAULT 0,
    
    error_message TEXT,
    job_result JSONB,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Audit Log for Bulk Operations
CREATE TABLE IF NOT EXISTS bulk_upload_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bulk_upload_id UUID NOT NULL REFERENCES bulk_uploads(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL, -- upload_started, file_parsed, decision_made, merge_completed
    actor_id UUID, -- References users(id)
    action_details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- PERFORMANCE INDICES
CREATE INDEX IF NOT EXISTS idx_bulk_files_hash ON bulk_upload_files(file_hash);
CREATE INDEX IF NOT EXISTS idx_bulk_files_upload_id ON bulk_upload_files(bulk_upload_id);
CREATE INDEX IF NOT EXISTS idx_bulk_files_email ON bulk_upload_files(extracted_email);
CREATE INDEX IF NOT EXISTS idx_bulk_matches_decision ON bulk_upload_candidate_matches(admin_decision);
CREATE INDEX IF NOT EXISTS idx_bulk_queue_status ON bulk_upload_processing_queue(job_status);

-- FOREIGN KEY CONSTRAINTS (Assuming users table exists)
-- ALTER TABLE bulk_uploads ADD CONSTRAINT fk_bulk_admin FOREIGN KEY (admin_id) REFERENCES users(id);
-- ALTER TABLE bulk_upload_files ADD CONSTRAINT fk_bulk_matched_user FOREIGN KEY (matched_candidate_id) REFERENCES users(id);
-- ALTER TABLE bulk_upload_candidate_matches ADD CONSTRAINT fk_match_target_user FOREIGN KEY (matched_candidate_user_id) REFERENCES users(id);
