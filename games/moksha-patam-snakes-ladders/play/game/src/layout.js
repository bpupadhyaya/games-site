// Screen geometry in one place so game.js (hit-testing) and view.js (drawing) never disagree.
// Virtual resolution 720 x 1280 portrait (docs/GAME-CONTRACT.md).
import { cellOf } from './rules.js';

export const W = 720, H = 1280;

export const FRAME = 34;                 // painted border thickness
export const CELL = 60;
export const GRID = CELL * 10;           // 600
export const BOARD_SIZE = GRID + FRAME * 2;   // 668
export const BOARD_X = (W - BOARD_SIZE) / 2;  // 26
export const BOARD_Y = 112;
export const GRID_X = BOARD_X + FRAME;
export const GRID_Y = BOARD_Y + FRAME;
export const BOARD_BOTTOM = BOARD_Y + BOARD_SIZE; // 780

export function squareXY(n) {
  if (n <= 0) return null;
  const { col, row } = cellOf(n);
  return { x: GRID_X + col * CELL + CELL / 2, y: GRID_Y + (9 - row) * CELL + CELL / 2 };
}
// Pawns that have not entered yet wait on the painted bottom border.
export function startXY(i) { return { x: GRID_X + 34 + i * 40, y: GRID_Y + GRID + FRAME / 2 + 1 }; }
export function posXY(n, i) { return n <= 0 ? startXY(i) : squareXY(n); }
export function squareAt(x, y) {
  if (x < GRID_X || x >= GRID_X + GRID || y < GRID_Y || y >= GRID_Y + GRID) return -1;
  const col = Math.floor((x - GRID_X) / CELL), row = 9 - Math.floor((y - GRID_Y) / CELL);
  return row * 10 + (row % 2 === 0 ? col : 9 - col) + 1;
}

export const inRect = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// ---- the play screen ------------------------------------------------------------------------------
export const HEAD = {
  menu: { x: 16, y: 14, w: 120, h: 70 },
  sound: { x: W - 136, y: 14, w: 120, h: 70 },
};
export const CHIPS_Y = BOARD_BOTTOM + 12;      // 792: player chips row
export const CHIP_H = 74;
export const MSG = { x: 20, y: CHIPS_Y + CHIP_H + 10, w: W - 40, h: 98 };   // caption / message panel
export const TABLE = { x: 20, y: MSG.y + MSG.h + 10, w: W - 40, h: 196 };    // where the dice are tossed
export const BAR_Y = TABLE.y + TABLE.h + 12;
export const BAR_H = H - BAR_Y - 14;
export const BAR = {
  menu: { x: 20, y: BAR_Y, w: 150, h: BAR_H },
  roll: { x: 186, y: BAR_Y, w: 348, h: BAR_H },
  hint: { x: 550, y: BAR_Y, w: 150, h: BAR_H },
};
export const DIE_HOME = { x: W / 2, y: TABLE.y + TABLE.h / 2 + 4 };
export function chipRect(i, n) {
  const gap = 10, w = (W - 40 - gap * (n - 1)) / n;
  return { x: 20 + i * (w + gap), y: CHIPS_Y, w, h: CHIP_H };
}
// Watch & Learn control row: Exit | Think- | Pause | Think+ | Speed
export const DEMO_BAR = {
  exit: { x: 16, y: BAR_Y, w: 118, h: BAR_H },
  tdec: { x: 146, y: BAR_Y, w: 96, h: BAR_H },
  pause: { x: 254, y: BAR_Y, w: 212, h: BAR_H },
  tinc: { x: 478, y: BAR_Y, w: 96, h: BAR_H },
  speed: { x: 586, y: BAR_Y, w: 118, h: BAR_H },
};
export const THINK_STEPS = [2, 3, 5, 8, 10];

// ---- text zoom -----------------------------------------------------------------------------------------
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const ZOOM_DEC = { x: 16, y: 14, w: 110, h: 64 };
export const ZOOM_INC = { x: W - 126, y: 14, w: 110, h: 64 };
export const REF_BACK = { x: 20, y: 1164, w: 332, h: 100 };
export const REF_NEXT = { x: 368, y: 1164, w: 332, h: 100 };
export const LIST_TOP = 92, LIST_BOTTOM = H - 10;
