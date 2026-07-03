// ⚠️ このファイルは worker/src/ 以下のTypeScriptを1ファイルにビルドしたものです。
// Cloudflareダッシュボード → Workers & Pages → 該当Worker → Edit code(Quick Editor) にそのまま貼り付けてください。
// ソースを編集する場合は worker/src/ を編集し、README_BUNDLE.mdの手順で再ビルドしてください。

// src/utils/response.ts
function jsonOk(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify({ success: true, data }), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...extraHeaders }
  });
}
function jsonError(code, message, status = 400, extraHeaders = {}) {
  return new Response(
    JSON.stringify({ success: false, error: { code, message } }),
    { status, headers: { "Content-Type": "application/json; charset=utf-8", ...extraHeaders } }
  );
}
var ApiError = class extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
};

// src/utils/password.ts
var PBKDF2_ITERATIONS = 1e5;
var HASH_ALGO = "SHA-256";
var KEY_LENGTH_BITS = 256;
function toBase64(buf) {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++)
    binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
function fromBase64(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++)
    bytes[i] = binary.charCodeAt(i);
  return bytes;
}
async function derive(password, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  return crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: HASH_ALGO },
    keyMaterial,
    KEY_LENGTH_BITS
  );
}
async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const derived = await derive(password, salt);
  return { hash: toBase64(derived), salt: toBase64(salt.buffer) };
}
async function verifyPassword(password, hash, salt) {
  const saltBytes = fromBase64(salt);
  const derived = await derive(password, saltBytes);
  const derivedB64 = toBase64(derived);
  if (derivedB64.length !== hash.length)
    return false;
  let diff = 0;
  for (let i = 0; i < derivedB64.length; i++) {
    diff |= derivedB64.charCodeAt(i) ^ hash.charCodeAt(i);
  }
  return diff === 0;
}
function isValidPassword(password) {
  if (password.length < 8 || password.length > 128)
    return false;
  if (!/[A-Za-z]/.test(password))
    return false;
  if (!/[0-9]/.test(password))
    return false;
  return true;
}
function isValidUserId(userId) {
  return /^[A-Za-z0-9_-]{3,20}$/.test(userId);
}
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

// src/utils/jwt.ts
function base64url(input) {
  let bytes;
  if (typeof input === "string") {
    bytes = new TextEncoder().encode(input);
  } else {
    bytes = new Uint8Array(input);
  }
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++)
    binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function base64urlDecode(input) {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((input.length + 3) % 4);
  return atob(padded);
}
async function getKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}
var SEVEN_DAYS = 60 * 60 * 24 * 7;
async function signJwt(payload, secret, expiresInSeconds = SEVEN_DAYS) {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1e3);
  const fullPayload = { ...payload, iat: now, exp: now + expiresInSeconds };
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(fullPayload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const key = await getKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signingInput));
  return `${signingInput}.${base64url(signature)}`;
}
async function verifyJwt(token, secret) {
  const parts = token.split(".");
  if (parts.length !== 3)
    return null;
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const key = await getKey(secret);
  const sigBytes = Uint8Array.from(base64urlDecode(encodedSignature), (c) => c.charCodeAt(0));
  const valid = await crypto.subtle.verify("HMAC", key, sigBytes, new TextEncoder().encode(signingInput));
  if (!valid)
    return null;
  try {
    const payload = JSON.parse(base64urlDecode(encodedPayload));
    if (payload.exp < Math.floor(Date.now() / 1e3))
      return null;
    return payload;
  } catch {
    return null;
  }
}

