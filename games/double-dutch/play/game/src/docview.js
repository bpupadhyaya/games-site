// Text screens: Rules (paged), About, How to Play and Settings share one scrolling document renderer with a text-size stepper (to 300%).
// render() records what is tappable in `ui.hits` (rects in screen space); the game's update() reads it on the next tick.
import { PAL, UI, DISPLAY, BODY, drawPassDot, drawTrickIcon, drawPerson, PEOPLE, TAU } from './art.js';
import { drawStreet, jumperPose } from './stage.js';
import { snaps } from './snaps.js';
import { txt, wrap, button, panel, rrect } from './ui.js';
import { TEXT_SCALES } from './layout.js';
import { TRICKS, LEVELS, JUDGE, beatsOf } from './moves.js';

export const ui = { hits: [] };
export const docMetrics = { max: 0, view: 0 };
const cache = new Map();

// ---- figures (they use the game's own person, rope and icon painters) ----------------------------------------------------------------
function panelBg(ctx, x, y, w, h) { ctx.fillStyle = 'rgba(255,255,255,0.06)'; rrect(ctx, { x, y, w, h }, 18); ctx.fill(); }
function figure(ctx, name, x, y, w, h) {
  ctx.save();
  if (name === 'side') {
    // the street seen from the side: two turners, the jumper in the middle, rope A near and rope B far
    panelBg(ctx, x, y, w, h);
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    const V = { Theta: 0.62, tRun: 0, J: { t0: -5, dur: 0.3, trick: null, x: 0, stumble: 0, run: 0 }, beat: 0.4, pulse: 0 };
    const sn = snaps.get('side');
    if (sn) { const sc = Math.max(w / sn.width, h / sn.height); ctx.drawImage(sn, x + (w - sn.width * sc) / 2, y + (h - sn.height * sc) / 2, sn.width * sc, sn.height * sc); }
    else drawStreet(ctx, w + x * 2, y + h + 4, { x, y: y + 4, w, h: h - 4 }, V, 3.1, { vignette: 0.15 });
    ctx.restore();
    txt(ctx, 'ROPE A', x + w * 0.2, y + h - 18, 20, PAL.ropeA, { align: 'center', weight: 800, stroke: 5 });
    txt(ctx, 'ROPE B', x + w * 0.8, y + h - 18, 20, PAL.ropeB, { align: 'center', weight: 800, stroke: 5 });
  } else if (name === 'cycle') {
    panelBg(ctx, x, y, w, h);
    const cell = w / 6, s = Math.min(cell * 0.6, h - 62);
    ['A', 'B', 'A', 'B', 'A', 'B'].forEach((r, i) => {
      const cx = x + cell * (i + 0.5);
      drawPassDot(ctx, { rope: r, call: null }, cx, y + 16 + s / 2, s);
      txt(ctx, String(i + 1), cx, y + h - 20, 22, PAL.dim, { align: 'center', weight: 700 });
    });
    txt(ctx, 'one pass on the ground for every beat', x + w / 2, y + h - 46, 20, PAL.text, { align: 'center', weight: 700, maxW: w - 20 });
  } else if (name === 'tricks') {
    panelBg(ctx, x, y, w, h);
    const cw = w / 2, ch = h / 2;
    TRICKS.forEach((tr, i) => {
      const cx = x + cw * (i % 2 + 0.5), top = y + ch * Math.floor(i / 2), gy = top + ch - 46, k = Math.min((ch - 56) / 0.98, cw * 0.62);
      const sn = snaps.get('trick-' + tr.id);
      if (sn) { const hh = ch - 40, sc = Math.min(cw * 0.92 / sn.width, hh / sn.height); ctx.drawImage(sn, cx - sn.width * sc / 2, top + 4 + (hh - sn.height * sc) / 2, sn.width * sc, sn.height * sc); }
      else {
      const J = { t0: 0, dur: 0.36, trick: tr.id, x: 0, stumble: 0, run: 0 };
      const P = jumperPose(J, 0.36 * (tr.id === 'spin' ? 0.12 : 0.5), 0);
      let arms = P.arms; if (arms[1] && arms[1].ground !== undefined) arms = [arms[0], { tx: cx + 0.13 * k, ty: gy - (1 - arms[1].ground) * 0.38 * k, bend: 0.8 }];
      drawPerson(ctx, PEOPLE.jumper, { x: cx, gy, k, lift: P.lift * 0.5, crouch: P.crouch, bow: P.bow, lean: P.lean, turn: P.turn, feet: P.feet, arms, mouth: P.mouth, shadow: true });
      }
      drawTrickIcon(ctx, tr.id, cx - cw * 0.2, top + ch - 20, 34);
      txt(ctx, tr.name, cx + cw * 0.04, top + ch - 20, 28, tr.col, { align: 'left', weight: 800, maxW: cw * 0.45 });
    });
  } else if (name === 'swipes') {
    panelBg(ctx, x, y, w, h);
    const cx = x + w / 2, cy = y + h / 2, s = Math.min(h * 0.2, w * 0.1);
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.arc(cx, cy, s * 0.55, 0, TAU); ctx.fill();
    txt(ctx, 'TAP = HOP', cx, cy, Math.max(16, s * 0.34), PAL.text, { align: 'center', weight: 800 });
    const off = s * 1.55;
    [['up', 0, -off], ['left', -off * 1.5, 0], ['right', off * 1.5, 0], ['down', 0, off]].forEach(([d, dx, dy]) => {
      const tr = TRICKS.find((q) => q.dir === d);
      drawTrickIcon(ctx, tr.id, cx + dx, cy + dy, s * 1.0);
      txt(ctx, tr.name, cx + dx, cy + dy + (d === 'up' ? -s * 0.85 : s * 0.85), Math.max(18, s * 0.34), tr.col, { align: 'center', weight: 800 });
    });
  } else if (name === 'timing') {
    panelBg(ctx, x, y, w, h);
    const cx = x + w / 2, bw = w * 0.88, base = y + h * 0.46, bh = h * 0.28, sc = bw / 2 / 0.16;
    const bands = [['Okay', 0.16, '#35d0ff'], ['Good', JUDGE.good, '#7be26a'], ['Perfect', JUDGE.perfect, '#ffc83d']];
    bands.forEach(([n, v, c]) => { ctx.fillStyle = c; rrect(ctx, { x: cx - v * sc, y: base - bh / 2, w: v * 2 * sc, h: bh }, 10); ctx.fill(); });
    ctx.fillStyle = '#1a0f33'; ctx.fillRect(cx - 2, base - bh / 2 - 8, 4, bh + 16);
    txt(ctx, 'rope on the ground', cx, base - bh / 2 - 24, 22, PAL.text, { align: 'center', weight: 700 });
    txt(ctx, 'Perfect', cx, base, 20, '#1a0f33', { align: 'center', weight: 800, maxW: JUDGE.perfect * 2 * sc - 6 });
    txt(ctx, 'Good', cx + (JUDGE.perfect + (JUDGE.good - JUDGE.perfect) / 2) * sc, base, 20, '#1a0f33', { align: 'center', weight: 800, maxW: (JUDGE.good - JUDGE.perfect) * sc });
    txt(ctx, 'Okay', cx + (JUDGE.good + (0.16 - JUDGE.good) / 2) * sc, base, 20, '#1a0f33', { align: 'center', weight: 800, maxW: (0.16 - JUDGE.good) * sc });
    txt(ctx, 'early', x + 60, base + bh / 2 + 28, 20, PAL.dim, { align: 'center', weight: 600 });
    txt(ctx, 'late', x + w - 60, base + bh / 2 + 28, 20, PAL.dim, { align: 'center', weight: 600 });
  } else if (name === 'levels') {
    panelBg(ctx, x, y, w, h);
    const rowH = (h - 16) / LEVELS.length;
    LEVELS.forEach((l, i) => {
      const yy = y + 8 + rowH * (i + 0.5);
      txt(ctx, `${i + 1}`, x + 30, yy, Math.min(26, rowH * 0.62), PAL.orange, { align: 'center', weight: 800 });
      txt(ctx, l.name, x + 62, yy, Math.min(26, rowH * 0.62), PAL.text, { weight: 700, maxW: w * 0.36 });
      txt(ctx, `${l.bpm} bpm`, x + w * 0.5, yy, Math.min(22, rowH * 0.55), PAL.dim, { weight: 700 });
      const used = new Set(beatsOf(l).filter((c) => c !== '.'));
      let ix = x + w * 0.68;
      TRICKS.forEach((tr) => { if (used.has(tr.key)) { drawTrickIcon(ctx, tr.id, ix, yy, Math.min(30, rowH * 0.74)); ix += Math.min(36, rowH * 0.9); } });
      if (used.has('p')) txt(ctx, 'PEPPER', Math.min(x + w - 50, ix + 26), yy, Math.min(18, rowH * 0.46), PAL.hot, { align: 'center', weight: 800 });
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
      ctx.font = `700 ${headF}px ${DISPLAY}`; const lines = wrap(ctx, b.h, width);
      ops.push({ t: 'h', y, lines, size: headF, h: lines.length * headF * 1.25 }); y += lines.length * headF * 1.25 + 8 * ts;
    } else if (b.p) {
      ctx.font = `600 ${bodyF}px ${BODY}`; const lines = wrap(ctx, b.p, width);
      ops.push({ t: 'p', y, lines, size: bodyF, lh, h: lines.length * lh }); y += lines.length * lh + 12 * ts;
    } else if (b.li) {
      ctx.font = `600 ${bodyF}px ${BODY}`; const ind = 34 * ts, lines = wrap(ctx, b.li, width - ind);
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
  txt(ctx, doc.title, tx, vp.y - 30, 38, PAL.gold, { align: 'center', font: DISPLAY, weight: 700, maxW: D.viewport.w - 20, stroke: 7 });
  const vh = doc.nav ? vp.h : (D.nav.back.y + D.nav.back.h) - vp.y;
  const view = { x: vp.x, y: vp.y, w: vp.w, h: vh };
  panel(ctx, view, { fill: 'rgba(22,11,44,0.86)', rad: 22 });
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
    else if (op.t === 'p') { ctx.font = `600 ${op.size}px ${BODY}`; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = PAL.text; op.lines.forEach((ln, i) => ctx.fillText(ln, 0, op.y + i * op.lh)); }
    else if (op.t === 'li') {
      ctx.font = `600 ${op.size}px ${BODY}`; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = PAL.text;
      ctx.beginPath(); ctx.fillStyle = PAL.orange; ctx.arc(10 * ts, op.y + op.lh * 0.5, 5 * ts + 1, 0, TAU); ctx.fill(); ctx.fillStyle = PAL.text;
      op.lines.forEach((ln, i) => ctx.fillText(ln, op.ind, op.y + i * op.lh));
    } else if (op.t === 'fig') figure(ctx, op.name, 0, op.y, innerW, op.h);
    else if (op.t === 'row') {
      const b = op.b, r = { x: 0, y: op.y, w: innerW, h: op.h };
      ctx.fillStyle = 'rgba(255,255,255,0.09)'; rrect(ctx, r, 18); ctx.fill();
      txt(ctx, b.label, 20, op.y + op.h * (b.hint ? 0.36 : 0.5), 28 * Math.min(ts, 1.6), PAL.text, { weight: 700, maxW: innerW * 0.52 });
      if (b.hint) txt(ctx, b.hint, 20, op.y + op.h * 0.72, 20 * Math.min(ts, 1.6), PAL.dim, { weight: 500, maxW: innerW * 0.55 });
      const val = b.val?.();
      const sx = view.x + padX, sy = view.y + 18 - scroll;
      const screenR = (rr) => ({ x: sx + rr.x, y: sy + rr.y, w: rr.w, h: rr.h });
      if (b.kind === 'toggle') {
        const tw = 108, th = 52, tr = { x: innerW - tw - 20, y: op.y + (op.h - th) / 2, w: tw, h: th };
        ctx.fillStyle = val ? '#3ee8b5' : 'rgba(255,255,255,0.2)'; rrect(ctx, tr, th / 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(val ? tr.x + tw - th / 2 : tr.x + th / 2, tr.y + th / 2, th / 2 - 5, 0, TAU); ctx.fill();
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
    ctx.fillStyle = 'rgba(255,255,255,0.14)'; rrect(ctx, sb, 3); ctx.fill();
    ctx.fillStyle = 'rgba(255,138,31,0.9)'; rrect(ctx, { x: sb.x, y: sb.y + (sb.h - th) * (scroll / max), w: sb.w, h: th }, 3); ctx.fill();
  }
  ui.view = view;
}
void UI;
