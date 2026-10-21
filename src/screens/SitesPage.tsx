import { useState } from "react";
import type { RoleRates, SiteRates, SiteTable, TierCaps } from "../engine";
import { emptySite } from "../model";
import { useStore } from "../store";
import { PageHeader } from "../components/TopBar";
import { NumInput, VersionBar, addVersion, type Num } from "../components/settingsParts";

function CapsRow({ label, caps, onChange, withX3 }: { label: string; caps: TierCaps; onChange: (c: TierCaps) => void; withX3?: boolean }) {
  const set = (k: keyof TierCaps) => (v: Num) => onChange({ ...caps, [k]: v });
  return (
    <>
      <span className="cap-label">{label}</span>
      <NumInput label={`${label} ×1 hours`} value={caps.x1} onChange={set("x1")} />
      <NumInput label={`${label} ×1.5 hours`} value={caps.x15} onChange={set("x15")} />
      <NumInput label={`${label} ×2 hours`} value={caps.x2} onChange={set("x2")} />
      {withX3 ? <NumInput label={`${label} ×3 hours`} value={caps.x3} onChange={set("x3")} /> : <span />}
    </>
  );
}

function RoleCard({ name, role, onChange, onRename, onRemove }: {
  name: string; role: RoleRates; onChange: (r: RoleRates) => void; onRename: (n: string) => void; onRemove: () => void;
}) {
  const [draft, setDraft] = useState(name);
  return (
    <div className="role-card">
      <label>Role name
        <input value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => draft.trim() && draft !== name && onRename(draft.trim())} />
      </label>
      <div className="grid3">
        <label>Hourly rate<NumInput label={`${name} hourly rate`} value={role.rate} onChange={(v) => onChange({ ...role, rate: v })} /></label>
        <label>Flat day<NumInput label={`${name} flat daily pay`} value={role.dailyPay} onChange={(v) => onChange({ ...role, dailyPay: v })} /></label>
        <label>Holiday day<NumInput label={`${name} holiday daily pay`} value={role.dailyHoliday} onChange={(v) => onChange({ ...role, dailyHoliday: v })} /></label>
      </div>
      <button className="danger" onClick={() => confirm(`Remove the role ${name}? Days that used it go back to the standard rate.`) && onRemove()}>Remove role</button>
    </div>
  );
}

function SiteCard({ name, site, payers, onChange, onRename, onRemove, onRenameRole }: {
  name: string; site: SiteRates; payers: Record<string, string>;
  onChange: (s: SiteRates) => void; onRename: (n: string) => void; onRemove: () => void; onRenameRole: (from: string, to: string) => void;
}) {
  const [draft, setDraft] = useState(name);
  const [newRole, setNewRole] = useState("");
  const set = <K extends keyof SiteRates>(k: K, v: SiteRates[K]) => onChange({ ...site, [k]: v });
  const roles = site.roles ?? {};
  const roleCount = Object.keys(roles).length;
  return (
    <details className="site">
      <summary>
        {name}
        <span className="muted"> · {payers[site.payer] ?? site.payer}{roleCount ? ` · ${roleCount} role${roleCount > 1 ? "s" : ""}` : ""}</span>
      </summary>
      <label>Site name
        <input value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => draft.trim() && draft !== name && onRename(draft.trim())} />
      </label>
      <label>Payslip
        <select value={site.payer} onChange={(e) => set("payer", e.target.value)}>
          {Object.entries(payers).map(([id, n]) => <option key={id} value={id}>{n}</option>)}
        </select>
      </label>
      <div className="grid2">
        <label>Hourly rate<NumInput label="Hourly rate" value={site.baseRate} onChange={(v) => set("baseRate", v)} /></label>
        <label>Lead / instructor rate<NumInput label="Lead rate" value={site.leadRate} onChange={(v) => set("leadRate", v)} /></label>
      </div>

      <h3 className="section-title">Other roles at this site</h3>
      <p className="muted small">A role is a position paid differently from the standard rate, for example a client medic. You pick it on the job under the site.</p>
      {Object.entries(roles).map(([roleName, role]) => (
        <RoleCard
          key={roleName} name={roleName} role={role}
          onChange={(r) => set("roles", { ...roles, [roleName]: r })}
          onRename={(to) => onRenameRole(roleName, to)}
          onRemove={() => set("roles", Object.fromEntries(Object.entries(roles).filter(([k]) => k !== roleName)))}
        />
      ))}
      <div className="row add">
        <input placeholder="New role, e.g. Client medic" aria-label={`New role for ${name}`} value={newRole} onChange={(e) => setNewRole(e.target.value)} />
        <button
          disabled={!newRole.trim() || Object.keys(roles).some((k) => k.toLowerCase() === newRole.trim().toLowerCase())}
          onClick={() => { set("roles", { ...roles, [newRole.trim()]: {} }); setNewRole(""); }}
        >Add role</button>
      </div>

      <h3 className="section-title">Overtime hours</h3>
      <p className="muted small">Hours at each pay multiple per day. Use a large number such as 1000 for “no limit”. Leave blank for none. Roles share these.</p>
      <div className="caps">
        <span /><span className="cap-h">×1</span><span className="cap-h">×1.5</span><span className="cap-h">×2</span><span className="cap-h">×3</span>
        <CapsRow label="Weekday" caps={site.weekday} onChange={(c) => set("weekday", c)} />
        <CapsRow label="Weekend" caps={site.weekend} onChange={(c) => set("weekend", c)} />
        <CapsRow label="Holiday" caps={site.holiday} onChange={(c) => set("holiday", c)} withX3 />
      </div>
      <h3 className="section-title">Flat daily pay</h3>
      <p className="muted small">Optional. If set, the day pays this amount plus any overtime.</p>
      <div className="grid3">
        <label>Standard<NumInput label="Standard daily pay" value={site.dailyStd} onChange={(v) => set("dailyStd", v)} /></label>
        <label>Lead<NumInput label="Lead daily pay" value={site.dailyLead} onChange={(v) => set("dailyLead", v)} /></label>
        <label>Holiday<NumInput label="Holiday daily pay" value={site.dailyHoliday} onChange={(v) => set("dailyHoliday", v)} /></label>
      </div>
      <h3 className="section-title">Rate after a threshold</h3>
      <p className="muted small">For sites like offshore: the hourly rate applies only when hours exceed the threshold.</p>
      <div className="grid2">
        <label>Threshold (hours)<NumInput label="Show rate above hours" value={site.showRateAboveHrs} onChange={(v) => set("showRateAboveHrs", v)} /></label>
        <label>Rate above threshold<NumInput label="Rate above threshold" value={site.rateAboveHrs} onChange={(v) => set("rateAboveHrs", v)} /></label>
      </div>
      <button className="danger" onClick={() => confirm(`Remove ${name} from these rates?`) && onRemove()}>Remove site</button>
    </details>
  );
}

