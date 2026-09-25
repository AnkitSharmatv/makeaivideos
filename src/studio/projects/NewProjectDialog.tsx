"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useUiStore } from "@/stores/ui";
import { useProjectsStore } from "@/stores/projects";

export function NewProjectDialog() {
  const setOpen = useUiStore((s) => s.setNewProjectOpen);
  const create = useProjectsStore((s) => s.create);
  const open = useProjectsStore((s) => s.open);
  const setGalleryTab = useUiStore((s) => s.setGalleryTab);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [setOpen]);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    const p = await create(name);
    open(p.id);
    setGalleryTab("projects");
    setBusy(false);
    setOpen(false);
  };

  return (
    <>
      <div className="scrim" onClick={() => setOpen(false)} aria-hidden="true" />
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 className="modal-title" id={titleId}>
          New project
        </h2>
        <p className="modal-sub">Everything you generate lands in the project that is open.</p>
        <div className="field" style={{ marginTop: "var(--space-4)" }}>
          <label className="label" htmlFor={`${titleId}-name`}>
            Name
          </label>
          <input
            ref={inputRef}
            id={`${titleId}-name`}
            className="input"
            value={name}
            placeholder="Spring campaign"
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void submit();
              }
            }}
          />
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
            Cancel
          </button>
          <button type="button" className={`btn btn-primary${busy ? " is-loading" : ""}`} onClick={() => void submit()} disabled={busy}>
            <span>Create project</span>
          </button>
        </div>
      </div>
    </>
  );
}
