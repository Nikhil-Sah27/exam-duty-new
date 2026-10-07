import { useState } from "react";
import { useAuthStore } from "@/shared/store/auth.store";
import TeacherTable from "./TeacherTable";
import CreateUserModal from "./CreateUserModal";
import ImportUsersModal from "./ImportUsersModal";

export default function UsersPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  // The page is open to CS, DCS and RS; bulk import is CS-only (as is the API).
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
