-- Pitchora migration: 返信機能 (SPEC 7章)
-- 既存のNeonプロジェクトに対して、SQL Editorでこのファイルの内容を実行してください。
-- 新規にプロジェクトを作る場合は worker/schema.sql に既に含まれているので不要です。

ALTER TABLE comments ADD COLUMN IF NOT EXISTS parent_comment_id INTEGER REFERENCES comments(id);
ALTER TABLE comments ADD COLUMN IF NOT EXISTS depth INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_comment_id);
