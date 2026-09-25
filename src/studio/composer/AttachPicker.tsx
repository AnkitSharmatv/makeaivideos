"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MediaKind } from "@/providers/types";
import type { MediaRef } from "@/db/types";
import { useUploadsStore, uploadPreview } from "@/stores/uploads";
import { useLibraryStore, assetThumb } from "@/stores/library";
import { useProjectsStore } from "@/stores/projects";

type Tab = "uploads" | "results";

type Props = { accepts: MediaKind | "audio"; onPick: (refs: MediaRef[]) => void; onClose: () => void };

/** This project's inputs and results. Click to multi-select; Attach confirms. */
export function AttachPicker({ accepts, onPick, onClose }: Props) {
  const uploads = useUploadsStore((s) => s.uploads);
  const removeUpload = useUploadsStore((s) => s.remove);
  const assets = useLibraryStore((s) => s.assets);
  const currentId = useProjectsStore((s) => s.currentId);
  const [tab, setTab] = useState<Tab>("uploads");
  const [selected, setSelected] = useState<MediaRef[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  const kind: MediaKind = accepts === "video" ? "video" : "image";
  const myUploads = useMemo(() => uploads.filter((u) => u.kind === kind && u.projectId === currentId), [uploads, kind, currentId]);
  const myAssets = useMemo(() => assets.filter((a) => a.kind === kind && a.projectId === currentId), [assets, kind, currentId]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [onClose]);

  const same = (a: MediaRef, b: MediaRef) => a.type === b.type && "id" in a && "id" in b && a.id === b.id;
  const isSel = (r: MediaRef) => selected.some((s) => same(s, r));
  const toggle = (r: MediaRef) => setSelected((s) => (isSel(r) ? s.filter((x) => !same(x, r)) : [...s, r]));

  const cells = tab === "uploads" ? myUploads.map((u) => ({ key: u.id, ref: { type: "upload", id: u.id } as MediaRef, src: uploadPreview(u), title: u.name, video: u.kind === "video", removable: true })) : myAssets.map((a) => ({ key: a.id, ref: { type: "asset", id: a.id } as MediaRef, src: assetThumb(a), title: a.prompt, video: a.kind === "video", removable: false }));

  return (
    <div className="popover attach" ref={ref} role="dialog" aria-label="Attach from this project">
      <div className="attach-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "uploads"} className="chip" onClick={() => setTab("uploads")}>
          Uploads{myUploads.length ? ` · ${myUploads.length}` : ""}
        </button>
        <button type="button" role="tab" aria-selected={tab === "results"} className="chip" onClick={() => setTab("results")}>
          Results{myAssets.length ? ` · ${myAssets.length}` : ""}
        </button>
      </div>

      {cells.length === 0 ? (
        <div className="attach-empty">
          {tab === "uploads" ? "No uploads in this project yet — use Upload or drop a file on the slot." : `No finished ${kind}s in this project yet.`}
        </div>
      ) : (
        <div className="attach-grid">
          {cells.slice(0, 80).map((c) => (
            <div key={c.key} className={`attach-cell${isSel(c.ref) ? " is-selected" : ""}`}>
              <button type="button" className="attach-cell-media" onClick={() => toggle(c.ref)} aria-pressed={isSel(c.ref)} title={c.title}>
                {c.video ? (
                  <video src={c.src} muted playsInline preload="metadata" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.src} alt="" loading="lazy" />
                )}
              </button>
              {c.removable ? (
                <button type="button" className="attach-cell-x" aria-label={`Delete ${c.title} from this project`} onClick={() => void removeUpload(c.key)}>
                  ×
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <div className="attach-foot">
        <span className="help">{selected.length ? `${selected.length} selected` : ""}</span>
        <span className="tile-actions-spacer" />
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => onPick(selected)} disabled={selected.length === 0}>
          Attach
        </button>
      </div>
    </div>
  );
}
