// Screen geometry in one place so game.js (hit-testing) and view.js (drawing) never disagree.
//
// FLUID (kit 1.7.x): the virtual canvas follows the real screen. The SHORT side is always 720 units, the long side grows with the
// aspect ratio. `setView(w, h)` is called every frame with the live size and re-lays everything out when it changes. W and H are
// live bindings (always the current virtual size). Three shapes:
//   tall     portrait, h >= 1280 (every phone): the approved phone layout; at 720 x 1280 it is exactly the original one.
//   compact  portrait, shorter than that (tablets): same stack with tighter bars, the board takes what is left.
//   wide     landscape: the dartboard on the left (as tall as the screen allows), scoreboard + throws + buttons in a column beside it.
// Nothing important within the safe insets; the top-left corner stays clear of the host's floating back button when host.back > 0.
export let W = 720;
export let H = 1280;
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
const clampN = (v, a, b) => Math.max(a, Math.min(b, v));

// Safe areas and the floating back button, in virtual units. main.js keeps this current (browsers: zeros). px = css pixels per unit.
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };
export const VIEW = { w: 720, h: 1280, land: false, mode: 'tall', key: '' };
export const BACKBOX = { x: 0, y: 0, w: 0, h: 0 };
// Text never below about 11 css px: when a unit is smaller than 0.55 css px, every text size is raised by this factor.
export const fontFloor = () => clampN(11 / (Math.max(0.2, host.px) * 18.5), 1, 1.45);

export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const BOARD_MIN_R = 148;
export const BOARD_R0 = 282;
export const BOARD = { cx: 360, cy: 592, R: BOARD_R0 };
export let PX_PER_MM = BOARD.R / 170;
// How much of the board's surround (number ring) extends past R (the outer gold edge), in units of R.
export const EXTENT = 1.225;

export const PANEL = [{ x: 14, y: 48, w: 344, h: 148 }, { x: 362, y: 48, w: 344, h: 148 }];
export const LEG_LINE = { x: 360, y: 224 };
export const CHIPS = { y: 944, h: 70, cw: 150, gap: 14, x0: 124, totalX: 610, totalW: 90 };
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
// Where a finger may start and drag an aim (x0..x1, top..bottom); the reticle stays inside [x0+24, x1-24] and [top+10, maxY].
export const AIM = { top: 200, bottom: 1166, maxY: 1010, offsetY: -150, minHold: 0.25, x0: 0, x1: 720, originX: 360, originY: 1150 };
// The box that banners, pops and the PAUSED label centre in (the board's zone on the screen).
export const ZONE = { cx: 360, x0: 0, x1: 720, top: 232, bot: 930, w: 692 };
// Text-size multipliers and the panel's inner baselines, filled by setPlayLayout.
export const HUD = { key: '', hs: 1, ns: 1, cs: 1, ps: 1, stacked: false, watchRow: true, wide: false, pan: { nameBase: 34, scoreBase: 114, avgBase: 134 }, btnFont: 32, watchFont: 40, hsReq: 1 };

// Menus, pages, settings (filled by setView).
export const SETUP_PINS = { start: { x: 30, y: 1156, w: 440, h: 96 }, back: { x: 486, y: 1156, w: 204, h: 96 } };
export const PAGE = { x: 34, y: 100, w: 652, h: 1030, head: 120, foot: 70, wide: false };
export const REF_BACK = { x: 20, y: 1164, w: 332, h: 100 };
export const REF_NEXT = { x: 368, y: 1164, w: 332, h: 100 };
export const TEXT_DEC = { x: 48, y: 110, w: 104, h: 60 };
export const TEXT_INC = { x: 568, y: 110, w: 104, h: 60 };
export const THINK_STEPS = [2, 5, 8, 10];
export const REVEAL_SECS = 2;

// Two columns for landscape menus: x and width of the left and the right column (the left one starts right of the back button).
export function wideCols() {
  const l = Math.max(24, host.l + 10), r = Math.max(24, host.r + 10), usable = W - l - r, mid = l + usable / 2;
  const backR = BACKBOX.w ? BACKBOX.x + BACKBOX.w + 10 : 0;
  const lx = Math.round(Math.max(l, backR, mid - 14 - 600)), lw = Math.round(mid - 14 - lx);
  const rx = Math.round(mid + 14), rw = Math.round(Math.min(600, W - r - rx));
  return { lx, lw, rx, rw, l, r, cw: rw };
}

