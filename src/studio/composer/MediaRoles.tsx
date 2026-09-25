"use client";

import { useRef, useState } from "react";
import type { MediaRoleSpec, ModelSpec } from "@/providers/types";
import type { MediaRef } from "@/db/types";
import { usePromptStore } from "@/stores/prompt";
import { useUploadsStore, uploadPreview } from "@/stores/uploads";
import { useLibraryStore, assetThumb } from "@/stores/library";
import { useUiStore } from "@/stores/ui";
import { useKeysStore } from "@/stores/keys";
import { useProjectsStore } from "@/stores/projects";
import { AttachPicker } from "./AttachPicker";

const EMPTY: MediaRef[] = [];

const ROLE_HINT: Record<string, string> = {
  start: "The video begins on this image.",
  end: "The video ends on this image.",
  reference: "Style, subject or product references the model should follow.",
  video: "Source clip.",
  audio: "Audio track.",
};

function acceptFor(spec: MediaRoleSpec): string {
  if (spec.accepts === "video") return "video/mp4,video/quicktime,video/webm";
  if (spec.accepts === "audio") return "audio/*";
  return "image/jpeg,image/png,image/webp";
}

function Thumb({ r, onRemove, tag }: { r: MediaRef; onRemove: () => void; tag?: string }) {
  const upload = useUploadsStore((s) => (r.type === "upload" ? s.uploads.find((u) => u.id === r.id) : undefined));
  const asset = useLibraryStore((s) => (r.type === "asset" ? s.assets.find((a) => a.id === r.id) : undefined));
  const busy = useUploadsStore((s) => (r.type === "upload" ? s.busy[r.id] : undefined));
  const src = r.type === "url" ? r.url : r.type === "asset" ? (asset ? assetThumb(asset) : undefined) : upload ? uploadPreview(upload) : undefined;
  const isVideo = r.type === "asset" ? asset?.kind === "video" : r.type === "upload" ? upload?.kind === "video" : /\.(mp4|mov|webm)(\?|$)/i.test(r.url);
  const missing = (r.type === "asset" && !asset) || (r.type === "upload" && !upload);
  return (
    <span className={`media-thumb${missing ? " is-missing" : ""}`} title={r.type === "url" ? r.url : upload?.name ?? asset?.prompt ?? ""}>
      {src ? (
        isVideo ? (
          <video src={src} muted playsInline preload="metadata" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" />
        )
      ) : (
        <span className="media-thumb-missing">?</span>
      )}
      {busy ? <span className="media-thumb-busy" aria-label="Uploading" /> : null}
      {tag ? <span className="media-thumb-tag num">{tag}</span> : null}
      <button type="button" className="media-thumb-x" onClick={onRemove} aria-label="Remove">
        ×
      </button>
    </span>
  );
}

function RoleSlot({ spec, model }: { spec: MediaRoleSpec; model: ModelSpec }) {
  const refs = usePromptStore((s) => s.media[spec.role] ?? EMPTY);
  const addMedia = usePromptStore((s) => s.addMedia);
  const removeMedia = usePromptStore((s) => s.removeMedia);
  const addUpload = useUploadsStore((s) => s.add);
  const ensureRemote = useUploadsStore((s) => s.ensureRemote);
  const keyHeld = useKeysStore((s) => !!s.status?.[model.provider]);
  const projectId = useProjectsStore((s) => s.currentId);
  const toast = useUiStore((s) => s.toast);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const room = spec.max - refs.length;
  const required = spec.min > 0 && refs.length < spec.min;

  const addFiles = async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => (spec.accepts === "image" ? f.type.startsWith("image/") : spec.accepts === "video" ? f.type.startsWith("video/") : true));
    if (list.length === 0) {
      toast(`Drop ${spec.accepts} files here.`, "warning");
      return;
    }
    const take = list.slice(0, room);
    if (take.length < list.length) toast(`${spec.label} takes up to ${spec.max}.`, "warning");
    if (!projectId) {
      toast("Open a project first — uploads are filed in it.", "warning");
      return;
    }
    for (const f of take) {
      try {
        const u = await addUpload(f, projectId);
        addMedia(spec.role, [{ type: "upload", id: u.id }], spec.max);
        // Warm the provider copy now so Generate doesn't wait.
        if (keyHeld) void ensureRemote(u.id, model.provider).catch((err: unknown) => toast(err instanceof Error ? err.message : "Upload failed.", "danger"));
      } catch (err) {
        toast(err instanceof Error ? err.message : "Could not read that file.", "danger");
      }
    }
  };

  return (
    <div
      className={`media-slot${dragging ? " is-dragging" : ""}${required ? " is-required" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const dragged = e.dataTransfer.getData("application/x-mav-asset");
        if (dragged) {
          try {
            const { id, kind } = JSON.parse(dragged) as { id: string; kind: string };
            if (kind !== spec.accepts) {
              toast(`${spec.label} takes ${spec.accepts}s.`, "warning");
              return;
            }
            const n = addMedia(spec.role, [{ type: "asset", id }], spec.max);
            if (n === 0) toast(`${spec.label} is full (${spec.max}).`, "warning");
          } catch {
            /* not ours */
          }
          return;
        }
        if (e.dataTransfer.files.length) void addFiles(e.dataTransfer.files);
      }}
    >
      <span className="media-slot-label" title={ROLE_HINT[spec.role]}>
        {spec.label}
        <span className="media-slot-count num">
          {refs.length}/{spec.max}
        </span>
        {spec.min > 0 ? <span className="media-slot-req">required</span> : null}
      </span>
      <div className="media-slot-items">
        {refs.map((r, i) => (
          <Thumb key={`${r.type}:${"id" in r ? r.id : r.url}:${i}`} r={r} tag={spec.role === "reference" ? `@image${i + 1}` : undefined} onRemove={() => removeMedia(spec.role, i)} />
        ))}
        {room > 0 ? (
          <span className="media-slot-actions">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()}>
              Upload
            </button>
            <span className="picker-anchor">
              <button type="button" className="btn btn-ghost btn-sm" aria-haspopup="dialog" aria-expanded={pickerOpen} onClick={() => setPickerOpen((o) => !o)}>
                Attach…
              </button>
              {pickerOpen ? (
                <AttachPicker
                  accepts={spec.accepts}
                  onPick={(picked) => {
                    const n = addMedia(spec.role, picked, spec.max);
                    if (n < picked.length) toast(`${spec.label} takes up to ${spec.max}.`, "warning");
                    setPickerOpen(false);
                  }}
                  onClose={() => setPickerOpen(false)}
                />
              ) : null}
            </span>
          </span>
        ) : null}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept={acceptFor(spec)}
        multiple={spec.max > 1}
        hidden
        onChange={(e) => {
          if (e.target.files?.length) void addFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

export function MediaRoles({ model }: { model: ModelSpec }) {
  return (
    <div className="media-roles" aria-label="Media inputs">
      {model.media.map((spec) => (
        <RoleSlot key={spec.role} spec={spec} model={model} />
      ))}
    </div>
  );
}
