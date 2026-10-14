// Text screens: Rules (paged), About, How to Play and Settings share one scrolling document renderer with a text-size stepper (to 300%).
// render records what is tappable in `ui.hits` (rects in screen space); the game's update() reads it on the next tick.
import { PAL, UI, DISPLAY, drawDrum, drawBeam, drawStroke, slotAngle, rgba } from './art.js';
import { TRACK } from './layout.js';
import { txt, wrap, button, panel, rrect } from './ui.js';
import { TEXT_SCALES } from './layout.js';

export const ui = { hits: [], view: null };
export const docMetrics = { max: 0, view: 0 };
const cache = new Map();

function figure(ctx, name, x, y, w, h, t) {
  ctx.save();
  if (name === 'drum') {
    const r = Math.min(h / 2 - 8, w * 0.36), cx = x + w / 2, cy = y + h / 2;
    drawDrum(ctx, cx, cy, r, { tension: 0.85, pulse: Math.max(0, Math.sin(t * 6)) });
    const ph = (t * 0.4) % 1;
    [[0, 'boom'], [3, 'ting'], [5, 'slap'], [7, 'shake'], [9, 'boom']].forEach(([sl, k]) => { const a = slotAngle(sl); drawStroke(ctx, cx + Math.cos(a) * r * TRACK, cy + Math.sin(a) * r * TRACK, r * 0.12, k, {}); });
    drawBeam(ctx, cx, cy, r, ph);
  } else if (name === 'strokes') {
    const items = [['boom', 'Boom', 'tap drum'], ['slap', 'Slap', 'slide on drum'], ['ting', 'Ting', 'tap triangle'], ['shake', 'Shake', 'swipe rattle'], ['warm', 'Warm', 'hold fire']];
    const cw = w / 5, r = Math.min(cw * 0.3, 40);
    items.forEach(([k, n, how], i) => {
      const cx = x + cw * (i + 0.5), cy = y + r + 20;
      drawStroke(ctx, cx, cy, r, k, { glow: 0.5 + 0.5 * Math.sin(t * 4 + i) });
      txt(ctx, n, cx, cy + r + 34, 26, PAL.text, { align: 'center', weight: 700, maxW: cw - 6 });
      txt(ctx, how, cx, cy + r + 62, 19, PAL.dim, { align: 'center', weight: 500, maxW: cw - 6 });
    });
  } else if (name === 'groove') {
    const rows = ['Always: shuffle and bass', 'Layer 1: wood knocks, more bass', 'Layer 2: hand claps', 'Layer 3: bell'], rh = h / 4;
    rows.forEach((n, i) => {
      const yy = y + i * rh + rh / 2, on = i <= 1;
      ctx.fillStyle = on ? 'rgba(47,216,196,0.28)' : 'rgba(255,255,255,0.06)'; rrect(ctx, { x: x + w * 0.5, y: yy - rh * 0.3, w: w * 0.5, h: rh * 0.6 }, 10); ctx.fill();
      txt(ctx, n, x, yy, 23, on ? PAL.text : PAL.dim, { weight: 600, maxW: w * 0.47 });
      for (let b = 0; b < 8; b++) { ctx.fillStyle = on ? PAL.teal : 'rgba(255,255,255,0.2)'; ctx.beginPath(); ctx.arc(x + w * 0.5 + w * 0.5 * (b + 0.5) / 8, yy, 6, 0, Math.PI * 2); ctx.fill(); }
    });
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
  txt(ctx, doc.title, vp.x + vp.w / 2, vp.y - 30, 44, PAL.amber, { align: 'center', font: DISPLAY, weight: 800, maxW: vp.w - 20 });
  const vh = doc.nav ? vp.h : D.fullH;
  const view = { x: vp.x, y: vp.y, w: vp.w, h: vh };
  panel(ctx, view, { fill: 'rgba(20,8,44,0.82)', rad: 22 });
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
      const b = op.b, hintTxt = typeof b.hint === 'function' ? b.hint(st) : b.hint, r = { x: 0, y: op.y, w: innerW, h: op.h };
      ctx.fillStyle = 'rgba(255,230,255,0.08)'; rrect(ctx, r, 18); ctx.fill();
      txt(ctx, b.label, 20, op.y + op.h * (hintTxt ? 0.36 : 0.5), 28 * Math.min(ts, 1.6), PAL.text, { weight: 700, maxW: innerW * 0.52 });
      if (hintTxt) txt(ctx, hintTxt, 20, op.y + op.h * 0.72, 20 * Math.min(ts, 1.6), PAL.dim, { weight: 500, maxW: b.kind === 'button' ? innerW - Math.min(innerW * 0.4, 280) - 56 : innerW * 0.55 });
      const val = b.val?.(st);
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
        button(ctx, br, (typeof b.btn === 'function' ? b.btn(st) : b.btn) ?? 'Open', { kind: 'primary', size: 28, noShadow: true });
        ui.hits.push({ id: 'set:' + b.row, r: screenR(r), clip: view });
      }
    }
  }
  ctx.restore();
  if (max > 0) {
    const sb = { x: view.x + view.w - 12, y: view.y + 12, w: 6, h: view.h - 24 }, th = Math.max(40, sb.h * view.h / (lay.total + 28));
    ctx.fillStyle = 'rgba(255,240,220,0.12)'; rrect(ctx, sb, 3); ctx.fill();
    ctx.fillStyle = 'rgba(255,179,71,0.75)'; rrect(ctx, { x: sb.x, y: sb.y + (sb.h - th) * (scroll / max), w: sb.w, h: th }, 3); ctx.fill();
  }
  ui.view = view;
}
