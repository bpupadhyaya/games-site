// Text screens: Rules (paged), About, How to Play and Settings share one scrolling document renderer with a text-size stepper (to 300%).
// render() records what is tappable in `ui.hits` (rects in screen space); the game's update() reads it on the next tick.
import { v3 } from './v3.js';
import { PAL, UI, DISPLAY, drawPicture, drawDie, drawFeather, drawGoose, drawSheet } from './art.js';
import { txt, wrap, button, panel, rrect, icon } from './ui.js';
import { TEXT_SCALES } from './layout.js';
import { GEESE, ROADS, MAX_FEATHERS } from './engine.js';
import { drawBoard } from './boardview.js';

export const ui = { hits: [] };
export const docMetrics = { max: 0, view: 0 };
const cache = new Map();
const TAU = Math.PI * 2;

// ---- figures: they use the game's own painters ---------------------------------------------------------------------------------------
function figure(ctx, name, x, y, w, h) {
  ctx.save();
  const ink = PAL.ink;
  if (name === 'spiral' || name === 'roads') {
    const s = Math.min(w, h);
    const was = v3.on; v3.on = false;       // the small figure is always the flat engraving
    drawBoard(ctx, { x: x + (w - s) / 2, y, w: s, h: s }, { mini: true, roads: name === 'roads', noSheet: false, t: 0 });
    v3.on = was;
  } else if (name === 'geese') {
    const n = GEESE.length, cols = Math.min(n, w > 700 ? 13 : 7), rows = Math.ceil(n / cols), cw = w / cols, ch = h / rows;
    GEESE.forEach((g, i) => {
      const cx = x + (i % cols + 0.5) * cw, cy = y + Math.floor(i / cols) * ch + ch * 0.42;
      drawGoose(ctx, cx, cy, Math.min(cw * 0.3, ch * 0.34, 34));
      txt(ctx, String(g), cx, cy + Math.min(cw * 0.3, ch * 0.34, 34) + 12, 22, ink, { align: 'center', font: DISPLAY });
    });
  } else if (name === 'specials') {
    const items = [['bridge', 'Bridge', '6 to 12'], ['inn', 'Inn', 'miss a turn'], ['well', 'Well', 'wait'], ['maze', 'Maze', 'back to 30'], ['prison', 'Prison', 'wait'], ['skeleton', 'Skeleton', 'to the start'], ['garden', 'Garden', '63: win']];
    const cols = w > 700 ? 4 : 3, rows = Math.ceil(items.length / cols), cw = w / cols, ch = h / rows;
    items.forEach(([k, label, sub], i) => {
      const cx = x + (i % cols + 0.5) * cw, cy = y + Math.floor(i / cols) * ch + ch * 0.4, s = Math.min(cw * 0.3, ch * 0.3, 54);
      ctx.fillStyle = 'rgba(214,189,138,0.5)'; rrect(ctx, { x: cx - cw * 0.45, y: cy - ch * 0.4, w: cw * 0.9, h: ch * 0.92 }, 12); ctx.fill();
      drawPicture(ctx, k, cx, cy - ch * 0.04, s * 1.5, { t: 0 });
      const ly = y + Math.floor(i / cols) * ch + ch * 0.74;
      txt(ctx, label, cx, ly, 24, ink, { align: 'center', font: DISPLAY, maxW: cw * 0.86 });
      txt(ctx, sub, cx, ly + 26, 20, PAL.sepia, { align: 'center', maxW: cw * 0.86 });
    });
  } else if (name === 'bounce') {
    const seq = [58, 59, 60, 61, 62, 63], cw = Math.min(w / 7, 110), x0 = x + (w - cw * 6) / 2, y0 = y + h * 0.5;
    seq.forEach((n, i) => {
      const cx = x0 + (i + 0.5) * cw;
      ctx.fillStyle = n === 63 ? '#cfe3a6' : '#ecd09a'; rrect(ctx, { x: cx - cw * 0.42, y: y0 - cw * 0.3, w: cw * 0.84, h: cw * 0.6 }, 10); ctx.fill();
      ctx.strokeStyle = ink; ctx.lineWidth = 2; rrect(ctx, { x: cx - cw * 0.42, y: y0 - cw * 0.3, w: cw * 0.84, h: cw * 0.6 }, 10); ctx.stroke();
      txt(ctx, String(n), cx, y0, 26, ink, { align: 'center', font: DISPLAY });
    });
    // from 60: roll 5 -> 61, 62, 63, then back 62, 61
    ctx.strokeStyle = PAL.oxblood; ctx.lineWidth = 4; ctx.beginPath();
    const px = (n) => x0 + (n - 58 + 0.5) * cw;
    ctx.moveTo(px(60), y0 - cw * 0.36); ctx.quadraticCurveTo(px(62), y0 - cw * 1.05, px(63) + cw * 0.1, y0 - cw * 0.36); ctx.stroke();
    ctx.setLineDash([8, 7]); ctx.beginPath(); ctx.moveTo(px(63) - cw * 0.1, y0 + cw * 0.36); ctx.quadraticCurveTo(px(62), y0 + cw * 1.05, px(61), y0 + cw * 0.36); ctx.stroke(); ctx.setLineDash([]);
    txt(ctx, 'throw 5 from 60: forward to 63, then back to 61', x + w / 2, y + h - 10, 21, PAL.sepia, { align: 'center', maxW: w - 20 });
  } else if (name === 'dicechoice') {
    const ds = Math.min(80, h * 0.34), cx = x + w / 2;
    drawDie(ctx, cx - ds * 0.7, y + ds * 0.62, ds, 4, { rot: -0.15 });
    drawDie(ctx, cx + ds * 0.7, y + ds * 0.62, ds, 2, { rot: 0.12 });
    const opts = [['Move 6', 'the total'], ['Move 4', 'one die'], ['Move 2', 'one die']];
    const bw = Math.min(w / 3 - 12, 210), by = y + ds * 1.4 + 18;
    opts.forEach(([a, b], i) => {
      const r = { x: x + w / 2 - bw * 1.5 - 12 + i * (bw + 12), y: by, w: bw, h: 78 };
      ctx.fillStyle = i === 0 ? PAL.oxblood : 'rgba(42,24,9,0.12)'; rrect(ctx, r, 14); ctx.fill();
      ctx.strokeStyle = ink; ctx.lineWidth = 2; rrect(ctx, r, 14); ctx.stroke();
      txt(ctx, a, r.x + r.w / 2, r.y + 28, 28, i === 0 ? '#fff6dc' : ink, { align: 'center', maxW: r.w - 10 });
      txt(ctx, b, r.x + r.w / 2, r.y + 58, 21, i === 0 ? '#f5dca0' : PAL.sepia, { align: 'center', maxW: r.w - 10 });
    });
  } else if (name === 'feather') {
    const n = MAX_FEATHERS, cw = Math.min(w / (n + 1), 120);
    for (let i = 0; i < n; i++) {
      const cx = x + w / 2 + (i - (n - 1) / 2) * cw, cy = y + h * 0.45;
      ctx.fillStyle = 'rgba(214,189,138,0.5)'; ctx.beginPath(); ctx.arc(cx, cy, cw * 0.4, 0, TAU); ctx.fill();
      drawFeather(ctx, cx, cy, cw * 0.28, -0.7);
    }
    txt(ctx, `up to ${MAX_FEATHERS} feathers held`, x + w / 2, y + h - 14, 22, PAL.sepia, { align: 'center' });
  }
  void ROADS; void drawSheet;
  ctx.restore();
}

