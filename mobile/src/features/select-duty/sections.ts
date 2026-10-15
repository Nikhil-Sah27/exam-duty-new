import { formatDate, formatTimeRange } from "./format";

export interface TimeSection<T> {
  key: string;
  title: string;
  subtitle: string;
  data: T[];
}

/**
 * Date + time-window sections ("Tue, 14 Oct" / "9:30 AM – 12:30 PM"), sorted
 * date → start → end like sectionizeRSGroupsByDateTime on the web. Item order
 * inside a section is preserved.
 */
export function sectionizeByWindow<T>(
  items: readonly T[],
  windowOf: (item: T) => { date: string; startTime: string; endTime: string },
): TimeSection<T>[] {
  const buckets = new Map<string, { date: string; startTime: string; endTime: string; data: T[] }>();
  for (const item of items) {
    const w = windowOf(item);
    const key = `${w.date}|${w.startTime}|${w.endTime}`;
    const b = buckets.get(key);
    if (b) b.data.push(item);
    else buckets.set(key, { ...w, data: [item] });
  }
  return [...buckets.entries()]
    .sort(([, a], [, b]) => {
      const da = new Date(a.date).getTime();
      const db = new Date(b.date).getTime();
      if (da !== db) return da - db;
      if (a.startTime !== b.startTime) return a.startTime < b.startTime ? -1 : 1;
      return a.endTime < b.endTime ? -1 : a.endTime > b.endTime ? 1 : 0;
    })
    .map(([key, b]) => ({
      key,
      title: formatDate(b.date),
      subtitle: formatTimeRange(b.startTime, b.endTime),
      data: b.data,
    }));
}
