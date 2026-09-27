import {
  useCallback,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";

export interface DraggablePosition {
  x: number;
  y: number;
}

export interface UseDraggableResult<T extends HTMLElement> {
  /** Attach to the element being moved (used to measure size + clamp bounds). */
  ref: RefObject<T | null>;
  /** Current fixed viewport position, or null while in its default layout spot. */
  position: DraggablePosition | null;
  isDragging: boolean;
  /** Spread onto the element that should be draggable (e.g. the whole card). */
  dragHandleProps: {
    onPointerDown: (e: ReactPointerEvent) => void;
    onPointerMove: (e: ReactPointerEvent) => void;
    onPointerUp: (e: ReactPointerEvent) => void;
  };
  /**
   * Put on the draggable's click target via `onClickCapture` — swallows the
   * click that ends a drag so moving the element never triggers its own click
   * action (e.g. the card flip). A plain click (no drag) passes through.
   */
  suppressClickAfterDrag: (e: {
    stopPropagation: () => void;
    preventDefault: () => void;
  }) => void;
}

const DRAG_THRESHOLD = 4;

/**
 * Pointer-based drag positioning for a single floating element, drag-from-
 * anywhere friendly. A press only *arms* a potential drag; the actual drag
 * (and pointer capture) begins only once movement crosses a small threshold —
 * so a plain click still reaches the element's own handlers (the card flip),
 * while a real drag repositions the element and suppresses that click. Starts
 * null (element keeps its normal layout position), switches to fixed viewport
 * coordinates once dragged, and clamps inside the viewport.
 */
export function useDraggable<T extends HTMLElement>(): UseDraggableResult<T> {
  const ref = useRef<T | null>(null);
  const [position, setPosition] = useState<DraggablePosition | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const start = useRef({ px: 0, py: 0, ox: 0, oy: 0 });
  const armedRef = useRef(false);
  const draggingRef = useRef(false);
  const draggedRecently = useRef(false);

  const onPointerDown = useCallback((e: ReactPointerEvent) => {
    if (e.button !== 0) return; // primary button / touch only
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    start.current = {
      px: e.clientX,
      py: e.clientY,
      ox: rect.left,
      oy: rect.top,
    };
    armedRef.current = true;
    // Intentionally no capture / dragging / position yet — a plain click must
    // still flow to the element (so the card can flip).
  }, []);

  const onPointerMove = useCallback((e: ReactPointerEvent) => {
    if (!armedRef.current && !draggingRef.current) return;
    const dx = e.clientX - start.current.px;
    const dy = e.clientY - start.current.py;
    if (!draggingRef.current) {
      if (Math.abs(dx) <= DRAG_THRESHOLD && Math.abs(dy) <= DRAG_THRESHOLD) {
        return; // still just a press, not a drag
      }
      // Movement crossed the threshold → begin the real drag + capture now.
      draggingRef.current = true;
      setIsDragging(true);
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // capture unsupported — the handle still tracks while pointer is over it
      }
    }
    const el = ref.current;
    const w = el?.offsetWidth ?? 0;
    const h = el?.offsetHeight ?? 0;
    const maxX = Math.max(0, window.innerWidth - w);
    const maxY = Math.max(0, window.innerHeight - h);
    const x = Math.min(Math.max(0, start.current.ox + dx), maxX);
    const y = Math.min(Math.max(0, start.current.oy + dy), maxY);
    setPosition({ x, y });
  }, []);

  const onPointerUp = useCallback((e: ReactPointerEvent) => {
    armedRef.current = false;
    if (!draggingRef.current) return; // was a click → leave the flip alone
    draggingRef.current = false;
    setIsDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    // Suppress the click that fires immediately after a drag so it never flips.
    draggedRecently.current = true;
    window.setTimeout(() => {
      draggedRecently.current = false;
    }, 0);
  }, []);

  const suppressClickAfterDrag = useCallback(
    (e: { stopPropagation: () => void; preventDefault: () => void }) => {
      if (draggedRecently.current) {
        e.stopPropagation();
        e.preventDefault();
      }
    },
    [],
  );

  return {
    ref,
    position,
    isDragging,
    dragHandleProps: { onPointerDown, onPointerMove, onPointerUp },
    suppressClickAfterDrag,
  };
}
