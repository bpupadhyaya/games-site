// Screen geometry: one place for every rectangle so game.js (hit-testing) and view.js (drawing) never disagree.
// Virtual resolution 720 x 1280 portrait. The kit draws its preview badge at top centre (y 6..34): the HUD stays below it.
export { W, H } from './cam.js';
const W = 720;

export const inRect = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// ---- play screen ----------------------------------------------------------------------------------
export const PAUSE_BTN = { x: 18, y: 46, w: 72, h: 72 };
export const HINT_BTN = { x: W - 90, y: 46, w: 72, h: 72 };
export const WATCH_BAR = {
  dec: { x: 20, y: 1150, w: 150, h: 84 },
  pause: { x: 184, y: 1150, w: 352, h: 84 },
  inc: { x: 550, y: 1150, w: 150, h: 84 },
  exit: { x: 20, y: 1060, w: 150, h: 70 },
};

// ---- reference pages (About / How to play / Rules) and settings ------------------------------------------------
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
