import { create } from "zustand";
import type { PromptEntry } from "@/db/types";
import * as api from "@/data/actions";

type PromptsState = {
  prompts: PromptEntry[];
  hydrate: (prompts: PromptEntry[]) => void;
  remember: (text: string) => void;
  forget: (text: string) => Promise<void>;
};

export const usePromptsStore = create<PromptsState>((set) => ({
  prompts: [],
  hydrate: (prompts) => set({ prompts }),
  remember: (text) => {
    const t = text.trim();
    if (!t) return;
    set((s) => {
      const existing = s.prompts.find((p) => p.text === t);
      const entry: PromptEntry = { text: t, lastUsedAt: Date.now(), uses: (existing?.uses ?? 0) + 1 };
      return { prompts: [entry, ...s.prompts.filter((p) => p.text !== t)].slice(0, 50) };
    });
    void api.rememberPrompt(t);
  },
  forget: async (text) => {
    set((s) => ({ prompts: s.prompts.filter((p) => p.text !== text) }));
    await api.forgetPrompt(text);
  },
}));
