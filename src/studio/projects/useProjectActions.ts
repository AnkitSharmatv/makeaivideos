"use client";

import { useCallback } from "react";
import type { Project } from "@/db/types";
import * as api from "@/data/actions";
import { useProjectsStore } from "@/stores/projects";
import { useLibraryStore } from "@/stores/library";
import { useUploadsStore } from "@/stores/uploads";
import { useUndoStore } from "@/stores/undo";
import { useUiStore } from "@/stores/ui";
import { dismissRun } from "@/generation/lifecycle";

export function useProjectActions() {
  const renameStore = useProjectsStore((s) => s.rename);
  const stage = useProjectsStore((s) => s.stage);
  const restore = useProjectsStore((s) => s.restore);
  const pushUndo = useUndoStore((s) => s.push);
  const toast = useUiStore((s) => s.toast);

  const rename = useCallback(
    async (id: string, name: string) => {
      await renameStore(id, name);
    },
    [renameStore],
  );

  const remove = useCallback(
    async (project: Project) => {
      const lib = useLibraryStore.getState();
      const liveRuns = lib.runs.filter((r) => r.projectId === project.id);
      const inFlight = liveRuns.filter((r) => r.status !== "failed");
      if (inFlight.length > 0 && !window.confirm(`${project.name} has ${inFlight.length} run(s) in flight. Cancel them and delete the project?`)) return;
      for (const r of inFlight) await dismissRun(r);

      const assets = lib.assets.filter((a) => a.projectId === project.id);
      const runs = lib.runs.filter((r) => r.projectId === project.id);
      stage(project.id);
      lib.stageRemove(assets.map((a) => a.id));
      lib.removeRunsForProject(project.id);
      const uploads = useUploadsStore.getState().stageRemoveForProject(project.id);

      const total = assets.length + uploads.length;
      pushUndo(
        `Deleted “${project.name}” and ${total} ${total === 1 ? "item" : "items"}`,
        () => {
          restore(project);
          useLibraryStore.getState().restoreAssets(assets);
          useLibraryStore.getState().restoreRuns(runs);
          useUploadsStore.getState().restore(uploads);
        },
        async () => {
          try {
            await api.deleteProject(project.id);
          } catch {
            toast("Could not delete the project from storage.", "danger");
          }
        },
      );
    },
    [stage, restore, pushUndo, toast],
  );

  return { rename, remove };
}
