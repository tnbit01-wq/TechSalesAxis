-- ========================================
-- CAREER READINESS FEATURE - DATABASE MIGRATION
-- Date: April 8, 2026
-- Purpose: Add job search mode, notice period, and availability tracking
-- Database: PostgreSQL
-- ========================================

BEGIN;

-- Step 1: Check if columns exist first, add if needed
ALTER TABLE candidate_profiles 
ADD COLUMN IF NOT EXISTS job_search_mode TEXT DEFAULT 'exploring';

ALTER TABLE candidate_profiles 
ADD COLUMN IF NOT EXISTS notice_period_days INTEGER DEFAULT NULL;

ALTER TABLE candidate_profiles 
ADD COLUMN IF NOT EXISTS career_readiness_timestamp TIMESTAMPTZ DEFAULT now();

ALTER TABLE candidate_profiles 
ADD COLUMN IF NOT EXISTS availability_date TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE candidate_profiles 
ADD COLUMN IF NOT EXISTS willing_to_relocate BOOLEAN DEFAULT false;

ALTER TABLE candidate_profiles 
ADD COLUMN IF NOT EXISTS career_readiness_metadata JSONB DEFAULT '{}';

-- Step 2: Add CHECK constraint to ensure valid job_search_mode values
ALTER TABLE candidate_profiles 
ADD CONSTRAINT IF NOT EXISTS check_job_search_mode 
CHECK (job_search_mode IN ('exploring', 'passive', 'active'));

-- Step 3: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_candidate_profiles_job_search_mode 
ON candidate_profiles(job_search_mode, career_readiness_timestamp);

CREATE INDEX IF NOT EXISTS idx_candidate_profiles_availability_date 
ON candidate_profiles(availability_date);

CREATE INDEX IF NOT EXISTS idx_candidate_profiles_notice_period 
ON candidate_profiles(notice_period_days);

CREATE INDEX IF NOT EXISTS idx_candidate_profiles_willing_to_relocate
ON candidate_profiles(willing_to_relocate);

-- Step 4: Initialize existing candidate data
UPDATE candidate_profiles 
SET 
  job_search_mode = COALESCE(job_search_mode, 'exploring'),
  career_readiness_timestamp = COALESCE(career_readiness_timestamp, NOW()),
  career_readiness_metadata = COALESCE(
    career_readiness_metadata,
    jsonb_build_object(
      'exploration_trigger', 'initial_onboarding',
      'willing_to_relocate', false,
      'contract_preference', 'fulltime',
      'visa_sponsorship_needed', false,
      'salary_flexibility', 0.5
    )
  )
WHERE job_search_mode IS NULL;

-- Step 5: Calculate availability_date for those with notice_period_days
UPDATE candidate_profiles 
SET availability_date = CURRENT_TIMESTAMP + (notice_period_days || ' days')::interval
WHERE notice_period_days IS NOT NULL;

-- Step 6: Create audit history table for tracking changes
CREATE TABLE IF NOT EXISTS career_readiness_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  old_job_search_mode TEXT,
  new_job_search_mode TEXT,
  old_notice_period_days INTEGER,
  new_notice_period_days INTEGER,
  changed_at TIMESTAMPTZ DEFAULT now(),
  reason TEXT DEFAULT 'self_update',
  ip_address TEXT,
  user_agent TEXT,
  CONSTRAINT fk_career_readiness_history_user 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_career_readiness_history_user 
