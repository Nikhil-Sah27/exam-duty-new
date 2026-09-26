import { Activity, CalendarClock, ClipboardList, Users } from "lucide-react";
import AssignmentStatusCard from "./AssignmentStatusCard";
import { useExamStatistics } from "../hooks/useExamStatistics";

interface ExamStatisticsSectionProps {
  ongoingCount: number;
  upcomingCount: number;
}

/**
 * Dashboard "State C" view — shown when there are no ongoing and no upcoming
 * exams, so there is no assignment data to display. Presents four headline
 * statistics with Ongoing / Upcoming as the two leftmost cards. Scheduled-exam
 * and student totals come from the centralized sources via `useExamStatistics`.
 */
export default function ExamStatisticsSection({
  ongoingCount,
  upcomingCount,
}: ExamStatisticsSectionProps) {
  const { scheduledExams, totalStudents } = useExamStatistics();

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
      <header className="mb-5 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
          <ClipboardList className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-bold text-slate-800">Exam Statistics</h2>
          <p className="text-sm text-slate-500">
            No exams are currently running or upcoming. Here&apos;s an overview
            of the institution&apos;s exam data.
          </p>
        </div>
      </header>

      {/* Ongoing & Upcoming are the two leftmost cards, per spec. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
        <AssignmentStatusCard
          tone="violet"
          icon={<ClipboardList className="h-5 w-5" />}
          label="Scheduled Exams"
          value={scheduledExams}
          valueSuffix=" total"
        />
        <AssignmentStatusCard
          tone="slate"
          icon={<Users className="h-5 w-5" />}
          label="Total Students"
          value={totalStudents}
        />
      </div>
    </section>
  );
}
