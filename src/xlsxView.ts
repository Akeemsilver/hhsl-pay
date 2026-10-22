/**
 * Reads one worksheet of an .xlsx into a simple grid that can be drawn on screen,
 * so the timesheet can be previewed exactly as the Excel file will look.
 * It understands what a form like the HHSL time sheet uses: values, number formats, merged cells,
 * borders, fills, fonts, alignment, column widths, row heights and one logo picture.
 */

export interface CellStyle {
  bold?: boolean;
  italic?: boolean;
  /** pt */
  size?: number;
  color?: string;
  fill?: string;
  h?: "left" | "center" | "right";
  v?: "top" | "center" | "bottom";
  wrap?: boolean;
  /** CSS borders per side, e.g. "1px solid #000000". */
  borders: { top?: string; right?: string; bottom?: string; left?: string };
}

export interface ViewCell {
  text: string;
  style: CellStyle;
  rowSpan: number;
  colSpan: number;
}

export interface SheetView {
  /** Column widths in px, column A first. */
  cols: number[];
  /** Row heights in px, row 1 first. */
  rows: number[];
  /** grid[row][col]; null where a merged cell covers it. */
  grid: Array<Array<ViewCell | null>>;
  image?: { src: string; x: number; y: number; w: number; h: number };
}

const attr = (s: string, name: string): string | undefined => new RegExp(`\\s${name}="([^"]*)"`).exec(s)?.[1];
const decode = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

