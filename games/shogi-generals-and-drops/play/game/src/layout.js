// Geometry. Virtual canvas 720 x 1560. Board cell size depends on the variant (9x9 or 5x5).
export const W = 720, H = 1560;

export function geom(n) {
  const cell = n === 9 ? 68 : 122, gw = cell * n, gx = (W - gw) / 2, gy = 372 + (612 - gw) / 2;
  return { n, cell, gw, gx, gy, slab: { x: gx - 26, y: gy - 30, w: gw + 52, h: gw + 56 }, thick: 34 };
}
// board square (r,c) -> screen point, honouring the view flip (human plays Gote => the board is turned round)
export function sqCenter(g, sq, flip) {
  const r = (sq / g.n) | 0, c = sq % g.n, rr = flip ? g.n - 1 - r : r, cc = flip ? g.n - 1 - c : c;
  return { x: g.gx + (cc + 0.5) * g.cell, y: g.gy + (rr + 0.5) * g.cell };
}
export function sqAt(g, x, y, flip) {
  const cc = Math.floor((x - g.gx) / g.cell), rr = Math.floor((y - g.gy) / g.cell);
  if (cc < 0 || rr < 0 || cc >= g.n || rr >= g.n) return -1;
  const r = flip ? g.n - 1 - rr : rr, c = flip ? g.n - 1 - cc : cc;
  return r * g.n + c;
}
// Stands (komadai): top = opponent's, bottom = yours.
export const STAND = { top: { x: 30, y: 196, w: 660, h: 104 }, bot: { x: 30, y: 1090, w: 660, h: 104 } };
export const STAND_ORDER = [7, 6, 5, 4, 3, 2, 1];    // rook, bishop, gold, silver, knight, lance, pawn
export function standSlot(which, i, count) {          // centre of the i-th slot (0..6)
  const s = STAND[which], gap = (s.w - 60) / 7;
  return { x: s.x + 30 + gap * (i + 0.5), y: s.y + s.h / 2 + 4 };
}
export const inRect = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// Text-size steps for the reference pages (About/How to play/Rules). Index into this, never a raw
// float, so "min"/"max" are exact and the stepper can cleanly disable at either end. Every page's
// content is paced (content.js) to fit comfortably even at the top step.
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];

// Auto Play (Watch & Learn) think-time steps, in seconds. Index into this, same pattern as
// TEXT_SCALES above - never a raw float, so the +/- stepper can cleanly disable at either end.
// Hard-capped at 10s per the owner's explicit instruction (a longer wait defeats the point of a
// short, timed "guess before you're shown" loop). Default index 1 (5s).
export const THINK_STEPS = [2, 5, 8, 10];
