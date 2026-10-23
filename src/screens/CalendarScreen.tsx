import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSessionState } from "../session";
import { useBarHeight } from "../barHeight";
import { valueOn } from "../engine";
import { daysOfMonth, shiftMonth, todayISO } from "../format";
import { useMonth } from "../hooks";
import { useMonthSlide } from "../slide";
import { MonthPicker } from "../components/MonthPicker";
import { useNav } from "../nav";
import { useStore } from "../store";
import { TopBar } from "../components/TopBar";
import { BackIcon, ForwardIcon } from "../components/Icons";
import { DayPanel } from "../components/DayPanel";
import { CalendarGrid, CorrectionBox, DayList, MonthSummary, SiteTable } from "../components/MonthParts";

export function CalendarScreen() {
  const { data } = useStore();
  const { loc, open } = useNav();
  const [month, setMonth] = useSessionState("calendar-month", todayISO().slice(0, 7));
  const [view, setView] = useSessionState<"calendar" | "list">("calendar-view", "calendar");
  // The tapped date, if it is in the month on screen; otherwise today when it is in that month, otherwise nothing.
  const [picked, setPicked] = useSessionState<string | null>("selected-date", null);
  const selected = picked && picked.startsWith(month) ? picked : todayISO().startsWith(month) ? todayISO() : null;
  // Changing the month while scrolled keeps the page on the same spot: the page is held at its old height until the new month has drawn.
  const spot = useRef<number | null>(null);
  const keepSpot = () => {
    if (window.scrollY <= 0) return;
    spot.current = window.scrollY;
    document.body.style.minHeight = `${document.documentElement.scrollHeight}px`;
  };
  useLayoutEffect(() => {
    if (spot.current === null) return;
    window.scrollTo(0, spot.current);
    spot.current = null;
  }, [month]);
  useEffect(() => () => { document.body.style.minHeight = ""; }, []);
  const changeMonth = (m: string) => { keepSpot(); setMonth(m); };
  const slide = useMonthSlide(month, (by) => changeMonth(shiftMonth(month, by)));
  const result = useMonth(month);
  const days = daysOfMonth(month);
  const today = todayISO();
  const year = Number(month.slice(0, 4));
  const noSites = Object.keys(valueOn(data.history.sites, `${month}-01`)).length === 0;

  // The month bar sticks right under the title bar, whatever height that bar has on this phone.
  useBarHeight();

  return (
    <>
      <TopBar title="Month" month={month} />
      <div className="monthbar sticky">
        <button className="icon" onClick={() => slide.go(-1)} aria-label="Previous month"><BackIcon /></button>
        <MonthPicker month={month} onChange={changeMonth} />
        <button className="icon" onClick={() => slide.go(1)} aria-label="Next month"><ForwardIcon /></button>
      </div>

      <div className="segmented" role="group" aria-label="View">
        <button aria-pressed={view === "calendar"} className={view === "calendar" ? "on" : ""} onClick={() => setView("calendar")}>Calendar</button>
        <button aria-pressed={view === "list"} className={view === "list" ? "on" : ""} onClick={() => setView("list")}>List</button>
      </div>

      {noSites && <p className="notice">Add your sites under the settings gear before logging days.</p>}

      {view === "calendar" ? (
        <>
          <CalendarGrid month={month} days={days} result={result} today={today} selected={selected} onPick={setPicked} slide={slide} />
          {selected ? <DayPanel date={selected} /> : <p className="muted pad">Tap a date to see its jobs and add one.</p>}
        </>
      ) : (
        <DayList days={days} result={result} today={today} onPick={(d) => open({ day: d })} slide={slide} />
      )}

      <MonthSummary result={result} label={month} />
      <SiteTable result={result} />
      <CorrectionBox month={month} result={result} />
    </>
  );
}
