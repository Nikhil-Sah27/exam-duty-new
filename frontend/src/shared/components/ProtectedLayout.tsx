import { Suspense } from "react";
import { Navigate, Outlet } from "react-router-dom";
import PageFallback from "@/shared/components/PageFallback";
import AuthGuard from "./AuthGuard";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import MainContent from "./MainContent";
import { useAuthStore } from "@/shared/store/auth.store";
import { getRoleConfig } from "@/modules/shared/role-config/roleConfig";

/**
 * Admin / Controller shell. Operational roles (invigilator, rs) get
 * redirected to their own dashboards before they can render any admin UI.
 */
export default function ProtectedLayout() {
  const user = useAuthStore((s) => s.user);
  const operationalConfig = getRoleConfig(user?.activeRole || undefined);

  if (operationalConfig) {
    return <Navigate to={operationalConfig.defaultPath} replace />;
  }

  return (
    <AuthGuard>
      <Navbar />
      <Sidebar />
      <MainContent>
        <Suspense fallback={<PageFallback />}><Outlet /></Suspense>
      </MainContent>
    </AuthGuard>
  );
}
