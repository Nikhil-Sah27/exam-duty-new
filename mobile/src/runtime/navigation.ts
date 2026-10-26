import { router } from "expo-router";

import type { AlarmPayload } from "@/alarms";
import { fetchMyUnits } from "@/features/duties/api";
import { markRead } from "@/features/notifications/api";
import { queryClient } from "@/lib/queryClient";
import { queryKeys } from "@/lib/queryKeys";
import type { DutyUnit } from "@/lib/types";

let alarmScreenOpen = false;
export const setAlarmScreenOpen = (open: boolean) => {
  alarmScreenOpen = open;
};

/**
 * Show the full-screen alarm UI for a ringing/tapped alarm (once). `fromLaunch`
 * = the alarm itself brought the app up (possibly over the lock screen), so the
 * screen sends the app back to the background once handled.
 */
export function openAlarmScreen(p: AlarmPayload, notificationId: string, fromLaunch = false) {
  if (alarmScreenOpen) return;
  alarmScreenOpen = true;
  router.push({
    pathname: "/alarm",
    params: {
      notificationId,
      id: p.id,
      fireAt: String(p.fireAt),
      title: p.title,
      body: p.body,
      unitKey: p.unitKey,
      primaryDutyId: p.primaryDutyId,
      startsAt: p.startsAt,
      lead: p.lead,
      test: p.test ? "1" : "0",
      fromLaunch: fromLaunch ? "1" : "0",
    },
  });
}

/** A unit by any of its duty ids — cache first, then a fresh fetch. */
export async function findUnitByDutyId(dutyId: string): Promise<DutyUnit | undefined> {
  const match = (list?: DutyUnit[]) => list?.find((u) => u.dutyIds.includes(dutyId) || u.primaryDutyId === dutyId);
  const cached = match(queryClient.getQueryData<DutyUnit[]>(queryKeys.myUnits));
  if (cached) return cached;
  try {
    const fresh = await fetchMyUnits();
    queryClient.setQueryData(queryKeys.myUnits, fresh);
    return match(fresh);
  } catch {
    return undefined;
  }
}

/**
 * Open what a notification is about — the single answer for a tapped phone push
 * and a tapped row in Alerts. Resolves false when it has no screen of its own
 * (the caller decides where to stay).
 *   cs_message        → the teacher's chat with CS (Messages tab)
 *   teacher_message   → CS: that teacher's chat
 *   request_submitted → CS: the change-request review queue
 *   a duty            → that duty (or Home if it's no longer upcoming)
 */
export async function openNotificationTarget(n: {
  type?: string;
  dutyId?: string | null;
  conversationId?: string | null;
}): Promise<boolean> {
  if (n.type === "cs_message") {
    router.navigate("/messages");
    return true;
  }
  if (n.type === "teacher_message") {
    if (n.conversationId) router.navigate({ pathname: "/cs/messages/[id]", params: { id: n.conversationId } });
    else router.navigate("/cs/messages");
    return true;
  }
  if (n.type === "request_submitted") {
    router.navigate("/cs/requests");
    return true;
  }
  if (n.dutyId) {
    const unit = await findUnitByDutyId(n.dutyId);
    if (unit) router.push({ pathname: "/duty/[key]", params: { key: unit.key } });
    else router.navigate("/");
    return true;
  }
  return false;
}

/** Where a tapped server push should land (Alerts when it has no screen of its own). */
export async function openFromPush(data: { type?: string; notificationId?: string; dutyId?: string; conversationId?: string }) {
  if (data.notificationId) {
    void markRead(data.notificationId)
      .then(() => queryClient.invalidateQueries({ queryKey: queryKeys.notifications }))
      .catch(() => undefined);
  }
  if (!(await openNotificationTarget(data))) router.navigate("/alerts");
}
