import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { clearSessionState } from "./session";

export type Tab = "home" | "calendar" | "year" | "charts";
export type Page = "settings" | "sites" | "tax" | "payslips" | "timesheet" | "holidays" | "backup" | "addsite";

/** Where the user is. Stored in the browser history so the phone's Back button works. */
export interface Loc {
  tab: Tab;
  page?: Page;
  /** ISO date of the open day sheet. */
  day?: string;
  /** A sheet opened on top of the day sheet, such as the time picker. */
  sub?: string;
  /** Open the day sheet with a new job or other job already added. */
  add?: "job" | "other";
  /** Open the day sheet scrolled to this job. */
  focus?: string;
  /** How many history entries deep we are (0 = the home screen). */
  n: number;
  /** The bottom history entry: Back from Home lands here, which asks to press Back again before leaving. */
  base?: boolean;
}

const ROOT: Loc = { tab: "home", n: 0 };

function read(): Loc {
  const s = window.history.state as Loc | null;
  return s && typeof s.n === "number" && typeof s.tab === "string" ? s : ROOT;
}

/** Lets a screen refuse a Back press, for example to ask before discarding unsaved changes. */
export interface Guard {
  blocks: (next: Loc, current: Loc) => boolean;
  onBlocked: () => void;
  /** Another day was tapped while this day sheet is open. Return true when the screen took care of it (for example by asking to discard changes). */
  onSwitch?: (day: string) => boolean;
}

interface Nav {
  loc: Loc;
  setGuard: (g: Guard | null) => void;
  /** Open a settings page or a day sheet on top of the current screen. */
  open: (next: { page?: Page; day?: string; sub?: string; add?: "job" | "other"; focus?: string }) => void;
  /** Show a day's sheet: opens it, or when one is already open switches it to this day (no extra Back step). */
  showDay: (day: string) => void;
  /** Switch tab; going back to Home returns to the first history entry. */
  selectTab: (tab: Tab) => void;
  back: () => void;
  /** True for a moment after Back is pressed on Home: the next press leaves the app. */
  exitHint: boolean;
}

const Ctx = createContext<Nav | null>(null);

export function useNav(): Nav {
  const v = useContext(Ctx);
  if (!v) throw new Error("useNav outside provider");
  return v;
}

export function NavProvider({ children }: { children: ReactNode }) {
  const [loc, setLoc] = useState<Loc>(read);
  const locRef = useRef(loc);
  locRef.current = loc;
  const guard = useRef<Guard | null>(null);
  const [exitHint, setExitHint] = useState(false);
  const lastExitPress = useRef(0);
  const setGuard = useCallback((g: Guard | null) => { guard.current = g; }, []);

  useEffect(() => {
    // Like an Android app: Back goes up one level, and from Home the first press only asks, the second leaves.
    const st = window.history.state as Loc | null;
    if (!st?.tab) {
      window.history.replaceState({ ...ROOT, base: true }, "");
      window.history.pushState(ROOT, "");
    } else if (st.n === 0 && !st.base) {
      window.history.replaceState({ ...ROOT, base: true }, "");
      window.history.pushState(ROOT, "");
    }
    const onPop = () => {
      const next = read();
      if (next.base) {
        if (Date.now() - lastExitPress.current < 2500) {
          window.history.back();
          return;
        }
        lastExitPress.current = Date.now();
        window.history.pushState(ROOT, "");
        setLoc(ROOT);
        setExitHint(true);
        window.setTimeout(() => setExitHint(false), 2500);
        return;
      }
      const g = guard.current;
      if (g && g.blocks(next, locRef.current)) {
        // Undo the Back press by putting the current screen back on top, then let the screen react.
        window.history.pushState(locRef.current, "");
        g.onBlocked();
        return;
      }
      setLoc(next);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const open = useCallback(
    (next: { page?: Page; day?: string; sub?: string; add?: "job" | "other"; focus?: string }) => {
      const l: Loc = { ...loc, ...next, n: loc.n + 1 };
      window.history.pushState(l, "");
      setLoc(l);
    },
    [loc],
  );

  const showDay = useCallback(
    (day: string) => {
      const cur = locRef.current;
      if (!cur.day) { open({ day }); return; }
      if (cur.day === day) return;
      if (guard.current?.onSwitch?.(day)) return;
      const l: Loc = { ...cur, day, add: undefined, focus: undefined, sub: undefined };
      window.history.replaceState(l, "");
      setLoc(l);
    },
    [open],
  );

  const selectTab = useCallback(
    (tab: Tab) => {
      if (tab === "home") {
        if (loc.n > 0) window.history.go(-loc.n);
        return;
      }
      if (tab === loc.tab && !loc.page && !loc.day) return;
      // Coming to the Month tab from another tab always shows the current month, whatever month was picked last time.
      if (tab === "calendar" && loc.tab !== "calendar") clearSessionState("calendar-month");
      // From Home we push, so Back returns to Home; between other tabs we replace.
      const l: Loc = { tab, n: loc.tab === "home" && loc.n === 0 ? 1 : loc.n };
      if (loc.n === 0) window.history.pushState(l, "");
      else window.history.replaceState(l, "");
      setLoc(l);
    },
    [loc],
  );

  const back = useCallback(() => window.history.back(), []);
  const value = useMemo(() => ({ loc, setGuard, open, showDay, selectTab, back, exitHint }), [loc, setGuard, open, showDay, selectTab, back, exitHint]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
