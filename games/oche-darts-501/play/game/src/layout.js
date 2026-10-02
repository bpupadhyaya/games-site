// Screen geometry in one place so game.js (hit-testing) and view.js (drawing) never disagree.
// Virtual resolution 720 x 1280, portrait. Nothing important within 40 px of the top or bottom edge,
// and the top-centre strip (y < 44) is left free for the preview badge.
export const W = 720;
export const H = 1280;
export const inRect = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// The board: R is the outer edge of the double ring in virtual pixels.
export const BOARD = { cx: 360, cy: 592, R: 282 };
export const PX_PER_MM = BOARD.R / 170;

// Scoreboard panels.
export const PANEL = [{ x: 14, y: 48, w: 344, h: 148 }, { x: 362, y: 48, w: 344, h: 148 }];
export const LEG_LINE = { y: 224 };

// Under the board.
export const CHIPS = { y: 944, h: 70 };
export const COACH = { x: 20, y: 1026, w: 680, h: 76 };
export const THINK_BTN = { x: 20, y: 1180, w: 330, h: 84 };
export const MENU_BTN = { x: 370, y: 1180, w: 330, h: 84 };
// Watch & Learn control bar.
export const WATCH = {
  dec: { x: 20, y: 1108, w: 120, h: 62 },
  inc: { x: 580, y: 1108, w: 120, h: 62 },
  label: { x: 150, y: 1108, w: 420, h: 62 },
  pause: { x: 20, y: 1180, w: 440, h: 84 },
  exit: { x: 476, y: 1180, w: 224, h: 84 },
};
export const AIM = { top: 200, bottom: 1166, offsetY: -150, minHold: 0.25 };

// Menus, pages, settings.
export const SETUP_PINS = { start: { x: 30, y: 1156, w: 440, h: 96 }, back: { x: 486, y: 1156, w: 204, h: 96 } };
export const REF_BACK = { x: 20, y: 1164, w: 332, h: 100 };
export const REF_NEXT = { x: 368, y: 1164, w: 332, h: 100 };
export const TEXT_DEC = { x: 20, y: 18, w: 120, h: 60 };
export const TEXT_INC = { x: W - 140, y: 18, w: 120, h: 60 };
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const THINK_STEPS = [2, 5, 8, 10];
export const REVEAL_SECS = 2;
