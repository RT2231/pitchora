import { Env } from "../types";
import { jsonOk, ApiError } from "../utils/response";
import { requireAuth } from "../middleware/auth";
import { getDb } from "../db";

// GET /api/posts/:postId/comments  (デフォルト: 古い順 SPEC 6章)
export async function handleListComments(request: Request, env: Env, postId: number): Promise<Response> {
  const url = new URL(request.url);
  const order = url.searchParams.get("order") === "newest" ? "DESC" : "ASC";

  const sql = getDb(env);

  const postRows = await sql("SELECT id FROM posts WHERE id = $1 AND is_deleted = false", [postId]);
  if (postRows.length === 0) throw new ApiError("NOT_FOUND", "投稿が見つかりません。", 404);

  // order の値はホワイトリストで決めた文字列のみなのでプレースホルダ不要
  const results = await sql(
    `SELECT c.id, c.content, c.is_edited, c.is_deleted,
            to_char(c.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
            to_char(c.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at,
            u.id as author_id, u.user_id as author_user_id, u.username as author_username
     FROM comments c JOIN users u ON u.id = c.user_id
     WHERE c.post_id = $1
     ORDER BY c.created_at ${order}`,
    [postId]
  );

  // 削除済みコメントは本文を隠して「このコメントは削除されました。」を返す
  const comments = results.map((c: any) =>
    c.is_deleted ? { ...c, content: "このコメントは削除されました。" } : c
  );

  return jsonOk({ comments });
}

interface CreateCommentBody {
  content?: string;
}

// POST /api/posts/:postId/comments
export async function handleCreateComment(request: Request, env: Env, postId: number): Promise<Response> {
  const auth = await requireAuth(request, env);
  const body = (await request.json().catch(() => ({}))) as CreateCommentBody;

  if (!body.content || body.content.length < 1 || body.content.length > 5000) {
    throw new ApiError("VALIDATION_ERROR", "コメントは1〜5000文字で入力してください。", 400);
  }
  if (/<[^>]+>/.test(body.content)) {
    throw new ApiError("VALIDATION_ERROR", "コメントにHTMLタグは使用できません。", 400);
  }

  const sql = getDb(env);

  const postRows = await sql("SELECT id FROM posts WHERE id = $1 AND is_deleted = false", [postId]);
  if (postRows.length === 0) throw new ApiError("NOT_FOUND", "投稿が見つかりません。", 404);

  const rows = await sql(
    "INSERT INTO comments (post_id, user_id, content) VALUES ($1, $2, $3) RETURNING id",
    [postId, auth.userId, body.content]
  );

  return jsonOk({ id: rows[0].id }, 201);
}

// DELETE /api/comments/:id （論理削除。投稿者本人のみ ※管理者削除は将来実装）
export async function handleDeleteComment(request: Request, env: Env, id: number): Promise<Response> {
  const auth = await requireAuth(request, env);
  const sql = getDb(env);

  const rows = await sql("SELECT * FROM comments WHERE id = $1 AND is_deleted = false", [id]);
  const comment = rows[0];
  if (!comment) throw new ApiError("NOT_FOUND", "コメントが見つかりません。", 404);
  if (comment.user_id !== auth.userId) throw new ApiError("FORBIDDEN", "このコメントを削除する権限がありません。", 403);

  await sql("UPDATE comments SET is_deleted = true, updated_at = now() WHERE id = $1", [id]);

  return jsonOk({ id });
}
