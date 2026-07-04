import { Env, UserRow } from "../types";
import { jsonOk, ApiError } from "../utils/response";
import { hashPassword, verifyPassword, isValidPassword, isValidUserId, isValidEmail } from "../utils/password";
import { signJwt } from "../utils/jwt";
import { getDb } from "../db";

interface RegisterBody {
  username?: string;
  user_id?: string;
  email?: string;
  password?: string;
}

export async function handleRegister(request: Request, env: Env): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as RegisterBody;
  const { username, user_id, email, password } = body;

  if (!username || username.length < 1 || username.length > 30) {
    throw new ApiError("VALIDATION_ERROR", "ユーザー名は1〜30文字で入力してください。", 400);
  }
  if (!user_id || !isValidUserId(user_id)) {
    throw new ApiError("VALIDATION_ERROR", "IDは半角英数字・_・-のみ、3〜20文字で入力してください。", 400);
  }
  if (!email || !isValidEmail(email)) {
    throw new ApiError("VALIDATION_ERROR", "有効なメールアドレスを入力してください。", 400);
  }
  if (!password || !isValidPassword(password)) {
    throw new ApiError("VALIDATION_ERROR", "パスワードは8〜128文字で、英字と数字を含めてください。", 400);
  }

  const sql = getDb(env);

  const existing = await sql("SELECT id FROM users WHERE user_id = $1 OR email = $2", [user_id, email]);
  if (existing.length > 0) {
    throw new ApiError("CONFLICT", "そのIDまたはメールアドレスは既に使用されています。", 409);
  }

  const { hash, salt } = await hashPassword(password);

  const rows = await sql(
    `INSERT INTO users (user_id, username, email, password_hash, password_salt)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [user_id, username, email, hash, salt]
  );

  const newUserId = rows[0].id as number;
  const token = await signJwt({ sub: newUserId, uid: user_id, name: username }, env.JWT_SECRET);

  return jsonOk({ token, user: { id: newUserId, user_id, username } }, 201);
}

interface LoginBody {
  email?: string;
  password?: string;
}

export async function handleLogin(request: Request, env: Env): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as LoginBody;
  const { email, password } = body;

  if (!email || !password) {
    throw new ApiError("VALIDATION_ERROR", "メールアドレスとパスワードを入力してください。", 400);
  }

  const sql = getDb(env);
  const rows = await sql("SELECT * FROM users WHERE email = $1", [email]);
  const user = rows[0] as UserRow | undefined;

  if (!user) {
    throw new ApiError("UNAUTHORIZED", "メールアドレスまたはパスワードが正しくありません。", 401);
  }

  const valid = await verifyPassword(password, user.password_hash, user.password_salt);
  if (!valid) {
    throw new ApiError("UNAUTHORIZED", "メールアドレスまたはパスワードが正しくありません。", 401);
  }

  const token = await signJwt(
    { sub: user.id, uid: user.user_id, name: user.username },
    env.JWT_SECRET
  );

  return jsonOk({ token, user: { id: user.id, user_id: user.user_id, username: user.username } });
}
