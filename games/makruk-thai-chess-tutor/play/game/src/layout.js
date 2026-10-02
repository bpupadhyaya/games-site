// Screen geometry: every rectangle in one place so game.js (hit-testing) and view.js (drawing) never disagree.
// Virtual resolution 720 x 1560 (tall portrait). Rank 8 is at the top of the board for Gold; flip shows Ruby from below.
export const W = 720, H = 1560;

export const SQ = 78, FRAME = 30;
export const GRID = SQ * 8; // 624
export const BOARD = { x: (W - (GRID + FRAME * 2)) / 2, y: 190, w: GRID + FRAME * 2, h: GRID + FRAME * 2 }; // 684 square
export const GX = BOARD.x + FRAME, GY = BOARD.y + FRAME;
export const PIECE_K = 0.74; // sprite units -> pixels

// square <-> screen. `flip` shows Ruby at the bottom (board turned 180 degrees).
export function squareXY(s, flip) {
  let f = s & 7, r = s >> 3;
  if (flip) { f = 7 - f; r = 7 - r; }
  return { x: GX + f * SQ, y: GY + (7 - r) * SQ };
}
export function squareCentre(s, flip) { const q = squareXY(s, flip); return { x: q.x + SQ / 2, y: q.y + SQ / 2 }; }
// the point where a piece stands (bottom centre of its square)
export function squareFoot(s, flip) { const q = squareXY(s, flip); return { x: q.x + SQ / 2, y: q.y + SQ - 8 }; }
export function squareAt(x, y, flip) {
  if (x < GX || x >= GX + GRID || y < GY || y >= GY + GRID) return -1;
  let f = Math.floor((x - GX) / SQ), r = 7 - Math.floor((y - GY) / SQ);
  if (flip) { f = 7 - f; r = 7 - r; }
  return r * 8 + f;
}
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// ---- header / play screen -------------------------------------------------------------------------------------
export const HDR = {
  menu: { x: 18, y: 18, w: 120, h: 62 },
  sound: { x: W - 138, y: 18, w: 120, h: 62 },
};
export const PLATE_TOP = { x: 18, y: 104, w: W - 36, h: 70 };
export const PLATE_BOT = { x: 18, y: BOARD.y + BOARD.h + 16, w: W - 36, h: 70 };
export const COUNT = { x: 18, y: PLATE_BOT.y + 86, w: W - 36, h: 104 };
export const MSG = { x: 24, y: COUNT.y + COUNT.h + 14, w: W - 48, h: 130 };
export const BAR_Y = MSG.y + MSG.h + 16, BAR_H = 108;
const bw4 = (W - 24 * 2 - 14 * 3) / 4;
const slot4 = (i) => ({ x: 24 + i * (bw4 + 14), y: BAR_Y, w: bw4, h: BAR_H });
export const BTN = { undo: slot4(0), hint: slot4(1), threat: slot4(2), end: slot4(3) };
export const INFO_STRIP = { x: 24, y: BAR_Y + BAR_H + 16, w: W - 48, h: 44 };
export const PROMO_BANNER = { x: BOARD.x + 60, y: BOARD.y + BOARD.h / 2 - 60, w: BOARD.w - 120, h: 120 };

// ---- title screen ------------------------------------------------------------------------------------------------
export const TITLE_HERO = { x: 0, y: 0, w: W, h: 640 };
// `tall` (text size 250% and 300%): taller buttons and a wide How to Play row, so the big text has room.
export function titleRows(hasSaved, tall = false) {
  const bw = 620, x0 = (W - bw) / 2, gap = tall ? 12 : 16;
  let y = 654;
  const rows = {};
  if (tall) {
    const half = (bw - gap) / 2;
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
export const SETTINGS_ROWS = 7;
export const SETTINGS_ROW = (i, tall = false) => (tall ? { x: 40, y: 118 + i * 182, w: W - 80, h: 168 } : { x: 40, y: 140 + i * 138, w: W - 80, h: 118 });
export const SETTINGS_BACK = { x: 40, y: H - 150, w: W - 80, h: 104 };

// ---- watch & learn -----------------------------------------------------------------------------------------------
export const THINK_STEPS = [2, 5, 8, 10];
export const REVEAL_TIME = 2;
export const AUTO = {
  exit: { x: 24, y: BAR_Y, w: 150, h: BAR_H },
  pause: { x: 188, y: BAR_Y, w: 196, h: BAR_H },
  dec: { x: 398, y: BAR_Y, w: 100, h: BAR_H },
  val: { x: 498, y: BAR_Y, w: 98, h: BAR_H },
  inc: { x: 596, y: BAR_Y, w: 100, h: BAR_H },
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
  { slug: 'xiangqi-river-and-palace', title: 'Xiangqi' },
  { slug: 'shogi-generals-and-drops', title: 'Shogi' },
  { slug: 'go-stones-and-territory', title: 'Go' },
  { slug: 'chess-royal-sixty-four', title: 'Chess' },
];
export const chipRect = (i, y0) => ({ x: 60 + (i % 2) * 300, y: y0 + Math.floor(i / 2) * 78, w: 280, h: 64 });
