/**
 * Role-agnostic duty filter shape shared by every Select Duty surface
 * (Invigilator, RS, DCS) and the CS assign pages — they all filter by the
 * same four facets, so the filter bar component lives here too.
 */
export interface DutyFilters {
  date: string;
  examType: string;
  department: string;
  semester: string;
}

export const EMPTY_FILTERS: DutyFilters = {
  date: "",
  examType: "",
  department: "",
  semester: "",
};
