import { QueryClientProvider } from "@tanstack/react-query";
import { DarkTheme, DefaultTheme, router, SplashScreen, Stack, ThemeProvider, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";

import { ensureChannels, loadAlarmState, useAlarmSettings } from "@/alarms";
import { queryClient } from "@/lib/queryClient";
import { isTeacherRole } from "@/lib/roles";
import { CsRuntime } from "@/runtime/CsRuntime";
import { TeacherRuntime } from "@/runtime/TeacherRuntime";
import { useAuthStore } from "@/store/auth";
import { useTheme } from "@/theme";

void SplashScreen.preventAutoHideAsync();

// Routes reachable without a role-bound teacher token.
const PUBLIC_SEGMENTS = new Set(["login", "forgot-password", "select-role", "cs-web"]);
// Where a signed-in CS may be: its own section, plus the shared Alerts screen.
const CS_SEGMENTS = new Set(["cs", "alerts"]);

export default function RootLayout() {
  const { colors, isDark } = useTheme();
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const token = useAuthStore((s) => s.token);
  const tempToken = useAuthStore((s) => s.tempToken);
  const role = useAuthStore((s) => s.user?.activeRole ?? null);
  const segments = useSegments();

  useEffect(() => {
    void useAuthStore.getState().hydrate();
    void useAlarmSettings.getState().load();
    void loadAlarmState();
    void ensureChannels().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (isHydrated) void SplashScreen.hideAsync();
  }, [isHydrated]);

  const isTeacher = !!token && isTeacherRole(role);
  // CS gets a phone-sized slice of the web dashboard under /cs.
  const isCs = !!token && role === "cs";
  // The platform superadmin works on the website; the app just points it there.
  const isSuperadmin = !!token && role === "superadmin";
  const pickingRole = !isTeacher && !isCs && !isSuperadmin && !!(tempToken || token);
  const signedOut = !token && !tempToken;

  // Stack.Protected covers the screens declared below; this catches any other
  // route left on screen after a login, role switch, logout or 401 — e.g. a
  // teacher route (select/**) for CS, or CS's /cs for a teacher.
  useEffect(() => {
    if (!isHydrated || isTeacher) return;
    const first = segments[0] as string | undefined;
    if (isCs) {
      if (!CS_SEGMENTS.has(first ?? "")) router.replace("/cs");
      return;
    }
    if (first && !PUBLIC_SEGMENTS.has(first)) router.replace(signedOut ? "/login" : pickingRole ? "/select-role" : "/cs-web");
  }, [isHydrated, isTeacher, isCs, signedOut, pickingRole, segments]);

  if (!isHydrated) return null;

  const navTheme = isDark ? DarkTheme : DefaultTheme;
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        value={{
          ...navTheme,
          colors: { ...navTheme.colors, primary: colors.primary, background: colors.background, card: colors.surface, text: colors.text, border: colors.border },
        }}
      >
        <StatusBar style="auto" />
        {isTeacher ? <TeacherRuntime /> : isCs ? <CsRuntime /> : null}
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
          <Stack.Protected guard={signedOut}>
            <Stack.Screen name="login" />
            <Stack.Screen name="forgot-password" options={{ headerShown: true, title: "Reset password", headerBackTitle: "Back" }} />
          </Stack.Protected>
          <Stack.Protected guard={pickingRole}>
            <Stack.Screen name="select-role" />
          </Stack.Protected>
          <Stack.Protected guard={isSuperadmin}>
            <Stack.Screen name="cs-web" />
          </Stack.Protected>
          <Stack.Protected guard={isCs}>
            <Stack.Screen name="cs" />
          </Stack.Protected>
          <Stack.Protected guard={isTeacher || isCs}>
            <Stack.Screen name="alerts" options={{ headerShown: true, title: "Alerts", headerBackTitle: "Back" }} />
          </Stack.Protected>
          <Stack.Protected guard={isTeacher}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="select/[examGroupId]" options={{ headerShown: false }} />
            <Stack.Screen name="duty/[key]" options={{ headerShown: true, title: "Duty", headerBackTitle: "Back" }} />
            <Stack.Screen name="change-requests" options={{ headerShown: true, title: "Change requests", headerBackTitle: "Back" }} />
            <Stack.Screen name="request-change/[key]" options={{ headerShown: true, title: "Request a change", headerBackTitle: "Back" }} />
            <Stack.Screen name="completed-duties" options={{ headerShown: true, title: "Completed duties", headerBackTitle: "Back" }} />
            <Stack.Screen name="alarm" options={{ presentation: "fullScreenModal", gestureEnabled: false, animation: "fade" }} />
          </Stack.Protected>
        </Stack>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
