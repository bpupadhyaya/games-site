// Screen geometry: one place for every rectangle so game.js (hit-testing), controls.js and the drawing code never disagree.
export const W = 720, H = 1280;
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const THINK_STEPS = [2, 5, 8, 10];
export const REF_BACK = { x: 20, y: 1164, w: 332, h: 100 };
export const REF_NEXT = { x: 368, y: 1164, w: 332, h: 100 };
export const TEXT_DEC = { x: 20, y: 18, w: 120, h: 60 };
export const TEXT_INC = { x: W - 140, y: 18, w: 120, h: 60 };
export const SETUP_PINS = { start: { x: 30, y: 1156, w: 440, h: 96 }, back: { x: 486, y: 1156, w: 204, h: 96 } };

// The in-play HUD follows the 100-300% text size through a gentler multiplier so the pitch stays visible.
export const PLAY_M = [1, 1.25, 1.5, 1.75, 2];
export const CTRL_TOP = 872;

export function hudLayout(idx) {
  const i = Math.max(0, Math.min(PLAY_M.length - 1, idx | 0)), m = PLAY_M[i];
  const topH = Math.round(14 + 84 * m);
  const bs = Math.min(m, 1.3);                                  // control buttons grow a little with the text size
  const a1 = { cx: 586, cy: 1062 + (bs - 1) * 20, r: 82 * bs };
  const a2 = { cx: 430, cy: 1168, r: 64 * bs };
  const spr = { cx: 640, cy: 930 + (bs - 1) * 8, r: 52 * bs };
  const small = Math.round(64 + 16 * (m - 1));
  const yb = topH + 10;
  const think = { x: 16, y: yb, w: 196 + 20 * (m - 1), h: small };
  const pause = { x: W - 16 - (196 + 20 * (m - 1)), y: yb, w: 196 + 20 * (m - 1), h: small };
  const stick = { x: 0, y: CTRL_TOP, w: 372, h: H - CTRL_TOP, cx: 150, cy: 1100, r: 96 };
  const meter = { x: 150, y: CTRL_TOP + 6, w: 420, h: 54 };
  return { idx: i, m, bs, topH, a1, a2, spr, think, pause, stick, meter, bannerY: Math.max(yb + small + 26, topH + 6 + 153 + 14) };
}
export const inCircle = (c, x, y, pad = 14) => (x - c.cx) * (x - c.cx) + (y - c.cy) * (y - c.cy) <= (c.r + pad) * (c.r + pad);
