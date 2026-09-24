import { useMutation, useQueryClient } from "@tanstack/react-query";
import { sendBroadcast } from "../services";
import type { SendBroadcastRequest } from "../types";

export const useSendBroadcast = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SendBroadcastRequest) => sendBroadcast(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
    },
  });
};
