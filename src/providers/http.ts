import { ProviderError } from "./types";

const DEFAULT_TIMEOUT_MS = 30_000;

type JsonRequest = {
  method?: "GET" | "POST" | "PUT";
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
};

export type JsonResponse<T> = { status: number; ok: boolean; data: T | null; text: string };

/**
 * fetch → JSON with a timeout. Never throws on HTTP status; callers decide.
 * Throws ProviderError only on network/timeout failures.
 */
export async function requestJson<T = unknown>(url: string, req: JsonRequest = {}): Promise<JsonResponse<T>> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), req.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: req.method ?? "GET",
      headers: {
        Accept: "application/json",
        ...(req.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...req.headers,
      },
      body: req.body !== undefined ? JSON.stringify(req.body) : undefined,
      signal: ctrl.signal,
      cache: "no-store",
    });
    const text = await res.text();
    let data: T | null = null;
    if (text) {
      try {
        data = JSON.parse(text) as T;
      } catch {
        data = null;
      }
    }
    return { status: res.status, ok: res.ok, data, text };
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    throw new ProviderError(aborted ? "The provider did not respond in time." : "Could not reach the provider.", "unknown");
  } finally {
    clearTimeout(timer);
  }
}

export function retryAfterMs(headers: Headers | undefined): number | undefined {
  const v = headers?.get("retry-after");
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n * 1000 : undefined;
}

/** Map an HTTP status to a FailureCode + readable message. */
export function httpFailure(status: number, detail?: string): ProviderError {
  const d = detail ? ` ${detail}` : "";
  if (status === 401 || status === 403) return new ProviderError(`Key rejected (${status}).${d}`, "auth", status);
  if (status === 402) return new ProviderError(`Insufficient credits (402).${d}`, "unknown", status);
  if (status === 429) return new ProviderError(`Rate limited (429).${d}`, "rate_limit", status);
  if (status >= 500) return new ProviderError(`Provider error (${status}).${d}`, "unknown", status);
  return new ProviderError(`Request failed (${status}).${d}`, "unknown", status);
}

/** Pull a short human message out of an unknown error body. */
export function errorDetail(data: unknown, text: string): string {
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    for (const k of ["message", "msg", "detail", "error"]) {
      const v = o[k];
      if (typeof v === "string" && v) return v.slice(0, 200);
      if (v && typeof v === "object") {
        const inner = (v as Record<string, unknown>).message;
        if (typeof inner === "string") return inner.slice(0, 200);
      }
    }
  }
  return text.slice(0, 200);
}

export function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}
