-- Migration: add image support to challenge tables
-- Run in Supabase SQL Editor (Dashboard > SQL Editor > New query)

-- 1. Add image columns to challenge_question_pool
ALTER TABLE challenge_question_pool ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT '';
ALTER TABLE challenge_question_pool ADD COLUMN IF NOT EXISTS image_base64 TEXT DEFAULT '';

-- 2. Add image columns to challenge_questions (per-challenge copy)
ALTER TABLE challenge_questions ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT '';
ALTER TABLE challenge_questions ADD COLUMN IF NOT EXISTS image_base64 TEXT DEFAULT '';

-- 3. Create unique index for dedup on pool table
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
EXCEPTION WHEN others THEN NULL;
END
$$;

-- 4. Optional: index for specialty lookups
CREATE INDEX IF NOT EXISTS idx_challenge_question_pool_specialty 
  ON challenge_question_pool(specialty);

-- 5. Optional: index for image_base64 (so queries on it are fast)
CREATE INDEX IF NOT EXISTS idx_challenge_question_pool_image_base64 
  ON challenge_question_pool(image_base64) 
  WHERE image_base64 IS NOT NULL AND image_base64 != '';
