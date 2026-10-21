import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { parseTimeInput, to12h, toMinutes } from "../engine";
import { useNav } from "../nav";

const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

function split(t: string | undefined): { ampm: "AM" | "PM"; hour: number; minute: number } {
  const mins = toMinutes(t) ?? 7 * 60;
  const h = Math.floor(mins / 60);
  return { ampm: h < 12 ? "AM" : "PM", hour: h % 12 === 0 ? 12 : h % 12, minute: mins % 60 };
}

function join(ampm: "AM" | "PM", hour: number, minute: number): string {
  const h24 = (hour % 12) + (ampm === "PM" ? 12 : 0);
  return `${String(h24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** The time picker: quick times, AM/PM, hour and minute, or type it. Saved as 24-hour "HH:MM". */
function TimeSheet({ title, value, quick, onSet, onCancel }: {
  title: string; value: string | undefined; quick: string[];
  onSet: (v: string | undefined) => void; onCancel: () => void;
}) {
  const [current, setCurrent] = useState<string>(value ?? "07:00");
  const [typed, setTyped] = useState("");
  const [typedError, setTypedError] = useState(false);
  const first = useRef<HTMLButtonElement>(null);
  const { ampm, hour, minute } = split(current);
  const minuteOptions = MINUTES.includes(minute) ? MINUTES : [...MINUTES, minute].sort((a, b) => a - b);

  useEffect(() => first.current?.focus(), []);

  const commitTyped = () => {
    if (!typed.trim()) return setTypedError(false);
    const parsed = parseTimeInput(typed);
    if (parsed) { setCurrent(parsed); setTypedError(false); setTyped(""); }
    else setTypedError(true);
  };

  return (
    <div className="sheet-backdrop top" onClick={onCancel}>
      <div className="sheet time-sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="time-head">
          <div>
            <strong>{title}</strong>
            <span className="badge">saved as 24-hour</span>
          </div>
          <div className="time-big">
            <span>{current}</span>
            <small>{to12h(current)}</small>
          </div>
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
          <label>AM / PM
            <select value={ampm} onChange={(e) => setCurrent(join(e.target.value as "AM" | "PM", hour, minute))}>
              <option>AM</option><option>PM</option>
            </select>
          </label>
          <label>Hour
            <select value={hour} onChange={(e) => setCurrent(join(ampm, Number(e.target.value), minute))}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => <option key={h} value={h}>{h}</option>)}
            </select>
          </label>
          <label>Minute
            <select value={minute} onChange={(e) => setCurrent(join(ampm, hour, Number(e.target.value)))}>
              {minuteOptions.map((m) => <option key={m} value={m}>{String(m).padStart(2, "0")}</option>)}
            </select>
          </label>
        </div>

        <label className="typed">
          Or type the time
          <input
            value={typed} placeholder="1930, 19:30 or 7:30pm" aria-invalid={typedError}
            onChange={(e) => setTyped(e.target.value)} onBlur={commitTyped}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitTyped(); } }}
          />
          {typedError && <span className="bad small" role="alert">That is not a time. Try 1930 or 7:30pm.</span>}
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
    </div>
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

/** The times used most in existing entries, so the picker offers your usual shift times. */
export function quickTimes(times: Array<string | undefined>): string[] {
  const counts = new Map<string, number>();
  for (const t of times) if (t) counts.set(t, (counts.get(t) ?? 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 4).map(([t]) => t);
  for (const d of ["07:00", "19:00"]) if (top.length < 2 && !top.includes(d)) top.push(d);
  return top;
}
