// Text screens: Rules (paged), About, How to Play and Settings share one scrolling document renderer with a text-size stepper (to 300%).
// render() records what is tappable in `ui.hits` (rects in screen space); the game's update() reads it on the next tick.
import { PAL, UI, DISPLAY, rgba, drawPot2D, drawFinger } from './art.js';
import { txt, wrap, button, panel, rrect } from './ui.js';
import { TEXT_SCALES, host } from './layout.js';
import { potFromOutline, N } from './sim.js';
import { brandGradient } from './brand.js';

export const ui = { hits: [] };
export const docMetrics = { max: 0, view: 0 };
const cache = new Map();

// ---- figures (they use the game's own pot painter) ------------------------------------------------------------------------------
const vase = (k = 1) => potFromOutline((y) => 0.62 + 0.38 * Math.sin(Math.min(1, y / 2.4) * Math.PI * 0.9) * k, 2.6, 0.2, 0.2);
function figure(ctx, name, x, y, w, h) {
  ctx.save();
  const sc = Math.min(h / 3.4, w / 5), cx = x + w / 2, by = y + h - 14;
  const lab = (s, px, py, al = 'center', col = PAL.gold) => txt(ctx, s, px, py, 22, col, { align: al, weight: 700 });
  if (name === 'layers') {
    const pot = vase(), s2 = Math.min(h / 3.1, w / 6);
    drawPot2D(ctx, pot, null, cx - w * 0.18, by, s2, { wet: true });
    ctx.strokeStyle = 'rgba(255,240,220,0.35)'; ctx.lineWidth = 1.2;
    for (let i = 0; i < N; i += 4) { const yy = by - pot.y0[i] * s2; ctx.beginPath(); ctx.moveTo(cx - w * 0.18 - pot.Ro[i] * s2, yy); ctx.lineTo(cx - w * 0.18 + pot.Ro[i] * s2, yy); ctx.stroke(); }
    const i = 24, yy = by - pot.yc[i] * s2, xo = cx - w * 0.18 + pot.Ro[i] * s2, xi = cx - w * 0.18 + pot.Ri[i] * s2;
    ctx.strokeStyle = PAL.terraHi; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(xi, yy); ctx.lineTo(xo, yy); ctx.stroke();
    lab('outer radius', cx + w * 0.02, yy - 26, 'left'); lab('inner radius', cx + w * 0.02, yy, 'left'); lab('one layer: height h, volume kept', cx + w * 0.02, yy + 28, 'left', PAL.text);
  } else if (name === 'centre') {
    const pot = potFromOutline((yy) => 1 - 0.0 * yy, 1.2, 0.2, 2); for (let i = 0; i < N; i++) pot.Ri[i] = 0;
    drawPot2D(ctx, pot, null, cx - w * 0.1, by, sc * 1.2, { wet: true, rim: false });
    drawPot2D(ctx, pot, null, cx - w * 0.1 + 0.3 * sc * 1.2, by, sc * 1.2, { wet: true, rim: false, shadow: false, color: '#ffffff' });
    drawFinger(ctx, cx - w * 0.1 + 1.0 * sc * 1.2, by - 0.6 * sc * 1.2, -1, 18, 0.6);
    lab('hold steady on the swinging side', cx, y + 22);
  } else if (name === 'open') {
    const pot = vase(); drawPot2D(ctx, pot, null, cx, by, sc, { wet: true });
    drawFinger(ctx, cx + 0.05 * sc, by - 2.4 * sc, -1, 14, 0.4);
    lab('press down, then draw outwards', cx, y + 22);
  } else if (name === 'pull') {
    const pot = vase(); drawPot2D(ctx, pot, null, cx, by, sc, { wet: true });
    drawFinger(ctx, cx + pot.Ro[20] * sc - 8, by - pot.yc[20] * sc, 1, 14, 0.6);
    ctx.strokeStyle = PAL.terraHi; ctx.lineWidth = 4; ctx.setLineDash([2, 10]); ctx.beginPath(); ctx.moveTo(cx + pot.Ro[20] * sc + 36, by - pot.yc[20] * sc); ctx.lineTo(cx + pot.Ro[34] * sc + 36, by - pot.yc[34] * sc); ctx.stroke(); ctx.setLineDash([]);
    lab('slide up while pressing in', cx, y + 22);
  } else if (name === 'shape') {
    const pot = vase(); drawPot2D(ctx, pot, null, cx, by, sc, { wet: true });
    drawFinger(ctx, cx + pot.Ro[22] * sc - 10, by - pot.yc[22] * sc, -1, 14, 0.5);
    ctx.strokeStyle = PAL.terraHi; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(cx + pot.Ro[22] * sc, by - pot.yc[22] * sc); ctx.lineTo(cx + pot.Ro[22] * sc + 40, by - pot.yc[22] * sc); ctx.stroke();
    lab('out for a belly, in for a neck', cx, y + 22);
  } else if (name === 'bands') {
    const pot = vase(), g = { trad: 2, base: 0, acc: 0, bands: [{ y: 0.7, half: 0.16, motif: 'waves', acc: 0 }, { y: 1.6, half: 0.2, motif: 'scroll', acc: 0 }] };
    drawPot2D(ctx, pot, g, cx - w * 0.2, by, sc, {});
    const g2 = { trad: 3, base: 0, acc: 0, bands: [{ y: 1.0, half: 0.22, motif: 'zigzag', acc: 0 }] };
    drawPot2D(ctx, pot, g2, cx + w * 0.2, by, sc, {});
    lab('bands of colour and pattern', cx, y + 22);
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
  panel(ctx, view, { fill: 'rgba(24,16,12,0.7)', rad: 22 });
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
      txt(ctx, b.label, 20, op.y + op.h * (b.hint ? 0.36 : 0.5), 28 * Math.min(ts, 1.6), PAL.text, { weight: 700, maxW: innerW * 0.52 });
      if (b.hint) txt(ctx, b.hint, 20, op.y + op.h * 0.72, 20 * Math.min(ts, 1.6), PAL.dim, { weight: 500, maxW: innerW * 0.55 });
      const val = b.val?.();
      const sx = view.x + padX, sy = view.y + 18 - scroll;
      const screenR = (rr) => ({ x: sx + rr.x, y: sy + rr.y, w: rr.w, h: rr.h });
      if (b.kind === 'toggle') {
        const tw = 108, th = 52, tr = { x: innerW - tw - 20, y: op.y + (op.h - th) / 2, w: tw, h: th };
        ctx.fillStyle = val ? '#49b5a4' : 'rgba(255,255,255,0.16)'; rrect(ctx, tr, th / 2); ctx.fill();
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
    ctx.fillStyle = 'rgba(243,201,132,0.7)'; rrect(ctx, { x: sb.x, y: sb.y + (sb.h - th) * (scroll / max), w: sb.w, h: th }, 3); ctx.fill();
  }
  ui.view = view;
}
