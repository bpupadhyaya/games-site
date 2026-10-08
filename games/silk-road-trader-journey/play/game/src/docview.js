// Text screens: Rules (paged), About, How to Play, Settings and the Journal share one scrolling document renderer with a text-size stepper (to 300%).
// render records what is tappable in `ui.hits` (rects in screen space); the game's update() reads it on the next tick.
import { PAL, UI, DISPLAY, txt, wrap, button, panel, rrect, icon, chip, bar } from './ui.js';
import { TEXT_SCALES, host } from './layout.js';
import { drawGood } from './icons.js';
import { portrait } from './figures.js';

export const ui = { hits: [], view: null };
export const docMetrics = { max: 0, view: 0, hit: null };
const cache = new Map();

// Layout of blocks into drawable ops at a given width and text scale.
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
      ops.push({ t: 'p', y, lines, size: bodyF, lh, h: lines.length * lh, dim: b.dim }); y += lines.length * lh + 12 * ts;
    } else if (b.li) {
      ctx.font = `500 ${bodyF}px ${UI}`; const ind = 34 * ts, lines = wrap(ctx, b.li, width - ind);
      ops.push({ t: 'li', y, lines, size: bodyF, lh, ind, h: lines.length * lh }); y += lines.length * lh + 8 * ts;
    } else if (b.fig) {
      const hh = b.hh * Math.min(ts, 1.5);
      ops.push({ t: 'fig', y, name: b.fig, arg: b.arg, h: hh }); y += hh + 16 * ts;
    } else if (b.card) {
      const c = b.card, isz = Math.round(112 * Math.min(ts, 1.5)), tw = width - isz - 34;
      const tf = 29 * ts, sf = 23 * ts;
      ctx.font = `800 ${tf}px ${UI}`; const tl = wrap(ctx, c.title, tw);
      ctx.font = `500 ${sf}px ${UI}`; const sl = c.sub ? wrap(ctx, c.sub, tw) : [];
      const bl = (c.lines ?? []).flatMap((s) => wrap(ctx, s, tw));
      const th = tl.length * tf * 1.2 + sl.length * sf * 1.3 + bl.length * sf * 1.35 + 20;
      const hh = Math.max(isz + 24, th + 24);
      ops.push({ t: 'card', y, c, tl, sl, bl, tf, sf, isz, h: hh }); y += hh + 12;
    } else if (b.sp) { y += 22 * ts; }
    else if (b.row) {
      const tsr = Math.min(ts, 1.6), ctl = b.kind === 'button' ? Math.min(width * 0.4, 280) : b.kind === 'stepper' ? 334 : b.kind === 'toggle' ? 128 : 170, tw = Math.max(width * 0.3, width - ctl - 46);
      const lf = 28 * tsr, hf = 20 * tsr; ctx.font = `700 ${lf}px ${UI}`; const ll = wrap(ctx, b.label, tw);
      ctx.font = `500 ${hf}px ${UI}`; const hl = b.hint ? wrap(ctx, b.hint, tw) : [];
      const rh = Math.max(86, ll.length * lf * 1.2 + hl.length * hf * 1.25 + 34, 56 * Math.min(ts, 1.8) + 30);
      ops.push({ t: 'row', y, b, h: rh, ll, hl, lf, hf }); y += rh + 10;
    } else if (b.chips) {
      ops.push({ t: 'chips', y, list: b.chips, h: 70 * Math.min(ts, 1.5) }); y += 70 * Math.min(ts, 1.5) + 10;
    }
  }
  return { ops, total: y };
}

