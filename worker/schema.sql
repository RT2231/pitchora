-- Pitchora Postgres schema (MVP: auth / posts / comments)
-- Neon の SQL Editor（ダッシュボード）にそのまま貼り付けて実行してください。

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  user_id       TEXT UNIQUE NOT NULL,
  username      TEXT NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS genres (
  id         SERIAL PRIMARY KEY,
  name       TEXT UNIQUE NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS posts (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id),
  title       TEXT NOT NULL,
  description TEXT NOT NULL,
  genre_id    INTEGER NOT NULL REFERENCES genres(id),
  visibility  TEXT NOT NULL CHECK (visibility IN ('public','unlisted','private')),
  is_deleted  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS comments (
  id                 SERIAL PRIMARY KEY,
  post_id            INTEGER NOT NULL REFERENCES posts(id),
  user_id            INTEGER NOT NULL REFERENCES users(id),
  content            TEXT NOT NULL,
  is_edited          BOOLEAN NOT NULL DEFAULT false,
  is_deleted         BOOLEAN NOT NULL DEFAULT false,
  parent_comment_id  INTEGER REFERENCES comments(id),
  depth              INTEGER NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS follows (
  id          SERIAL PRIMARY KEY,
  follower_id INTEGER NOT NULL REFERENCES users(id),
  followee_id INTEGER NOT NULL REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (follower_id, followee_id),
  CHECK (follower_id <> followee_id)
);

CREATE TABLE IF NOT EXISTS reactions (
  id            SERIAL PRIMARY KEY,
  post_id       INTEGER NOT NULL REFERENCES posts(id),
  user_id       INTEGER NOT NULL REFERENCES users(id),
  reaction_type TEXT NOT NULL DEFAULT 'like',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_visibility_created ON posts(visibility, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_genre_id ON posts(genre_id);
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_followee ON follows(followee_id);
CREATE INDEX IF NOT EXISTS idx_reactions_post_id ON reactions(post_id);

INSERT INTO genres (name, sort_order) VALUES
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
  ('その他', 11)
ON CONFLICT (name) DO NOTHING;
