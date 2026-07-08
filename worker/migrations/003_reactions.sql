-- Pitchora migration: リアクション（いいね）機能 (SPEC 8章)
-- 既存のNeonプロジェクトに対して、SQL Editorでこのファイルの内容を実行してください。
-- 新規にプロジェクトを作る場合は worker/schema.sql に既に含まれているので不要です。

CREATE TABLE IF NOT EXISTS reactions (
  id            SERIAL PRIMARY KEY,
  post_id       INTEGER NOT NULL REFERENCES posts(id),
  user_id       INTEGER NOT NULL REFERENCES users(id),
  reaction_type TEXT NOT NULL DEFAULT 'like',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- SPEC 8章: 同一ユーザーは1投稿につき1回（種類を問わず1つだけ）
  UNIQUE (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_reactions_post_id ON reactions(post_id);
