-- Migration: add current_salary column and indexes for salary fields
BEGIN;

ALTER TABLE candidate_profiles
  ADD COLUMN IF NOT EXISTS current_salary numeric;

-- Ensure expected_salary column exists (it already does in model)
-- CREATE INDEX for common filters if needed
CREATE INDEX IF NOT EXISTS idx_candidate_expected_salary ON candidate_profiles (expected_salary);
CREATE INDEX IF NOT EXISTS idx_candidate_current_salary ON candidate_profiles (current_salary);

COMMIT;
