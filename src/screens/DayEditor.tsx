import { useEffect, useRef } from "react";
import { computeDay, valueOn } from "../engine";
import { WEEKDAYS, money } from "../format";
import { newId, type Entry } from "../model";
import { useStore } from "../store";

export function DayEditor({ date, onClose }: { date: string; onClose: () => void }) {
  const { data, update } = useStore();
  const sites = valueOn(data.history.sites, date);
  const siteNames = Object.keys(sites);
  const entries = data.entries.filter((e) => e.date === date);
  const closeRef = useRef<HTMLButtonElement>(null);
  const wd = new Date(`${date}T00:00:00Z`).getUTCDay();

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const patch = (id: string, changes: Partial<Entry>) =>
    update((d) => ({ ...d, entries: d.entries.map((e) => (e.id === id ? { ...e, ...changes } : e)) }));
  const remove = (id: string) => update((d) => ({ ...d, entries: d.entries.filter((e) => e.id !== id) }));
  const add = () =>
    update((d) => ({ ...d, entries: [...d.entries, { id: newId(), date, site: siteNames[0] ?? "", hours: 12 }] }));

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={`Entries for ${date}`} onClick={(e) => e.stopPropagation()}>
        <header className="bar">
          <h2>{WEEKDAYS[wd]} {date}</h2>
          <button ref={closeRef} className="icon" onClick={onClose} aria-label="Close">✕</button>
        </header>

        {siteNames.length === 0 && <p className="muted">No sites are set up for this date. Add them under Rates.</p>}

        {entries.map((entry) => {
          const pay = computeDay(entry, sites);
          const known = siteNames.some((n) => n.toLowerCase() === entry.site.trim().toLowerCase());
          return (
            <div className="entry" key={entry.id}>
              <label>
                Site
                <select value={entry.site} onChange={(e) => patch(entry.id, { site: e.target.value })}>
                  {!known && <option value={entry.site}>{entry.site || "Choose…"} (not in rates)</option>}
                  {siteNames.map((n) => <option key={n}>{n}</option>)}
                </select>
              </label>
              <label>
                Hours
                <input
                  type="number" inputMode="decimal" min="0" max="24" step="0.25"
                  value={entry.hours}
                  onChange={(e) => patch(entry.id, { hours: Math.max(0, Number(e.target.value)) })}
                />
              </label>
              <div className="checks">
                <label><input type="checkbox" checked={!!entry.lead} onChange={(e) => patch(entry.id, { lead: e.target.checked })} /> Lead / instructor / medic</label>
                <label><input type="checkbox" checked={!!entry.holiday} onChange={(e) => patch(entry.id, { holiday: e.target.checked })} /> Public holiday</label>
              </div>
              <div className="preview">
                <span>
                  {pay.dailyPay > 0 ? `Flat ${money(pay.dailyPay)}` : `Rate ${money(pay.rate)}/h`}
                  {pay.tierHours.x15 + pay.tierHours.x2 + pay.tierHours.x3 > 0 &&
                    ` · OT ${[["×1.5", pay.tierHours.x15], ["×2", pay.tierHours.x2], ["×3", pay.tierHours.x3]].filter(([, h]) => Number(h) > 0).map(([l, h]) => `${h}h ${l}`).join(", ")}`}
                </span>
                <strong>{money(pay.total)}</strong>
              </div>
              <button className="danger" onClick={() => remove(entry.id)}>Remove</button>
            </div>
          );
        })}

        <button className="primary wide" onClick={add} disabled={siteNames.length === 0}>
          {entries.length ? "Add another entry (2nd job)" : "Add entry"}
        </button>
      </div>
    </div>
  );
}
