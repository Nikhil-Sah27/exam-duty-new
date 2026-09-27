export type NotificationType =
  | "duty_assigned"
  | "duty_cancelled"
  | "request_submitted"
  | "request_approved"
  | "request_rejected"
  | "duty_swapped"
  | "duty_reminder"
  | "target_reached"
  | "exam_created"
  | "exam_deleted_duty_release"
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
