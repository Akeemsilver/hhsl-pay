import { useEffect, useState } from "react";
import { valueOn, type RoleRates, type SiteRates, type SiteTable, type TierCaps } from "../engine";
import { DEFAULT_ROLES, emptySite, rolesFor } from "../model";
import { useStore } from "../store";
import { PageHeader } from "../components/TopBar";
import { NumInput, versionLabel, type Num } from "../components/settingsParts";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { applyFrom, changeGroup, commonValue, diffSite, groupSites, patchSite } from "../rateEdit";
import { todayISO } from "../format";

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

function RoleCard({ name, role, site, builtIn, onChange, onRename, onRemove }: {
  name: string; role: RoleRates; site: SiteRates; builtIn: boolean; onChange: (r: RoleRates) => void; onRename: (n: string) => void; onRemove: () => void;
}) {
  const [draft, setDraft] = useState(name);
  const own = !!(role.weekday || role.weekend || role.holiday);
  const [more, setMore] = useState(own);
  return (
    <div className="role-card">
      {builtIn ? <strong>{name}</strong> : (
        <label>Role name
          <input value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => draft.trim() && draft !== name && onRename(draft.trim())} />
        </label>
      )}
      <div className="grid3">
        <label>Hourly rate<NumInput label={`${name} hourly rate`} value={role.rate} onChange={(v) => onChange({ ...role, rate: v })} /></label>
        <label>Flat day<NumInput label={`${name} flat daily pay`} value={role.dailyPay} onChange={(v) => onChange({ ...role, dailyPay: v })} /></label>
        <label>Holiday day<NumInput label={`${name} holiday daily pay`} value={role.dailyHoliday} onChange={(v) => onChange({ ...role, dailyHoliday: v })} /></label>
      </div>
      <button className="more" aria-expanded={more} onClick={() => setMore(!more)}>
        {more ? "Less ▴" : "More ▾"} <span className="muted small">· hours at 1x, 1.5x, 2x, 3x{own ? " (own hours set)" : " (same as site)"}</span>
      </button>
      {more && (
        <div className="more-panel">
          <label className="check">
            <input type="checkbox" aria-label={`${name} has its own overtime hours`} checked={own}
              onChange={(e) => onChange(e.target.checked
                ? { ...role, weekday: { ...site.weekday }, weekend: { ...site.weekend }, holiday: { ...site.holiday } }
                : { ...role, weekday: undefined, weekend: undefined, holiday: undefined })} />
            {" "}Different hours for {name} than the rest of the site
          </label>
          {own ? (
            <>
              <div className="caps">
                <span /><span className="cap-h">1x</span><span className="cap-h">1.5x</span><span className="cap-h">2x</span><span className="cap-h">3x</span>
                <CapsRow label="Weekday" caps={role.weekday ?? {}} onChange={(c) => onChange({ ...role, weekday: c })} />
                <CapsRow label="Weekend" caps={role.weekend ?? {}} onChange={(c) => onChange({ ...role, weekend: c })} />
                <CapsRow label="Holiday" caps={role.holiday ?? {}} onChange={(c) => onChange({ ...role, holiday: c })} withX3 />
              </div>
              <p className="muted small">Example: <strong>8</strong> under 1x and <strong>4</strong> under 1.5x means the first 8 hours of the day are paid at 1x and the next 4 hours at 1.5x. Type <strong>1000</strong> for “no limit”.</p>
            </>
          ) : <p className="muted small">{name} uses the site's hours (see “Overtime hours” lower on this page).</p>}
        </div>
      )}
      {builtIn
        ? <p className="muted small">Leave blank to pay this role at the site's standard rate.</p>
        : <button className="danger" onClick={() => confirm(`Remove the role ${name}? Days that used it go back to the standard rate.`) && onRemove()}>Remove role</button>}
    </div>
  );
}

