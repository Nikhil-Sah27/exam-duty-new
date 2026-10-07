import { useCallback, useMemo, useState } from "react";

/** Pending (not yet claimed) selection for a Select Duty screen, keyed by a stable id. */
export function useSelectionSet<T>(idOf: (item: T) => string) {
  const [selected, setSelected] = useState<T[]>([]);
  const ids = useMemo(() => new Set(selected.map(idOf)), [selected, idOf]);

  const add = useCallback((item: T) => setSelected((prev) => [...prev, item]), []);
  const remove = useCallback(
    (id: string) => setSelected((prev) => prev.filter((s) => idOf(s) !== id)),
    [idOf],
  );
  const clear = useCallback(() => setSelected([]), []);

  return { selected, ids, add, remove, clear };
}
