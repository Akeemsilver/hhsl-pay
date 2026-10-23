import { useLayoutEffect, useRef } from "react";

const MIN_PX = 9;

/** A note that always stays on one line: the text is made smaller, a step at a time, until it fits the width (down to 9 px). */
export function FitLine({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      el.style.fontSize = "";
      let px = parseFloat(getComputedStyle(el).fontSize);
      while (el.scrollWidth > el.clientWidth + 0.5 && px > MIN_PX) {
        px -= 0.25;
        el.style.fontSize = `${px}px`;
      }
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text]);
  return <p ref={ref} className={className}>{text}</p>;
}
