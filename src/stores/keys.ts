import { create } from "zustand";
import type { ProviderId } from "@/providers/types";
import { getBalance, getKeyStatus, type KeyStatus } from "@/keys/actions";

export type BalanceInfo = { credits?: number; usd?: number; at: number } | { unavailable: true; at: number };

type KeysState = {
  /** null until the first server round-trip completes. */
  status: KeyStatus | null;
  balances: Partial<Record<ProviderId, BalanceInfo>>;
  refreshBalance: (id: ProviderId) => Promise<void>;
  refresh: () => Promise<void>;
  set: (id: ProviderId, held: boolean) => void;
  anyKey: () => boolean;
};

export const useKeysStore = create<KeysState>((set, get) => ({
  status: null,
  balances: {},
  refreshBalance: async (id) => {
    if (!get().status?.[id]) return;
    const r = await getBalance(id);
    set((s) => ({ balances: { ...s.balances, [id]: r.ok ? { credits: r.credits, usd: r.usd, at: r.at } : { unavailable: true, at: Date.now() } } }));
  },
  refresh: async () => {
    try {
      const status = await getKeyStatus();
      set({ status });
    } catch {
      set({ status: { kie: false, fal: false, higgsfield: false } });
    }
  },
  set: (id, held) =>
    set((s) => {
      const balances = { ...s.balances };
      if (!held) delete balances[id];
      return { status: { ...(s.status ?? { kie: false, fal: false, higgsfield: false }), [id]: held }, balances };
    }),
  anyKey: () => {
    const st = get().status;
    return !!st && Object.values(st).some(Boolean);
  },
}));
