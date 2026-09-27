import { Moon, Sun } from "lucide-react";
import { useAppStore } from "@/shared/store/app.store";

/**
 * Light/dark theme toggle for the top bar. Shared by the CS Navbar and the
 * Invigilator/DCS/RS header so every dashboard exposes the same control.
 * Styled for the dark chrome both bars already use.
 */
export default function DarkModeToggle() {
  const theme = useAppStore((s) => s.theme);
  const toggleTheme = useAppStore((s) => s.toggleTheme);
  const isDark = theme === "dark";

  return (
    <button
      onClick={toggleTheme}
      className="rounded p-1.5 text-gray-200 transition-colors hover:bg-gray-700"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
    >
      {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}
