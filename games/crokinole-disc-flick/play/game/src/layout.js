// Screen geometry: one place for every rectangle so game.js (hit-testing) and view.js (drawing) never disagree.
// Virtual resolution 720 x 1280 portrait. Nothing important is painted in the outer 24 px (tall phones letterbox).
export const W = 720, H = 1280;
export const BC = { x: 360, y: 616 };   // board centre on screen

export const inRect = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// ---- play screen -------------------------------------------------------------------------------
export const CARD = [{ x: 20, y: 24, w: 300, h: 134 }, { x: 400, y: 24, w: 300, h: 134 }];
export const ROUND_PILL = { x: 326, y: 78, w: 68, h: 62 };
export const TOAST_Y = 196;
export const PLAY_ZONE = { x: 0, y: 236, w: W, h: 862 };   // where a pull may start
export const SLIDER = { x: 20, y: 1104, w: 680, h: 90 };
export const TRACK = { x0: 84, x1: 636, y: 1160 };
export const HINT_BTN = { x: 20, y: 1206, w: 210, h: 64 };
export const MENU_BTN = { x: 490, y: 1206, w: 210, h: 64 };
export const DEMO_BAR = {
  dec: { x: 20, y: 1108, w: 150, h: 84 },
  pause: { x: 184, y: 1108, w: 352, h: 84 },
  inc: { x: 550, y: 1108, w: 150, h: 84 },
  exit: { x: 20, y: 1206, w: 680, h: 64 },
};
export const PULL = { min: 26, max: 240 };

// ---- reference pages (About / How to play / Rules) and settings --------------------------------
export const REF_BACK = { x: 20, y: 1164, w: 332, h: 100 };
export const REF_NEXT = { x: 368, y: 1164, w: 332, h: 100 };
export const TEXT_DEC = { x: 20, y: 18, w: 120, h: 60 };
export const TEXT_INC = { x: W - 140, y: 18, w: 120, h: 60 };
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const THINK_STEPS = [2, 5, 8, 10];

export const SETUP_PINS = {
  start: { x: 30, y: 1156, w: 440, h: 96 },
  back: { x: 486, y: 1156, w: 204, h: 96 },
};
