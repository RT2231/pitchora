import { Env } from "../types";
import { jsonOk, ApiError } from "../utils/response";
import { requireAuth } from "../middleware/auth";
import { getDb } from "../db";

// POST /api/posts/:id/like
export async function handleLikePost(request: Request, env: Env, postId: number): Promise<Response> {
  const auth = await requireAuth(request, env);
  const sql = getDb(env);

  const postRows = await sql("SELECT id FROM posts WHERE id = $1 AND is_deleted = false", [postId]);
  if (postRows.length === 0) throw new ApiError("NOT_FOUND", "投稿が見つかりません。", 404);

  // 冪等: 既にいいね済みでもエラーにはしない（SPEC 8章: 同一ユーザーは1投稿につき1回）
  await sql(
    `INSERT INTO reactions (post_id, user_id, reaction_type) VALUES ($1, $2, 'like')
     ON CONFLICT (post_id, user_id) DO NOTHING`,
    [postId, auth.userId]
  );

  const countRows = await sql("SELECT COUNT(*)::int AS count FROM reactions WHERE post_id = $1", [postId]);

  return jsonOk({ liked: true, like_count: countRows[0].count });
}

// DELETE /api/posts/:id/like
export async function handleUnlikePost(request: Request, env: Env, postId: number): Promise<Response> {
  const auth = await requireAuth(request, env);
  const sql = getDb(env);

  const postRows = await sql("SELECT id FROM posts WHERE id = $1 AND is_deleted = false", [postId]);
  if (postRows.length === 0) throw new ApiError("NOT_FOUND", "投稿が見つかりません。", 404);

  await sql("DELETE FROM reactions WHERE post_id = $1 AND user_id = $2", [postId, auth.userId]);

  const countRows = await sql("SELECT COUNT(*)::int AS count FROM reactions WHERE post_id = $1", [postId]);

  return jsonOk({ liked: false, like_count: countRows[0].count });
}
