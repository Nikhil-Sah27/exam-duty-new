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

/** Where a tapped server push should land. */
export async function openFromPush(data: { notificationId?: string; dutyId?: string }) {
  if (data.notificationId) {
    void markRead(data.notificationId)
      .then(() => queryClient.invalidateQueries({ queryKey: queryKeys.notifications }))
      .catch(() => undefined);
  }
  if (data.dutyId) {
    const unit = await findUnitByDutyId(data.dutyId);
    if (unit) {
      router.push({ pathname: "/duty/[key]", params: { key: unit.key } });
      return;
    }
    router.navigate("/");
    return;
  }
  router.navigate("/alerts");
}
