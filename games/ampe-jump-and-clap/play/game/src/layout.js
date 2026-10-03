// Screen geometry: one place for every rectangle so game.js (hit-testing) and the drawing code never disagree.
export const W = 720, H = 1280;
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export const REF_BACK = { x: 20, y: 1164, w: 332, h: 100 };
export const REF_NEXT = { x: 368, y: 1164, w: 332, h: 100 };
export const TEXT_DEC = { x: 20, y: 18, w: 120, h: 60 };
export const TEXT_INC = { x: W - 140, y: 18, w: 120, h: 60 };
export const SETUP_PINS = { start: { x: 30, y: 1156, w: 440, h: 96 }, back: { x: 486, y: 1156, w: 204, h: 96 } };

// The in-play HUD follows the text-size setting (100-300%) through a gentler multiplier so the scene stays visible.
export const PLAY_M = [1, 1.2, 1.4, 1.6, 1.8];

export function hudLayout(idx) {
  const m = PLAY_M[clamp(idx | 0, 0, PLAY_M.length - 1)];
  const gap = 10;
  const bottom = H - 12;
  const utilH = Math.round(66 * m);
  const util = { think: { x: 14, y: bottom - utilH, w: (W - 28 - gap) / 2, h: utilH }, pause: { x: 14 + (W - 28 - gap) / 2 + gap, y: bottom - utilH, w: (W - 28 - gap) / 2, h: utilH } };
  const btnH = Math.round(170 * (0.85 + 0.15 * m));
  const by = util.think.y - gap - btnH;
  const bw = (W - 28 - gap) / 2;
  const left = { x: 14, y: by, w: bw, h: btnH }, right = { x: 14 + bw + gap, y: by, w: bw, h: btnH };
  const topH = Math.round(84 * m) + Math.round(66 * m);
  const ring = { x: W / 2, y: by - 70 - Math.round(20 * (m - 1)), r0: 92, rt: 40 };
  return { m, util, left, right, topH, ring, btnTop: by, bottom };
}
