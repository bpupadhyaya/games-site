// Geometry. Virtual canvas 720 x 1560. The board is turned upright: three columns of ten squares. The path runs DOWN the left column
// (squares 1-10), UP the middle (11-20) and DOWN the right (21-30). The exit is below square 30.
export const W = 720, H = 1560;
export const CW = 164, CH = 88, BX = 114, BY = 352;            // one square, and the top-left of the 3 x 10 grid
export const BOARD = { x: BX, y: BY, w: CW * 3, h: CH * 10 };

// index 0..29 -> column and row
export function colRow(i) { const c = Math.floor(i / 10), k = i % 10; return { c, r: c === 1 ? 9 - k : k }; }
export const idxAt = (c, r) => (c === 1 ? 10 + (9 - r) : c * 10 + r);
export function cell(i) {
  const { c, r } = colRow(i);
  return { x: BX + c * CW, y: BY + r * CH, w: CW, h: CH, cx: BX + c * CW + CW / 2, cy: BY + r * CH + CH / 2 };
}
// The exit: a slot below the last square. TAP it to bring a piece home.
export const EXIT = { x: BX + 2 * CW + 12, y: BY + 10 * CH + 4, w: CW - 24, h: 50, cx: BX + 2.5 * CW, cy: BY + 10 * CH + 29 };
// Which square does a tap mean? -1 none, 30 = the exit.
export function squareAt(x, y) {
  if (inRect(EXIT, x, y)) return 30;
  if (x < BX || x >= BX + 3 * CW || y < BY || y >= BY + 10 * CH) return -1;
  return idxAt(Math.floor((x - BX) / CW), Math.floor((y - BY) / CH));
}
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// The stick tray, the message banner and the buttons.
export const TRAY = { x: 88, y: 1300, w: 544, h: 142 };
export const BTN = {
  menu: { x: 60, y: 1462, w: 190, h: 72 }, undo: { x: 265, y: 1462, w: 190, h: 72 }, hint: { x: 470, y: 1462, w: 190, h: 72 },
  again: { x: 140, y: 900, w: 440, h: 96 }, back: { x: 140, y: 1016, w: 440, h: 84 }, share: { x: 140, y: 1120, w: 440, h: 84 },
  next: { x: 265, y: 1462, w: 395, h: 72 },
  // Auto Play: originally the same bottom-row three-button shape as play's Menu/Undo/Hint
  // (Exit/Think-/Think+); now four evenly-sized buttons across that same 60-660 span to fit the
  // owner-requested Pause control (Exit, Pause, Think-, Think+) without moving the row or
  // resizing/touching anything above it. While paused, the row is replaced by `again`/`back`
  // (Resume/Exit) above - the same spot and size the result screens already use.
  apExit: { x: 60, y: 1462, w: 141, h: 72 }, apPause: { x: 213, y: 1462, w: 141, h: 72 },
  apDec: { x: 366, y: 1462, w: 141, h: 72 }, apInc: { x: 519, y: 1462, w: 141, h: 72 },
};
const row = (i) => ({ x: 90, y: 790 + i * 76, w: 540, h: 66 });
export function titleRows(hasSave) {
  // Auto Play: a new full-width row of its own (same shape as Learn/Play/Two/Daily/How above it),
  // added right after How to play -- the About/Rules row and the settings row below both compute
  // off `names.length`, so they shift down by the same 76px every row already steps by, and nothing
  // above this row moves.
  const names = (hasSave ? ['resume'] : []).concat(['learn', 'play', 'two', 'daily', 'how', 'autoplay']), out = {};
  names.forEach((n, i) => { out[n] = row(i); });
  // About used to be its own full-width row here (names.length); it now shares that same row, two
  // even columns, with Rules (the addition) - every row above keeps its exact original position,
  // and everything below keeps its exact original position too, since this still counts as one row.
  const aboutRow = row(names.length), gap = 14, half = (aboutRow.w - gap) / 2;
  out.about = { x: aboutRow.x, y: aboutRow.y, w: half, h: aboutRow.h };
  out.rules = { x: aboutRow.x + half + gap, y: aboutRow.y, w: half, h: aboutRow.h };
  const y = 790 + (names.length + 1) * 76 + 6;
  out.level = { x: 90, y, w: 262, h: 60 }; out.sound = { x: 368, y, w: 262, h: 60 };
  out.calm = { x: 90, y: y + 68, w: 262, h: 60 }; out.big = { x: 368, y: y + 68, w: 262, h: 60 };
  return out;
}
// Three even slots so Prev (only shown once past page 1) and Next (only shown before the last page)
// never collide with Back, which is always shown, centred.
export const PAGE = { prev: { x: 40, y: 1440, w: 200, h: 84 }, back: { x: 260, y: 1440, w: 200, h: 84 }, next: { x: 480, y: 1440, w: 200, h: 84 } };
// Text-size stepper for the About/How to play/Rules reference pages: a header row above the title,
// clear of the Back/Next/Prev/Menu row in the footer. "A-"/"A+" on all three screens.
export const TEXT_STEPPER = { dec: { x: 40, y: 24, w: 120, h: 62 }, inc: { x: W - 160, y: 24, w: 120, h: 62 } };
// Index into this, never a raw float, so the stepper can cleanly disable at either end and a stale
// saved index (e.g. from a build with a shorter array) always clamps instead of producing NaN sizes.
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
// Auto Play think-time steps, in seconds: an index into this array (never a raw float), default 5s
// (index 1), hard-capped at 10s per the owner's instruction that a longer wait defeats the point.
export const AP_THINK_STEPS = [2, 5, 8, 10];
