-- Migration: add bulk upload indexes for faster batch reconciliation and queue processing
BEGIN;

-- Indexes to speed up batch metrics and file status queries
CREATE INDEX IF NOT EXISTS idx_bulk_upload_files_bulk_upload_id ON bulk_upload_files (bulk_upload_id);
CREATE INDEX IF NOT EXISTS idx_bulk_upload_files_bulk_upload_id_parsing_status ON bulk_upload_files (bulk_upload_id, parsing_status);
CREATE INDEX IF NOT EXISTS idx_bulk_upload_files_bulk_upload_id_match_type ON bulk_upload_files (bulk_upload_id, match_type);
CREATE INDEX IF NOT EXISTS idx_bulk_upload_files_bulk_upload_id_matched_candidate_id ON bulk_upload_files (bulk_upload_id, matched_candidate_id);
CREATE INDEX IF NOT EXISTS idx_bulk_upload_files_parsing_confidence ON bulk_upload_files (parsing_confidence);
CREATE INDEX IF NOT EXISTS idx_bulk_upload_candidate_matches_bulk_upload_file_id ON bulk_upload_candidate_matches (bulk_upload_file_id);
CREATE INDEX IF NOT EXISTS idx_bulk_upload_candidate_matches_match_confidence ON bulk_upload_candidate_matches (match_confidence);
CREATE INDEX IF NOT EXISTS idx_bulk_upload_candidate_matches_admin_decision ON bulk_upload_candidate_matches (admin_decision);
CREATE INDEX IF NOT EXISTS idx_bulk_upload_processing_queue_bulk_upload_id ON bulk_upload_processing_queue (bulk_upload_id);
CREATE INDEX IF NOT EXISTS idx_bulk_upload_processing_queue_job_status ON bulk_upload_processing_queue (job_status);
CREATE INDEX IF NOT EXISTS idx_bulk_upload_processing_queue_scheduled_for ON bulk_upload_processing_queue (scheduled_for);
CREATE INDEX IF NOT EXISTS idx_bulk_upload_processing_queue_job_type_status ON bulk_upload_processing_queue (job_type, job_status);
CREATE INDEX IF NOT EXISTS idx_bulk_upload_audit_log_bulk_upload_id ON bulk_upload_audit_log (bulk_upload_id);

COMMIT;
