// Screen geometry: one place for every rectangle so game.js (hit-testing) and hud.js / menus.js (drawing) never
// disagree. Virtual resolution 720 x 1280 portrait.
export const W = 720;
export const H = 1280;

export const inRect = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// ---- play screen -------------------------------------------------------------------------------
export const HUD = { x: 20, y: 40, w: 680, h: 128 };
export const PLAY_ZONE = { x: 0, y: 150, w: W, h: 950 };   // where a drag may start
const bw = (W - 40 - 3 * 10) / 4;
export const BAR_BTN = [0, 1, 2, 3].map((i) => ({ x: 20 + i * (bw + 10), y: 1146, w: bw, h: 100 }));
export const POP_BTN = BAR_BTN[0];
export const FLIP_BTN = BAR_BTN[1];
export const HINT_BTN = BAR_BTN[2];       // THINK in trick/practice, BANK in a Run
export const MENU_BTN = BAR_BTN[3];
// Watch & Learn bar: thinking time less / pause / more, then exit
export const WATCH_BAR = {
  dec: { x: 20, y: 1146, w: 150, h: 100 },
  pause: { x: 184, y: 1146, w: 352, h: 100 },
  inc: { x: 550, y: 1146, w: 150, h: 100 },
  exit: { x: 20, y: 1100, w: 150, h: 40 },
};

// ---- reference pages and settings -------------------------------------------------------------
export const REF_BACK = { x: 20, y: 1164, w: 332, h: 100 };
export const REF_NEXT = { x: 368, y: 1164, w: 332, h: 100 };
export const TEXT_DEC = { x: 20, y: 18, w: 120, h: 60 };
export const TEXT_INC = { x: W - 140, y: 18, w: 120, h: 60 };
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const THINK_STEPS = [2, 5, 8, 10];
