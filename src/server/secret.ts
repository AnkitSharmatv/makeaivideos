import "server-only";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DATA_DIR, ensureDirs } from "./paths";

let cached: Buffer | null = null;

/**
 * 32-byte secret for key encryption. `APP_SECRET` (hex) wins; otherwise one is
 * generated on first run and kept in data/secret.key so nobody has to edit .env.
 */
export function appSecret(): Buffer {
  if (cached) return cached;
  const env = process.env.APP_SECRET;
  if (env && /^[0-9a-f]{64}$/i.test(env)) {
    cached = Buffer.from(env, "hex");
    return cached;
  }
  ensureDirs();
  const file = path.join(DATA_DIR, "secret.key");
  try {
    const hex = fs.readFileSync(file, "utf8").trim();
    if (/^[0-9a-f]{64}$/i.test(hex)) {
      cached = Buffer.from(hex, "hex");
      return cached;
    }
  } catch {
    /* generate below */
  }
  const fresh = crypto.randomBytes(32);
  fs.writeFileSync(file, fresh.toString("hex") + "\n", { mode: 0o600 });
  cached = fresh;
  return cached;
}
