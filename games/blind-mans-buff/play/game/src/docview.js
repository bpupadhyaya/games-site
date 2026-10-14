// Text screens: Rules (paged), About, How to Play and Settings share one scrolling document renderer with a text-size stepper (to 300%).
// render() records what is tappable in `ui.hits` (rects in screen space); the game's update() reads it on the next tick.
import { PAL, UI, DISPLAY, drawPortrait, drawSeeker, drawFigure, drawFeather, drawObstacle, TAU } from './art.js';
import { txt, wrap, button, panel, rrect } from './ui.js';
import { TEXT_SCALES } from './layout.js';
import { ROSTER, rosterOf, TEMPERS, heightNote } from './engine.js';

export const ui = { hits: [] };
export const docMetrics = { max: 0, view: 0 };
const cache = new Map();

// ---- figures (they use the game's own art) ----------------------------------------------------------------------------------------------
function ring(ctx, x, y, r, col, a, lw = 3) { ctx.strokeStyle = col; ctx.globalAlpha = a; ctx.lineWidth = lw; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; }
// The 3D seeker still (null while loading or when the 3D layer is unavailable: the caller then paints the 2D art).
const SEEKER_REC = { id: 'seeker', skin: 1, hair: '#5a3418', outfit: '#8f2f4a', trim: '#e8c26a', head: 'none', trinket: 'none' };
function seekerPic(ctx, cx, cy, size) {
  const f3 = globalThis.__people3d;
  if (!f3 || f3.pending || !f3.seekerPic) return false;
  const im = f3.seekerPic(SEEKER_REC);
  if (!im) return false;
  ctx.drawImage(im, cx - size * 0.5, cy - size * 0.58, size, size);
  return true;
}
function figure(ctx, name, x, y, w, h) {
  ctx.save(); ctx.beginPath(); ctx.rect(x - 4, y - 6, w + 8, h + 12); ctx.clip();
  if (name === 'seeker') {
    ctx.fillStyle = 'rgba(10,6,24,0.55)'; rrect(ctx, { x, y, w, h }, 18); ctx.fill();
    const cx = x + w * 0.28, cy = y + h * 0.55, s = Math.min(h * 0.17, 40);
    const g = ctx.createRadialGradient(cx, cy, 10, cx, cy, h * 0.7); g.addColorStop(0, 'rgba(255,217,160,0.38)'); g.addColorStop(1, 'rgba(255,217,160,0)'); ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    if (!seekerPic(ctx, cx, cy - 4, h * 1.05)) drawSeeker(ctx, cx, cy, s, 0, { reach: 0, out: 0.5 });
    for (let i = 0; i < 3; i++) ring(ctx, x + w * 0.74, y + h * 0.3, 16 + i * 17, '#fbf1dc', 0.8 - i * 0.25, 3);
    ctx.fillStyle = '#fbf1dc'; ctx.beginPath(); ctx.arc(x + w * 0.74, y + h * 0.3, 7, 0, TAU); ctx.fill();
    ctx.setLineDash([8, 8]); ring(ctx, x + w * 0.74, y + h * 0.78, 26, '#f6a0bc', 0.8, 3); ctx.setLineDash([]);
    ctx.fillStyle = '#f6a0bc'; ctx.beginPath(); ctx.arc(x + w * 0.74, y + h * 0.78, 7, 0, TAU); ctx.fill();
    txt(ctx, 'you, with the blindfold', cx, y + h - 14, 22, PAL.dim, { align: 'center', maxW: w * 0.4 });
    txt(ctx, 'a clap, heard from afar', x + w * 0.74, y + h * 0.3 + 50, 21, PAL.dim, { align: 'center', maxW: w * 0.36 });
    txt(ctx, 'a giggle: old and unsure', x + w * 0.74, y + h * 0.78 + 42, 21, PAL.dim, { align: 'center', maxW: w * 0.36 });
  } else if (name === 'sounds') {
    const items = [['clap', '#fbf1dc', 'Clap', 34], ['giggle', '#f6a0bc', 'Giggle', 28], ['step', '#a8d0f0', 'Steps', 16], ['call', '#e8c26a', 'Your call', 42]];
    const cell = w / items.length;
    items.forEach(([k, col, label, r], i) => {
      const cx = x + cell * (i + 0.5), cy = y + h * 0.42;
      for (let j = 0; j < 3; j++) ring(ctx, cx, cy, r * (0.35 + j * 0.34), col, 0.9 - j * 0.28, 4);
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx, cy, 6, 0, TAU); ctx.fill();
      txt(ctx, label, cx, y + h - 30, 24, PAL.text, { align: 'center', weight: 700, maxW: cell - 6 });
    });
  } else if (name === 'cone') {
    ctx.fillStyle = 'rgba(10,6,24,0.55)'; rrect(ctx, { x, y, w, h }, 18); ctx.fill();
    const cx = x + w * 0.14, cy = y + h * 0.5, s = Math.min(h * 0.17, 40), R = Math.min(w * 0.5, h * 1.2);
    ctx.fillStyle = 'rgba(232,194,106,0.28)'; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R * 0.62, -Math.PI / 3, Math.PI / 3); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#e8c26a'; ctx.lineWidth = 3; ctx.stroke();
    if (!seekerPic(ctx, cx, cy - 4, h * 1.05)) drawSeeker(ctx, cx, cy, s, 0, { reach: 0.8, out: 1 });
    drawFigure(ctx, ROSTER[1], cx + R * 0.42, cy - 4, s * 0.9, Math.PI, {});
    drawFigure(ctx, ROSTER[2], cx + R * 0.42, cy + h * 0.38, s * 0.9, Math.PI, { alpha: 0.7 });
    txt(ctx, 'inside the sweep: caught', cx + R * 0.42, cy - s * 1.7, 21, '#e8c26a', { align: 'center', weight: 700, maxW: w * 0.4 });
    txt(ctx, 'outside: missed', cx + R * 0.42, cy + h * 0.38 + s * 1.5, 21, PAL.dim, { align: 'center', maxW: w * 0.4 });
    txt(ctx, '120 degrees', x + w * 0.84, y + h * 0.3, 24, PAL.text, { align: 'center', weight: 700, maxW: w * 0.28 });
    txt(ctx, '84 units long', x + w * 0.84, y + h * 0.3 + 30, 22, PAL.dim, { align: 'center', maxW: w * 0.28 });
  } else if (name === 'clues') {
    const r = ROSTER[0], s = Math.min(h * 0.82, w * 0.3), px = x + s * 0.55 + 8, py = y + h / 2;
    drawPortrait(ctx, r, px, py, s, {});
    const lines = [['1  Height', heightNote(r.height)], ['2  Head', 'powdered wig'], ['3  Trinket', 'folded fan']];
    lines.forEach(([a, b], i) => {
      const yy = y + h * (0.2 + i * 0.3);
      ctx.fillStyle = 'rgba(255,240,220,0.08)'; rrect(ctx, { x: px + s * 0.62, y: yy - 30, w: w - (px - x) - s * 0.62 - 4, h: 60 }, 14); ctx.fill();
      txt(ctx, a, px + s * 0.62 + 14, yy - 8, 20, PAL.gold, { weight: 800 });
      txt(ctx, b, px + s * 0.62 + 14, yy + 15, 24, PAL.text, { weight: 700, maxW: w * 0.5 });
    });
  } else if (name === 'roster') {
    const cols = 5, cell = w / cols, s = Math.min(cell * 0.84, (h / 2) * 0.62);
    ROSTER.forEach((r, i) => {
      const cx = x + cell * ((i % cols) + 0.5), cy = y + (h / 2) * (Math.floor(i / cols) + 0.4) + 6;
      drawPortrait(ctx, r, cx, cy, s, {});
      txt(ctx, r.name.replace('Madame ', '').replace('Monsieur ', '').replace('Chevalier ', '').replace('Little ', '').replace('Old ', ''), cx, cy + s / 2 + 18, 18, PAL.text, { align: 'center', weight: 700, maxW: cell - 6 });
    });
  } else if (name === 'feathers') {
    for (let i = 0; i < 3; i++) drawFeather(ctx, x + w / 2 + (i - 1) * 100, y + h * 0.45, 100, i < 2, -0.5);
    txt(ctx, 'caught all, plenty of sand, few clues', x + w / 2, y + h - 18, 22, PAL.dim, { align: 'center', maxW: w - 20 });
  } else if (name === 'gaits') {
    const items = [['Tiptoe', 0, '#9be0a8', 'silent'], ['Walk', 150, '#f0d98a', 'heard 150'], ['Run', 380, '#f08a7a', 'heard 380']];
    const cell = w / 3, k = (h * 0.38) / 380;
    items.forEach(([n, rr, col, note], i) => {
      const cx = x + cell * (i + 0.5), cy = y + h * 0.45;
      if (rr > 0) ring(ctx, cx, cy, Math.max(12, rr * k), col, 0.8, 4);
      drawFigure(ctx, ROSTER[4], cx, cy, 20, -Math.PI / 2, {});
      txt(ctx, n, cx, y + h - 40, 26, PAL.text, { align: 'center', weight: 800, maxW: cell - 8 });
      txt(ctx, note, cx, y + h - 12, 20, PAL.dim, { align: 'center', maxW: cell - 8 });
    });
  }
  void TEMPERS; void rosterOf; void drawObstacle;
  ctx.restore();
}

