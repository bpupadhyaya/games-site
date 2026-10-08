// Text screens: Rules (paged), About, How to Play and Settings share one scrolling document renderer with a text-size stepper (to 300%).
// render() records what is tappable in `ui.hits` (rects in screen space); the game's update() reads it on the next tick.
import { PAL, UI, DISPLAY, rgba, drawBar, drawGong, drawNote, drawCycleRing, drawEnsIcon } from './art.js';
import { txt, wrap, button, panel, rrect, icon, chip } from './ui.js';
import { TEXT_SCALES, host } from './layout.js';
import { TUNINGS, CYCLES, INSTRUMENTS } from './music.js';

export const ui = { hits: [] };
export const docMetrics = { max: 0, view: 0 };
const cache = new Map();

// ---- figures (they use the game's own bar / gong / note painters) --------------------------------------------------------------------
function barRow(ctx, tun, x, y, w, h, o = {}) {
  const n = tun.n, cell = w / n, bw = Math.min(cell * 0.82, h * 0.55), bh = h - 34;
  for (let i = 0; i < n; i++) {
    const hh = bh * (1 - 0.26 * (n > 1 ? i / (n - 1) : 0));
    drawBar(ctx, { cx: x + cell * (i + 0.5), cy: y + bh / 2, w: bw, h: hh }, { label: o.noLabel ? null : tun.numerals[i], ring: o.ring === i ? 0.8 : 0 });
    txt(ctx, o.under?.[i] ?? '', x + cell * (i + 0.5), y + h - 12, Math.min(22, cell * 0.2), PAL.dim, { align: 'center', weight: 600, maxW: cell });
  }
}
function figure(ctx, name, x, y, w, h, st) {
  ctx.save();
  if (name === 'slendro' || name === 'pelog') {
    const tun = TUNINGS[name];
    barRow(ctx, tun, x, y, w, h, { under: tun.cents.map((c, i) => (i === 0 ? '0' : `+${c - tun.cents[i - 1]}`)) });
  } else if (name === 'gongs') {
    const r = Math.min(w * 0.11, (h - 40) / 2.6), xs = [0.2, 0.5, 0.8], kinds = ['kenong', 'kempul', 'gong'], names = ['Kenong', 'Kempul', 'Gong'], rs = [0.86, 0.96, 1.28];
    kinds.forEach((k, i) => { const cx = x + w * xs[i]; drawGong(ctx, { cx, cy: y + h * 0.45, r: r * rs[i] }, k, {}); txt(ctx, names[i], cx, y + h - 12, 24, PAL.text, { align: 'center', weight: 700 }); });
  } else if (name === 'cycle16' || name === 'cycle8') {
    const cyc = name === 'cycle16' ? CYCLES.long : CYCLES.short, r = Math.min(h * 0.38, w * 0.2), cx = x + w * 0.27, cy = y + h * 0.5;
    drawCycleRing(ctx, cx, cy, r, cyc, 0.3, {}, 0);
    const rows = [['#c8a878', 'Kethuk tick'], ['#59d4b6', 'Kenong'], ['#b99cff', 'Kempul'], ['#f2cf7c', 'Gong (top)']];
    rows.forEach(([c, label], i) => { const yy = cy - r * 0.95 + i * r * 0.62; ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x + w * 0.56, yy, 9, 0, 6.3); ctx.fill(); txt(ctx, label, x + w * 0.56 + 24, yy, 24, PAL.text, { weight: 600, maxW: w * 0.4 }); });
  } else if (name === 'notes') {
    const items = [['bar', 3, false, 'bar'], ['bar', 5, true, 'soft bar'], ['gong', null, false, 'gong'], ['bar', 2, 'ghost', 'ghost']];
    items.forEach(([shape, lab, soft, label], i) => {
      const cx = x + w * (i + 0.5) / 4;
      drawNote(ctx, cx, y + h * 0.4, 36, shape, lab, soft === true, 1, soft === 'ghost');
      txt(ctx, label, cx, y + h - 16, 22, PAL.text, { align: 'center', weight: 600 });
    });
  } else if (name === 'layers') {
    const names = ['Cycle (always)', 'Slenthem', 'Peking', 'Shimmer'], rowH = h / 4;
    names.forEach((n, i) => {
      const yy = y + i * rowH + rowH / 2, on = i <= 2;
      ctx.fillStyle = on ? 'rgba(89,212,182,0.32)' : 'rgba(255,255,255,0.06)'; rrect(ctx, { x: x + 190, y: yy - rowH * 0.32, w: w - 190, h: rowH * 0.64 }, 10); ctx.fill();
      txt(ctx, n, x, yy, 22, on ? PAL.text : PAL.dim, { weight: 600, maxW: 180 });
      for (let b = 0; b < 12; b++) { if ((b * 5 + i * 3) % (i === 0 ? 3 : 4) < 2 || i === 0) { ctx.fillStyle = on ? '#8ef0dc' : 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.arc(x + 220 + b * ((w - 250) / 11), yy, 5, 0, Math.PI * 2); ctx.fill(); } }
    });
  } else if (name === 'ensemble') {
    const keys = ['kethuk', 'kenong', 'kempul', 'gong', 'slenthem', 'peking'], cw = w / 6;
    keys.forEach((k, i) => { drawEnsIcon(ctx, k, x + cw * (i + 0.5), y + h * 0.42, Math.min(cw * 0.42, h * 0.34), {}); txt(ctx, k[0].toUpperCase() + k.slice(1), x + cw * (i + 0.5), y + h - 12, Math.min(22, cw * 0.19), PAL.text, { align: 'center', weight: 600, maxW: cw - 4 }); });
  }
  ctx.restore();
}

