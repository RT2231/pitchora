// Worker のデプロイ先URLは Vercel の環境変数 VITE_API_BASE で設定してください
export const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8787";

export interface ApiSuccess<T> { success: true; data: T }
export interface ApiFailure { success: false; error: { code: string; message: string } }
export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

function getToken(): string | null {
  return localStorage.getItem("pitchora_token");
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem("pitchora_token", token);
  else localStorage.removeItem("pitchora_token");
}

export function getCurrentUser(): { id: number; user_id: string; username: string } | null {
  const raw = localStorage.getItem("pitchora_user");
  return raw ? JSON.parse(raw) : null;
}

export function setCurrentUser(user: { id: number; user_id: string; username: string } | null) {
  if (user) localStorage.setItem("pitchora_user", JSON.stringify(user));
  else localStorage.removeItem("pitchora_user");
}

export class ApiClientError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const body = (await res.json()) as ApiResult<T>;

  if (!body.success) {
    if (res.status === 401) {
      setToken(null);
      setCurrentUser(null);
    }
    throw new ApiClientError(body.error.code, body.error.message, res.status);
  }
  return body.data;
}

export const api = {
  register: (payload: { username: string; user_id: string; email: string; password: string }) =>
    request<{ token: string; user: { id: number; user_id: string; username: string } }>(
      "/api/auth/register",
      { method: "POST", body: JSON.stringify(payload) }
    ),

  login: (payload: { email: string; password: string }) =>
    request<{ token: string; user: { id: number; user_id: string; username: string } }>(
      "/api/auth/login",
      { method: "POST", body: JSON.stringify(payload) }
    ),

  listGenres: () => request<{ genres: { id: number; name: string }[] }>("/api/genres"),

  listPosts: (params: { genre_id?: number; offset?: number; author?: string } = {}) => {
    const q = new URLSearchParams();
    if (params.genre_id) q.set("genre_id", String(params.genre_id));
    if (params.offset) q.set("offset", String(params.offset));
    if (params.author) q.set("author", params.author);
    return request<{ posts: any[]; limit: number; offset: number }>(`/api/posts?${q.toString()}`);
  },

  getPost: (id: number) => request<{ post: any }>(`/api/posts/${id}`),

  createPost: (payload: { title: string; description: string; genre_id: number; visibility: string }) =>
    request<{ id: number }>("/api/posts", { method: "POST", body: JSON.stringify(payload) }),

  updatePost: (id: number, payload: Partial<{ title: string; description: string; genre_id: number; visibility: string }>) =>
    request<{ id: number }>(`/api/posts/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),

  deletePost: (id: number) => request<{ id: number }>(`/api/posts/${id}`, { method: "DELETE" }),

  listComments: (postId: number) => request<{ comments: any[] }>(`/api/posts/${postId}/comments`),

  createComment: (postId: number, content: string) =>
    request<{ id: number }>(`/api/posts/${postId}/comments`, { method: "POST", body: JSON.stringify({ content }) }),

  deleteComment: (id: number) => request<{ id: number }>(`/api/comments/${id}`, { method: "DELETE" }),

  getUserProfile: (userId: string) =>
    request<{
      user: { id: number; user_id: string; username: string; created_at: string };
      post_count: number;
      follower_count: number;
      following_count: number;
      is_following: boolean;
      is_self: boolean;
    }>(`/api/users/${encodeURIComponent(userId)}`),

  followUser: (userId: string) =>
    request<{ following: boolean }>(`/api/users/${encodeURIComponent(userId)}/follow`, { method: "POST" }),

  unfollowUser: (userId: string) =>
    request<{ following: boolean }>(`/api/users/${encodeURIComponent(userId)}/follow`, { method: "DELETE" }),

  listFollowers: (userId: string) =>
    request<{ users: { user_id: string; username: string }[] }>(`/api/users/${encodeURIComponent(userId)}/followers`),

  listFollowing: (userId: string) =>
    request<{ users: { user_id: string; username: string }[] }>(`/api/users/${encodeURIComponent(userId)}/following`),

  likePost: (postId: number) => request<{ liked: boolean; like_count: number }>(`/api/posts/${postId}/like`, { method: "POST" }),

  unlikePost: (postId: number) => request<{ liked: boolean; like_count: number }>(`/api/posts/${postId}/like`, { method: "DELETE" }),
};
