import { View } from "react-native";

import { Banner, Screen, Text } from "@/components/ui";
import { TabHeader } from "@/features/notifications/TabHeader";
import { greeting } from "@/lib/format";
import { useAuthStore } from "@/store/auth";
import { useTheme } from "@/theme";

import { AssignmentStatusCard } from "./components/AssignmentStatusCard";
import { ExamList } from "./components/ExamList";
import { StatTile } from "./components/StatTile";
import { useCsDashboard } from "./hooks";

/**
 * CS Home — the phone-sized CS dashboard: ongoing and upcoming exam counts and
 * lists, and the next exam date's classroom assignment status. With no ongoing
 * or upcoming exams it shows just the two zero counts (no status card), like
 * the web dashboard's numbers, which this mirrors through the same selectors.
 */
export default function CsHomeScreen() {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const d = useCsDashboard();
  const active = d.ongoing.length > 0 || d.upcoming.length > 0;

  return (
    <Screen refreshing={d.isRefetching} onRefresh={() => void d.refetch()}>
      <TabHeader>
        <View style={{ gap: 4 }}>
          <Text muted>{greeting()},</Text>
          <Text variant="title">{user?.name ?? ""}</Text>
          <Text variant="caption" muted>
            Signed in as CS
          </Text>
        </View>
      </TabHeader>

      {d.error && !d.groupsLoading ? (
        <Banner tone="danger" title="Couldn't load the dashboard">
          <Text variant="caption" color={colors.danger}>
            {d.error instanceof Error ? d.error.message : "Please try again"} — pull down to retry.
          </Text>
        </Banner>
      ) : null}

      <View style={{ flexDirection: "row", gap: 8 }}>
        <StatTile label="Ongoing exams" value={d.ongoing.length} fg={colors.warning} bg={colors.warningBg} />
        <StatTile label="Upcoming exams" value={d.upcoming.length} fg={colors.info} bg={colors.infoBg} />
      </View>

      {d.groupsLoading ? (
        <Text muted>Loading exams…</Text>
      ) : active ? (
        <>
          {d.targetLoading ? <Text muted>Loading assignment status…</Text> : <AssignmentStatusCard target={d.target} />}
          <ExamList title="Ongoing exams" exams={d.ongoing} />
          <ExamList title="Upcoming exams" exams={d.upcoming} />
        </>
      ) : null}
    </Screen>
  );
}
