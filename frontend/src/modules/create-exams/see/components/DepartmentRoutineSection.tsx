import { GraduationCap } from "lucide-react";
import type { DepartmentData, SEERoutineEntry } from "../types";
import type { AddEntryInput } from "../hooks/useSEERoutine";
import CourseSelectorCard from "./CourseSelectorCard";
import ScheduledRoutineList from "./ScheduledRoutineList";

interface DepartmentRoutineSectionProps {
  department: DepartmentData;
  routine: SEERoutineEntry[];
  scheduledCourseIds: Set<string>;
  /** Non-null only when the entry currently being edited belongs to this dept. */
  editingEntry: SEERoutineEntry | null;
  editingId: string | null;
  feedback: string | null;
  onSubmit: (input: AddEntryInput) => boolean;
  onCancelEdit: () => void;
  onEdit: (localId: string) => void;
  onDelete: (localId: string) => void;
}

/**
 * One department's scheduling block in the multi-department SEE routine phase:
 * a department header, the "Schedule a Course" card, and that department's
 * scheduled routine. Rendered once per selected department so CSE's courses are
 * never mixed with ME's.
 */
export default function DepartmentRoutineSection({
  department,
  routine,
  scheduledCourseIds,
  editingEntry,
  editingId,
  feedback,
  onSubmit,
  onCancelEdit,
  onEdit,
  onDelete,
}: DepartmentRoutineSectionProps) {
  return (
    <section className="space-y-4 rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-br from-pink-500 to-purple-600 px-3 py-1.5 text-sm font-bold text-white shadow-sm">
          <GraduationCap className="h-4 w-4" />
          {department.code}
        </span>
        <span className="text-sm font-medium text-gray-500">
          {department.name}
        </span>
      </div>

      {department.courses.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 py-8 text-center">
          <p className="text-sm text-gray-500">
            No courses found for {department.code} in this semester.
          </p>
        </div>
      ) : (
        <CourseSelectorCard
          courses={department.courses}
          scheduledCourseIds={scheduledCourseIds}
          editingEntry={editingEntry}
          feedback={feedback}
          onSubmit={onSubmit}
          onCancelEdit={onCancelEdit}
        />
      )}

      <ScheduledRoutineList
        routine={routine}
        editingId={editingId}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </section>
  );
}
