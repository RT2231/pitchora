import { Env } from "../types";
import { jsonOk, ApiError } from "../utils/response";
import { requireAuth, optionalAuth } from "../middleware/auth";
import { getDb } from "../db";

interface CreatePostBody {
  title?: string;
  description?: string;
  genre_id?: number;
  visibility?: string;
}

const VISIBILITIES = ["public", "unlisted", "private"];

// タイムスタンプはUTCのISO8601文字列として返す（フロント側でnew Date()できる形に統一）
function tsSelect(table: string, column: "created_at" | "updated_at"): string {
  return `to_char(${table}.${column} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS ${column}`;
}

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

// GET /api/posts?limit=20&offset=0&genre_id=1&author=user_id
export async function handleListPosts(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 20) || 20, 50);
  const offset = Math.max(Number(url.searchParams.get("offset") ?? 0) || 0, 0);
  const genreId = url.searchParams.get("genre_id");
  const author = url.searchParams.get("author");

  const auth = await optionalAuth(request, env);
  const sql = getDb(env);

  // 公開投稿 + (ログイン中なら自分の全投稿)
  const binds: (string | number)[] = [];
  let authIdx = -1;
  if (auth) {
    binds.push(auth.userId);
    authIdx = binds.length;
  }

  let query = `
    SELECT p.id, p.title, p.description, p.genre_id, p.visibility, ${tsSelect("p", "created_at")},
           ${tsSelect("p", "updated_at")},
           u.id as author_id, u.user_id as author_user_id, u.username as author_username,
           g.name as genre_name,
           (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id AND c.is_deleted = false) as comment_count,
           (SELECT COUNT(*)::int FROM reactions r WHERE r.post_id = p.id) as like_count,
           ${authIdx > 0 ? `EXISTS (SELECT 1 FROM reactions r2 WHERE r2.post_id = p.id AND r2.user_id = $${authIdx}) as liked_by_me` : "false as liked_by_me"}
    FROM posts p
    JOIN users u ON u.id = p.user_id
    JOIN genres g ON g.id = p.genre_id
    WHERE p.is_deleted = false
  `;

  if (authIdx > 0) {
    query += ` AND (p.visibility = 'public' OR p.user_id = $${authIdx})`;
  } else {
    query += ` AND p.visibility = 'public'`;
  }

  if (genreId) {
    binds.push(Number(genreId));
    query += ` AND p.genre_id = $${binds.length}`;
  }

  if (author) {
    binds.push(author);
    query += ` AND u.user_id = $${binds.length}`;
  }

  binds.push(limit);
  query += ` ORDER BY p.created_at DESC LIMIT $${binds.length}`;
  binds.push(offset);
  query += ` OFFSET $${binds.length}`;

  const posts = await sql(query, binds);

  return jsonOk({ posts, limit, offset });
}

// GET /api/posts/:id
export async function handleGetPost(request: Request, env: Env, id: number): Promise<Response> {
  const auth = await optionalAuth(request, env);
  const sql = getDb(env);

  const rows = await sql(
    `SELECT p.id, p.user_id, p.title, p.description, p.genre_id, p.visibility, p.is_deleted,
            ${tsSelect("p", "created_at")}, ${tsSelect("p", "updated_at")},
            u.user_id as author_user_id, u.username as author_username, g.name as genre_name,
            (SELECT COUNT(*)::int FROM reactions r WHERE r.post_id = p.id) as like_count,
            ${auth ? "EXISTS (SELECT 1 FROM reactions r2 WHERE r2.post_id = p.id AND r2.user_id = $2)" : "false"} as liked_by_me
     FROM posts p JOIN users u ON u.id = p.user_id JOIN genres g ON g.id = p.genre_id
     WHERE p.id = $1 AND p.is_deleted = false`,
    auth ? [id, auth.userId] : [id]
  );
  const post = rows[0];

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

  const sql = getDb(env);

  const genre = await sql("SELECT id FROM genres WHERE id = $1", [body.genre_id]);
  if (genre.length === 0) {
    throw new ApiError("VALIDATION_ERROR", "指定されたジャンルが存在しません。", 400);
  }

  const rows = await sql(
    `INSERT INTO posts (user_id, title, description, genre_id, visibility)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [auth.userId, body.title, body.description, body.genre_id, body.visibility]
  );

  return jsonOk({ id: rows[0].id }, 201);
}

// PATCH /api/posts/:id
export async function handleUpdatePost(request: Request, env: Env, id: number): Promise<Response> {
  const auth = await requireAuth(request, env);
  const body = (await request.json().catch(() => ({}))) as CreatePostBody;
  validatePostFields(body, true);

  const sql = getDb(env);

  const rows = await sql("SELECT * FROM posts WHERE id = $1 AND is_deleted = false", [id]);
  const post = rows[0];
  if (!post) throw new ApiError("NOT_FOUND", "投稿が見つかりません。", 404);
  if (post.user_id !== auth.userId) throw new ApiError("FORBIDDEN", "この投稿を編集する権限がありません。", 403);

  const title = body.title ?? post.title;
  const description = body.description ?? post.description;
  const genreId = body.genre_id ?? post.genre_id;
  const visibility = body.visibility ?? post.visibility;

  await sql(
    `UPDATE posts SET title = $1, description = $2, genre_id = $3, visibility = $4, updated_at = now() WHERE id = $5`,
    [title, description, genreId, visibility, id]
  );

  return jsonOk({ id });
}

// DELETE /api/posts/:id （論理削除）
export async function handleDeletePost(request: Request, env: Env, id: number): Promise<Response> {
  const auth = await requireAuth(request, env);
  const sql = getDb(env);

  const rows = await sql("SELECT * FROM posts WHERE id = $1 AND is_deleted = false", [id]);
  const post = rows[0];
  if (!post) throw new ApiError("NOT_FOUND", "投稿が見つかりません。", 404);
  if (post.user_id !== auth.userId) throw new ApiError("FORBIDDEN", "この投稿を削除する権限がありません。", 403);

  await sql("UPDATE posts SET is_deleted = true, updated_at = now() WHERE id = $1", [id]);

  return jsonOk({ id });
}

// GET /api/genres
export async function handleListGenres(_request: Request, env: Env): Promise<Response> {
  const sql = getDb(env);
  const genres = await sql("SELECT id, name FROM genres ORDER BY sort_order ASC");
  return jsonOk({ genres });
}
