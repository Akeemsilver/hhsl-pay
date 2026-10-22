import { buildTimesheet, type TimesheetSettings } from "./timesheet";
import { fillTimesheet, timesheetFileName } from "./timesheetFile";
import type { RuleHistory } from "./engine";
import type { Entry } from "./model";

export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** The filled Excel timesheet for a month, ready to preview or download. */
export async function makeTimesheetXlsx(
  template: ArrayBuffer | Uint8Array,
  settings: TimesheetSettings | undefined,
  month: string,
  entries: Entry[],
  history: RuleHistory,
): Promise<{ bytes: Uint8Array; fileName: string; rows: ReturnType<typeof buildTimesheet>["rows"]; warnings: string[] }> {
  const { rows, warnings } = buildTimesheet(month, entries, history, settings?.rules ?? [], settings?.includeOther !== false);
  const name = settings?.name ?? "";
  const bytes = await fillTimesheet(template, { name, siteLabel: settings?.siteLabel || "ERT Offsite", month, rows });
  return { bytes, fileName: timesheetFileName(name, month), rows, warnings };
}
