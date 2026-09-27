import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/shared/store/auth.store";
import { useImportantNotifications } from "./useImportantNotifications";
import { useImportantNotificationQueue } from "./useImportantNotificationQueue";
import ImportantNotificationContainer from "./ImportantNotificationContainer";

/**
 * Orchestrator for the CS dashboard's important-notification popups. Wires the
 * centralized data (`useImportantNotifications`) to the one-at-a-time queue
 * (`useImportantNotificationQueue`) and renders the floating glass container.
 *
 * Additive + self-contained: it holds all notification logic so the dashboard
 * component stays untouched, and it renders nothing (returns null) when there's
 * no active notification or the viewer isn't CS. Does not touch the existing
 * bell notification system.
 */
export default function ImportantNotificationProvider() {
  const activeRole = useAuthStore((s) => s.user?.activeRole);
  const notifications = useImportantNotifications();
  const { current, visible, dismiss } = useImportantNotificationQueue(
    notifications,
  );
  const navigate = useNavigate();

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
