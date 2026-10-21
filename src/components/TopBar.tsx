import type { ReactNode } from "react";
import { useNav } from "../nav";
import { useSiteFilter } from "../filter";
import { useStore } from "../store";
import { BottomSheet } from "./BottomSheet";
import { BackIcon, FilterIcon, GearIcon } from "./Icons";

/** Header for the main tabs: title on the left, settings gear on the right. */
export function TopBar({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
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
        {action}
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
