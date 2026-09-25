"use server";

import { changePassword, checkPassword, createUser, currentUser, endSession, findUserByEmail, startSession, userCount, type User } from "@/server/auth";
import { licensee } from "@/server/license";

export type AuthState = { user: User | null; needsSetup: boolean; signupOpen: boolean; licensee: string | null };

function signupOpen(): boolean {
  return process.env.ALLOW_SIGNUP === "true";
}

export async function getAuthState(): Promise<AuthState> {
  const [user, count] = await Promise.all([currentUser(), userCount()]);
  return { user, needsSetup: count === 0, signupOpen: signupOpen(), licensee: licensee() };
}

type Result = { ok: true } | { ok: false; reason: string };

function validate(email: string, password: string): string | null {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "Enter a valid email address.";
  if (password.length < 8) return "Use at least 8 characters for the password.";
  return null;
}

/** First run: creates the admin account and signs in. Refused once any user exists. */
export async function setupAccount(email: string, name: string, password: string): Promise<Result> {
  if ((await userCount()) > 0) return { ok: false, reason: "This instance is already set up. Sign in instead." };
  const bad = validate(email, password);
  if (bad) return { ok: false, reason: bad };
  const user = await createUser(email, name, password, true);
  await startSession(user.id);
  return { ok: true };
}

/** Additional accounts, only when ALLOW_SIGNUP=true. */
export async function signUp(email: string, name: string, password: string): Promise<Result> {
  if (!signupOpen()) return { ok: false, reason: "Sign-up is closed on this instance." };
  const bad = validate(email, password);
  if (bad) return { ok: false, reason: bad };
  if (await findUserByEmail(email)) return { ok: false, reason: "That email already has an account." };
  const user = await createUser(email, name, password, false);
  await startSession(user.id);
  return { ok: true };
}

export async function signIn(email: string, password: string): Promise<Result> {
  const user = await checkPassword(email, password);
  if (!user) return { ok: false, reason: "Email or password didn't match." };
  await startSession(user.id);
  return { ok: true };
}

export async function signOut(): Promise<void> {
  await endSession();
}

export async function updatePassword(current: string, next: string): Promise<Result> {
  const user = await currentUser();
  if (!user) return { ok: false, reason: "Sign in first." };
  if (next.length < 8) return { ok: false, reason: "Use at least 8 characters." };
  const ok = await changePassword(user.id, current, next);
  if (!ok) return { ok: false, reason: "Current password didn't match." };
  await startSession(user.id);
  return { ok: true };
}
