# Pitchora セットアップ手順（Cloudflareダッシュボードのみで完結）

このプロジェクトは以下の3パーツで構成されています。

- `worker/` … バックエンドAPI（Cloudflare Workers + D1）
- `frontend/` … SPA（Cloudflare Pages）
- `DATABASE.md` / `worker/schema.sql` … D1のテーブル設計

コマンドライン（wrangler CLI）は使わず、すべてダッシュボードの操作だけで進められます。

---

## 1. D1データベースを作成する

1. Cloudflareダッシュボード → **Workers & Pages** → **D1 SQL Database** → **Create database**
2. データベース名: `pitchora-db`（任意ですが以降この名前で説明します）
3. 作成後、データベースの **Console** タブを開き、`worker/schema.sql` の中身を貼り付けて実行
   - これで `users` / `genres` / `posts` / `comments` テーブルとジャンルの初期データが作成されます

---

## 2. Workerを作成する

1. **Workers & Pages** → **Create** → **Workers** → 適当な名前（例: `pitchora-api`）で作成
2. 作成後、**Edit code**（Quick Editor）を開き、`worker/src/` 以下のファイルの内容をそのまま貼り付けます
   - Quick Editorは単一ファイルの簡易エディタなので、複数ファイルの場合は
     GitHubリポジトリと連携してデプロイする方法（下記「GitHub連携の場合」）が簡単です
3. **Settings → Bindings** で以下を追加:
   - **D1 Database**: Variable name = `DB` → 手順1で作成した `pitchora-db` を選択
   - （任意）**KV Namespace**: Variable name = `SESSIONS`（現時点では未使用ですが、将来のレート制限やセッション管理用に用意しています）
4. **Settings → Variables and Secrets** で以下を追加:
   - `JWT_SECRET`（**Secret** として追加。ランダムな長い文字列。例: パスワード生成ツールで32文字以上）
   - `ALLOWED_ORIGIN`（**Variable**。PagesのURL、例: `https://pitchora.pages.dev`。フロントとバックのCORS許可用）
5. **Deploy** をクリック

### GitHub連携の場合（複数ファイルなのでこちらを推奨）

1. このプロジェクトを自分のGitHubリポジトリにpush
2. **Workers & Pages** → **Create** → **Workers** → **Connect to Git**
3. リポジトリを選択し、**Root directory** を `worker` に設定
4. Build設定は不要（`main = "src/index.ts"` を `wrangler.toml` が指定済み）
5. 上記手順3・4のBindings / Secretsをダッシュボードで設定してデプロイ

---

## 3. Pages（フロントエンド）を作成する

1. **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
2. リポジトリを選択し、**Root directory** を `frontend` に設定
3. Build設定:
   - Build command: `npm run build`
   - Build output directory: `dist`
4. **Environment variables** に `VITE_API_BASE` を追加し、手順2で作成したWorkerのURL
   （例: `https://pitchora-api.your-subdomain.workers.dev`）を設定
5. **Save and Deploy**

---

## 4. 動作確認

1. Pagesのデプロイ完了後に発行されるURLにアクセス
2. 「はじめる」から新規登録 → 番組を投稿 → コメントできることを確認
3. うまく通信できない場合:
   - Workerの `ALLOWED_ORIGIN` がPagesのURLと一致しているか確認
   - フロントの `VITE_API_BASE` がWorkerのURLと一致しているか確認
   - ブラウザの開発者ツール（Network/Console）でエラー内容を確認

---

## 実装済みの範囲（MVP）

- アカウント登録・ログイン（Bearer Token認証）
- 番組の投稿・編集・削除（論理削除）・公開範囲（公開/限定公開/非公開）
- コメントの投稿・削除・一覧（並び替え：古い順/新しい順）
- ジャンル一覧（初期11ジャンル）

## 未実装（SPEC.md記載の将来範囲）

返信、リアクション種別追加、ブックマーク、フォロー、通知、タイムライン（人気/おすすめ）、
検索、タグ、放送局、通報/ブロック/ミュート、NGワード、管理者機能など。
`DATABASE.md` の「将来マイグレーション予定」を参照してください。
