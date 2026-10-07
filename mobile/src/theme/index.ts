import { useColorScheme } from "react-native";

// Proctavo brand tokens — indigo→violet, matching the web logo mark
// (frontend/public/favicon.svg) and frontend/src/shared/theme. Both themes are
// supported surfaces, as on the web: always style through `useTheme()`.

const brand = {
  primary: "#6366f1", // indigo-500
  primaryDeep: "#4f46e5", // indigo-600
  accent: "#8b5cf6", // violet-500
};

const light = {
  ...brand,
  background: "#f8fafc",
  surface: "#ffffff",
  surfaceMuted: "#f1f5f9",
  border: "#e2e8f0",
  text: "#0f172a",
  textMuted: "#64748b",
  onPrimary: "#ffffff",
  success: "#16a34a",
  successBg: "#dcfce7",
  warning: "#d97706",
  warningBg: "#fef3c7",
  danger: "#dc2626",
  dangerBg: "#fee2e2",
  info: "#2563eb",
  infoBg: "#dbeafe",
};

const dark: typeof light = {
  ...brand,
  primary: "#818cf8",
  background: "#0b1020",
  surface: "#141a2e",
  surfaceMuted: "#1c2440",
  border: "#273154",
  text: "#e2e8f0",
  textMuted: "#94a3b8",
  onPrimary: "#ffffff",
  success: "#4ade80",
  successBg: "#14532d",
  warning: "#fbbf24",
  warningBg: "#451a03",
  danger: "#f87171",
  dangerBg: "#450a0a",
  info: "#60a5fa",
  infoBg: "#172554",
};

export type ThemeColors = typeof light;

/** Role accent chips — same hues the web uses per role. */
export const roleColors: Record<"invigilator" | "rs" | "dcs", { fg: string; bg: string; label: string }> = {
  invigilator: { fg: "#4f46e5", bg: "#e0e7ff", label: "Invigilator" },
  rs: { fg: "#0d9488", bg: "#ccfbf1", label: "RS" },
  dcs: { fg: "#c026d3", bg: "#fae8ff", label: "DCS" },
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

export function useTheme() {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  return { colors: isDark ? dark : light, isDark, spacing, radius };
}
