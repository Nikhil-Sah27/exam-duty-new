import { Suspense } from "react";
import { Navigate, Outlet } from "react-router-dom";
import PageFallback from "@/shared/components/PageFallback";
import AuthGuard from "@/shared/components/AuthGuard";
import MainContent from "@/shared/components/MainContent";
import { useAuthStore } from "@/shared/store/auth.store";
import { getRoleConfig } from "@/modules/shared/role-config/roleConfig";
import InvigilatorHeader from "@/modules/invigilator/components/InvigilatorHeader";
import DCSSidebar from "./DCSSidebar";

/**
 * DCS dashboard shell. Mirrors InvigilatorLayout/RSLayout: same AuthGuard,
 * same shared Header (notifications + user + logout), DCSSidebar in place.
 */
export default function DCSLayout() {
  const user = useAuthStore((s) => s.user);

  if (user && user.activeRole !== "dcs") {
    const elsewhere = getRoleConfig(user.activeRole);
    return <Navigate to={elsewhere?.defaultPath || "/"} replace />;
  }

  return (
    <AuthGuard>
      <InvigilatorHeader />
      <DCSSidebar />
      <MainContent>
        <Suspense fallback={<PageFallback />}><Outlet /></Suspense>
      </MainContent>
    </AuthGuard>
  );
}
