// Text screens: Rules (paged), About, How to Play and Settings share one scrolling document renderer with a text-size stepper (to 300%).
// render() records what is tappable in `ui.hits` (rects in screen space); the game's update() reads it on the next tick.
import { PAL, UI, DISPLAY, drawPoseIcon, drawKid, KIDS, TAU } from './art.js';
import { txt, wrap, button, panel, rrect } from './ui.js';
import { TEXT_SCALES, minBtn } from './layout.js';
import { POSES, LEVELS, JUDGE } from './moves.js';

export const ui = { hits: [] };
export const docMetrics = { max: 0, view: 0 };
const cache = new Map();

// ---- figures (they use the game's own icon and child painters) ---------------------------------------------------------------
function figure(ctx, name, x, y, w, h) {
  ctx.save();
  if (name === 'poses') {
    const cell = w / 4, s = Math.min(cell * 0.78, h - 52);
    POSES.forEach((p, i) => {
      const cx = x + cell * (i + 0.5);
      drawPoseIcon(ctx, i, cx, y + s / 2, s);
      txt(ctx, p.label, cx, y + s + 24, Math.min(26, cell * 0.2), p.col, { align: 'center', weight: 700 });
    });
  } else if (name === 'plan') {
    const cx = x + w / 2, cy = y + h / 2, u = h * 0.16, half = w * 0.42;
    ctx.fillStyle = 'rgba(255,255,255,0.06)'; rrect(ctx, { x, y, w, h }, 18); ctx.fill();
    ctx.strokeStyle = PAL.pink; ctx.lineWidth = 6; ctx.lineCap = 'round';
    for (const d of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx - half, cy + d * u); ctx.lineTo(cx + half, cy + d * u); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(cx - half, cy - u); ctx.quadraticCurveTo(cx - half - 40, cy, cx - half, cy + u); ctx.moveTo(cx + half, cy - u); ctx.quadraticCurveTo(cx + half + 40, cy, cx + half, cy + u); ctx.stroke();
    for (const s of [-1, 1]) { ctx.fillStyle = s < 0 ? '#ffcf3f' : '#52d6a4'; ctx.beginPath(); ctx.arc(cx + s * (half - 18), cy, u * 0.55, 0, TAU); ctx.fill(); ctx.fillStyle = PAL.navy; txt(ctx, 'holder', cx + s * (half - 18), cy, 18, PAL.navy, { align: 'center', weight: 700 }); }
    txt(ctx, 'FAR strand', cx, cy - u - 22, 22, PAL.text, { align: 'center', weight: 700 });
    txt(ctx, 'NEAR strand', cx, cy + u + 24, 22, PAL.text, { align: 'center', weight: 700 });
    txt(ctx, 'IN', cx, cy, 22, POSES[1].col, { align: 'center', weight: 800 });
    txt(ctx, 'jumper side (OUT)', cx, y + h - 14, 20, POSES[0].col, { align: 'center', weight: 700 });
  } else if (name === 'heights') {
    const hh = h - 12, k = hh / 1.08, gx = x + w * 0.3, gy = y + h - 8;
    ctx.fillStyle = 'rgba(255,255,255,0.06)'; rrect(ctx, { x, y, w, h }, 18); ctx.fill();
    drawKid(ctx, KIDS.jumper, { k, x: gx, feet: [{ x: gx - k * 0.06, y: gy }, { x: gx + k * 0.06, y: gy }], armL: 0.25, armR: 0.25, hairSwing: 0.1 });
    LEVELS.forEach((l, i) => {
      const yy = gy - l.hgt * k;
      ctx.strokeStyle = PAL.pink; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(gx - k * 0.2, yy); ctx.lineTo(gx + k * 0.38, yy); ctx.stroke();
      txt(ctx, `${i + 1}  ${l.name}`, gx + k * 0.44, yy, Math.max(16, Math.min(24, hh / 12)), PAL.text, { weight: 700 });
    });
  } else if (name === 'track') {
    ctx.fillStyle = 'rgba(14,22,58,0.6)'; rrect(ctx, { x, y, w, h }, 18); ctx.fill();
    const nowX = x + w * 0.22, s = Math.min(h * 0.5, w * 0.12);
    ctx.fillStyle = 'rgba(255,248,236,0.35)'; ctx.fillRect(nowX - 2, y + 10, 4, h - 20);
    txt(ctx, 'NOW', nowX, y + h - 14, 20, PAL.gold, { align: 'center', weight: 800 });
    [1, 2, 0, 3].forEach((p, i) => { const tx = nowX + w * 0.2 * (i + 1) - (i === 0 ? 0 : 0); drawPoseIcon(ctx, p, Math.min(tx, x + w - s), y + h * 0.42, s, {}); });
    ctx.globalAlpha = 0.5; drawPoseIcon(ctx, 2, nowX - w * 0.12, y + h * 0.42, s); ctx.globalAlpha = 1;
    txt(ctx, 'passed', nowX - w * 0.12, y + 22, 18, PAL.dim, { align: 'center', weight: 600 });
    txt(ctx, 'coming', nowX + w * 0.3, y + 22, 18, PAL.dim, { align: 'center', weight: 600 });
  } else if (name === 'timing') {
    const cx = x + w / 2, bw = w * 0.88, base = y + h * 0.42, bh = h * 0.3, sc = bw / 2 / JUDGE.ok;
    const bands = [['Okay', JUDGE.ok, '#4aa8ff'], ['Good', JUDGE.good, '#26c281'], ['Perfect', JUDGE.perfect, '#ffd23f']];
    bands.forEach(([n, v, c]) => { ctx.fillStyle = c; rrect(ctx, { x: cx - v * sc, y: base - bh / 2, w: v * 2 * sc, h: bh }, 10); ctx.fill(); });
    ctx.fillStyle = '#14204a'; ctx.fillRect(cx - 2, base - bh / 2 - 8, 4, bh + 16);
    txt(ctx, 'the beat', cx, base - bh / 2 - 22, 20, PAL.text, { align: 'center', weight: 700 });
    bands.forEach(([n, v]) => txt(ctx, `${n} ${Math.round(v * 1000)} ms`, cx + v * sc * (n === 'Perfect' ? 0.5 : 0.9) - (n === 'Okay' ? 0 : 0), base + bh / 2 + 24 + (n === 'Perfect' ? 0 : n === 'Good' ? 26 : 52) * 0, 20, PAL.text, { align: 'center', weight: 700, maxW: w * 0.3 }));
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
      ctx.font = `700 ${headF}px ${DISPLAY}`; const lines = wrap(ctx, b.h, width);
      ops.push({ t: 'h', y, lines, size: headF, h: lines.length * headF * 1.25 }); y += lines.length * headF * 1.25 + 8 * ts;
    } else if (b.p) {
      ctx.font = `500 ${bodyF}px ${DISPLAY}`; const lines = wrap(ctx, b.p, width);
      ops.push({ t: 'p', y, lines, size: bodyF, lh, h: lines.length * lh }); y += lines.length * lh + 12 * ts;
    } else if (b.li) {
      ctx.font = `500 ${bodyF}px ${DISPLAY}`; const ind = 34 * ts, lines = wrap(ctx, b.li, width - ind);
      ops.push({ t: 'li', y, lines, size: bodyF, lh, ind, h: lines.length * lh }); y += lines.length * lh + 8 * ts;
    } else if (b.fig) {
      const hh = b.hh * Math.min(ts, 1.5);
      ops.push({ t: 'fig', y, name: b.fig, h: hh }); y += hh + 16 * ts;
    } else if (b.sp) { y += 22 * ts; }
    else if (b.row) {
      const rh = Math.max(86, minBtn(), 56 * ts + 30);
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
  txt(ctx, doc.title, tx, vp.y - 30, 38, PAL.gold, { align: 'center', font: DISPLAY, weight: 700, maxW: D.viewport.w - 20, stroke: 7 });
  const vh = doc.nav ? vp.h : (D.nav.back.y + D.nav.back.h) - vp.y;
  const view = { x: vp.x, y: vp.y, w: vp.w, h: vh };
  panel(ctx, view, { fill: 'rgba(12,20,52,0.84)', rad: 22 });
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
    if (op.t === 'h') { ctx.font = `700 ${op.size}px ${DISPLAY}`; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = PAL.gold; op.lines.forEach((ln, i) => ctx.fillText(ln, 0, op.y + i * op.size * 1.25)); }
    else if (op.t === 'p') { ctx.font = `500 ${op.size}px ${DISPLAY}`; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = PAL.text; op.lines.forEach((ln, i) => ctx.fillText(ln, 0, op.y + i * op.lh)); }
    else if (op.t === 'li') {
      ctx.font = `500 ${op.size}px ${DISPLAY}`; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = PAL.text;
      ctx.beginPath(); ctx.fillStyle = PAL.pink; ctx.arc(10 * ts, op.y + op.lh * 0.5, 5 * ts + 1, 0, TAU); ctx.fill(); ctx.fillStyle = PAL.text;
      op.lines.forEach((ln, i) => ctx.fillText(ln, op.ind, op.y + i * op.lh));
    } else if (op.t === 'fig') figure(ctx, op.name, 0, op.y, innerW, op.h);
    else if (op.t === 'row') {
      const b = op.b, r = { x: 0, y: op.y, w: innerW, h: op.h };
      ctx.fillStyle = 'rgba(255,255,255,0.09)'; rrect(ctx, r, 18); ctx.fill();
      txt(ctx, b.label, 20, op.y + op.h * (b.hint ? 0.36 : 0.5), 28 * Math.min(ts, 1.6), PAL.text, { weight: 700, maxW: innerW * 0.52 });
      if (b.hint) {
        const ctlLeft = b.kind === 'stepper' ? innerW - 20 - Math.max(72, minBtn()) * 2 - 100 : b.kind === 'button' ? innerW - Math.min(innerW * 0.4, 280) - 20 : b.kind === 'cycle' ? innerW * 0.6 : innerW * 0.8;
        txt(ctx, b.hint, 20, op.y + op.h * 0.72, 20 * Math.min(ts, 1.6), PAL.dim, { weight: 500, maxW: Math.max(120, ctlLeft - 32) });
      }
      const val = b.val?.();
      const sx = view.x + padX, sy = view.y + 18 - scroll;
      const screenR = (rr) => ({ x: sx + rr.x, y: sy + rr.y, w: rr.w, h: rr.h });
      if (b.kind === 'toggle') {
        const tw = 108, th = 52, tr = { x: innerW - tw - 20, y: op.y + (op.h - th) / 2, w: tw, h: th };
        ctx.fillStyle = val ? '#25c7c2' : 'rgba(255,255,255,0.2)'; rrect(ctx, tr, th / 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(val ? tr.x + tw - th / 2 : tr.x + th / 2, tr.y + th / 2, th / 2 - 5, 0, TAU); ctx.fill();
        ui.hits.push({ id: 'set:' + b.row, r: screenR(r), clip: view });
      } else if (b.kind === 'cycle') {
        txt(ctx, String(val), innerW - 24, op.y + op.h / 2, 28 * Math.min(ts, 1.6), PAL.gold, { align: 'right', weight: 800, maxW: innerW * 0.4 });
        ui.hits.push({ id: 'set:' + b.row, r: screenR(r), clip: view });
      } else if (b.kind === 'stepper') {
        const bw = Math.max(72, minBtn()), sbh = Math.max(64, minBtn()), dec = { x: innerW - 20 - bw * 2 - 100, y: op.y + (op.h - sbh) / 2, w: bw, h: sbh }, inc = { x: innerW - 20 - bw, y: dec.y, w: bw, h: 64 };
        button(ctx, dec, '-', { kind: 'quiet', size: 34, noShadow: true }); button(ctx, inc, '+', { kind: 'quiet', size: 34, noShadow: true });
        txt(ctx, String(val), dec.x + bw + 50, op.y + op.h / 2, 26 * Math.min(ts, 1.4), PAL.gold, { align: 'center', weight: 800, maxW: 96 });
        ui.hits.push({ id: 'set:' + b.row + 'Dec', r: screenR(dec), clip: view }, { id: 'set:' + b.row + 'Inc', r: screenR(inc), clip: view });
      } else if (b.kind === 'button') {
        const bw = Math.min(innerW * 0.4, 280), br = { x: innerW - bw - 20, y: op.y + (op.h - Math.max(66, minBtn())) / 2, w: bw, h: Math.max(66, minBtn()) };
        button(ctx, br, b.btn ?? 'Open', { kind: 'primary', size: 28, noShadow: true });
        ui.hits.push({ id: 'set:' + b.row, r: screenR(r), clip: view });
      }
    }
  }
  ctx.restore();
  if (max > 0) {
    const sb = { x: view.x + view.w - 12, y: view.y + 12, w: 6, h: view.h - 24 }, th = Math.max(40, sb.h * view.h / (lay.total + 28));
    ctx.fillStyle = 'rgba(255,255,255,0.14)'; rrect(ctx, sb, 3); ctx.fill();
    ctx.fillStyle = 'rgba(255,79,139,0.85)'; rrect(ctx, { x: sb.x, y: sb.y + (sb.h - th) * (scroll / max), w: sb.w, h: th }, 3); ctx.fill();
  }
  ui.view = view;
}
void UI;
