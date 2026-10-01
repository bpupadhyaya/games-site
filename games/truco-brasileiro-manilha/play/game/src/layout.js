// Geometry for the 720 x 1560 canvas. Everything that can be tapped is defined here.
export const W = 720, H = 1560;
export const CW = 150, CH = 210;          // a card in your hand
export const BW = 74, BH = 105;           // a card back in a computer player's hand (scale 0.5)
export const HAND_Y = 1196;               // top of the cards in your hand
export const LIFT = 46;
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export const R = (x, y, w, h) => ({ x, y, w, h });

export function handSlot(i, n) {
  const step = n <= 1 ? 0 : Math.min(184, (W - 40 - CW) / (n - 1));
  const total = CW + step * (n - 1);
  return { x: (W - total) / 2 + step * i, y: HAND_Y, step };
}
// table positions: 0 south (you), 1 east, 2 north, 3 west
export const TRICK = [{ x: 360, y: 925 }, { x: 507, y: 778 }, { x: 360, y: 632 }, { x: 213, y: 778 }];
export const SEAT = [{ x: 360, y: 1300 }, { x: 660, y: 760 }, { x: 360, y: 370 }, { x: 60, y: 760 }];
export const DECK = { x: 360, y: 740 };
export const TABLE = { x: 60, y: 482, w: 600, h: 560 };
export const TSC = 0.757;                  // scale of a card lying on the table

export const BTN = { hint: R(24, 1452, 200, 86), sig: R(260, 1452, 200, 86), menu: R(496, 1452, 200, 86) };
export const PLATE_US = R(24, 44, 214, 84), PLATE_THEM = R(482, 44, 214, 84), STAKE = R(256, 40, 208, 92);
export const VIRA = R(24, 140, 352, 96), TRICKS = R(392, 140, 304, 96);
export const TOAST = R(40, 246, 640, 66);
export const TRUCO_BTN = R(150, 1070, 420, 84);
export const ANS = [R(28, 1078, 210, 104), R(255, 1078, 210, 104), R(482, 1078, 210, 104)];
export const ACT = { a: R(30, 1078, 316, 104), b: R(374, 1078, 316, 104) };
export const PANEL = R(16, 972, 688, 224);
export const SIGPOP = Array.from({ length: 4 }, (_, i) => R(30 + (i % 2) * 336, 1036 + Math.floor(i / 2) * 82, 318, 74));
export const SIGCLOSE = R(600, 972, 104, 40);
export const OVERLAY_BTN = R(160, 1290, 400, 104);
export const OVERLAY_BTN2 = R(160, 1176, 400, 90);
export const BACK = R(24, 40, 120, 60);

// ---- title screen --------------------------------------------------------------------------------------------
export function titleRows(hasSave) {
  const x = 90, w = 540, o = {};
  let y = hasSave ? 760 : 820;
  const row = (h, g = 14) => { const r = R(x, y, w, h); y += h + g; return r; };
  if (hasSave) o.resume = row(92, 12);
  o.play = row(hasSave ? 92 : 104, 14);
  const half = (w - 12) / 2, third = (w - 24) / 3;
  const seg = (n, h = 68) => { const rs = []; for (let i = 0; i < n; i++) rs.push(R(x + i * ((w - (n - 1) * 12) / n + 12), y, (w - (n - 1) * 12) / n, h)); y += h + 12; return rs; };
  o.variant = seg(2); o.players = seg(2); o.level = seg(3);
  y += 6;
  const duo = () => { const r = [R(x, y, half, 80), R(x + half + 12, y, half, 80)]; y += 92; return r; };
  [o.how, o.rules] = duo();
  const tri = [R(x, y, third, 80), R(x + third + 12, y, third, 80), R(x + 2 * (third + 12), y, third, 80)];
  [o.about, o.settings, o.auto] = tri;
  return o;
}
// Large-text title: one scrolling column (used when the text zoom is above 100%).
export const HEADER_H = 330;
// ---- reference pages --------------------------------------------------------------------------------------------
export const REF_BACK = R(20, 1424, 330, 108);
export const REF_NEXT = R(370, 1424, 330, 108);
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const TEXT_DEC = R(20, 20, 130, 68);
export const TEXT_INC = R(W - 150, 20, 130, 68);
export const REF_PANEL = R(30, 108, 660, 1290);
// ---- auto play ---------------------------------------------------------------------------------------------------
export const AUTO_THINK_STEPS = [2, 5, 8, 10];
export const AUTO_REVEAL_SECS = 2;
export const AUTO_BAR = R(24, 242, 672, 66);
export const AUTO_DEC = R(560, 262, 56, 36);
export const AUTO_INC = R(624, 262, 56, 36);
// Large-text title: a single scrolling column of rows whose height grows with the text zoom.
export function largeTitle(scale, hasSave) {
  const ids = [...(hasSave ? ['resume'] : []), 'play', 'variant', 'players', 'level', 'how', 'rules', 'about', 'settings', 'auto'];
  const h = Math.round(64 * scale + 24), g = 14; let y = HEADER_H; const rows = {};
  for (const id of ids) { rows[id] = R(40, y, 640, h); y += h + g; }
  return { rows, contentH: y + 60, h };
}
