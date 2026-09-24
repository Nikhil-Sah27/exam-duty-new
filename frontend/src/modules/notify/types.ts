import type { UserRole } from "@/shared/lib/types";

export type NotifyAudience = "all" | "role" | "specific";

export interface SendBroadcastRequest {
  audience: NotifyAudience;
  title: string;
  message: string;
  // Present when audience === "role"
  roles?: UserRole[];
  // Present when audience === "specific"
  userIds?: string[];
}

export interface SendBroadcastResponse {
  success: boolean;
  sent: number;
  recipients: string[];
}
