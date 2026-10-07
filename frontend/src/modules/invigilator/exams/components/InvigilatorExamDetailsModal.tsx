import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type {
  ExamRoomAssignment,
  ExamSchedule,
  RoomDutyFlags,
  DutyStatus,
} from "@/modules/shared/exams/types/exam.types";
import { useAuthStore } from "@/shared/store/auth.store";
import { getRoleConfig } from "@/modules/shared/role-config/roleConfig";
import { useDutySelection } from "@/modules/invigilator/duties/hooks/useDutySelection";
import { claimDcsGroup } from "@/modules/dcs/select-duty/services/dcsDutyService";
import { selectRSDutyGroup } from "@/modules/rs/select-duty/services/rsDutyService";
import DutyGroupDetailsModal from "@/modules/shared/components/DutyGroupDetailsModal";
import { useAssignmentStatus } from "@/modules/shared/hooks/useAssignmentStatus";
import { useGroupForRoom } from "@/modules/invigilator/exams/hooks/useGroupForRoom";
import { type OperationalRoleKey } from "@/modules/shared/utils/assignmentStatusUtils";
import type { SlotContext } from "@/modules/invigilator/duties/utils/dutySelectionUtils";
import {
  CourseSection,
  ExamDetailsSection,
  ModalHeroHeader,
  RoomInformationSection,
} from "./exam-details-modal/ExamInfoSections";
import DutySelectionPanel, {
  DutyGroupSection,
} from "./exam-details-modal/DutySelectionPanel";

interface InvigilatorExamDetailsModalProps {
  open: boolean;
  onClose: () => void;
  assignment: ExamRoomAssignment;
  schedule: ExamSchedule;
  dutyFlags: RoomDutyFlags | undefined;
  /** Legacy CS-style status — accepted but not used for color decisions. */
  status: DutyStatus;
  isMine: boolean;
}

export default function InvigilatorExamDetailsModal({
  open,
  onClose,
  assignment,
  schedule,
  dutyFlags,
  isMine,
}: InvigilatorExamDetailsModalProps) {
  const user = useAuthStore((s) => s.user);
  const roleConfig = getRoleConfig(user?.activeRole || undefined);
  const viewerRole = (roleConfig?.roleKey as OperationalRoleKey) || "invigilator";
  // DCS / RS pick their duty as a whole group — never per room. The
  // classroom modal therefore replaces the per-room "Select Duty" button
  // with a link into the duty-group view for those two roles. Invigilator
  // remains room-based, as the spec mandates.
  const isGroupBasedRole = viewerRole === "dcs" || viewerRole === "rs";

  const { room, departments } = assignment;
  const buildingName = room.building?.name || "Unknown";
  const flags: RoomDutyFlags = dutyFlags || {
    dcsAssigned: false,
    rsAssigned: false,
    invigilatorAssigned: false,
  };

  // Slot context for the interactive role row. Hooks always run.
  const slot: SlotContext = {
    date: schedule.date,
    startTime: schedule.startTime,
    endTime: schedule.endTime,
    roomNumber: room.roomNumber,
    roomId: room._id,
    flags,
  };
  const dutySelection = useDutySelection(slot);

  // Resolve the group the viewer's role would actually claim from this
  // classroom. Returns null for invigilator (room-based path stays intact).
  const groupForRoom = useGroupForRoom({
    viewerRole,
    examRoomId: open ? assignment._id : null,
    scheduleId: open ? schedule._id : null,
  });

  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const qc = useQueryClient();

  // Route the group claim to the right role service. Lives here (not in the
  // shared modal) so the shared layer carries no dependency on DCS/RS — the
  // modal just awaits this and surfaces any error.
  const handleClaimGroup = async () => {
    if (groupForRoom.dcsGroup) {
      await claimDcsGroup(groupForRoom.dcsGroup._id);
      qc.invalidateQueries({ queryKey: ["dcs"] });
      qc.invalidateQueries({ queryKey: ["shared"] });
    } else if (groupForRoom.rsGroup) {
      await selectRSDutyGroup({
        examScheduleId: groupForRoom.rsGroup.scheduleId,
        examRoomIds: groupForRoom.rsGroup.rooms.map((r) => r.examRoomId),
      });
      qc.invalidateQueries({ queryKey: ["shared"] });
    }
  };

  // Drive header colour + "duty status" badge purely from the
  // teacher-perspective hook so the modal stays consistent with chips/cards.
  const assignment$ = useAssignmentStatus({
    flags,
    viewerRole,
    isMine: isMine || dutySelection.state === "SELECTED_BY_ME",
    hasConflict: dutySelection.state === "CONFLICT",
  });

  if (!open) return null;

  const handleSelect = () => {
    dutySelection.select({
      examScheduleId: schedule._id,
      examRoomId: assignment._id,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-2xl max-h-[92vh] overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* HERO HEADER */}
        <ModalHeroHeader
          room={room}
          buildingName={buildingName}
          status={assignment$.status}
          onClose={onClose}
        />

        <div className="max-h-[calc(92vh-7rem)] overflow-y-auto px-5 py-5">
          <div className="space-y-5">
            <CourseSection courses={schedule.courses} departments={departments} />

            <ExamDetailsSection schedule={schedule} departments={departments} />

            <DutySelectionPanel
              assignment$={assignment$}
              viewerRole={viewerRole}
              flags={flags}
              myUserId={user?.id ?? null}
              isMine={isMine}
              dutySelection={dutySelection}
              isGroupBasedRole={isGroupBasedRole}
              onSelect={handleSelect}
            />

            {/* DUTY GROUP — only for DCS/RS viewers (see DutyGroupSection). */}
            {isGroupBasedRole && (
              <DutyGroupSection
                viewerRole={viewerRole}
                groupForRoom={groupForRoom}
                onViewGroup={() => setGroupModalOpen(true)}
              />
            )}

            <RoomInformationSection room={room} buildingName={buildingName} />
          </div>
        </div>

        {/* FOOTER */}
        <div className="border-t border-gray-100 bg-gray-50 px-5 py-3">
          <button
            onClick={onClose}
            className="w-full rounded-lg border border-gray-200 bg-white py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
          >
            Close
          </button>
        </div>
      </div>

      {/* Group details — opened from the panel above. Lifted out of the
          classroom modal's inner container so its own overflow + z-index
          stack don't fight each other. Closes itself on a successful
          claim, which also bubbles to close the classroom modal. */}
      <DutyGroupDetailsModal
        open={groupModalOpen}
        onClose={() => setGroupModalOpen(false)}
        summary={groupForRoom.summary}
        onClaim={handleClaimGroup}
        onClaimed={onClose}
      />
    </div>
  );
}
