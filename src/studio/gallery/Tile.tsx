"use client";

import { useState } from "react";
import type { Asset } from "@/db/types";
import { PROVIDER_LABELS } from "@/providers/types";
import { getProvider } from "@/providers";
import { setAssetDims } from "@/data/actions";
import { useLibraryStore, assetSrc, assetThumb } from "@/stores/library";
import { useUiStore } from "@/stores/ui";
import { useAssetActions } from "./useAssetActions";
import { MoveMenu } from "./MoveMenu";
import { UseMenu } from "./UseMenu";

type Props = { asset: Asset; projectLabel?: string };

export function Tile({ asset, projectLabel }: Props) {
  const openViewer = useUiStore((s) => s.openViewer);
  const { remove, toggleFavorite, move, reuse } = useAssetActions();
  const [loaded, setLoaded] = useState(false);
  const [broken, setBroken] = useState(false);
  // Menus are anchored to the button that opened them (state, not refs, so render can read it).
  const [useAnchor, setUseAnchor] = useState<HTMLElement | null>(null);
  const [moveAnchor, setMoveAnchor] = useState<HTMLElement | null>(null);

  const [stale] = useState(() => !asset.localFile && Date.now() - asset.createdAt > getProvider(asset.provider).retentionMs);

  // Fill in dimensions the provider didn't report, so masonry stays stable next time.
  const learnDims = (w: number, h: number) => {
    setLoaded(true);
    if (!w || !h || (asset.width && asset.height)) return;
    useLibraryStore.getState().patchAsset(asset.id, { width: w, height: h });
    void setAssetDims(asset.id, w, h);
  };

  return (
    <article
      className={`tile${loaded ? " is-loaded" : ""}${broken ? " is-broken" : ""}`}
      data-kind={asset.kind}
      draggable
      onDragStart={(e) => {
        // Drop it on a composer slot to use it as a start frame, end frame or reference.
        e.dataTransfer.setData("application/x-mav-asset", JSON.stringify({ id: asset.id, kind: asset.kind }));
        e.dataTransfer.effectAllowed = "copy";
      }}
    >
      <button type="button" className="tile-media" onClick={() => openViewer(asset.id)} aria-label={`Open: ${asset.prompt.slice(0, 80)}`}>
        {asset.kind === "video" ? (
          <video
            src={assetSrc(asset)}
            muted
            loop
            playsInline
            preload="metadata"
            onLoadedMetadata={(e) => learnDims(e.currentTarget.videoWidth, e.currentTarget.videoHeight)}
            onError={() => setBroken(true)}
            onMouseEnter={(e) => void e.currentTarget.play().catch(() => undefined)}
            onMouseLeave={(e) => {
              e.currentTarget.pause();
              e.currentTarget.currentTime = 0;
            }}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={assetThumb(asset)}
            alt={asset.prompt.slice(0, 120)}
            loading="lazy"
            decoding="async"
            onLoad={(e) => learnDims(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)}
            onError={() => setBroken(true)}
          />
        )}
        {broken ? <span className="tile-broken">Media unavailable — the provider may have expired it.</span> : null}
      </button>

      <div className="tile-top">
        {asset.kind === "video" ? <span className="badge">video</span> : null}
        {stale && !broken ? (
          <span className="badge" data-tone="warning" title="Older than the provider's stated retention; the file may be gone.">
            may expire
          </span>
        ) : null}
        {projectLabel ? <span className="badge tile-project">{projectLabel}</span> : null}
        {asset.favorite === 1 ? (
          <span className="tile-fav" aria-label="Favorite">
            ♥
          </span>
        ) : null}
      </div>

      <div className="tile-actions">
        <span className="tile-meta">{PROVIDER_LABELS[asset.provider]}</span>
        <span className="tile-actions-spacer" />
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => reuse(asset)} title="Restore model, prompt and settings">
          Reuse
        </button>
        <span className="tile-move">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={(e) => {
              const el = e.currentTarget;
              setUseAnchor((a) => (a ? null : el));
            }}
            aria-haspopup="menu"
            aria-expanded={!!useAnchor}
            title="Use as start frame, end frame or reference"
          >
            Use ▾
          </button>
          {useAnchor ? <UseMenu asset={asset} anchor={useAnchor} onClose={() => setUseAnchor(null)} /> : null}
        </span>
        <button type="button" className="btn btn-ghost btn-sm" aria-pressed={asset.favorite === 1} onClick={() => toggleFavorite([asset])} title="Favorite">
          {asset.favorite === 1 ? "♥" : "♡"}
        </button>
        <span className="tile-move">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={(e) => {
              const el = e.currentTarget;
              setMoveAnchor((a) => (a ? null : el));
            }}
            aria-haspopup="menu"
            aria-expanded={!!moveAnchor}
            title="Move to project"
          >
            Move
          </button>
          {moveAnchor ? (
            <MoveMenu
              excludeProjectId={asset.projectId}
              anchor={moveAnchor}
              onPick={(pid) => {
                setMoveAnchor(null);
                move([asset], pid);
              }}
              onClose={() => setMoveAnchor(null)}
            />
          ) : null}
        </span>
        <button type="button" className="btn btn-danger btn-sm" onClick={() => remove([asset])} title="Delete">
          Delete
        </button>
      </div>
    </article>
  );
}
