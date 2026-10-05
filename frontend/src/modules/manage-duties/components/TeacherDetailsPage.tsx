import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { useDutiesByTeacher } from "@/modules/shared/exams/hooks/useSharedExamData";
import { useTeacherDetails, useTeacherDcsGroups } from "../hooks";
import {
  useTeacherDutyProgress,
  useTeacherRsDutyProgress,
  useTeacherDcsDutyProgress,
} from "@/modules/duty-calculation/hooks/useDutyProgress";
import TeacherHeader from "./TeacherHeader";
import DutyStatsBar from "./DutyStatsBar";
import DutySection from "./DutySection";
import TeacherRSDutyGroups from "./TeacherRSDutyGroups";
import TeacherDCSDutyGroups from "./TeacherDCSDutyGroups";
import UnassignDutyModal, { type UnassignTarget } from "./UnassignDutyModal";
import { isDutyUpcoming } from "@/modules/shared/duties/utils/dutyTiming";
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

  // Duty stats (Completed / Remaining / Target) come from the server-computed
  // duty-calculation endpoints — the single source of truth used everywhere
  // (dashboards, assign wizards, reports) — so the tiles never recompute or
  // hard-code targets. One endpoint per role the teacher actually holds; the
  // tiles sum them so a dual-role teacher (e.g. RS + Invigilator) shows the
  // combined figure. Targets are per-role, so a role the teacher lacks is
  // never fetched.
  const roles = teacher?.roles ?? [];
  // CS is a pure admin role with no duties; only these roles carry a target.
  const hasDutyRole = roles.some(
    (r) => r === "invigilator" || r === "rs" || r === "dcs",
  );
  const invProgress = useTeacherDutyProgress(
    roles.includes("invigilator") ? id : null,
  );
  const rsProgress = useTeacherRsDutyProgress(roles.includes("rs") ? id : null);
  const dcsProgress = useTeacherDcsDutyProgress(
    roles.includes("dcs") ? id : null,
  );

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

  // Sum the per-role progress payloads into the three tiles. Each payload
  // already collapses RS/DCS room-groups into units, so a 5-room RS group
  // counts once — matching every other duty-count surface.
  const dutyStats = [invProgress.data, rsProgress.data, dcsProgress.data]
    .filter((p): p is NonNullable<typeof p> => p != null)
    .reduce(
      (acc, p) => ({
        completed: acc.completed + p.completed,
        remaining: acc.remaining + p.remaining,
        target: acc.target + p.target,
      }),
      { completed: 0, remaining: 0, target: 0 },
    );

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

  // Completed is time-derived, never a stored status — a duty stays "assigned"
  // even after it happens. Split on `isDutyUpcoming` (the app-wide source of
  // truth) so a past duty lands in Completed, matching the stat tiles and every
  // other dashboard, instead of lingering under Upcoming.
  const liveFlat = flatDuties.filter((d) => d.status !== "cancelled");
  const flatUpcoming = liveFlat.filter((d) => isDutyUpcoming(d.date, d.endTime));
  const flatCompleted = liveFlat.filter(
    (d) => !isDutyUpcoming(d.date, d.endTime),
  );

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

      {/* Stats bar — CS (and non-teaching) accounts carry no duty target, so
          the Completed/Remaining/Target tiles would be a meaningless 0/0/0. */}
      {hasDutyRole && (
        <DutyStatsBar
          completed={dutyStats.completed}
          remaining={dutyStats.remaining}
          target={dutyStats.target}
        />
      )}

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
