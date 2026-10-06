// Screen geometry: one place for every rectangle so game.js (hit-testing) and view.js (drawing) never disagree.
//
// FLUID (kit 1.7.x): the virtual SHORT side is always 720 units and the long side follows the real screen, so the game fills every phone
// and tablet in portrait and in landscape. `layoutFor(w, h, demo)` is a pure function of the live size (plus the host's safe areas and the
// scene kind) and is cached; `use(w, h, demo)` makes one layout current by copying it into the exported live objects below, so game.js
// and view.js keep importing plain names (W, H, RACK, BTN, PILE_C ...). Call `use` at the start of every update and render.
//
// Shapes (mode):
//   tall     portrait phone (h >= 1160): the approved phone look, table spread over the extra height.
//   compact  portrait shorter than a phone (tablets, squat phones): smaller table tiles, top seat merged into one row.
//   wide     landscape: seats left / right / top, the rack at the bottom with the Runs / Sets / Smart / Hint buttons on its left and
//            Discard / meld counter on its right, status strip above the rack.
//   Squarish windows (neither fits) are laid out as a portrait screen and zoomed out (`ZOOM`), so nothing ever overflows.
export const THINK_STEPS = [2, 5, 8, 10];
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const COLS = 10;
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// Safe areas and the host's floating back button, in virtual units (main.js keeps this current; browsers: all zero).
// back > 0 only when a host back button exists (standalone builds have none: then the top-left corner is free).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };

// ---- live exports (mutated in place by use()) ---------------------------------------------------------------------------
export let W = 720, H = 1280, ZOOM = 1;
export const LAY = {};
export const RACK = { x0: 30, pitch: 66, tw: 62, th: 90, rowY: [826, 928], frame: { x: 12, y: 792, w: 696, h: 244 } };
export const TILE_S = { w: 54, h: 76 };
export const STACK_C = { x: 316, y: 470 };
export const INDICATOR_C = { x: 408, y: 470 };
export const PILE_C = [{ x: 360, y: 652 }, { x: 566, y: 470 }, { x: 360, y: 288 }, { x: 154, y: 470 }];   // 0 = you, 1 = right, 2 = top, 3 = left
export const PILE_SZ = { w: 76, h: 104 };
export const PLATE = [{}, {}, {}, {}];
export const BACKS = { top: {}, left: {}, right: {} };
export const SEAT_POS = [{ x: 360, y: 900 }, { x: 682, y: 400 }, { x: 360, y: 156 }, { x: 38, y: 400 }];
export const HUD_MENU = {};
export const HUD_OKEY = {};
export const BTN = { runs: {}, sets: {}, smart: {}, hint: {} };
export const DISCARD_BTN = {};
export const STATUS = {};
export const MELDS_BAR = {};
export const PAUSE = { panel: {}, resume: {}, sound: {}, rules: {}, quit: {} };
export const RESULT = { panel: {}, primary: {}, secondary: {} };
export const DEMO = { dec: {}, pause: {}, inc: {}, speed: {} };
export const SET_ROWS = [];
export const SET_BACK = {};
export const TEXT_DEC = {};
export const TEXT_INC = {};
export const REF_BACK = {};
export const REF_NEXT = {};
export const REF_PANEL = {};
export const LIMIT_BTN = {};

