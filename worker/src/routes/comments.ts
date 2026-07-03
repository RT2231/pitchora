import { Env } from "../types";
import { jsonOk, ApiError } from "../utils/response";
import { requireAuth } from "../middleware/auth";

// GET /api/posts/:postId/comments  (デフォルト: 古い順 SPEC 6章)
export async function handleListComments(request: Request, env: Env, postId: number): Promise<Response> {
  const url = new URL(request.url);
  const order = url.searchParams.get("order") === "newest" ? "DESC" : "ASC";

  const post = await env.DB.prepare("SELECT id FROM posts WHERE id = ? AND is_deleted = 0").bind(postId).first();
  if (!post) throw new ApiError("NOT_FOUND", "投稿が見つかりません。", 404);

  const { results } = await env.DB
    .prepare(
      `SELECT c.id, c.content, c.is_edited, c.is_deleted, c.created_at, c.updated_at,
              u.id as author_id, u.user_id as author_user_id, u.username as author_username
       FROM comments c JOIN users u ON u.id = c.user_id
       WHERE c.post_id = ?
       ORDER BY c.created_at ${order}`
    )
    .bind(postId)
    .all<any>();

  // 削除済みコメントは本文を隠して「このコメントは削除されました。」を返す
  const comments = results.map((c: any) =>
    c.is_deleted
      ? { ...c, content: "このコメントは削除されました。" }
      : c
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

  const post = await env.DB.prepare("SELECT id FROM posts WHERE id = ? AND is_deleted = 0").bind(postId).first();
  if (!post) throw new ApiError("NOT_FOUND", "投稿が見つかりません。", 404);

  const result = await env.DB
    .prepare("INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)")
    .bind(postId, auth.userId, body.content)
    .run();

  return jsonOk({ id: result.meta.last_row_id }, 201);
}

// DELETE /api/comments/:id （論理削除。投稿者本人のみ ※管理者削除は将来実装）
export async function handleDeleteComment(request: Request, env: Env, id: number): Promise<Response> {
  const auth = await requireAuth(request, env);

  const comment = await env.DB.prepare("SELECT * FROM comments WHERE id = ? AND is_deleted = 0").bind(id).first<any>();
  if (!comment) throw new ApiError("NOT_FOUND", "コメントが見つかりません。", 404);
  if (comment.user_id !== auth.userId) throw new ApiError("FORBIDDEN", "このコメントを削除する権限がありません。", 403);

  await env.DB.prepare("UPDATE comments SET is_deleted = 1, updated_at = datetime('now') WHERE id = ?").bind(id).run();

  return jsonOk({ id });
}
