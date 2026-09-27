import { create } from "zustand";

export type Theme = "light" | "dark";

const THEME_KEY = "theme";

/** Read the persisted theme (matches the no-FOUC inline script in index.html). */
function readInitialTheme(): Theme {
  try {
    if (localStorage.getItem(THEME_KEY) === "dark") return "dark";
  } catch {
    // localStorage unavailable (privacy mode) — fall back to light.
  }
  return "light";
}

/** Toggle the `.dark` class on <html> and persist the choice. */
function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // ignore persistence failures
  }
}

interface AppState {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  /** Active color theme; drives the `.dark` class on <html>. */
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

export const useAppStore = create<AppState>((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  theme: readInitialTheme(),
  toggleTheme: () =>
    set((state) => {
      const next: Theme = state.theme === "dark" ? "light" : "dark";
      applyTheme(next);
      return { theme: next };
    }),
  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
  },
}));
