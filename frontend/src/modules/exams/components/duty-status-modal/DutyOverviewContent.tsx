import { Loader2, UserCheck } from "lucide-react";
import type {
  ExamRoomAssignment,
  ExamSchedule,
  RoomDutyFlags,
  DutyStatus,
} from "../../types";
import { getStatusLabel, getStatusColors } from "../../utils/dutyStatusUtils";
import CourseSummary from "@/modules/shared/exams/components/CourseSummary";
import RoleBadge from "./RoleBadge";
import type { AssignRole } from "./CsAssignRolePanel";
import { formatTime, formatDate } from "./utils";

interface DutyOverviewContentProps {
  schedule: ExamSchedule;
  departments: ExamRoomAssignment["departments"];
  status: DutyStatus;
  flags: RoomDutyFlags;
  csAssignMode: boolean;
  onSelectRole: (role: AssignRole) => void;
  /** CS only, upcoming schedules only — take the holder off a filled slot. */
  onUnassignRole?: (role: AssignRole) => void;
  /** Server-side assignment error from the assign-duty mutation, if any. */
  assignError: Error | null;
  isAssigning: boolean;
  showAssignCta: boolean;
  hasConflict: boolean;
  /** Teacher being assigned in the invigilator assign-duty wizard. */
  teacherName?: string;
  onAssign: () => void;
  onClose: () => void;
}

/** Overview mode: course/exam info, overall + role-wise status, and the
 *  footer (assign CTA in the assign-duty wizard, plain Close otherwise). */
export default function DutyOverviewContent({
  schedule,
  departments,
  status,
  flags,
  csAssignMode,
  onSelectRole,
  onUnassignRole,
  assignError,
  isAssigning,
  showAssignCta,
  hasConflict,
  teacherName,
  onAssign,
  onClose,
}: DutyOverviewContentProps) {
  const colors = getStatusColors(status);

  return (
    <>
      <div className="space-y-4 px-5 py-4">
        {/* Subject / course — shared block; narrowed to this room's
            department(s) so multi-dept schedules show only the relevant
            paper. */}
        <CourseSummary
          courses={schedule.courses}
          forDepartments={departments}
        />

        {/* Exam Info */}
        <div className="rounded-lg bg-gray-50 px-3 py-2.5">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-gray-400">Date: </span>
              <span className="font-medium text-gray-700">
                {formatDate(schedule.date)}
              </span>
            </div>
            <div>
              <span className="text-gray-400">Time: </span>
              <span className="font-medium text-gray-700">
                {formatTime(schedule.startTime)} –{" "}
                {formatTime(schedule.endTime)}
              </span>
            </div>
            <div className="col-span-2">
              <span className="text-gray-400">Departments: </span>
              <span className="font-medium text-gray-700">
                {departments.length > 0 ? departments.join(", ") : "—"}
              </span>
            </div>
          </div>
        </div>

        {/* Overall Status */}
        <div
          className={`flex items-center gap-2 rounded-lg border-2 px-3 py-2 ${colors.border}`}
        >
          <span className={`h-3 w-3 rounded-full ${colors.dot}`} />
          <span className="text-sm font-semibold text-gray-700">
            {getStatusLabel(status)}
          </span>
        </div>

        {/* Role-wise Status */}
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-gray-400">
            Duty Assignments
          </p>
          <div className="space-y-2">
            <RoleBadge
              label="DCS (Deputy Chief Superintendent)"
              assigned={flags.dcsAssigned}
              assignee={flags.dcsTeacher}
              onAssignClick={
                csAssignMode ? () => onSelectRole("dcs") : undefined
              }
              onUnassignClick={
                onUnassignRole ? () => onUnassignRole("dcs") : undefined
              }
            />
            <RoleBadge
              label="RS (Room Superintendent)"
              assigned={flags.rsAssigned}
              assignee={flags.rsTeacher}
              onAssignClick={
                csAssignMode ? () => onSelectRole("rs") : undefined
              }
              onUnassignClick={
                onUnassignRole ? () => onUnassignRole("rs") : undefined
              }
            />
            <RoleBadge
              label="Invigilator"
              assigned={flags.invigilatorAssigned}
              assignee={flags.invigilatorTeacher}
              onAssignClick={
                csAssignMode ? () => onSelectRole("invigilator") : undefined
              }
              onUnassignClick={
                onUnassignRole ? () => onUnassignRole("invigilator") : undefined
              }
            />
          </div>
        </div>

        {/* Assignment error (from server) */}
        {assignError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {assignError.message}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-100 px-5 py-3">
        {showAssignCta ? (
          <div className="space-y-2">
            {hasConflict && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <p className="font-medium">
                  {teacherName} already has another duty
                  during this date and time.
                </p>
                <p className="mt-0.5 text-amber-700">
                  Choose another classroom.
                </p>
              </div>
            )}
            <button
              onClick={onAssign}
              disabled={hasConflict || isAssigning}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {isAssigning ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Assigning...
                </>
              ) : (
                <>
                  <UserCheck className="h-4 w-4" />
                  Assign Duty to {teacherName}
                </>
              )}
            </button>
          </div>
        ) : (
          <button
            onClick={onClose}
            className="w-full rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
          >
            Close
          </button>
        )}
      </div>
    </>
  );
}
