"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useKeysStore, type BalanceInfo } from "@/stores/keys";
import { useModelStore } from "@/stores/model";
import { useUiStore } from "@/stores/ui";
import { getProvider } from "@/providers";
import { PROVIDER_IDS, PROVIDER_LABELS, type ProviderId } from "@/providers/types";
import { formatCredits, formatUsd } from "@/generation/pricing";

const STALE_MS = 5 * 60_000;
/** Below this the lamp turns amber — enough for a couple of video runs, no more. */
const LOW_USD = 1;

function usdOf(info: BalanceInfo | undefined): number | null {
  return info && !("unavailable" in info) && info.usd !== undefined ? info.usd : null;
}

function WalletIcon() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" focusable="false">
      <path
        d="M2 4.5A1.5 1.5 0 0 1 3.5 3h8A1.5 1.5 0 0 1 13 4.5V5h.5A1.5 1.5 0 0 1 15 6.5v5A1.5 1.5 0 0 1 13.5 13h-10A1.5 1.5 0 0 1 2 11.5v-7Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <circle cx="11.5" cy="9" r="1" fill="currentColor" />
    </svg>
  );
}

function Row({ id, active }: { id: ProviderId; active: boolean }) {
  const info = useKeysStore((s) => s.balances[id]);
  const refreshBalance = useKeysStore((s) => s.refreshBalance);
  const p = getProvider(id);
  const hasEndpoint = !!p.balance;

  useEffect(() => {
    if (!hasEndpoint) return;
    if (!info || Date.now() - info.at > STALE_MS) void refreshBalance(id);
  }, [id, info, hasEndpoint, refreshBalance]);

  const usd = usdOf(info);
  const credits = info && !("unavailable" in info) ? info.credits : undefined;
  const low = usd !== null && usd < LOW_USD;

  return (
    <div className={`wallet-row${active ? " is-active" : ""}`}>
      <div className="wallet-row-head">
        <span className="wallet-row-name">{PROVIDER_LABELS[id]}</span>
        {active ? <span className="badge">in use</span> : null}
      </div>
      <div className="wallet-row-body">
        {hasEndpoint ? (
          usd !== null ? (
            <button type="button" className={`wallet-amount num${low ? " is-low" : ""}`} onClick={() => void refreshBalance(id)} title="Refresh">
              {credits !== undefined ? (
                <>
                  <b>{formatCredits(credits)}</b> cr <span className="wallet-usd">≈ {formatUsd(usd)}</span>
                </>
              ) : (
                <b>{formatUsd(usd)}</b>
              )}
            </button>
          ) : info ? (
            <span className="wallet-amount wallet-dim">balance unavailable</span>
          ) : (
            <span className="wallet-amount wallet-dim num">…</span>
          )
        ) : (
          <a className="wallet-amount wallet-dim" href={p.auth.consoleUrl} target="_blank" rel="noreferrer noopener">
            check in console ↗
          </a>
        )}
        <a className="btn btn-secondary btn-sm" href={p.auth.rechargeUrl} target="_blank" rel="noreferrer noopener">
          Recharge
        </a>
      </div>
    </div>
  );
}

/** Wallet icon in the topbar; the balances and Recharge links live in its dropdown. */
export function Wallet() {
  const kind = useUiStore((s) => s.kind);
  const openKeyModal = useUiStore((s) => s.openKeyModal);
  const selectedKeys = useModelStore((s) => s.selected);
  const modelFor = useModelStore((s) => s.modelFor);
  const status = useKeysStore((s) => s.status);
  const balances = useKeysStore((s) => s.balances);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const model = selectedKeys[kind] ? modelFor(kind) : null;
  const held = useMemo(() => PROVIDER_IDS.filter((id) => status?.[id]), [status]);
  // Active provider first.
  const ordered = useMemo(() => [...held].sort((a, b) => Number(b === model?.provider) - Number(a === model?.provider)), [held, model?.provider]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (held.length === 0) return null;

  // The trigger shows the active provider's balance only, so the bar stays quiet.
  const activeId = ordered[0]!;
  const activeUsd = usdOf(balances[activeId]);
  const low = activeUsd !== null && activeUsd < LOW_USD;
  const activeCredits = balances[activeId] && !("unavailable" in balances[activeId]!) ? balances[activeId]!.credits : undefined;
  const short = activeUsd === null ? null : activeCredits !== undefined ? `${formatCredits(activeCredits)} cr` : formatUsd(activeUsd);

  return (
    <div className="wallet" ref={ref}>
      <button
        type="button"
        className={`btn btn-ghost btn-sm wallet-trigger${low ? " is-low" : ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        title={`Balance${short ? ` — ${PROVIDER_LABELS[activeId]}: ${short}` : ""}`}
      >
        <WalletIcon />
        {short ? <span className="wallet-trigger-value num">{short}</span> : null}
        <span className="caret" aria-hidden="true">
          ▾
        </span>
      </button>
      {open ? (
        <div className="popover wallet-menu" role="menu" aria-label="Balances">
          <div className="wallet-menu-head eyebrow">Balance</div>
          {ordered.map((id) => (
            <Row key={id} id={id} active={id === model?.provider} />
          ))}
          {held.length < PROVIDER_IDS.length ? (
            <button
              type="button"
              className="move-menu-row wallet-add"
              onClick={() => {
                setOpen(false);
                openKeyModal("manage");
              }}
            >
              Add another provider key
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
