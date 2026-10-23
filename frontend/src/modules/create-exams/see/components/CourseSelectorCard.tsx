import { useEffect, useState } from "react";
import { Plus, AlertTriangle, RotateCcw, Save } from "lucide-react";
import Button from "@/shared/components/Button";
import type { DepartmentData, SEERoutineEntry } from "../types";
import CourseCodeDropdown from "./CourseCodeDropdown";
import CourseTitleDropdown from "./CourseTitleDropdown";
import ExamDatePicker from "./ExamDatePicker";
import TimeRangePicker from "./TimeRangePicker";

interface CourseSelectorCardProps {
  courses: DepartmentData["courses"];
  scheduledCourseIds: Set<string>;
  /** Pre-populate the card for the "edit existing routine entry" flow. */
  editingEntry: SEERoutineEntry | null;
  /** Server / form-level feedback message — surfaced under the card. */
  feedback: string | null;
  onSubmit: (input: {
    courseId: string;
    date: string;
    startTime: string;
    endTime: string;
  }) => boolean;
  onCancelEdit?: () => void;
  disabled?: boolean;
}

const todayISO = (): string => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
};

/**
 * The scheduling card. Pickers are synchronized — selecting a course code
 * auto-selects the matching course title and vice versa, because both
 * dropdowns are bound to the same `courseId` state.
 */
export default function CourseSelectorCard({
  courses,
  scheduledCourseIds,
  editingEntry,
  feedback,
  onSubmit,
  onCancelEdit,
  disabled,
}: CourseSelectorCardProps) {
  const [courseId, setCourseId] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  // Reset / pre-fill whenever the edit target changes.
  useEffect(() => {
    if (editingEntry) {
      setCourseId(editingEntry.courseId);
      setDate(editingEntry.date);
      setStartTime(editingEntry.startTime);
      setEndTime(editingEntry.endTime);
    } else {
      setCourseId("");
      setDate("");
      setStartTime("");
      setEndTime("");
    }
  }, [editingEntry]);

  const handleSubmit = () => {
    const ok = onSubmit({ courseId, date, startTime, endTime });
    if (ok && !editingEntry) {
      // Clear only what differs per subject. Start/end time are kept so CS
      // can schedule the next course in the same slot without re-entering it.
      setCourseId("");
      setDate("");
    }
  };

  const isEditing = Boolean(editingEntry);

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">
          {isEditing ? "Edit Scheduled Course" : "Schedule a Course"}
        </h3>
        {isEditing && onCancelEdit && (
          <button
            onClick={onCancelEdit}
            className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700"
          >
            <RotateCcw className="h-3 w-3" /> Cancel edit
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CourseCodeDropdown
          courses={courses}
          scheduledCourseIds={scheduledCourseIds}
          value={courseId}
          onChange={setCourseId}
          disabled={disabled}
        />
        <CourseTitleDropdown
          courses={courses}
          scheduledCourseIds={scheduledCourseIds}
          value={courseId}
          onChange={setCourseId}
          disabled={disabled}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ExamDatePicker
          value={date}
          onChange={setDate}
          min={todayISO()}
          disabled={disabled}
        />
        <TimeRangePicker
          startTime={startTime}
          endTime={endTime}
          onStartChange={setStartTime}
          onEndChange={setEndTime}
          disabled={disabled}
        />
      </div>

      {feedback && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-700">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {feedback}
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <Button onClick={handleSubmit} disabled={disabled}>
          {isEditing ? (
            <>
              <Save className="mr-1 h-4 w-4" /> Save Changes
            </>
          ) : (
            <>
              <Plus className="mr-1 h-4 w-4" /> Add To Routine
            </>
          )}
        </Button>
      </div>
    </section>
  );
}
