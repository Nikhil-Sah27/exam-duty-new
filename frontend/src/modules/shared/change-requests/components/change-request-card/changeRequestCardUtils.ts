import type {
  RsSourceDutyRef,
  RsTargetExamRoomRef,
} from "../../types/changeRequest.types";

export function formatDate(s: string): string {
  return new Date(s).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

export function formatTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${m.toString().padStart(2, "0")} ${period}`;
}

export function rsGroupSummary(
  duties: readonly RsSourceDutyRef[] | undefined,
  rooms: readonly RsTargetExamRoomRef[] | undefined,
  side: "source" | "target",
) {
  const items = side === "source" ? duties ?? [] : rooms ?? [];
  if (items.length === 0) return null;
  const first =
    side === "source"
      ? (items[0] as RsSourceDutyRef).examRoom?.room
      : (items[0] as RsTargetExamRoomRef).room;
  const buildingName = first?.building?.name || "—";
  const roomNumbers =
    side === "source"
      ? (duties ?? []).map((d) => d.examRoom?.room?.roomNumber || d.room)
      : (rooms ?? []).map((er) => er.room?.roomNumber || "");
  const sorted = [...roomNumbers].sort((a, b) => {
    const an = parseInt(a, 10);
    const bn = parseInt(b, 10);
    if (Number.isFinite(an) && Number.isFinite(bn) && an !== bn) return an - bn;
    return a.localeCompare(b);
  });
  const rangeLabel =
    sorted.length === 0
      ? ""
      : sorted.length === 1
        ? `Room ${sorted[0]}`
        : `Rooms ${sorted[0]}–${sorted[sorted.length - 1]}`;
  const schedule =
    side === "source"
      ? (items[0] as RsSourceDutyRef).examSchedule
      : (items[0] as RsTargetExamRoomRef).schedule;
  const depts = new Set<string>();
  if (side === "source") {
    for (const d of duties ?? []) {
      for (const dep of d.examRoom?.departments ?? []) depts.add(dep.toUpperCase());
    }
  } else {
    for (const er of rooms ?? []) {
      for (const dep of er.departments ?? []) depts.add(dep.toUpperCase());
    }
  }
  return {
    buildingName,
    rangeLabel,
    roomNumbers: sorted,
    schedule,
    departments: [...depts].sort(),
  };
}
