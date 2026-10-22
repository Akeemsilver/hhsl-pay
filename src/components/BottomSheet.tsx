import { useEffect, useRef, type ReactNode } from "react";
import { useLayer } from "./layers";

const DISMISS_DISTANCE = 110;

/**
 * A bottom sheet that closes when you tap outside it, press Escape or the phone's Back button (the owner wires Back),
 * or pull it down. Pulling down only starts when the content is scrolled to the top, so scrolling still works.
 * The owner decides what "close" means, for example asking to discard unsaved changes.
 */
export function BottomSheet({ label, onRequestClose, top, children }: {
  label: string; onRequestClose: () => void; top?: boolean; children: ReactNode;
}) {
  const sheet = useRef<HTMLDivElement>(null);
  const close = useRef(onRequestClose);
  close.current = onRequestClose;
  useLayer(() => close.current());

  useEffect(() => {
    const el = sheet.current;
    if (!el) return;
    let startY = 0, dy = 0, tracking = false, dragging = false;

    const move = (to: number) => {
      dy = Math.max(0, to);
      el.style.transition = "none";
      el.style.transform = `translateY(${dy}px)`;
    };
    const release = () => {
      const far = dy > DISMISS_DISTANCE;
      el.style.transition = "";
      el.style.transform = "";
      tracking = dragging = false;
      dy = 0;
      if (far) close.current();
    };

    const onStart = (e: TouchEvent) => { startY = e.touches[0]!.clientY; tracking = true; dragging = false; dy = 0; };
    const onMove = (e: TouchEvent) => {
      if (!tracking) return;
      const d = e.touches[0]!.clientY - startY;
      if (!dragging) {
        if (d > 8 && el.scrollTop <= 0) dragging = true;
        else if (d < -8) tracking = false;
      }
      if (dragging) {
        e.preventDefault();
        move(d);
      }
    };
    const onEnd = () => { if (dragging) release(); tracking = false; };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);

    // Mouse and pen: drag the grabber.
    const grab = el.querySelector<HTMLElement>(".grabber");
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      startY = e.clientY; tracking = dragging = true; grab?.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => { if (dragging && e.pointerType !== "touch") move(e.clientY - startY); };
    const onUp = (e: PointerEvent) => { if (dragging && e.pointerType !== "touch") release(); };
    grab?.addEventListener("pointerdown", onDown);
    grab?.addEventListener("pointermove", onPointerMove);
    grab?.addEventListener("pointerup", onUp);
    grab?.addEventListener("pointercancel", onUp);

    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
      grab?.removeEventListener("pointerdown", onDown);
      grab?.removeEventListener("pointermove", onPointerMove);
      grab?.removeEventListener("pointerup", onUp);
      grab?.removeEventListener("pointercancel", onUp);
    };
  }, []);

  return (
    <div className={`sheet-backdrop ${top ? "top" : ""}`} onClick={() => close.current()}>
      <div ref={sheet} className="sheet" role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()}>
        <div className="grabber" aria-hidden="true" />
        {children}
      </div>
    </div>
  );
}
