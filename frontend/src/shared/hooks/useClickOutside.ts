import { useEffect, type RefObject } from "react";

/**
 * Call `handler` when a pointer press lands outside `ref`, or when Escape is
 * pressed. Used by custom popovers/dropdowns to close on outside interaction.
 * Pass `enabled` (e.g. the open state) so listeners are only attached while the
 * surface is actually open.
 */
export function useClickOutside<T extends HTMLElement>(
  ref: RefObject<T | null>,
  handler: () => void,
  enabled = true,
): void {
  useEffect(() => {
    if (!enabled) return;

    const onPointerDown = (e: PointerEvent) => {
      const el = ref.current;
      if (el && !el.contains(e.target as Node)) handler();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handler();
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [ref, handler, enabled]);
}
