/**
 * Background wiring for a signed-in CS: register this phone for pushes (a
 * teacher's message buzzes it) and the shared push listeners. No duty alarms —
 * CS holds no duties. Renders nothing.
 */
import { useEffect } from "react";

import { afterSignedIn } from "@/features/auth/session";
import { usePushListeners } from "@/runtime/usePushListeners";
import { useAuthStore } from "@/store/auth";

export function CsRuntime() {
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    if (token) void afterSignedIn();
  }, [token]);

  usePushListeners();
  return null;
}
