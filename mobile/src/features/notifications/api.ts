import api from "@/lib/api";
import type { ApiEnvelope } from "@/lib/types";

export interface AppNotification {
  _id: string;
  type: string;
  title: string;
  message: string;
  role: string | null;
  refModel: "Duty" | "ChangeRequest" | null;
  refId: string | null;
  isRead: boolean;
  createdAt: string;
}

/** Latest 50, scoped server-side to the active role (plus role-agnostic ones). */
export async function fetchNotifications(): Promise<AppNotification[]> {
  const res = await api.get<ApiEnvelope<AppNotification[]>>("/notifications");
  return res.data.data ?? [];
}

export async function fetchUnreadCount(): Promise<number> {
  const res = await api.get<ApiEnvelope<{ count: number }>>("/notifications/unread-count");
  return res.data.data?.count ?? 0;
}

export async function markRead(id: string): Promise<void> {
  await api.patch(`/notifications/${id}/read`);
}

export async function markAllRead(): Promise<void> {
  await api.patch("/notifications/read-all");
}
