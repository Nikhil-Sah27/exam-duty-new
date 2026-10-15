import { useMutation, useQuery } from "@tanstack/react-query";
import * as Notifications from "expo-notifications";
import { useEffect } from "react";
import { Platform } from "react-native";

import { fetchNotifications, fetchUnreadCount, markAllRead, markRead } from "@/features/notifications/api";
import { queryClient } from "@/lib/queryClient";
import { queryKeys } from "@/lib/queryKeys";
import { useAuthStore } from "@/store/auth";

export function useNotifications() {
  const token = useAuthStore((s) => s.token);
  return useQuery({ queryKey: queryKeys.notifications, queryFn: fetchNotifications, enabled: !!token });
}

export function useUnreadCount() {
  const token = useAuthStore((s) => s.token);
  const query = useQuery({
    queryKey: queryKeys.unreadCount,
    queryFn: fetchUnreadCount,
    enabled: !!token,
    refetchInterval: 60_000,
  });
  // Keep the app-icon badge in step with the inbox (iOS; Android launchers vary).
  useEffect(() => {
    if (Platform.OS === "ios" && typeof query.data === "number") {
      void Notifications.setBadgeCountAsync(query.data).catch(() => undefined);
    }
  }, [query.data]);
  return query;
}

const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications });

export function useMarkRead() {
  return useMutation({ mutationFn: markRead, onSuccess: refresh });
}

export function useMarkAllRead() {
  return useMutation({ mutationFn: markAllRead, onSuccess: refresh });
}
