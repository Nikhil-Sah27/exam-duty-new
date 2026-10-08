import { Suspense } from "react";
import { Navigate, Outlet, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import AuthGuard from "@/shared/components/AuthGuard";
import PageFallback from "@/shared/components/PageFallback";
import DarkModeToggle from "@/shared/components/DarkModeToggle";
import Logo from "@/shared/components/Logo";
import { useAuthStore } from "@/shared/store/auth.store";
import { homePathForRole } from "@/modules/shared/role-config/roleConfig";

/**
 * Superadmin shell (MULTI_COLLEGE_PLAN.md §3.3). No sidebar: the console is
 * colleges and nothing else — it never shows a college's teachers or exams.
 */
export default function PlatformLayout() {
  return (
    <AuthGuard>
      <PlatformShell />
    </AuthGuard>
  );
}

function PlatformShell() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  // Wait for /auth/me before rendering pages, so nobody else's session ever
  // fires a console request on the way to its own home.
  if (!user) return <PageFallback />;
  if (user.activeRole !== "superadmin") {
    return <Navigate to={homePathForRole(user.activeRole)} replace />;
  }

  const signOut = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <>
      <header className="fixed left-0 top-0 z-40 flex h-16 w-full items-center justify-between bg-gray-800 px-4 text-white shadow-md sm:px-6">
        <div className="flex items-center gap-3">
          <Logo size={30} showWordmark className="text-white" wordmarkClassName="text-lg font-bold tracking-tight text-white" />
          <span className="hidden rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide sm:inline">
            Superadmin
          </span>
        </div>
        <div className="flex items-center gap-3">
          <DarkModeToggle />
          <span className="hidden text-sm text-gray-300 md:inline">{user?.name}</span>
          <button
            onClick={signOut}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-gray-200 hover:bg-gray-700"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-24 sm:px-6">
        <Suspense fallback={<PageFallback />}>
          <Outlet />
        </Suspense>
      </main>
    </>
  );
}
