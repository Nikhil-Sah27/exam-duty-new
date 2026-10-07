import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { BackHandler, Platform, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { confirmFromAlarm, snoozeAlarm, stopRinging, type AlarmPayload } from "@/alarms";
import { Button, Icon, Text } from "@/components/ui";
import { useMyUnits } from "@/features/duties/hooks";
import { examTitle, formatClock, formatExamDate, formatInstant } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/roles";
import { setAlarmScreenOpen } from "@/runtime/navigation";

type Params = Record<keyof AlarmPayload | "notificationId" | "fromLaunch", string>;

const back = () => (router.canGoBack() ? router.back() : router.replace("/"));

/** Full-screen view of a ringing duty alarm. Re-checks the duty before sending anyone to a room. */
export default function AlarmScreen() {
  const params = useLocalSearchParams<Params>();
  const payload: AlarmPayload = useMemo(
    () => ({
      id: params.id ?? "",
      fireAt: Number(params.fireAt) || 0,
      title: params.title ?? "Exam duty",
      body: params.body ?? "",
      shortTitle: "",
      unitKey: params.unitKey ?? "",
      primaryDutyId: params.primaryDutyId ?? "",
      startsAt: params.startsAt ?? "",
      lead: (params.lead as AlarmPayload["lead"]) ?? "test",
      test: params.test === "1",
    }),
    [params],
  );
  const notificationId = params.notificationId ?? payload.id;
  // Brought up by the alarm itself (maybe over the lock screen): like a clock
  // app, step aside once handled instead of dropping the user into the app.
  const leave = () => {
    back();
    if (Platform.OS === "android" && params.fromLaunch === "1") BackHandler.exitApp();
  };
  const units = useMyUnits();
  const [busy, setBusy] = useState<"snooze" | "go" | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    setAlarmScreenOpen(true);
    const t = setInterval(() => setNow(new Date()), 15_000);
    return () => {
      clearInterval(t);
      setAlarmScreenOpen(false);
    };
  }, []);

  const unit = units.data?.find((u) => u.key === payload.unitKey);
  const cancelled = !payload.test && units.isSuccess && !unit;

  const dismiss = async () => {
    await stopRinging(notificationId);
    leave();
  };
  const snooze = async () => {
    setBusy("snooze");
    await snoozeAlarm(payload, notificationId);
    leave();
  };
  const onMyWay = async () => {
    setBusy("go");
    await stopRinging(notificationId);
    if (!unit?.confirmed) await confirmFromAlarm(payload); // no-op for tests; errors swallowed
    void units.refetch();
    leave();
  };

  const clock = formatClock(`${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: cancelled ? "#334155" : "#4338ca" }}>
      <View style={{ flex: 1, padding: 24, justifyContent: "space-between" }}>
        <View style={{ alignItems: "center", gap: 10, marginTop: 24 }}>
          <Icon name={cancelled ? "info" : "alarm"} size={44} color="#ffffff" />
          <Text style={{ fontSize: 56, fontWeight: "800", color: "#ffffff", lineHeight: 64 }}>{clock}</Text>
          <Text variant="heading" color="#e0e7ff" style={{ textAlign: "center" }}>
            {cancelled ? "This duty was cancelled" : payload.title}
          </Text>
        </View>

        <View style={{ backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 20, padding: 20, gap: 8 }}>
          {unit ? (
            <>
              <Text variant="label" color="#c7d2fe">
                {ROLE_LABELS[unit.role]} · {examTitle(unit.examLabel, unit.semester)}
              </Text>
              <Text variant="heading" color="#ffffff">
                {formatClock(unit.startTime)} – {formatClock(unit.endTime)}
              </Text>
              <Text color="#e0e7ff">{formatExamDate(unit.date)}</Text>
              <Text variant="subheading" color="#ffffff">
                {unit.location}
              </Text>
              {!unit.confirmed ? (
                <Text variant="caption" color="#fde68a">
                  {"Not confirmed yet — \"I'm on my way\" confirms it."}
                </Text>
              ) : null}
            </>
          ) : cancelled ? (
            <Text color="#e2e8f0">
              {"It's no longer in your upcoming duties — it may have been cancelled, swapped or moved. Check Alerts for details. No need to go."}
            </Text>
          ) : (
            <Text color="#e0e7ff">{payload.body || (payload.test ? "Test alarm" : "Checking your duty…")}</Text>
          )}
          {payload.startsAt && !payload.test && !unit && !cancelled ? (
            <Text variant="caption" color="#c7d2fe">
              Starts {formatInstant(new Date(payload.startsAt))}
            </Text>
          ) : null}
        </View>

        <View style={{ gap: 12 }}>
          {!cancelled ? (
            <Button
              title="I'm on my way"
              icon="walk"
              variant="success"
              size="lg"
              onPress={() => void onMyWay()}
              loading={busy === "go"}
            />
          ) : null}
          <View style={{ flexDirection: "row", gap: 12 }}>
            {!cancelled ? (
              <Button
                title="Snooze 5 min"
                icon="snooze"
                variant="secondary"
                size="lg"
                style={{ flex: 1 }}
                onPress={() => void snooze()}
                loading={busy === "snooze"}
              />
            ) : null}
            <Button title="Dismiss" icon="close" variant="secondary" size="lg" style={{ flex: 1 }} onPress={() => void dismiss()} />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
