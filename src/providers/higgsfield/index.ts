import { ProviderError, type GenerateInput, type JobStatus, type KeyCheck, type Output, type PriceEstimate, type Provider } from "../types";
import { errorDetail, httpFailure, isRecord, requestJson } from "../http";
import { resolveSettings, ratioToDims, renderRefTags } from "../catalog-utils";
import { HIGGSFIELD_CATALOG, type HiggsfieldEntry } from "./catalog";

export const HF_BASE = "https://api.higgsfield.ai";

const DAY = 24 * 60 * 60 * 1000;

function authHeaders(key: string): Record<string, string> {
  return { Authorization: `Key ${key}` };
}

function entry(modelId: string): HiggsfieldEntry {
  const e = HIGGSFIELD_CATALOG.find((x) => x.id === modelId);
  if (!e) throw new ProviderError(`Unknown Higgsfield model "${modelId}".`);
  return e;
}

/** Public so unit tests can assert the exact body without the network. */
export function buildHiggsfieldRequest(input: GenerateInput): { path: string; body: Record<string, unknown> } {
  const e = entry(input.modelId);
  const settings = resolveSettings(e, input.settings);
  const count = e.batch.native ? Math.max(1, Math.min(e.batch.max, input.count ?? 1)) : 1;
  const prompt = renderRefTags(input.prompt, e.promptRefs);
  return { path: `/${e.id}`, body: e.body({ ...input, prompt }, settings, count) };
}

type RequestStatus = {
  status?: "queued" | "in_progress" | "completed" | "failed" | "nsfw" | "canceled" | string;
  request_id?: string;
  error?: string | null;
  images?: { url?: string }[];
  video?: { url?: string };
};

export function normalizeHiggsfieldStatus(r: RequestStatus, input: GenerateInput): JobStatus {
  const e = entry(input.modelId);
  switch (r.status) {
    case "queued":
      return { state: "queued" };
    case "in_progress":
      return { state: "running" };
    case "completed": {
      const settings = resolveSettings(e, input.settings);
      const dims = ratioToDims(typeof settings.aspect_ratio === "string" ? settings.aspect_ratio : undefined);
      const duration = e.kind === "video" && settings.duration !== undefined ? Number(settings.duration) : undefined;
      const outputs: Output[] = [];
      if (e.kind === "image" && Array.isArray(r.images)) {
        for (const im of r.images) {
          if (isRecord(im) && typeof im.url === "string") outputs.push({ url: im.url, kind: "image", ...(dims ?? {}) });
        }
      } else if (e.kind === "video" && isRecord(r.video) && typeof r.video.url === "string") {
        outputs.push({ url: r.video.url, kind: "video", ...(dims ?? {}), ...(duration ? { duration } : {}) });
      }
      if (outputs.length === 0) return { state: "failed", reason: "Higgsfield completed without media." };
      return { state: "done", outputs };
    }
    case "failed":
      return { state: "failed", reason: r.error || "Generation failed.", code: "unknown" };
    case "nsfw":
      return { state: "failed", reason: r.error || "Rejected by content moderation.", code: "nsfw" };
    case "canceled":
      return { state: "failed", reason: "Canceled.", code: "canceled" };
    default:
      return { state: "queued" };
  }
}

export const higgsfield: Provider = {
  id: "higgsfield",
  label: "Higgsfield",
  auth: {
    placeholder: "key_id:key_secret",
    pattern: /^[^:\s]+:[^:\s]+$/,
    describeHeader: "Authorization: Key id:secret",
    // Referral links — see the disclosure in README.md.
    consoleUrl: "https://gotolink.cc/hgapi",
    rechargeUrl: "https://gotolink.cc/hgapi",
  },
  catalog: HIGGSFIELD_CATALOG,
  retentionMs: 7 * DAY,
  uploads: "provider",

  async submit(input, key) {
    const { path, body } = buildHiggsfieldRequest(input);
    const res = await requestJson<{ request_id?: string; status?: string; detail?: unknown }>(`${HF_BASE}${path}`, {
      method: "POST",
      headers: authHeaders(key),
      body,
    });
    if (!res.ok || !res.data?.request_id) throw httpFailure(res.status, errorDetail(res.data, res.text));
    return { jobId: res.data.request_id };
  },

  async poll(jobId, key, input) {
    const res = await requestJson<RequestStatus>(`${HF_BASE}/requests/${encodeURIComponent(jobId)}/status`, {
      headers: authHeaders(key),
    });
    if (!res.ok || !res.data) throw httpFailure(res.status, errorDetail(res.data, res.text));
    return normalizeHiggsfieldStatus(res.data, input);
  },

  async cancel(jobId, key) {
    await requestJson(`${HF_BASE}/requests/${encodeURIComponent(jobId)}/cancel`, { method: "POST", headers: authHeaders(key) });
  },

  /** POST /estimate/{endpoint} with the real body → { credits, usd }. Free and side-effect free. */
  async estimate(input, key): Promise<PriceEstimate | null> {
    const { path, body } = buildHiggsfieldRequest(input);
    const res = await requestJson<{ credits?: string | number; usd?: string | number }>(`${HF_BASE}/estimate${path}`, {
      method: "POST",
      headers: authHeaders(key),
      body,
    });
    if (!res.ok || !res.data) return null;
    const usd = Number(res.data.usd);
    const credits = Number(res.data.credits);
    if (!Number.isFinite(usd)) return null;
    return { usd, ...(Number.isFinite(credits) ? { credits } : {}) };
  },

  async validateKey(key): Promise<KeyCheck> {
    // The estimate endpoint is authenticated, free, and side-effect free.
    const res = await requestJson<unknown>(`${HF_BASE}/estimate/higgsfield-ai/soul/v2/standard`, {
      method: "POST",
      headers: authHeaders(key),
      body: { prompt: "key check" },
    });
    if (res.status === 401 || res.status === 403) return { ok: false, status: res.status, reason: errorDetail(res.data, res.text) };
    if (res.ok || res.status === 400 || res.status === 422) return { ok: true };
    return { ok: false, status: res.status, reason: errorDetail(res.data, res.text) };
  },
};
