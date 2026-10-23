import { useLayoutEffect, useRef } from "react";

const MIN_PX = 9;

/**
 * A note that always stays on one line: if the text is too wide its size is reduced once, in proportion, to fit
 * (down to 9 px). It only looks again when the text or the width changes, never when its own size changes.
 */
export function FitLine({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let lastWidth = -1;
    const fit = () => {
      lastWidth = el.clientWidth;
      el.style.fontSize = "";
      const base = parseFloat(getComputedStyle(el).fontSize);
      if (el.scrollWidth <= el.clientWidth) return;
      const px = Math.max(MIN_PX, Math.floor(base * (el.clientWidth / el.scrollWidth) * 4) / 4);
      el.style.fontSize = `${px}px`;
    };
    fit();
    const ro = new ResizeObserver(() => { if (el.clientWidth !== lastWidth) fit(); });
    ro.observe(el);
    return () => ro.disconnect();
  }, [text]);
  return <p ref={ref} className={className}>{text}</p>;
}
