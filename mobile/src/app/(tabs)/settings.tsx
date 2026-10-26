import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Switch, View } from "react-native";

import {
  getAlarmHealth,
  LEAD_OPTIONS,
  playSoundCheck,
  scheduleTestAlarm,
  syncAlarms,
  useAlarmSettings,
  useAlarmState,
  type HealthItem,
  type LeadId,
} from "@/alarms";
import { Banner, Button, Card, Divider, Icon, Screen, Text } from "@/components/ui";
import { AccountCard, AppVersionNote } from "@/features/auth/AccountCard";
import { TabHeader } from "@/features/notifications/TabHeader";
import { formatInstant } from "@/lib/format";
import { useTheme } from "@/theme";

function HealthRow({ item, onFixed }: { item: HealthItem; onFixed: () => void }) {
  const { colors } = useTheme();
  const tone = item.ok === true ? colors.success : item.ok === false ? colors.danger : colors.warning;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 }}>
      <Icon name={item.ok === true ? "check" : item.ok === false ? "error" : "info"} size={20} color={tone} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="body" style={{ fontWeight: "600" }}>
          {item.label}
        </Text>
        <Text variant="caption" muted>
          {item.detail}
        </Text>
      </View>
      {item.ok !== true && item.fix ? (
        <Button
          title={item.fixLabel ?? "Fix"}
          variant="secondary"
          onPress={async () => {
            await item.fix?.();
            onFixed();
          }}
        />
      ) : null}
    </View>
  );
}

export default function SettingsScreen() {
  const { colors } = useTheme();
  const { settings, update } = useAlarmSettings();
  const alarmState = useAlarmState();
  const [health, setHealth] = useState<HealthItem[]>([]);
  const [testAt, setTestAt] = useState<number | null>(null);

  const refreshHealth = useCallback(() => {
    void getAlarmHealth().then(setHealth).catch(() => undefined);
  }, []);

  // Re-check whenever the tab is shown — e.g. after returning from system settings.
  useFocusEffect(refreshHealth);

  const apply = async (patch: Parameters<typeof update>[0]) => {
    await update(patch);
    await syncAlarms();
  };

  const toggleLead = (id: LeadId) => {
    const has = settings.leads.includes(id);
    const leads = has ? settings.leads.filter((l) => l !== id) : [...settings.leads, id];
    void apply({ leads });
  };

  const test = async () => {
    const at = await scheduleTestAlarm(10);
    setTestAt(at);
    setTimeout(() => setTestAt(null), 15_000);
  };

  const problems = health.filter((h) => h.ok === false).length;

  return (
    <Screen>
      <TabHeader>
        <Text variant="title">Settings</Text>
      </TabHeader>

      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Icon name="alarm" size={24} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text variant="subheading">Duty alarms</Text>
            <Text variant="caption" muted>
              Rings like an alarm clock before each duty.
            </Text>
          </View>
          <Switch
            value={settings.enabled}
            onValueChange={(enabled) => void apply({ enabled })}
            trackColor={{ true: colors.primary, false: colors.border }}
          />
        </View>

        {settings.enabled ? (
          <>
            <Divider />
            <Text variant="label" muted>
              Ring me
            </Text>
            {LEAD_OPTIONS.map((o) => (
              <View key={o.id} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 4 }}>
                <Text>{o.label}</Text>
                <Switch
                  value={settings.leads.includes(o.id)}
                  onValueChange={() => toggleLead(o.id)}
                  trackColor={{ true: colors.primary, false: colors.border }}
                />
              </View>
            ))}
            {settings.leads.length === 0 ? <Banner tone="warning" title="Pick at least one time, or no alarm will ring." /> : null}
            <Divider />
            <Text variant="caption" muted>
              {alarmState.scheduledCount > 0 && alarmState.nextAlarm
                ? `${alarmState.scheduledCount} alarm${alarmState.scheduledCount === 1 ? "" : "s"} set · next ${formatInstant(alarmState.nextAlarm.fireAt)}`
                : "No alarms set — you have no upcoming duties."}
            </Text>
            {alarmState.lastError ? (
              <Text variant="caption" color={colors.warning}>
                Last sync failed: {alarmState.lastError}. Existing alarms are kept.
              </Text>
            ) : null}
            <Button
              title={testAt ? "Rings in a few seconds — lock your phone" : "Test alarm now"}
              icon="bellRing"
              variant="secondary"
              onPress={() => void test()}
              disabled={!!testAt}
            />
            <Button title="Play alarm sound" icon="volumeUp" variant="secondary" onPress={() => void playSoundCheck()} />
          </>
        ) : null}
      </Card>

      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text variant="subheading">Will my alarm ring?</Text>
          {problems > 0 ? (
            <Text variant="caption" color={colors.danger}>
              {problems} to fix
            </Text>
          ) : health.length ? (
            <Text variant="caption" color={colors.success}>
              All good
            </Text>
          ) : null}
        </View>
        {health.map((item, i) => (
          <View key={item.id}>
            {i > 0 ? <Divider /> : null}
            <HealthRow item={item} onFixed={() => setTimeout(refreshHealth, 800)} />
          </View>
        ))}
      </Card>

      <AccountCard signOutWarning="Alarms on this phone will be removed until you sign in again." />

      <AppVersionNote />
    </Screen>
  );
}
