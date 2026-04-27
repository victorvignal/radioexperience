-- Migration: add image support to challenge tables
-- Run in Supabase SQL Editor (Dashboard > SQL Editor > New query)

-- 1. Add image columns to challenge_question_pool
ALTER TABLE challenge_question_pool ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT '';
ALTER TABLE challenge_question_pool ADD COLUMN IF NOT EXISTS image_base64 TEXT DEFAULT '';

-- 2. Add image columns to challenge_questions (per-challenge copy)
ALTER TABLE challenge_questions ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT '';
ALTER TABLE challenge_questions ADD COLUMN IF NOT EXISTS image_base64 TEXT DEFAULT '';

-- 3. Index for specialty lookups (safe, small text)
CREATE INDEX IF NOT EXISTS idx_challenge_question_pool_specialty 
  ON challenge_question_pool(specialty);

-- Note: image_base64 is too large for GIN/trgm indexes (max 8KB per entry)
-- If you need to filter by has_image, use the existing has_image boolean column
-- or add a computed flag column if needed