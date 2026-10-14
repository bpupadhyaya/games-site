// Text screens: Rules (paged), About, How to Play and Settings share one scrolling document renderer with a text-size stepper (to 300%).
// render() records what is tappable in `ui.hits` (rects in screen space); the game's update() reads it on the next tick.
import { PAL, UI, DISPLAY, rgba, drawHoop, drawChild } from './art.js';
import { txt, wrap, button, panel, rrect } from './ui.js';
import { TEXT_SCALES } from './layout.js';
import { drawBalance } from './playview.js';
import { LOOKS } from './courses.js';

export const ui = { hits: [] };
export const docMetrics = { max: 0, view: 0 };
const cache = new Map();
const TAU = Math.PI * 2;
const demoRacer = (o = {}) => ({ lam: 0, psi: 0, spin: 0.6, phase: 'roll', downT: 0, downKind: '', stride: 0.4, ...o });

// ---- figures (they use the game's own hoop, child and balance painters) ------------------------------------------------------------
function figure(ctx, name, x, y, w, h) {
  ctx.save();
  if (name === 'stick') {
    // the hoop with the push zone below and the brake zone above, and the steering sideways
    const cx = x + w / 2, gy = y + h * 0.6, k = Math.min(h / 4.2, w / 8);
    ctx.fillStyle = 'rgba(70,214,150,0.16)'; rrect(ctx, { x: x + 6, y: gy, w: w - 12, h: y + h - gy - 4 }, 14); ctx.fill();
    ctx.fillStyle = 'rgba(255,140,100,0.16)'; rrect(ctx, { x: x + 6, y: y + 4, w: w - 12, h: gy - y - 6 }, 14); ctx.fill();
    drawHoop(ctx, cx, gy, k * 1.9, demoRacer({ lam: 0.1, psi: 0.1 }), { tape: '#e8472f' });
    drawChild(ctx, cx - k * 1.35, gy + k * 0.75, k * 1.4, LOOKS[0], 0.6, cx - k * 0.1, gy - k * 0.7, { lean: 0.1 });
    txt(ctx, 'BRAKE: finger above the hoop', cx, y + 24, 21, '#ffb090', { align: 'center', weight: 700, maxW: w - 20 });
    txt(ctx, 'PUSH: finger below the hoop', cx, y + h - 22, 21, '#8ef0c0', { align: 'center', weight: 700, maxW: w - 20 });
    txt(ctx, 'steer left', x + 70, gy - 4, 20, PAL.text, { align: 'center', weight: 600, maxW: 110 });
    txt(ctx, 'steer right', x + w - 70, gy - 4, 20, PAL.text, { align: 'center', weight: 600, maxW: 110 });
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    for (const sg of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx + sg * 130, gy + 24); ctx.lineTo(cx + sg * (w / 2 - 36), gy + 24); ctx.lineTo(cx + sg * (w / 2 - 54), gy + 12); ctx.moveTo(cx + sg * (w / 2 - 36), gy + 24); ctx.lineTo(cx + sg * (w / 2 - 54), gy + 36); ctx.stroke(); }
  } else if (name === 'balance') {
    drawBalance(ctx, { x: x + 6, y: y + 10, w: w - 12, h: 48 }, 0.3, { target: 0.1 });
    txt(ctx, 'the white dot is how far the hoop leans', x + w / 2, y + 86, 20, PAL.dim, { align: 'center', weight: 600, maxW: w - 10 });
    txt(ctx, 'keep it in the green', x + w / 2, y + 116, 22, '#8ef0dc', { align: 'center', weight: 700, maxW: w - 10 });
  } else if (name === 'hoop') {
    const cells = [['Upright', { lam: 0, psi: 0 }], ['Leaning right', { lam: 0.55, psi: 0.3 }], ['Leaning left', { lam: -0.55, psi: -0.3 }], ['Falling', { lam: 1.1, psi: 0.6, phase: 'down', downT: 0.3 }]];
    const cw = w / cells.length, k = Math.min(h / 3.2, cw / 2.4), gy = y + h - 40;
    cells.forEach(([label, o], i) => {
      const cx = x + (i + 0.5) * cw;
      ctx.fillStyle = 'rgba(255,255,255,0.06)'; rrect(ctx, { x: x + i * cw + 3, y, w: cw - 6, h: h - 4 }, 14); ctx.fill();
      drawHoop(ctx, cx - (o.phase === 'down' ? k * 0.5 : 0), gy, k * 1.8 * (o.phase === 'down' ? 0.8 : 1), demoRacer(o), { tape: '#e8472f' });
      txt(ctx, label, cx, y + h - 14, 19, PAL.text, { align: 'center', weight: 600, maxW: cw - 8 });
    });
  } else if (name === 'gate') {
    const cx = x + w / 2, gy = y + h - 30, gw = Math.min(w * 0.7, 460), k = Math.min(h / 3.2, 80);
    ctx.fillStyle = 'rgba(255,255,255,0.06)'; rrect(ctx, { x: x + 4, y, w: w - 8, h: h - 6 }, 14); ctx.fill();
    for (const sg of [-1, 1]) {
      const px = cx + sg * gw / 2;
      for (let j = 0; j < 6; j++) { ctx.fillStyle = j % 2 ? '#fff6e2' : '#d95a3a'; ctx.fillRect(px - 7, gy - (j + 1) * 2.2 * k / 6, 14, 2.2 * k / 6 + 1); }
    }
    ctx.strokeStyle = 'rgba(60,40,20,0.8)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx - gw / 2, gy - 2.2 * k); ctx.quadraticCurveTo(cx, gy - 2.2 * k + 22, cx + gw / 2, gy - 2.2 * k); ctx.stroke();
    ctx.fillStyle = 'rgba(255,211,90,0.28)'; ctx.fillRect(cx - gw * 0.2, gy - 8, gw * 0.4, 16);
    txt(ctx, 'PERFECT', cx, gy - 30, 21, '#ffd35a', { align: 'center', weight: 700 });
    txt(ctx, 'GOOD', cx - gw * 0.34, gy - 30, 19, '#8ff0d6', { align: 'center', weight: 700 });
    txt(ctx, 'GOOD', cx + gw * 0.34, gy - 30, 19, '#8ff0d6', { align: 'center', weight: 700 });
    txt(ctx, 'POST', cx - gw / 2 - 40, gy - 2.2 * k - 14, 18, '#ffb43c', { align: 'center', weight: 700 });
    txt(ctx, 'POST', cx + gw / 2 + 40, gy - 2.2 * k - 14, 18, '#ffb43c', { align: 'center', weight: 700 });
  } else if (name === 'surface') {
    const items = [['Road', '#c99a62'], ['Cobbles', '#9a9486'], ['Mud', '#5e3f24'], ['Planks', '#bd8640'], ['Puddle', '#9fd8ee'], ['Grass', '#6bb347'], ['Water', '#3aa4c6'], ['Kerb', '#d95a3a']];
    const cols = w > 900 ? 8 : 4, rows = Math.ceil(items.length / cols), cw = w / cols, ch = h / rows;
    items.forEach(([label, col], i) => {
      const cx = x + (i % cols + 0.5) * cw, cy = y + Math.floor(i / cols) * ch + ch * 0.4;
      ctx.fillStyle = col; rrect(ctx, { x: cx - cw * 0.3, y: cy - ch * 0.26, w: cw * 0.6, h: ch * 0.5 }, 14); ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.35)'; rrect(ctx, { x: cx - cw * 0.3, y: cy - ch * 0.26, w: cw * 0.6, h: ch * 0.5 }, 14); ctx.stroke();
      txt(ctx, label, cx, cy + ch * 0.4, 20, PAL.text, { align: 'center', weight: 600, maxW: cw - 6 });
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
      ctx.font = `700 ${headF}px ${UI}`; const lines = wrap(ctx, b.h, width);
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
  txt(ctx, doc.title, tx, vp.y - 30, 38, PAL.gold, { align: 'center', font: DISPLAY, weight: 700, maxW: D.viewport.w - 20, stroke: 6 });
  // body
  const vh = doc.nav ? vp.h : (D.nav.back.y + D.nav.back.h) - vp.y;
  const view = { x: vp.x, y: vp.y, w: vp.w, h: vh };
  panel(ctx, view, { fill: 'rgba(8,20,30,0.7)', rad: 22 });
  const padX = 22, innerW = view.w - padX * 2 - 18;
  const key = `${doc.key}|${doc.blocks.length}|${Math.round(innerW)}|${ts}`;
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
      const hint = typeof b.hint === 'function' ? b.hint() : b.hint;
      txt(ctx, b.label, 20, op.y + op.h * (hint ? 0.36 : 0.5), 28 * Math.min(ts, 1.6), PAL.text, { weight: 700, maxW: innerW * 0.52 });
      if (hint) txt(ctx, hint, 20, op.y + op.h * 0.72, 20 * Math.min(ts, 1.6), PAL.dim, { weight: 500, maxW: innerW * 0.55 });
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
        button(ctx, br, (typeof b.btn === 'function' ? b.btn() : b.btn) ?? 'Open', { kind: 'primary', size: 28, noShadow: true });
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
