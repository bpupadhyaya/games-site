// Text screens: Rules (paged), About, How to Play and Settings share one scrolling document renderer with a text-size stepper (to 300%).
// render() records what is tappable in `ui.hits` (rects in screen space); the game's update() reads it on the next tick.
import { PAL, UI, DISPLAY, rgba } from './art.js';
import { txt, wrap, button, panel, rrect, icon, chip } from './ui.js';
import { TEXT_SCALES, host } from './layout.js';
import { drawPad, drawStrokeMeter } from './playview.js';
import { drawBoat } from './art.js';
import { LOOKS } from './courses.js';

export const ui = { hits: [] };
export const docMetrics = { max: 0, view: 0 };
const cache = new Map();
const TAU = Math.PI * 2;

// ---- figures (they use the game's own pad, meter and boat painters) --------------------------------------------------------------------
function figure(ctx, name, x, y, w, h) {
  ctx.save();
  if (name === 'pad') {
    const me = { a: 0.45, aAvg: 0.2, inWater: true };
    drawPad(ctx, { x: x + 6, y: y + 4, w: w - 12, h: Math.min(h - 40, 120) }, me, { t: 99 });
    txt(ctx, 'drag left and right; the teal marker is where you steer', x + w / 2, y + h - 18, 20, PAL.dim, { align: 'center', weight: 600, maxW: w - 10 });
  } else if (name === 'meter') {
    drawStrokeMeter(ctx, { x: x + 6, y: y + 6, w: w - 12, h: 40 }, 3.4, true);
    txt(ctx, 'green: steady stroke   amber: fast   red: frantic, costs poise', x + w / 2, y + 74, 20, PAL.dim, { align: 'center', weight: 600, maxW: w - 10 });
  } else if (name === 'boat') {
    const b = { look: LOOKS[0], s: 0, n: 0, h: 0, a: 0.3, sway: 0.2, poise: 1, net: 0.4, fish: 3, inWater: true, still: false, v: 1 };
    const k = Math.min(w / 8.2, (h - 36) / 4.2);
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.fillStyle = 'rgba(80,170,190,0.35)'; rrect(ctx, { x, y, w, h }, 16); ctx.fill();
    ctx.translate(x + w * 0.42, y + h * 0.42); ctx.scale(k, k);
    drawBoat(ctx, b, 3, {});
    ctx.restore();
    const lab = [['Hat', 0.2, 0.17], ['Net', 0.46, 0.96], ['Oar', 0.2, 0.9]];
    void lab;
    txt(ctx, 'standing at the stern: one leg on the oar, a hand free for the net', x + w / 2, y + h - 14, 20, PAL.dim, { align: 'center', weight: 600, maxW: w - 10 });
  } else if (name === 'legend') {
    const items = [['Stake', 'stake'], ['Gate', 'gate'], ['Weed', 'hyac'], ['Swell', 'swell'], ['Fence', 'fence'], ['Shoal', 'shoal']];
    const cols = w > 800 ? 6 : 3, rows = Math.ceil(items.length / cols), cw = w / cols, ch = h / rows;
    items.forEach(([label, kind], i) => {
      const cx = x + (i % cols + 0.5) * cw, cy = y + Math.floor(i / cols) * ch + ch * 0.42, u = Math.min(cw, ch) * 0.28;
      ctx.fillStyle = 'rgba(80,170,190,0.4)'; rrect(ctx, { x: cx - cw * 0.42, y: cy - ch * 0.38, w: cw * 0.84, h: ch * 0.7 }, 16); ctx.fill();
      glyph(ctx, kind, cx, cy, u);
      txt(ctx, label, cx, cy + ch * 0.46, 20, PAL.text, { align: 'center', weight: 700, maxW: cw - 6 });
    });
  }
  ctx.restore();
}
function glyph(ctx, kind, cx, cy, u) {
  ctx.save(); ctx.translate(cx, cy);
  if (kind === 'stake') { ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, u * 0.7, 0, TAU); ctx.stroke(); ctx.fillStyle = '#a9824a'; ctx.beginPath(); ctx.arc(0, 0, u * 0.45, 0, TAU); ctx.fill(); }
  else if (kind === 'gate') { for (const [sx, c] of [[-1, '#e8452c'], [1, '#f4f4f4']]) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(sx * u, 0, u * 0.32, 0, TAU); ctx.fill(); } ctx.setLineDash([5, 5]); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-u * 0.6, 0); ctx.lineTo(u * 0.6, 0); ctx.stroke(); }
  else if (kind === 'hyac') { for (let i = 0; i < 6; i++) { const a = i * 1.1; ctx.fillStyle = '#6fbf48'; ctx.beginPath(); ctx.ellipse(Math.cos(a) * u * 0.6, Math.sin(a) * u * 0.45, u * 0.42, u * 0.36, a, 0, TAU); ctx.fill(); } ctx.fillStyle = '#c9a8f4'; ctx.beginPath(); ctx.arc(0, 0, u * 0.18, 0, TAU); ctx.fill(); }
  else if (kind === 'swell') { ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; for (let r = -1; r <= 1; r++) { ctx.beginPath(); for (let q = -1; q <= 1.01; q += 0.2) { const px = q * u * 1.1, py = r * u * 0.5 + Math.sin(q * 4) * u * 0.14; q === -1 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); } ctx.stroke(); } }
  else if (kind === 'fence') { ctx.fillStyle = '#b78a4a'; for (let q = -2; q <= 2; q++) { ctx.beginPath(); ctx.arc(q * u * 0.42, 0, u * 0.17, 0, TAU); ctx.fill(); } ctx.strokeStyle = 'rgba(120,80,30,0.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-u * 0.9, 0); ctx.lineTo(u * 0.9, 0); ctx.stroke(); }
  else if (kind === 'shoal') { ctx.fillStyle = 'rgba(10,50,70,0.4)'; ctx.beginPath(); ctx.ellipse(0, 0, u * 0.9, u * 0.7, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff3c8'; for (let i = 0; i < 4; i++) { const a = i * 1.57; ctx.save(); ctx.translate(Math.cos(a) * u * 0.4, Math.sin(a) * u * 0.35); ctx.rotate(a + 1.6); ctx.beginPath(); ctx.ellipse(0, 0, u * 0.12, u * 0.3, 0, 0, TAU); ctx.fill(); ctx.restore(); } }
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
  panel(ctx, view, { fill: 'rgba(6,30,44,0.7)', rad: 22 });
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
      ctx.beginPath(); ctx.fillStyle = PAL.ember; ctx.arc(10 * ts, op.y + op.lh * 0.5, 5 * ts + 1, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = PAL.text;
      op.lines.forEach((ln, i) => ctx.fillText(ln, op.ind, op.y + i * op.lh));
    } else if (op.t === 'fig') figure(ctx, op.name, 0, op.y, innerW, op.h);
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
        const bw = Math.min(innerW * 0.46, 320), br = { x: innerW - bw - 20, y: op.y + (op.h - 66) / 2, w: bw, h: 66 };
        const lab = typeof b.btn === 'function' ? b.btn() : (b.btn ?? 'Open');
        button(ctx, br, lab, { kind: b.done?.() ? 'disabled' : 'primary', size: 26, noShadow: true });
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