export function setView(w, h) {
  w = Math.round(w) || 720; h = Math.round(h) || 1280;
  const key = `${w}x${h}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}|${host.px.toFixed(2)}`;
  if (key === VIEW.key) return false;
  W = w; H = h;
  Object.assign(VIEW, { w, h, key, land: w >= h, mode: w >= h ? 'wide' : h >= 1280 ? 'tall' : 'compact' });
  const bs = host.back ? Math.max(host.back, 56) + 8 : 0;
  Object.assign(BACKBOX, bs ? { x: host.l, y: host.t, w: bs, h: bs } : { x: 0, y: 0, w: 0, h: 0 });
  HUD.key = '';
  pageLayout();
  setupPins();
  return true;
}

// ---- reference pages (Rules, How to Play, About) -----------------------------------------------------
function pageLayout() {
  const lift = Math.max(0, host.b - 16);
  if (VIEW.mode !== 'wide') {
    const x = Math.max(34, host.l + 10), w = W - x - Math.max(34, host.r + 10);
    const navH = 100, navY = H - 16 - lift - navH;
    const y = Math.max(100, host.back ? BACKBOX.y + BACKBOX.h + 8 : host.t + 8);
    Object.assign(PAGE, { x, y, w, h: navY - 34 - y, head: 124, foot: 70, wide: false });
    const bw = (w - 16) / 2;
    Object.assign(REF_BACK, { x, y: navY, w: bw, h: navH }); Object.assign(REF_NEXT, { x: x + bw + 16, y: navY, w: bw, h: navH });
  } else {
    const x = Math.max(34, host.l + 10, BACKBOX.w ? BACKBOX.x + BACKBOX.w + 10 : 0), w = Math.min(1040, W - 2 * x), px = (W - w) / 2, y = Math.max(14, host.t + 6);
    const h = H - y - Math.max(14, host.b + 6);
    Object.assign(PAGE, { x: px, y, w, h, head: 112, foot: 100, wide: true });
    const bh = 76, by = y + h - bh - 14, bw = Math.min(300, (w - 60) * 0.3);
    Object.assign(REF_BACK, { x: px + 20, y: by, w: bw, h: bh }); Object.assign(REF_NEXT, { x: px + w - 20 - bw, y: by, w: bw, h: bh });
  }
  Object.assign(TEXT_DEC, { x: PAGE.x + 14, y: PAGE.y + 12, w: 104, h: 60 });
  Object.assign(TEXT_INC, { x: PAGE.x + PAGE.w - 118, y: PAGE.y + 12, w: 104, h: 60 });
}

function setupPins() {
  const lift = Math.max(0, host.b - 16);
  if (VIEW.mode !== 'wide') {
    const x0 = Math.max(30, host.l + 10), x1 = W - Math.max(30, host.r + 10), y = H - 124 - lift, gap = 16, bw = 204;
    Object.assign(SETUP_PINS.start, { x: x0, y, w: x1 - x0 - gap - bw, h: 96 });
    Object.assign(SETUP_PINS.back, { x: x1 - bw, y, w: bw, h: 96 });
  } else {
    const c = wideCols(), x0 = c.rx, x1 = c.rx + c.rw, y = H - 20 - lift - 96, gap = 14, bw = Math.round(c.rw * 0.34);
    Object.assign(SETUP_PINS.start, { x: x0, y, w: x1 - x0 - gap - bw, h: 96 });
    Object.assign(SETUP_PINS.back, { x: x1 - bw, y, w: bw, h: 96 });
  }
}

// ---- the play screen -----------------------------------------------------------------------------------
// ONE function fills the shared objects above in place; view.js draws from them and game.js hit-tests against them.
export function setPlayLayout(textIdx = 0, watch = false) {
  const idx = clampN(textIdx | 0, 0, TEXT_SCALES.length - 1);
  const key = `${VIEW.key}|${idx}|${watch ? 1 : 0}`;
  if (key === HUD.key) return false;
  HUD.key = key;
  const req = Math.max(TEXT_SCALES[idx], fontFloor());
  const floor = Math.max(1, fontFloor());
  let plan = null;
  for (let hs = req; ; hs = Math.max(floor, Math.round((hs - 0.1) * 100) / 100)) {
    plan = VIEW.mode === 'wide' ? planWide(hs, watch) : planPortrait(hs, watch);
    if (plan.fits || hs <= floor + 1e-6) break;
  }
  commit(plan);
  HUD.hsReq = req;
  return true;
}

