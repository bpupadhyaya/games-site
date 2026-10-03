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
export const PLAY_M = [1, 1.18, 1.36, 1.52, 1.66];

// n = number of context buttons. Returns every HUD rectangle for the multiplier index idx.
export function hudLayout(idx, n, wantHint = true) {
  const i = Math.max(0, Math.min(PLAY_M.length - 1, idx | 0)), m = PLAY_M[i];
  const gap = 8;
  const topH = Math.round(104 * m);
  const bottom = H - 12;
  const utilH = Math.round(62 * m);
  const util = [];
  const uw = (W - 24 - gap * 2) / 3;
  for (let k = 0; k < 3; k++) util.push({ x: 12 + k * (uw + gap), y: bottom - utilH, w: uw, h: utilH });
  let y = bottom - utilH - gap;
  const choices = [];
  if (n > 0) {
    const rowH = Math.round(70 * m);
    const perRow = m >= 1.35 && n > 3 ? Math.ceil(n / 2) : n;
    const rows = Math.ceil(n / perRow);
    for (let r = rows - 1; r >= 0; r--) {
      const cnt = Math.min(perRow, n - r * perRow);
      const cw = (W - 24 - gap * (cnt - 1)) / cnt;
      y -= rowH;
      for (let k = 0; k < cnt; k++) choices.push({ idx: r * perRow + k, rect: { x: 12 + k * (cw + gap), y, w: cw, h: rowH } });
      y -= gap;
    }
    choices.sort((a, b) => a.idx - b.idx);
  }
  const hintH = wantHint && m < 1.5 ? Math.round(54 * m) : 0;
  let hint = null;
  if (hintH) { y -= hintH; hint = { x: 12, y, w: W - 24, h: hintH }; y -= 4; }
  const barTop = y;
  const mini = { x: 12, y: topH + 8, w: Math.round(150 * Math.min(m, 1.3)), h: Math.round(112 * Math.min(m, 1.3)) };
  return { idx: i, m, topH, util, choices, hint, barTop, mini };
}
export const THINK_CARD = { x: 30, y: 250, w: 660, h: 620 };
