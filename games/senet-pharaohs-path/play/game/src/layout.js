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
};
const row = (i) => ({ x: 90, y: 790 + i * 76, w: 540, h: 66 });
export function titleRows(hasSave) {
  const names = (hasSave ? ['resume'] : []).concat(['learn', 'play', 'two', 'daily', 'how', 'about']), out = {};
  names.forEach((n, i) => { out[n] = row(i); });
  const y = 790 + names.length * 76 + 6;
  out.level = { x: 90, y, w: 262, h: 60 }; out.sound = { x: 368, y, w: 262, h: 60 };
  out.calm = { x: 90, y: y + 68, w: 262, h: 60 }; out.big = { x: 368, y: y + 68, w: 262, h: 60 };
  return out;
}
export const PAGE = { back: { x: 140, y: 1440, w: 440, h: 84 }, next: { x: 380, y: 1440, w: 260, h: 84 }, prev: { x: 80, y: 1440, w: 260, h: 84 } };
