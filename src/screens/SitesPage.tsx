import { useEffect, useState } from "react";
import { valueOn, type RoleRates, type SiteRates, type SiteTable, type TierCaps } from "../engine";
import { DEFAULT_ROLES, emptySite, isFixedDay, isOther, payerLabel, rolesFor } from "../model";
import { useStore } from "../store";
import { useNav } from "../nav";
import { SITE_COLORS, siteColorIndex } from "../siteColor";
import { PageHeader } from "../components/TopBar";
import { NumInput, TakeEffect, versionLabel, type Num } from "../components/settingsParts";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { applyFrom, changeGroup, commonValue, diffSite, groupSites, isFarBack, patchSite, rateImpact, type GroupChange, type Impact } from "../rateEdit";
import { HOURS_TEMPLATES, applyTemplate, detectTemplate, templateById } from "../templates";
import { dmy, todayISO } from "../format";

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

/** A small two-way switch. */
function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: Array<[T, string]>; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg-sm" role="group" aria-label={label}>
      {options.map(([v, t]) => <button key={v} type="button" aria-pressed={value === v} className={value === v ? "on" : ""} onClick={() => onChange(v)}>{t}</button>)}
    </div>
  );
}

/** Yes or No: does a job at this site have a lunch check? No hides the lunch options on the day form. Not shown for a fixed day rate. */
function LunchChoice({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="lunch-choice" role="group" aria-label="Job requires lunch check">
      <span className="lbl">Job requires lunch check</span>
      <Seg label="Lunch check" value={value ? "yes" : "no"} options={[["yes", "Yes"], ["no", "No"]]} onChange={(v) => onChange(v === "yes")} />
      <span className="muted small">{value ? "The day form asks if lunch was paid and takes unpaid lunch off." : "No lunch options on the day form; the whole time between start and end is paid."}</span>
    </div>
  );
}

/** Role list, or a box you type the location in, which goes in the time sheet's Client assigned column. */
function RoleFieldChoice({ value, onChange }: { value: SiteRates["roleField"]; onChange: (v: SiteRates["roleField"]) => void }) {
  const typed = !!value;
  return (
    <div className="lunch-choice" role="group" aria-label="Role field">
      <span className="lbl">Role box on the day form</span>
      <Seg label="Role box" value={typed ? "typed" : "fixed"} options={[["fixed", "Standard roles"], ["typed", "Type in a location"]]} onChange={(v) => onChange(v === "fixed" ? undefined : (value ?? { label: "Location", placeholder: "Dolphin platform" }))} />
      {typed ? (
        <>
          <span className="muted small">On the day form you type the location, for example:</span>
          <input readOnly tabIndex={-1} aria-label="Example of the location box" className="example-box" placeholder={`e.g. ${value!.placeholder ?? "Dolphin platform"}`} />
          <span className="muted small">The location you type goes in the Client assigned column of the timesheet.</span>
        </>
      ) : (
        <span className="muted small">The day form shows the Role list. Example: Client medic and your own roles.</span>
      )}
    </div>
  );
}

const sameCaps = (a: TierCaps = {}, b: TierCaps = {}) => (["x1", "x15", "x2"] as const).every((k) => (a[k] ?? 0) === (b[k] ?? 0));
const CAPS_HEAD = <><span /><span className="cap-h">1x</span><span className="cap-h">1.5x</span><span className="cap-h">2x</span><span className="cap-h">3x</span></>;

/** Keeps the "rate after the covered hours" switch-on point in step with the smallest covered-hours number. */
function fixify(s: SiteRates): SiteRates {
  const covered = [s.weekday.x1, s.weekend.x1, s.holiday.x1].filter((h): h is number => !!h && h > 0 && h < 1000);
  return { ...s, showRateAboveHrs: covered.length && (s.rateAboveHrs ?? 0) > 0 ? Math.min(...covered) : undefined };
}

/**
 * A fixed day rate: one amount pays the first N hours of the day (lunch makes no difference), then the hours after
 * that are paid at the hourly rate times 1.5, 2 or 3, with limits you set. Weekend and holiday can be "same as weekday".
 */
