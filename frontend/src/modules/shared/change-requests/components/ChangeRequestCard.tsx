import { ArrowRight, User } from "lucide-react";
import type { ChangeRequest } from "../types/changeRequest.types";
import ChangeRequestStatusBadge from "./ChangeRequestStatusBadge";
import DutyBlock from "./change-request-card/DutyBlock";
import DcsGroupBlock from "./change-request-card/DcsGroupBlock";
import RsGroupBlock from "./change-request-card/RsGroupBlock";
import { rsGroupSummary } from "./change-request-card/changeRequestCardUtils";

interface ChangeRequestCardProps {
  request: ChangeRequest;
  /** Whether to show admin actions (approve/reject). Controller-only. */
  reviewActions?: React.ReactNode;
  /** Optional invigilator-side cancel button. */
  cancelAction?: React.ReactNode;
}

export default function ChangeRequestCard({
  request,
  reviewActions,
  cancelAction,
}: ChangeRequestCardProps) {
  const r = request;
  const isDcsSwap = r.scope === "dcs_group" || r.type === "dcs_swap";
  const isRsSwap = r.scope === "rs_group" || r.type === "rs_swap";
  const typeLabel = isDcsSwap
    ? "DCS Swap"
    : isRsSwap
      ? "RS Swap"
      : r.type === "move"
        ? "Move"
        : r.type === "swap"
          ? "Swap"
          : "Drop";

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
    <article className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <span className="rounded bg-gray-800 px-2 py-0.5 text-[10px] font-bold text-white">
              {typeLabel.toUpperCase()}
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
        </div>
        <span className="shrink-0 text-[10px] text-gray-400">
          {new Date(r.createdAt).toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
          })}
        </span>
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
            room={r.duty.room}
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
