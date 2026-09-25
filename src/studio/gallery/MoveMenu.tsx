"use client";

import { useEffect, useRef } from "react";
import { useProjectsStore } from "@/stores/projects";
import { Floating } from "../ui/Floating";

type Props = { excludeProjectId?: string; anchor?: HTMLElement | null; onPick: (projectId: string) => void; onClose: () => void };

export function MoveMenu({ excludeProjectId, anchor = null, onPick, onClose }: Props) {
  const projects = useProjectsStore((s) => s.projects);
  const ref = useRef<HTMLDivElement>(null);
  const options = projects.filter((p) => p.id !== excludeProjectId);

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
    ref.current?.querySelector<HTMLElement>("button")?.focus();
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [onClose, anchor]);

  return (
    <Floating anchor={anchor} width={200}>
    <div className="popover move-menu" ref={ref} role="menu" aria-label="Move to project">
      <div className="move-menu-head eyebrow">Move to</div>
      {options.length === 0 ? <div className="picker-empty">No other projects yet.</div> : null}
      {options.map((p) => (
        <button key={p.id} type="button" role="menuitem" className="move-menu-row" onClick={() => onPick(p.id)}>
          {p.name}
        </button>
      ))}
    </div>
    </Floating>
  );
}
