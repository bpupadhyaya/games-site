// Text screens: Rules (paged), About, How to Play and Settings share one scrolling document renderer with a text-size stepper (to 300%).
// render() records what is tappable in `ui.hits` (rects in screen space); the game's update() reads it on the next tick.
import { PAL, UI, DISPLAY, CJK, rgba, mk } from './art.js';
import { txt, wrap, button, panel, rrect, icon, chip } from './ui.js';
import { TEXT_SCALES, host } from './layout.js';
import { LESSONS, TYPES, lessonById, targetPath, CHAR_BOX } from './lessons.js';
import { synthSamples, paintSamples, toneAlpha, BRUSH } from './brush.js';

export const ui = { hits: [] };
export const docMetrics = { max: 0, view: 0 };
const cache = new Map();
const figCache = new Map();

// ---- figures (they paint with the game's own brush) ---------------------------------------------------------------------------------
// Paint samples into g through a scratch canvas so the tone can be applied to the stroke as a whole.
function inkSamples(g, smp, tone, seed) {
  const tmp = mk(g.canvas.width, g.canvas.height);
  if (!tmp) return;
  const t = tmp.getContext('2d'); t.setTransform(g.getTransform()); paintSamples(t, smp, 1, seed);
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = toneAlpha(tone); g.drawImage(tmp, 0, 0); g.restore();
}
function inkInto(g, lesson, idx, ox, oy, k, o = {}) {           // paint model stroke idx of a lesson at offset/scale into g
  const P = targetPath(lesson, idx).map((p) => [ox + (p[0] - lesson.box.x) * k, oy + (p[1] - lesson.box.y) * k]);
  inkSamples(g, synthSamples(P, lesson.strokes[idx].type, lesson.base * k, o), o.tone ?? 0.95, idx * 5);
}
function paperTile(g, x, y, w, h) {
  const gr = g.createLinearGradient(x, y, x + w, y + h); gr.addColorStop(0, '#f3ead3'); gr.addColorStop(1, '#e6d9bb');
  g.fillStyle = gr; g.beginPath(); g.roundRect(x, y, w, h, 6); g.fill();
}
function buildFigure(name, w, h) {
  const S = 2, c = mk(w * S, h * S);
  if (!c) return null;
  const g = c.getContext('2d'); g.scale(S, S);
  if (name === 'types') {
    const ids = ['heng', 'shu', 'dian', 'pie', 'na', 'gou'], cell = w / 6, tile = Math.min(cell - 10, h - 52);
    ids.forEach((id, i) => { const x = i * cell + (cell - tile) / 2; paperTile(g, x, 0, tile, tile); inkInto(g, lessonById(id), 0, x, 0, tile / CHAR_BOX.w); });
  } else if (name === 'tones') {
    const tw = (w - 24) / 3, th = h - 40;
    [0.95, 0.52, 0.2].forEach((d, i) => { const x = i * (tw + 12); paperTile(g, x, 0, tw, th); inkSamples(g, synthSamples([[x + tw * 0.1, th / 2], [x + tw * 0.9, th / 2]], 'heng', 30, {}), d, i); });
  } else if (name === 'envelope') {
    const th = h - 56; paperTile(g, 0, 0, w, th);
    inkSamples(g, synthSamples([[w * 0.05, th / 2], [w * 0.95, th / 2]], 'heng', 36, {}), 0.95, 4);
  } else if (name === 'dry') {
    paperTile(g, 0, 0, w, h);
    [0.5, 0.2, 0.0].forEach((lo, i) => {
      const y = (h / 3) * (i + 0.5), smp = synthSamples([[w * 0.06, y], [w * 0.94, y]], 'heng', 34, {});
      smp.forEach((q, j) => { q.l = Math.max(0, (1 - j / smp.length) * (lo * 1.6 + (i === 0 ? 0.25 : 0))); });
      inkSamples(g, smp, 0.95, i * 9);
    });
  } else if (name === 'order') {
    const L = lessonById('da'), tile = Math.min(h, w * 0.5), k = tile / CHAR_BOX.w, ox = (w - tile) / 2;
    paperTile(g, ox, 0, tile, tile);
    L.strokes.forEach((_, i) => inkInto(g, L, i, ox, 0, k));
  }
  return c;
}

