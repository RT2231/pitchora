import { Env } from "../types";
import { jsonOk, ApiError } from "../utils/response";
import { requireAuth, optionalAuth } from "../middleware/auth";
import { getDb } from "../db";

async function findUserByPublicId(sql: ReturnType<typeof getDb>, userId: string) {
  const rows = await sql("SELECT id, user_id, username FROM users WHERE user_id = $1", [userId]);
  return rows[0] as { id: number; user_id: string; username: string } | undefined;
}

// GET /api/users?q=keyword
export async function handleSearchUsers(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim();
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 20) || 20, 50);

  if (!q) return jsonOk({ users: [] });

  const sql = getDb(env);
  const users = await sql(
    `SELECT user_id, username FROM users
     WHERE user_id ILIKE $1 OR username ILIKE $1
     ORDER BY username ASC
     LIMIT $2`,
    [`%${q}%`, limit]
  );
  return jsonOk({ users });
}

// GET /api/users/:userId
export async function handleGetUserProfile(request: Request, env: Env, userId: string): Promise<Response> {
  const auth = await optionalAuth(request, env);
  const sql = getDb(env);

  const rows = await sql(
    `SELECT id, user_id, username,
            to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at
     FROM users WHERE user_id = $1`,
    [userId]
  );
  const user = rows[0];
  if (!user) throw new ApiError("NOT_FOUND", "ユーザーが見つかりません。", 404);

  const [postCountRows, followerCountRows, followingCountRows] = await Promise.all([
    sql(
      `SELECT COUNT(*)::int AS count FROM posts
       WHERE user_id = $1 AND is_deleted = false AND visibility = 'public'`,
      [user.id]
    ),
    sql("SELECT COUNT(*)::int AS count FROM follows WHERE followee_id = $1", [user.id]),
    sql("SELECT COUNT(*)::int AS count FROM follows WHERE follower_id = $1", [user.id]),
  ]);

  let isFollowing = false;
  let isSelf = false;
  if (auth) {
    isSelf = auth.userId === user.id;
    if (!isSelf) {
      const followRows = await sql(
        "SELECT 1 FROM follows WHERE follower_id = $1 AND followee_id = $2",
        [auth.userId, user.id]
      );
      isFollowing = followRows.length > 0;
    }
  }

  return jsonOk({
    user: {
      id: user.id,
      user_id: user.user_id,
      username: user.username,
      created_at: user.created_at,
    },
    post_count: postCountRows[0].count,
    follower_count: followerCountRows[0].count,
    following_count: followingCountRows[0].count,
    is_following: isFollowing,
    is_self: isSelf,
  });
}

// POST /api/users/:userId/follow
export async function handleFollowUser(request: Request, env: Env, userId: string): Promise<Response> {
  const auth = await requireAuth(request, env);
  const sql = getDb(env);

  const target = await findUserByPublicId(sql, userId);
  if (!target) throw new ApiError("NOT_FOUND", "ユーザーが見つかりません。", 404);
  if (target.id === auth.userId) {
    throw new ApiError("VALIDATION_ERROR", "自分自身をフォローすることはできません。", 400);
  }

  // 冪等: 既にフォロー済みでもエラーにはしない
  await sql(
    `INSERT INTO follows (follower_id, followee_id) VALUES ($1, $2)
     ON CONFLICT (follower_id, followee_id) DO NOTHING`,
    [auth.userId, target.id]
  );

  return jsonOk({ following: true });
}

// DELETE /api/users/:userId/follow
export async function handleUnfollowUser(request: Request, env: Env, userId: string): Promise<Response> {
  const auth = await requireAuth(request, env);
  const sql = getDb(env);

  const target = await findUserByPublicId(sql, userId);
  if (!target) throw new ApiError("NOT_FOUND", "ユーザーが見つかりません。", 404);

  // 冪等: フォローしていなくてもエラーにはしない（SPEC 10章: フォロー解除は即時反映・通知なし）
  await sql("DELETE FROM follows WHERE follower_id = $1 AND followee_id = $2", [auth.userId, target.id]);

  return jsonOk({ following: false });
}

// GET /api/users/:userId/followers
export async function handleListFollowers(request: Request, env: Env, userId: string): Promise<Response> {
  const sql = getDb(env);
  const target = await findUserByPublicId(sql, userId);
  if (!target) throw new ApiError("NOT_FOUND", "ユーザーが見つかりません。", 404);

  const users = await sql(
    `SELECT u.user_id, u.username
     FROM follows f JOIN users u ON u.id = f.follower_id
     WHERE f.followee_id = $1
     ORDER BY f.created_at DESC`,
    [target.id]
  );
  return jsonOk({ users });
}

// GET /api/users/:userId/following
export async function handleListFollowing(request: Request, env: Env, userId: string): Promise<Response> {
  const sql = getDb(env);
  const target = await findUserByPublicId(sql, userId);
  if (!target) throw new ApiError("NOT_FOUND", "ユーザーが見つかりません。", 404);

  const users = await sql(
    `SELECT u.user_id, u.username
     FROM follows f JOIN users u ON u.id = f.followee_id
     WHERE f.follower_id = $1
     ORDER BY f.created_at DESC`,
    [target.id]
  );
  return jsonOk({ users });
}
