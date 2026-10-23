import { router, Stack, useLocalSearchParams } from "expo-router";
import { useMemo, useState, type ReactNode } from "react";
import { Alert } from "react-native";

import { Banner, Button, EmptyState, Screen, Text } from "@/components/ui";
import { DcsGroupCard, RSGroupCard } from "@/features/select-duty/components/DutyCards";
import type { DcsGroup } from "@/features/select-duty/shared/dcsTypes";
import type { Duty } from "@/features/select-duty/shared/dutyTypes";
import { compareRoomNumbers } from "@/features/select-duty/shared/rsDutyGroupingUtils";
import type { RSDutyGroup } from "@/features/select-duty/shared/rsTypes";
import { ROLE_LABELS } from "@/lib/roles";
import { useTheme } from "@/theme";

import { ChangeRequestCard } from "../components/ChangeRequestCard";
import { SectionLabel, whenLabel } from "../components/parts";
import { ReplacementSlotCard } from "../components/ReplacementSlotCard";
import { ReasonField, RequestLayout, SubmitBar, TargetSections } from "../components/RequestLayout";
import { DcsGroupSummary, DutySummary, dutyRoomLabel, RsGroupSummary } from "../components/SourceCards";
import {
  useAvailableRsGroups,
  useDcsSources,
  useDutiesForRole,
  useInvigilatorSources,
  useMyChangeRequests,
  useOpenDcsGroups,
  useReplacementSlots,
  useRsSources,
  useSubmitChangeRequest,
} from "../hooks";
import { CHANGE_REQUESTS_HREF, parseUnitKey, unitKeyOfDcsGroup, unitKeyOfDuty, unitKeyOfRsGroup } from "../routes";
import type { RSUpcomingGroup } from "../shared/rsUpcomingGrouping";
import { DEFAULT_REASON, type ChangeRequest, type ReplacementSlot } from "../types";
import {
  canRequestChange,
  canSelectReplacement,
  eligibleDcsSwapTargets,
  eligibleRsSwapTargets,
  pendingDcsSourceIds,
  pendingRsSourceKeys,
} from "../validation";

// "Request a change" for ONE duty unit — the mobile version of the web's
// RequestChangeModal (invigilator move), RsSwapTargetModal (rs_swap) and
// DcsSwapTargetModal (dcs_swap). Route param `key` is the duty-unit key
// (`${scheduleId}|${role}`, as in GET /duties/my-units and duty/[key]); the
// optional `source` pins the exact duty / RS group / DCS group.

const NOT_CHANGEABLE = {
  title: "This duty can't be changed here",
  message: "It may have finished, been cancelled or been swapped already. Pull down to refresh, or check your requests.",
};

function onSubmitted() {
  Alert.alert("Request sent", "CS will review it. You'll get an alert when they decide.", [
    { text: "View my requests", onPress: () => router.dismissTo(CHANGE_REQUESTS_HREF) },
    { text: "Done", onPress: () => (router.canGoBack() ? router.back() : router.dismissTo(CHANGE_REQUESTS_HREF)) },
  ]);
}

function Centered({ children }: { children: ReactNode }) {
  return <Screen edges={[]}>{children}</Screen>;
}

function NotFound({ onRefresh, refreshing }: { onRefresh: () => void; refreshing: boolean }) {
  return (
    <Screen edges={[]} refreshing={refreshing} onRefresh={onRefresh}>
      <EmptyState
        icon="info"
        title={NOT_CHANGEABLE.title}
        message={NOT_CHANGEABLE.message}
        action={<Button title="My change requests" variant="secondary" icon="swap" onPress={() => router.dismissTo(CHANGE_REQUESTS_HREF)} />}
      />
    </Screen>
  );
}

/** One unit can (rarely) hold several groups/duties; let the teacher pick which. */
function Chooser({ children }: { children: ReactNode }) {
  return (
    <Screen edges={[]}>
      <Text muted>You hold more than one duty in this slot. Pick the one you want to change.</Text>
      {children}
    </Screen>
  );
}

/** The request already in flight for this source, instead of the picker. */
function AlreadyPending({ requests, current }: { requests: ChangeRequest[]; current: ReactNode }) {
  return (
    <Screen edges={[]}>
      <SectionLabel>Current</SectionLabel>
      {current}
      <Banner tone="warning" title="You already have a pending request for this">
        <Text variant="caption" muted>
          One request at a time — wait for CS to approve or reject it.
        </Text>
      </Banner>
      {requests.map((r) => (
        <ChangeRequestCard key={r._id} request={r} />
      ))}
    </Screen>
  );
}

