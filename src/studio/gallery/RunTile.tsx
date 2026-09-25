"use client";

import type { Run } from "@/db/types";
import { PROVIDER_LABELS } from "@/providers/types";
import { retryRun, dismissRun } from "@/generation/lifecycle";
import { findModel } from "@/providers";
import { useModelStore } from "@/stores/model";
import { usePromptStore } from "@/stores/prompt";
import { useUiStore } from "@/stores/ui";
import { refsFromAsset } from "./useAssetActions";

export function RunTile({ run }: { run: Run }) {
  const selectModel = useModelStore((s) => s.select);
  const applySettings = useModelStore((s) => s.applySettings);
  const restorePrompt = usePromptStore((s) => s.restore);
  const setKind = useUiStore((s) => s.setKind);

  const edit = () => {
    const model = findModel(`${run.provider}:${run.modelId}`);
    if (model) {
      selectModel(model);
      applySettings(model, run.input.settings);
      setKind(model.kind);
    }
    restorePrompt({ prompt: run.input.prompt, negativePrompt: run.input.negativePrompt, seed: run.input.seed, media: refsFromAsset({ media: run.input.media, mediaRefs: run.mediaRefs }) });
    void dismissRun(run);
  };

  if (run.status === "failed") {
    return (
      <article className="tile tile-failed" data-kind={run.kind}>
        <div className="tile-failed-body">
          <span className="badge" data-tone={run.errorCode === "nsfw" ? "warning" : "danger"}>
            {run.errorCode === "nsfw" ? "moderated" : run.errorCode === "auth" ? "key" : run.errorCode === "rate_limit" ? "rate limit" : "failed"}
          </span>
          <p className="tile-failed-reason">{run.error ?? "Generation failed."}</p>
          <p className="tile-failed-prompt">{run.input.prompt}</p>
        </div>
        <div className="tile-failed-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => void retryRun(run)}>
            Retry
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={edit}>
            Edit
          </button>
          <span className="tile-actions-spacer" />
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void dismissRun(run)} aria-label="Dismiss">
            ×
          </button>
        </div>
      </article>
    );
  }

  const pct = run.status === "running" && typeof run.progress === "number" ? Math.round(run.progress * 100) : null;
  return (
    <article className="tile tile-skeleton skeleton" data-kind={run.kind} aria-busy="true" aria-label={`${run.status} — ${run.input.prompt.slice(0, 60)}`}>
      <div className="tile-skeleton-body">
        <span className="tile-skeleton-state num">
          {run.status === "queued" ? "Queued" : "Rendering"}
          {pct !== null ? ` · ${pct}%` : ""}
        </span>
        <span className="tile-skeleton-meta">{PROVIDER_LABELS[run.provider]}</span>
      </div>
      <button type="button" className="btn btn-ghost btn-sm tile-skeleton-cancel" onClick={() => void dismissRun(run)} aria-label="Cancel run">
        ×
      </button>
    </article>
  );
}
