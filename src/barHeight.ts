import { useEffect } from "react";

/**
 * Publishes the height of the title bar as --bar-h, so things that stick under it (the month bar, an open year table's
 * header) sit right below it whatever height it has on this phone.
 */
export function useBarHeight(): void {
  useEffect(() => {
    const bar = document.querySelector<HTMLElement>(".bar");
    if (!bar) return;
    const set = () => document.documentElement.style.setProperty("--bar-h", `${bar.getBoundingClientRect().height}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(bar);
    return () => { ro.disconnect(); document.documentElement.style.removeProperty("--bar-h"); };
  }, []);
}
