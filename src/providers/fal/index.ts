import { ProviderError, type Balance, type GenerateInput, type JobStatus, type KeyCheck, type Output, type Provider } from "../types";
import { errorDetail, httpFailure, isRecord, requestJson } from "../http";
import { resolveSettings, renderRefTags } from "../catalog-utils";
import { FAL_CATALOG, type FalEntry } from "./catalog";

export const FAL_QUEUE = "https://queue.fal.run";
export const FAL_API = "https://api.fal.ai";

const DAY = 24 * 60 * 60 * 1000;

function authHeaders(key: string): Record<string, string> {
  return { Authorization: `Key ${key}` };
}

function entry(modelId: string): FalEntry {
  const e = FAL_CATALOG.find((x) => x.id === modelId);
  if (!e) throw new ProviderError(`Unknown FAL model "${modelId}".`);
  return e;
}

/** Public so unit tests can assert the exact body without the network. */
export function buildFalRequest(input: GenerateInput): { path: string; body: Record<string, unknown> } {
  const e = entry(input.modelId);
  const settings = resolveSettings(e, input.settings);
  const count = e.batch.native ? Math.max(1, Math.min(e.batch.max, input.count ?? 1)) : 1;
  const prompt = renderRefTags(input.prompt, e.promptRefs);
  return { path: `/${e.id}`, body: e.body({ ...input, prompt }, settings, count) };
}

/**
 * Job ids are "<requests base path>|<request_id>" so poll can use the exact
 * status/response URLs FAL returned on submit (the base path is the app
 * alias, which can differ from the full model id).
 */
export function encodeFalJobId(statusUrl: string, requestId: string): string {
  const base = statusUrl.replace(/^https?:\/\/[^/]+/, "").replace(/\/requests\/.*$/, "");
  return `${base}|${requestId}`;
}
export function decodeFalJobId(jobId: string): { base: string; requestId: string } {
  const i = jobId.lastIndexOf("|");
  if (i < 0) throw new ProviderError("Malformed FAL job id.");
  return { base: jobId.slice(0, i), requestId: jobId.slice(i + 1) };
}

type QueueStatus = {
  status?: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | string;
  queue_position?: number;
  response_url?: string;
};

type FalFile = { url?: string; width?: number | null; height?: number | null; content_type?: string | null };

function toOutputs(result: unknown, kind: "image" | "video"): Output[] {
  if (!isRecord(result)) return [];
  if (kind === "image" && Array.isArray(result.images)) {
    return result.images
      .filter((f): f is FalFile => isRecord(f) && typeof f.url === "string")
      .map((f) => ({
        url: f.url as string,
        kind,
        ...(typeof f.width === "number" ? { width: f.width } : {}),
        ...(typeof f.height === "number" ? { height: f.height } : {}),
      }));
  }
  if (kind === "video" && isRecord(result.video) && typeof result.video.url === "string") {
    return [{ url: result.video.url, kind }];
  }
  return [];
}

const NSFW_RX = /nsfw|safety|moderat|content policy|flagged/i;

export function normalizeFalResult(result: unknown, kind: "image" | "video"): JobStatus {
  const outputs = toOutputs(result, kind);
  if (outputs.length === 0) return { state: "failed", reason: "FAL returned no media." };
  if (isRecord(result) && Array.isArray(result.has_nsfw_concepts) && result.has_nsfw_concepts.every((x) => x === true)) {
    return { state: "failed", reason: "Every output was flagged by the safety checker.", code: "nsfw" };
  }
  return { state: "done", outputs };
}

export const fal: Provider = {
  id: "fal",
  label: "FAL",
  auth: {
    placeholder: "key_id:key_secret",
    describeHeader: "Authorization: Key <key>",
    // Referral links — see the disclosure in README.md.
    consoleUrl: "https://gotolink.cc/fal",
    rechargeUrl: "https://gotolink.cc/fal",
  },
  catalog: FAL_CATALOG,
  retentionMs: 7 * DAY,
  uploads: "provider",

  async submit(input, key) {
    const { path, body } = buildFalRequest(input);
    const res = await requestJson<{ request_id?: string; status_url?: string; detail?: unknown }>(`${FAL_QUEUE}${path}`, {
      method: "POST",
      headers: authHeaders(key),
      body,
    });
    if (!res.ok || !res.data?.request_id || !res.data.status_url) {
      throw httpFailure(res.status, errorDetail(res.data, res.text));
    }
    return { jobId: encodeFalJobId(res.data.status_url, res.data.request_id) };
  },

  async poll(jobId, key, input) {
    const e = entry(input.modelId);
    const { base, requestId } = decodeFalJobId(jobId);
    const st = await requestJson<QueueStatus>(`${FAL_QUEUE}${base}/requests/${requestId}/status`, { headers: authHeaders(key) });
    if (!st.ok || !st.data) throw httpFailure(st.status, errorDetail(st.data, st.text));
    if (st.data.status === "IN_QUEUE") return { state: "queued" };
    if (st.data.status === "IN_PROGRESS") return { state: "running" };
    if (st.data.status !== "COMPLETED") return { state: "queued" };

    const rs = await requestJson<unknown>(`${FAL_QUEUE}${base}/requests/${requestId}`, { headers: authHeaders(key) });
    if (!rs.ok) {
      const detail = errorDetail(rs.data, rs.text);
      if (NSFW_RX.test(detail)) return { state: "failed", reason: detail, code: "nsfw" };
      if (rs.status === 422 || rs.status === 400) return { state: "failed", reason: `FAL rejected the request: ${detail}` };
      throw httpFailure(rs.status, detail);
    }
    return normalizeFalResult(rs.data, e.kind);
  },

  async cancel(jobId, key) {
    const { base, requestId } = decodeFalJobId(jobId);
    await requestJson(`${FAL_QUEUE}${base}/requests/${requestId}/cancel`, { method: "PUT", headers: authHeaders(key) });
  },

  /** Dashboard endpoint; returns the USD balance. Not formally documented, so any odd shape yields null. */
  async balance(key): Promise<Balance | null> {
    const res = await requestJson<unknown>("https://rest.alpha.fal.ai/billing/user_balance", { headers: authHeaders(key) });
    if (!res.ok) return null;
    const d = res.data;
    const n = typeof d === "number" ? d : isRecord(d) && typeof d.balance === "number" ? d.balance : isRecord(d) && typeof d.user_balance === "number" ? d.user_balance : null;
    return n === null ? null : { usd: n };
  },

  async validateKey(key): Promise<KeyCheck> {
    const res = await requestJson<unknown>(`${FAL_API}/v1/models?limit=1`, { headers: authHeaders(key) });
    if (res.ok) return { ok: true };
    return { ok: false, status: res.status, reason: errorDetail(res.data, res.text) };
  },
};
