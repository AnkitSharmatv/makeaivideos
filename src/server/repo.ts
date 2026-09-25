import "server-only";
import { all, batch, one, run, type InValue } from "./db";
import type { Asset, MediaRefs, Project, PromptEntry, Run, Upload } from "@/db/types";
import type { GenerateInput, MediaKind, ProviderId, SettingValue, FailureCode } from "@/providers/types";
import { HISTORY_CAP } from "@/config";
import { folderName, moveFile, removeFile } from "./files";

const j = (v: unknown): string => JSON.stringify(v ?? null);
const p = <T>(s: unknown, fallback: T): T => {
  if (typeof s !== "string") return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
};
const num = (v: unknown): number | undefined => (v === null || v === undefined ? undefined : Number(v));
const str = (v: unknown): string | undefined => (v === null || v === undefined ? undefined : String(v));

// ───────────────────────── Projects ─────────────────────────

type ProjectRow = { id: string; name: string; created_at: number; updated_at: number };
const toProject = (r: ProjectRow): Project => ({ id: r.id, name: r.name, createdAt: Number(r.created_at), updatedAt: Number(r.updated_at) });

export async function listProjects(userId: string): Promise<Project[]> {
  return (await all<ProjectRow>("SELECT id, name, created_at, updated_at FROM projects WHERE user_id = ? ORDER BY updated_at DESC", [userId])).map(toProject);
}

export async function insertProject(userId: string, project: Project): Promise<void> {
  await run("INSERT INTO projects (id, user_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)", [project.id, userId, project.name, project.createdAt, project.updatedAt]);
}

export async function getProject(userId: string, id: string): Promise<Project | null> {
  const r = await one<ProjectRow>("SELECT id, name, created_at, updated_at FROM projects WHERE id = ? AND user_id = ?", [id, userId]);
  return r ? toProject(r) : null;
}

/** Disk folder for a project's files: its name, made filesystem-safe. */
export async function projectFolder(userId: string, id: string): Promise<string> {
  const p = await getProject(userId, id);
  return folderName(p?.name ?? "Untitled");
}

export async function renameProject(userId: string, id: string, name: string): Promise<Project | null> {
  const before = await getProject(userId, id);
  if (!before) return null;
  const now = Date.now();
  await run("UPDATE projects SET name = ?, updated_at = ? WHERE id = ? AND user_id = ?", [name, now, id, userId]);
  const oldFolder = folderName(before.name);
  const newFolder = folderName(name);
  if (oldFolder !== newFolder) await relocateProjectFiles(userId, id, newFolder);
  return getProject(userId, id);
}

/** Move every stored file of a project into `folder` and update the rows. */
export async function relocateProjectFiles(userId: string, projectId: string, folder: string): Promise<void> {
  const assets = await all<{ id: string; local_file: string | null }>("SELECT id, local_file FROM assets WHERE project_id = ? AND user_id = ?", [projectId, userId]);
  for (const a of assets) {
    const local = a.local_file ? await moveFile("media", a.local_file, folder) : null;
    if (local !== a.local_file) await run("UPDATE assets SET local_file = ?, thumb_file = NULL WHERE id = ?", [local, a.id]);
  }
  const uploads = await all<{ id: string; file: string }>("SELECT id, file FROM uploads WHERE project_id = ? AND user_id = ?", [projectId, userId]);
  for (const u of uploads) {
    const file = await moveFile("uploads", u.file, folder);
    if (file !== u.file) await run("UPDATE uploads SET file = ? WHERE id = ?", [file, u.id]);
  }
}

/** Files stored before per-project folders existed (flat, id-named) are moved into place. */
export async function migrateFlatFiles(userId: string): Promise<void> {
  const rows = await all<{ project_id: string }>(
    "SELECT DISTINCT project_id FROM assets WHERE user_id = ? AND local_file NOT LIKE '%/%' UNION SELECT DISTINCT project_id FROM uploads WHERE user_id = ? AND file NOT LIKE '%/%'",
    [userId, userId],
  );
  for (const r of rows) await relocateProjectFiles(userId, r.project_id, await projectFolder(userId, r.project_id));
}

