import type { AppData } from "./model";

export class ImportError extends Error {}

export interface Assignment {
  site: string;
  role?: string;
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** Works out which site a spreadsheet's client text means, using your timesheet rules and site names. */
export function guessAssignment(client: string, data: AppData): Assignment | undefined {
  const c = norm(client);
  if (!c) return undefined;
  for (const r of data.timesheet?.rules ?? []) if (norm(r.label) === c) return { site: r.site, role: r.role };
  const siteNames = [...new Set(data.history.sites.flatMap((v) => Object.keys(v.value)))];
  const bySite = siteNames.find((n) => norm(n) === c);
  if (bySite) return { site: bySite };
  const medic = /^(.*)\s+medic$/.exec(c)?.[1];
  const medicSite = medic ? siteNames.find((n) => norm(n) === medic) : undefined;
  if (medicSite) return { site: medicSite, role: "Client medic" };
  return undefined;
}
