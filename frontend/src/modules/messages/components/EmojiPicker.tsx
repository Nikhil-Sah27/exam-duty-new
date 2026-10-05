import { useEffect, useRef } from "react";
import { EMOJI_PALETTE } from "../utils/format";
import Twemoji from "./Twemoji";

interface EmojiPickerProps {
  onPick: (emoji: string) => void;
  onClose: () => void;
}

/** A small popover grid of emojis for the composer. Closes on outside click. */
export default function EmojiPicker({ onPick, onClose }: EmojiPickerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    // Defer so the opening click doesn't immediately close it.
    const id = setTimeout(() => document.addEventListener("mousedown", handler), 0);
    return () => {
      clearTimeout(id);
      document.removeEventListener("mousedown", handler);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute bottom-14 left-3 z-20 w-64 rounded-2xl border border-gray-200 bg-white p-2 shadow-xl"
    >
      <div className="grid grid-cols-8 gap-0.5">
        {EMOJI_PALETTE.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => onPick(e)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-lg transition-transform hover:scale-125 hover:bg-gray-100"
          >
            <Twemoji text={e} />
          </button>
        ))}
      </div>
    </div>
  );
}
