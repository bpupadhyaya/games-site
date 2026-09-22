// Geometry. Virtual canvas 720 x 1560. Grid offsets (x right, y down) are measured in squares from the centre square.
import { geo } from './rules.js';

export const W = 720;
export const H = 1560;
export const BOARD = { cx: 360, cy: 650, S: 680 };   // the cloth's square footprint (centre and side)
export const MAT = { x: 46, y: 1032, w: 628, h: 322 }; // the throwing rug
export const cellSize = (mode) => BOARD.S / (geo(mode).R * 2 + 4);

// rotate an offset a quarter-turns anticlockwise (as seen on screen): bottom arm -> right arm -> top -> left
export function rot(x, y, a) { for (let k = 0; k < a; k++) { const t = x; x = y; y = -t; } return [x, y]; }

// screen point of a grid offset
export function gridXY(mode, x, y) { const cs = cellSize(mode); return { x: BOARD.cx + x * cs, y: BOARD.cy + y * cs }; }

// offset (in squares) of outer square t
export function trackOffset(mode, t) {
  const G = geo(mode), a = Math.floor(t / G.A), j = t % G.A, R = G.R;
  let u, v;
  if (j < R) { u = -1; v = j + 1; } else if (j === R) { u = 0; v = R; } else { u = 1; v = 2 * R + 1 - j; }
  return rot(u, v + 1, a);
}
export const homeOffset = (mode, arm, row) => rot(0, row + 1, arm);
export const yardOffset = (mode, arm) => { const R = geo(mode).R, d = R / 2 + 1.75; return rot(-d, d, arm); };
export const yardSlot = (mode, arm, k) => { const [x, y] = yardOffset(mode, arm), s = 1.15, o = [[-s, -s], [s, -s], [-s, s], [s, s]][k % 4]; return [x + o[0], y + o[1]]; };
export const centreSlot = (mode, arm, k) => { const [x, y] = rot(-0.3 + (k % 2) * 0.6, 0.62 + Math.floor(k / 2) * 0.0, arm); return [x, y]; };

// where a pawn (player pl, pawn i) stands when at position p (screen point + lift-free)
export function posXY(g, pl, i, p) {
  const G = geo(g.mode), arm = g.players[pl].arm;
  let o;
  if (p < 0) o = yardSlot(g.mode, arm, i);
  else if (p < G.T) o = trackOffset(g.mode, (G.A * arm + G.R + 1 + p) % G.T);
  else if (p < G.END) o = homeOffset(g.mode, arm, G.R - 1 - (p - G.T));
  else o = centreSlot(g.mode, arm, i);
  return gridXY(g.mode, o[0], o[1]);
}

// the squares a hopping pawn crosses, in screen points
export function hopPath(g, pl, i, from, to) {
  if (from < 0) return [posXY(g, pl, i, from), posXY(g, pl, i, 0)];
  const pts = [posXY(g, pl, i, from)];
  for (let p = from + 1; p <= to; p++) pts.push(posXY(g, pl, i, p));
  return pts;
}

// generic button hit test
export const inRect = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
