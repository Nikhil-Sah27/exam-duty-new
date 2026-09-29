import api from "@/shared/lib/api";
import type { Duty, DutyListResponse } from "@/modules/duties/types";
import {
  filterUpcomingDuties,
  groupUpcomingDuties,
  type DateGroup,
} from "@/modules/shared/duties/utils/upcomingDutyUtils";

/**
 * Read-only service for the Upcoming Duties module. Wraps the existing
 * `/duties?teacher=:id` endpoint and adds an "upcoming + assigned" filter
 * at the API boundary. No new data sources, no duplication.
 */

export const getUpcomingDuties = async (teacherId: string): Promise<Duty[]> => {
  const res = await api.get<DutyListResponse>("/duties", {
    params: { teacher: teacherId, status: "assigned" },
  });
  return filterUpcomingDuties(res.data.data);
};

export const groupUpcomingDutiesByDate = (duties: Duty[]): DateGroup[] =>
  groupUpcomingDuties(duties);
