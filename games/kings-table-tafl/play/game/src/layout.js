// Geometry. Virtual canvas 720 x 1560. The board is always 616 wide, so 11x11 squares are 56 and 7x7 squares 88.
export const W = 720, H = 1560;
export const BX = 52, BY = 500, BS = 616;
export const cell = (n) => BS / n;
export const centerOf = (n, i) => ({ x: BX + ((i % n) + 0.5) * cell(n), y: BY + (((i / n) | 0) + 0.5) * cell(n) });
export function squareAt(n, px, py) {
  const cs = cell(n), x = Math.floor((px - BX) / cs), y = Math.floor((py - BY) / cs);
  return x < 0 || y < 0 || x >= n || y >= n ? -1 : x + n * y;
}
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
const R = (x, y, w, h) => ({ x, y, w, h });
export const BTN = {
  menu: R(60, 1462, 190, 72), undo: R(265, 1462, 190, 72), hint: R(470, 1462, 190, 72),
  again: R(140, 980, 440, 96), back: R(140, 1096, 440, 84), share: R(140, 1160, 440, 84),
  next: R(265, 1462, 395, 72), skip: R(470, 1462, 190, 72),
};
// Title screen: rows of crafted buttons.
export function titleRows(hasSave) {
  const names = (hasSave ? ['resume'] : []).concat(['learn', 'big', 'small', 'daily', 'two']), out = {};
  names.forEach((nm, i) => { out[nm] = R(90, 700 + i * 76, 540, 66); });
  const y = 700 + names.length * 76 + 6;
  out.side = R(90, y, 262, 60); out.level = R(368, y, 262, 60);
  out.sound = R(90, y + 68, 262, 60); out.calm = R(368, y + 68, 262, 60);
  out.text = R(90, y + 136, 262, 60); out.about = R(368, y + 136, 262, 60);
  // Controls and the new Rules reference share the row Controls used to have alone, same two-column
  // pattern as side/level, sound/calm, text/about above - nothing else on the title screen moves.
  out.help = R(90, y + 204, 262, 60); out.rules = R(368, y + 204, 262, 60);
  return out;
}
