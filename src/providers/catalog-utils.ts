import type { GenerateInput, MediaRoleSpec, ModelSpec, PriceEstimate, PriceFn, PromptRefStyle, SettingSpec, SettingValue } from "./types";

/** Concise builders for catalog entries. */
export const s = {
  enum: (key: string, label: string, values: string[], def = values[0] ?? ""): SettingSpec => ({
    key,
    label,
    type: "enum",
    values,
    default: def,
  }),
  number: (key: string, label: string, min: number, max: number, step: number, def: number, unit?: string): SettingSpec => ({
    key,
    label,
    type: "number",
    min,
    max,
    step,
    default: def,
    unit,
  }),
  bool: (key: string, label: string, def: boolean): SettingSpec => ({ key, label, type: "boolean", default: def }),
};

export const m = {
  start: (required = true): MediaRoleSpec => ({ role: "start", label: "Start frame", accepts: "image", min: required ? 1 : 0, max: 1 }),
  end: (): MediaRoleSpec => ({ role: "end", label: "End frame", accepts: "image", min: 0, max: 1 }),
  reference: (max: number, min = 0): MediaRoleSpec => ({ role: "reference", label: "Reference", accepts: "image", min, max }),
  video: (required = true): MediaRoleSpec => ({ role: "video", label: "Video", accepts: "video", min: required ? 1 : 0, max: 1 }),
};

/** Resolve every declared setting to a value, filling defaults. */
export function resolveSettings(model: ModelSpec, given: Record<string, SettingValue>): Record<string, SettingValue> {
  const out: Record<string, SettingValue> = {};
  for (const spec of model.settings) {
    const v = given[spec.key];
    if (spec.type === "enum") out[spec.key] = typeof v === "string" && spec.values.includes(v) ? v : spec.default;
    else if (spec.type === "number") {
      const n = typeof v === "number" ? v : Number(v);
      out[spec.key] = Number.isFinite(n) ? Math.min(spec.max, Math.max(spec.min, n)) : spec.default;
    } else out[spec.key] = typeof v === "boolean" ? v : spec.default;
  }
  return out;
}

export function firstUrl(input: GenerateInput, role: keyof GenerateInput["media"]): string | undefined {
  return input.media[role]?.[0];
}

export function urls(input: GenerateInput, role: keyof GenerateInput["media"]): string[] {
  return input.media[role] ?? [];
}

/** Common aspect-ratio → dimensions guess for tiles before media loads. */
export function ratioToDims(ratio: string | undefined, base = 1024): { width: number; height: number } | undefined {
  if (!ratio) return undefined;
  const mm = /^(\d+):(\d+)$/.exec(ratio);
  if (!mm) return undefined;
  const w = Number(mm[1]);
  const h = Number(mm[2]);
  if (!w || !h) return undefined;
  return w >= h ? { width: base, height: Math.round((base * h) / w) } : { width: Math.round((base * w) / h), height: base };
}

/** Number of megapixels for a FAL-style image_size or an aspect ratio at ~1K. */
export function megapixels(settings: Record<string, SettingValue>): number {
  const size = typeof settings.image_size === "string" ? settings.image_size : undefined;
  const table: Record<string, number> = {
    square: 512 * 512,
    square_hd: 1024 * 1024,
    portrait_4_3: 768 * 1024,
    portrait_3_2: 683 * 1024,
    portrait_16_9: 576 * 1024,
    landscape_4_3: 1024 * 768,
    landscape_3_2: 1024 * 683,
    landscape_16_9: 1024 * 576,
    landscape_21_9: 1024 * 439,
  };
  if (size && table[size]) return table[size] / 1_000_000;
  const dims = ratioToDims(typeof settings.aspect_ratio === "string" ? settings.aspect_ratio : undefined) ?? { width: 1024, height: 1024 };
  return (dims.width * dims.height) / 1_000_000;
}

/** Duration in seconds from a setting that may be "8", "8s" or 8. */
export function seconds(v: SettingValue | undefined, fallback: number): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

/** Credit-based pricing helper: credits × creditUsd, per request. */
export function creditPrice(creditUsd: number, fn: (settings: Record<string, SettingValue>, count: number) => number | null): PriceFn {
  return (settings, count) => {
    const credits = fn(settings, count);
    if (credits === null || !Number.isFinite(credits)) return null;
    return { credits, usd: credits * creditUsd, approx: true };
  };
}

/** USD-based pricing helper, per request. */
export function usdPrice(fn: (settings: Record<string, SettingValue>, count: number) => number | null): PriceFn {
  return (settings, count) => {
    const usd = fn(settings, count);
    if (usd === null || !Number.isFinite(usd)) return null;
    const est: PriceEstimate = { usd, approx: true };
    return est;
  };
}

export const REF_TAG = /@image(\d+)\b/gi;

/** Rewrite the app's `@imageN` tags into the model's own convention. */
export function renderRefTags(prompt: string, style: PromptRefStyle | undefined): string {
  switch (style) {
    case "at-image":
    case "elements":
      return prompt.replace(REF_TAG, (_m, n: string) => `@image${n}`);
    case "ImageN":
      return prompt.replace(REF_TAG, (_m, n: string) => `Image${n}`);
    case "Image N":
      return prompt.replace(REF_TAG, (_m, n: string) => `Image ${n}`);
    default:
      return prompt.replace(REF_TAG, (_m, n: string) => `image ${n}`);
  }
}

/** Kling-style subject list: one element per reference, named so `@imageN` in the prompt resolves. */
export function elementsFor(urls: string[]): { name: string; description: string; element_input_urls: string[] }[] {
  return urls.map((url, i) => ({ name: `image${i + 1}`, description: `reference image ${i + 1}`, element_input_urls: [url] }));
}
