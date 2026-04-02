-- ============================================================================
-- BULK UPLOAD - DATABASE INTEGRATION & S3 CONFIGURATION
-- Author: GitHub Copilot
-- Date: March 27, 2026
-- Description: 
-- 1. Updates candidate_profiles to link back to bulk uploads (Shadow Profile tracking).
-- 2. Provides guidance for S3 Bucket setup.
-- ============================================================================

-- 1. EXTEND CANDIDATE PROFILES
-- We add 'bulk_file_id' to candidate_profiles. 
-- This allows us to know which candidate was created from which bulk upload.
ALTER TABLE candidate_profiles 
ADD COLUMN IF NOT EXISTS bulk_file_id UUID REFERENCES bulk_upload_files(id) ON DELETE SET NULL;

-- Add index for faster lookups when checking if a bulk file has already converted to a profile
CREATE INDEX IF NOT EXISTS idx_candidate_bulk_file_id ON candidate_profiles(bulk_file_id);

-- 2. BULK UPLOAD SOURCE TRACKING
-- Mark if a candidate is a "Shadow Profile" (not yet verified/claimed)
ALTER TABLE candidate_profiles 
ADD COLUMN IF NOT EXISTS is_shadow_profile BOOLEAN DEFAULT FALSE;

-- ============================================================================
-- S3 CONFIGURATION REQUIREMENTS (Manual Setup Needed)
-- ============================================================================
-- The Bulk Upload feature requires a dedicated, isolated S3 bucket to prevent
-- mixing unverified/bulk resumes with regular candidate resumes.
--
-- BUCKET NAME: talentflow-bulk-resumes (or your custom S3_BUCKET_BULK_RESUMES env)
--
-- RECOMMENDED BUCKET POLICY:
-- --------------------------
-- {
--     "Version": "2012-10-17",
--     "Statement": [
--         {
--             "Sid": "AllowAdminAndApiAccess",
--             "Effect": "Allow",
--             "Principal": {
--                 "AWS": "arn:aws:iam::YOUR_ACCOUNT_ID:role/TalentFlowApiRole"
--             },
--             "Action": [
--                 "s3:PutObject",
--                 "s3:GetObject",
--                 "s3:DeleteObject"
--             ],
--             "Resource": "arn:aws:s3:::talentflow-bulk-resumes/*"
--         }
--     ]
-- }
--
-- RECOMMENDED LIFECYCLE RULE:
-- ---------------------------
-- Bulk resumes are often "leads" and might not need to be stored forever if not converted.
-- Suggested: Move to GLACIER after 90 days, Delete after 365 days if matching shadow profile is not activated.

