import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/shared/store/auth.store";
import { useAppStore } from "@/shared/store/app.store";
import { useMe } from "@/modules/auth/hooks";
import { useRealtimeSync } from "@/shared/realtime/useRealtimeSync";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const hydrate = useAuthStore((s) => s.hydrate);
  const setUser = useAuthStore((s) => s.setUser);
  const applyRoleTheme = useAppStore((s) => s.applyRoleTheme);
  const activeRole = user?.activeRole;
  const navigate = useNavigate();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Every dashboard shell (CS / DCS / RS / Invigilator) wraps in AuthGuard, so
  // this is the one place that applies the theme saved for the active role.
  useEffect(() => {
    if (activeRole) applyRoleTheme(activeRole);
  }, [activeRole, applyRoleTheme]);

  // Live duty updates for every role shell: pages refetch when anyone claims or
  // releases a duty.
  useRealtimeSync();

  // Fetch user profile when we have a token but no user (e.g. after page refresh)
  const { data: me } = useMe();

  // Also after the first load: /auth/me carries the college's feature switches,
  // so a change by the superadmin reaches open pages on the next refetch.
  useEffect(() => {
    if (me) setUser(me);
  }, [me, setUser]);

  useEffect(() => {
    if (isHydrated && !token) {
      navigate("/login", { replace: true });
    }
  }, [isHydrated, token, navigate]);

  if (!isHydrated || !token) {
    return null;
  }

  return <>{children}</>;
}
