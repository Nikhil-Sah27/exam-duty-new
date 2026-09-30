import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { useDutiesByTeacher } from "@/modules/shared/exams/hooks/useSharedExamData";
import { useTeacherDetails, useTeacherDcsGroups } from "../hooks";
import TeacherHeader from "./TeacherHeader";
import DutyStatsBar from "./DutyStatsBar";
import DutySection from "./DutySection";
import TeacherRSDutyGroups from "./TeacherRSDutyGroups";
import TeacherDCSDutyGroups from "./TeacherDCSDutyGroups";
import UnassignDutyModal, { type UnassignTarget } from "./UnassignDutyModal";
import { countDutyUnits } from "../utils/dutyUnitCounts";
import { formatDate } from "@/shared/lib/utils";

export default function TeacherDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const {
    data: teacher,
    isLoading: teacherLoading,
    isError: teacherError,
    error: tError,
  } = useTeacherDetails(id!);
  const { data: dutiesData, isLoading: dutiesLoading } = useDutiesByTeacher(id);
  const { data: dcsGroupsData, isLoading: dcsGroupsLoading } =
    useTeacherDcsGroups(id!);
  const [unassignTarget, setUnassignTarget] = useState<UnassignTarget | null>(null);

  if (teacherLoading || dutiesLoading || dcsGroupsLoading) {
    return <p className="text-gray-500">Loading...</p>;
  }

  if (teacherError) {
    return <p className="text-red-600">Error: {tError.message}</p>;
  }

  if (!teacher) {
    return <p className="text-red-600">Teacher not found.</p>;
  }

  const duties = dutiesData ?? [];
  const dcsGroups = dcsGroupsData ?? [];

  // RS and DCS are group roles — a whole room-group counts as one duty, not one
  // per class — so the tiles use group-aware counts, not raw room-duty counts.
  const stats = countDutyUnits(duties);

  // Grouped views own their role's duties: RS derives room-groups from the
  // flat list; DCS renders its persisted groups. Everything else (invigilator
  // duties, plus legacy duties with no role) falls back to the flat table.
  // If DCS groups failed to load, DCS duties fall back to the flat table too
  // so nothing silently disappears.
  const rsDuties = duties.filter((d) => d.role === "rs");
  const hasDcsGroups = dcsGroups.length > 0;
  const flatDuties = duties.filter((d) => {
    if (d.role === "rs") return false;
    if (d.role === "dcs") return !hasDcsGroups;
    return true;
  });

  const showDcs = hasDcsGroups;
  const showRs = rsDuties.length > 0;
  // Always render the flat table when there are flat duties, or as the default
  // empty state when the teacher has no grouped duties either.
  const showFlat = flatDuties.length > 0 || (!showDcs && !showRs);

  const flatUpcoming = flatDuties.filter((d) => d.status === "assigned");
  const flatCompleted = flatDuties.filter((d) => d.status === "completed");

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-gray-400">
        <Link
          to="/manage-duties"
          className="transition-colors hover:text-gray-700"
        >
          Manage Duties
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-gray-700">{teacher.name}</span>
      </nav>

      {/* Header card */}
      <TeacherHeader teacher={teacher} />

      {/* Stats bar */}
      <DutyStatsBar
        upcoming={stats.active}
        completed={stats.completed}
        total={stats.total}
      />

      {/* Duty sections — grouped for RS/DCS, flat table otherwise */}
      {showDcs && (
        <TeacherDCSDutyGroups
          groups={dcsGroups}
          onUnassign={(g) => {
            const dutyId = g.duties?.[0];
            if (!dutyId) return;
            setUnassignTarget({
              dutyId,
              group: true,
              teacherName: teacher.name,
              what: `DCS group of ${g.assignedRooms.length} room${g.assignedRooms.length === 1 ? "" : "s"} on ${formatDate(g.schedule.date)}`,
            });
          }}
        />
      )}
      {showRs && (
        <TeacherRSDutyGroups
          duties={rsDuties}
          onUnassign={(g) =>
            setUnassignTarget({
              dutyId: g.rooms[0].dutyId,
              group: true,
              teacherName: teacher.name,
              what: `RS group of ${g.rooms.length} room${g.rooms.length === 1 ? "" : "s"} on ${formatDate(g.date)}`,
            })
          }
        />
      )}
      {showFlat && (
        <>
          <DutySection
            title="Upcoming Duties"
            variant="upcoming"
            duties={flatUpcoming}
            onUnassign={(d) =>
              setUnassignTarget({
                dutyId: d._id,
                // Legacy DCS rows only land here when their groups failed to load.
                group: d.role === "dcs",
                teacherName: teacher.name,
                what: `duty in room ${d.room || "—"} on ${formatDate(d.date)}`,
              })
            }
          />
          <DutySection
            title="Completed Duties"
            variant="completed"
            duties={flatCompleted}
          />
        </>
      )}

      <UnassignDutyModal target={unassignTarget} onClose={() => setUnassignTarget(null)} />
    </div>
  );
}
