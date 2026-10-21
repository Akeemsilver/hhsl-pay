import { useCallback, useEffect, useMemo, useState } from "react";
import { computeMonth, filterMonth, type MonthResult } from "./engine";
import { isCombined, isOther, overridesFor, type Entry } from "./model";
import { useSiteFilter } from "./filter";
import { useStore } from "./store";
import { clearTemplate, loadTemplate, saveTemplate, type StoredTemplate } from "./storage";

export function useMonth(month: string): MonthResult<Entry> {
  const { data } = useStore();
  const { site } = useSiteFilter();
  return useMemo(() => {
    const r = computeMonth(month, data.entries.filter((e) => !isOther(e)), data.history, overridesFor(data, month), isCombined(data, month));
    return site ? filterMonth(r, site, data.history) : r;
  }, [month, data, site]);
}

/** Month results for the twelve months of a year. */
export function useYear(year: number): Array<MonthResult<Entry>> {
  const { data } = useStore();
  const { site } = useSiteFilter();
  return useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const month = `${year}-${String(i + 1).padStart(2, "0")}`;
        const r = computeMonth(month, data.entries.filter((e) => !isOther(e)), data.history, overridesFor(data, month), isCombined(data, month));
        return site ? filterMonth(r, site, data.history) : r;
      }),
    [year, data, site],
  );
}

/** The imported time sheet template (undefined until loaded, null when there is none). */
export function useTemplate() {
  const [template, setTemplate] = useState<StoredTemplate | null | undefined>(undefined);
  useEffect(() => { void loadTemplate().then(setTemplate); }, []);
  const save = useCallback(async (file: File) => {
    const stored = { name: file.name, bytes: await file.arrayBuffer() };
    const ok = await saveTemplate(stored);
    if (ok) setTemplate(stored);
    return ok;
  }, []);
  const clear = useCallback(async () => { await clearTemplate(); setTemplate(null); }, []);
  return { template, save, clear };
}
