import { ExamGroupType } from "../types";

const EXAM_TYPES: ExamGroupType[] = ["IA1", "IA2", "IA3", "SEE"];
const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "ongoing", label: "Ongoing" },
  { value: "upcoming", label: "Upcoming" },
  { value: "completed", label: "Completed" },
];

const SELECT_CLASS =
  "rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

interface ExamFiltersProps {
  selectedType: string;
  selectedSemester: string;
  onTypeChange: (type: string) => void;
  onSemesterChange: (semester: string) => void;
  /** Department filter — rendered on the left only when `onDepartmentChange` is given. */
  selectedDepartment?: string;
  onDepartmentChange?: (department: string) => void;
  /** Department codes present in the data, for the dropdown options. */
  departmentOptions?: string[];
  /** Status filter — rendered on the right only when `onStatusChange` is given. */
  selectedStatus?: string;
  onStatusChange?: (status: string) => void;
}

export default function ExamFilters({
  selectedType,
  selectedSemester,
  onTypeChange,
  onSemesterChange,
  selectedDepartment = "",
  onDepartmentChange,
  departmentOptions = [],
  selectedStatus = "",
  onStatusChange,
}: ExamFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Exam Type Filter */}
      <select
        value={selectedType}
        onChange={(e) => onTypeChange(e.target.value)}
        className={SELECT_CLASS}
        aria-label="Exam type"
      >
        <option value="">All Types</option>
        {EXAM_TYPES.map((type) => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
      </select>

      {/* Semester Filter */}
      <select
        value={selectedSemester}
        onChange={(e) => onSemesterChange(e.target.value)}
        className={SELECT_CLASS}
        aria-label="Semester"
      >
        <option value="">All Semesters</option>
        {SEMESTERS.map((s) => (
          <option key={s} value={s}>
            Semester {s}
          </option>
        ))}
      </select>

      {/* Department Filter */}
      {onDepartmentChange && (
        <select
          value={selectedDepartment}
          onChange={(e) => onDepartmentChange(e.target.value)}
          className={SELECT_CLASS}
          aria-label="Department"
        >
          <option value="">All Departments</option>
          {departmentOptions.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      )}

      {/* Status Filter — pushed to the right */}
      {onStatusChange && (
        <select
          value={selectedStatus}
          onChange={(e) => onStatusChange(e.target.value)}
          className={`ml-auto ${SELECT_CLASS}`}
          aria-label="Status"
        >
          <option value="">All Status</option>
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
