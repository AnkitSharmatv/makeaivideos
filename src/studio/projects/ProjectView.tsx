"use client";

import { useMemo, useState } from "react";
import type { MediaKind } from "@/providers/types";
import { useProjectsStore } from "@/stores/projects";
import { useLibraryStore } from "@/stores/library";
import { useUiStore } from "@/stores/ui";
import { MediaGrid } from "../gallery/MediaGrid";
import { EmptyState, STARTERS } from "../gallery/EmptyState";
import { useProjectActions } from "./useProjectActions";
import { ProjectInputs } from "./ProjectInputs";

type Props = { projectId: string; kind?: MediaKind };

export function ProjectView({ projectId, kind }: Props) {
  const project = useProjectsStore((s) => s.projects.find((p) => p.id === projectId) ?? null);
  const open = useProjectsStore((s) => s.open);
  const assets = useLibraryStore((s) => s.assets);
  const runs = useLibraryStore((s) => s.runs);
  const loaded = useLibraryStore((s) => s.loaded);
  const setGalleryTab = useUiStore((s) => s.setGalleryTab);
  const { rename, remove } = useProjectActions();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const scopedAssets = useMemo(() => assets.filter((a) => a.projectId === projectId && (!kind || a.kind === kind)), [assets, projectId, kind]);
  const scopedRuns = useMemo(() => runs.filter((r) => r.projectId === projectId && (!kind || r.kind === kind)), [runs, projectId, kind]);

  if (!project) return null;

  const commitRename = async () => {
    setEditing(false);
    if (draft.trim() && draft.trim() !== project.name) await rename(project.id, draft.trim());
  };

  const empty = loaded && scopedAssets.length === 0 && scopedRuns.length === 0;

  return (
    <div className="project-view">
      <div className="project-head">
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              open(null);
              setGalleryTab("projects");
            }}
          >
            Projects
          </button>
          <span className="breadcrumb-sep" aria-hidden="true">
            /
          </span>
          {editing ? (
            <input
              className="input project-rename"
              value={draft}
              autoFocus
              maxLength={80}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => void commitRename()}
              onKeyDown={(e) => {
                if (e.key === "Enter") void commitRename();
                if (e.key === "Escape") setEditing(false);
              }}
              aria-label="Project name"
            />
          ) : (
            <h1 className="project-title">{project.name}</h1>
          )}
          {kind ? <span className="badge">{kind}s</span> : null}
        </nav>
        <div className="project-head-actions">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setDraft(project.name);
              setEditing(true);
            }}
          >
            Rename
          </button>
          <button type="button" className="btn btn-danger btn-sm" onClick={() => void remove(project)}>
            Delete
          </button>
        </div>
      </div>

      {!kind ? <ProjectInputs projectId={projectId} /> : null}

      {empty ? (
        kind ? (
          <EmptyState
            title={kind === "image" ? "No images in this project" : "No videos in this project"}
            body={`Pick ${kind === "image" ? "an image" : "a video"} model below and describe what you want.`}
            action={{ label: "Try a starter prompt", starter: STARTERS[kind] }}
          />
        ) : (
          <EmptyState
            title="This project is empty"
            body="Describe an image or a video below. Results land here as they finish."
            action={{ label: "Try a starter prompt", starter: STARTERS.image, onClick: () => setGalleryTab("image") }}
          />
        )
      ) : (
        <MediaGrid assets={scopedAssets} runs={scopedRuns} />
      )}
    </div>
  );
}
