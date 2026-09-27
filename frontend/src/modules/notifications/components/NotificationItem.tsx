import { useState } from "react";
import { Star, Trash2 } from "lucide-react";
import { Notification } from "../types";
import { useDeleteNotification, useMarkAsRead } from "../hooks";
import {
  getDisplayContent,
  getNotificationMeta,
  timeAgo,
} from "../utils/notificationHelpers";
import NotificationDeleteModal from "./NotificationDeleteModal";

interface NotificationItemProps {
  notification: Notification;
}

/**
 * Single notification row. Clicking the card body marks it as read (existing
 * behavior); the trash icon opens a per-item confirmation modal and, on
 * confirm, deletes only this notification via the JWT-scoped endpoint.
 */
export default function NotificationItem({
  notification,
}: NotificationItemProps) {
  const markRead = useMarkAsRead();
  const deleteOne = useDeleteNotification();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleCardClick = () => {
    if (!notification.isRead) markRead.mutate(notification._id);
  };

  // Stop the click from bubbling to the card so opening the delete modal
  // doesn't also flip read-state.
  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmOpen(true);
  };

  const handleConfirmDelete = () => {
    deleteOne.mutate(notification._id, {
      onSettled: () => setConfirmOpen(false),
    });
  };

  const meta = getNotificationMeta(notification.type);
  const { title, message } = getDisplayContent(notification);

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={handleCardClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleCardClick();
          }
        }}
        className={`group/notif flex w-full cursor-pointer flex-col gap-1 border-l-4 px-4 py-3 text-left transition-colors hover:bg-gray-50 ${
          meta.border
        } ${
          meta.highlight
            ? "bg-amber-50/60 ring-1 ring-inset ring-amber-300/70 dark:bg-amber-500/10"
            : notification.isRead
              ? "opacity-60"
              : "bg-blue-50/50"
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
            {meta.highlight ? (
              <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-500" />
            ) : (
              <span
                className={`inline-block h-2 w-2 shrink-0 rounded-full ${
                  notification.isRead ? "bg-transparent" : meta.dot
                }`}
              />
            )}
            {title}
          </span>
          <span className="shrink-0 text-xs text-gray-400">
            {timeAgo(notification.createdAt)}
          </span>
        </div>
        <p className="text-xs text-gray-500">{message}</p>

        <div className="mt-1 flex items-center justify-end">
          <button
            type="button"
            onClick={handleDeleteClick}
            disabled={deleteOne.isPending}
            aria-label="Delete notification"
            title="Delete notification"
            className="rounded p-1 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <NotificationDeleteModal
        open={confirmOpen}
        variant="single"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleConfirmDelete}
        isDeleting={deleteOne.isPending}
      />
    </>
  );
}
