import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert } from "react-native";

import { syncAlarms } from "@/alarms";

import { CLAIM_INVALIDATIONS } from "./queries";

export interface ClaimResult<T> {
  item: T;
  ok: boolean;
  error?: string;
}

interface Options<T> {
  /** One API call per item — the web submits sequentially too, so results are per item. */
  claimOne: (item: T) => Promise<unknown>;
  /** Short label for the results summary ("Main Block — Room 201"). */
  labelOf: (item: T) => string;
  /** Called after every run (success or not) so the screen can clear its selection. */
  onDone?: (results: ClaimResult<T>[]) => void;
}

/**
 * Sequential claim submit shared by the three roles. A claim can lose a race —
 * the backend's one-live-duty-per-slot index answers 409 "just taken" — so every
 * run refetches all duty data afterwards, success or not, and reports each
 * failure by name. Successful claims also re-sync the device's duty alarms.
 */
export function useClaimRunner<T>({ claimOne, labelOf, onDone }: Options<T>) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (items: T[]): Promise<ClaimResult<T>[]> => {
      const results: ClaimResult<T>[] = [];
      for (const item of items) {
        try {
          await claimOne(item);
          results.push({ item, ok: true });
        } catch (e) {
          results.push({ item, ok: false, error: e instanceof Error ? e.message : String(e) });
        }
      }
      return results;
    },
    onSuccess: async (results) => {
      const okCount = results.filter((r) => r.ok).length;
      const failed = results.filter((r) => !r.ok);

      if (okCount > 0) {
        // Alarms are best-effort here — a sync failure must not read as a failed claim.
        syncAlarms().catch(() => {});
      }

      if (failed.length === 0) {
        Alert.alert(
          okCount === 1 ? "Duty claimed" : `${okCount} duties claimed`,
          "It's on your Home screen and your duty alarms are set.",
        );
      } else {
        const lines = failed.map((r) => `• ${labelOf(r.item)}: ${r.error}`).join("\n");
        Alert.alert(
          okCount > 0 ? `Claimed ${okCount} of ${results.length}` : "Couldn't claim",
          `${lines}\n\nThe list has been refreshed.`,
        );
      }
      onDone?.(results);
    },
    onError: (e) => {
      Alert.alert("Couldn't claim", e instanceof Error ? e.message : String(e));
    },
    onSettled: () => {
      for (const key of CLAIM_INVALIDATIONS) {
        void queryClient.invalidateQueries({ queryKey: [...key] });
      }
    },
  });

  return { run: mutation.mutate, isPending: mutation.isPending };
}
