"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Asset, Run } from "@/db/types";
import { findModel } from "@/providers";
import { resolveSettings, ratioToDims } from "@/providers/catalog-utils";
import { Tile } from "./Tile";
import { RunTile } from "./RunTile";

type Item = { key: string; ratio: number; node: React.ReactNode; createdAt: number };

const GAP = 12;
const MIN_W = 220;

function runRatio(run: Run): number {
  const model = findModel(`${run.provider}:${run.modelId}`);
  if (!model) return 1;
  const st = resolveSettings(model, run.input.settings);
  const dims = ratioToDims(typeof st.aspect_ratio === "string" ? st.aspect_ratio : undefined);
  if (dims) return dims.width / dims.height;
  if (typeof st.image_size === "string") {
    if (st.image_size.startsWith("portrait")) return 3 / 4;
    if (st.image_size.startsWith("landscape")) return 4 / 3;
  }
  return model.kind === "video" ? 16 / 9 : 1;
}

type Props = { assets: Asset[]; runs: Run[]; projectLabels?: Record<string, string> };

/** Column masonry: items go to the shortest column, in order, so newest stays on top. */
export function MediaGrid({ assets, runs, projectLabels }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(3);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry?.contentRect.width ?? el.clientWidth;
      setCols(Math.max(1, Math.floor((w + GAP) / (MIN_W + GAP))));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const items = useMemo<Item[]>(() => {
    const r: Item[] = runs.map((run) => ({ key: `run:${run.id}`, ratio: runRatio(run), node: <RunTile run={run} />, createdAt: run.createdAt }));
    const a: Item[] = assets.map((asset) => ({
      key: `asset:${asset.id}`,
      ratio: asset.width && asset.height ? asset.width / asset.height : asset.kind === "video" ? 16 / 9 : 1,
      node: <Tile asset={asset} projectLabel={projectLabels?.[asset.projectId]} />,
      createdAt: asset.createdAt,
    }));
    // In-flight and failed runs first, then finished work newest-first.
    return [...r.sort((x, y) => y.createdAt - x.createdAt), ...a];
  }, [assets, runs, projectLabels]);

  const columns = useMemo(() => {
    const heights = Array.from({ length: cols }, () => 0);
    const buckets: Item[][] = Array.from({ length: cols }, () => []);
    for (const it of items) {
      let best = 0;
      for (let i = 1; i < cols; i++) if (heights[i]! < heights[best]!) best = i;
      buckets[best]!.push(it);
      heights[best]! += 1 / it.ratio + 0.08;
    }
    return buckets;
  }, [items, cols]);

  return (
    <div className="masonry" ref={ref} style={{ gap: GAP }}>
      {columns.map((col, i) => (
        <div className="masonry-col" key={i} style={{ gap: GAP }}>
          {col.map((it) => (
            <div key={it.key} className="masonry-item" style={{ aspectRatio: String(it.ratio) }}>
              {it.node}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
