// An ink layer: the painted result for one sheet of paper (offscreen canvases, derived from stroke data, never part of the game state).
import { paintSamples, toneAlpha } from './brush.js';
import { paintSeal, mk } from './art.js';

export function makeLayer(pw, ph, res) {
  const ink = mk(pw * res, ph * res), live = mk(pw * res, ph * res);
  const L = { pw, ph, res, ink, live, ictx: ink ? ink.getContext('2d') : null, lctx: live ? live.getContext('2d') : null, liveFrom: 0, liveTone: 0.7, liveOn: false };
  for (const c of [L.ictx, L.lctx]) if (c) { c.setTransform(res, 0, 0, res, 0, 0); c.fillStyle = '#000'; }
  return L;
}
export function clearLayer(L) {
  if (!L.ictx) return;
  for (const c of [L.ictx, L.lctx]) { c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, L.ink.width, L.ink.height); c.setTransform(L.res, 0, 0, L.res, 0, 0); }
  L.liveFrom = 0; L.liveOn = false;
}
// Paint the samples of the stroke in progress that have not been painted yet.
export function liveUpdate(L, st, seed = 0) {
  if (!L.lctx) return;
  if (!L.liveOn) { L.liveOn = true; L.liveFrom = 0; L.liveTone = st.tone; }
  const from = Math.max(1, L.liveFrom - 1);
  paintSamples(L.lctx, st.s, from, seed);
  L.liveFrom = st.s.length; L.liveTone = st.tone;
}
export function liveCommit(L) {
  if (!L.ictx || !L.liveOn) { L.liveOn = false; return; }
  L.ictx.save(); L.ictx.setTransform(1, 0, 0, 1, 0, 0); L.ictx.globalAlpha = toneAlpha(L.liveTone); L.ictx.drawImage(L.live, 0, 0); L.ictx.restore();
  L.lctx.save(); L.lctx.setTransform(1, 0, 0, 1, 0, 0); L.lctx.clearRect(0, 0, L.live.width, L.live.height); L.lctx.restore();
  L.liveOn = false; L.liveFrom = 0;
}
export function stampSeal(L, seal) {
  if (!L.ictx) return;
  paintSeal(L.ictx, seal.k, seal.x, seal.y, seal.s, seal.r, seal.v ?? 3, L.res);
}
// Rebuild a layer from saved strokes and seals (gallery thumbnails, undo).
export function replay(L, strokes, seals) {
  clearLayer(L);
  strokes.forEach((st, i) => { L.liveOn = true; L.liveFrom = 0; L.liveTone = st.tone; paintSamples(L.lctx, st.s, 1, i * 13); L.liveFrom = st.s.length; liveCommit(L); });
  for (const s of seals ?? []) stampSeal(L, s);
}
// Draw the layer into `rect` (screen units). src = the part of the layer to show (page units). Multiply keeps the paper's grain visible through the ink.
export function drawLayer(ctx, L, rect, src = { x: 0, y: 0, w: L.pw, h: L.ph }) {
  if (!L.ink) return;
  ctx.save(); ctx.globalCompositeOperation = 'multiply';
  const sx = src.x * L.res, sy = src.y * L.res, sw = src.w * L.res, sh = src.h * L.res;
  ctx.drawImage(L.ink, sx, sy, sw, sh, rect.x, rect.y, rect.w, rect.h);
  if (L.liveOn) { ctx.globalAlpha = toneAlpha(L.liveTone); ctx.drawImage(L.live, sx, sy, sw, sh, rect.x, rect.y, rect.w, rect.h); }
  ctx.restore();
}
