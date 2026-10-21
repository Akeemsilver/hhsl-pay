import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Tab = "home" | "calendar" | "year" | "charts";
export type Page = "settings" | "rates" | "backup";

/** Where the user is. Stored in the browser history so the phone's Back button works. */
export interface Loc {
  tab: Tab;
  page?: Page;
  /** ISO date of the open day sheet. */
  day?: string;
  /** How many history entries deep we are (0 = the home screen). */
  n: number;
}

const ROOT: Loc = { tab: "home", n: 0 };

function read(): Loc {
  const s = window.history.state as Loc | null;
  return s && typeof s.n === "number" && typeof s.tab === "string" ? s : ROOT;
}

interface Nav {
  loc: Loc;
  /** Open a settings page or a day sheet on top of the current screen. */
  open: (next: { page?: Page; day?: string }) => void;
  /** Switch tab; going back to Home returns to the first history entry. */
  selectTab: (tab: Tab) => void;
  back: () => void;
}

const Ctx = createContext<Nav | null>(null);

export function useNav(): Nav {
  const v = useContext(Ctx);
  if (!v) throw new Error("useNav outside provider");
  return v;
}

export function NavProvider({ children }: { children: ReactNode }) {
  const [loc, setLoc] = useState<Loc>(read);

  useEffect(() => {
    if (!(window.history.state as Loc | null)?.tab) window.history.replaceState(ROOT, "");
    const onPop = () => setLoc(read());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const open = useCallback(
    (next: { page?: Page; day?: string }) => {
      const l: Loc = { ...loc, ...next, n: loc.n + 1 };
      window.history.pushState(l, "");
      setLoc(l);
    },
    [loc],
  );

  const selectTab = useCallback(
    (tab: Tab) => {
      if (tab === "home") {
        if (loc.n > 0) window.history.go(-loc.n);
        return;
      }
      if (tab === loc.tab && !loc.page && !loc.day) return;
      // From Home we push, so Back returns to Home; between other tabs we replace.
      const l: Loc = { tab, n: loc.tab === "home" && loc.n === 0 ? 1 : loc.n };
      if (loc.n === 0) window.history.pushState(l, "");
      else window.history.replaceState(l, "");
      setLoc(l);
    },
    [loc],
  );

  const back = useCallback(() => window.history.back(), []);
  const value = useMemo(() => ({ loc, open, selectTab, back }), [loc, open, selectTab, back]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
