"use client";

import { useMemo } from "react";
import { useProjectsStore } from "@/stores/projects";
import { useLibraryStore } from "@/stores/library";
import { useUiStore } from "@/stores/ui";
import { useUploadsStore } from "@/stores/uploads";
import { EmptyState } from "../gallery/EmptyState";
import { ProjectTile } from "./ProjectTile";

export function ProjectsGrid({ hint }: { hint?: "image" | "video" }) {
  const projects = useProjectsStore((s) => s.projects);
  const loaded = useProjectsStore((s) => s.loaded);
  const assets = useLibraryStore((s) => s.assets);
  const runs = useLibraryStore((s) => s.runs);
  const setNewProjectOpen = useUiStore((s) => s.setNewProjectOpen);
  const uploads = useUploadsStore((s) => s.uploads);

  const byProject = useMemo(() => {
    const map = new Map<string, { images: number; videos: number; cover?: (typeof assets)[number]; live: number }>();
    for (const p of projects) map.set(p.id, { images: 0, videos: 0, live: 0 });
    for (const a of assets) {
      const e = map.get(a.projectId);
      if (!e) continue;
      if (a.kind === "image") e.images += 1;
      else e.videos += 1;
      if (!e.cover || a.createdAt > e.cover.createdAt) e.cover = a;
    }
    for (const r of runs) {
      const e = map.get(r.projectId);
      if (e && r.status !== "failed") e.live += 1;
    }
    return map;
  }, [projects, assets, runs]);

  if (!loaded) return null;

  if (projects.length === 0) {
    return (
      <EmptyState
        title="Start a project"
        body="Projects are folders for everything you generate. Create one, then describe your first image or video."
        action={{ label: "New project", onClick: () => setNewProjectOpen(true) }}
      />
    );
  }

  return (
    <div className="projects">
      <div className="projects-head">
        <span className="projects-hint">
          {hint ? `Open a project to see its ${hint === "image" ? "images" : "videos"}.` : "Everything you generate is filed in a project."}
        </span>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setNewProjectOpen(true)}>
          New project
        </button>
      </div>
      <div className="projects-grid">
        {projects.map((p) => {
          const stats = byProject.get(p.id) ?? { images: 0, videos: 0, live: 0 };
          const inputs = uploads.filter((u) => u.projectId === p.id).length;
          return <ProjectTile key={p.id} project={p} images={stats.images} videos={stats.videos} inputs={inputs} live={stats.live} cover={stats.cover} />;
        })}
      </div>
    </div>
  );
}
