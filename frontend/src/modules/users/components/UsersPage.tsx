import { useState } from "react";
import { useAuthStore } from "@/shared/store/auth.store";
import TeacherTable from "./TeacherTable";
import CreateUserModal from "./CreateUserModal";
import ImportUsersModal from "./ImportUsersModal";

export default function UsersPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  // Teachers is a CS page (account writes are CS-only on the API too); the
  // check keeps a deep-linked DCS/RS from seeing an import that would 403.
  const isCs = useAuthStore((s) => s.user?.activeRole === "cs");

  return (
    <>
      <TeacherTable
        onCreateClick={() => setModalOpen(true)}
        onImportClick={isCs ? () => setImportOpen(true) : undefined}
      />
      <CreateUserModal open={modalOpen} onClose={() => setModalOpen(false)} />
      {isCs && <ImportUsersModal open={importOpen} onClose={() => setImportOpen(false)} />}
    </>
  );
}
