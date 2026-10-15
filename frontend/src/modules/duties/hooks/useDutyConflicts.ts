import { useCallback, useMemo } from "react";
import type { Duty } from "../types";
import {
  dutyConflictService,
  type ConflictAnalysis,
  type ConflictWindow,
} from "../services/dutyConflictService";

/**
 * Reusable conflict layer for every Select Duty hook
 * (`useDutySelection`, `useRSDutyAvailability`, `useDcsDutySelection`). Encapsulates the
 * `selected[] + myDuties[]` → "is this candidate blocked?" computation so:
 *
 *  - each role uses **the same** conflict definition (single source of truth)
 *  - hidden-count + banner copy come from one helper, not duplicated per page
 *  - card components receive a precomputed `ConflictAnalysis` and never run
 *    the engine inline
 */
export interface UseDutyConflictsArgs {
  selected: readonly ConflictWindow[];
  myDuties: readonly Duty[];
}

export interface UseDutyConflictsResult {
  /** Predicate — fastest path, no string allocation. */
  isConflict: (candidate: ConflictWindow) => boolean;
  /** Full analysis — used when a card needs reason/tooltip. */
  analyze: (candidate: ConflictWindow) => ConflictAnalysis;
  /**
   * Count and copy for the top banner. `hiddenCount` is the number of
   * candidates in `pool` that would be hidden/disabled because they
   * conflict; `banner` is the friendly message to surface above the grid.
   */
  summarize: (pool: readonly ConflictWindow[]) => {
    hiddenCount: number;
    banner: string | null;
  };
}

const FRIENDLY_BANNER = (count: number): string =>
  count === 1
    ? "1 duty is hidden because it overlaps with your current selection."
    : `${count} duties are hidden because they overlap with your current selection.`;

const EMPTY_SELECTED: readonly ConflictWindow[] = [];
const EMPTY_DUTIES: readonly Duty[] = [];

/** Start-of-day timestamp — the bucket key, matching the engine's `sameDay`. */
const dayKey = (date: string | Date): number => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

export function useDutyConflicts({
  selected,
  myDuties,
}: UseDutyConflictsArgs): UseDutyConflictsResult {
  // Index blockers by calendar day once per change. A candidate can only clash
  // with blockers that share its day, so feeding the engine the same-day slice
  // turns the per-grid cost from O(slots × blockers) into
  // O(slots × same-day-blockers) — the same primitives, just pre-narrowed.
  // Insertion order is preserved within each bucket, so the engine's
  // selected-first ordering (and the reason string it derives) is unchanged.
  const byDay = useMemo(() => {
    const sel = new Map<number, ConflictWindow[]>();
    for (const s of selected) {
      const k = dayKey(s.date);
      let arr = sel.get(k);
      if (!arr) sel.set(k, (arr = []));
      arr.push(s);
    }
    const dut = new Map<number, Duty[]>();
    for (const d of myDuties) {
      if (d.status !== "assigned") continue;
      const k = dayKey(d.date);
      let arr = dut.get(k);
      if (!arr) dut.set(k, (arr = []));
      arr.push(d);
    }
    return { sel, dut };
  }, [selected, myDuties]);

  const blockersFor = useCallback(
    (candidate: ConflictWindow) => {
      const k = dayKey(candidate.date);
      return {
        selected: byDay.sel.get(k) ?? EMPTY_SELECTED,
        myDuties: byDay.dut.get(k) ?? EMPTY_DUTIES,
      };
    },
    [byDay],
  );

  const isConflict = useCallback(
    (candidate: ConflictWindow) =>
      dutyConflictService.isTimeConflict(candidate, blockersFor(candidate)),
    [blockersFor],
  );

  const analyze = useCallback(
    (candidate: ConflictWindow) =>
      dutyConflictService.analyze(candidate, blockersFor(candidate)),
    [blockersFor],
  );

  const summarize = useCallback(
    (pool: readonly ConflictWindow[]) => {
      let hiddenCount = 0;
      for (const c of pool) {
        if (dutyConflictService.isTimeConflict(c, blockersFor(c))) hiddenCount += 1;
      }
      return {
        hiddenCount,
        banner: hiddenCount > 0 ? FRIENDLY_BANNER(hiddenCount) : null,
      };
    },
    [blockersFor],
  );

  return { isConflict, analyze, summarize };
}