function colIndex(letters: string): number {
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function colName(index: number): string {
  let n = index + 1, out = "";
  while (n > 0) { const rem = (n - 1) % 26; out = String.fromCharCode(65 + rem) + out; n = Math.floor((n - 1) / 26); }
  return out;
}

function parseRef(ref: string): { r: number; c: number } {
  const m = /^([A-Z]+)(\d+)$/.exec(ref)!;
  return { r: Number(m[2]) - 1, c: colIndex(m[1]!) };
}

function* blocks(xml: string, name: string): Generator<{ attrs: string; body: string }> {
  const re = new RegExp(`<${name}\\b([^>]*?)(?:/>|>([\\s\\S]*?)</${name}>)`, "g");
  for (const m of xml.matchAll(re)) yield { attrs: m[1] ?? "", body: m[2] ?? "" };
}

const argb = (s: string | undefined) => (s && /^[0-9A-Fa-f]{8}$/.test(s) ? `#${s.slice(2)}` : s && /^[0-9A-Fa-f]{6}$/.test(s) ? `#${s}` : undefined);

function borderCss(style: string | undefined, color: string | undefined): string | undefined {
  if (!style || style === "none") return undefined;
  const width = style === "thick" ? 3 : style === "medium" || style === "mediumDashed" ? 2 : 1;
  const kind = /dash|dot|hair/i.test(style) ? "dotted" : "solid";
  return `${width}px ${kind} ${color ?? "#000000"}`;
}

const BUILTIN_FORMATS: Record<number, string> = { 1: "0", 2: "0.00", 3: "#,##0", 4: "#,##0.00", 9: "0%", 10: "0.00%", 20: "h:mm", 21: "h:mm:ss", 18: "h:mm AM/PM" };

function formatNumber(value: number, code: string | undefined): string {
  if (!code || code === "General") return String(Math.round(value * 1e10) / 1e10);
  if (/h:mm/.test(code)) {
    const mins = Math.round((value % 1) * 1440);
    return `${Math.floor(mins / 60) % 24}:${String(mins % 60).padStart(2, "0")}`;
  }
  const decimals = /0\.(0+)/.exec(code)?.[1]?.length ?? 0;
  if (code.includes("%")) return `${(value * 100).toFixed(decimals)}%`;
  return code.includes("#,##") ? value.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : value.toFixed(decimals);
}

interface Xf { numFmtId: number; style: CellStyle }

function parseStyles(xml: string): { xfs: Xf[]; formats: Map<number, string> } {
  const formats = new Map<number, string>();
  for (const f of blocks(xml, "numFmt")) formats.set(Number(attr(f.attrs, "numFmtId")), decode(attr(f.attrs, "formatCode") ?? ""));

  const fonts = [...blocks(/<fonts[\s\S]*?<\/fonts>/.exec(xml)?.[0] ?? "", "font")].map((f) => ({
    bold: /<b\b/.test(f.body), italic: /<i\b/.test(f.body),
    size: Number(attr(/<sz\b[^>]*>/.exec(f.body)?.[0] ?? "", "val")) || undefined,
    color: argb(attr(/<color\b[^>]*>/.exec(f.body)?.[0] ?? "", "rgb")),
  }));
  const fills = [...blocks(/<fills[\s\S]*?<\/fills>/.exec(xml)?.[0] ?? "", "fill")].map((f) =>
    /patternType="solid"/.test(f.body) ? argb(attr(/<fgColor\b[^>]*>/.exec(f.body)?.[0] ?? "", "rgb")) : undefined);
  const borders = [...blocks(/<borders[\s\S]*?<\/borders>/.exec(xml)?.[0] ?? "", "border")].map((b) => {
    const side = (name: string) => {
      const m = new RegExp(`<${name}\\b([^>]*?)(?:/>|>([\\s\\S]*?)</${name}>)`).exec(b.body);
      return m ? borderCss(attr(m[1] ?? "", "style"), argb(attr(/<color\b[^>]*>/.exec(m[2] ?? "")?.[0] ?? "", "rgb"))) : undefined;
    };
    return { top: side("top"), right: side("right"), bottom: side("bottom"), left: side("left") };
  });

  const xfSection = /<cellXfs[\s\S]*?<\/cellXfs>/.exec(xml)?.[0] ?? "";
  const xfs: Xf[] = [...blocks(xfSection, "xf")].map((x) => {
    const font = fonts[Number(attr(x.attrs, "fontId") ?? 0)];
    const al = /<alignment\b[^>]*>/.exec(x.body)?.[0] ?? "";
    const h = attr(al, "horizontal"), v = attr(al, "vertical");
    return {
      numFmtId: Number(attr(x.attrs, "numFmtId") ?? 0),
      style: {
        bold: font?.bold, italic: font?.italic, size: font?.size, color: font?.color,
        fill: fills[Number(attr(x.attrs, "fillId") ?? 0)],
        h: h === "center" || h === "right" || h === "left" ? h : undefined,
        v: v === "top" || v === "bottom" ? v : v === "center" ? "center" : undefined,
        wrap: attr(al, "wrapText") === "1",
        borders: borders[Number(attr(x.attrs, "borderId") ?? 0)] ?? {},
      },
    };
  });
  return { xfs, formats };
}

const hasBorder = (s: CellStyle) => !!(s.borders.top || s.borders.right || s.borders.bottom || s.borders.left);

export async function parseSheet(bytes: ArrayBuffer | Uint8Array): Promise<SheetView> {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(bytes);
  const text = async (path: string) => (await zip.file(path)?.async("string")) ?? "";
  const sheetXml = await text("xl/worksheets/sheet1.xml");
  if (!sheetXml) throw new Error("No worksheet found.");
  const { xfs, formats } = parseStyles(await text("xl/styles.xml"));
  const shared = [...blocks(await text("xl/sharedStrings.xml"), "si")].map((si) => decode([...blocks(si.body, "t")].map((t) => t.body).join("")));

  // Column widths and row heights
  const defCol = Number(attr(/<sheetFormatPr\b[^>]*>/.exec(sheetXml)?.[0] ?? "", "defaultColWidth") ?? 8.43);
  const defRow = Number(attr(/<sheetFormatPr\b[^>]*>/.exec(sheetXml)?.[0] ?? "", "defaultRowHeight") ?? 15);
  const colWidths = new Map<number, number>();
  for (const c of blocks(/<cols>[\s\S]*?<\/cols>/.exec(sheetXml)?.[0] ?? "", "col")) {
    const min = Number(attr(c.attrs, "min")), max = Number(attr(c.attrs, "max")), w = Number(attr(c.attrs, "width"));
    for (let i = min; i <= max; i++) colWidths.set(i - 1, w);
  }

  // Cells
  const cells = new Map<string, { text: string; style: CellStyle }>();
  const rowHeights = new Map<number, number>();
  let maxRow = 0, maxCol = 0;
  for (const row of blocks(sheetXml, "row")) {
    const r = Number(attr(row.attrs, "r")) - 1;
    const ht = attr(row.attrs, "ht");
    if (ht) rowHeights.set(r, Number(ht));
    for (const c of blocks(row.body, "c")) {
      const ref = attr(c.attrs, "r")!;
      const { r: rr, c: cc } = parseRef(ref);
      const xf = xfs[Number(attr(c.attrs, "s") ?? 0)] ?? { numFmtId: 0, style: { borders: {} } };
      const type = attr(c.attrs, "t");
      let out = "";
      if (type === "inlineStr") out = decode([...blocks(c.body, "t")].map((t) => t.body).join(""));
      else {
        const v = /<v>([\s\S]*?)<\/v>/.exec(c.body)?.[1];
        if (v !== undefined) {
          if (type === "s") out = shared[Number(v)] ?? "";
          else if (type === "str") out = decode(v);
          else if (type === "b") out = v === "1" ? "TRUE" : "FALSE";
          else out = formatNumber(Number(v), formats.get(xf.numFmtId) ?? BUILTIN_FORMATS[xf.numFmtId]);
        }
      }
      cells.set(ref, { text: out, style: xf.style });
      if (out !== "" || hasBorder(xf.style) || xf.style.fill) { maxRow = Math.max(maxRow, rr); maxCol = Math.max(maxCol, cc); }
    }
  }

  const rowCount = maxRow + 1, colCount = maxCol + 1;
  const cols = Array.from({ length: colCount }, (_, i) => Math.trunc((colWidths.get(i) ?? defCol) * 7 + 5));
  const rows = Array.from({ length: rowCount }, (_, i) => Math.round(((rowHeights.get(i) ?? defRow) * 96) / 72));

  const grid: Array<Array<ViewCell | null>> = Array.from({ length: rowCount }, (_, r) =>
    Array.from({ length: colCount }, (_, c) => {
      const cell = cells.get(`${colName(c)}${r + 1}`);
      return { text: cell?.text ?? "", style: cell?.style ?? { borders: {} }, rowSpan: 1, colSpan: 1 };
    }));
  for (const m of blocks(sheetXml, "mergeCell")) {
    const [a, b] = (attr(m.attrs, "ref") ?? "").split(":");
    if (!a || !b) continue;
    const from = parseRef(a), to = parseRef(b);
    if (from.r >= rowCount || from.c >= colCount) continue;
    const owner = grid[from.r]![from.c]!;
    owner.rowSpan = Math.min(to.r, rowCount - 1) - from.r + 1;
    owner.colSpan = Math.min(to.c, colCount - 1) - from.c + 1;
    // A merged cell takes the borders along its far edges from the cells it covers.
    const farRight = grid[from.r]![Math.min(to.c, colCount - 1)]!.style.borders.right;
    const farBottom = grid[Math.min(to.r, rowCount - 1)]![from.c]!.style.borders.bottom;
    owner.style = { ...owner.style, borders: { ...owner.style.borders, right: owner.style.borders.right ?? farRight, bottom: owner.style.borders.bottom ?? farBottom } };
    for (let r = from.r; r <= Math.min(to.r, rowCount - 1); r++) {
      for (let c = from.c; c <= Math.min(to.c, colCount - 1); c++) if (r !== from.r || c !== from.c) grid[r]![c] = null;
    }
  }

  // The logo
  let image: SheetView["image"];
  const drawing = await text("xl/drawings/drawing1.xml");
  const rels = await text("xl/drawings/_rels/drawing1.xml.rels");
  const anchor = /<xdr:oneCellAnchor>[\s\S]*?<\/xdr:oneCellAnchor>/.exec(drawing)?.[0];
  if (anchor) {
    const num = (re: RegExp) => Number(re.exec(anchor)?.[1] ?? 0);
    const col = num(/<xdr:col>(\d+)<\/xdr:col>/), row = num(/<xdr:row>(\d+)<\/xdr:row>/);
    const colOff = num(/<xdr:colOff>(\d+)<\/xdr:colOff>/), rowOff = num(/<xdr:rowOff>(\d+)<\/xdr:rowOff>/);
    const ext = /<xdr:ext cx="(\d+)" cy="(\d+)"/.exec(anchor);
    const rid = /r:embed="([^"]+)"/.exec(anchor)?.[1];
    const target = rid ? new RegExp(`Id="${rid}"[^>]*Target="([^"]+)"|Target="([^"]+)"[^>]*Id="${rid}"`).exec(rels) : null;
    const path = (target?.[1] ?? target?.[2])?.replace("../", "xl/");
    const file = path ? zip.file(path) : null;
    if (file && ext) {
      const png = await file.async("base64");
      const mime = /\.jpe?g$/i.test(path!) ? "image/jpeg" : "image/png";
      image = {
        src: `data:${mime};base64,${png}`,
        x: cols.slice(0, col).reduce((s, w) => s + w, 0) + colOff / 9525,
        y: rows.slice(0, row).reduce((s, h) => s + h, 0) + rowOff / 9525,
        w: Number(ext[1]) / 9525, h: Number(ext[2]) / 9525,
      };
    }
  }
  return { cols, rows, grid, image };
}
