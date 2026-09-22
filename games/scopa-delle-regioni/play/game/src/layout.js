// Geometry of the virtual 720 x 1560 canvas.
export const W = 720, H = 1560;
export const inRect = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

export const HAND = { w: 192, h: 307, y: 1290, xs: [144, 360, 576], lift: 34 };
export const handPos = (i) => ({ x: HAND.xs[i], y: HAND.y });
export const CLOTH = { x: 26, y: 356, w: 668, h: 674 };
export const DECK = { x: 30, y: 1036, w: 96, h: 90 };
export const PILE = { x: 594, y: 1036, w: 96, h: 90 };
export const deckPos = { x: 62, y: 1081 }, pilePos = { x: 626, y: 1081 };
export const MSG = { x: 134, y: 1034, w: 452, h: 92 };

// seats around the table for the "other" players, along the top of the table
export function seatPos(n, seat) {
  if (n === 2) return { x: 360, y: 268 };
  return { x: [0, 225, 385, 545][seat], y: 268 };
}
// The table cards sit in fixed slots so they never jump around when others are taken.
export function tableGrid(count) {
  const big = count <= 12;
  return big
    ? { cols: 4, w: 124, h: 198, px: 150, py: 216, y0: 477, rowOrder: [1, 0, 2], colOrder: [1, 2, 0, 3], slots: 12 }
    : { cols: 6, w: 97, h: 155, px: 106, py: 164, y0: 447, rowOrder: [1, 2, 0, 3], colOrder: [2, 3, 1, 4, 0, 5], slots: 24 };
}
export function slotPos(i, gr) {
  const r = gr.rowOrder[Math.floor(i / gr.cols)] ?? 0, c = gr.colOrder[i % gr.cols];
  return { x: 360 + (c - (gr.cols - 1) / 2) * gr.px, y: gr.y0 + r * gr.py };
}

export const BTN = {
  menu: { x: 40, y: 1462, w: 190, h: 72 }, undo: { x: 265, y: 1462, w: 190, h: 72 }, hint: { x: 490, y: 1462, w: 190, h: 72 },
  next: { x: 200, y: 1462, w: 320, h: 72 }, share: { x: 200, y: 1462, w: 320, h: 72 },
  again: { x: 130, y: 1110, w: 460, h: 92 }, back: { x: 130, y: 1220, w: 460, h: 92 },
  cont: { x: 130, y: 1290, w: 460, h: 96 }, backPage: { x: 130, y: 1440, w: 460, h: 90 },
};
const row = (y, h = 84) => ({ x: 70, y, w: 580, h });
export function titleRows(hasSave) {
  let y = 800; const R = {};
  if (hasSave) { R.resume = row(y); y += 100; }
  R.learn = row(y); y += 100; R.play = row(y); y += 100; R.four = row(y); y += 100; R.daily = row(y); y += 100;
  R.about = { x: 70, y, w: 185, h: 78 }; R.controls = { x: 267, y, w: 185, h: 78 }; R.settings = { x: 465, y, w: 185, h: 78 };
  return R;
}
export const SET = {
  level: row(250), sound: row(345), calm: row(440), big: row(535), deck: row(630), target: row(725), back: { x: 130, y: 1440, w: 460, h: 90 },
};