export const slotRect = (s) => {
  const r = Math.floor(s / COLS), c = s % COLS;
  return { x: RACK.x0 + c * RACK.pitch, y: RACK.rowY[r], w: RACK.tw, h: RACK.th };
};
export const slotCenter = (s) => { const q = slotRect(s); return { x: q.x + q.w / 2, y: q.y + q.h / 2 }; };
// Nearest slot to a point (for dropping a dragged tile); -1 outside the rack frame.
export function slotAt(x, y) {
  const f = RACK.frame;
  if (x < f.x - 6 || x > f.x + f.w + 6 || y < f.y - 10 || y > f.y + f.h + 6) return -1;
  const row = y < (RACK.rowY[0] + RACK.th + RACK.rowY[1]) / 2 ? 0 : 1;
  const col = Math.max(0, Math.min(COLS - 1, Math.floor((x - RACK.x0 + (RACK.pitch - RACK.tw) / 2) / RACK.pitch)));
  return row * COLS + col;
}
export const pileRect = (seat) => { const c = PILE_C[seat]; return { x: c.x - PILE_SZ.w / 2, y: c.y - PILE_SZ.h / 2, w: PILE_SZ.w, h: PILE_SZ.h }; };
export const stackRect = () => ({ x: STACK_C.x - PILE_SZ.w / 2, y: STACK_C.y - PILE_SZ.h / 2, w: PILE_SZ.w, h: PILE_SZ.h });
export const setBtnRect = (i) => { const r = SET_ROWS[i]; return { x: r.x + r.lw, y: r.y + 8, w: r.w - r.lw - 20, h: r.h - 16 }; };
export const stepRect = (i, right) => { const r = SET_ROWS[i]; return right ? { x: r.x + r.w - 90, y: r.y + 8, w: 70, h: r.h - 16 } : { x: r.x + r.lw, y: r.y + 8, w: 70, h: r.h - 16 }; };

// ---- title rows: a function of the live layout and whether a saved match exists -----------------------------------------
export function titleRows(hasSave = false) {
  const T = LAY.title, x = T.bx, w = T.bw, gap = T.gap;
  const half = (w - gap) / 2;
  const cont = hasSave ? { x, y: T.y0, w: half, h: T.h1 } : null;
  const play = hasSave ? { x: x + half + gap, y: T.y0, w: half, h: T.h1 } : { x, y: T.y0, w, h: T.h1 };
  const watch = { x, y: T.y0 + T.h1 + gap, w, h: T.h2 };
  const ry = watch.y + watch.h + gap, third = (w - gap * 2) / 3;
  const howto = { x, y: ry, w: third, h: T.h3 };
  const rules = { x: x + third + gap, y: ry, w: third, h: T.h3 };
  const about = { x: x + (third + gap) * 2, y: ry, w: third, h: T.h3 };
  const sy = ry + T.h3 + gap;
  const settings = { x, y: sy, w: (w - gap) * 0.62, h: T.h3 };
  const sound = { x: x + (w - gap) * 0.62 + gap, y: sy, w: (w - gap) * 0.38, h: T.h3 };
  return { cont, play, watch, howto, rules, about, settings, sound, lockTap: T.lockTap, bottom: sy + T.h3 };
}

// ---- cache + use ---------------------------------------------------------------------------------------------------------
const cache = new Map();
let cur = null;
export function layoutFor(w, h, demo = false) {
  w = Math.round(w); h = Math.round(h);
  const key = `${w}x${h}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}|${Math.round(host.px * 100)}|${demo ? 'd' : 'p'}`;
  let L = cache.get(key);
  if (!L) { L = build(w, h, { ...host }, !!demo); L.key = key; cache.set(key, L); if (cache.size > 40) cache.delete(cache.keys().next().value); }
  return L;
}
const setAll = (dst, src) => { for (const k of Object.keys(src)) dst[k] = src[k]; };
const setArr = (dst, src) => { dst.length = 0; for (const v of src) dst.push(v); };
export function use(w, h, demo = false) {
  const L = layoutFor(w, h, demo);
  if (L === cur) return L;
  cur = L;
  try { if (L.previewBadge) globalThis.__previewBadge = L.previewBadge; else delete globalThis.__previewBadge; } catch { /* ignore */ }
  W = L.w; H = L.h; ZOOM = L.zoom;
  for (const k of Object.keys(LAY)) delete LAY[k];
  setAll(LAY, L);
  setAll(RACK, L.RACK); setAll(TILE_S, L.TILE_S); setAll(STACK_C, L.STACK_C); setAll(INDICATOR_C, L.INDICATOR_C); setAll(PILE_SZ, L.PILE_SZ);
  setArr(PILE_C, L.PILE_C); setArr(PLATE, L.PLATE); setArr(SEAT_POS, L.SEAT_POS); setAll(BACKS, L.BACKS);
  setAll(HUD_MENU, L.HUD_MENU); setAll(HUD_OKEY, L.HUD_OKEY); setAll(BTN, L.BTN); setAll(DISCARD_BTN, L.DISCARD_BTN); setAll(STATUS, L.STATUS); setAll(MELDS_BAR, L.MELDS_BAR);
  setAll(PAUSE, L.PAUSE); setAll(RESULT, L.RESULT); setAll(DEMO, L.DEMO);
  setArr(SET_ROWS, L.SET_ROWS); setAll(SET_BACK, L.SET_BACK);
  setAll(TEXT_DEC, L.TEXT_DEC); setAll(TEXT_INC, L.TEXT_INC); setAll(REF_BACK, L.REF_BACK); setAll(REF_NEXT, L.REF_NEXT); setAll(REF_PANEL, L.REF_PANEL);
  setAll(LIMIT_BTN, L.LIMIT_BTN);
  return L;
}

