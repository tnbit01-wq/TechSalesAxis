-- Migration: Secure & Lean Candidate Profile Schema
-- Purpose: Remove redundant columns and standardize on JSONB for high-fidelity UI

-- 1. Remove redundant/obsolete columns from candidate_profiles
ALTER TABLE public.candidate_profiles 
DROP COLUMN IF EXISTS resume_uploaded,
DROP COLUMN IF EXISTS qualifications_held,
DROP COLUMN IF EXISTS university,
DROP COLUMN IF EXISTS current_company_name,
DROP COLUMN IF EXISTS previous_companies,
DROP COLUMN IF EXISTS resume_url,
DROP COLUMN IF EXISTS sales_metrics,
DROP COLUMN IF EXISTS crm_tools,
DROP COLUMN IF EXISTS sales_methodologies,
DROP COLUMN IF EXISTS product_domain_expertise,
DROP COLUMN IF EXISTS target_market_exposure;

-- 2. Add missing UI-relevant columns
ALTER TABLE public.candidate_profiles 
ADD COLUMN IF NOT EXISTS expected_salary INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS location_tier TEXT;

-- 3. Ensure JSONB defaults and constraints
-- These are now the primary source of truth for the Resume Parser and UI
ALTER TABLE public.candidate_profiles 
ALTER COLUMN education_history SET DEFAULT '[]'::jsonb,
ALTER COLUMN experience_history SET DEFAULT '[]'::jsonb,
ALTER COLUMN projects SET DEFAULT '[]'::jsonb,
ALTER COLUMN career_gap_report SET DEFAULT '{}'::jsonb;

-- 4. Standardize Recruiter Profile Schema Preview
-- Removing redundant job_title/department if using professional_persona (to be built)
ALTER TABLE public.recruiter_profiles 
ADD COLUMN IF NOT EXISTS identity_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS identity_proof_path TEXT,
ADD COLUMN IF NOT EXISTS professional_persona JSONB DEFAULT '{}'::jsonb;

-- 5. Trigger to sync completion_score (Draft)
-- This function will be expanded as we implement the "Gamification" logic
CREATE OR REPLACE FUNCTION public.calculate_profile_completion()
RETURNS TRIGGER AS $$
DECLARE
    score INTEGER := 0;
BEGIN
    IF NEW.full_name IS NOT NULL AND NEW.full_name != '' THEN score := score + 10; END IF;
    IF NEW.profile_photo_url IS NOT NULL THEN score := score + 15; END IF;
    IF NEW.bio IS NOT NULL AND length(NEW.bio) > 20 THEN score := score + 15; END IF;
    IF NEW.experience_history != '[]'::jsonb THEN score := score + 30; END IF;
    IF NEW.education_history != '[]'::jsonb THEN score := score + 20; END IF;
    IF NEW.identity_verified = true THEN score := score + 10; END IF;
    
    NEW.completion_score := score;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_refresh_completion_score ON public.candidate_profiles;
CREATE TRIGGER tr_refresh_completion_score
    BEFORE INSERT OR UPDATE ON public.candidate_profiles
    FOR EACH ROW EXECUTE FUNCTION public.calculate_profile_completion();
