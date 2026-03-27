-- =========================================
-- Chat & Messaging Schema
-- =========================================

-- ---------- CHAT THREADS ----------
-- Unique thread per recruiter-candidate pair
CREATE TABLE chat_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recruiter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT false, -- Enabled via shortlist or invite
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(candidate_id, recruiter_id)
);

-- ---------- CHAT MESSAGES ----------
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id),
  text TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ---------- CHAT REPORTS ----------
CREATE TYPE report_status AS ENUM ('pending', 'under_review', 'resolved', 'dismissed');

CREATE TABLE chat_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
  reporter_id UUID REFERENCES users(id) ON DELETE CASCADE,
  thread_id UUID REFERENCES chat_threads(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status report_status DEFAULT 'pending',
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ---------- INDEXES ----------
CREATE INDEX idx_chat_messages_thread ON chat_messages(thread_id);
CREATE INDEX idx_chat_threads_candidate ON chat_threads(candidate_id);
CREATE INDEX idx_chat_threads_recruiter ON chat_threads(recruiter_id);

-- ---------- RLS HELPERS ----------
-- Enable Realtime for these tables
-- Realtime features removed - messaging handled by FastAPI WebSocket layer
