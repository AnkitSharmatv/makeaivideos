import { create } from "zustand";
import type { Asset, Run } from "@/db/types";
import * as api from "@/data/actions";

type LibraryState = {
  assets: Asset[];
  runs: Run[];
  loaded: boolean;
  hydrate: (assets: Asset[], runs: Run[]) => void;
  /** Server already stored them; merge into memory and drop anything the cap removed. */
  addAssets: (assets: Asset[], dropped?: string[]) => void;
  /** Removes from memory only; commit/restore decide persistence. */
  stageRemove: (ids: string[]) => Asset[];
  restoreAssets: (assets: Asset[]) => void;
  commitRemove: (ids: string[]) => Promise<void>;
  setFavorite: (ids: string[], favorite: boolean) => Promise<void>;
  moveAssets: (ids: string[], projectId: string) => Promise<void>;
  patchAsset: (id: string, patch: Partial<Asset>) => void;
  upsertRun: (run: Run) => void;
  removeRun: (id: string) => void;
  removeRunsForProject: (projectId: string) => void;
  restoreRuns: (runs: Run[]) => void;
};

export const useLibraryStore = create<LibraryState>((set, get) => ({
  assets: [],
  runs: [],
  loaded: false,
  hydrate: (assets, runs) => set({ assets, runs, loaded: true }),
  addAssets: (assets, dropped = []) =>
    set((s) => ({
      assets: [...assets, ...s.assets.filter((a) => !dropped.includes(a.id) && !assets.some((n) => n.id === a.id))].sort((a, b) => b.createdAt - a.createdAt),
    })),
  stageRemove: (ids) => {
    const removed = get().assets.filter((a) => ids.includes(a.id));
    set((s) => ({ assets: s.assets.filter((a) => !ids.includes(a.id)) }));
    return removed;
  },
  restoreAssets: (assets) =>
    set((s) => ({
      assets: [...s.assets.filter((a) => !assets.some((r) => r.id === a.id)), ...assets].sort((a, b) => b.createdAt - a.createdAt),
    })),
  commitRemove: async (ids) => {
    await api.deleteAssets(ids);
  },
  setFavorite: async (ids, favorite) => {
    const fav: 0 | 1 = favorite ? 1 : 0;
    set((s) => ({ assets: s.assets.map((a) => (ids.includes(a.id) ? { ...a, favorite: fav } : a)) }));
    await api.setAssetsFavorite(ids, favorite);
  },
  moveAssets: async (ids, projectId) => {
    set((s) => ({ assets: s.assets.map((a) => (ids.includes(a.id) ? { ...a, projectId } : a)) }));
    await api.moveAssets(ids, projectId);
  },
  patchAsset: (id, patch) => set((s) => ({ assets: s.assets.map((a) => (a.id === id ? { ...a, ...patch } : a)) })),
  upsertRun: (run) =>
    set((s) => {
      const exists = s.runs.some((r) => r.id === run.id);
      const runs = exists ? s.runs.map((r) => (r.id === run.id ? run : r)) : [run, ...s.runs];
      return { runs };
    }),
  removeRun: (id) => set((s) => ({ runs: s.runs.filter((r) => r.id !== id) })),
  removeRunsForProject: (projectId) => set((s) => ({ runs: s.runs.filter((r) => r.projectId !== projectId) })),
  restoreRuns: (runs) => set((s) => ({ runs: [...s.runs.filter((r) => !runs.some((x) => x.id === r.id)), ...runs] })),
}));

/** URL the browser should load for an asset: the local copy when there is one, else the provider's. */
export function assetSrc(a: Pick<Asset, "url" | "localFile">): string {
  return a.localFile ? `/api/files/media/${a.localFile}` : a.url;
}

/** Grid preview: a cached, downsized copy of the local image; videos and remote-only assets use the source. */
export function assetThumb(a: Pick<Asset, "url" | "localFile" | "kind">): string {
  return a.localFile && a.kind === "image" ? `/api/thumb/${a.localFile}` : assetSrc(a);
}