// src/routes/auth.ts
async function handleRegister(request, env) {
  const body = await request.json().catch(() => ({}));
  const { username, user_id, email, password } = body;
  if (!username || username.length < 1 || username.length > 30) {
    throw new ApiError("VALIDATION_ERROR", "\u30E6\u30FC\u30B6\u30FC\u540D\u306F1\u301C30\u6587\u5B57\u3067\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044\u3002", 400);
  }
  if (!user_id || !isValidUserId(user_id)) {
    throw new ApiError("VALIDATION_ERROR", "ID\u306F\u534A\u89D2\u82F1\u6570\u5B57\u30FB_\u30FB-\u306E\u307F\u30013\u301C20\u6587\u5B57\u3067\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044\u3002", 400);
  }
  if (!email || !isValidEmail(email)) {
    throw new ApiError("VALIDATION_ERROR", "\u6709\u52B9\u306A\u30E1\u30FC\u30EB\u30A2\u30C9\u30EC\u30B9\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044\u3002", 400);
  }
  if (!password || !isValidPassword(password)) {
    throw new ApiError("VALIDATION_ERROR", "\u30D1\u30B9\u30EF\u30FC\u30C9\u306F8\u301C128\u6587\u5B57\u3067\u3001\u82F1\u5B57\u3068\u6570\u5B57\u3092\u542B\u3081\u3066\u304F\u3060\u3055\u3044\u3002", 400);
  }
  const existing = await env.DB.prepare("SELECT id FROM users WHERE user_id = ? OR email = ?").bind(user_id, email).first();
  if (existing) {
    throw new ApiError("CONFLICT", "\u305D\u306EID\u307E\u305F\u306F\u30E1\u30FC\u30EB\u30A2\u30C9\u30EC\u30B9\u306F\u65E2\u306B\u4F7F\u7528\u3055\u308C\u3066\u3044\u307E\u3059\u3002", 409);
  }
  const { hash, salt } = await hashPassword(password);
  const result = await env.DB.prepare(
    "INSERT INTO users (user_id, username, email, password_hash, password_salt) VALUES (?, ?, ?, ?, ?)"
  ).bind(user_id, username, email, hash, salt).run();
  const newUserId = result.meta.last_row_id;
  const token = await signJwt({ sub: newUserId, uid: user_id, name: username }, env.JWT_SECRET);
  return jsonOk({ token, user: { id: newUserId, user_id, username } }, 201);
}
async function handleLogin(request, env) {
  const body = await request.json().catch(() => ({}));
  const { email, password } = body;
  if (!email || !password) {
    throw new ApiError("VALIDATION_ERROR", "\u30E1\u30FC\u30EB\u30A2\u30C9\u30EC\u30B9\u3068\u30D1\u30B9\u30EF\u30FC\u30C9\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044\u3002", 400);
  }
  const user = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();
  if (!user) {
    throw new ApiError("UNAUTHORIZED", "\u30E1\u30FC\u30EB\u30A2\u30C9\u30EC\u30B9\u307E\u305F\u306F\u30D1\u30B9\u30EF\u30FC\u30C9\u304C\u6B63\u3057\u304F\u3042\u308A\u307E\u305B\u3093\u3002", 401);
  }
  const valid = await verifyPassword(password, user.password_hash, user.password_salt);
  if (!valid) {
    throw new ApiError("UNAUTHORIZED", "\u30E1\u30FC\u30EB\u30A2\u30C9\u30EC\u30B9\u307E\u305F\u306F\u30D1\u30B9\u30EF\u30FC\u30C9\u304C\u6B63\u3057\u304F\u3042\u308A\u307E\u305B\u3093\u3002", 401);
  }
  const token = await signJwt(
    { sub: user.id, uid: user.user_id, name: user.username },
    env.JWT_SECRET
  );
  return jsonOk({ token, user: { id: user.id, user_id: user.user_id, username: user.username } });
}

