import { Navigate, Outlet } from "react-router-dom";
import AuthGuard from "@/shared/components/AuthGuard";
import MainContent from "@/shared/components/MainContent";
import { useAuthStore } from "@/shared/store/auth.store";
import { getRoleConfig } from "@/modules/shared/role-config/roleConfig";
import InvigilatorHeader from "./InvigilatorHeader";
import InvigilatorSidebar from "./InvigilatorSidebar";

export default function InvigilatorLayout() {
  const user = useAuthStore((s) => s.user);

  if (user && user.activeRole !== "invigilator") {
    // Send RS users to their own dashboard, admin roles back to root.
    const elsewhere = getRoleConfig(user.activeRole);
    return <Navigate to={elsewhere?.defaultPath || "/"} replace />;
  }

  return (
    <AuthGuard>
      <InvigilatorHeader />
      <InvigilatorSidebar />
      <MainContent>
        <Outlet />
      </MainContent>
    </AuthGuard>
  );
}
