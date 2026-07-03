-- Pitchora D1 schema (MVP: auth / posts / comments)
-- Run this once against your D1 database from the Cloudflare dashboard
-- (Workers & Pages > D1 > your database > Console), or via `wrangler d1 execute`.

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       TEXT UNIQUE NOT NULL,
  username      TEXT NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS genres (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT UNIQUE NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS posts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id),
  title       TEXT NOT NULL,
  description TEXT NOT NULL,
  genre_id    INTEGER NOT NULL REFERENCES genres(id),
  visibility  TEXT NOT NULL CHECK(visibility IN ('public','unlisted','private')),
  is_deleted  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS comments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id    INTEGER NOT NULL REFERENCES posts(id),
  user_id    INTEGER NOT NULL REFERENCES users(id),
  content    TEXT NOT NULL,
  is_edited  INTEGER NOT NULL DEFAULT 0,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_visibility_created ON posts(visibility, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_genre_id ON posts(genre_id);
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id, created_at ASC);

INSERT OR IGNORE INTO genres (name, sort_order) VALUES
  ('バラエティ', 1),
  ('ドラマ', 2),
  ('アニメ', 3),
  ('ニュース', 4),
  ('音楽', 5),
  ('スポーツ', 6),
  ('教養', 7),
  ('ドキュメンタリー', 8),
  ('ラジオ', 9),
  ('ネット配信', 10),
  ('その他', 11);
