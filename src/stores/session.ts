import { create } from "zustand";
import { getAuthState, type AuthState } from "@/auth/actions";
import type { User } from "@/server/auth";

type SessionState = {
  /** null until the first round-trip. */
  auth: AuthState | null;
  refresh: () => Promise<AuthState>;
  setUser: (user: User | null) => void;
};

export const useSessionStore = create<SessionState>((set, get) => ({
  auth: null,
  refresh: async () => {
    const auth = await getAuthState();
    set({ auth });
    return auth;
  },
  setUser: (user) => set({ auth: { ...(get().auth ?? { needsSetup: false, signupOpen: false, licensee: null }), user } }),
}));
