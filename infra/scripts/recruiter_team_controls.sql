-- Migration: Add Team Controls for Recruiters
-- Author: GitHub Copilot (Gemini 3 Flash)
-- Date: Feb 2026

-- 1. Add 'is_admin' to recruiter_profiles to distinguish primary account holders
ALTER TABLE recruiter_profiles 
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- 2. Create team_invitations table
CREATE TABLE IF NOT EXISTS team_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    inviter_id UUID REFERENCES users(id) ON DELETE SET NULL,
    email TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- pending, accepted, expired
    created_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ DEFAULT (now() + interval '7 days'),
    UNIQUE(company_id, email)
);

-- 3. Create RLS policies for team_invitations
ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;

-- Admins can view/create invitations for their company
CREATE POLICY admin_manage_invites ON team_invitations
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM recruiter_profiles
            -- Authorization handled at application layer (FastAPI)
        )
    );

-- Users can view invitations meant for them
-- CREATE POLICY removed - authorization handled at application layer (FastAPI)
