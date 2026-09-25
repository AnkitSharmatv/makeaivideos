"use client";

import { useEffect } from "react";
import { useUndoStore } from "@/stores/undo";

const UNDO_MS = 6000;

export function UndoBar() {
  const pending = useUndoStore((s) => s.pending);
  const runUndo = useUndoStore((s) => s.runUndo);
  const expire = useUndoStore((s) => s.expire);

  useEffect(() => {
    if (!pending) return;
    const t = setTimeout(() => void expire(), UNDO_MS);
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        void runUndo();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
    };
  }, [pending, expire, runUndo]);

  if (!pending) return null;
  return (
    <div className="undo-bar" role="status" key={pending.id}>
      <i className="undo-drain" aria-hidden="true" />
      <span>{pending.label}</span>
      <button type="button" className="btn btn-ghost btn-sm undo-btn" onClick={() => void runUndo()}>
        Undo
      </button>
    </div>
  );
}
