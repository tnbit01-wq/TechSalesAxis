-- Add columns for between-role details
ALTER TABLE candidate_profiles
  ADD COLUMN between_role_detail VARCHAR,
  ADD COLUMN between_role_note TEXT;

-- Backfill from career_readiness_metadata JSONB if present
UPDATE candidate_profiles
SET between_role_detail = career_readiness_metadata->> 'between_role_detail'
WHERE career_readiness_metadata ? 'between_role_detail' AND (between_role_detail IS NULL OR between_role_detail = '');

UPDATE candidate_profiles
SET between_role_note = career_readiness_metadata->> 'between_role_note'
WHERE career_readiness_metadata ? 'between_role_note' AND (between_role_note IS NULL OR between_role_note = '');
