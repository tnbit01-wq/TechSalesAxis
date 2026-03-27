-- =========================================
-- Career GPS & Milestones Schema
-- Implementation for Feature 3
-- =========================================

-- 1. Extend Candidate Profiles for GPS Inputs
ALTER TABLE candidate_profiles 
ADD COLUMN IF NOT EXISTS target_role TEXT,
ADD COLUMN IF NOT EXISTS career_interests TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS long_term_goal TEXT;

-- 2. Career GPS Parent Table
CREATE TABLE IF NOT EXISTS career_gps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES candidate_profiles(user_id) ON DELETE CASCADE,
    target_role TEXT NOT NULL,
    current_status TEXT DEFAULT 'active' CHECK (current_status IN ('active', 'archived')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Career Milestones Table
CREATE TABLE IF NOT EXISTS career_milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gps_id UUID NOT NULL REFERENCES career_gps(id) ON DELETE CASCADE,
    step_order INT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    skills_to_acquire TEXT[] DEFAULT '{}',
    learning_actions JSONB DEFAULT '[]', -- Array of {title, platform, url}
    status TEXT DEFAULT 'not-started' CHECK (status IN ('not-started', 'in-progress', 'completed')),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Enable RLS
ALTER TABLE career_gps ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_milestones ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
DROP POLICY IF EXISTS "Users can manage their own GPS" ON career_gps;
CREATE POLICY "Users can manage their own GPS" 
ON career_gps FOR ALL 
USING (candidate_id = auth.uid());

DROP POLICY IF EXISTS "Users can manage their own milestones" ON career_milestones;
CREATE POLICY "Users can manage their own milestones" 
ON career_milestones FOR ALL 
USING (gps_id IN (SELECT id FROM career_gps WHERE candidate_id = auth.uid()));

-- 6. Add to Realtime Publication
-- Realtime features removed - authenticationand updates handled by FastAPI application layer