export default function RequestChangeScreen() {
  const { key, source } = useLocalSearchParams<{ key: string; source?: string }>();
  const unit = parseUnitKey(key);

  const title = unit ? `Change ${unit.role === "invigilator" ? "duty" : `${ROLE_LABELS[unit.role]} group`}` : "Request a change";
  return (
    <>
      <Stack.Screen options={{ title }} />
      {!unit ? (
        <Centered>
          <EmptyState icon="error" title="Unknown duty" message="This link doesn't point at one of your duties." />
        </Centered>
      ) : unit.role === "invigilator" ? (
        <InvigilatorRequest unitKey={key} source={source} />
      ) : unit.role === "rs" ? (
        <RsRequest unitKey={key} source={source} />
      ) : (
        <DcsRequest unitKey={key} source={source} />
      )}
    </>
  );
}

// ── Invigilator: move one duty to a vacant slot ("move") ─────────────────

function InvigilatorRequest({ unitKey, source }: { unitKey: string; source?: string }) {
  const q = useInvigilatorSources(true);
  const [picked, setPicked] = useState<string | null>(source ?? null);
  const candidates = useMemo(() => q.sources.filter((d) => unitKeyOfDuty(d) === unitKey), [q.sources, unitKey]);
  const duty = candidates.find((d) => d._id === picked) ?? (candidates.length === 1 ? candidates[0] : null);

  if (q.isLoading) return <Centered><Text muted>Loading your duty…</Text></Centered>;
  if (q.isError) return <LoadError message={q.error.message} onRetry={() => void q.refetch()} />;
  if (candidates.length === 0) return <NotFound refreshing={q.isRefetching} onRefresh={() => void q.refetch()} />;
  if (!duty) {
    return (
      <Chooser>
        {candidates.map((d) => (
          <DutySummary key={d._id} duty={d} footer={<Button title="Change this one" icon="swap" onPress={() => setPicked(d._id)} />} />
        ))}
      </Chooser>
    );
  }
  return <InvigilatorForm duty={duty} allDuties={q.all} />;
}

const slotId = (s: ReplacementSlot) => `${s.scheduleId}:${s.examRoomId}`;
const slotWindow = (s: ReplacementSlot) => ({ date: s.date, startTime: s.startTime, endTime: s.endTime });

function InvigilatorForm({ duty, allDuties }: { duty: Duty; allDuties: Duty[] }) {
  const requests = useMyChangeRequests();
  const pending = (requests.data ?? []).filter((r) => r.status === "pending" && r.duty?._id === duty._id);
  const eligibility = canRequestChange(duty);
  const slotsQ = useReplacementSlots(pending.length === 0 && eligibility.ok ? duty._id : null);
  const submit = useSubmitChangeRequest();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const slots = useMemo(
    () =>
      [...(slotsQ.data ?? [])].sort(
        (a, b) =>
          new Date(a.date).getTime() - new Date(b.date).getTime() ||
          a.startTime.localeCompare(b.startTime) ||
          (a.buildingName ?? "").localeCompare(b.buildingName ?? "") ||
          compareRoomNumbers(a.roomNumber ?? "", b.roomNumber ?? ""),
      ),
    [slotsQ.data],
  );
  const selected = slots.find((s) => slotId(s) === selectedId) ?? null;
  const current = <DutySummary duty={duty} />;

  if (pending.length > 0) return <AlreadyPending requests={pending} current={current} />;
  if (!eligibility.ok) {
    return (
      <Screen edges={[]}>
        {current}
        <Banner tone="warning" title={eligibility.reason ?? "This duty can't be changed."} />
      </Screen>
    );
  }

  const choose = (slot: ReplacementSlot) => {
    setError(null);
    const result = canSelectReplacement(slot, duty, allDuties);
    if (!result.ok) {
      setError(result.reason || "Cannot select this slot.");
      return;
    }
    setSelectedId(slotId(slot));
  };

  const send = () => {
    if (!selected) return;
    setError(null);
    submit.mutate(
      {
        type: "move",
        duty: duty._id,
        reason: reason.trim() || DEFAULT_REASON,
        requestedSchedule: selected.scheduleId,
        requestedExamRoom: selected.examRoomId,
      },
      { onSuccess: onSubmitted, onError: (e) => setError(e.message || "Failed to submit request.") },
    );
  };

  return (
    <RequestLayout
      refreshing={slotsQ.isRefetching}
      onRefresh={() => void slotsQ.refetch()}
      footer={
        <SubmitBar
          summary={selected ? `Move to ${selected.buildingName || "Unknown"} — ${selected.roomNumber}, ${whenLabel(selected.date, selected.startTime, selected.endTime)}` : null}
          disabled={!selected}
          submitting={submit.isPending}
          onSubmit={send}
          error={error}
        />
      }>
      <SectionLabel>Current duty</SectionLabel>
      {current}
      <TargetSections
        title="Vacant invigilator slots"
        items={slots}
        windowOf={slotWindow}
        keyOf={slotId}
        loading={slotsQ.isLoading}
        error={slotsQ.error}
        emptyMessage="No vacant slots match. All upcoming invigilator slots are filled or clash with your other duties."
        renderItem={(slot) => {
          const result = canSelectReplacement(slot, duty, allDuties);
          return (
            <ReplacementSlotCard
              slot={slot}
              selected={selectedId === slotId(slot)}
              conflictReason={result.ok ? null : (result.reason ?? "Not available")}
              busy={submit.isPending}
              onPress={() => choose(slot)}
            />
          );
        }}
      />
      <ReasonField value={reason} onChange={setReason} placeholder="e.g. clash with a department meeting" />
      <Text variant="caption" muted>
        {`Currently ${dutyRoomLabel(duty)}. CS approves or rejects the move; your duty stays as it is until then.`}
      </Text>
    </RequestLayout>
  );
}

