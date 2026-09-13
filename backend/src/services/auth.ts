import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const envSecret = process.env.JWT_SECRET;
if (!envSecret) {
  throw new Error("JWT_SECRET env var is required (set it in .env — see .env.example)");
}
// Narrowed to `string` here (not just at the check site) so every function
// below — closures included — sees a plain `string`, not `string | undefined`.
const JWT_SECRET: string = envSecret;

const TOKEN_TTL = "30d";

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(userId: number): string {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

export function verifyToken(token: string): number | null {
  try {
    // jsonwebtoken types `sub` as `string` (per the JWT spec's convention),
    // but signToken() above always encodes it as the numeric user id we
    // passed in — safe to assert back to that shape via `unknown`.
    const payload = jwt.verify(token, JWT_SECRET) as unknown as { sub: number };
    return payload.sub;
  } catch {
    return null;
  }
}
