// Screen geometry: one place for every rectangle so game.js (hit-testing) and view.js (drawing) never disagree.
// Virtual resolution 720 x 1280 portrait. The yard is drawn in its own 660 x 800 world, scaled to the free area.
import { WORLD } from './sim.js';

export const W = 720;
export const H = 1280;
export const inRect = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// The play screen follows the text size (100-300%) with a gentler multiplier PLAY_M, so the yard stays playable.
// Every text is fitted to its slot; at the larger sizes the yard shrinks a little to make room.
export const PLAY_M = [1, 1.25, 1.5, 1.75, 2];

export function playLayout(idx) {
  const i = Math.max(0, Math.min(PLAY_M.length - 1, idx | 0)), m = PLAY_M[i];
  // ---- HUD: two player cards, a stage strip, a coach line
  const cardH = Math.round(70 * m), stripH = Math.round(40 * m), coachH = Math.round((m >= 1.5 ? 78 : 50) * Math.min(m, 1.6));
  const cardY = 40, stripY = cardY + cardH + 8, coachY = stripY + stripH + 6;
  const hudBottom = coachY + coachH;
  const cardW = 340;
  const cards = [{ x: 14, y: cardY, w: cardW, h: cardH }, { x: W - 14 - cardW, y: cardY, w: cardW, h: cardH }];
  const strip = { x: 14, y: stripY, w: W - 28, h: stripH };
  const coach = { x: 14, y: coachY, w: W - 28, h: coachH };
  // ---- bottom bar: a toss pad and a row of buttons
  const btnH = Math.round(84 * Math.min(m, 1.5)), padH = Math.round(112 * (1 + (m - 1) * 0.45));
  const bottom = 1264, btnY = bottom - btnH, padY = btnY - 10 - padH;
  const bw = (W - 28 - 10) / 2;
  const think = { x: 14, y: btnY, w: bw, h: btnH };
  const pause = { x: 14 + bw + 10, y: btnY, w: bw, h: btnH };
  const qw = (W - 28 - 30) / 4;
  const watch = { dec: { x: 14, y: btnY, w: qw, h: btnH }, pause: { x: 14 + qw + 10, y: btnY, w: qw, h: btnH }, inc: { x: 14 + 2 * (qw + 10), y: btnY, w: qw, h: btnH }, exit: { x: 14 + 3 * (qw + 10), y: btnY, w: qw, h: btnH } };
  const pad = { x: 14, y: padY, w: W - 28, h: padH };
  // ---- the yard's place on screen
  const top = hudBottom + 8, availH = padY - 8 - top, availW = W - 20;
  const s = Math.min(availW / WORLD.w, availH / WORLD.h, 1.06);
  const view = { s, ox: 10 + (availW - WORLD.w * s) / 2, oy: top + (availH - WORLD.h * s) / 2 };
  return { idx: i, m, cards, strip, coach, hudBottom, pad, think, pause, watch, view, barTop: padY };
}
export const toWorld = (v, x, y) => ({ x: (x - v.ox) / v.s, y: (y - v.oy) / v.s });
export const toScreen = (v, x, y) => ({ x: v.ox + x * v.s, y: v.oy + y * v.s });

// ---- reference pages (About / How to play / Rules) and settings --------------------------------
export const CLOSE_BTN = { x: 20, y: 1164, w: 680, h: 100 };
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
