import { useCallback, useRef } from "react";

/**
 * Cross-session dedup store for popup notifications, backed by localStorage and
 * scoped per user. Returns a stable initial `Set` of already-shown ids (read
 * once on mount) plus a `markSeen` writer. Feeds the queue's `persistence`
 * option so every important popup fires exactly once per user, even after a
 * page reload or re-login.
 *
 * Falls back to an in-memory-only set when storage is unavailable (private
 * mode, quota) so the popups still work, just without cross-session memory.
 */
export function usePersistedSeen(userId: string | undefined) {
  const key = userId ? `important-notif-seen:${userId}` : null;

  // Read once — the queue seeds its internal `seen` ref from this on first
  // render, so a stable reference is important.
  const seenRef = useRef<Set<string> | undefined>(undefined);
  if (!seenRef.current) {
    seenRef.current = readSeen(key);
  }

  const markSeen = useCallback(
    (id: string) => {
      seenRef.current?.add(id);
      if (!key) return;
      try {
        // Cap the stored list so it can't grow unbounded over months of use.
        const ids = Array.from(seenRef.current ?? []).slice(-300);
        localStorage.setItem(key, JSON.stringify(ids));
      } catch {
        // Ignore storage failures — dedup degrades to session-only.
      }
    },
    [key],
  );

  return { seen: seenRef.current, markSeen };
}

function readSeen(key: string | null): Set<string> {
  if (!key) return new Set();
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr.map(String)) : new Set();
  } catch {
    return new Set();
  }
}
