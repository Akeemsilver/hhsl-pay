import { useMemo } from "react";
import { computeMonth, type MonthResult } from "./engine";
import { isOther, overridesFor, type Entry } from "./model";
import { useStore } from "./store";

export function useMonth(month: string): MonthResult<Entry> {
  const { data } = useStore();
  return useMemo(() => computeMonth(month, data.entries.filter((e) => !isOther(e)), data.history, overridesFor(data, month)), [month, data]);
}

/** Month results for the twelve months of a year. */
export function useYear(year: number): Array<MonthResult<Entry>> {
  const { data } = useStore();
  return useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const month = `${year}-${String(i + 1).padStart(2, "0")}`;
        return computeMonth(month, data.entries.filter((e) => !isOther(e)), data.history, overridesFor(data, month));
      }),
    [year, data],
  );
}
