// Screen geometry in one place so game.js (hit-testing) and view.js (drawing) never disagree.
// Virtual resolution 720 x 1280, portrait. Nothing important within 40 px of the top or bottom edge,
// and the top-centre strip (y < 44) is left free for the preview badge.
export const W = 720;
export const H = 1280;
export const inRect = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// The play screen is laid out by ONE function, setPlayLayout(textIdx, watch), which fills the shared objects below in place.
// view.js draws from them and game.js hit-tests against them, so a button can never be drawn in one place and hit in another.
// At 100% it reproduces the original fixed layout exactly. As the text size grows the scoreboard turns into two stacked rows,
// the bottom bar and coach strip grow taller, and the board shrinks to make room (never below BOARD_MIN_R, see below).
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
// The board is never drawn smaller than this radius (virtual px; 100% is 282): the aim ring and the rings stay usable.
export const BOARD_MIN_R = 148;
const clampN = (v, a, b) => Math.max(a, Math.min(b, v));
export const BOARD_R0 = 282;
export const BOARD = { cx: 360, cy: 592, R: BOARD_R0 };
export let PX_PER_MM = BOARD.R / 170;
// How much of the board's surround (number ring) extends past R (the outer gold edge), in units of R.
const EXTENT = 1.225;

export const PANEL = [{ x: 14, y: 48, w: 344, h: 148 }, { x: 362, y: 48, w: 344, h: 148 }];
export const LEG_LINE = { y: 224 };
export const CHIPS = { y: 944, h: 70, cw: 150, gap: 14, x0: 124, totalX: 610 };
export const COACH = { x: 20, y: 1026, w: 680, h: 76 };
export const THINK_BTN = { x: 20, y: 1180, w: 330, h: 84 };
export const MENU_BTN = { x: 370, y: 1180, w: 330, h: 84 };
// Watch & Learn control bar.
export const WATCH = {
  dec: { x: 20, y: 1108, w: 120, h: 62 },
  inc: { x: 580, y: 1108, w: 120, h: 62 },
  label: { x: 150, y: 1108, w: 420, h: 62 },
  pause: { x: 20, y: 1180, w: 440, h: 84 },
  exit: { x: 476, y: 1180, w: 224, h: 84 },
};
export const AIM = { top: 200, bottom: 1166, maxY: 1010, offsetY: -150, minHold: 0.25 };
// Text-size multipliers and the panel's inner baselines, filled by setPlayLayout.
export const HUD = { key: -1, hs: 1, ns: 1, cs: 1, ps: 1, stacked: false, watchRow: true, pan: { nameBase: 34, scoreBase: 114, avgBase: 134 }, btnFont: 32, watchFont: 40 };

