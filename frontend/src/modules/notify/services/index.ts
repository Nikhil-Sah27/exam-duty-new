import api from "@/shared/lib/api";
import type { SendBroadcastRequest, SendBroadcastResponse } from "../types";

export const sendBroadcast = async (
  payload: SendBroadcastRequest
): Promise<SendBroadcastResponse> => {
  const res = await api.post<SendBroadcastResponse>("/notify", payload);
  return res.data;
};
