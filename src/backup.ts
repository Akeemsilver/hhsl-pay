import type { RuleHistory } from "./engine";
import type { AppData } from "./model";
import type { TimesheetRule } from "./timesheet";
import { allSiteColors } from "./siteColor";

const APP = "hhsl-salary-tracker";

export type BackupKind = "full" | "rates";

/** A rates file ("starter kit"): the sites, rates and tax rules, plus the payslip group names and timesheet job rules. No days and no name. */
export interface RatesKit extends RuleHistory {
  payerNames?: Record<string, string>;
  timesheetRules?: TimesheetRule[];
  siteLabel?: string;
  payrollEmail?: string;
  /** Which payslip group other jobs are paid and taxed on. */
  otherPayer?: string;
  /** Split or combined tax, and from which month. */
  taxMode?: AppData["taxMode"];
  /** Public holiday edits (for example Divali). */
  holidays?: AppData["holidays"];
  /** Calendar colour per site (0–11), keyed by lower-case site name. */
  siteColors?: AppData["siteColors"];
  /** The company time sheet form (.xlsx), so a colleague does not have to find it. Sent inside the kit, never kept in the app's public code. */
  timesheetTemplate?: { name: string; data: string };
}

export interface Parsed {
  kind: BackupKind;
  data?: AppData;
  history?: RuleHistory;
  kit?: RatesKit;
}

/** The starter kit for this phone's current setup. */
export function ratesKitOf(data: AppData, template?: { name: string; bytes: ArrayBuffer } | null): RatesKit {
  return {
    ...(template ? { timesheetTemplate: { name: template.name, data: toB64(new Uint8Array(template.bytes)) } } : {}),
    sites: data.history.sites,
    tax: data.history.tax,
    payerNames: data.payerNames,
    timesheetRules: data.timesheet?.rules,
    siteLabel: data.timesheet?.siteLabel,
    payrollEmail: data.timesheet?.payrollEmail,
    otherPayer: data.otherPayer,
    taxMode: data.taxMode,
    holidays: data.holidays,
    siteColors: allSiteColors(data),
  };
}

/** The data with a starter kit's rates and groups applied. Days, name and backups settings stay. */
export function applyKit(data: AppData, kit: RatesKit): AppData {
  return {
    ...data,
    history: { sites: kit.sites, tax: kit.tax },
    payerNames: { ...data.payerNames, ...(kit.payerNames ?? {}) },
    otherPayer: kit.otherPayer ?? data.otherPayer,
    taxMode: kit.taxMode ?? data.taxMode,
    holidays: kit.holidays ?? data.holidays,
    siteColors: kit.siteColors ? { ...data.siteColors, ...kit.siteColors } : data.siteColors,
    timesheet: kit.timesheetRules || kit.siteLabel || kit.payrollEmail
      ? { name: data.timesheet?.name ?? "", siteLabel: kit.siteLabel ?? data.timesheet?.siteLabel ?? "ERT Offsite", rules: kit.timesheetRules ?? data.timesheet?.rules ?? [], payrollEmail: kit.payrollEmail ?? data.timesheet?.payrollEmail, includeOther: data.timesheet?.includeOther }
      : data.timesheet,
  };
}

interface Envelope {
  app: typeof APP;
  format: 1;
  kind: BackupKind;
  exportedAt: string;
  payload?: unknown;
  encrypted?: { salt: string; iv: string; ciphertext: string };
}

const enc = new TextEncoder();
const dec = new TextDecoder();

export function toB64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
export function fromB64(text: string): Uint8Array {
  const s = atob(text);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 250_000, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function serialize(kind: BackupKind, content: AppData | RuleHistory | RatesKit, password?: string): Promise<string> {
  const env: Envelope = { app: APP, format: 1, kind, exportedAt: new Date().toISOString() };
  if (password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(password, salt);
    const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(content)));
    env.encrypted = { salt: toB64(salt), iv: toB64(iv), ciphertext: toB64(new Uint8Array(cipher)) };
  } else {
    env.payload = content;
  }
  return JSON.stringify(env);
}

export class PasswordRequired extends Error {}
export class BadBackup extends Error {}

function isHistory(x: any): x is RuleHistory {
  return x && Array.isArray(x.sites) && Array.isArray(x.tax) && x.sites.length > 0 && x.tax.length > 0;
}

function isData(x: any): x is AppData {
  return x && x.version === 1 && isHistory(x.history) && Array.isArray(x.entries) && typeof x.payerNames === "object";
}

export function isEncrypted(text: string): boolean {
  try {
    return !!(JSON.parse(text) as Envelope).encrypted;
  } catch {
    return false;
  }
}

export async function parse(text: string, password?: string): Promise<Parsed> {
  let env: Envelope;
  try {
    env = JSON.parse(text);
  } catch {
    throw new BadBackup("This file is not a backup.");
  }
  if (env?.app !== APP || env.format !== 1) throw new BadBackup("This file is not a backup from this app.");

  let payload: unknown = env.payload;
  if (env.encrypted) {
    if (!password) throw new PasswordRequired();
    try {
      const key = await deriveKey(password, fromB64(env.encrypted.salt));
      const plain = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: fromB64(env.encrypted.iv) },
        key,
        fromB64(env.encrypted.ciphertext),
      );
      payload = JSON.parse(dec.decode(plain));
    } catch {
      throw new BadBackup("Wrong password, or the file is damaged.");
    }
  }

  if (env.kind === "full" && isData(payload)) return { kind: "full", data: payload };
  if (env.kind === "rates" && isHistory(payload)) {
    const kit = payload as RatesKit;
    return { kind: "rates", history: { sites: kit.sites, tax: kit.tax }, kit };
  }
  throw new BadBackup("The backup is missing data or is from a newer version.");
}

export function backupFileName(kind: BackupKind, encrypted: boolean): string {
  if (kind === "rates" && !encrypted) return "HHSL-starter-kit-rates.json";
  const date = new Date().toISOString().slice(0, 10);
  return `salary-tracker-${kind === "full" ? "backup" : "rates"}-${date}${encrypted ? "-locked" : ""}.json`;
}

/** Share through the phone's share sheet when possible, otherwise download. */
export async function deliver(fileName: string, content: string | Uint8Array, type = "application/json"): Promise<"shared" | "downloaded"> {
  const file = new File([content as BlobPart], fileName, { type });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: fileName });
      return "shared";
    } catch (e) {
      if ((e as DOMException)?.name === "AbortError") throw e;
    }
  }
  return download(fileName, content, type);
}

/** Save the file to the phone's Downloads without opening the share sheet. */
export function download(fileName: string, content: string | Uint8Array, type = "application/json"): "downloaded" {
  const file = new File([content as BlobPart], fileName, { type });
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return "downloaded";
}
