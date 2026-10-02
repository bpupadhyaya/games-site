// Screen geometry: one place for every rectangle so game.js (hit-testing) and view.js (drawing) never disagree.
// Virtual resolution 720 x 1280 portrait. Nothing important is painted in the outer 24 px (tall phones letterbox).
export const W = 720, H = 1280;
export const BC = { x: 360, y: 616 };   // board centre on screen

export const inRect = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// ---- play screen -------------------------------------------------------------------------------
export const CARD = [{ x: 20, y: 24, w: 300, h: 134 }, { x: 400, y: 24, w: 300, h: 134 }];
export const ROUND_PILL = { x: 326, y: 78, w: 68, h: 62 };
export const TOAST_Y = 196;
export const PLAY_ZONE = { x: 0, y: 236, w: W, h: 862 };   // where a pull may start
export const SLIDER = { x: 20, y: 1104, w: 680, h: 90 };
export const TRACK = { x0: 84, x1: 636, y: 1160 };
export const HINT_BTN = { x: 20, y: 1206, w: 210, h: 64 };
export const MENU_BTN = { x: 490, y: 1206, w: 210, h: 64 };
export const DEMO_BAR = {
  dec: { x: 20, y: 1108, w: 150, h: 84 },
  pause: { x: 184, y: 1108, w: 352, h: 84 },
  inc: { x: 550, y: 1108, w: 150, h: 84 },
  exit: { x: 20, y: 1206, w: 680, h: 64 },
};
export const PULL = { min: 26, max: 240 };