function FixedDayEditor({ site, onChange }: { site: SiteRates; onChange: (s: SiteRates) => void }) {
  const [weekendOwn, setWeekendOwn] = useState(!(sameCaps(site.weekend, site.weekday) && !site.dailyWeekend));
  const [holidayOwn, setHolidayOwn] = useState(!(sameCaps(site.holiday, site.weekday) && !site.dailyHoliday));
  const put = (next: SiteRates) => onChange(fixify(next));
  const hasOvertime = [site.weekday, site.weekend, site.holiday].some((c) => (c.x15 ?? 0) > 0 || (c.x2 ?? 0) > 0 || (c.x3 ?? 0) > 0) || (site.rateAboveHrs ?? 0) > 0;
  const setWeekday = (c: TierCaps) => put({ ...site, weekday: c, ...(weekendOwn ? {} : { weekend: { ...c } }), ...(holidayOwn ? {} : { holiday: { ...c } }) });
  return (
    <div className="pay-block">
      <h4>Weekday</h4>
      <div className="grid2">
        <label>Fixed day rate ($)<NumInput label="Fixed day rate" value={site.dailyStd} onChange={(v) => put({ ...site, dailyStd: v })} /></label>
        <label>Team lead day rate ($, if different)<NumInput label="Team lead day rate" value={site.dailyLead !== site.dailyStd ? site.dailyLead : undefined} onChange={(v) => put({ ...site, dailyLead: v })} /></label>
      </div>
      <div className="caps">{CAPS_HEAD}<CapsRow label="Hours" caps={site.weekday} onChange={setWeekday} /></div>
      <p className="muted small">1x: the hours the fixed day rate covers (for example 12). Leave it blank for a flat rate that pays the whole day, like HHSL Compound. Then the hours paid at 1.5x, 2x and 3x. Type 1000 for “no limit”.</p>
      {hasOvertime && (
        <>
          <label>Hourly rate for the hours after 1x ($/h)<NumInput label="Hourly rate after the fixed hours" value={site.rateAboveHrs} onChange={(v) => put({ ...site, rateAboveHrs: v })} /></label>
          <p className="muted small">{(site.weekday.x1 ?? 0) > 0 ? `1x is the first ${site.weekday.x1} hours, paid by the fixed day rate. Each hour after that is paid at this rate times 1.5, 2 or 3.` : "Set the 1x hours above first."}</p>
        </>
      )}

      <h4>Weekend</h4>
      <label className="check">
        <input type="checkbox" aria-label="Weekend same as weekday" checked={!weekendOwn} onChange={(e) => { setWeekendOwn(!e.target.checked); if (e.target.checked) put({ ...site, weekend: { ...site.weekday }, dailyWeekend: undefined }); }} />
        Same as weekday
      </label>
      {weekendOwn && (
        <>
          <label>Weekend fixed day rate ($)<NumInput label="Weekend fixed day rate" value={site.dailyWeekend} onChange={(v) => put({ ...site, dailyWeekend: v })} /></label>
          <div className="caps">{CAPS_HEAD}<CapsRow label="Hours" caps={site.weekend} onChange={(c) => put({ ...site, weekend: c })} /></div>
        </>
      )}

      <h4>Holiday / TAR</h4>
      <label className="check">
        <input type="checkbox" aria-label="Holiday same as weekday" checked={!holidayOwn} onChange={(e) => { setHolidayOwn(!e.target.checked); if (e.target.checked) put({ ...site, holiday: { ...site.weekday }, dailyHoliday: undefined }); }} />
        Same as weekday
      </label>
      {holidayOwn && (
        <>
          <label>Holiday fixed day rate ($)<NumInput label="Holiday fixed day rate" value={site.dailyHoliday} onChange={(v) => put({ ...site, dailyHoliday: v })} /></label>
          <div className="caps">{CAPS_HEAD}<CapsRow label="Hours" caps={site.holiday} onChange={(c) => put({ ...site, holiday: c })} withX3 /></div>
        </>
      )}
    </div>
  );
}

