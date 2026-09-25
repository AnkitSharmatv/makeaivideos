import { ProviderError, type Balance, type GenerateInput, type JobStatus, type KeyCheck, type Output, type Provider } from "../types";
import { errorDetail, isRecord, requestJson } from "../http";
import { resolveSettings, ratioToDims, renderRefTags } from "../catalog-utils";
import { KIE_CATALOG, KIE_CREDIT_USD, type KieEntry } from "./catalog";

export const KIE_BASE = "https://api.kie.ai";

const DAY = 24 * 60 * 60 * 1000;

function authHeaders(key: string): Record<string, string> {
  return { Authorization: `Bearer ${key}` };
}

function entry(modelId: string): KieEntry {
  const e = KIE_CATALOG.find((x) => x.id === modelId);
  if (!e) throw new ProviderError(`Unknown KIE model "${modelId}".`);
  return e;
}

/** KIE wraps every response as { code, msg, data }. HTTP status is often 200 even on errors. */
type Envelope<T> = { code?: number; msg?: string; data?: T };

function envelopeError(httpStatus: number, env: Envelope<unknown> | null, text: string): ProviderError {
  const code = typeof env?.code === "number" ? env.code : httpStatus;
  const msg = env?.msg ?? errorDetail(env, text);
  if (code === 401) return new ProviderError(`Key rejected (401). ${msg}`, "auth", 401);
  if (code === 402) return new ProviderError(`Insufficient KIE credits. ${msg}`, "unknown", 402);
  if (code === 429) return new ProviderError(`Rate limited by KIE. ${msg}`, "rate_limit", 429, 10_000);
  if (code === 422 || code === 400) return new ProviderError(`KIE rejected the request: ${msg}`, "unknown", code);
  return new ProviderError(`KIE error (${code}): ${msg}`, "unknown", code);
}

/** Public so unit tests can assert the exact body without the network. */
export function buildKieRequest(input: GenerateInput): { model: string; input: Record<string, unknown> } {
  const e = entry(input.modelId);
  const settings = resolveSettings(e, input.settings);
  const prompt = renderRefTags(input.prompt, e.promptRefs);
  return { model: e.id, input: e.body({ ...input, prompt }, settings) };
}

type RecordInfo = {
  taskId?: string;
  model?: string;
  state?: "waiting" | "queuing" | "generating" | "success" | "fail" | string;
  resultJson?: string;
  failCode?: string;
  failMsg?: string;
  progress?: number;
  creditsConsumed?: number;
};

const NSFW_RX = /nsfw|sensitive|moderat|content policy|safety|inappropriate|violat/i;

export function normalizeKieStatus(info: RecordInfo, input: GenerateInput): JobStatus {
  const e = entry(input.modelId);
  switch (info.state) {
    case "waiting":
    case "queuing":
      return { state: "queued" };
    case "generating":
      return { state: "running", progress: typeof info.progress === "number" ? info.progress / 100 : undefined };
    case "success": {
      let urlsOut: string[] = [];
      try {
        const parsed: unknown = info.resultJson ? JSON.parse(info.resultJson) : null;
        if (isRecord(parsed) && Array.isArray(parsed.resultUrls)) {
          urlsOut = parsed.resultUrls.filter((u): u is string => typeof u === "string");
        }
      } catch {
        /* fallthrough → empty */
      }
      if (urlsOut.length === 0) return { state: "failed", reason: "KIE reported success but returned no media." };
      const settings = resolveSettings(e, input.settings);
      const ratio = typeof settings.aspect_ratio === "string" ? settings.aspect_ratio : undefined;
      const dims = ratioToDims(ratio);
      const duration = e.kind === "video" && settings.duration !== undefined ? Number(settings.duration) : undefined;
      const outputs: Output[] = urlsOut.map((url) => ({
        url,
        kind: e.kind,
        ...(dims ?? {}),
        ...(duration && Number.isFinite(duration) ? { duration } : {}),
      }));
      const credits = typeof info.creditsConsumed === "number" ? info.creditsConsumed : undefined;
      return { state: "done", outputs, ...(credits !== undefined ? { cost: { credits, usd: credits * KIE_CREDIT_USD } } : {}) };
    }
    case "fail": {
      const reason = info.failMsg || `KIE task failed${info.failCode ? ` (${info.failCode})` : ""}.`;
      return { state: "failed", reason, code: NSFW_RX.test(reason) ? "nsfw" : "unknown" };
    }
    default:
      return { state: "queued" };
  }
}

export const kie: Provider = {
  id: "kie",
  label: "KIE",
  auth: {
    placeholder: "kie_… API key",
    describeHeader: "Authorization: Bearer <key>",
    // Referral links — see the disclosure in README.md.
    consoleUrl: "https://gotolink.cc/kie",
    rechargeUrl: "https://gotolink.cc/kie",
  },
  catalog: KIE_CATALOG,
  retentionMs: 14 * DAY,
  creditUsd: KIE_CREDIT_USD,
  uploads: "provider",

  async submit(input, key) {
    const body = buildKieRequest(input);
    const res = await requestJson<Envelope<{ taskId?: string }>>(`${KIE_BASE}/api/v1/jobs/createTask`, {
      method: "POST",
      headers: authHeaders(key),
      body,
    });
    const env = res.data;
    const taskId = env?.data?.taskId;
    if (!res.ok || env?.code !== 200 || !taskId) throw envelopeError(res.status, env, res.text);
    return { jobId: taskId };
  },

  async poll(jobId, key, input) {
    const res = await requestJson<Envelope<RecordInfo>>(
      `${KIE_BASE}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(jobId)}`,
      { headers: authHeaders(key) },
    );
    const env = res.data;
    if (!res.ok || env?.code !== 200 || !env.data) throw envelopeError(res.status, env, res.text);
    return normalizeKieStatus(env.data, input);
  },

  async balance(key): Promise<Balance | null> {
    const res = await requestJson<Envelope<number>>(`${KIE_BASE}/api/v1/chat/credit`, { headers: authHeaders(key) });
    const env = res.data;
    if (!res.ok || env?.code !== 200 || typeof env.data !== "number") return null;
    return { credits: env.data, usd: env.data * KIE_CREDIT_USD };
  },

  async validateKey(key): Promise<KeyCheck> {
    const res = await requestJson<Envelope<number>>(`${KIE_BASE}/api/v1/chat/credit`, { headers: authHeaders(key) });
    const env = res.data;
    if (res.ok && env?.code === 200) return { ok: true };
    const code = typeof env?.code === "number" ? env.code : res.status;
    return { ok: false, status: code, reason: env?.msg ?? errorDetail(env, res.text) };
  },
};