const R = (x, y, w, h) => ({ x, y, w, h });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function build(rw, rh, ins0, demo) {
  // ---- which shape, and the zoom for squarish windows ------------------------------------------------------------------
  const land = rw >= 896 && rw >= rh * 1.25;
  let zoom = 1;
  if (!land) zoom = Math.min(1, rw / 720, rh / 960);
  const w = rw / zoom, h = rh / zoom;
  const ins = { t: ins0.t / zoom, r: ins0.r / zoom, b: ins0.b / zoom, l: ins0.l / zoom, back: ins0.back / zoom };
  const U = { x0: ins.l, y0: ins.t, x1: w - ins.r, y1: h - ins.b }; U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  const cx = (U.x0 + U.x1) / 2, cy = (U.y0 + U.y1) / 2;
  const pxu = Math.max(0.25, ins0.px * zoom);       // css pixels per virtual unit: tap targets aim for ~44 css px, text for >= 11 css px
  const tapU = (css, lo, hi) => clamp(Math.ceil(css / pxu), lo, hi);
  const bk = ins.back ? Math.max(ins.back, 56) + 8 : 0;
  const big = !land && h >= 1160;
  const mode = land ? 'wide' : big ? 'tall' : 'compact';
  const L = { w, h, zoom, land, mode, big, demo, cx, cy, U, bk, backBox: bk ? R(U.x0, U.y0, bk, bk) : R(0, 0, 0, 0), realW: rw, realH: rh };

  // ---- the rack and the bottom controls --------------------------------------------------------------------------------
  const rk = land ? { th: 78, gap: 8, padT: 22, padB: 12 } : big ? { th: 90, gap: 12, padT: 34, padB: 18 } : { th: 80, gap: 8, padT: 24, padB: 12 };
  const frameH = rk.padT + rk.th * 2 + rk.gap + rk.padB, frameW = 696;
  const sh = land ? 40 : big ? 70 : 60, bh = big ? tapU(44, 64, 76) : 56;
  const B0 = h - Math.max(ins.b + 4, 14);
  const Wc = Math.min(680, U.w - 40), x0c = cx - Wc / 2;
  let frameY, btnY = 0, status, demoBanner = null;
  if (!land) {
    let yb = B0;
    if (demo) { demoBanner = R(x0c, yb - 40, Wc, 40); yb -= 50; }
    status = R(x0c, yb - sh, demo ? Wc - 172 : Wc, sh); yb -= sh + 10;
    btnY = yb - bh; frameY = btnY - (demo ? 30 : 10) - frameH;
  } else {
    frameY = B0 - frameH;
    const stripW = clamp(U.w - 300, 696, 1100), sy = frameY - 6 - sh;
    status = R(cx - stripW / 2, sy, demo ? Math.round(stripW * 0.54) : stripW, sh);
    if (demo) demoBanner = R(status.x + status.w + 8, sy, stripW - status.w - 8, sh);
  }
  const frame = R(cx - frameW / 2, frameY, frameW, frameH);
  L.RACK = { x0: frame.x + 18, pitch: 66, tw: 62, th: rk.th, rowY: [frameY + rk.padT, frameY + rk.padT + rk.th + rk.gap], frame };
  L.STATUS = status; L.demoBanner = demoBanner;

  // ---- play buttons / Watch & Learn controls / discard ----------------------------------------------------------------
  const BTN = { runs: null, sets: null, smart: null, hint: null }, DEMO = {};
  let DISCARD_BTN, MELDS_BAR;
  if (!land) {
    const bw = (Wc - 36) / 4;
    ['runs', 'sets', 'smart', 'hint'].forEach((k, i) => { BTN[k] = R(x0c + i * (bw + 12), btnY, bw, bh); });
    const sd = Math.round(Wc * 0.176);
    DEMO.dec = R(x0c, btnY, sd, bh); DEMO.inc = R(x0c + Wc - sd, btnY, sd, bh); DEMO.pause = R(x0c + sd + 12, btnY, Wc - 2 * sd - 24, bh);
    DEMO.speed = R(x0c + Wc - 160, status.y + (sh - 56) / 2, 160, 56);
    DEMO.thinkLbl = { x: cx, y: btnY - 15, size: 18 };
  } else {
    const pl = { x0: U.x0 + 8, x1: frame.x - 12 }, pw = Math.max(60, pl.x1 - pl.x0), px0 = pl.x0;
    const pwc = Math.min(pw, 300), pxc = px0 + (pw - pwc) / 2;
    if (pw >= 190) {
      const bh2 = (frameH - 8) / 2, bw2 = (pwc - 8) / 2;
      ['runs', 'sets', 'smart', 'hint'].forEach((k, i) => { BTN[k] = R(pxc + (i % 2) * (bw2 + 8), frameY + Math.floor(i / 2) * (bh2 + 8), bw2, bh2); });
    } else {
      const bh4 = (frameH - 18) / 4;
      ['runs', 'sets', 'smart', 'hint'].forEach((k, i) => { BTN[k] = R(pxc, frameY + i * (bh4 + 6), pwc, bh4); });
    }
    // Watch & Learn: Pause on top, [-] think [+] in the middle, Speed below (narrow panels put the think label on a 4th row)
    const narrow = pw < 190, lblH = narrow ? 24 : 0, hr = (frameH - 12 - lblH - (narrow ? 6 : 0)) / 3;
    DEMO.pause = R(pxc, frameY, pwc, hr);
    const sd = narrow ? (pwc - 6) / 2 : Math.max(52, Math.min(70, pwc * 0.26));
    DEMO.dec = R(pxc, frameY + hr + 6, sd, hr); DEMO.inc = R(pxc + pwc - sd, frameY + hr + 6, sd, hr);
    DEMO.speed = R(pxc, frameY + 2 * (hr + 6), pwc, hr);
    DEMO.thinkLbl = narrow ? { x: pxc + pwc / 2, y: frameY + 3 * (hr + 6) + 8, size: 15 } : { x: pxc + pwc / 2, y: frameY + hr + 6 + hr / 2, size: 16 };
    // right of the rack: meld counter and Discard
    const pr = { x0: frame.x + frame.w + 12, x1: U.x1 - 8 }, prw = Math.max(60, pr.x1 - pr.x0), prc = Math.min(prw, 280), prx = pr.x0 + (prw - prc) / 2;
    MELDS_BAR = R(prx, frameY, prc, 70);
    DISCARD_BTN = R(prx, frameY + 78, prc, frameH - 78);
  }
  L.BTN = BTN; L.DEMO = DEMO;

  // ---- the HUD (Menu / Exit, deal, okey chip) ------------------------------------------------------------------------
  const hudY = U.y0 + 8, menuH = tapU(44, 50, 64), hudH = Math.max(58, menuH + 8);
  const menuX = bk ? U.x0 + bk + 4 : U.x0 + 14;
  L.HUD_MENU = R(menuX, hudY + (hudH - menuH) / 2, 96, menuH);
  const chipW = land ? 200 : 256;
  L.HUD_OKEY = R(U.x1 - 14 - chipW, hudY, chipW, 58);
  let leftTop, rightTop;
  if (!land) { L.dealLbl = { x: menuX + 110, y1: hudY + hudH / 2 - 8, y2: hudY + hudH / 2 + 16, maxW: Math.max(90, L.HUD_OKEY.x - (menuX + 110) - 8), align: 'left' }; }
  else {
    const yd = Math.max(hudY + hudH + 4, bk ? U.y0 + bk + 8 : 0);
    L.dealLbl = { x: U.x0 + 14, y1: yd + 28, y2: yd + 50, maxW: 156, align: 'left' };   // baselines: the text sits below the host back button
    leftTop = yd + 62; rightTop = hudY + 58 + 8;
  }

  // ---- the table zone: top seat, three pile rows, my row ---------------------------------------------------------------
  let zTop, zBot, myRowY = 0;
  const topSeat = {};
  if (!land) {
    const T0 = hudY + hudH + 8, T1 = frameY - 8;
    L.previewBadge = { x: U.x1 - 14, y: T0 + 4, align: 'right' };   // the kit's preview badge would sit on the deal label: park it at the right end of the top-seat row
    myRowY = T1 - 54; zBot = myRowY - 4;
    const plateW = big ? 244 : 188, fw = big ? 380 : 330, sb = big ? 1 : 0.85, step = big ? 24 : 20;
    if (big) {
      topSeat.plate = R(cx - 122, T0, 244, 50);
      topSeat.backs = { x: cx, y: T0 + 66, s: sb, step, fw };
      zTop = T0 + 122 + 4;
    } else {
      const gx = cx - (plateW + 10 + fw) / 2;
      topSeat.plate = R(gx, T0 + 4, plateW, 50);
      topSeat.backs = { x: gx + plateW + 10 + fw / 2, y: T0 + 4 + (58 - (48 * sb + 16)) / 2 + 8, s: sb, step, fw };
      zTop = T0 + 58 + 6;
    }
  } else {
    // landscape: the top seat shares the HUD row, centred between the Menu corner and the okey chip
    const pw0 = 150, fw = 320, gx = cx - (pw0 + 10 + fw) / 2;
    // (the kit's "Preview 1:28" chip floats at the top centre, so the top seat starts just below it)
    const ty = Math.max(hudY, U.y0 + Math.ceil(26 / pxu));
    topSeat.plate = R(gx, ty, pw0, 50);
    topSeat.backs = { x: gx + pw0 + 10 + fw / 2, y: ty + 8 + (50 - (48 * 0.85 + 16)) / 2 + 4, s: 0.85, step: 20, fw };
    zTop = ty + 64; zBot = status.y - 6;
  }
  const avail = zBot - zTop;
  const ts = clamp((avail - 64 - 84) / 228, 0.7, 1.1);
  const phH = 76 * ts + 28, pwW = 54 * ts + 22;
  const g = Math.max(4, (avail - 3 * phH) / 4);
  const yTopPile = zTop + g + phH / 2, yMid = yTopPile + phH + g, yMine = yMid + phH + g;
  const hs = land ? clamp(U.w / 1000, 0.95, 1.7) : clamp(ts, 0.85, 1.1);
  L.TILE_S = { w: 54 * ts, h: 76 * ts }; L.PILE_SZ = { w: pwW, h: phH };
  L.PILE_C = [{ x: cx, y: yMine }, { x: cx + 206 * hs, y: yMid }, { x: cx, y: yTopPile }, { x: cx - 206 * hs, y: yMid }];
  L.STACK_C = { x: cx - 44 * hs, y: yMid }; L.INDICATOR_C = { x: cx + 48 * hs, y: yMid };
  // the felt mat between the side seats
  const matX0 = land ? U.x0 + 172 : Math.max(U.x0 + 8, cx - 300), matX1 = land ? U.x1 - 172 : Math.min(U.x1 - 8, cx + 300);
  L.mat = R(matX0, zTop - 2, matX1 - matX0, (land ? status.y - 4 : frameY - 6) - zTop + 2);

  // my row (portrait) / my plate beside my pile (landscape)
  if (!land) {
    const plateW = 188, melW = 250, disW = Wc - plateW - melW - 24;
    L.myPlate = R(x0c, myRowY, plateW, 54);
    MELDS_BAR = R(x0c + plateW + 12, myRowY, melW, 54);
    DISCARD_BTN = R(x0c + plateW + melW + 24, myRowY, disW, 54);
  } else {
    L.myPlate = R(cx + pwW / 2 + 16, yMine - 27, 168, 54);
  }
  L.MELDS_BAR = MELDS_BAR; L.DISCARD_BTN = DISCARD_BTN;

  // side seats: plate + a column of face-down tiles, centred in the side zone
  const sTop = land ? 0 : zTop, sBot = land ? frameY - 8 : zBot;
  const sb = clamp(ts * 0.9, 0.8, 1);
  const sideBlock = (top) => {
    const colAvail = sBot - top - 62 - 8 - 8;
    const step = clamp((colAvail - 34 * sb - 16) / 14, 12, 19);
    const colH = 14 * step + 34 * sb + 16, H0 = 62 + 8 + 8 + colH;
    const y = land ? top : top + Math.max(0, (sBot - top - H0) / 2);
    return { y, step, colH };
  };
  const lb = sideBlock(land ? leftTop : sTop), rb = sideBlock(land ? rightTop : sTop);
  const lx = U.x0 + 10, rx = U.x1 - 160;
  L.PLATE = [L.myPlate, R(rx, rb.y, 150, 62), R(topSeat.plate.x, topSeat.plate.y, topSeat.plate.w, topSeat.plate.h), R(lx, lb.y, 150, 62)];
  L.BACKS = {
    top: topSeat.backs,
    left: { x: U.x0 + 38, y: lb.y + 62 + 8 + 8, s: sb, step: lb.step, colH: lb.colH },
    right: { x: U.x1 - 38, y: rb.y + 62 + 8 + 8, s: sb, step: rb.step, colH: rb.colH },
  };
  L.SEAT_POS = [
    { x: cx, y: frameY + frameH / 2 },
    { x: L.BACKS.right.x, y: L.BACKS.right.y + (14 * rb.step) / 2 },
    { x: topSeat.backs.x, y: topSeat.backs.y + 24 * topSeat.backs.s },
    { x: L.BACKS.left.x, y: L.BACKS.left.y + (14 * lb.step) / 2 },
  ];
  L.toastY = hudY + hudH + 34;
  L.bannerY = (zTop + zBot) / 2;

  // ---- pause / result / limit (centred panels) ---------------------------------------------------------------------------
  const pp = R(cx - 270, cy - 280, 540, 560);
  L.PAUSE = { panel: pp, resume: R(pp.x + 40, pp.y + 110, 460, 84), sound: R(pp.x + 40, pp.y + 214, 460, 84), rules: R(pp.x + 40, pp.y + 318, 460, 84), quit: R(pp.x + 40, pp.y + 422, 460, 84) };
  if (!land) {
    const ph = Math.min(820, U.h - 40), pwid = Math.min(640, U.w - 40), P = R(cx - pwid / 2, cy - ph / 2, pwid, ph);
    L.RESULT = { panel: P, primary: R(P.x + 40, P.y + P.h - 130, P.w - 80, 90), secondary: R(P.x + 40, P.y + P.h - 230, P.w - 80, 80), cols: 1 };
  } else {
    const pwid = Math.min(U.w - 40, 1040), ph = Math.min(U.h - 24, 680), P = R(cx - pwid / 2, cy - ph / 2, pwid, ph);
    const colW = Math.round(P.w * 0.5), rx0 = P.x + P.w - colW;
    L.RESULT = { panel: P, primary: R(rx0 + 30, P.y + P.h - 124, colW - 60, 84), secondary: R(rx0 + 30, P.y + P.h - 216, colW - 60, 76), cols: 2, colW };
  }
  L.LIMIT = { panel: R(cx - 290, cy - 260, 580, 520) };
  L.LIMIT_BTN = R(cx - 200, cy + 130, 400, 84);

  L.title = titleLayout(L, h, U, cx, cy, ins);
  Object.assign(L, settingsLayout(h, U, cx, ins, land));
  Object.assign(L, refLayout(h, U, cx, ins, land));
  return L;
}