// src/middleware/auth.ts
async function requireAuth(request, env) {
  const header = request.headers.get("Authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    throw new ApiError("UNAUTHORIZED", "\u8A8D\u8A3C\u304C\u5FC5\u8981\u3067\u3059\u3002", 401);
  }
  const payload = await verifyJwt(match[1], env.JWT_SECRET);
  if (!payload) {
    throw new ApiError("UNAUTHORIZED", "\u30C8\u30FC\u30AF\u30F3\u304C\u7121\u52B9\u3001\u307E\u305F\u306F\u671F\u9650\u5207\u308C\u3067\u3059\u3002", 401);
  }
  return { userId: payload.sub, userPublicId: payload.uid, username: payload.name };
}
async function optionalAuth(request, env) {
  const header = request.headers.get("Authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match)
    return null;
  const payload = await verifyJwt(match[1], env.JWT_SECRET);
  if (!payload)
    return null;
  return { userId: payload.sub, userPublicId: payload.uid, username: payload.name };
}

// src/routes/posts.ts
var VISIBILITIES = ["public", "unlisted", "private"];
function validatePostFields(body, partial) {
  if (!partial || body.title !== void 0) {
    if (!body.title || body.title.length < 1 || body.title.length > 100) {
      throw new ApiError("VALIDATION_ERROR", "\u30BF\u30A4\u30C8\u30EB\u306F1\u301C100\u6587\u5B57\u3067\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044\u3002", 400);
    }
  }
  if (!partial || body.description !== void 0) {
    if (!body.description || body.description.length < 1 || body.description.length > 1e4) {
      throw new ApiError("VALIDATION_ERROR", "\u8AAC\u660E\u306F1\u301C10000\u6587\u5B57\u3067\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044\u3002", 400);
    }
    if (/<[^>]+>/.test(body.description || "")) {
      throw new ApiError("VALIDATION_ERROR", "\u8AAC\u660E\u306BHTML\u30BF\u30B0\u306F\u4F7F\u7528\u3067\u304D\u307E\u305B\u3093\u3002", 400);
    }
  }
  if (!partial || body.genre_id !== void 0) {
    if (!body.genre_id) {
      throw new ApiError("VALIDATION_ERROR", "\u30B8\u30E3\u30F3\u30EB\u3092\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044\u3002", 400);
    }
  }
  if (!partial || body.visibility !== void 0) {
    if (!body.visibility || !VISIBILITIES.includes(body.visibility)) {
      throw new ApiError("VALIDATION_ERROR", "\u516C\u958B\u7BC4\u56F2\u306E\u6307\u5B9A\u304C\u4E0D\u6B63\u3067\u3059\u3002", 400);
    }
  }
}
async function handleListPosts(request, env) {
  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 20) || 20, 50);
  const offset = Math.max(Number(url.searchParams.get("offset") ?? 0) || 0, 0);
  const genreId = url.searchParams.get("genre_id");
  const auth = await optionalAuth(request, env);
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
  const binds = [];
  if (auth)
    binds.push(auth.userId);
  if (genreId) {
    query += " AND p.genre_id = ?";
    binds.push(Number(genreId));
  }
  query += " ORDER BY p.created_at DESC LIMIT ? OFFSET ?";
  binds.push(limit, offset);
  const { results } = await env.DB.prepare(query).bind(...binds).all();
  return jsonOk({ posts: results, limit, offset });
}
async function handleGetPost(request, env, id) {
  const auth = await optionalAuth(request, env);
  const post = await env.DB.prepare(
    `SELECT p.*, u.user_id as author_user_id, u.username as author_username, g.name as genre_name
       FROM posts p JOIN users u ON u.id = p.user_id JOIN genres g ON g.id = p.genre_id
       WHERE p.id = ? AND p.is_deleted = 0`
  ).bind(id).first();
  if (!post) {
    throw new ApiError("NOT_FOUND", "\u6295\u7A3F\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\u3002", 404);
  }
  if (post.visibility === "private" && (!auth || auth.userId !== post.user_id)) {
    throw new ApiError("NOT_FOUND", "\u6295\u7A3F\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\u3002", 404);
  }
  return jsonOk({ post });
}
async function handleCreatePost(request, env) {
  const auth = await requireAuth(request, env);
  const body = await request.json().catch(() => ({}));
  validatePostFields(body, false);
  const genre = await env.DB.prepare("SELECT id FROM genres WHERE id = ?").bind(body.genre_id).first();
  if (!genre) {
    throw new ApiError("VALIDATION_ERROR", "\u6307\u5B9A\u3055\u308C\u305F\u30B8\u30E3\u30F3\u30EB\u304C\u5B58\u5728\u3057\u307E\u305B\u3093\u3002", 400);
  }
  const result = await env.DB.prepare(
    "INSERT INTO posts (user_id, title, description, genre_id, visibility) VALUES (?, ?, ?, ?, ?)"
  ).bind(auth.userId, body.title, body.description, body.genre_id, body.visibility).run();
  const newId = result.meta.last_row_id;
  return jsonOk({ id: newId }, 201);
}
async function handleUpdatePost(request, env, id) {
  const auth = await requireAuth(request, env);
  const body = await request.json().catch(() => ({}));
  validatePostFields(body, true);
  const post = await env.DB.prepare("SELECT * FROM posts WHERE id = ? AND is_deleted = 0").bind(id).first();
  if (!post)
    throw new ApiError("NOT_FOUND", "\u6295\u7A3F\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\u3002", 404);
  if (post.user_id !== auth.userId)
    throw new ApiError("FORBIDDEN", "\u3053\u306E\u6295\u7A3F\u3092\u7DE8\u96C6\u3059\u308B\u6A29\u9650\u304C\u3042\u308A\u307E\u305B\u3093\u3002", 403);
  const title = body.title ?? post.title;
  const description = body.description ?? post.description;
  const genreId = body.genre_id ?? post.genre_id;
  const visibility = body.visibility ?? post.visibility;
  await env.DB.prepare(
    "UPDATE posts SET title = ?, description = ?, genre_id = ?, visibility = ?, updated_at = datetime('now') WHERE id = ?"
  ).bind(title, description, genreId, visibility, id).run();
  return jsonOk({ id });
}
async function handleDeletePost(request, env, id) {
  const auth = await requireAuth(request, env);
  const post = await env.DB.prepare("SELECT * FROM posts WHERE id = ? AND is_deleted = 0").bind(id).first();
  if (!post)
    throw new ApiError("NOT_FOUND", "\u6295\u7A3F\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\u3002", 404);
  if (post.user_id !== auth.userId)
    throw new ApiError("FORBIDDEN", "\u3053\u306E\u6295\u7A3F\u3092\u524A\u9664\u3059\u308B\u6A29\u9650\u304C\u3042\u308A\u307E\u305B\u3093\u3002", 403);
  await env.DB.prepare("UPDATE posts SET is_deleted = 1, updated_at = datetime('now') WHERE id = ?").bind(id).run();
  return jsonOk({ id });
}
async function handleListGenres(_request, env) {
  const { results } = await env.DB.prepare("SELECT id, name FROM genres ORDER BY sort_order ASC").all();
  return jsonOk({ genres: results });
}

