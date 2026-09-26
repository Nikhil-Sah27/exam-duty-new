import { Users, UserX, UserCog, Activity, CalendarClock } from "lucide-react";
import AssignmentStatusCard from "./AssignmentStatusCard";
import type { DashboardAssignmentTarget } from "@/modules/shared/exams/selectors/dashboardSelectors";

interface AssignmentStatusSectionProps {
  target: DashboardAssignmentTarget;
  ongoingCount: number;
  upcomingCount: number;
  /** True while the duty slots feeding the assignment counts are loading. */
  loading?: boolean;
}

/** "Sunday, 27 Sep 2026" — full weekday, day, short month, year. */
function formatFull(d: Date): string {
  return d.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Assignment-status section. The target date is chosen centrally
 * (`getDashboardAssignmentTarget`): tomorrow when exams exist tomorrow, else
 * the nearest future exam date — combining ALL exams on that date. The header,
 * subtitle, exam list and card deep-links all adapt to the chosen date.
 * Renders the two required cards (Not Assigned, Partially Assigned — Fully
 * Assigned omitted) plus the Ongoing / Upcoming counts beside them.
 */
export default function AssignmentStatusSection({
  target,
  ongoingCount,
  upcomingCount,
  loading = false,
}: AssignmentStatusSectionProps) {
  const hasTarget = target.date !== null && target.totalClasses > 0;

  const title = target.isTomorrow
    ? "Tomorrow's Exams — Teacher Assignment Status"
    : "Next Exams — Teacher Assignment Status";

  const linkFor = (assignment: "not-assigned" | "partial") =>
    `/exams?assignment=${assignment}&date=${target.dateKey}`;

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
      <header className="mb-5 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
          <Users className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-slate-800">{title}</h2>
          <p className="text-sm text-slate-500">{renderSubtitle(target)}</p>

          {target.exams.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                {target.exams.length}{" "}
                {target.exams.length === 1 ? "Exam" : "Exams"}
              </span>
              {target.exams.map((e) => (
                <span
                  key={e.examGroupId}
                  className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 ring-1 ring-indigo-100"
                >
                  {e.examType} · Sem {e.semester}
                </span>
              ))}
            </div>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          <>
            <CardSkeleton />
            <CardSkeleton />
          </>
        ) : hasTarget ? (
          <>
            <AssignmentStatusCard
              tone="red"
              icon={<UserX className="h-5 w-5" />}
              label="Teachers Not Assigned"
              value={target.notAssigned}
              valuePrefix="across "
              valueSuffix=" classes"
              to={linkFor("not-assigned")}
            />
            <AssignmentStatusCard
              tone="amber"
              icon={<UserCog className="h-5 w-5" />}
              label="Partially Assigned"
              value={target.partiallyAssigned}
              valuePrefix="across "
              valueSuffix=" classes"
              to={linkFor("partial")}
            />
          </>
        ) : (
          <div className="sm:col-span-2 flex items-center rounded-2xl border border-dashed border-gray-200 px-5 py-6 text-sm text-slate-500">
            No upcoming exams scheduled.
          </div>
        )}

        <AssignmentStatusCard
          tone="emerald"
          icon={<Activity className="h-5 w-5" />}
          label="Ongoing Exams"
          value={ongoingCount}
          valueSuffix=" in progress"
        />
        <AssignmentStatusCard
          tone="indigo"
          icon={<CalendarClock className="h-5 w-5" />}
          label="Upcoming Exams"
          value={upcomingCount}
          valueSuffix=" not started"
        />
      </div>
    </section>
  );
}

function renderSubtitle(target: DashboardAssignmentTarget) {
  if (!target.date) {
    return "No exams are scheduled tomorrow or later.";
  }
  const date = <span className="font-semibold text-slate-700">{formatFull(target.date)}</span>;
  if (target.isTomorrow) {
    return <>Status of teacher assignments for exams scheduled on {date}.</>;
  }
  return (
    <>
      No exams are scheduled tomorrow. Showing assignment status for the next
      scheduled exams on {date}.
    </>
  );
}

function CardSkeleton() {
  return (
    <div className="flex animate-pulse flex-col rounded-2xl border border-gray-100 bg-gray-50 p-5">
      <div className="h-11 w-11 rounded-xl bg-gray-200" />
      <div className="mt-4 h-4 w-32 rounded bg-gray-200" />
      <div className="mt-2 h-6 w-24 rounded bg-gray-200" />
    </div>
  );
}
