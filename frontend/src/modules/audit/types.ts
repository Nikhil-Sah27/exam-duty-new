export type AuditAction =
  // Duties
  | "SELF_ASSIGN_DUTY"
  | "SELF_ASSIGN_DUTY_GROUP"
  | "ADMIN_ASSIGN_DUTY"
  | "ADMIN_ASSIGN_DUTY_GROUP"
  | "CANCEL_DUTY"
  | "ADMIN_UNASSIGN_DUTY"
  | "ADMIN_UNASSIGN_DUTY_GROUP"
  // DCS groups
  | "CLAIM_DCS_GROUP"
  | "ADMIN_CLAIM_DCS_GROUP"
  | "RELEASE_DCS_GROUP"
  // Change requests
  | "SUBMIT_CHANGE_REQUEST"
  | "APPROVE_CHANGE_REQUEST"
  | "REJECT_CHANGE_REQUEST"
  // Exams
  | "CREATE_EXAM"
  | "DELETE_EXAM"
  // Users
  | "CREATE_USER"
  | "UPDATE_USER"
  | "DEACTIVATE_USER"
  | "REACTIVATE_USER"
  // Broadcasts
  | "SEND_BROADCAST";

export interface AuditLogEntry {
  _id: string;
  action: AuditAction | string;
  entity: string;
  entityId: string | null;
  performedBy: { _id: string; name: string; email: string } | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

export interface AuditFilters {
  action?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export interface AuditListResponse {
  success: boolean;
  count: number;
  total: number;
  page: number;
  pages: number;
  data: AuditLogEntry[];
}
