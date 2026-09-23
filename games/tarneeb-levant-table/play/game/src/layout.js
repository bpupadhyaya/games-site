// Geometry of the 720 x 1560 table. Seats: 0 South (you, bottom), 1 East (right), 2 North (partner, top), 3 West (left).
export const W = 720, H = 1560;
export const CARD = { w: 108, h: 158 };            // your cards in hand
export const TRICK_CARD = { w: 100, h: 146 };
export const BACK = { w: 58, h: 84 };              // the other players' cards
export const HAND_Y = 1276, LIFT = 48;
export const SLOT = [{ x: 360, y: 942 }, { x: 476, y: 812 }, { x: 360, y: 682 }, { x: 244, y: 812 }];
// where each seat's cards fly from / to (centre of its fan)
export const SEAT = [{ x: 360, y: 1350 }, { x: 640, y: 812 }, { x: 360, y: 312 }, { x: 80, y: 812 }];
export const DECK = { x: 360, y: 812 };
export const PLATE = [{ x: 360, y: 1216 }, { x: 606, y: 610 }, { x: 360, y: 400 }, { x: 114, y: 610 }];

// Positions of the n cards of your hand (left to right), each { x, y, w, h } (x is the left edge, y the top).
export function handLayout(n, w = CARD.w, h = CARD.h) {
  const step = n > 1 ? Math.min(w * 0.72, (W - 104 - w) / (n - 1)) : 0, total = step * (n - 1) + w, x0 = (W - total) / 2;
  return Array.from({ length: n }, (_, i) => ({ x: x0 + i * step, y: HAND_Y, w, h, step }));
}
// Which card a tap at (x, y) means: the front-most card (rightmost) whose visible part contains the point.
export function cardAt(n, sel, x, y) {
  const L = handLayout(n);
  for (let i = n - 1; i >= 0; i--) {
    const r = L[i], right = i === n - 1 ? r.x + r.w : r.x + r.step, top = r.y - (i === sel ? LIFT : 0) - 6;
    if (x >= r.x && x <= right && y >= top && y <= r.y + r.h + 4) return i;
  }
  return -1;
}
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// About and Rules are both paginated reference pages (Back/Next/"Page N of M"), one concept per
// page. Two half-width buttons side by side, same row for both screens.
export const ABOUT_BACK = { x: 90, y: 1470, w: 260, h: 78 };
export const ABOUT_NEXT = { x: 370, y: 1470, w: 260, h: 78 };
export const RULES_BACK = { x: 90, y: 1470, w: 260, h: 78 };
export const RULES_NEXT = { x: 370, y: 1470, w: 260, h: 78 };
// Text-size stepper for the About/Rules reference pages, tucked into the otherwise-empty top
// corners of the screen (this game's Back/Next live at the bottom, not the top, so there is
// nothing up here to crowd). An index into TEXT_SCALES, never a raw float, so "min"/"max" are
// exact and the stepper can cleanly disable at either end.
export const TEXT_DEC = { x: 30, y: 36, w: 118, h: 62 };
export const TEXT_INC = { x: W - 30 - 118, y: 36, w: 118, h: 62 };
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];

// Auto Play ("Watch & Learn") think-time steps, in seconds. Index into this, same pattern as
// TEXT_SCALES above - never a raw float, so the +/- stepper can cleanly disable at either end.
// Hard-capped at 10s per the owner's explicit instruction. Default index 1 (5s).
export const THINK_STEPS = [2, 5, 8, 10];
export const BTN = {
  leave: { x: 40, y: 1478, w: 190, h: 70 }, undo: { x: 265, y: 1478, w: 190, h: 70 }, hint: { x: 490, y: 1478, w: 190, h: 70 },
  next: { x: 130, y: 900, w: 460, h: 88 }, back: { x: 130, y: 1004, w: 460, h: 80 }, lesson: { x: 130, y: 1040, w: 460, h: 84 },
};
// bidding panel: 7..13 in two rows, Pass, and the trump picker
export const BID = {
  panel: { x: 40, y: 948, w: 640, h: 216 },
  nums: [7, 8, 9, 10, 11, 12, 13].map((n, i) => ({ n, x: 62 + (i % 4) * 152, y: 986 + Math.floor(i / 4) * 76, w: 140, h: 66 })),
  pass: { x: 62 + 3 * 152, y: 986 + 76, w: 140, h: 66 },
  suits: [0, 1, 2, 3].map((s) => ({ s, x: 62 + s * 152, y: 984, w: 140, h: 140 })),
};
// title screen rows
const row = (i) => ({ x: 110, y: 700 + i * 92, w: 500, h: 80 });
export function titleRows(hasSave) {
  const names = (hasSave ? ['resume'] : []).concat(['learn', 'play', 'daily']), out = {};
  names.forEach((n, i) => { out[n] = row(i); });
  // About and Rules share what used to be a single full-width "about" row, split into two even
  // columns at the same y/height - the only change to the title screen (everything else below
  // still starts at exactly the same y it always did).
  const abr = row(names.length), half = (abr.w - 14) / 2;
  out.about = { x: abr.x, y: abr.y, w: half, h: abr.h };
  out.rules = { x: abr.x + half + 14, y: abr.y, w: half, h: abr.h };
  const y = 700 + (names.length + 1) * 92 + 8;
  out.level = { x: 110, y, w: 500, h: 66 };
  out.sound = { x: 110, y: y + 76, w: 242, h: 60 }; out.calm = { x: 368, y: y + 76, w: 242, h: 60 };
  out.big = { x: 110, y: y + 144, w: 242, h: 60 }; out.target = { x: 368, y: y + 144, w: 242, h: 60 };
  // Free, silent, whole-match teaching demo - one more full-width row below everything else, so it
  // never crowds the existing rows above it (both list shapes, with/without "Continue your match",
  // still end comfortably clear of the canvas bottom).
  out.auto = { x: 110, y: y + 220, w: 500, h: 78 };
  return out;
}
export const LESSON_ROWS = (n) => Array.from({ length: n }, (_, i) => ({ x: 60, y: 288 + i * 108, w: 600, h: 92 }));
export const LESSONS_BACK = (n) => ({ x: 130, y: 288 + n * 108 + 16, w: 460, h: 78 });
