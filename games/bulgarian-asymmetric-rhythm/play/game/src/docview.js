// Text screens: Rules (paged), About, How to Play and Settings share one scrolling document renderer with a text-size stepper (to 300%).
// render records what is tappable in `ui.hits` (rects in screen space); the game's update() reads it on the next tick.
import { PAL, UI, DISPLAY, KIND_COL, drawPad, drawSymbol, drawStitch } from './art.js';
import { drawRow } from './rows.js';
import { barOf, parseBar, PIECES, DANCERS, LAYER_NAMES, FLOW } from './music.js';
import { txt, wrap, button, panel, rrect } from './ui.js';
import { TEXT_SCALES } from './layout.js';

export const ui = { hits: [], view: null };
export const docMetrics = { max: 0, view: 0 };
const cache = new Map();
const SPEC = (label, pat) => `${label} ${pat}`;

// small cloth strip behind a sample row
function strip(ctx, x, y, w, h) {
  ctx.fillStyle = '#f6e8c9'; rrect(ctx, { x, y, w, h }, 14); ctx.fill();
  ctx.fillStyle = PAL.red; ctx.fillRect(x + 10, y + 6, w - 20, 4); ctx.fillRect(x + 10, y + h - 10, w - 20, 4);
}

function figure(ctx, name, x, y, w, h, t) {
  ctx.save();
  if (name === 'row') {
    // a 7/8 bar with the needle running along it
    const bar = parseBar(SPEC('2+2+3', 'D.DcD.S'));
    strip(ctx, x, y, w, h);
    const ph = (t * 0.45) % 1, p = ph * bar.n;
    const cues = bar.cells.filter((c) => c.kind).map((c) => ({ i: c.i, kind: c.kind, done: c.i < p - 0.4, j: 'perfect', demo: false }));
    drawRow(ctx, bar, { x: x + 12, y: y + 12, w: w - 24, h: h - 24 }, { cues, p, t, now: Math.min(bar.n - 1, Math.round(p)) });
  } else if (name === 'pads') {
    const items = [['drum', 'DRUM', 'the accent: first pulse of a group'], ['clap', 'CLAP', 'a lighter pulse between'], ['step', 'STEP', 'a dance step, often the long group']];
    const cw = w / 3, ph = Math.min(h * 0.62, 120);
    items.forEach(([k, n, how], i) => {
      const r = { x: x + cw * i + 6, y, w: cw - 12, h: ph };
      drawPad(ctx, r, k, { hit: Math.max(0, Math.sin(t * 3 + i * 2)) * 0.6, t });
      txt(ctx, n, r.x + r.w / 2, y + ph + 26, 26, PAL.text, { align: 'center', weight: 800, maxW: cw - 8 });
      ctx.font = `500 19px ${UI}`;
      wrap(ctx, how, cw - 12).slice(0, 3).forEach((ln, li) => txt(ctx, ln, r.x + r.w / 2, y + ph + 54 + li * 24, 19, PAL.dim, { align: 'center', weight: 500, maxW: cw - 4 }));
    });
  } else if (name === 'groupings') {
    const items = [['5/8', '2+3', 'D.D..'], ['7/8', '2+2+3', 'D.D.D..'], ['7/8', '3+2+2', 'D..D.D.'], ['9/8', '2+2+2+3', 'D.D.D.D..'], ['11/8', '2+2+3+2+2', 'D.D.D..D.D.']];
    const rh = h / items.length;
    items.forEach(([m, g, pat], i) => {
      const yy = y + i * rh;
      txt(ctx, m, x + 8, yy + rh * 0.5, Math.min(34, rh * 0.62), PAL.amber, { font: DISPLAY, weight: 700 });
      const bar = parseBar(SPEC(g, pat));
      strip(ctx, x + 86, yy + 3, w - 86, rh - 6);
      drawRow(ctx, bar, { x: x + 94, y: yy + 5, w: w - 102, h: rh - 10 }, { mini: true, cues: bar.cells.filter((c) => c.kind).map((c) => ({ i: c.i, kind: c.kind, done: false })) });
    });
  } else if (name === 'stitches') {
    const items = [['perfect', 'Perfect'], ['great', 'Great'], ['good', 'Good'], ['off', 'Off'], ['miss', 'Miss']];
    const cw = w / items.length, r = Math.min(cw * 0.34, 36);
    items.forEach(([g, n], i) => {
      const cx = x + cw * (i + 0.5), cy = y + r + 14;
      ctx.fillStyle = '#f6e8c9'; rrect(ctx, { x: cx - r * 1.15, y: cy - r * 1.15, w: r * 2.3, h: r * 2.3 }, 12); ctx.fill();
      drawStitch(ctx, cx, cy, r * 2.2, g, ['drum', 'clap', 'step'][i % 3]);
      txt(ctx, n, cx, cy + r + 34, 22, PAL.text, { align: 'center', weight: 700, maxW: cw - 4 });
    });
  } else if (name === 'flow') {
    const rows = LAYER_NAMES.map((n, i) => `${i === 0 ? 'Always' : `Flow ${Math.round(FLOW.layers[i - 1] * 100)}%`}: ${n}, ${DANCERS[i]} dancers`), rh = h / 4;
    rows.forEach((n, i) => {
      const yy = y + i * rh + rh / 2, on = i <= 1;
      ctx.fillStyle = on ? 'rgba(104,220,142,0.26)' : 'rgba(255,255,255,0.06)'; rrect(ctx, { x: x + w * 0.58, y: yy - rh * 0.3, w: w * 0.42, h: rh * 0.6 }, 10); ctx.fill();
      txt(ctx, n, x, yy, 22, on ? PAL.text : PAL.dim, { weight: 600, maxW: w * 0.55 });
      for (let b = 0; b < DANCERS[i]; b++) { ctx.fillStyle = on ? PAL.teal : 'rgba(255,255,255,0.22)'; ctx.beginPath(); ctx.arc(x + w * 0.58 + w * 0.42 * (b + 0.5) / 10, yy, 6, 0, Math.PI * 2); ctx.fill(); }
    });
  } else if (name === 'shift') {
    // the same seven pulses in three groupings
    const items = [['2+2+3', 'D.D.D..'], ['3+2+2', 'D..D.D.'], ['2+3+2', 'D.D..D.']], rh = h / 3;
    items.forEach(([g, pat], i) => {
      const yy = y + i * rh, bar = parseBar(SPEC(g, pat));
      strip(ctx, x, yy + 3, w, rh - 6);
      drawRow(ctx, bar, { x: x + 10, y: yy + 5, w: w - 20, h: rh - 10 }, { cues: bar.cells.filter((c) => c.kind).map((c) => ({ i: c.i, kind: c.kind, done: false })) });
    });
  } else if (name === 'symbols') {
    const items = [['drum', 'Drum'], ['clap', 'Clap'], ['step', 'Step']], cw = w / 3, r = Math.min(cw * 0.22, 36);
    items.forEach(([k, n], i) => { const cx = x + cw * (i + 0.5); drawSymbol(ctx, k, cx, y + r + 8, r, { glow: 0.4 + 0.4 * Math.sin(t * 4 + i) }); txt(ctx, n, cx, y + r * 2 + 36, 24, PAL.text, { align: 'center', weight: 700 }); });
  }
  ctx.restore();
}

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
    } else if (b.row) {
      const rh = Math.max(92, 60 * ts + 30);
      ops.push({ t: 'row', y, b, h: rh }); y += rh + 10;
    }
  }
  return { ops, total: y };
}

