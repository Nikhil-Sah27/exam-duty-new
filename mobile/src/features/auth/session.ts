import { cancelAllAlarms, syncAlarms } from "@/alarms";
import { selectRole } from "@/features/auth/api";
import { queryClient } from "@/lib/queryClient";
import type { LoginResult, UserRole } from "@/lib/types";
import { ensureNotificationPermission, registerForPush, unregisterPush } from "@/push";
import { useAuthStore } from "@/store/auth";
import { isTeacherRole } from "@/lib/roles";

/** Store a login result; a multi-role user continues on the role picker. */
export async function completeLogin(result: LoginResult): Promise<void> {
  const store = useAuthStore.getState();
  if (result.requiresRoleSelection || !result.token) {
    await store.setTempAuth(result.user, result.tempToken ?? "");
    return;
  }
  await store.setAuth(result.user, result.token); // TeacherRuntime then runs afterSignedIn()
}

/** Pick (or switch to) a role. Works from the tempToken and from a full token. */
export async function chooseRole(role: UserRole): Promise<void> {
  const { user, token } = await selectRole(role);
  const store = useAuthStore.getState();
  queryClient.clear();
  await store.setAuth(user, token); // TeacherRuntime re-runs afterSignedIn() for the new token
}

/** Device registration + alarm sync once a role-bound teacher token exists (called by TeacherRuntime). */
export async function afterSignedIn(): Promise<void> {
  const role = useAuthStore.getState().user?.activeRole;
  if (!isTeacherRole(role)) return;
  await ensureNotificationPermission().catch(() => false); // alarms need it even without push
  await Promise.allSettled([registerForPush(), syncAlarms()]);
}

/** Unregister this phone, clear alarms and cached data, then forget the session. */
export async function signOut(): Promise<void> {
  await unregisterPush().catch(() => undefined);
  await cancelAllAlarms().catch(() => undefined);
  queryClient.clear();
  await useAuthStore.getState().logout();
}
