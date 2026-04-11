# COPY-PASTE SQL SCRIPT FOR DATABASE MIGRATION

**Just copy everything below and paste into your PostgreSQL query editor**

---

## For psql Command Line:
```
psql -h localhost -U postgres -d talentflow -f CAREER_READINESS_MIGRATION_COMPLETE.sql
```

## For SQL Clients (DBeaver, pgAdmin, etc.): Copy & Paste Below:

```sql
-- ========================================
-- CAREER READINESS FEATURE - DATABASE MIGRATION
-- Paste this entire script into your SQL client and execute
-- ========================================

BEGIN;

-- Step 1: Add new columns to candidate_profiles
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

-- Step 2: Add CHECK constraint
ALTER TABLE candidate_profiles 
ADD CONSTRAINT IF NOT EXISTS check_job_search_mode 
CHECK (job_search_mode IN ('exploring', 'passive', 'active'));

-- Step 3: Create indexes
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

-- Step 5: Calculate availability dates
UPDATE candidate_profiles 
SET availability_date = CURRENT_TIMESTAMP + (notice_period_days || ' days')::interval
WHERE notice_period_days IS NOT NULL;

-- Step 6: Create audit history table
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

-- Step 7: Create trigger functions
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

DROP TRIGGER IF EXISTS trigger_update_availability_date ON candidate_profiles;

CREATE TRIGGER trigger_update_availability_date
BEFORE UPDATE ON candidate_profiles
FOR EACH ROW
EXECUTE FUNCTION update_availability_date();

-- Trigger for logging
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

DROP TRIGGER IF EXISTS trigger_log_career_readiness ON candidate_profiles;

CREATE TRIGGER trigger_log_career_readiness
AFTER UPDATE ON candidate_profiles
FOR EACH ROW
EXECUTE FUNCTION log_career_readiness_change();

-- Step 8: Add comments
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

COMMIT;
```

---

## After Running the Migration:

**Verify it worked by running this:**
```sql
-- Check columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'candidate_profiles' 
  AND column_name IN ('job_search_mode', 'notice_period_days', 'availability_date');

-- Should return 3 rows. If you see 0 rows, the migration didn't work.

-- Check some data
SELECT user_id, job_search_mode, notice_period_days 
FROM candidate_profiles 
LIMIT 5;
```

---

## Then Restart Your Backend:

```powershell
# Kill Python processes
taskkill /F /IM python.exe

# Restart backend
cd apps\api
..\..\.venv\Scripts\Activate.ps1
python -m uvicorn src.main:app --host 127.0.0.1 --port 8005 --reload
```

If you get error "column candidate_profiles.job_search_mode does not exist", it means the SQL migration didn't run successfully. Check for SQL errors in the client.
