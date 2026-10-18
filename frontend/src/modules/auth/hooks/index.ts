import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  loginUser,
  registerUser,
  getMe,
  selectRole,
  forgotPassword,
  resetPassword,
} from "../services";
import { useAuthStore } from "@/shared/store/auth.store";
import { LoginRequest, RegisterRequest } from "../types";
import type { UserRole } from "@/shared/lib/types";
import { homePathForRole } from "@/modules/shared/role-config/roleConfig";

// Land the user on the right home for an active role: superadmin → its console,
// CS → the admin root, DCS/RS/Invigilator → their role-config's defaultPath.
const dashboardPathForRole = (role: UserRole): string => homePathForRole(role);

export const useLogin = () => {
  const setAuth = useAuthStore((s) => s.setAuth);
  const setTempAuth = useAuthStore((s) => s.setTempAuth);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: LoginRequest) => loginUser(data),
    onSuccess: (res) => {
      const { user, token, tempToken, requiresRoleSelection } = res.data;

      // Start the new session from a clean cache. Without this, a profile/duty
      // query cached by a previous account (which stays "fresh" for staleTime)
      // is served to the new login before any refetch — so the dashboard would
      // render the prior user's identity and data. This is the fix for logging
      // in as one account and landing on another's dashboard.
      queryClient.clear();

      if (!requiresRoleSelection && token) {
        // Single-role user — full token issued, straight to dashboard.
        setAuth(user, token);
        navigate(dashboardPathForRole(user.activeRole || user.roles[0]));
        return;
      }

      // Multi-role user — always show the picker.
      setTempAuth(user, tempToken || "");
      navigate("/select-role");
    },
  });
};

export const useSelectRole = () => {
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (role: UserRole) => {
      const res = await selectRole(role);
      return { res, role };
    },
    onSuccess: ({ res, role }) => {
      setAuth(res.data.user, res.data.token);
      // Duty lists and the notification feed are role-scoped server-side, so a
      // switch must drop the previous role's cached data — otherwise the new
      // dashboard briefly shows the old role's duties/messages until refetch.
      queryClient.invalidateQueries();
      navigate(dashboardPathForRole(role));
    },
  });
};

export const useRegister = () => {
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: RegisterRequest) => registerUser(data),
    onSuccess: (res) => {
      const { user, token } = res.data;
      if (token) {
        queryClient.clear(); // clean cache for the new session (see useLogin)
        setAuth(user, token);
        navigate(dashboardPathForRole(user.activeRole || user.roles[0]));
      }
    },
  });
};

/** Request a password-reset OTP by email. */
export const useForgotPassword = () =>
  useMutation({ mutationFn: (email: string) => forgotPassword(email) });

/** Reset the password with the emailed OTP + new password. */
export const useResetPassword = () =>
  useMutation({
    mutationFn: (data: { email: string; otp: string; newPassword: string }) =>
      resetPassword(data),
  });

export const useMe = () => {
  const token = useAuthStore((s) => s.token);

  return useQuery({
    // Keyed by the token so a profile is never read from another session's
    // cache: a new login means a new token means a fresh fetch, independent of
    // staleTime. Second line of defence behind the cache-clear on login/logout.
    queryKey: ["auth", "me", token],
    queryFn: getMe,
    enabled: !!token,
    retry: false,
  });
};
