# Pitchora DATABASE.md

Version: 0.2.0（MVP: 認証〜投稿〜コメントの範囲のみ）

このドキュメントは Neon（Postgres）上のテーブル設計を定義する。
SPEC.md を唯一の仕様とし、本ドキュメントはその実装としての DB 設計を担う。

対象範囲（実装済み）: 3章(アカウント), 5章(投稿), 6章(コメント), 7章(返信), 8章(リアクション/いいね), 10章(フォロー), 15章(ジャンル), 18章(フォロー一覧・簡易版)
将来拡張（未実装）: リアクション種別追加（❤️以外）, ブックマーク, 通知, 検索インデックス, タグ, NGワード, 通報/管理者機能, 放送局

**データベース: Neon（Postgres） ※D1は使用しない**
Cloudflare Workers からは `@neondatabase/serverless`（HTTPベースのドライバ）で接続する。
接続文字列はCloudflareダッシュボードの Worker Secret（`DATABASE_URL`）として設定する。

---

## ER 概要

```
users 1---* posts 1---* comments
genres 1---* posts
users 1---* comments
```

---

## テーブル定義

### users

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| id | SERIAL | PRIMARY KEY | 内部ID |
| user_id | TEXT | UNIQUE NOT NULL | 公開ユーザーID（半角英数字, _, -、3〜20文字） |
| username | TEXT | NOT NULL | 表示名 |
| email | TEXT | UNIQUE NOT NULL | メールアドレス |
| password_hash | TEXT | NOT NULL | PBKDF2ハッシュ（Base64） |
| password_salt | TEXT | NOT NULL | ソルト（Base64） |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | 作成日時 |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | 更新日時 |

バリデーション（SPEC 3章準拠）:
- password: 8〜128文字、英字+数字必須
- user_id: 半角英数字 `_` `-`、3〜20文字、一意

---

### genres

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| id | SERIAL | PRIMARY KEY | ID |
| name | TEXT | UNIQUE NOT NULL | ジャンル名 |
| sort_order | INTEGER | NOT NULL DEFAULT 0 | 表示順 |

初期データ（SPEC 15章）: バラエティ / ドラマ / アニメ / ニュース / 音楽 / スポーツ / 教養 / ドキュメンタリー / ラジオ / ネット配信 / その他

---

### posts

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| id | SERIAL | PRIMARY KEY | ID |
| user_id | INTEGER | NOT NULL REFERENCES users(id) | 投稿者 |
| title | TEXT | NOT NULL | タイトル（1〜100文字） |
| description | TEXT | NOT NULL | 説明（1〜10000文字, Markdown可・HTML不可） |
| genre_id | INTEGER | NOT NULL REFERENCES genres(id) | ジャンル（1件必須） |
| visibility | TEXT | NOT NULL CHECK (visibility IN ('public','unlisted','private')) | 公開範囲（公開/限定公開/非公開=下書き） |
| is_deleted | BOOLEAN | NOT NULL DEFAULT false | 論理削除フラグ |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | 作成日時 |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | 更新日時 |

注記: 編集履歴は保持しない（SPEC 5章）。削除は論理削除のみ、完全削除は将来の管理者機能で対応。
タグ / 放送曜日 / 放送時間 / 出演者 / サムネイルは MVP 範囲外（将来のマイグレーションで追加）。
APIレスポンスでは `created_at` / `updated_at` を `to_char(... AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')` で
UTCのISO8601文字列に整形して返す（クライアント側の `new Date()` 互換性を保つため）。

インデックス:
```sql
CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_posts_visibility_created ON posts(visibility, created_at DESC);
CREATE INDEX idx_posts_genre_id ON posts(genre_id);
```

---

### comments

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| id | SERIAL | PRIMARY KEY | ID |
| post_id | INTEGER | NOT NULL REFERENCES posts(id) | 対象投稿 |
| user_id | INTEGER | NOT NULL REFERENCES users(id) | コメント投稿者 |
| content | TEXT | NOT NULL | 本文（最大5000文字, Markdown/HTML不可） |
| is_edited | BOOLEAN | NOT NULL DEFAULT false | 編集済みフラグ |
| is_deleted | BOOLEAN | NOT NULL DEFAULT false | 論理削除フラグ（削除後は「このコメントは削除されました。」表示） |
| parent_comment_id | INTEGER | REFERENCES comments(id) | 返信先コメント（NULLならトップレベル） |
| depth | INTEGER | NOT NULL DEFAULT 0 | 階層の深さ（0始まり、最大4＝5階層まで） |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | 作成日時 |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | 更新日時 |

インデックス:
```sql
CREATE INDEX idx_comments_post_id ON comments(post_id, created_at ASC);
CREATE INDEX idx_comments_parent_id ON comments(parent_comment_id);
```

注記: 返信は`parent_comment_id`の自己参照で表現し、`depth`はAPI側で親の depth+1 を計算して保存する
（SPEC 7章: 最大5階層。上限に達した場合はAPIがバリデーションエラーを返す）。
メンション（@ユーザー名の自動挿入）はクライアント側で返信フォームに事前入力するだけの表示上の機能で、
本文はプレーンテキストとして保存される（通知連携は未実装）。

---

### follows

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| id | SERIAL | PRIMARY KEY | ID |
| follower_id | INTEGER | NOT NULL REFERENCES users(id) | フォローする側 |
| followee_id | INTEGER | NOT NULL REFERENCES users(id) | フォローされる側 |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | フォローした日時 |

制約: `UNIQUE (follower_id, followee_id)`（二重フォロー防止）、`CHECK (follower_id <> followee_id)`（自己フォロー禁止）

インデックス:
```sql
CREATE INDEX idx_follows_follower ON follows(follower_id);
CREATE INDEX idx_follows_followee ON follows(followee_id);
```

注記: フォロー解除は即時反映・通知なし（SPEC 10章）。相互フォロー判定はAPI側で
`follows`を2方向で検索して算出する（専用カラムは持たない）。

---

### reactions

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| id | SERIAL | PRIMARY KEY | ID |
| post_id | INTEGER | NOT NULL REFERENCES posts(id) | 対象投稿 |
| user_id | INTEGER | NOT NULL REFERENCES users(id) | リアクションしたユーザー |
| reaction_type | TEXT | NOT NULL DEFAULT 'like' | リアクション種類（現状は'like'固定。将来拡張用に列を用意） |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | 日時 |

制約: `UNIQUE (post_id, user_id)`（SPEC 8章: 同一ユーザーは1投稿につき1回、種類問わず1つだけ）

インデックス:
```sql
CREATE INDEX idx_reactions_post_id ON reactions(post_id);
```

---

## 将来マイグレーション予定（未実装・参考）

- posts: tags(JSONB or 別テーブル), broadcast_day, broadcast_time, cast, thumbnail_url
- reactions: 複数リアクション種別対応（👍👏😂😭😮）は reaction_type 列で対応可能。UNIQUE制約の見直しが必要
- bookmarks テーブル
- notifications テーブル
- reports テーブル
- ng_words テーブル
- broadcast_stations テーブル

これらは SPEC.md の該当章が実装フェーズに入った段階で追記する。
