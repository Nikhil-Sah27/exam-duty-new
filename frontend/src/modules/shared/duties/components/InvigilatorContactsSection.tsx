import { UserRound, DoorOpen } from "lucide-react";
import ContactActions from "@/shared/components/ContactActions";
import { useInvigilatorContacts } from "../hooks/useInvigilatorContacts";
import type {
  InvigilatorContact,
  RoomWithInvigilators,
} from "../services/invigilatorContactsService";

interface InvigilatorContactsSectionProps {
  /** ExamRoom._ids to look up. Sorted internally for stable cache keys. */
  examRoomIds: readonly string[];
  /**
   * Optional pre-fetched data. When supplied, the built-in fetch is skipped —
   * lets the DCS modal keep using its group-scoped endpoint while still
   * reusing this component's rendering.
   */
  rooms?: readonly RoomWithInvigilators[];
  /** Optional flag to render a smaller heading. */
  compact?: boolean;
  /** Section heading override. */
  title?: string;
  /** Sub-text under the heading. */
  subtitle?: string;
}

/**
 * Presentational block: one card per room, listing every invigilator assigned
 * with name + department + clickable email + clickable phone. Handles loading,
 * error, and empty states so callers just drop it into a modal.
 *
 * Kept role-agnostic: both RS and DCS dashboards render the same layout.
 */
export default function InvigilatorContactsSection({
  examRoomIds,
  rooms: providedRooms,
  compact = false,
  title = "Invigilators under your supervision",
  subtitle = "Contact details for the invigilators assigned to each room.",
}: InvigilatorContactsSectionProps) {
  const shouldFetch = !providedRooms;
  const query = useInvigilatorContacts(
    shouldFetch ? examRoomIds : null,
    shouldFetch,
  );

  const rooms: readonly RoomWithInvigilators[] =
    providedRooms ?? query.data ?? [];
  const isLoading = shouldFetch && query.isLoading;
  const isError = shouldFetch && query.isError;

  return (
    <div>
      <h4
        className={`font-bold text-gray-800 ${compact ? "text-xs" : "text-sm"}`}
      >
        {title}
      </h4>
      {subtitle && (
        <p className="text-[11px] text-gray-500">{subtitle}</p>
      )}

      {isLoading && (
        <p className="mt-3 text-xs text-gray-400">
          Loading invigilator contacts...
        </p>
      )}

      {isError && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          Failed to load invigilator contacts. Try reopening this view.
        </div>
      )}

      {!isLoading && !isError && rooms.length === 0 && (
        <p className="mt-3 text-xs text-gray-400">
          No rooms found for this group.
        </p>
      )}

      {!isLoading && !isError && rooms.length > 0 && (
        <ul className="mt-3 space-y-3">
          {rooms.map((r) => (
            <RoomContactCard key={r.examRoomId} room={r} />
          ))}
        </ul>
      )}
    </div>
  );
}

function RoomContactCard({ room }: { room: RoomWithInvigilators }) {
  const { invigilators } = room;
  return (
    <li className="rounded-xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 font-semibold text-gray-800">
            <DoorOpen className="h-3.5 w-3.5 text-gray-400" />
            {room.room?.building?.name ?? "—"} — {room.room?.roomNumber ?? "—"}
          </p>
          <p className="mt-0.5 text-[10px] text-gray-500">
            {room.room?.floor !== undefined && `Floor ${room.room.floor}`}
            {room.room?.floor !== undefined &&
              room.room?.capacity !== undefined &&
              " · "}
            {room.room?.capacity !== undefined && `Cap ${room.room.capacity}`}
            {room.departments.length > 0 &&
              ` · ${room.departments.join(", ")}`}
          </p>
        </div>
        {invigilators.length > 0 ? (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
            {invigilators.length} invigilator
            {invigilators.length === 1 ? "" : "s"}
          </span>
        ) : (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
            No invigilator yet
          </span>
        )}
      </div>

      {invigilators.length > 0 && (
        <ul className="mt-2 space-y-1.5 border-t border-gray-100 pt-2">
          {invigilators.map((inv) => (
            <ContactLine key={inv._id} inv={inv} />
          ))}
        </ul>
      )}
    </li>
  );
}

function ContactLine({ inv }: { inv: InvigilatorContact }) {
  return (
    <li className="text-xs">
      <div className="flex items-center gap-1.5 font-semibold text-gray-800">
        <UserRound className="h-3 w-3 text-gray-400" />
        {inv.name}
        {inv.department && (
          <span className="rounded bg-gray-100 px-1 py-0 text-[10px] font-semibold text-gray-600">
            {inv.department}
          </span>
        )}
      </div>
      <div className="ml-4 mt-1">
        <ContactActions phone={inv.phone} email={inv.email} />
      </div>
    </li>
  );
}
