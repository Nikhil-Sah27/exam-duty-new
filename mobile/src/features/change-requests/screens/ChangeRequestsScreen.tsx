import { router } from "expo-router";
import { useMemo } from "react";
import { View } from "react-native";

import { Banner, Button, Card, EmptyState, Screen, Text } from "@/components/ui";
import { isTeacherRole } from "@/lib/roles";
import type { TeacherRole } from "@/lib/types";
import { useAuthStore } from "@/store/auth";
import { useTheme } from "@/theme";

import { ChangeRequestCard } from "../components/ChangeRequestCard";
import { SectionLabel } from "../components/parts";
import { DcsGroupSummary, DutySummary, RequestChangeAction, RsGroupSummary } from "../components/SourceCards";
import { useDcsSources, useInvigilatorSources, useRoleRequests, useRsSources } from "../hooks";
import { requestChangeHref, unitKeyOfDcsGroup, unitKeyOfDuty, unitKeyOfRsGroup } from "../routes";
import { canRequestChange, hasPendingRequest, pendingDcsSourceIds, pendingRsSourceKeys } from "../validation";

// Port of the three web pages, picked by the active role:
//   invigilator/change-requests/pages/InvigilatorChangeRequestsPage.tsx
//   rs/change-requests/pages/RsChangeRequestsPage.tsx
//   dcs/change-requests/pages/DcsChangeRequestsPage.tsx
// Everything goes through the app's own token — never the website.

const COPY: Record<TeacherRole, { intro: string; mine: string; pending: string; emptyTitle: string; emptyMessage: string }> = {
  invigilator: {
    intro: "Ask to move one of your upcoming duties to a vacant slot. CS reviews every request.",
    mine: "My upcoming duties",
    pending: "Pending requests",
    emptyTitle: "No upcoming duties assigned to you",
    emptyMessage: "Once a duty is assigned, you'll be able to request changes here.",
  },
  rs: {
    intro: "Ask to swap one of your RS duty groups for another open group. RS works on whole room groups, not single classrooms.",
    mine: "My RS duty groups",
    pending: "Pending swap requests",
    emptyTitle: "You have no upcoming RS groups",
    emptyMessage: "Pick a room group in Select Duty first.",
  },
  dcs: {
    intro: "Ask to swap one of your DCS duty groups for another open group. DCS works on whole groups, not single classrooms.",
    mine: "My DCS duty groups",
    pending: "Pending swap requests",
    emptyTitle: "You have no upcoming DCS duty groups",
    emptyMessage: "Pick a supervision group in Select Duty first.",
  },
};

export default function ChangeRequestsScreen() {
  const { colors } = useTheme();
  const activeRole = useAuthStore((s) => s.user?.activeRole ?? null);
  const role: TeacherRole | null = isTeacherRole(activeRole) ? activeRole : null;

  const requests = useRoleRequests(role);
  const inv = useInvigilatorSources(role === "invigilator");
  const rs = useRsSources(role === "rs");
  const dcs = useDcsSources(role === "dcs");

  const all = useMemo(() => requests.data ?? [], [requests.data]);
  const rsPending = useMemo(() => pendingRsSourceKeys(all), [all]);
  const dcsPending = useMemo(() => pendingDcsSourceIds(all), [all]);

  if (!role) {
    return (
      <Screen edges={[]}>
        <EmptyState icon="info" title="Change requests are for teachers" message="Switch to your Invigilator, RS or DCS role to request a change." />
      </Screen>
    );
  }

  const copy = COPY[role];
  const sourcesQuery = role === "invigilator" ? inv : role === "rs" ? rs : dcs;
  const sourceCount = role === "invigilator" ? inv.sources.length : role === "rs" ? rs.sources.length : dcs.sources.length;
  const refreshing = requests.isRefetching || sourcesQuery.isRefetching;
  const refresh = () => {
    void requests.refetch();
    void sourcesQuery.refetch();
  };

  return (
    <Screen edges={[]} refreshing={refreshing} onRefresh={refresh}>
      <Text muted>{copy.intro}</Text>

      <View style={{ gap: 12 }}>
        <SectionLabel>{copy.mine}</SectionLabel>
        {sourcesQuery.isLoading ? (
          <Text muted>Loading…</Text>
        ) : sourcesQuery.isError ? (
          <Banner tone="danger" title="Couldn't load your duties">
            <Text variant="caption" color={colors.danger}>
              {sourcesQuery.error?.message} — pull down to retry.
            </Text>
          </Banner>
        ) : sourceCount === 0 ? (
          <Card>
            <EmptyState
              icon="calendar"
              title={copy.emptyTitle}
              message={copy.emptyMessage}
              action={role === "invigilator" ? undefined : <Button title="Select a duty" icon="select" onPress={() => router.navigate("/select")} />}
            />
          </Card>
        ) : role === "invigilator" ? (
          inv.sources.map((d) => (
            <DutySummary
              key={d._id}
              duty={d}
              footer={
                <RequestChangeAction
                  pending={hasPendingRequest(d._id, all)}
                  eligibility={canRequestChange(d)}
                  onPress={() => router.push(requestChangeHref(unitKeyOfDuty(d), d._id))}
                />
              }
            />
          ))
        ) : role === "rs" ? (
          rs.sources.map((g) => (
            <RsGroupSummary
              key={g.groupId}
              group={g}
              footer={
                <RequestChangeAction
                  pending={rsPending.has(g.groupId)}
                  onPress={() => router.push(requestChangeHref(unitKeyOfRsGroup(g), g.groupId))}
                />
              }
            />
          ))
        ) : (
          dcs.sources.map((g) => (
            <DcsGroupSummary
              key={g._id}
              group={g}
              footer={
                <RequestChangeAction
                  pending={dcsPending.has(g._id)}
                  onPress={() => router.push(requestChangeHref(unitKeyOfDcsGroup(g), g._id))}
                />
              }
            />
          ))
        )}
      </View>

      {requests.isError ? (
        <Banner tone="danger" title="Couldn't load your requests">
          <Text variant="caption" color={colors.danger}>
            {requests.error.message} — pull down to retry.
          </Text>
        </Banner>
      ) : null}

      {requests.pending.length > 0 ? (
        <View style={{ gap: 12 }}>
          <SectionLabel>{copy.pending}</SectionLabel>
          {requests.pending.map((r) => (
            <ChangeRequestCard key={r._id} request={r} />
          ))}
        </View>
      ) : null}

      {requests.decided.length > 0 ? (
        <View style={{ gap: 12 }}>
          <SectionLabel>History</SectionLabel>
          {requests.decided.map((r) => (
            <ChangeRequestCard key={r._id} request={r} />
          ))}
        </View>
      ) : null}

      {!requests.isLoading && !requests.isError && requests.pending.length === 0 && requests.decided.length === 0 ? (
        <Text variant="caption" muted style={{ textAlign: "center" }}>
          {"You haven't asked for any changes yet."}
        </Text>
      ) : null}
    </Screen>
  );
}
