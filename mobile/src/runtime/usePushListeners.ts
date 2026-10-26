import * as Notifications from "expo-notifications";
import { useEffect, useRef } from "react";

import { CR_KEYS } from "@/features/change-requests/hooks";
import { messageKeys } from "@/features/messages/hooks";
import { queryClient } from "@/lib/queryClient";
import { queryKeys } from "@/lib/queryKeys";
import { pushDataOf } from "@/push";
import { openFromPush } from "@/runtime/navigation";

/**
 * Server-push wiring shared by every signed-in role (TeacherRuntime,
 * CsRuntime): when a push arrives, refresh what it may have changed (alerts,
 * duties, change requests, chats); when one is tapped — or launched the app —
 * open what it's about (openFromPush).
 *
 * `intercept` lets a role claim a notification first and skip the rest
 * (teachers: their own duty alarms). `onReceived` runs after the refresh.
 */
export function usePushListeners({
  intercept,
  onReceived,
}: {
  intercept?: (n: Notifications.Notification) => boolean;
  onReceived?: () => void;
} = {}) {
  // Latest callbacks without re-subscribing on every render.
  const handlers = useRef({ intercept, onReceived });
  useEffect(() => {
    handlers.current = { intercept, onReceived };
  });

  useEffect(() => {
    const open = (response: Notifications.NotificationResponse) => {
      if (handlers.current.intercept?.(response.notification)) return;
      void openFromPush(pushDataOf(response.notification));
    };

    const received = Notifications.addNotificationReceivedListener((n) => {
      if (handlers.current.intercept?.(n)) return;
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
      void queryClient.invalidateQueries({ queryKey: queryKeys.myUnits });
      // Approvals / rejections / new requests arrive as pushes too.
      void queryClient.invalidateQueries({ queryKey: CR_KEYS.all });
      // A chat message: refresh the chat, inbox and Messages tab badge right away.
      void queryClient.invalidateQueries({ queryKey: messageKeys.all });
      handlers.current.onReceived?.();
    });
    const tapped = Notifications.addNotificationResponseReceivedListener(open);

    // Cold start from a tapped push (or iOS alarm notification).
    void Notifications.getLastNotificationResponseAsync().then((last) => {
      if (last) {
        open(last);
        void Notifications.clearLastNotificationResponseAsync();
      }
    });
    return () => {
      received.remove();
      tapped.remove();
    };
  }, []);
}