function planPortrait(hs, watch) {
  const tight = VIEW.mode === 'compact';
  const ML = Math.max(14, host.l + 6), MR = Math.max(14, host.r + 6), xL = ML, xR = W - MR, fullW = xR - xL;
  const IL = ML + 6, IR = xR - 6, innerW = IR - IL, cxm = (xL + xR) / 2;
  const top0 = host.back ? Math.max(48, host.t + Math.max(host.back, 56) + 8 + 6) : Math.max(48, host.t + 8);
  const ns = 1 + (hs - 1) * 0.45, cs = Math.min(hs, 1.5), ps = 1 + (hs - 1) * 0.5;
  const stacked = hs >= 2;
  const fn = 25 * hs, fa = 20 * hs, fl = 22 * hs, fs = 92 * ns;
  let panels, pan;
  if (!stacked) {
    const nameBase = 8 + 1.05 * fn, scoreBase = 8 + 1.3 * fn + 0.8 * fs;
    const h = Math.round(scoreBase + 0.9 * fa + 16), pw = (fullW - 4) / 2;
    pan = { nameBase, scoreBase, avgBase: h - 14 };
    panels = [{ x: xL, y: top0, w: pw, h }, { x: xL + pw + 4, y: top0, w: pw, h }];
  } else {
    const h = Math.round(Math.max(8 + 1.22 * fn + 1.1 * fa + 8, 0.95 * fs + 14));
    pan = { nameBase: 8 + 1.05 * fn, scoreBase: h / 2 + 0.36 * fs, avgBase: h - 12 };
    panels = [{ x: xL, y: top0, w: fullW, h }, { x: xL, y: top0 + h + 8, w: fullW, h }];
  }
  const panelsBottom = panels[1].y + panels[1].h;
  const legY = Math.round(panelsBottom + 6 + fl * (1 - 0.08 * (hs - 1)));
  const topLimit = legY + 0.22 * fl + 5;
  const lift = Math.max(0, host.b - 16);
  const bot = H - 16 - lift;
  const fBtn = 32 * hs, fW = 40 * Math.min(hs, 1.5);
  const hb = Math.round(Math.max(tight ? 76 : 84, 1.15 * fBtn + 34));
  const btnY = bot - hb;
  const pw2 = hs >= 2 ? Math.round(innerW * 0.58) : Math.round(innerW * 0.647);
  const h1 = Math.round(Math.max(tight ? 56 : 62, 0.95 * fW + 22)), bw = Math.round(Math.min(120 * Math.min(hs, 1.5), innerW * 0.2));
  const y1 = btnY - 10 - h1;
  const watchRow = !(watch && hs >= 2.5);
  const barTop = watch ? (watchRow ? y1 : btnY) : btnY;
  const band = watch ? 6 : tight ? 14 : Math.max(12, 78 - (hs - 1) * 66);
  const coachH = Math.round(Math.max(tight ? 66 : 76, 1.3 * 22 * hs + 26));
  const coachY = barTop - band - coachH;
  const fCL = 36 * cs, fCS = 20 * cs;
  const chipH = Math.round(1.056 * fCL + 1.16 * fCS + 9), gap = 14, tw = 70 * cs;
  const cw = Math.round(Math.min(150 * cs, (fullW - 8 - 2 * gap - 14 - tw) / 3));
  const rowW = 3 * cw + 2 * gap;
  const x0 = Math.round(Math.min(cxm - rowW / 2, xR - 8 - tw - rowW));
  const chipY = coachY - (tight ? 10 : 12) - chipH;
  const botLimit = chipY - 6;
  const Rmin = tight ? 120 : BOARD_MIN_R;
  const rawR = (botLimit - topLimit) / (2 * EXTENT);
  const R = Math.max(Rmin, Math.min(BOARD_R0, rawR));
  const lo = topLimit + EXTENT * R, hiL = Math.max(lo, botLimit - EXTENT * R);
  const pref = tight ? (topLimit + botLimit) / 2 : 592 + (H - 1280) / 2;
  const cy = clampN(pref, lo, hiL);
  const aimBottom = btnY - 14;
  const half = Math.round((innerW - 20) / 2);
  return {
    fits: rawR >= (tight ? 130 : BOARD_MIN_R) - 1e-6,
    hs, ns, cs, ps, stacked, wide: false, pan, panels, legX: cxm, legY, watchRow,
    chips: { y: chipY, h: chipH, cw, gap, x0, totalX: x0 + rowW + 14, totalW: Math.max(40, xR - 6 - (x0 + rowW + 14)) },
    coach: { x: IL, y: coachY, w: innerW, h: coachH },
    think: { x: IL, y: btnY, w: half, h: hb }, menu: { x: IL + half + 20, y: btnY, w: innerW - half - 20, h: hb },
    wPause: { x: IL, y: btnY, w: pw2, h: hb }, wExit: { x: IL + pw2 + 16, y: btnY, w: innerW - pw2 - 16, h: hb },
    wDec: watchRow ? { x: IL, y: y1, w: bw, h: h1 } : null, wInc: watchRow ? { x: IR - bw, y: y1, w: bw, h: h1 } : null, wLabel: watchRow ? { x: IL + bw + 10, y: y1, w: innerW - 2 * bw - 20, h: h1 } : null,
    btnFont: fBtn, watchFont: fW,
    board: { cx: cxm, cy: Math.round(cy), R: Math.round(R * 100) / 100 },
    aim: { top: panelsBottom + 4, bottom: aimBottom, x0: 0, x1: W, originX: cxm, originY: aimBottom - 16 },
    zone: { cx: cxm, x0: xL, x1: xR, top: panelsBottom + 20, bot: chipY - 14, w: fullW },
  };
}

