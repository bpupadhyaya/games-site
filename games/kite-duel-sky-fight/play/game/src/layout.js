// Screen geometry: one place for every rectangle so game.js (hit-testing) and view.js (drawing)
// never disagree. Virtual resolution 720 x 1280 portrait.
export { W, H } from './sim.js';
const W = 720;

export const inRect = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// ---- play screen -------------------------------------------------------------------------------
export const SKY_ZONE = { x: 0, y: 206, w: W, h: 950 };         // where a touch sets the heading point
export const HUD_TOP = 44;
export const WIND_PANEL = { x: 20, y: 138, w: 680, h: 58 };
export const MODE_BTN = [
  { id: -1, x: 14, y: 1176, w: 148, h: 84 },
  { id: 0, x: 170, y: 1176, w: 148, h: 84 },
  { id: 1, x: 326, y: 1176, w: 148, h: 84 },
];
export const THINK_BTN = { x: 482, y: 1176, w: 108, h: 84 };
export const PAUSE_BTN = { x: 598, y: 1176, w: 108, h: 84 };
export const WATCH_BAR = {
  dec: { x: 14, y: 1176, w: 132, h: 84 },
  pause: { x: 154, y: 1176, w: 222, h: 84 },
  inc: { x: 384, y: 1176, w: 132, h: 84 },
  exit: { x: 524, y: 1176, w: 182, h: 84 },
};
export const BANNER_BTN = { x: 130, y: 670, w: 460, h: 92 };

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
