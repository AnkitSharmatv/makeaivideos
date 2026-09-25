/**
 * Cost hints. Published rates live in each model's catalog `price`; when a
 * provider reports what a run actually cost, that observation wins for the
 * same model + settings next time.
 */
import type { Run } from "@/db/types";
import { getProvider } from "@/providers";
import type { JobCost, ModelSpec, PriceEstimate, SettingValue } from "@/providers/types";
import { resolveSettings } from "@/providers/catalog-utils";

const OBSERVED_KEY = "mav.prices";

type Observed = Record<string, { credits?: number; usd?: number; at: number }>;

function signature(model: Pick<ModelSpec, "provider" | "id">, settings: Record<string, SettingValue>, count: number): string {
  const keys = Object.keys(settings).sort();
  return `${model.provider}:${model.id}|${count}|${keys.map((k) => `${k}=${String(settings[k])}`).join(",")}`;
}

function readObserved(): Observed {
  try {
    const raw = localStorage.getItem(OBSERVED_KEY);
    return raw ? (JSON.parse(raw) as Observed) : {};
  } catch {
    return {};
  }
}

export function recordObservedCost(run: Run, cost: JobCost): void {
  if (typeof localStorage === "undefined") return;
  try {
    const all = readObserved();
    all[signature({ provider: run.provider, id: run.modelId }, run.input.settings, run.input.count ?? 1)] = { ...cost, at: Date.now() };
    const entries = Object.entries(all).sort((a, b) => b[1].at - a[1].at).slice(0, 300);
    localStorage.setItem(OBSERVED_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    /* ignore */
  }
}

export type CostHint = PriceEstimate & { source: "observed" | "published" | "live"; runs: number };

/**
 * Estimate for a Generate press: `batch` runs of `count` outputs each.
 * Returns null when nothing is known — the UI then shows nothing.
 */
export function estimateCost(model: ModelSpec, settings: Record<string, SettingValue>, batch: number, live?: PriceEstimate | null): CostHint | null {
  const native = model.batch.native;
  const count = native ? Math.min(batch, model.batch.max) : 1;
  const runs = native ? 1 : Math.min(batch, model.batch.max);
  const creditUsd = getProvider(model.provider).creditUsd;

  let per: PriceEstimate | null = null;
  let source: CostHint["source"] = "published";

  if (live) {
    per = live;
    source = "live";
  } else {
    const obs = typeof localStorage !== "undefined" ? readObserved()[signature(model, settings, count)] : undefined;
    if (obs && (obs.usd !== undefined || (obs.credits !== undefined && creditUsd))) {
      per = { usd: obs.usd ?? obs.credits! * creditUsd!, credits: obs.credits };
      source = "observed";
    } else if (model.price) {
      per = model.price(settings, count);
    }
  }
  if (!per) return null;
  return {
    usd: per.usd * runs,
    credits: per.credits !== undefined ? per.credits * runs : undefined,
    approx: source !== "live",
    source,
    runs,
  };
}

export function formatUsd(usd: number): string {
  if (usd < 0.01) return `$${usd.toFixed(3)}`;
  if (usd < 1) return `$${usd.toFixed(2)}`;
  return `$${usd.toFixed(2)}`;
}

export function formatCredits(c: number): string {
  return Number.isInteger(c) ? String(c) : c.toFixed(1);
}

/**
 * Price of one run at the model's default settings — the figure shown in the
 * models list so a model can be judged before it's selected. Null when the
 * provider publishes no rate (Higgsfield quotes live instead).
 */
export function baselinePrice(model: ModelSpec): (PriceEstimate & { per: "image" | "video" }) | null {
  if (!model.price) return null;
  const settings = resolveSettings(model, {});
  const est = model.price(settings, 1);
  if (!est) return null;
  return { ...est, per: model.kind };
}

/** "8 cr · ≈ $0.04" / "≈ $0.30" */
export function formatPrice(p: PriceEstimate): string {
  const parts: string[] = [];
  if (p.credits !== undefined) parts.push(`${formatCredits(p.credits)} cr`);
  parts.push(`${p.approx ? "≈ " : ""}${formatUsd(p.usd)}`);
  return parts.join(" · ");
}
