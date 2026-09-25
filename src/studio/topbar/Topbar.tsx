"use client";

import { APP_NAME } from "@/config";
import { useUiStore } from "@/stores/ui";
import { useKeysStore } from "@/stores/keys";
import { useLibraryStore } from "@/stores/library";
import { useProjectsStore } from "@/stores/projects";
import { Lamp } from "./Lamp";
import type { LampState } from "@/stores/ui";
import type { User } from "@/server/auth";
import { AccountMenu } from "../auth/AccountMenu";
import { Wallet } from "./Wallet";

export function Topbar({ user, licensee, onSignedOut }: { user: User; licensee?: string | null; onSignedOut: () => void }) {
  const openKeyModal = useUiStore((s) => s.openKeyModal);
  const keyStatus = useKeysStore((s) => s.status);
  const runs = useLibraryStore((s) => s.runs);
  const currentId = useProjectsStore((s) => s.currentId);

  const anyKey = !!keyStatus && Object.values(keyStatus).some(Boolean);
  const scoped = currentId ? runs.filter((r) => r.projectId === currentId) : runs;
  const live = scoped.some((r) => r.status === "queued" || r.status === "running");
  const failed = scoped.some((r) => r.status === "failed");
  const state: LampState = live ? "live" : failed ? "error" : anyKey ? "held" : "none";
  const liveCount = scoped.filter((r) => r.status !== "failed").length;
  const label = state === "live" ? `Generating ${liveCount > 1 ? `· ${liveCount}` : ""}`.trim() : state === "error" ? "Run failed" : undefined;

  return (
    <header className="topbar">
      <div className="topbar-left">
        <span className="wordmark">{APP_NAME}</span>
      </div>
      <div className="topbar-right">
        <Wallet />
        <Lamp state={state} label={label} />
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => openKeyModal("manage")} data-key-trigger>
          Keys
        </button>
        <AccountMenu user={user} licensee={licensee} onSignedOut={onSignedOut} />
      </div>
    </header>
  );
}
