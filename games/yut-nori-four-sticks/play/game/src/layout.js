// Geometry of the 720 x 1560 screen. The board is a square drawn flat on the mat.
export const W = 720, H = 1560;
export const BX0 = 88, BX1 = 632, BY0 = 420, BY1 = 964;          // corners of the track square
const S = (BX1 - BX0) / 5;
const CXc = (BX0 + BX1) / 2, CYc = (BY0 + BY1) / 2;
export const TOKEN_R = 33;

function coords(i) {
  if (i <= 4) return [BX1, BY1 - S * i];                             // 0..4 up the right side (0 = start corner)
  if (i <= 9) return [BX1 - S * (i - 5), BY0];                        // 5..9 along the top
  if (i <= 14) return [BX0, BY0 + S * (i - 10)];                      // 10..14 down the left side
  if (i <= 19) return [BX0 + S * (i - 15), BY1];                      // 15..19 along the bottom
  const lerp = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
  const c = [CXc, CYc], tr = [BX1, BY0], tl = [BX0, BY0], bl = [BX0, BY1], br = [BX1, BY1];
  if (i === 20 || i === 21) return lerp(tr, c, (i - 19) / 3);
  if (i === 22) return c;
  if (i === 23 || i === 24) return lerp(c, bl, (i - 22) / 3);
  if (i === 25 || i === 26) return lerp(tl, c, (i - 24) / 3);
  return lerp(c, br, (i - 26) / 3);                                    // 27, 28
}
export const POINTS = Array.from({ length: 29 }, (_, i) => { const [x, y] = coords(i); return { x, y }; });
export const HOME_POS = { x: 668, y: 1000 };                          // where a finishing token walks off to
export const isBig = (i) => i === 0 || i === 5 || i === 10 || i === 15 || i === 22;

// Tokens waiting / home (small tokens in a tray). Team 1 (computer) at the top, team 0 (you) below the board.
export const TRAY = [
  { wait: (k) => ({ x: 70 + k * 58, y: 1034 }), home: (k) => ({ x: 450 + k * 58, y: 1034 }), label: { x: 360, y: 1041 } },
  { wait: (k) => ({ x: 70 + k * 58, y: 330 }), home: (k) => ({ x: 450 + k * 58, y: 330 }), label: { x: 360, y: 337 } },
];
export const CHIP = (k, n) => { const w = 92, gap = 10, tot = n * w + (n - 1) * gap, x0 = 360 - tot / 2; return { x: x0 + k * (w + gap), y: 1090, w, h: 78 }; };
export const PAD = { x: 30, y: 1178, w: 660, h: 264 };               // the throwing mat: TAP or SWIPE here
export const BTN = {
  menu: { x: 40, y: 1462, w: 190, h: 74 }, undo: { x: 265, y: 1462, w: 190, h: 74 }, hint: { x: 490, y: 1462, w: 190, h: 74 },
  again: { x: 140, y: 1000, w: 440, h: 96 }, back: { x: 140, y: 1116, w: 440, h: 84 }, share: { x: 140, y: 1220, w: 440, h: 84 },
  next: { x: 265, y: 1462, w: 415, h: 74 },
};
const row = (i) => ({ x: 90, y: 790 + i * 76, w: 540, h: 66 });
export function titleRows(hasSave) {
  const names = (hasSave ? ['resume'] : []).concat(['learn', 'play', 'two', 'daily']), out = {};
  names.forEach((n, i) => { out[n] = row(i); });
  const y = 790 + names.length * 76 + 2;
  out.level = { x: 90, y, w: 262, h: 60 }; out.sound = { x: 368, y, w: 262, h: 60 };
  out.calm = { x: 90, y: y + 68, w: 262, h: 60 }; out.big = { x: 368, y: y + 68, w: 262, h: 60 };
  out.about = { x: 90, y: y + 136, w: 262, h: 60 }; out.how = { x: 368, y: y + 136, w: 262, h: 60 };
  return out;
}
export const PAGE_BACK = { x: 140, y: 1400, w: 440, h: 84 };
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// Which board point a tap means (nearest point within reach), or -1
export function pointNear(x, y) {
  let best = -1, bd = 1e9;
  for (let i = 0; i < 29; i++) { const p = POINTS[i], d = Math.hypot(p.x - x, p.y - 8 - y); if (d < bd) { bd = d; best = i; } }
  return bd < 52 ? best : -1;
}