function planWide(hs, watch) {
  const ML = Math.max(14, host.l + 6), MR = Math.max(14, host.r + 6), usable = W - ML - MR;
  const T = Math.max(14, host.t + 8), B = H - Math.max(14, host.b + 8);
  const ns = 1 + (hs - 1) * 0.45, cs = Math.min(hs, 1.5), ps = 1 + (hs - 1) * 0.5;
  const sideW = Math.round(clampN(usable * 0.36, 360, 520));
  const gapC = 14;
  const areaW = usable - sideW - gapC;
  const R = Math.round(clampN(Math.min((areaW - 8) / (2 * EXTENT), (B - T) / (2 * EXTENT)), 90, 300) * 100) / 100;
  const groupW = 2 * EXTENT * R + gapC + sideW;
  const gx = ML + Math.max(0, (usable - groupW) / 2);
  const bcx = gx + EXTENT * R, bcy = (T + B) / 2;
  const sx = Math.round(gx + 2 * EXTENT * R + gapC), sw = sideW;
  const fn = 25 * hs, fa = 20 * hs, fl = 22 * hs, fs = 92 * ns;
  const ph = Math.round(Math.max(8 + 1.22 * fn + 1.1 * fa + 8, 0.95 * fs + 14));
  const pan = { nameBase: 8 + 1.05 * fn, scoreBase: ph / 2 + 0.36 * fs, avgBase: ph - 12 };
  const fBtn = 32 * hs, fW = 40 * Math.min(hs, 1.5);
  const hb = Math.round(Math.max(76, 1.15 * fBtn + 34));
  const h1 = Math.round(Math.max(56, 0.95 * fW + 22));
  const watchRow = !(watch && hs >= 2.2);
  const coachH = Math.round(Math.max(76, 1.3 * 22 * hs + 26));
  const fCL = 36 * cs, fCS = 20 * cs;
  const chipH = Math.round(1.056 * fCL + 1.16 * fCS + 9);
  const legH = Math.round(fl * 1.4 + 6);
  const secs = [2 * ph + 8, legH, chipH, coachH];
  if (watch && watchRow) secs.push(h1);
  secs.push(hb);
  const g0 = 10, total = secs.reduce((a, b) => a + b, 0) + g0 * (secs.length - 1), avail = B - T;
  const fits = total <= avail;
  const slack = Math.max(0, avail - total), extra = Math.min(slack / (secs.length - 1), 26), off = (slack - extra * (secs.length - 1)) / 2;
  const gap = g0 + extra;
  let y = T + off;
  const pnY = y; y += secs[0] + gap;
  const legY = y; y += legH + gap;
  const chipY = y; y += chipH + gap;
  const coachY = y; y += coachH + gap;
  let rowY = 0; if (watch && watchRow) { rowY = y; y += h1 + gap; }
  const btnY = y;
  const half = Math.round((sw - 14) / 2), pw2 = Math.round(sw * 0.6);
  const gapC2 = 14, tw = 70 * cs;
  const cw = Math.round(Math.min(150 * cs, (sw - 2 * gapC2 - 12 - tw) / 3));
  const rowW = 3 * cw + 2 * gapC2, x0 = Math.round(sx + Math.max(0, (sw - rowW - 12 - tw) / 2));
  const bw = Math.round(Math.min(120 * Math.min(hs, 1.5), sw * 0.2));
  const board = { cx: Math.round(bcx), cy: Math.round(bcy), R };
  return {
    fits, hs, ns, cs, ps, stacked: true, wide: true, pan,
    panels: [{ x: sx, y: pnY, w: sw, h: ph }, { x: sx, y: pnY + ph + 8, w: sw, h: ph }], legX: sx + sw / 2, legY: Math.round(legY + legH * 0.72), watchRow,
    chips: { y: chipY, h: chipH, cw, gap: gapC2, x0, totalX: x0 + rowW + 12, totalW: Math.max(36, sx + sw - (x0 + rowW + 12)) },
    coach: { x: sx, y: coachY, w: sw, h: coachH },
    think: { x: sx, y: btnY, w: half, h: hb }, menu: { x: sx + half + 14, y: btnY, w: sw - half - 14, h: hb },
    wPause: { x: sx, y: btnY, w: pw2, h: hb }, wExit: { x: sx + pw2 + 14, y: btnY, w: sw - pw2 - 14, h: hb },
    wDec: watch && watchRow ? { x: sx, y: rowY, w: bw, h: h1 } : null, wInc: watch && watchRow ? { x: sx + sw - bw, y: rowY, w: bw, h: h1 } : null,
    wLabel: watch && watchRow ? { x: sx + bw + 10, y: rowY, w: sw - 2 * bw - 20, h: h1 } : null,
    btnFont: fBtn, watchFont: fW, board,
    aim: { top: 0, bottom: H, x0: 0, x1: sx - 6, originX: board.cx, originY: H - 8 },
    zone: { cx: board.cx, x0: ML, x1: sx - gapC, top: T + 6, bot: B - 6, w: Math.round(2 * EXTENT * R) },
  };
}

