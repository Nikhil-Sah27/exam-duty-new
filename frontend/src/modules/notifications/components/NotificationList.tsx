import { useScopedNotifications, useMarkAllAsRead } from "../hooks";
import NotificationItem from "./NotificationItem";
import ClearAllNotificationsButton from "./ClearAllNotificationsButton";
import { Button } from "@/shared/components";

export default function NotificationList() {
  const { data: notifications, isLoading } = useScopedNotifications();
  const markAll = useMarkAllAsRead();

  const list = notifications ?? [];
  const hasAny = list.length > 0;
  const hasUnread = list.some((n) => !n.isRead);

  return (
    <div className="flex max-h-96 w-80 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-800">Notifications</h3>
        <div className="flex items-center gap-2">
          {hasUnread && (
            <Button
              variant="secondary"
              onClick={() => markAll.mutate()}
              isLoading={markAll.isPending}
              className="border-0 px-2 py-1 text-xs text-blue-600 hover:bg-transparent hover:text-blue-800"
            >
              Mark all read
            </Button>
          )}
          {hasAny && <ClearAllNotificationsButton />}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <p className="p-4 text-center text-sm text-gray-400">Loading...</p>
        ) : !hasAny ? (
          <p className="p-6 text-center text-sm text-gray-400">
            No notifications available
          </p>
        ) : (
          <div className="divide-y divide-gray-100">
            {list.map((n) => (
              <NotificationItem key={n._id} notification={n} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
