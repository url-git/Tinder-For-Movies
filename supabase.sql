-- ============================================================
-- CineMatch – Supabase schema
-- Uruchom w SQL Editor: https://supabase.com/dashboard → SQL Editor
-- ============================================================

-- SESSIONS: przechowuje sesję + posortowaną listę filmów
CREATE TABLE IF NOT EXISTS sessions (
  id           TEXT PRIMARY KEY,
  genre_id     INTEGER NOT NULL,
  movies       JSONB   NOT NULL DEFAULT '[]',
  player_count INTEGER NOT NULL DEFAULT 1,
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- VOTES: głosy graczy
CREATE TABLE IF NOT EXISTS votes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT    NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL CHECK (user_id IN (1, 2)),
  movie_id   INTEGER NOT NULL,
  vote       TEXT    NOT NULL CHECK (vote IN ('like', 'dislike')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (session_id, user_id, movie_id)
);

-- ============================================================
-- Row Level Security – dostęp bez logowania (anon key)
-- ============================================================
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sessions_open" ON sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "votes_open"    ON votes    FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- Realtime – włącz nasłuchiwanie zmian
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE votes;
