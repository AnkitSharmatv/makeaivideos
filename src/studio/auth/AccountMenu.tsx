"use client";

import { useEffect, useRef, useState } from "react";
import { signOut, updatePassword } from "@/auth/actions";
import type { User } from "@/server/auth";
import { useUiStore } from "@/stores/ui";

type Props = { user: User; licensee?: string | null; onSignedOut: () => void };

export function AccountMenu({ user, licensee, onSignedOut }: Props) {
  const [open, setOpen] = useState(false);
  const [changing, setChanging] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState<string | null>(null);
  const toast = useUiStore((s) => s.toast);
  const openModelSettings = useUiStore((s) => s.openModelSettings);
  const ref = useRef<HTMLDivElement>(null);

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

  const change = async () => {
    const res = await updatePassword(current, next);
    if (!res.ok) {
      setError(res.reason);
      return;
    }
    setChanging(false);
    setCurrent("");
    setNext("");
    setError(null);
    toast("Password changed.", "success");
  };

  return (
    <div className="account" ref={ref}>
      <button type="button" className="btn btn-ghost btn-sm" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {user.name || user.email}
      </button>
      {open ? (
        <div className="popover account-menu" role="menu">
          <div className="account-menu-head">
            <span className="account-name">{user.name}</span>
            <span className="account-email">{user.email}</span>
            {licensee ? <span className="account-licensee">Licensed to {licensee}</span> : null}
          </div>
          <button
            type="button"
            role="menuitem"
            className="move-menu-row"
            onClick={() => {
              setOpen(false);
              openModelSettings();
            }}
          >
            Models
          </button>
          {changing ? (
            <div className="account-change">
              <input className="input" type="password" placeholder="Current password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
              <input className="input" type="password" placeholder="New password (8+)" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
              {error ? <span className="help is-error">{error}</span> : null}
              <div className="account-change-actions">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setChanging(false)}>
                  Cancel
                </button>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => void change()} disabled={!current || next.length < 8}>
                  Save
                </button>
              </div>
            </div>
          ) : (
            <button type="button" role="menuitem" className="move-menu-row" onClick={() => setChanging(true)}>
              Change password
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            className="move-menu-row"
            onClick={async () => {
              await signOut();
              onSignedOut();
            }}
          >
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
