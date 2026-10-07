// Copied verbatim from frontend/src/modules/shared/exams/utils/examStatusUtils.ts
// (pure helpers only — the Tailwind class maps are web-only) — keep in sync.

import type { ExamGroup, ExamGroupStatus } from "./examTypes";

export function getExamGroupStatus(group: ExamGroup): ExamGroupStatus {
  const now = new Date();
  const start = new Date(group.startDate);
  const end = new Date(group.endDate);
  now.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  if (now < start) return "upcoming";
  if (now > end) return "completed";
  return "ongoing";
}

const TYPE_SUBTITLE: Record<string, string> = {
  IA1: "Internal Assessment 1",
  IA2: "Internal Assessment 2",
  IA3: "Internal Assessment 3",
  SEE: "Semester End Examination",
};

export function getTypeSubtitle(examType: string): string {
  return TYPE_SUBTITLE[examType] || examType;
}
