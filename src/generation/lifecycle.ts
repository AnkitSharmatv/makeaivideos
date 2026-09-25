/**
 * Client-side run lifecycle: submit → poll → completeRun (server writes the
 * assets and keeps local copies). Runs persist server-side so a reload resumes.
 */
import type { MediaRefs, Run } from "@/db/types";
import { findModel, modelKey } from "@/providers";
import type { GenerateInput, ModelSpec } from "@/providers/types";
import { submitJob, pollJob, cancelJob, completeRun } from "./actions";
import { saveRun, removeRun } from "@/data/actions";
import { useLibraryStore } from "@/stores/library";
import { useProjectsStore } from "@/stores/projects";
import { usePromptsStore } from "@/stores/prompts";
import { useKeysStore } from "@/stores/keys";
import { recordObservedCost } from "./pricing";

const POLL_MS = 4_000;
const MAX_BACKOFF_MS = 60_000;
const DEADLINE_MS = 10 * 60_000;

const loops = new Map<string, { stop: boolean }>();

function newId(): string {
  return crypto.randomUUID();
}

async function persist(run: Run): Promise<void> {
  useLibraryStore.getState().upsertRun(run);
  await saveRun(run);
}

async function finish(run: Run): Promise<void> {
  useLibraryStore.getState().removeRun(run.id);
  await removeRun(run.id);
}

function failRun(run: Run, reason: string, code?: Run["errorCode"]): Promise<void> {
  return persist({ ...run, status: "failed", error: reason, errorCode: code, updatedAt: Date.now() });
}

async function pollLoop(run: Run): Promise<void> {
  const handle = { stop: false };
  loops.set(run.id, handle);
  let delay = POLL_MS;
  const started = Date.now();
  let current = run;
  try {
    while (!handle.stop) {
      await new Promise((r) => setTimeout(r, delay));
      if (handle.stop) return;
      if (Date.now() - started > DEADLINE_MS) {
        await failRun(current, "Timed out after 10 minutes. The provider may still finish it; check their dashboard.");
        return;
      }
      if (!current.jobId) return;
      const status = await pollJob(current.provider, current.jobId, current.input);
      if (handle.stop) return;
      if (status.state === "transient") {
        delay = Math.min(MAX_BACKOFF_MS, Math.max(status.retryAfterMs ?? 0, delay * 2));
        continue;
      }
      delay = POLL_MS;
      if (status.state === "queued") {
        if (current.status !== "queued") current = { ...current, status: "queued", updatedAt: Date.now() };
        useLibraryStore.getState().upsertRun(current);
        continue;
      }
      if (status.state === "running") {
        current = { ...current, status: "running", progress: status.progress, updatedAt: Date.now() };
        useLibraryStore.getState().upsertRun(current);
        continue;
      }
      if (status.state === "failed") {
        await failRun(current, status.reason, status.code);
        return;
      }
      if (status.state !== "done") continue;
      current = { ...current, status: "running", progress: 1, updatedAt: Date.now() };
      useLibraryStore.getState().upsertRun(current);
      const { assets, dropped } = await completeRun(current.id, status.outputs, status.cost);
      if (status.cost) recordObservedCost(current, status.cost);
      useLibraryStore.getState().addAssets(assets, dropped);
      useLibraryStore.getState().removeRun(current.id);
      useProjectsStore.getState().touch(current.projectId);
      void useKeysStore.getState().refreshBalance(current.provider);
      return;
    }
  } catch (err) {
    await failRun(current, err instanceof Error ? err.message : "Polling failed.");
  } finally {
    loops.delete(run.id);
  }
}

async function submitAndPoll(run: Run): Promise<void> {
  const res = await submitJob(run.provider, run.input);
  if (!res.ok) {
    await failRun(run, res.reason, res.code);
    return;
  }
  const next: Run = { ...run, jobId: res.jobId, status: "queued", updatedAt: Date.now() };
  await persist(next);
  void pollLoop(next);
}

export type StartParams = {
  model: ModelSpec;
  projectId: string;
  prompt: string;
  negativePrompt?: string;
  seed?: number;
  media: GenerateInput["media"];
  mediaRefs?: MediaRefs;
  settings: GenerateInput["settings"];
  batch: number;
};

/** Creates N skeleton runs immediately and submits them. */
export async function startRuns(p: StartParams): Promise<Run[]> {
  const now = Date.now();
  const native = p.model.batch.native;
  const count = Math.max(1, Math.min(p.model.batch.max, p.batch));
  const jobs = native ? 1 : count;
  const base: Omit<GenerateInput, "count"> = {
    modelId: p.model.id,
    prompt: p.prompt,
    negativePrompt: p.negativePrompt || undefined,
    seed: p.seed,
    media: p.media,
    settings: p.settings,
  };
  const runs: Run[] = [];
  for (let i = 0; i < jobs; i++) {
    const input: GenerateInput = native ? { ...base, count } : { ...base };
    // Distinct seeds per job when the user pinned one and asked for several.
    if (!native && p.seed !== undefined && jobs > 1) input.seed = p.seed + i;
    runs.push({
      id: newId(),
      projectId: p.projectId,
      provider: p.model.provider,
      modelId: p.model.id,
      kind: p.model.kind,
      input,
      mediaRefs: p.mediaRefs,
      count: native ? count : 1,
      status: "queued",
      createdAt: now + i,
      updatedAt: now + i,
    });
  }
  await Promise.all(runs.map(persist));
  usePromptsStore.getState().remember(p.prompt);
  for (const run of runs) void submitAndPoll(run);
  return runs;
}

/** Re-submit a failed run with the same input. */
export async function retryRun(run: Run): Promise<void> {
  const fresh: Run = { ...run, id: newId(), jobId: undefined, status: "queued", error: undefined, errorCode: undefined, progress: undefined, createdAt: Date.now(), updatedAt: Date.now() };
  await dismissRun(run);
  await persist(fresh);
  void submitAndPoll(fresh);
}

export async function dismissRun(run: Run): Promise<void> {
  const loop = loops.get(run.id);
  if (loop) loop.stop = true;
  if (run.jobId && run.status !== "failed") void cancelJob(run.provider, run.jobId);
  await finish(run);
}

/** Called once after the library loads: resume polling for anything still in flight. */
export function resumeRuns(runs: Run[]): void {
  for (const run of runs) {
    if (run.status === "failed") continue;
    if (loops.has(run.id)) continue;
    if (!run.jobId) {
      void failRun(run, "Interrupted before the provider accepted it.");
      continue;
    }
    if (!findModel(`${run.provider}:${run.modelId}`)) {
      void failRun(run, "Model no longer in the catalog.");
      continue;
    }
    void pollLoop(run);
  }
}

export { modelKey };
