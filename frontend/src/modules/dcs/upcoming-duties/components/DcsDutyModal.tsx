import { useQuery } from "@tanstack/react-query";
import {
  X,
  Calendar,
  Clock,
  DoorOpen,
  Users,
  Crown,
  UserRound,
} from "lucide-react";
import type { DcsGroup, DcsRoomContact } from "../../select-duty/types";
import { getDcsGroupContacts } from "../../select-duty/services/dcsDutyService";
import { useExamGroupDetails } from "@/modules/shared/exams/hooks/useSharedExamData";
import CourseSummary from "@/modules/shared/exams/components/CourseSummary";
import ContactActions from "@/shared/components/ContactActions";

function formatLongDate(s: string): string {
  return new Date(s).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${m.toString().padStart(2, "0")} ${period}`;
}

interface DcsDutyModalProps {
  open: boolean;
  group: DcsGroup | null;
  onClose: () => void;
}

/**
 * Detail view for a DCS duty. Spec calls for class-by-class breakdown
 * including the invigilator currently assigned to each room (name + email +
 * contact) — the DCS uses this to reach the team they're supervising.
 *
 * Invigilator data comes from `/api/dcs/groups/:id/invigilators`, which joins
 * Duty + User per room and filters to role=invigilator. The DCS's own
 * supervision is implied (they're viewing their own duty).
 */
export default function DcsDutyModal({ open, group, onClose }: DcsDutyModalProps) {
  const contactsQuery = useQuery({
    queryKey: ["dcs", "contacts", group?._id],
    queryFn: () => getDcsGroupContacts(group!._id),
    enabled: Boolean(open && group),
  });

  // Pull the parent exam group's full details so we can show the per-schedule
  // course (added additively to /api/exam-groups/:id/details). Reuses the
  // existing shared hook + cache key so opening the modal twice doesn't
  // re-fetch.
  const groupId = group?.examGroup?._id ?? null;
  const detailsQuery = useExamGroupDetails(open ? groupId : null);

  if (!open || !group) return null;

  const contactsByRoom = new Map<string, DcsRoomContact>();
  for (const c of contactsQuery.data?.rooms ?? []) {
    contactsByRoom.set(c.examRoomId, c);
  }

  // Resolve the matching schedule from the group's details. All rooms in a
  // DCS group share the same schedule, so the course list applies group-wide.
  const matchingSchedule = detailsQuery.data?.schedules?.find(
    (s) => s._id === group.schedule._id,
  );
  const scheduleCourses = matchingSchedule?.courses;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-6 py-5 text-white">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-1 transition-colors hover:bg-white/20"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-bold tracking-wide backdrop-blur-sm">
              {group.examGroup?.examType}
            </span>
            <span className="rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-semibold backdrop-blur-sm">
              Sem {group.examGroup?.semester}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold backdrop-blur-sm">
              <Crown className="h-2.5 w-2.5" />
              DCS Group {group.groupIndex} of {group.dcsRequired}
            </span>
          </div>
          <h3 className="mt-2 text-lg font-bold">
            Your Supervision Duty
          </h3>
          <p className="mt-0.5 text-xs text-white/80">{formatLongDate(group.schedule.date)}</p>
        </div>

        <div className="max-h-[calc(90vh-7rem)] overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat icon={<Clock />} label="Time" value={`${formatTime(group.schedule.startTime)} – ${formatTime(group.schedule.endTime)}`} />
            <Stat icon={<Calendar />} label="Date" value={new Date(group.schedule.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} />
            <Stat icon={<DoorOpen />} label="Rooms" value={String(group.assignedRooms.length)} />
            <Stat icon={<Users />} label="Students" value={String(group.assignedStudents)} />
          </div>

          {group.assignedDepartments.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              <span className="text-[10px] uppercase tracking-widest text-gray-400 self-center">
                Departments:
              </span>
              {group.assignedDepartments.map((d) => (
                <span
                  key={d}
                  className="rounded bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700"
                >
                  {d}
                </span>
              ))}
            </div>
          )}

          {/* Subject/course block. All rooms in a DCS group share one
              schedule, so the courses apply group-wide. Filtered to the
              departments actually represented in this DCS group. */}
          <div className="mt-4">
            <CourseSummary
              courses={scheduleCourses}
              forDepartments={group.assignedDepartments}
            />
          </div>

          <h4 className="mt-6 text-sm font-bold text-gray-800">
            Classes under your supervision
          </h4>
          <p className="text-[11px] text-gray-500">
            Per-room invigilator contacts are listed below.
          </p>

          <ul className="mt-3 space-y-3">
            {group.assignedRooms.map((examRoom) => {
              const contact = contactsByRoom.get(examRoom._id);
              const invigilators = contact?.invigilators ?? [];
              return (
                <li
                  key={examRoom._id}
                  className="rounded-xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-gray-800">
                        {examRoom.room?.building?.name} —{" "}
                        {examRoom.room?.roomNumber}
                      </p>
                      <p className="text-[10px] text-gray-500">
                        Floor {examRoom.room?.floor} · Cap{" "}
                        {examRoom.room?.capacity} ·{" "}
                        {examRoom.departments.join(", ") || "—"}
                      </p>
                    </div>
                    {invigilators.length > 0 ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                        Invigilator assigned
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                        No invigilator yet
                      </span>
                    )}
                  </div>

                  {contactsQuery.isLoading && (
                    <p className="mt-2 text-[10px] text-gray-400">Loading contacts...</p>
                  )}

                  {!contactsQuery.isLoading && invigilators.length > 0 && (
                    <ul className="mt-2 space-y-2 border-t border-gray-100 pt-2">
                      {invigilators.map((inv) => (
                        <li
                          key={inv._id}
                          className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-2.5"
                        >
                          <div className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-gray-800">
                            <UserRound className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                            {inv.name}
                            {inv.designation && (
                              <span className="rounded bg-indigo-50 px-1.5 py-0 text-[10px] font-semibold text-indigo-700 ring-1 ring-indigo-100">
                                {inv.designation}
                              </span>
                            )}
                            {inv.department && (
                              <span className="rounded bg-white px-1.5 py-0 text-[10px] font-semibold text-gray-600 ring-1 ring-gray-200">
                                {inv.department}
                              </span>
                            )}
                          </div>
                          {/* Call / WhatsApp / email — the DCS must be able to
                              reach the invigilator on the spot. */}
                          <div className="mt-1.5">
                            <ContactActions phone={inv.phone} email={inv.email} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="border-t border-gray-100 bg-gray-50 px-6 py-3">
          <button
            onClick={onClose}
            className="w-full rounded-lg border border-gray-200 bg-white py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-3 py-2">
      <div className="flex items-center gap-1.5 text-gray-400">
        <span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center [&>svg]:h-3.5 [&>svg]:w-3.5">
          {icon}
        </span>
        <p className="text-[10px] font-semibold uppercase tracking-widest">{label}</p>
      </div>
      <p className="mt-0.5 truncate text-sm font-bold text-gray-800">{value}</p>
    </div>
  );
}
