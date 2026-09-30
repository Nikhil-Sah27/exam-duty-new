import api from "@/shared/lib/api";
import {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  SelectRoleResponse,
  User,
} from "../types";
import type { UserRole } from "@/shared/lib/types";

export const loginUser = async (data: LoginRequest): Promise<AuthResponse> => {
  const res = await api.post<AuthResponse>("/auth/login", data);
  return res.data;
};

export const registerUser = async (
  data: RegisterRequest
): Promise<AuthResponse> => {
  const res = await api.post<AuthResponse>("/auth/register", data);
  return res.data;
};

export const selectRole = async (
  role: UserRole
): Promise<SelectRoleResponse> => {
  const res = await api.post<SelectRoleResponse>("/auth/select-role", { role });
  return res.data;
};

export const getMe = async (): Promise<User> => {
  const res = await api.get<{ success: boolean; data: User }>("/auth/me");
  return res.data.data;
};

interface MessageResponse {
  success: boolean;
  message: string;
}

/** Request a password-reset OTP be emailed to the account. */
export const forgotPassword = async (
  email: string,
): Promise<MessageResponse> => {
  const res = await api.post<MessageResponse>("/auth/forgot-password", {
    email,
  });
  return res.data;
};

/** Complete a password reset with the emailed OTP + a new password. */
export const resetPassword = async (data: {
  email: string;
  otp: string;
  newPassword: string;
}): Promise<MessageResponse> => {
  const res = await api.post<MessageResponse>("/auth/reset-password", data);
  return res.data;
};
