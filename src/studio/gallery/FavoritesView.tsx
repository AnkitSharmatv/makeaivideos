"use client";

import { useMemo } from "react";
import { useLibraryStore } from "@/stores/library";
import { useProjectsStore } from "@/stores/projects";
import { MediaGrid } from "./MediaGrid";
import { EmptyState } from "./EmptyState";

export function FavoritesView() {
  const assets = useLibraryStore((s) => s.assets);
  const loaded = useLibraryStore((s) => s.loaded);
  const projects = useProjectsStore((s) => s.projects);
  const favs = useMemo(() => assets.filter((a) => a.favorite === 1), [assets]);
  const labels = useMemo(() => Object.fromEntries(projects.map((p) => [p.id, p.name])), [projects]);

  if (!loaded) return null;
  if (favs.length === 0) {
    return <EmptyState title="No favorites yet" body="Tap ♡ on any tile to keep it here. Favorites never age out of history, in any project." />;
  }
  return <MediaGrid assets={favs} runs={[]} projectLabels={labels} />;
}