export function renderDoc(ctx, st, L, doc, t) {
  const D = L.doc, ts = TEXT_SCALES[st.prefs.textIdx] ?? 1, vp = D.viewport;
  ui.hits = [];
  button(ctx, D.back, 'Back', { icon: 'back', kind: 'ghost', size: 28 }); ui.hits.push({ id: 'back', r: D.back });
  button(ctx, D.textDec, 'A-', { kind: st.prefs.textIdx > 0 ? 'quiet' : 'disabled', size: 28 }); ui.hits.push({ id: 'textDec', r: D.textDec });
  button(ctx, D.textInc, 'A+', { kind: st.prefs.textIdx < TEXT_SCALES.length - 1 ? 'quiet' : 'disabled', size: 28 }); ui.hits.push({ id: 'textInc', r: D.textInc });
  if (doc.nav) {
    button(ctx, D.nav.back, 'Previous', { icon: 'back', kind: doc.page > 0 ? 'quiet' : 'disabled', size: 28 });
    button(ctx, D.nav.next, doc.page < doc.pages - 1 ? 'Next' : 'Done', { kind: 'primary', size: 28 });
    ui.hits.push({ id: 'prev', r: D.nav.back }, { id: 'next', r: D.nav.next });
  }
  txt(ctx, doc.title, vp.x + vp.w / 2, vp.y - 30, 44, PAL.amber, { align: 'center', font: DISPLAY, weight: 700, maxW: vp.w - 20 });
  const vh = doc.nav ? vp.h : D.fullH;
  const view = { x: vp.x, y: vp.y, w: vp.w, h: vh };
  panel(ctx, view, { fill: 'rgba(30,10,12,0.86)', rad: 22 });
  const padX = 22, innerW = view.w - padX * 2 - 18;
  const key = `${doc.key}|${Math.round(innerW)}|${ts}`;
  let lay = cache.get(key);
  if (!lay) { lay = layoutDoc(ctx, doc.blocks, innerW, ts); if (cache.size > 40) cache.clear(); cache.set(key, lay); }
  const max = Math.max(0, lay.total + 28 - view.h);
  docMetrics.max = max; docMetrics.view = view.h;
  if (st.docRescale) { st.docScroll = st.docFrac * max; st.docRescale = false; }
  const scroll = Math.max(0, Math.min(st.docScroll, max)); st.docScroll = scroll;
  ctx.save(); rrect(ctx, view, 22); ctx.clip();
  ctx.translate(view.x + padX, view.y + 18 - scroll);
  for (const op of lay.ops) {
    if (op.y + op.h < scroll - 40 || op.y > scroll + view.h + 40) continue;
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    if (op.t === 'h') { ctx.font = `800 ${op.size}px ${UI}`; ctx.fillStyle = PAL.amber; op.lines.forEach((ln, i) => ctx.fillText(ln, 0, op.y + i * op.size * 1.25)); }
    else if (op.t === 'p') { ctx.font = `500 ${op.size}px ${UI}`; ctx.fillStyle = PAL.text; op.lines.forEach((ln, i) => ctx.fillText(ln, 0, op.y + i * op.lh)); }
    else if (op.t === 'li') {
      ctx.font = `500 ${op.size}px ${UI}`; ctx.fillStyle = PAL.teal;
      ctx.beginPath(); ctx.arc(10 * ts, op.y + op.lh * 0.5, 5 * ts + 1, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = PAL.text;
      op.lines.forEach((ln, i) => ctx.fillText(ln, op.ind, op.y + i * op.lh));
    } else if (op.t === 'fig') figure(ctx, op.name, 0, op.y, innerW, op.h, t);
    else if (op.t === 'row') {
      const b = op.b, r = { x: 0, y: op.y, w: innerW, h: op.h };
      ctx.fillStyle = 'rgba(255,230,200,0.08)'; rrect(ctx, r, 18); ctx.fill();
      const hint = typeof b.hint === 'function' ? b.hint() : b.hint;
      txt(ctx, b.label, 20, op.y + op.h * (hint ? 0.36 : 0.5), 28 * Math.min(ts, 1.6), PAL.text, { weight: 700, maxW: innerW * 0.52 });
      const hintW = b.kind === 'button' ? innerW - Math.min(innerW * 0.4, 280) - 56 : b.kind === 'stepper' ? innerW - 40 - 144 - 150 - 24 : innerW * 0.55;
      if (hint) txt(ctx, hint, 20, op.y + op.h * 0.72, 20 * Math.min(ts, 1.6), PAL.dim, { weight: 500, maxW: hintW });
      const val = b.val?.();
      const sx = view.x + padX, sy = view.y + 18 - scroll;
      const screenR = (rr) => ({ x: sx + rr.x, y: sy + rr.y, w: rr.w, h: rr.h });
      if (b.kind === 'toggle') {
        const tw = 108, th = 52, tr = { x: innerW - tw - 20, y: op.y + (op.h - th) / 2, w: tw, h: th };
        ctx.fillStyle = val ? PAL.teal : 'rgba(255,255,255,0.16)'; rrect(ctx, tr, th / 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(val ? tr.x + tw - th / 2 : tr.x + th / 2, tr.y + th / 2, th / 2 - 5, 0, Math.PI * 2); ctx.fill();
        ui.hits.push({ id: 'set:' + b.row, r: screenR(r), clip: view });
      } else if (b.kind === 'cycle') {
        txt(ctx, String(val), innerW - 24, op.y + op.h / 2, 28 * Math.min(ts, 1.6), PAL.amber, { align: 'right', weight: 800, maxW: innerW * 0.4 });
        ui.hits.push({ id: 'set:' + b.row, r: screenR(r), clip: view });
      } else if (b.kind === 'stepper') {
        const bw = 72, dec = { x: innerW - 20 - bw * 2 - 150, y: op.y + (op.h - 64) / 2, w: bw, h: 64 }, inc = { x: innerW - 20 - bw, y: dec.y, w: bw, h: 64 };
        button(ctx, dec, '-', { kind: 'quiet', size: 34, noShadow: true }); button(ctx, inc, '+', { kind: 'quiet', size: 34, noShadow: true });
        txt(ctx, String(val), dec.x + bw + 75, op.y + op.h / 2, 26 * Math.min(ts, 1.4), PAL.amber, { align: 'center', weight: 800, maxW: 140 });
        ui.hits.push({ id: 'set:' + b.row + 'Dec', r: screenR(dec), clip: view }, { id: 'set:' + b.row + 'Inc', r: screenR(inc), clip: view });
      } else if (b.kind === 'button') {
        const bw = Math.min(innerW * 0.4, 280), br = { x: innerW - bw - 20, y: op.y + (op.h - 66) / 2, w: bw, h: 66 };
        button(ctx, br, (typeof b.btn === 'function' ? b.btn() : b.btn) ?? 'Open', { kind: 'primary', size: 28, noShadow: true });
        ui.hits.push({ id: 'set:' + b.row, r: screenR(r), clip: view });
      }
    }
  }
  ctx.restore();
  if (max > 0) {
    const sb = { x: view.x + view.w - 12, y: view.y + 12, w: 6, h: view.h - 24 }, th = Math.max(40, sb.h * view.h / (lay.total + 28));
    ctx.fillStyle = 'rgba(255,240,220,0.12)'; rrect(ctx, sb, 3); ctx.fill();
    ctx.fillStyle = 'rgba(242,182,50,0.75)'; rrect(ctx, { x: sb.x, y: sb.y + (sb.h - th) * (scroll / max), w: sb.w, h: th }, 3); ctx.fill();
  }
  ui.view = view;
}
void KIND_COL; void barOf; void PIECES;
