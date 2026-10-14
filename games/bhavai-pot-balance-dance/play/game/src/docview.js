// Text screens: Rules (paged), About, How to Play and Settings share one scrolling document renderer with a text-size stepper (to 300%).
// render() records what is tappable in `ui.hits` (rects in screen space); the game's update() reads it on the next tick.
import { PAL, UI, DISPLAY, rgba } from './art.js';
import { txt, wrap, button, panel, rrect, icon, chip } from './ui.js';
import { TEXT_SCALES, host } from './layout.js';
import { createWorld } from './sim.js';
import { renderChart } from './playview.js';
import { makeCam } from './art.js';
import { drawDancer, drawTower, drawPotLocal } from './figure.js';

export const ui = { hits: [] };
export const docMetrics = { max: 0, view: 0 };
const cache = new Map();
const TAU = Math.PI * 2;

// ---- figures (they use the game's own chart, tower and dancer painters) -----------------------------------------------------------
function figure(ctx, name, x, y, w, h) {
  ctx.save();
  if (name === 'tower') {
    const S = { x, y, w, h }, cam = makeCam(S, 60);
    ctx.fillStyle = 'rgba(143,240,230,0.06)'; rrect(ctx, S, 16); ctx.fill();
    const cells = [[-0.18, 'leans left'], [0, 'upright'], [0.18, 'leans right']];
    const k = Math.min((h - 60) / 3.1, w / 3 / 1.5), cw = w / 3;
    cells.forEach(([th, label], i) => {
      const c2 = { ...cam, ppm: k, ox: x + (i + 0.5) * cw, oy: y + h - 40 };
      drawDancer(ctx, c2, { x: 0 + 0, v: 0, th, om: 0, t: 0, bp: 0.2, side: 1, spin: 0, n: 3, fall: 0 }, 0);
      drawTower(ctx, c2, { x: 0, th, om: 0, n: 4, t: 0, lift: 1 });
      txt(ctx, label, x + (i + 0.5) * cw, y + h - 14, 20, PAL.text, { align: 'center', weight: 700, maxW: cw - 8 });
    });
  } else if (name === 'chart') {
    const W = createWorld(0, { mode: 'dance' });
    W.t = W.t0 + 3.2 * W.bl; W.bi = 4; W.x = -0.2;
    const C = { x: x + w * 0.2, y, w: w * 0.6, h };
    renderChart(ctx, C, W, 1.7, { look: 3.4 });
  } else if (name === 'cues') {
    const items = [['Footprint', 'step'], ['Spin', 'turn'], ['Pot', 'pot'], ['Rest', 'rest']];
    const cw = w / items.length;
    items.forEach(([label, kind], i) => {
      const cx = x + (i + 0.5) * cw, cy = y + h * 0.42;
      ctx.fillStyle = 'rgba(143,240,230,0.07)'; rrect(ctx, { x: x + i * cw + 3, y, w: cw - 6, h: h - 4 }, 14); ctx.fill();
      if (kind === 'step') { ctx.fillStyle = '#ffd45a'; ctx.beginPath(); ctx.ellipse(cx, cy + 8, 15, 26, 0, 0, Math.PI * 2); ctx.fill(); for (let j = 0; j < 5; j++) { ctx.beginPath(); ctx.arc(cx - 15 + j * 7.5, cy - 24 + Math.abs(j - 1.5) * 1.5, 4.5, 0, Math.PI * 2); ctx.fill(); } }
      else if (kind === 'turn') { ctx.strokeStyle = '#ff6f9c'; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(cx, cy, 24, -2.4, 0.6); ctx.stroke(); ctx.fillStyle = '#ff6f9c'; ctx.beginPath(); ctx.arc(cx + Math.cos(0.6) * 24, cy + Math.sin(0.6) * 24, 9, 0, Math.PI * 2); ctx.fill(); }
      else if (kind === 'pot') { ctx.save(); ctx.translate(cx, cy + 6); drawPotLocal(ctx, 130, 0); ctx.restore(); }
      else { ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(cx - 18, cy); ctx.lineTo(cx + 18, cy); ctx.stroke(); }
      txt(ctx, label, cx, y + h - 20, 20, PAL.text, { align: 'center', weight: 700, maxW: cw - 8 });
    });
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
  panel(ctx, view, { fill: 'rgba(7,20,40,0.72)', rad: 22 });
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
      ctx.beginPath(); ctx.fillStyle = PAL.marigold; ctx.arc(10 * ts, op.y + op.lh * 0.5, 5 * ts + 1, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = PAL.text;
      op.lines.forEach((ln, i) => ctx.fillText(ln, op.ind, op.y + i * op.lh));
    } else if (op.t === 'fig') figure(ctx, op.name, 0, op.y, innerW, op.h);
    else if (op.t === 'row') {
      const b = op.b, r = { x: 0, y: op.y, w: innerW, h: op.h };
      ctx.fillStyle = 'rgba(143,240,230,0.07)'; rrect(ctx, r, 18); ctx.fill();
      const ctrlW = b.kind === 'toggle' ? 150 : b.kind === 'button' ? Math.min(innerW * 0.4, 280) + 30 : b.kind === 'stepper' ? 320 : 180;
      const textW = Math.max(innerW * 0.3, innerW - ctrlW - 36);
      txt(ctx, b.label, 20, op.y + op.h * (b.hint ? 0.34 : 0.5), 28 * Math.min(ts, 1.6), PAL.text, { weight: 700, maxW: textW });
      if (b.hint) txt(ctx, b.hint, 20, op.y + op.h * 0.7, 20 * Math.min(ts, 1.6), PAL.dim, { weight: 500, maxW: textW });
      const val = b.val?.();
      const sx = view.x + padX, sy = view.y + 18 - scroll;
      const screenR = (rr) => ({ x: sx + rr.x, y: sy + rr.y, w: rr.w, h: rr.h });
      if (b.kind === 'toggle') {
        const tw = 108, th = 52, tr = { x: innerW - tw - 20, y: op.y + (op.h - th) / 2, w: tw, h: th };
        ctx.fillStyle = val ? '#27c4c0' : 'rgba(255,255,255,0.16)'; rrect(ctx, tr, th / 2); ctx.fill();
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
    ctx.fillStyle = 'rgba(143,240,230,0.7)'; rrect(ctx, { x: sb.x, y: sb.y + (sb.h - th) * (scroll / max), w: sb.w, h: th }, 3); ctx.fill();
  }
  ui.view = view;
}
