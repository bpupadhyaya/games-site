// Pure text layout helpers. Widths are ESTIMATED (no canvas here) with a conservative per-character factor, so the same
// numbers drive both what is drawn (view.js) and what can be tapped (ui.js/game.js): what you see is what you can tap,
// and nothing overflows at any text-size step.
export const CHAR_W = 0.52;
export const estW = (str, size) => str.length * size * CHAR_W;

export function wrapLines(str, size, maxW) {
  const out = [];
  for (const para of String(str).split('\n')) {
    let cur = '';
    for (const word of para.split(' ')) {
      const t = cur ? cur + ' ' + word : word;
      if (estW(t, size) > maxW && cur) { out.push(cur); cur = word; } else cur = t;
    }
    out.push(cur);
  }
  // a single very long word is hard-broken so it can never run outside its box
  const per = Math.max(1, Math.floor(maxW / (size * CHAR_W)));
  return out.flatMap((l) => (l.length > per ? l.match(new RegExp(`.{1,${per}}`, 'g')) : [l]));
}

// Split a reader document (sections of paragraphs, optional art) into pages for a body box at a given zoom.
// section: { h: heading, art?: kind, p: [paragraph, ...] }.  Returns [{ h, art, lines:[{str, gapBefore}], part, parts }].
export const ART_H = 230;
export function paginate(sections, z, bodyW, bodyH, base = 28) {
  const size = Math.round(base * z), lh = Math.round(size * 1.36), gap = Math.round(size * 0.55), pages = [];
  for (const sec of sections) {
    let cur = null, used = 0;
    const open = (withArt) => { cur = { h: sec.h, art: withArt ? sec.art : null, lines: [], part: 0, size, lh }; used = withArt ? ART_H + Math.round(size * 0.3) : 0; pages.push(cur); };
    open(!!sec.art);
    for (const para of sec.p) {
      const lines = wrapLines(para, size, bodyW);
      lines.forEach((str, k) => {
        const g = k === 0 && cur.lines.length ? gap : 0;
        if (used + g + lh > bodyH && cur.lines.length) { open(false); }
        const g2 = k === 0 && cur.lines.length ? gap : 0;
        cur.lines.push({ str, gap: g2 }); used += g2 + lh;
      });
    }
  }
  // number the continuation pages of every section
  const bySec = new Map();
  pages.forEach((p) => { bySec.set(p.h, (bySec.get(p.h) || 0) + 1); });
  const seen = {};
  pages.forEach((p) => { seen[p.h] = (seen[p.h] || 0) + 1; p.part = seen[p.h]; p.parts = bySec.get(p.h); });
  return pages;
}
