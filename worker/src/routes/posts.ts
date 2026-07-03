import { Env } from "../types";
import { jsonOk, ApiError } from "../utils/response";
import { requireAuth, optionalAuth } from "../middleware/auth";

interface CreatePostBody {
  title?: string;
  description?: string;
  genre_id?: number;
  visibility?: string;
}

const VISIBILITIES = ["public", "unlisted", "private"];

function validatePostFields(body: CreatePostBody, partial: boolean) {
  if (!partial || body.title !== undefined) {
    if (!body.title || body.title.length < 1 || body.title.length > 100) {
      throw new ApiError("VALIDATION_ERROR", "タイトルは1〜100文字で入力してください。", 400);
    }
  }
  if (!partial || body.description !== undefined) {
    if (!body.description || body.description.length < 1 || body.description.length > 10000) {
      throw new ApiError("VALIDATION_ERROR", "説明は1〜10000文字で入力してください。", 400);
    }
    if (/<[^>]+>/.test(body.description || "")) {
      throw new ApiError("VALIDATION_ERROR", "説明にHTMLタグは使用できません。", 400);
    }
  }
  if (!partial || body.genre_id !== undefined) {
    if (!body.genre_id) {
      throw new ApiError("VALIDATION_ERROR", "ジャンルを選択してください。", 400);
    }
  }
  if (!partial || body.visibility !== undefined) {
    if (!body.visibility || !VISIBILITIES.includes(body.visibility)) {
      throw new ApiError("VALIDATION_ERROR", "公開範囲の指定が不正です。", 400);
    }
  }
}

// GET /api/posts?limit=20&offset=0&genre_id=1
export async function handleListPosts(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 20) || 20, 50);
  const offset = Math.max(Number(url.searchParams.get("offset") ?? 0) || 0, 0);
  const genreId = url.searchParams.get("genre_id");

  const auth = await optionalAuth(request, env);

  // 公開投稿 + (ログイン中なら自分の全投稿)
  let query = `
    SELECT p.id, p.title, p.description, p.genre_id, p.visibility, p.created_at, p.updated_at,
           u.id as author_id, u.user_id as author_user_id, u.username as author_username,
           g.name as genre_name,
           (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id AND c.is_deleted = 0) as comment_count
    FROM posts p
    JOIN users u ON u.id = p.user_id
    JOIN genres g ON g.id = p.genre_id
    WHERE p.is_deleted = 0
      AND (p.visibility = 'public' ${auth ? "OR p.user_id = ?" : ""})
  `;
  const binds: (string | number)[] = [];
  if (auth) binds.push(auth.userId);

  if (genreId) {
    query += " AND p.genre_id = ?";
    binds.push(Number(genreId));
  }

  query += " ORDER BY p.created_at DESC LIMIT ? OFFSET ?";
  binds.push(limit, offset);

  const { results } = await env.DB.prepare(query).bind(...binds).all();

  return jsonOk({ posts: results, limit, offset });
}

// GET /api/posts/:id
export async function handleGetPost(request: Request, env: Env, id: number): Promise<Response> {
  const auth = await optionalAuth(request, env);

  const post = await env.DB
    .prepare(
      `SELECT p.*, u.user_id as author_user_id, u.username as author_username, g.name as genre_name
       FROM posts p JOIN users u ON u.id = p.user_id JOIN genres g ON g.id = p.genre_id
       WHERE p.id = ? AND p.is_deleted = 0`
    )
    .bind(id)
    .first<any>();

  if (!post) {
    throw new ApiError("NOT_FOUND", "投稿が見つかりません。", 404);
  }
  if (post.visibility === "private" && (!auth || auth.userId !== post.user_id)) {
    throw new ApiError("NOT_FOUND", "投稿が見つかりません。", 404);
  }

  return jsonOk({ post });
}

// POST /api/posts
export async function handleCreatePost(request: Request, env: Env): Promise<Response> {
  const auth = await requireAuth(request, env);
  const body = (await request.json().catch(() => ({}))) as CreatePostBody;
  validatePostFields(body, false);

  const genre = await env.DB.prepare("SELECT id FROM genres WHERE id = ?").bind(body.genre_id).first();
  if (!genre) {
    throw new ApiError("VALIDATION_ERROR", "指定されたジャンルが存在しません。", 400);
  }

  const result = await env.DB
    .prepare(
      "INSERT INTO posts (user_id, title, description, genre_id, visibility) VALUES (?, ?, ?, ?, ?)"
    )
    .bind(auth.userId, body.title, body.description, body.genre_id, body.visibility)
    .run();

  const newId = result.meta.last_row_id;
  return jsonOk({ id: newId }, 201);
}

// PATCH /api/posts/:id
export async function handleUpdatePost(request: Request, env: Env, id: number): Promise<Response> {
  const auth = await requireAuth(request, env);
  const body = (await request.json().catch(() => ({}))) as CreatePostBody;
  validatePostFields(body, true);

  const post = await env.DB.prepare("SELECT * FROM posts WHERE id = ? AND is_deleted = 0").bind(id).first<any>();
  if (!post) throw new ApiError("NOT_FOUND", "投稿が見つかりません。", 404);
  if (post.user_id !== auth.userId) throw new ApiError("FORBIDDEN", "この投稿を編集する権限がありません。", 403);

  const title = body.title ?? post.title;
  const description = body.description ?? post.description;
  const genreId = body.genre_id ?? post.genre_id;
  const visibility = body.visibility ?? post.visibility;

  await env.DB
    .prepare(
      "UPDATE posts SET title = ?, description = ?, genre_id = ?, visibility = ?, updated_at = datetime('now') WHERE id = ?"
    )
    .bind(title, description, genreId, visibility, id)
    .run();

  return jsonOk({ id });
}

// DELETE /api/posts/:id （論理削除）
export async function handleDeletePost(request: Request, env: Env, id: number): Promise<Response> {
  const auth = await requireAuth(request, env);

  const post = await env.DB.prepare("SELECT * FROM posts WHERE id = ? AND is_deleted = 0").bind(id).first<any>();
  if (!post) throw new ApiError("NOT_FOUND", "投稿が見つかりません。", 404);
  if (post.user_id !== auth.userId) throw new ApiError("FORBIDDEN", "この投稿を削除する権限がありません。", 403);

  await env.DB.prepare("UPDATE posts SET is_deleted = 1, updated_at = datetime('now') WHERE id = ?").bind(id).run();

  return jsonOk({ id });
}

// GET /api/genres
export async function handleListGenres(_request: Request, env: Env): Promise<Response> {
  const { results } = await env.DB.prepare("SELECT id, name FROM genres ORDER BY sort_order ASC").all();
  return jsonOk({ genres: results });
}