function figure(ctx, name, x, y, w, h) {
  const key = `${name}|${Math.round(w)}x${Math.round(h)}`;
  let img = figCache.get(key);
  if (img === undefined) { img = buildFigure(name, Math.round(w), Math.round(h)); if (figCache.size > 12) figCache.clear(); figCache.set(key, img); }
  if (img) ctx.drawImage(img, x, y, w, h);
  ctx.save();
  if (name === 'types') {
    const ids = ['heng', 'shu', 'dian', 'pie', 'na', 'gou'], cell = w / 6;
    ids.forEach((id, i) => { const t = TYPES[id]; txt(ctx, `${t.cn}`, x + cell * (i + 0.5), y + h - 34, 26, PAL.gold, { align: 'center', font: CJK, weight: 700 }); txt(ctx, t.name, x + cell * (i + 0.5), y + h - 10, 17, PAL.text, { align: 'center', weight: 600, maxW: cell - 4 }); });
  } else if (name === 'tones') {
    const tw = (w - 24) / 3;
    ['Dark', 'Mid', 'Pale'].forEach((n, i) => txt(ctx, n, x + i * (tw + 12) + tw / 2, y + h - 18, 24, PAL.text, { align: 'center', weight: 700 }));
  } else if (name === 'envelope') {
    ['press', 'glide', 'gather'].forEach((n, i) => txt(ctx, n, x + w * [0.1, 0.5, 0.9][i], y + h - 36, 24, PAL.gold, { align: 'center', weight: 700 }));
    txt(ctx, 'heavy, even, heavy again, then lift', x + w / 2, y + h - 10, 20, PAL.dim, { align: 'center', weight: 500, maxW: w });
  } else if (name === 'order') {
    const L = lessonById('da'), tile = Math.min(h, w * 0.5), k = tile / CHAR_BOX.w, ox = x + (w - tile) / 2;
    L.strokes.forEach((st, i) => { const p = targetPath(L, i)[0], px = ox + (p[0] - L.box.x) * k, py = y + (p[1] - L.box.y) * k; ctx.fillStyle = PAL.cinnabar; ctx.beginPath(); ctx.arc(px, py, 14, 0, Math.PI * 2); ctx.fill(); txt(ctx, String(i + 1), px, py + 1, 18, '#fff', { align: 'center', weight: 800 }); });
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
  panel(ctx, view, { fill: 'rgba(10,18,20,0.7)', rad: 22 });
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
      ctx.beginPath(); ctx.fillStyle = PAL.cinnabarHi; ctx.arc(10 * ts, op.y + op.lh * 0.5, 5 * ts + 1, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = PAL.text;
      op.lines.forEach((ln, i) => ctx.fillText(ln, op.ind, op.y + i * op.lh));
    } else if (op.t === 'fig') figure(ctx, op.name, 0, op.y, innerW, op.h);
    else if (op.t === 'row') {
      const b = op.b, r = { x: 0, y: op.y, w: innerW, h: op.h };
      ctx.fillStyle = 'rgba(244,236,216,0.07)'; rrect(ctx, r, 18); ctx.fill();
      txt(ctx, b.label, 20, op.y + op.h * (b.hint ? 0.36 : 0.5), 28 * Math.min(ts, 1.6), PAL.text, { weight: 700, maxW: innerW * 0.52 });
      if (b.hint) txt(ctx, b.hint, 20, op.y + op.h * 0.72, 20 * Math.min(ts, 1.6), PAL.dim, { weight: 500, maxW: innerW * 0.55 });
      const val = b.val?.();
      const sx = view.x + padX, sy = view.y + 18 - scroll;
      const screenR = (rr) => ({ x: sx + rr.x, y: sy + rr.y, w: rr.w, h: rr.h });
      if (b.kind === 'toggle') {
        const tw = 108, th = 52, tr = { x: innerW - tw - 20, y: op.y + (op.h - th) / 2, w: tw, h: th };
        ctx.fillStyle = val ? '#2f9c82' : 'rgba(255,255,255,0.16)'; rrect(ctx, tr, th / 2); ctx.fill();
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
    ctx.fillStyle = 'rgba(244,236,216,0.12)'; rrect(ctx, sb, 3); ctx.fill();
    ctx.fillStyle = 'rgba(236,208,138,0.7)'; rrect(ctx, { x: sb.x, y: sb.y + (sb.h - th) * (scroll / max), w: sb.w, h: th }, 3); ctx.fill();
  }
  ui.view = view;
}
