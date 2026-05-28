-- Migration: promote career readiness fields to individual columns
BEGIN;

ALTER TABLE candidate_profiles
  ADD COLUMN IF NOT EXISTS contract_preference varchar(32) DEFAULT 'fulltime',
  ADD COLUMN IF NOT EXISTS visa_sponsorship_needed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS target_market_segment varchar(64) DEFAULT 'any';

-- Backfill from existing JSONB metadata where present
UPDATE candidate_profiles
SET
  contract_preference = COALESCE((career_readiness_metadata->>'contract_preference'), contract_preference),
  visa_sponsorship_needed = CASE WHEN career_readiness_metadata ? 'visa_sponsorship_needed' THEN (career_readiness_metadata->>'visa_sponsorship_needed')::boolean ELSE visa_sponsorship_needed END,
  target_market_segment = COALESCE((career_readiness_metadata->>'target_market_segment'), target_market_segment)
WHERE career_readiness_metadata IS NOT NULL;

-- Indexes for common filters
CREATE INDEX IF NOT EXISTS idx_candidate_contract_preference ON candidate_profiles (contract_preference);
CREATE INDEX IF NOT EXISTS idx_candidate_visa_sponsorship_needed ON candidate_profiles (visa_sponsorship_needed);
CREATE INDEX IF NOT EXISTS idx_candidate_target_market_segment ON candidate_profiles (target_market_segment);

COMMIT;
