// Text screens: Rules (paged), About, How to Play and Settings share one scrolling document renderer with a text-size stepper (to 300%).
// render() records what is tappable in `ui.hits` (rects in screen space); the game's update() reads it on the next tick.
import { PAL, UI, DISPLAY, rgba, drawBead, drawNoteBar } from './art.js';
import { txt, wrap, button, panel, rrect, chip } from './ui.js';
import { TEXT_SCALES } from './layout.js';
import { PARTS, SCALE_LIST, RESONANCE, ASSIST } from './music.js';

export const ui = { hits: [] };
export const docMetrics = { max: 0, view: 0 };
const cache = new Map();
const TAU = Math.PI * 2;

// ---- figures (they use the game's own bead and bar painters) ---------------------------------------------------------------------------
function ladder(ctx, x, y, w, h, lines, labels = true) {
  ctx.fillStyle = 'rgba(8,3,4,0.5)'; rrect(ctx, { x, y, w, h }, 14); ctx.fill();
  lines.forEach((l, i) => {
    const yy = y + h - 14 - (h - 28) * (i / (lines.length - 1));
    ctx.strokeStyle = l.tonic ? 'rgba(255,214,130,0.6)' : 'rgba(255,225,170,0.2)'; ctx.lineWidth = l.tonic ? 2.5 : 1.5;
    ctx.beginPath(); ctx.moveTo(x + 10, yy); ctx.lineTo(x + w - 10, yy); ctx.stroke();
    if (labels) txt(ctx, String(l.n), x + 22, yy - 11, 17, l.tonic ? PAL.gold : PAL.dim, { weight: 700 });
    l.y = yy;
  });
}
function figure(ctx, name, x, y, w, h) {
  ctx.save();
  if (name === 'ladder') {
    const ls = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({ n, tonic: n === 1 || n === 8 }));
    ladder(ctx, x, y, w, h, ls);
    const bx = x + w * 0.3;
    drawNoteBar(ctx, bx + 30, bx + w * 0.34, ls[2].y, 18, 1, {});
    drawNoteBar(ctx, bx + w * 0.36, bx + w * 0.58, ls[4].y, 18, 1, {});
    drawBead(ctx, bx, ls[2].y, 20, 1, { amp: 1 });
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.moveTo(bx, y + 8); ctx.lineTo(bx, y + h - 8); ctx.stroke(); ctx.setLineDash([]);
    txt(ctx, 'now', bx, y + h - 6, 18, PAL.dim, { align: 'center', base: 'bottom', weight: 700 });
    txt(ctx, 'notes come from the right', x + w - 14, y + 22, 19, PAL.dim, { align: 'right', weight: 600, maxW: w * 0.55 });
  } else if (name === 'voices') {
    const ls = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => ({ n, tonic: n === 1 || n === 8 }));
    ladder(ctx, x, y, w, h, ls, false);
    const bx = x + w * 0.5, ys = [ls[0].y, ls[4].y, ls[6].y];
    for (let p = 0; p < 3; p++) {
      drawNoteBar(ctx, bx + 10, x + w - 20, ys[p], 15, p, {});
      drawNoteBar(ctx, x + 20, bx - 20, ys[p] + (p === 1 ? -(ls[1].y - ls[0].y) : 0), 15, p, { friend: true });
      drawBead(ctx, bx, ys[p], 20, p, { amp: 1 });
      txt(ctx, PARTS[p].name, x + w - 24, ys[p] - 26, 20, PARTS[p].col, { align: 'right', weight: 800 });
    }
  } else if (name === 'tune') {
    const ls = [1, 2, 3, 4, 5].map((n) => ({ n, tonic: n === 1 }));
    ladder(ctx, x, y, w, h, ls, false);
    const cy = ls[2].y, hh = Math.min(30, h * 0.14), bx = x + w * 0.5;
    ctx.fillStyle = 'rgba(80,220,180,0.22)'; ctx.fillRect(x + 14, cy - hh, w - 28, hh * 2);
    ctx.fillStyle = 'rgba(255,220,120,0.14)'; ctx.fillRect(x + 14, cy - hh * 2.2, w - 28, hh * 4.4);
    drawNoteBar(ctx, x + 60, x + w - 60, cy, hh * 0.55, 1, {});
    drawBead(ctx, bx, cy - hh * 0.2, 18, 1, { amp: 1, lock: 1 });
    txt(ctx, 'in tune: full credit', x + w - 20, cy - hh * 1.3, 20, '#9ff0d8', { align: 'right', weight: 700 });
    txt(ctx, 'near: half credit', x + w - 20, cy - hh * 2.6, 20, '#ffe39a', { align: 'right', weight: 700 });
  } else if (name === 'lock') {
    const cx = x + w / 2, cy = y + h / 2;
    ctx.fillStyle = 'rgba(8,3,4,0.5)'; rrect(ctx, { x, y, w, h }, 14); ctx.fill();
    const g = ctx.createRadialGradient(cx, cy, 6, cx, cy, h * 0.9); g.addColorStop(0, 'rgba(255,240,170,0.5)'); g.addColorStop(1, 'rgba(255,200,100,0)');
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    const r = Math.min(h * 0.32, 40), pts = [[cx - w * 0.26, cy + h * 0.2, 0], [cx, cy - h * 0.2, 1], [cx + w * 0.26, cy + h * 0.2, 2]];
    ctx.strokeStyle = 'rgba(255,240,180,0.7)'; ctx.lineWidth = 4; ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.closePath(); ctx.stroke();
    pts.forEach((q) => drawBead(ctx, q[0], q[1], r * 0.75, q[2], { amp: 1, lock: 1 }));
    txt(ctx, 'LOCKED', cx, y + h - 22, 26, PAL.gold, { align: 'center', weight: 800 });
  } else if (name === 'scales') {
    const rowH = h / SCALE_LIST.length;
    SCALE_LIST.forEach((sc, i) => {
      const yy = y + i * rowH + rowH / 2;
      txt(ctx, sc.name, x + 6, yy, Math.min(26, rowH * 0.4), PAL.gold, { weight: 800 });
      const x0 = x + w * 0.26, x1 = x + w - 16;
      ctx.fillStyle = 'rgba(255,240,220,0.08)'; ctx.fillRect(x0, yy - 1, x1 - x0, 2);
      sc.steps.concat([1200]).forEach((c, k) => {
        const px = x0 + (x1 - x0) * (c / 1200);
        ctx.fillStyle = k === 0 || k === 7 ? PAL.gold : PAL.text; ctx.beginPath(); ctx.arc(px, yy, k === 0 || k === 7 ? 9 : 6.5, 0, TAU); ctx.fill();
      });
    });
  } else if (name === 'resonance') {
    const n = RESONANCE.max, bw = (w - 20 * 2) / n;
    for (let i = 0; i < n; i++) {
      const bx = x + 20 + i * bw, bh = h * (0.34 + 0.5 * i / (n - 1));
      const g = ctx.createLinearGradient(0, y + h - bh, 0, y + h); g.addColorStop(0, '#ffe9a0'); g.addColorStop(1, '#d98f2a');
      ctx.fillStyle = g; rrect(ctx, { x: bx + 5, y: y + h - bh - 20, w: bw - 10, h: bh }, 10); ctx.fill();
      txt(ctx, 'x' + RESONANCE.mult(i + 1), bx + bw / 2, y + h - bh - 38, 22, PAL.gold, { align: 'center', weight: 800 });
      txt(ctx, 'level ' + (i + 1), bx + bw / 2, y + h - 6, 17, PAL.dim, { align: 'center', base: 'bottom', weight: 600 });
    }
  } else if (name === 'breath') {
    const ls = [1, 2, 3, 4, 5].map((n) => ({ n, tonic: n === 1 }));
    ladder(ctx, x, y, w, h, ls, false);
    drawNoteBar(ctx, x + 20, x + w * 0.3, ls[2].y, 16, 1, {});
    ctx.fillStyle = 'rgba(190,225,255,0.14)'; ctx.fillRect(x + w * 0.3 + 6, y + 8, w * 0.28, h - 16);
    txt(ctx, 'breath', x + w * 0.44, y + h / 2, 24, '#cfe8ff', { align: 'center', weight: 800 });
    txt(ctx, 'lift your finger', x + w * 0.44, y + h / 2 + 30, 18, PAL.dim, { align: 'center', weight: 600 });
    drawNoteBar(ctx, x + w * 0.6, x + w - 20, ls[3].y, 16, 1, {});
  } else if (name === 'assist') {
    const rowH = h / ASSIST.length;
    ASSIST.forEach((a, i) => {
      const yy = y + i * rowH + rowH / 2;
      ctx.fillStyle = 'rgba(255,240,220,0.07)'; rrect(ctx, { x, y: yy - rowH * 0.42, w, h: rowH * 0.84 }, 12); ctx.fill();
      txt(ctx, a.name, x + 16, yy - 6, Math.min(26, rowH * 0.34), PAL.gold, { weight: 800 });
      txt(ctx, `in tune within ${a.lock} cents, near within ${a.near}`, x + 16, yy + rowH * 0.22, Math.min(19, rowH * 0.24), PAL.dim, { weight: 500, maxW: w - 30 });
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
  txt(ctx, doc.title, tx, vp.y - 30, 42, PAL.gold, { align: 'center', font: DISPLAY, weight: 700, maxW: D.viewport.w - 20, stroke: 6 });
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
      txt(ctx, b.label, 20, op.y + op.h * (b.hint ? 0.36 : 0.5), 28 * Math.min(ts, 1.6), PAL.text, { weight: 700, maxW: b.kind === 'stepper' ? Math.max(90, innerW - 354) : innerW * 0.52 });
      if (b.hint) txt(ctx, b.hint, 20, op.y + op.h * 0.72, 20 * Math.min(ts, 1.6), PAL.dim, { weight: 500, maxW: b.kind === 'stepper' ? Math.max(90, innerW - 354) : b.kind === 'button' ? Math.max(90, innerW - Math.min(innerW * 0.4, 280) - 50) : innerW * 0.55 });
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
