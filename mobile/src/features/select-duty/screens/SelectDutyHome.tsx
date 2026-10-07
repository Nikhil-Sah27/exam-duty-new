import { useQueryClient } from "@tanstack/react-query";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { TeacherRole } from "@/lib/types";
import { useAuthStore } from "@/store/auth";
import { radius, roleColors, spacing, useTheme } from "@/theme";

import { CenterState, SectionHeader } from "../components/ui";
import { ProgressCard } from "../components/ProgressCard";
import { formatShortDate } from "../format";
import {
  KEYS,
  useAvailableDutySlots,
  useDcsGroups,
  useExamGroups,
  useMyDuties,
  useMyProgress,
} from "../hooks/queries";
import { selectableFilter } from "../shared/dutyStatusFilter";
import { selectActiveExamGroups } from "../shared/examSelectors";
import { groupExamsByStatusThenType } from "../shared/examSortUtils";
import { getTypeSubtitle } from "../shared/examStatusUtils";
import type { ExamGroup } from "../shared/examTypes";
import { groupRoomsIntoRSGroups } from "../shared/rsDutyGroupingUtils";

export function asTeacherRole(role: string | null | undefined): TeacherRole | null {
  return role === "invigilator" || role === "rs" || role === "dcs" ? role : null;
}

const INTRO: Record<TeacherRole, string> = {
  invigilator: "Pick the rooms you'll invigilate. Full and clashing slots are blocked.",
  rs: "Pick room groups to supervise — up to 5 rooms in the same block, exam and time slot.",
  dcs: "Pick a DCS supervision group — sized automatically by total students (1 DCS per 300).",
};

const STATUS_LABEL = { ongoing: "Ongoing", upcoming: "Upcoming", completed: "Completed" } as const;

interface ExamCounts {
  open: number;
  mine: number;
  total: number;
}

export default function SelectDutyHome() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const role = asTeacherRole(user?.activeRole);

  const progressQ = useMyProgress(role);
  const examGroupsQ = useExamGroups();
  const slotsQ = useAvailableDutySlots(role === "invigilator" || role === "rs");
  const dcsQ = useDcsGroups(role === "dcs");
  const dutiesQ = useMyDuties(user?.id);
  const [refreshing, setRefreshing] = useState(false);

  // Refetch stale data whenever the tab regains focus (claims made elsewhere,
  // CS assignments, other teachers' claims).
  useFocusEffect(
    useCallback(() => {
      void queryClient.refetchQueries({ queryKey: ["shared"], stale: true, type: "active" });
      void queryClient.refetchQueries({ queryKey: KEYS.dcsGroups, stale: true, type: "active" });
    }, [queryClient]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.allSettled([
      queryClient.invalidateQueries({ queryKey: ["shared"] }),
      queryClient.invalidateQueries({ queryKey: KEYS.dcsGroups }),
      queryClient.invalidateQueries({ queryKey: ["duty-calculation"] }),
    ]);
    setRefreshing(false);
  }, [queryClient]);

  // Per-exam open / mine counts for the active role.
  const counts = useMemo(() => {
    const out = new Map<string, ExamCounts>();
    const bump = (id: string, open: boolean, mine: boolean) => {
      const c = out.get(id) ?? { open: 0, mine: 0, total: 0 };
      c.total += 1;
      if (open) c.open += 1;
      if (mine) c.mine += 1;
      out.set(id, c);
    };
    const myDuties = dutiesQ.data ?? [];
    const holds = (examRoomId: string, r: "invigilator" | "rs") =>
      myDuties.some(
        (d) => d.status === "assigned" && (d.role ?? "invigilator") === r && d.examRoom?._id === examRoomId,
      );

    if (role === "invigilator") {
      for (const s of slotsQ.data) {
        bump(s.examGroupId, !s.flags.invigilatorAssigned, s.flags.invigilatorAssigned && holds(s.examRoomId, "invigilator"));
      }
    } else if (role === "rs") {
      for (const g of groupRoomsIntoRSGroups(slotsQ.data)) {
        bump(g.examGroupId, !g.allAssigned, g.allAssigned && g.rooms.every((r) => holds(r.examRoomId, "rs")));
      }
    } else if (role === "dcs") {
      const selectable = selectableFilter(dcsQ.data ?? [], (g) => ({
        date: g.schedule.date,
        startTime: g.schedule.startTime,
        endTime: g.schedule.endTime,
        cancelled: g.status === "released",
      }));
      for (const g of selectable) {
        const examId = g.examGroup?._id;
        if (!examId) continue;
        bump(examId, g.status === "open", g.status === "claimed" && g.assignedTeacher?._id === user?.id);
      }
    }
    return out;
  }, [role, slotsQ.data, dcsQ.data, dutiesQ.data, user?.id]);

  // Exams that still have something selectable for this role, grouped
  // Ongoing → Upcoming, then SEE → IA1 → IA2 → IA3 (shared web ordering).
  const statusGroups = useMemo(() => {
    const active = selectActiveExamGroups(examGroupsQ.data ?? []);
    return groupExamsByStatusThenType(active.filter((g) => (counts.get(g._id)?.total ?? 0) > 0));
  }, [examGroupsQ.data, counts]);

  if (!role) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <CenterState
          title="Select Duty is for teachers"
          message="Switch to your Invigilator, RS or DCS role to pick duties. CS assigns duties from the web dashboard."
        />
      </View>
    );
  }

  const loading =
    examGroupsQ.isLoading || dutiesQ.isLoading || (role === "dcs" ? dcsQ.isLoading : slotsQ.isLoading);
  const error = examGroupsQ.error || dutiesQ.error || (role === "dcs" ? dcsQ.error : slotsQ.error);
  const rc = roleColors[role];

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl * 2 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>
      <Text style={[styles.h1, { color: colors.text }]}>Select Duty</Text>
      <Text style={[styles.intro, { color: colors.textMuted }]}>{INTRO[role]}</Text>

      <ProgressCard role={role} progress={progressQ.data} />

      {loading ? (
        <CenterState loading message="Loading exams…" />
      ) : error && statusGroups.length === 0 ? (
        <CenterState
          title="Couldn't load duties"
          message={error instanceof Error ? error.message : "Please try again."}
          actionLabel="Retry"
          onAction={onRefresh}
        />
      ) : statusGroups.length === 0 ? (
        <CenterState
          title="Nothing to select right now"
          message="There are no upcoming exams with open slots for your role. Pull down to refresh."
        />
      ) : (
        statusGroups.map((sg) => (
          <View key={sg.status}>
            <SectionHeader title={STATUS_LABEL[sg.status]} />
            {sg.types.map((t) => (
              <View key={t.type}>
                <Text style={[styles.typeHeader, { color: colors.textMuted }]}>{getTypeSubtitle(t.type)}</Text>
                {t.exams.map((exam) => (
                  <ExamRow key={exam._id} exam={exam} counts={counts.get(exam._id)} accent={rc.fg} role={role} />
                ))}
              </View>
            ))}
          </View>
        ))
      )}
    </ScrollView>
  );
}

