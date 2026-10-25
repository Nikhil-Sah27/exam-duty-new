import { View } from "react-native";

import { Banner, Card, EmptyState, Screen, Text } from "@/components/ui";
import { useAuthStore } from "@/store/auth";
import { useTheme } from "@/theme";

import { CompletedDutyCard } from "./CompletedDutyCard";
import { useMyCompletedDuties } from "./hooks";

/**
 * Opened from Home → "Completed". Lists exactly what that number counts, from
 * the same backend function, so the count and this list always agree.
 */
export default function CompletedDutiesScreen() {
  const { colors } = useTheme();
  const role = useAuthStore((s) => s.user?.activeRole ?? null);
  const list = useMyCompletedDuties();
  const group = role === "rs" || role === "dcs";
  const count = list.data?.length ?? 0;
  const noun = group ? (count === 1 ? "group" : "groups") : count === 1 ? "duty" : "duties";

  return (
    <Screen edges={[]} refreshing={list.isRefetching} onRefresh={() => void list.refetch()}>
      {list.isLoading ? (
        <Text muted>Loading…</Text>
      ) : list.isError ? (
        <Banner tone="danger" title="Couldn't load your completed duties">
          <Text variant="caption" color={colors.danger}>
            {list.error.message} — pull down to retry.
          </Text>
        </Banner>
      ) : list.data && list.data.length > 0 ? (
        <View style={{ gap: 10 }}>
          <Text variant="caption" muted>
            {count} completed {noun}, newest first
          </Text>
          {list.data.map((d) => (
            <CompletedDutyCard key={d.key} duty={d} />
          ))}
        </View>
      ) : (
        <Card>
          <EmptyState icon="check" title="No completed duties yet" message="Duties show up here once their exam time has passed." />
        </Card>
      )}
    </Screen>
  );
}
