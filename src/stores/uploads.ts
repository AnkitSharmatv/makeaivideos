import { create } from "zustand";
import type { Upload } from "@/db/types";
import type { MediaKind, ProviderId } from "@/providers/types";
import * as api from "@/data/actions";

/** URL for an upload's stored file. */
export function uploadPreview(u: Pick<Upload, "file">): string {
  return `/api/files/uploads/${u.file}`;
}

async function probe(file: File, kind: MediaKind): Promise<{ width?: number; height?: number; duration?: number }> {
  if (kind === "image") return {};
  const src = URL.createObjectURL(file);
  try {
    return await new Promise((resolve) => {
      const v = document.createElement("video");
      v.preload = "metadata";
      v.onloadedmetadata = () => resolve({ width: v.videoWidth, height: v.videoHeight, duration: v.duration });
      v.onerror = () => resolve({});
      v.src = src;
    });
  } finally {
    URL.revokeObjectURL(src);
  }
}

type UploadsState = {
  uploads: Upload[];
  loaded: boolean;
  /** ids currently being sent to a provider */
  busy: Record<string, ProviderId>;
  hydrate: (uploads: Upload[]) => void;
  add: (file: File, projectId: string) => Promise<Upload>;
  remove: (id: string) => Promise<void>;
  /** In-memory only; the project undo bar decides persistence. */
  stageRemoveForProject: (projectId: string) => Upload[];
  restore: (uploads: Upload[]) => void;
  /** Public URL for this provider, uploading (again) if there is none or it expired. */
  ensureRemote: (id: string, provider: ProviderId) => Promise<string>;
};

export const useUploadsStore = create<UploadsState>((set, get) => ({
  uploads: [],
  loaded: false,
  busy: {},
  hydrate: (uploads) => set({ uploads, loaded: true }),
  add: async (file, projectId) => {
    const kind: MediaKind = file.type.startsWith("video/") ? "video" : "image";
    const meta = await probe(file, kind);
    const form = new FormData();
    form.append("projectId", projectId);
    form.append("meta", JSON.stringify(meta));
    form.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: form });
    const data = (await res.json().catch(() => null)) as (Upload & { error?: string }) | null;
    if (!res.ok || !data || data.error) throw new Error(data?.error ?? `Upload failed (${res.status}).`);
    set((s) => ({ uploads: [data, ...s.uploads] }));
    return data;
  },
  remove: async (id) => {
    set((s) => ({ uploads: s.uploads.filter((u) => u.id !== id) }));
    await api.deleteUpload(id);
  },
  stageRemoveForProject: (projectId) => {
    const removed = get().uploads.filter((u) => u.projectId === projectId);
    set((s) => ({ uploads: s.uploads.filter((u) => u.projectId !== projectId) }));
    return removed;
  },
  restore: (uploads) => set((s) => ({ uploads: [...uploads, ...s.uploads.filter((u) => !uploads.some((x) => x.id === u.id))].sort((a, b) => b.createdAt - a.createdAt) })),
  ensureRemote: async (id, provider) => {
    const u = get().uploads.find((x) => x.id === id);
    if (!u) throw new Error("That upload is no longer in the project.");
    const existing = u.remotes[provider];
    if (existing && existing.expiresAt > Date.now()) return existing.url;
    set((s) => ({ busy: { ...s.busy, [id]: provider } }));
    try {
      const res = await api.ensureUploadRemote(id, provider);
      if (!res.ok) throw new Error(res.reason);
      set((s) => ({
        uploads: s.uploads.map((x) => (x.id === id ? { ...x, remotes: { ...x.remotes, [provider]: { url: res.url, expiresAt: Date.now() + 60 * 60 * 1000 } } } : x)),
      }));
      return res.url;
    } finally {
      set((s) => {
        const busy = { ...s.busy };
        delete busy[id];
        return { busy };
      });
    }
  },
}));
