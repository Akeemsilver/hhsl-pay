import { useCallback, useEffect, useState } from "react";

export type ThemePref = "system" | "light" | "dark";
const KEY = "hhsl-salary-tracker:theme";

export function getTheme(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    /* storage unavailable */
  }
  // Light until you choose otherwise.
  return "light";
}

/** Sets or clears the data-theme override the stylesheet reads. */
export function applyTheme(pref: ThemePref): void {
  const root = document.documentElement;
  if (pref === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", pref);
  const dark = pref === "dark" || (pref === "system" && window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#0f1418" : "#0f766e");
}

export function useTheme(): [ThemePref, (p: ThemePref) => void] {
  const [pref, setPref] = useState<ThemePref>(getTheme);
  const set = useCallback((p: ThemePref) => {
    try {
      localStorage.setItem(KEY, p);
    } catch {
      /* ignore */
    }
    applyTheme(p);
    setPref(p);
  }, []);
  useEffect(() => {
    if (pref !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [pref]);
  return [pref, set];
}
