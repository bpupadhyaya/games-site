// Geometry. Virtual canvas 720 x 1560. The board is seen from above: 9 files by 10 ranks, points D apart.
// When the human plays Black the board is turned round (flip) so the human always sits at the bottom.
export const W = 720, H = 1560;
export const D = 76, GX = 56, GY = 372;                  // spacing, and the top-left point of the grid
export const PIECE_R = 32;
export const BOARD = { x: 4, y: GY - 40, w: 712, h: 9 * D + 80 };

export function pointXY(sq, flip = false) {
  let x = sq % 9, y = (sq / 9) | 0;
  if (flip) { x = 8 - x; y = 9 - y; }
  return { x: GX + x * D, y: GY + y * D };
}
// Which board square a screen position means (nearest point), or -1
export function squareAt(px, py, flip = false) {
  let cx = Math.round((px - GX) / D), cy = Math.round((py - GY) / D);
  if (cx < 0 || cx > 8 || cy < 0 || cy > 9) return -1;
  if (Math.hypot(px - (GX + cx * D), py - (GY + cy * D)) > D * 0.62) return -1;
  if (flip) { cx = 8 - cx; cy = 9 - cy; }
  return cy * 9 + cx;
}

// Screen furniture. The app draws its own "Menu" button top-left, so nothing important sits there.
const row = (i, y0 = 738) => ({ x: 90, y: y0 + i * 84, w: 540, h: 72 });
// Title buttons: [resume?] learn, red, black, two, daily; then two rows of small buttons and one wide one.
export function titleRows(hasSave) {
  const names = (hasSave ? ['resume'] : []).concat(['learn', 'red', 'black', 'two', 'daily']), out = {};
  const y0 = hasSave ? 690 : 740;
  names.forEach((n, i) => { out[n] = row(i, y0); });
  const y = y0 + names.length * 84 + 8;
  // Language choice: a clearly labeled row right on the title screen (not only in Settings), so it is the first
  // thing a player sees rather than something buried behind a generic settings button.
  out.langZh = { x: 90, y, w: 262, h: 76 }; out.langEn = { x: 368, y, w: 262, h: 76 };
  out.level = { x: 90, y: y + 84, w: 262, h: 66 }; out.sound = { x: 368, y: y + 84, w: 262, h: 66 };
  // How to play / About / Rules share one row, three even columns spanning the same width the row used as two
  // columns before (Rules is the addition) - nothing else on the title screen moved.
  { const gap = 14, third = (540 - gap * 2) / 3, ry = y + 160;
    out.how = { x: 90, y: ry, w: third, h: 66 };
    out.about = { x: 90 + third + gap, y: ry, w: third, h: 66 };
    out.rules = { x: 90 + (third + gap) * 2, y: ry, w: third, h: 66 }; }
  out.look = { x: 90, y: y + 236, w: 540, h: 66 };
  return out;
}
export const LOOK = {
  lang: [0, 1].map((i) => ({ x: 90 + i * 278, y: 470, w: 262, h: 76 })),
  boards: [0, 1].map((i) => ({ x: 90 + i * 278, y: 615, w: 262, h: 76 })),
  sets: [0, 1].map((i) => ({ x: 90 + i * 278, y: 760, w: 262, h: 76 })),
  text: [0, 1].map((i) => ({ x: 90 + i * 278, y: 905, w: 262, h: 76 })),
  calm: [0, 1].map((i) => ({ x: 90 + i * 278, y: 1050, w: 262, h: 76 })),
  sound: [0, 1].map((i) => ({ x: 90 + i * 278, y: 1195, w: 262, h: 76 })),
  back: { x: 140, y: 1350, w: 440, h: 84 },
};
export const BTN = {
  menu: { x: 60, y: 1462, w: 190, h: 72 }, undo: { x: 265, y: 1462, w: 190, h: 72 }, hint: { x: 470, y: 1462, w: 190, h: 72 },
  again: { x: 140, y: 1090, w: 440, h: 92 }, back: { x: 140, y: 1200, w: 440, h: 84 }, share: { x: 140, y: 1300, w: 440, h: 80 },
  next: { x: 140, y: 1462, w: 440, h: 72 }, prev: { x: 60, y: 1462, w: 190, h: 72 },
  done: { x: 140, y: 1462, w: 440, h: 72 }, page: { x: 470, y: 1462, w: 190, h: 72 },
};
// Text-size steps for the How to play / About / Rules reference pages. Index into this array, never
// a raw float, so the stepper can disable cleanly at either end and a stale saved index from a build
// with a different-length array can be clamped instead of producing NaN sizes.
export const TEXT_SCALES = [1, 1.15, 1.3];
// Stepper buttons, top corners of the reference pages - clear of the centred heading/page-title text
// (which never reaches within 150px of either edge) and of the footer Back/Next row.
export const TEXTSTEP = {
  dec: { x: 18, y: 16, w: 110, h: 64 },
  inc: { x: W - 128, y: 16, w: 110, h: 64 },
};
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
// Player plates: opponent above the board, you below it
export const PLATE = { top: { x: 40, y: 224, w: 640, h: 88 }, bottom: { x: 40, y: 1134, w: 640, h: 88 } };
export const MSG = { x: 40, y: 1240, w: 640, h: 190 };
// The result panel that opens over the board when a game ends
export const RES = {
  panel: { x: 70, y: 440, w: 580, h: 650 },
  again: { x: 120, y: 800, w: 480, h: 88 }, look: { x: 120, y: 900, w: 480, h: 80 }, menu: { x: 120, y: 992, w: 480, h: 80 },
};
export const LOOKLABEL = [440, 585, 730, 875, 1020, 1165];
