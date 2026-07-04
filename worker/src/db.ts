import { neon } from "@neondatabase/serverless";
import { Env } from "./types";

// Neon serverless driver は fetch ベースのHTTPドライバなので、
// Cloudflare Workers上でも接続プールを気にせず毎リクエストで呼び出せる。
export function getDb(env: Env) {
  return neon(env.DATABASE_URL);
}
