// Text screens: Rules (paged), About, How to Play and Settings share one scrolling document renderer with a text-size stepper (to 300%).
// render() records what is tappable in `ui.hits` (rects in screen space); the game's update() reads it on the next tick.
import { PAL, UI, DISPLAY, drawKeyboard, drawBellowsPad, drawCaja, drawGuacharaca, drawAccNote, drawCajaNote, drawGuaNote, drawPartIcon } from './art.js';
import { txt, wrap, button, panel, rrect } from './ui.js';
import { TEXT_SCALES } from './layout.js';
import { accGeom, cajaGeom, guaGeom } from './layout.js';
import { PART, PARTS } from './music.js';

export const ui = { hits: [] };
export const docMetrics = { max: 0, view: 0 };
const cache = new Map();

// ---- figures (they use the game's own painters) --------------------------------------------------------------------------------------
function figure(ctx, name, x, y, w, h) {
  ctx.save();
  if (name === 'seats') {
    const cw = w / 3, lines = { gua: 'keeps the pulse', caja: 'anchors the beat', acc: 'sings the tune' };
    PARTS.forEach((p, i) => {
      const cx = x + cw * (i + 0.5);
      ctx.fillStyle = 'rgba(255,244,224,0.07)'; rrect(ctx, { x: cx - cw * 0.46, y: y + 4, w: cw * 0.92, h: h - 8 }, 18); ctx.fill();
      drawPartIcon(ctx, p, cx, y + h * 0.36, Math.min(cw * 0.2, h * 0.24), PART[p].col);
      txt(ctx, PART[p].name, cx, y + h * 0.68, Math.min(26, cw * 0.17), PAL.text, { align: 'center', weight: 800, maxW: cw * 0.88 });
      txt(ctx, lines[p], cx, y + h * 0.85, Math.min(20, cw * 0.14), PAL.dim, { align: 'center', weight: 600, maxW: cw * 0.88 });
    });
  } else if (name === 'keys') {
    const G = accGeom({ x, y, w, h: h + 150 });
    const g2 = { ...G, panel: { x, y, w, h }, btns: G.btns.map((b) => ({ ...b, cy: y + h / 2, r: Math.min(b.r, h * 0.3) })) };
    drawKeyboard(ctx, g2, { flash: [], pull: false, want: -1 }, 0);
  } else if (name === 'bellows') {
    const hw = (w - 20) / 2;
    drawBellowsPad(ctx, { x, y, w: hw, h }, { pull: 0, held: false, hint: null }, 0);
    drawBellowsPad(ctx, { x: x + hw + 20, y, w: hw, h }, { pull: 1, held: true, hint: null }, 0);
    txt(ctx, 'PUSH (released)', x + hw / 2, y + h * 0.5, 26, '#fff', { align: 'center', weight: 800, stroke: 6 });
    txt(ctx, 'PULL (held)', x + hw + 20 + hw / 2, y + h * 0.5, 26, '#fff', { align: 'center', weight: 800, stroke: 6 });
  } else if (name === 'caja') {
    const G = cajaGeom({ x, y, w, h });
    drawCaja(ctx, G, { tum: 0.6, tak: 0 }, 0);
  } else if (name === 'gua') {
    const G = guaGeom({ x, y, w, h });
    drawGuacharaca(ctx, G, { fork: -0.3, lean: -0.5, glow: 1, trail: [] }, 0);
  } else if (name === 'ribbon') {
    ctx.fillStyle = 'rgba(5,24,30,0.7)'; rrect(ctx, { x, y, w, h }, 16); ctx.fill();
    const px = x + w * 0.2, rows = [y + h * 0.28, y + h * 0.66, y + h * 0.88];
    ctx.strokeStyle = 'rgba(255,238,210,0.15)'; ctx.lineWidth = 2; for (const ry of [y + h * 0.54, y + h * 0.78]) { ctx.beginPath(); ctx.moveTo(x + 10, ry); ctx.lineTo(x + w - 10, ry); ctx.stroke(); }
    ctx.strokeStyle = PAL.gold; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(px, y + 6); ctx.lineTo(px, y + h - 6); ctx.stroke();
    const r = Math.min(h * 0.09, 22);
    [[0.35, 0, false], [0.62, 1, true], [0.88, 2, false]].forEach(([fx, k, pull]) => drawAccNote(ctx, x + w * fx, rows[0] + (k - 1) * h * 0.08, r, { btn: 3 + k, pull }, {}));
    [[0.3, 'tum'], [0.55, 'tak'], [0.8, 'tum']].forEach(([fx, kind], i) => drawCajaNote(ctx, x + w * fx, y + h * (kind === 'tum' ? 0.62 : 0.7), r * 0.8, { kind }, { alpha: i === 1 ? 1 : 0.9 }));
    [[0.28, 'R', 0], [0.42, 'L', 0], [0.56, 'R', 1], [0.7, 'L', 0], [0.84, 'R', 0]].forEach(([fx, dir, acc]) => drawGuaNote(ctx, x + w * fx, rows[2], r * 0.8, { dir, acc }, {}));
    txt(ctx, 'playhead', px + 8, y + 18, Math.min(18, h * 0.08), PAL.gold, { weight: 700 });
  }
  ctx.restore();
}

