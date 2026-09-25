"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { allModels, modelKey } from "@/providers";
import { PROVIDER_IDS, PROVIDER_LABELS, type MediaKind, type ModelSpec, type ProviderId } from "@/providers/types";
import { useKeysStore } from "@/stores/keys";
import { useModelStore } from "@/stores/model";
import { useUiStore } from "@/stores/ui";

type Props = {
  kind: MediaKind;
  selected: ModelSpec | null;
  onClose: () => void;
  onNeedKey: (provider: ProviderId) => void;
};

/** "Seedance 2.5" → { family: "seedance", version: 2.5, rest: "" } so families group and newer versions sort first. */
function nameParts(name: string): { family: string; version: number; rest: string } {
  const m = /^([^\d]*)(\d+(?:\.\d+)?)?(.*)$/.exec(name.toLowerCase());
  return { family: (m?.[1] ?? name).trim(), version: m?.[2] ? parseFloat(m[2]) : 0, rest: (m?.[3] ?? "").trim() };
}

function compareModels(a: ModelSpec, b: ModelSpec): number {
  const x = nameParts(a.name);
  const y = nameParts(b.name);
  if (x.family !== y.family) return x.family.localeCompare(y.family);
  if (x.version !== y.version) return y.version - x.version;
  return x.rest.localeCompare(y.rest);
}

function buildGroups(query: string, kind: MediaKind, keyStatus: Record<ProviderId, boolean> | null, disabled: string[] = []) {
  const q = query.trim().toLowerCase();
  const models = allModels()
    .filter((m) => m.kind === kind && !disabled.includes(modelKey(m)) && (!q || `${m.name} ${m.id} ${PROVIDER_LABELS[m.provider]}`.toLowerCase().includes(q)))
    .sort(compareModels);
  // Providers with a key first, then the rest, in the fixed provider order.
  const order = [...PROVIDER_IDS].sort((a, b) => Number(!!keyStatus?.[b]) - Number(!!keyStatus?.[a]));
  return order.map((p) => ({ provider: p, models: models.filter((m) => m.provider === p) })).filter((g) => g.models.length > 0);
}

export function ModelPicker({ kind, selected, onClose, onNeedKey }: Props) {
  const keyStatus = useKeysStore((s) => s.status);
  const select = useModelStore((s) => s.select);
  const disabled = useModelStore((s) => s.disabled);
  const setEnabled = useModelStore((s) => s.setEnabled);
  const openModelSettings = useUiStore((s) => s.openModelSettings);
  const hiddenCount = useMemo(() => allModels().filter((m) => m.kind === kind && disabled.includes(modelKey(m))).length, [kind, disabled]);
  const toast = useUiStore((s) => s.toast);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(() => {
    const all = buildGroups("", kind, keyStatus, []).flatMap((g) => g.models);
    const idx = selected ? all.findIndex((m) => modelKey(m) === modelKey(selected)) : 0;
    return Math.max(0, idx);
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const groups = useMemo(() => buildGroups(query, kind, keyStatus, disabled), [query, kind, keyStatus, disabled]);
  // A previously selected model that has since been switched off stays reachable.
  const hiddenSelected = selected && disabled.includes(modelKey(selected)) ? selected : null;

  const flat = useMemo(() => groups.flatMap((g) => g.models), [groups]);
  const indexOf = useMemo(() => new Map(flat.map((m, i) => [modelKey(m), i])), [flat]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);


  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${cursor}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  const choose = (m: ModelSpec) => {
    if (!keyStatus?.[m.provider]) {
      onNeedKey(m.provider);
      return;
    }
    const { dropped } = select(m);
    if (dropped.length) toast(`Switched to ${m.name}. Dropped: ${dropped.join(", ")}.`, "warning");
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(flat.length - 1, c + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(0, c - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const m = flat[cursor];
      if (m) choose(m);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div className="popover picker" role="dialog" aria-label="Choose a model" onKeyDown={onKeyDown}>
      <div className="picker-search">
        <input
          ref={inputRef}
          className="input"
          placeholder={`Search ${kind} models…`}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setCursor(0);
          }}
          aria-label="Search models"
        />
      </div>
      {hiddenSelected ? (
        <div className="picker-hidden-row">
          <span>
            <b>{hiddenSelected.name}</b> is switched off
          </span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEnabled([modelKey(hiddenSelected)], true)}>
            Re-enable
          </button>
        </div>
      ) : null}
      <div className="picker-list" role="listbox" ref={listRef} aria-activedescendant={flat[cursor] ? `opt-${modelKey(flat[cursor]).replace(/[^a-z0-9]/gi, "-")}` : undefined}>
        {groups.length === 0 ? (
          <div className="picker-empty">
            {query ? `No ${kind} models match “${query}”.` : `Every ${kind} model is switched off.`}
          </div>
        ) : null}
        {groups.map((g) => {
          const held = !!keyStatus?.[g.provider];
          return (
            <div key={g.provider} className="picker-group">
              <div className="picker-group-head">
                <span className="eyebrow">{PROVIDER_LABELS[g.provider]}</span>
                {!held ? <span className="badge">no key</span> : null}
              </div>
              {g.models.map((m) => {
                const i = indexOf.get(modelKey(m)) ?? 0;
                const isSel = selected ? modelKey(m) === modelKey(selected) : false;
                return (
                  <button
                    key={modelKey(m)}
                    id={`opt-${modelKey(m).replace(/[^a-z0-9]/gi, "-")}`}
                    type="button"
                    role="option"
                    aria-selected={isSel}
                    data-index={i}
                    className={`picker-row${isSel ? " is-selected" : ""}${i === cursor ? " is-cursor" : ""}${held ? "" : " is-dim"}`}
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => choose(m)}
                  >
                    <span className="picker-row-name">{m.name}</span>
                    <span className="picker-row-meta">
                      {m.media.some((r) => r.min > 0) ? <span className="badge">needs media</span> : null}
                      {m.notes ? <span className="picker-row-notes">{m.notes}</span> : null}
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
      <div className="picker-foot">
        <span className="help">{hiddenCount > 0 ? `${hiddenCount} ${kind} ${hiddenCount === 1 ? "model is" : "models are"} switched off` : ""}</span>
        <span className="tile-actions-spacer" />
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            onClose();
            openModelSettings();
          }}
        >
          Manage models
        </button>
      </div>
    </div>
  );
}
