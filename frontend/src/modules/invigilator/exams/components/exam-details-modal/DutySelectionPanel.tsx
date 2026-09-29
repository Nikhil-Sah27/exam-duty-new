import { AlertTriangle, Sparkles, Users } from "lucide-react";
import type { RoomDutyFlags } from "@/modules/shared/exams/types/exam.types";
import RoleAssignmentCard from "@/modules/shared/components/RoleAssignmentCard";
import AssignmentStatusBadge from "@/modules/shared/components/AssignmentStatusBadge";
import type { UseAssignmentStatusResult } from "@/modules/shared/hooks/useAssignmentStatus";
import { type OperationalRoleKey } from "@/modules/shared/utils/assignmentStatusUtils";
import type { useDutySelection } from "@/modules/invigilator/duties/hooks/useDutySelection";
import DutySelectionButton from "@/modules/invigilator/duties/components/DutySelectionButton";
import DutyGroupInfoPanel from "@/modules/shared/components/DutyGroupInfoPanel";
import type { useGroupForRoom } from "@/modules/invigilator/exams/hooks/useGroupForRoom";
import Section from "./Section";

interface DutySelectionPanelProps {
  assignment$: UseAssignmentStatusResult;
  viewerRole: OperationalRoleKey;
  flags: RoomDutyFlags;
  myUserId: string | null;
  isMine: boolean;
  dutySelection: ReturnType<typeof useDutySelection>;
  isGroupBasedRole: boolean;
  onSelect: () => void;
}

/**
 * The teacher-perspective "Duty Status" banner plus the three per-role
 * assignment rows ("Duty Assignments"). All interactivity for claiming a
 * per-room duty lives here.
 */
export default function DutySelectionPanel({
  assignment$,
  viewerRole,
  flags,
  myUserId,
  isMine,
  dutySelection,
  isGroupBasedRole,
  onSelect,
}: DutySelectionPanelProps) {
  // Role rows in display order: DCS → RS → Invigilator. Role isolation is
  // enforced inside RoleAssignmentCard: rows for roles OTHER than the
  // viewer's render neutral (gray) regardless of occupancy or any time
  // conflict the viewer may have. Only the viewer's own role row picks up
  // the green / blue / red palette and the interactive controls.
  const renderRoleRow = (role: OperationalRoleKey) => {
    const isViewerRole = role === viewerRole;
    const interactiveAvailable =
      isViewerRole && dutySelection.state === "AVAILABLE";
    const interactivePending =
      isViewerRole && dutySelection.state === "PENDING";
    const interactiveConflict =
      isViewerRole && dutySelection.state === "CONFLICT";

    // Per-room "Select Duty" is only ever surfaced for Invigilator. DCS and
    // RS get the group panel rendered below this section, so we suppress
    // the inline action for the viewer's row to keep them on the group path.
    const showInlineSelect =
      interactiveAvailable && !(isGroupBasedRole && isViewerRole);

    // Notes that only apply to the viewer's own row. Other-role rows never
    // get a "you have a conflict" message — those would be misleading.
    const note = isViewerRole
      ? interactivePending
        ? "Awaiting approval from the controller."
        : interactiveConflict
          ? "You already have a duty during this time slot."
          : dutySelection.errorMessage
            ? dutySelection.errorMessage
            : undefined
      : undefined;
    const noteTone: "info" | "warn" =
      interactiveConflict || (isViewerRole && dutySelection.errorMessage)
        ? "warn"
        : "info";

    return (
      <RoleAssignmentCard
        key={role}
        role={role}
        viewerRole={viewerRole}
        flags={flags}
        myUserId={myUserId}
        // `isMine` is the cross-cutting "I just selected" fast path — the
        // shared duty-by-teacher list confirms ownership; the flag check on
        // role + assignee id is the durable one.
        isMine={isViewerRole && (isMine || dutySelection.state === "SELECTED_BY_ME")}
        hasViewerConflict={interactiveConflict}
        action={
          showInlineSelect ? (
            <DutySelectionButton
              onClick={onSelect}
              isSubmitting={dutySelection.isSubmitting}
            />
          ) : undefined
        }
        note={note}
        noteTone={noteTone}
      />
    );
  };

  return (
    <>
      {/* DUTY STATUS (teacher-perspective) */}
      <Section icon={Sparkles} title="Duty Status">
        <div
          className={`flex items-center justify-between gap-3 rounded-xl border-2 px-4 py-3 shadow-sm transition-colors ${assignment$.paint.border} ${assignment$.paint.bg}`}
        >
          <div className="flex items-center gap-2">
            <span className={`h-3 w-3 rounded-full ${assignment$.paint.dot}`} />
            <p className={`text-sm font-bold ${assignment$.paint.text}`}>
              {assignment$.label}
            </p>
          </div>
          <AssignmentStatusBadge status={assignment$.status} size="md" />
        </div>

        {assignment$.status === "CONFLICT" && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              You already have another duty during this date and time.
              Remove the conflicting selection first.
            </span>
          </div>
        )}
      </Section>

      {/* DUTY ASSIGNMENTS — three rows, one per role */}
      <Section icon={Users} title="Duty Assignments">
        <div className="grid grid-cols-1 gap-2">
          {renderRoleRow("dcs")}
          {renderRoleRow("rs")}
          {renderRoleRow("invigilator")}
        </div>
      </Section>
    </>
  );
}

/**
 * DUTY GROUP — only for DCS/RS viewers. This is the ONLY path they have to
 * claim a duty (per-room claims are disabled in the assignment rows above),
 * keeping group-level assignment authoritative.
 */
export function DutyGroupSection({
  viewerRole,
  groupForRoom,
  onViewGroup,
}: {
  viewerRole: OperationalRoleKey;
  groupForRoom: ReturnType<typeof useGroupForRoom>;
  onViewGroup: () => void;
}) {
  return (
    <Section icon={Users} title="Duty Group">
      <DutyGroupInfoPanel
        viewerRole={viewerRole}
        dcsGroup={groupForRoom.dcsGroup}
        rsGroup={groupForRoom.rsGroup}
        dcsDisplayOrdinal={groupForRoom.dcsDisplayOrdinal}
        isLoading={groupForRoom.isLoading}
        onViewGroup={onViewGroup}
      />
    </Section>
  );
}
