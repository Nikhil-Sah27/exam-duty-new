
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchNotifications,
  fetchUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications,
} from "../services";
import type { Notification } from "../types";
import { useAuthStore } from "@/shared/store/auth.store";
import { useDutiesByTeacher } from "@/modules/shared/exams/hooks/useSharedExamData";

const NOTIFICATIONS_KEY = ["notifications"];
const UNREAD_COUNT_KEY = ["notifications", "unread-count"];

const OPERATIONAL_ROLES = new Set(["invigilator", "rs", "dcs"]);

/**
 * Scope a notification feed to one operational role. Keeps the dashboards a
 * multi-role teacher switches between from showing each other's duty messages.
 *
 * A notification is kept when it belongs to the active role or is role-agnostic:
 *   1. `role` set by the backend wins (the authoritative, server-side scope).
 *   2. Otherwise — for notifications written before role scoping, or a backend
 *      that hasn't been updated — derive the role from the referenced duty when
 *      the viewer still holds it (`dutyRoleById`).
 *   3. No role info at all (announcements, exam updates, select-duty nudges) →
 *      role-agnostic, shown everywhere.
 * CS (and any non-operational role) sees the full, unscoped feed.
 */
export function scopeNotifications(
  list: readonly Notification[],
  activeRole: string | null | undefined,
  dutyRoleById: Map<string, string>,
): Notification[] {
  if (!activeRole || !OPERATIONAL_ROLES.has(activeRole)) return [...list];
  return list.filter((n) => {
    if (n.role) return n.role === activeRole;
    if (n.refModel === "Duty" && n.refId) {
      const derived = dutyRoleById.get(n.refId);
      if (derived) return derived === activeRole;
    }
    return true;
  });
}

export const useNotifications = () => {
  return useQuery({
    queryKey: NOTIFICATIONS_KEY,
    queryFn: fetchNotifications,
    refetchInterval: 30_000,
  });
};

/**
 * Role-scoped notification feed — what every teacher-facing surface (bell list,
 * popups) should read so a multi-role teacher never sees the other role's
 * messages, even if the backend feed isn't role-filtered yet.
 */
export const useScopedNotifications = () => {
  const activeRole = useAuthStore((s) => s.user?.activeRole);
  const userId = useAuthStore((s) => s.user?.id);
  const query = useNotifications();
  // All-role duties (no role arg) → map duty id → its role, to classify
  // notifications the backend left unscoped.
  const dutiesQuery = useDutiesByTeacher(userId);

  const dutyRoleById = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of dutiesQuery.data ?? []) m.set(d._id, d.role ?? "invigilator");
    return m;
  }, [dutiesQuery.data]);

  const data = useMemo(
    () => scopeNotifications(query.data ?? [], activeRole, dutyRoleById),
    [query.data, activeRole, dutyRoleById],
  );

  return { ...query, data };
};

export const useUnreadCount = () => {
  return useQuery({
    queryKey: UNREAD_COUNT_KEY,
    queryFn: fetchUnreadCount,
    refetchInterval: 30_000,
  });
};

/**
 * Unread badge count derived from the role-scoped feed, so the bell number
 * agrees with the list the user actually sees in their current dashboard.
 */
export const useScopedUnreadCount = (): number => {
  const { data } = useScopedNotifications();
  return (data ?? []).filter((n) => !n.isRead).length;
};

export const useMarkAsRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
      queryClient.invalidateQueries({ queryKey: UNREAD_COUNT_KEY });
    },
  });
};

export const useMarkAllAsRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
      queryClient.invalidateQueries({ queryKey: UNREAD_COUNT_KEY });
    },
  });
};

export const useDeleteNotification = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteNotification(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
      queryClient.invalidateQueries({ queryKey: UNREAD_COUNT_KEY });
    },
  });
};

export const useDeleteAllNotifications = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => deleteAllNotifications(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
      queryClient.invalidateQueries({ queryKey: UNREAD_COUNT_KEY });
    },
  });
};
