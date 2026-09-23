import { PTS } from './rules.js';
// Geometry. The board is a plane seen in perspective: board coordinates (u, v) with u in -3..3 (columns) and
// v in 0..6 (rows, 0 = far side). A true projective map, so straight lines stay straight.
export const W = 720, H = 1560;
// D: spacing of the points at the near edge. K and HGT set the tilt and how tall the board stands on the screen.
const CX = 360, D = 100, K = 0.028, Y_NEAR = 1322, HGT = 4700, Y_H = Y_NEAR - HGT;
// Everything drawn on the board (lines, inlays, pieces) scales with UNIT, so the scene grows in proportion.
export const UNIT = D / 126;

export function project(u, v) {
  const z = 1 + K * (6 - v);
  return { x: CX + (u * D) / z, y: Y_H + HGT / z, s: 1 / z };
}

// Board point index (x + 7 * y) -> screen
export const pointAt = (idx) => project((idx % 7) - 3, Math.floor(idx / 7));
export const PIECE_R = 45 * UNIT;
// Sizes: the fox is about three quarters of a point's width, a goose about half, so 17 geese never crowd the board.
export const SIZE = { F: 1.0, G: 0.78 };

// Screen furniture. The app draws its own "Menu" button top-left, so nothing important sits there.
const row = (i) => ({ x: 90, y: 770 + i * 78, w: 540, h: 68 });
// The title's buttons depend on whether an unfinished game is saved:
// { resume?, learn, fox, geese, two, daily, level, flock, sound, marks, calm, look }
export function titleRows(hasSave) {
  const names = (hasSave ? ['resume'] : []).concat(['learn', 'fox', 'geese', 'two', 'daily']), out = {};
  names.forEach((n, i) => { out[n] = row(i); });
  const y = 770 + names.length * 78 + 4;
  // three rows of two small buttons: [level | flock] [sound | warnings] [reduced motion | board and pieces]
  out.level = { x: 90, y, w: 262, h: 62 }; out.flock = { x: 368, y, w: 262, h: 62 };
  out.sound = { x: 90, y: y + 70, w: 262, h: 62 }; out.marks = { x: 368, y: y + 70, w: 262, h: 62 };
  // Reduced motion / Board and pieces used to be a 2-column row; it is now 3 columns, same y and
  // same overall span (90..630), to make room for Rules (Rules-page addition; nothing else moves).
  out.calm = { x: 90, y: y + 140, w: 168, h: 62 }; out.look = { x: 276, y: y + 140, w: 168, h: 62 }; out.rules = { x: 462, y: y + 140, w: 168, h: 62 };
  return out;
}
// The 'Board and pieces' screen: three boards, two piece sets, message size, back.
export const LOOK = {
  boards: [0, 1, 2].map((i) => ({ x: 90 + i * 184, y: 800, w: 172, h: 76 })),
  sets: [0, 1].map((i) => ({ x: 90 + i * 278, y: 960, w: 262, h: 76 })),
  text: [0, 1].map((i) => ({ x: 90 + i * 278, y: 1120, w: 262, h: 76 })),
  back: { x: 140, y: 1290, w: 440, h: 84 },
};
export const BTN = {
  menu: { x: 60, y: 1462, w: 190, h: 72 }, undo: { x: 265, y: 1462, w: 190, h: 72 }, hint: { x: 470, y: 1462, w: 190, h: 72 }, stop: { x: 470, y: 1462, w: 190, h: 72 },
  again: { x: 140, y: 900, w: 440, h: 96 }, back: { x: 140, y: 1016, w: 440, h: 84 }, share: { x: 140, y: 1120, w: 440, h: 84 },
  next: { x: 140, y: 1462, w: 440, h: 72 },
};
// Rules reference: paginated, reached from the title screen only. Back/Next share the bottom-bar
// row/height the play screen's own button bar already uses.
export const RULES_NAV = { back: { x: 90, y: 1462, w: 262, h: 72 }, next: { x: 368, y: 1462, w: 262, h: 72 } };
// Text-size steps for the Rules reference page. An *index* array, never a raw float, so the
// stepper below can cleanly disable at either end and a stale saved index can always be clamped.
export const TEXT_SCALES = [1, 1.15, 1.3];
// The text-size stepper on the Rules page: top corners flanking the "Rules" header, well clear of
// the Back/Next row that lives in the bottom bar.
export const RULES_TEXT = { dec: { x: 14, y: 14, w: 96, h: 58 }, inc: { x: W - 110, y: 14, w: 96, h: 58 } };
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
// The flock tray: one small row of up to 17 geese, the taken ones dimmed.
export const trayPos = (k) => ({ x: 74 + k * 36.5, y: 530, s: 1 });
// Which board point a tap means: the nearest point or the head standing on it.
export function pointNear(x, y) {
  let best = -1, bd = Infinity;
  for (const i of PTS) { const p = pointAt(i), d = Math.min(Math.hypot(p.x - x, p.y - y), Math.hypot(p.x - x, p.y - 26 * p.s - y)); if (d < bd) { bd = d; best = i; } }
  return bd < 56 ? best : -1;
}
// Tester tool (only drawn and only active behind the Developer toggle): a button on the title to jump into any lesson.
export const DEV_BTN = { x: 470, y: 40, w: 220, h: 56 };