ON career_readiness_history(user_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_career_readiness_history_mode
ON career_readiness_history(new_job_search_mode, changed_at DESC);

-- Step 7: Create trigger function to update availability_date
CREATE OR REPLACE FUNCTION update_availability_date()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.notice_period_days IS DISTINCT FROM OLD.notice_period_days THEN
    IF NEW.notice_period_days IS NOT NULL THEN
      NEW.availability_date = CURRENT_TIMESTAMP + (NEW.notice_period_days || ' days')::interval;
    ELSE
      NEW.availability_date = NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop old trigger if exists
DROP TRIGGER IF EXISTS trigger_update_availability_date ON candidate_profiles;

-- Create trigger
CREATE TRIGGER trigger_update_availability_date
BEFORE UPDATE ON candidate_profiles
FOR EACH ROW
EXECUTE FUNCTION update_availability_date();

-- Step 8: Create trigger function to log changes
CREATE OR REPLACE FUNCTION log_career_readiness_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.job_search_mode IS DISTINCT FROM OLD.job_search_mode) 
     OR (NEW.notice_period_days IS DISTINCT FROM OLD.notice_period_days) THEN
    INSERT INTO career_readiness_history (
      user_id, 
      old_job_search_mode, 
      new_job_search_mode,
      old_notice_period_days,
      new_notice_period_days,
      reason
    ) VALUES (
      NEW.user_id,
      OLD.job_search_mode,
      NEW.job_search_mode,
      OLD.notice_period_days,
      NEW.notice_period_days,
      'self_update'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop old trigger if exists
DROP TRIGGER IF EXISTS trigger_log_career_readiness ON candidate_profiles;

-- Create trigger
CREATE TRIGGER trigger_log_career_readiness
AFTER UPDATE ON candidate_profiles
FOR EACH ROW
EXECUTE FUNCTION log_career_readiness_change();

-- Step 9: Add column comments for documentation
COMMENT ON COLUMN candidate_profiles.job_search_mode 
  IS 'Candidate job search intent: exploring (casual), passive (open), active (urgent)';
  
COMMENT ON COLUMN candidate_profiles.notice_period_days 
  IS 'Days notice required before starting new role (0=immediate, NULL=exploring)';
  
COMMENT ON COLUMN candidate_profiles.availability_date 
  IS 'Calculated date when candidate can realistically start (now + notice_period)';
  
COMMENT ON COLUMN candidate_profiles.career_readiness_timestamp 
  IS 'When career readiness was last updated (triggers re-verification every 15 days)';
  
COMMENT ON COLUMN candidate_profiles.willing_to_relocate 
  IS 'Whether candidate is willing to relocate for job opportunities';
  
COMMENT ON COLUMN candidate_profiles.career_readiness_metadata 
  IS 'JSONB storing exploration_trigger, visa_sponsorship_needed, salary_flexibility, etc';

-- Step 10: Verify migration success
SELECT 
  COUNT(*) as total_records,
  COUNT(CASE WHEN job_search_mode = 'exploring' THEN 1 END) as exploring_count,
  COUNT(CASE WHEN job_search_mode = 'passive' THEN 1 END) as passive_count,
  COUNT(CASE WHEN job_search_mode = 'active' THEN 1 END) as active_count,
  COUNT(CASE WHEN job_search_mode IS NULL THEN 1 END) as null_count
FROM candidate_profiles;

COMMIT;

-- ========================================
-- VERIFICATION QUERIES (run these after to confirm)
-- ========================================

-- Check if all columns exist
SELECT 
  column_name, 
  data_type, 
  is_nullable 
FROM information_schema.columns 
WHERE table_name = 'candidate_profiles' 
  AND column_name IN (
    'job_search_mode',
    'notice_period_days',
    'availability_date',
    'career_readiness_timestamp',
    'career_readiness_metadata',
    'willing_to_relocate'
  )
ORDER BY ordinal_position;

-- Check if triggers exist
SELECT 
  trigger_name, 
  event_manipulation, 
  event_object_table 
FROM information_schema.triggers 
WHERE event_object_table = 'candidate_profiles' 
  AND trigger_name LIKE '%career_readiness%'
  OR trigger_name LIKE '%availability%';

-- Check if indexes exist
SELECT 
  indexname, 
  tablename 
FROM pg_indexes 
WHERE tablename = 'candidate_profiles' 
  AND indexname LIKE '%career_readiness%'
  OR indexname LIKE '%availability%'
  OR indexname LIKE '%notice_period%';

-- Sample data check
SELECT 
  full_name,
  job_search_mode,
  notice_period_days,
  availability_date,
  willing_to_relocate,
  career_readiness_timestamp
FROM candidate_profiles
LIMIT 5;
