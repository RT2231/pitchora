import { Env, AuthContext } from "../types";
import { verifyJwt } from "../utils/jwt";
import { ApiError } from "../utils/response";

export async function requireAuth(request: Request, env: Env): Promise<AuthContext> {
  const header = request.headers.get("Authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    throw new ApiError("UNAUTHORIZED", "認証が必要です。", 401);
  }
  const payload = await verifyJwt(match[1], env.JWT_SECRET);
  if (!payload) {
    throw new ApiError("UNAUTHORIZED", "トークンが無効、または期限切れです。", 401);
  }
  return { userId: payload.sub, userPublicId: payload.uid, username: payload.name };
}

export async function optionalAuth(request: Request, env: Env): Promise<AuthContext | null> {
  const header = request.headers.get("Authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const payload = await verifyJwt(match[1], env.JWT_SECRET);
  if (!payload) return null;
  return { userId: payload.sub, userPublicId: payload.uid, username: payload.name };
}
