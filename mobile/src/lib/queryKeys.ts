// Query keys shared across features. Anything that changes a teacher's duties
// (claims, confirms, cancels) should invalidate `myUnits` and call `syncAlarms()`.
export const queryKeys = {
  myUnits: ["my-units"] as const,
  notifications: ["notifications"] as const,
  unreadCount: ["notifications", "unread-count"] as const,
  me: ["auth", "me"] as const,
  // Under the "duty-calculation" root next to the progress counts, so whatever
  // refreshes the "Completed" number refreshes its list too.
  myCompleted: (role: string | null) => ["duty-calculation", "my-completed", role] as const,
};
