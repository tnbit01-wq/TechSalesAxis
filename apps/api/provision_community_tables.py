import os
import sys
import asyncio
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Set up paths
sys.path.append(os.path.abspath(os.path.join(os.getcwd(), "src")))

try:
    from core.config import DATABASE_URL
except ImportError:
    DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    print("Error: DATABASE_URL environment variable is not set.")
    sys.exit(1)

engine = create_engine(DATABASE_URL)

SQL = """
-- 1. Ensure uuid-ossp extension exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create post_likes table
CREATE TABLE IF NOT EXISTS public.post_likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, post_id)
);

-- 3. Create post_comments table
CREATE TABLE IF NOT EXISTS public.post_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create user_pinned_posts table
CREATE TABLE IF NOT EXISTS public.user_pinned_posts (
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
    pinned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    PRIMARY KEY (user_id, post_id)
);

-- 5. Create follows table
CREATE TABLE IF NOT EXISTS public.follows (
    follower_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    following_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (follower_id, following_id)
);

-- 6. Create post_interactions table
CREATE TABLE IF NOT EXISTS public.post_interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    interaction_type VARCHAR(10),
    content TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_post_likes_post_id ON public.post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON public.post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_pinned_posts_user ON public.user_pinned_posts(user_id);
"""

def execute():
    try:
        with engine.connect() as conn:
            conn.execute(text(SQL))
            conn.commit()
            print("Successfully provisioned community feed tables in RDS.")
    except Exception as e:
        print(f"Error executing SQL: {e}")
        sys.exit(1)

if __name__ == "__main__":
    execute()
