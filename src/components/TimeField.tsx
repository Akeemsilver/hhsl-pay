import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { parseTimeInput, toMinutes } from "../engine";
import { BottomSheet } from "./BottomSheet";
import { useNav } from "../nav";
import { Wheel } from "./Wheel";

const MINUTE_ITEMS = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));
const HOUR_ITEMS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
const AMPM = ["AM", "PM"];
const two = (n: number) => String(n).padStart(2, "0");

/** The time picker: quick times, then AM/PM, hour and minute wheels (like the phone's own), or type it. Always saved as 24-hour "HH:MM". */
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
  // The wheels show a 12-hour clock; the value stays 24-hour.
  const pm = hour >= 12;
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  const to24 = (isPm: boolean, h12: number) => (h12 % 12) + (isPm ? 12 : 0);

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

        <div className="wheels">
          <div className="wheel-col"><span className="wheel-label">AM / PM</span>
            <Wheel label="AM or PM" items={AMPM} index={pm ? 1 : 0} onIndex={(i) => setCurrent(`${two(to24(i === 1, hour12))}:${two(minute)}`)} />
          </div>
          <div className="wheel-col"><span className="wheel-label">Hour</span>
            <Wheel label="Hour" items={HOUR_ITEMS} index={hour12 - 1} onIndex={(i) => setCurrent(`${two(to24(pm, i + 1))}:${two(minute)}`)} />
          </div>
          <div className="wheel-col"><span className="wheel-label">Minute</span>
            <Wheel label="Minute" items={MINUTE_ITEMS} index={minute} onIndex={(i) => setCurrent(`${two(hour)}:${two(i)}`)} />
          </div>
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
