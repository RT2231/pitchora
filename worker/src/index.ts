import { Env } from "./types";
import { jsonError, ApiError } from "./utils/response";
import { handleRegister, handleLogin } from "./routes/auth";
import {
  handleListPosts,
  handleGetPost,
  handleCreatePost,
  handleUpdatePost,
  handleDeletePost,
  handleListGenres,
} from "./routes/posts";
import { handleListComments, handleCreateComment, handleDeleteComment } from "./routes/comments";
import {
  handleGetUserProfile,
  handleFollowUser,
  handleUnfollowUser,
  handleListFollowers,
  handleListFollowing,
  handleSearchUsers,
} from "./routes/users";
import { handleLikePost, handleUnlikePost } from "./routes/reactions";

function corsHeaders(env: Env, request: Request): Record<string, string> {
  const origin = request.headers.get("Origin") || "";
  const allowed = env.ALLOWED_ORIGIN;
  const allowOrigin = allowed && (allowed === "*" || allowed === origin) ? origin || allowed : allowed || "*";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const cors = corsHeaders(env, request);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    try {
      const url = new URL(request.url);
      const path = url.pathname;
      const method = request.method;
      const response = await route(request, env, path, method);
      // CORSヘッダーを付与して返す
      const headers = new Headers(response.headers);
      Object.entries(cors).forEach(([k, v]) => headers.set(k, v));
      return new Response(response.body, { status: response.status, headers });
    } catch (err) {
      if (err instanceof ApiError) {
        return jsonError(err.code, err.message, err.status, cors);
      }
      console.error(err);
      return jsonError("INTERNAL_SERVER_ERROR", "サーバーエラーが発生しました。", 500, cors);
    }
  },
};

async function route(request: Request, env: Env, path: string, method: string): Promise<Response> {
  // /api/auth/*
  if (path === "/api/auth/register" && method === "POST") return handleRegister(request, env);
  if (path === "/api/auth/login" && method === "POST") return handleLogin(request, env);

  // /api/genres
  if (path === "/api/genres" && method === "GET") return handleListGenres(request, env);

  // /api/users?q=keyword （検索。 /api/users/:userId より先に判定）
  if (path === "/api/users" && method === "GET") return handleSearchUsers(request, env);

  // /api/posts
  if (path === "/api/posts" && method === "GET") return handleListPosts(request, env);
  if (path === "/api/posts" && method === "POST") return handleCreatePost(request, env);

  // /api/posts/:id
  const postIdMatch = path.match(/^\/api\/posts\/(\d+)$/);
  if (postIdMatch) {
    const id = Number(postIdMatch[1]);
    if (method === "GET") return handleGetPost(request, env, id);
    if (method === "PATCH") return handleUpdatePost(request, env, id);
    if (method === "DELETE") return handleDeletePost(request, env, id);
  }

  // /api/posts/:id/comments
  const commentsMatch = path.match(/^\/api\/posts\/(\d+)\/comments$/);
  if (commentsMatch) {
    const postId = Number(commentsMatch[1]);
    if (method === "GET") return handleListComments(request, env, postId);
    if (method === "POST") return handleCreateComment(request, env, postId);
  }

  // /api/posts/:id/like
  const likeMatch = path.match(/^\/api\/posts\/(\d+)\/like$/);
  if (likeMatch) {
    const postId = Number(likeMatch[1]);
    if (method === "POST") return handleLikePost(request, env, postId);
    if (method === "DELETE") return handleUnlikePost(request, env, postId);
  }

  // /api/comments/:id
  const commentIdMatch = path.match(/^\/api\/comments\/(\d+)$/);
  if (commentIdMatch) {
    const id = Number(commentIdMatch[1]);
    if (method === "DELETE") return handleDeleteComment(request, env, id);
  }

  // /api/users/:userId/follow
  const followMatch = path.match(/^\/api\/users\/([^/]+)\/follow$/);
  if (followMatch) {
    const userId = decodeURIComponent(followMatch[1]);
    if (method === "POST") return handleFollowUser(request, env, userId);
    if (method === "DELETE") return handleUnfollowUser(request, env, userId);
  }

  // /api/users/:userId/followers
  const followersMatch = path.match(/^\/api\/users\/([^/]+)\/followers$/);
  if (followersMatch && method === "GET") {
    return handleListFollowers(request, env, decodeURIComponent(followersMatch[1]));
  }

  // /api/users/:userId/following
  const followingMatch = path.match(/^\/api\/users\/([^/]+)\/following$/);
  if (followingMatch && method === "GET") {
    return handleListFollowing(request, env, decodeURIComponent(followingMatch[1]));
  }

  // /api/users/:userId
  const userIdMatch = path.match(/^\/api\/users\/([^/]+)$/);
  if (userIdMatch && method === "GET") {
    return handleGetUserProfile(request, env, decodeURIComponent(userIdMatch[1]));
  }

  throw new ApiError("NOT_FOUND", "指定されたエンドポイントは存在しません。", 404);
}
