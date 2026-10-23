import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLayer } from "./layers";

const MIN = 1, MAX = 4;
const MAX_CANVAS_PX = 4096;
const clamp = (z: number) => Math.min(MAX, Math.max(MIN, Math.round(z * 100) / 100));

interface Doc { numPages: number; getPage: (n: number) => Promise<any> }

/**
 * A PDF reader like the phone's own: pages are drawn sharp at the phone's full pixel density, only the pages near the
 * screen are drawn (so a long guide stays light), and you can pinch or use + / − to zoom and scroll sideways.
 */
export function PdfViewer({ pdf, title, label, error, busy, onClose, foot }: {
  pdf: Uint8Array | null; title: string; label: string; error: string | null; busy: string; onClose: () => void; foot?: ReactNode;
}) {
  const [doc, setDoc] = useState<Doc | null>(null);
  const [failed, setFailed] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [page, setPage] = useState(1);
  const [width, setWidth] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);
  const holder = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(1);
  zoomRef.current = zoom;
  useLayer(onClose);

  // Open the document.
  useEffect(() => {
    if (!pdf) return;
    let gone = false;
    (async () => {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.js?url")).default;
      const d = await pdfjs.getDocument({ data: pdf.slice() }).promise;
      if (!gone) { setDoc(d as unknown as Doc); setFailed(false); }
    })().catch(() => !gone && setFailed(true));
    return () => { gone = true; };
  }, [pdf]);

  // The width one page fills at zoom 1.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth - 8);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Page boxes sized from each page's shape, then each page drawn when it nears the screen and cleared when far away.
  useEffect(() => {
    const box = holder.current;
    const root = scroller.current;
    if (!doc || !box || !root || width <= 0) return;
    let gone = false;
    const cssW = width * zoom;
    const ratio = Math.min(window.devicePixelRatio || 1, 3, MAX_CANVAS_PX / cssW);
    const drawn = new Map<number, HTMLCanvasElement>();
    const tasks = new Map<number, { cancel: () => void }>();
    const slots: HTMLDivElement[] = [];
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const n = Number((e.target as HTMLElement).dataset.n);
        if (e.isIntersecting) void draw(n); else clear(n);
      }
    }, { root, rootMargin: "100% 0px" });

    async function draw(n: number) {
      if (drawn.has(n)) return;
      const slot = slots[n - 1]!;
      const p = await doc!.getPage(n);
      if (gone || drawn.has(n)) return;
      const base = p.getViewport({ scale: 1 });
      const viewport = p.getViewport({ scale: (cssW / base.width) * ratio });
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.style.cssText = "width:100%;height:100%;display:block";
      canvas.setAttribute("aria-label", `${label} page ${n}`);
      drawn.set(n, canvas);
      const task = p.render({ canvasContext: canvas.getContext("2d")!, viewport });
      tasks.set(n, task);
      try { await task.promise; } catch { drawn.delete(n); return; }
      tasks.delete(n);
      if (!gone && drawn.get(n) === canvas) slot.replaceChildren(canvas);
    }
    function clear(n: number) {
      tasks.get(n)?.cancel();
      tasks.delete(n);
      if (drawn.delete(n)) slots[n - 1]?.replaceChildren();
    }

    (async () => {
      const frag: HTMLDivElement[] = [];
      for (let n = 1; n <= doc.numPages; n++) {
        const p = await doc.getPage(n);
        const base = p.getViewport({ scale: 1 });
        const slot = document.createElement("div");
        slot.className = "pdf-slot";
        slot.dataset.n = String(n);
        slot.style.width = `${cssW}px`;
        slot.style.height = `${(cssW / base.width) * base.height}px`;
        slots.push(slot);
        frag.push(slot);
      }
      if (gone) return;
      box.replaceChildren(...frag);
      frag.forEach((s) => io.observe(s));
    })();

    // Which page is on screen, for the "page 2 of 12" label.
    const onScroll = () => {
      const mid = root.getBoundingClientRect().top + root.clientHeight / 2;
      const at = slots.findIndex((s) => s.getBoundingClientRect().bottom > mid);
      setPage(at < 0 ? slots.length : at + 1);
    };
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      gone = true;
      io.disconnect();
      tasks.forEach((t) => t.cancel());
      root.removeEventListener("scroll", onScroll);
    };
  }, [doc, width, zoom, label]);

  // Pinch to zoom: the pages follow the fingers, then are redrawn sharp when they lift.
  useEffect(() => {
    const root = scroller.current;
    const box = holder.current;
    if (!root || !box) return;
    let start: { d: number; z: number; x: number; y: number } | null = null;
    let scale = 1;
    const dist = (t: TouchList) => Math.hypot(t[0]!.clientX - t[1]!.clientX, t[0]!.clientY - t[1]!.clientY);
    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      const r = root.getBoundingClientRect();
      start = { d: dist(e.touches), z: zoomRef.current, x: (e.touches[0]!.clientX + e.touches[1]!.clientX) / 2 - r.left, y: (e.touches[0]!.clientY + e.touches[1]!.clientY) / 2 - r.top };
      scale = 1;
    };
    const onMove = (e: TouchEvent) => {
      if (!start || e.touches.length !== 2) return;
      e.preventDefault();
      scale = clamp(start.z * (dist(e.touches) / start.d)) / start.z;
      box.style.transformOrigin = `${start.x + root.scrollLeft}px ${start.y + root.scrollTop}px`;
      box.style.transform = `scale(${scale})`;
    };
    const onEnd = (e: TouchEvent) => {
      if (!start || e.touches.length >= 2) return;
      const s = start, k = scale;
      start = null;
      box.style.transform = "";
      if (Math.abs(k - 1) < 0.02) return;
      setZoom(clamp(s.z * k));
      // Keep the spot between the fingers where it was.
      requestAnimationFrame(() => {
        root.scrollLeft = (s.x + root.scrollLeft) * k - s.x;
        root.scrollTop = (s.y + root.scrollTop) * k - s.y;
      });
    };
    root.addEventListener("touchstart", onStart, { passive: true });
    root.addEventListener("touchmove", onMove, { passive: false });
    root.addEventListener("touchend", onEnd);
    root.addEventListener("touchcancel", onEnd);
    return () => {
      root.removeEventListener("touchstart", onStart);
      root.removeEventListener("touchmove", onMove);
      root.removeEventListener("touchend", onEnd);
      root.removeEventListener("touchcancel", onEnd);
    };
  }, []);

  const step = (delta: number) => setZoom((z) => clamp(z + delta));
  const problem = error ?? (failed ? `Could not show the ${label.toLowerCase()}.` : null);
  return (
    <div className="viewer" role="dialog" aria-modal="true" aria-label={`${label} preview`}>
      <header className="viewer-bar">
        <button onClick={onClose}>Close</button>
        <h2>{title}{doc && doc.numPages > 1 ? <small> · {page} of {doc.numPages}</small> : null}</h2>
        <button className="zoom" aria-label="Zoom out" disabled={zoom <= MIN} onClick={() => step(-0.5)}>−</button>
        <button className="zoom" aria-label="Zoom in" disabled={zoom >= MAX} onClick={() => step(0.5)}>+</button>
      </header>
      <div className="viewer-scroll" ref={scroller}>
        {problem && <p className="notice warn">{problem}</p>}
        {!problem && !doc && <p className="muted pad">{busy}</p>}
        <div ref={holder} className="pdf-pages" />
      </div>
      {foot && <footer className="viewer-foot">{foot}</footer>}
    </div>
  );
}
