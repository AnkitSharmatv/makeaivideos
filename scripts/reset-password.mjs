#!/usr/bin/env node
/**
 * Reset a local account's password from the terminal (for self-hosters who
 * lock themselves out).
 *
 *   pnpm reset-password you@example.com            # asks for a new password (interactive terminal)
 *   pnpm reset-password you@example.com --generate # prints a random one-time password instead
 *
 * Without an interactive terminal (e.g. a "Run" button, CI, a pipe) it
 * behaves like --generate so it never hangs waiting for input.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Writable } from "node:stream";
import readline from "node:readline/promises";
import { createClient } from "@libsql/client";

const args = process.argv.slice(2);
const email = (args.find((a) => !a.startsWith("--")) ?? "").trim().toLowerCase();
const generate = args.includes("--generate") || !process.stdin.isTTY;
if (!email) {
  console.error("Usage: pnpm reset-password you@example.com [--generate]");
  process.exit(1);
}

const dataDir = path.resolve(process.env.DATA_DIR ?? path.join(process.cwd(), "data"));
const dbFile = path.join(dataDir, "makeaivideos.db");
if (!fs.existsSync(dbFile)) {
  console.error(`No database at ${dbFile}. Run this from the app folder (or set DATA_DIR).`);
  process.exit(1);
}
const db = createClient({ url: `file:${dbFile}` });

const N = 2 ** 15, r = 8, p = 1, keylen = 64;
function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password.normalize("NFKC"), salt, keylen, { N, r, p, maxmem: 128 * N * r * 2 });
  return `scrypt$${N}$${r}$${p}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

async function askHidden(question) {
  process.stdout.write(question);
  const muted = new Writable({ write(_chunk, _enc, cb) { cb(); } });
  const rl = readline.createInterface({ input: process.stdin, output: muted, terminal: true });
  try {
    return await rl.question("");
  } finally {
    rl.close();
    process.stdout.write("\n");
  }
}

const user = (await db.execute({ sql: "SELECT id, name FROM users WHERE email = ?", args: [email] })).rows[0];
if (!user) {
  console.error(`No account with email ${email}.`);
  process.exit(1);
}

let pw;
if (generate) {
  pw = crypto.randomBytes(9).toString("base64url"); // 12 chars
} else {
  pw = await askHidden(`New password for ${user.name} <${email}> (min 8 chars): `);
  if (pw.length < 8) {
    console.error("Use at least 8 characters.");
    process.exit(1);
  }
  const again = await askHidden("Repeat it: ");
  if (pw !== again) {
    console.error("Passwords didn't match.");
    process.exit(1);
  }
}

await db.batch(
  [
    { sql: "UPDATE users SET password_hash = ? WHERE id = ?", args: [hashPassword(pw), user.id] },
    { sql: "DELETE FROM sessions WHERE user_id = ?", args: [user.id] },
  ],
  "write",
);

if (generate) {
  console.log(`\nTemporary password for ${email}:\n\n    ${pw}\n\nSign in with it, then change it from the account menu (top right).`);
} else {
  console.log("Password updated. Existing sessions were signed out.");
}
process.exit(0);
