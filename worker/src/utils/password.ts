const PBKDF2_ITERATIONS = 100_000;
const HASH_ALGO = "SHA-256";
const KEY_LENGTH_BITS = 256;

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function derive(password: string, salt: Uint8Array): Promise<ArrayBuffer> {
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

export async function hashPassword(password: string): Promise<{ hash: string; salt: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const derived = await derive(password, salt);
  return { hash: toBase64(derived), salt: toBase64(salt.buffer as ArrayBuffer) };
}

export async function verifyPassword(password: string, hash: string, salt: string): Promise<boolean> {
  const saltBytes = fromBase64(salt);
  const derived = await derive(password, saltBytes);
  const derivedB64 = toBase64(derived);
  // タイミング攻撃を避けるための定数時間比較
  if (derivedB64.length !== hash.length) return false;
  let diff = 0;
  for (let i = 0; i < derivedB64.length; i++) {
    diff |= derivedB64.charCodeAt(i) ^ hash.charCodeAt(i);
  }
  return diff === 0;
}

// SPEC 3章: 8〜128文字, 英字+数字必須
export function isValidPassword(password: string): boolean {
  if (password.length < 8 || password.length > 128) return false;
  if (!/[A-Za-z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  return true;
}

// SPEC 3章: 半角英数字, _, -、3〜20文字
export function isValidUserId(userId: string): boolean {
  return /^[A-Za-z0-9_-]{3,20}$/.test(userId);
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}
