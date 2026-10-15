import { create } from "zustand";
import type { UserRole } from "@/shared/lib/types";

export type Theme = "light" | "dark";

/** Every role whose theme we track independently. */
const ALL_ROLES: UserRole[] = ["superadmin", "cs", "dcs", "rs", "invigilator"];
/**
 * The pre-split global preference. Read once to migrate existing installs into
 * per-role keys, then deleted. Never written afterwards, so it can't leak one
 * role's choice onto another.
 */
const LEGACY_KEY = "theme";
const roleKey = (role: UserRole) => `theme:${role}`;

function read(key: string): Theme | null {
  try {
    const v = localStorage.getItem(key);
    return v === "dark" ? "dark" : v === "light" ? "light" : null;
  } catch {
    // localStorage unavailable (privacy mode)
    return null;
  }
}

/**
 * One-time migration: if an install still has the old global `theme` key and no
 * per-role keys yet, seed every role with it (preserving prior behaviour) and
 * drop the global key. Safe to call on every load — it no-ops once migrated.
 */
function migrateLegacyTheme() {
  try {
    const legacy = read(LEGACY_KEY);
    if (!legacy) return;
    const hasPerRole = ALL_ROLES.some((r) => read(roleKey(r)) !== null);
    if (!hasPerRole) {
      for (const r of ALL_ROLES) localStorage.setItem(roleKey(r), legacy);
    }
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    // ignore persistence failures
  }
}
migrateLegacyTheme();

/** The theme saved for a role; unset roles default to light. */
function readRoleTheme(role: UserRole): Theme {
  return read(roleKey(role)) ?? "light";
}

/** True when ANY role has opted into dark — drives the role-selection page. */
function anyRoleDark(): boolean {
  return ALL_ROLES.some((r) => read(roleKey(r)) === "dark");
}

/** Toggle the `.dark` class on <html>. Persistence is per-role, done separately. */
function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

function persistRoleTheme(role: UserRole, theme: Theme) {
  try {
    localStorage.setItem(roleKey(role), theme);
  } catch {
    // ignore persistence failures
  }
}

/** The theme already painted by the no-FOUC script, so the toggle icon starts right. */
function currentlyApplied(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

interface AppState {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  /** Currently applied theme — drives the toggle icon. */
  theme: Theme;
  /** Apply the theme saved for `role` (called when a dashboard mounts). */
  applyRoleTheme: (role: UserRole) => void;
  /** Apply dark if ANY role opted in — used by the role-selection page, where
   *  no single role is active yet. */
  applyAnyRoleTheme: () => void;
  /** Flip + persist the theme for `role` only, leaving other roles untouched. */
  toggleTheme: (role: UserRole) => void;
}

export const useAppStore = create<AppState>((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  theme: currentlyApplied(),

  applyRoleTheme: (role) => {
    const theme = readRoleTheme(role);
    applyTheme(theme);
    set({ theme });
  },

  applyAnyRoleTheme: () => {
    const theme: Theme = anyRoleDark() ? "dark" : "light";
    applyTheme(theme);
    set({ theme });
  },

  toggleTheme: (role) =>
    set((state) => {
      const next: Theme = state.theme === "dark" ? "light" : "dark";
      persistRoleTheme(role, next);
      applyTheme(next);
      return { theme: next };
    }),
}));
