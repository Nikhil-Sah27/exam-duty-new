const DEPT_COLORS: Record<string, string> = {
  CSE: "bg-blue-100 text-blue-700",
  ECE: "bg-purple-100 text-purple-700",
  ISE: "bg-emerald-100 text-emerald-700",
  ME: "bg-orange-100 text-orange-700",
  MECH: "bg-orange-100 text-orange-700",
  CE: "bg-amber-100 text-amber-700",
  EEE: "bg-rose-100 text-rose-700",
  AIML: "bg-indigo-100 text-indigo-700",
  MBA: "bg-teal-100 text-teal-700",
};

export function deptColor(d: string): string {
  return DEPT_COLORS[d.toUpperCase()] || "bg-gray-100 text-gray-700";
}

export function formatDate(s: string): string {
  return new Date(s).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function formatTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${m.toString().padStart(2, "0")} ${period}`;
}

export interface SummaryRoom {
  examRoomId: string;
  roomNumber: string;
  floor?: number;
  buildingName: string;
}

export interface SummaryBuildingBucket {
  buildingName: string;
  rooms: SummaryRoom[];
}

/**
 * Group a flat rooms array by building so the chip block can show
 * "Academic Block: 103, 401 / Lab Block: 205" rather than a flat list
 * of bare room numbers. Stable order: alphabetical by building name.
 */
export function groupSummaryRoomsByBuilding(
  rooms: readonly SummaryRoom[],
): SummaryBuildingBucket[] {
  const map = new Map<string, SummaryBuildingBucket>();
  for (const r of rooms) {
    const key = r.buildingName || "—";
    const bucket = map.get(key);
    if (bucket) bucket.rooms.push(r);
    else map.set(key, { buildingName: key, rooms: [r] });
  }
  return [...map.values()].sort((a, b) =>
    a.buildingName.localeCompare(b.buildingName),
  );
}