function SiteCard({ name, saved, payers, onSave, onRename, onRemove, onRenameRole }: {
  name: string; saved: SiteRates; payers: Record<string, string>;
  onSave: (draft: SiteRates, from: string) => void; onRename: (n: string) => void; onRemove: () => void; onRenameRole: (from: string, to: string) => void;
}) {
  const savedKey = JSON.stringify(saved);
  const [site, setSite] = useState<SiteRates>(saved);
  useEffect(() => setSite(JSON.parse(savedKey) as SiteRates), [savedKey]);
  const dirty = JSON.stringify(site) !== savedKey;
  const [from, setFrom] = useState(todayISO());
  const onChange = (s: SiteRates) => setSite(s);
  const [draft, setDraft] = useState(name);
  const [newRole, setNewRole] = useState("");
  const set = <K extends keyof SiteRates>(k: K, v: SiteRates[K]) => onChange({ ...site, [k]: v });
  const roles = site.roles ?? {};
  const roleCount = Object.values(roles).filter((r) => r.rate || r.dailyPay || r.dailyHoliday || r.weekday || r.weekend || r.holiday).length;
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

      <h3 className="section-title">Role rates</h3>
      <p className="muted small">You pick the role on the job, under the site. Give a role its own pay here, or leave it blank to use the site's standard rate.</p>
      {rolesFor(site).map((roleName) => {
        const builtIn = (DEFAULT_ROLES as readonly string[]).some((d) => d.toLowerCase() === roleName.toLowerCase());
        const key = Object.keys(roles).find((k) => k.toLowerCase() === roleName.toLowerCase()) ?? roleName;
        return (
          <RoleCard
            key={roleName} name={roleName} role={roles[key] ?? {}} site={site} builtIn={builtIn}
            onChange={(r) => set("roles", { ...roles, [key]: r })}
            onRename={(to) => onRenameRole(roleName, to)}
            onRemove={() => set("roles", Object.fromEntries(Object.entries(roles).filter(([k]) => k !== key)))}
          />
        );
      })}
      <div className="row add">
        <input placeholder="Add another role" aria-label={`New role for ${name}`} value={newRole} onChange={(e) => setNewRole(e.target.value)} />
        <button
          disabled={!newRole.trim() || rolesFor(site).some((k) => k.toLowerCase() === newRole.trim().toLowerCase())}
          onClick={() => { set("roles", { ...roles, [newRole.trim()]: {} }); setNewRole(""); }}
        >Add role</button>
      </div>

      <h3 className="section-title">Overtime hours</h3>
      <p className="muted small">How many hours of each day are paid at 1x, 1.5x, 2x and 3x. Example: 8 under 1x and 4 under 1.5x means the first 8 hours at 1x, then 4 hours at 1.5x. Type 1000 for “no limit”. A role can have its own hours under “More” in its card.</p>
      <div className="caps">
        <span /><span className="cap-h">1x</span><span className="cap-h">1.5x</span><span className="cap-h">2x</span><span className="cap-h">3x</span>
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
      <button className="danger" onClick={() => confirm(`Remove ${name} and its rates?`) && onRemove()}>Remove site</button>
      {dirty && (
        <div className="save-bar" role="group" aria-label={`Save changes to ${name}`}>
          <div className="save-row">
            <label>Take effect from
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value || todayISO())} />
            </label>
            <button onClick={() => setSite(saved)}>Discard</button>
            <button className="primary" onClick={() => onSave(site, from)}>Save</button>
          </div>
          <p className="muted small">{from === todayISO() ? "Starts today; earlier days keep their old rates." : from < todayISO() ? "Past date: days since then are repriced." : "Nothing changes until that day."}</p>
        </div>
      )}
    </details>
  );
}