function titleLayout(L, h, U, cx, cy, ins) {
  const T = {};
  // Arcforge lockup: bottom centre, directly under the last menu row (>= ~125 css px wide, aspect 1200:327).
  const lkw = Math.max(260, 125 / Math.max(0.2, host.px || 0.6)), lkh = Math.round(lkw * 327 / 1200);
  const placeLock = (mcx, rowsBottom, maxW) => {
    const w = Math.min(lkw, maxW), hh = w * 327 / 1200;
    T.lockup = R(mcx - w / 2, rowsBottom + 14, w, hh);
    const m = 44 / Math.max(0.2, host.px || 0.6), tw = Math.max(w + 24, m), th = Math.max(hh + 12, m);
    T.lockTap = R(mcx - tw / 2, rowsBottom + 6, tw, Math.max(th, hh + 8));
    return T.lockup.y + hh;
  };
  if (!L.land) {
    const k = clamp(h / 1280, 0.78, 1.2), kw = Math.min(k, 1.12); let kk = Math.min(k, 1.15); const extra = Math.max(0, h - 1280 * k);
    T.k = k; T.cx = cx;
    { const bb = L.backBox; if (bb.w && U.y0 + 18 + 26 * k < bb.y + bb.h) kk = Math.min(kk, (cx - (bb.x + bb.w) - 14) / 269); }   // the OKEY tile row clears the host back button
    T.tw = 124 * kk; T.th = 172 * kk; T.lgap = 14 * kk;
    T.letterY = U.y0 + 18 + 26 * k + extra * 0.12;
    T.ulY = T.letterY + T.th + 64 * k; T.tag1 = T.ulY + 58 * k; T.tag2 = T.tag1 + 42 * k;
    T.y0 = T.tag2 + 94 * k + extra * 0.3;
    T.h1 = Math.round(96 * k); T.h2 = Math.round(80 * k); T.h3 = Math.round(76 * k); T.gap = Math.round(14 * k);
    T.bw = Math.min(540 * kw, U.w - 40); T.bx = cx - T.bw / 2;
    const bottom = T.y0 + T.h1 + T.h2 + 2 * T.h3 + 3 * T.gap;
    const lockBottom = placeLock(cx, bottom, U.w - 40);
    T.stats1 = lockBottom + 52 * k + extra * 0.1; T.stats2 = T.stats1 + 40 * k; T.cap = T.stats2 + 50 * k;
    T.showS = Math.min(1.15, (U.w - 56) / 650); T.showH = 120 * Math.min(k, 1.1);
    T.showY = L.h - Math.max(ins.b, 0) - 20 - T.showH;
    T.showX = cx - (U.w - 56) / 2; T.showW = U.w - 56;
    T.tagMax = U.w - 80;
  } else {
    const Lw = U.w * 0.5, lcx = U.x0 + Lw / 2, rcx = U.x0 + Lw + (U.w - Lw) / 2;
    const kL = clamp(Math.min((Lw - 50) / 538, (L.h - 60) / 760), 0.6, 1);
    T.k = kL; T.cx = lcx;
    { const bb = L.backBox; if (bb.w && U.y0 + 92 < bb.y + bb.h) T.cx = Math.max(lcx, Math.min(bb.x + bb.w + 14 + 269 * kL, U.x0 + Lw - 269 * kL)); }   // the OKEY tile row clears the host back button
    T.tw = 124 * kL; T.th = 172 * kL; T.lgap = 14 * kL;
    T.letterY = U.y0 + 92; T.ulY = T.letterY + T.th + 50 * kL; T.tag1 = T.ulY + 52 * kL; T.tag2 = T.tag1 + 36 * kL;
    T.h1 = 96; T.h2 = 80; T.h3 = 76; T.gap = 14;
    const gh = T.h1 + T.h2 + 2 * T.h3 + 3 * T.gap;
    T.bw = Math.min(540, (U.w - Lw) - 50); T.bx = rcx - T.bw / 2; T.y0 = Math.max(U.y0 + 40, cy - (gh + lkh + 14) / 2);
    placeLock(rcx, T.y0 + gh, T.bw);
    T.showS = Math.min(1, (Lw - 40) / 650); T.showH = 120 * T.showS; T.showW = Lw - 40; T.showX = lcx - T.showW / 2;
    T.showY = L.h - Math.max(ins.b, 0) - 14 - T.showH;
    T.stats1 = T.showY - 52; T.stats2 = T.stats1 + 30; T.cap = T.tag2 + 36;
    T.tagMax = Lw - 40;
  }
  return T;
}

