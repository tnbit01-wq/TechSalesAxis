-- Migration: Create Like and Comment tables for Community Feed

-- Create likes table
CREATE TABLE IF NOT EXISTS post_likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, post_id) -- Ensure a user can only like a post once
);

-- Create comments table
CREATE TABLE IF NOT EXISTS post_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;

-- Post Likes Policies
CREATE POLICY "Public likes can be viewed by everyone" ON post_likes
    FOR SELECT USING (true);

CREATE POLICY "Users can manage their own likes" ON post_likes
    FOR ALL USING (auth.uid() = user_id);

-- Post Comments Policies
CREATE POLICY "Public comments can be viewed by everyone" ON post_comments
    FOR SELECT USING (true);

CREATE POLICY "Users can manage their own comments" ON post_comments
    FOR ALL USING (auth.uid() = user_id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_post_likes_post_id ON post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON post_comments(post_id);
