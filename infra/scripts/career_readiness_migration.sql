-- ========================================
-- Migration: Career Readiness Feature
-- Date: April 8, 2026
-- Purpose: Add job search mode, notice period, and availability tracking
-- ========================================

-- 1. Add new columns to candidate_profiles
ALTER TABLE candidate_profiles 
ADD COLUMN IF NOT EXISTS job_search_mode TEXT DEFAULT 'exploring',
ADD COLUMN IF NOT EXISTS notice_period_days INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS career_readiness_timestamp TIMESTAMPTZ DEFAULT now(),
ADD COLUMN IF NOT EXISTS availability_date TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS willing_to_relocate BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS career_readiness_metadata JSONB DEFAULT '{}';

-- 2. Create ENUM for job_search_mode if not exists
DO $$ BEGIN
    CREATE TYPE job_search_mode_enum AS ENUM ('exploring', 'passive', 'active');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 3. Add constraint if not exists
ALTER TABLE candidate_profiles 
ADD CONSTRAINT career_readiness_mode_check 
CHECK (job_search_mode IN ('exploring', 'passive', 'active'))
ON CONFLICT DO NOTHING;

-- 4. Create index for faster filtering by recruiter
CREATE INDEX IF NOT EXISTS idx_candidate_profiles_job_search_mode 
ON candidate_profiles(job_search_mode, career_readiness_timestamp);

CREATE INDEX IF NOT EXISTS idx_candidate_profiles_availability_date 
ON candidate_profiles(availability_date);

CREATE INDEX IF NOT EXISTS idx_candidate_profiles_notice_period 
ON candidate_profiles(notice_period_days);

-- 5. Update existing candidates without career readiness data
UPDATE candidate_profiles 
SET 
  job_search_mode = 'exploring',
  career_readiness_timestamp = NOW(),
  career_readiness_metadata = jsonb_build_object(
    'exploration_trigger', 'initial_onboarding',
    'willing_to_relocate', false,
    'contract_preference', 'fulltime',
    'visa_sponsorship_needed', false,
    'salary_flexibility', 0.5
  )
WHERE job_search_mode IS NULL OR job_search_mode = '';

-- 6. Calculate availability_date for those with notice_period
UPDATE candidate_profiles 
SET availability_date = CURRENT_TIMESTAMP + (notice_period_days || ' days')::interval
WHERE notice_period_days IS NOT NULL 
AND availability_date IS NULL;

-- 7. Create audit table for tracking career readiness changes (optional, for analytics)
CREATE TABLE IF NOT EXISTS career_readiness_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  old_job_search_mode TEXT,
  new_job_search_mode TEXT,
  old_notice_period_days INTEGER,
  new_notice_period_days INTEGER,
  changed_at TIMESTAMPTZ DEFAULT now(),
  reason TEXT DEFAULT 'self_update',
  ip_address TEXT,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_career_readiness_history_user 
ON career_readiness_history(user_id, changed_at DESC);

-- 8. Trigger to update availability_date when notice_period changes
CREATE OR REPLACE FUNCTION update_availability_date()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.notice_period_days IS NOT NULL 
     AND NEW.notice_period_days != OLD.notice_period_days THEN
    NEW.availability_date = CURRENT_TIMESTAMP + (NEW.notice_period_days || ' days')::interval;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_availability_date ON candidate_profiles;

CREATE TRIGGER trigger_update_availability_date
BEFORE UPDATE ON candidate_profiles
FOR EACH ROW
EXECUTE FUNCTION update_availability_date();

-- 9. Trigger to log career readiness changes
CREATE OR REPLACE FUNCTION log_career_readiness_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.job_search_mode != OLD.job_search_mode 
     OR NEW.notice_period_days != OLD.notice_period_days THEN
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

DROP TRIGGER IF EXISTS trigger_log_career_readiness ON candidate_profiles;

CREATE TRIGGER trigger_log_career_readiness
AFTER UPDATE ON candidate_profiles
FOR EACH ROW
EXECUTE FUNCTION log_career_readiness_change();

-- 10. Add comment documentation
COMMENT ON COLUMN candidate_profiles.job_search_mode 
  IS 'Candidate job search intent: exploring (casual), passive (open), active (urgent)';
  
COMMENT ON COLUMN candidate_profiles.notice_period_days 
  IS 'Days notice required before starting new role (0=immediate, NULL=exploring)';
  
COMMENT ON COLUMN candidate_profiles.availability_date 
  IS 'Calculated date when candidate can realistically start (now + notice_period)';
  
COMMENT ON COLUMN candidate_profiles.career_readiness_timestamp 
  IS 'When career readiness was last updated (triggers re-verification every 15 days)';
  
COMMENT ON COLUMN candidate_profiles.career_readiness_metadata 
  IS 'JSONB storing exploration_trigger, visa_sponsorship_needed, salary_flexibility, etc';

-- 11. Verify migration success
SELECT 
  table_name, 
  column_name, 
  data_type 
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
ORDER BY column_name;
