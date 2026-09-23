// Geometry for the 720 x 1560 canvas. Everything that is tapped is defined here.
export const W = 720, H = 1560;
export const CW = 148, CH = 208;          // a card in your hand
export const TW = 112, TH = 157;          // a card on the table
export const BW = 84, BH = 118;           // a card back in a computer player's hand
export const HAND_Y = 1188;               // top of the cards in your hand
export const LIFT = 46;
export const inRect = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export const R = (x, y, w, h) => ({ x, y, w, h });

// slot (top-left) of the i-th of n cards in your hand
export function handSlot(i, n) {
  const step = n <= 1 ? 0 : Math.min(98, (W - 32 - CW) / (n - 1));
  const total = CW + step * (n - 1);
  return { x: (W - total) / 2 + step * i, y: HAND_Y, step };
}
// centre of a card on the table for each seat: 0 you (south), 1 right (east), 2 partner (north), 3 left (west)
export const TRICK = [{ x: 360, y: 905 }, { x: 492, y: 758 }, { x: 360, y: 610 }, { x: 228, y: 758 }];
// where a seat's hand sits (centre) and where its played cards start from
export const SEAT = [{ x: 360, y: 1300 }, { x: 660, y: 760 }, { x: 360, y: 285 }, { x: 60, y: 760 }];
export const DECK = { x: 360, y: 740 };

export const BTN = {
  hint: R(24, 1452, 200, 86), undo: R(260, 1452, 200, 86), menu: R(496, 1452, 200, 86),
};
export const TOAST = R(60, 384, 600, 88);
export const CHIP = R(170, 164, 380, 50);

export function titleRows(hasSave) {
  const y0 = hasSave ? 820 : 880, h = 104, g = 22, x = 90, w = 540;
  let y = y0;
  const row = () => { const r = R(x, y, w, h); y += h + g; return r; };
  const o = {};
  if (hasSave) o.resume = row();
  o.play = row(); o.learn = row(); o.daily = row();
  o.level = R(x, y, w, 76); y += 76 + 16;
  // Settings / About / Controls / Rules / Auto Play share one row, five even columns (was four —
  // Auto Play is the addition: a silent, free, teaching-only watch mode, see AUTOPLAY docs in game.js).
  const sm = (w - 4 * 10) / 5, gap = 10;
  o.settings = R(x, y, sm, 84); o.about = R(x + sm + gap, y, sm, 84); o.how = R(x + 2 * (sm + gap), y, sm, 84); o.rules = R(x + 3 * (sm + gap), y, sm, 84); o.auto = R(x + 4 * (sm + gap), y, sm, 84);
  return o;
}
// ---- Auto Play (Watch & Learn) --------------------------------------------------------------------
// A separate, silent, free, THINK -> REVEAL -> ACT teaching-demo scene. See docs at the top of the
// auto-play block in game.js for the full behaviour. Configurable think-time steps, index-based
// (never a raw float), hard-capped at 10s per the owner's instruction.
export const AUTO_THINK_STEPS = [2, 5, 8, 10];
export const AUTO_REVEAL_SECS = 2;
// A slim HUD strip in the gap between the contract chip and the (face-up, study-mode) seats, so it
// never collides with the scoreboard plaques above or the cards below at any scene this appears in.
export const AUTO_BAR = R(40, 216, 640, 50);
export const AUTO_DEC = R(420, 224, 60, 34);
export const AUTO_INC = R(624, 224, 60, 34);
export const PANEL = R(30, 990, 660, 190);
export function bidButtons(n, round) {
  if (round === 1 || n <= 3) { const w = (660 - 2 * 16) / n; return Array.from({ length: n }, (_, i) => R(30 + i * (w + 16), 1050, w, 108)); }
  return [];
}
// Second-round layout: 3 trump-suit buttons on top, Sun and Pass below
export function bid2Buttons() {
  const w = (660 - 32) / 3, top = [0, 1, 2].map((i) => R(30 + i * (w + 16), 998, w, 84));
  const w2 = (660 - 16) / 2;
  return { suits: top, sun: R(30, 1094, w2, 84), pass: R(30 + w2 + 16, 1094, w2, 84) };
}
export const ACT = { a: R(30, 1074, 316, 104), b: R(374, 1074, 316, 104) };
export const OVERLAY_BTN = R(160, 1290, 400, 104);
export const LESSON_CARD = R(30, 110, 660, 210);
// Plain "Back" used by non-paginated screens (Lessons, Settings) — stays a small top-left pill.
export const BACK = R(24, 40, 120, 60);
// Reference-page (About/Controls/Rules) nav: a bottom-anchored, equal-width Back/Next pill pair,
// clear of the reader-card panel above it — never crammed into the header row. Back reads as the
// neutral/secondary action, Next as the primary (gold) action; disabled/"Done" states are handled
// in view.js.
export const REF_BACK = R(20, 1416, 330, 116);
export const REF_NEXT = R(370, 1416, 330, 116);
// Text-size stepper (A-/A+) for the About/Controls/Rules reference pages: two small pills in the
// TOP corners only, well clear of the title — matches the pattern used across every other game.
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const TEXT_DEC = R(20, 20, 130, 68);
export const TEXT_INC = R(W - 150, 20, 130, 68);