export async function touchProject(userId: string, id: string): Promise<void> {
  await run("UPDATE projects SET updated_at = ? WHERE id = ? AND user_id = ?", [Date.now(), id, userId]);
}

/** Cascades to assets, runs and uploads (rows + files). */
export async function deleteProject(userId: string, id: string): Promise<void> {
  const assets = await all<{ local_file: string | null }>("SELECT local_file FROM assets WHERE project_id = ? AND user_id = ?", [id, userId]);
  const uploads = await all<{ file: string }>("SELECT file FROM uploads WHERE project_id = ? AND user_id = ?", [id, userId]);
  await run("DELETE FROM projects WHERE id = ? AND user_id = ?", [id, userId]);
  await Promise.all([...assets.map((a) => removeFile("media", a.local_file)), ...uploads.map((u) => removeFile("uploads", u.file))]);
}

// ───────────────────────── Assets ─────────────────────────

type AssetRow = {
  id: string; project_id: string; run_id: string; provider: string; model_id: string; kind: string; prompt: string; negative_prompt: string | null;
  settings: string; media: string; media_refs: string | null; seed: number | null; url: string; local_file: string | null; thumb_file: string | null;
  width: number | null; height: number | null; duration: number | null; cost_credits: number | null; cost_usd: number | null; favorite: number; created_at: number;
};

const toAsset = (r: AssetRow): Asset => ({
  id: r.id,
  projectId: r.project_id,
  runId: r.run_id,
  provider: r.provider as ProviderId,
  modelId: r.model_id,
  kind: r.kind as MediaKind,
  prompt: r.prompt,
  negativePrompt: str(r.negative_prompt),
  settings: p<Record<string, SettingValue>>(r.settings, {}),
  media: p<GenerateInput["media"]>(r.media, {}),
  mediaRefs: r.media_refs ? p<MediaRefs>(r.media_refs, {}) : undefined,
  seed: num(r.seed),
  url: r.url,
  localFile: str(r.local_file),
  thumbFile: str(r.thumb_file),
  width: num(r.width),
  height: num(r.height),
  duration: num(r.duration),
  costCredits: num(r.cost_credits),
  costUsd: num(r.cost_usd),
  favorite: Number(r.favorite) === 1 ? 1 : 0,
  createdAt: Number(r.created_at),
});

export async function listAssets(userId: string): Promise<Asset[]> {
  return (await all<AssetRow>("SELECT * FROM assets WHERE user_id = ? ORDER BY created_at DESC", [userId])).map(toAsset);
}

