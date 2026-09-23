// Geometry. The board is a plane seen in perspective (a true projective map, so straight lines stay straight).
// Board coordinates: u in -3..3 (left to right), v in 0..6 (0 = the far side). Everything on the board scales
// with s (perspective) and UNIT.
export const W = 720, H = 1560;
const CX = 360, D = 96, K = 0.03, Y_NEAR = 1262, HGT = 3200, Y_H = Y_NEAR - HGT;
export const UNIT = D / 106;
export function project(u, v) { const z = 1 + K * (6 - v); return { x: CX + (u * D) / z, y: Y_H + HGT / z, s: 1 / z }; }
// point i -> board coordinates
export const PT = [];
for (let r = 0; r < 3; r++) { const s = 3 - r; [[-s, -s], [0, -s], [s, -s], [s, 0], [s, s], [0, s], [-s, s], [-s, 0]].forEach(([u, v]) => PT.push([u, v + 3])); }
export const pointAt = (i) => project(PT[i][0], PT[i][1]);
export const PIECE_R = 39 * UNIT;
// where a hand rack holds its men (top rack = computer / second player, bottom rack = you)
export const RACK = { top: { y: 650 }, bottom: { y: 1384 } };
export const rackPos = (which, k) => ({ x: 360 + (k - 4) * 56, y: RACK[which].y, s: 0.9 });
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

const mainRow = (y, i) => ({ x: 90, y: y + i * 72, w: 540, h: 64 });
// Title buttons. names: resume?, learn, play, two, daily; then small: level side / sound calm / look big / about how rules auto
export function titleRows(hasSave) {
  const names = (hasSave ? ['resume'] : []).concat(['learn', 'play', 'two', 'daily']), out = {}, y0 = 880 - (hasSave ? 0 : 0);
  names.forEach((n, i) => { out[n] = mainRow(y0, i); });
  const y = y0 + names.length * 72 + 8, sm = (i, j) => ({ x: 90 + j * 278, y: y + i * 66, w: 262, h: 58 });
  out.level = sm(0, 0); out.side = sm(0, 1); out.sound = sm(1, 0); out.calm = sm(1, 1);
  // Text size used to live here as a binary "Large text" toggle. It is now a 3-step stepper drawn
  // directly on the About/How/Rules pages themselves (TEXT_SCALES/TEXT_STEP below), right where a
  // player is actually reading, so this row's other button takes the whole row.
  out.look = { x: 90, y: y + 2 * 66, w: 540, h: 58 };
  // Row 3 was About/How/Rules (3 columns); Auto Play is the addition (4 equal columns now, same
  // total span x=90..630) - every other row above keeps its exact position/size, unchanged.
  const bw3 = 540, gap3 = 14, n4 = 4, colw = (bw3 - gap3 * (n4 - 1)) / n4, sm3 = (j) => ({ x: 90 + j * (colw + gap3), y: y + 3 * 66, w: colw, h: 58 });
  out.about = sm3(0); out.how = sm3(1); out.rules = sm3(2); out.auto = sm3(3);
  return out;
}
// Auto Play (Watch & Learn): think-time steps in seconds, hard-capped at 10s. An index into this
// array (same pattern as TEXT_SCALES), never a raw float.
export const AUTO_THINK_STEPS = [2, 5, 8, 10];
export const AUTO_REVEAL_SECONDS = 2;
export const LOOK = {
  woods: [0, 1, 2].map((i) => ({ x: 90 + i * 184, y: 760, w: 172, h: 76 })),
  sets: [0, 1].map((i) => ({ x: 90 + i * 278, y: 940, w: 262, h: 76 })),
  marks: { x: 90, y: 1250, w: 540, h: 66 },
  back: { x: 140, y: 1440, w: 440, h: 84 },
};
export const BTN = {
  menu: { x: 60, y: 1462, w: 190, h: 72 }, undo: { x: 265, y: 1462, w: 190, h: 72 }, hint: { x: 470, y: 1462, w: 190, h: 72 },
  again: { x: 140, y: 930, w: 440, h: 96 }, back: { x: 140, y: 1046, w: 440, h: 84 }, share: { x: 140, y: 1150, w: 440, h: 84 },
  next: { x: 275, y: 1462, w: 385, h: 72 }, show: { x: 470, y: 1462, w: 190, h: 72 },
  // About, How to play and Rules are all now paginated reference screens (see TEXT_SCALES below -
  // bigger text meant more of them needed real Back/Next pagination, not just a single Back), and
  // share this one Back | Next pair.
  refBack: { x: 140, y: 1400, w: 212, h: 84 }, refNext: { x: 368, y: 1400, w: 212, h: 84 },
};
// Text-size steps for the About/How/Rules reference pages. An *index* array, never a raw float, so
// "min"/"max" are exact and the stepper can cleanly disable at either end. Raised from a 1.3x
// ceiling to 3.0x (300%) on 2026-09-23 at the owner's request (an intermediate 2.0x pass was
// superseded before landing); kept evenly spaced.
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
// The stepper's home: two small pills in the top corners of the panel (matching the same stepper
// placement used across every other reference page in the catalogue), well clear of the centred
// header title below. Back/Next on these pages live at the BOTTOM (see BTN.refBack/refNext above),
// so the top is naturally clear of them either way.
export const TEXT_STEP = {
  dec: { x: 50, y: 148, w: 120, h: 56 },
  inc: { x: 550, y: 148, w: 120, h: 56 },
};
// Which board point a tap means: the nearest point (generous radius, the men are big).
export function pointNear(x, y, max = 52) {
  let best = -1, bd = Infinity;
  for (let i = 0; i < 24; i++) { const p = pointAt(i), d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = i; } }
  return bd < max ? best : -1;
}
// The keyboard cursor moves to the nearest point in the pressed direction.
export function neighbourToward(i, dx, dy) {
  const a = pointAt(i); let best = -1, bs = Infinity;
  for (let j = 0; j < 24; j++) {
    if (j === i) continue;
    const b = pointAt(j), vx = b.x - a.x, vy = b.y - a.y, along = vx * dx + vy * dy, across = Math.abs(vx * dy - vy * dx);
    if (along <= 8) continue;
    const s = along + across * 2.2; if (s < bs) { bs = s; best = j; }
  }
  return best < 0 ? i : best;
}
// Title scene shows the board smaller: a transform about the board centre.
export const TITLE_BOARD = { cx: 360, cy: 973, k: 0.58, tx: 360, ty: 640 };
