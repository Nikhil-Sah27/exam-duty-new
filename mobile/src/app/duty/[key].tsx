import { Stack, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { View } from "react-native";

import { alarmsForUnit, useAlarmState } from "@/alarms";
import { Banner, Button, Card, Chip, EmptyState, Icon, RoleChip, Screen, Text } from "@/components/ui";
import { useConfirmUnit, useUnit } from "@/features/duties/hooks";
import { WEB_URL } from "@/lib/config";
import { examTitle, formatClock, formatExamDate, formatInstant } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/roles";
import { useTheme } from "@/theme";

function Row({ icon, label, value }: { icon: Parameters<typeof Icon>[0]["name"]; label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
      <Icon name={icon} size={18} color={colors.textMuted} />
      <View style={{ flex: 1 }}>
        <Text variant="caption" muted>
          {label}
        </Text>
        <Text>{value}</Text>
      </View>
    </View>
  );
}

export default function DutyDetailScreen() {
  const { colors } = useTheme();
  const { key } = useLocalSearchParams<{ key: string }>();
  const { unit, isLoading, refetch, isRefetching } = useUnit(key);
  const confirm = useConfirmUnit();
  const lastSyncAt = useAlarmState((s) => s.lastSyncAt);
  const [alarms, setAlarms] = useState<{ fireAt: number; title: string }[]>([]);

  useEffect(() => {
    if (key) void alarmsForUnit(key).then(setAlarms);
  }, [key, lastSyncAt]);

  if (!unit) {
    return (
      <Screen edges={[]}>
        {isLoading ? (
          <Text muted>Loading…</Text>
        ) : (
          <EmptyState icon="info" title="This duty isn't upcoming any more" message="It may have finished, been cancelled or been swapped. Check Alerts for details." />
        )}
      </Screen>
    );
  }

  const isGroup = unit.role !== "invigilator";
  return (
    <Screen edges={[]} refreshing={isRefetching} onRefresh={() => void refetch()}>
      <Stack.Screen options={{ title: `${ROLE_LABELS[unit.role]} duty` }} />
      <Card>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          <RoleChip role={unit.role} />
          {unit.confirmed ? (
            <Chip label="Confirmed" fg={colors.success} bg={colors.successBg} />
          ) : (
            <Chip label="Not confirmed" fg={colors.warning} bg={colors.warningBg} />
          )}
        </View>
        <Text variant="heading">{examTitle(unit.examLabel, unit.semester)}</Text>
        <Row icon="calendar" label="Date" value={formatExamDate(unit.date)} />
        <Row icon="clock" label="Time" value={`${formatClock(unit.startTime)} – ${formatClock(unit.endTime)}`} />
        {unit.building ? <Row icon="building" label="Building" value={unit.building} /> : null}
        <Row
          icon="room"
          label={isGroup ? `Rooms (${unit.rooms.length})` : "Room"}
          value={unit.rooms.length ? unit.rooms.join(", ") : unit.location}
        />
        {!unit.confirmed ? (
          <Button title="Confirm I'll be there" icon="confirm" size="lg" onPress={() => confirm.mutate(unit)} loading={confirm.isPending} />
        ) : null}
        {confirm.isError ? <Banner tone="danger" title={confirm.error.message} /> : null}
      </Card>

      <Card>
        <Text variant="subheading">Alarms for this duty</Text>
        {alarms.length ? (
          alarms.map((a) => (
            <View key={a.fireAt} style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
              <Icon name="alarm" size={18} color={colors.primary} />
              <Text>{formatInstant(a.fireAt)}</Text>
            </View>
          ))
        ) : (
          <Text muted>No alarm set. Check Settings → Duty alarms.</Text>
        )}
      </Card>

      <Button
        title="Request a change on the website"
        variant="secondary"
        icon="external"
        onPress={() => void WebBrowser.openBrowserAsync(`${WEB_URL}/${unit.role}/change-requests`)}
      />
    </Screen>
  );
}
