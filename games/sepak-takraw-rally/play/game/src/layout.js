// Screen geometry: one place for every rectangle so game.js (hit-testing) and the drawing code never disagree.
export const W = 720, H = 1280;
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const THINK_STEPS = [2, 5, 8, 10];
export const REF_BACK = { x: 20, y: 1164, w: 332, h: 100 };
export const REF_NEXT = { x: 368, y: 1164, w: 332, h: 100 };
export const TEXT_DEC = { x: 20, y: 18, w: 120, h: 60 };
export const TEXT_INC = { x: W - 140, y: 18, w: 120, h: 60 };
export const SETUP_PINS = { start: { x: 30, y: 1156, w: 440, h: 96 }, back: { x: 486, y: 1156, w: 204, h: 96 } };

// The in-play HUD follows the text-size setting (100-300%) through a gentler multiplier so the court stays visible.
export const PLAY_M = [1, 1.25, 1.5, 1.75, 2];

// n = number of choice buttons, hasAction = SMASH/SERVE button present
export function hudLayout(idx, n, hasAction, perRowFixed = 0) {
  const i = Math.max(0, Math.min(PLAY_M.length - 1, idx | 0)), m = PLAY_M[i];
  const topH = Math.round(30 + 90 * m);
  const rowH = Math.round(84 + 16 * (m - 1));
  const gap = 10;
  const small = Math.round(70 + 18 * (m - 1));
  const bottom = H - 14;
  const util = { think: null, pause: null };
  const uy = bottom - small;
  const uw = (W - 28 - gap) / 2;
  util.think = { x: 14, y: uy, w: uw, h: small };
  util.pause = { x: 14 + uw + gap, y: uy, w: uw, h: small };
  let y = uy - gap;
  let action = null;
  if (hasAction) { const ah = Math.round(116 + 30 * (m - 1)); y -= ah; action = { x: 14, y, w: W - 28, h: ah }; y -= gap; }
  const choices = [];
  if (n > 0) {
    const perRow = perRowFixed || (m >= 1.5 && n > 3 ? Math.ceil(n / 2) : n);
    const rows = Math.ceil(n / perRow);
    for (let r = rows - 1; r >= 0; r--) {
      const cnt = Math.min(perRow, n - r * perRow);
      const cw = (W - 28 - gap * (cnt - 1)) / cnt;
      y -= rowH;
      for (let k = 0; k < cnt; k++) choices.push({ idx: r * perRow + k, rect: { x: 14 + k * (cw + gap), y, w: cw, h: rowH } });
      y -= gap;
    }
    choices.sort((a, b) => a.idx - b.idx);
  }
  const barTop = y + gap;
  return { idx: i, m, topH, rowH, util, action, choices, barTop, courtBottom: barTop - 6 };
}
