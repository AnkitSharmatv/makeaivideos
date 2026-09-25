import { create } from "zustand";
import type { Project } from "@/db/types";
import * as api from "@/data/actions";

const CURRENT_KEY = "mav.project";

type ProjectsState = {
  projects: Project[];
  loaded: boolean;
  currentId: string | null;
  hydrate: (projects: Project[]) => void;
  create: (name: string) => Promise<Project>;
  rename: (id: string, name: string) => Promise<void>;
  /** Removes from the list immediately; the caller decides when to commit or restore via the undo bar. */
  stage: (id: string) => void;
  restore: (p: Project) => void;
  touch: (id: string) => void;
  open: (id: string | null) => void;
  current: () => Project | null;
};

function readCurrent(): string | null {
  try {
    return localStorage.getItem(CURRENT_KEY);
  } catch {
    return null;
  }
}

function writeCurrent(id: string | null) {
  try {
    if (id) localStorage.setItem(CURRENT_KEY, id);
    else localStorage.removeItem(CURRENT_KEY);
  } catch {
    /* ignore */
  }
}

export const useProjectsStore = create<ProjectsState>((set, get) => ({
  projects: [],
  loaded: false,
  currentId: null,
  hydrate: (projects) => {
    const saved = readCurrent();
    const currentId = saved && projects.some((p) => p.id === saved) ? saved : null;
    set({ projects, loaded: true, currentId });
  },
  create: async (name) => {
    const p = await api.createProject(name);
    set((s) => ({ projects: [p, ...s.projects] }));
    return p;
  },
  rename: async (id, name) => {
    const next = await api.renameProject(id, name);
    if (!next) return;
    set((s) => ({ projects: s.projects.map((p) => (p.id === id ? next : p)).sort((a, b) => b.updatedAt - a.updatedAt) }));
  },
  stage: (id) => {
    set((s) => ({
      projects: s.projects.filter((p) => p.id !== id),
      currentId: s.currentId === id ? null : s.currentId,
    }));
    if (readCurrent() === id) writeCurrent(null);
  },
  restore: (p) => set((s) => ({ projects: [...s.projects.filter((x) => x.id !== p.id), p].sort((a, b) => b.updatedAt - a.updatedAt) })),
  touch: (id) => {
    const now = Date.now();
    set((s) => ({ projects: s.projects.map((p) => (p.id === id ? { ...p, updatedAt: now } : p)).sort((a, b) => b.updatedAt - a.updatedAt) }));
  },
  open: (id) => {
    writeCurrent(id);
    set({ currentId: id });
  },
  current: () => {
    const { projects, currentId } = get();
    return projects.find((p) => p.id === currentId) ?? null;
  },
}));
