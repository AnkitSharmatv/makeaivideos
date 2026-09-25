"use client";

import { useMemo } from "react";
import { useUiStore } from "@/stores/ui";
import { useProjectsStore } from "@/stores/projects";
import { useLibraryStore } from "@/stores/library";
import { TabRail } from "./TabRail";
import { ProjectsGrid } from "../projects/ProjectsGrid";
import { ProjectView } from "../projects/ProjectView";
import { FavoritesView } from "./FavoritesView";

export function Gallery() {
  const tab = useUiStore((s) => s.galleryTab);
  const currentId = useProjectsStore((s) => s.currentId);
  const projects = useProjectsStore((s) => s.projects);
  const assets = useLibraryStore((s) => s.assets);

  const counts = useMemo(() => {
    const inProject = currentId ? assets.filter((a) => a.projectId === currentId) : [];
    return {
      projects: projects.length,
      image: inProject.filter((a) => a.kind === "image").length,
      video: inProject.filter((a) => a.kind === "video").length,
      favorites: assets.filter((a) => a.favorite === 1).length,
    };
  }, [assets, projects, currentId]);

  let body: React.ReactNode;
  if (tab === "favorites") body = <FavoritesView />;
  else if (!currentId) body = <ProjectsGrid hint={tab === "image" || tab === "video" ? tab : undefined} />;
  else body = <ProjectView projectId={currentId} kind={tab === "image" || tab === "video" ? tab : undefined} />;

  return (
    <main className="gallery">
      <div className="gallery-head">
        <TabRail counts={counts} />
      </div>
      <div className="gallery-body" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {body}
      </div>
    </main>
  );
}
