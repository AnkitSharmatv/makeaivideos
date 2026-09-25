"use client";

import { useEffect, useMemo, useState } from "react";
import type { ModelSpec, PriceEstimate, SettingValue } from "@/providers/types";
import type { MediaRefs } from "@/db/types";
import { getProvider } from "@/providers";
import { estimateJob } from "@/generation/actions";
import { estimateCost, type CostHint } from "@/generation/pricing";

/**
 * Cost for the current composer state. Published rates resolve instantly;
 * providers with a live quote (Higgsfield) are asked after a short debounce.
 */
export function useCostHint(model: ModelSpec | null, settings: Record<string, SettingValue>, batch: number, prompt: string, media: MediaRefs): CostHint | null {
  const [live, setLive] = useState<{ sig: string; value: PriceEstimate | null } | null>(null);
  const sig = model ? `${model.provider}:${model.id}|${batch}|${JSON.stringify(settings)}|${JSON.stringify(media)}` : "";
  const hasLive = !!model && !!getProvider(model.provider).estimate;

  useEffect(() => {
    if (!model || !hasLive || !prompt.trim()) return;
    let cancelled = false;
    const t = setTimeout(() => {
      const count = model.batch.native ? Math.min(batch, model.batch.max) : 1;
      const urlMedia = Object.fromEntries(
        Object.entries(media).map(([role, refs]) => [role, (refs ?? []).flatMap((r) => (r.type === "url" ? [r.url] : ["https://example.com/placeholder.jpg"]))]),
      );
      void estimateJob(model.provider, { modelId: model.id, prompt, media: urlMedia, settings, count }).then((value) => {
        if (!cancelled) setLive({ sig, value });
      });
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // sig captures settings/media/batch; prompt changes shouldn't re-quote.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, hasLive, !!prompt.trim()]);

  return useMemo(() => {
    if (!model) return null;
    const liveValue = hasLive && live?.sig === sig ? live.value : undefined;
    return estimateCost(model, settings, batch, liveValue);
  }, [model, settings, batch, hasLive, live, sig]);
}
