import { QueryClient } from "@tanstack/react-query";

/**
 * The single app-wide React Query client, created as a module singleton rather
 * than inside a component. Non-React code — the axios 401 interceptor and the
 * auth store's `logout` — imports it to `clear()` the cache on every session
 * boundary, so one account's cached data can never bleed into the next session.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: 1,
    },
  },
});
