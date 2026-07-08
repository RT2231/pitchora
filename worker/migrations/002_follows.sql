-- Pitchora migration: フォロー機能 (SPEC 10章・18章)
-- 既存のNeonプロジェクトに対して、SQL Editorでこのファイルの内容を実行してください。
-- 新規にプロジェクトを作る場合は worker/schema.sql に既に含まれているので不要です。

CREATE TABLE IF NOT EXISTS follows (
  id          SERIAL PRIMARY KEY,
  follower_id INTEGER NOT NULL REFERENCES users(id),
  followee_id INTEGER NOT NULL REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (follower_id, followee_id),
  CHECK (follower_id <> followee_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_followee ON follows(followee_id);
