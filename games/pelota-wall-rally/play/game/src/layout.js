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

/**
 * In-play layout. nChips = number of shot chips (3 in a rally, 2 when serving).
 * Bottom block: the SWING button (right), shot chips and Think / Pause (left). The stick lives in the left part above the block.
 */
export function hudLayout(idx, nChips = 3) {
  const i = Math.max(0, Math.min(PLAY_M.length - 1, idx | 0)), m = PLAY_M[i];
  const topH = Math.round(30 + 90 * m);
  const gap = 10, bottom = H - 14;
  const uh = Math.round(64 + 22 * (m - 1) * 1.6);                // util row height
  const ch = Math.round(66 + 22 * (m - 1) * 1.6);                // chip height
  const sw = Math.round(190 + 46 * (m - 1));                     // swing button size
  const swing = { x: W - 14 - sw, y: bottom - sw, w: sw, h: sw };
  const leftW = swing.x - gap - 14;
  const util = {}; const uw = (leftW - gap) / 2;
  util.think = { x: 14, y: bottom - uh, w: uw, h: uh };
  util.pause = { x: 14 + uw + gap, y: bottom - uh, w: uw, h: uh };
  const chips = [];
  const cw = (leftW - gap * (nChips - 1)) / nChips;
  for (let k = 0; k < nChips; k++) chips.push({ idx: k, rect: { x: 14 + k * (cw + gap), y: bottom - uh - gap - ch, w: cw, h: ch } });
  const blockTop = Math.min(swing.y, chips[0] ? chips[0].rect.y : swing.y);
  return { idx: i, m, topH, util, swing, chips, blockTop, stickZone: { x: 0, y: Math.round(H * 0.6), w: Math.round(W * 0.62), h: blockTop - Math.round(H * 0.6) - 6 }, aimBottom: blockTop - 4 };
}
