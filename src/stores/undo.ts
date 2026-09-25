import { create } from "zustand";

export type UndoEntry = {
  id: number;
  label: string;
  /** Reverts the change. */
  undo: () => void | Promise<void>;
  /** Makes the change permanent (called when the bar expires or is replaced). */
  commit: () => void | Promise<void>;
  createdAt: number;
};

type UndoState = {
  pending: UndoEntry | null;
  push: (label: string, undo: UndoEntry["undo"], commit: UndoEntry["commit"]) => void;
  runUndo: () => Promise<void>;
  expire: () => Promise<void>;
};

let seq = 1;

export const useUndoStore = create<UndoState>((set, get) => ({
  pending: null,
  push: (label, undo, commit) => {
    const prev = get().pending;
    if (prev) void prev.commit();
    set({ pending: { id: seq++, label, undo, commit, createdAt: Date.now() } });
  },
  runUndo: async () => {
    const p = get().pending;
    if (!p) return;
    set({ pending: null });
    await p.undo();
  },
  expire: async () => {
    const p = get().pending;
    if (!p) return;
    set({ pending: null });
    await p.commit();
  },
}));
