import { Navigate } from "react-router-dom";
import { useAuthStore } from "@/shared/store/auth.store";
import { homePathForRole } from "@/modules/shared/role-config/roleConfig";
import HomePage from "../pages/HomePage";

/**
 * Root route gate. Signed-in users are sent straight to their dashboard (CS →
 * /dashboard, operational roles → their role dashboard); everyone else sees the
 * public Proctavo landing page.
 */
export default function HomeGate() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);

  if (token && user?.activeRole) {
    return <Navigate to={homePathForRole(user.activeRole)} replace />;
  }

  return <HomePage />;
}
