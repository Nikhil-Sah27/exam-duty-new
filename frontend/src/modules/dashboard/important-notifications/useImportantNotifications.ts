import { useMemo } from "react";
import { useDashboardSummary } from "../hooks/useDashboardSummary";
import { useAllChangeRequests } from "@/modules/shared/change-requests/hooks/useChangeRequests";
import { getImportantDashboardNotifications } from "./importantNotificationSelectors";
import type { ImportantNotification } from "./types";

/**
 * Composes the important dashboard notifications from the SAME data sources the
 * app already uses: the assignment target (via `useDashboardSummary`) and the
 * change-request list from the SHARED change-requests query the CS Change
 * Requests page consumes — so pending requests are read from one cache, not a
 * duplicate. The queue/UI consume the returned, priority-sorted list.
 */
export function useImportantNotifications(): ImportantNotification[] {
  const { assignmentTarget } = useDashboardSummary();
  const { data: changeRequests } = useAllChangeRequests("pending");

  return useMemo(
    () =>
      getImportantDashboardNotifications({
        assignmentTarget,
        changeRequests: changeRequests ?? [],
      }),
    [assignmentTarget, changeRequests],
  );
}
