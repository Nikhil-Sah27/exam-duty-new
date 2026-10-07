import { router } from "expo-router";
import { Pressable, View } from "react-native";

import { Banner, Button, Card, EmptyState, Screen, Text } from "@/components/ui";
import type { AppNotification } from "@/features/notifications/api";
import { useMarkAllRead, useMarkRead, useNotifications } from "@/features/notifications/hooks";
import { timeAgo } from "@/lib/format";
import { findUnitByDutyId } from "@/runtime/navigation";
import { useTheme } from "@/theme";

function NotificationRow({ n, onPress }: { n: AppNotification; onPress: () => void }) {
  const { colors, radius } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        gap: 12,
        padding: 14,
        borderRadius: radius.md,
        backgroundColor: n.isRead ? colors.surface : colors.infoBg,
        borderWidth: 1,
        borderColor: n.isRead ? colors.border : colors.infoBg,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <View style={{ width: 8, paddingTop: 6 }}>
        {!n.isRead ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary }} /> : null}
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text variant="body" style={{ fontWeight: n.isRead ? "500" : "700" }}>
          {n.title}
        </Text>
        <Text variant="caption" muted>
          {n.message}
        </Text>
        <Text variant="caption" muted style={{ opacity: 0.7 }}>
          {timeAgo(n.createdAt)}
        </Text>
      </View>
    </Pressable>
  );
}

export default function AlertsScreen() {
  const { colors } = useTheme();
  const list = useNotifications();
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();
  const unread = list.data?.filter((n) => !n.isRead).length ?? 0;

  const open = async (n: AppNotification) => {
    if (!n.isRead) markRead.mutate(n._id);
    if (n.refModel === "Duty" && n.refId) {
      const unit = await findUnitByDutyId(n.refId);
      if (unit) router.push({ pathname: "/duty/[key]", params: { key: unit.key } });
    }
  };

  return (
    <Screen refreshing={list.isRefetching} onRefresh={() => void list.refetch()}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text variant="title">Alerts</Text>
        {unread > 0 ? (
          <Button title="Mark all read" variant="ghost" icon="doneAll" onPress={() => markAll.mutate()} loading={markAll.isPending} />
        ) : null}
      </View>

      {list.isLoading ? (
        <Text muted>Loading…</Text>
      ) : list.isError ? (
        <Banner tone="danger" title="Couldn't load alerts">
          <Text variant="caption" color={colors.danger}>
            {list.error.message} — pull down to retry.
          </Text>
        </Banner>
      ) : list.data && list.data.length > 0 ? (
        <View style={{ gap: 10 }}>
          {list.data.map((n) => (
            <NotificationRow key={n._id} n={n} onPress={() => void open(n)} />
          ))}
          <Text variant="caption" muted style={{ textAlign: "center", marginTop: 8 }}>
            Showing your latest {list.data.length} alerts.
          </Text>
        </View>
      ) : (
        <Card>
          <EmptyState icon="alerts" title="You're all caught up" message="Duty assignments, changes and reminders show up here and on your lock screen." />
        </Card>
      )}
    </Screen>
  );
}
