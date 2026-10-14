// Text screens: Rules (paged), About, How to Play and Settings share one scrolling document renderer with a text-size stepper (to 300%).
// render() records what is tappable in `ui.hits` (rects in screen space); the game's update() reads it on the next tick.
import { PAL, UI, DISPLAY, rgba, drawMiniSantoor, drawNote, drawBody, drawCourses, drawBridges, drawSpot, drawMallet } from './art.js';
import { txt, wrap, button, panel, rrect, icon, chip } from './ui.js';
import { TEXT_SCALES, host, makeInst } from './layout.js';
import { NNOTE, SCALES } from './music.js';
import { v3 } from './v3.js';

export const ui = { hits: [] };
export const docMetrics = { max: 0, view: 0 };
const cache = new Map();

// ---- figures (they use the game's own instrument and note painters) --------------------------------------------------------------------
function figure(ctx, name, x, y, w, h) {
  ctx.save();
  if (name === 'instrument') {
    const side = Math.min(w, h - 40), rect = { x: x + (w - side * 1.15) / 2, y: y + 4, w: side * 1.15, h: side * 0.85 };
    const inst = drawMiniSantoor(ctx, rect, { vert: true });
    txt(ctx, 'narrow end: high notes', x + w / 2, y + h - 34, 20, PAL.dim, { align: 'center', weight: 600, maxW: w - 10 });
    txt(ctx, 'wide end (your end): low notes', x + w / 2, y + h - 10, 20, PAL.dim, { align: 'center', weight: 600, maxW: w - 10 });
    void inst;
  } else if (name === 'zigzag') {
    const rect = { x: x + w * 0.2, y: y + 4, w: w * 0.6, h: h - 12 }, inst = drawMiniSantoor(ctx, rect, { vert: true });
    const pts = []; for (let n = 0; n < 10; n++) pts.push(inst.pt(n));
    ctx.strokeStyle = 'rgba(255,240,210,0.85)'; ctx.lineWidth = 3; ctx.setLineDash([8, 6]); ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.stroke(); ctx.setLineDash([]);
    pts.forEach((q, n) => drawNote(ctx, q.x, q.y, Math.max(8, inst.rh * 0.3), { side: n & 1, k: 0, label: String(n + 1) }));
    chip(ctx, x + w * 0.1, y + h * 0.5, 'left mallet', 18, { align: 'center', fill: 'rgba(255,179,71,0.35)' });
    chip(ctx, x + w * 0.9, y + h * 0.5, 'right mallet', 18, { align: 'center', fill: 'rgba(53,214,192,0.35)' });
  } else if (name === 'notes') {
    const items = [['note', 0, 'strike'], ['roll', 1, 'tremolo'], ['run', 0, 'run'], ['note', 1, 'right hand'], ['ghost', 0, "teacher's"]];
    items.forEach(([k, side, label], i) => {
      const cx = x + w * (i + 0.5) / items.length, r = Math.min(34, w / items.length * 0.3);
      drawNote(ctx, cx, y + h * 0.4, r, { side, kind: k === 'ghost' ? 'note' : k, k: 0.6, ghost: k === 'ghost', hold: k === 'roll' ? 0.6 : 0 });
      txt(ctx, label, cx, y + h - 16, Math.min(22, w / items.length * 0.19), PAL.text, { align: 'center', weight: 600, maxW: w / items.length - 6 });
    });
  } else if (name === 'ring') {
    const cx = x + w / 2, cy = y + h / 2, r = Math.min(h * 0.22, 40);
    [1, 0.6, 0.25].forEach((k, i) => {
      const px = x + w * (0.2 + i * 0.3);
      drawSpot(ctx, px, cy, r, 0, 0, 0);
      drawNote(ctx, px, cy, r, { side: 0, k });
      txt(ctx, ['far', 'closer', 'on the beat'][i], px, y + h - 14, 20, PAL.dim, { align: 'center', weight: 600 });
    });
    void cx;
  } else if (name === 'run') {
    const rect = { x: x + w * 0.2, y: y + 4, w: w * 0.6, h: h - 58 }, inst = drawMiniSantoor(ctx, rect, { vert: true });
    const pts = []; for (let n = 4; n < 12; n++) pts.push(inst.pt(n));
    ctx.strokeStyle = '#35c3b0'; ctx.lineWidth = Math.max(4, inst.rh * 0.3); ctx.lineCap = 'round'; ctx.globalAlpha = 0.7; ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.stroke(); ctx.globalAlpha = 1;
    pts.forEach((q, i) => drawNote(ctx, q.x, q.y, Math.max(7, inst.rh * 0.28), { side: (i + 4) & 1, kind: 'run', k: 0 }));
    chip(ctx, x + w * 0.5, y + h - 20, 'one stroke from note 5 up to note 12', Math.min(24, Math.max(13, h * 0.07)), { align: 'center', fill: 'rgba(6,18,24,0.9)', color: '#bff0e6' });
  } else if (name === 'layers') {
    const names = ['The melody (you)', 'Layer 1: a drone on every beat', 'Layer 2: a soft hand-drum pulse'], rowH = h / 3;
    names.forEach((n, i) => {
      const yy = y + i * rowH + rowH / 2;
      ctx.fillStyle = 'rgba(47,182,163,0.3)'; rrect(ctx, { x, y: yy - rowH * 0.36, w, h: rowH * 0.72 }, 10); ctx.fill();
      txt(ctx, n, x + 14, yy, Math.min(23, rowH * 0.42), PAL.text, { weight: 600, maxW: w - 150 });
      for (let b = 0; b < 8; b++) { if (i === 1 && b % 2) continue; ctx.fillStyle = i === 0 ? '#ffb347' : '#f6d98a'; ctx.beginPath(); ctx.arc(x + w - 130 + b * 15, yy, 5, 0, Math.PI * 2); ctx.fill(); }
    });
  }
  ctx.restore();
}
void drawBody; void drawCourses; void drawBridges; void drawMallet; void makeInst; void SCALES; void NNOTE; void rgba; void DISPLAY; void host; void TEXT_SCALES; void icon;

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
      const rh = Math.max(86, 56 * ts + 30) + (b.tall ? 24 * Math.min(ts, 2) : 0);
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
  txt(ctx, doc.title, tx, vp.y - 30, 42, PAL.gold, { align: 'center', font: DISPLAY, weight: 700, maxW: D.viewport.w - 20, stroke: 6 });
  // body
  const vh = doc.nav ? vp.h : (D.nav.back.y + D.nav.back.h) - vp.y;
  const view = { x: vp.x, y: vp.y, w: vp.w, h: vh };
  panel(ctx, view, { fill: 'rgba(12,8,30,0.62)', rad: 22, kind: 'inset' });
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
    } else if (op.t === 'fig') { const was = v3.on; if (was && !(op.y - scroll >= 0 && op.y - scroll + op.h <= view.h - 18)) v3.on = false; figure(ctx, op.name, 0, op.y, innerW, op.h); v3.on = was; }
    else if (op.t === 'row') {
      const b = op.b, r = { x: 0, y: op.y, w: innerW, h: op.h };
      const fx = (v) => (typeof v === 'function' ? v() : v), label = fx(b.label), hint = fx(b.hint), off = fx(b.disabled);
      ctx.fillStyle = 'rgba(255,240,220,0.07)'; rrect(ctx, r, 18); ctx.fill();
      const room = b.kind === 'stepper' ? innerW - 334 - 20 : b.kind === 'button' ? innerW - Math.min(innerW * 0.4, 280) - 60 : b.kind === 'cycle' ? innerW * 0.5 : innerW - 150;
      txt(ctx, label, 20, op.y + op.h * (hint ? 0.36 : 0.5), 28 * Math.min(ts, 1.6), PAL.text, { weight: 700, maxW: room });
      if (hint) txt(ctx, hint, 20, op.y + op.h * 0.72, 20 * Math.min(ts, 1.6), PAL.dim, { weight: 500, maxW: room });
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
        { const was = v3.on; if (was && !(op.y - scroll >= 0 && op.y - scroll + op.h <= view.h - 18)) v3.on = false; button(ctx, dec, '-', { kind: 'quiet', size: 34, noShadow: true }); button(ctx, inc, '+', { kind: 'quiet', size: 34, noShadow: true }); v3.on = was; }
        txt(ctx, String(val), dec.x + bw + 75, op.y + op.h / 2, 26 * Math.min(ts, 1.4), PAL.gold, { align: 'center', weight: 800, maxW: 140 });
        ui.hits.push({ id: 'set:' + b.row + 'Dec', r: screenR(dec), clip: view }, { id: 'set:' + b.row + 'Inc', r: screenR(inc), clip: view });
      } else if (b.kind === 'button') {
        const bw = Math.min(innerW * 0.4, 280), br = { x: innerW - bw - 20, y: op.y + (op.h - 66) / 2, w: bw, h: 66 };
        { const was = v3.on; if (was && !(op.y - scroll >= 0 && op.y - scroll + op.h <= view.h - 18)) v3.on = false; button(ctx, br, fx(b.btn) ?? 'Open', { kind: off ? 'disabled' : 'primary', size: 28, noShadow: true }); v3.on = was; }
        if (!off) ui.hits.push({ id: 'set:' + b.row, r: screenR(r), clip: view });
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