// src/routes/comments.ts
async function handleListComments(request, env, postId) {
  const url = new URL(request.url);
  const order = url.searchParams.get("order") === "newest" ? "DESC" : "ASC";
  const post = await env.DB.prepare("SELECT id FROM posts WHERE id = ? AND is_deleted = 0").bind(postId).first();
  if (!post)
    throw new ApiError("NOT_FOUND", "\u6295\u7A3F\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\u3002", 404);
  const { results } = await env.DB.prepare(
    `SELECT c.id, c.content, c.is_edited, c.is_deleted, c.created_at, c.updated_at,
              u.id as author_id, u.user_id as author_user_id, u.username as author_username
       FROM comments c JOIN users u ON u.id = c.user_id
       WHERE c.post_id = ?
       ORDER BY c.created_at ${order}`
  ).bind(postId).all();
  const comments = results.map(
    (c) => c.is_deleted ? { ...c, content: "\u3053\u306E\u30B3\u30E1\u30F3\u30C8\u306F\u524A\u9664\u3055\u308C\u307E\u3057\u305F\u3002" } : c
  );
  return jsonOk({ comments });
}
async function handleCreateComment(request, env, postId) {
  const auth = await requireAuth(request, env);
  const body = await request.json().catch(() => ({}));
  if (!body.content || body.content.length < 1 || body.content.length > 5e3) {
    throw new ApiError("VALIDATION_ERROR", "\u30B3\u30E1\u30F3\u30C8\u306F1\u301C5000\u6587\u5B57\u3067\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044\u3002", 400);
  }
  if (/<[^>]+>/.test(body.content)) {
    throw new ApiError("VALIDATION_ERROR", "\u30B3\u30E1\u30F3\u30C8\u306BHTML\u30BF\u30B0\u306F\u4F7F\u7528\u3067\u304D\u307E\u305B\u3093\u3002", 400);
  }
  const post = await env.DB.prepare("SELECT id FROM posts WHERE id = ? AND is_deleted = 0").bind(postId).first();
  if (!post)
    throw new ApiError("NOT_FOUND", "\u6295\u7A3F\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\u3002", 404);
  const result = await env.DB.prepare("INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)").bind(postId, auth.userId, body.content).run();
  return jsonOk({ id: result.meta.last_row_id }, 201);
}
async function handleDeleteComment(request, env, id) {
  const auth = await requireAuth(request, env);
  const comment = await env.DB.prepare("SELECT * FROM comments WHERE id = ? AND is_deleted = 0").bind(id).first();
  if (!comment)
    throw new ApiError("NOT_FOUND", "\u30B3\u30E1\u30F3\u30C8\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\u3002", 404);
  if (comment.user_id !== auth.userId)
    throw new ApiError("FORBIDDEN", "\u3053\u306E\u30B3\u30E1\u30F3\u30C8\u3092\u524A\u9664\u3059\u308B\u6A29\u9650\u304C\u3042\u308A\u307E\u305B\u3093\u3002", 403);
  await env.DB.prepare("UPDATE comments SET is_deleted = 1, updated_at = datetime('now') WHERE id = ?").bind(id).run();
  return jsonOk({ id });
}

