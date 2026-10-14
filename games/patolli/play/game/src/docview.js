// Text screens: Rules (paged), About, How to Play and Settings share one scrolling document renderer with a text-size stepper (to 300%).
// render() records what is tappable in `ui.hits` (rects in screen space); the game's update() reads it on the next tick.
import { PAL, UI, DISPLAY, SEAT, drawBead, drawBean, drawGlyph, drawSheet, rr, TAU } from './art.js';
import { txt, wrap, button, rrect } from './ui.js';
import { TEXT_SCALES } from './layout.js';
import { STEPS, ODDS, BEANS } from './engine.js';
import { drawBoard } from './boardview.js';

export const ui = { hits: [] };
export const docMetrics = { max: 0, view: 0 };
const cache = new Map();

// ---- figures: they use the game's own painters ---------------------------------------------------------------------------------------
function figure(ctx, name, x, y, w, h) {
  ctx.save();
  const ink = PAL.ink;
  if (name === 'board') {
    const s = Math.min(w, h);
    drawBoard(ctx, { x: x + (w - s) / 2, y, w: s, h: s }, { mini: false, armSeat: [0, 1, 2, 3] });
  } else if (name === 'beans') {
    const rows = 6, rh = Math.min(h / rows, 76), bw = Math.min(rh * 0.9, 56);
    for (let k = 0; k < rows; k++) {
      const cy = y + (k + 0.5) * rh;
      ctx.fillStyle = k % 2 ? 'rgba(43,26,13,0.08)' : 'rgba(43,26,13,0.14)'; rrect(ctx, { x, y: cy - rh / 2 + 2, w, h: rh - 4 }, 10); ctx.fill();
      for (let i = 0; i < BEANS; i++) drawBean(ctx, x + 14 + bw * 0.6 + i * (bw + 8), cy, bw, i < k, { rot: (i % 2 ? 0.2 : -0.15) });
      const lx = x + 14 + (bw + 8) * BEANS + 12;
      txt(ctx, `${k} marked`, lx, cy, Math.min(26, rh * 0.38), ink, { maxW: w * 0.26 });
      txt(ctx, `${STEPS[k]} ${STEPS[k] === 1 ? 'step' : 'steps'}${k === 5 ? ' + throw again' : ''}`, x + w - 12, cy - rh * 0.12, Math.min(28, rh * 0.4), PAL.good, { align: 'right', maxW: w * 0.34 });
      txt(ctx, `${Math.round(ODDS[k] * 100)}% of throws`, x + w - 12, cy + rh * 0.26, Math.min(20, rh * 0.28), PAL.sepia, { align: 'right', maxW: w * 0.34 });
    }
  } else if (name === 'capture') {
    const n = 7, cs = Math.min(w / (n + 1), 70), x0 = x + (w - cs * n) / 2, cy = y + cs * 1.9;
    for (let i = 0; i < n; i++) {
      const cx = x0 + i * cs;
      const entry = i === 6;
      ctx.fillStyle = entry ? SEAT[1].base : PAL.stone; rrect(ctx, { x: cx + 3, y: cy - cs / 2 + 3, w: cs - 6, h: cs - 6 }, 8); ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(60,35,15,0.6)'; rrect(ctx, { x: cx + 3, y: cy - cs / 2 + 3, w: cs - 6, h: cs - 6 }, 8); ctx.stroke();
    }
    drawBead(ctx, x0 + cs * 0.5, cy + cs * 0.2, cs * 0.95, 0);
    drawBead(ctx, x0 + cs * 4.5, cy + cs * 0.2, cs * 0.95, 1);
    ctx.strokeStyle = PAL.good; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x0 + cs * 0.7, cy - cs * 0.55); ctx.quadraticCurveTo(x0 + cs * 2.5, cy - cs * 1.3, x0 + cs * 4.3, cy - cs * 0.55); ctx.stroke();
    txt(ctx, 'throw 4: lands on a single piece', x0 + cs * 2.5, cy - cs * 1.62, 22, PAL.good, { align: 'center', maxW: cs * 6 });
    txt(ctx, 'safe mouth', x0 + cs * 6.5, cy - cs * 0.78, 18, PAL.sepia, { align: 'center', maxW: cs * 1.2 });
    ctx.strokeStyle = PAL.danger; ctx.setLineDash([8, 7]); ctx.beginPath(); ctx.moveTo(x0 + cs * 4.6, cy + cs * 0.75); ctx.quadraticCurveTo(x0 + cs * 5.6, cy + cs * 1.25, x0 + cs * 6.5, cy + cs * 0.75); ctx.stroke(); ctx.setLineDash([]);
    txt(ctx, 'captured: back to its pit', x0 + cs * 4.5, cy + cs * 1.45, 21, PAL.danger, { align: 'center', maxW: cs * 5 });
  } else if (name === 'specials') {
    const items = [['entry', 'Arm mouth', 'safe square; pieces enter here'], ['trap', 'Trap', 'thrown back four squares'], ['boost', 'Corner stone', 'throw the beans again'], ['spine', 'Spine', 'only your own pieces'], ['home', 'Centre stone', 'home']];
    const cols = w > 700 ? 3 : 2, rows = Math.ceil(items.length / cols), cw = w / cols, ch = h / rows;
    items.forEach(([k, label, sub], i) => {
      const cx = x + (i % cols + 0.5) * cw, cy = y + Math.floor(i / cols) * ch + ch * 0.36, s = Math.min(cw * 0.2, ch * 0.2, 40);
      ctx.fillStyle = 'rgba(43,26,13,0.1)'; rrect(ctx, { x: cx - cw * 0.46, y: cy - ch * 0.34, w: cw * 0.92, h: ch * 0.92 }, 12); ctx.fill();
      if (k === 'entry') { ctx.fillStyle = SEAT[0].base; rr(ctx, cx - s, cy - s, s * 2, s * 2, 8); ctx.fill(); }
      else if (k === 'spine') { ctx.fillStyle = SEAT[0].base; rr(ctx, cx - s, cy - s, s * 2, s * 2, 8); ctx.fill(); ctx.fillStyle = 'rgba(244,236,216,0.45)'; rr(ctx, cx - s * 0.7, cy - s * 0.7, s * 1.4, s * 1.2, 5); ctx.fill(); }
      else if (k === 'home') { ctx.fillStyle = '#f0dcae'; rr(ctx, cx - s, cy - s, s * 2, s * 2, 6); ctx.fill(); ctx.fillStyle = '#2b1a0d'; rr(ctx, cx - s * 0.6, cy - s * 0.6, s * 1.2, s * 1.2, 4); ctx.fill(); ctx.fillStyle = PAL.gold; rr(ctx, cx - s * 0.25, cy - s * 0.25, s * 0.5, s * 0.5, 2); ctx.fill(); }
      else { ctx.fillStyle = PAL.stone; rr(ctx, cx - s, cy - s, s * 2, s * 2, 8); ctx.fill(); drawGlyph(ctx, k, cx, cy, s * 0.95); }
      const ly = y + Math.floor(i / cols) * ch + ch * 0.68;
      txt(ctx, label, cx, ly, 25, ink, { align: 'center', font: DISPLAY, maxW: cw * 0.86 });
      txt(ctx, sub, cx, ly + 26, 20, PAL.sepia, { align: 'center', maxW: cw * 0.86 });
    });
  }
  ctx.restore();
}

