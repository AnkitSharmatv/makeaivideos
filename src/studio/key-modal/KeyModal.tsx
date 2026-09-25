"use client";

import { useEffect, useId, useRef, useState } from "react";
import { PROVIDER_IDS, PROVIDER_LABELS, type ProviderId } from "@/providers/types";
import { allProviders } from "@/providers";
import { saveKey, removeKey } from "@/keys/actions";
import { useUiStore } from "@/stores/ui";
import { useKeysStore } from "@/stores/keys";

type Props = { mode: "gate" | "manage"; initialProvider?: ProviderId };

const AUTH = Object.fromEntries(allProviders().map((p) => [p.id, p.auth])) as Record<ProviderId, ReturnType<typeof allProviders>[number]["auth"]>;

function modelCount(id: ProviderId): number {
  return allProviders().find((p) => p.id === id)?.catalog.length ?? 0;
}

export function KeyModal({ mode, initialProvider }: Props) {
  const close = useUiStore((s) => s.closeKeyModal);
  const setGalleryTab = useUiStore((s) => s.setGalleryTab);
  const toast = useUiStore((s) => s.toast);
  const status = useKeysStore((s) => s.status);
  const setHeld = useKeysStore((s) => s.set);
  const refreshBalance = useKeysStore((s) => s.refreshBalance);
  const openModelSettings = useUiStore((s) => s.openModelSettings);
  const [provider, setProvider] = useState<ProviderId>(initialProvider ?? "kie");
  const [value, setValue] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState<ProviderId | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const helpId = useId();
  const gate = mode === "gate";

  useEffect(() => {
    const trigger = document.querySelector<HTMLElement>("[data-key-trigger]");
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !gate) {
        e.preventDefault();
        close();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      trigger?.focus();
    };
  }, [close, gate]);

  const auth = AUTH[provider];
  const held = !!status?.[provider];

  const onSave = async () => {
    if (!value.trim() || busy) return;
    setBusy(true);
    setError(null);
    const res = await saveKey(provider, value);
    setBusy(false);
    if (!res.ok) {
      setError(res.reason);
      return;
    }
    setHeld(provider, true);
    setValue("");
    void refreshBalance(provider);
    setJustSaved(provider);
    toast(`${PROVIDER_LABELS[provider]} key saved.`, "success");
    if (gate) {
      setGalleryTab("projects");
      close();
    }
  };

  const onRemove = async () => {
    setBusy(true);
    await removeKey(provider);
    setBusy(false);
    setHeld(provider, false);
    setValue("");
    setError(null);
    toast(`${PROVIDER_LABELS[provider]} key removed.`);
  };

  return (
    <>
      <div className="scrim" onClick={gate ? undefined : close} aria-hidden="true" />
      <div className="modal key-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 className="modal-title" id={titleId}>
          {gate ? "Add a provider key to start" : "Provider keys"}
        </h2>
        <p className="modal-sub">
          {gate
            ? "Pick the provider you have a key for. Keys are held in an httpOnly cookie on this device; the browser never calls a provider directly."
            : "One key per provider. Keys are held in an httpOnly cookie on this device; the browser never calls a provider directly."}
        </p>

        <div className="key-providers" role="radiogroup" aria-label="Provider">
          {PROVIDER_IDS.map((id) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={id === provider}
              className="chip"
              onClick={() => {
                setProvider(id);
                setValue("");
                setError(null);
                inputRef.current?.focus();
              }}
            >
              {PROVIDER_LABELS[id]}
              {status?.[id] ? <i className="chip-dot" aria-label="key held" /> : null}
            </button>
          ))}
        </div>

        <div className="field">
          <label className="label" htmlFor={`${titleId}-key`}>
            {PROVIDER_LABELS[provider]} API key
            {held ? <span className="label-note"> · a key is saved</span> : null}
          </label>
          <div className="key-input-row">
            <input
              ref={inputRef}
              id={`${titleId}-key`}
              className="input"
              type={show ? "text" : "password"}
              autoComplete="off"
              spellCheck={false}
              placeholder={held ? "Paste a new key to replace it" : auth.placeholder}
              value={value}
              aria-describedby={helpId}
              aria-invalid={error ? true : undefined}
              disabled={busy}
              onChange={(e) => {
                setValue(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void onSave();
                }
              }}
            />
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShow((s) => !s)} aria-pressed={show}>
              {show ? "Hide" : "Show"}
            </button>
          </div>
          <span className="help" id={helpId}>
            Sent as <span className="key-header">{auth.describeHeader}</span> ·{" "}
            <a href={auth.consoleUrl} target="_blank" rel="noreferrer">
              get a key
            </a>
          </span>
          {error ? (
            <span className="help is-error" role="alert">
              {error}
            </span>
          ) : null}
        </div>

        {justSaved ? (
          <p className="help key-saved-hint">
            {modelCount(justSaved)} {PROVIDER_LABELS[justSaved]} models are available.{" "}
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                close();
                openModelSettings();
              }}
            >
              Choose which to show
            </button>
          </p>
        ) : null}
        <div className="modal-actions">
          {held ? (
            <button type="button" className="btn btn-danger" onClick={() => void onRemove()} disabled={busy}>
              Remove key
            </button>
          ) : null}
          <span className="modal-actions-spacer" />
          {!gate ? (
            <button type="button" className="btn btn-ghost" onClick={close} disabled={busy}>
              {held || (status && Object.values(status).some(Boolean)) ? "Done" : "Cancel"}
            </button>
          ) : null}
          <button
            type="button"
            className={`btn btn-primary${busy ? " is-loading" : ""}`}
            disabled={value.trim().length === 0 || busy}
            onClick={() => void onSave()}
          >
            <span>Save key</span>
          </button>
        </div>
      </div>
    </>
  );
}
