import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BellRing, CheckCircle2, Loader2 } from "lucide-react";
import api from "@/shared/lib/api";
import { useAuthStore } from "@/shared/store/auth.store";
import { useDutiesByTeacher } from "@/modules/shared/exams/hooks/useSharedExamData";
import { isDutyUpcoming } from "@/modules/shared/duties/utils/dutyTiming";
import { formatTime } from "@/modules/shared/duties/utils/upcomingDutyUtils";
import { formatDate } from "@/shared/lib/utils";
import type { Duty } from "@/modules/duties/types";

const ROLE_LABEL: Record<string, string> = { invigilator: "Invigilator", rs: "RS", dcs: "DCS" };

/**
 * One entry per duty UNIT (schedule + role) — the same unit the backend
 * confirms, reminds and invites for — so a 5-room RS group is one row with one
 * Confirm button, not five.
 */
interface PendingUnit {
  key: string;
  dutyId: string;
  role: string;
  date: string;
  startTime: string;
  endTime: string;
  rooms: string[];
}

const roomLabel = (d: Duty) => {
  const room = d.examRoom?.room;
  return room?.building?.name && room.roomNumber ? `${room.building.name} — ${room.roomNumber}` : d.room;
};

/**
 * "Awaiting your confirmation" on every teacher dashboard (REMINDERS_PLAN.md
 * §B). Duties CS assigned start unconfirmed; confirming here is the same as the
 * one-click button in the email. Renders nothing when there's nothing pending.
 */
export default function PendingConfirmations() {
  const user = useAuthStore((s) => s.user);
  const { data: duties } = useDutiesByTeacher(user?.id);
  const queryClient = useQueryClient();

  const pending = useMemo(() => {
    const units = new Map<string, PendingUnit>();
    for (const d of duties ?? []) {
      if (d.status !== "assigned" || d.confirmedAt || !isDutyUpcoming(d.date, d.endTime)) continue;
      const key = `${d.examSchedule?._id ?? d._id}|${d.role ?? "invigilator"}`;
      const unit = units.get(key);
      if (unit) unit.rooms.push(roomLabel(d));
      else
        units.set(key, {
          key,
          dutyId: d._id,
          role: d.role ?? "invigilator",
          date: d.date,
          startTime: d.startTime,
          endTime: d.endTime,
          rooms: [roomLabel(d)],
        });
    }
    return [...units.values()].sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
  }, [duties]);

  const confirm = useMutation({
    mutationFn: (dutyId: string) => api.post(`/duties/${dutyId}/confirm`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shared"] });
      queryClient.invalidateQueries({ queryKey: ["duties"] });
    },
  });

  if (pending.length === 0) return null;

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <BellRing className="h-4 w-4 text-amber-600" />
        <h2 className="text-sm font-bold text-gray-800">Awaiting your confirmation</h2>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
          {pending.length}
        </span>
      </div>
      <p className="mb-3 text-xs text-gray-600">
        CS assigned these duties to you. Confirm you'll be there — or request a change if you can't make it.
      </p>

      <ul className="space-y-2">
        {pending.map((u) => {
          const busy = confirm.isPending && confirm.variables === u.dutyId;
          return (
            <li
              key={u.key}
              className="flex flex-col gap-2 rounded-xl border border-gray-100 bg-white px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 text-sm">
                <p className="font-semibold text-gray-800">
                  {ROLE_LABEL[u.role] ?? u.role}
                  {u.rooms.length > 1 ? ` · ${u.rooms.length} rooms` : ""} — {formatDate(u.date)}
                </p>
                <p className="truncate text-xs text-gray-500">
                  {formatTime(u.startTime)} – {formatTime(u.endTime)} · {u.rooms.join(", ")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => confirm.mutate(u.dutyId)}
                disabled={confirm.isPending}
                className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                Confirm I'll be there
              </button>
            </li>
          );
        })}
      </ul>

      {confirm.error && <p className="mt-2 text-xs text-red-600">{confirm.error.message}</p>}
    </section>
  );
}
