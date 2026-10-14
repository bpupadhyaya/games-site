// Text screens: Rules (paged), About, How to Play and Settings share one scrolling document renderer with a text-size stepper (to 300%).
// render() records what is tappable in `ui.hits` (rects in screen space); the game's update() reads it on the next tick.
import { PAL, UI, DISPLAY, drawShipSide, drawGood, drawIsland, drawSea, drawPortMarker } from './art.js';
import { GOODS, PORTS, edges, pointOfSail, shipSpec } from './engine.js';
import { txt, wrap, button, panel, rrect } from './ui.js';
import { TEXT_SCALES, mapXform } from './layout.js';

export const ui = { hits: [] };
export const docMetrics = { max: 0, view: 0 };
const cache = new Map();

// ---- figures (they use the game's own painters) ---------------------------------------------------------------------------------------
function figure(ctx, name, x, y, w, h) {
  ctx.save();
  if (name === 'ship') {
    drawShipSide(ctx, x + w / 2, y + h * 0.4, Math.min(w * 0.8, h * 1.7), shipSpec({ size: 'pinisi', timber: 'teak', rig: 'balanced' }, 0.8), 1, 1, 0);
  } else if (name === 'goods') {
    const n = GOODS.length, rx = Math.min(w / n * 0.4, (h - 74) / 1.6);
    GOODS.forEach((g, i) => {
      const cx = x + w * (i + 0.5) / n;
      drawGood(ctx, g.id, cx, y + h * 0.36, rx * 1.4);
      txt(ctx, g.name, cx, y + h - (i % 2 ? 12 : 38), 22, PAL.text, { align: 'center', weight: 700, maxW: w / n * 1.9 });
    });
  } else if (name === 'points') {
    const bw = Math.min(w - 20, 640), bx = x + (w - bw) / 2, base = y + h - 40, mh = h - 90;
    ctx.fillStyle = 'rgba(255,255,255,0.06)'; rrect(ctx, { x: bx - 8, y: y + 6, w: bw + 16, h: h - 12 }, 14); ctx.fill();
    const n = 13;
    for (let i = 0; i < n; i++) {
      const a = i / (n - 1) * Math.PI, v = pointOfSail(a), cx = bx + 20 + (bw - 40) * i / (n - 1);
      ctx.fillStyle = v > 0.9 ? PAL.gold : v > 0.6 ? '#7fd0c6' : PAL.coral;
      rrect(ctx, { x: cx - bw / n * 0.3, y: base - mh * v, w: bw / n * 0.6, h: mh * v }, 6); ctx.fill();
    }
    txt(ctx, 'wind astern', bx + 40, y + h - 14, 20, PAL.dim, { weight: 600, align: 'center' });
    txt(ctx, 'wind on the beam', bx + bw / 2, y + h - 14, 20, PAL.dim, { weight: 600, align: 'center' });
    txt(ctx, 'into the wind', bx + bw - 50, y + h - 14, 20, PAL.dim, { weight: 600, align: 'center' });
  } else if (name === 'chart') {
    const s = Math.min(w, h) , map = { x: x + (w - s) / 2, y, w: s, h: s }, X = mapXform(map, 0.06);
    ctx.save(); rrect(ctx, map, 18); ctx.clip();
    drawSea(ctx, map, 0, null, true);
    for (const e of edges) { const a = X.to(PORTS[e.a].x, PORTS[e.a].y), b = X.to(PORTS[e.b].x, PORTS[e.b].y); ctx.strokeStyle = 'rgba(248,239,214,0.5)'; ctx.lineWidth = 2; ctx.setLineDash([2, 8]); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.setLineDash([]); }
    PORTS.forEach((p, i) => {
      const q = X.to(p.x, p.y); drawIsland(ctx, q.x, q.y, p.r * X.s * 0.9, 3 + i * 7 + PORTS.length, 0, p.id === 'ternate');
      drawPortMarker(ctx, q.x, q.y, Math.max(6, s * 0.014), { yard: p.yard });
      txt(ctx, p.name, q.x, q.y + p.r * X.s * 1.6 + 6, Math.max(15, s * 0.034), PAL.text, { align: 'center', weight: 800, stroke: 4 });
    });
    ctx.restore();
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
  const D = L.doc, ts = TEXT_SCALES[st.prefs.textIdx] ?? 1, vp = doc.nav ? D.viewportNav : D.viewport;
  ui.hits = [];
  // header
  button(ctx, D.back, 'Back', { icon: 'back', kind: 'ghost', size: 28 });
  ui.hits.push({ id: 'back', r: D.back });
  button(ctx, D.textDec, 'A-', { kind: st.prefs.textIdx > 0 ? 'quiet' : 'disabled', size: 28 }); ui.hits.push({ id: 'textDec', r: D.textDec });
  button(ctx, D.textInc, 'A+', { kind: st.prefs.textIdx < TEXT_SCALES.length - 1 ? 'quiet' : 'disabled', size: 28 }); ui.hits.push({ id: 'textInc', r: D.textInc });
  if (doc.nav) { button(ctx, D.nav.back, 'Previous', { icon: 'back', kind: doc.page > 0 ? 'quiet' : 'disabled', size: 28 }); button(ctx, D.nav.next, doc.page < doc.pages - 1 ? 'Next' : 'Done', { kind: 'primary', size: 28 }); ui.hits.push({ id: 'prev', r: D.nav.back }, { id: 'next', r: D.nav.next }); }
  // title
  const tx = D.viewport.x + D.viewport.w / 2;
  txt(ctx, doc.title, tx, vp.y - 32, 42, PAL.gold, { align: 'center', font: DISPLAY, weight: 700, maxW: D.viewport.w - 20, stroke: 6 });
  // body
  const vh = vp.h;
  const view = { x: vp.x, y: vp.y, w: vp.w, h: vh };
  panel(ctx, view, { fill: 'rgba(4,22,32,0.72)', rad: 22 });
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
      ctx.beginPath(); ctx.fillStyle = PAL.coral; ctx.arc(10 * ts, op.y + op.lh * 0.5, 5 * ts + 1, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = PAL.text;
      op.lines.forEach((ln, i) => ctx.fillText(ln, op.ind, op.y + i * op.lh));
    } else if (op.t === 'fig') figure(ctx, op.name, 0, op.y, innerW, op.h);
    else if (op.t === 'row') {
      const b = op.b, r = { x: 0, y: op.y, w: innerW, h: op.h };
      ctx.fillStyle = 'rgba(235,250,245,0.07)'; rrect(ctx, r, 18); ctx.fill();
      const ctrlW = b.kind === 'stepper' ? 340 : b.kind === 'button' ? Math.min(innerW * 0.4, 280) + 30 : b.kind === 'toggle' ? 140 : b.kind === 'cycle' ? innerW * 0.4 : 0;
      const textW = Math.max(innerW * 0.3, innerW - ctrlW - 36);
      txt(ctx, b.label, 20, op.y + op.h * (b.hint ? 0.36 : 0.5), 28 * Math.min(ts, 1.6), PAL.text, { weight: 700, maxW: textW });
      if (b.hint) txt(ctx, b.hint, 20, op.y + op.h * 0.72, 20 * Math.min(ts, 1.6), PAL.dim, { weight: 500, maxW: textW });
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
        button(ctx, br, b.btn ?? 'Open', { kind: b.disabled ? 'disabled' : 'primary', size: 28, noShadow: true });
        if (!b.disabled) ui.hits.push({ id: 'set:' + b.row, r: screenR(r), clip: view });
      }
    }
  }
  ctx.restore();
  // scrollbar
  if (max > 0) {
    const sb = { x: view.x + view.w - 12, y: view.y + 12, w: 6, h: view.h - 24 }, th = Math.max(40, sb.h * view.h / (lay.total + 28));
    ctx.fillStyle = 'rgba(235,250,245,0.12)'; rrect(ctx, sb, 3); ctx.fill();
    ctx.fillStyle = 'rgba(242,198,90,0.75)'; rrect(ctx, { x: sb.x, y: sb.y + (sb.h - th) * (scroll / max), w: sb.w, h: th }, 3); ctx.fill();
  }
  ui.view = view;
}