export function renderDoc(ctx, st, L, doc, figs = {}) {
  const D = L.doc, ts = TEXT_SCALES[st.prefs.textIdx] ?? 1, t = st.t;
  ui.hits = [];
  button(ctx, D.back, doc.backLabel ?? 'Back', { icon: 'back', kind: 'ghost', size: 28 }); ui.hits.push({ id: 'back', r: D.back });
  button(ctx, D.textDec, 'A-', { kind: st.prefs.textIdx > 0 ? 'quiet' : 'disabled', size: 28 }); ui.hits.push({ id: 'textDec', r: D.textDec });
  button(ctx, D.textInc, 'A+', { kind: st.prefs.textIdx < TEXT_SCALES.length - 1 ? 'quiet' : 'disabled', size: 28 }); ui.hits.push({ id: 'textInc', r: D.textInc });
  txt(ctx, doc.title, D.viewport.x + D.viewport.w / 2, D.titleY, 38, PAL.gold, { align: 'center', font: DISPLAY, weight: 700, maxW: D.viewport.w - 20, stroke: 6 });
  let vp = doc.nav ? D.viewport : D.viewportFull;
  if (doc.nav) {
    button(ctx, D.nav.back, 'Previous', { icon: 'back', kind: doc.page > 0 ? 'quiet' : 'disabled', size: 26 }); button(ctx, D.nav.next, doc.page < doc.pages - 1 ? 'Next' : 'Done', { kind: 'primary', size: 28 });
    ui.hits.push({ id: 'prev', r: D.nav.back }, { id: 'next', r: D.nav.next });
    txt(ctx, `Page ${doc.page + 1} of ${doc.pages}`, (D.nav.back.x + D.nav.back.w + D.nav.next.x) / 2, D.nav.back.y + D.nav.back.h / 2, 24, PAL.dim, { align: 'center', weight: 600 });
  }
  let extra = 0;
  if (doc.tabs) {   // tab strip above the viewport
    const th = Math.max(56, L.mb), n = doc.tabs.length, gap = 10, w = (vp.w - gap * (n - 1)) / n;
    doc.tabs.forEach((tb, i) => { const r = { x: vp.x + i * (w + gap), y: vp.y, w, h: th }; button(ctx, r, tb.label, { kind: tb.id === doc.tab ? 'primary' : 'quiet', size: 26, noShadow: true }); ui.hits.push({ id: 'tab:' + tb.id, r }); });
    extra = th + 12;
  }
  const view = { x: vp.x, y: vp.y + extra, w: vp.w, h: vp.h - extra };
  panel(ctx, view, { fill: 'rgba(18,11,7,0.8)', rad: 22 });
  const padX = 22, innerW = view.w - padX * 2 - 18;
  const key = `${doc.key}|${Math.round(innerW)}|${ts}|${doc.rev ?? 0}`;
  let lay = cache.get(key);
  if (!lay) { lay = layoutDoc(ctx, doc.blocks, innerW, ts); if (cache.size > 40) cache.clear(); cache.set(key, lay); }
  const max = Math.max(0, lay.total + 28 - view.h);
  docMetrics.max = max; docMetrics.view = view.h; docMetrics.hit = view;
  if (st.docRescale) { st.docScroll = st.docFrac * max; st.docRescale = false; }
  const scroll = Math.max(0, Math.min(st.docScroll, max)); st.docScroll = scroll;
  ctx.save(); rrect(ctx, view, 22); ctx.clip();
  ctx.translate(view.x + padX, view.y + 18 - scroll);
  for (const op of lay.ops) {
    if (op.y + op.h < scroll - 60 || op.y > scroll + view.h + 60) continue;
    if (op.t === 'h') { ctx.font = `800 ${op.size}px ${UI}`; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = PAL.gold; op.lines.forEach((ln, i) => ctx.fillText(ln, 0, op.y + i * op.size * 1.25)); }
    else if (op.t === 'p') { ctx.font = `500 ${op.size}px ${UI}`; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = op.dim ? PAL.dim : PAL.text; op.lines.forEach((ln, i) => ctx.fillText(ln, 0, op.y + i * op.lh)); }
    else if (op.t === 'li') {
      ctx.font = `500 ${op.size}px ${UI}`; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.beginPath(); ctx.fillStyle = PAL.amber; ctx.arc(10 * ts, op.y + op.lh * 0.5, 5 * ts + 1, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = PAL.text;
      op.lines.forEach((ln, i) => ctx.fillText(ln, op.ind, op.y + i * op.lh));
    } else if (op.t === 'fig') { ctx.save(); figs[op.name]?.(ctx, 0, op.y, innerW, op.h, op.arg, t); ctx.restore(); }
    else if (op.t === 'card') drawCard(ctx, op, innerW, figs, t);
    else if (op.t === 'chips') { let cx = 0; ctx.font = `700 ${24 * Math.min(ts, 1.5)}px ${UI}`; for (const c of op.list) { const r = chip(ctx, cx, op.y + op.h / 2, c.label, 24 * Math.min(ts, 1.5), { fill: c.fill ?? 'rgba(255,240,215,0.12)', color: c.color }); cx += r.w + 8; } }
    else if (op.t === 'row') drawRow(ctx, op, innerW, view, padX, scroll, ts);
  }
  ctx.restore();
  if (max > 0) {
    const sb = { x: view.x + view.w - 12, y: view.y + 12, w: 6, h: view.h - 24 }, th = Math.max(40, sb.h * view.h / (lay.total + 28));
    ctx.fillStyle = 'rgba(255,240,215,0.12)'; rrect(ctx, sb, 3); ctx.fill();
    ctx.fillStyle = 'rgba(255,200,140,0.7)'; rrect(ctx, { x: sb.x, y: sb.y + (sb.h - th) * (scroll / max), w: sb.w, h: th }, 3); ctx.fill();
  }
  ui.view = view;
}

function drawCard(ctx, op, innerW, figs, t) {
  const c = op.c, isz = op.isz, y = op.y;
  ctx.fillStyle = 'rgba(255,240,215,0.06)'; rrect(ctx, { x: 0, y, w: innerW, h: op.h }, 16); ctx.fill();
  const ix = 12, iy = y + 12, box = { x: ix, y: iy, w: isz, h: isz };
  ctx.save(); rrect(ctx, box, 14); ctx.clip();
  if (c.icon === 'portrait') portrait(ctx, ix + isz / 2, iy + isz / 2, isz, c.look, {});
  else if (c.icon === 'good') { const g = ctx.createLinearGradient(ix, iy, ix, iy + isz); g.addColorStop(0, '#5a3f2a'); g.addColorStop(1, '#2b1c12'); ctx.fillStyle = g; ctx.fillRect(ix, iy, isz, isz); drawGood(ctx, c.id, ix + isz / 2, iy + isz / 2, isz * 0.8); }
  else if (c.icon === 'city') figs.city?.(ctx, box, c.id, c.dim, t);
  else if (c.icon === 'locked') { ctx.fillStyle = 'rgba(255,240,215,0.08)'; ctx.fillRect(ix, iy, isz, isz); icon(ctx, 'lock', ix + isz / 2, iy + isz / 2, isz * 0.22, PAL.dim); }
  ctx.restore();
  if (c.icon === 'portrait') { ctx.lineWidth = 2; ctx.strokeStyle = PAL.gold; rrect(ctx, box, 14); ctx.stroke(); }
  const tx = ix + isz + 18; let ty = y + 14;
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.font = `800 ${op.tf}px ${UI}`; ctx.fillStyle = c.dim ? PAL.dim : PAL.gold; op.tl.forEach((ln) => { ctx.fillText(ln, tx, ty); ty += op.tf * 1.2; });
  ctx.font = `600 ${op.sf}px ${UI}`; ctx.fillStyle = PAL.dim; op.sl.forEach((ln) => { ctx.fillText(ln, tx, ty); ty += op.sf * 1.3; });
  ctx.font = `500 ${op.sf}px ${UI}`; ctx.fillStyle = PAL.text; op.bl.forEach((ln) => { ctx.fillText(ln, tx, ty + 4); ty += op.sf * 1.35; });
}

function drawRow(ctx, op, innerW, view, padX, scroll, ts) {
  const b = op.b, r = { x: 0, y: op.y, w: innerW, h: op.h }, tsr = Math.min(ts, 1.6);
  ctx.fillStyle = 'rgba(255,240,215,0.07)'; rrect(ctx, r, 18); ctx.fill();
  { const th = op.ll.length * op.lf * 1.2 + op.hl.length * op.hf * 1.25; let ty = op.y + (op.h - th) / 2;
    for (const ln of op.ll) { txt(ctx, ln, 20, ty + op.lf * 0.6, op.lf, PAL.text, { weight: 700 }); ty += op.lf * 1.2; }
    for (const ln of op.hl) { txt(ctx, ln, 20, ty + op.hf * 0.62, op.hf, PAL.dim, { weight: 500 }); ty += op.hf * 1.25; } }
  const val = b.val?.();
  const sx = view.x + padX, sy = view.y + 18 - scroll;
  const screenR = (rr) => ({ x: sx + rr.x, y: sy + rr.y, w: rr.w, h: rr.h });
  if (b.kind === 'toggle') {
    const tw = 108, th = 52, tr = { x: innerW - tw - 20, y: op.y + (op.h - th) / 2, w: tw, h: th };
    ctx.fillStyle = val ? '#27a79d' : 'rgba(255,255,255,0.16)'; rrect(ctx, tr, th / 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(val ? tr.x + tw - th / 2 : tr.x + th / 2, tr.y + th / 2, th / 2 - 5, 0, Math.PI * 2); ctx.fill();
    ui.hits.push({ id: 'set:' + b.row, r: screenR(r), clip: view });
  } else if (b.kind === 'cycle') {
    txt(ctx, String(val), innerW - 24, op.y + op.h / 2, 28 * tsr, PAL.gold, { align: 'right', weight: 800, maxW: innerW * 0.4 });
    ui.hits.push({ id: 'set:' + b.row, r: screenR(r), clip: view });
  } else if (b.kind === 'stepper') {
    const bw = 72, dec = { x: innerW - 20 - bw * 2 - 150, y: op.y + (op.h - 64) / 2, w: bw, h: 64 }, inc = { x: innerW - 20 - bw, y: dec.y, w: bw, h: 64 };
    button(ctx, dec, '-', { kind: 'quiet', size: 34, noShadow: true }); button(ctx, inc, '+', { kind: 'quiet', size: 34, noShadow: true });
    txt(ctx, String(val), dec.x + bw + 75, op.y + op.h / 2, 26 * Math.min(ts, 1.4), PAL.gold, { align: 'center', weight: 800, maxW: 140 });
    ui.hits.push({ id: 'set:' + b.row + 'Dec', r: screenR(dec), clip: view }, { id: 'set:' + b.row + 'Inc', r: screenR(inc), clip: view });
  } else if (b.kind === 'button') {
    const bw = Math.min(innerW * 0.4, 280), br = { x: innerW - bw - 20, y: op.y + (op.h - 66) / 2, w: bw, h: 66 };
    button(ctx, br, b.btn ?? 'Open', { kind: b.danger ? 'danger' : 'primary', size: 26, noShadow: true });
    ui.hits.push({ id: 'set:' + b.row, r: screenR(br), clip: view });
  }
}
