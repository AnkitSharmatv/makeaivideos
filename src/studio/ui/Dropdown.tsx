"use client";

import { useEffect, useId, useRef, useState } from "react";

type Props = {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  /** Optional display transform for option text. */
  render?: (v: string) => string;
};

/** Compact listbox: a chip-sized trigger with a popover list. Arrow keys, Home/End, Enter, Esc, type-ahead. */
export function Dropdown({ label, value, options, onChange, render }: Props) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(Math.max(0, options.indexOf(value)));
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const typeahead = useRef({ buf: "", at: 0 });
  const id = useId();
  const show = render ?? ((v: string) => v);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.focus();
    listRef.current?.querySelector<HTMLElement>(`[data-index="${cursor}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, cursor]);

  const openAt = () => {
    setCursor(Math.max(0, options.indexOf(value)));
    setOpen(true);
  };

  const choose = (v: string) => {
    onChange(v);
    setOpen(false);
    wrapRef.current?.querySelector<HTMLElement>("button")?.focus();
  };

  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(options.length - 1, c + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(0, c - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setCursor(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setCursor(options.length - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const v = options[cursor];
      if (v !== undefined) choose(v);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      wrapRef.current?.querySelector<HTMLElement>("button")?.focus();
    } else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
      const now = e.timeStamp;
      const t = typeahead.current;
      t.buf = now - t.at < 600 ? t.buf + e.key : e.key;
      t.at = now;
      const i = options.findIndex((o) => show(o).toLowerCase().startsWith(t.buf.toLowerCase()));
      if (i >= 0) setCursor(i);
    }
  };

  return (
    <div className="dropdown" ref={wrapRef}>
      <button
        type="button"
        className="chip dropdown-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${id}-list` : undefined}
        onClick={() => (open ? setOpen(false) : openAt())}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            openAt();
          }
        }}
      >
        <span className="dropdown-label">{label}</span>
        <span className="dropdown-value num">{show(value)}</span>
        <span className="caret" aria-hidden="true">
          ▾
        </span>
      </button>
      {open ? (
        <ul
          id={`${id}-list`}
          ref={listRef}
          className="popover dropdown-list"
          role="listbox"
          aria-label={label}
          tabIndex={-1}
          aria-activedescendant={`${id}-opt-${cursor}`}
          onKeyDown={onListKey}
        >
          {options.map((o, i) => (
            <li
              key={o}
              id={`${id}-opt-${i}`}
              role="option"
              aria-selected={o === value}
              data-index={i}
              className={`dropdown-option num${i === cursor ? " is-cursor" : ""}`}
              onMouseEnter={() => setCursor(i)}
              onClick={() => choose(o)}
            >
              {show(o)}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
