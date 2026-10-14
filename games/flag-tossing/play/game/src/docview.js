// Text screens: Rules (paged), About, How to Play and Settings share one scrolling document renderer with a text-size stepper (to 300%).
// render() records what is tappable in `ui.hits` (rects in screen space); the game's update() reads it on the next tick.
import { PAL, UI, DISPLAY, rgba, drawFlag, drawBearer, DESIGNS } from './art.js';
import { TUNE, ENS } from './engine.js';
import { txt, wrap, button, panel, rrect, icon, chip } from './ui.js';
import { TEXT_SCALES, host } from './layout.js';
import { brandGradient } from './brand.js';

export const ui = { hits: [] };
export const docMetrics = { max: 0, view: 0 };
const cache = new Map();

// ---- figures (they use the game's own flag and bearer painters) ---------------------------------------------------------------------
function figure(ctx, name, x, y, w, h) {
  ctx.save();
  if (name === 'flags') {
    const n = DESIGNS.length, cell = w / 4, rows = 2, fh = Math.min(h / rows - 20, cell * 0.78);
    DESIGNS.forEach((d, i) => {
      const cx = x + cell * ((i % 4) + 0.5), cy = y + (h / rows) * (Math.floor(i / 4) + 0.5);
      drawFlag(ctx, cx - fh * 0.2, cy, fh, 0, i, { ph: i, held: true });
    });
  } else if (name === 'timing') {
    // the grade bands around the beat, for the release and for the catch
    const gw = Math.min(w - 20, 640), cx = x + w / 2, gy = y + h * 0.5, sc = gw / 2 / 0.5;       // half-width = 0.5 beat
    const band = (lim, col, hh) => { ctx.fillStyle = col; rrect(ctx, { x: cx - lim * sc, y: gy - hh / 2, w: lim * 2 * sc, h: hh }, hh / 2); ctx.fill(); };
    band(0.5, 'rgba(255,255,255,0.10)', 46); band(TUNE.catchGood, 'rgba(143,211,255,0.55)', 46); band(TUNE.catchPerfect, 'rgba(255,240,176,0.95)', 46);
    ctx.strokeStyle = PAL.text; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx, gy - 40); ctx.lineTo(cx, gy + 40); ctx.stroke();
    txt(ctx, 'THE BEAT', cx, gy - 54, 22, PAL.text, { align: 'center', weight: 800 });
    txt(ctx, 'PERFECT', cx, gy + 4, Math.min(22, gw / 28), '#2a1d05', { align: 'center', weight: 800 });
    txt(ctx, 'GOOD', cx + (TUNE.catchPerfect + TUNE.catchGood) / 2 * sc, gy + 4, Math.min(20, gw / 32), '#06203a', { align: 'center', weight: 800 });
    txt(ctx, 'GOOD', cx - (TUNE.catchPerfect + TUNE.catchGood) / 2 * sc, gy + 4, Math.min(20, gw / 32), '#06203a', { align: 'center', weight: 800 });
    txt(ctx, 'early', cx - gw / 2 + 10, gy + 50, 20, PAL.dim, { align: 'left', weight: 600 });
    txt(ctx, 'late', cx + gw / 2 - 10, gy + 50, 20, PAL.dim, { align: 'right', weight: 600 });
  } else if (name === 'heights') {
    const n = 4, base = y + h - 28, top = y + 18, cx0 = x + 50;
    ctx.strokeStyle = 'rgba(251,241,220,0.4)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx0, base); ctx.lineTo(cx0, top); ctx.stroke();
    for (let b = 1; b <= 5; b++) {
      const t = (b - TUNE.airMin) / (TUNE.airMax - TUNE.airMin), yy = base - (base - top) * (0.18 + 0.82 * t);
      ctx.strokeStyle = PAL.gold; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx0 - 12, yy); ctx.lineTo(cx0 + 12, yy); ctx.stroke();
      txt(ctx, `${b} beat${b > 1 ? 's' : ''}`, cx0 + 24, yy, 24, PAL.text, { weight: 700 });
      const fx = x + w * 0.62 + (b - 3) * w * 0.07;
      ctx.setLineDash([6, 8]); ctx.strokeStyle = 'rgba(251,241,220,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(fx, base); ctx.lineTo(fx, yy); ctx.stroke(); ctx.setLineDash([]);
      drawFlag(ctx, fx, yy, Math.min(66, h * 0.2), 0.3 * b, b + 2, { ph: b, held: true });
    }
  } else if (name === 'stage') {
    [1, 2, 3].forEach((e, i) => {
      const cy = y + (h / 3) * (i + 1) - 12, bh = Math.min(70, h / 3 - 18);
      ENS[e].xs.forEach((fx, s) => {
        const cx = x + 90 + (w - 120) * fx;
        drawBearer(ctx, cx, cy, bh, { costume: s === ENS[e].you ? 0 : (s % 2) + 1, you: s === ENS[e].you, hands: [{ x: 22, y: -62 }, { x: -20, y: -58 }] });
      });
      txt(ctx, ENS[e].name, x + 8, cy - bh * 0.5, 24, PAL.gold, { weight: 800 });
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
  panel(ctx, view, { fill: 'rgba(13,24,48,0.78)', rad: 22 });
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
      ctx.beginPath(); ctx.fillStyle = PAL.terracotta; ctx.arc(10 * ts, op.y + op.lh * 0.5, 5 * ts + 1, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = PAL.text;
      op.lines.forEach((ln, i) => ctx.fillText(ln, op.ind, op.y + i * op.lh));
    } else if (op.t === 'fig') figure(ctx, op.name, 0, op.y, innerW, op.h);
    else if (op.t === 'row') {
      const b = op.b, r = { x: 0, y: op.y, w: innerW, h: op.h };
      ctx.fillStyle = 'rgba(255,240,220,0.07)'; rrect(ctx, r, 18); ctx.fill();
      txt(ctx, b.label, 20, op.y + op.h * (b.hint ? 0.36 : 0.5), 28 * Math.min(ts, 1.6), PAL.text, { weight: 700, maxW: Math.max(120, Math.min(innerW * 0.6, (b.kind === 'stepper' ? innerW - 314 : b.kind === 'button' ? innerW - Math.min(innerW * 0.4, 280) - 20 : innerW - 128) - 34)) });
      const ctrlX = b.kind === 'stepper' ? innerW - 20 - 72 * 2 - 150 : b.kind === 'button' ? innerW - Math.min(innerW * 0.4, 280) - 20 : b.kind === 'toggle' ? innerW - 128 : innerW * 0.6;
      const lblW = Math.max(120, Math.min(innerW * 0.6, ctrlX - 20 - 34));
      if (b.hint) txt(ctx, b.hint, 20, op.y + op.h * 0.72, 20 * Math.min(ts, 1.6), PAL.dim, { weight: 500, maxW: lblW });
      const val = b.val?.();
      const sx = view.x + padX, sy = view.y + 18 - scroll;
      const screenR = (rr) => ({ x: sx + rr.x, y: sy + rr.y, w: rr.w, h: rr.h });
      if (b.kind === 'toggle') {
        const tw = 108, th = 52, tr = { x: innerW - tw - 20, y: op.y + (op.h - th) / 2, w: tw, h: th };
        ctx.fillStyle = val ? '#2f8a5b' : 'rgba(255,255,255,0.16)'; rrect(ctx, tr, th / 2); ctx.fill();
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
        button(ctx, br, b.btn ?? 'Open', { kind: b.disabled ? 'disabled' : 'primary', size: 28, noShadow: true });
        ui.hits.push({ id: 'set:' + b.row, r: screenR(r), clip: view });
      }
    }
  }
  ctx.restore();
  // scrollbar
  if (max > 0) {
    const sb = { x: view.x + view.w - 12, y: view.y + 12, w: 6, h: view.h - 24 }, th = Math.max(40, sb.h * view.h / (lay.total + 28));
    ctx.fillStyle = 'rgba(255,240,220,0.12)'; rrect(ctx, sb, 3); ctx.fill();
    ctx.fillStyle = 'rgba(242,193,78,0.8)'; rrect(ctx, { x: sb.x, y: sb.y + (sb.h - th) * (scroll / max), w: sb.w, h: th }, 3); ctx.fill();
  }
  ui.view = view;
}
