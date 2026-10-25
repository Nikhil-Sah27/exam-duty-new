import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { Banner, Button, Card, Chip, EmptyState, ListRow, Divider, Screen, Text } from "@/components/ui";
import { NextAlarmCard } from "@/features/alarms/NextAlarmCard";
import { CHANGE_REQUESTS_HREF } from "@/features/change-requests/routes";
import { DutyProgressSummary } from "@/features/duties/DutyProgressSummary";
import { DutyUnitCard } from "@/features/duties/DutyUnitCard";
import { useConfirmUnit, useMyUnits } from "@/features/duties/hooks";
import { useUnreadMessages } from "@/features/messages/hooks";
import { TabHeader } from "@/features/notifications/TabHeader";
import { ROLE_LABELS, isTeacherRole } from "@/lib/roles";
import { useAuthStore } from "@/store/auth";
import { useTheme } from "@/theme";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default function HomeScreen() {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const units = useMyUnits();
  const confirm = useConfirmUnit();
  const [confirming, setConfirming] = useState<string | null>(null);
  const { data: unreadMessages = 0 } = useUnreadMessages();
  const role = user?.activeRole;
  const unconfirmed = units.data?.filter((u) => !u.confirmed).length ?? 0;

  return (
    <Screen refreshing={units.isRefetching} onRefresh={() => void units.refetch()}>
      <TabHeader>
        <View style={{ gap: 4 }}>
          <Text muted>{greeting()},</Text>
          <Text variant="title">{user?.name ?? ""}</Text>
          {role ? (
            <Text variant="caption" muted>
              Signed in as {ROLE_LABELS[role]}
            </Text>
          ) : null}
        </View>
      </TabHeader>

      <NextAlarmCard />

      {unconfirmed > 0 ? (
        <Banner tone="warning" title={`${unconfirmed} dut${unconfirmed === 1 ? "y needs" : "ies need"} your confirmation`}>
          <Text variant="caption" color={colors.warning}>
            {"Let the exam cell know you'll be there."}
          </Text>
        </Banner>
      ) : null}

      {role && isTeacherRole(role) ? <DutyProgressSummary role={role} /> : null}

      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text variant="heading">Upcoming duties</Text>
        {units.data?.length ? (
          <Text variant="caption" muted>
            {units.data.length} total
          </Text>
        ) : null}
      </View>

      {units.isLoading ? (
        <Text muted>Loading your duties…</Text>
      ) : units.isError ? (
        <Banner tone="danger" title="Couldn't load your duties">
          <Text variant="caption" color={colors.danger}>
            {units.error.message} — pull down to retry.
          </Text>
        </Banner>
      ) : units.data && units.data.length > 0 ? (
        units.data.map((unit) => (
          <DutyUnitCard
            key={unit.key}
            unit={unit}
            onPress={() => router.push({ pathname: "/duty/[key]", params: { key: unit.key } })}
            confirming={confirming === unit.key && confirm.isPending}
            onConfirm={() => {
              setConfirming(unit.key);
              confirm.mutate(unit);
            }}
          />
        ))
      ) : (
        <Card>
          <EmptyState
            icon="calendar"
            title="No upcoming duties"
            message="Pick your duties for the next exams — your alarms set themselves."
            action={<Button title="Select a duty" icon="select" onPress={() => router.navigate("/select")} />}
          />
        </Card>
      )}

      {confirm.isError ? <Banner tone="danger" title={confirm.error.message} /> : null}

      {role && role !== "cs" ? (
        <Card>
          <ListRow
            icon="swap"
            title="Change requests"
            subtitle="Move or swap a duty"
            chevron
            onPress={() => router.push(CHANGE_REQUESTS_HREF)}
          />
          <Divider />
          <ListRow
            icon="chat"
            title="Message the exam cell"
            subtitle="Chat with CS"
            right={unreadMessages > 0 ? <Chip label={String(unreadMessages)} fg={colors.onPrimary} bg={colors.danger} /> : null}
            chevron
            onPress={() => router.navigate("/messages")}
          />
        </Card>
      ) : null}
    </Screen>
  );
}
