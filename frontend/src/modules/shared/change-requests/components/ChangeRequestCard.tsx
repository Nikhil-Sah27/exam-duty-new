import { ArrowRight, Mail, Phone, User } from "lucide-react";
import type { ChangeRequest } from "../types/changeRequest.types";
import ChangeRequestStatusBadge from "./ChangeRequestStatusBadge";
import DutyBlock from "./change-request-card/DutyBlock";
import DcsGroupBlock from "./change-request-card/DcsGroupBlock";
import RsGroupBlock from "./change-request-card/RsGroupBlock";
import { rsGroupSummary } from "./change-request-card/changeRequestCardUtils";
import { WhatsAppIcon } from "@/shared/components";
import { waLink } from "@/shared/lib/whatsapp";

interface ChangeRequestCardProps {
  request: ChangeRequest;
  /** Whether to show admin actions (approve/reject). Controller-only. */
  reviewActions?: React.ReactNode;
  /** Optional invigilator-side cancel button. */
  cancelAction?: React.ReactNode;
  /** Optional CS-only delete control, shown in the header next to the date. */
  deleteAction?: React.ReactNode;
}

export default function ChangeRequestCard({
  request,
  reviewActions,
  cancelAction,
  deleteAction,
}: ChangeRequestCardProps) {
  const r = request;
  const isDcsSwap = r.scope === "dcs_group" || r.type === "dcs_swap";
  const isRsSwap = r.scope === "rs_group" || r.type === "rs_swap";

  // Lead with the ROLE (duty-scoped requests are always invigilator; RS/DCS use
  // group swaps), then the action — e.g. "INVIGILATOR MOVE", "RS SWAP",
  // "DCS SWAP" — so every card names the role the way the DCS card already does.
  const roleLabel = isDcsSwap ? "DCS" : isRsSwap ? "RS" : "Invigilator";
  const actionLabel =
    isDcsSwap || isRsSwap || r.type === "swap"
      ? "Swap"
      : r.type === "move"
        ? "Move"
        : "Drop";
  const badgeLabel = `${roleLabel} ${actionLabel}`;

  // Chip colour by role (matches the block tints); left edge by review status,
  // so a long list scans at a glance (green approved / red rejected / amber pending).
  const roleChipColor = isDcsSwap
    ? "bg-blue-600"
    : isRsSwap
      ? "bg-indigo-600"
      : "bg-emerald-600";
  const statusBorder =
    r.status === "approved"
      ? "border-l-emerald-400"
      : r.status === "rejected"
        ? "border-l-rose-400"
        : "border-l-amber-400";

  // Current duty room — prefer the populated roomRef (Building — Room) so it
  // matches the "Requested" side; fall back to the legacy room string label.
  const currentRoom = r.duty?.roomRef?.roomNumber
    ? `${r.duty.roomRef.building?.name || "Unknown"} — ${r.duty.roomRef.roomNumber}`
    : r.duty?.room || "—";

  const movingTo =
    r.type === "move" && r.requestedDate && r.requestedStartTime && r.requestedEndTime
      ? {
          date: r.requestedDate,
          startTime: r.requestedStartTime,
          endTime: r.requestedEndTime,
          room: r.requestedExamRoom?.room
            ? `${r.requestedExamRoom.room.building?.name || "Unknown"} — ${r.requestedExamRoom.room.roomNumber}`
            : r.requestedRoom || "—",
          examLabel: r.requestedSchedule?.examGroup
            ? `${r.requestedSchedule.examGroup.examType} · Sem ${r.requestedSchedule.examGroup.semester}`
            : undefined,
        }
      : null;

  return (
    <article
      className={`space-y-3 rounded-2xl border border-l-4 border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md ${statusBorder}`}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <span
              className={`rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wide text-white ${roleChipColor}`}
            >
              {badgeLabel.toUpperCase()}
            </span>
            <ChangeRequestStatusBadge status={r.status} />
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <User className="h-3 w-3 text-gray-400" />
            {r.requestedBy.name}
            {r.requestedBy.department && (
              <span className="text-gray-400">· {r.requestedBy.department}</span>
            )}
          </div>
          {/* Requester contact — lets CS reach the teacher straight from the card. */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            {r.requestedBy.email && (
              <a
                href={`mailto:${r.requestedBy.email}`}
                className="flex items-center gap-1 text-gray-500 transition-colors hover:text-indigo-600"
              >
                <Mail className="h-3 w-3" />
                {r.requestedBy.email}
              </a>
            )}
            {r.requestedBy.phone && (
              <>
                <a
                  href={`tel:${r.requestedBy.phone}`}
                  className="flex items-center gap-1 text-gray-500 transition-colors hover:text-indigo-600"
                >
                  <Phone className="h-3 w-3" />
                  {r.requestedBy.phone}
                </a>
                <a
                  href={waLink(r.requestedBy.phone)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 font-medium text-green-600 transition-colors hover:text-green-700"
                >
                  <WhatsAppIcon className="h-3.5 w-3.5" />
                  WhatsApp
                </a>
              </>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-[10px] text-gray-400">
            {new Date(r.createdAt).toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
            })}
          </span>
          {deleteAction}
        </div>
      </header>

      {isRsSwap ? (
        (() => {
          const src = rsGroupSummary(r.rsSourceDuties, undefined, "source");
          const tgt = rsGroupSummary(undefined, r.rsTargetExamRooms, "target");
          if (!src || !tgt) return null;
          return (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
              <RsGroupBlock label="Current Assignment" summary={src} />
              <div className="hidden items-center justify-center px-1 sm:flex">
                <ArrowRight className="h-4 w-4 text-gray-300" />
              </div>
              <RsGroupBlock label="Requested Assignment" summary={tgt} />
            </div>
          );
        })()
      ) : isDcsSwap && r.dcsSourceGroup && r.dcsTargetGroup ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
          <DcsGroupBlock label="Current Assignment" group={r.dcsSourceGroup} />
          <div className="hidden items-center justify-center px-1 sm:flex">
            <ArrowRight className="h-4 w-4 text-gray-300" />
          </div>
          <DcsGroupBlock label="Requested Assignment" group={r.dcsTargetGroup} />
        </div>
      ) : r.duty ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
          <DutyBlock
            label="Current"
            date={r.duty.date}
            startTime={r.duty.startTime}
            endTime={r.duty.endTime}
            room={currentRoom}
            examLabel={r.duty.exam?.name}
          />
          {movingTo && (
            <>
              <div className="hidden items-center justify-center px-1 sm:flex">
                <ArrowRight className="h-4 w-4 text-gray-300" />
              </div>
              <DutyBlock
                label="Requested"
                date={movingTo.date}
                startTime={movingTo.startTime}
                endTime={movingTo.endTime}
                room={movingTo.room}
                examLabel={movingTo.examLabel}
              />
            </>
          )}
        </div>
      ) : null}

      {r.reason && (
        <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
          <span className="font-semibold text-gray-700">Reason: </span>
          {r.reason}
        </div>
      )}

      {r.reviewNote && (
        <div
          className={`rounded-lg px-3 py-2 text-xs ${
            r.status === "approved"
              ? "bg-green-50 text-green-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          <span className="font-semibold">Review note: </span>
          {r.reviewNote}
        </div>
      )}

      {(reviewActions || cancelAction) && (
        <div className="flex justify-end gap-2 border-t border-gray-100 pt-2">
          {cancelAction}
          {reviewActions}
        </div>
      )}
    </article>
  );
}
