// Screen geometry: one place for every rectangle so game.js (hit-testing) and the drawing code never disagree.
export const W = 720, H = 1280;
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export const inCircle = (c, x, y, extra = 0) => !!c && Math.hypot(x - c.x, y - c.y) <= c.r + extra;

export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const THINK_STEPS = [2, 5, 8, 10];
export const REF_BACK = { x: 20, y: 1164, w: 332, h: 100 };
export const REF_NEXT = { x: 368, y: 1164, w: 332, h: 100 };
export const TEXT_DEC = { x: 20, y: 18, w: 120, h: 60 };
export const TEXT_INC = { x: W - 140, y: 18, w: 120, h: 60 };
export const SETUP_PINS = { start: { x: 30, y: 1156, w: 440, h: 96 }, back: { x: 486, y: 1156, w: 204, h: 96 } };

// The in-play HUD follows the text-size setting (100-300%) through a gentler multiplier so the court stays visible.
export const PLAY_M = [1, 1.25, 1.5, 1.75, 2];

// In play: scoreboard on top, Think / Pause under it, the court in the middle, the thumb controls in the bottom zone.
export function hudLayout(idx) {
  const i = Math.max(0, Math.min(PLAY_M.length - 1, idx | 0)), m = PLAY_M[i];
  const topH = Math.round(22 + 82 * m) + (m > 1.4 ? 14 : 0);
  const uh = Math.round(54 + 14 * (m - 1)), uw = Math.round(150 + 40 * (m - 1));
  const util = { think: { x: 14, y: topH + 6, w: uw, h: uh }, pause: { x: W - 14 - uw, y: topH + 6, w: uw, h: uh } };
  const s = 1 + 0.15 * (m - 1);
  const btn = {
    a: { x: 604, y: 1128, r: Math.round(66 * s) },
    b: { x: 470, y: 1176, r: Math.round(50 * s) },
    c: { x: 480, y: 1040, r: Math.round(50 * s) },
    d: { x: 612, y: 982, r: Math.round(46 * s) },
  };
  return { idx: i, m, s, topH, util, btn, stickZone: { x: 0, y: 900, w: 380, h: 380 }, meter: { x: 400, y: 884, w: 300, h: Math.round(22 * s) }, courtBottom: 930 };
}
