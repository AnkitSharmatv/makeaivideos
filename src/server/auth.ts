import "server-only";
import { cookies, headers } from "next/headers";
import { all, batch, newId, one, run } from "./db";
import { hashPassword, randomToken, sha256, verifyPassword } from "./crypto";

export const SESSION_COOKIE = "mav_session";
const SESSION_DAYS = 30;

export type User = { id: string; email: string; name: string; isAdmin: boolean; createdAt: number };

type UserRow = { id: string; email: string; name: string; password_hash: string; is_admin: number; created_at: number };

function toUser(r: UserRow): User {
  return { id: r.id, email: r.email, name: r.name, isAdmin: r.is_admin === 1, createdAt: Number(r.created_at) };
}

export async function userCount(): Promise<number> {
  const r = await one<{ n: number }>("SELECT COUNT(*) AS n FROM users");
  return Number(r?.n ?? 0);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function createUser(email: string, name: string, password: string, isAdmin: boolean): Promise<User> {
  const id = newId();
  const now = Date.now();
  await run("INSERT INTO users (id, email, name, password_hash, is_admin, created_at) VALUES (?, ?, ?, ?, ?, ?)", [
    id,
    normalizeEmail(email),
    name.trim() || email.split("@")[0] || "You",
    hashPassword(password),
    isAdmin ? 1 : 0,
    now,
  ]);
  return { id, email: normalizeEmail(email), name: name.trim(), isAdmin, createdAt: now };
}

export async function findUserByEmail(email: string): Promise<{ user: User; passwordHash: string } | null> {
  const r = await one<UserRow>("SELECT * FROM users WHERE email = ?", [normalizeEmail(email)]);
  return r ? { user: toUser(r), passwordHash: r.password_hash } : null;
}

export async function checkPassword(email: string, password: string): Promise<User | null> {
  const found = await findUserByEmail(email);
  if (!found) {
    // Burn similar time so a missing address isn't distinguishable by latency.
    verifyPassword(password, hashPassword("x"));
    return null;
  }
  return verifyPassword(password, found.passwordHash) ? found.user : null;
}

async function isHttps(): Promise<boolean> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "";
  return proto.split(",")[0]?.trim() === "https";
}

export async function startSession(userId: string): Promise<void> {
  const token = randomToken();
  const now = Date.now();
  const expires = now + SESSION_DAYS * 24 * 60 * 60 * 1000;
  await run("INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)", [sha256(token), userId, expires, now]);
  const jar = await cookies();
  jar.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: await isHttps(),
    path: "/",
    expires: new Date(expires),
  });
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await run("DELETE FROM sessions WHERE token_hash = ?", [sha256(token)]);
  jar.delete(SESSION_COOKIE);
}

/** The signed-in user, or null. Expired sessions are dropped as they're seen. */
export async function currentUser(): Promise<User | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const r = await one<UserRow & { expires_at: number }>(
    "SELECT u.*, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?",
    [sha256(token)],
  );
  if (!r) return null;
  if (Number(r.expires_at) < Date.now()) {
    await run("DELETE FROM sessions WHERE token_hash = ?", [sha256(token)]);
    return null;
  }
  return toUser(r);
}

export class AuthError extends Error {
  constructor(message = "Sign in to continue.") {
    super(message);
    this.name = "AuthError";
  }
}

export async function requireUser(): Promise<User> {
  const u = await currentUser();
  if (!u) throw new AuthError();
  return u;
}

export async function changePassword(userId: string, current: string, next: string): Promise<boolean> {
  const r = await one<UserRow>("SELECT * FROM users WHERE id = ?", [userId]);
  if (!r || !verifyPassword(current, r.password_hash)) return false;
  await batch([
    { sql: "UPDATE users SET password_hash = ? WHERE id = ?", args: [hashPassword(next), userId] },
    { sql: "DELETE FROM sessions WHERE user_id = ?", args: [userId] },
  ]);
  return true;
}

export async function listUsers(): Promise<User[]> {
  const rows = await all<UserRow>("SELECT * FROM users ORDER BY created_at");
  return rows.map(toUser);
}
