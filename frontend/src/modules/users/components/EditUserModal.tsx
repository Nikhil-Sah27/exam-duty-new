import { useState, useEffect, FormEvent } from "react";
import { useUpdateUser } from "../hooks";
import { UserProfile } from "../types";
import { Input, Button, Modal, ErrorAlert } from "@/shared/components";
import { UserRole } from "@/shared/lib/types";
import {
  OTHER_DESIGNATION,
  resolveRolesFromDesignation,
} from "@/shared/utils/roleResolver";
import DesignationRoleFields from "./DesignationRoleFields";
import DepartmentSelect from "@/modules/departments/components/DepartmentSelect";

interface EditUserModalProps {
  open: boolean;
  onClose: () => void;
  user: UserProfile | null;
}

export default function EditUserModal({ open, onClose, user }: EditUserModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [department, setDepartment] = useState("");
  const [designation, setDesignation] = useState("");
  const [otherRole, setOtherRole] = useState<UserRole>("invigilator");

  const updateMutation = useUpdateUser();

  useEffect(() => {
    if (user && open) {
      setName(user.name);
      setEmail(user.email);
      setPhone(user.phone ?? "");
      setDepartment(user.department ?? "");
      setDesignation(user.designation ?? "");
      // Seed the "Other" single-role picker from the user's current roles
      // (first entry is a fine default; only used when designation is "Other").
      setOtherRole((user.roles?.[0] as UserRole) || "invigilator");
      updateMutation.reset();
    }
  }, [user, open]);

  if (!user) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    const fixed = resolveRolesFromDesignation(designation);
    const roles = designation === OTHER_DESIGNATION ? [otherRole] : fixed;

    updateMutation.mutate(
      {
        id: user._id,
        data: {
          name,
          email,
          phone,
          department: department || undefined,
          designation: designation || undefined,
          roles: roles || undefined,
        },
      },
      {
        onSuccess: () => onClose(),
      }
    );
  };

  return (
    <Modal open={open} onClose={onClose} title="Edit User">
      {updateMutation.isError && (
        <ErrorAlert message={updateMutation.error.message} />
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Full Name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <Input
          label="Email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

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
          <Button type="submit" isLoading={updateMutation.isPending}>
            Save Changes
          </Button>
        </div>
      </form>
    </Modal>
  );
}
