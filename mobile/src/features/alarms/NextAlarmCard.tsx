import { router } from "expo-router";
import { View } from "react-native";

import { useAlarmSettings, useAlarmState } from "@/alarms";
import { Card, Icon, Text } from "@/components/ui";
import { useMyUnits } from "@/features/duties/hooks";
import { formatInstant } from "@/lib/format";
import { useTheme } from "@/theme";

import { SoundCheckBanner } from "./SoundCheckBanner";

/**
 * Home's "Next alarm" card (+ the silent-phone warning under it). Shown only
 * while the teacher has upcoming duties — in any role, whatever their
 * designation: it reads the same `/duties/my-units` list the alarms are
 * scheduled from and Home's "Upcoming duties" shows, so with nothing upcoming
 * there is nothing to ring for and the card stays hidden. Hidden while that
 * list is still loading too, so it never flashes in and out.
 */
export function NextAlarmCard() {
  const { colors } = useTheme();
  const units = useMyUnits();
  const nextAlarm = useAlarmState((s) => s.nextAlarm);
  const alarmsOn = useAlarmSettings((s) => s.settings.enabled);

  if (!units.data?.length) return null;

  return (
    <>
      <Card onPress={() => router.navigate("/settings")} style={{ backgroundColor: colors.primaryDeep, borderColor: colors.primaryDeep }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <Icon name={alarmsOn ? "alarmOn" : "alarmOff"} size={28} color="#ffffff" />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="label" color="#e0e7ff">
              {alarmsOn ? "Next alarm" : "Duty alarms are off"}
            </Text>
            <Text variant="subheading" color="#ffffff">
              {!alarmsOn ? "Turn them on in Settings" : nextAlarm ? formatInstant(nextAlarm.fireAt) : "None scheduled"}
            </Text>
            {alarmsOn && nextAlarm ? (
              <Text variant="caption" color="#e0e7ff">
                {nextAlarm.title}
              </Text>
            ) : null}
          </View>
          <Icon name="chevron" size={16} color="#e0e7ff" />
        </View>
      </Card>

      {alarmsOn && nextAlarm ? <SoundCheckBanner /> : null}
    </>
  );
}