function GroupRates({ payer, name, table, onApply }: {
  payer: string; name: string; table: SiteTable;
  onApply: (c: { baseRate?: number; leadRate?: number; caps?: { weekday: TierCaps; weekend: TierCaps; holiday: TierCaps } }, from: string) => void;
}) {
  const { change, skip } = groupSites(table, payer);
  const mine = change.map((n) => table[n]!);
  const curStd = commonValue(mine.map((m) => m.baseRate).filter((v) => v !== undefined));
  const curLead = commonValue(mine.map((m) => m.leadRate).filter((v) => v !== undefined));
  const curCaps = { weekday: commonValue(mine.map((m) => m.weekday)) ?? {}, weekend: commonValue(mine.map((m) => m.weekend)) ?? {}, holiday: commonValue(mine.map((m) => m.holiday)) ?? {} };
  const key = JSON.stringify([curStd, curLead, curCaps, change]);
  const [std, setStd] = useState<Num>(curStd);
  const [lead, setLead] = useState<Num>(curLead);
  const [caps, setCaps] = useState(curCaps);
  const [more, setMore] = useState(false);
  const [from, setFrom] = useState(todayISO());
  const [ask, setAsk] = useState(false);
  useEffect(() => { setStd(curStd); setLead(curLead); setCaps(curCaps); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const capsChanged = JSON.stringify(caps) !== JSON.stringify(curCaps);
  const changed = std !== curStd || lead !== curLead || capsChanged;
  if (change.length === 0) return null;
  return (
    <section className="card group-rates" aria-label={`Rates for ${name}`}>
      <h2>{name}</h2>
      <p className="muted small">The same rates for all {change.length} hourly site{change.length === 1 ? "" : "s"}: {change.join(", ")}.</p>
      <div className="grid2">
        <label>Standard rate ($/h)<NumInput label={`${name} standard rate`} value={std} onChange={setStd} /></label>
        <label>Team lead rate ($/h)<NumInput label={`${name} team lead rate`} value={lead} onChange={setLead} /></label>
      </div>
      <button className="more" aria-expanded={more} onClick={() => setMore(!more)}>{more ? "Less ▴" : "More ▾"} <span className="muted small">· hours at 1x, 1.5x, 2x, 3x</span></button>
      {more && (
        <div className="more-panel">
          <div className="caps">
            <span /><span className="cap-h">1x</span><span className="cap-h">1.5x</span><span className="cap-h">2x</span><span className="cap-h">3x</span>
            <CapsRow label="Weekday" caps={caps.weekday} onChange={(c) => setCaps({ ...caps, weekday: c })} />
            <CapsRow label="Weekend" caps={caps.weekend} onChange={(c) => setCaps({ ...caps, weekend: c })} />
            <CapsRow label="Holiday" caps={caps.holiday} onChange={(c) => setCaps({ ...caps, holiday: c })} withX3 />
          </div>
          <p className="muted small">Example: 12 under 1x means the first 12 hours of each day are paid at 1x. Type 1000 for “no limit”.</p>
        </div>
      )}
      <label>Take effect from
        <input type="date" aria-label={`${name} take effect from`} value={from} onChange={(e) => setFrom(e.target.value || todayISO())} />
      </label>
      <p className="muted small">{from === todayISO() ? "Today: it starts now, and earlier days keep their old rates." : from < todayISO() ? "A past date: every day since then is repriced with the new rates." : "A future date: nothing changes until that day."}</p>
      <button className="primary wide" disabled={!changed} onClick={() => setAsk(true)}>Change for all sites</button>
      {skip.length > 0 && <p className="muted small">Not changed (flat pay or a threshold rate): {skip.join(", ")}. Edit those below.</p>}
      {ask && (
        <ConfirmDialog
          title={`Change ${name}?`}
          message={`${std !== curStd ? `Standard rate ${curStd ?? "-"} → ${std ?? "-"}. ` : ""}${lead !== curLead ? `Team lead rate ${curLead ?? "-"} → ${lead ?? "-"}. ` : ""}${capsChanged ? "Hours at 1x, 1.5x, 2x and 3x change too. " : ""}Applies to ${change.join(", ")} from ${from}${from === todayISO() ? " (today)" : ""}.`}
          confirmLabel="Change for all sites" cancelLabel="Cancel" safe
          onCancel={() => setAsk(false)}
          onConfirm={() => { setAsk(false); onApply({ baseRate: std, leadRate: lead, caps: capsChanged ? caps : undefined }, from); }}
        />
      )}
    </section>
  );
}

export function SitesPage() {
  const { data, update } = useStore();
  const versions = data.history.sites;
  const [asOf, setAsOf] = useState(todayISO());
  const [newSite, setNewSite] = useState("");
  const table = valueOn(versions, asOf < versions[0]!.effectiveFrom ? versions[0]!.effectiveFrom : asOf);

  const payers = { ...data.payerNames };
  for (const v of versions) for (const s of Object.values(v.value)) payers[s.payer] ??= s.payer;
  const groups = [...new Set(Object.values(table).map((s) => s.payer))];

  const setVersions = (fn: (list: typeof versions) => typeof versions) =>
    update((d) => ({ ...d, history: { ...d.history, sites: fn(d.history.sites) } }));

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

  const saveSite = (name: string, saved: SiteRates, draft: SiteRates, from: string) => {
    const patch = diffSite(saved, draft);
    // A site with no rates yet (just added) gets its first rates for all days; otherwise they start on the chosen date.
    const isNew = !(saved.baseRate || saved.leadRate || saved.dailyStd || saved.dailyLead || saved.dailyHoliday || saved.rateAboveHrs);
    const start = isNew ? versions[0]!.effectiveFrom : from;
    setVersions((list) => applyFrom(list, start, (t) => patchSite(t, name, patch, draft)));
    if (start > todayISO()) setAsOf(start);
  };

  return (
    <>
      <PageHeader title="Site locations & rates" />
      <p className="muted pad">Change the rates for a whole payslip group in one go, or edit one site. Every change has a “Take effect from” date, which is today unless you pick another day. Earlier days keep their old rates, so a raise never changes past pay.</p>

      {asOf !== todayISO() && (
        <p className="notice">Showing the rates in force on <strong>{asOf}</strong>. <button className="link" onClick={() => setAsOf(todayISO())}>Back to today</button></p>
      )}

      {groups.map((g) => (
        <GroupRates
          key={g} payer={g} name={payers[g] ?? g} table={table}
          onApply={(c, from) => { setVersions((list) => applyFrom(list, from, (t) => changeGroup(t, g, c))); if (from > todayISO()) setAsOf(from); }}
        />
      ))}

      <h2 className="section-title">Each site</h2>
      <section className="card">
        {Object.entries(table).map(([name, site]) => (
          <SiteCard
            key={name} name={name} saved={site} payers={payers}
            onSave={(draft, from) => saveSite(name, site, draft, from)}
            onRename={(to) => renameSite(name, to)}
            onRenameRole={(from, to) => renameRole(name, from, to)}
            onRemove={() => setVersions((list) => list.map((v) => ({ ...v, value: Object.fromEntries(Object.entries(v.value).filter(([k]) => k !== name)) })))}
          />
        ))}
        <div className="row add">
          <input placeholder="New site name" aria-label="New site name" value={newSite} onChange={(e) => setNewSite(e.target.value)} />
          <button
            className="primary"
            disabled={!newSite.trim() || Object.keys(table).some((k) => k.toLowerCase() === newSite.trim().toLowerCase())}
            onClick={() => { setVersions((list) => list.map((v) => ({ ...v, value: { ...v.value, [newSite.trim()]: emptySite(groups[0] ?? Object.keys(payers)[0] ?? "main") } }))); setNewSite(""); }}
          >Add site</button>
        </div>
      </section>

      <details className="card history">
        <summary>Rate history (advanced)</summary>
        <p className="muted small">Each time you save a change with a “Take effect from” date, a new set of rates starts on that day. Older days always use the set that was in force on their date.</p>
        <label>Show the rates in force on
          <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value || todayISO())} />
        </label>
        <ul className="plain small">
          {versions.map((v) => (
            <li key={v.effectiveFrom} className="row">
              <span>{versionLabel(v, versions)}</span>
              <button className="danger" disabled={versions.length < 2} onClick={() => confirm(`Delete "${versionLabel(v, versions)}"? Those days will use the rates before them.`) && setVersions((list) => list.filter((x) => x.effectiveFrom !== v.effectiveFrom))}>Delete</button>
            </li>
          ))}
        </ul>
      </details>
    </>
  );
}
