import { useState, useEffect, FormEvent } from "react";
import type { Course, CourseExams, CourseType, ElectiveGroup } from "../../types";
import { Modal, Input, Button, ErrorAlert } from "@/shared/components";
import { EXAM_LABELS, COURSE_TYPE_LABELS } from "./courseListUtils";

/** The slice of a react-query mutation result the modals need for status UI. */
interface MutationStatus {
  isPending: boolean;
  isError: boolean;
  error: Error | null;
}

/**
 * Course form state. Lives in the parent (via this hook) so open/edit
 * handlers can preset fields before the modal opens.
 */
export function useCourseForm(editCourse: Course | null) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [credits, setCredits] = useState("3");
  const [exams, setExams] = useState<CourseExams>({ ia1: false, ia2: false, ia3: false, see: false });
  const [courseType, setCourseType] = useState<CourseType>("core");
  const [electiveGroupId, setElectiveGroupId] = useState<string>("");

  useEffect(() => {
    if (editCourse) {
      setName(editCourse.name);
      setCode(editCourse.code);
      setCredits(String(editCourse.credits));
      setExams({ ...editCourse.exams });
      setCourseType(editCourse.courseType || "core");
      const egId = typeof editCourse.electiveGroup === "object" && editCourse.electiveGroup
        ? editCourse.electiveGroup._id
        : editCourse.electiveGroup || "";
      setElectiveGroupId(egId as string);
    }
  }, [editCourse]);

  const reset = () => {
    setName("");
    setCode("");
    setCredits("3");
    setExams({ ia1: false, ia2: false, ia3: false, see: false });
    setCourseType("core");
    setElectiveGroupId("");
  };

  const toggleExam = (key: keyof CourseExams) =>
    setExams((prev) => ({ ...prev, [key]: !prev[key] }));

  return {
    name,
    setName,
    code,
    setCode,
    credits,
    setCredits,
    exams,
    toggleExam,
    courseType,
    setCourseType,
    electiveGroupId,
    setElectiveGroupId,
    reset,
  };
}

export type CourseFormState = ReturnType<typeof useCourseForm>;

export function CourseFormModal({
  open,
  isEdit,
  form,
  electiveGroups,
  mutation,
  onClose,
  onSubmit,
}: {
  open: boolean;
  isEdit: boolean;
  form: CourseFormState;
  electiveGroups: ElectiveGroup[] | undefined;
  mutation: MutationStatus;
  onClose: () => void;
  onSubmit: (e: FormEvent) => void;
}) {
  const isElective = form.courseType !== "core";

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Edit Course" : "Add Course"}>
      {mutation.isError && <ErrorAlert message={mutation.error?.message ?? ""} />}
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Course Name" required value={form.name} onChange={(e) => form.setName(e.target.value)} placeholder="e.g. Data Structures" />
          <Input label="Course Code" required value={form.code} onChange={(e) => form.setCode(e.target.value.toUpperCase())} placeholder="e.g. CS301" />
        </div>
        <Input label="Credits" type="number" required min={1} value={form.credits} onChange={(e) => form.setCredits(e.target.value)} />

        {/* Course Type */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">Course Type</label>
          <div className="flex gap-3">
            {(["core", "elective"] as CourseType[]).map((t) => (
              <label key={t} className="flex items-center gap-1.5 text-sm text-gray-700">
                <input
                  type="radio"
                  name="courseType"
                  checked={form.courseType === t}
                  onChange={() => {
                    form.setCourseType(t);
                    if (t === "core") form.setElectiveGroupId("");
                  }}
                  className="border-gray-300"
                />
                {COURSE_TYPE_LABELS[t]}
              </label>
            ))}
          </div>
        </div>

        {/* Elective Group selector */}
        {isElective && (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Elective Group</label>
            <select
              value={form.electiveGroupId}
              onChange={(e) => form.setElectiveGroupId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              required
            >
              <option value="">Select group...</option>
              {(electiveGroups ?? []).map((g) => (
                <option key={g._id} value={g._id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Exam Types */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">Exam Types</label>
          <div className="flex gap-4">
            {EXAM_LABELS.map(({ key, label }) => (
              <label key={key} className="flex items-center gap-1.5 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.exams[key]}
                  onChange={() => form.toggleExam(key)}
                  className="rounded border-gray-300"
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" isLoading={mutation.isPending}>
            {isEdit ? "Save Changes" : "Add Course"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function GroupFormModal({
  open,
  editGroup,
  groupName,
  setGroupName,
  createStatus,
  updateStatus,
  onClose,
  onSubmit,
}: {
  open: boolean;
  editGroup: ElectiveGroup | null;
  groupName: string;
  setGroupName: (name: string) => void;
  createStatus: MutationStatus;
  updateStatus: MutationStatus;
  onClose: () => void;
  onSubmit: (e: FormEvent) => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editGroup ? "Rename Elective Group" : "Create Elective Group"}
    >
      {(createStatus.isError || updateStatus.isError) && (
        <ErrorAlert
          message={(createStatus.error || updateStatus.error)?.message ?? ""}
        />
      )}
      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          label="Group Name"
          required
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          placeholder="e.g. Elective Group 1"
        />
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            type="submit"
            isLoading={editGroup ? updateStatus.isPending : createStatus.isPending}
          >
            {editGroup ? "Save Changes" : "Create Group"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
