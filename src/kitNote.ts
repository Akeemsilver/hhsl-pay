import { useSyncExternalStore } from "react";

/** A note about the starter kit that has just been loaded (or not), shown on Home until it is dismissed. It lives only while the app is open. */
export interface KitNote { ok: boolean; title: string; text: string }

let note: KitNote | null = null;
const listeners = new Set<() => void>();

export function setKitNote(next: KitNote | null): void {
  note = next;
  listeners.forEach((l) => l());
}

export function useKitNote(): KitNote | null {
  return useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => note);
}

/** "12 sites in 2 payslip groups, and the timesheet form" */
export function kitSummary(sites: number, groups: number, template: boolean): string {
  const s = `${sites} site${sites === 1 ? "" : "s"} in ${groups} payslip group${groups === 1 ? "" : "s"}`;
  return template ? `${s}, and the timesheet form` : s;
}
