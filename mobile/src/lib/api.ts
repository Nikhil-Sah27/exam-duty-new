import axios from "axios";

import { API_URL } from "@/lib/config";
import { useAuthStore } from "@/store/auth";

// Same contract as the web client (frontend/src/shared/lib/api.ts): attach the
// role token (or the tempToken before a role is picked), collapse every error
// into `new Error(message)`, and log out on 401. Callers read `res.data.data`.
// eslint-disable-next-line import/no-named-as-default-member
const api = axios.create({
  baseURL: API_URL,
  timeout: 20000,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const { token, tempToken } = useAuthStore.getState();
  const auth = token || tempToken;
  if (auth) config.headers.Authorization = `Bearer ${auth}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      void useAuthStore.getState().logout();
    }
    const message =
      error.response?.data?.message ||
      (error.code === "ECONNABORTED" ? "The server took too long to respond" : null) ||
      (error.message === "Network Error" ? "No internet connection" : error.message) ||
      "Something went wrong";
    return Promise.reject(new Error(message));
  },
);

export default api;
