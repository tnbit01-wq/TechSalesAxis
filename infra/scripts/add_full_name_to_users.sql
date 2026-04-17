-- Migration: Add full_name column to users table
-- Purpose: Store user's full name for personalized email greetings
-- Date: 2026-04-16

ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name TEXT;

-- Add comment to column
COMMENT ON COLUMN users.full_name IS 'User''s full name captured during signup, used for personalized email templates';

-- Verify the column was added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'full_name';