function ExamRow({
  exam,
  counts,
  accent,
  role,
}: {
  exam: ExamGroup;
  counts: ExamCounts | undefined;
  accent: string;
  role: TeacherRole;
}) {
  const { colors } = useTheme();
  const open = counts?.open ?? 0;
  const mine = counts?.mine ?? 0;
  const unit = role === "invigilator" ? (open === 1 ? "slot" : "slots") : open === 1 ? "group" : "groups";
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/select/[examGroupId]", params: { examGroupId: exam._id } })}
      accessibilityRole="button"
      accessibilityLabel={`${exam.examType} semester ${exam.semester}, ${open} open ${unit}`}
      style={({ pressed }) => [
        styles.examCard,
        { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
      ]}>
      <View style={[styles.examBadge, { backgroundColor: accent }]}>
        <Text style={styles.examBadgeText}>{exam.examType}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.examTitle, { color: colors.text }]}>Semester {exam.semester}</Text>
        <Text style={[styles.examMeta, { color: colors.textMuted }]}>
          {formatShortDate(exam.startDate)} – {formatShortDate(exam.endDate)}
          {exam.departments?.length ? ` · ${exam.departments.join(", ")}` : ""}
        </Text>
        <View style={styles.countRow}>
          <Text style={[styles.count, { color: open > 0 ? colors.success : colors.danger }]}>
            {open > 0 ? `${open} open ${unit}` : "All taken"}
          </Text>
          {mine > 0 && <Text style={[styles.count, { color: colors.primary }]}>· {mine} yours</Text>}
        </View>
      </View>
      <Text style={[styles.chevron, { color: colors.textMuted }]}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  h1: { fontSize: 28, fontWeight: "800" },
  intro: { fontSize: 14, marginTop: spacing.xs, marginBottom: spacing.lg, lineHeight: 20 },
  typeHeader: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },
  examCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.lg,
    marginBottom: spacing.md,
    minHeight: 72,
  },
  examBadge: { width: 52, height: 52, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  examBadgeText: { color: "#ffffff", fontWeight: "800", fontSize: 15 },
  examTitle: { fontSize: 16, fontWeight: "700" },
  examMeta: { fontSize: 13, marginTop: 2 },
  countRow: { flexDirection: "row", gap: spacing.xs, marginTop: spacing.xs },
  count: { fontSize: 13, fontWeight: "700" },
  chevron: { fontSize: 28, fontWeight: "300" },
});
