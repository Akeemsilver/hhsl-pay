import { applyKit, BadBackup, isEncrypted, parse, PasswordRequired, type RatesKit } from "./backup";
import type { AppData } from "./model";

/** The address of this app, for sharing: where it is hosted, including the folder (e.g. https://name.github.io/hhsl-pay/). */
export function appLink(): string {
  const base = import.meta.env.BASE_URL || "/";
  return `${window.location.origin}${base}`;
}

export const siteCount = (data: Pick<AppData, "history">) => new Set(data.history.sites.flatMap((v) => Object.keys(v.value))).size;

export interface KitResult { data: AppData; sites: number; groups: number }

/** Read a starter kit (rates file) and return the data with its sites, rates and groups applied. Throws a readable Error. */
export async function readKit(file: File, data: AppData): Promise<KitResult> {
  const text = await file.text();
  let kit: RatesKit | undefined;
  try {
    if (isEncrypted(text)) throw new Error("This file is locked with a password. Ask the sender for an unlocked starter kit.");
    const parsed = await parse(text);
    if (parsed.kind !== "rates" || !parsed.history) throw new Error("That is a backup, not a starter kit. Ask for the starter kit (rates) file.");
    kit = parsed.kit ?? { ...parsed.history };
  } catch (e) {
    if (e instanceof PasswordRequired) throw new Error("This file is locked with a password. Ask the sender for an unlocked starter kit.");
    if (e instanceof BadBackup) throw new Error(e.message);
    throw e instanceof Error ? e : new Error("Could not read that file.");
  }
  const next = applyKit(data, kit);
  const last = kit.sites[kit.sites.length - 1]?.value ?? {};
  return { data: next, sites: Object.keys(last).length, groups: new Set(Object.values(last).map((s) => s.payer)).size };
}
