// Screen geometry: one place for every rectangle so game.js (hit-testing) and view.js (drawing)
// never disagree. Virtual resolution 720 x 1280 portrait.
import { ARENA } from './sim.js';
export { W, H } from './sim.js';
const W = 720;

export const inRect = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// ---- play screen -------------------------------------------------------------------------------
// Everything on the play screen follows the text-size setting (100-300%), but the dish has to stay playable, so the
// play screen uses a gentler multiplier PLAY_M (100% -> x1, 300% -> x2) and fits every text to its slot. One function
// builds every rectangle for a text size, so hit-testing (game.js) and drawing (view.js) never disagree.
export const PLAY_M = [1, 1.25, 1.5, 1.75, 2];
// bar heights per text-size step: [tool buttons, pause row]
const BAR_H = [[84, 84], [100, 72], [112, 80], [124, 86], [135, 90]];

export function playLayout(idx) {
  const i = Math.max(0, Math.min(PLAY_M.length - 1, idx | 0)), m = PLAY_M[i], pm = Math.min(m, 1.5);
  // ---- HUD
  const centerW = Math.round(128 + 60 * (m - 1));
  const bw = (W - 48 - centerW) / 2;
  const base = 56 + 16 * m;                       // baseline of the name row
  const barY = base + 8, barH = Math.round(22 * pm), tenY = barY + barH + 7, tenH = Math.round(12 * pm);
  const panelY = tenY + tenH + 20 - 8 * (m - 1);
  const twoRow = m >= 1.5;
  const panelH = twoRow ? Math.round(70 * m - 6) : Math.round(58 * m);
  const hud = { m, pm, bw, centerW, lx: 24, rx: W - 24 - bw, base, barY, barH, tenY, tenH, twoRow, nameFs: 26 * m, numFs: 24 * m, timerFs: 34 * m };
  const panel = { x: 20, y: Math.round(panelY), w: 680, h: panelH };
  const hudBottom = panel.y + panel.h;
  // ---- bottom bar
  const [mh, th] = BAR_H[i];
  let tools, pause, watch;
  if (i === 0) {
    tools = [0, 1].map((k) => ({ id: k, x: 14 + k * 244, y: 1176, w: 236, h: 84 }));
    pause = { x: 498, y: 1176, w: 208, h: 84 };
    watch = { dec: { x: 14, y: 1176, w: 132, h: 84 }, pause: { x: 154, y: 1176, w: 222, h: 84 }, inc: { x: 384, y: 1176, w: 132, h: 84 }, exit: { x: 524, y: 1176, w: 182, h: 84 } };
  } else {
    const bottom = 1262, ty = bottom - th, my = ty - 10 - mh, hw = (W - 28 - 10) / 2;
    tools = [0, 1].map((k) => ({ id: k, x: 14 + k * (hw + 10), y: my, w: hw, h: mh }));
    pause = { x: 14, y: ty, w: W - 28, h: th };
    watch = { dec: { x: 14, y: my, w: hw, h: mh }, inc: { x: 14 + hw + 10, y: my, w: hw, h: mh }, pause: { x: 14, y: ty, w: Math.round(hw * 1.2), h: th }, exit: { x: 14 + Math.round(hw * 1.2) + 10, y: ty, w: W - 28 - Math.round(hw * 1.2) - 10, h: th } };
  }
  const barTop = Math.min(tools[0].y, watch.dec.y);
  const field = { x: 0, y: hudBottom + 10, w: W, h: barTop - 20 - (hudBottom + 10) };
  // how far a finger can pull back before the bar or the HUD is in the way
  const aTop = ARENA.cy - 0.74 * ARENA.R * ARENA.sy, aBot = ARENA.cy + 0.74 * ARENA.R * ARENA.sy;
  const pullMax = [Math.max(120, Math.min(230, barTop - 18 - aBot)), Math.max(120, Math.min(230, aTop - hudBottom - 24))];
  // the spin-up timing gauge sits between the dish and the bar
  const gaugeTop = ARENA.cy + (ARENA.R + 40) * ARENA.sy + 6;
  const gauge = { x: 70, y: gaugeTop, w: 580, h: Math.max(60, Math.min(104, barTop - gaugeTop - 12)) };
  return { idx: i, m, hud, panel, hudBottom, tools, pause, watch, barTop, field, pullMax, gauge };
}

// ---- reference pages (About / How to play / Rules) and settings --------------------------------
export const REF_BACK = { x: 20, y: 1164, w: 332, h: 100 };
export const REF_NEXT = { x: 368, y: 1164, w: 332, h: 100 };
export const TEXT_DEC = { x: 20, y: 18, w: 120, h: 60 };
export const TEXT_INC = { x: W - 140, y: 18, w: 120, h: 60 };
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const THINK_STEPS = [2, 5, 8, 10];
export const SETUP_PINS = {
  start: { x: 30, y: 1156, w: 440, h: 96 },
  back: { x: 486, y: 1156, w: 204, h: 96 },
};
