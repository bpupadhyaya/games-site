// Geometry. Virtual canvas 720 x 1560. Grid offsets (x right, y down) are measured in squares from the centre square.
import { A, R, T, END } from './rules.js';

export const W = 720;
export const H = 1560;
export const BOARD = { cx: 360, cy: 640, S: 680 };     // the board's square footprint (centre and side)
export const TRAY = { x: 46, y: 1040, w: 628, h: 300 }; // the dice tray
export const CS = BOARD.S / (R * 2 + 4);                // one square, in pixels (34)
export const DICE_SPOTS = [{ x: 235, y: 1170 }, { x: 485, y: 1170 }];

export const inRect = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// rotate an offset a quarter-turns anticlockwise (as seen on screen): bottom arm -> right arm -> top -> left
export function rot(x, y, a) { for (let k = 0; k < a; k++) { const t = x; x = y; y = -t; } return [x, y]; }
export const gridXY = (x, y) => ({ x: BOARD.cx + x * CS, y: BOARD.cy + y * CS });

// offset (in squares) of outer square t
export function trackOffset(t) {
  const a = Math.floor(t / A), j = t % A;
  let u, v;
  if (j < R) { u = -1; v = j + 1; } else if (j === R) { u = 0; v = R; } else { u = 1; v = 2 * R + 1 - j; }
  return rot(u, v + 1, a);
}
export const homeOffset = (arm, row) => rot(0, row + 1, arm);
// the cárcel sits in the corner next to the arm's salida (bottom-right for the bottom arm, turning anticlockwise)
export const jailOffset = (arm) => { const d = R / 2 + 1.75; return rot(d, d, arm); };
export const jailSlot = (arm, k) => { const [x, y] = jailOffset(arm), s = 1.2, o = [[-s, -s], [s, -s], [-s, s], [s, s]][k % 4]; return [x + o[0], y + o[1]]; };
export const coronaSlot = (arm, k) => { const [x, y] = rot(-0.34 + (k % 2) * 0.68, 0.7 + Math.floor(k / 2) * 0.0, arm); return [x, y]; };

// where a piece (player pl, piece i) stands at position p (screen point of its foot)
export function posXY(g, pl, i, p) {
  const arm = g.players[pl].arm;
  let o;
  if (p < 0) o = jailSlot(arm, i);
  else if (p < T) o = trackOffset((A * arm + R + 1 + p) % T);
  else if (p < END) o = homeOffset(arm, R - 1 - (p - T));
  else o = coronaSlot(arm, i);
  return gridXY(o[0], o[1]);
}

// the squares a hopping piece crosses, in screen points
export function hopPath(g, pl, i, from, to) {
  if (from < 0) return [posXY(g, pl, i, from), posXY(g, pl, i, 0)];
  const pts = [posXY(g, pl, i, from)];
  for (let p = from + 1; p <= to; p++) pts.push(posXY(g, pl, i, p));
  return pts;
}
