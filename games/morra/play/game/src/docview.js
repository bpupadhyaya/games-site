// Text screens: Rules (paged), About, How to Play and Settings share one scrolling document renderer with a text-size stepper (to 300%).
// render() records what is tappable in `ui.hits` (rects in screen space); the game's update() reads it on the next tick.
import { PAL, UI, DISPLAY, drawHand, extFor, SKINS } from './art.js';
import { txt, wrap, button, panel, rrect } from './ui.js';
import { TEXT_SCALES } from './layout.js';
import { RIVALS, WORDS } from './engine.js';

export const ui = { hits: [] };
export const docMetrics = { max: 0, view: 0 };
const cache = new Map();

const handOf = (n, o = {}) => ({ ext: extFor(n, 1), skin: o.skin ?? 0, sleeve: o.sleeve ?? '#2f5a6a', trim: o.trim ?? '#f2eee2', accent: o.accent, ring: o.ring, bracelet: o.bracelet, pattern: o.pattern, rot: o.rot ?? 0 });

// ---- figures (they use the game's own hands) ----------------------------------------------------------------------------------------------
function figure(ctx, name, x, y, w, h) {
  ctx.save(); ctx.beginPath(); ctx.rect(x - 4, y - 6, w + 8, h + 12); ctx.clip();
  if (name === 'hands') {
    const cell = w / 6, s = Math.min(cell * 0.62, h * 0.52);
    for (let n = 0; n < 6; n++) {
      const cx = x + cell * (n + 0.5);
      drawHand(ctx, cx, y + h - 34 - 0.02 * s, s, handOf(n, { skin: n % 4 }));
      ctx.fillStyle = 'rgba(10,4,16,0.0)';
      txt(ctx, String(n), cx, y + h - 12, 24, PAL.gold, { align: 'center', weight: 800 });
    }
  } else if (name === 'sum') {
    const s = Math.min(w * 0.17, h * 0.42), cy = y + h - 26;
    drawHand(ctx, x + w * 0.18, cy, s, handOf(3, { skin: 1 }));
    drawHand(ctx, x + w * 0.82, cy, s, handOf(4, { skin: 3, sleeve: '#b4343f' }));
    txt(ctx, '3 + 4 = 7', x + w / 2, y + h * 0.3, Math.min(60, w * 0.12), PAL.gold, { align: 'center', font: DISPLAY, weight: 400, stroke: 6, maxW: w * 0.4 });
    txt(ctx, 'sette!', x + w / 2, y + h * 0.62, 30, PAL.text, { align: 'center', weight: 700 });
  } else if (name === 'range') {
    const cell = (w - 20) / 11, ch = Math.min(60, h * 0.4);
    for (let c = 0; c <= 10; c++) {
      const on = c >= 3 && c <= 8, rx = x + 10 + c * cell;
      ctx.fillStyle = on ? '#f0b94a' : 'rgba(255,244,222,0.12)'; rrect(ctx, { x: rx + 2, y: y + 14, w: cell - 4, h: ch }, 10); ctx.fill();
      txt(ctx, String(c), rx + cell / 2, y + 14 + ch / 2, Math.min(28, cell * 0.6), on ? '#2a1608' : PAL.dim, { align: 'center', weight: 800 });
    }
    txt(ctx, 'throw 3: calls 3 to 8', x + w / 2, y + 14 + ch + 40, 24, PAL.text, { align: 'center', weight: 600, maxW: w - 20 });
  } else if (name === 'words') {
    const cols = 4, cell = w / cols, rowH = 40;
    WORDS.forEach((s, i) => {
      const cx = x + cell * ((i % cols) + 0.5), cy = y + 22 + Math.floor(i / cols) * rowH;
      txt(ctx, `${i}  ${s}`, cx, cy, 24, PAL.text, { align: 'center', weight: 600, maxW: cell - 10 });
    });
  } else if (name === 'cases') {
    const rows = [['You say 7, total 7, rival says 5', 'You score 1', PAL.basil], ['You say 6, rival says 7, total 7', 'Rival scores 1', PAL.rose], ['You and the rival both say 7, total 7', 'Nobody scores', PAL.gold], ['You say 4, rival says 9, total 7', 'Nobody scores', PAL.dim]];
    const rh = h / rows.length;
    rows.forEach(([a, b, c], i) => {
      const yy = y + rh * (i + 0.5);
      txt(ctx, a, x + 4, yy, 21, PAL.text, { weight: 500, maxW: w * 0.62 });
      txt(ctx, b, x + w - 4, yy, 22, c, { align: 'right', weight: 800, maxW: w * 0.34 });
    });
  } else if (name === 'rivals') {
    const cell = w / 5, s = Math.min(cell * 0.6, h * 0.4);
    RIVALS.forEach((r, i) => {
      const cx = x + cell * (i + 0.5);
      drawHand(ctx, cx, y + h - 54, s, { ...handOf(i + 1), skin: r.tone, sleeve: r.sleeve, trim: r.trim, accent: r.accent, ring: r.ring, bracelet: r.bracelet, pattern: r.id === 'marco' ? 'stripe' : r.id === 'lucia' ? 'dots' : null });
      txt(ctx, r.name.replace('Il ', '').replace('Don ', '').replace('Nonna ', ''), cx, y + h - 22, 20, PAL.text, { align: 'center', weight: 700, maxW: cell - 6 });
    });
  }
  ctx.restore();
}

