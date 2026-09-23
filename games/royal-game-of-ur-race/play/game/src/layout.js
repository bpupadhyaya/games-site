// Geometry. The board is seen from above with its long axis running up the screen: three lanes (left = side 0, the
// player; middle = shared; right = side 1) and eight rows (row 0 nearest the player). Virtual canvas 720 x 1560.
import { cellOf, PIECES, HOME } from './rules.js';
export const W = 720, H = 1560;
export const CW = 156, CH = 122, X0 = 126, YB = 1306, YT = YB - 8 * CH;     // board: x 126..594, y 330..1306
export const cellRect = (lane, c) => ({ x: X0 + lane * CW, y: YB - (c + 1) * CH, w: CW, h: CH });
export const cellCenter = (lane, c) => ({ x: X0 + lane * CW + CW / 2, y: YB - c * CH - CH / 2 });
export const isPlayable = (lane, c) => lane === 1 || c <= 3 || c >= 6;      // the two pieces of the board and the bridge between them
export const squareAt = (side, p) => { const q = cellOf(side, p); return q ? cellCenter(q.lane, q.c) : null; };
export const PIECE_R = 40;

// Where pieces wait (beside their start block) and where borne-off pieces are stacked (beside the far block).
export const reservePos = (side, k) => ({ x: side === 0 ? 64 : W - 64, y: YB - 44 - k * 62 });
export const homePos = (side, k) => ({ x: (side === 0 ? 34 : W - 34) + (side === 0 ? 1 : -1) * (k % 2) * 46, y: YT + 34 + Math.floor(k / 2) * 56 });
export const RESERVE_RECT = (side) => ({ x: side === 0 ? 8 : W - 118, y: YB - 470, w: 110, h: 476 });
export const HOME_RECT = (side) => ({ x: side === 0 ? 8 : W - 118, y: YT - 4, w: 110, h: 250 });
export const DICE = { x: 60, y: 1338, w: 600, h: 102 };
export const dieCenter = (k) => ({ x: 132 + k * 96, y: 1392 });

export const BTN = {
  menu: { x: 60, y: 1462, w: 190, h: 72 }, undo: { x: 265, y: 1462, w: 190, h: 72 }, hint: { x: 470, y: 1462, w: 190, h: 72 },
  again: { x: 140, y: 900, w: 440, h: 96 }, back: { x: 140, y: 1016, w: 440, h: 84 }, share: { x: 140, y: 1120, w: 440, h: 84 },
  next: { x: 140, y: 1462, w: 440, h: 72 }, prev: { x: 60, y: 1462, w: 190, h: 72 },
};
const row = (i) => ({ x: 90, y: 790 + i * 76, w: 540, h: 66 });
export function titleRows(hasSave) {
  const names = (hasSave ? ['resume'] : []).concat(['learn', 'play', 'two', 'daily']), out = {};
  names.forEach((n, i) => { out[n] = row(i); });
  // About and Rules share the row "About the game" used to have alone, two even columns (Rules is
  // the addition) -- every other row keeps its exact original position, since this reuses the same
  // row index (names.length) "about" always occupied and the formula below is unchanged.
  const aboutRow = row(names.length), gap = 14, half = (aboutRow.w - gap) / 2;
  out.about = { x: aboutRow.x, y: aboutRow.y, w: half, h: aboutRow.h };
  out.rules = { x: aboutRow.x + half + gap, y: aboutRow.y, w: half, h: aboutRow.h };
  const y = 790 + (names.length + 1) * 76 + 6;
  out.level = { x: 90, y, w: 262, h: 60 }; out.sound = { x: 368, y, w: 262, h: 60 };
  out.big = { x: 90, y: y + 68, w: 262, h: 60 }; out.calm = { x: 368, y: y + 68, w: 262, h: 60 };
  return out;
}
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
// Which board cell a tap means (or null): { lane, c }
export function cellNear(x, y) {
  if (x < X0 || x > X0 + 3 * CW || y < YT || y > YB) return null;
  const lane = Math.min(2, Math.floor((x - X0) / CW)), c = Math.min(7, Math.floor((YB - y) / CH));
  return isPlayable(lane, c) ? { lane, c } : null;
}
// The resting slot of every off-board piece of one side (null for pieces on the board): waiting pieces stack beside the
// start block, borne-off pieces beside the far block.
export function restSlots(pos, s) {
  const out = []; let w = 0, h = 0;
  for (let i = 0; i < PIECES; i++) out[i] = pos[i] === 0 ? reservePos(s, w++) : pos[i] === HOME ? homePos(s, h++) : null;
  return out;
}
