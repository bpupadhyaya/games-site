// Screen geometry. Virtual canvas 720 x 1560; the board is a square, physics units map to pixels with K.
import { S, BASE_Y } from './physics.js';
export const W = 720, H = 1560;
export const PLAY = 570, K = PLAY / S;                 // playing surface in pixels, pixels per board unit
export const CX = 360, CY = 800;
export const BX = CX - PLAY / 2, BY = CY - PLAY / 2;   // top-left of the playing surface
export const FRAME = 62;                               // wooden frame thickness
export const sx = (x) => BX + x * K;
export const sy = (y) => BY + y * K;
export const ux = (px) => (px - BX) / K;
export const uy = (py) => (py - BY) / K;
export const inRect = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export const rect = (x, y, w, h) => ({ x, y, w, h });

// Buttons ------------------------------------------------------------------------------------------------
export function titleButtons(hasSave) {
  const x = 90, w = 540; let y = hasSave ? 838 : 890;
  const R = {};
  if (hasSave) { R.resume = rect(x, y, w, 96); y += 116; }
  R.play = rect(x, y, w, 96); y += 116;
  R.two = rect(x, y, w, 88); y += 108;
  R.learn = rect(x, y, w, 88); y += 108;
  R.daily = rect(x, y, w, 88); y += 116;
  R.level = rect(x, y, w, 70);
  // Controls / About / Game Rules / Settings: four equal columns spanning the same width and right
  // edge the original three-across row used (a smaller adaptation of that row, the way Chess's own
  // Rules page went from a two- to a three-column row).
  { const gap = 14, cw = (w - gap * 3) / 4, ry = y + 90;
    R.howto = rect(x, ry, cw, 70); R.about = rect(x + cw + gap, ry, cw, 70);
    R.rules = rect(x + (cw + gap) * 2, ry, cw, 70); R.settings = rect(x + (cw + gap) * 3, ry, cw, 70); }
  return R;
}
export const PLAYB = {                                 // bottom row during play
  menu: rect(34, 1446, 200, 84), hint: rect(260, 1446, 200, 84), flick: rect(486, 1446, 200, 84),
};
export const METER = rect(90, 1218, 540, 30);
export const BACK = rect(28, 44, 150, 64);
export const MENU = { resume: rect(110, 560, 500, 92), restart: rect(110, 672, 500, 92), settings: rect(110, 784, 500, 92), quit: rect(110, 896, 500, 92) };
export const OVER = { again: rect(110, 1000, 500, 96), menu: rect(110, 1116, 500, 84) };
export const LESSONB = { next: rect(110, 1330, 500, 92), retry: rect(110, 1330, 240, 92), list: rect(370, 1330, 240, 92) };
export const PAGE = { prev: rect(40, 1440, 200, 84), next: rect(480, 1440, 200, 84), back: rect(260, 1440, 200, 84) };
// Text-size stepper for the About/Controls/Game Rules reference pages — top-left and top-right
// corners, the same rect shape BACK already uses, so it reads as a header row without crowding the
// Back/Next/Done row at the bottom of these pages.
export const PAGE_TEXT = { dec: rect(28, 44, 150, 64), inc: rect(W - 178, 44, 150, 64) };
// Text-size steps for those reference pages. Index into this, never a raw float, so the stepper can
// disable cleanly at either end. Content in pages.js is paced to fit at the top step.
export const TEXT_SCALES = [1, 1.15, 1.3];
export function settingRows() { const r = []; for (let i = 0; i < 7; i++) r.push(rect(60, 250 + i * 132, 600, 104)); return r; }
export function lessonRows() { const r = []; for (let i = 0; i < 8; i++) r.push(rect(60, 240 + i * 130, 600, 108)); return r; }
export { S, BASE_Y };
