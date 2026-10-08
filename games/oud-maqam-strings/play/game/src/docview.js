// Text screens: Rules (paged), About, How to Play and Settings share one scrolling document renderer with a text-size stepper (to 300%).
// render() records what is tappable in `ui.hits` (rects in screen space); the game's update() reads it on the next tick.
import { PAL, UI, DISPLAY, rgba, drawOudIcon } from './art.js';
import { txt, wrap, button, panel, rrect, icon, chip } from './ui.js';
import { TEXT_SCALES, host } from './layout.js';
import { MAQAMAT, IQA, PITCH_WINDOW, posOfCents, degLabel } from './music.js';
import { brandGradient } from './brand.js';

export const ui = { hits: [] };
export const docMetrics = { max: 0, view: 0 };
const cache = new Map();

// ---- figures (they use the game's own oud painter and constants) --------------------------------------------------------------------
function figure(ctx, name, x, y, w, h) {
  ctx.save();
  if (name === 'oud') {
    drawOudIcon(ctx, x + w / 2, y + h / 2, Math.min(h * 1.35, w * 0.9), -0.62);
  } else if (name === 'neck') {
    const M = MAQAMAT.rast, span = 1250, x0 = x + 30, x1 = x + w - 30, cy = y + h * 0.42;
    ctx.fillStyle = '#1b1410'; rrect(ctx, { x: x0, y: cy - 30, w: x1 - x0, h: 60 }, 8); ctx.fill();
    for (let i = 0; i < 4; i++) { ctx.strokeStyle = 'rgba(232,226,208,0.8)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x0, cy - 18 + i * 12); ctx.lineTo(x1, cy - 18 + i * 12); ctx.stroke(); }
    M.deg.forEach((c, i) => {
      const u = x0 + posOfCents(c, span) * (x1 - x0), q = M.q.includes(i);
      ctx.fillStyle = q ? PAL.turq : i === 0 || i === 7 ? PAL.gold : PAL.pearl;
      ctx.beginPath(); if (q) { ctx.moveTo(u, cy - 9); ctx.lineTo(u + 8, cy); ctx.lineTo(u, cy + 9); ctx.lineTo(u - 8, cy); ctx.closePath(); } else ctx.arc(u, cy, 6, 0, 6.3); ctx.fill();
      txt(ctx, degLabel('rast', i), u, cy + 52, 22, q ? PAL.turq : PAL.text, { align: 'center', weight: 700 });
    });
    txt(ctx, 'nut (open string)', x0, y + 14, 20, PAL.dim, { weight: 500 });
    txt(ctx, 'down the neck: higher', x1, y + 14, 20, PAL.dim, { align: 'right', weight: 500 });
    txt(ctx, 'Rast on the neck. Turquoise = quarter-tone.', x + w / 2, y + h - 12, 22, PAL.dim, { align: 'center', weight: 500 });
  } else if (name === 'bands') {
    const pw = PITCH_WINDOW[0], cx = x + w / 2, cy = y + h * 0.45, sc = (w * 0.42) / pw.o;
    [['good', pw.o, 'rgba(159,196,255,0.35)'], ['great', pw.g, 'rgba(142,240,220,0.4)'], ['perfect', pw.p, 'rgba(255,224,122,0.55)']].forEach(([n, v, col]) => {
      ctx.fillStyle = col; rrect(ctx, { x: cx - v * sc, y: cy - 34, w: v * 2 * sc, h: 68 }, 14); ctx.fill();
      txt(ctx, `${n} \u00b1${v}`, cx + v * sc - 8, cy - 48 - (n === 'good' ? 0 : n === 'great' ? 0 : 0), 20, PAL.text, { align: 'right', weight: 700 });
    });
    ctx.strokeStyle = PAL.gold; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx, cy - 46); ctx.lineTo(cx, cy + 46); ctx.stroke();
    txt(ctx, 'target', cx, cy + 66, 22, PAL.text, { align: 'center', weight: 700 });
    txt(ctx, 'flat \u2190   cents from the target   \u2192 sharp', cx, y + h - 12, 22, PAL.dim, { align: 'center', weight: 500 });
  } else if (name === 'cycle') {
    const iq = IQA.maqsum.slots, cell = Math.min(80, (w - 20) / 8), x0 = x + (w - cell * 8) / 2, cy = y + h * 0.4;
    for (let i = 0; i < 8; i++) {
      const ch = iq[i], cx = x0 + cell * (i + 0.5);
      ctx.fillStyle = ch === 'D' ? PAL.ember : ch === 'T' ? PAL.turq : 'rgba(255,255,255,0.12)';
      ctx.beginPath(); ctx.arc(cx, cy, ch === 'D' ? cell * 0.36 : ch === 'T' ? cell * 0.28 : cell * 0.12, 0, 6.3); ctx.fill();
      txt(ctx, ch === '.' ? '' : ch === 'D' ? 'dum' : 'tak', cx, cy + cell * 0.7, Math.min(24, cell * 0.3), PAL.text, { align: 'center', weight: 700 });
      txt(ctx, String(i + 1), cx, cy - cell * 0.7, 20, PAL.dim, { align: 'center', weight: 500 });
    }
    txt(ctx, 'Maqsum: one cycle of eight slots', x + w / 2, y + h - 12, 22, PAL.dim, { align: 'center', weight: 500 });
  } else if (name === 'scales') {
    const names = ['rast', 'bayati', 'hijaz', 'nahawand'], rowH = (h - 8) / names.length, x0 = x + 175, x1 = x + w - 24;
    names.forEach((id, r) => {
      const M = MAQAMAT[id], cy = y + rowH * (r + 0.5);
      txt(ctx, M.name, x, cy, 24, PAL.gold, { weight: 800 });
      ctx.strokeStyle = 'rgba(255,240,220,0.2)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0, cy); ctx.lineTo(x1, cy); ctx.stroke();
      M.deg.forEach((c, i) => {
        const u = x0 + (c / 1200) * (x1 - x0 - 10), q = M.q.includes(i);
        ctx.fillStyle = q ? PAL.turq : PAL.pearl;
        ctx.beginPath(); if (q) { ctx.moveTo(u, cy - 11); ctx.lineTo(u + 9, cy); ctx.lineTo(u, cy + 11); ctx.lineTo(u - 9, cy); ctx.closePath(); } else ctx.arc(u, cy, 6.5, 0, 6.3); ctx.fill();
      });
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
  panel(ctx, view, { fill: 'rgba(12,8,30,0.62)', rad: 22 });
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
        ctx.fillStyle = val ? '#35c7b8' : 'rgba(255,255,255,0.16)'; rrect(ctx, tr, th / 2); ctx.fill();
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