export function SitesPage() {
  const { data, update } = useStore();
  const versions = data.history.sites;
  const [sel, setSel] = useState(versions.at(-1)!.effectiveFrom);
  const [newSite, setNewSite] = useState("");
  const now = versions.find((v) => v.effectiveFrom === sel) ?? versions.at(-1)!;

  const payers = { ...data.payerNames };
  for (const v of versions) for (const s of Object.values(v.value)) payers[s.payer] ??= s.payer;

  const setSites = (fn: (s: SiteTable) => SiteTable) =>
    update((d) => ({
      ...d,
      history: { ...d.history, sites: d.history.sites.map((v) => (v.effectiveFrom === now.effectiveFrom ? { ...v, value: fn(v.value) } : v)) },
    }));

  // Renames carry through every rate version, your entries and the timesheet settings.
  const renameSite = (from: string, to: string) =>
    update((d) => {
      const rename = (t: SiteTable): SiteTable => Object.fromEntries(Object.entries(t).map(([k, v]) => [k === from ? to : k, v]));
      return {
        ...d,
        history: { ...d.history, sites: d.history.sites.map((v) => ({ ...v, value: rename(v.value) })) },
        entries: d.entries.map((e) => (e.site === from ? { ...e, site: to } : e)),
        timesheet: d.timesheet && { ...d.timesheet, rules: d.timesheet.rules.map((r) => (r.site === from ? { ...r, site: to } : r)) },
      };
    });

  const renameRole = (site: string, from: string, to: string) =>
    update((d) => {
      const fix = (t: SiteTable): SiteTable =>
        Object.fromEntries(Object.entries(t).map(([k, v]) => [k, k === site && v.roles
          ? { ...v, roles: Object.fromEntries(Object.entries(v.roles).map(([r, x]) => [r === from ? to : r, x])) }
          : v]));
      return {
        ...d,
        history: { ...d.history, sites: d.history.sites.map((v) => ({ ...v, value: fix(v.value) })) },
        entries: d.entries.map((e) => (e.site === site && e.role === from ? { ...e, role: to } : e)),
        timesheet: d.timesheet && { ...d.timesheet, rules: d.timesheet.rules.map((r) => (r.site === site && r.role === from ? { ...r, role: to } : r)) },
      };
    });

  return (
    <>
      <PageHeader title="Site locations & rates" />
      <p className="muted pad">Add the sites you work at, with their pay rates. When you get a raise, add new rates from its start date. Earlier days keep their old rates.</p>

      <section className="card">
        <VersionBar
          versions={versions} selected={now.effectiveFrom} onSelect={setSel}
          onAdd={(date) => {
            const r = addVersion(versions, sel, date);
            if (typeof r === "string") return r;
            update((d) => ({ ...d, history: { ...d.history, sites: r } }));
            setSel(date);
            return null;
          }}
          onDelete={(date) => {
            update((d) => ({ ...d, history: { ...d.history, sites: d.history.sites.filter((v) => v.effectiveFrom !== date) } }));
            setSel(versions.find((v) => v.effectiveFrom !== date)!.effectiveFrom);
          }}
        />
        {Object.entries(now.value).map(([name, site]) => (
          <SiteCard
            key={`${now.effectiveFrom}:${name}`} name={name} site={site} payers={payers}
            onChange={(s) => setSites((t) => ({ ...t, [name]: s }))}
            onRename={(to) => renameSite(name, to)}
            onRenameRole={(from, to) => renameRole(name, from, to)}
            onRemove={() => setSites((t) => Object.fromEntries(Object.entries(t).filter(([k]) => k !== name)))}
          />
        ))}
        <div className="row add">
          <input placeholder="New site name" aria-label="New site name" value={newSite} onChange={(e) => setNewSite(e.target.value)} />
          <button
            className="primary"
            disabled={!newSite.trim() || Object.keys(now.value).some((k) => k.toLowerCase() === newSite.trim().toLowerCase())}
            onClick={() => { setSites((t) => ({ ...t, [newSite.trim()]: emptySite(Object.keys(payers)[0] ?? "main") })); setNewSite(""); }}
          >Add site</button>
        </div>
      </section>
    </>
  );
}
