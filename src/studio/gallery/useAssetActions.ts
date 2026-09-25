"use client";

import { useCallback } from "react";
import type { Asset, MediaRefs } from "@/db/types";
import { useLibraryStore } from "@/stores/library";
import { useUndoStore } from "@/stores/undo";
import { useUiStore } from "@/stores/ui";
import { usePromptStore } from "@/stores/prompt";
import { useModelStore } from "@/stores/model";
import { useProjectsStore } from "@/stores/projects";
import { findModel } from "@/providers";

/** Prefer the original refs (re-uploadable); fall back to the URLs that were sent. */
export function refsFromAsset(a: Pick<Asset, "media" | "mediaRefs">): MediaRefs {
  if (a.mediaRefs && Object.keys(a.mediaRefs).length) return a.mediaRefs;
  const out: MediaRefs = {};
  for (const [role, urls] of Object.entries(a.media ?? {})) {
    if (urls?.length) out[role as keyof MediaRefs] = urls.map((url) => ({ type: "url", url }));
  }
  return out;
}

export function useAssetActions() {
  const stageRemove = useLibraryStore((s) => s.stageRemove);
  const restoreAssets = useLibraryStore((s) => s.restoreAssets);
  const commitRemove = useLibraryStore((s) => s.commitRemove);
  const setFavorite = useLibraryStore((s) => s.setFavorite);
  const moveAssets = useLibraryStore((s) => s.moveAssets);
  const pushUndo = useUndoStore((s) => s.push);
  const toast = useUiStore((s) => s.toast);
  const setKind = useUiStore((s) => s.setKind);
  const restorePrompt = usePromptStore((s) => s.restore);
  const selectModel = useModelStore((s) => s.select);
  const applySettings = useModelStore((s) => s.applySettings);
  const projects = useProjectsStore((s) => s.projects);

  const remove = useCallback(
    (assets: Asset[]) => {
      if (assets.length === 0) return;
      const ids = assets.map((a) => a.id);
      const removed = stageRemove(ids);
      pushUndo(
        removed.length === 1 ? "Deleted 1 item" : `Deleted ${removed.length} items`,
        () => restoreAssets(removed),
        () => commitRemove(ids),
      );
    },
    [stageRemove, restoreAssets, commitRemove, pushUndo],
  );

  const toggleFavorite = useCallback(
    (assets: Asset[]) => {
      const allFav = assets.every((a) => a.favorite === 1);
      void setFavorite(
        assets.map((a) => a.id),
        !allFav,
      );
    },
    [setFavorite],
  );

  const move = useCallback(
    (assets: Asset[], projectId: string) => {
      const target = projects.find((p) => p.id === projectId);
      if (!target) return;
      void moveAssets(
        assets.map((a) => a.id),
        projectId,
      );
      toast(`Moved ${assets.length === 1 ? "1 item" : `${assets.length} items`} to “${target.name}”.`, "success");
    },
    [moveAssets, projects, toast],
  );

  /** Restores model + settings + prompt + media into the composer. */
  const reuse = useCallback(
    (asset: Asset) => {
      const model = findModel(`${asset.provider}:${asset.modelId}`);
      if (model) {
        selectModel(model);
        applySettings(model, asset.settings);
        setKind(model.kind);
      } else {
        toast("That model is no longer in the catalog; restored the prompt only.", "warning");
      }
      restorePrompt({ prompt: asset.prompt, negativePrompt: asset.negativePrompt, seed: asset.seed, media: refsFromAsset(asset) });
    },
    [selectModel, applySettings, setKind, restorePrompt, toast],
  );

  return { remove, toggleFavorite, move, reuse };
}
