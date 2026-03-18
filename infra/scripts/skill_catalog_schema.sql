-- Create skill_catalog table for Evolutionary Skill Library
CREATE TABLE IF NOT EXISTS public.skill_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    experience_band TEXT NOT NULL,
    occurrence_count BIGINT DEFAULT 1,
    is_verified BOOLEAN DEFAULT true,
    last_seen_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    -- Ensure same skill name per experience band is unique
    UNIQUE (name, experience_band)
);

-- Index for fast lookup in onboarding
CREATE INDEX IF NOT EXISTS idx_skill_catalog_band ON public.skill_catalog (experience_band);

-- RLS: Select is public (needed for onboarding), but update/insert restricted
ALTER TABLE public.skill_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public select for skill_catalog" 
ON public.skill_catalog FOR SELECT 
USING (true);

-- Insert initial seed data from the static skillsData.ts to ensure onboarding isn't empty
-- Fresher
INSERT INTO public.skill_catalog (name, experience_band) VALUES 
('Cold Outbound (Email/Phone)', 'fresher'),
('Lead Research & Sourcing', 'fresher'),
('LinkedIn Sales Navigator', 'fresher'),
('CRM Hygiene (Salesforce/HubSpot)', 'fresher'),
('Objection Handling', 'fresher'),
('Discovery Call Basics', 'fresher'),
('Time Management', 'fresher'),
('Ideal Customer Profile Identification', 'fresher'),
('BDR/SDR Workflow', 'fresher'),
('Active Listening', 'fresher')
ON CONFLICT (name, experience_band) DO NOTHING;

-- Mid
INSERT INTO public.skill_catalog (name, experience_band) VALUES 
('SaaS Product Demoing', 'mid'),
('MEDDIC / MEDDPICC Methodology', 'mid'),
('Solution Selling', 'mid'),
('Pipeline Forecasting', 'mid'),
('ROI & Business Case Mapping', 'mid'),
('Multi-threading', 'mid'),
('Contract Negotiation', 'mid'),
('Account Mapping', 'mid'),
('Gap Analysis', 'mid'),
('Competitive Intelligence', 'mid')
ON CONFLICT (name, experience_band) DO NOTHING;

-- Senior
INSERT INTO public.skill_catalog (name, experience_band) VALUES 
('Enterprise Account Planning', 'senior'),
('C-Suite Stakeholder Management', 'senior'),
('Complex Deal Orchestration', 'senior'),
('Strategic Global Partnerships', 'senior'),
('TCO (Total Cost of Ownership) Modeling', 'senior'),
('Territory Management & Strategy', 'senior'),
('Value-Based Selling', 'senior'),
('Sales Engineering Collaboration', 'senior'),
('Change Management Selling', 'senior'),
('Account-Based Marketing (ABM)', 'senior')
ON CONFLICT (name, experience_band) DO NOTHING;

-- Leadership
INSERT INTO public.skill_catalog (name, experience_band) VALUES 
('GTM (Go-to-Market) Strategy', 'leadership'),
('Revenue Operations (RevOps)', 'leadership'),
('Sales Playbook Development', 'leadership'),
('Compensation Plan Design', 'leadership'),
('Sales Recruitment & Training', 'leadership'),
('P&L Responsibility', 'leadership'),
('Executive Relationship Building', 'leadership'),
('Sales Mentorship & Coaching', 'leadership'),
('Sales Tech Stack Optimization', 'leadership'),
('Scaling High-Performance Teams', 'leadership')
ON CONFLICT (name, experience_band) DO NOTHING;
