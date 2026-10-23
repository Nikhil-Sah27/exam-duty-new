import { useEffect, useRef, useState, type RefObject } from "react";
import { Keyboard, LayoutAnimation, Platform, View, type KeyboardEvent } from "react-native";

type Frame = { bottom: number } | null;

const overlap = (frame: Frame, keyboardTop: number | null) =>
  keyboardTop == null || !frame ? 0 : Math.max(0, Math.round(frame.bottom - keyboardTop));

/** Measure `view` in window coordinates, store its bottom edge and recompute the inset. */
function measure(
  view: RefObject<View | null>,
  frame: { current: Frame },
  keyboardTop: { current: number | null },
  set: (n: number) => void,
) {
  view.current?.measureInWindow((_x, y, _w, h) => {
    frame.current = { bottom: y + h };
    set(overlap(frame.current, keyboardTop.current));
  });
}

/**
 * How far the keyboard overlaps a full-height container, in window coordinates.
 *
 * Why not KeyboardAvoidingView: it measures its frame relative to its parent, so
 * under a native-stack header it under-pads by the header height unless given a
 * hand-tuned `keyboardVerticalOffset`. Android is edge-to-edge here (the window no
 * longer resizes for the keyboard), so we measure the container in the window and
 * compare it with the keyboard's top edge (`screenY`). If a device does resize the
 * window, the container's bottom moves up, `onLayout` re-measures and the inset
 * drops back to 0, so it never double-pads.
 *
 * Attach `ref` + `onLayout` to the screen's root view and pad its bottom by `inset`
 * (padding doesn't change the view's own frame, so this can't feed back on itself).
 */
export function useKeyboardInset() {
  const ref = useRef<View>(null);
  const frame = useRef<Frame>(null);
  const keyboardTop = useRef<number | null>(null);
  const [inset, setInset] = useState(0);

  const onLayout = () => measure(ref, frame, keyboardTop, setInset);

  useEffect(() => {
    const ios = Platform.OS === "ios";
    const animate = (e: KeyboardEvent) => {
      if (ios && e.duration) {
        const duration = Math.max(e.duration, 10);
        LayoutAnimation.configureNext({ duration, update: { duration, type: LayoutAnimation.Types.keyboard } });
      }
    };
    const show = Keyboard.addListener(ios ? "keyboardWillShow" : "keyboardDidShow", (e) => {
      keyboardTop.current = e.endCoordinates.screenY;
      animate(e);
      setInset(overlap(frame.current, keyboardTop.current));
      // The first layout can be caught mid screen-transition; confirm with a fresh measure.
      measure(ref, frame, keyboardTop, setInset);
    });
    const hide = Keyboard.addListener(ios ? "keyboardWillHide" : "keyboardDidHide", (e) => {
      keyboardTop.current = null;
      animate(e);
      setInset(0);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return { ref, onLayout, inset, keyboardOpen: inset > 0 };
}
