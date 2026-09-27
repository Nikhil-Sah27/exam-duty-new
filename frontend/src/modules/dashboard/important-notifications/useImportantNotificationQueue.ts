import { useCallback, useEffect, useRef, useState } from "react";
import type { ImportantNotification } from "./types";

export interface QueueTiming {
  /** Delay before the first popup after mount (so the dashboard shows first). */
  initialDelay: number;
  /** How long a popup stays fully visible. */
  displayDuration: number;
  /** Slide/fade-out duration. */
  exitDuration: number;
  /** Quiet gap between one popup leaving and the next entering. */
  gap: number;
}

const DEFAULT_TIMING: QueueTiming = {
  initialDelay: 2500,
  displayDuration: 6000,
  // Matches the popup's 0.9s fade-out (+ buffer) so it fully fades before unmount.
  exitDuration: 950,
  gap: 800,
};

export interface QueueState {
  /** The notification currently on screen (null when nothing is showing). */
  current: ImportantNotification | null;
  /** Drives the enter/exit animation (true = shown, false = hidden). */
  visible: boolean;
  /** Close the current popup immediately, cancel its timer, advance to next. */
  dismiss: () => void;
}

/**
 * Optional cross-session dedup. `initialSeen` pre-seeds the set (ids already
 * shown to this user in a past session), and `onSeen` fires the first time a
 * notification is shown so the caller can persist it (e.g. to localStorage).
 * Omit both to get the original session-only behaviour (used by the CS surface).
 */
export interface QueuePersistence {
  initialSeen?: Set<string>;
  onSeen?: (id: string) => void;
}

/**
 * Sequences important notifications one-at-a-time with entrance/visible/exit
 * timing. De-dupes via a `seen` set keyed on notification id, so a React
 * re-render never re-shows the same notification. Newly-arrived notifications
 * are picked up once the queue goes idle. When `persistence` is supplied the
 * dedup survives across sessions.
 */
export function useImportantNotificationQueue(
  notifications: ImportantNotification[],
  timing: Partial<QueueTiming> = {},
  persistence: QueuePersistence = {},
): QueueState {
  const t = { ...DEFAULT_TIMING, ...timing };

  const [current, setCurrent] = useState<ImportantNotification | null>(null);
  const [visible, setVisible] = useState(false);

  const seen = useRef<Set<string>>(new Set(persistence.initialSeen ?? []));
  const onSeenRef = useRef(persistence.onSeen);
  onSeenRef.current = persistence.onSeen;
  const timers = useRef<number[]>([]);
  const idle = useRef(false);
  const notifRef = useRef(notifications);
  notifRef.current = notifications;

  const clearTimers = () => {
    timers.current.forEach((id) => clearTimeout(id));
    timers.current = [];
  };
  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  // Circular advance ⇄ hide, resolved through refs so timers always call the
  // latest closures (which read fresh state via refs).
  const advanceRef = useRef<() => void>(() => {});
  const hideRef = useRef<() => void>(() => {});

  advanceRef.current = () => {
    const next = notifRef.current.find((n) => !seen.current.has(n.id));
    if (!next) {
      idle.current = true;
      setCurrent(null);
      setVisible(false);
      return;
    }
    idle.current = false;
    seen.current.add(next.id);
    onSeenRef.current?.(next.id);
    setCurrent(next);
    setVisible(false);
    later(() => setVisible(true), 40); // enter on next frame
    later(() => hideRef.current(), 40 + t.displayDuration);
  };

  hideRef.current = () => {
    setVisible(false);
    later(() => {
      setCurrent(null);
      later(() => advanceRef.current(), t.gap);
    }, t.exitDuration);
  };

  const dismiss = useCallback(() => {
    clearTimers();
    hideRef.current();
  }, []);

  // First popup after the initial delay. Cleanup clears pending timers (also
  // handles StrictMode's mount/unmount/mount without double-starting).
  useEffect(() => {
    later(() => advanceRef.current(), t.initialDelay);
    return () => clearTimers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pick up notifications that arrive after the queue has drained.
  useEffect(() => {
    if (
      idle.current &&
      notifications.some((n) => !seen.current.has(n.id))
    ) {
      idle.current = false;
      later(() => advanceRef.current(), t.gap);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifications]);

  return { current, visible, dismiss };
}
