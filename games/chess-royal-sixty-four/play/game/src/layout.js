// Screen geometry. One place for every rectangle so game.js (hit-testing) and view.js (drawing)
// never disagree. Virtual resolution: 720 x 1280 portrait (docs/GAME-CONTRACT.md).
export const W = 720, H = 1280;

export const HEADER_H = 128;
export const BOARD_TOP = 140;
export const FRAME = 26;           // the carved frame thickness, where coordinate labels live
export const SQ = 76;              // one square, in virtual pixels
export const INNER = SQ * 8;       // 608
export const BOARD_SIZE = INNER + FRAME * 2; // 660
export const BOARD_X = (W - BOARD_SIZE) / 2; // 30
export const BOARD_Y = BOARD_TOP;
export const GRID_X = BOARD_X + FRAME;
export const GRID_Y = BOARD_Y + FRAME;
export const BOARD_BOTTOM = BOARD_Y + BOARD_SIZE;

export const TRAY_TOP = BOARD_BOTTOM + 10;
export const TRAY_H = 46;
export const PANEL_TOP = TRAY_TOP + TRAY_H * 2 + 10;
export const PANEL_H = 148;
export const BAR_TOP = PANEL_TOP + PANEL_H + 12;
export const BAR_H = 118;

// square <-> pixel. `flip` = true shows Black at the bottom (board rotated 180 degrees).
export function squareAt(x, y, flip) {
  if (x < GRID_X || x >= GRID_X + INNER || y < GRID_Y || y >= GRID_Y + INNER) return -1;
  let file = Math.floor((x - GRID_X) / SQ);
  let rankFromTop = Math.floor((y - GRID_Y) / SQ);
  let rank = 7 - rankFromTop;
  if (flip) { file = 7 - file; rank = 7 - rank; }
  if (file < 0 || file > 7 || rank < 0 || rank > 7) return -1;
  return rank * 8 + file;
}
export function pointXY(sq, flip) {
  let file = sq & 7, rank = sq >> 3;
  if (flip) { file = 7 - file; rank = 7 - rank; }
  const rankFromTop = 7 - rank;
  return { x: GRID_X + file * SQ + SQ / 2, y: GRID_Y + rankFromTop * SQ + SQ / 2 };
}
export function squareTopLeft(sq, flip) {
  let file = sq & 7, rank = sq >> 3;
  if (flip) { file = 7 - file; rank = 7 - rank; }
  const rankFromTop = 7 - rank;
  return { x: GRID_X + file * SQ, y: GRID_Y + rankFromTop * SQ };
}

export const inRect = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// ---- title screen -------------------------------------------------------------------------------
export const TITLE_BOARD = { x: W / 2 - 300, y: 20, w: 600, h: 520 }; // the hero board banner + title text
export function titleRows(hasSaved) {
  const cx = W / 2, bw = 560, bh = 76, gap = 14;
  let y = TITLE_BOARD.y + TITLE_BOARD.h + 30;
  const row = (h = bh) => { const r = { x: cx - bw / 2, y, w: bw, h }; y += h + gap; return r; };
  const rows = {};
  if (hasSaved) rows.resume = row();
  rows.playWhite = row();
  rows.playBlack = row();
  rows.twoPlayer = row();
  rows.watch = row();
  rows.learn = row();
  // Controls / About / Rules share one row, three even columns (was two — Rules is the addition).
  const third = (bw - gap * 2) / 3;
  rows.howto = { x: cx - bw / 2, y, w: third, h: bh };
  rows.about = { x: cx - bw / 2 + third + gap, y, w: third, h: bh };
  rows.rules = { x: cx - bw / 2 + (third + gap) * 2, y, w: third, h: bh };
  y += bh + gap;
  const half = (bw - gap) / 2;
  rows.level = { x: cx - bw / 2, y, w: half, h: bh };
  rows.theme = { x: cx - bw / 2 + half + gap, y, w: half, h: bh };
  return rows;
}

