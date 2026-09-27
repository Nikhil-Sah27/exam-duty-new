import { useAuthStore } from "@/shared/store/auth.store";
import DashboardHero from "./DashboardHero";
import AssignmentStatusSection from "./AssignmentStatusSection";
import ExamStatisticsSection from "./ExamStatisticsSection";
import OngoingExamsSection from "./OngoingExamsSection";
import UpcomingExamsSection from "./UpcomingExamsSection";
import CompletedExamsSection from "./CompletedExamsSection";
import UpcomingExamPopup from "./upcoming-exam-popup/UpcomingExamPopup";
import ImportantNotificationProvider from "../important-notifications/ImportantNotificationProvider";
import { useDashboardSummary } from "../hooks/useDashboardSummary";

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const {
    ongoingExams,
    upcomingExams,
    completedExams,
    assignmentTarget,
    groupsLoading,
    assignmentLoading,
    error,
  } = useDashboardSummary();

  // No ongoing and no upcoming exams → there's no assignment data, so the top
  // section becomes the Exam Statistics overview and the Completed grid is
  // surfaced below. Otherwise (tomorrow / nearest-future) show assignment
  // status at the top and keep Completed hidden.
  const noActiveExams =
    ongoingExams.length === 0 && upcomingExams.length === 0;

  return (
    <div className="mt-4 space-y-6">
      <DashboardHero name={user?.name} />

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Failed to load dashboard data. Please try again later.
        </div>
      ) : null}

      {groupsLoading ? (
        <p className="text-sm text-gray-500">Loading exams...</p>
      ) : (
        <>
          {/* Top section: assignment status (State A/B) or exam statistics (State C). */}
          {noActiveExams ? (
            <ExamStatisticsSection
              ongoingCount={ongoingExams.length}
              upcomingCount={upcomingExams.length}
            />
          ) : (
            <AssignmentStatusSection
              target={assignmentTarget}
              ongoingCount={ongoingExams.length}
              upcomingCount={upcomingExams.length}
              loading={assignmentLoading}
            />
          )}

          {/* Exam card grids — always shown. */}
          <OngoingExamsSection exams={ongoingExams} />
          <UpcomingExamsSection exams={upcomingExams} />

          {/* Completed exams only when nothing is ongoing or upcoming. */}
          {noActiveExams && <CompletedExamsSection exams={completedExams} />}
        </>
      )}

      {/* Additive: floating bottom flip-popup for upcoming exams (CS only). */}
      <UpcomingExamPopup />

      {/* Additive: top-left liquid-glass important-notification popups (CS only). */}
      <ImportantNotificationProvider />
    </div>
  );
}
