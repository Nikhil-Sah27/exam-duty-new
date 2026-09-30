import { useCsUnread, useMyUnread } from "../hooks/useMessages";

interface MessagesNavBadgeProps {
  /** "cs" reads the inbox-wide unread count; "teacher" reads this teacher's. */
  variant: "cs" | "teacher";
}

/**
 * The small unread pill shown next to the "Messages" sidebar item. Self-fetches
 * its count so any sidebar can drop it in without threading data through props.
 */
export default function MessagesNavBadge({ variant }: MessagesNavBadgeProps) {
  const cs = useCsUnread(variant === "cs");
  const teacher = useMyUnread(variant === "teacher");
  const count = variant === "cs" ? cs.data ?? 0 : teacher.data ?? 0;

  if (count <= 0) return null;

  return (
    <span className="ml-auto inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-indigo-500 px-1.5 text-[10px] font-bold text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}
