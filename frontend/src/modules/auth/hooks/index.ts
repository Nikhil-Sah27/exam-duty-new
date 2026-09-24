import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { loginUser, registerUser, getMe, selectRole } from "../services";
import { useAuthStore } from "@/shared/store/auth.store";
import { LoginRequest, RegisterRequest } from "../types";
import type { UserRole } from "@/shared/lib/types";
import { getRoleConfig } from "@/modules/shared/role-config/roleConfig";

// Land the user on the right dashboard for an active role. CS goes to the
// admin root; DCS/RS/Invigilator go to their role-config's defaultPath.
const dashboardPathForRole = (role: UserRole): string => {
  const cfg = getRoleConfig(role);
  return cfg ? cfg.defaultPath : "/";
};

export const useLogin = () => {
  const setAuth = useAuthStore((s) => s.setAuth);
  const setTempAuth = useAuthStore((s) => s.setTempAuth);
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (data: LoginRequest) => loginUser(data),
    onSuccess: (res) => {
      const { user, token, tempToken, requiresRoleSelection } = res.data;

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

  return useMutation({
    mutationFn: async (role: UserRole) => {
      const res = await selectRole(role);
      return { res, role };
    },
    onSuccess: ({ res, role }) => {
      setAuth(res.data.user, res.data.token);
      navigate(dashboardPathForRole(role));
    },
  });
};

export const useRegister = () => {
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (data: RegisterRequest) => registerUser(data),
    onSuccess: (res) => {
      const { user, token } = res.data;
      if (token) {
        setAuth(user, token);
        navigate(dashboardPathForRole(user.activeRole || user.roles[0]));
      }
    },
  });
};

export const useMe = () => {
  const token = useAuthStore((s) => s.token);

  return useQuery({
    queryKey: ["auth", "me"],
    queryFn: getMe,
    enabled: !!token,
    retry: false,
  });
};
