import "server-only";
import fs from "node:fs";
import path from "node:path";

let cached: string | null | undefined;

/**
 * Optional per-copy stamp. If the app folder contains LICENSED-TO.txt, its first
 * non-empty line is shown in the account menu ("Licensed to …"). Absent = nothing shown.
 */
export function licensee(): string | null {
  if (cached !== undefined) return cached;
  try {
    const raw = fs.readFileSync(path.join(/*turbopackIgnore: true*/ process.cwd(), "LICENSED-TO.txt"), "utf8");
    const first = raw
      .split("\n")
      .map((l) => l.trim())
      .find(Boolean);
    cached = first ? first.slice(0, 120) : null;
  } catch {
    cached = null;
  }
  return cached;
}
