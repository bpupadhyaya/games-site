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
// Index into this, never a raw float, so the stepper can cleanly disable at either end and a stale
// saved index (e.g. from a build with a shorter array) always clamps instead of producing NaN sizes.
export const TEXT_SCALES = [1, 1.15, 1.3];
// Title screen: rows depend on whether an unfinished game is saved.
export function titleRows(hasSave) {
  const out = {}; let y = 740;
  const full = (n) => { out[n] = { x: 80, y, w: 560, h: 66 }; y += 76; };
  const pair = (a, b) => { out[a] = { x: 80, y, w: 272, h: 60 }; out[b] = { x: 368, y, w: 272, h: 60 }; y += 68; };
  if (hasSave) full('resume');
  full('learn'); pair('dark', 'light'); full('two'); full('daily'); y += 6;
  pair('level', 'sound'); pair('marks', 'calm'); pair('big', 'howto'); pair('about', 'rules');
  return out;
}
// Which board point a tap means: the nearest point (or the cow standing on it).
export function pointNear(x, y) {
  let best = -1, bd = Infinity;
  for (let i = 0; i < 24; i++) { const p = pointAt(i), d = Math.min(Math.hypot(p.x - x, p.y - y), Math.hypot(p.x - x, p.y - 22 * p.s - y)); if (d < bd) { bd = d; best = i; } }
  return bd < 58 ? best : -1;
}
