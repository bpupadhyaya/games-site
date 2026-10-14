// Text screens: Rules (paged), About, How to Play and Settings share one scrolling document renderer with a text-size stepper (to 300%).
// render() records what is tappable in `ui.hits` (rects in screen space); the game's update() reads it on the next tick.
import { PAL, UI, DISPLAY, TAU, TILT, camFor, camAspect, drawPlayer, drawBall } from './art.js';
import { txt, wrap, button, panel, rrect } from './ui.js';
import { TEXT_SCALES } from './layout.js';
import { CX, CY, R, RIM } from './engine.js';

export const ui = { hits: [] };
export const docMetrics = { max: 0, view: 0 };
const cache = new Map();

// ---- figures (they use the game's own art) ----------------------------------------------------------------------------------------------
let uid = 100;
const person = (x, y, orig, a = 0, o = {}) => ({
  id: uid++, team: orig, orig, x, y, vx: 0, vy: 0, a, st: 'in', ball: null, windT: 0, windMax: 0.3, catchT: 0, stun: 0, hitT: 0, throwT: 0, gait: 0, tall: 1,
  skin: ['#f6d9c0', '#d9a577', '#b57d54', '#eec19a'][uid % 4], hair: ['#2a1a10', '#5a3a1e', '#1a1a1e', '#c9a14a'][uid % 4], style: uid % 4, num: 1 + (uid % 9), ...o,
});
function stage(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(8,14,30,0.6)'; rrect(ctx, { x, y, w, h }, 18); ctx.fill();
  const cw = Math.min(w - 16, (h - 8) / camAspect());
  return camFor({ x: x + (w - cw) / 2, y: y + 4, w: cw, h: cw * camAspect() });
}
function worldGround(ctx, cam, court) {
  ctx.save(); ctx.translate(cam.ox, cam.oy); ctx.scale(cam.S, cam.S * TILT);
  const g = ctx.createRadialGradient(CX, CY, 20, CX, CY, R + 20); g.addColorStop(0, 'rgba(255,214,170,0.35)'); g.addColorStop(1, 'rgba(255,214,170,0.1)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(CX, CY, R, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#fffdf4'; ctx.lineWidth = 12; ctx.beginPath(); ctx.arc(CX, CY, R, 0, TAU); ctx.stroke();
  if (court) { ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(CX - R, CY); ctx.lineTo(CX + R, CY); ctx.stroke(); }
  ctx.restore();
}
function label(ctx, cam, wx, wy, text, size = 20, col = PAL.text) { txt(ctx, text, cam.X(wx), cam.Y(wy), size, col, { align: 'center', weight: 700, stroke: 5 }); }
function dashed(ctx, cam, x0, y0, z0, x1, y1, z1, col, w = 3) {
  ctx.save(); ctx.setLineDash([8, 7]); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath();
  ctx.moveTo(cam.X(x0), cam.Y(y0) - z0 * cam.S); ctx.lineTo(cam.X(x1), cam.Y(y1) - z1 * cam.S); ctx.stroke(); ctx.restore();
}

function figure(ctx, name, x, y, w, h, t) {
  ctx.save(); ctx.beginPath(); ctx.rect(x - 4, y - 6, w + 8, h + 12); ctx.clip();
  if (name === 'court') {
    const cam = stage(ctx, x, y, w, h); worldGround(ctx, cam, true);
    const mine = [[300, 760], [500, 640], [720, 790]], theirs = [[320, 250], [520, 340], [700, 230]];
    const all = [...mine.map((p, i) => person(p[0], p[1], 0, -Math.PI / 2, { gait: t * 6 + i })), ...theirs.map((p, i) => person(p[0], p[1], 1, Math.PI / 2, { gait: t * 6 + i }))];
    all.sort((a, b) => a.y - b.y).forEach((p) => drawPlayer(ctx, cam, p, { you: p.x === 500 && p.y === 640, t }));
    drawBall(ctx, cam, { x: 600, y: 500, z: 0, vx: 0, vy: 0, vz: 0, live: false }, { t });
    label(ctx, cam, 180, 880, 'your half', 20, PAL.sunLight); label(ctx, cam, 180, 130, 'their half', 20, PAL.moonLight);
  } else if (name === 'cemetery') {
    const cam = stage(ctx, x, y, w, h); worldGround(ctx, cam, true);
    const mates = [person(330, 800, 0, -Math.PI / 2), person(660, 760, 0, -Math.PI / 2)];
    const foes = [person(420, 300, 1, Math.PI / 2), person(640, 250, 1, Math.PI / 2)];
    const burned = person(500, R * 0 + 20, 0, Math.PI / 2, { ball: 1 });
    [...foes, burned, ...mates].sort((a, b) => a.y - b.y).forEach((p) => drawPlayer(ctx, cam, p, { t }));
    dashed(ctx, cam, 500, 30, 50, 640, 740, 40, '#ff6b5a');
    label(ctx, cam, 780, 70, 'cemetery', 22, PAL.sunLight);
  } else if (name === 'ring') {
    const cam = stage(ctx, x, y, w, h); worldGround(ctx, cam, false);
    const rim = [];
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU - 1.2; rim.push(person(CX + Math.cos(a) * RIM, CY + Math.sin(a) * RIM, 1, a + Math.PI, { st: 'rim' })); }
    const inside = [person(430, 560, 0, -1, { gait: t * 6 }), person(600, 450, 0, 2, { gait: t * 6 + 2 }), person(520, 700, 0, 0.5, { gait: t * 6 + 4 })];
    const joiner = person(CX + Math.cos(2.4) * RIM, CY + Math.sin(2.4) * RIM, 0, 2.4 + Math.PI, { st: 'rim' });
    [...rim, joiner, ...inside].sort((a, b) => a.y - b.y).forEach((p) => drawPlayer(ctx, cam, p, { t }));
    label(ctx, cam, 500, 120, 'the ring', 22, PAL.moonLight); label(ctx, cam, 500, 520, 'dodgers', 20, PAL.sunLight);
    label(ctx, cam, 230, 800, 'hit: joins the ring', 18, PAL.gold);
  } else if (name === 'lob') {
    // side-on diagram: fast = flat line, lob = arc over the player in the middle
    const gy = y + h * 0.78, x0 = x + w * 0.1, x1 = x + w * 0.9, mid = (x0 + x1) / 2;
    ctx.fillStyle = 'rgba(8,14,30,0.6)'; rrect(ctx, { x, y, w, h }, 18); ctx.fill();
    ctx.strokeStyle = 'rgba(255,248,236,0.4)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + 10, gy); ctx.lineTo(x + w - 10, gy); ctx.stroke();
    const s = h / 330;
    const mk = (px, orig, a) => { const p = person(0, 0, orig, a); const cam = { X: () => px, Y: () => gy, fs: () => s, S: s }; drawPlayer(ctx, cam, { ...p, x: 0, y: 1000 }, {}); };
    mk(x0, 0, 0); mk(mid, 1, Math.PI); mk(x1, 1, Math.PI);
    ctx.strokeStyle = '#ff6b5a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x0 + 22 * s, gy - 52 * s); ctx.lineTo(mid - 8 * s, gy - 54 * s); ctx.stroke();
    ctx.strokeStyle = PAL.gold; ctx.beginPath(); ctx.moveTo(x0 + 22 * s, gy - 52 * s); ctx.quadraticCurveTo((x0 + x1) / 2, gy - h * 0.95, x1 - 10 * s, gy - 46 * s); ctx.stroke();
    txt(ctx, 'fast: hits the first player in the way', x + 14, y + 24, 20, '#ff9a8a', { weight: 700, maxW: w * 0.6 });
    txt(ctx, 'lob: over him, lands on his teammate', x + 14, y + 50, 20, PAL.gold, { weight: 700, maxW: w * 0.6 });
  } else if (name === 'catch') {
    ctx.fillStyle = 'rgba(8,14,30,0.6)'; rrect(ctx, { x, y, w, h }, 18); ctx.fill();
    const s = h / 200, px = x + w * 0.22, py = y + h * 0.82;
    const p = person(0, 1000, 0, Math.PI / 2, { catchT: 0.3 });
    drawPlayer(ctx, { X: () => px, Y: () => py, fs: () => s, S: s }, p, {});
    const bx = x + w * 0.04, by = y + h * 0.32;
    ctx.strokeStyle = '#ff6b5a'; ctx.lineWidth = 3; ctx.setLineDash([8, 6]); ctx.beginPath(); ctx.moveTo(bx + 8, by); ctx.lineTo(px - 24 * s, py - 56 * s); ctx.stroke(); ctx.setLineDash([]);
    // the timeline: stance, then recovery
    const tx = x + w * 0.42, tw = w * 0.52, ty = y + h * 0.45, st = 0.45, tot = 1.3;
    ctx.fillStyle = 'rgba(255,248,236,0.12)'; rrect(ctx, { x: tx, y: ty, w: tw, h: 26 }, 13); ctx.fill();
    ctx.fillStyle = PAL.good; rrect(ctx, { x: tx, y: ty, w: tw * st / tot, h: 26 }, 13); ctx.fill();
    ctx.fillStyle = 'rgba(255,107,90,0.7)'; ctx.fillRect(tx + tw * st / tot, ty, tw * (1 - st / tot) - 13, 26);
    txt(ctx, 'hands open', tx + tw * st / tot / 2, ty - 18, 20, PAL.good, { align: 'center', weight: 700, maxW: tw * 0.4 });
    txt(ctx, 'recovering', tx + tw * (st / tot + (1 - st / tot) / 2), ty + 52, 20, '#ff9a8a', { align: 'center', weight: 700, maxW: tw * 0.5 });
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
  txt(ctx, doc.title, tx, vp.y - 30, 44, PAL.gold, { align: 'center', font: DISPLAY, weight: 800, maxW: vp.w - 20, stroke: 6 });
  const vh = doc.nav ? vp.h : (D.nav.back.y + D.nav.back.h) - vp.y;
  const view = { x: vp.x, y: vp.y, w: vp.w, h: vh };
  panel(ctx, view, { fill: 'rgba(12,20,42,0.88)', rad: 22 });
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
    } else if (op.t === 'fig') figure(ctx, op.name, 0, op.y, innerW, op.h, st.t);
    else if (op.t === 'row') {
      const b = op.b, r = { x: 0, y: op.y, w: innerW, h: op.h };
      ctx.fillStyle = 'rgba(255,248,236,0.07)'; rrect(ctx, r, 18); ctx.fill();
      const label = typeof b.label === 'function' ? b.label() : b.label, hint = typeof b.hint === 'function' ? b.hint() : b.hint;
      txt(ctx, label, 20, op.y + op.h * (hint ? 0.36 : 0.5), 28 * Math.min(ts, 1.6), PAL.text, { weight: 700, maxW: b.kind === 'button' ? innerW - Math.min(innerW * 0.4, 280) - 60 : innerW * 0.52 });
      if (hint) txt(ctx, hint, 20, op.y + op.h * 0.72, 20 * Math.min(ts, 1.6), PAL.dim, { weight: 500, maxW: innerW * 0.55 });
      const val = b.val?.();
      const sx = view.x + padX, sy = view.y + 18 - scroll;
      const screenR = (rr) => ({ x: sx + rr.x, y: sy + rr.y, w: rr.w, h: rr.h });
      if (b.kind === 'toggle') {
        const tw = 108, th = 52, tr = { x: innerW - tw - 20, y: op.y + (op.h - th) / 2, w: tw, h: th };
        ctx.fillStyle = val ? '#3fae74' : 'rgba(255,255,255,0.16)'; rrect(ctx, tr, th / 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(val ? tr.x + tw - th / 2 : tr.x + th / 2, tr.y + th / 2, th / 2 - 5, 0, Math.PI * 2); ctx.fill();
        ui.hits.push({ id: 'set:' + b.row, r: screenR(r), clip: view });
      } else if (b.kind === 'cycle') {
        txt(ctx, String(val), innerW - 24, op.y + op.h / 2, 28 * Math.min(ts, 1.6), PAL.gold, { align: 'right', weight: 800, maxW: innerW * 0.4 });
        ui.hits.push({ id: 'set:' + b.row, r: screenR(r), clip: view });
      } else if (b.kind === 'button') {
        const bw = Math.min(innerW * 0.4, 280), br = { x: innerW - bw - 20, y: op.y + (op.h - 66) / 2, w: bw, h: 66 };
        const bl = typeof b.btn === 'function' ? b.btn() : b.btn;
        button(ctx, br, bl ?? 'Open', { kind: bl === 'Owned' ? 'disabled' : 'primary', size: 28, noShadow: true });
        ui.hits.push({ id: 'set:' + b.row, r: screenR(r), clip: view });
      }
    }
  }
  ctx.restore();
  if (max > 0) {
    const sb = { x: view.x + view.w - 12, y: view.y + 12, w: 6, h: view.h - 24 }, th = Math.max(40, sb.h * view.h / (lay.total + 28));
    ctx.fillStyle = 'rgba(255,248,236,0.12)'; rrect(ctx, sb, 3); ctx.fill();
    ctx.fillStyle = 'rgba(255,210,63,0.7)'; rrect(ctx, { x: sb.x, y: sb.y + (sb.h - th) * (scroll / max), w: sb.w, h: th }, 3); ctx.fill();
  }
  ui.view = view;
}
