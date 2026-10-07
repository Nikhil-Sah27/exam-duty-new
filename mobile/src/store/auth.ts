import * as SecureStore from "expo-secure-store";
import { create } from "zustand";

import type { User, UserRole } from "@/lib/types";

// Mirrors frontend/src/shared/store/auth.store.ts, persisted in the device keychain
// instead of localStorage. A tempToken (multi-role user, role not yet picked) only
// unlocks POST /auth/select-role.
const KEYS = { token: "auth.token", tempToken: "auth.tempToken", user: "auth.user" } as const;

interface AuthState {
  user: User | null;
  token: string | null;
  tempToken: string | null;
  isHydrated: boolean;
  setAuth: (user: User, token: string) => Promise<void>;
  setTempAuth: (user: User, tempToken: string) => Promise<void>;
  setUser: (user: User) => Promise<void>;
  setActiveRole: (role: UserRole, token: string) => Promise<void>;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
}

const write = (key: string, value: string | null) =>
  value === null ? SecureStore.deleteItemAsync(key) : SecureStore.setItemAsync(key, value);

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  tempToken: null,
  isHydrated: false,

  setAuth: async (user, token) => {
    set({ user, token, tempToken: null });
    await Promise.all([write(KEYS.token, token), write(KEYS.tempToken, null), write(KEYS.user, JSON.stringify(user))]);
  },

  setTempAuth: async (user, tempToken) => {
    set({ user, tempToken, token: null });
    await Promise.all([write(KEYS.tempToken, tempToken), write(KEYS.token, null), write(KEYS.user, JSON.stringify(user))]);
  },

  setUser: async (user) => {
    set({ user });
    await write(KEYS.user, JSON.stringify(user));
  },

  setActiveRole: async (role, token) => {
    const user = get().user ? { ...get().user!, activeRole: role } : null;
    set({ token, tempToken: null, user });
    await Promise.all([
      write(KEYS.token, token),
      write(KEYS.tempToken, null),
      write(KEYS.user, user ? JSON.stringify(user) : null),
    ]);
  },

  logout: async () => {
    set({ user: null, token: null, tempToken: null });
    await Promise.all([write(KEYS.token, null), write(KEYS.tempToken, null), write(KEYS.user, null)]);
  },

  hydrate: async () => {
    try {
      const [token, tempToken, userJson] = await Promise.all([
        SecureStore.getItemAsync(KEYS.token),
        SecureStore.getItemAsync(KEYS.tempToken),
        SecureStore.getItemAsync(KEYS.user),
      ]);
      set({ token, tempToken, user: userJson ? (JSON.parse(userJson) as User) : null, isHydrated: true });
    } catch {
      set({ isHydrated: true });
    }
  },
}));