export async function insertAssets(userId: string, assets: Asset[]): Promise<void> {
  await batch(
    assets.map((a) => ({
      sql: `INSERT INTO assets (id, user_id, project_id, run_id, provider, model_id, kind, prompt, negative_prompt, settings, media, media_refs, seed, url, local_file, thumb_file, width, height, duration, cost_credits, cost_usd, favorite, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        a.id, userId, a.projectId, a.runId, a.provider, a.modelId, a.kind, a.prompt, a.negativePrompt ?? null, j(a.settings), j(a.media),
        a.mediaRefs ? j(a.mediaRefs) : null, a.seed ?? null, a.url, a.localFile ?? null, a.thumbFile ?? null, a.width ?? null, a.height ?? null,
        a.duration ?? null, a.costCredits ?? null, a.costUsd ?? null, a.favorite, a.createdAt,
      ] as InValue[],
    })),
  );
}

export async function updateAssets(userId: string, ids: string[], patch: Partial<Pick<Asset, "favorite" | "projectId" | "width" | "height" | "localFile" | "thumbFile">>): Promise<void> {
  if (ids.length === 0) return;
  // Moving between projects also moves the files on disk.
  if (patch.projectId !== undefined) {
    const folder = await projectFolder(userId, patch.projectId);
    const q = ids.map(() => "?").join(",");
    const rows = await all<{ id: string; local_file: string | null }>(`SELECT id, local_file FROM assets WHERE user_id = ? AND id IN (${q})`, [userId, ...ids]);
    for (const a of rows) {
      const local = a.local_file ? await moveFile("media", a.local_file, folder) : null;
      await run("UPDATE assets SET local_file = ?, thumb_file = NULL WHERE id = ?", [local, a.id]);
    }
  }
  const sets: string[] = [];
  const args: InValue[] = [];
  if (patch.favorite !== undefined) { sets.push("favorite = ?"); args.push(patch.favorite); }
  if (patch.projectId !== undefined) { sets.push("project_id = ?"); args.push(patch.projectId); }
  if (patch.width !== undefined) { sets.push("width = ?"); args.push(patch.width); }
  if (patch.height !== undefined) { sets.push("height = ?"); args.push(patch.height); }
  if (patch.localFile !== undefined) { sets.push("local_file = ?"); args.push(patch.localFile); }
  if (patch.thumbFile !== undefined) { sets.push("thumb_file = ?"); args.push(patch.thumbFile); }
  if (sets.length === 0) return;
  await run(`UPDATE assets SET ${sets.join(", ")} WHERE user_id = ? AND id IN (${ids.map(() => "?").join(",")})`, [...args, userId, ...ids]);
}

export async function deleteAssets(userId: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const q = ids.map(() => "?").join(",");
  const rows = await all<{ local_file: string | null }>(`SELECT local_file FROM assets WHERE user_id = ? AND id IN (${q})`, [userId, ...ids]);
  await run(`DELETE FROM assets WHERE user_id = ? AND id IN (${q})`, [userId, ...ids]);
  await Promise.all(rows.map((r) => removeFile("media", r.local_file)));
}

/** Drop the oldest non-favorite assets beyond HISTORY_CAP. Returns removed ids. */
export async function enforceCap(userId: string): Promise<string[]> {
  const rows = await all<{ id: string }>("SELECT id FROM assets WHERE user_id = ? AND favorite = 0 ORDER BY created_at DESC LIMIT -1 OFFSET ?", [userId, HISTORY_CAP]);
  const ids = rows.map((r) => r.id);
  await deleteAssets(userId, ids);
  return ids;
}

// ───────────────────────── Runs ─────────────────────────

type RunRow = {
  id: string; project_id: string; provider: string; model_id: string; kind: string; input: string; media_refs: string | null; count: number;
  job_id: string | null; status: string; progress: number | null; error: string | null; error_code: string | null; created_at: number; updated_at: number;
};

const toRun = (r: RunRow): Run => ({
  id: r.id,
  projectId: r.project_id,
  provider: r.provider as ProviderId,
  modelId: r.model_id,
  kind: r.kind as MediaKind,
  input: p<GenerateInput>(r.input, { modelId: r.model_id, prompt: "", media: {}, settings: {} }),
  mediaRefs: r.media_refs ? p<MediaRefs>(r.media_refs, {}) : undefined,
  count: Number(r.count),
  jobId: str(r.job_id),
  status: r.status as Run["status"],
  progress: num(r.progress),
  error: str(r.error),
  errorCode: str(r.error_code) as FailureCode | undefined,
  createdAt: Number(r.created_at),
  updatedAt: Number(r.updated_at),
});

export async function listRuns(userId: string): Promise<Run[]> {
  return (await all<RunRow>("SELECT * FROM runs WHERE user_id = ? ORDER BY created_at DESC", [userId])).map(toRun);
}

export async function getRun(userId: string, id: string): Promise<Run | null> {
  const r = await one<RunRow>("SELECT * FROM runs WHERE user_id = ? AND id = ?", [userId, id]);
  return r ? toRun(r) : null;
}

export async function putRun(userId: string, r: Run): Promise<void> {
  await run(
    `INSERT INTO runs (id, user_id, project_id, provider, model_id, kind, input, media_refs, count, job_id, status, progress, error, error_code, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET job_id = excluded.job_id, status = excluded.status, progress = excluded.progress, error = excluded.error, error_code = excluded.error_code, updated_at = excluded.updated_at`,
    [
      r.id, userId, r.projectId, r.provider, r.modelId, r.kind, j(r.input), r.mediaRefs ? j(r.mediaRefs) : null, r.count, r.jobId ?? null, r.status,
      r.progress ?? null, r.error ?? null, r.errorCode ?? null, r.createdAt, r.updatedAt,
    ],
  );
}

export async function deleteRun(userId: string, id: string): Promise<void> {
  await run("DELETE FROM runs WHERE user_id = ? AND id = ?", [userId, id]);
}

// ───────────────────────── Uploads ─────────────────────────

type UploadRow = {
  id: string; project_id: string; kind: string; name: string; type: string; size: number; file: string; width: number | null; height: number | null;
  duration: number | null; remotes: string; created_at: number;
};

const toUpload = (r: UploadRow): Upload => ({
  id: r.id,
  projectId: r.project_id,
  kind: r.kind as MediaKind,
  name: r.name,
  type: r.type,
  size: Number(r.size),
  file: r.file,
  width: num(r.width),
  height: num(r.height),
  duration: num(r.duration),
  remotes: p<Upload["remotes"]>(r.remotes, {}),
  createdAt: Number(r.created_at),
});

export async function listUploads(userId: string): Promise<Upload[]> {
  return (await all<UploadRow>("SELECT * FROM uploads WHERE user_id = ? ORDER BY created_at DESC", [userId])).map(toUpload);
}

export async function getUpload(userId: string, id: string): Promise<Upload | null> {
  const r = await one<UploadRow>("SELECT * FROM uploads WHERE user_id = ? AND id = ?", [userId, id]);
  return r ? toUpload(r) : null;
}

export async function insertUpload(userId: string, u: Upload): Promise<void> {
  await run(
    "INSERT INTO uploads (id, user_id, project_id, kind, name, type, size, file, width, height, duration, remotes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [u.id, userId, u.projectId, u.kind, u.name, u.type, u.size, u.file, u.width ?? null, u.height ?? null, u.duration ?? null, j(u.remotes), u.createdAt],
  );
}

export async function setUploadRemote(userId: string, id: string, provider: ProviderId, remote: { url: string; expiresAt: number }): Promise<Upload | null> {
  const u = await getUpload(userId, id);
  if (!u) return null;
  const remotes = { ...u.remotes, [provider]: remote };
  await run("UPDATE uploads SET remotes = ? WHERE user_id = ? AND id = ?", [j(remotes), userId, id]);
  return { ...u, remotes };
}

export async function deleteUpload(userId: string, id: string): Promise<void> {
  const u = await getUpload(userId, id);
  await run("DELETE FROM uploads WHERE user_id = ? AND id = ?", [userId, id]);
  if (u) await removeFile("uploads", u.file);
}

// ───────────────────────── Prompt history ─────────────────────────

const PROMPT_CAP = 50;

export async function listPrompts(userId: string): Promise<PromptEntry[]> {
  const rows = await all<{ text: string; last_used_at: number; uses: number }>("SELECT text, last_used_at, uses FROM prompts WHERE user_id = ? ORDER BY last_used_at DESC LIMIT ?", [userId, PROMPT_CAP]);
  return rows.map((r) => ({ text: r.text, lastUsedAt: Number(r.last_used_at), uses: Number(r.uses) }));
}

export async function rememberPrompt(userId: string, text: string): Promise<void> {
  const t = text.trim();
  if (!t) return;
  await run(
    "INSERT INTO prompts (user_id, text, last_used_at, uses) VALUES (?, ?, ?, 1) ON CONFLICT(user_id, text) DO UPDATE SET last_used_at = excluded.last_used_at, uses = uses + 1",
    [userId, t, Date.now()],
  );
  await run("DELETE FROM prompts WHERE user_id = ? AND text NOT IN (SELECT text FROM prompts WHERE user_id = ? ORDER BY last_used_at DESC LIMIT ?)", [userId, userId, PROMPT_CAP]);
}

export async function forgetPrompt(userId: string, text: string): Promise<void> {
  await run("DELETE FROM prompts WHERE user_id = ? AND text = ?", [userId, text]);
}

// ───────────────────────── Settings ─────────────────────────

export async function getSetting(userId: string, key: string): Promise<string | null> {
  const r = await one<{ value: string }>("SELECT value FROM settings WHERE user_id = ? AND key = ?", [userId, key]);
  return r?.value ?? null;
}

export async function setSetting(userId: string, key: string, value: string): Promise<void> {
  await run("INSERT INTO settings (user_id, key, value) VALUES (?, ?, ?) ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value", [userId, key, value]);
}
