export type NotificationType =
  | "duty_assigned"
  | "duty_group_assigned"
  | "duty_self_claimed"
  | "duty_cancelled"
  | "duty_group_cancelled"
  | "request_submitted"
  | "request_approved"
  | "request_rejected"
  | "duty_swapped"
  | "duty_reminder"
  | "target_reached"
  | "exam_created"
  | "exam_updated"
  | "exam_deleted_duty_release"
  // CS-facing awareness alerts — a teacher took or gave back work themselves.
  | "duty_claimed_by_teacher"
  | "duty_released_by_teacher"
  | "group_released"
  | "announcement";

export interface Notification {
  _id: string;
  recipient: string;
  type: NotificationType;
  title: string;
  message: string;
  refModel: "Duty" | "ChangeRequest" | null;
  refId: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationListResponse {
  success: boolean;
  count: number;
  data: Notification[];
}

export interface UnreadCountResponse {
  success: boolean;
  data: { count: number };
}
