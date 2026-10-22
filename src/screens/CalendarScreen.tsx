import { useState } from "react";
import { valueOn } from "../engine";
import { MONTHS, daysOfMonth, shiftMonth, todayISO } from "../format";
import { useMonth } from "../hooks";
import { useNav } from "../nav";
import { useStore } from "../store";
import { TopBar } from "../components/TopBar";
import { BackIcon, ForwardIcon } from "../components/Icons";
import { DayPanel } from "../components/DayPanel";
import { CalendarGrid, CorrectionBox, DayList, MonthSummary } from "../components/MonthParts";

export function CalendarScreen() {
  const { data } = useStore();
  const { loc, open } = useNav();
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const [view, setView] = useState<"calendar" | "list">("calendar");
  // The tapped date, if it is in the month on screen; otherwise today when it is in that month, otherwise nothing.
  const [picked, setPicked] = useState<string | null>(null);
  const selected = picked && picked.startsWith(month) ? picked : todayISO().startsWith(month) ? todayISO() : null;
  const result = useMonth(month);
  const days = daysOfMonth(month);
  const today = todayISO();
  const year = Number(month.slice(0, 4));
  const noSites = Object.keys(valueOn(data.history.sites, `${month}-01`)).length === 0;

  return (
    <>
      <TopBar title="Calendar" month={month} />
      <div className="monthbar">
        <button className="icon" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month"><BackIcon /></button>
        <div className="monthname">
          <select aria-label="Month" value={month.slice(5)} onChange={(e) => setMonth(`${year}-${e.target.value}`)}>
            {MONTHS.map((m, i) => <option key={m} value={String(i + 1).padStart(2, "0")}>{m}</option>)}
          </select>{" "}
          <span>{year}</span>
        </div>
        <button className="icon" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Next month"><ForwardIcon /></button>
      </div>

      <div className="segmented" role="group" aria-label="View">
        <button aria-pressed={view === "calendar"} className={view === "calendar" ? "on" : ""} onClick={() => setView("calendar")}>Calendar</button>
        <button aria-pressed={view === "list"} className={view === "list" ? "on" : ""} onClick={() => setView("list")}>List</button>
      </div>

      {noSites && <p className="notice">Add your sites under the settings gear before logging days.</p>}

      {view === "calendar" ? (
        <>
          <CalendarGrid month={month} days={days} result={result} today={today} selected={selected} onPick={setPicked} onShift={(by) => setMonth(shiftMonth(month, by))} />
          {selected ? <DayPanel date={selected} /> : <p className="muted pad">Tap a date to see its jobs and add one.</p>}
        </>
      ) : (
        <DayList days={days} result={result} today={today} onPick={(d) => open({ day: d })} onShift={(by) => setMonth(shiftMonth(month, by))} />
      )}

      <MonthSummary result={result} label={month} />
      <CorrectionBox month={month} result={result} />
    </>
  );
}
