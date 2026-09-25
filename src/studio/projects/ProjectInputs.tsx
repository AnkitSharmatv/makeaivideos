"use client";

import { useMemo, useRef, useState } from "react";
import { useUploadsStore, uploadPreview } from "@/stores/uploads";
import { usePromptStore } from "@/stores/prompt";
import { useModelStore } from "@/stores/model";
import { useUiStore } from "@/stores/ui";
import type { Upload } from "@/db/types";

/** The files uploaded into this project, kept with it. */
export function ProjectInputs({ projectId }: { projectId: string }) {
  const uploads = useUploadsStore((s) => s.uploads);
  const add = useUploadsStore((s) => s.add);
  const remove = useUploadsStore((s) => s.remove);
  const addMedia = usePromptStore((s) => s.addMedia);
  const modelFor = useModelStore((s) => s.modelFor);
  const kind = useUiStore((s) => s.kind);
  const toast = useUiStore((s) => s.toast);
  const [open, setOpen] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const mine = useMemo(() => uploads.filter((u) => u.projectId === projectId), [uploads, projectId]);

  const use = (u: Upload) => {
    const model = modelFor(kind);
    if (!model) {
      toast("Pick a model first, then use an input.", "warning");
      return;
    }
    const roles = model.media.filter((r) => r.accepts === u.kind);
    const slot = roles.find((r) => (usePromptStore.getState().media[r.role]?.length ?? 0) < r.max);
    if (!slot) {
      toast(roles.length ? `${model.name} already has all its ${u.kind}s.` : `${model.name} doesn't take ${u.kind} input.`, "warning");
      return;
    }
    addMedia(slot.role, [{ type: "upload", id: u.id }], slot.max);
    toast(`Attached as ${slot.label.toLowerCase()} for ${model.name}.`, "success");
  };

  const onFiles = async (files: FileList) => {
    for (const f of Array.from(files)) {
      if (!f.type.startsWith("image/") && !f.type.startsWith("video/")) continue;
      try {
        await add(f, projectId);
      } catch (err) {
        toast(err instanceof Error ? err.message : "Could not read that file.", "danger");
      }
    }
  };

  return (
    <section className="inputs" aria-label="Project inputs">
      <div className="inputs-head">
        <button type="button" className="btn btn-ghost btn-sm" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <span className="eyebrow">Inputs</span>
          <span className="count num">{mine.length}</span>
          <span aria-hidden="true">{open ? "▾" : "▸"}</span>
        </button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()}>
          Add files
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/mp4,video/quicktime,video/webm"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files?.length) void onFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {open ? (
        mine.length === 0 ? (
          <p className="inputs-empty">Reference images and start frames you upload for this project stay here, ready to reuse.</p>
        ) : (
          <div className="inputs-row">
            {mine.map((u) => (
              <div key={u.id} className="input-card" title={u.name}>
                {u.kind === "video" ? (
                  <video src={uploadPreview(u)} muted playsInline preload="metadata" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={uploadPreview(u)} alt={u.name} />
                )}
                <div className="input-card-actions">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => use(u)}>
                    Use
                  </button>
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => void remove(u.id)} aria-label={`Delete ${u.name}`}>
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : null}
    </section>
  );
}
