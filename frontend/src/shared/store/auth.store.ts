import { create } from "zustand";
import { User, UserRole } from "@/shared/lib/types";

interface AuthState {
  user: User | null;
  token: string | null;
  // A tempToken is issued after a successful login when the user has multiple
  // roles and hasn't picked one yet. It only unlocks POST /auth/select-role.
  tempToken: string | null;
  isHydrated: boolean;
  setAuth: (user: User, token: string) => void;
  setTempAuth: (user: User, tempToken: string) => void;
  setUser: (user: User) => void;
  setActiveRole: (role: UserRole, token: string) => void;
  logout: () => void;
  hydrate: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  tempToken: null,
  isHydrated: false,

  setAuth: (user, token) => {
    localStorage.setItem("token", token);
    localStorage.removeItem("tempToken");
    set({ user, token, tempToken: null });
  },

  setTempAuth: (user, tempToken) => {
    localStorage.setItem("tempToken", tempToken);
    localStorage.removeItem("token");
    set({ user, tempToken, token: null });
  },

  setUser: (user) => {
    set({ user });
  },

  setActiveRole: (role, token) => {
    localStorage.setItem("token", token);
    localStorage.removeItem("tempToken");
    set((state) => ({
      token,
      tempToken: null,
      user: state.user ? { ...state.user, activeRole: role } : state.user,
    }));
  },

  logout: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("tempToken");
    set({ user: null, token: null, tempToken: null });
  },

  hydrate: () => {
    if (typeof window === "undefined") {
      set({ isHydrated: true });
      return;
    }
    const token = localStorage.getItem("token");
    const tempToken = localStorage.getItem("tempToken");
    set({ token, tempToken, isHydrated: true });
  },
}));
