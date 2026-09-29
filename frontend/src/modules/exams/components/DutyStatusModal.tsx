import { useState } from "react";
import { X } from "lucide-react";
import type {
  ExamRoomAssignment,
  ExamSchedule,
  RoomDutyFlags,
  DutyStatus,
} from "../types";
import { useAssignmentTeacher } from "@/modules/manage-duties/context/AssignmentTeacherContext";
import {
  useAssignDutyBySlot,
  useTeacherDuties,
} from "@/modules/manage-duties/hooks";
import { useAuthStore } from "@/shared/store/auth.store";
import CsAssignRolePanel, {
  type AssignRole,
} from "./duty-status-modal/CsAssignRolePanel";
import DutyOverviewContent from "./duty-status-modal/DutyOverviewContent";
import { sameDay, timeOverlaps } from "./duty-status-modal/utils";

interface DutyStatusModalProps {
  open: boolean;
  onClose: () => void;
  assignment: ExamRoomAssignment;
  schedule: ExamSchedule;
  dutyFlags: RoomDutyFlags | undefined;
  status: DutyStatus;
}

export default function DutyStatusModal({
  open,
  onClose,
  assignment,
  schedule,
  dutyFlags,
  status,
}: DutyStatusModalProps) {
  // Called unconditionally so hook order stays stable across renders — the
  // context returns null outside the assign-duty wizard, which we short-circuit
  // on below.
  const assignmentCtx = useAssignmentTeacher();
  const teacherId = assignmentCtx?.teacher._id;
  const { data: teacherDuties } = useTeacherDuties(teacherId || "");
  const assignMutation = useAssignDutyBySlot(teacherId || "");

  // CS administrative assignment: available only when browsing Exams as CS
  // (active role) and NOT inside the invigilator assign-duty wizard (which
  // carries its own teacher context and keeps its original behaviour).
  const activeRole = useAuthStore((s) => s.user?.activeRole);
  const csAssignMode = activeRole === "cs" && !assignmentCtx;
  const [assignRole, setAssignRole] = useState<AssignRole | null>(null);

  if (!open) return null;

  const handleClose = () => {
    setAssignRole(null);
    onClose();
  };

  // After a successful CS assignment, return to the overview — cache
  // invalidation refreshes the flags so the row flips to Assigned in place.
  const handleAssigned = () => setAssignRole(null);

  const { room, departments } = assignment;
  const buildingName = room.building?.name || "Unknown";
  const flags =
    dutyFlags || {
      dcsAssigned: false,
      rsAssigned: false,
      invigilatorAssigned: false,
    };

  // Conflict detection for the assign-duty flow — surface a disabled button
  // + message the same way the spec asks, so the CS never round-trips the
  // backend just to hear "no".
  const invigilatorVacant = !flags.invigilatorAssigned;
  const hasConflict = assignmentCtx
    ? (teacherDuties || []).some(
        (d) =>
          d.status === "assigned" &&
          sameDay(d.date, schedule.date) &&
          timeOverlaps(
            d.startTime,
            d.endTime,
            schedule.startTime,
            schedule.endTime
          )
      )
    : false;

  const showAssignCta = assignmentCtx && invigilatorVacant;

  const handleAssign = () => {
    if (!assignmentCtx) return;
    assignMutation.mutate(
      {
        examSchedule: schedule._id,
        examRoom: assignment._id,
        teacher: assignmentCtx.teacher._id,
      },
      {
        onSuccess: () => {
          onClose();
        },
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-gray-800">
              {buildingName} — {room.roomNumber}
            </h3>
            <p className="mt-0.5 text-xs text-gray-400">
              Floor {room.floor} · Capacity {room.capacity}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {assignRole && csAssignMode ? (
          <CsAssignRolePanel
            assignRole={assignRole}
            schedule={schedule}
            assignment={assignment}
            onBack={() => setAssignRole(null)}
            onAssigned={handleAssigned}
          />
        ) : (
          <DutyOverviewContent
            schedule={schedule}
            departments={departments}
            status={status}
            flags={flags}
            csAssignMode={csAssignMode}
            onSelectRole={setAssignRole}
            assignError={
              assignMutation.isError ? (assignMutation.error as Error) : null
            }
            isAssigning={assignMutation.isPending}
            showAssignCta={!!showAssignCta}
            hasConflict={hasConflict}
            teacherName={assignmentCtx?.teacher.name}
            onAssign={handleAssign}
            onClose={handleClose}
          />
        )}
      </div>
    </div>
  );
}
