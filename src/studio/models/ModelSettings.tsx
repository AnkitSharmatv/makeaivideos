"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { allModels, modelKey, getProvider } from "@/providers";
import { PROVIDER_IDS, PROVIDER_LABELS, type MediaKind, type ModelSpec } from "@/providers/types";
import { useModelStore } from "@/stores/model";
import { useKeysStore } from "@/stores/keys";
import { useUiStore } from "@/stores/ui";
import { baselinePrice, formatPrice } from "@/generation/pricing";

type Row = { model: ModelSpec; key: string };

/** Default-settings price, plus the per-second note for video models billed by duration. */
function PriceTag({ model }: { model: ModelSpec }) {
  const p = baselinePrice(model);
  if (!p) return <span className="model-price model-price-none">quoted live</span>;
  const defaults = model.settings.find((s) => s.key === "duration");
  const perSecond = model.kind === "video" && !!defaults;
  return (
    <span className="model-price num" title={perSecond ? "At this model's default duration and settings" : "At this model's default settings"}>
      {formatPrice(p)}
      {perSecond ? <span className="model-price-unit">/ default clip</span> : null}
    </span>
  );
}

/** Account-level: which models appear in the composer's picker. Everything is on until switched off. */
export function ModelSettings() {
  const close = useUiStore((s) => s.closeModelSettings);
  const openKeyModal = useUiStore((s) => s.openKeyModal);
  const disabled = useModelStore((s) => s.disabled);
  const setEnabled = useModelStore((s) => s.setEnabled);
  const keyStatus = useKeysStore((s) => s.status);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<MediaKind | "all">("all");
  const [sort, setSort] = useState<"name" | "price">("name");
  const titleId = useId();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [close]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = allModels()
      .filter((m) => (kind === "all" || m.kind === kind) && (!q || `${m.name} ${m.id} ${PROVIDER_LABELS[m.provider]}`.toLowerCase().includes(q)))
      .map((model) => ({ model, key: modelKey(model) }))
      .sort((a, b) => {
        if (sort !== "price") return 0;
        // Cheapest first; models without a published rate go last.
        const pa = baselinePrice(a.model)?.usd ?? Infinity;
        const pb = baselinePrice(b.model)?.usd ?? Infinity;
        return pa - pb;
      });
    return PROVIDER_IDS.map((provider) => ({
      provider,
      image: rows.filter((r) => r.model.provider === provider && r.model.kind === "image"),
      video: rows.filter((r) => r.model.provider === provider && r.model.kind === "video"),
    })).filter((g) => g.image.length + g.video.length > 0);
  }, [query, kind, sort]);

  const isOn = (key: string) => !disabled.includes(key);
  const countOn = (rows: Row[]) => rows.filter((r) => isOn(r.key)).length;
  const toggleMany = (rows: Row[], on: boolean) =>
    setEnabled(
      rows.map((r) => r.key),
      on,
    );

  const section = (rows: Row[], label: string) =>
    rows.length === 0 ? null : (
      <div className="models-kind" key={label}>
        <div className="models-kind-head">
          <span className="eyebrow">
            {label} · <span className="num">{countOn(rows)}</span> of <span className="num">{rows.length}</span> on
          </span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => toggleMany(rows, countOn(rows) < rows.length)}>
            {countOn(rows) < rows.length ? "Enable all" : "Disable all"}
          </button>
        </div>
        <ul className="models-list">
          {rows.map(({ model, key }) => (
            <li key={key}>
              <button
                type="button"
                className="toggle model-toggle"
                role="switch"
                aria-checked={isOn(key)}
                onClick={() => setEnabled([key], !isOn(key))}
                title={model.notes}
              >
                <i aria-hidden="true" />
                <span className="model-toggle-name">{model.name}</span>
                <PriceTag model={model} />
              </button>
            </li>
          ))}
        </ul>
      </div>
    );

  const total = allModels().length;
  const off = disabled.length;

  return (
    <>
      <div className="scrim" onClick={close} aria-hidden="true" />
      <div className="modal models-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="models-head">
          <div>
            <h2 className="modal-title" id={titleId}>
              Models
            </h2>
            <p className="modal-sub">
              Switch off what you don&apos;t use and the prompt bar&apos;s picker stays short. <span className="num">{total - off}</span> of{" "}
              <span className="num">{total}</span> on. Prices are for one run at each model&apos;s default settings.
            </p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={close} aria-label="Close">
            ×
          </button>
        </div>

        <div className="models-controls">
          <input className="input" placeholder="Search models…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search models" autoFocus />
          <div className="kind-switch" role="radiogroup" aria-label="Kind">
            {(["all", "image", "video"] as const).map((k) => (
              <button key={k} type="button" role="radio" aria-checked={kind === k} className="chip" onClick={() => setKind(k)}>
                {k === "all" ? "All" : k === "image" ? "Image" : "Video"}
              </button>
            ))}
          </div>
          <button type="button" className="chip" aria-pressed={sort === "price"} onClick={() => setSort((v) => (v === "price" ? "name" : "price"))} title="Sort by price, cheapest first">
            Cheapest first
          </button>
        </div>

        <div className="models-body">
          {groups.map((g) => {
            const rows = [...g.image, ...g.video];
            const held = !!keyStatus?.[g.provider];
            return (
              <section className="models-provider" key={g.provider}>
                <header className="models-provider-head">
                  <span className="models-provider-name">{PROVIDER_LABELS[g.provider]}</span>
                  <span className="help">
                    <span className="num">{countOn(rows)}</span> of <span className="num">{rows.length}</span> on
                  </span>
                  {held ? null : (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => openKeyModal("manage", g.provider)}>
                      Add key
                    </button>
                  )}
                  <span className="tile-actions-spacer" />
                  <a className="help" href={getProvider(g.provider).auth.consoleUrl} target="_blank" rel="noreferrer noopener">
                    docs ↗
                  </a>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => toggleMany(rows, countOn(rows) < rows.length)}>
                    {countOn(rows) < rows.length ? "Enable all" : "Disable all"}
                  </button>
                </header>
                {section(g.image, "Image")}
                {section(g.video, "Video")}
              </section>
            );
          })}
          {groups.length === 0 ? <p className="picker-empty">No models match “{query}”.</p> : null}
        </div>

        <div className="modal-actions models-foot">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() =>
              setEnabled(
                allModels().map((m) => modelKey(m)),
                false,
              )
            }
          >
            Turn everything off
          </button>
          <span className="tile-actions-spacer" />
          <button
            type="button"
            className="btn btn-secondary"
            disabled={off === 0}
            onClick={() =>
              setEnabled(
                allModels().map((m) => modelKey(m)),
                true,
              )
            }
          >
            Reset to all on
          </button>
          <button type="button" className="btn btn-primary" onClick={close}>
            Done
          </button>
        </div>
      </div>
    </>
  );
}
