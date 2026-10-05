import { useLayoutEffect, useRef } from "react";
import twemoji from "@twemoji/api";

interface TwemojiProps {
  /** Raw text that may contain Unicode emoji. */
  text: string;
  className?: string;
}

/**
 * Renders `text` with any Unicode emoji upgraded to crisp Twemoji SVGs — the
 * same high-quality glyphs on every OS, instead of Windows' flat Segoe UI Emoji.
 *
 * Why it's written this way:
 *  - We set `textContent` (never innerHTML) and let Twemoji swap emoji nodes for
 *    <img>s, so there is no XSS surface and React never manages the mutated
 *    children (the span's JSX children stay empty) — no reconciliation conflict.
 *  - `useLayoutEffect` runs before paint, so there's no flash of un-upgraded text.
 *  - Node-mode `parse` wires Twemoji's built-in `onerror`, which restores the
 *    native glyph if the SVG can't load (offline / CDN blocked).
 */
export default function Twemoji({ text, className }: TwemojiProps) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.textContent = text;
    twemoji.parse(el, { folder: "svg", ext: ".svg" });
  }, [text]);
  return <span ref={ref} className={className} />;
}
