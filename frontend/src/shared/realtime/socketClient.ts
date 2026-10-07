import { useAuthStore } from "@/shared/store/auth.store";

/**
 * Connection to the backend's realtime socket (REALTIME_PLAN.md §3).
 *
 * The socket.io client is loaded from the backend itself (socket.io serves its
 * own matching client next to the socket) rather than bundled: no frontend
 * dependency, the client version always matches the server, and a backend
 * without socket.io simply means no live updates — never a broken page.
 *
 * It lives under the API prefix, so it goes through the same proxy as every
 * API call (Vite `/api` in dev, nginx `/api` in production).
 */
const API_BASE = new URL(import.meta.env.VITE_API_URL || "/api", window.location.origin);
const SOCKET_PATH = `${API_BASE.pathname.replace(/\/$/, "")}/socket.io`;
const CLIENT_URL = `${API_BASE.origin}${SOCKET_PATH}/socket.io.esm.min.js`;

/** The slice of the socket.io client API this app uses. */
export interface RealtimeSocket {
  on(event: string, handler: (...args: unknown[]) => void): RealtimeSocket;
  disconnect(): RealtimeSocket;
}

type IoFactory = (
  uri: string,
  opts: { path: string; auth: (cb: (data: { token: string | null }) => void) => void }
) => RealtimeSocket;

/** Connect, or resolve null when the backend has no realtime socket. */
export async function openRealtimeSocket(): Promise<RealtimeSocket | null> {
  try {
    const { io } = (await import(/* @vite-ignore */ CLIENT_URL)) as { io: IoFactory };
    return io(API_BASE.origin, {
      path: SOCKET_PATH,
      // Read at every (re)connect so a reconnect never uses a stale token.
      auth: (cb) => cb({ token: useAuthStore.getState().token }),
    });
  } catch {
    return null;
  }
}
