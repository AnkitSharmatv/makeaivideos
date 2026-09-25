"use client";

import { useEffect, useRef } from "react";
import { useUiStore, type Toast } from "@/stores/ui";

const AUTO_MS = 4000;

function ToastItem({ t }: { t: Toast }) {
  const dismiss = useUiStore((s) => s.dismissToast);
  const remaining = useRef(AUTO_MS);
  const started = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const arm = () => {
      started.current = Date.now();
      timer.current = setTimeout(() => dismiss(t.id), remaining.current);
    };
    arm();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [dismiss, t.id]);

  const pause = () => {
    if (timer.current) clearTimeout(timer.current);
    remaining.current = Math.max(500, remaining.current - (Date.now() - started.current));
  };
  const resume = () => {
    started.current = Date.now();
    timer.current = setTimeout(() => dismiss(t.id), remaining.current);
  };

  return (
    <div className="toast" data-kind={t.kind} role="status" onMouseEnter={pause} onMouseLeave={resume}>
      <span className="toast-text">{t.text}</span>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => dismiss(t.id)} aria-label="Dismiss">
        ×
      </button>
    </div>
  );
}

export function Toasts() {
  const toasts = useUiStore((s) => s.toasts);
  if (toasts.length === 0) return null;
  return (
    <div className="toast-region" aria-live="polite">
      {toasts.map((t) => (
        <ToastItem key={t.id} t={t} />
      ))}
    </div>
  );
}
