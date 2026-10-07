import { focusManager, QueryClient } from "@tanstack/react-query";
import { AppState, Platform } from "react-native";

// One client for the whole app so non-React code (push listeners, the alarm
// engine) can invalidate queries too.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
    mutations: { retry: 0 },
  },
});

// React Query's "refetch on window focus" → refetch when the app returns to the foreground.
focusManager.setEventListener((handleFocus) => {
  if (Platform.OS === "web") return undefined;
  const sub = AppState.addEventListener("change", (state) => handleFocus(state === "active"));
  return () => sub.remove();
});
