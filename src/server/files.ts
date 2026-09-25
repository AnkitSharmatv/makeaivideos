import "server-only";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { DIRS, ensureDirs } from "./paths";

export type FileKind = Exclude<keyof typeof DIRS, "root">;

const EXT_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
};

export const TYPE_BY_EXT: Record<string, string> = Object.fromEntries(Object.entries(EXT_BY_TYPE).map(([t, e]) => [e, t]));

export function extFor(contentType: string, fallbackName = ""): string {
  const byType = EXT_BY_TYPE[contentType.split(";")[0]?.trim() ?? ""];
  if (byType) return byType;
  const m = /\.([a-z0-9]{2,4})$/i.exec(fallbackName);
  return m ? m[1]!.toLowerCase() : "bin";
}

const SEGMENT = /^[a-zA-Z0-9][a-zA-Z0-9 _.()-]{0,119}$/;

/**
 * Stored paths are `folder/file` or `file` — at most one folder level, plain
 * characters only, never `..`. Anything else is refused, so nothing outside
 * the data directory can be read or written.
 */
export function safeRel(rel: string): string | null {
  const parts = rel.split("/");
  if (parts.length > 2) return null;
  for (const seg of parts) if (!SEGMENT.test(seg) || seg === "." || seg === "..") return null;
  return parts.join("/");
}

/** Folder-safe version of a project name, e.g. "Spring campaign" → "Spring campaign". */
export function folderName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9 _.()-]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
  const safe = cleaned && SEGMENT.test(cleaned) && cleaned !== "." && cleaned !== ".." ? cleaned : "";
  return safe || "Untitled";
}

export function slug(s: string, max = 40): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, max) || "file";
}

/** 2026-09-20_1902 — sortable, readable. */
export function stamp(ts = Date.now()): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}

export function filePath(kind: FileKind, rel: string): string | null {
  const safe = safeRel(rel);
  return safe ? path.join(DIRS[kind], safe) : null;
}

export async function writeFile(kind: FileKind, rel: string, data: Buffer | Uint8Array): Promise<string> {
  ensureDirs();
  const p = filePath(kind, rel);
  if (!p) throw new Error("Bad file name.");
  await fsp.mkdir(path.dirname(p), { recursive: true });
  await fsp.writeFile(p, data);
  return rel;
}

/** A path under `folder` that doesn't exist yet: name.ext, name (2).ext, … */
export async function uniqueRel(kind: FileKind, folder: string, base: string, ext: string): Promise<string> {
  for (let i = 0; i < 1000; i++) {
    const candidate = `${folder}/${base}${i ? ` (${i + 1})` : ""}.${ext}`;
    const p = filePath(kind, candidate);
    if (!p) throw new Error("Bad file name.");
    if (!fs.existsSync(p)) return candidate;
  }
  throw new Error("Too many files with that name.");
}

export async function removeFile(kind: FileKind, rel: string | null | undefined): Promise<void> {
  if (!rel) return;
  const p = filePath(kind, rel);
  if (!p) return;
  await fsp.rm(p, { force: true });
  await pruneEmptyFolder(kind, rel);
  if (kind === "media") await removeFile("thumbs", cachedThumbRel(rel));
}

/** Move a stored file into another folder (project rename / move). Returns the new rel path. */
export async function moveFile(kind: FileKind, rel: string, folder: string): Promise<string> {
  const from = filePath(kind, rel);
  if (!from || !fs.existsSync(from)) return rel;
  const base = path.basename(rel);
  const dot = base.lastIndexOf(".");
  const next = await uniqueRel(kind, folder, dot > 0 ? base.slice(0, dot) : base, dot > 0 ? base.slice(dot + 1) : "bin");
  const to = filePath(kind, next);
  if (!to) return rel;
  await fsp.mkdir(path.dirname(to), { recursive: true });
  await fsp.rename(from, to);
  await pruneEmptyFolder(kind, rel);
  if (kind === "media") await removeFile("thumbs", cachedThumbRel(rel)); // regenerated on demand at the new path
  return next;
}

async function pruneEmptyFolder(kind: FileKind, rel: string): Promise<void> {
  const folder = rel.includes("/") ? rel.split("/")[0]! : null;
  if (!folder) return;
  const p = filePath(kind, folder);
  if (!p) return;
  try {
    if ((await fsp.readdir(p)).length === 0) await fsp.rmdir(p);
  } catch {
    /* ignore */
  }
}

export function readStream(kind: FileKind, rel: string): { stream: fs.ReadStream; size: number; type: string } | null {
  const p = filePath(kind, rel);
  if (!p || !fs.existsSync(p)) return null;
  const size = fs.statSync(p).size;
  const ext = path.extname(p).slice(1).toLowerCase();
  return { stream: fs.createReadStream(p), size, type: TYPE_BY_EXT[ext] ?? "application/octet-stream" };
}

export async function readBuffer(kind: FileKind, rel: string): Promise<Buffer | null> {
  const p = filePath(kind, rel);
  if (!p) return null;
  try {
    return await fsp.readFile(p);
  } catch {
    return null;
  }
}

/** Fetch a provider result to disk under `folder`; returns the stored path and content type. */
export async function archiveFromUrl(url: string, folder: string, base: string, hint: "image" | "video"): Promise<{ rel: string; type: string; size: number } | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const type = (res.headers.get("content-type") ?? "").split(";")[0]?.trim() || (hint === "video" ? "video/mp4" : "image/png");
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0) return null;
    const rel = await uniqueRel("media", folder, base, extFor(type, url));
    await writeFile("media", rel, buf);
    return { rel, type, size: buf.length };
  } catch {
    return null;
  }
}

/**
 * JPEG preview of a stored image, made on first request and kept in
 * data/.cache/thumbs (mirrors the media path). Returns the cache path.
 */
export async function thumbFor(mediaRel: string, width = 640): Promise<string | null> {
  const src = filePath("media", mediaRel);
  if (!src || !fs.existsSync(src)) return null;
  const rel = mediaRel.replace(/\.[a-z0-9]+$/i, "") + ".jpg";
  const out = filePath("thumbs", rel);
  if (!out) return null;
  if (fs.existsSync(out)) return out;
  try {
    const sharp = (await import("sharp")).default;
    await fsp.mkdir(path.dirname(out), { recursive: true });
    await sharp(src, { animated: false }).resize({ width, withoutEnlargement: true }).jpeg({ quality: 82 }).toFile(out);
    return out;
  } catch {
    return null;
  }
}

function cachedThumbRel(mediaRel: string): string {
  return mediaRel.replace(/\.[a-z0-9]+$/i, "") + ".jpg";
}

export async function imageDims(kind: FileKind, rel: string): Promise<{ width: number; height: number } | null> {
  const p = filePath(kind, rel);
  if (!p) return null;
  try {
    const sharp = (await import("sharp")).default;
    const meta = await sharp(p).metadata();
    return meta.width && meta.height ? { width: meta.width, height: meta.height } : null;
  } catch {
    return null;
  }
}
