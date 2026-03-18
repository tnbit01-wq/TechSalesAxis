
-- Profile Matching & Reasoning Cache Schema
-- This table stores AI-generated reasoning for candidate-recruiter matches.
-- It includes versioning (tokens) to handle assessment retakes.

CREATE TABLE IF NOT EXISTS public.profile_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    recruiter_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    match_score INT DEFAULT 0,
    reasoning_text TEXT, -- Simple English reasoning
    candidate_token TEXT, -- Timestamp or hash of candidate's last assessment
    recruiter_token TEXT, -- Timestamp or hash of recruiter's last assessment
    match_type TEXT DEFAULT 'culture_fit', -- For filtering different recommendation types
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(candidate_id, recruiter_id, match_type)
);

-- Indexing for fast lookups
CREATE INDEX IF NOT EXISTS idx_profile_matches_candidate ON public.profile_matches(candidate_id);
CREATE INDEX IF NOT EXISTS idx_profile_matches_recruiter ON public.profile_matches(recruiter_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER tr_update_profile_matches_timestamp
BEFORE UPDATE ON public.profile_matches
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
