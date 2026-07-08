# Pitchora セットアップ手順

このプロジェクトは以下の3パーツで構成されています。

- `worker/` … バックエンドAPI（Cloudflare Workers + Neon Postgres）
- `frontend/` … SPA（Vercel / Vite + Vanilla TypeScript）
- `DATABASE.md` / `worker/schema.sql` … DBのテーブル設計

バックエンド（Cloudflare Worker）はコマンドライン（wrangler CLI）を使わず、
すべてCloudflareダッシュボードの操作だけで進められます。
データベースはCloudflare D1ではなく外部のNeon（Postgres）を使い、こちらもダッシュボードのSQL Editorで完結します。
フロントエンドはVercelのダッシュボード（GitHub連携によるImport）でデプロイします。

---

## 1. Neonでデータベースを作成する

1. [neon.tech](https://neon.tech) でアカウント作成 → **New Project** を作成
2. プロジェクト作成後、サイドバーの **SQL Editor** を開き、`worker/schema.sql` の中身を貼り付けて実行
   - これで `users` / `genres` / `posts` / `comments` テーブルとジャンルの初期データが作成されます
3. **Dashboard → Connection Details** から接続文字列（Connection string）をコピー
   - 例: `postgres://user:password@ep-xxxx-pooler.region.aws.neon.tech/neondb?sslmode=require`
   - Cloudflare Workers（Neon serverless driver・HTTP接続）で使うので、**Pooled connection** の文字列で問題ありません

---

## 2. Workerを作成する

1. Cloudflareダッシュボード → **Workers & Pages** → **Create** → **Workers** → 適当な名前（例: `pitchora`）で作成
   - **GitHub連携でWorkerを作成する場合、ここで付けた名前と `worker/wrangler.toml` の `name` を一致させてください。**
     一致しないと `wrangler deploy` 実行時に警告が出ます（自動的に補正はされますが、念のため揃えておくのが安全です）。
2. 作成後、**Edit code**（Quick Editor）を開き、`worker/src/` 以下のファイルの内容をそのまま貼り付けます
   - Quick Editorは単一ファイルの簡易エディタなので、複数ファイルの場合は
     GitHubリポジトリと連携してデプロイする方法（下記「GitHub連携の場合」）が簡単です
3. **Settings → Variables and Secrets** で以下を追加:
   - `DATABASE_URL`（**Secret**）: 手順1でコピーしたNeonの接続文字列
   - `JWT_SECRET`（**Secret**）: ランダムな長い文字列（32文字以上推奨）
   - `ALLOWED_ORIGIN`（**Variable**）: フロントエンド（Vercel）のURL（例: `https://pitchora.vercel.app`）
4. （任意）**Settings → Bindings** で KV Namespace を追加する場合は Variable name を `SESSIONS` に
   （現時点では未使用。将来のレート制限やセッション管理用）
5. **Deploy** をクリック

### GitHub連携の場合（複数ファイルなのでこちらを推奨）

1. このプロジェクトを自分のGitHubリポジトリにpush
2. **Workers & Pages** → **Create** → **Workers** → **Connect to Git**
3. リポジトリを選択し、**Root directory** を `worker` に設定
4. Build設定は不要（`main = "src/index.ts"` を `wrangler.toml` が指定済み）
5. 上記手順3のSecrets/Variablesをダッシュボードで設定してデプロイ
   - `@neondatabase/serverless` は `worker/package.json` の依存関係に含まれているため、
     Git連携デプロイ時は自動的にインストールされます

---

## 3. フロントエンドをVercelにデプロイする

1. [vercel.com/new](https://vercel.com/new) → GitHubリポジトリ `RT2231/pitchora` をImport
2. **Root Directory** を `frontend` に設定（モノレポ構成のため必須）
   - Framework Presetは `Vite` が自動検出されます
   - Build Command / Output Directoryはデフォルト（`npm run build` / `dist`）のままでOK
3. **Environment Variables** に `VITE_API_BASE` を追加し、手順2で作成したWorkerのURL
   （例: `https://pitchora.your-subdomain.workers.dev`）を設定
4. **Deploy**
5. デプロイ完了後に発行される本番URL（例: `https://pitchora.vercel.app`）を控えておく
   → 次の手順でWorkerの `ALLOWED_ORIGIN` にこのURLを設定します

すでにVercelプロジェクトを作成済みの場合は、上記2・3を確認・追記するだけで構いません。

---

## 4. Worker の ALLOWED_ORIGIN をVercelのURLに合わせる

1. Cloudflareダッシュボード → 対象Worker（`pitchora`）→ **Settings → Variables and Secrets**
2. `ALLOWED_ORIGIN` を、手順3で確認したVercelの本番URL（例: `https://pitchora.vercel.app`）に設定
   - Vercelはデプロイのたびにプレビュー用の一意なURL（`https://pitchora-xxxx-yourteam.vercel.app`）も発行しますが、
     まずは本番ドメイン1つに絞ってCORSを許可するのがシンプルです
   - プレビューデプロイからもAPIを呼びたい場合は、ひとまず `*` にするか、後述の複数オリジン対応を検討してください
3. 保存すると自動的に再デプロイされます

---

## 5. 動作確認

1. Vercelの本番URLにアクセス
2. 「はじめる」から新規登録 → 番組を投稿 → コメントできることを確認
3. うまく通信できない場合:
   - Workerの `DATABASE_URL` が正しいNeon接続文字列か確認（`?sslmode=require` が付いているか）
   - Workerの `ALLOWED_ORIGIN` がVercelのURLと一致しているか確認
   - フロントの `VITE_API_BASE`（Vercelの環境変数）がWorkerのURLと一致しているか確認
   - ブラウザの開発者ツール（Network/Console）でエラー内容を確認
   - `VITE_API_BASE` を追加・変更した場合はVercel側で再デプロイ（Redeploy）が必要です
4. Git連携でWorkerをデプロイしている場合、ビルドログに
   `KV namespace '...' is not valid` のようなエラーが出たときは、
   `worker/wrangler.toml` に実在しないKV Namespace IDが書かれていないか確認してください。
   KVを使わないなら `wrangler.toml` から `[[kv_namespaces]]` セクション自体を削除するのが確実です。

---

## 実装済みの範囲

- アカウント登録・ログイン（Bearer Token認証）
- 番組の投稿・編集・削除（論理削除）・公開範囲（公開/限定公開/非公開）
- コメントの投稿・削除・一覧（並び替え：古い順/新しい順）
- 返信（コメントへのネスト返信、最大5階層、返信時の@メンション自動挿入）
- ジャンル一覧（初期11ジャンル）
- フォロー / フォロー解除、フォロワー数・フォロー数、ユーザープロフィールページ
- リアクション（いいね）: 投稿への❤️、1ユーザー1投稿につき1回まで
- 検索: キーワード（タイトル・説明の部分一致）・ジャンル絞り込み・並び替え（新着/人気/更新順）・ユーザー検索

## 未実装（SPEC.md記載の将来範囲）

あいまい検索、タグ・放送局・投稿日でのフィルター、リアクション種別追加（❤️以外）、
ブックマーク、通知、タイムライン（人気/おすすめ）、タグ、放送局、
通報/ブロック/ミュート、NGワード、管理者機能など。
`DATABASE.md` の「将来マイグレーション予定」を参照してください。

## 既存プロジェクトへのマイグレーション

Neonで既にテーブルを作成済みの場合、機能追加のたびに新しいテーブルが必要になることがあります。
`worker/migrations/` 以下のファイルを、まだ実行していないものがあれば **SQL Editor** で実行してください。

- `002_follows.sql` — フォロー機能
- `003_reactions.sql` — リアクション（いいね）機能
- `004_comment_replies.sql` — 返信機能

（新規にプロジェクトを作る場合は `worker/schema.sql` に全て含まれているので個別の実行は不要です）
