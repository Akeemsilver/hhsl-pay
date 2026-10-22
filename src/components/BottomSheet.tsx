import { useEffect, useRef, type ReactNode } from "react";
import { useLayer } from "./layers";

const DISMISS_DISTANCE = 110;

/**
 * A bottom sheet that closes when you tap outside it, press Escape or the phone's Back button (the owner wires Back),
 * or pull it down by its handle or title bar. The content below scrolls freely and never pulls the sheet.
 * The owner decides what "close" means, for example asking to discard unsaved changes.
 */
export function BottomSheet({ label, onRequestClose, onPullDismiss, top, fromTop, children }: {
  label: string; onRequestClose: () => void; /** What pulling the sheet down does; closing straight away by default is the same as onRequestClose. */ onPullDismiss?: () => void; top?: boolean; /** Dock the sheet to the top of the screen (for search boxes, so the keyboard never covers it). It cannot be pulled down. */ fromTop?: boolean; children: ReactNode;
}) {
  const sheet = useRef<HTMLDivElement>(null);
  const close = useRef(onRequestClose);
  close.current = onRequestClose;
  const pull = useRef(onPullDismiss);
  pull.current = onPullDismiss;
  useLayer(() => close.current());

  useEffect(() => {
    const el = sheet.current;
    if (!el || fromTop) return;
    const backdrop = el.parentElement;
    const HANDLE = ".grabber, .bar, .time-head, .sheet-head";
    let startY = 0, dy = 0, tracking = false, dragging = false, pointerId = -1, lastY = 0, lastT = 0, speed = 0;
    let settling = false;

    // The sheet follows the finger one-to-one. Nothing is decided until the finger lifts.
    const move = (to: number) => {
      dy = Math.max(0, to);
      el.style.transition = "none";
      el.style.transform = `translateY(${dy}px)`;
      if (backdrop) backdrop.style.background = `rgba(0, 0, 0, ${0.45 * (1 - Math.min(1, dy / Math.max(1, el.offsetHeight)))})`;
    };
    const track = (y: number) => {
      const now = performance.now();
      if (now > lastT) speed = (y - lastY) / (now - lastT);
      lastY = y; lastT = now;
    };
    const springBack = () => {
      el.style.transition = "";
      el.style.transform = "";
      if (backdrop) backdrop.style.background = "";
      tracking = dragging = false; dy = 0;
    };
    // Lifting the finger: far enough (or flicked down) closes with a slide down, otherwise it settles back.
    const release = () => {
      const far = dy > DISMISS_DISTANCE || (speed > 0.6 && dy > 30);
      tracking = dragging = false;
      if (!far) { springBack(); return; }
      settling = true;
      // Carry on at the speed of the finger: a hard flick leaves quickly, a slow pull glides out, never a jump.
      const rest = Math.max(el.offsetHeight, window.innerHeight) - dy;
      const ms = Math.round(Math.min(360, Math.max(160, rest / Math.max(speed, 0.8))));
      el.style.transition = `transform ${ms}ms cubic-bezier(0.4, 0, 0.2, 1)`;
      el.style.transform = `translateY(${dy + rest}px)`;
      if (backdrop) { backdrop.style.transition = `background ${ms}ms linear`; backdrop.style.background = "rgba(0, 0, 0, 0)"; }
      window.setTimeout(() => { (pull.current ?? close.current)(); }, ms);
    };

    // Only the handle and the title bar pull the sheet (touch-action none there, so the browser never takes the gesture).
    // A sheet opened inside another one (the site search, the time picker) must not pull the sheet behind it.
    const mine = (e: Event) => (e.target as Element | null)?.closest(".sheet") === el;
    const onDown = (e: PointerEvent) => {
      if (settling || !mine(e) || !(e.target as Element).closest(HANDLE)) return;
      startY = e.clientY; lastY = startY; lastT = performance.now(); speed = 0;
      tracking = true; dragging = false; pointerId = e.pointerId;
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!tracking || e.pointerId !== pointerId) return;
      const d = e.clientY - startY;
      if (!dragging && Math.abs(d) > 6) { dragging = true; el.setPointerCapture(e.pointerId); }
      if (dragging) { track(e.clientY); move(d); }
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      pointerId = -1;
      if (dragging) release(); else tracking = false;
    };
    const onPointerCancel = (e: PointerEvent) => { if (e.pointerId === pointerId) { pointerId = -1; if (dragging) springBack(); tracking = false; } };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onPointerCancel);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onPointerCancel);
    };
  }, []);

  return (
    <div className={`sheet-backdrop ${top ? "top" : ""} ${fromTop ? "from-top" : ""}`} onClick={() => close.current()}>
      <div ref={sheet} className="sheet" role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()}>
        {!fromTop && <div className="grabber" aria-hidden="true" />}
        {children}
      </div>
    </div>
  );
}