// ---- layout of blocks into drawable ops --------------------------------------------------------------------------------------------------
function layoutDoc(ctx, blocks, width, ts) {
  const ops = []; let y = 0;
  const bodyF = 26 * ts, headF = 32 * ts, lh = bodyF * 1.36;
  for (const b of blocks) {
    if (b.h) {
      y += ops.length ? 22 * ts : 0;
      ctx.font = `400 ${headF}px ${DISPLAY}`; const lines = wrap(ctx, b.h, width);
      ops.push({ t: 'h', y, lines, size: headF, h: lines.length * headF * 1.25 }); y += lines.length * headF * 1.25 + 8 * ts;
    } else if (b.p) {
      ctx.font = `600 ${bodyF}px ${UI}`; const lines = wrap(ctx, b.p, width);
      ops.push({ t: 'p', y, lines, size: bodyF, lh, h: lines.length * lh }); y += lines.length * lh + 12 * ts;
    } else if (b.li) {
      ctx.font = `600 ${bodyF}px ${UI}`; const ind = 34 * ts, lines = wrap(ctx, b.li, width - ind);
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
  if (doc.nav) {
    button(ctx, D.nav.back, 'Previous', { icon: 'back', kind: doc.page > 0 ? 'quiet' : 'disabled', size: 28 });
    button(ctx, D.nav.next, doc.page < doc.pages - 1 ? 'Next' : 'Done', { kind: 'primary', size: 28 });
    ui.hits.push({ id: 'prev', r: D.nav.back }, { id: 'next', r: D.nav.next });
  }
  const tx = vp.x + vp.w / 2;
  txt(ctx, doc.title, tx, vp.y - 30, 34, PAL.goldHi, { align: 'center', font: DISPLAY, maxW: vp.w - 20, stroke: 6 });
  const vh = doc.nav ? vp.h : (D.nav.back.y + D.nav.back.h) - vp.y;
  const view = { x: vp.x, y: vp.y, w: vp.w, h: vh };
  drawSheet(ctx, view, 18);
  const padX = 24, innerW = view.w - padX * 2 - 18;
  const key = `${doc.key}|${Math.round(innerW)}|${ts}`;
  let lay = cache.get(key);
  if (!lay) { lay = layoutDoc(ctx, doc.blocks, innerW, ts); if (cache.size > 30) cache.clear(); cache.set(key, lay); }
  const top = 30;
  const max = Math.max(0, lay.total + top + 24 - view.h);
  docMetrics.max = max; docMetrics.view = view.h;
  if (st.docRescale) { st.docScroll = st.docFrac * max; st.docRescale = false; }
  const scroll = Math.max(0, Math.min(st.docScroll, max)); st.docScroll = scroll;
  ctx.save(); rrect(ctx, view, 18); ctx.clip();
  ctx.translate(view.x + padX, view.y + top - scroll);
  for (const op of lay.ops) {
    if (op.y + op.h < scroll - 40 - top || op.y > scroll + view.h + 40) continue;
    if (op.t === 'h') { ctx.font = `400 ${op.size}px ${DISPLAY}`; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = '#9a3b1f'; op.lines.forEach((ln, i) => ctx.fillText(ln, 0, op.y + i * op.size * 1.25)); }
    else if (op.t === 'p') { ctx.font = `600 ${op.size}px ${UI}`; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = PAL.ink; op.lines.forEach((ln, i) => ctx.fillText(ln, 0, op.y + i * op.lh)); }
    else if (op.t === 'li') {
      ctx.font = `600 ${op.size}px ${UI}`; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = PAL.ink;
      ctx.beginPath(); ctx.fillStyle = '#9a3b1f'; ctx.rect(6 * ts, op.y + op.lh * 0.5 - 5 * ts, 10 * ts, 10 * ts); ctx.fill(); ctx.fillStyle = PAL.ink;
      op.lines.forEach((ln, i) => ctx.fillText(ln, op.ind, op.y + i * op.lh));
    } else if (op.t === 'fig') figure(ctx, op.name, 0, op.y, innerW, op.h);
    else if (op.t === 'row') {
      const b = op.b, r = { x: 0, y: op.y, w: innerW, h: op.h };
      ctx.fillStyle = 'rgba(43,26,13,0.1)'; rrect(ctx, r, 16); ctx.fill();
      txt(ctx, b.label, 20, op.y + op.h * (b.hint ? 0.36 : 0.5), 28 * Math.min(ts, 1.6), PAL.ink, { maxW: innerW * 0.52 });
      const hint = typeof b.hint === 'function' ? b.hint() : b.hint;
      if (hint) txt(ctx, hint, 20, op.y + op.h * 0.72, 20 * Math.min(ts, 1.6), PAL.sepia, { maxW: innerW * 0.5 });
      const val = b.val?.();
      const sx = view.x + padX, sy = view.y + top - scroll;
      const screenR = (rrr) => ({ x: sx + rrr.x, y: sy + rrr.y, w: rrr.w, h: rrr.h });
      if (b.kind === 'toggle') {
        const tw = 108, th = 52, tr = { x: innerW - tw - 20, y: op.y + (op.h - th) / 2, w: tw, h: th };
        ctx.fillStyle = val ? '#1f8a62' : 'rgba(43,26,13,0.28)'; rrect(ctx, tr, th / 2); ctx.fill();
        ctx.fillStyle = '#fff6dc'; ctx.beginPath(); ctx.arc(val ? tr.x + tw - th / 2 : tr.x + th / 2, tr.y + th / 2, th / 2 - 5, 0, TAU); ctx.fill();
        ui.hits.push({ id: 'set:' + b.row, r: screenR(r), clip: view });
      } else if (b.kind === 'cycle') {
        txt(ctx, String(val), innerW - 24, op.y + op.h / 2, 28 * Math.min(ts, 1.6), '#9a3b1f', { align: 'right', maxW: innerW * 0.4 });
        ui.hits.push({ id: 'set:' + b.row, r: screenR(r), clip: view });
      } else if (b.kind === 'info') {
        txt(ctx, String(val), innerW - 24, op.y + op.h / 2, 28 * Math.min(ts, 1.6), '#9a3b1f', { align: 'right', maxW: innerW * 0.4 });
      } else if (b.kind === 'button') {
        const bw = Math.min(innerW * 0.4, 280), br = { x: innerW - bw - 20, y: op.y + (op.h - 66) / 2, w: bw, h: 66 };
        button(ctx, br, b.btn ?? 'Open', { kind: 'primary', size: 28, noShadow: true, flat: true });
        ui.hits.push({ id: 'set:' + b.row, r: screenR(r), clip: view });
      }
    }
  }
  ctx.restore();
  if (max > 0) {
    const sb = { x: view.x + view.w - 12, y: view.y + 12, w: 6, h: view.h - 24 }, th = Math.max(40, sb.h * view.h / (lay.total + top + 24));
    ctx.fillStyle = 'rgba(43,26,13,0.14)'; rrect(ctx, sb, 3); ctx.fill();
    ctx.fillStyle = 'rgba(154,59,31,0.75)'; rrect(ctx, { x: sb.x, y: sb.y + (sb.h - th) * (scroll / max), w: sb.w, h: th }, 3); ctx.fill();
  }
  ui.view = view;
}
