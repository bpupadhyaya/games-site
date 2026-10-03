// Screen geometry: one place for every rectangle so game.js (hit-testing) and the drawing code never disagree.
export const W = 720, H = 1280;
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export const inCircle = (c, x, y) => !!c && (x - c.x) * (x - c.x) + (y - c.y) * (y - c.y) <= c.r * c.r;

export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const THINK_STEPS = [2, 5, 8, 10];
export const REF_BACK = { x: 20, y: 1164, w: 332, h: 100 };
export const REF_NEXT = { x: 368, y: 1164, w: 332, h: 100 };
export const TEXT_DEC = { x: 20, y: 18, w: 120, h: 60 };
export const TEXT_INC = { x: W - 140, y: 18, w: 120, h: 60 };
export const SETUP_PINS = { start: { x: 30, y: 1156, w: 440, h: 96 }, back: { x: 486, y: 1156, w: 204, h: 96 } };

// The in-play HUD follows the 100-300% text setting through a gentler multiplier so the pitch stays visible.
export const PLAY_M = [1, 1.2, 1.4, 1.6, 1.8];

export function hudLayout(idx) {
  const i = Math.max(0, Math.min(PLAY_M.length - 1, idx | 0)), m = PLAY_M[i];
  const topH = Math.round(64 + 70 + 46 * (m - 1) * 2.2);
  const k = Math.min(1.16, 1 + 0.04 * i);                       // button size grows a little with the text size
  const stick = { x: 150, y: 1122, r: 92 };
  const btns = [
    { i: 0, x: 600, y: 1070, r: Math.round(64 * k) },       // A: shoot / tackle / head / dive
    { i: 1, x: 462, y: 1120, r: Math.round(52 * k) },       // B: pass / slide / jump
    { i: 2, x: 548, y: 1214, r: Math.round(46 * k) },       // C: lob / call
    { i: 3, x: 672, y: 1196, r: Math.round(42 * k) },       // D: through
  ];
  const sprint = { x: 330, y: 1190, r: Math.round(44 * k) };
  const pause = { x: W - 74, y: 4, w: 60, h: 56 };
  const think = { x: 14, y: 940, w: Math.round(150 * Math.min(k, 1.2)), h: Math.round(56 * k) };
  const zone = { x: 0, y: 960, w: 330, h: 320 };             // where a new touch becomes the stick
  return { idx: i, m, topH, k, stick, btns, sprint, pause, think, zone };
}
