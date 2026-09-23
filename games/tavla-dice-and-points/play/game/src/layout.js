// Geometry. Virtual canvas 720 x 1560. The board is drawn flat (seen from above) and turned so that it is tall:
// two columns of twelve points with the bar down the middle. Your home board (points 1-6) is bottom left,
// your checkers start bottom right (point 24) and travel up the right side, across the top and down the left.
import { BAR, OFF } from './rules.js';
export const W = 720, H = 1560;
export const FRAME = { x: 8, y: 262, w: 704, h: 1038 };          // outer edge of the wooden frame
export const IN = { x0: 34, x1: 686, y0: 288, y1: 1274 };         // the playing field
export const CH = { x0: 318, x1: 402, cx: 360 };                    // the bar (channel)
export const SLOT = (IN.y1 - IN.y0) / 12;                           // height of one point
export const PLEN = 254;                                            // length of a point
export const D = 72, R = D / 2;                                     // checker diameter
export const MID = (IN.y0 + IN.y1) / 2;
export const TRAY = { opp: { x: 34, y: 214, w: 652, h: 44 }, me: { x: 34, y: 1306, w: 652, h: 44 } };
export const DICE = { x: 60, y: 1358, w: 600, h: 96, cy: 1406, x0: 158, x1: 604, d: 66 };   // dice tray and the tumbling area
export const CUBE = { x: 96, y: 1406, s: 58 };
export const BTN = {
  menu: { x: 34, y: 1474, w: 200, h: 64 }, undo: { x: 260, y: 1474, w: 200, h: 64 }, hint: { x: 486, y: 1474, w: 200, h: 64 },
  again: { x: 140, y: 900, w: 440, h: 96 }, back: { x: 140, y: 1016, w: 440, h: 84 }, share: { x: 140, y: 1120, w: 440, h: 84 },
  next: { x: 140, y: 1474, w: 440, h: 64 },
};
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// where point idx (0..23) sits: which column, its vertical centre, where its checkers start and which way they stack
export function pointGeom(idx) {
  const pt = idx + 1, left = pt <= 12, slot = left ? 12 - pt : pt - 13;
  return { left, slot, y: IN.y0 + (slot + 0.5) * SLOT, edge: left ? IN.x0 : IN.x1, dir: left ? 1 : -1 };
}
// centre of the k-th checker (0 = base) of n on point idx
export function stackPos(idx, k, n) {
  const g = pointGeom(idx), room = PLEN - 6, step = n <= 3 ? D + 1 : (room - D) / (n - 1);
  return { x: g.edge + g.dir * (R + 3 + k * step), y: g.y };
}
export function barPos(side, k, n) {
  const step = n <= 5 ? D + 2 : (MID - IN.y0 - 60 - D) / (n - 1), y0 = 6 + R;
  return { x: CH.cx, y: MID + (side === 0 ? 1 : -1) * (y0 + k * step) };
}
export const offPos = (side, k) => ({ x: 64 + k * 40, y: side === 0 ? TRAY.me.y + TRAY.me.h / 2 : TRAY.opp.y + TRAY.opp.h / 2 });
// The landing spot for a checker arriving on idx / bar / off, given how many are there already.
export function landing(idx, n, side) {
  if (idx === OFF) return offPos(side, n);
  if (idx === BAR) return barPos(side, n, n + 1);
  return stackPos(idx, n, n + 1);
}
// which target a screen tap means: a point 0..23, BAR, OFF, or -1
export function targetAt(x, y) {
  if (inRect({ x: TRAY.me.x, y: TRAY.me.y - 6, w: TRAY.me.w, h: TRAY.me.h + 14 }, x, y)) return OFF;
  if (y < IN.y0 - 8 || y > IN.y1 + 8) return -1;
  if (x > CH.x0 - 4 && x < CH.x1 + 4) return BAR;
  const slot = Math.floor((y - IN.y0) / SLOT); if (slot < 0 || slot > 11) return -1;
  if (x < CH.cx) return 12 - slot - 1;
  return 13 + slot - 1;
}
export const pointRect = (idx) => { const g = pointGeom(idx); return { x: g.left ? IN.x0 : IN.x1 - PLEN, y: g.y - SLOT / 2, w: PLEN, h: SLOT }; };

// ---- screens -------------------------------------------------------------------------------------------------------
// Title buttons depend on whether an unfinished game is saved.
export function titleRows(hasSave) {
  const names = (hasSave ? ['resume'] : []).concat(['play', 'learn', 'two', 'daily']), out = {};
  names.forEach((n, i) => { out[n] = { x: 110, y: 500 + i * 92, w: 500, h: 80 }; });
  const y = 500 + names.length * 92 + 6, half = (i, j) => ({ x: 110 + j * 256, y: y + i * 72, w: 244, h: 62 });
  out.level = half(0, 0); out.cube = half(0, 1); out.gammon = half(1, 0); out.settings = half(1, 1);
  // How to play / About / Rules share the third row as three even columns (Rules is the addition; same
  // row position and height as before, just three columns instead of two).
  const gap3 = 12, third = (500 - gap3 * 2) / 3, y3 = y + 2 * 72;
  out.howto = { x: 110, y: y3, w: third, h: 62 };
  out.about = { x: 110 + third + gap3, y: y3, w: third, h: 62 };
  out.rules = { x: 110 + 2 * (third + gap3), y: y3, w: third, h: 62 };
  return out;
}
export const PANEL = { x: 36, y: 250, w: 648, h: 1150 };
export const PBACK = { x: 140, y: 1420, w: 440, h: 76 };
// Text-size steps for the reference pages (About/How to play/Rules) drawn by drawDoc(). An index
// into this array, never a raw float, so the stepper can cleanly disable at either end and a
// clamp-on-load can never point past the end of the array.
export const TEXT_SCALES = [1, 1.15, 1.3];
// The A-/A+ stepper buttons, in the panel's own header row, flanking the title on both sides —
// same idea as a header row's Back/Next, just this page's own reader card instead.
export const TEXT_BTN = {
  dec: { x: PANEL.x + 22, y: PANEL.y + 20, w: 100, h: 56 },
  inc: { x: PANEL.x + PANEL.w - 22 - 100, y: PANEL.y + 20, w: 100, h: 56 },
};
export const SET_ROWS = ['sound', 'calm', 'big', 'set', 'auto', 'moves'].reduce((o, n, i) => { o[n] = { x: 90, y: 330 + i * 116, w: 540, h: 92 }; return o; }, {});
export const CUBE_ASK = { take: { x: 90, y: 760, w: 250, h: 84 }, drop: { x: 380, y: 760, w: 250, h: 84 } };
export const OVER = { again: { x: 110, y: 790, w: 500, h: 84 }, menu: { x: 110, y: 890, w: 240, h: 72 }, share: { x: 370, y: 890, w: 240, h: 72 } };
export const DONE = { x: 260, y: 1474, w: 426, h: 64 };
