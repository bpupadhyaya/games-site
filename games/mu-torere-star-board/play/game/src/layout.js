// Geometry (virtual canvas 720 x 1560). The star board is centred at (BX, BY). Points 0..7 are the eight
// points of the star, clockwise from the top; point 8 is the putahi (centre).
export const W = 720, H = 1560;
export const BX = 360, BY = 935;
export const PR = 240;        // distance from the centre to a star point (where stones sit)
export const TIP = 322;       // tip of the carved star
export const NOTCH = 226;     // inner corner of the carved star
export const STONE_R = 44;
const TAU = Math.PI * 2;
export const angleOf = (i) => -Math.PI / 2 + (i * TAU) / 8;
export function pointPos(i, cx = BX, cy = BY, k = 1) {
  if (i === 8) return { x: cx, y: cy };
  const a = angleOf(i); return { x: cx + Math.cos(a) * PR * k, y: cy + Math.sin(a) * PR * k };
}
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
// Which board point a tap means (nearest point within reach), or -1.
export function pointNear(x, y) {
  let best = -1, bd = Infinity;
  for (let i = 0; i < 9; i++) { const p = pointPos(i), d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = i; } }
  return bd < 74 ? best : -1;
}
// Title screen buttons depend on whether an unfinished game is saved.
export function titleRows(hasSave) {
  const names = (hasSave ? ['resume'] : []).concat(['learn', 'ladder', 'two', 'daily']), out = {};
  names.forEach((n, i) => { out[n] = { x: 90, y: 736 + i * 76, w: 540, h: 66 }; });
  // About / How to play / Rules share one row, three even columns (same x/w as the sound/calm/big
  // row below) instead of each taking a full-width row of its own — Rules is the addition; About
  // keeps the exact y position it always had, How to play moves up into the freed row alongside it.
  const rowY = 736 + names.length * 76;
  out.about = { x: 90, y: rowY, w: 172, h: 66 };
  out.howto = { x: 274, y: rowY, w: 172, h: 66 };
  out.rules = { x: 458, y: rowY, w: 172, h: 66 };
  out.sound = { x: 90, y: 1290, w: 172, h: 60 }; out.calm = { x: 274, y: 1290, w: 172, h: 60 }; out.big = { x: 458, y: 1290, w: 172, h: 60 };
  out.marks = { x: 90, y: 1360, w: 540, h: 60 };
  return out;
}
export const BTN = {
  menu: { x: 60, y: 1462, w: 190, h: 72 }, undo: { x: 265, y: 1462, w: 190, h: 72 }, hint: { x: 470, y: 1462, w: 190, h: 72 },
  over1: { x: 90, y: 1280, w: 540, h: 70 }, over2: { x: 90, y: 1362, w: 540, h: 70 }, over3: { x: 90, y: 1444, w: 540, h: 70 },
  cont: { x: 270, y: 1462, w: 390, h: 72 },
};
export const LADDER_ROW = (i) => ({ x: 40, y: 330 + i * 86, w: 640, h: 76 });
export const LADDER_SIDE = { x: 90, y: 1390, w: 540, h: 60 };
export const BACK = { x: 140, y: 1462, w: 440, h: 72 };
// Text-size stepper for the About / How to play / Rules reference pages: a header row above the
// title, clear of the Back button in the footer. "A-"/"A+" on all three screens.
export const TEXT_STEPPER = { dec: { x: 40, y: 24, w: 120, h: 62 }, inc: { x: W - 160, y: 24, w: 120, h: 62 } };
// Index into this, never a raw float, so the stepper can cleanly disable at either end and a stale
// saved index (e.g. from a build with a shorter array) always clamps instead of producing NaN sizes.
export const TEXT_SCALES = [1, 1.15, 1.3];
