import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/shared/store/auth.store";
import { openRealtimeSocket, type RealtimeSocket } from "./socketClient";

// Every query family that shows who holds which duty — the same set the app's
// own claim / assign / release mutations invalidate. React Query refetches only
// the ones mounted on screen; the rest are just marked stale.
const DUTY_QUERY_ROOTS = [
  "shared", // exam-groups, duty-status, duties-by-teacher (all select-duty screens)
  "dcs",
  "duties",
  "duty-calculation",
  "manage-duties",
  "change-requests",
  "exam-groups",
  "invigilators-for-rooms",
];

/**
 * Keeps every open page live: when anyone takes or releases a duty, the server
 * sends `duties:changed` and the duty data on screen refetches — no refresh.
 * Mounted once in AuthGuard, which wraps all four role layouts.
 */
export function useRealtimeSync() {
  const token = useAuthStore((s) => s.token);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!token) return;
    let socket: RealtimeSocket | null = null;
    let disposed = false;

    const refresh = () => {
      // A hidden tab only marks data stale; React Query refetches it on focus.
      const refetchType = document.hidden ? "none" : "active";
      for (const root of DUTY_QUERY_ROOTS) {
        queryClient.invalidateQueries({ queryKey: [root], refetchType });
      }
    };

    openRealtimeSocket().then((s) => {
      if (disposed) {
        s?.disconnect();
        return;
      }
      socket = s;
      if (!socket) return;
      let connectedBefore = false;
      socket.on("connect", () => {
        // After a reconnect (laptop sleep, network drop) catch up on whatever
        // changed while we weren't listening.
        if (connectedBefore) refresh();
        connectedBefore = true;
      });
      socket.on("duties:changed", refresh);
    });

    // Re-runs on role switch / re-login (new token) and disconnects on logout.
    return () => {
      disposed = true;
      socket?.disconnect();
    };
  }, [token, queryClient]);
}
