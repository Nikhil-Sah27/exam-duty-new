import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { View } from "react-native";

import { useAlarmSettings, useAlarmState } from "@/alarms";
import { Banner, Button, Card, EmptyState, Icon, ListRow, Divider, Screen, Text } from "@/components/ui";
import { SoundCheckBanner } from "@/features/alarms/SoundCheckBanner";
import { DutyUnitCard } from "@/features/duties/DutyUnitCard";
import { useConfirmUnit, useMyUnits } from "@/features/duties/hooks";
import { WEB_URL } from "@/lib/config";
import { formatInstant } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/roles";
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
  const nextAlarm = useAlarmState((s) => s.nextAlarm);
  const alarmsOn = useAlarmSettings((s) => s.settings.enabled);
  const [confirming, setConfirming] = useState<string | null>(null);
  const role = user?.activeRole;
  const unconfirmed = units.data?.filter((u) => !u.confirmed).length ?? 0;

  return (
    <Screen refreshing={units.isRefetching} onRefresh={() => void units.refetch()}>
      <View style={{ gap: 4 }}>
        <Text muted>{greeting()},</Text>
        <Text variant="title">{user?.name ?? ""}</Text>
        {role ? (
          <Text variant="caption" muted>
            Signed in as {ROLE_LABELS[role]}
          </Text>
        ) : null}
      </View>

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

      {unconfirmed > 0 ? (
        <Banner tone="warning" title={`${unconfirmed} dut${unconfirmed === 1 ? "y needs" : "ies need"} your confirmation`}>
          <Text variant="caption" color={colors.warning}>
            {"Let the exam cell know you'll be there."}
          </Text>
        </Banner>
      ) : null}

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
          <Text variant="label" muted>
            On the website
          </Text>
          <ListRow
            icon="swap"
            title="Change requests"
            subtitle="Swap or give up a duty"
            chevron
            onPress={() => void WebBrowser.openBrowserAsync(`${WEB_URL}/${role}/change-requests`)}
          />
          <Divider />
          <ListRow
            icon="chat"
            title="Message the exam cell"
            subtitle="Chat with CS"
            chevron
            onPress={() => void WebBrowser.openBrowserAsync(`${WEB_URL}/${role}/messages`)}
          />
        </Card>
      ) : null}
    </Screen>
  );
}
