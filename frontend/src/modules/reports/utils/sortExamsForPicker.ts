import type { ExamGroup, ExamGroupStatus } from "@/modules/exams/types";
import { getExamGroupStatus } from "@/modules/shared/exams/utils/examStatusUtils";

export interface ExamPickerItem {
  exam: ExamGroup;
  status: ExamGroupStatus;
}

/** Sort priority: ongoing first, then upcoming, then completed. */
const STATUS_ORDER: ExamGroupStatus[] = ["ongoing", "upcoming", "completed"];

/**
 * Within a status, order by date ascending, then by semester (1, 2, 3…) as the
 * tiebreaker when two exams start on the same day. Exam groups carry a date
 * range but no clock time, so the start date is the effective "date + time"
 * key; the semester tiebreaker keeps the order stable and predictable.
 */
function compareWithinStatus(a: ExamGroup, b: ExamGroup): number {
  const byDate =
    new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
  if (byDate !== 0) return byDate;
  return a.semester - b.semester;
}

/**
 * Return exams as a single flat list — no status sections — ordered ongoing →
 * upcoming → completed, and within a status by date then semester. Each item
 * carries its own status so the row can show a per-exam status badge. Reuses
 * `getExamGroupStatus` (the app-wide source of truth for the status split) so
 * the picker can never disagree with the dashboards.
 */
export function sortExamsForPicker(exams: ExamGroup[]): ExamPickerItem[] {
  return exams
    .map((exam) => ({ exam, status: getExamGroupStatus(exam) }))
    .sort((a, b) => {
      const byStatus =
        STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
      if (byStatus !== 0) return byStatus;
      return compareWithinStatus(a.exam, b.exam);
    });
}

export const STATUS_LABEL: Record<ExamGroupStatus, string> = {
  ongoing: "Ongoing",
  upcoming: "Upcoming",
  completed: "Completed",
};
