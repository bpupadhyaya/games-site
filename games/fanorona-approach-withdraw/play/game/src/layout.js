// Screen geometry: every rectangle in one place so game.js (hit-testing) and view.js (drawing) never disagree.
// Virtual resolution 720 x 1560 (tall portrait). The board is drawn with its 9-point lines running UP the screen,
// so the two armies face each other across the width of the phone: yours on the left, theirs on the right.
import { ROWS, COLS, idx, rowOf, colOf } from './rules.js';
export const W = 720, H = 1560;

export const S = 120;                       // distance between neighbouring points
export const FRAME = 64;
export const GRID_W = (ROWS - 1) * S, GRID_H = (COLS - 1) * S; // 480 x 960
export const GX = (W - GRID_W) / 2, GY = 234;
export const BOARD = { x: GX - FRAME, y: GY - FRAME, w: GRID_W + FRAME * 2, h: GRID_H + FRAME * 2 };
export const STONE_R = 38;

// point <-> screen. `flip` rotates the board 180 degrees (so a Dark player also sees their army on the left).
export function pointXY(p, flip) {
  const r = rowOf(p), c = colOf(p);
  const rr = flip ? ROWS - 1 - r : r, cc = flip ? COLS - 1 - c : c;
  return { x: GX + rr * S, y: GY + (COLS - 1 - cc) * S };
}
export function pointAt(x, y, flip, tol = S * 0.5) {
  let best = -1, bd = tol;
  for (let p = 0; p < ROWS * COLS; p++) {
    const q = pointXY(p, flip), d = Math.hypot(q.x - x, q.y - y);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// ---- header / play screen -------------------------------------------------------------------------------------
export const HDR = {
  menu: { x: 18, y: 18, w: 120, h: 62 },
  sound: { x: W - 138, y: 18, w: 120, h: 62 },
  tallyL: { x: 18, y: 96, w: 330, h: 64 },
  tallyR: { x: W - 348, y: 96, w: 330, h: 64 },
};
export const MSG = { x: 24, y: BOARD.y + BOARD.h + 14, w: W - 48, h: 96 };       // y 1228 ..
const barY = MSG.y + MSG.h + 14;
export const BAR_Y = barY, BAR_H = 104;
const bw4 = (W - 24 * 2 - 14 * 3) / 4;
const slot4 = (i) => ({ x: 24 + i * (bw4 + 14), y: barY, w: bw4, h: BAR_H });
export const BTN = { undo: slot4(0), hint: slot4(1), danger: slot4(2), end: slot4(3) };
// choice panel (approach / withdraw) sits over the message panel
export const CHOICE = {
  approach: { x: 24, y: MSG.y, w: (W - 48 - 16) / 2, h: MSG.h },
  withdraw: { x: 24 + (W - 48 - 16) / 2 + 16, y: MSG.y, w: (W - 48 - 16) / 2, h: MSG.h },
};
export const INFO_STRIP = { x: 24, y: barY + BAR_H + 18, w: W - 48, h: 44 };

// ---- title screen ------------------------------------------------------------------------------------------------
export const TITLE_HERO = { x: 0, y: 0, w: W, h: 640 };
// `tall` (text size 250% and 300%): taller buttons and a wide How to Play row, so the big text has room.
export function titleRows(hasSaved, tall = false) {
  const bw = 620, x0 = (W - bw) / 2, gap = tall ? 12 : 16;
  let y = 654;
  if (tall) {
    const rows = {}, half = (bw - gap) / 2;
    if (hasSaved) { rows.resume = { x: x0, y, w: bw, h: 78 }; y += 78 + gap; }
    rows.play = { x: x0, y, w: bw, h: 134 }; y += 134 + gap;
    rows.two = { x: x0, y, w: half, h: 108 }; rows.learn = { x: x0 + half + gap, y, w: half, h: 108 }; y += 108 + gap;
    rows.watch = { x: x0, y, w: half, h: 108 }; rows.settings = { x: x0 + half + gap, y, w: half, h: 108 }; y += 108 + gap;
    rows.level = { x: x0, y, w: half, h: 100 }; rows.side = { x: x0 + half + gap, y, w: half, h: 100 }; y += 100 + gap;
    rows.howto = { x: x0, y, w: bw, h: 84 }; y += 84 + gap;
    rows.rules = { x: x0, y, w: half, h: 84 }; rows.about = { x: x0 + half + gap, y, w: half, h: 84 };
    rows.bottom = y + 84;
    return rows;
  }
  const half = (bw - gap) / 2, third = (bw - gap * 2) / 3;
  const rows = {};
  if (hasSaved) { rows.resume = { x: x0, y, w: bw, h: 84 }; y += 84 + gap; }
  rows.play = { x: x0, y, w: bw, h: 112 }; y += 112 + gap;
  rows.two = { x: x0, y, w: half, h: 92 }; rows.learn = { x: x0 + half + gap, y, w: half, h: 92 }; y += 92 + gap;
  rows.watch = { x: x0, y, w: half, h: 92 }; rows.settings = { x: x0 + half + gap, y, w: half, h: 92 }; y += 92 + gap;
  rows.level = { x: x0, y, w: half, h: 84 }; rows.side = { x: x0 + half + gap, y, w: half, h: 84 }; y += 84 + gap;
  rows.howto = { x: x0, y, w: third, h: 84 }; rows.rules = { x: x0 + third + gap, y, w: third, h: 84 }; rows.about = { x: x0 + (third + gap) * 2, y, w: third, h: 84 };
  rows.bottom = y + 84;
  return rows;
}
export const LIMIT = { panel: { x: 60, y: 420, w: W - 120, h: 520 }, btn: { x: 120, y: 810, w: W - 240, h: 90 } };
export const TITLE_SOUND = { x: W - 138, y: 18, w: 120, h: 62 };

// ---- reference pages (How to Play / About / Rules) ---------------------------------------------------------------
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const TEXT_DEC = { x: 20, y: 18, w: 130, h: 64 };
export const TEXT_INC = { x: W - 150, y: 18, w: 130, h: 64 };
export const REF_BACK = { x: 20, y: H - 150, w: 332, h: 104 };
export const REF_NEXT = { x: 368, y: H - 150, w: 332, h: 104 };
export const REF_PANEL = { x: 28, y: 100, w: W - 56, h: H - 100 - 176 };

// ---- settings ---------------------------------------------------------------------------------------------------
// `tall` (text size 250% and 300%): taller rows so the big labels and hints can wrap onto two lines.
export const SETTINGS_ROW = (i, tall = false) => (tall ? { x: 40, y: 118 + i * 182, w: W - 80, h: 168 } : { x: 40, y: 140 + i * 138, w: W - 80, h: 118 });
export const SETTINGS_BACK = { x: 40, y: H - 150, w: W - 80, h: 104 };

// ---- watch & learn -----------------------------------------------------------------------------------------------
export const THINK_STEPS = [2, 5, 8, 10];
export const REVEAL_TIME = 2;
const ay = BAR_Y;
export const AUTO = {
  exit: { x: 24, y: ay, w: 150, h: BAR_H },
  pause: { x: 188, y: ay, w: 196, h: BAR_H },
  dec: { x: 398, y: ay, w: 100, h: BAR_H },
  inc: { x: 596, y: ay, w: 100, h: BAR_H },
  val: { x: 498, y: ay, w: 98, h: BAR_H },
};

// ---- result overlay + learn -----------------------------------------------------------------------------------------
const RP = { x: 40, y: 150, w: W - 80, h: 1180 };
export const RESULT = {
  panel: RP,
  dec: { x: RP.x + 18, y: RP.y + 18, w: 96, h: 56 }, inc: { x: RP.x + RP.w - 114, y: RP.y + 18, w: 96, h: 56 },
  titleZone: { y: RP.y + 84, h: 170 }, art: { y: RP.y + 260, h: 210 }, subZone: { y: RP.y + 480, h: 230 },
  again: { x: RP.x + 40, y: RP.y + 725, w: RP.w - 80, h: 92 }, menu: { x: RP.x + 40, y: RP.y + 829, w: RP.w - 80, h: 92 },
  chipsY: RP.y + 985,
};
export const LEARN_BAR = {
  menu: { x: 24, y: BAR_Y, w: 150, h: BAR_H },
  hint: { x: 188, y: BAR_Y, w: 150, h: BAR_H },
  reset: { x: 352, y: BAR_Y, w: 150, h: BAR_H },
  next: { x: 516, y: BAR_Y, w: 180, h: BAR_H },
};
export const SIBLINGS = [
  { slug: 'tiger-and-goat', title: 'Tiger and Goat' },
  { slug: 'fox-and-geese', title: 'Fox and Geese' },
  { slug: 'mill-nine-mens-morris', title: "Nine Men's Morris" },
  { slug: 'kings-table-tafl', title: 'Tafl' },
];
export const chipRect = (i, y0) => ({ x: 60 + (i % 2) * 300, y: y0 + Math.floor(i / 2) * 78, w: 280, h: 64 });
export { idx };