function settingsLayout(h, U, cx, ins, land) {
  const rows = [], n = 7;
  let titleY, back, statsY = 0, statsX = cx, statsSz = 24;
  if (!land) {
    titleY = U.y0 + 62;
    const y0 = U.y0 + 124, tall = h >= 1160, backH = tall ? 84 : 64, statsH = tall ? 3 * 40 + 10 : 0;
    const bottom = h - Math.max(ins.b, 0) - 14;
    const gap = tall ? 14 : 8;
    const rh = clamp((bottom - backH - 14 - statsH - y0 - n * gap) / n, 56, 84);
    const w = Math.min(640, U.w - 40);
    for (let i = 0; i < n; i++) rows.push({ x: cx - w / 2, y: y0 + i * (rh + gap), w, h: rh, lw: w >= 640 ? 330 : Math.round(w * 0.5) });
    const endY = y0 + n * (rh + gap);
    back = R(cx - 200, Math.min(bottom - backH, endY + 6 + statsH), 400, backH);
    statsY = tall ? endY + 36 : 0;
  } else {
    titleY = U.y0 + 52;
    const colW = Math.min(640, (U.w - 60) / 2), gx = 20, lx = cx - colW - gx / 2, rx = cx + gx / 2, y0 = U.y0 + 100;
    const rh = 76, gap = 10;
    const place = (x, j) => rows.push({ x, y: y0 + j * (rh + gap), w: colW, h: rh, lw: Math.round(colW * 0.5) });
    for (let i = 0; i < 4; i++) place(lx, i);
    for (let i = 4; i < 7; i++) place(rx, i - 4);
    back = R(cx - 200, Math.min(h - Math.max(ins.b, 0) - 14 - 76, y0 + 4 * (rh + gap) + 6), 400, 76);
    statsX = rx + colW / 2; statsY = y0 + 3 * (rh + gap) + 24; statsSz = 22;
  }
  return { SET_ROWS: rows, SET_BACK: back, settingsTitleY: titleY, statsY, statsX, statsSz };
}

function refLayout(h, U, cx, ins, land) {
  const bh = land ? 64 : h >= 1160 ? 84 : 70;
  const Wc = land ? Math.min(U.w - 40, 1040) : Math.min(680, U.w - 40), x0 = cx - Wc / 2;
  const fy = h - Math.max(ins.b + 4, 14) - bh;
  const bw = Math.round(Wc * 0.3), sm = Math.round(Wc * 0.15), gap = (Wc - bw * 2 - sm * 2) / 3;
  const panelY = U.y0 + (land ? 8 : 12);
  const P = R(x0, panelY, Wc, fy - 10 - panelY);
  return {
    REF_PANEL: P, REF_BACK: R(x0, fy, bw, bh), TEXT_DEC: R(x0 + bw + gap, fy, sm, bh), TEXT_INC: R(x0 + bw + gap * 2 + sm, fy, sm, bh), REF_NEXT: R(x0 + Wc - bw, fy, bw, bh),
  };
}