function commit(p) {
  const { hs, ns, cs, ps } = p;
  Object.assign(HUD, { hs, ns, cs, ps, stacked: p.stacked, wide: p.wide, watchRow: p.watchRow, pan: p.pan, btnFont: p.btnFont, watchFont: p.watchFont });
  p.panels.forEach((r, i) => Object.assign(PANEL[i], r));
  Object.assign(LEG_LINE, { x: p.legX, y: p.legY });
  Object.assign(CHIPS, p.chips);
  Object.assign(COACH, p.coach);
  Object.assign(THINK_BTN, p.think); Object.assign(MENU_BTN, p.menu);
  Object.assign(WATCH.pause, p.wPause); Object.assign(WATCH.exit, p.wExit);
  for (const [k, r] of [['dec', p.wDec], ['inc', p.wInc], ['label', p.wLabel]]) Object.assign(WATCH[k], r ?? { x: -1000, y: -1000, w: 1, h: 1 });
  Object.assign(BOARD, p.board);
  PX_PER_MM = BOARD.R / 170;
  const a = p.aim;
  Object.assign(AIM, { top: a.top, bottom: a.bottom, x0: a.x0, x1: a.x1, originX: a.originX, originY: a.originY });
  AIM.maxY = p.wide ? Math.round(BOARD.cy + BOARD.R + 60) : Math.min(Math.round(BOARD.cy + BOARD.R + 136), Math.round(a.bottom - 30));
  Object.assign(ZONE, p.zone);
}

setView(720, 1280);
setPlayLayout(0, false);
