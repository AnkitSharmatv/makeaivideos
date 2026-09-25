import { NextResponse } from "next/server";
import fs from "node:fs";
import { Readable } from "node:stream";
import { currentUser } from "@/server/auth";
import { thumbFor } from "@/server/files";

export const runtime = "nodejs";

/** Downsized JPEG of a stored image, generated on first request and cached under data/.cache. */
export async function GET(_req: Request, ctx: { params: Promise<{ path: string[] }> }): Promise<Response> {
  const user = await currentUser();
  if (!user) return new NextResponse("Sign in to continue.", { status: 401 });
  const { path } = await ctx.params;
  const out = await thumbFor(path.map(decodeURIComponent).join("/"));
  if (!out) return new NextResponse("Not found", { status: 404 });
  const size = fs.statSync(out).size;
  return new Response(Readable.toWeb(fs.createReadStream(out)) as ReadableStream, {
    headers: { "Content-Type": "image/jpeg", "Content-Length": String(size), "Cache-Control": "private, max-age=3600" },
  });
}
