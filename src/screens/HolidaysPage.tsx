import { useState } from "react";
import { useStore } from "../store";
import { PageHeader } from "../components/TopBar";
import { builtInHolidays, holidaysFor } from "../holidays";
import { dmy } from "../format";

export function HolidaysPage() {
  const { data, update } = useStore();
  const [year, setYear] = useState(new Date().getFullYear());
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const list = holidaysFor(year, data);
  const builtIn = new Set(builtInHolidays(year).map((h) => h.date));
  const removed = (data.holidays?.removed ?? []).filter((d) => d.startsWith(`${year}-`) && builtIn.has(d));
  const edit = (fn: (h: { added: { date: string; name: string }[]; removed: string[] }) => { added: { date: string; name: string }[]; removed: string[] }) =>
    update((d) => ({ ...d, holidays: fn(d.holidays ?? { added: [], removed: [] }) }));
  return (
    <>
      <PageHeader title="Public holidays" />
      <p className="muted pad">These dates show in red on the calendar and new jobs on them are marked as a public holiday. Divali and Eid ul-Fitr change every year, so add them here.</p>
      <section className="card">
        <div className="row">
          <button aria-label="Previous year" onClick={() => setYear(year - 1)}>‹</button>
          <strong>{year}</strong>
          <button aria-label="Next year" onClick={() => setYear(year + 1)}>›</button>
        </div>
        <ul className="plain">
          {list.map((h) => (
            <li key={h.date} className="row">
              <span><strong>{dmy(h.date)}</strong> <span className="hol-name">{h.name}</span></span>
              <button aria-label={`Remove ${h.name}`} onClick={() => edit((x) => ({
                added: x.added.filter((a) => a.date !== h.date),
                removed: builtIn.has(h.date) ? [...x.removed, h.date] : x.removed,
              }))}>Remove</button>
            </li>
          ))}
        </ul>
        {removed.length > 0 && (
          <button onClick={() => edit((x) => ({ ...x, removed: x.removed.filter((d) => !removed.includes(d)) }))}>Restore {removed.length} removed</button>
        )}
      </section>
      <h2 className="section-title">Add a holiday</h2>
      <section className="card">
        <label>Date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label>Name<input placeholder="Divali" value={name} onChange={(e) => setName(e.target.value)} /></label>
        <button disabled={!date || !name.trim()} onClick={() => {
          edit((x) => ({ added: [...x.added.filter((a) => a.date !== date), { date, name: name.trim() }], removed: x.removed.filter((d) => d !== date) }));
          setYear(Number(date.slice(0, 4)));
          setDate(""); setName("");
        }}>Add holiday</button>
      </section>
    </>
  );
}
