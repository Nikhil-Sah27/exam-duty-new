import { useState, FormEvent } from "react";
import { useCreateUser } from "../hooks";
import { UserRole } from "@/shared/lib/types";
import { Input, Button, Modal, ErrorAlert } from "@/shared/components";
import {
  OTHER_DESIGNATION,
  resolveRolesFromDesignation,
} from "@/shared/utils/roleResolver";
import DesignationRoleFields from "./DesignationRoleFields";
import DepartmentSelect from "@/modules/departments/components/DepartmentSelect";

interface CreateUserModalProps {
  open: boolean;
  onClose: () => void;
}

export default function CreateUserModal({ open, onClose }: CreateUserModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [department, setDepartment] = useState("");
  const [designation, setDesignation] = useState("");
  // Only used when designation === "Other".
  const [otherRole, setOtherRole] = useState<UserRole>("invigilator");

  const createMutation = useCreateUser();

  const resetForm = () => {
    setName("");
    setEmail("");
    setPassword("");
    setPhone("");
    setDepartment("");
    setDesignation("");
    setOtherRole("invigilator");
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    // Derive roles: fixed by designation, or the caller's single pick for "Other".
    const fixed = resolveRolesFromDesignation(designation);
    const roles = designation === OTHER_DESIGNATION ? [otherRole] : fixed;

    if (!roles || roles.length === 0) {
      // Should be blocked by required=true on Designation, but guard anyway.
      return;
    }

    createMutation.mutate(
      {
        name,
        email,
        password,
        phone,
        designation,
        roles,
        department: department || undefined,
      },
      {
        onSuccess: () => {
          resetForm();
          onClose();
        },
      }
    );
  };

  return (
    <Modal open={open} onClose={onClose} title="Add User">
      {createMutation.isError && (
        <ErrorAlert message={createMutation.error.message} />
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Full Name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Dr. Ramesh Kumar"
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ramesh@university.edu"
          />
          <Input
            label="Password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min. 6 characters"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Phone"
            type="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. +91 98765 43210"
          />
          <DepartmentSelect value={department} onChange={setDepartment} />
        </div>

        <DesignationRoleFields
          designation={designation}
          onDesignationChange={setDesignation}
          role={otherRole}
          onRoleChange={setOtherRole}
        />

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={createMutation.isPending}>
            Add User
          </Button>
        </div>
      </form>
    </Modal>
  );
}