// ---- layout of blocks into drawable ops ------------------------------------------------------------------------------------------------
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
  txt(ctx, doc.title, tx, vp.y - 50, 38, PAL.gold, { align: 'center', font: DISPLAY, weight: 400, maxW: D.viewport.w - 20, stroke: 6 });
  if (doc.nav) txt(ctx, `Page ${doc.page + 1} of ${doc.pages}`, tx, vp.y - 16, 20, PAL.dim, { align: 'center', weight: 600 });
  const vh = doc.nav ? vp.h : (D.nav.back.y + D.nav.back.h) - vp.y;
  const view = { x: vp.x, y: vp.y, w: vp.w, h: vh };
  panel(ctx, view, { rad: 22 });
  const padX = 22, innerW = view.w - padX * 2 - 18;
  const key = `${doc.key}|${doc.page ?? 0}|${Math.round(innerW)}|${ts}`;
  let lay = doc.volatile ? null : cache.get(key);
  if (!lay) { lay = layoutDoc(ctx, doc.blocks, innerW, ts); if (!doc.volatile) { if (cache.size > 40) cache.clear(); cache.set(key, lay); } }
  const max = Math.max(0, lay.total + 28 - view.h);
  docMetrics.max = max; docMetrics.view = view.h;
  if (st.docRescale) { st.docScroll = st.docFrac * max; st.docRescale = false; }
  const scroll = Math.max(0, Math.min(st.docScroll, max)); st.docScroll = scroll;
  ctx.save(); rrect(ctx, view, 22); ctx.clip();
  ctx.translate(view.x + padX, view.y + 18 - scroll);
  for (const op of lay.ops) {
    if (op.y + op.h < scroll - 40 || op.y > scroll + view.h + 40) continue;
    if (op.t === 'h') { ctx.font = `800 ${op.size}px ${UI}`; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = PAL.gold; op.lines.forEach((ln, i) => ctx.fillText(ln, 0, op.y + i * op.size * 1.25)); }
    else if (op.t === 'p') { ctx.font = `500 ${op.size}px ${UI}`; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = PAL.text; op.lines.forEach((ln, i) => ctx.fillText(ln, 0, op.y + i * op.lh)); }
    else if (op.t === 'li') {
      ctx.font = `500 ${op.size}px ${UI}`; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = PAL.mango;
      ctx.beginPath(); ctx.arc(10 * ts, op.y + op.lh * 0.5, 5 * ts + 1, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = PAL.text;
      op.lines.forEach((ln, i) => ctx.fillText(ln, op.ind, op.y + i * op.lh));
    } else if (op.t === 'fig') figure(ctx, op.name, 0, op.y, innerW, op.h);
    else if (op.t === 'row') {
      const b = op.b, r = { x: 0, y: op.y, w: innerW, h: op.h };
      ctx.fillStyle = 'rgba(255,244,224,0.07)'; rrect(ctx, r, 18); ctx.fill();
      txt(ctx, b.label, 20, op.y + op.h * (b.hint ? 0.36 : 0.5), 28 * Math.min(ts, 1.6), PAL.text, { weight: 700, maxW: innerW * 0.52 });
      if (b.hint) txt(ctx, b.hint, 20, op.y + op.h * 0.72, 20 * Math.min(ts, 1.6), PAL.dim, { weight: 500, maxW: innerW * 0.55 });
      const val = b.val?.();
      const sx = view.x + padX, sy = view.y + 18 - scroll;
      const screenR = (rr2) => ({ x: sx + rr2.x, y: sy + rr2.y, w: rr2.w, h: rr2.h });
      if (b.kind === 'toggle') {
        const tw = 108, th = 52, tr = { x: innerW - tw - 20, y: op.y + (op.h - th) / 2, w: tw, h: th };
        ctx.fillStyle = val ? '#35d6c6' : 'rgba(255,255,255,0.16)'; rrect(ctx, tr, th / 2); ctx.fill();
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
  if (max > 0) {
    const sb = { x: view.x + view.w - 12, y: view.y + 12, w: 6, h: view.h - 24 }, th = Math.max(40, sb.h * view.h / (lay.total + 28));
    ctx.fillStyle = 'rgba(255,244,224,0.12)'; rrect(ctx, sb, 3); ctx.fill();
    ctx.fillStyle = 'rgba(255,176,46,0.75)'; rrect(ctx, { x: sb.x, y: sb.y + (sb.h - th) * (scroll / max), w: sb.w, h: th }, 3); ctx.fill();
  }
  ui.view = view;
}
