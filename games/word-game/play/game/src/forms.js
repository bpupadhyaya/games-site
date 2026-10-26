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
export function layoutForm(rows, width, scale, cwMul = 1, opts = {}) {
  const wrapEst2 = (str, size, w, cw) => wrapEst(str, size, w, cw * cwMul);
  const S = (n) => Math.round(n * scale);
  const items = []; let y = 6;
  const push = (row, h, extra = {}) => { items.push({ row, y, h, hits: [], ...extra }); const it = items[items.length - 1]; y += h; return it; };
  for (let ri = 0; ri < rows.length; ri += 1) {
    const row = rows[ri];
    if (opts.twoCol && row.k === 'btn') {   // landscape welcome screens: consecutive option buttons share a compact two-column grid
      let rj = ri; while (rj < rows.length && rows[rj].k === 'btn') rj += 1;
      const grp = rows.slice(ri, rj), bh = S(76), gw = S(14), hw = (width - gw) / 2, nr = Math.ceil(grp.length / 2);
      const it = push({ k: 'btn', id: grp[0].id }, nr * (bh + S(10)));
      grp.forEach((g, i) => it.hits.push({ id: g.id, x: (i % 2) * (hw + gw), y: Math.floor(i / 2) * (bh + S(10)), w: hw, h: bh, label: g.label, sub: g.sub, style: g.style, disabled: g.disabled, kind: 'btn' }));
      ri = rj - 1; continue;
    }
    switch (row.k) {
      case 'h': { const sz = S(38), lines = wrapEst2(row.t, sz, width, 0.58); push(row, lines.length * Math.round(sz * 1.2) + S(16), { lines, size: sz, lh: Math.round(sz * 1.2) }); break; }
      case 'p': { const sz = S(row.small ? 23 : 27), lines = wrapEst2(row.t, sz, width, 0.47); push(row, lines.length * Math.round(sz * 1.42) + S(10), { lines, size: sz, lh: Math.round(sz * 1.42) }); break; }
      case 'hl': { const sz = S(row.size ?? 40), lines = wrapEst2(row.words.join(' '), sz, width, 0.52); push(row, lines.length * Math.round(sz * 1.5) + S(16), { lines, size: sz, lh: Math.round(sz * 1.5) }); break; }
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
        const extra = [], exHl = [];
        for (const l of row.lines ?? []) for (const wl of wrapEst2(l, S(23), width - S(8), 0.47)) { extra.push(wl); exHl.push(Boolean(row.hl) && l.startsWith('Example:')); }
        const chips = [];
        if (row.lookup) chips.push({ id: `look:${row.w}`, label: row.checked ? 'Looked up' : 'Look up', on: row.checked });
        if (row.compare) chips.push({ id: `compare:${row.w}`, label: 'Compare', on: false });
        if (row.known !== undefined) chips.push({ id: `known:${row.w}`, label: row.known ? 'Known ✓' : 'I know it', on: row.known });
        if (row.dict) chips.push({ id: `dict:${row.w}`, label: 'Meaning', on: false });
        if (row.dict) chips.push({ id: `thes:${row.w}`, label: 'Synonyms', on: false });
        if (row.remove) chips.push({ id: `mwrm:${row.w}`, label: 'Remove', on: false });
        if (row.explore) chips.push({ id: `explore:${row.w}`, label: 'Explore', on: false });
        if (row.flag !== undefined) chips.push({ id: `flag:${row.w}`, label: row.flag ? 'Flagged' : 'Flag', on: row.flag });
        const cw = S(150), total = chips.length * (cw + S(8)), below = total > width * 0.5, chipH = S(52);
        const perRow = Math.max(1, Math.floor((width + S(8)) / (cw + S(8)))), chipRows = below ? Math.ceil(chips.length / perRow) : 0;      // chips wrap onto more rows when there are many (look up, compare, known, explore, flag)
        const head = tsz + S(40) + (chipRows ? chipRows * (chipH + S(10)) : 0), bodyH = lines.length * Math.round(bsz * 1.38) + extra.length * Math.round(S(23) * 1.4) + S(14);
        const it = push(row, head + bodyH + S(34), { lines, extra, exHl, tsz, bsz, head, hlWord: row.hl });
        let hx = width, cy = below ? tsz + S(44) : 0, cx = 0;
        chips.forEach((c, ci) => { if (below) { if (ci > 0 && ci % perRow === 0) { cx = 0; cy += chipH + S(10); } it.hits.push({ ...c, x: cx, y: cy, w: cw, h: chipH, kind: 'chip', sz: S(22) }); cx += cw + S(8); } else { hx -= cw; it.hits.push({ ...c, x: hx, y: 0, w: cw, h: chipH, kind: 'chip', sz: S(22) }); hx -= S(8); } });
        break;
      }
      case 'rtext': {
        const sz = S(30), lh = S(48), toks = row.t.split(/\s+/).filter(Boolean), it = push(row, 0); let x = 0, line = 0;
        for (const tk of toks) {
          const w = Math.max(S(20), estW(tk, sz, 0.52 * cwMul)), id = tk.replace(/[^A-Za-z]/g, '').toLowerCase();
          if (x + w > width && x > 0) { x = 0; line += 1; }
          it.hits.push({ id: id ? `rw:${id}:${it.hits.length}` : 'none', x, y: line * lh, w, h: lh - 4, label: tk, kind: 'tok', sz, word: id, idx: it.hits.length, disabled: !id });
          x += w + S(12);
        }
        it.h = (line + 1) * lh + S(16); y += it.h; it.lh = lh; break;
      }
      case 'big': push(row, S(row.art ? 250 : 190), { size: S(row.art ? 110 : 130) }); break;
      case 'grid': {
        const gap = S(8), ch = S(row.h ?? 78), labelH = row.label ? S(36) : 0, it = push(row, 0); let cy = labelH;
        for (let r = 0; r < row.rows.length; r += 1) {
          const cells = row.rows[r], cols = row.cols ?? Math.max(...row.rows.map((x) => x.length)), cw = Math.floor((width - (cols - 1) * gap) / cols), rowW = cells.length * cw + (cells.length - 1) * gap, x0 = Math.floor((width - rowW) / 2);
          cells.forEach((c, i) => it.hits.push({ id: `${row.id}:${c.v}`, x: x0 + i * (cw + gap), y: cy, w: cw, h: ch, label: c.label, on: c.on, bad: c.bad, disabled: c.off, kind: 'chip', sz: S(row.sz ?? 34) }));
          cy += ch + gap;
        }
        it.h = cy + S(10); it.labelH = labelH; y += it.h; break;
      }
      case 'wmap': {                                    // a word map: tiers of linked words around a centre word (C4, C10, D1)
        const labH = S(30), chH = S(58), gap = S(8), sz = S(23), tg = S(18), it = push(row, 0); let cy = 0; it.labels = []; it.links = []; let prevBottom = null;
        const tier = (t, centre) => {
          if (!t.words.length) return;
          const top = cy; if (prevBottom !== null) it.links.push([width / 2, prevBottom, width / 2, top]);
          if (t.label) { it.labels.push({ t: t.label, y: cy + S(22) }); cy += labH; }
          let cx = 0; const ws = centre ? [t.words[0]] : t.words; let first = true;
          const meas = ws.map((w) => (centre ? Math.min(width, Math.max(S(170), estW(w, S(34)) + S(64))) : Math.min(width, Math.max(S(90), estW(w, sz) + S(40)))));
          if (centre) cx = Math.floor((width - meas[0]) / 2);
          ws.forEach((w, i) => {
            const cw = meas[i], h = centre ? S(76) : chH;
            if (!centre && cx + cw > width && cx > 0) { cx = 0; cy += chH + gap; }
            it.hits.push({ id: centre ? 'wmapc:x' : `${t.id}:${w}`, x: cx, y: cy, w: cw, h, label: w, on: centre || Boolean(t.on?.includes(w)), disabled: centre ? false : t.off?.includes(w), kind: 'chip', sz: centre ? S(34) : sz });
            cx += cw + gap; first = false;
          });
          void first; cy += (centre ? S(76) : chH); prevBottom = cy; cy += tg;
        };
        for (let i = 0; i < row.tiers.length; i += 1) { if (i === row.centreAt) tier({ words: [row.centre] }, true); tier(row.tiers[i], false); }
        if (row.centreAt >= row.tiers.length) tier({ words: [row.centre] }, true);
        it.h = cy + S(6); y += it.h; break;
      }
      case 'heat': push(row, S(7 * 34 + 110), { size: S(26) }); break;
      case 'stickers': { const cols = width > S(520) ? 5 : 4, cell = Math.floor((width - (cols - 1) * S(10)) / cols); push(row, Math.ceil(row.cells.length / cols) * (cell + S(10)) + S(10), { cols, cell }); break; }
      default: break;
    }
  }
  return { items, height: y + 20 };
}
export function hitAt(layout, x, y) {
  for (const it of layout.items) for (const h of it.hits) { const hy = it.y + h.y; if (x >= h.x && x <= h.x + h.w && y >= hy && y <= hy + h.h) return h; }
  return null;
}
