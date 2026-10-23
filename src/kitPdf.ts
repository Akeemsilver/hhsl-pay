/**
 * The starter kit as a PDF. WhatsApp opens a .txt in a text viewer with no way to save it, but it offers a normal
 * download for a PDF, and phones let a PDF be shared. The kit text sits inside the PDF as an attached file, and the
 * app finds it again by its markers when the PDF is picked.
 */
const BEGIN = "HHSLKIT-BEGIN\n";
const END = "\nHHSLKIT-END";
const enc = new TextEncoder();

const pdfText = (s: string) => s.replace(/[\\()]/g, (c) => `\\${c}`);

export function kitToPdf(kitText: string, fileName: string): Uint8Array {
  const lines = [
    ["HHSL pay app: starter kit", 20],
    ["Save this file, then open the app and tap", 12],
    ["Choose starter kit file and pick it.", 12],
    ["Do not open it in another app. It holds company pay rates.", 12],
  ] as const;
  const page = lines.map(([t, size], i) => `BT /F1 ${size} Tf 56 ${760 - i * (i === 0 ? 34 : 20)} Td (${pdfText(t)}) Tj ET`).join("\n");
  const embedded = enc.encode(BEGIN + kitText + END);
  const objs: Array<Array<string | Uint8Array>> = [
    [`<< /Type /Catalog /Pages 2 0 R /Names << /EmbeddedFiles << /Names [(${pdfText(fileName)}) 6 0 R] >> >> >>`],
    ["<< /Type /Pages /Kids [3 0 R] /Count 1 >>"],
    ["<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>"],
    [`<< /Length ${enc.encode(page).length} >>\nstream\n${page}\nendstream`],
    ["<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"],
    [`<< /Type /Filespec /F (${pdfText(fileName)}) /EF << /F 7 0 R >> >>`],
    [`<< /Type /EmbeddedFile /Length ${embedded.length} >>\nstream\n`, embedded, "\nendstream"],
  ];
  const out: Uint8Array[] = [];
  let size = 0;
  const push = (p: string | Uint8Array) => { const b = typeof p === "string" ? enc.encode(p) : p; out.push(b); size += b.length; };
  push("%PDF-1.4\n");
  const offsets: number[] = [];
  objs.forEach((parts, i) => {
    offsets.push(size);
    push(`${i + 1} 0 obj\n`);
    parts.forEach(push);
    push("\nendobj\n");
  });
  const xref = size;
  push(`xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`);
  push(`trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const all = new Uint8Array(size);
  let at = 0;
  for (const b of out) { all.set(b, at); at += b.length; }
  return all;
}

/** The kit text from a picked file: a kit PDF gives the text inside it, any other file is returned as it is. */
export function kitTextOf(fileText: string): string {
  if (!fileText.startsWith("%PDF")) return fileText;
  const a = fileText.indexOf(BEGIN);
  const b = fileText.lastIndexOf(END);
  if (a < 0 || b < a) throw new Error("That PDF is not a starter kit. Pick the HHSL starter kit file you were sent.");
  return fileText.slice(a + BEGIN.length, b);
}