// ── RS: swap a whole derived room group ("rs_swap") ──────────────────────

function RsRequest({ unitKey, source }: { unitKey: string; source?: string }) {
  const q = useRsSources(true);
  const [picked, setPicked] = useState<string | null>(source ?? null);
  const candidates = useMemo(() => q.sources.filter((g) => unitKeyOfRsGroup(g) === unitKey), [q.sources, unitKey]);
  const group = candidates.find((g) => g.groupId === picked) ?? (candidates.length === 1 ? candidates[0] : null);

  if (q.isLoading) return <Centered><Text muted>Loading your group…</Text></Centered>;
  if (q.isError) return <LoadError message={q.error.message} onRetry={() => void q.refetch()} />;
  if (candidates.length === 0) return <NotFound refreshing={q.isRefetching} onRefresh={() => void q.refetch()} />;
  if (!group) {
    return (
      <Chooser>
        {candidates.map((g) => (
          <RsGroupSummary key={g.groupId} group={g} footer={<Button title="Change this group" icon="swap" onPress={() => setPicked(g.groupId)} />} />
        ))}
      </Chooser>
    );
  }
  return <RsForm group={group} allDuties={q.all} />;
}

const rsKey = (g: RSDutyGroup) => g.groupId;
const rsWindow = (g: RSDutyGroup) => ({ date: g.date, startTime: g.startTime, endTime: g.endTime });

function RsForm({ group, allDuties }: { group: RSUpcomingGroup; allDuties: Duty[] }) {
  const requests = useMyChangeRequests();
  const pendingKeys = pendingRsSourceKeys(requests.data ?? []);
  const isPending = pendingKeys.has(group.groupId);
  const available = useAvailableRsGroups(!isPending);
  const submit = useSubmitChangeRequest();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const targets = useMemo(() => eligibleRsSwapTargets(available.groups, group, allDuties), [available.groups, group, allDuties]);
  const selected = targets.find((g) => g.groupId === selectedId) ?? null;
  const current = <RsGroupSummary group={group} />;

  if (isPending) {
    const pending = (requests.data ?? []).filter((r) => r.status === "pending" && r.rsSourceKey === group.groupId);
    return <AlreadyPending requests={pending} current={current} />;
  }

  const send = () => {
    if (!selected) return;
    setError(null);
    submit.mutate(
      {
        type: "rs_swap",
        reason: reason.trim() || DEFAULT_REASON,
        rsSourceDuties: group.rooms.map((r) => r.dutyId),
        rsTargetExamRooms: selected.rooms.map((r) => r.examRoomId),
        rsSourceKey: group.groupId,
        rsTargetKey: selected.groupId,
      },
      { onSuccess: onSubmitted, onError: (e) => setError(e.message || "Failed to submit request.") },
    );
  };

  return (
    <RequestLayout
      refreshing={false}
      onRefresh={() => void available.refetch()}
      footer={
        <SubmitBar
          title="Submit swap request"
          summary={selected ? `Swap to ${selected.buildingName} — ${selected.rangeLabel}, ${whenLabel(selected.date, selected.startTime, selected.endTime)}` : "Pick a vacant RS group to move your whole group to."}
          disabled={!selected}
          submitting={submit.isPending}
          onSubmit={send}
          error={error}
        />
      }>
      <SectionLabel>Current group</SectionLabel>
      {current}
      <TargetSections
        title="Available RS groups"
        items={targets}
        windowOf={rsWindow}
        keyOf={rsKey}
        loading={available.isLoading}
        error={available.error}
        emptyMessage="No vacant RS groups match. Every candidate is either full or clashes with your other duties."
        renderItem={(g) => (
          <RSGroupCard
            group={g}
            state={selectedId === g.groupId ? "SELECTED" : "AVAILABLE"}
            takenRooms={0}
            busy={submit.isPending}
            onPress={() => {
              setError(null);
              setSelectedId(g.groupId);
            }}
          />
        )}
      />
      <ReasonField value={reason} onChange={setReason} placeholder="e.g. clash with a faculty meeting" />
      <Text variant="caption" muted>
        All rooms in the group move together once CS approves. Until then you keep your current group.
      </Text>
    </RequestLayout>
  );
}

