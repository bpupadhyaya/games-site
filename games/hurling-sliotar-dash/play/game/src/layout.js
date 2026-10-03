// Screen geometry: one place for every rectangle so game.js (hit-testing) and the drawing code never disagree.
export const W = 720, H = 1280;
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export const inCircle = (c, x, y) => !!c && Math.hypot(x - c.x, y - c.y) <= c.r;

export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const THINK_STEPS = [2, 5, 8, 10];
export const REF_BACK = { x: 20, y: 1164, w: 332, h: 100 };
export const REF_NEXT = { x: 368, y: 1164, w: 332, h: 100 };
export const REF_CLOSE = { x: 20, y: 1164, w: 680, h: 100 };
export const TEXT_DEC = { x: 20, y: 18, w: 120, h: 60 };
export const TEXT_INC = { x: W - 140, y: 18, w: 120, h: 60 };
export const SETUP_PINS = { start: { x: 30, y: 1156, w: 440, h: 96 }, back: { x: 486, y: 1156, w: 204, h: 96 } };

// The in-play HUD follows the text-size setting (100-300%) through a gentler multiplier so the pitch stays visible.
export const PLAY_M = [1, 1.2, 1.4, 1.6, 1.8];

// In-play layout. The pitch occupies the middle of the screen; the scoreboard and prompts live in the open area above it, the
// controls (floating stick on the left half, four round buttons on the right) below.
export function hudLayout(idx) {
  const i = Math.max(0, Math.min(PLAY_M.length - 1, idx | 0)), m = PLAY_M[i];
  const s = 1 + 0.4 * (m - 1) / 0.8;                  // button size factor, at most 1.4
  const topH = Math.round(118 * m) + (m > 1.3 ? Math.round(52 * m) : 0);   // large text: the clock moves to a second row
  const mu = Math.min(m, 1.6);
  const uh = Math.round(62 * mu);
  const R1 = Math.round(84 * s), R2 = Math.round(60 * s), D = R1 + R2 + 12;
  const sx = W - 14 - R1, sy = H - 14 - R1;
  const strike = { x: sx, y: sy, r: R1 };
  const pass = { x: sx - D, y: sy, r: R2 };
  const rise = { x: sx - D * 0.707, y: sy - D * 0.707, r: R2 };
  const hook = { x: sx, y: sy - D, r: R2 };
  const stick = { x: 130 + Math.round(20 * s), y: H - 150 - Math.round(20 * s), r: Math.round(96 * s), zone: { x: 0, y: 560, w: 420, h: H - 560 } };
  const util = { pause: { x: 14, y: topH + 8, w: Math.round(150 * mu), h: uh }, think: { x: W - 14 - Math.round(150 * mu), y: topH + 8, w: Math.round(150 * mu), h: uh } };
  return { idx: i, m, s, topH, mu, strike, pass, rise, hook, stick, util, tiles: { y: topH + uh + 22 } };
}
