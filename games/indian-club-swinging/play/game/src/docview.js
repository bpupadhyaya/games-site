// Text screens: Rules (paged), About, How to Play and Settings share one scrolling document renderer with a text-size stepper (to 300%).
// render() records what is tappable in `ui.hits` (rects in screen space); the game's update() reads it on the next tick.
import { PAL, UI, DISPLAY, rgba, drawClub, drawBead } from './art.js';
import { txt, wrap, button, panel, rrect, icon, chip } from './ui.js';
import { TEXT_SCALES, host } from './layout.js';
import { MOVES, MOVE_ORDER, pathPoints, leadPoint, pairOf } from './moves.js';
import { brandGradient } from './brand.js';

export const ui = { hits: [] };
export const docMetrics = { max: 0, view: 0 };
const cache = new Map();

// ---- figures (they use the game's own club and path painters) ------------------------------------------------------------------------
const mini = (ctx, m, cx, cy, r, o = {}) => {
  const pts = pathPoints(m, 64);
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.strokeStyle = o.dim ? 'rgba(255,243,218,0.45)' : 'rgba(255,243,218,0.85)'; ctx.lineWidth = Math.max(2.5, r * 0.07);
  ctx.setLineDash(o.dash === false ? [] : [r * 0.14, r * 0.1]);
  ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(cx + p.x * r, cy + p.y * r) : ctx.moveTo(cx + p.x * r, cy + p.y * r))); ctx.stroke();
  ctx.setLineDash([]);
  const s = leadPoint(m, o.turns ?? 0);
  drawBead(ctx, cx + s.x * r, cy + s.y * r, Math.max(5, r * 0.11), 0.8);
  // direction arrow a quarter of the way round
  const a = leadPoint(m, 0.12), b = leadPoint(m, 0.14), ang = Math.atan2(b.y - a.y, b.x - a.x), ax = cx + a.x * r, ay = cy + a.y * r;
  ctx.fillStyle = PAL.turmeric; ctx.translate(ax, ay); ctx.rotate(ang); ctx.beginPath(); ctx.moveTo(r * 0.12, 0); ctx.lineTo(-r * 0.08, r * 0.09); ctx.lineTo(-r * 0.08, -r * 0.09); ctx.closePath(); ctx.fill();
  ctx.restore();
};
export { mini };

function figure(ctx, name, x, y, w, h) {
  ctx.save();
  if (name === 'clubs') {
    const cx = x + w / 2, cy = y + h / 2, L = Math.min(h * 0.95, w * 0.34);
    drawClub(ctx, cx + L * 0.55, cy + L * 0.1, -0.55, L, { tone: 0 });
    drawClub(ctx, cx - L * 0.55, cy + L * 0.1, -Math.PI + 0.55, L, { tone: 1 });
    txt(ctx, 'lead club', cx + L * 0.9, y + h - 8, 22, PAL.dim, { align: 'center', weight: 500 });
    txt(ctx, 'second club', cx - L * 0.9, y + h - 8, 22, PAL.dim, { align: 'center', weight: 500 });
  } else if (name === 'pairs') {
    const names = ['together', 'mirror', 'alternate'], cell = w / 3, r = Math.min(cell * 0.32, (h - 60) / 2);
    names.forEach((n, i) => {
      const cx = x + cell * (i + 0.5), cy = y + r + 8, m = MOVES[i === 0 ? 'front' : i === 1 ? 'mirror' : 'alternate'];
      ctx.strokeStyle = 'rgba(255,243,218,0.35)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
      const p = leadPoint(m, 0.125), q = pairOf(m, p);
      drawBead(ctx, cx + p.x * r, cy + p.y * r, r * 0.13, 0.7); 
      ctx.fillStyle = PAL.tealHi; ctx.beginPath(); ctx.arc(cx + q.x * r, cy + q.y * r, r * 0.12, 0, Math.PI * 2); ctx.fill();
      txt(ctx, n, cx, y + h - 14, 24, PAL.text, { align: 'center', weight: 700 });
    });
  } else if (name === 'shapes') {
    const ids = ['front', 'wide', 'tall', 'eight', 'rise'], cell = w / ids.length, r = Math.min(cell * 0.4, (h - 40) / 2);
    ids.forEach((id, i) => mini(ctx, MOVES[id], x + cell * (i + 0.5), y + r + 6, r, { turns: 0.1 }));
    ['circle', 'wide', 'tall', 'eight', 'upright'].forEach((n, i) => txt(ctx, n, x + cell * (i + 0.5), y + h - 12, 20, PAL.dim, { align: 'center', weight: 500 }));
  } else if (name === 'flow') {
    const bw = w - 40, bx = x + 20, by = y + 24;
    for (let i = 0; i < 5; i++) {
      const sx = bx + (bw / 5) * i;
      ctx.fillStyle = i < 3 ? PAL.turmeric : 'rgba(255,243,218,0.14)'; rrect(ctx, { x: sx + 3, y: by, w: bw / 5 - 6, h: 44 }, 10); ctx.fill();
      txt(ctx, `x${i + 1}`, sx + bw / 10, by + 78, 26, i < 3 ? PAL.text : PAL.dim, { align: 'center', weight: 700 });
    }
  } else if (name === 'moves') {
    const cols = 4, rows = 3, cw = w / cols, ch = h / rows;
    MOVE_ORDER.forEach((id, i) => {
      const cx = x + cw * ((i % cols) + 0.5), cy = y + ch * (Math.floor(i / cols) + 0.4), r = Math.min(cw * 0.3, ch * 0.3);
      mini(ctx, MOVES[id], cx, cy, r, { turns: 0.1, dim: true });
      txt(ctx, MOVES[id].name, cx, cy + r + 22, 18, PAL.text, { align: 'center', weight: 600, maxW: cw - 8 });
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
  panel(ctx, view, { fill: 'rgba(6,24,28,0.7)', rad: 22 });
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
      ctx.beginPath(); ctx.fillStyle = PAL.turmeric; ctx.arc(10 * ts, op.y + op.lh * 0.5, 5 * ts + 1, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = PAL.text;
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
        ctx.fillStyle = val ? '#2bb6a0' : 'rgba(255,255,255,0.16)'; rrect(ctx, tr, th / 2); ctx.fill();
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
