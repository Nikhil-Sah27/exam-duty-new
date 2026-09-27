import { useState } from "react";
import type { ExamRoomAssignment, ExamSchedule } from "../../types";
import { useAssignInvigilator } from "@/modules/manage-duties/hooks";
import EligibleTeacherList from "./EligibleTeacherList";
import AssignPanelShell, { AssignContextCard } from "./AssignPanelShell";
import { formatDate, formatTime } from "./format";

/**
 * CS assigns a single invigilator to ONE classroom (invigilator duties are
 * per-room, not group-based). Reuses the same `admin-assign` record a teacher
 * would create by self-claiming.
 */
export default function CsInvigilatorAssignPanel({
  schedule,
  assignment,
  onBack,
  onAssigned,
}: {
  schedule: ExamSchedule;
  assignment: ExamRoomAssignment;
  onBack: () => void;
  onAssigned: () => void;
}) {
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const mutation = useAssignInvigilator();

  const buildingName = assignment.room.building?.name || "Unknown";
  const course = (schedule.courses || []).find(
    (c) =>
      c.departmentCode &&
      assignment.departments
        .map((d) => d.toUpperCase())
        .includes(c.departmentCode.toUpperCase())
  );

  const handleAssign = (teacherId: string) => {
    setAssigningId(teacherId);
    mutation.mutate(
      {
        examSchedule: schedule._id,
        examRoom: assignment._id,
        teacher: teacherId,
      },
      {
        onSuccess: () => onAssigned(),
        onSettled: () => setAssigningId(null),
      }
    );
  };

  return (
    <AssignPanelShell title="Assign Invigilator" onBack={onBack}>
      <AssignContextCard
        rows={[
          ["Room", `${buildingName} — ${assignment.room.roomNumber}`],
          ...(course?.courseTitle
            ? ([["Course", course.courseTitle]] as [string, string][])
            : []),
          ...(course?.courseCode
            ? ([["Course Code", course.courseCode]] as [string, string][])
            : []),
          ["Date", formatDate(schedule.date)],
          [
            "Time",
            `${formatTime(schedule.startTime)} – ${formatTime(schedule.endTime)}`,
          ],
        ]}
      />

      {mutation.isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {(mutation.error as Error).message}
        </div>
      )}

      <EligibleTeacherList
        role="invigilator"
        onAssign={handleAssign}
        assigningId={assigningId}
        isPending={mutation.isPending}
        conflict={{
          date: schedule.date,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
        }}
      />
    </AssignPanelShell>
  );
}