export function setPlayLayout(textIdx = 0, watch = false) {
  const idx = clampN(textIdx | 0, 0, TEXT_SCALES.length - 1);
  const key = idx * 2 + (watch ? 1 : 0);
  if (key === HUD.key) return false;
  HUD.key = key;
  const hs = TEXT_SCALES[idx];
  const ns = 1 + (hs - 1) * 0.45;       // the big remaining-score number grows more gently (it is already huge)
  const cs = Math.min(hs, 1.5);         // throw chips
  const ps = 1 + (hs - 1) * 0.5;        // the little score pops over the board
  Object.assign(HUD, { hs, ns, cs, ps, stacked: hs >= 2 });
  const fn = 25 * hs, fa = 20 * hs, fl = 22 * hs, fs = 92 * ns;

  // Scoreboard.
  let panels, pan;
  if (!HUD.stacked) {
    const nameBase = 8 + 1.05 * fn, scoreBase = 8 + 1.3 * fn + 0.8 * fs;
    const h = Math.round(scoreBase + 0.9 * fa + 16);
    pan = { nameBase, scoreBase, avgBase: h - 14 };
    panels = [{ x: 14, y: 48, w: 344, h }, { x: 362, y: 48, w: 344, h }];
  } else {
    const h = Math.round(Math.max(8 + 1.22 * fn + 1.1 * fa + 8, 0.95 * fs + 14));
    pan = { nameBase: 8 + 1.05 * fn, scoreBase: h / 2 + 0.36 * fs, avgBase: h - 12 };
    panels = [{ x: 14, y: 48, w: 692, h }, { x: 14, y: 48 + h + 8, w: 692, h }];
  }
  HUD.pan = pan;
  panels.forEach((p, i) => Object.assign(PANEL[i], p));
  const panelsBottom = panels[1].y + panels[1].h;
  LEG_LINE.y = Math.round(panelsBottom + 6 + fl * (1 - 0.08 * (hs - 1)));
  const topLimit = LEG_LINE.y + 0.22 * fl + 5;
  AIM.top = panelsBottom + 4;

  // Bottom, built upwards from the bottom edge: buttons, (watch bar), coach strip, throw chips.
  const fBtn = 32 * hs, fW = 40 * Math.min(hs, 1.5);
  HUD.btnFont = fBtn; HUD.watchFont = fW;
  const hb = Math.round(Math.max(84, 1.15 * fBtn + 34));
  const btnY = 1264 - hb;
  Object.assign(THINK_BTN, { x: 20, y: btnY, w: 330, h: hb });
  Object.assign(MENU_BTN, { x: 370, y: btnY, w: 330, h: hb });
  const pw = hs >= 2 ? 396 : 440;
  Object.assign(WATCH.pause, { x: 20, y: btnY, w: pw, h: hb });
  Object.assign(WATCH.exit, { x: 20 + pw + 16, y: btnY, w: 680 - pw - 16, h: hb });
  const h1 = Math.round(Math.max(62, 0.95 * fW + 22)), bw = Math.round(120 * Math.min(hs, 1.5));
  const y1 = btnY - 10 - h1;
  Object.assign(WATCH.dec, { x: 20, y: y1, w: bw, h: h1 });
  Object.assign(WATCH.inc, { x: 700 - bw, y: y1, w: bw, h: h1 });
  Object.assign(WATCH.label, { x: 20 + bw + 10, y: y1, w: 680 - 2 * bw - 20, h: h1 });
  // From 250% in Watch & Learn the thinking-time row would not leave room for the board: it is hidden (the same setting is in Settings).
  HUD.watchRow = !(watch && hs >= 2.5);
  if (!HUD.watchRow) for (const k of ['dec', 'inc', 'label']) Object.assign(WATCH[k], { x: -1000, y: -1000, w: 1, h: 1 });
  const barTop = watch ? (HUD.watchRow ? y1 : btnY) : btnY;
  const band = watch ? 6 : Math.max(12, 78 - (hs - 1) * 66);
  const coachH = Math.round(Math.max(76, 1.3 * 22 * hs + 26));
  const coachY = barTop - band - coachH;
  Object.assign(COACH, { x: 20, y: coachY, w: 680, h: coachH });
  AIM.bottom = btnY - 14;

  const fCL = 36 * cs, fCS = 20 * cs;
  const chipH = Math.round(1.056 * fCL + 1.16 * fCS + 9);
  const gap = 14, tw = 70 * cs;
  const cw = Math.round(Math.min(150 * cs, (W - 28 - 2 * gap - 14 - tw) / 3));
  const rowW = 3 * cw + 2 * gap;
  const x0 = Math.round(Math.min((W - rowW) / 2, W - 28 - tw - rowW));
  Object.assign(CHIPS, { y: coachY - 12 - chipH, h: chipH, cw, gap, x0, totalX: x0 + rowW + 14 });

  // The board takes what is left between the leg line and the chips.
  const botLimit = CHIPS.y - 6;
  const R = Math.max(BOARD_MIN_R, Math.min(BOARD_R0, (botLimit - topLimit) / (2 * EXTENT)));
  const cy = clampN(592, topLimit + EXTENT * R, Math.max(topLimit + EXTENT * R, botLimit - EXTENT * R));
  Object.assign(BOARD, { cx: 360, cy: Math.round(cy), R: Math.round(R * 100) / 100 });
  PX_PER_MM = BOARD.R / 170;
  AIM.maxY = Math.min(1010, Math.round(BOARD.cy + BOARD.R + 136));
  return true;
}

// Menus, pages, settings.
export const SETUP_PINS = { start: { x: 30, y: 1156, w: 440, h: 96 }, back: { x: 486, y: 1156, w: 204, h: 96 } };
export const REF_BACK = { x: 20, y: 1164, w: 332, h: 100 };
export const REF_NEXT = { x: 368, y: 1164, w: 332, h: 100 };
export const TEXT_DEC = { x: 20, y: 18, w: 120, h: 60 };
export const TEXT_INC = { x: W - 140, y: 18, w: 120, h: 60 };
export const THINK_STEPS = [2, 5, 8, 10];
export const REVEAL_SECS = 2;
