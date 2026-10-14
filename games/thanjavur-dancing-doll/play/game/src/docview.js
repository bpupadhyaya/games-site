// Text screens: Rules (paged), About, How to Play and Settings share one scrolling document renderer with a text-size stepper (to 300%).
// render() records what is tappable in `ui.hits` (rects in screen space); the game's update() reads it on the next tick.
import { PAL, UI, DISPLAY } from './art.js';
import { txt, wrap, button, panel, rrect } from './ui.js';
import { TEXT_SCALES } from './layout.js';
import { drawDoll } from './doll.js';
import { drawRail, drawTimeline } from './playview.js';
import { PHASES, TOTAL, DEG, ballastFor } from './sim.js';

export const ui = { hits: [] };
export const docMetrics = { max: 0, view: 0 };
const cache = new Map();
const TAU = Math.PI * 2;

// ---- figures (they use the game's own doll, rail and timeline painters) ---------------------------------------------------------------
function figure(ctx, name, x, y, w, h) {
  ctx.save();
  ctx.fillStyle = 'rgba(234,169,28,0.14)'; rrect(ctx, { x, y, w, h }, 16); ctx.fill();
  if (name === 'sway') {
    const cells = [[-0.35, 'leans left'], [0, 'upright'], [0.35, 'leans right']];
    const cw = w / 3, R = Math.min((h - 70) / 5.7, cw / 2.6);
    cells.forEach(([th, label], i) => {
      drawDoll(ctx, x + (i + 0.5) * cw, y + h - 44, R, { th, lag: -th * 0.35, ch: 0, variant: 0, paint: 3 });
      txt(ctx, label, x + (i + 0.5) * cw, y + h - 18, 20, PAL.text, { align: 'center', weight: 700, maxW: cw - 8 });
    });
  } else if (name === 'ghost') {
    const R = Math.min((h - 40) / 5.7, w / 6);
    drawDoll(ctx, x + w * 0.33, y + h - 20, R, { th: 0.32, lag: -0.11, ch: 3, variant: 1, ghost: true, alpha: 0.7 });
    drawDoll(ctx, x + w * 0.33, y + h - 20, R, { th: 0.2, lag: -0.04, ch: 3, variant: 1, paint: 3 });
    txt(ctx, 'The ghost is the pattern.', x + w * 0.68, y + h * 0.36, 24, PAL.text, { align: 'center', weight: 800, maxW: w * 0.3 });
    txt(ctx, 'Keep your doll inside it.', x + w * 0.68, y + h * 0.56, 22, PAL.dim, { align: 'center', weight: 700, maxW: w * 0.3 });
  } else if (name === 'tap') {
    const R = Math.min((h - 50) / 5.7, w / 8), cx = x + w / 2, gy = y + h - 30;
    drawDoll(ctx, cx, gy, R, { th: 0, ch: 1, variant: 0, paint: 3 });
    const arrow = (px, py, dir, label, big) => {
      ctx.fillStyle = PAL.vermilion; ctx.beginPath(); ctx.arc(px, py, big ? 17 : 11, 0, TAU); ctx.fill();
      ctx.strokeStyle = PAL.vermilion; ctx.lineWidth = big ? 7 : 4; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + dir * (big ? 60 : 34), py); ctx.stroke();
      txt(ctx, label, px + dir * 40, py - 30, 19, PAL.text, { align: 'center', weight: 800 });
    };
    arrow(cx - R * 1.1, gy - R * 2.4, 1, 'strong push', true);
    arrow(cx + R * 0.35, gy - R * 1.4, 1, 'nudge', false);
  } else if (name === 'rail') {
    const r = { x: x + w * 0.1, y: y + h * 0.4, w: w * 0.8, h: Math.min(60, h * 0.36) };
    drawRail(ctx, r, 0.6, { target: 0.6, mark: 0.08, near: true, label: '1.5 s', t: 0 });
    txt(ctx, 'slower', r.x + 4, y + h * 0.14, 20, PAL.dim, { weight: 700 });
    txt(ctx, 'quicker', r.x + r.w - 4, y + h * 0.14, 20, PAL.dim, { align: 'right', weight: 700 });
    txt(ctx, 'The gold inlay is the right speed for the doll.', x + w / 2, y + h * 0.86, 20, PAL.text, { align: 'center', weight: 700, maxW: w - 20 });
  } else if (name === 'timeline') {
    const hist = new Array(24).fill(0).map((_, i) => (i % 7 === 3 ? 0.2 : i % 5 === 2 ? 0.5 : 0.9));
    drawTimeline(ctx, { x: x + 8, y: y + 8, w: w - 16, h: h - 16 }, PHASES.RAMP + 7, hist);
  }
  ctx.restore();
  void DEG; void ballastFor; void TOTAL;
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
  button(ctx, D.back, 'Back', { icon: 'back', kind: 'ghost', size: 28 });
  ui.hits.push({ id: 'back', r: D.back });
  button(ctx, D.textDec, 'A-', { kind: st.prefs.textIdx > 0 ? 'quiet' : 'disabled', size: 28 }); ui.hits.push({ id: 'textDec', r: D.textDec });
  button(ctx, D.textInc, 'A+', { kind: st.prefs.textIdx < TEXT_SCALES.length - 1 ? 'quiet' : 'disabled', size: 28 }); ui.hits.push({ id: 'textInc', r: D.textInc });
  if (doc.nav) { button(ctx, D.nav.back, 'Previous', { icon: 'back', kind: doc.page > 0 ? 'quiet' : 'disabled', size: 28 }); button(ctx, D.nav.next, doc.page < doc.pages - 1 ? 'Next' : 'Done', { kind: 'primary', size: 28 }); ui.hits.push({ id: 'prev', r: D.nav.back }, { id: 'next', r: D.nav.next }); }
  const tx = D.viewport.x + D.viewport.w / 2;
  txt(ctx, doc.title, tx, vp.y - 30, 34, PAL.vermilion, { align: 'center', font: DISPLAY, weight: 400, maxW: D.viewport.w - 20, stroke: 8 });
  const vh = doc.nav ? vp.h : (D.nav.back.y + D.nav.back.h) - vp.y;
  const view = { x: vp.x, y: vp.y, w: vp.w, h: vh };
  panel(ctx, view, { fill: 'rgba(255,247,228,0.95)', rad: 22 });
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
    if (op.t === 'h') { ctx.font = `800 ${op.size}px ${UI}`; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = PAL.vermilion; op.lines.forEach((ln, i) => ctx.fillText(ln, 0, op.y + i * op.size * 1.25)); }
    else if (op.t === 'p') { ctx.font = `500 ${op.size}px ${UI}`; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = PAL.text; op.lines.forEach((ln, i) => ctx.fillText(ln, 0, op.y + i * op.lh)); }
    else if (op.t === 'li') {
      ctx.font = `500 ${op.size}px ${UI}`; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.beginPath(); ctx.fillStyle = PAL.gold; ctx.arc(10 * ts, op.y + op.lh * 0.5, 5 * ts + 1, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = PAL.text;
      op.lines.forEach((ln, i) => ctx.fillText(ln, op.ind, op.y + i * op.lh));
    } else if (op.t === 'fig') figure(ctx, op.name, 0, op.y, innerW, op.h);
    else if (op.t === 'row') {
      const b = op.b, r = { x: 0, y: op.y, w: innerW, h: op.h };
      ctx.fillStyle = 'rgba(234,169,28,0.16)'; rrect(ctx, r, 18); ctx.fill();
      txt(ctx, typeof b.label === 'function' ? b.label() : b.label, 20, op.y + op.h * (b.hint ? 0.36 : 0.5), 28 * Math.min(ts, 1.6), PAL.text, { weight: 700, maxW: innerW * 0.52 });
      if (b.hint) txt(ctx, typeof b.hint === 'function' ? b.hint() : b.hint, 20, op.y + op.h * 0.72, 20 * Math.min(ts, 1.6), PAL.dim, { weight: 500, maxW: innerW * 0.55 });
      const val = b.val?.();
      const sx = view.x + padX, sy = view.y + 18 - scroll;
      const screenR = (rr) => ({ x: sx + rr.x, y: sy + rr.y, w: rr.w, h: rr.h });
      if (b.kind === 'toggle') {
        const tw = 108, th = 52, tr = { x: innerW - tw - 20, y: op.y + (op.h - th) / 2, w: tw, h: th };
        ctx.fillStyle = val ? PAL.emerald : 'rgba(58,22,32,0.2)'; rrect(ctx, tr, th / 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(val ? tr.x + tw - th / 2 : tr.x + th / 2, tr.y + th / 2, th / 2 - 5, 0, Math.PI * 2); ctx.fill();
        ui.hits.push({ id: 'set:' + b.row, r: screenR(r), clip: view });
      } else if (b.kind === 'cycle') {
        txt(ctx, String(val), innerW - 24, op.y + op.h / 2, 28 * Math.min(ts, 1.6), PAL.vermilion, { align: 'right', weight: 800, maxW: innerW * 0.4 });
        ui.hits.push({ id: 'set:' + b.row, r: screenR(r), clip: view });
      } else if (b.kind === 'button') {
        const bw = Math.min(innerW * 0.4, 280), br = { x: innerW - bw - 20, y: op.y + (op.h - 66) / 2, w: bw, h: 66 };
        const off = b.off?.();
        button(ctx, br, (typeof b.btn === 'function' ? b.btn() : b.btn) ?? 'Open', { kind: off ? 'disabled' : 'primary', size: 28, noShadow: true });
        if (!off) ui.hits.push({ id: 'set:' + b.row, r: screenR(r), clip: view });
      }
    }
  }
  ctx.restore();
  if (max > 0) {
    const sb = { x: view.x + view.w - 12, y: view.y + 12, w: 6, h: view.h - 24 }, th = Math.max(40, sb.h * view.h / (lay.total + 28));
    ctx.fillStyle = 'rgba(58,22,32,0.12)'; rrect(ctx, sb, 3); ctx.fill();
    ctx.fillStyle = 'rgba(168,111,12,0.8)'; rrect(ctx, { x: sb.x, y: sb.y + (sb.h - th) * (scroll / max), w: sb.w, h: th }, 3); ctx.fill();
  }
  ui.view = view;
}
