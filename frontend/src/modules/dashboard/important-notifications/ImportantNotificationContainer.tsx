import { createPortal } from "react-dom";
import { useAppStore } from "@/shared/store/app.store";
import type { ImportantNotification } from "./types";
import ImportantNotificationPopup from "./ImportantNotificationPopup";

interface ImportantNotificationContainerProps {
  notification: ImportantNotification | null;
  visible: boolean;
  onAction: () => void;
  onClose: () => void;
}

/**
 * Anchors the important-notification popup near the top-left of the dashboard
 * CONTENT (beside the welcome banner), not over the sidebar — its left offset
 * tracks the sidebar's open/closed state (matching MainContent's ml-60). Stays
 * inside the viewport on every screen (width clamps in the popup) — no
 * horizontal scroll. Portalled to <body> so it never affects the layout.
 */
export default function ImportantNotificationContainer({
  notification,
  visible,
  onAction,
  onClose,
}: ImportantNotificationContainerProps) {
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  if (!notification) return null;

  return createPortal(
    <div
      className="pointer-events-none fixed top-[8.5rem] z-50 transition-[left] duration-300"
      style={{ left: sidebarOpen ? "16.5rem" : "1rem" }}
    >
      <ImportantNotificationPopup
        key={notification.id}
        notification={notification}
        visible={visible}
        onAction={onAction}
        onClose={onClose}
      />
    </div>,
    document.body,
  );
}
