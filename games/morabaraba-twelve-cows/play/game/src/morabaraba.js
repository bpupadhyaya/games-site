// Morabaraba: 24 points on three nested squares (rings 0 outer, 1 middle, 2 inner), joined by four midpoint lines and four
// corner diagonals. Point index = ring * 8 + k, k = 0..7 clockwise from the top-left corner (even k = corner, odd = midpoint).
import { createMillRules } from './millfamily.js';

const adj = Array.from({ length: 24 }, () => []), mills = [];
const link = (a, b) => { adj[a].push(b); adj[b].push(a); };
for (let r = 0; r < 3; r++) {
  for (let k = 0; k < 8; k++) link(r * 8 + k, r * 8 + ((k + 1) % 8));
  for (let k = 0; k < 8; k += 2) mills.push([r * 8 + k, r * 8 + k + 1, r * 8 + ((k + 2) % 8)]);
}
for (let k = 0; k < 8; k++) {                       // odd k: the four "spokes"; even k: the four corner diagonals
  for (let r = 0; r < 2; r++) link(r * 8 + k, (r + 1) * 8 + k);
  mills.push([k, 8 + k, 16 + k]);
}
adj.forEach((a) => a.sort((x, y) => x - y));

export const MORABARABA = { name: 'Morabaraba', n: 24, adj, mills, cows: 12, flyAt: 3, minCows: 3, fullBoard: 'draw', drawPlies: 40, repeats: 3 };
export const RULES = createMillRules(MORABARABA);
// board-space position of a point: u, v in -3..3 (outer square is +-3, middle +-2, inner +-1)
const RING_XY = [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]];
export const POINT_UV = Array.from({ length: 24 }, (_, i) => { const r = Math.floor(i / 8), [x, y] = RING_XY[i % 8]; return [x * (3 - r), y * (3 - r)]; });
export const POINT_NAMES = Array.from({ length: 24 }, (_, i) => `${['outer', 'middle', 'inner'][Math.floor(i / 8)]} ${['top-left', 'top', 'top-right', 'right', 'bottom-right', 'bottom', 'bottom-left', 'left'][i % 8]}`);
