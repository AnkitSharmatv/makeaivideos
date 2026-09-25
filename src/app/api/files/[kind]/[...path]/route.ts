import { NextResponse } from "next/server";
import { Readable } from "node:stream";
import { currentUser } from "@/server/auth";
import { readStream, type FileKind } from "@/server/files";

export const runtime = "nodejs";

const KINDS = new Set<FileKind>(["uploads", "media"]);

/** Serves files from the data directory to the signed-in user. */
export async function GET(_req: Request, ctx: { params: Promise<{ kind: string; path: string[] }> }): Promise<Response> {
  const user = await currentUser();
  if (!user) return new NextResponse("Sign in to continue.", { status: 401 });
  const { kind, path } = await ctx.params;
  if (!KINDS.has(kind as FileKind)) return new NextResponse("Not found", { status: 404 });
  const f = readStream(kind as FileKind, path.map(decodeURIComponent).join("/"));
  if (!f) return new NextResponse("Not found", { status: 404 });
  return new Response(Readable.toWeb(f.stream) as ReadableStream, {
    headers: {
      "Content-Type": f.type,
      "Content-Length": String(f.size),
      "Cache-Control": "private, max-age=3600",
    },
  });
}