// ---- shared control-bar buttons (play / lesson / puzzle scenes) --------------------------------
const barY = BAR_TOP, bh2 = BAR_H - 16, bw2 = (W - 24 * 2 - 16 * 4) / 5;
function barButton(i) { return { x: 24 + i * (bw2 + 16), y: barY + 8, w: bw2, h: bh2 }; }
export const BTN = {
  menu: barButton(0),
  flip: barButton(1),
  undo: barButton(2),
  hint: barButton(3),
  resign: barButton(4),
};
// A 4-wide variant for scenes that only need four buttons (lessons) — wider slots, longer labels fit.
const bw4 = (W - 24 * 2 - 16 * 3) / 4;
function barButton4(i) { return { x: 24 + i * (bw4 + 16), y: barY + 8, w: bw4, h: bh2 }; }
export const BTN4 = { menu: barButton4(0), flip: barButton4(1), hint: barButton4(2), next: barButton4(3) };
// Think-time stepper (-/+) for the AI-vs-AI demo scene, in the control-bar band that scene
// otherwise leaves empty (no move/undo/hint/resign buttons apply there). Index into THINK_STEPS,
// never a raw float, so it can disable cleanly at either end, same pattern as TEXT_SCALES.
export const THINK_STEPS = [2, 5, 8, 10];
export const DEMO_THINK = {
  dec: { x: 24, y: barY + 8, w: 160, h: bh2 },
  inc: { x: W - 184, y: barY + 8, w: 160, h: bh2 },
};
// Pause/Resume sits in the middle of that same otherwise-empty control-bar band, between the two
// think-time stepper pills - freezes the whole THINK/REVEAL_SOURCE/REVEAL/MOVE loop at any moment,
// resuming exactly where it froze.
export const DEMO_PAUSE = { x: 200, y: barY + 8, w: 320, h: bh2 };
// HEADER.back/next: the top-left/top-right pair used ONLY by the title screen's sound toggle and
// the demo scene's Exit/Speed row (two buttons, never crowded). The About/Controls/Rules reference
// pages (renderPage) use their OWN REF_BACK/REF_NEXT + TEXT_DEC/TEXT_INC below instead — previously
// all four of these lived in this one top row (`y: 14`), cramming Back, Next, A- and A+ together
// right under the canvas edge. That pattern is gone: the text-size stepper is now two small pills
// in the top corners only, and Back/Next is an equal-width pill pair anchored near the bottom,
// clear of the reader-card panel, matching the pattern used across every other game.
export const HEADER = {
  back: { x: 14, y: 14, w: 100, h: 60 },
  next: { x: W - 114, y: 14, w: 100, h: 60 },
  sound: { x: W - 114, y: 14, w: 100, h: 60 },
};
// Text-size stepper (A-/A+) for the About/Controls/Rules reference pages: two small pills in the
// top corners only, well clear of the "About"/"Controls"/"Rules" heading below them.
export const TEXT_DEC = { x: 20, y: 18, w: 120, h: 60 };
export const TEXT_INC = { x: W - 140, y: 18, w: 120, h: 60 };
// Reference-page nav: an equal-width Back/Next pill pair anchored near the bottom of the canvas,
// clear of the reader-card panel above it. Back reads as the neutral/secondary action, Next as the
// primary action (drawButton's own accent style).
export const REF_BACK = { x: 20, y: 1164, w: 332, h: 100 };
export const REF_NEXT = { x: 368, y: 1164, w: 332, h: 100 };
// Text-size steps for the reference pages (About/Controls/Rules). Index into this, never a raw
// float, so "min"/"max" are exact and the stepper can cleanly disable at either end. Every page's
// content is paced (content.js) to fit comfortably even at the top step.
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const RESULT_PANEL = {
  again: { x: W / 2 - 270, y: 860, w: 250, h: 84 },
  menu: { x: W / 2 + 20, y: 860, w: 250, h: 84 },
};
// The result overlay's own natural end-of-session "More from Arcforge" cross-promo row (same
// mechanism as harvest-sling's tally screen, `env.openGame(slug)`). This is a FREE game, so every
// entry here must be a PAID game, never one of the app's other free games (they're already visible
// in the menu) — see the standing regression test in test/game.test.js. Sits in the genuinely empty
// gap between the mode subtitle (ends ~y531) and the New Game/Menu row (RESULT_PANEL, starts y860):
// Featured paid games (Tiger and Goat, Go, Carrom) plus one chess-family affinity pick (Xiangqi).
export const SIBLINGS = [
  { slug: 'tiger-and-goat', title: 'Tiger and Goat' },
  { slug: 'go-stones-and-territory', title: 'Go' },
  { slug: 'carrom-striker-and-queen', title: 'Carrom' },
  { slug: 'xiangqi-river-and-palace', title: 'Xiangqi' },
];
// 2x2 grid, same x-columns as RESULT_PANEL's own buttons (90..350 and 370..630).
export const chipRect = (i) => ({ x: 90 + (i % 2) * 280, y: 640 + Math.floor(i / 2) * 80, w: 260, h: 64 });
export const PROMO = {
  card: { x: W / 2 - 300, y: 470, w: 600, h: 340 },
  pieces: [0, 1, 2, 3].map((i) => ({ x: W / 2 - 300 + 40 + i * 135, y: 560, w: 110, h: 110 })),
};