function pickTemplate(id: string) {
  const t = templateById(id)!;
  return { weekday: { ...t.weekday }, weekend: { ...t.weekend }, holiday: { ...t.holiday } };
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
          <label>Hours at 1x, 1.5x, 2x, 3x
            <select aria-label={`${name} hours template`} value={own ? (detectTemplate(role as Pick<SiteRates, "weekday" | "weekend" | "holiday"> & RoleRates) ?? "custom") : "site"}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "site") onChange({ ...role, weekday: undefined, weekend: undefined, holiday: undefined });
                else if (v === "custom") onChange({ ...role, weekday: role.weekday ?? { ...site.weekday }, weekend: role.weekend ?? { ...site.weekend }, holiday: role.holiday ?? { ...site.holiday } });
                else onChange({ ...role, ...pickTemplate(v) });
              }}>
              <option value="site">Same as the rest of the site</option>
              {HOURS_TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              <option value="custom">Custom hours…</option>
            </select>
          </label>
          {own && templateById(detectTemplate(role as Pick<SiteRates, "weekday" | "weekend" | "holiday"> & RoleRates)) && <p className="muted small">{templateById(detectTemplate(role as Pick<SiteRates, "weekday" | "weekend" | "holiday"> & RoleRates))!.description}</p>}
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

function SiteCard({ name, saved, payers, firstDate, impactFor, onSave, onRename, onRemove, onRenameRole }: {
  name: string; saved: SiteRates; payers: Record<string, string>; firstDate: string; impactFor: (draft: SiteRates, from: string) => Impact;
  onSave: (draft: SiteRates, from: string) => void; onRename: (n: string) => void; onRemove: () => void; onRenameRole: (from: string, to: string) => void;
}) {
  const { data, update } = useStore();
  const colorNow = siteColorIndex(data, name);
  const savedKey = JSON.stringify(saved);
  const [site, setSite] = useState<SiteRates>(saved);
  useEffect(() => setSite(JSON.parse(savedKey) as SiteRates), [savedKey]);
  const dirty = JSON.stringify(site) !== savedKey;
  const [from, setFrom] = useState(todayISO());
  const onChange = (s: SiteRates) => setSite(s);
  const [draft, setDraft] = useState(name);
  const [newRole, setNewRole] = useState("");
  const [fixedMode, setFixedMode] = useState(isFixedDay(saved));
  useEffect(() => setFixedMode(isFixedDay(JSON.parse(savedKey) as SiteRates)), [savedKey]);
  const set = <K extends keyof SiteRates>(k: K, v: SiteRates[K]) => onChange({ ...site, [k]: v });
  const roles = site.roles ?? {};
  const roleCount = Object.values(roles).filter((r) => r.rate || r.dailyPay || r.dailyHoliday || r.weekday || r.weekend || r.holiday).length;
  return (
    <details className="site">
      <summary>
        {name}
        <span className="muted"> · {payers[site.payer] ?? site.payer}{site.baseRate ? ` · $${site.baseRate}/h${site.leadRate && site.leadRate !== site.baseRate ? ` · lead $${site.leadRate}` : ""}` : ""}{isFixedDay(site) ? ` · $${site.dailyStd}/day` : ""}{roleCount ? ` · ${roleCount} role${roleCount > 1 ? "s" : ""}` : ""}</span>
      </summary>
      <label>Site name
        <input value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => draft.trim() && draft !== name && onRename(draft.trim())} />
      </label>
      <div>
        <span className="muted small">Calendar colour</span>
        <div className="swatches">
          {SITE_COLORS.map((c, i) => (
            <button key={c.name} type="button" className={`color-swatch ${i === colorNow ? "on" : ""}`} style={{ background: c.hex }} aria-label={c.name} aria-pressed={i === colorNow}
              onClick={() => update((d) => ({ ...d, siteColors: { ...d.siteColors, [name.toLowerCase()]: i } }))} />
          ))}
        </div>
      </div>
      <label>Payslip
        <select value={site.payer} onChange={(e) => set("payer", e.target.value)}>
          {Object.entries(payers).map(([id, n]) => <option key={id} value={id}>{n}</option>)}
        </select>
      </label>
      <RoleFieldChoice value={site.roleField} onChange={(v) => set("roleField", v)} />
      <div className="lunch-choice">
        <span className="lbl">How the site is paid</span>
        <Seg label="How the site is paid" value={fixedMode ? "fixed" : "hourly"} options={[["hourly", "Hourly"], ["fixed", "Fixed day rate"]]}
          onChange={(m) => { setFixedMode(m === "fixed"); if (m === "hourly") onChange({ ...site, dailyStd: undefined, dailyLead: undefined, dailyWeekend: undefined, dailyHoliday: undefined, showRateAboveHrs: undefined, rateAboveHrs: undefined }); }} />
      </div>
      {fixedMode ? (
        <>
          <FixedDayEditor key={savedKey} site={site} onChange={onChange} />
          <p className="muted small">A fixed day rate pays the same for the day whatever the lunch, so there is no lunch check for {name}.</p>
        </>
      ) : (
        <>
          <LunchChoice value={site.lunch !== false} onChange={(v) => set("lunch", v ? undefined : false)} />
          <div className="grid2">
            <label>Standard rate ($/h)<NumInput label="Hourly rate" value={site.baseRate} onChange={(v) => set("baseRate", v)} /></label>
            <label>Team lead rate ($/h)<NumInput label="Lead rate" value={site.leadRate} onChange={(v) => set("leadRate", v)} /></label>
          </div>
        </>
      )}
      <p className="muted small">{name} is in {payers[site.payer] ?? site.payer}. Changing the rates here only changes {name}. When you later use “Change for all sites” on the group, you can choose to leave {name} out.</p>

      {!site.roleField && (
        <>
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
        </>
      )}

      {!fixedMode && (
        <>
      <h3 className="section-title">Overtime hours</h3>
      <label>Start from a template
        <select aria-label={`${name} hours template`} value={detectTemplate(site) ?? ""} onChange={(e) => e.target.value && onChange(applyTemplate(site, e.target.value))}>
          <option value="">{detectTemplate(site) ? "" : "Custom hours"}</option>
          {HOURS_TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </label>
      {templateById(detectTemplate(site)) && <p className="muted small">{templateById(detectTemplate(site))!.description}</p>}
      <p className="muted small">How many hours of each day are paid at 1x, 1.5x, 2x and 3x. Example: 8 under 1x and 4 under 1.5x means the first 8 hours at 1x, then 4 hours at 1.5x. Type 1000 for “no limit”. A role can have its own hours under “More” in its card.</p>
      <div className="caps">
        <span /><span className="cap-h">1x</span><span className="cap-h">1.5x</span><span className="cap-h">2x</span><span className="cap-h">3x</span>
        <CapsRow label="Weekday" caps={site.weekday} onChange={(c) => set("weekday", c)} />
        <CapsRow label="Weekend" caps={site.weekend} onChange={(c) => set("weekend", c)} />
        <CapsRow label="Holiday" caps={site.holiday} onChange={(c) => set("holiday", c)} withX3 />
      </div>
        </>
      )}
      {!fixedMode && (site.showRateAboveHrs ?? 0) > 0 && (
        <>
      <h3 className="section-title">Rate after a threshold</h3>
      <p className="muted small">For sites like offshore: the hourly rate applies only when hours exceed the threshold.</p>
      <div className="grid2">
        <label>Threshold (hours)<NumInput label="Show rate above hours" value={site.showRateAboveHrs} onChange={(v) => set("showRateAboveHrs", v)} /></label>
        <label>Rate above threshold<NumInput label="Rate above threshold" value={site.rateAboveHrs} onChange={(v) => set("rateAboveHrs", v)} /></label>
      </div>
        </>
      )}
      <button className="danger" onClick={() => confirm(`Remove ${name} and its rates?`) && onRemove()}>Remove site</button>
      {dirty && (
        <div className="save-bar" role="group" aria-label={`Save changes to ${name}`}>
          <TakeEffect from={from} setFrom={setFrom} firstDate={firstDate} label={`${name} take effect from`} impact={from < todayISO() ? impactFor(site, from) : undefined} />
          <div className="save-row">
            <button onClick={() => setSite(saved)}>Discard</button>
            <button className="primary" onClick={() => onSave(site, from)}>Save</button>
          </div>
        </div>
      )}
      <button className="more close-site" onClick={(e) => { const d = e.currentTarget.closest("details")!; d.open = false; d.scrollIntoView({ block: "nearest" }); }}>Close {name} ▴</button>
    </details>
  );
}

function GroupRates({ payer, name, table, firstDate, impactFor, farBack, onApply }: {
  payer: string; name: string; table: SiteTable; firstDate: string;
  impactFor: (c: GroupChange, from: string) => Impact; farBack: (from: string) => boolean;
  onApply: (c: GroupChange, from: string) => void;
}) {
  const { change, skip } = groupSites(table, payer);
  const mine = change.map((n) => table[n]!);
  const curStd = commonValue(mine.map((m) => m.baseRate).filter((v) => v !== undefined));
  const curLead = commonValue(mine.map((m) => m.leadRate).filter((v) => v !== undefined));
  const curCaps = { weekday: commonValue(mine.map((m) => m.weekday)) ?? {}, weekend: commonValue(mine.map((m) => m.weekend)) ?? {}, holiday: commonValue(mine.map((m) => m.holiday)) ?? {} };
  const key = JSON.stringify([curStd, curLead, curCaps, change, mine.map((m) => [m.baseRate, m.leadRate])]);
  const [std, setStd] = useState<Num>(curStd);
  const [lead, setLead] = useState<Num>(curLead);
  const [sameLead, setSameLead] = useState(curStd !== undefined && curStd === curLead);
  const [caps, setCaps] = useState(curCaps);
  const [more, setMore] = useState(false);
  const [from, setFrom] = useState(todayISO());
  const [ask, setAsk] = useState(false);
  // Sites that already have their own rate are left out by default, so a group change never overwrites them by accident.
  const ownRate = (n: string) => { const t = table[n]!; return (curStd !== undefined && t.baseRate !== curStd) || (curLead !== undefined && t.leadRate !== undefined && t.leadRate !== curLead); };
  const defaultExcept = change.filter(ownRate);
  const [except, setExcept] = useState<string[]>(defaultExcept);
  useEffect(() => { setStd(curStd); setLead(curLead); setSameLead(curStd !== undefined && curStd === curLead); setCaps(curCaps); setExcept(defaultExcept); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const newLead = sameLead ? std : lead;
  const capsChanged = JSON.stringify(caps) !== JSON.stringify(curCaps);
  const changed = std !== curStd || newLead !== curLead || capsChanged;
  const change_: GroupChange = { baseRate: std, leadRate: newLead, caps: capsChanged ? caps : undefined, except };
  const included = change.filter((n) => !except.includes(n));
  if (change.length === 0) return null;
  const impact = from < todayISO() ? impactFor(change_, from) : undefined;
  return (
    <section className="card group-rates" aria-label={`Rates for ${name}`}>
      <h2>{name}</h2>
      <p className="muted small">{included.length === change.length ? `${change.length} hourly site${change.length === 1 ? "" : "s"}` : `${included.length} of ${change.length} hourly sites`}: {included.join(", ") || "none"}.{except.length > 0 && <> Left out: <strong>{except.join(", ")}</strong>.</>}</p>
      <div className="grid2">
        <label>Standard rate ($/h)<NumInput label={`${name} standard rate`} value={std} onChange={setStd} /></label>
        <label>Team lead rate ($/h)<NumInput label={`${name} team lead rate`} value={sameLead ? std : lead} onChange={(v) => { setSameLead(false); setLead(v); }} /></label>
      </div>
      <label className="check"><input type="checkbox" aria-label={`${name} team lead same as standard`} checked={sameLead} onChange={(e) => setSameLead(e.target.checked)} /> {" "}Team lead is paid the same as standard</label>
      <button className="more" aria-expanded={more} onClick={() => setMore(!more)}>{more ? "Less ▴" : "More… ▾"} <span className="muted small">· hours, except, start date{except.length ? ` · ${except.length} left out` : ""}</span></button>
      {more && (
        <div className="more-panel">
          <h3 className="sub">Hours at 1x, 1.5x, 2x, 3x</h3>
          <label>Start from a template
            <select aria-label={`${name} hours template`} value={detectTemplate(caps) ?? ""} onChange={(e) => e.target.value && setCaps(applyTemplate(caps, e.target.value))}>
              <option value="">{detectTemplate(caps) ? "" : "Custom hours"}</option>
              {HOURS_TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
          <div className="caps">
            <span /><span className="cap-h">1x</span><span className="cap-h">1.5x</span><span className="cap-h">2x</span><span className="cap-h">3x</span>
            <CapsRow label="Weekday" caps={caps.weekday} onChange={(c) => setCaps({ ...caps, weekday: c })} />
            <CapsRow label="Weekend" caps={caps.weekend} onChange={(c) => setCaps({ ...caps, weekend: c })} />
            <CapsRow label="Holiday / TAR" caps={caps.holiday} onChange={(c) => setCaps({ ...caps, holiday: c })} withX3 />
          </div>
          <p className="muted small">Example: 12 under 1x means the first 12 hours of each day are paid at 1x. Type 1000 for “no limit”. Holiday / TAR is used for a holiday or a turnaround / shutdown, even on a weekend.</p>
          <h3 className="sub">Except</h3>
          <div className="except-panel" role="group" aria-label={`Sites to leave out of ${name} changes`}>
            <p className="muted small">Tick a site to <strong>leave it out</strong> of “Change for all sites”. Sites with their own rate start out ticked.</p>
            {change.map((n) => (
              <label key={n} className="check">
                <input type="checkbox" aria-label={`Leave out ${n}`} checked={except.includes(n)} onChange={(e) => setExcept(e.target.checked ? [...except, n] : except.filter((x) => x !== n))} />
                {" "}{n}{table[n]!.baseRate !== undefined && <span className="muted small"> · ${table[n]!.baseRate}/h{table[n]!.leadRate !== undefined && table[n]!.leadRate !== table[n]!.baseRate ? ` · lead $${table[n]!.leadRate}` : ""}{ownRate(n) ? " · own rate" : ""}</span>}
              </label>
            ))}
          </div>
          <TakeEffect from={from} setFrom={setFrom} firstDate={firstDate} label={`${name} take effect from`} impact={impact} />
        </div>
      )}
      <button className="primary wide" disabled={!changed || included.length === 0} onClick={() => setAsk(true)}>Change for all sites</button>
      {skip.length > 0 && <p className="muted small">Not changed (flat pay or a threshold rate): {skip.join(", ")}. Edit those below.</p>}
      {ask && (
        <ConfirmDialog
          title={farBack(from) ? `Are you sure? ${dmy(from)} is a long way back` : `Change ${name}?`}
          message={`${std !== curStd ? `Standard rate ${curStd ?? "-"} → ${std ?? "-"}. ` : ""}${newLead !== curLead ? `Team lead rate ${curLead ?? "-"} → ${newLead ?? "-"}. ` : ""}${capsChanged ? "Hours at 1x, 1.5x, 2x and 3x change too. " : ""}Applies to ${included.join(", ")}${except.length ? ` (leaving out ${except.join(", ")})` : ""} from ${dmy(from)}${from === todayISO() ? " (today)" : ""}.${impact && impact.days > 0 ? ` This recalculates ${impact.days} logged day${impact.days === 1 ? "" : "s"} (${impact.delta >= 0 ? "+" : "-"}$${Math.abs(impact.delta).toFixed(2)} gross).` : ""}`}
          confirmLabel="Change for all sites" cancelLabel="Cancel" safe
          onCancel={() => setAsk(false)}
          onConfirm={() => { setAsk(false); onApply(change_, from); }}
        />
      )}
    </section>
  );
}

const newFixedSite = (): SiteRates => ({ ...emptySite("main"), weekday: { x1: 12, x15: 1000 }, weekend: { x1: 12, x15: 1000 }, holiday: { x1: 12, x2: 1000 } });

function AddSiteForm({ table, payers, onAdd, onDone }: {
  table: SiteTable; payers: Record<string, string>;
  onAdd: (name: string, payer: string, site: SiteRates, newGroupName?: string) => void;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const groupIds = Object.keys(payers);
  const [group, setGroup] = useState(groupIds[0] ?? "main");
  const [groupName, setGroupName] = useState("");
  const [std, setStd] = useState<Num>();
  const [lead, setLead] = useState<Num>();
  const [template, setTemplate] = useState<string | undefined>();
  const [lunch, setLunch] = useState(true);
  const [roleField, setRoleField] = useState<SiteRates["roleField"]>();
  const [fixed, setFixed] = useState(false);
  const [fx, setFx] = useState<SiteRates>(newFixedSite());
  const isNew = group === "__new";
  const mine = Object.values(table).filter((s) => s.payer === group && (s.baseRate ?? 0) > 0);
  const groupStd = commonValue(mine.map((m) => m.baseRate));
  const groupLead = commonValue(mine.map((m) => m.leadRate).filter((v) => v !== undefined));
  const groupTemplate = commonValue(mine.map((m) => detectTemplate(m)).filter((v) => v !== undefined));
  const tpl = template ?? (isNew ? "overtime" : groupTemplate ?? "overtime");
  const finalStd = isNew ? std : groupStd;
  const finalLead = isNew ? (lead ?? std) : (groupLead ?? groupStd);
  const taken = Object.keys(table).some((k) => k.toLowerCase() === name.trim().toLowerCase());
  const ok = !!name.trim() && !taken && (!isNew || !!groupName.trim()) && (fixed ? (fx.dailyStd ?? 0) > 0 : !isNew || (std ?? 0) > 0);
  const reset = () => { onDone(); setName(""); setGroupName(""); setStd(undefined); setLead(undefined); setTemplate(undefined); setLunch(true); setRoleField(undefined); setFixed(false); setFx(newFixedSite()); };
  const add = () => {
    const id = isNew ? slug(groupName, groupIds) : group;
    const extra: Partial<SiteRates> = { ...(roleField ? { roleField } : {}), ...(!fixed && !lunch ? { lunch: false } : {}) };
    const site: SiteRates = fixed
      ? { ...fx, payer: id, ...extra }
      : applyTemplate({ ...emptySite(id), baseRate: finalStd, leadRate: finalLead, ...extra }, tpl);
    onAdd(name.trim(), id, site, isNew ? groupName.trim() : undefined);
    reset();
  };
  return (
    <div className="add-site page-form">
      <label>Site name<input placeholder="New site name" aria-label="New site name" value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label>Group (which payslip it goes on)
        <select aria-label="Group for the new site" value={group} onChange={(e) => { setGroup(e.target.value); setTemplate(undefined); }}>
          {groupIds.map((id) => <option key={id} value={id}>{payers[id]}</option>)}
          <option value="__new">＋ New group…</option>
        </select>
      </label>
      {isNew && <label>New group name<input aria-label="New group name" placeholder="e.g. Trinidad Offshore" value={groupName} onChange={(e) => setGroupName(e.target.value)} /></label>}
      {isNew && <p className="muted small">A group is its own payslip: in Split mode it pays its own PAYE, NIS and health surcharge.</p>}
      <RoleFieldChoice value={roleField} onChange={setRoleField} />
      <div className="lunch-choice">
        <span className="lbl">How the site is paid</span>
        <Seg label="How the site is paid" value={fixed ? "fixed" : "hourly"} options={[["hourly", "Hourly"], ["fixed", "Fixed day rate"]]} onChange={(m) => setFixed(m === "fixed")} />
      </div>
      {fixed ? (
        <>
          <FixedDayEditor site={fx} onChange={setFx} />
          <p className="muted small">A fixed day rate pays the same for the day whatever the lunch, so there is no lunch check.</p>
        </>
      ) : (
        <>
          {isNew ? (
            <div className="grid2">
              <label>Standard rate ($/h)<NumInput label="New group standard rate" value={std} onChange={setStd} /></label>
              <label>Team lead rate ($/h)<NumInput label="New group team lead rate" value={lead ?? std} onChange={setLead} /></label>
            </div>
          ) : (
            <p className="muted small">Uses the group's rates: {groupStd !== undefined ? `$${groupStd}/h standard, $${finalLead ?? groupStd}/h team lead` : "no hourly rates set yet; edit the site after adding it"}.</p>
          )}
          <LunchChoice value={lunch} onChange={setLunch} />
          <label>Overtime hours
            <select aria-label="Hours template for the new site" value={tpl} onChange={(e) => setTemplate(e.target.value)}>
              {HOURS_TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
          <p className="muted small">{templateById(tpl)?.description}</p>
        </>
      )}
      <div className="row">
        <button onClick={reset}>Cancel</button>
        <button className="primary" disabled={!ok} onClick={add}>Add site</button>
      </div>
      {taken && <p className="bad" role="alert">There is already a site with that name.</p>}
    </div>
  );
}

function slug(name: string, taken: string[]): string {
  const base = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "group";
  let id = base, n = 2;
  while (taken.includes(id)) id = `${base}-${n++}`;
  return id;
}

export function SitesPage() {
  const { data, update } = useStore();
  const { open } = useNav();
  const versions = data.history.sites;
  const [asOf, setAsOf] = useState(todayISO());
  const [pending, setPending] = useState<{ title: string; message: string; run: () => void } | null>(null);
  const table = valueOn(versions, asOf < versions[0]!.effectiveFrom ? versions[0]!.effectiveFrom : asOf);

  const payers = { ...data.payerNames };
  for (const v of versions) for (const s of Object.values(v.value)) payers[s.payer] ??= payerLabel(data.payerNames, s.payer);
  const groups = [...new Set(Object.values(table).map((s) => s.payer))];
  const jobs = data.entries.filter((e) => !isOther(e));
  const earliest = jobs.reduce<string | undefined>((m, e) => (!m || e.date < m ? e.date : m), undefined);
  const firstDate = versions[0]!.effectiveFrom;
  const farBack = (from: string) => isFarBack(from, todayISO(), earliest);
  const impactFor = (mutate: (t: SiteTable) => SiteTable, from: string) => rateImpact(jobs, versions, applyFrom(versions, from, mutate), from);

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
    const run = () => {
      setVersions((list) => applyFrom(list, start, (t) => patchSite(t, name, patch, draft)));
      if (start > todayISO()) setAsOf(start);
    };
    if (farBack(start) && !isNew) {
      const imp = impactFor((t) => patchSite(t, name, patch, draft), start);
      setPending({ title: `Are you sure? ${start} is a long way back`, message: `Saving ${name} from ${start} recalculates ${imp.days} logged day${imp.days === 1 ? "" : "s"} (${imp.delta >= 0 ? "+" : "-"}$${Math.abs(imp.delta).toFixed(2)} gross).`, run });
    } else run();
  };

  return (
    <>
      <PageHeader title="Site locations & rates" />
      <p className="muted pad">Change the rates for a whole payslip group in one go, or edit one site. Every change has a “Take effect from” date, which is today unless you pick another day. Earlier days keep their old rates, so a raise never changes past pay.</p>

      {asOf !== todayISO() && (
        <p className="notice">Showing the rates in force on <strong>{dmy(asOf)}</strong>. <button className="link" onClick={() => setAsOf(todayISO())}>Back to today</button></p>
      )}

      {groups.map((g) => (
        <GroupRates
          key={g} payer={g} name={payers[g] ?? g} table={table} firstDate={firstDate} farBack={farBack}
          impactFor={(c, from) => impactFor((t) => changeGroup(t, g, c), from)}
          onApply={(c, from) => { setVersions((list) => applyFrom(list, from, (t) => changeGroup(t, g, c))); if (from > todayISO()) setAsOf(from); }}
        />
      ))}

      <h2 className="section-title">Each site</h2>
      <section className="card">
        {Object.entries(table).map(([name, site]) => (
          <SiteCard
            key={name} name={name} saved={site} payers={payers} firstDate={firstDate}
            impactFor={(draft, from) => impactFor((t) => patchSite(t, name, diffSite(site, draft), draft), from)}
            onSave={(draft, from) => saveSite(name, site, draft, from)}
            onRename={(to) => renameSite(name, to)}
            onRenameRole={(from, to) => renameRole(name, from, to)}
            onRemove={() => setVersions((list) => list.map((v) => ({ ...v, value: Object.fromEntries(Object.entries(v.value).filter(([k]) => k !== name)) })))}
          />
        ))}
        <button className="primary wide" onClick={() => open({ page: "addsite" })}>＋ Add new location</button>
      </section>

      {pending && (
        <ConfirmDialog title={pending.title} message={pending.message} confirmLabel="Save from that date" cancelLabel="Cancel" safe
          onCancel={() => setPending(null)} onConfirm={() => { const r = pending.run; setPending(null); r(); }} />
      )}

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

/** The "Add new location" page: its own screen, so the sites list stays out of the way. */
export function AddSitePage() {
  const { data, update } = useStore();
  const { back } = useNav();
  const versions = data.history.sites;
  const table = valueOn(versions, todayISO() < versions[0]!.effectiveFrom ? versions[0]!.effectiveFrom : todayISO());
  const payers = { ...data.payerNames };
  for (const v of versions) for (const s of Object.values(v.value)) payers[s.payer] ??= payerLabel(data.payerNames, s.payer);
  return (
    <>
      <PageHeader title="Add new location" />
      <section className="card">
        <AddSiteForm
          table={table} payers={payers} onDone={back}
          onAdd={(name, payer, site, groupName) => update((d) => ({
            ...d,
            payerNames: groupName ? { ...d.payerNames, [payer]: groupName } : d.payerNames,
            history: { ...d.history, sites: d.history.sites.map((v) => ({ ...v, value: { ...v.value, [name]: structuredClone(site) } })) },
          }))}
        />
      </section>
    </>
  );
}
