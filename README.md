# Pitchora

> 「好きな番組を、もっと語れる。」

架空のテレビ番組・ラジオ番組・配信番組を投稿・共有・評価できるSNS。

## 構成

- `worker/` — バックエンドAPI（Cloudflare Workers + D1）
- `frontend/` — SPA（Cloudflare Pages / Vite + Vanilla TypeScript）
- `DATABASE.md` — D1のテーブル設計
- `SETUP.md` — Cloudflareダッシュボードのみで完結するデプロイ手順

## 現状（MVP）

認証（登録・ログイン）、番組の投稿・編集・削除、コメントの投稿・削除まで実装済み。
詳細は `SETUP.md` の「実装済みの範囲」を参照。

企画・全機能仕様は元プロジェクトの `README.md` / `SPEC.md` を参照してください。
