// Geometry of the virtual 720 x 1560 canvas. South (player 0, the human) owns the lower two rows, north the upper two.
// Each player's FRONT row is the one nearest the middle. Nothing important is painted in the top/bottom 100 px (phone notches).
import { colOf, rowIsFront } from './rules.js';

export const W = 720, H = 1560;
export const PIT_R = 34, PITCH = 78, CX = 360;
export const ROW_Y = { nBack: 548, nFront: 686, sFront: 824, sBack: 962 };
export const FRAME = { x: 8, y: 330, w: 704, h: 850 };
export const TRAY = { n: { x: 60, y: 372, w: 600, h: 76 }, s: { x: 60, y: 1062, w: 600, h: 76 } };

// screen position of pit r (ring index 0..15) of player p. North is turned half a turn, so its left is the screen's right.
export function pitPos(p, r) {
  const c = colOf(r), front = rowIsFront(r);
  if (p === 0) return { x: CX + (c - 3.5) * PITCH, y: front ? ROW_Y.sFront : ROW_Y.sBack };
  return { x: CX + (3.5 - c) * PITCH, y: front ? ROW_Y.nFront : ROW_Y.nBack };
}
export const trayPos = (p) => (p === 0 ? { x: 360, y: TRAY.s.y + TRAY.s.h / 2 } : { x: 360, y: TRAY.n.y + TRAY.n.h / 2 });
// nearest pit of player p to a tap (generous), or -1
export function pitNear(p, x, y) {
  let best = -1, bd = 1e9;
  for (let r = 0; r < 16; r++) {
    const q = pitPos(p, r), dx = Math.abs(x - q.x), dy = Math.abs(y - q.y);
    if (dx > PITCH / 2 + 2 || dy > 66) continue;
    const d = dx * dx + dy * dy;
    if (d < bd) { bd = d; best = r; }
  }
  return best;
}
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

export const BTN = {
  menu: { x: 40, y: 1346, w: 190, h: 84 }, undo: { x: 265, y: 1346, w: 190, h: 84 }, hint: { x: 490, y: 1346, w: 190, h: 84 },
  next: { x: 290, y: 1346, w: 390, h: 84 },
  // choice prompt (kichwa, safari, direction): two wide answers in the panel above the buttons
  pick1: { x: 40, y: 1262, w: 300, h: 68 }, pick2: { x: 380, y: 1262, w: 300, h: 68 }, pickCancel: { x: 570, y: 1202, w: 110, h: 44 },
  again: { x: 130, y: 1010, w: 460, h: 96 }, back: { x: 130, y: 1126, w: 460, h: 96 },
  // paginated reference pages (About, How to Play, Rules): Back/Next footer and the text-size stepper up top
  pgBack: { x: 60, y: 1322, w: 250, h: 80 }, pgNext: { x: 410, y: 1322, w: 250, h: 80 },
  textDec: { x: 50, y: 176, w: 96, h: 58 }, textInc: { x: 574, y: 176, w: 96, h: 58 },
  apExit: { x: 40, y: 1346, w: 148, h: 84 }, apPause: { x: 204, y: 1346, w: 148, h: 84 }, apDec: { x: 368, y: 1346, w: 148, h: 84 }, apInc: { x: 532, y: 1346, w: 148, h: 84 },
  step: { x: 40, y: 1346, w: 190, h: 84 }, // lesson: Skip
};
export const AP_THINK_STEPS = [2, 5, 8, 10];
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const REF = { x: 36, y: 120, w: 648, h: 1300, bottom: 1270 };   // reference page panel

// The menu and settings grow with the text size: bigger buttons (so bigger labels fit) and, from 150%, no mini board so the
// taller column of buttons has the room.
export const bigMenu = (scale) => scale >= 1.5;
export function titleRows(hasSave, scale = 1) {
  const k = 1 + (scale - 1) * 0.35, big = bigMenu(scale), h = Math.round(84 * k), h2 = big ? Math.round(78 * k) : 78;
  const row = (y) => ({ x: 70, y, w: 580, h });
  let y = big ? 316 : 760;
  const R = {}, step = big ? h + 14 : hasSave ? 94 : 102;
  if (hasSave) { R.resume = row(y); y += step; }
  R.learn = row(y); y += step;
  R.play = row(y); y += step;
  R.two = row(y); y += step;
  R.autoplay = row(y); y += step;
  const q = (580 - 14 * 3) / 4;
  R.howto = { x: 70, y, w: q, h: h2 }; R.rules = { x: 70 + (q + 14), y, w: q, h: h2 };
  R.about = { x: 70 + (q + 14) * 2, y, w: q, h: h2 }; R.settings = { x: 70 + (q + 14) * 3, y, w: q, h: h2 };
  return R;
}
export function setRows(scale = 1) {
  const k = 1 + (scale - 1) * 0.3, h = Math.round(84 * k), gap = scale >= 2 ? 8 : 12, y0 = scale >= 2 ? 250 : 270, R = {};
  ['level', 'sound', 'calm', 'text', 'seeds', 'wood', 'think'].forEach((n, i) => { R[n] = { x: 70, y: y0 + i * (h + gap), w: 580, h }; });
  R.back = { x: 130, y: scale >= 2 ? 1264 : 1236, w: 460, h: scale >= 2 ? 78 : 90 };
  return R;
}
