import type { Dated, ISODate } from "./types";

/** The entry with the latest effectiveFrom that is on or before `date`. */
export function valueOn<T>(history: Array<Dated<T>>, date: ISODate): T {
  let best: Dated<T> | undefined;
  for (const item of history) {
    if (item.effectiveFrom <= date && (!best || item.effectiveFrom >= best.effectiveFrom)) {
      best = item;
    }
  }
  if (!best) throw new Error(`No rules in effect on ${date}`);
  return best.value;
}
