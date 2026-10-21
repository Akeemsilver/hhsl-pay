import { valueOn } from "../engine";
import { MONTHS, WEEKDAYS, daysOfMonth, hoursText, money, shiftMonth, todayISO } from "../format";
import { useMonth, useYear } from "../hooks";
import { useNav } from "../nav";
import { isOther, othersByDate } from "../model";
import { useStore } from "../store";
import { TopBar } from "../components/TopBar";
import { PlusIcon } from "../components/Icons";
import { CalendarGrid } from "../components/MonthParts";

const DAY_MS = 86_400_000;

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

function longDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]?.slice(0, 3)}`;
}

export function HomeScreen() {
  const { data } = useStore();
  const { open, selectTab } = useNav();
  const today = todayISO();
  const month = today.slice(0, 7);
  const year = Number(today.slice(0, 4));
  const prevMonth = shiftMonth(month, -1);

  const thisMonth = useMonth(month);
  const lastMonth = useMonth(prevMonth);
  const months = useYear(year);
  const prevYearMonths = useYear(year - 1);

  const noSites = Object.keys(valueOn(data.history.sites, today)).length === 0;
  const lastBackup = data.lastBackupAt ? Date.parse(data.lastBackupAt) : 0;
  const backupDue = data.entries.length > 0 && Date.now() - lastBackup > 30 * DAY_MS;

  const worked = new Set([
    ...thisMonth.entries.filter((e) => e.pay.total > 0).map((e) => e.entry.date),
    ...othersByDate(data.entries, month).keys(),
  ]);
  const hours = thisMonth.entries.reduce((s, e) => s + e.entry.hours, 0);
  const diff = thisMonth.gross - lastMonth.gross;

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
    .filter((e) => e.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);
  const siteTotal = (e: (typeof latest)[number]) =>
    months.concat(prevYearMonths).flatMap((m) => m.entries).find((p) => p.entry.id === e.id)?.pay.total ?? 0;

  return (
    <>
      <TopBar title={`${greeting()}`} subtitle={longDate(today)} />

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

      <section className="hero" aria-label="This month">
        <div className="hero-top">
          <span>{MONTHS[thisMonthIndex]} so far</span>
          {lastMonth.gross > 0 && (
            <span className="delta">{diff >= 0 ? "▲" : "▼"} {money(Math.abs(diff))} vs {MONTHS[Number(prevMonth.slice(5)) - 1]?.slice(0, 3)}</span>
          )}
        </div>
        <div className="hero-value">{money(thisMonth.gross)}</div>
        <div className="hero-stats">
          <div><span>Net</span><strong>{money(thisMonth.net)}</strong></div>
          <div><span>Days</span><strong>{worked.size}</strong></div>
          <div><span>Hours</span><strong>{hoursText(hours)}</strong></div>
          <div><span>PAYE</span><strong>{money(thisMonth.paye)}</strong></div>
        </div>
      </section>

      <div className="actions">
        <button className="primary" onClick={() => open({ day: today })}><PlusIcon /> Log today</button>
        <button onClick={() => selectTab("calendar")}>Open calendar</button>
      </div>

      <div className="home-cal">
        <div className="card-head">
          <h2>{MONTHS[thisMonthIndex]}</h2>
          <button className="link" onClick={() => selectTab("calendar")}>Full calendar</button>
        </div>
        <CalendarGrid month={month} days={daysOfMonth(month)} result={thisMonth} today={today} onPick={(d) => open({ day: d })} payerOrder={Object.keys(data.payerNames)} />
      </div>

      <section className="card">
        <div className="card-head">
          <h2>{year} so far</h2>
          <button className="link" onClick={() => selectTab("year")}>Details</button>
        </div>
        <div className="kpis">
          <div><span>Gross</span><strong>{money(ytdGross)}</strong></div>
          <div><span>Net</span><strong>{money(ytdNet)}</strong></div>
          <div><span>PAYE paid</span><strong>{money(ytdPaye)}</strong></div>
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
                <rect x={x} y={102 - h} width="40" height={Math.max(h, r.gross > 0 ? 1 : 0)} rx="4" className={`bar-rect ${r.month === month ? "now" : ""}`} />
                <text x={x + 20} y="120" textAnchor="middle" className="axis">{MONTHS[Number(r.month.slice(5)) - 1]?.slice(0, 3)}</text>
              </g>
            );
          })}
        </svg>
      </section>

      <section className="card">
        <h2>Recent days</h2>
        {latest.length === 0 ? (
          <p className="muted">Nothing logged yet. Tap “Log today” to add your first day.</p>
        ) : (
          <ul className="recent">
            {latest.map((e) => (
              <li key={e.id}>
                <button onClick={() => open({ day: e.date })}>
                  <span className="when">{shortDate(e.date)}</span>
                  <span className="what">
                    {isOther(e) ? `Other · ${e.description || "no description"}` : <>{e.site}{e.hours > 0 && ` · ${hoursText(e.hours)} hrs`}{e.holiday && " · holiday"}</>}
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
