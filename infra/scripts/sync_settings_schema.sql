-- Migration: Standardize Candidate & Recruiter Settings Schema
-- Purpose: Create missing candidate_settings table and unify preference logic

-- 1. Create candidate_settings table (Mirroring recruiter structure)
CREATE TABLE IF NOT EXISTS public.candidate_settings (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    email_notifications BOOLEAN DEFAULT true,
    web_notifications BOOLEAN DEFAULT true,
    mobile_notifications BOOLEAN DEFAULT false,
    is_public BOOLEAN DEFAULT true, -- Determines visibility in Talent Pool
    language TEXT DEFAULT 'en',
    timezone TEXT DEFAULT 'UTC',
    job_alert_frequency TEXT DEFAULT 'instant', -- instant, daily, weekly
    minimum_salary_threshold INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Add modern branding columns to companies if not exists
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS brand_colors JSONB DEFAULT '{"primary": "#4f46e5", "secondary": "#6366f1"}'::jsonb;

-- 3. Add Privacy Column to recruiter_settings
ALTER TABLE public.recruiter_settings ADD COLUMN IF NOT EXISTS ghost_mode BOOLEAN DEFAULT false;

-- 4. Enable RLS (Row Level Security)
ALTER TABLE public.candidate_settings ENABLE ROW LEVEL SECURITY;

-- 5. Policies for candidate_settings
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'candidate_settings' AND policyname = 'Users can view their own candidate settings'
    ) THEN
        CREATE POLICY "Users can view their own candidate settings" 
        ON public.candidate_settings FOR SELECT 
        USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'candidate_settings' AND policyname = 'Users can update their own candidate settings'
    ) THEN
        CREATE POLICY "Users can update their own candidate settings" 
        ON public.candidate_settings FOR UPDATE 
        USING (auth.uid() = user_id);
    END IF;
END $$;

-- 6. Trigger to automatically create settings row for new candidates
CREATE OR REPLACE FUNCTION public.handle_new_candidate_settings()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.candidate_settings (user_id)
    VALUES (new.id)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: Ensure this trigger is active or manually seed existing users
-- DROP TRIGGER IF EXISTS on_auth_user_created_settings ON auth.users;
-- CREATE TRIGGER on_auth_user_created_settings
--     AFTER INSERT ON auth.users
--     FOR EACH ROW EXECUTE FUNCTION public.handle_new_candidate_settings();

-- Manual seed for existing candidate users who might be missing settings
INSERT INTO public.candidate_settings (user_id)
SELECT id FROM auth.users 
WHERE id NOT IN (SELECT user_id FROM public.candidate_settings)
ON CONFLICT (user_id) DO NOTHING;
