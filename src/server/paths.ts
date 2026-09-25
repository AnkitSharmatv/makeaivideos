import "server-only";
import fs from "node:fs";
import path from "node:path";

/** Everything the app persists lives under one directory; back it up by copying it. */
export const DATA_DIR = path.resolve(/*turbopackIgnore: true*/ process.env.DATA_DIR ?? path.join(process.cwd(), "data"));

export const DIRS = {
  root: DATA_DIR,
  uploads: path.join(DATA_DIR, "uploads"),
  media: path.join(DATA_DIR, "media"),
  /** Regenerable previews; safe to delete at any time. */
  thumbs: path.join(DATA_DIR, ".cache", "thumbs"),
} as const;

export function ensureDirs(): void {
  for (const d of Object.values(DIRS)) fs.mkdirSync(d, { recursive: true });
}

export const DB_FILE = path.join(DATA_DIR, "makeaivideos.db");
