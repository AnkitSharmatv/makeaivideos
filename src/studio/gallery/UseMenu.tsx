"use client";

import { useEffect, useRef } from "react";
import type { Asset } from "@/db/types";
import type { MediaKind, ModelSpec } from "@/providers/types";
import { useModelStore } from "@/stores/model";
import { usePromptStore } from "@/stores/prompt";
import { useUiStore } from "@/stores/ui";
import { Floating } from "../ui/Floating";

type Props = { asset: Asset; anchor: HTMLElement | null; onClose: () => void };

/** "Use as…" — every slot the selected image and video models offer for this asset's kind. */
export function UseMenu({ asset, anchor, onClose }: Props) {
  const selected = useModelStore((s) => s.selected);
  const modelFor = useModelStore((s) => s.modelFor);
  const media = usePromptStore((s) => s.media);
  const addMedia = usePromptStore((s) => s.addMedia);
  const setGalleryTab = useUiStore((s) => s.setGalleryTab);
  const setKind = useUiStore((s) => s.setKind);
  const galleryTab = useUiStore((s) => s.galleryTab);
  const toast = useUiStore((s) => s.toast);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node) && !anchor?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey, true);
    ref.current?.querySelector<HTMLElement>("button:not(:disabled)")?.focus();
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [onClose, anchor]);

  const groups = (["video", "image"] as MediaKind[])
    .map((kind) => ({ kind, model: selected[kind] ? modelFor(kind) : null }))
    .filter((g): g is { kind: MediaKind; model: ModelSpec } => !!g.model);

  const pick = (kind: MediaKind, model: ModelSpec, role: ModelSpec["media"][number]) => {
    const n = addMedia(role.role, [{ type: "asset", id: asset.id }], role.max);
    if (n === 0) {
      toast(`${role.label} is full (${role.max}).`, "warning");
      return;
    }
    if (galleryTab === "image" || galleryTab === "video") setGalleryTab(kind);
    else setKind(kind);
    toast(`Added as ${role.label.toLowerCase()} for ${model.name}.`, "success");
    onClose();
  };

  return (
    <Floating anchor={anchor} width={240}>
    <div className="popover use-menu" ref={ref} role="menu" aria-label="Use this result as">
      <div className="move-menu-head eyebrow">Use as</div>
      {groups.length === 0 ? <div className="picker-empty">Pick an image or video model first.</div> : null}
      {groups.map(({ kind, model }) => {
        const roles = model.media.filter((r) => r.accepts === asset.kind);
        return (
          <div key={kind} className="use-menu-group">
            <div className="use-menu-model">
              <span className="badge">{kind}</span>
              <span>{model.name}</span>
            </div>
            {roles.length === 0 ? (
              <div className="use-menu-none">Doesn&apos;t take {asset.kind} input — choose another {kind} model.</div>
            ) : (
              roles.map((r) => {
                const count = media[r.role]?.length ?? 0;
                const full = count >= r.max;
                return (
                  <button key={r.role} type="button" role="menuitem" className="move-menu-row use-menu-row" disabled={full} onClick={() => pick(kind, model, r)}>
                    <span>{r.label}</span>
                    <span className="use-menu-count num">
                      {count}/{r.max}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        );
      })}
    </div>
    </Floating>
  );
}