// ---- layout of blocks into drawable ops --------------------------------------------------------------------------------------------------
function layoutDoc(ctx, blocks, width, ts) {
  const ops = []; let y = 0;
  const bodyF = 27 * ts, headF = 34 * ts, lh = bodyF * 1.42;
  for (const b of blocks) {
    if (b.h) {
      y += ops.length ? 22 * ts : 0;
      ctx.font = `800 ${headF}px ${UI}`; const lines = wrap(ctx, b.h, width);
      ops.push({ t: 'h', y, lines, size: headF, h: lines.length * headF * 1.25 }); y += lines.length * headF * 1.25 + 8 * ts;
    } else if (b.p) {
      ctx.font = `500 ${bodyF}px ${UI}`; const lines = wrap(ctx, b.p, width);
      ops.push({ t: 'p', y, lines, size: bodyF, lh, h: lines.length * lh }); y += lines.length * lh + 12 * ts;
    } else if (b.li) {
      ctx.font = `500 ${bodyF}px ${UI}`; const ind = 34 * ts, lines = wrap(ctx, b.li, width - ind);
      ops.push({ t: 'li', y, lines, size: bodyF, lh, ind, h: lines.length * lh }); y += lines.length * lh + 8 * ts;
    } else if (b.fig) {
      const hh = b.hh * Math.min(ts, 1.5);
      ops.push({ t: 'fig', y, name: b.fig, h: hh }); y += hh + 16 * ts;
    } else if (b.sp) { y += 22 * ts; }
    else if (b.row) {
      const rh = Math.max(86, 56 * ts + 30);
      ops.push({ t: 'row', y, b, h: rh }); y += rh + 10;
    }
  }
  return { ops, total: y };
}

