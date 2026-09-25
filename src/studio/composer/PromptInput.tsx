"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { usePromptStore } from "@/stores/prompt";

const MAX_LINES = 6;

export type TagSuggestion = { tag: string; label: string; thumb?: string; video?: boolean };

type Props = {
  onSubmit: () => void;
  disabled?: boolean;
  /** `@` completions: attached references, in slot order. */
  suggestions?: TagSuggestion[];
  /** The selected model takes reference images, so `@imageN` means something. */
  tagsEnabled?: boolean;
};

const TAG_RX = /@image\d+\b/gi;

/**
 * The textarea's text is transparent; this mirror renders the same string
 * behind it with the tags marked up. Both must share every metric.
 */
function highlight(text: string, valid: Set<string>): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  TAG_RX.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TAG_RX.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const known = valid.has(m[0].toLowerCase());
    out.push(
      <mark key={m.index} className={known ? "tag-mark" : "tag-mark is-unknown"}>
        {m[0]}
      </mark>,
    );
    last = m.index + m[0].length;
  }
  // A trailing newline needs something after it or the last line has no height.
  out.push(text.slice(last) + (text.endsWith("\n") ? " " : ""));
  return out;
}

export function PromptInput({ onSubmit, disabled, suggestions = [], tagsEnabled = false }: Props) {
  const prompt = usePromptStore((s) => s.prompt);
  const setPrompt = usePromptStore((s) => s.setPrompt);
  const focusRequest = usePromptStore((s) => s.focusRequest);
  const ref = useRef<HTMLTextAreaElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<{ start: number; query: string } | null>(null);
  const [cursor, setCursor] = useState(0);

  // Auto-grow to MAX_LINES, then scroll. Re-measured on prompt change and resize.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      const cs = getComputedStyle(el);
      const line = parseFloat(cs.lineHeight);
      const pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      const max = line * MAX_LINES + pad;
      el.style.height = "auto";
      const next = Math.min(el.scrollHeight, max);
      el.style.height = `${next}px`;
      el.style.overflowY = el.scrollHeight > max ? "auto" : "hidden";
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el.parentElement ?? el);
    return () => ro.disconnect();
  }, [prompt]);

  useEffect(() => {
    if (focusRequest === 0) return;
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [focusRequest]);

  const matches = menu ? suggestions.filter((s) => s.tag.toLowerCase().startsWith(`@${menu.query.toLowerCase()}`)) : [];
  const validTags = useMemo(() => new Set(suggestions.map((s) => s.tag.toLowerCase())), [suggestions]);
  const marks = useMemo(() => (tagsEnabled ? highlight(prompt, validTags) : null), [tagsEnabled, prompt, validTags]);

  // Keep the mirror aligned when the textarea scrolls past six lines.
  const syncScroll = () => {
    const el = ref.current;
    const mirror = mirrorRef.current;
    if (el && mirror) mirror.scrollTop = el.scrollTop;
  };

  /** Open the menu when the caret sits right after `@word`. */
  const detect = (el: HTMLTextAreaElement) => {
    if (suggestions.length === 0) return setMenu(null);
    const before = el.value.slice(0, el.selectionStart);
    const m = /(^|\s)@(\w*)$/.exec(before);
    if (!m) return setMenu(null);
    setMenu({ start: before.length - m[2].length - 1, query: m[2] });
    setCursor(0);
  };

  const insert = (s: TagSuggestion) => {
    const el = ref.current;
    if (!el || !menu) return;
    const end = el.selectionStart;
    const next = `${prompt.slice(0, menu.start)}${s.tag} ${prompt.slice(end)}`;
    setPrompt(next);
    setMenu(null);
    const caret = menu.start + s.tag.length + 1;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(caret, caret);
    });
  };

  return (
    <div className="prompt-wrap">
      <div className={`prompt-field${marks ? " is-highlighted" : ""}`}>
        {marks ? (
          <div className="prompt-highlight" ref={mirrorRef} aria-hidden="true">
            {marks}
          </div>
        ) : null}
        <textarea
        ref={ref}
        className="input prompt-input"
        rows={2}
        value={prompt}
        placeholder={suggestions.length ? "Describe what you want… type @ to mention an attached image" : "Describe the image or video you want…"}
        aria-label="Prompt"
        aria-autocomplete={suggestions.length ? "list" : undefined}
        disabled={disabled}
        spellCheck
        onChange={(e) => {
          setPrompt(e.target.value);
          detect(e.target);
          syncScroll();
        }}
        onScroll={syncScroll}
        onClick={(e) => detect(e.currentTarget)}
        onBlur={() => setTimeout(() => setMenu(null), 120)}
        onKeyDown={(e) => {
          if (menu && matches.length > 0) {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setCursor((c) => (c + 1) % matches.length);
              return;
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setCursor((c) => (c - 1 + matches.length) % matches.length);
              return;
            }
            if (e.key === "Enter" || e.key === "Tab") {
              e.preventDefault();
              insert(matches[cursor] ?? matches[0]!);
              return;
            }
            if (e.key === "Escape") {
              e.preventDefault();
              setMenu(null);
              return;
            }
          }
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            onSubmit();
          }
        }}
        />
      </div>
      {menu && matches.length > 0 ? (
        <ul className="popover tag-menu" role="listbox" aria-label="Attached images">
          {matches.map((s, i) => (
            <li
              key={s.tag}
              role="option"
              aria-selected={i === cursor}
              className={`tag-option${i === cursor ? " is-cursor" : ""}`}
              onMouseDown={(e) => {
                e.preventDefault();
                insert(s);
              }}
              onMouseEnter={() => setCursor(i)}
            >
              {s.thumb ? (
                s.video ? (
                  <video src={s.thumb} muted playsInline preload="metadata" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.thumb} alt="" />
                )
              ) : (
                <span className="tag-option-blank" />
              )}
              <span className="tag-option-tag">{s.tag}</span>
              <span className="tag-option-label">{s.label}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
