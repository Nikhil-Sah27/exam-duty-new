/**
 * Shape of an "important" dashboard notification (the temporary glass popups).
 * Pure data — produced by the centralized selectors, consumed by the queue +
 * UI. The UI never derives any of these fields itself.
 */
export type NotificationPriority = "high" | "medium" | "low";

/** Accent tint per notification kind (kept subtle — glass base stays dominant). */
export type NotificationAccent = "red" | "amber" | "blue" | "violet" | "green";

export interface ImportantNotification {
  /** Stable id used for session-dedup, e.g. `duty-change-2-<reqId>`. */
  id: string;
  priority: NotificationPriority;
  accent: NotificationAccent;
  /** Small category label, e.g. "DUTY REQUEST" / "EXAM REMINDER". */
  category: string;
  title: string;
  message: string;
  /**
   * When true the bubble gets a stronger "very important" treatment — a gold
   * pulsing ring and a star badge. Used e.g. for CS-assigned duties.
   */
  highlight?: boolean;
  /** Optional call-to-action label + existing route to navigate to. */
  actionLabel?: string;
  actionHref?: string;
  createdAt?: string;
}
