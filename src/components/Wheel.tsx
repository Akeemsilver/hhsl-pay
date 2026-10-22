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

  // Move the wheel when the value changes from outside (a quick time, typing, a tap), but not while the finger is doing it.
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    if (index === emitted.current && !first.current) return;
    const top = index * ITEM;
    if (Math.abs(el.scrollTop - top) > 1) el.scrollTo({ top, behavior: first.current ? "auto" : "smooth" });
    emitted.current = index;
    first.current = false;
  }, [index]);

  useEffect(() => () => window.clearTimeout(pending.current), []);

  const onScroll = () => {
    const el = box.current;
    if (!el) return;
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
      <div className="wheel-scroll" ref={box} onScroll={onScroll} style={{ height: ITEM * ROWS }}>
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
