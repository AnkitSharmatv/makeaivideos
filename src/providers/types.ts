/**
 * The only contract the rest of the app knows about. Everything
 * provider-specific lives behind it in src/providers/<name>/.
 */

export type ProviderId = "higgsfield" | "fal" | "kie";

export const PROVIDER_IDS: readonly ProviderId[] = ["kie", "fal", "higgsfield"];

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  higgsfield: "Higgsfield",
  fal: "FAL",
  kie: "KIE",
};

export function isProviderId(x: unknown): x is ProviderId {
  return x === "higgsfield" || x === "fal" || x === "kie";
}

export type MediaKind = "image" | "video";

export type SettingSpec =
  | { key: string; label: string; type: "enum"; values: string[]; default: string }
  | { key: string; label: string; type: "number"; min: number; max: number; step: number; default: number; unit?: string }
  | { key: string; label: string; type: "boolean"; default: boolean };

/** Reserved setting keys that the composer renders in the Advanced row. */
export const NEGATIVE_PROMPT_KEY = "negative_prompt";
export const SEED_KEY = "seed";

export type MediaRole = "start" | "end" | "reference" | "video" | "audio";

export type MediaRoleSpec = {
  role: MediaRole;
  label: string;
  accepts: MediaKind | "audio";
  min: number;
  max: number;
};

/** A cost estimate for one run (one request), before any batch multiplier. */
export type PriceEstimate = {
  usd: number;
  /** Provider credits, when the provider bills in credits. */
  credits?: number;
  /** True when derived from a published rate rather than a live quote. */
  approx?: boolean;
};

export type Balance = { credits?: number; usd?: number };

export type PriceFn = (settings: Record<string, SettingValue>, count: number) => PriceEstimate | null;

/**
 * How a model wants attached reference images mentioned in the prompt. The app
 * always shows `@image1`, `@image2`… and rewrites them per model at submit.
 *  - "at-image": keep `@image1` (Grok)
 *  - "ImageN":   `Image1` (Wan on KIE)
 *  - "Image N":  `Image 1` (Wan on Higgsfield)
 *  - "elements": named subjects sent as elements, keep `@image1` (Kling 3.0)
 *  - "natural":  plain "image 1" — models with no syntax
 */
export type PromptRefStyle = "at-image" | "ImageN" | "Image N" | "elements" | "natural";

export type ModelSpec = {
  /** Provider-scoped id used in requests. */
  id: string;
  provider: ProviderId;
  name: string;
  kind: MediaKind;
  /** Declared allow-lists → the UI renders exactly these. */
  settings: SettingSpec[];
  media: MediaRoleSpec[];
  batch: { native: boolean; max: number };
  /** Prompt syntax for referencing attached images; undefined = natural language. */
  promptRefs?: PromptRefStyle;
  /** True when the model accepts a negative prompt / seed via the Advanced row. */
  advanced?: { negativePrompt?: boolean; seed?: boolean };
  /** Pricing tier, resolution caps, etc. */
  notes?: string;
  /** Published pricing, as a function of the resolved settings and native batch count. Never blocks. */
  price?: PriceFn;
};

export type SettingValue = string | number | boolean;

export type GenerateInput = {
  modelId: string;
  prompt: string;
  negativePrompt?: string;
  /** role → public URLs */
  media: Partial<Record<MediaRole, string[]>>;
  settings: Record<string, SettingValue>;
  seed?: number;
  /** Only honoured when model.batch.native. */
  count?: number;
};

export type Output = {
  url: string;
  kind: MediaKind;
  width?: number;
  height?: number;
  duration?: number;
};

export type FailureCode = "nsfw" | "canceled" | "rate_limit" | "auth" | "unknown";

export type JobCost = { credits?: number; usd?: number };

export type JobStatus =
  | { state: "queued" | "running"; progress?: number }
  | { state: "done"; outputs: Output[]; cost?: JobCost }
  | { state: "failed"; reason: string; code?: FailureCode; retryAfterMs?: number };

export type KeyCheck = { ok: true } | { ok: false; status: number; reason: string };

export interface Provider {
  id: ProviderId;
  label: string;
  auth: {
    /** e.g. "id:secret" or "key" */
    placeholder: string;
    pattern?: RegExp;
    /** Shown in the key modal, e.g. "Authorization: Key id:secret" */
    describeHeader: string;
    /** Where the user creates a key / tops up. */
    consoleUrl: string;
    rechargeUrl: string;
  };
  catalog: ModelSpec[];
  /** How long result URLs are known to live on the provider CDN, in ms. */
  retentionMs: number;
  /** USD value of one provider credit, when the provider bills in credits. */
  creditUsd?: number;
  /** Live quote for a request, when the provider offers one (authenticated, free). */
  estimate?(input: GenerateInput, key: string): Promise<PriceEstimate | null>;
  /** Account balance, when the provider exposes one. */
  balance?(key: string): Promise<Balance | null>;
  submit(input: GenerateInput, key: string): Promise<{ jobId: string }>;
  poll(jobId: string, key: string, input: GenerateInput): Promise<JobStatus>;
  cancel?(jobId: string, key: string): Promise<void>;
  /** Cheapest authenticated call, used to validate a key on save. */
  validateKey(key: string): Promise<KeyCheck>;
  uploads?: "provider" | "blob";
}

/** Thrown by adapters; the generation layer maps it into JobStatus / UI text. */
export class ProviderError extends Error {
  code: FailureCode;
  status?: number;
  retryAfterMs?: number;
  constructor(message: string, code: FailureCode = "unknown", status?: number, retryAfterMs?: number) {
    super(message);
    this.name = "ProviderError";
    this.code = code;
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}