// ---- layout of blocks into drawable ops ----------------------------------------------------------------------------------------------------
function layoutDoc(ctx, blocks, width, ts) {
  const ops = []; let y = 0;
  const bodyF = 27 * ts, headF = 34 * Math.min(ts, 2), lh = bodyF * 1.42;
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
  const tx = vp.x + vp.w / 2;
  txt(ctx, doc.title, tx, vp.y - 30, 38, PAL.gold, { align: 'center', font: DISPLAY, weight: 400, maxW: vp.w - 20, stroke: 6 });
  const vh = doc.nav ? vp.h : (D.nav.back.y + D.nav.back.h) - vp.y;
  const view = { x: vp.x, y: vp.y, w: vp.w, h: vh };
  panel(ctx, view, { fill: 'rgba(22,18,48,0.84)', rad: 22 });
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
      ctx.beginPath(); ctx.fillStyle = PAL.gold; ctx.arc(10 * ts, op.y + op.lh * 0.5, 5 * ts + 1, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = PAL.text;
      op.lines.forEach((ln, i) => ctx.fillText(ln, op.ind, op.y + i * op.lh));
    } else if (op.t === 'fig') figure(ctx, op.name, 0, op.y, innerW, op.h);
    else if (op.t === 'row') {
      const b = op.b, r = { x: 0, y: op.y, w: innerW, h: op.h };
      ctx.fillStyle = 'rgba(251,241,220,0.07)'; rrect(ctx, r, 18); ctx.fill();
      const lab = typeof b.label === 'function' ? b.label() : b.label, hint = typeof b.hint === 'function' ? b.hint() : b.hint;
      txt(ctx, lab, 20, op.y + op.h * (hint ? 0.36 : 0.5), 28 * Math.min(ts, 1.6), PAL.text, { weight: 700, maxW: innerW * 0.52 });
      if (hint) txt(ctx, hint, 20, op.y + op.h * 0.72, 20 * Math.min(ts, 1.6), PAL.dim, { weight: 500, maxW: innerW * 0.55 });
      const val = b.val?.();
      const sx = view.x + padX, sy = view.y + 18 - scroll;
      const screenR = (rr) => ({ x: sx + rr.x, y: sy + rr.y, w: rr.w, h: rr.h });
      if (b.kind === 'toggle') {
        const tw = 108, th = 52, tr = { x: innerW - tw - 20, y: op.y + (op.h - th) / 2, w: tw, h: th };
        ctx.fillStyle = val ? '#5a9a6a' : 'rgba(255,255,255,0.16)'; rrect(ctx, tr, th / 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(val ? tr.x + tw - th / 2 : tr.x + th / 2, tr.y + th / 2, th / 2 - 5, 0, Math.PI * 2); ctx.fill();
        ui.hits.push({ id: 'set:' + b.row, r: screenR(r), clip: view });
      } else if (b.kind === 'cycle') {
        txt(ctx, String(val), innerW - 24, op.y + op.h / 2, 28 * Math.min(ts, 1.6), PAL.gold, { align: 'right', weight: 800, maxW: innerW * 0.4 });
        ui.hits.push({ id: 'set:' + b.row, r: screenR(r), clip: view });
      } else if (b.kind === 'button') {
        const bw = Math.min(innerW * 0.4, 280), br = { x: innerW - bw - 20, y: op.y + (op.h - 66) / 2, w: bw, h: 66 };
        const off = typeof b.off === 'function' ? b.off() : false;
        button(ctx, br, (typeof b.btn === 'function' ? b.btn() : b.btn) ?? 'Open', { kind: off ? 'disabled' : 'primary', size: 28, noShadow: true });
        if (!off) ui.hits.push({ id: 'set:' + b.row, r: screenR(r), clip: view });
      }
    }
  }
  ctx.restore();
  if (max > 0) {
    const sb = { x: view.x + view.w - 12, y: view.y + 12, w: 6, h: view.h - 24 }, th = Math.max(40, sb.h * view.h / (lay.total + 28));
    ctx.fillStyle = 'rgba(251,241,220,0.12)'; rrect(ctx, sb, 3); ctx.fill();
    ctx.fillStyle = 'rgba(232,194,106,0.7)'; rrect(ctx, { x: sb.x, y: sb.y + (sb.h - th) * (scroll / max), w: sb.w, h: th }, 3); ctx.fill();
  }
  ui.view = view;
}

