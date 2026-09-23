// Geometry. The board is a plane seen in perspective: board coordinates (u, v) with u in -2..2
// (columns) and v in 0..4 (rows, 0 = far side). A true projective map, so straight lines stay straight.
export const W = 720, H = 1560;
// D: spacing of the points at the near edge. The board is as wide as the screen allows; K and HGT set the tilt.
const CX = 360, D = 138, K = 0.045, Y_NEAR = 1335, HGT = 3300, Y_H = Y_NEAR - HGT;
// Everything drawn on the board (lines, inlays, pieces) scales with UNIT, so the scene grows in proportion.
export const UNIT = D / 126;

export function project(u, v) {
  const z = 1 + K * (4 - v);
  return { x: CX + (u * D) / z, y: Y_H + HGT / z, s: 1 / z };
}

// Board point index 0..24 -> column i, row j
export const pointAt = (idx) => project((idx % 5) - 2, Math.floor(idx / 5));
export const PIECE_R = 45 * UNIT;
// Owner's sizes (2026-09-20): tigers at 75 %, goats at 50 % of the full piece size, so 20 goats never crowd the board.
export const SIZE = { T: 0.75, G: 0.5 };

// Screen furniture. The app draws its own "Menu" button top-left, so nothing important sits there.
const row = (i) => ({ x: 90, y: 770 + i * 78, w: 540, h: 68 });
// The title's buttons depend on whether an unfinished game is saved: { resume?, learn, goats, tigers, two, daily, level, sound, marks, calm, look }
export function titleRows(hasSave) {
  const names = (hasSave ? ['resume'] : []).concat(['learn', 'goats', 'tigers', 'two', 'daily']), out = {};
  names.forEach((n, i) => { out[n] = row(i); });
  const y = 770 + names.length * 78 + 4;
  // two rows of two small buttons: [level | sound] and [warnings | reduced motion]
  out.level = { x: 90, y, w: 262, h: 62 }; out.sound = { x: 368, y, w: 262, h: 62 };
  out.marks = { x: 90, y: y + 70, w: 262, h: 62 }; out.calm = { x: 368, y: y + 70, w: 262, h: 62 };
  // 'Board and pieces' used to span the full row alone; it now shares that same row/y with the
  // new Rules button, same two-column width as the rows above (Rules-page addition).
  out.look = { x: 90, y: y + 140, w: 262, h: 62 };
  out.rules = { x: 368, y: y + 140, w: 262, h: 62 };
  // Free, silent, whole-game teaching demo - one more full-width row below everything else, close
  // to the canvas edge in the "has a saved game" shape but still clear of it.
  out.auto = { x: 90, y: out.look.y + 62 + 30, w: 540, h: 72 };
  return out;
}
// The 'Board and pieces' screen: three board woods, two piece sets, back. (The old "message text"
// Normal/Large row moved to the Rules screen itself as a visible text-size stepper - see
// RULES_HEADER/TEXT_SCALES above - rather than staying buried in this settings screen.)
export const LOOK = {
  woods: [0, 1, 2].map((i) => ({ x: 90 + i * 184, y: 800, w: 172, h: 76 })),
  sets: [0, 1].map((i) => ({ x: 90 + i * 278, y: 960, w: 262, h: 76 })),
  back: { x: 140, y: 1120, w: 440, h: 84 },
};
export const BTN = {
  menu: { x: 60, y: 1462, w: 190, h: 72 }, undo: { x: 265, y: 1462, w: 190, h: 72 }, hint: { x: 470, y: 1462, w: 190, h: 72 },
  again: { x: 140, y: 900, w: 440, h: 96 }, back: { x: 140, y: 1016, w: 440, h: 84 }, share: { x: 140, y: 1120, w: 440, h: 84 },
  next: { x: 140, y: 1462, w: 440, h: 72 },
};
// Rules reference: paginated, reached from the title screen only. Back/Next share the same
// bottom-bar row/height the play screen's own button bar already uses.
export const RULES_NAV = { back: { x: 90, y: 1462, w: 262, h: 72 }, next: { x: 368, y: 1462, w: 262, h: 72 } };
// Text-size stepper for the Rules screen (index into TEXT_SCALES, never a raw float, so "min"/"max"
// are exact and the buttons can cleanly disable at either end). Top-left/top-right corners, well
// clear of both the Rules panel's own title below them and the Back/Next row at the bottom.
export const RULES_HEADER = {
  textDec: { x: 24, y: 20, w: 110, h: 60 },
  textInc: { x: W - 24 - 110, y: 20, w: 110, h: 60 },
};
// Text-size steps for the Rules reference page. Every page's content is paced (content.js) to fit
// comfortably even at the top step (raised from a 1.3x ceiling to 3x - text-size-300 request,
// 2026-09-22 - content.js pages were re-split as needed to still fit at the new top step).
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
// Auto Play ("Watch & Learn") think-time steps, in seconds. Index into this, same pattern as
// TEXT_SCALES above - never a raw float, so the +/- stepper can cleanly disable at either end.
// Hard-capped at 10s per the owner's explicit instruction. Default index 1 (5s).
export const THINK_STEPS = [2, 5, 8, 10];
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
// Where the goats still to be placed wait (two rows of ten), and where captured goats are laid out.
export const handPos = (k) => ({ x: 94 + (k % 10) * 59, y: 500 + Math.floor(k / 10) * 62, s: 1 });
// Captured goats sit in ONE compact row (20 fit), drawn at half size, so a message banner never covers them.
export const capturedPos = (k) => ({ x: 92 + k * 30, y: 704, s: 1 });
// Which board point a tap means: the nearest point or the head standing on it.
export function pointNear(x, y) {
  let best = -1, bd = Infinity;
  for (let i = 0; i < 25; i++) { const p = pointAt(i), d = Math.min(Math.hypot(p.x - x, p.y - y), Math.hypot(p.x - x, p.y - 26 * p.s - y)); if (d < bd) { bd = d; best = i; } }
  return bd < 62 ? best : -1;
}
