// Text screens: Rules (paged), About, How to Play and Settings share one scrolling document renderer with a text-size stepper (to 300%).
// render() records what is tappable in `ui.hits` (rects in screen space); the game's update() reads it on the next tick.
import { PAL, UI, DISPLAY, WRAPS, drawLyre, drawCue, drawStrumCue, drawDampCue } from './art.js';
import { txt, wrap, button, panel, rrect } from './ui.js';
import { TEXT_SCALES, lyreFor } from './layout.js';
import { STRING_COUNT, QENETS, soundName, DUEL } from './music.js';

export const ui = { hits: [] };
export const docMetrics = { max: 0, view: 0 };
const cache = new Map();

// ---- figures (they use the game's own painters) ------------------------------------------------------------------------------------------
function figure(ctx, name, x, y, w, h) {
  ctx.save();
  if (name === 'instrument') {
    const G = lyreFor(x + w * 0.2, y + 4, w * 0.6, h - 8);
    drawLyre(ctx, G, { t: 0, labels: [1, 2, 3, 4, 5, 6].map((k) => soundName(k, 0)) });
    const lab = (s, px, py, al) => txt(ctx, s, px, py, 22, PAL.dim, { align: al, weight: 600 });
    lab('crossbar and wraps', x + w - 8, G.barY, 'right'); lab('strings', x + 8, G.pluckY + 40, 'left'); lab('bridge', x + w - 8, G.bridgeY, 'right'); lab('hide-covered bowl', x + w - 8, G.bowlCy + G.ry * 0.5, 'right'); lab('arm', x + 8, (G.barY + G.bowlCy) / 2, 'left');
  } else if (name === 'modes') {
    const rows = QENETS.length, rh = h / rows;
    QENETS.forEach((q, i) => {
      const yy = y + i * rh + rh / 2;
      txt(ctx, q.name, x, yy, 24, PAL.gold, { weight: 800, maxW: w * 0.34 });
      for (let k = 1; k <= 6; k++) {
        const cx = x + w * 0.42 + (k - 1) * (w * 0.58 / 6) + w * 0.03;
        ctx.fillStyle = WRAPS[k - 1]; ctx.beginPath(); ctx.arc(cx, yy, Math.min(rh * 0.36, 22), 0, Math.PI * 2); ctx.fill();
        txt(ctx, soundName(k, i), cx, yy + 1, Math.min(18, rh * 0.32), '#14100a', { align: 'center', weight: 800 });
      }
    });
  } else if (name === 'cues') {
    const cell = w / 4, cy = y + h * 0.4, r = Math.min(cell * 0.2, 36);
    drawCue(ctx, x + cell * 0.5, cy, r, 0.7, 'p');
    drawCue(ctx, x + cell * 1.5, cy, r, 0.7, 'soft');
    drawStrumCue(ctx, x + cell * 2.3, x + cell * 2.7, cy, r * 0.7, 0.9);
    drawDampCue(ctx, x + cell * 3.5, cy, r, 0.9);
    ['pluck', 'soft pluck', 'strum', 'damp'].forEach((s, i) => txt(ctx, s, x + cell * (i + 0.5), y + h - 24, 22, PAL.text, { align: 'center', weight: 600 }));
  } else if (name === 'layers') {
    const names = ['Base layer', 'Layer 1', 'Layer 2', 'Layer 3'], rowH = h / 4;
    names.forEach((n, i) => {
      const yy = y + i * rowH + rowH / 2, on = i <= 2;
      ctx.fillStyle = on ? 'rgba(70,178,122,0.34)' : 'rgba(255,255,255,0.06)'; rrect(ctx, { x: x + 130, y: yy - rowH * 0.32, w: w - 130, h: rowH * 0.64 }, 10); ctx.fill();
      txt(ctx, n, x, yy, 22, on ? PAL.text : PAL.dim, { weight: 600 });
      for (let b = 0; b < 12; b++) { if ((b * 5 + i * 3) % (i === 0 ? 3 : 4) < 2 || i === 0) { ctx.fillStyle = on ? '#a8f0d4' : 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.arc(x + 160 + b * ((w - 190) / 11), yy, 5, 0, Math.PI * 2); ctx.fill(); } }
    });
  } else if (name === 'duel') {
    const n = DUEL.lives;
    txt(ctx, 'Round 3 of ' + DUEL.rounds, x, y + 26, 26, PAL.gold, { weight: 800 });
    for (let i = 0; i < n; i++) { ctx.fillStyle = i < 2 ? PAL.coral : 'rgba(255,255,255,0.15)'; ctx.beginPath(); ctx.arc(x + w - 30 - i * 56, y + 26, 20, 0, Math.PI * 2); ctx.fill(); }
    const cx0 = x + w * 0.08, step = w * 0.84 / 4;
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = WRAPS[(i * 2) % 6]; ctx.beginPath(); ctx.arc(cx0 + i * step, y + h * 0.58, 26, 0, Math.PI * 2); ctx.fill();
      txt(ctx, String(1 + (i * 2) % 6), cx0 + i * step, y + h * 0.58, 24, '#14100a', { align: 'center', weight: 800 });
    }
    txt(ctx, 'listen, then answer without rings', x + w / 2, y + h - 22, 22, PAL.dim, { align: 'center', weight: 600 });
  } else if (name === 'compose') {
    const cols = 12, rows = 6, cw = w / cols, rh = (h - 10) / rows;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const on = (c * 5 + r * 7) % 9 === 0;
      ctx.fillStyle = on ? WRAPS[5 - r] : 'rgba(255,255,255,0.08)'; rrect(ctx, { x: x + c * cw + 2, y: y + r * rh + 2, w: cw - 4, h: rh - 4 }, 6); ctx.fill();
    }
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
  button(ctx, D.back, 'Back', { icon: 'back', kind: 'ghost', size: 28 });
  ui.hits.push({ id: 'back', r: D.back });
  button(ctx, D.textDec, 'A-', { kind: st.prefs.textIdx > 0 ? 'quiet' : 'disabled', size: 28 }); ui.hits.push({ id: 'textDec', r: D.textDec });
  button(ctx, D.textInc, 'A+', { kind: st.prefs.textIdx < TEXT_SCALES.length - 1 ? 'quiet' : 'disabled', size: 28 }); ui.hits.push({ id: 'textInc', r: D.textInc });
  if (doc.nav) { button(ctx, D.nav.back, 'Previous', { icon: 'back', kind: doc.page > 0 ? 'quiet' : 'disabled', size: 28 }); button(ctx, D.nav.next, doc.page < doc.pages - 1 ? 'Next' : 'Done', { kind: 'primary', size: 28 }); ui.hits.push({ id: 'prev', r: D.nav.back }, { id: 'next', r: D.nav.next }); }
  const tx = D.viewport.x + D.viewport.w / 2;
  txt(ctx, doc.title, tx, vp.y - 30, 34, PAL.gold, { align: 'center', font: DISPLAY, weight: 400, maxW: D.viewport.w - 20, stroke: 6 });
  const vh = doc.nav ? vp.h : (D.nav.back.y + D.nav.back.h) - vp.y;
  const view = { x: vp.x, y: vp.y, w: vp.w, h: vh };
  panel(ctx, view, { fill: 'rgba(4,26,24,0.78)', rad: 22 });
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
      ctx.beginPath(); ctx.fillStyle = PAL.saffron; ctx.arc(10 * ts, op.y + op.lh * 0.5, 5 * ts + 1, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = PAL.text;
      op.lines.forEach((ln, i) => ctx.fillText(ln, op.ind, op.y + i * op.lh));
    } else if (op.t === 'fig') figure(ctx, op.name, 0, op.y, innerW, op.h);
    else if (op.t === 'row') {
      const b = op.b, r = { x: 0, y: op.y, w: innerW, h: op.h };
      ctx.fillStyle = 'rgba(255,247,230,0.07)'; rrect(ctx, r, 18); ctx.fill();
      txt(ctx, b.label, 20, op.y + op.h * (b.hint ? 0.36 : 0.5), 28 * Math.min(ts, 1.6), PAL.text, { weight: 700, maxW: innerW * 0.52 });
      if (b.hint) txt(ctx, b.hint, 20, op.y + op.h * 0.72, 20 * Math.min(ts, 1.6), PAL.dim, { weight: 500, maxW: innerW * 0.55 });
      const val = b.val?.();
      const sx = view.x + padX, sy = view.y + 18 - scroll;
      const screenR = (rr) => ({ x: sx + rr.x, y: sy + rr.y, w: rr.w, h: rr.h });
      if (b.kind === 'toggle') {
        const tw = 108, th = 52, tr = { x: innerW - tw - 20, y: op.y + (op.h - th) / 2, w: tw, h: th };
        ctx.fillStyle = val ? '#46b27a' : 'rgba(255,255,255,0.16)'; rrect(ctx, tr, th / 2); ctx.fill();
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
  if (max > 0) {
    const sb = { x: view.x + view.w - 12, y: view.y + 12, w: 6, h: view.h - 24 }, th = Math.max(40, sb.h * view.h / (lay.total + 28));
    ctx.fillStyle = 'rgba(255,247,230,0.12)'; rrect(ctx, sb, 3); ctx.fill();
    ctx.fillStyle = 'rgba(255,205,110,0.75)'; rrect(ctx, { x: sb.x, y: sb.y + (sb.h - th) * (scroll / max), w: sb.w, h: th }, 3); ctx.fill();
  }
  ui.view = view;
}
void STRING_COUNT;
