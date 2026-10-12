// A small PDF writer in plain JavaScript (hub audit O4/P3/Y6): text, lines, rectangles, filled boxes and page breaks, on the standard
// Helvetica fonts that every PDF reader has built in (no font files, no library, no network).
// The file it writes is 7-bit ASCII only (text is transliterated to plain letters), so it can travel through the same text export path as the
// CSV and JSON files and still be a valid, byte-exact PDF. Coordinates: millimetres from the TOP-left corner of the page.
// Pure: no DOM, no clock, no randomness. The creation date is passed in by the caller.

const MM = 72 / 25.4;                                  // points per millimetre
// Helvetica advance widths for codes 32..126, in 1/1000 em (from the standard Adobe font metrics).
const HW = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
const MAP = { '‘': "'", '’': "'", '“': '"', '”': '"', '–': '-', '—': '-', '…': '...', '×': 'x', '·': '-', '•': '-', ' ': ' ', '−': '-', '✓': 'x', 'é': 'e' };

// Plain ASCII for a PDF string: curly quotes and dashes become straight ones, accents lose their marks, anything else becomes "?".
export function ascii(str) {
  let out = '';
  for (const ch of String(str ?? '').normalize('NFD')) {
    if (MAP[ch]) out += MAP[ch];
    else if (ch === '\n' || ch === '\t') out += ' ';
    else { const c = ch.charCodeAt(0); if (c >= 32 && c <= 126) out += ch; else if (c >= 0x300 && c <= 0x36f) continue; else out += '?'; }
  }
  return out;
}
const esc = (s) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
// Width of a string in points at a font size (bold is a little wider).
export function textWidth(str, size, bold = false) {
  let w = 0; for (const ch of ascii(str)) w += HW[ch.charCodeAt(0) - 32] ?? 556;
  return (w / 1000) * size * (bold ? 1.07 : 1);
}
const hex = (c) => {                                    // '#rrggbb' -> "r g b" in 0..1
  const m = /^#?([0-9a-f]{6})$/i.exec(c ?? ''); if (!m) return '0 0 0';
  const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => (v / 255).toFixed(3)).join(' ');
};
const f2 = (n) => (Math.round(n * 100) / 100).toString();

export function createPdf({ landscape = false, title = '', author = 'Word Game', created = '' } = {}) {
  const PW = (landscape ? 297 : 210), PH = (landscape ? 210 : 297);       // A4 in mm
  const pages = [];
  let cur = null;
  const api = {
    width: PW, height: PH, margin: 16,
    get pageCount() { return pages.length; },
    page() { cur = []; pages.push(cur); return api; },
    // text at x,y (y is the baseline, from the top). opts: size (pt), bold, italic, color, align 'left'|'center'|'right'
    text(x, y, str, opts = {}) {
      if (!cur) api.page();
      const size = opts.size ?? 11, s = ascii(str); if (!s) return api;
      const w = textWidth(s, size, opts.bold) / MM;
      const px = opts.align === 'center' ? x - w / 2 : opts.align === 'right' ? x - w : x;
      const font = opts.bold ? 'F2' : opts.italic ? 'F3' : 'F1';
      cur.push(`${hex(opts.color)} rg BT /${font} ${f2(size)} Tf ${f2(px * MM)} ${f2((PH - y) * MM)} Td (${esc(s)}) Tj ET`);
      return api;
    },
    line(x1, y1, x2, y2, opts = {}) {
      if (!cur) api.page();
      cur.push(`${hex(opts.color ?? '#000000')} RG ${f2((opts.width ?? 0.3) * MM)} w ${f2(x1 * MM)} ${f2((PH - y1) * MM)} m ${f2(x2 * MM)} ${f2((PH - y2) * MM)} l S`);
      return api;
    },
    // rectangle with its top-left corner at x,y. opts: fill, stroke, width
    rect(x, y, w, h, opts = {}) {
      if (!cur) api.page();
      const op = opts.fill && opts.stroke ? 'B' : opts.fill ? 'f' : 'S';
      cur.push(`${opts.fill ? `${hex(opts.fill)} rg ` : ''}${opts.stroke || !opts.fill ? `${hex(opts.stroke ?? '#000000')} RG ` : ''}${f2((opts.width ?? 0.3) * MM)} w ${f2(x * MM)} ${f2((PH - y - h) * MM)} ${f2(w * MM)} ${f2(h * MM)} re ${op}`);
      return api;
    },
    // Break a string into lines no wider than `width` mm.
    wrap(str, width, size = 11, bold = false) {
      const out = [];
      for (const para of String(str ?? '').split('\n')) {
        let line = '';
        for (const wd of ascii(para).split(' ').filter(Boolean)) {
          const cand = line ? `${line} ${wd}` : wd;
          if (textWidth(cand, size, bold) / MM > width && line) { out.push(line); line = wd; } else line = cand;
        }
        out.push(line);
      }
      return out;
    },
    // The file as one ASCII string. Objects: 1 catalog, 2 page list, 3-5 fonts, then a page and its content stream per page, then the info.
    toString() {
      if (!pages.length) api.page();
      const objs = [];
      objs.push('<< /Type /Catalog /Pages 2 0 R >>');
      objs.push(`<< /Type /Pages /Kids [${pages.map((_, i) => `${6 + i * 2} 0 R`).join(' ')}] /Count ${pages.length} >>`);
      for (const f of ['Helvetica', 'Helvetica-Bold', 'Helvetica-Oblique']) objs.push(`<< /Type /Font /Subtype /Type1 /BaseFont /${f} /Encoding /WinAnsiEncoding >>`);
      pages.forEach((ops, i) => {
        const stream = ops.join('\n');
        objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${f2(PW * MM)} ${f2(PH * MM)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${7 + i * 2} 0 R >>`);
        objs.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
      });
      objs.push(`<< /Title (${esc(ascii(title))}) /Producer (Word Game) /Author (${esc(ascii(author))})${/^\d{8}$/.test(created) ? ` /CreationDate (D:${created})` : ''} >>`);
      let out = '%PDF-1.4\n'; const offsets = [];
      objs.forEach((body, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${body}\nendobj\n`; });
      const xref = out.length;
      out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
      out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R /Info ${objs.length} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
      return out;
    },
  };
  return api;
}

// Day number (days since 1970-01-01) to a calendar date, with no Date object: pure arithmetic.
export function civil(day) {
  const z = Math.floor(day) + 719468, era = Math.floor(z / 146097), doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365), y = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100)), mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1, m = mp < 10 ? mp + 3 : mp - 9;
  return { y: m <= 2 ? y + 1 : y, m, d };
}
export const isoDate = (day) => { const c = civil(day); return `${c.y}-${String(c.m).padStart(2, '0')}-${String(c.d).padStart(2, '0')}`; };
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const longDate = (day) => { const c = civil(day); return `${c.d} ${MONTHS[c.m - 1]} ${c.y}`; };
export const pdfDate = (day) => isoDate(day).replace(/-/g, '');
