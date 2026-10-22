import { useCallback, useLayoutEffect, useRef, type RefObject, type TouchEvent } from "react";

const MS = 200;
const reduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export interface MonthSlide {
  /** Put on the element that slides. */
  ref: RefObject<HTMLDivElement>;
  /** Put on the element that listens for the finger (it can be the same one). */
  bind: { onTouchStart: (e: TouchEvent) => void; onTouchMove: (e: TouchEvent) => void; onTouchEnd: (e: TouchEvent) => void; onTouchCancel: () => void };
  /** Slide to the next (+1) or previous (-1) month, as if swiped. Used by the arrow buttons. */
  go: (by: -1 | 1) => void;
}

/**
 * Month change by finger or button. The month follows your finger while you drag, then slides away and the new
 * month slides in from the other side. A short or mostly-vertical drag springs back and scrolling is untouched.
 */
export function useMonthSlide(monthKey: string, onShift: (by: -1 | 1) => void): MonthSlide {
  const ref = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const dragging = useRef(false);
  const busy = useRef(false);
  const enterFrom = useRef<number | null>(null);
  const shift = useRef(onShift);
  shift.current = onShift;

  const width = () => ref.current?.parentElement?.clientWidth ?? window.innerWidth;
  const set = (x: number, animate: boolean) => {
    const el = ref.current;
    if (!el) return;
    el.style.transition = animate ? `transform ${MS}ms ease-out, opacity ${MS}ms ease-out` : "none";
    el.style.transform = x === 0 ? "" : `translateX(${x}px)`;
    el.style.opacity = x === 0 ? "" : String(Math.max(0.35, 1 - Math.abs(x) / (width() * 1.2)));
  };

  // The new month appears from the side the finger was heading away from, then slides to rest.
  useLayoutEffect(() => {
    const from = enterFrom.current;
    enterFrom.current = null;
    if (from === null) return;
    const el = ref.current;
    if (!el) { busy.current = false; return; }
    set(from, false);
    void el.offsetWidth;
    set(0, true);
    window.setTimeout(() => { busy.current = false; set(0, false); }, MS);
  }, [monthKey]);

  const go = useCallback((by: -1 | 1) => {
    if (busy.current) return;
    if (reduced() || !ref.current) { shift.current(by); return; }
    busy.current = true;
    const w = width();
    set(-by * w, true);
    window.setTimeout(() => { enterFrom.current = by * w; shift.current(by); }, MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bind = {
    onTouchStart: (e: TouchEvent) => {
      const t = e.touches[0];
      start.current = t && e.touches.length === 1 && !busy.current ? { x: t.clientX, y: t.clientY } : null;
      dragging.current = false;
    },
    onTouchMove: (e: TouchEvent) => {
      const from = start.current; const t = e.touches[0];
      if (!from || !t) return;
      const dx = t.clientX - from.x; const dy = t.clientY - from.y;
      if (!dragging.current) {
        if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.5) dragging.current = true;
        else if (Math.abs(dy) > 12) start.current = null;
      }
      if (dragging.current) set(dx, false);
    },
    onTouchEnd: (e: TouchEvent) => {
      const from = start.current; const t = e.changedTouches[0];
      start.current = null;
      if (!from || !t || !dragging.current) return;
      dragging.current = false;
      const dx = t.clientX - from.x;
      if (Math.abs(dx) < 60) { set(0, true); return; }
      const by: -1 | 1 = dx < 0 ? 1 : -1;
      if (reduced()) { set(0, false); shift.current(by); return; }
      busy.current = true;
      const w = width();
      set(-by * w, true);
      window.setTimeout(() => { enterFrom.current = by * w; shift.current(by); }, MS);
    },
    onTouchCancel: () => { start.current = null; if (dragging.current) { dragging.current = false; set(0, true); } },
  };
  return { ref, bind, go };
}
