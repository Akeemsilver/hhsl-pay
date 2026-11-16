import { useSyncExternalStore } from "react";

/**
 * "Hide money": every dollar figure on screen is blurred, everywhere, until it is turned off. It is a setting of this phone
 * (remembered), not part of the days and rates, and it only changes what is drawn: downloaded files keep the real figures.
 *
 * The figures are found in the text of the page and marked with the browser's text highlight (`::highlight(money)`), which
 * blurs them without changing the page, so every screen, pop-up and table is covered without each one being rewritten.
 */
const KEY = "hhsl-salary-tracker:hide-money";

type Highlights = { set: (name: string, h: unknown) => void; delete: (name: string) => void };
const highlights = (): Highlights | undefined => (typeof CSS !== "undefined" ? (CSS as unknown as { highlights?: Highlights }).highlights : undefined);
const HighlightCtor = (): (new (...r: Range[]) => unknown) | undefined => (typeof window !== "undefined" ? (window as unknown as { Highlight?: new (...r: Range[]) => unknown }).Highlight : undefined);

/** False on a phone too old to blur text this way (the button is then turned off). */
export const hideMoneySupported = (): boolean => !!highlights() && !!HighlightCtor();

const MONEY = /-?\$\d[\d,]*(?:\.\d+)?K?/g;

/** Where the dollar figures are in a piece of text, as [start, end) pairs. */
export function findMoney(text: string): Array<[number, number]> {
  return [...text.matchAll(MONEY)].map((m) => [m.index!, m.index! + m[0].length] as [number, number]);
}

function read(): boolean {
  try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
}

let hidden = read();
const listeners = new Set<() => void>();
let observer: MutationObserver | null = null;
let sweeping = false;

/** Mark every dollar figure currently on the page. Runs before the screen is painted, so nothing shows for a moment. */
function sweep(): void {
  if (sweeping) return;
  sweeping = true;
  try {
    const H = HighlightCtor(), hl = highlights();
    if (!H || !hl) return;
    const ranges: Range[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => { const t = (n.parentElement?.tagName ?? "SCRIPT"); return t === "SCRIPT" || t === "STYLE" || t === "TEXTAREA" ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; },
    });
    for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
      // A run is a text node and the ones right after it: the page can split "$" and "60" into two.
      if (node.previousSibling?.nodeType === 3) continue;
      const run: Text[] = [node];
      for (let s = node.nextSibling; s && s.nodeType === 3; s = s.nextSibling) run.push(s as Text);
      const text = run.map((t) => t.data).join("");
      if (!text.includes("$")) continue;
      const at = (pos: number): [Text, number] => {
        let left = pos;
        for (const t of run) { if (left <= t.data.length) return [t, left]; left -= t.data.length; }
        const last = run[run.length - 1]!;
        return [last, last.data.length];
      };
      for (const [a, b] of findMoney(text)) {
        const r = document.createRange();
        const [sn, so] = at(a), [en, eo] = at(b);
        r.setStart(sn, so); r.setEnd(en, eo);
        ranges.push(r);
      }
    }
    hl.set("money", new H(...ranges));
  } finally {
    sweeping = false;
  }
}

function apply(): void {
  document.documentElement.classList.toggle("hide-money", hidden && hideMoneySupported());
  observer?.disconnect();
  observer = null;
  if (hidden && hideMoneySupported()) {
    sweep();
    observer = new MutationObserver(sweep);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  } else {
    highlights()?.delete("money");
  }
}

/** Call once when the app starts, so a phone that was left hidden stays hidden. */
export function initHideMoney(): void {
  apply();
}

export function setHideMoney(next: boolean): void {
  hidden = next;
  try { localStorage.setItem(KEY, next ? "1" : "0"); } catch { /* storage unavailable: it lasts until the app is closed */ }
  apply();
  listeners.forEach((l) => l());
}

export function useHideMoney(): [boolean, () => void] {
  const value = useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => hidden);
  return [value, () => setHideMoney(!hidden)];
}
