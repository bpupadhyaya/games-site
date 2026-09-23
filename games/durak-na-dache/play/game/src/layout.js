// Screen geometry for the 720x1560 portrait canvas, shared by drawing (view.js) and input (game.js).
export const W = 720, H = 1560;
export const CARD = { w: 150, h: 210 };
export const FONT = '"Cormorant Garamond", Georgia, "Times New Roman", serif';

export const inRect = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export const rect = (x, y, w, h) => ({ x, y, w, h });
export const mid = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

export const TOP = { menu: rect(22, 22, 96, 92), info: rect(132, 22, 456, 92), sound: rect(602, 22, 96, 92) };

// Opponent seats (top of the table). n = number of players including you.
export function seatSpot(n, seat) {
  // seat 0 is you (bottom). Others are ordered clockwise and spread along the far edge.
  const others = n - 1, k = seat - 1;
  const xs = others === 1 ? [360] : others === 2 ? [190, 530] : [130, 360, 590];
  return { x: xs[k], y: 258, scale: others === 1 ? 0.5 : others === 2 ? 0.44 : 0.4, maxW: others === 1 ? 300 : others === 2 ? 260 : 190 };
}

export const STOCK = { x: 118, y: 500, scale: 0.7 };
export const TRUMP = { x: 178, y: 500 };
export const DISCARD = { x: 606, y: 500, scale: 0.7 };

// Table pair slots: up to 6, three columns by two rows.
export const PAIR_SCALE = 0.9;
export function pairSpot(i) {
  const col = i % 3, row = (i / 3) | 0;
  return { x: 128 + col * 232, y: 690 + row * 224 };
}
export const TRANSFER_SLOT = (n) => { const s = pairSpot(Math.min(5, n)); return { x: s.x, y: s.y, w: 150 * PAIR_SCALE, h: 210 * PAIR_SCALE }; };
export const TABLE_ZONE = rect(30, 560, 660, 480);

export const BAR = { y: 1078, h: 80 };
export const ACTIONS = ['take', 'bito', 'hint', 'undo', 'seen'];
export function actionRect(k) { const i = ACTIONS.indexOf(k); return rect(24 + i * 138, BAR.y, 126, BAR.h); }

export const HAND_Y = 1352;
// Where hand card i of n sits (centre), and its fan rotation. Rows kick in beyond 9 cards.
export function handSlot(i, n) {
  const perRow = 9;
  const rows = Math.max(1, Math.ceil(n / perRow));
  const row = rows === 1 ? 0 : Math.min(rows - 1, Math.floor(i / Math.ceil(n / rows)));
  const perThis = rows === 1 ? n : Math.ceil(n / rows);
  const col = rows === 1 ? i : i - row * perThis;
  const cnt = rows === 1 ? n : Math.min(perThis, n - row * perThis);
  const span = 640;
  const step = cnt <= 1 ? 0 : Math.min(cnt <= 6 ? 108 : 100, (span - CARD.w) / (cnt - 1));
  const cx = 360 + (col - (cnt - 1) / 2) * step;
  const c = col - (cnt - 1) / 2;
  const rot = rows === 1 ? c * (cnt <= 6 ? 2.6 : 2.2) * Math.PI / 180 : c * 1.4 * Math.PI / 180;
  const pitch = rows > 2 ? 88 : 106;
  const cy = HAND_Y - (rows - 1 - row) * pitch + (rows === 1 ? c * c * 1.5 : c * c * 0.6);
  return { x: cx, y: cy, rot, row };
}

// Pitch/height tightened slightly (was 108/90) to make room for the new "Auto Play" entry without
// pushing the stats panels below it off the bottom of the canvas, in the worst case (a saved game
// present, so the list is at its longest: Continue/New/Learn/Daily/About/Settings/Rules/Auto).
export const MENU_BTN = (i, n = 5) => rect(110, 704 + i * 92, 500, 84);
// Plain single "Back" pill used by every OTHER scene (lesson, daily, settings, etc.) — still just
// one small top-left button, never crowded.
export const BACK = rect(26, 24, 130, 70);

// Text-size stepper for the reference pages (About/Rules): two small pills in the TOP corners only,
// well clear of the page title below them. An index into TEXT_SCALES, never a raw float, so a stray
// out-of-range save can always be clamped back into bounds.
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const HEADER = {
  textDec: rect(20, 20, 130, 68),
  textInc: rect(W - 150, 20, 130, 68),
};
// Reference-page nav (About/Rules): an equal-width Back/Next pill pair anchored near the bottom of
// the canvas, clear of the reader panel above it — previously these shared one crowded row at the
// very top with the text-size stepper (`BACK`/`NEXT` at y:24). Back is the neutral/secondary
// action, Next the primary one (lacquer()'s own 'gold' kind).
export const REF_BACK = rect(20, 1416, 330, 116);
export const REF_NEXT = rect(370, 1416, 330, 116);

// One row per toggle: Sound, Reduced motion, Large print, Four-colour suits, Card back theme.
export const SETTINGS_ROWS = 5;
export const SETTINGS_ROW = (i) => rect(90, 290 + i * 132, W - 180, 104);

export const SETUP = {
  players: [2, 3, 4].map((v, i) => ({ v, r: rect(110 + i * 170, 330, 150, 84) })),
  modes: [rect(70, 494, 285, 96), rect(365, 494, 285, 96)],
  levels: [1, 2, 3, 4].map((v, i) => ({ v, r: rect(60 + (i % 2) * 300, 690 + ((i / 2) | 0) * 118, 280, 100) })),
  start: rect(110, 1080, 500, 112),
};

// ---- Auto Play ("Watch & Learn") ------------------------------------------------------------
// Configurable THINK pause: index-based steps (never a raw float), hard-capped at 10s. Status bar
// sits in the ~70px gap between the top bar and the opponent seats — otherwise empty during play.
export const AUTO_THINK_STEPS = [2, 5, 8, 10];
export const AUTO_REVEAL_SECS = 2;
export const AUTO_BAR = rect(20, 122, W - 40, 62);
export const AUTO_DEC = rect(30, 134, 60, 40);
export const AUTO_INC = rect(W - 90, 134, 60, 40);
// Take/Bito/Hint/Undo/Seen have no meaning in a spectator run — Auto Play's Exit/Pause/Skip share
// the same action-bar row, just three wider buttons instead of five.
const AUTO_ACTIONS = ['exit', 'pause', 'skip'];
export function autoActionRect(k) { const i = AUTO_ACTIONS.indexOf(k); return rect(24 + i * 228, BAR.y, 210, BAR.h); }
