# Pitchora セットアップ手順

このプロジェクトは以下の3パーツで構成されています。

- `worker/` … バックエンドAPI（Cloudflare Workers + D1 + KV）
- `frontend/` … SPA（Vercel / Vite + Vanilla TypeScript）
- `DATABASE.md` / `worker/schema.sql` … D1のテーブル設計

バックエンド（Cloudflare側）はコマンドライン（wrangler CLI）を使わず、
すべてCloudflareダッシュボードの操作だけで進められます。
フロントエンドはVercelのダッシュボード（GitHub連携によるImport）でデプロイします。

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
   - `ALLOWED_ORIGIN`（**Variable**。VercelのURL、例: `https://pitchora.vercel.app`。フロントとバックのCORS許可用。手順4で設定・変更します）
5. **Deploy** をクリック

### GitHub連携の場合（複数ファイルなのでこちらを推奨）

1. このプロジェクトを自分のGitHubリポジトリにpush
2. **Workers & Pages** → **Create** → **Workers** → **Connect to Git**
3. リポジトリを選択し、**Root directory** を `worker` に設定
4. Build設定は不要（`main = "src/index.ts"` を `wrangler.toml` が指定済み）
5. 上記手順3・4のBindings / Secretsをダッシュボードで設定してデプロイ

---

## 3. フロントエンドをVercelにデプロイする

フロントエンド（`frontend/`）はCloudflare PagesではなくVercelでホストします
（バックエンドは引き続きCloudflare Workers + D1 + KVです）。

1. [vercel.com/new](https://vercel.com/new) → GitHubリポジトリ `RT2231/pitchora` をImport
2. **Root Directory** を `frontend` に設定（モノレポ構成のため必須）
   - Framework Presetは `Vite` が自動検出されます
   - Build Command / Output Directoryはデフォルト（`npm run build` / `dist`）のままでOK
3. **Environment Variables** に `VITE_API_BASE` を追加し、手順2で作成したWorkerのURL
   （例: `https://pitchora-api.your-subdomain.workers.dev`）を設定
4. **Deploy**
5. デプロイ完了後に発行される本番URL（例: `https://pitchora.vercel.app`）を控えておく
   → 次の手順でWorkerの `ALLOWED_ORIGIN` にこのURLを設定します

すでにVercelプロジェクトを作成済みの場合は、上記2・3を確認・追記するだけで構いません。

---

## 4. Worker の ALLOWED_ORIGIN をVercelのURLに合わせる

1. Cloudflareダッシュボード → 対象Worker（`pitchora-api`）→ **Settings → Variables and Secrets**
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
   - Workerの `ALLOWED_ORIGIN` がVercelのURLと一致しているか確認
   - フロントの `VITE_API_BASE`（Vercelの環境変数）がWorkerのURLと一致しているか確認
   - ブラウザの開発者ツール（Network/Console）でエラー内容を確認
   - `VITE_API_BASE` を追加・変更した場合はVercel側で再デプロイ（Redeploy）が必要です

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
