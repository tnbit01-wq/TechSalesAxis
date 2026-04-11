-- ============================================================================
-- Add Conversational Onboarding Sessions Table
-- ============================================================================
-- LEAN SCHEMA - Only columns that are actually used
-- No unused/redundant columns

CREATE TABLE conversational_onboarding_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Conversation data (REQUIRED - stored and used)
    conversation_messages JSONB NOT NULL DEFAULT '[]'::jsonb,
    total_messages INTEGER DEFAULT 0,
    conversation_status VARCHAR(20) DEFAULT 'in_progress',
    
    -- Extracted career readiness info (populated incrementally)
    extracted_employment_status TEXT,
    extracted_job_search_mode TEXT,
    extracted_notice_period_days INTEGER,
    extracted_current_role TEXT,
    extracted_years_experience INTEGER,
    extracted_willing_to_relocate BOOLEAN,
    extracted_visa_sponsorship_needed BOOLEAN,
    extracted_metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Information completeness and quality
    completeness_score NUMERIC(5,2) DEFAULT 0.0,
    missing_critical_fields TEXT[] DEFAULT '{}',
    average_ai_confidence NUMERIC(5,2) DEFAULT 0.0,
    
    -- Outcomes
    successfully_completed BOOLEAN DEFAULT FALSE,
    
    -- Timing
    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_conversational_onboarding_candidate_id 
ON conversational_onboarding_sessions(candidate_id);

CREATE INDEX idx_conversational_onboarding_status 
ON conversational_onboarding_sessions(conversation_status);

CREATE INDEX idx_conversational_onboarding_completed 
ON conversational_onboarding_sessions(successfully_completed);

-- Comments
COMMENT ON TABLE conversational_onboarding_sessions IS 
'Tracks natural language, chat-based onboarding sessions. Pure conversation flow without rigid forms.';

COMMENT ON COLUMN conversational_onboarding_sessions.conversation_messages IS 
'JSONB array storing [{user: string, assistant: string, timestamp: ISO8601}, ...]';

COMMENT ON COLUMN conversational_onboarding_sessions.completeness_score IS 
'0-100 score: how much career readiness info has been extracted (0=none, 100=all critical fields)';

COMMENT ON COLUMN conversational_onboarding_sessions.average_ai_confidence IS 
'0-100 average confidence of AI extractions (helps assess data quality)';
