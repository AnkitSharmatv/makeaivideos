import { NextResponse } from "next/server";
import { currentUser } from "@/server/auth";
import * as repo from "@/server/repo";
import { newId } from "@/server/db";
import { extFor, imageDims, slug, uniqueRel, writeFile } from "@/server/files";
import { MAX_UPLOAD_BYTES } from "@/uploads";
import type { Upload } from "@/db/types";

export const runtime = "nodejs";

/** Multipart: `file`, `projectId`. Stores the file under data/uploads and records it in the project. */
export async function POST(req: Request): Promise<Response> {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data." }, { status: 400 });
  }
  const projectId = form.get("projectId");
  const file = form.get("file");
  if (typeof projectId !== "string" || !projectId) return NextResponse.json({ error: "Missing project." }, { status: 400 });
  if (!(file instanceof File)) return NextResponse.json({ error: "No file." }, { status: 400 });
  if (file.size === 0) return NextResponse.json({ error: "Empty file." }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "File is larger than 50 MB." }, { status: 413 });
  const projects = await repo.listProjects(user.id);
  if (!projects.some((p) => p.id === projectId)) return NextResponse.json({ error: "Unknown project." }, { status: 404 });

  const type = file.type || "application/octet-stream";
  const kind = type.startsWith("video/") ? "video" : "image";
  const id = newId();
  const folder = await repo.projectFolder(user.id, projectId);
  const ext = extFor(type, file.name);
  const base = slug((file.name || "upload").replace(/\.[a-z0-9]+$/i, ""), 60);
  const stored = await uniqueRel("uploads", folder, base, ext);
  await writeFile("uploads", stored, Buffer.from(await file.arrayBuffer()));
  const dims = kind === "image" ? await imageDims("uploads", stored) : null;
  const meta = form.get("meta");
  const extra = typeof meta === "string" ? (JSON.parse(meta) as { width?: number; height?: number; duration?: number }) : {};

  const upload: Upload = {
    id,
    projectId,
    kind,
    name: (file.name || stored).slice(-120),
    type,
    size: file.size,
    file: stored,
    width: dims?.width ?? extra.width,
    height: dims?.height ?? extra.height,
    duration: extra.duration,
    remotes: {},
    createdAt: Date.now(),
  };
  await repo.insertUpload(user.id, upload);
  return NextResponse.json(upload);
}
