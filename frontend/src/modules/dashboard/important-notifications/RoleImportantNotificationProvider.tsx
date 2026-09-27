import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/shared/store/auth.store";
import { useNotifications } from "@/modules/notifications/hooks";
import { useImportantNotificationQueue } from "./useImportantNotificationQueue";
import { usePersistedSeen } from "./usePersistedSeen";
import ImportantNotificationContainer from "./ImportantNotificationContainer";
import {
  buildRoleImportantNotifications,
  type OperationalRole,
} from "./roleNotificationSelectors";

const OP_ROLES: OperationalRole[] = ["invigilator", "rs", "dcs"];

/**
 * Important-notification popups for the operational dashboards (Invigilator /
 * RS / DCS) — the teacher-facing counterpart to the CS
 * `ImportantNotificationProvider`. Reuses the same glass popup UI + one-at-a-
 * time queue, sourced from the per-user backend notification feed (the same
 * feed the bell reads), so popup and bell always agree. Self-gates on
 * `activeRole`; renders nothing for CS (which has its own provider) or any
 * unknown role.
 */
export default function RoleImportantNotificationProvider() {
  const activeRole = useAuthStore((s) => s.user?.activeRole);
  const userId = useAuthStore((s) => s.user?.id);
  const navigate = useNavigate();

  const { data: feed } = useNotifications();

  const isOpRole = OP_ROLES.includes(activeRole as OperationalRole);
  const role = activeRole as OperationalRole;

  const notifications = useMemo(() => {
    if (!isOpRole) return [];
    return buildRoleImportantNotifications({
      role,
      notifications: feed ?? [],
      now: Date.now(),
    });
  }, [isOpRole, role, feed]);

  const { seen, markSeen } = usePersistedSeen(userId);
  const { current, visible, dismiss } = useImportantNotificationQueue(
    notifications,
    {},
    { initialSeen: seen, onSeen: markSeen },
  );

  if (!isOpRole) return null;

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
