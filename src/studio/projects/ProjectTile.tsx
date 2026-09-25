"use client";

import { useState } from "react";
import type { Asset, Project } from "@/db/types";
import { useProjectsStore } from "@/stores/projects";
import { useUiStore } from "@/stores/ui";
import { useProjectActions } from "./useProjectActions";
import { relativeTime } from "@/lib/format";
import { assetSrc, assetThumb } from "@/stores/library";

type Props = { project: Project; images: number; videos: number; inputs: number; live: number; cover?: Asset };

export function ProjectTile({ project, images, videos, inputs, live, cover }: Props) {
  const open = useProjectsStore((s) => s.open);
  const setGalleryTab = useUiStore((s) => s.setGalleryTab);
  const { rename, remove } = useProjectActions();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(project.name);

  const openProject = () => {
    open(project.id);
    setGalleryTab("projects");
  };

  const commitRename = async () => {
    setEditing(false);
    if (draft.trim() && draft.trim() !== project.name) await rename(project.id, draft.trim());
    else setDraft(project.name);
  };

  return (
    <div className="project-tile" data-live={live > 0 || undefined}>
      <button type="button" className="project-cover" onClick={openProject} aria-label={`Open ${project.name}`}>
        {cover ? (
          cover.kind === "video" ? (
            <video src={assetSrc(cover)} muted playsInline preload="metadata" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={assetThumb(cover)} alt="" loading="lazy" />
          )
        ) : (
          <span className="project-cover-empty" aria-hidden="true" />
        )}
        {live > 0 ? <span className="project-live">{live} in flight</span> : null}
      </button>
      <div className="project-meta">
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
              if (e.key === "Escape") {
                setDraft(project.name);
                setEditing(false);
              }
            }}
            aria-label="Project name"
          />
        ) : (
          <button type="button" className="project-name" onClick={openProject} title={project.name}>
            {project.name}
          </button>
        )}
        <span className="project-stats num">
          {images} {images === 1 ? "image" : "images"} · {videos} {videos === 1 ? "video" : "videos"}
          {inputs ? ` · ${inputs} ${inputs === 1 ? "input" : "inputs"}` : ""} · {relativeTime(project.updatedAt)}
        </span>
      </div>
      <div className="project-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>
          Rename
        </button>
        <button type="button" className="btn btn-danger btn-sm" onClick={() => void remove(project)}>
          Delete
        </button>
      </div>
    </div>
  );
}