// ---- the play screen at any text size -----------------------------------------------------------
// ONE function owns every rectangle of the play screen (HUD, toast, board frame, pull zone, slider, buttons, banner), so
// drawing (view.js) and hit-testing (game.js) can never disagree. `z` is the text zoom (1 .. 3). At 100% the original
// layout above is returned unchanged. From 150% the two score cards become full-width rows, the round and disc count move
// to a line of their own, the control bar gets taller (watch mode: stacked rows) and the board shrinks to what is left
// (never above its 100% size). Font sizes are carried in `fs`; text shrinks to fit, then falls back to a short form.
const cache = new Map();
export function playLayout(z = 1, watch = false) {
  const key = `${z}|${watch ? 1 : 0}`;
  let L = cache.get(key);
  if (!L) { L = buildLayout(z, watch); cache.set(key, L); }
  return L;
}
const BOARD_EXTENT = 700;   // R_BOARD + 20 rim, both sides (see art.js)
function buildLayout(z, watch) {
  if (z <= 1.01) {
    return {
      z: 1, stacked: false, cards: CARD, pill: ROUND_PILL, info: null, toastY: TOAST_Y, board: { cx: BC.x, cy: BC.y, s: 1 },
      zone: PLAY_ZONE, slider: SLIDER, track: TRACK, knob: 1.2, hint: HINT_BTN, menu: MENU_BTN, demo: DEMO_BAR, bar: null,
      banner: { x: 40, y: 956, w: 640, h: 142 }, bannerReplacesBar: false, chip: 1, pop: 1,
      fs: { name: 26, sub: 19, score: 54, round: 16, roundNum: 28, toast: 26, slider: 18, btn: 28, demoBtn: 24, disc: 22 },
    };
  }
  const f = (b) => Math.round(b * z), M = 20, GW = W - 2 * M;
  const fs = { name: f(22), sub: f(14), score: f(34), info: f(17), toast: f(15), slider: f(14), btn: f(22), demoBtn: f(20), bTitle: f(17), bScore: f(30), bName: f(14), bTap: f(14) };
  // top: two score rows, then one slot shared by the round/disc line and the toast
  const showSub = z <= 2.01;
  const rowH = Math.round(Math.max(fs.score, fs.name * 1.15 + (showSub ? fs.sub * 1.15 : 0)) + 16);
  let y = 24;
  const cards = [{ x: M, y, w: GW, h: rowH }, { x: M, y: y + rowH + 8, w: GW, h: rowH }];
  y += rowH * 2 + 8 + 8;
  const slotH = Math.max(Math.round(fs.info * 1.25) + 8, Math.round(fs.toast * 2 * 1.2) + 16);
  const info = { x: M, y, w: GW, h: slotH };
  const topEnd = y + slotH;
  // bottom block: slider + Hint/Menu (play) or the Watch & Learn buttons (watch)
  const GAP = 8;
  let slider = null, track = null, hint = null, menu = null, demo = null, barH, knob = 1.2 * Math.min(z, 1.5);
  const banner = { h: Math.round(fs.bTitle * 1.2 + fs.bScore * 1.1 + fs.bTap * 1.2 + 44) };
  const btnH = Math.round(fs.btn * 1.1 + 26), dBtnH = Math.round(fs.demoBtn * 1.1 + 26);
  if (watch) {
    barH = z <= 2.01 ? dBtnH * 2 + GAP : dBtnH * 3 + GAP * 2;
  } else {
    const labelH = Math.round(fs.slider * 1.25) + 8, trackH = Math.round(19 * knob * 2) + 10;
    barH = labelH + trackH + GAP + btnH;
    slider = { h: labelH + trackH, labelH };
  }
  const blockH = Math.max(barH, banner.h);
  const top = H - 14 - blockH;
  if (watch) {
    if (z <= 2.01) {
      const wide = Math.round((GW - 2 * GAP) * 0.27), mid = GW - 2 * wide - 2 * GAP;
      demo = {
        dec: { x: M, y: top, w: wide, h: dBtnH }, pause: { x: M + wide + GAP, y: top, w: mid, h: dBtnH }, inc: { x: M + wide + GAP + mid + GAP, y: top, w: wide, h: dBtnH },
        exit: { x: M, y: top + dBtnH + GAP, w: GW, h: dBtnH },
      };
    } else {
      const half = (GW - GAP) / 2;
      demo = {
        pause: { x: M, y: top, w: GW, h: dBtnH }, dec: { x: M, y: top + dBtnH + GAP, w: half, h: dBtnH }, inc: { x: M + half + GAP, y: top + dBtnH + GAP, w: half, h: dBtnH },
        exit: { x: M, y: top + 2 * (dBtnH + GAP), w: GW, h: dBtnH },
      };
    }
  } else {
    slider = { x: M, y: top, w: GW, h: slider.h, labelH: slider.labelH };
    track = { x0: 84, x1: 636, y: top + slider.labelH + Math.round((slider.h - slider.labelH) / 2) };
    const half = (GW - GAP) / 2, by = top + slider.h + GAP;
    hint = { x: M, y: by, w: half, h: btnH }; menu = { x: M + half + GAP, y: by, w: half, h: btnH };
  }
  banner.x = M; banner.y = top; banner.w = GW; banner.h = blockH;
  // the board takes what is left between the two blocks
  const y1 = topEnd + 6, y2 = top - 6;
  const s = Math.max(0.3, Math.min(1, (y2 - y1) / BOARD_EXTENT, (W - 16) / BOARD_EXTENT));
  return {
    z, stacked: true, cards, pill: null, info, toastY: info.y, board: { cx: W / 2, cy: (y1 + y2) / 2, s },
    zone: { x: 0, y: topEnd, w: W, h: top - topEnd }, slider, track, knob, hint, menu, demo, bar: { y: top, h: blockH },
    banner, bannerReplacesBar: true, chip: Math.min(z, 1.5), pop: Math.min(z, 2), showSub, fs,
  };
}

// ---- reference pages (About / How to play / Rules) and settings --------------------------------
export const REF_BACK = { x: 20, y: 1164, w: 332, h: 100 };
export const REF_NEXT = { x: 368, y: 1164, w: 332, h: 100 };
export const TEXT_DEC = { x: 20, y: 18, w: 120, h: 60 };
export const TEXT_INC = { x: W - 140, y: 18, w: 120, h: 60 };
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const THINK_STEPS = [2, 5, 8, 10];

export const SETUP_PINS = {
  start: { x: 30, y: 1156, w: 440, h: 96 },
  back: { x: 486, y: 1156, w: 204, h: 96 },
};
