// Geometry (virtual canvas 720 x 1560). The slab (papamu) is a square; the playing grid sits inside its tapa border.
export const W = 720, H = 1560;
export const SLAB = { x: 24, y: 424, w: 672, h: 672 };
export const GRID = { x: 60, y: 460, size: 600 };
export const cellSize = (n) => GRID.size / n;
export const cellCenter = (n, i) => { const c = cellSize(n), x = i % n, y = (i - x) / n; return { x: GRID.x + (x + 0.5) * c, y: GRID.y + (y + 0.5) * c }; };
export const stoneRadius = (n) => cellSize(n) * 0.375;
// Which square a tap means (any tap inside the square counts; the whole cell is the target, thumbs are big).
export function squareAt(n, x, y) {
  const c = cellSize(n), cx = Math.floor((x - GRID.x) / c), cy = Math.floor((y - GRID.y) / c);
  return cx < 0 || cy < 0 || cx >= n || cy >= n ? -1 : cx + n * cy;
}
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
const R = (x, y, w, h) => ({ x, y, w, h });
export const BTN = {
  menu: R(60, 1462, 190, 72), undo: R(265, 1462, 190, 72), hint: R(470, 1462, 190, 72),
  again: R(140, 1000, 440, 96), back: R(140, 1116, 440, 84), share: R(140, 1220, 440, 84), next: R(140, 1462, 440, 72),
};
// Title screen buttons.
export function titleRows(hasSave) {
  const names = (hasSave ? ['resume'] : []).concat(['play', 'learn', 'daily', 'how', 'about']), out = {}, y0 = hasSave ? 690 : 730;
  names.forEach((nm, i) => { out[nm] = R(90, y0 + i * 88, 540, 76); });
  const y = y0 + names.length * 88 + 8;
  out.sound = R(90, y, 172, 62); out.calm = R(274, y, 172, 62); out.big = R(458, y, 172, 62);
  return out;
}
// Setup screen: board size (3), your side (2), computer level (4), start.
export const SETUP = {
  sizes: [0, 1, 2].map((i) => R(90 + i * 184, 690, 172, 84)),
  sides: [0, 1, 2].map((i) => R(90 + i * 184, 880, 172, 84)),
  levels: [0, 1, 2, 3].map((i) => R(90 + (i % 2) * 278, 1060 + Math.floor(i / 2) * 92, 262, 80)),
  start: R(110, 1290, 500, 96), back: R(60, 1462, 190, 72),
};
export const HELP = { prev: R(60, 1462, 190, 72), next: R(470, 1462, 190, 72), back: R(265, 1462, 190, 72) };
