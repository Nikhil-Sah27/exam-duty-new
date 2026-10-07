import { QueryClientProvider } from "@tanstack/react-query";
import { DarkTheme, DefaultTheme, router, SplashScreen, Stack, ThemeProvider, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";

import { ensureChannels, loadAlarmState, useAlarmSettings } from "@/alarms";
import { queryClient } from "@/lib/queryClient";
import { isTeacherRole } from "@/lib/roles";
import { TeacherRuntime } from "@/runtime/TeacherRuntime";
import { useAuthStore } from "@/store/auth";
import { useTheme } from "@/theme";

void SplashScreen.preventAutoHideAsync();

// Routes reachable without a role-bound teacher token.
const PUBLIC_SEGMENTS = new Set(["login", "forgot-password", "select-role", "cs-web"]);

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
  const isCs = !!token && role === "cs";
  const pickingRole = !isTeacher && !isCs && !!(tempToken || token);
  const signedOut = !token && !tempToken;

  // Stack.Protected covers the screens declared below; this catches any other
  // teacher-only route (e.g. select/**) left on screen after a logout or 401.
  useEffect(() => {
    if (!isHydrated || isTeacher) return;
    const first = segments[0] as string | undefined;
    if (first && !PUBLIC_SEGMENTS.has(first)) router.replace(signedOut ? "/login" : pickingRole ? "/select-role" : "/cs-web");
  }, [isHydrated, isTeacher, signedOut, pickingRole, segments]);

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
        {isTeacher ? <TeacherRuntime /> : null}
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
          <Stack.Protected guard={signedOut}>
            <Stack.Screen name="login" />
            <Stack.Screen name="forgot-password" options={{ headerShown: true, title: "Reset password", headerBackTitle: "Back" }} />
          </Stack.Protected>
          <Stack.Protected guard={pickingRole}>
            <Stack.Screen name="select-role" />
          </Stack.Protected>
          <Stack.Protected guard={isCs}>
            <Stack.Screen name="cs-web" />
          </Stack.Protected>
          <Stack.Protected guard={isTeacher}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="select/[examGroupId]" options={{ headerShown: false }} />
            <Stack.Screen name="duty/[key]" options={{ headerShown: true, title: "Duty", headerBackTitle: "Back" }} />
            <Stack.Screen name="alarm" options={{ presentation: "fullScreenModal", gestureEnabled: false, animation: "fade" }} />
          </Stack.Protected>
        </Stack>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
