// The generic "form reader" used by every settings / study / progress / about screen: a list of rows is turned into positioned
// items (pure arithmetic, no canvas) so both update() (hit testing) and render() (drawing) use the same geometry.
// Row kinds: h p pre chips step btn btn2 kv bar word gap rule. Text width is estimated (no measureText) so this stays pure.
const CW = 0.58;                                   // average glyph width in em for bold text (chips), deliberately generous
export const estW = (str, size, cw = CW) => str.length * size * cw;
export function wrapEst(str, size, width, cw = 0.47) {
  const out = [];
  for (const para of String(str).split('\n')) {
    if (!para) { out.push(''); continue; }
    let line = '';
    for (const wd of para.split(' ')) {
      const cand = line ? `${line} ${wd}` : wd;
      if (estW(cand, size, cw) > width && line) { out.push(line); line = wd; } else line = cand;
    }
    out.push(line);
  }
  return out;
}
const rect = (x, y, w, h) => ({ x, y, w, h });

// Returns { items, height }. Item: { row, y, h, lines?, hits: [{ id, x, y, w, h, label, style, on, disabled, kind }] }; x,y relative to the content origin.
export function layoutForm(rows, width, scale, cwMul = 1) {
  const wrapEst2 = (str, size, w, cw) => wrapEst(str, size, w, cw * cwMul);
  const S = (n) => Math.round(n * scale);
  const items = []; let y = 6;
  const push = (row, h, extra = {}) => { items.push({ row, y, h, hits: [], ...extra }); const it = items[items.length - 1]; y += h; return it; };
  for (const row of rows) {
    switch (row.k) {
      case 'h': { const sz = S(38), lines = wrapEst2(row.t, sz, width, 0.58); push(row, lines.length * Math.round(sz * 1.2) + S(16), { lines, size: sz, lh: Math.round(sz * 1.2) }); break; }
      case 'p': { const sz = S(row.small ? 23 : 27), lines = wrapEst2(row.t, sz, width, 0.47); push(row, lines.length * Math.round(sz * 1.42) + S(10), { lines, size: sz, lh: Math.round(sz * 1.42) }); break; }
      case 'sub': { const sz = S(28), lines = wrapEst2(row.t, sz, width, 0.55); push(row, lines.length * Math.round(sz * 1.3) + S(14), { lines, size: sz, lh: Math.round(sz * 1.3) }); break; }
      case 'pre': { const sz = S(21), lines = wrapEst2(row.t, sz, width, 0.47); push(row, lines.length * Math.round(sz * 1.35) + S(4), { lines, size: sz, lh: Math.round(sz * 1.35) }); break; }
      case 'gap': push(row, S(row.h ?? 18)); break;
      case 'rule': push(row, S(20)); break;
      case 'kv': { const sz = S(27); const lines = wrapEst(row.r, sz, width * 0.52, 0.56); push(row, Math.max(S(44), lines.length * Math.round(sz * 1.3) + S(12)), { lines, size: sz, lh: Math.round(sz * 1.3) }); break; }
      case 'bar': push(row, S(row.text ? 104 : 64), { size: S(25) }); break;
      case 'btn': { const it = push(row, S(row.sub ? 108 : 88) + S(12)); it.hits.push({ id: row.id, x: 0, y: 0, w: width, h: S(row.sub ? 108 : 88), label: row.label, sub: row.sub, style: row.style, disabled: row.disabled, kind: 'btn' }); break; }
      case 'btn2': {
        const it = push(row, S(88) + S(12)), hw = (width - S(14)) / 2;
        it.hits.push({ id: row.a.id, x: 0, y: 0, w: hw, h: S(88), label: row.a.label, style: row.a.style, disabled: row.a.disabled, kind: 'btn' });
        it.hits.push({ id: row.b.id, x: hw + S(14), y: 0, w: hw, h: S(88), label: row.b.label, style: row.b.style, disabled: row.b.disabled, kind: 'btn' });
        break;
      }
      case 'chips': {
        const labelH = row.label ? S(36) : 0, chH = S(66), gap = S(10), sz = S(25);
        const it = push(row, 0); let cx = 0, cy = labelH;
        for (const o of row.opts) {
          const cw = Math.min(width, Math.max(S(96), estW(o.label, sz) + S(44)));
          if (cx + cw > width && cx > 0) { cx = 0; cy += chH + gap; }
          it.hits.push({ id: `${row.id}:${o.v}`, x: cx, y: cy, w: cw, h: chH, label: o.label, on: o.on, disabled: o.disabled, kind: 'chip', sz });
          cx += cw + gap;
        }
        it.h = cy + chH + (row.hint ? S(8) : 0) + S(16);
        if (row.hint) { const hl = wrapEst2(row.hint, S(22), width, 0.47); it.hintLines = hl; it.hintY = cy + chH + S(8); it.h += hl.length * Math.round(S(22) * 1.35); }
        it.labelH = labelH; y += it.h; break;
      }
      case 'step': {
        const labelH = S(36), bh = S(76), bw = S(92);
        const it = push(row, labelH + bh + S(22));
        it.hits.push({ id: `${row.id}:dec`, x: 0, y: labelH, w: bw, h: bh, label: '−', kind: 'btn', disabled: row.decOff, sz: S(40) });
        it.hits.push({ id: `${row.id}:inc`, x: width - bw, y: labelH, w: bw, h: bh, label: '+', kind: 'btn', disabled: row.incOff, sz: S(40) });
        it.labelH = labelH; it.stepBox = rect(bw + S(10), labelH, width - 2 * bw - S(20), bh); break;
      }
      case 'word': {
        const tsz = S(40), bsz = S(25), lines = wrapEst2(row.gloss, bsz, width - S(8), 0.47);
        const extra = (row.lines ?? []).flatMap((l) => wrapEst2(l, S(23), width - S(8), 0.47));
        const head = tsz + S(40), bodyH = lines.length * Math.round(bsz * 1.38) + extra.length * Math.round(S(23) * 1.4) + S(14);
        const it = push(row, head + bodyH + S(34), { lines, extra, tsz, bsz, head });
        let hx = width;
        if (row.lookup) { hx -= S(150); it.hits.push({ id: `look:${row.w}`, x: hx, y: 0, w: S(150), h: S(52), label: row.checked ? 'Looked up' : 'Look up', on: row.checked, kind: 'chip', sz: S(22) }); hx -= S(8); }
        if (row.known !== undefined) { hx -= S(150); it.hits.push({ id: `known:${row.w}`, x: hx, y: 0, w: S(150), h: S(52), label: row.known ? 'Known ✓' : 'I know it', on: row.known, kind: 'chip', sz: S(22) }); }
        break;
      }
      default: break;
    }
  }
  return { items, height: y + 20 };
}
export function hitAt(layout, x, y) {
  for (const it of layout.items) for (const h of it.hits) { const hy = it.y + h.y; if (x >= h.x && x <= h.x + h.w && y >= hy && y <= hy + h.h) return h; }
  return null;
}
