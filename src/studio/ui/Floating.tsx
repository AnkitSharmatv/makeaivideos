"use client";

import { useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";

type Props = { anchor: HTMLElement | null; children: React.ReactNode; className?: string; width?: number };

/**
 * Renders children in a portal, fixed just above (or below) the anchor,
 * so menus inside overflow-hidden tiles aren't clipped.
 */
export function Floating({ anchor, children, className, width = 240 }: Props) {
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number } | null>(null);

  useLayoutEffect(() => {
    if (!anchor) return;
    const place = () => {
      const r = anchor.getBoundingClientRect();
      const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
      // Prefer above; fall back below when there's no room.
      if (r.top > 260) setPos({ left, bottom: window.innerHeight - r.top + 4 });
      else setPos({ left, top: r.bottom + 4 });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [anchor, width]);

  if (!anchor || !pos) return null;
  return createPortal(
    <div className={`floating ${className ?? ""}`} style={{ position: "fixed", zIndex: 60, width, ...pos }}>
      {children}
    </div>,
    document.body,
  );
}
