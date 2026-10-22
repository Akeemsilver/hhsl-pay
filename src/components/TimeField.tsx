import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { parseTimeInput, toMinutes } from "../engine";
import { BottomSheet } from "./BottomSheet";
import { useNav } from "../nav";

const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const two = (n: number) => String(n).padStart(2, "0");

/** The time picker: quick times, hour (0-23) and minute dials, or type it. Saved as 24-hour "HH:MM". */
function TimeSheet({ title, value, quick, onSet, onCancel }: {
  title: string; value: string | undefined; quick: string[];
  onSet: (v: string | undefined) => void; onCancel: () => void;
}) {
  const [current, setCurrent] = useState<string>(value ?? "07:00");
  const [typed, setTyped] = useState("");
  const [typedError, setTypedError] = useState(false);
  const first = useRef<HTMLButtonElement>(null);
  const mins = toMinutes(current) ?? 7 * 60;
  const hour = Math.floor(mins / 60), minute = mins % 60;
  const minuteOptions = MINUTES.includes(minute) ? MINUTES : [...MINUTES, minute].sort((a, b) => a - b);

  useEffect(() => first.current?.focus(), []);

  const commitTyped = () => {
    if (!typed.trim()) return setTypedError(false);
    const parsed = parseTimeInput(typed);
    if (parsed) { setCurrent(parsed); setTypedError(false); setTyped(""); }
    else setTypedError(true);
  };

  return (
    <BottomSheet label={title} onRequestClose={onCancel} top>
      <div className="time-sheet">
        <div className="time-head">
          <strong>{title}</strong>
          <div className="time-big">{current}</div>
        </div>

        {quick.length > 0 && (
          <>
            <h3 className="section-title">Quick times</h3>
            <div className="quick-times">
              {quick.map((q, i) => (
                <button key={q} ref={i === 0 ? first : undefined} type="button" aria-pressed={current === q} className={current === q ? "on" : ""} onClick={() => setCurrent(q)}>{q}</button>
              ))}
            </div>
          </>
        )}

        <div className="dials">
          <label>Hour
            <select value={hour} onChange={(e) => setCurrent(`${two(Number(e.target.value))}:${two(minute)}`)}>
              {HOURS.map((h) => <option key={h} value={h}>{two(h)}</option>)}
            </select>
          </label>
          <label>Minute
            <select value={minute} onChange={(e) => setCurrent(`${two(hour)}:${two(Number(e.target.value))}`)}>
              {minuteOptions.map((m) => <option key={m} value={m}>{two(m)}</option>)}
            </select>
          </label>
        </div>

        <label className="typed">
          Or type the time
          <input
            value={typed} placeholder="1930 or 19:30" aria-invalid={typedError} inputMode="numeric"
            onChange={(e) => setTyped(e.target.value)} onBlur={commitTyped}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitTyped(); } }}
          />
          {typedError && <span className="bad small" role="alert">That is not a time. Try 1930 or 07:30.</span>}
        </label>

        <div className="time-actions">
          <button type="button" onClick={() => onSet(undefined)}>Clear</button>
          <button type="button" onClick={onCancel}>Cancel</button>
          <button
            type="button" className="primary"
            onClick={() => { const parsed = typed.trim() ? parseTimeInput(typed) : null; onSet(parsed ?? current); }}
          >Set</button>
        </div>
      </div>
    </BottomSheet>
  );
}

/** A tappable time that opens the picker. The picker takes part in the Back button. */
export function TimeField({ label, value, quick, onChange }: {
  label: string; value: string | undefined; quick: string[]; onChange: (v: string | undefined) => void;
}) {
  const { loc, open, back } = useNav();
  const [show, setShow] = useState(false);

  useEffect(() => { if (!loc.sub) setShow(false); }, [loc.sub]);

  return (
    <div className="field">
      <span className="lbl">{label}</span>
      <button
        type="button" className={`time-btn ${value ? "" : "empty"}`}
        aria-label={`${label}: ${value ?? "not set"}`}
        onClick={() => { setShow(true); open({ sub: "time" }); }}
      >{value ?? "HH:MM"}</button>
      {show && createPortal(
        <TimeSheet
          title={label} value={value} quick={quick}
          onSet={(v) => { onChange(v); back(); }}
          onCancel={back}
        />,
        document.body,
      )}
    </div>
  );
}

/** The times used most in existing entries, so the picker offers your usual start and end times. */
export function quickTimes(times: Array<string | undefined>): string[] {
  const counts = new Map<string, number>();
  for (const t of times) if (t) counts.set(t, (counts.get(t) ?? 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 4).map(([t]) => t);
  for (const d of ["07:00", "19:00"]) if (top.length < 2 && !top.includes(d)) top.push(d);
  return top;
}
