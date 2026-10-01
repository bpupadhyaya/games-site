// Geometry. Virtual canvas 720 x 1560. The board is drawn flat (seen from above) and turned so that it is tall: two columns of
// twelve points with the channel down the middle. Point 24 is bottom right, 13 top right, 12 top left, 1 bottom left.
import { BAR, OFF } from './rules.js';
export const W = 720, H = 1560;
export const FRAME = { x: 8, y: 262, w: 704, h: 1038 };          // outer edge of the wooden frame
export const IN = { x0: 34, x1: 686, y0: 288, y1: 1274 };         // the playing field
export const CH = { x0: 318, x1: 402, cx: 360 };                    // the channel (the bar in Portes)
export const SLOT = (IN.y1 - IN.y0) / 12;                           // height of one point
export const PLEN = 254;                                            // length of a point
export const D = 72, R = D / 2;                                     // checker diameter
export const MID = (IN.y0 + IN.y1) / 2;
export const TRAY = { opp: { x: 34, y: 214, w: 652, h: 44 }, me: { x: 34, y: 1306, w: 652, h: 44 } };
export const DICE = { x: 60, y: 1358, w: 600, h: 96, cy: 1406, x0: 158, x1: 604, d: 66 };   // dice tray and the tumbling area
export const BTN = {
  menu: { x: 34, y: 1474, w: 200, h: 64 }, undo: { x: 260, y: 1474, w: 200, h: 64 }, hint: { x: 486, y: 1474, w: 200, h: 64 },
  pause: { x: 20, y: 22, w: 84, h: 84 },
  // Auto Play rail: four small buttons in the same row
  aMenu: { x: 20, y: 1474, w: 150, h: 64 }, aPause: { x: 186, y: 1474, w: 170, h: 64 }, aLess: { x: 372, y: 1474, w: 160, h: 64 }, aMore: { x: 548, y: 1474, w: 152, h: 64 },
};
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// where point idx (0..23) sits: which column, its vertical centre, where its checkers start and which way they stack
export function pointGeom(idx) {
  const pt = idx + 1, left = pt <= 12, slot = left ? 12 - pt : pt - 13;
  return { left, slot, y: IN.y0 + (slot + 0.5) * SLOT, edge: left ? IN.x0 : IN.x1, dir: left ? 1 : -1 };
}
// centre of the k-th checker (0 = base) of n on point idx. `pinned`: the base checker is pinned and the rest sit half over it.
export function stackPos(idx, k, n, pinned = false) {
  const g = pointGeom(idx), room = PLEN - 6;
  const step = n <= 3 ? D + 1 : (room - D) / (n - 1);
  let off = k * step;
  if (pinned && k >= 1) {
    const s2 = n <= 4 ? D * 0.56 : ((room - D) / (n - 1)) * 0.75;
    off = s2 + (k - 1) * (n <= 4 ? D * 0.9 : (room - D - s2) / Math.max(1, n - 2));
  }
  return { x: g.edge + g.dir * (R + 3 + off), y: g.y };
}
export function barPos(side, k, n) {
  const step = n <= 5 ? D + 2 : (MID - IN.y0 - 60 - D) / (n - 1), y0 = 6 + R;
  return { x: CH.cx, y: MID + (side === 0 ? 1 : -1) * (y0 + k * step) };
}
export const offPos = (side, k) => ({ x: 64 + k * 40, y: side === 0 ? TRAY.me.y + TRAY.me.h / 2 : TRAY.opp.y + TRAY.opp.h / 2 });
// which target a screen tap means: a point 0..23, BAR, OFF, or -1
export function targetAt(x, y) {
  if (inRect({ x: TRAY.me.x, y: TRAY.me.y - 6, w: TRAY.me.w, h: TRAY.me.h + 14 }, x, y)) return OFF;
  if (y < IN.y0 - 8 || y > IN.y1 + 8) return -1;
  if (x > CH.x0 - 4 && x < CH.x1 + 4) return BAR;
  const slot = Math.floor((y - IN.y0) / SLOT); if (slot < 0 || slot > 11) return -1;
  if (x < CH.cx) return 12 - slot - 1;
  return 13 + slot - 1;
}

// ---- screens ------------------------------------------------------------------------------------------------------------------
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const THINK_STEPS = [2, 5, 8, 10];
// Title buttons depend on whether an unfinished game is saved.
export function titleRows(hasSave) {
  const out = {}; let y = 660;
  const row = (n, h = 84, gap = 16) => { out[n] = { x: 110, y, w: 500, h }; y += h + gap; };
  if (hasSave) row('resume');
  row('play', 96); row('auto', 84);
  const third = (500 - 24) / 3;
  ['howto', 'rules', 'about'].forEach((n, i) => { out[n] = { x: 110 + i * (third + 12), y, w: third, h: 70 }; });
  y += 70 + 16; row('settings', 70);
  return out;
}
// the game-choice cards on the setup screen: 2 x 2
export const SETUP = {
  modes: [0, 1, 2, 3].map((i) => ({ x: 52 + (i % 2) * 312, y: 330 + Math.floor(i / 2) * 156, w: 304, h: 144 })),
  match: [{ x: 52, y: 720, w: 304, h: 70 }, { x: 364, y: 720, w: 304, h: 70 }],
  opp: [{ x: 52, y: 850, w: 304, h: 70 }, { x: 364, y: 850, w: 304, h: 70 }],
  levels: [0, 1, 2, 3].map((i) => ({ x: 52 + i * 156, y: 980, w: 148, h: 76 })),
  start: { x: 110, y: 1180, w: 500, h: 96 },
  back: { x: 110, y: 1296, w: 500, h: 76 },
};
export const PANEL = { x: 36, y: 250, w: 648, h: 1150 };
export const PBACK = { x: 140, y: 1420, w: 440, h: 76 };
export const DOC_BACK = { x: 20, y: 1420, w: 330, h: 76 };
export const DOC_NEXT = { x: 370, y: 1420, w: 330, h: 76 };
export const TEXT_BTN = {
  dec: { x: PANEL.x + 22, y: PANEL.y + 20, w: 100, h: 56 },
  inc: { x: PANEL.x + PANEL.w - 22 - 100, y: PANEL.y + 20, w: 100, h: 56 },
};
export const SET_ROWS = ['sound', 'calm', 'set', 'auto'].reduce((o, n, i) => { o[n] = { x: 90, y: 330 + i * 116, w: 540, h: 92 }; return o; }, {});
export const SET_TEXT = { dec: { x: 90, y: 330 + 4 * 116, w: 130, h: 92 }, inc: { x: 500, y: 330 + 4 * 116, w: 130, h: 92 }, mid: { x: 230, y: 330 + 4 * 116, w: 260, h: 92 } };
export const PAUSE = { resume: { x: 110, y: 640, w: 500, h: 96 }, restart: { x: 110, y: 760, w: 500, h: 80 }, menu: { x: 110, y: 864, w: 500, h: 80 } };
export const OVER = { again: { x: 110, y: 960, w: 500, h: 84 }, menu: { x: 110, y: 1060, w: 240, h: 72 }, share: { x: 370, y: 1060, w: 240, h: 72 } };
export const DONE = { x: 260, y: 1474, w: 426, h: 64 };
export { BAR, OFF };
