import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { MediaKind, ProviderId } from "@/providers/types";

export type GalleryTab = "projects" | "image" | "video" | "favorites";
export const GALLERY_TABS: readonly GalleryTab[] = ["projects", "image", "video", "favorites"];

export type LampState = "none" | "held" | "live" | "error";

export type Toast = { id: number; kind: "info" | "success" | "warning" | "danger"; text: string };

type UiState = {
  galleryTab: GalleryTab;
  setGalleryTab: (tab: GalleryTab) => void;
  /** What the composer generates. Image/Video tabs set it; other tabs keep the last value. */
  kind: MediaKind;
  setKind: (kind: MediaKind) => void;
  keyModal: null | { mode: "gate" | "manage"; provider?: ProviderId };
  openKeyModal: (mode?: "gate" | "manage", provider?: ProviderId) => void;
  closeKeyModal: () => void;
  batch: number;
  setBatch: (n: number) => void;
  toasts: Toast[];
  toast: (text: string, kind?: Toast["kind"]) => void;
  dismissToast: (id: number) => void;
  viewerAssetId: string | null;
  openViewer: (id: string | null) => void;
  newProjectOpen: boolean;
  setNewProjectOpen: (open: boolean) => void;
  modelSettingsOpen: boolean;
  openModelSettings: () => void;
  closeModelSettings: () => void;
};

let toastSeq = 1;

/**
 * Only `galleryTab`, `kind` and `batch` persist. The store is rehydrated
 * manually from <Studio> after mount so the server and first client render agree.
 */
export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      galleryTab: "projects",
      setGalleryTab: (galleryTab) =>
        set((s) => ({ galleryTab, kind: galleryTab === "image" || galleryTab === "video" ? galleryTab : s.kind })),
      kind: "image",
      setKind: (kind) => set({ kind }),
      keyModal: null,
      openKeyModal: (mode = "manage", provider) => set({ keyModal: { mode, provider } }),
      closeKeyModal: () => set({ keyModal: null }),
      batch: 1,
      setBatch: (batch) => set({ batch }),
      toasts: [],
      toast: (text, kind = "info") => set((s) => ({ toasts: [...s.toasts.slice(-3), { id: toastSeq++, kind, text }] })),
      dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
      viewerAssetId: null,
      openViewer: (viewerAssetId) => set({ viewerAssetId }),
      newProjectOpen: false,
      setNewProjectOpen: (newProjectOpen) => set({ newProjectOpen }),
      modelSettingsOpen: false,
      openModelSettings: () => set({ modelSettingsOpen: true }),
      closeModelSettings: () => set({ modelSettingsOpen: false }),
    }),
    {
      name: "mav.ui",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ galleryTab: s.galleryTab, kind: s.kind, batch: s.batch }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<Pick<UiState, "galleryTab" | "kind" | "batch">>;
        return {
          ...current,
          galleryTab: p.galleryTab && GALLERY_TABS.includes(p.galleryTab) ? p.galleryTab : current.galleryTab,
          kind: p.kind === "image" || p.kind === "video" ? p.kind : current.kind,
          batch: typeof p.batch === "number" && p.batch >= 1 && p.batch <= 4 ? p.batch : current.batch,
        };
      },
      skipHydration: true,
    },
  ),
);
