import { useEffect, useState } from "react";
import { X, Loader2 } from "lucide-react";
import {
  useAssignmentClassRows,
} from "@/modules/shared/exams/hooks/useSharedExamData";
import {
  getClassesForTarget,
  type DashboardAssignmentTarget,
} from "@/modules/shared/exams/selectors/dashboardSelectors";
import type { DutyStatus } from "@/modules/shared/exams/types/exam.types";
import DutyStatusModal from "@/modules/exams/components/DutyStatusModal";
import TeacherAssignmentTable from "./TeacherAssignmentTable";

type FilterStatus = Extract<DutyStatus, "NOT_ASSIGNED" | "PARTIAL">;

interface TeacherAssignmentViewProps {
  status: FilterStatus;
  target: DashboardAssignmentTarget;
  onClose: () => void;
}

function formatFull(d: Date): string {
  return d.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const COPY: Record<FilterStatus, { title: string; noun: (n: number) => string }> = {
  NOT_ASSIGNED: {
    title: "Not Assigned Classes",
    noun: (n) =>
      `${n} ${n === 1 ? "class requires" : "classes require"} teacher assignment`,
  },
  PARTIAL: {
    title: "Partially Assigned Classes",
    noun: (n) =>
      `${n} ${n === 1 ? "class has" : "classes have"} incomplete teacher assignments`,
  },
};

/**
 * Full-screen class-level drill-down opened from the dashboard's Not-Assigned /
 * Partially-Assigned cards. Lists exactly the classrooms in that status on the
 * assignment-status target date, and lets CS assign duties per classroom via
 * the EXISTING DutyStatusModal (same DCS / RS / Invigilator flow used from the
 * Exams timetable). Assigning invalidates `["shared"]`, so the row list
 * refetches automatically and a class drops off once it leaves the status.
 */
export default function TeacherAssignmentView({
  status,
  target,
  onClose,
}: TeacherAssignmentViewProps) {
  const { data: rows, isLoading, error } = useAssignmentClassRows();
  const [activeSlotId, setActiveSlotId] = useState<string | null>(null);

  // The visible list filters to the selected status; the active row is looked
  // up across ALL rows so the assignment modal stays open through the session
  // even after the class changes status (and thus leaves the filtered list).
  const classes = getClassesForTarget(rows, target.date, status);
  const activeRow = rows.find((r) => r.slotId === activeSlotId) ?? null;
  // Surface an error only when nothing loaded at all — a transient refetch
  // error with cached rows keeps showing the (stale-but-usable) list.
  const showError = Boolean(error) && rows.length === 0 && !isLoading;

  // Esc closes the assignment modal first (it has no Esc handler of its own),
  // then the full-screen view.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (activeSlotId) setActiveSlotId(null);
      else onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, activeSlotId]);

  const copy = COPY[status];

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-white">
      {/* Header */}
      <header className="flex items-start justify-between border-b border-gray-100 px-6 py-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
            Teacher Assignment
          </p>
          <h2 className="text-xl font-bold text-slate-800">{copy.title}</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            {copy.noun(classes.length)}
            {target.date ? (
              <>
                {" · "}
                <span className="font-semibold text-slate-700">
                  {formatFull(target.date)}
                </span>
              </>
            ) : null}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="shrink-0 rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-6 w-6" />
        </button>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-auto px-6 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading classes…
          </div>
        ) : showError ? (
          <p className="py-16 text-center text-sm font-medium text-red-500">
            Couldn&apos;t load classes. Please try again.
          </p>
        ) : classes.length === 0 ? (
          <p className="py-16 text-center text-[15px] font-medium italic tracking-wide text-slate-400">
            No classes need attention here right now.
          </p>
        ) : (
          <TeacherAssignmentTable classes={classes} onAssign={setActiveSlotId} />
        )}
      </div>

      {/* Existing assignment modal, reused as-is for the selected classroom. */}
      {activeRow && (
        <DutyStatusModal
          open
          onClose={() => setActiveSlotId(null)}
          assignment={activeRow.assignment}
          schedule={activeRow.schedule}
          dutyFlags={activeRow.flags}
          status={activeRow.status}
        />
      )}
    </div>
  );
}
