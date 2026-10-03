// Screen geometry: one place for every rectangle so game.js (hit-testing) and the drawing code never disagree.
export const W = 720, H = 1280;
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export const inCircle = (c, x, y, pad = 0) => Math.hypot(x - c.x, y - c.y) <= c.r + pad;

export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const THINK_STEPS = [2, 5, 8, 10];
export const REF_BACK = { x: 20, y: 1164, w: 332, h: 100 };
export const REF_NEXT = { x: 368, y: 1164, w: 332, h: 100 };
export const TEXT_DEC = { x: 20, y: 18, w: 120, h: 60 };
export const TEXT_INC = { x: W - 140, y: 18, w: 120, h: 60 };
export const SETUP_PINS = { start: { x: 30, y: 1156, w: 440, h: 96 }, back: { x: 486, y: 1156, w: 204, h: 96 } };

// The in-play HUD follows the text-size setting (100-300%) through a gentler multiplier so the field stays visible.
export const PLAY_M = [1, 1.25, 1.5, 1.75, 2];

// In-play layout. The stick floats where the left thumb lands (default hint position below); the right thumb has SWING and HOOK.
export function playLayout(idx) {
  const i = Math.max(0, Math.min(PLAY_M.length - 1, idx | 0)), m = PLAY_M[i];
  const topH = Math.round(124 + 62 * (m - 1) * 1.1);
  const sw = { x: 586, y: 1118, r: 88 };
  const hook = { x: 600, y: 932, r: 62 };
  const small = Math.round(60 + 16 * (m - 1));
  const pause = { x: W - 14 - Math.round(150 * Math.min(m, 1.5)), y: topH + 10, w: Math.round(150 * Math.min(m, 1.5)), h: small };
  const think = { x: 14, y: topH + 10, w: Math.round(150 * Math.min(m, 1.5)), h: small };
  const stickHint = { x: 150, y: 1100, r: 96 };
  return { idx: i, m, topH, sw, hook, pause, think, stickHint, stickZone: { x: 0, y: 560, w: 470, h: 720 } };
}
