import { Suspense } from "react";
import { Navigate, Outlet } from "react-router-dom";
import PageFallback from "@/shared/components/PageFallback";
import AuthGuard from "@/shared/components/AuthGuard";
import MainContent from "@/shared/components/MainContent";
import { useAuthStore } from "@/shared/store/auth.store";
import { getRoleConfig } from "@/modules/shared/role-config/roleConfig";
import InvigilatorHeader from "@/modules/invigilator/components/InvigilatorHeader";
import RSSidebar from "./RSSidebar";

/**
 * RS dashboard shell. Mirrors InvigilatorLayout: same AuthGuard, same shared
 * Header (notifications + user + logout), but uses RSSidebar.
 */
export default function RSLayout() {
  const user = useAuthStore((s) => s.user);

  if (user && user.activeRole !== "rs") {
    const elsewhere = getRoleConfig(user.activeRole);
    return <Navigate to={elsewhere?.defaultPath || "/"} replace />;
  }

  return (
    <AuthGuard>
      <InvigilatorHeader />
      <RSSidebar />
      <MainContent>
        <Suspense fallback={<PageFallback />}><Outlet /></Suspense>
      </MainContent>
    </AuthGuard>
  );
}
