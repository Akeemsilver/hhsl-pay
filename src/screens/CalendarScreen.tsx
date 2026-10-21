import { useState } from "react";
import { valueOn } from "../engine";
import { MONTHS, daysOfMonth, shiftMonth, todayISO } from "../format";
import { useMonth } from "../hooks";
import { useNav } from "../nav";
import { useStore } from "../store";
import { TopBar } from "../components/TopBar";
import { BackIcon, ForwardIcon } from "../components/Icons";
import { CalendarGrid, CorrectionBox, DayList, MonthSummary } from "../components/MonthParts";

export function CalendarScreen() {
  const { data } = useStore();
  const { open } = useNav();
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const result = useMonth(month);
  const days = daysOfMonth(month);
  const today = todayISO();
  const year = Number(month.slice(0, 4));
  const noSites = Object.keys(valueOn(data.history.sites, `${month}-01`)).length === 0;
  const payerOrder = Object.keys(data.payerNames);

  return (
    <>
      <TopBar title="Calendar" />
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

      {view === "calendar"
        ? <CalendarGrid month={month} days={days} result={result} today={today} onPick={(d) => open({ day: d })} payerOrder={payerOrder} />
        : <DayList days={days} result={result} today={today} onPick={(d) => open({ day: d })} />}

      <MonthSummary result={result} label={month} />
      <CorrectionBox month={month} result={result} />
    </>
  );
}