// ---- layout of blocks into drawable ops --------------------------------------------------------------------------------------------------
function layoutDoc(ctx, blocks, width, ts) {
  const ops = []; let y = 0;
  const bodyF = 27 * ts * 1.08, headF = 34 * ts, lh = bodyF * 1.36;
  for (const b of blocks) {
    if (b.h) {
      y += ops.length ? 22 * ts : 0;
      ctx.font = `700 ${headF}px ${DISPLAY}`; const lines = wrap(ctx, b.h, width);
      ops.push({ t: 'h', y, lines, size: headF, h: lines.length * headF * 1.25 }); y += lines.length * headF * 1.25 + 8 * ts;
    } else if (b.p) {
      ctx.font = `700 ${bodyF}px ${UI}`; const lines = wrap(ctx, b.p, width);
      ops.push({ t: 'p', y, lines, size: bodyF, lh, h: lines.length * lh }); y += lines.length * lh + 12 * ts;
    } else if (b.li) {
      ctx.font = `700 ${bodyF}px ${UI}`; const ind = 34 * ts, lines = wrap(ctx, b.li, width - ind);
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
  txt(ctx, doc.title, tx, vp.y - 30, 36, PAL.goldHi, { align: 'center', font: DISPLAY, maxW: vp.w - 20, stroke: 6 });
  const vh = doc.nav ? vp.h : (D.nav.back.y + D.nav.back.h) - vp.y;
  const view = { x: vp.x, y: vp.y, w: vp.w, h: vh };
  // the page itself: parchment, so the long text is easy on the eyes
  if (v3.on) v3.panels.push({ r: { x: view.x, y: view.y, w: view.w, h: view.h }, rad: 18, kind: 'parch' });
  else {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6;
    ctx.fillStyle = '#efdfb8'; rrect(ctx, view, 18); ctx.fill();
    ctx.restore();
  }
  const padX = 24, innerW = view.w - padX * 2 - 18;
  const key = `${doc.key}|${Math.round(innerW)}|${ts}`;
  let lay = cache.get(key);
  if (!lay) { lay = layoutDoc(ctx, doc.blocks, innerW, ts); if (cache.size > 30) cache.clear(); cache.set(key, lay); }
  const max = Math.max(0, lay.total + 28 - view.h);
  docMetrics.max = max; docMetrics.view = view.h;
  if (st.docRescale) { st.docScroll = st.docFrac * max; st.docRescale = false; }
  const scroll = Math.max(0, Math.min(st.docScroll, max)); st.docScroll = scroll;
  ctx.save(); rrect(ctx, view, 18); ctx.clip();
  const g = ctx.createLinearGradient(view.x, view.y, view.x + view.w, view.y + view.h);
  g.addColorStop(0, 'rgba(255,248,224,0.55)'); g.addColorStop(1, 'rgba(200,164,100,0.35)');
  ctx.fillStyle = g; ctx.fillRect(view.x, view.y, view.w, view.h);
  ctx.translate(view.x + padX, view.y + 18 - scroll);
  for (const op of lay.ops) {
    if (op.y + op.h < scroll - 40 || op.y > scroll + view.h + 40) continue;
    if (op.t === 'h') { ctx.font = `700 ${op.size}px ${DISPLAY}`; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = PAL.oxblood; op.lines.forEach((ln, i) => ctx.fillText(ln, 0, op.y + i * op.size * 1.25)); }
    else if (op.t === 'p') { ctx.font = `700 ${op.size}px ${UI}`; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = PAL.ink; op.lines.forEach((ln, i) => ctx.fillText(ln, 0, op.y + i * op.lh)); }
    else if (op.t === 'li') {
      ctx.font = `700 ${op.size}px ${UI}`; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = PAL.ink;
      ctx.beginPath(); ctx.fillStyle = PAL.oxblood; ctx.arc(10 * ts, op.y + op.lh * 0.5, 5 * ts + 1, 0, TAU); ctx.fill(); ctx.fillStyle = PAL.ink;
      op.lines.forEach((ln, i) => ctx.fillText(ln, op.ind, op.y + i * op.lh));
    } else if (op.t === 'fig') figure(ctx, op.name, 0, op.y, innerW, op.h);
    else if (op.t === 'row') {
      const b = op.b, r = { x: 0, y: op.y, w: innerW, h: op.h };
      ctx.fillStyle = 'rgba(42,24,9,0.1)'; rrect(ctx, r, 16); ctx.fill();
      const room = b.kind === 'button' ? innerW - Math.min(innerW * 0.4, 280) - 56 : innerW * 0.55;     // never run under the row's button
      txt(ctx, b.label, 20, op.y + op.h * (b.hint ? 0.36 : 0.5), 28 * Math.min(ts, 1.6), PAL.ink, { maxW: b.kind === 'button' ? room : innerW * 0.52 });
      if (b.hint) txt(ctx, b.hint, 20, op.y + op.h * 0.72, 20 * Math.min(ts, 1.6), PAL.sepia, { maxW: room });
      const val = b.val?.();
      const sx = view.x + padX, sy = view.y + 18 - scroll;
      const screenR = (rr) => ({ x: sx + rr.x, y: sy + rr.y, w: rr.w, h: rr.h });
      if (b.kind === 'toggle') {
        const tw = 108, th = 52, tr = { x: innerW - tw - 20, y: op.y + (op.h - th) / 2, w: tw, h: th };
        ctx.fillStyle = val ? '#2f7a6e' : 'rgba(42,24,9,0.25)'; rrect(ctx, tr, th / 2); ctx.fill();
        ctx.fillStyle = '#fff6dc'; ctx.beginPath(); ctx.arc(val ? tr.x + tw - th / 2 : tr.x + th / 2, tr.y + th / 2, th / 2 - 5, 0, TAU); ctx.fill();
        ui.hits.push({ id: 'set:' + b.row, r: screenR(r), clip: view });
      } else if (b.kind === 'cycle') {
        txt(ctx, String(val), innerW - 24, op.y + op.h / 2, 28 * Math.min(ts, 1.6), PAL.oxblood, { align: 'right', maxW: innerW * 0.4 });
        ui.hits.push({ id: 'set:' + b.row, r: screenR(r), clip: view });
      } else if (b.kind === 'info') {
        txt(ctx, String(val), innerW - 24, op.y + op.h / 2, 28 * Math.min(ts, 1.6), PAL.oxblood, { align: 'right', maxW: innerW * 0.4 });
      } else if (b.kind === 'button') {
        const bw = Math.min(innerW * 0.4, 280), br = { x: innerW - bw - 20, y: op.y + (op.h - 66) / 2, w: bw, h: 66 };
        const ab = screenR(br), inside = ab.y >= view.y && ab.y + ab.h <= view.y + view.h;
        button(ctx, br, b.btn ?? 'Open', { kind: 'primary', size: 28, noShadow: true, v3rect: inside ? ab : null });
        ui.hits.push({ id: 'set:' + b.row, r: screenR(r), clip: view });
      }
    }
  }
  ctx.restore();
  if (max > 0) {
    const sb = { x: view.x + view.w - 12, y: view.y + 12, w: 6, h: view.h - 24 }, th = Math.max(40, sb.h * view.h / (lay.total + 28));
    ctx.fillStyle = 'rgba(42,24,9,0.12)'; rrect(ctx, sb, 3); ctx.fill();
    ctx.fillStyle = 'rgba(143,42,34,0.7)'; rrect(ctx, { x: sb.x, y: sb.y + (sb.h - th) * (scroll / max), w: sb.w, h: th }, 3); ctx.fill();
  }
  ui.view = view;
  void panel; void icon;
}
