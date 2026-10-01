// Screen geometry: one place for every rectangle so game.js (hit-testing) and view.js (drawing)
// never disagree. Virtual resolution 720 x 1280 portrait.
export { W, H } from './cam.js';
const W = 720;

export const inRect = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// ---- play screen -------------------------------------------------------------------------------
export const HUD = { y: 0, h: 124 };
export const PLAY_ZONE = { x: 0, y: 186, w: W, h: 920 };   // where a pull may start
export const BAR = { y: 1112, h: 168 };
const lw = (W - 40 - 3 * 8) / 4;
export const LOFT_BTN = [0, 1, 2, 3].map((i) => ({ x: 20 + i * (lw + 8), y: 1122, w: lw, h: 80 }));
export const SPIN_BTN = { x: 20, y: 1212, w: 268, h: 62 };
export const HINT_BTN = { x: 302, y: 1212, w: 196, h: 62 };
export const MENU_BTN = { x: 512, y: 1212, w: 188, h: 62 };
export const FAST_BTN = { x: 560, y: 134, w: 144, h: 52 };   // visible during Watch, shows speed/ff state
export const PULL = { min: 26, max: 230, draw: 0.62 };
export const REST = { y: 935 };   // placeholder; view computes from camera

// ---- title -------------------------------------------------------------------------------------
export function titleRows() {
  const cx = W / 2, bw = 540, bh = 88, gap = 16;
  let y = 640;
  const rows = {};
  const row = (name, h = bh) => { rows[name] = { x: cx - bw / 2, y, w: bw, h }; y += h + gap; };
  row('play'); row('two'); row('watch');
  const third = (bw - gap * 2) / 3;
  rows.howto = { x: cx - bw / 2, y, w: third, h: 76 };
  rows.rules = { x: cx - bw / 2 + third + gap, y, w: third, h: 76 };
  rows.about = { x: cx - bw / 2 + (third + gap) * 2, y, w: third, h: 76 };
  y += 76 + gap;
  const half = (bw - gap) / 2;
  rows.settings = { x: cx - bw / 2, y, w: half, h: 76 };
  rows.sound = { x: cx - bw / 2 + half + gap, y, w: half, h: 76 };
  return rows;
}

// ---- setup -------------------------------------------------------------------------------------
export const SETUP_PINS = {
  start: { x: 30, y: 1156, w: 440, h: 96 },
  back: { x: 486, y: 1156, w: 204, h: 96 },
};

// ---- reference pages (About / How to play / Rules) and settings --------------------------------
export const REF_BACK = { x: 20, y: 1164, w: 332, h: 100 };
export const REF_NEXT = { x: 368, y: 1164, w: 332, h: 100 };
export const TEXT_DEC = { x: 20, y: 18, w: 120, h: 60 };
export const TEXT_INC = { x: W - 140, y: 18, w: 120, h: 60 };
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const THINK_STEPS = [2, 5, 8, 10];

export const RESULT = {
  again: { x: 60, y: 940, w: 280, h: 96 },
  menu: { x: 380, y: 940, w: 280, h: 96 },
};
export const PAUSE_MENU = {
  card: { x: 70, y: 330, w: 580, h: 560 },
  resume: { x: 110, y: 430, w: 500, h: 84 },
  rules: { x: 110, y: 530, w: 240, h: 76 },
  howto: { x: 370, y: 530, w: 240, h: 76 },
  sound: { x: 110, y: 622, w: 240, h: 76 },
  calm: { x: 370, y: 622, w: 240, h: 76 },
  quit: { x: 110, y: 716, w: 500, h: 84 },
};
export const DEMO_BAR = {
  dec: { x: 20, y: 1122, w: 150, h: 80 },
  pause: { x: 184, y: 1122, w: 352, h: 80 },
  inc: { x: 550, y: 1122, w: 150, h: 80 },
  exit: { x: 20, y: 1212, w: 680, h: 62 },
};
export const SETTINGS = {
  row: (i) => ({ x: 40, y: 220 + i * 120, w: 640, h: 96 }),
  back: { x: 20, y: 1164, w: 680, h: 100 },
};