// ---- layout of blocks into drawable ops ----------------------------------------------------------------------------------------------------
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
  const tx = vp.x + vp.w / 2;
  txt(ctx, doc.title, tx, vp.y - 30, 38, PAL.gold, { align: 'center', font: DISPLAY, weight: 400, maxW: vp.w - 20, stroke: 6 });
  const vh = doc.nav ? vp.h : (D.nav.back.y + D.nav.back.h) - vp.y;
  const view = { x: vp.x, y: vp.y, w: vp.w, h: vh };
  panel(ctx, view, { fill: 'rgba(22,10,28,0.78)', rad: 22 });
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
      ctx.fillStyle = 'rgba(255,240,220,0.07)'; rrect(ctx, r, 18); ctx.fill();
      const hintText = typeof b.hint === 'function' ? b.hint() : b.hint;
      txt(ctx, b.label, 20, op.y + op.h * (hintText ? 0.36 : 0.5), 28 * Math.min(ts, 1.6), PAL.text, { weight: 700, maxW: innerW * 0.52 });
      if (hintText) txt(ctx, hintText, 20, op.y + op.h * 0.72, 20 * Math.min(ts, 1.6), PAL.dim, { weight: 500, maxW: innerW * 0.55 });
      const val = b.val?.();
      const sx = view.x + padX, sy = view.y + 18 - scroll;
      const screenR = (rr) => ({ x: sx + rr.x, y: sy + rr.y, w: rr.w, h: rr.h });
      if (b.kind === 'toggle') {
        const tw = 108, th = 52, tr = { x: innerW - tw - 20, y: op.y + (op.h - th) / 2, w: tw, h: th };
        ctx.fillStyle = val ? '#4f9a4a' : 'rgba(255,255,255,0.16)'; rrect(ctx, tr, th / 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(val ? tr.x + tw - th / 2 : tr.x + th / 2, tr.y + th / 2, th / 2 - 5, 0, Math.PI * 2); ctx.fill();
        ui.hits.push({ id: 'set:' + b.row, r: screenR(r), clip: view });
      } else if (b.kind === 'cycle') {
        txt(ctx, String(val), innerW - 24, op.y + op.h / 2, 28 * Math.min(ts, 1.6), PAL.gold, { align: 'right', weight: 800, maxW: innerW * 0.4 });
        ui.hits.push({ id: 'set:' + b.row, r: screenR(r), clip: view });
      } else if (b.kind === 'button') {
        const bw = Math.min(innerW * 0.4, 280), br = { x: innerW - bw - 20, y: op.y + (op.h - 66) / 2, w: bw, h: 66 };
        const off = b.disabled?.();
        button(ctx, br, (typeof b.btn === 'function' ? b.btn() : b.btn) ?? 'Open', { kind: off ? 'disabled' : 'primary', size: 28, noShadow: true });
        ui.hits.push({ id: 'set:' + b.row, r: screenR(r), clip: view });
      }
    }
  }
  ctx.restore();
  if (max > 0) {
    const sb = { x: view.x + view.w - 12, y: view.y + 12, w: 6, h: view.h - 24 }, th = Math.max(40, sb.h * view.h / (lay.total + 28));
    ctx.fillStyle = 'rgba(255,240,220,0.12)'; rrect(ctx, sb, 3); ctx.fill();
    ctx.fillStyle = 'rgba(255,200,140,0.7)'; rrect(ctx, { x: sb.x, y: sb.y + (sb.h - th) * (scroll / max), w: sb.w, h: th }, 3); ctx.fill();
  }
  ui.view = view;
}

export { handOf };
