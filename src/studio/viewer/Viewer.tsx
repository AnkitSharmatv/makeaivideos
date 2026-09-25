"use client";

import { useEffect, useMemo, useState } from "react";
import { useLibraryStore, assetSrc } from "@/stores/library";
import { useUiStore } from "@/stores/ui";
import { useProjectsStore } from "@/stores/projects";
import { PROVIDER_LABELS } from "@/providers/types";
import { findModel } from "@/providers";
import { useAssetActions } from "../gallery/useAssetActions";
import { formatTimestamp, formatDuration } from "@/lib/format";
import { startRuns } from "@/generation/lifecycle";
import { formatCredits, formatUsd } from "@/generation/pricing";

export function Viewer({ assetId }: { assetId: string }) {
  const asset = useLibraryStore((s) => s.assets.find((a) => a.id === assetId) ?? null);
  const assets = useLibraryStore((s) => s.assets);
  const openViewer = useUiStore((s) => s.openViewer);
  const toast = useUiStore((s) => s.toast);
  const projects = useProjectsStore((s) => s.projects);
  const { toggleFavorite, remove, reuse } = useAssetActions();
  const [copied, setCopied] = useState(false);
  const [recreating, setRecreating] = useState(false);

  // Neighbours within the same project, for ← → navigation.
  const siblings = useMemo(() => (asset ? assets.filter((a) => a.projectId === asset.projectId) : []), [assets, asset]);
  const idx = asset ? siblings.findIndex((a) => a.id === asset.id) : -1;
  const prev = idx > 0 ? siblings[idx - 1] : undefined;
  const next = idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : undefined;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        openViewer(null);
      } else if (e.key === "ArrowLeft" && prev) openViewer(prev.id);
      else if (e.key === "ArrowRight" && next) openViewer(next.id);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openViewer, prev, next]);

  if (!asset) {
    return null;
  }

  const model = findModel(`${asset.provider}:${asset.modelId}`);
  const project = projects.find((p) => p.id === asset.projectId);
  const settingsList = Object.entries(asset.settings);

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(asset.prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast("Clipboard unavailable.", "warning");
    }
  };

  const download = async () => {
    try {
      const res = await fetch(assetSrc(asset));
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      const ext = asset.kind === "video" ? "mp4" : (blob.type.split("/")[1] ?? "png").replace("jpeg", "jpg");
      a.download = `${asset.modelId.replace(/[^a-z0-9]+/gi, "-")}-${asset.id.slice(0, 8)}.${ext}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
    } catch {
      // Cross-origin without CORS: fall back to opening the file.
      window.open(asset.url, "_blank", "noopener");
    }
  };

  const recreate = async () => {
    if (!model || !project || recreating) return;
    setRecreating(true);
    try {
      await startRuns({
        model,
        projectId: project.id,
        prompt: asset.prompt,
        negativePrompt: asset.negativePrompt,
        seed: undefined,
        media: asset.media,
        mediaRefs: asset.mediaRefs,
        settings: asset.settings,
        batch: 1,
      });
      toast(`Recreating with ${model.name}…`, "info");
      openViewer(null);
    } finally {
      setRecreating(false);
    }
  };

  return (
    <div className="viewer" role="dialog" aria-modal="true" aria-label="Viewer">
      <div className="viewer-scrim" onClick={() => openViewer(null)} aria-hidden="true" />
      <div className="viewer-stage">
        {asset.kind === "video" ? (
          <video src={assetSrc(asset)} controls autoPlay loop playsInline />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={assetSrc(asset)} alt={asset.prompt.slice(0, 120)} />
        )}
        {prev ? (
          <button type="button" className="btn btn-ghost viewer-nav viewer-prev" onClick={() => openViewer(prev.id)} aria-label="Previous">
            ‹
          </button>
        ) : null}
        {next ? (
          <button type="button" className="btn btn-ghost viewer-nav viewer-next" onClick={() => openViewer(next.id)} aria-label="Next">
            ›
          </button>
        ) : null}
      </div>
      <aside className="viewer-panel">
        <div className="viewer-panel-head">
          <span className="eyebrow">
            {PROVIDER_LABELS[asset.provider]} · {model?.name ?? asset.modelId}
          </span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => openViewer(null)} aria-label="Close">
            ×
          </button>
        </div>

        <div className="viewer-prompt">
          <p>{asset.prompt}</p>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void copyPrompt()}>
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        {asset.negativePrompt ? (
          <div className="viewer-block">
            <span className="eyebrow">Negative</span>
            <p className="viewer-secondary">{asset.negativePrompt}</p>
          </div>
        ) : null}

        <dl className="viewer-meta num">
          {settingsList.map(([k, v]) => (
            <div key={k}>
              <dt>{model?.settings.find((s) => s.key === k)?.label ?? k}</dt>
              <dd>{String(v)}</dd>
            </div>
          ))}
          {asset.seed !== undefined ? (
            <div>
              <dt>Seed</dt>
              <dd>{asset.seed}</dd>
            </div>
          ) : null}
          {asset.width && asset.height ? (
            <div>
              <dt>Size</dt>
              <dd>
                {asset.width}×{asset.height}
              </dd>
            </div>
          ) : null}
          {formatDuration(asset.duration) ? (
            <div>
              <dt>Duration</dt>
              <dd>{formatDuration(asset.duration)}</dd>
            </div>
          ) : null}
          {asset.costCredits !== undefined || asset.costUsd !== undefined ? (
            <div>
              <dt>Charged</dt>
              <dd>
                {asset.costCredits !== undefined ? `${formatCredits(asset.costCredits)} cr` : ""}
                {asset.costCredits !== undefined && asset.costUsd !== undefined ? " · " : ""}
                {asset.costUsd !== undefined ? formatUsd(asset.costUsd) : ""}
              </dd>
            </div>
          ) : null}
          <div>
            <dt>Project</dt>
            <dd>{project?.name ?? "—"}</dd>
          </div>
          <div>
            <dt>Created</dt>
            <dd>{formatTimestamp(asset.createdAt)}</dd>
          </div>
        </dl>

        <div className="viewer-actions">
          <button type="button" className={`btn btn-primary${recreating ? " is-loading" : ""}`} onClick={() => void recreate()} disabled={!model || recreating}>
            <span>Recreate</span>
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              reuse(asset);
              openViewer(null);
            }}
          >
            Reuse
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => void download()}>
            Download
          </button>
          <button type="button" className="btn btn-ghost" aria-pressed={asset.favorite === 1} onClick={() => toggleFavorite([asset])}>
            {asset.favorite === 1 ? "♥ Favorited" : "♡ Favorite"}
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => {
              remove([asset]);
              openViewer(next?.id ?? prev?.id ?? null);
            }}
          >
            Delete
          </button>
        </div>
      </aside>
    </div>
  );
}
