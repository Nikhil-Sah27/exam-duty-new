import { useState, type ChangeEvent } from "react";
import { Select } from "@/shared/components";
import { useDepartments, useCreateDepartment } from "../hooks";
import DepartmentModal from "./DepartmentModal";

/** Sentinel value for the inline "create a new department" option. */
const CREATE = "__create_department__";

interface DepartmentSelectProps {
  /** The selected department name (users store the name, not an id). */
  value: string;
  onChange: (departmentName: string) => void;
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
}

/**
 * A dropdown of existing departments (chosen by name, matching how users/exams
 * store `department`). Includes an inline "＋ Create new department…" option that
 * opens the department form and auto-selects the newly created one — so a
 * missing department can be added on the spot and picked here and everywhere.
 */
export default function DepartmentSelect({
  value,
  onChange,
  label = "Department",
  id = "department",
  required = false,
  placeholder = "Select department",
}: DepartmentSelectProps) {
  const { data: departments = [], isLoading } = useDepartments();
  const createMutation = useCreateDepartment();
  const [modalOpen, setModalOpen] = useState(false);

  const names = departments.map((d) => d.name);

  const options = [
    { value: "", label: isLoading ? "Loading…" : placeholder },
    // Preserve a legacy/free-text value that isn't a registered department yet.
    ...(value && !names.includes(value)
      ? [{ value, label: `${value} (unlisted)` }]
      : []),
    ...departments.map((d) => ({
      value: d.name,
      label: d.code ? `${d.name} (${d.code})` : d.name,
    })),
    { value: CREATE, label: "＋ Create new department…" },
  ];

  const handleChange = (e: ChangeEvent<HTMLSelectElement>) => {
    if (e.target.value === CREATE) {
      setModalOpen(true);
      return;
    }
    onChange(e.target.value);
  };

  const handleCreate = (data: { name: string; code: string }) => {
    createMutation.mutate(data, {
      onSuccess: (dept) => {
        setModalOpen(false);
        onChange(dept.name); // auto-select the freshly created department
      },
    });
  };

  return (
    <>
      <Select
        label={label}
        id={id}
        value={value}
        onChange={handleChange}
        required={required}
        options={options}
      />
      <DepartmentModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          createMutation.reset();
        }}
        onSubmit={handleCreate}
        isLoading={createMutation.isPending}
        error={createMutation.isError ? (createMutation.error as Error) : null}
      />
    </>
  );
}
