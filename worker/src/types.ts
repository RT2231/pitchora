export interface Env {
  DATABASE_URL: string; // Neon Postgres 接続文字列（Cloudflareダッシュボードで Secret として設定）
  SESSIONS?: KVNamespace;
  JWT_SECRET: string;
  ALLOWED_ORIGIN?: string; // 例: https://pitchora.vercel.app
}

export interface UserRow {
  id: number;
  user_id: string;
  username: string;
  email: string;
  password_hash: string;
  password_salt: string;
  created_at: string;
  updated_at: string;
}

export interface PublicUser {
  id: number;
  user_id: string;
  username: string;
}

export interface PostRow {
  id: number;
  user_id: number;
  title: string;
  description: string;
  genre_id: number;
  visibility: "public" | "unlisted" | "private";
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface CommentRow {
  id: number;
  post_id: number;
  user_id: number;
  content: string;
  is_edited: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthContext {
  userId: number;
  userPublicId: string;
  username: string;
}
