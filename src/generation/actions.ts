"use server";

import { getProvider } from "@/providers";
import { requireUser } from "@/server/auth";
import { getProviderKey } from "@/server/keys";
import * as repo from "@/server/repo";
import { newId } from "@/server/db";
import { archiveFromUrl, imageDims, slug, stamp } from "@/server/files";
import { ProviderError, isProviderId, type GenerateInput, type JobStatus, type FailureCode, type PriceEstimate, type Output, type JobCost } from "@/providers/types";
import type { Asset, Run } from "@/db/types";

export type SubmitResult = { ok: true; jobId: string } | { ok: false; reason: string; code: FailureCode; retryAfterMs?: number };

function failure(err: unknown): { ok: false; reason: string; code: FailureCode; retryAfterMs?: number } {
  if (err instanceof ProviderError) return { ok: false, reason: err.message, code: err.code, retryAfterMs: err.retryAfterMs };
  return { ok: false, reason: err instanceof Error ? err.message : "Unexpected error.", code: "unknown" };
}

function sanitizeInput(raw: GenerateInput): GenerateInput {
  const media: GenerateInput["media"] = {};
  for (const [role, list] of Object.entries(raw.media ?? {})) {
    if (!Array.isArray(list)) continue;
    const clean = list.filter((u): u is string => typeof u === "string" && /^https?:\/\//.test(u)).slice(0, 20);
    if (clean.length) (media as Record<string, string[]>)[role] = clean;
  }
  const settings: GenerateInput["settings"] = {};
  for (const [k, v] of Object.entries(raw.settings ?? {})) {
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") settings[k] = v;
  }
  return {
    modelId: String(raw.modelId ?? ""),
    prompt: String(raw.prompt ?? "").slice(0, 20_000),
    negativePrompt: raw.negativePrompt ? String(raw.negativePrompt).slice(0, 5_000) : undefined,
    media,
    settings,
    seed: typeof raw.seed === "number" && Number.isFinite(raw.seed) ? Math.floor(raw.seed) : undefined,
    count: typeof raw.count === "number" ? Math.max(1, Math.min(6, Math.floor(raw.count))) : undefined,
  };
}

export async function submitJob(providerId: string, rawInput: GenerateInput): Promise<SubmitResult> {
  const user = await requireUser();
  if (!isProviderId(providerId)) return { ok: false, reason: "Unknown provider.", code: "unknown" };
  const key = await getProviderKey(user.id, providerId);
  if (!key) return { ok: false, reason: "No key saved for this provider.", code: "auth" };
  const provider = getProvider(providerId);
  const input = sanitizeInput(rawInput);
  if (!provider.catalog.some((m) => m.id === input.modelId)) return { ok: false, reason: "Unknown model.", code: "unknown" };
  if (!input.prompt.trim()) return { ok: false, reason: "Prompt is empty.", code: "unknown" };
  try {
    const { jobId } = await provider.submit(input, key);
    return { ok: true, jobId };
  } catch (err) {
    return failure(err);
  }
}

/** A poll either yields a JobStatus or a transient error the client should retry with backoff. */
export type PollResult = JobStatus | { state: "transient"; reason: string; retryAfterMs?: number };

export async function pollJob(providerId: string, jobId: string, rawInput: GenerateInput): Promise<PollResult> {
  const user = await requireUser();
  if (!isProviderId(providerId)) return { state: "failed", reason: "Unknown provider.", code: "unknown" };
  const key = await getProviderKey(user.id, providerId);
  if (!key) return { state: "failed", reason: "The key for this provider was removed.", code: "auth" };
  const provider = getProvider(providerId);
  try {
    return await provider.poll(jobId, key, sanitizeInput(rawInput));
  } catch (err) {
    const f = failure(err);
    const status = err instanceof ProviderError ? err.status : undefined;
    // Network errors, 5xx and 429 are transient; 4xx (other than 429) are final.
    const transient = status === undefined || status >= 500 || status === 429;
    if (transient) return { state: "transient", reason: f.reason, retryAfterMs: f.retryAfterMs };
    return { state: "failed", reason: f.reason, code: f.code };
  }
}

export async function cancelJob(providerId: string, jobId: string): Promise<void> {
  const user = await requireUser();
  if (!isProviderId(providerId)) return;
  const key = await getProviderKey(user.id, providerId);
  if (!key) return;
  const provider = getProvider(providerId);
  if (!provider.cancel) return;
  try {
    await provider.cancel(jobId, key);
  } catch {
    /* best-effort */
  }
}

/** Live quote for providers that offer one (Higgsfield). Null when unsupported or unavailable. */
export async function estimateJob(providerId: string, rawInput: GenerateInput): Promise<PriceEstimate | null> {
  const user = await requireUser();
  if (!isProviderId(providerId)) return null;
  const provider = getProvider(providerId);
  if (!provider.estimate) return null;
  const key = await getProviderKey(user.id, providerId);
  if (!key) return null;
  try {
    return await provider.estimate(sanitizeInput(rawInput), key);
  } catch {
    return null;
  }
}

/**
 * A run finished: turn its outputs into assets, keep a local copy of each
 * file (when enabled), drop the run row, and enforce the history cap.
 */
export async function completeRun(runId: string, outputs: Output[], cost?: JobCost): Promise<{ assets: Asset[]; dropped: string[] }> {
  const user = await requireUser();
  const run = await repo.getRun(user.id, runId);
  if (!run) return { assets: [], dropped: [] };
  const keepLocal = (await repo.getSetting(user.id, "keepLocalCopy")) !== "false";
  const folder = await repo.projectFolder(user.id, run.projectId);
  const now = Date.now();
  const assets: Asset[] = [];
  for (const [i, o] of outputs.entries()) {
    const id = newId();
    let localFile: string | undefined;
    let width = o.width;
    let height = o.height;
    if (keepLocal) {
      // e.g. "First Project/2026-09-20_1902_gpt-image-2-5-sunburst_9051312c.png"
      const base = `${stamp(now)}_${slug(run.modelId)}_${id.slice(0, 8)}`;
      const stored = await archiveFromUrl(o.url, folder, base, o.kind);
      if (stored) {
        localFile = stored.rel;
        if (o.kind === "image") {
          const d = await imageDims("media", stored.rel);
          if (d) ({ width, height } = d);
        }
      }
    }
    assets.push({
      id,
      projectId: run.projectId,
      runId: run.id,
      provider: run.provider,
      modelId: run.modelId,
      kind: o.kind,
      prompt: run.input.prompt,
      negativePrompt: run.input.negativePrompt,
      settings: run.input.settings,
      media: run.input.media,
      mediaRefs: run.mediaRefs,
      seed: run.input.seed,
      url: o.url,
      localFile,
      width,
      height,
      duration: o.duration,
      costCredits: cost?.credits,
      costUsd: cost?.usd,
      favorite: 0,
      createdAt: now + i,
    });
  }
  await repo.insertAssets(user.id, assets);
  await repo.deleteRun(user.id, run.id);
  await repo.touchProject(user.id, run.projectId);
  const dropped = await repo.enforceCap(user.id);
  return { assets, dropped };
}

export type { Run };
