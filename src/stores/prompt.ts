import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { MediaRole } from "@/providers/types";
import type { MediaRef, MediaRefs } from "@/db/types";

type PromptState = {
  prompt: string;
  negativePrompt: string;
  seed: number | null;
  media: MediaRefs;
  setPrompt: (prompt: string) => void;
  setNegativePrompt: (negativePrompt: string) => void;
  setSeed: (seed: number | null) => void;
  setMedia: (role: MediaRole, refs: MediaRef[]) => void;
  /** Appends up to `max` items; returns how many were accepted. */
  addMedia: (role: MediaRole, refs: MediaRef[], max: number) => number;
  removeMedia: (role: MediaRole, index: number) => void;
  clearMedia: () => void;
  /** Bumps whenever something outside the textarea writes the prompt, so it can focus. */
  focusRequest: number;
  seedPrompt: (prompt: string) => void;
  restore: (v: { prompt: string; negativePrompt?: string; seed?: number; media?: MediaRefs }) => void;
};

export const usePromptStore = create<PromptState>()(
  persist(
    (set, get) => ({
      prompt: "",
      negativePrompt: "",
      seed: null,
      media: {},
      focusRequest: 0,
      setPrompt: (prompt) => set({ prompt }),
      setNegativePrompt: (negativePrompt) => set({ negativePrompt }),
      setSeed: (seed) => set({ seed }),
      setMedia: (role, refs) => set((s) => ({ media: { ...s.media, [role]: refs } })),
      addMedia: (role, refs, max) => {
        const current = get().media[role] ?? [];
        const room = Math.max(0, max - current.length);
        const accepted = refs.slice(0, room);
        if (accepted.length) set((s) => ({ media: { ...s.media, [role]: [...(s.media[role] ?? []), ...accepted] } }));
        return accepted.length;
      },
      removeMedia: (role, index) =>
        set((s) => ({ media: { ...s.media, [role]: (s.media[role] ?? []).filter((_, i) => i !== index) } })),
      clearMedia: () => set({ media: {} }),
      seedPrompt: (prompt) =>
        set((s) => ({ prompt, focusRequest: s.focusRequest + 1 })),
      restore: (v) =>
        set((s) => ({
          prompt: v.prompt,
          negativePrompt: v.negativePrompt ?? "",
          seed: v.seed ?? null,
          media: v.media ? { ...v.media } : {},
          focusRequest: s.focusRequest + 1,
        })),
    }),
    {
      name: "mav.prompt",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        prompt: s.prompt,
        negativePrompt: s.negativePrompt,
        seed: s.seed,
        media: s.media,
      }),
      skipHydration: true,
    },
  ),
);
