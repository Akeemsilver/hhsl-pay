import { useEffect, useLayoutEffect, useRef } from "react";

const ITEM = 44;
const ROWS = 5;

/**
 * A scrolling wheel like the phone's own time picker: flick or drag it and it settles on one value, shown big in the
 * middle with the neighbours fading away. Tap a value to pick it. `index` is the picked item.
 */
export function Wheel({ items, index, onIndex, label }: { items: string[]; index: number; onIndex: (i: number) => void; label: string }) {
  const box = useRef<HTMLDivElement>(null);
  const emitted = useRef(index);
  const first = useRef(true);
  const pending = useRef(0);
  // Where the wheel is gliding to when the value was changed from outside. While it glides, the scroll positions it passes
  // through are not picked values: they must not be reported, or the time would flicker through every value in between.
  const gliding = useRef<number | null>(null);

  // Move the wheel when the value changes from outside (a quick time, typing, a tap), but not while the finger is doing it.
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    if (index === emitted.current && !first.current) return;
    const top = index * ITEM;
    if (Math.abs(el.scrollTop - top) > 1) {
      if (first.current) el.scrollTo({ top, behavior: "auto" });
      else {
        gliding.current = top;
        window.clearTimeout(pending.current);
        // A safety net in case the glide is cut short: control goes back to the finger after a moment.
        pending.current = window.setTimeout(() => { gliding.current = null; }, 900);
        el.scrollTo({ top, behavior: "smooth" });
      }
    }
    emitted.current = index;
    first.current = false;
  }, [index]);

  useEffect(() => () => window.clearTimeout(pending.current), []);

  const onScroll = () => {
    const el = box.current;
    if (!el) return;
    if (gliding.current !== null) {
      if (Math.abs(el.scrollTop - gliding.current) <= 1) { gliding.current = null; window.clearTimeout(pending.current); }
      return;
    }
    const i = Math.min(items.length - 1, Math.max(0, Math.round(el.scrollTop / ITEM)));
    if (i !== emitted.current) { emitted.current = i; onIndex(i); }
  };
  const step = (by: number) => {
    const i = Math.min(items.length - 1, Math.max(0, index + by));
    if (i !== index) { emitted.current = -1; onIndex(i); }
  };

  return (
    <div className="wheel" role="listbox" aria-label={label} aria-activedescendant={`${label}-${index}`} tabIndex={0}
      onKeyDown={(e) => { if (e.key === "ArrowDown") { e.preventDefault(); step(1); } else if (e.key === "ArrowUp") { e.preventDefault(); step(-1); } }}>
      <div className="wheel-band" aria-hidden="true" />
      <div className="wheel-scroll" ref={box} onScroll={onScroll} onPointerDown={() => { gliding.current = null; }} onWheel={() => { gliding.current = null; }} style={{ height: ITEM * ROWS }}>
        <div style={{ height: ITEM * 2 }} aria-hidden="true" />
        {items.map((t, i) => {
          const d = Math.abs(i - index);
          return (
            <div key={t} id={`${label}-${i}`} role="option" aria-selected={i === index} className={`wheel-item d${Math.min(d, 3)}`} style={{ height: ITEM }}
              onClick={() => { emitted.current = -1; onIndex(i); }}>{t}</div>
          );
        })}
        <div style={{ height: ITEM * 2 }} aria-hidden="true" />
      </div>
    </div>
  );
}
