import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/shared/store/auth.store";
import { useImportantNotifications } from "./useImportantNotifications";
import { useImportantNotificationQueue } from "./useImportantNotificationQueue";
import ImportantNotificationContainer from "./ImportantNotificationContainer";
import type { ImportantNotification } from "./types";

/**
 * Orchestrator for the CS dashboard's important-notification popups. Wires the
 * centralized data (`useImportantNotifications`) to the one-at-a-time queue
 * (`useImportantNotificationQueue`) and renders the floating glass container.
 *
 * Show policy (per CS request):
 *   • The two "always" categories — pending change requests and the
 *     not/partially-assigned alert — pop up EVERY time CS opens the dashboard.
 *   • Every other notification (e.g. the tomorrow's-exams reminder) is shown
 *     only once per page load: it appears on login / refresh, but NOT again on
 *     each in-app navigation back to the dashboard.
 *
 * CS-only surface; renders null for other roles and when nothing is active.
 */
const ALWAYS_CATEGORIES = new Set(["DUTY REQUEST", "ASSIGNMENT ALERT"]);
const isAlways = (n: ImportantNotification) => ALWAYS_CATEGORIES.has(n.category);

/**
 * Ids of "rest" notifications already shown during THIS page load. Module-level
 * (not React state) so it survives route navigations — the provider remounts on
 * every dashboard visit — but resets on a full page reload. Also cleared on a
 * new sign-in (user change) so login re-shows them.
 */
const shownRestThisPageLoad = new Set<string>();
let lastUserId: string | undefined;

export default function ImportantNotificationProvider() {
  const activeRole = useAuthStore((s) => s.user?.activeRole);
  const userId = useAuthStore((s) => s.user?.id);
  const notifications = useImportantNotifications();
  const navigate = useNavigate();

  // New sign-in → forget what the previous session already showed.
  if (userId && userId !== lastUserId) {
    shownRestThisPageLoad.clear();
    lastUserId = userId;
  }

  // Always-categories every mount; the rest only if not yet shown this page load.
  const toShow = useMemo(
    () =>
      notifications.filter(
        (n) => isAlways(n) || !shownRestThisPageLoad.has(n.id),
      ),
    [notifications],
  );
  const restIds = useMemo(
    () => new Set(notifications.filter((n) => !isAlways(n)).map((n) => n.id)),
    [notifications],
  );

  const { current, visible, dismiss } = useImportantNotificationQueue(
    toShow,
    {},
    {
      // Record only "rest" ids so they don't re-pop on later dashboard visits;
      // the always-categories are intentionally never recorded.
      onSeen: (id) => {
        if (restIds.has(id)) shownRestThisPageLoad.add(id);
      },
    },
  );

  // CS-only surface (the dashboard is already CS-gated, but be explicit).
  if (activeRole !== "cs") return null;

  const handleAction = () => {
    if (current?.actionHref) navigate(current.actionHref);
    dismiss();
  };

  return (
    <ImportantNotificationContainer
      notification={current}
      visible={visible}
      onAction={handleAction}
      onClose={dismiss}
    />
  );
}
