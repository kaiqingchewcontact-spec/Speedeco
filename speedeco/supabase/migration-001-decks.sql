-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor → New Query)

-- Decks table: stores generated carousel decks
CREATE TABLE IF NOT EXISTS decks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT,
  source_content TEXT,
  source_url TEXT,
  arc_id TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT 'standard',
  tone TEXT NOT NULL DEFAULT 'sharp',
  slides JSONB NOT NULL DEFAULT '[]'::jsonb,
  slide_count INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast user lookups
CREATE INDEX IF NOT EXISTS idx_decks_user_id ON decks(user_id);
CREATE INDEX IF NOT EXISTS idx_decks_created_at ON decks(created_at DESC);

-- Row Level Security
ALTER TABLE decks ENABLE ROW LEVEL SECURITY;

-- Policy: users can only see their own decks
CREATE POLICY "Users can view own decks"
  ON decks FOR SELECT
  USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can insert own decks"
  ON decks FOR INSERT
  WITH CHECK (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can update own decks"
  ON decks FOR UPDATE
  USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can delete own decks"
  ON decks FOR DELETE
  USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER decks_updated_at
  BEFORE UPDATE ON decks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
