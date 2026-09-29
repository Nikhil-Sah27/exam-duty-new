import type { CourseExams, CourseType } from "../../types";

export const EXAM_LABELS: { key: keyof CourseExams; label: string }[] = [
  { key: "ia1", label: "IA1" },
  { key: "ia2", label: "IA2" },
  { key: "ia3", label: "IA3" },
  { key: "see", label: "SEE" },
];

export const COURSE_TYPE_LABELS: Record<CourseType, string> = {
  core: "Core",
  elective: "Elective",
};
