import { Trash2, Pencil } from "lucide-react";
import type { Course } from "../../types";
import { EXAM_LABELS } from "./courseListUtils";

export default function CourseRow({
  course,
  onEdit,
  onDelete,
}: {
  course: Course;
  onEdit: (c: Course) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-2.5">
      <div className="min-w-0 flex-1">
        <span className="text-sm font-medium text-gray-800">{course.code}</span>
        <span className="mx-2 text-gray-300">&mdash;</span>
        <span className="text-sm text-gray-600">{course.name}</span>
        <span className="ml-2 text-xs text-gray-400">({course.credits} cr)</span>
      </div>
      <div className="flex items-center gap-2">
        {EXAM_LABELS.map(({ key, label }) =>
          course.exams[key] ? (
            <span
              key={key}
              className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700"
            >
              {label}
            </span>
          ) : null
        )}
        <button
          onClick={() => onEdit(course)}
          className="ml-2 rounded p-1 text-gray-300 hover:bg-blue-50 hover:text-blue-500"
          title="Edit"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => onDelete(course._id)}
          className="rounded p-1 text-gray-300 hover:bg-red-50 hover:text-red-500"
          title="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