export function renderDoc(ctx, st, L, doc) {
  const D = L.doc, ts = TEXT_SCALES[st.prefs.textIdx] ?? 1, vp = D.viewport;
  ui.hits = [];
  // header
  button(ctx, D.back, 'Back', { icon: 'back', kind: 'ghost', size: 28 });
  ui.hits.push({ id: 'back', r: D.back });
  button(ctx, D.textDec, 'A-', { kind: st.prefs.textIdx > 0 ? 'quiet' : 'disabled', size: 28 }); ui.hits.push({ id: 'textDec', r: D.textDec });
  button(ctx, D.textInc, 'A+', { kind: st.prefs.textIdx < TEXT_SCALES.length - 1 ? 'quiet' : 'disabled', size: 28 }); ui.hits.push({ id: 'textInc', r: D.textInc });
  if (doc.nav) { button(ctx, D.nav.back, 'Previous', { icon: 'back', kind: doc.page > 0 ? 'quiet' : 'disabled', size: 28 }); button(ctx, D.nav.next, doc.page < doc.pages - 1 ? 'Next' : 'Done', { kind: 'primary', size: 28 }); ui.hits.push({ id: 'prev', r: D.nav.back }, { id: 'next', r: D.nav.next }); }
  // title
  const tx = D.viewport.x + D.viewport.w / 2;
  txt(ctx, doc.title, tx, vp.y - 30, 38, PAL.gold, { align: 'center', font: DISPLAY, weight: 400, maxW: D.viewport.w - 20, stroke: 6 });
  // body
  const vh = doc.nav ? vp.h : (D.nav.back.y + D.nav.back.h) - vp.y;
  const view = { x: vp.x, y: vp.y, w: vp.w, h: vh };
  panel(ctx, view, { fill: 'rgba(28,10,8,0.72)', rad: 22 });
  const padX = 22, innerW = view.w - padX * 2 - 18;
  const key = `${doc.key}|${Math.round(innerW)}|${ts}`;
  let lay = cache.get(key);
  if (!lay) { lay = layoutDoc(ctx, doc.blocks, innerW, ts); if (cache.size > 30) cache.clear(); cache.set(key, lay); }
  const max = Math.max(0, lay.total + 28 - view.h);
  docMetrics.max = max; docMetrics.view = view.h; docMetrics.hit = view;
  if (st.docRescale) { st.docScroll = st.docFrac * max; st.docRescale = false; }
  const scroll = Math.max(0, Math.min(st.docScroll, max)); st.docScroll = scroll;
  ctx.save(); rrect(ctx, view, 22); ctx.clip();
  ctx.translate(view.x + padX, view.y + 18 - scroll);
  for (const op of lay.ops) {
    if (op.y + op.h < scroll - 40 || op.y > scroll + view.h + 40) continue;
    if (op.t === 'h') { ctx.font = `800 ${op.size}px ${UI}`; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = PAL.gold; op.lines.forEach((ln, i) => ctx.fillText(ln, 0, op.y + i * op.size * 1.25)); }
    else if (op.t === 'p') { ctx.font = `500 ${op.size}px ${UI}`; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = PAL.text; op.lines.forEach((ln, i) => ctx.fillText(ln, 0, op.y + i * op.lh)); }
    else if (op.t === 'li') {
      ctx.font = `500 ${op.size}px ${UI}`; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = PAL.text;
      ctx.beginPath(); ctx.fillStyle = PAL.amber; ctx.arc(10 * ts, op.y + op.lh * 0.5, 5 * ts + 1, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = PAL.text;
      op.lines.forEach((ln, i) => ctx.fillText(ln, op.ind, op.y + i * op.lh));
    } else if (op.t === 'fig') figure(ctx, op.name, 0, op.y, innerW, op.h, st);
    else if (op.t === 'row') {
      const b = op.b, r = { x: 0, y: op.y, w: innerW, h: op.h };
      ctx.fillStyle = 'rgba(255,240,220,0.07)'; rrect(ctx, r, 18); ctx.fill();
      txt(ctx, b.label, 20, op.y + op.h * (b.hint ? 0.36 : 0.5), 28 * Math.min(ts, 1.6), PAL.text, { weight: 700, maxW: innerW * 0.52 });
      if (b.hint) txt(ctx, b.hint, 20, op.y + op.h * 0.72, 20 * Math.min(ts, 1.6), PAL.dim, { weight: 500, maxW: innerW * 0.55 });
      const val = b.val?.();
      const sx = view.x + padX, sy = view.y + 18 - scroll;
      const screenR = (rr) => ({ x: sx + rr.x, y: sy + rr.y, w: rr.w, h: rr.h });
      if (b.kind === 'toggle') {
        const tw = 108, th = 52, tr = { x: innerW - tw - 20, y: op.y + (op.h - th) / 2, w: tw, h: th };
        ctx.fillStyle = val ? '#2fb6a3' : 'rgba(255,255,255,0.16)'; rrect(ctx, tr, th / 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(val ? tr.x + tw - th / 2 : tr.x + th / 2, tr.y + th / 2, th / 2 - 5, 0, Math.PI * 2); ctx.fill();
        ui.hits.push({ id: 'set:' + b.row, r: screenR(r), clip: view });
      } else if (b.kind === 'cycle') {
        txt(ctx, String(val), innerW - 24, op.y + op.h / 2, 28 * Math.min(ts, 1.6), PAL.gold, { align: 'right', weight: 800, maxW: innerW * 0.4 });
        ui.hits.push({ id: 'set:' + b.row, r: screenR(r), clip: view });
      } else if (b.kind === 'stepper') {
        const bw = 72, dec = { x: innerW - 20 - bw * 2 - 150, y: op.y + (op.h - 64) / 2, w: bw, h: 64 }, inc = { x: innerW - 20 - bw, y: dec.y, w: bw, h: 64 };
        button(ctx, dec, '-', { kind: 'quiet', size: 34, noShadow: true }); button(ctx, inc, '+', { kind: 'quiet', size: 34, noShadow: true });
        txt(ctx, String(val), dec.x + bw + 75, op.y + op.h / 2, 26 * Math.min(ts, 1.4), PAL.gold, { align: 'center', weight: 800, maxW: 140 });
        ui.hits.push({ id: 'set:' + b.row + 'Dec', r: screenR(dec), clip: view }, { id: 'set:' + b.row + 'Inc', r: screenR(inc), clip: view });
      } else if (b.kind === 'button') {
        const bw = Math.min(innerW * 0.4, 280), br = { x: innerW - bw - 20, y: op.y + (op.h - 66) / 2, w: bw, h: 66 };
        button(ctx, br, b.btn ?? 'Open', { kind: 'primary', size: 28, noShadow: true });
        ui.hits.push({ id: 'set:' + b.row, r: screenR(r), clip: view });
      }
    }
  }
  ctx.restore();
  // scrollbar
  if (max > 0) {
    const sb = { x: view.x + view.w - 12, y: view.y + 12, w: 6, h: view.h - 24 }, th = Math.max(40, sb.h * view.h / (lay.total + 28));
    ctx.fillStyle = 'rgba(255,240,220,0.12)'; rrect(ctx, sb, 3); ctx.fill();
    ctx.fillStyle = 'rgba(255,200,140,0.7)'; rrect(ctx, { x: sb.x, y: sb.y + (sb.h - th) * (scroll / max), w: sb.w, h: th }, 3); ctx.fill();
  }
  ui.view = view;
}
