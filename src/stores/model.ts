import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { MediaKind, ModelSpec, SettingValue } from "@/providers/types";
import { findModel, modelKey } from "@/providers";
import { saveDisabledModels } from "@/data/actions";

type ModelState = {
  /** Selected model key per kind, e.g. { image: "kie:google/nano-banana" }. */
  selected: Partial<Record<MediaKind, string>>;
  /** Per-model setting values, keyed by model key. */
  settings: Record<string, Record<string, SettingValue>>;
  /** Model keys switched off by the user (account-level). Everything else is on. */
  disabled: string[];
  hydrateDisabled: (keys: string[]) => void;
  isEnabled: (model: Pick<ModelSpec, "provider" | "id">) => boolean;
  setEnabled: (keys: string[], enabled: boolean) => void;
  select: (model: ModelSpec) => { dropped: string[] };
  setSetting: (model: ModelSpec, key: string, value: SettingValue) => void;
  resetSettings: (model: ModelSpec) => void;
  /** Overwrite every setting for a model (Reuse / Recreate). */
  applySettings: (model: ModelSpec, values: Record<string, SettingValue>) => void;
  modelFor: (kind: MediaKind) => ModelSpec | null;
};

function isValidValue(model: ModelSpec, key: string, value: SettingValue): boolean {
  const spec = model.settings.find((s) => s.key === key);
  if (!spec) return false;
  if (spec.type === "enum") return typeof value === "string" && spec.values.includes(value);
  if (spec.type === "number") return typeof value === "number" && value >= spec.min && value <= spec.max;
  return typeof value === "boolean";
}

export const useModelStore = create<ModelState>()(
  persist(
    (set, get) => ({
      selected: {},
      settings: {},
      disabled: [],
      hydrateDisabled: (keys) => set({ disabled: keys }),
      isEnabled: (model) => !get().disabled.includes(modelKey(model)),
      setEnabled: (keys, enabled) => {
        const next = enabled ? get().disabled.filter((k) => !keys.includes(k)) : [...new Set([...get().disabled, ...keys])];
        set({ disabled: next });
        void saveDisabledModels(next);
      },
      select: (model) => {
        const { selected, settings } = get();
        const prevKey = selected[model.kind];
        const nextKey = modelKey(model);
        const dropped: string[] = [];
        // Carry compatible settings across from the previously selected model of this kind.
        if (prevKey && prevKey !== nextKey) {
          const prev = findModel(prevKey);
          const prevValues = settings[prevKey] ?? {};
          const carried: Record<string, SettingValue> = { ...(settings[nextKey] ?? {}) };
          for (const [k, v] of Object.entries(prevValues)) {
            const prevSpec = prev?.settings.find((s) => s.key === k);
            if (!prevSpec) continue;
            const prevDefault = prevSpec.default;
            if (v === prevDefault) continue; // untouched settings aren't worth reporting
            if (isValidValue(model, k, v)) carried[k] = v;
            else dropped.push(prevSpec.label);
          }
          set({ selected: { ...selected, [model.kind]: nextKey }, settings: { ...settings, [nextKey]: carried } });
        } else {
          set({ selected: { ...selected, [model.kind]: nextKey } });
        }
        return { dropped };
      },
      setSetting: (model, key, value) => {
        const mk = modelKey(model);
        set((s) => ({ settings: { ...s.settings, [mk]: { ...(s.settings[mk] ?? {}), [key]: value } } }));
      },
      resetSettings: (model) => {
        const mk = modelKey(model);
        set((s) => {
          const next = { ...s.settings };
          delete next[mk];
          return { settings: next };
        });
      },
      applySettings: (model, values) => {
        const mk = modelKey(model);
        set((s) => ({ settings: { ...s.settings, [mk]: { ...values } } }));
      },
      modelFor: (kind) => {
        const key = get().selected[kind];
        return key ? (findModel(key) ?? null) : null;
      },
    }),
    {
      name: "mav.model",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ selected: s.selected, settings: s.settings }),
      skipHydration: true,
    },
  ),
);
