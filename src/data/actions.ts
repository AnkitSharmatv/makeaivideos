"use server";

import type { Asset, Project, PromptEntry, Run, Upload } from "@/db/types";
import { requireUser } from "@/server/auth";
import * as repo from "@/server/repo";
import { newId } from "@/server/db";
import { isProviderId, type ProviderId } from "@/providers/types";
import { getProviderKey } from "@/server/keys";
import { uploadBackend } from "@/uploads";
import { readBuffer } from "@/server/files";

// ───────────────────────── Bootstrap ─────────────────────────

export type Snapshot = {
  projects: Project[];
  assets: Asset[];
  runs: Run[];
  uploads: Upload[];
  prompts: PromptEntry[];
  settings: Record<string, string>;
  /** Model keys the user has switched off. Everything else is on. */
  disabledModels: string[];
};

export async function loadSnapshot(): Promise<Snapshot> {
  const user = await requireUser();
  await repo.migrateFlatFiles(user.id);
  const [projects, assets, runs, uploads, prompts, keep, disabled] = await Promise.all([
    repo.listProjects(user.id),
    repo.listAssets(user.id),
    repo.listRuns(user.id),
    repo.listUploads(user.id),
    repo.listPrompts(user.id),
    repo.getSetting(user.id, "keepLocalCopy"),
    repo.getSetting(user.id, "disabledModels"),
  ]);
  let disabledModels: string[] = [];
  try {
    const parsed: unknown = disabled ? JSON.parse(disabled) : [];
    if (Array.isArray(parsed)) disabledModels = parsed.filter((x): x is string => typeof x === "string");
  } catch {
    disabledModels = [];
  }
  return { projects, assets, runs, uploads, prompts, settings: { keepLocalCopy: keep ?? "true" }, disabledModels };
}

/** Replaces the whole disabled set; everything not listed is available. */
export async function saveDisabledModels(keys: string[]): Promise<void> {
  const user = await requireUser();
  const clean = [...new Set(keys.filter((k) => typeof k === "string" && k.length < 200))].slice(0, 2000);
  await repo.setSetting(user.id, "disabledModels", JSON.stringify(clean));
}

// ───────────────────────── Projects ─────────────────────────

export async function createProject(name: string): Promise<Project> {
  const user = await requireUser();
  const now = Date.now();
  const project: Project = { id: newId(), name: name.trim().slice(0, 80) || "Untitled project", createdAt: now, updatedAt: now };
  await repo.insertProject(user.id, project);
  return project;
}

export async function renameProject(id: string, name: string): Promise<Project | null> {
  const user = await requireUser();
  return repo.renameProject(user.id, id, name.trim().slice(0, 80) || "Untitled project");
}

export async function touchProject(id: string): Promise<void> {
  const user = await requireUser();
  await repo.touchProject(user.id, id);
}

export async function deleteProject(id: string): Promise<void> {
  const user = await requireUser();
  await repo.deleteProject(user.id, id);
}

// ───────────────────────── Assets ─────────────────────────

export async function deleteAssets(ids: string[]): Promise<void> {
  const user = await requireUser();
  await repo.deleteAssets(user.id, ids);
}

export async function setAssetsFavorite(ids: string[], favorite: boolean): Promise<void> {
  const user = await requireUser();
  await repo.updateAssets(user.id, ids, { favorite: favorite ? 1 : 0 });
}

export async function moveAssets(ids: string[], projectId: string): Promise<void> {
  const user = await requireUser();
  await repo.updateAssets(user.id, ids, { projectId });
}

export async function setAssetDims(id: string, width: number, height: number): Promise<void> {
  const user = await requireUser();
  await repo.updateAssets(user.id, [id], { width, height });
}

// ───────────────────────── Runs ─────────────────────────

export async function saveRun(run: Run): Promise<void> {
  const user = await requireUser();
  await repo.putRun(user.id, run);
}

export async function removeRun(id: string): Promise<void> {
  const user = await requireUser();
  await repo.deleteRun(user.id, id);
}

// ───────────────────────── Uploads ─────────────────────────

export async function deleteUpload(id: string): Promise<void> {
  const user = await requireUser();
  await repo.deleteUpload(user.id, id);
}

/** Push a stored upload to a provider's storage (if no live copy exists) and return the public URL. */
export async function ensureUploadRemote(id: string, providerId: string): Promise<{ ok: true; url: string } | { ok: false; reason: string }> {
  const user = await requireUser();
  if (!isProviderId(providerId)) return { ok: false, reason: "Unknown provider." };
  const u = await repo.getUpload(user.id, id);
  if (!u) return { ok: false, reason: "That upload is no longer in the project." };
  const existing = u.remotes[providerId];
  if (existing && existing.expiresAt > Date.now()) return { ok: true, url: existing.url };
  const key = await getProviderKey(user.id, providerId);
  if (!key) return { ok: false, reason: "No key saved for this provider." };
  const bytes = await readBuffer("uploads", u.file);
  if (!bytes) return { ok: false, reason: "The file is missing from disk." };
  try {
    const remote = await uploadBackend(providerId)(new Blob([new Uint8Array(bytes)], { type: u.type }), u.name, u.type, key);
    await repo.setUploadRemote(user.id, id, providerId, remote);
    return { ok: true, url: remote.url };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "Upload to the provider failed." };
  }
}

// ───────────────────────── Prompts & settings ─────────────────────────

export async function rememberPrompt(text: string): Promise<void> {
  const user = await requireUser();
  await repo.rememberPrompt(user.id, text);
}

export async function forgetPrompt(text: string): Promise<void> {
  const user = await requireUser();
  await repo.forgetPrompt(user.id, text);
}

export async function setKeepLocalCopy(on: boolean): Promise<void> {
  const user = await requireUser();
  await repo.setSetting(user.id, "keepLocalCopy", on ? "true" : "false");
}

export type { ProviderId };