// src/index.ts
function corsHeaders(env, request) {
  const origin = request.headers.get("Origin") || "";
  const allowed = env.ALLOWED_ORIGIN;
  const allowOrigin = allowed && (allowed === "*" || allowed === origin) ? origin || allowed : allowed || "*";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400"
  };
}
var src_default = {
  async fetch(request, env) {
    const cors = corsHeaders(env, request);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }
    try {
      const url = new URL(request.url);
      const path = url.pathname;
      const method = request.method;
      const response = await route(request, env, path, method);
      const headers = new Headers(response.headers);
      Object.entries(cors).forEach(([k, v]) => headers.set(k, v));
      return new Response(response.body, { status: response.status, headers });
    } catch (err) {
      if (err instanceof ApiError) {
        return jsonError(err.code, err.message, err.status, cors);
      }
      console.error(err);
      return jsonError("INTERNAL_SERVER_ERROR", "\u30B5\u30FC\u30D0\u30FC\u30A8\u30E9\u30FC\u304C\u767A\u751F\u3057\u307E\u3057\u305F\u3002", 500, cors);
    }
  }
};
async function route(request, env, path, method) {
  if (path === "/api/auth/register" && method === "POST")
    return handleRegister(request, env);
  if (path === "/api/auth/login" && method === "POST")
    return handleLogin(request, env);
  if (path === "/api/genres" && method === "GET")
    return handleListGenres(request, env);
  if (path === "/api/posts" && method === "GET")
    return handleListPosts(request, env);
  if (path === "/api/posts" && method === "POST")
    return handleCreatePost(request, env);
  const postIdMatch = path.match(/^\/api\/posts\/(\d+)$/);
  if (postIdMatch) {
    const id = Number(postIdMatch[1]);
    if (method === "GET")
      return handleGetPost(request, env, id);
    if (method === "PATCH")
      return handleUpdatePost(request, env, id);
    if (method === "DELETE")
      return handleDeletePost(request, env, id);
  }
  const commentsMatch = path.match(/^\/api\/posts\/(\d+)\/comments$/);
  if (commentsMatch) {
    const postId = Number(commentsMatch[1]);
    if (method === "GET")
      return handleListComments(request, env, postId);
    if (method === "POST")
      return handleCreateComment(request, env, postId);
  }
  const commentIdMatch = path.match(/^\/api\/comments\/(\d+)$/);
  if (commentIdMatch) {
    const id = Number(commentIdMatch[1]);
    if (method === "DELETE")
      return handleDeleteComment(request, env, id);
  }
  throw new ApiError("NOT_FOUND", "\u6307\u5B9A\u3055\u308C\u305F\u30A8\u30F3\u30C9\u30DD\u30A4\u30F3\u30C8\u306F\u5B58\u5728\u3057\u307E\u305B\u3093\u3002", 404);
}
export {
  src_default as default
};
