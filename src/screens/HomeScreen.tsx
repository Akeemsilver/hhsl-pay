import { useLayoutEffect, useRef, useState } from "react";
import { valueOn } from "../engine";
import { MONTHS, dayDMY, daysOfMonth, hoursText, money, shiftMonth, todayISO } from "../format";
import { useInstall } from "../install";
import { useSiteFilter } from "../filter";
import { useMonth, useMonthSplit, useYear } from "../hooks";
import { useMonthSlide } from "../slide";
import { useNav } from "../nav";
import { isOther, othersByDate } from "../model";
import { useStore } from "../store";
import { TopBar } from "../components/TopBar";
import { BackIcon, ForwardIcon } from "../components/Icons";
import { TaxSwitch } from "../components/TaxMode";
import { MonthPicker } from "../components/MonthPicker";
import { AverageLine } from "../components/AverageLine";
import { CalendarGrid, PayerTax } from "../components/MonthParts";
import { sheetSplit } from "../sheetSplit";

const DAY_MS = 86_400_000;

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

const longDate = (iso: string) => dayDMY(iso);
const shortDate = (iso: string) => dayDMY(iso);

export function HomeScreen() {
  const { data } = useStore();
  const { open, selectTab, loc } = useNav();
  const [picked, setPicked] = useState<string | undefined>();
  const today = todayISO();
  const [shown, setShown] = useState(today.slice(0, 7));
  const month = today.slice(0, 7);
  const year = Number(today.slice(0, 4));

  // The site hours line up exactly under the Paid hours figure, whatever the width of the other columns.
  const heroRef = useRef<HTMLElement>(null);
  const alignHours = () => {
    const hero = heroRef.current;
    const stat = hero?.querySelector<HTMLElement>(".hero-stats > div:nth-child(4)");
    const slot = hero?.querySelector<HTMLElement>(".payer-slot");
    const days = hero?.querySelector<HTMLElement>(".hero-stats > div:nth-child(3)");
    if (hero && days && slot) hero.style.setProperty("--dx", `${Math.round((days.getBoundingClientRect().left - slot.getBoundingClientRect().left) * 10) / 10}px`);
    if (hero && stat && slot) hero.style.setProperty("--hx", `${Math.round((stat.getBoundingClientRect().left - slot.getBoundingClientRect().left) * 10) / 10}px`);
  };
  useLayoutEffect(() => {
    alignHours();
    window.addEventListener("resize", alignHours);
    return () => window.removeEventListener("resize", alignHours);
  });

  const { site: filterSite } = useSiteFilter();
  const install = useInstall();
  const shownResult = useMonth(shown);
  const shownYear = useYear(Number(shown.slice(0, 4)));
  const prevShown = shiftMonth(shown, -1);
  // The top card stays the same height whether tax is split or combined, so flipping it never moves what is below.
  const splitResult = useMonthSplit(shown);
  const groupCount = splitResult.payers.length;
  const lastMonth = useMonth(prevShown);
  const slide = useMonthSlide(shown, (by) => setShown(shiftMonth(shown, by)));
  const months = useYear(year);
  const prevYearMonths = useYear(year - 1);

  const noSites = Object.keys(valueOn(data.history.sites, today)).length === 0;
  const lastBackup = data.lastBackupAt ? Date.parse(data.lastBackupAt) : 0;
  const backupDue = data.entries.length > 0 && Date.now() - lastBackup > 30 * DAY_MS;

  // Jobs on the time sheet get their own line (days only); their days and hours come out of their group's line, so the lines add up to the totals.
  const shownSplit = sheetSplit(shownResult, data, { others: !filterSite });
  const ghostSplit = sheetSplit(splitResult, data, { others: !filterSite });
  const hours = shownSplit.totalHours;
  const diff = shownResult.gross - lastMonth.gross;

  const rules = valueOn(data.history.tax, today);
  const ytdGross = months.reduce((s, m) => s + m.gross, 0);
  const ytdNet = months.reduce((s, m) => s + m.net, 0);
  const ytdPaye = months.reduce((s, m) => s + m.paye, 0);
  const thisMonthIndex = Number(month.slice(5)) - 1;
  const lastIncomeIndex = months.reduce((last, m, i) => (m.gross > 0 ? i : last), -1);
  const elapsed = Math.max(thisMonthIndex, lastIncomeIndex) + 1;
  const projection = (ytdGross / elapsed) * 12;
  const progress = Math.min(1, ytdGross / rules.annualThreshold);

  // Last six months, crossing into the previous year when needed.
  const recent = Array.from({ length: 6 }, (_, k) => {
    const m = shiftMonth(month, k - 5);
    const y = Number(m.slice(0, 4));
    const source = y === year ? months : y === year - 1 ? prevYearMonths : [];
    return { month: m, gross: source[Number(m.slice(5)) - 1]?.gross ?? 0 };
  });
  const max = Math.max(1, ...recent.map((r) => r.gross));

  const latest = data.entries
    .filter((e) => e.date <= today && (!filterSite || e.site === filterSite))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);
  const siteTotal = (e: (typeof latest)[number]) =>
    months.concat(prevYearMonths).flatMap((m) => m.entries).find((p) => p.entry.id === e.id)?.pay.total ?? 0;

  return (
    <>
      <TopBar title={`${greeting()}`} subtitle={longDate(today)} month={shown} />

      {install.state === "ready" && (
        <div className="notice install-card">
          <strong>Install the app</strong>
          <p>Put it on your home screen so it opens like any other app, full screen, and works without a signal.</p>
          <button className="primary wide" onClick={() => void install.install()}>Install app</button>
        </div>
      )}
      {install.state === "ios" && (
        <div className="notice install-card">
          <strong>Install the app</strong>
          <p>On iPhone: open this page in <strong>Safari</strong>, tap the <strong>Share</strong> button (square with an arrow), then <strong>Add to Home Screen</strong>, then <strong>Add</strong>.</p>
          <button onClick={() => open({ page: "settings" })}>Full instructions in Settings</button>
        </div>
      )}

      {noSites && (
        <div className="notice">
          <strong>Start here: add your sites and rates.</strong>
          <p>Open the settings gear at the top right, or restore a backup, to load your sites.</p>
          <div className="row">
            <button className="primary" onClick={() => open({ page: "sites" })}>Set up rates</button>
            <button onClick={() => open({ page: "backup" })}>Restore a backup</button>
          </div>
        </div>
      )}

      {backupDue && (
        <div className="notice warn">
          <strong>Back up your data</strong>
          <p>{data.lastBackupAt ? "It has been over 30 days since your last backup." : "You have not backed up yet."} If this phone is lost or its browser data cleared, your entries are gone.</p>
          <button onClick={() => open({ page: "backup" })}>Back up now</button>
        </div>
      )}

      <section className="hero" ref={heroRef} aria-label={`Totals for ${shown}`}>
        <div className="hero-top">
          <span><i className="dot dot-gross" />Gross · {MONTHS[Number(shown.slice(5)) - 1]}{shown.slice(0, 4) !== String(year) ? ` ${shown.slice(0, 4)}` : ""}{shown === month ? " so far" : ""}</span>
          {lastMonth.gross > 0 && (
            <span className="delta">{diff >= 0 ? "▲" : "▼"} {money(Math.abs(diff))} vs {MONTHS[Number(prevShown.slice(5)) - 1]?.slice(0, 3)}</span>
          )}
        </div>
        <div className="hero-value">{money(shownResult.gross)}</div>
        <div className="hero-stats">
          <div><span><i className="dot dot-net" />Net</span><strong className="c-net">{money(shownResult.net)}</strong></div>
          <div><span><i className="dot dot-paye" />PAYE</span><strong className="c-paye">{money(shownResult.paye)}</strong></div>
          <div><span>Days</span><strong>{shownSplit.totalDays}</strong></div>
          <div><span>Paid hours</span><strong>{hoursText(hours)} h</strong></div>
        </div>
        <AverageLine gross={shownYear.map((m) => m.gross)} net={shownYear.map((m) => m.net)} index={Number(shown.slice(5)) - 1} />
        <div className="payer-slot">
          <PayerTax payers={shownSplit.payers} sheet={shownSplit.sheet} groups={groupCount} />
          <div className="payer-ghost" aria-hidden="true"><PayerTax payers={ghostSplit.payers} sheet={ghostSplit.sheet} groups={groupCount} /></div>
        </div>
      </section>

      <div className="actions">
        <button className="primary" disabled={shown === month} onClick={() => setShown(month)}>{shown === month ? "This month" : `Back to ${MONTHS[Number(month.slice(5)) - 1]?.slice(0, 3)}`}</button>
        <button onClick={() => selectTab("calendar")}>Month</button>
        <TaxSwitch />
      </div>

      <div className="home-cal">
        <div className="monthbar">
          <button className="icon" onClick={() => slide.go(-1)} aria-label="Previous month"><BackIcon /></button>
          <MonthPicker month={shown} onChange={setShown} />
          <button className="icon" onClick={() => slide.go(1)} aria-label="Next month"><ForwardIcon /></button>
        </div>
        <CalendarGrid month={shown} days={daysOfMonth(shown)} result={shownResult} today={today} selected={loc.day ?? picked} onPick={(d) => { setPicked(d); open({ day: d }); }} slide={slide} />
      </div>

      <section className="card">
        <div className="card-head">
          <h2>{year} so far</h2>
          <button className="link" onClick={() => selectTab("year")}>Details</button>
        </div>
        <div className="kpis">
          <div><span><i className="dot dot-gross" />Gross</span><strong className="c-gross">{money(ytdGross)}</strong></div>
          <div><span><i className="dot dot-net" />Net</span><strong className="c-net">{money(ytdNet)}</strong></div>
          <div><span><i className="dot dot-paye" />PAYE paid</span><strong className="c-paye">{money(ytdPaye)}</strong></div>
        </div>
        <div className="meter" role="img" aria-label={`${Math.round(progress * 100)}% of the ${money(rules.annualThreshold)} threshold`}>
          <div style={{ width: `${progress * 100}%` }} />
        </div>
        <p className="muted small">
          {ytdGross <= rules.annualThreshold
            ? `${money(rules.annualThreshold - ytdGross)} left before the ${money(rules.annualThreshold)} tax threshold.`
            : `${money(ytdGross - rules.annualThreshold)} over the ${money(rules.annualThreshold)} threshold.`}
          {ytdGross > 0 && ` On track for about ${money(projection)} this year.`}
        </p>
      </section>

      <section className="card">
        <h2>Last 6 months</h2>
        <svg viewBox="0 0 360 130" className="chart" role="img" aria-label="Gross income for the last six months">
          {recent.map((r, i) => {
            const h = (r.gross / max) * 84;
            const x = i * 60 + 10;
            return (
              <g key={r.month}>
                {r.gross > 0 && <text x={x + 20} y={96 - h} textAnchor="middle" className="axis">{r.gross >= 1000 ? `${(r.gross / 1000).toFixed(1)}k` : Math.round(r.gross)}</text>}
                <rect x={x} y={102 - h} width="40" height={Math.max(h, r.gross > 0 ? 1 : 0)} rx="4" className={`bar-rect gross ${r.month === month ? "now" : ""}`} />
                <text x={x + 20} y="120" textAnchor="middle" className="axis">{MONTHS[Number(r.month.slice(5)) - 1]?.slice(0, 3)}</text>
              </g>
            );
          })}
        </svg>
      </section>

      <section className="card">
        <h2>Recent days</h2>
        {latest.length === 0 ? (
          <p className="muted">Nothing logged yet. Tap today’s date on the calendar to add your first day.</p>
        ) : (
          <ul className="recent">
            {latest.map((e) => (
              <li key={e.id}>
                <button onClick={() => open({ day: e.date })}>
                  <span className="when">{shortDate(e.date)}</span>
                  <span className="what">
                    {isOther(e) ? `Other · ${e.description || "no description"}` : <>{e.site}{e.hours > 0 && ` · ${hoursText(e.hours)} h`}{e.holiday && " · HOL/TAR"}</>}
                  </span>
                  <span className="amount">{isOther(e) ? "" : money(siteTotal(e))}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
