import type { ReactNode } from "react";
import { useNav } from "../nav";
import { useSiteFilter } from "../filter";
import { useStore } from "../store";
import { BottomSheet } from "./BottomSheet";
import { BackIcon, DownloadIcon, EyeIcon, FilterIcon, GearIcon } from "./Icons";
import { ExportSheet } from "./ExportSheet";
import { TimesheetViewer } from "./TimesheetViewer";
import { PayslipViewer } from "./PayslipViewer";
import { ViewChooser } from "./ViewChooser";
import { todayISO } from "../format";

/**
 * Header for the main tabs: title on the left; on the right the same buttons on every tab (view and download the
 * timesheet or payslip for `month`, filter by location when there is more than one site, settings).
 */
export function TopBar({ title, subtitle, month = todayISO().slice(0, 7) }: { title: ReactNode; subtitle?: ReactNode; month?: string }) {
  const { open, back, loc } = useNav();
  const { data } = useStore();
  const { site, setSite } = useSiteFilter();
  const sites = [...new Set(data.history.sites.flatMap((v) => Object.keys(v.value)))].sort((a, b) => a.localeCompare(b));
  const pick = (s: string | null) => { setSite(s); back(); };
  return (
    <>
    <header className="bar top">
      <div className="titles">
        <h1>{title}</h1>
        {subtitle && <p className="muted small">{subtitle}</p>}
      </div>
      <div className="top-actions">
        <button className="icon gear" aria-label="View timesheet or payslip" title="View timesheet or payslip" onClick={() => open({ sub: "viewpick" })}><EyeIcon /></button>
        <button className="icon gear" aria-label="Download timesheet or payslip" title="Download timesheet or payslip" onClick={() => open({ sub: "export" })}><DownloadIcon /></button>
        {sites.length > 1 && (
          <button className={`icon gear ${site ? "active" : ""}`} aria-label="Filter by location" title="Filter by location" aria-pressed={!!site} onClick={() => open({ sub: "filter" })}>
            <FilterIcon />
          </button>
        )}
        <button className="icon gear" aria-label="Settings" title="Settings" onClick={() => open({ page: "settings" })}>
          <GearIcon />
        </button>
      </div>
    </header>
    {site && (
      <div className="filter-chip" role="status">
        <span>Showing only <strong>{site}</strong></span>
        <button onClick={() => setSite(null)}>Show all</button>
      </div>
    )}
    {loc.sub === "export" && !loc.day && !loc.page && <ExportSheet month={month} />}
    {loc.sub === "view" && !loc.day && !loc.page && <TimesheetViewer month={month} />}
    {loc.sub === "viewpick" && !loc.day && !loc.page && <ViewChooser month={month} />}
    {loc.sub === "viewslip" && !loc.day && !loc.page && <PayslipViewer month={month} />}
    {loc.sub === "filter" && !loc.page && (
      <BottomSheet label="Filter by location" onRequestClose={back}>
        <h2>Filter by location</h2>
        <p className="muted small">Every tab then shows only that location. Tax figures are the location's share of each payslip's PAYE, NIS and surcharge, since tax is worked out on the whole payslip.</p>
        <ul className="filter-list">
          <li><button className={!site ? "on" : ""} aria-pressed={!site} onClick={() => pick(null)}>All locations</button></li>
          {sites.map((n) => <li key={n}><button className={site === n ? "on" : ""} aria-pressed={site === n} onClick={() => pick(n)}>{n}</button></li>)}
        </ul>
      </BottomSheet>
    )}
    </>
  );
}

/** Header for pushed pages: back arrow plus title. */
export function PageHeader({ title }: { title: string }) {
  const { back } = useNav();
  return (
    <header className="bar page">
      <button className="icon" aria-label="Back" onClick={back}><BackIcon /></button>
      <h1>{title}</h1>
      <span className="spacer" />
    </header>
  );
}
