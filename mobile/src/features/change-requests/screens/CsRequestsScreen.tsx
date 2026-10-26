import { useState } from "react";
import { View } from "react-native";

import { Banner, Button, Card, EmptyState, Screen, SegmentedControl, Text } from "@/components/ui";
import { TabHeader } from "@/features/notifications/TabHeader";
import { useTheme } from "@/theme";

import { ChangeRequestCard } from "../components/ChangeRequestCard";
import { ReviewSheet } from "../components/ReviewSheet";
import { useAllChangeRequests, useReviewChangeRequest, type ReviewStatus } from "../hooks";

const SEGMENTS: { value: ReviewStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

const EMPTY: Record<ReviewStatus, string> = {
  pending: "Nothing waiting — new requests from teachers show up here.",
  approved: "No approved requests yet.",
  rejected: "No rejected requests yet.",
};

/**
 * CS's change-request review (port of the web ChangeRequestsPage, review only):
 * Pending / Approved / Rejected, each request on the shared card, approve or
 * reject with an optional note to the teacher.
 */
export default function CsRequestsScreen() {
  const { colors } = useTheme();
  const [tab, setTab] = useState<ReviewStatus>("pending");
  const list = useAllChangeRequests(tab);
  const pendingCount = useAllChangeRequests("pending").data?.length ?? 0;
  const review = useReviewChangeRequest();
  const [target, setTarget] = useState<{ id: string; action: "approve" | "reject" } | null>(null);

  const segments = SEGMENTS.map((s) => (s.value === "pending" && pendingCount ? { ...s, label: `Pending (${pendingCount})` } : s));

  const confirm = (note: string) => {
    if (!target) return;
    review.mutate(
      { id: target.id, action: target.action, note: note || undefined },
      { onSuccess: () => setTarget(null) },
    );
  };

  return (
    <Screen refreshing={list.isRefetching} onRefresh={() => void list.refetch()}>
      <TabHeader>
        <Text variant="title">Change requests</Text>
      </TabHeader>
      <SegmentedControl segments={segments} value={tab} onChange={setTab} />

      {list.isLoading ? (
        <Text muted>Loading…</Text>
      ) : list.isError ? (
        <Banner tone="danger" title="Couldn't load requests">
          <Text variant="caption" color={colors.danger}>
            {list.error.message} — pull down to retry.
          </Text>
        </Banner>
      ) : list.data && list.data.length > 0 ? (
        list.data.map((r) => (
          <ChangeRequestCard
            key={r._id}
            request={r}
            reviewer
            actions={
              r.status === "pending" ? (
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Button title="Reject" variant="danger" icon="close" onPress={() => setTarget({ id: r._id, action: "reject" })} style={{ flex: 1 }} />
                  <Button title="Approve" variant="success" icon="check" onPress={() => setTarget({ id: r._id, action: "approve" })} style={{ flex: 1 }} />
                </View>
              ) : undefined
            }
          />
        ))
      ) : (
        <Card>
          <EmptyState icon="swap" title={`No ${tab} requests`} message={EMPTY[tab]} />
        </Card>
      )}

      <ReviewSheet
        key={target ? `${target.id}:${target.action}` : "closed"}
        action={target?.action ?? null}
        busy={review.isPending}
        error={review.isError ? review.error.message : null}
        onCancel={() => {
          review.reset();
          setTarget(null);
        }}
        onConfirm={confirm}
      />
    </Screen>
  );
}
