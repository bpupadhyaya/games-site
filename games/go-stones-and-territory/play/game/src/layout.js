// Geometry. Virtual canvas 720 x 1560. A board layout L = { n, x, y, size, d, m } (top-left of the board face, its side,
// the spacing of the crossings, and the margin from the face edge to the first line).
export const W = 720, H = 1560;

export function boardLayout(n, x = 36, y = 312, size = 648) {
  const d = size / (n - 1 + 1.3), m = d * 0.65;
  return { n, x, y, size, d, m };
}
export const px = (L, i) => L.x + L.m + (i % L.n) * L.d;
export const py = (L, i) => L.y + L.m + Math.floor(i / L.n) * L.d;
export const stoneR = (L) => L.d * 0.485;

// nearest crossing to a screen point; -1 when the point is clearly off the board
export function pointNear(L, x, y) {
  const gx = Math.round((x - L.x - L.m) / L.d), gy = Math.round((y - L.y - L.m) / L.d);
  if (x < L.x - 8 || y < L.y - 8 || x > L.x + L.size + 8 || y > L.y + L.size + 8) return -1;
  const cx = Math.max(0, Math.min(L.n - 1, gx)), cy = Math.max(0, Math.min(L.n - 1, gy));
  return cy * L.n + cx;
}

export function starPoints(n) {
  if (n === 19) return [3, 9, 15].flatMap((y) => [3, 9, 15].map((x) => y * 19 + x));
  if (n === 13) return [[3, 3], [9, 3], [3, 9], [9, 9], [6, 6]].map(([x, y]) => y * 13 + x);
  if (n === 9) return [[2, 2], [6, 2], [2, 6], [6, 6], [4, 4]].map(([x, y]) => y * 9 + x);
  if (n === 7) return [[3, 3]].map(([x, y]) => y * 7 + x);
  return [Math.floor(n / 2) * n + Math.floor(n / 2)];
}

export const inRect = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// Screen furniture. The app draws its own "Menu" button top-left, so nothing important sits there.
export const PLAYBOARD = boardLayout(9);
export const R = {
  place: { x: 250, y: 1118, w: 220, h: 104 },
  pass: { x: 36, y: 1290, w: 150, h: 84 }, undo: { x: 202, y: 1290, w: 150, h: 84 },
  hint: { x: 368, y: 1290, w: 150, h: 84 }, menu: { x: 534, y: 1290, w: 150, h: 84 },
  msg: { x: 36, y: 972, w: 648, h: 122 },
  next: { x: 190, y: 1118, w: 340, h: 104 },
  back: { x: 36, y: 1290, w: 150, h: 84 }, reset: { x: 202, y: 1290, w: 150, h: 84 }, skip: { x: 534, y: 1290, w: 150, h: 84 },
  done: { x: 190, y: 1118, w: 340, h: 104 },
};
export const titleButtons = (hasSave) => {
  // 'rules' is appended LAST on purpose: every earlier row keeps the exact x/y/w/h it always had.
  const names = (hasSave ? ['resume'] : []).concat(['play', 'learn', 'daily', 'about', 'how', 'settings', 'rules']);
  const out = {}, y0 = hasSave ? 872 : 900, h = hasSave ? 74 : 80, gap = hasSave ? 12 : 14;
  names.forEach((nm, i) => { out[nm] = { x: 110, y: y0 + i * (h + gap), w: 500, h }; });
  return out;
};

// The paginated reference pages (About / How to play / Rules): Back exits to the title, Next
// cycles pages with wraparound. All three screens share this one footer nav.
export const PAGE_NAV = { back: { x: 36, y: 1380, w: 300, h: 84 }, next: { x: 384, y: 1380, w: 300, h: 84 } };

// Text-size steps for the About/How/Rules reference pages. An *index* into this, never a raw
// float, so "min"/"max" are exact and the stepper can cleanly disable at either end. Content on
// every reference page is paced (content.js) to fit comfortably even at the top step.
export const TEXT_SCALES = [1, 1.15, 1.3];
// "A-"/"A+" stepper buttons, flanking the big page title (drawn at y=176) above the reader panel
// (which starts at y=214) - out of the way of the panel and of Back/Next at the bottom.
export const TEXT_BTN = {
  dec: { x: 30, y: 122, w: 128, h: 72 },
  inc: { x: W - 30 - 128, y: 122, w: 128, h: 72 },
};