// ── DCS: swap a persisted DCSGroup ("dcs_swap") ──────────────────────────

function DcsRequest({ unitKey, source }: { unitKey: string; source?: string }) {
  const q = useDcsSources(true);
  const duties = useDutiesForRole("dcs");
  const [picked, setPicked] = useState<string | null>(source ?? null);
  const candidates = useMemo(() => q.sources.filter((g) => unitKeyOfDcsGroup(g) === unitKey), [q.sources, unitKey]);
  const group = candidates.find((g) => g._id === picked) ?? (candidates.length === 1 ? candidates[0] : null);

  if (q.isLoading) return <Centered><Text muted>Loading your group…</Text></Centered>;
  if (q.isError) return <LoadError message={q.error.message} onRetry={() => void q.refetch()} />;
  if (candidates.length === 0) return <NotFound refreshing={q.isRefetching} onRefresh={() => void q.refetch()} />;
  if (!group) {
    return (
      <Chooser>
        {candidates.map((g) => (
          <DcsGroupSummary key={g._id} group={g} footer={<Button title="Change this group" icon="swap" onPress={() => setPicked(g._id)} />} />
        ))}
      </Chooser>
    );
  }
  return <DcsForm group={group} owned={q.owned} allDuties={duties.all} />;
}

const dcsKey = (g: DcsGroup) => g._id;
const dcsWindow = (g: DcsGroup) => ({ date: g.schedule.date, startTime: g.schedule.startTime, endTime: g.schedule.endTime });

function DcsForm({ group, owned, allDuties }: { group: DcsGroup; owned: DcsGroup[]; allDuties: Duty[] }) {
  const requests = useMyChangeRequests();
  const isPending = pendingDcsSourceIds(requests.data ?? []).has(group._id);
  const open = useOpenDcsGroups(!isPending);
  const submit = useSubmitChangeRequest();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const targets = useMemo(() => eligibleDcsSwapTargets(open.data ?? [], group, owned, allDuties), [open.data, group, owned, allDuties]);
  const selected = targets.find((g) => g._id === selectedId) ?? null;
  const current = <DcsGroupSummary group={group} />;

  if (isPending) {
    const pending = (requests.data ?? []).filter((r) => r.status === "pending" && r.dcsSourceGroup?._id === group._id);
    return <AlreadyPending requests={pending} current={current} />;
  }

  const send = () => {
    setError(null);
    if (!selected) {
      setError("Pick a target DCS group to swap into.");
      return;
    }
    submit.mutate(
      {
        type: "dcs_swap",
        dcsSourceGroup: group._id,
        dcsTargetGroup: selected._id,
        reason: reason.trim() || DEFAULT_REASON,
      },
      { onSuccess: onSubmitted, onError: (e) => setError(e.message || "Failed to submit request.") },
    );
  };

  return (
    <RequestLayout
      refreshing={open.isRefetching}
      onRefresh={() => void open.refetch()}
      footer={
        <SubmitBar
          title="Submit swap request"
          summary={
            selected
              ? `Swap to DCS group #${selected.groupIndex}, ${whenLabel(selected.schedule.date, selected.schedule.startTime, selected.schedule.endTime)}`
              : "Pick an open DCS group to move into. The whole group moves together."
          }
          disabled={!selected}
          submitting={submit.isPending}
          onSubmit={send}
          error={error}
        />
      }>
      <SectionLabel>Current assignment</SectionLabel>
      {current}
      <TargetSections
        title="Available DCS groups"
        items={targets}
        windowOf={dcsWindow}
        keyOf={dcsKey}
        loading={open.isLoading}
        error={open.error}
        emptyMessage="No open DCS groups available right now (all claimed, in the past, or clashing with your other duties)."
        renderItem={(g) => (
          <DcsGroupCard
            group={g}
            ordinal={undefined}
            state={selectedId === g._id ? "SELECTED" : "AVAILABLE"}
            busy={submit.isPending}
            onPress={() => {
              setError(null);
              setSelectedId(g._id);
            }}
          />
        )}
      />
      <ReasonField value={reason} onChange={setReason} placeholder="e.g. need to attend a department meeting" />
      <Text variant="caption" muted>
        The whole group moves together once CS approves. Until then you keep your current group.
      </Text>
    </RequestLayout>
  );
}

function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { colors } = useTheme();
  return (
    <Screen edges={[]} onRefresh={onRetry} refreshing={false}>
      <Banner tone="danger" title="Couldn't load your duties">
        <Text variant="caption" color={colors.danger}>
          {message} — pull down to retry.
        </Text>
      </Banner>
    </Screen>
  );
}
