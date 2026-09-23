// Geometry. The board is a plane seen from a little above: board coordinates (u, v) in -3..3 (outer square = +-3, middle = +-2,
// inner = +-1; v = -3 is the far side). A true projective map, so straight lines stay straight. Virtual canvas 720 x 1560.
import { POINT_UV } from './morabaraba.js';

export const W = 720, H = 1560;
const CX = 360, D = 93, K = 0.032, HGT = 3200, Y_NEAR = 1070, Y_H = Y_NEAR - HGT;

export function project(u, v) {
  const z = 1 + K * (3 - v);
  return { x: CX + (u * D) / z, y: Y_H + HGT / z, s: 1 / z };
}
export const pointAt = (i) => project(POINT_UV[i][0], POINT_UV[i][1]);
export const COW_R = 35;                 // half the width of a cow token at the near edge

// The two pens (12 slots each): the opponent's above the board, the player's below it.
export const PEN = { top: { x: 36, y: 356, w: 648, h: 84 }, bottom: { x: 36, y: 1160, w: 648, h: 84 } };
export const penSlot = (which, i) => ({ x: PEN[which].x + 52 + i * 49.5, y: PEN[which].y + 52, s: 1 });
export const MSG = { x: 30, y: 1262, w: 660, h: 176 };

export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export const BTN = {
  menu: { x: 46, y: 1462, w: 200, h: 76 }, undo: { x: 260, y: 1462, w: 200, h: 76 }, hint: { x: 474, y: 1462, w: 200, h: 76 },
  again: { x: 130, y: 900, w: 460, h: 96 }, back: { x: 130, y: 1016, w: 460, h: 84 }, share: { x: 130, y: 1120, w: 460, h: 84 },
  next: { x: 130, y: 1462, w: 460, h: 76 }, prev: { x: 46, y: 1462, w: 200, h: 76 }, nextPage: { x: 474, y: 1462, w: 200, h: 76 },
};
// Text-size stepper for the How to play / About / Rules reference pages: a header row above the
// heading, clear of the Menu/Back/Next buttons in the footer. "A-"/"A+" on all three screens.
export const TEXT_STEPPER = { dec: { x: 40, y: 24, w: 120, h: 62 }, inc: { x: W - 160, y: 24, w: 120, h: 62 } };
// The info-page footer always spans the same x=46..674 strip: Menu is always present, Back only
// once you're past page 1, Next only before the last page - 3 equal pills, or 2 wider ones on the
// first/last page, never a lopsided pair with Back's slot left as dead space in the middle (which
// is what happened before: Menu and Next stayed pinned to their 3-button positions even with no
// Back between them).
export function infoFooterRects(hasBack, hasNext) {
  const X0 = 46, SPAN = 628, GAP = 14, Y = 1462, H = 76;
  const n = 1 + (hasBack ? 1 : 0) + (hasNext ? 1 : 0);
  const w = (SPAN - GAP * (n - 1)) / n;
  let x = X0;
  const next = () => { const r = { x, y: Y, w, h: H }; x += w + GAP; return r; };
  return { menu: next(), back: hasBack ? next() : null, next: hasNext ? next() : null };
}
// Index into this, never a raw float, so the stepper can cleanly disable at either end and a stale
// saved index (e.g. from a build with a shorter array) always clamps instead of producing NaN sizes.
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
// Auto Play (Watch & Learn): think-time steps in seconds, hard-capped at 10s. An index into this
// array (same pattern as TEXT_SCALES), never a raw float. The stepper reuses TEXT_STEPPER's own
// position/style - never shown on the same scene as the text-size stepper, so no clash.
export const AUTO_THINK_STEPS = [2, 5, 8, 10];
export const AUTO_REVEAL_SECONDS = 2;
// Title screen: rows depend on whether an unfinished game is saved.
export function titleRows(hasSave) {
  const out = {}; let y = 740;
  const full = (n) => { out[n] = { x: 80, y, w: 560, h: 66 }; y += 76; };
  const pair = (a, b) => { out[a] = { x: 80, y, w: 272, h: 60 }; out[b] = { x: 368, y, w: 272, h: 60 }; y += 68; };
  // Auto Play is the addition: the last row grew from a 2-column pair (About/Rules) to a 3-column
  // trio (About/Rules/Auto Play), same total span (x=80..640) and same y - every row above (and the
  // badges row drawn below it, at RW.about.y + 100) keeps its exact position, unchanged.
  const trio = (a, b, c) => { const gap = 14, colw = (560 - gap * 2) / 3; out[a] = { x: 80, y, w: colw, h: 60 }; out[b] = { x: 80 + colw + gap, y, w: colw, h: 60 }; out[c] = { x: 80 + 2 * (colw + gap), y, w: colw, h: 60 }; y += 68; };
  if (hasSave) full('resume');
  full('learn'); pair('dark', 'light'); full('two'); full('daily'); y += 6;
  pair('level', 'sound'); pair('marks', 'calm'); pair('big', 'howto'); trio('about', 'rules', 'auto');
  return out;
}
// Which board point a tap means: the nearest point (or the cow standing on it).
export function pointNear(x, y) {
  let best = -1, bd = Infinity;
  for (let i = 0; i < 24; i++) { const p = pointAt(i), d = Math.min(Math.hypot(p.x - x, p.y - y), Math.hypot(p.x - x, p.y - 22 * p.s - y)); if (d < bd) { bd = d; best = i; } }
  return bd < 58 ? best : -1;
}
