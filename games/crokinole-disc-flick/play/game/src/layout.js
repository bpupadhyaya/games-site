// Screen geometry: one place for every rectangle so game.js (hit-testing) and view.js (drawing) never disagree.
// FLUID (kit 1.7): the SHORT side of the screen is always 720 units and the long side grows with the aspect ratio, so the
// live size is W x H = 720 x (960..1728) in portrait and (960..1728) x 720 in landscape. `meta` is the object the kit
// updates on every resize; `syncSize()` copies it into the live bindings W and H (the game calls it every frame).
// Everything below is a pure function of (W, H, safe insets, host back button, text zoom), cached by that key.
// At exactly 720 x 1280 with no insets every rectangle is the one the game shipped with (tests tap fixed points there).
export const meta = { width: 720, height: 1280, fluid: { short: 720 } };
export let W = 720;
export let H = 1280;
export function syncSize() { W = meta.width; H = meta.height; }

// Safe areas and the host's floating back button, in virtual units (main.js keeps this current; browsers: all zero).
// px = CSS pixels per virtual unit (0 = unknown). Text and tap targets are sized from it.
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0 };

export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const R = (x, y, w, h) => ({ x, y, w, h });
// A tap target about 44 CSS px tall where the screen allows (never smaller than `base`, never more than 20 units taller).
const tap = (base) => (host.px > 0 ? clamp(Math.round(44 / host.px), base, base + 20) : base);
// Smallest font (virtual units) that is still about 11 CSS px.
const minFs = () => (host.px > 0 ? Math.ceil(11 / host.px) : 0);

export const PULL = { min: 26, max: 240 };
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const THINK_STEPS = [2, 5, 8, 10];
const BOARD_EXTENT = 700;   // R_BOARD + 20 rim, both sides (see art.js)

// ---- the play screen -----------------------------------------------------------------------------------------------
// Four shapes, all returned by playLayout(z, watch):
//   portrait, tall enough (H - back clearance >= 1280): the approved phone look; extra height goes to the board's breathing room.
//   portrait, shorter (tablets, small phones with the host back button): compact cards, banner takes the control strip, board shrinks.
//   portrait with text zoom > 100%: the two score cards become full-width rows (as shipped in 1.0.2), board shrinks to what is left.
//   landscape: the board at the largest size the height allows, with one panel (cards, round line, controls) beside it, or two
//   panels (cards left, controls right) when the screen is wide enough. Text zoom enlarges the panel text.
const cache = new Map();
export function playLayout(z = 1, watch = false) {
  const key = `${W}x${H}|${z}|${watch ? 1 : 0}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}|${host.px.toFixed(2)}`;
  let L = cache.get(key);
  if (!L) {
    L = W > H ? landscape(z, watch) : portrait(z, watch);
    L.key = key; L.w = W; L.h = H; cache.set(key, L);
    if (cache.size > 60) cache.delete(cache.keys().next().value);
  }
  return L;
}

const demoStack = (x, y0, w, dh, g) => {   // Watch & Learn buttons stacked: Pause, Think -/+, Leave
  const half = (w - g) / 2;
  return { pause: R(x, y0, w, dh), dec: R(x, y0 + dh + g, half, dh), inc: R(x + half + g, y0 + dh + g, half, dh), exit: R(x, y0 + 2 * (dh + g), w, dh) };
};

function portrait(z, watch) {
  const T = host.back ? Math.max(0, host.t + host.back + 6 - 24) : 0;   // keep the host back button clear of the cards
  const bb = Math.max(0, host.b - 10);
  const top = 24 + T;
  if (z > 1.01) {
    // the play HUD follows the text size as far as the board can stay big enough to shoot at (the menus and pages always follow it fully)
    for (let ze = z; ze > 1.01; ze -= 0.25) { const Lz = portraitZoom(ze, watch, top, bb); if (Lz.board.s >= 0.6 || ze - 0.25 <= 1.01) return Lz; }
  }
  const btnH = tap(64);
  const btnY = H - 10 - bb - btnH;
  const normal = H - T >= 1280;
  let L;
  if (normal) {
    const sliderY = btnY - 12 - 90, zoneTop = top + 212;
    const E = sliderY - zoneTop - 868;
    L = {
      cards: [R(20, top, 300, 134), R(400, top, 300, 134)], pill: R(326, top + 54, 68, 62), compact: false,
      toastY: top + 172, board: { cx: 360, cy: zoneTop + 380 + E * 0.45, s: 1 }, zone: R(0, zoneTop, W, sliderY - zoneTop - 6),
      slider: R(20, sliderY, 680, 90), labelH: 32, track: { x0: 84, x1: 636, y: sliderY + 56, cx: 360, half: 276 },
      hint: R(20, btnY, 210, btnH), menu: R(490, btnY, 210, btnH),
      demo: { dec: R(20, btnY - 14 - 84, 150, 84), pause: R(184, btnY - 14 - 84, 352, 84), inc: R(550, btnY - 14 - 84, 150, 84), exit: R(20, btnY, 680, btnH) },
      banner: R(40, sliderY - 148, 640, 142), bannerReplacesBar: false, ctrl: R(20, sliderY, 680, H - 8 - bb - sliderY),
    };
  } else {
    // compact: the banner replaces the control strip, so the board can use the room the banner would have taken
    const sh = 84, bh = Math.max(56, Math.min(btnH, 72)), ctrlH = sh + 8 + bh, ctrlY = H - 10 - bb - ctrlH;
    const cardH = 108, toastY = top + cardH + 8, zoneTop = toastY + 60;
    const free = ctrlY - zoneTop - 8, s = clamp(free / BOARD_EXTENT, 0.3, 1);
    const dRow = 76;
    L = {
      cards: [R(20, top, 300, cardH), R(400, top, 300, cardH)], pill: R(326, top + 24, 68, 62), compact: true,
      toastY, board: { cx: 360, cy: zoneTop + 4 + free / 2, s }, zone: R(0, zoneTop, W, ctrlY - zoneTop - 6),
      slider: R(20, ctrlY, 680, sh), labelH: 32, track: { x0: 84, x1: 636, y: ctrlY + 56, cx: 360, half: 276 },
      hint: R(20, ctrlY + sh + 8, 210, bh), menu: R(490, ctrlY + sh + 8, 210, bh),
      demo: { dec: R(20, ctrlY, 150, dRow), pause: R(184, ctrlY, 352, dRow), inc: R(550, ctrlY, 150, dRow), exit: R(20, ctrlY + dRow + 8, 680, ctrlH - dRow - 8) },
      banner: R(40, ctrlY + Math.max(0, (ctrlH - 142) / 2), 640, 142), bannerReplacesBar: true, ctrl: R(20, ctrlY, 680, H - 8 - bb - ctrlY),
    };
  }
  return Object.assign(L, {
    z: 1, legacy: true, rows: false, fullCards: !L.compact, info: null, knob: 1.2, chip: 1, pop: 1, land: false, mode: normal ? 'tall' : 'compact', bar: null,
    fs: { name: 26, sub: 19, score: 54, round: 16, roundNum: 28, toast: 26, slider: 18, btn: 28, demoBtn: 24, disc: 22 },
  });
}

function portraitZoom(z, watch, top0, bb) {
  const f = (b) => Math.round(b * z), M = Math.max(20, host.l, host.r), GW = W - 2 * M;
  const fs = { name: f(22), sub: f(14), score: f(34), info: f(17), toast: f(15), slider: f(14), btn: f(22), demoBtn: f(20), bTitle: f(17), bScore: f(30), bName: f(14), bTap: f(14) };
  const showSub = z <= 2.01;
  const rowH = Math.round(Math.max(fs.score, fs.name * 1.15 + (showSub ? fs.sub * 1.15 : 0)) + 16);
  let y = top0;
  const cards = [R(M, y, GW, rowH), R(M, y + rowH + 8, GW, rowH)];
  y += rowH * 2 + 8 + 8;
  const slotH = Math.max(Math.round(fs.info * 1.25) + 8, Math.round(fs.toast * 2 * 1.2) + 16);
  const info = R(M, y, GW, slotH);
  const topEnd = y + slotH;
  const GAP = 8, knob = 1.2 * Math.min(z, 1.5);
  const btnH = tap(Math.round(fs.btn * 1.1 + 26)), dBtnH = tap(Math.round(fs.demoBtn * 1.1 + 26));
  const banner = { h: Math.round(fs.bTitle * 1.2 + fs.bScore * 1.1 + fs.bTap * 1.2 + 44) };
  let slider = null, track = null, hint = null, menu = null, demo = null, barH, labelH = 0, sliderH = 0;
  if (watch) barH = z <= 2.01 ? dBtnH * 2 + GAP : dBtnH * 3 + GAP * 2;
  else {
    labelH = Math.round(fs.slider * 1.25) + 8;
    sliderH = labelH + Math.round(19 * knob * 2) + 10;
    barH = sliderH + GAP + btnH;
  }
  const blockH = Math.max(barH, banner.h);
  const top = H - 14 - bb - blockH;
  if (watch) {
    if (z <= 2.01) {
      const wide = Math.round((GW - 2 * GAP) * 0.27), mid = GW - 2 * wide - 2 * GAP;
      demo = { dec: R(M, top, wide, dBtnH), pause: R(M + wide + GAP, top, mid, dBtnH), inc: R(M + wide + GAP + mid + GAP, top, wide, dBtnH), exit: R(M, top + dBtnH + GAP, GW, dBtnH) };
    } else {
      const half = (GW - GAP) / 2;
      demo = { pause: R(M, top, GW, dBtnH), dec: R(M, top + dBtnH + GAP, half, dBtnH), inc: R(M + half + GAP, top + dBtnH + GAP, half, dBtnH), exit: R(M, top + 2 * (dBtnH + GAP), GW, dBtnH) };
    }
  } else {
    slider = R(M, top, GW, sliderH);
    track = { x0: M + 64, x1: M + GW - 64, y: top + labelH + Math.round((sliderH - labelH) / 2), cx: W / 2, half: (GW - 128) / 2 };
    const half = (GW - GAP) / 2, by = top + sliderH + GAP;
    hint = R(M, by, half, btnH); menu = R(M + half + GAP, by, half, btnH);
  }
  const banner2 = R(M, top, GW, blockH);
  const y1 = topEnd + 6, y2 = top - 6;
  const s = Math.max(0.3, Math.min(1, (y2 - y1) / BOARD_EXTENT, (W - 16) / BOARD_EXTENT));
  return {
    z, legacy: false, rows: true, fullCards: false, compact: false, land: false, mode: 'zoom', cards, pill: null, info, toastY: info.y, board: { cx: W / 2, cy: (y1 + y2) / 2, s },
    zone: R(0, topEnd, W, top - topEnd), slider, labelH, track, knob, hint, menu, demo, bar: { y: top, h: blockH }, ctrl: R(M, top, GW, blockH),
    banner: banner2, bannerReplacesBar: true, chip: Math.min(z, 1.5), pop: Math.min(z, 2), showSub, fs,
  };
}

function landscape(z, watch, ze = z) {
  const L0 = landscape1(z, watch, ze);
  if (L0.overflow && ze > 1.01) return landscape(z, watch, Math.max(1, ze - 0.25));
  return L0;
}
function landscape1(z0, watch, z) {
  const g = 12, zc = Math.min(z, 3), mf = minFs();
  const U = { x0: host.l, x1: W - host.r, y0: host.t, y1: H - host.b };
  U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  const backBox = host.back ? R(host.l, host.t, host.back + 8, host.back + 8) : null;
  const f = (b) => Math.round(Math.max(b, mf) * zc);
  const fs = { name: f(24), sub: f(17), score: f(40), info: f(20), toast: f(20), slider: f(17), btn: f(24), demoBtn: f(22), bTitle: f(22), bScore: f(38), bName: f(18), bTap: f(18) };
  const full = z <= 1.01, showSub = z <= 2.01;
  const rowH = full ? 134 : Math.round(Math.max(fs.score, fs.name * 1.15 + (showSub ? fs.sub * 1.15 : 0)) + 16);
  const infoH = Math.max(Math.round(fs.info * 1.25) + 10, Math.round(fs.toast * 2 * 1.2) + 16);
  const btnH = tap(Math.round(fs.btn * 1.1 + 26)), dBtnH = tap(Math.round(fs.demoBtn * 1.1 + 26));
  const knob = 1.2 * Math.min(z, 1.5), labelH = Math.round(fs.slider * 1.25) + 8, sliderH = labelH + Math.round(19 * knob * 2) + 10;
  const ctrlH = watch ? 3 * dBtnH + 2 * g : sliderH + g + btnH;
  const bannerH = Math.round(fs.bTitle * 1.2 + fs.bScore * 1.1 + fs.bTap * 1.2 + 44);
  const blockH = Math.max(ctrlH, bannerH);
  // board size and panels
  const topPad = 34;   // the kit's preview countdown pill sits at the top centre (y 6..34): keep the board below it
  const sMax = Math.min(1, (U.h - 16 - topPad) / BOARD_EXTENT);
  const cwCap = 360 + Math.round(60 * (zc - 1)), cwMin = 290 + Math.round(50 * (zc - 1));
  const Pmin = cwMin + 2 * g;
  const sTwo = Math.min(sMax, (U.w - 2 * Pmin - 2 * g) / BOARD_EXTENT), sOne = Math.min(sMax, (U.w - Pmin - 2 * g) / BOARD_EXTENT);
  const two = sTwo >= 0.92 * sOne;
  const s = Math.max(0.3, two ? sTwo : sOne), bs = BOARD_EXTENT * s;
  let boardLeft, cwL, cwR, xL, xR;
  if (two) {
    boardLeft = U.x0 + (U.w - bs) / 2;
    const lw = boardLeft - U.x0 - g, rw = U.x1 - (boardLeft + bs) - g;
    cwL = clamp(lw - 2 * g, 200, cwCap); cwR = clamp(rw - 2 * g, 200, cwCap);
    xL = U.x0 + (lw - cwL) / 2 + g / 2; xR = boardLeft + bs + g + (rw - cwR) / 2;
  } else {
    cwR = clamp(U.w - bs - 3 * g, 200, cwCap); cwL = cwR;
    const G = bs + g + cwR, gx = U.x0 + (U.w - G) / 2;
    boardLeft = gx; xR = gx + bs + g; xL = xR;
  }
  const cx = boardLeft + bs / 2, cy = U.y0 + topPad + (U.h - topPad) / 2;
  // panel contents: cards and the round line at the top, controls at the bottom
  let yTop = U.y0 + g;
  if (two && backBox && xL < backBox.x + backBox.w) yTop = Math.max(yTop, backBox.y + backBox.h + g / 2);
  const cards = [R(xL, yTop, cwL, rowH), R(xL, yTop + rowH + 8, cwL, rowH)];
  const info = R(xL, yTop + 2 * rowH + 8 + g, cwL, infoH);
  const ctrlX = xR, cw = cwR, ctrlY = U.y1 - g - blockH;
  const cTop = ctrlY + blockH - ctrlH;
  let slider = null, track = null, hint = null, menu = null, demo = null;
  if (watch) demo = demoStack(ctrlX, cTop, cw, dBtnH, g);
  else {
    slider = R(ctrlX, cTop, cw, sliderH);
    const pad = 36;
    track = { x0: ctrlX + pad, x1: ctrlX + cw - pad, y: cTop + labelH + Math.round((sliderH - labelH) / 2), cx: ctrlX + cw / 2, half: (cw - 2 * pad) / 2 };
    const half = (cw - g) / 2, by = cTop + sliderH + g;
    hint = R(ctrlX, by, half, btnH); menu = R(ctrlX + half + g, by, half, btnH);
  }
  const ctrl = R(ctrlX, ctrlY, cw, blockH);
  const overflow = two ? info.y + info.h > U.y1 : info.y + info.h + g > ctrlY;
  const zone = R(boardLeft - g, 0, bs + 2 * g, H);
  return {
    z, overflow, legacy: false, rows: !full, fullCards: full, compact: false, land: true, two, mode: two ? 'wide2' : 'wide', cards, pill: null, info, toastY: info.y,
    board: { cx, cy, s }, zone, slider, labelH, track, knob, hint, menu, demo, bar: null, ctrl, banner: R(ctrl.x, ctrl.y, ctrl.w, blockH),
    bannerReplacesBar: true, chip: Math.min(z, 1.5), pop: Math.min(z, 2), showSub, fs, backBox,
    panels: [R(xL, U.y0, cwL, U.h), R(xR, U.y0, cwR, U.h)],
  };
}

// ---- reference pages (About / How to play / Rules) --------------------------------------------------------------------
// The page panel and its buttons. Portrait: text size controls at the top right (the top left stays free for the host back
// button), Back / Next along the bottom. Landscape: one bottom row Back | A- 100% A+ | Next and a wide panel above it.
const refCache = new Map();
export function refLayout() {
  const key = `${W}x${H}|${Math.round(host.t)},${Math.round(host.l)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.back)}|${host.px.toFixed(2)}`;
  let r = refCache.get(key);
  if (r) return r;
  if (W > H) {
    const margin = host.back ? Math.max(34, host.l + host.back + 10) : 34;
    const pw = Math.min(W - 2 * margin, 920), barH = tap(76), barY = H - Math.max(14, host.b + 8) - barH, py = Math.max(10, host.t + 6);
    const gw = Math.min(pw, 860), x0 = (W - gw) / 2, bw = Math.round(gw * 0.27), g = 12, mw = gw - 2 * bw - 2 * g, sw = Math.round(mw * 0.3);
    r = {
      land: true, panel: R((W - pw) / 2, py, pw, barY - 10 - py), back: R(x0, barY, bw, barH), next: R(x0 + gw - bw, barY, bw, barH),
      dec: R(x0 + bw + g, barY, sw, barH), inc: R(x0 + gw - bw - g - sw, barY, sw, barH), pct: { x: x0 + bw + g + sw + (mw - 2 * sw) / 2, y: barY + barH / 2 },
    };
  } else {
    const rowY = Math.max(18, host.t + 6), M = Math.max(20, host.l, host.r);
    const py = Math.max(100, rowY + 70, host.back ? host.t + host.back + 10 : 0);
    const barH = 100, barY = H - Math.max(116, host.b + barH + 10);
    const half = (W - 2 * M - 16) / 2;
    r = {
      land: false, panel: R(34, py, W - 68, barY - 34 - py), back: R(M, barY, half, barH), next: R(M + half + 16, barY, half, barH),
      inc: R(W - M - 120, rowY, 120, 60), dec: R(W - M - 252, rowY, 120, 60), pct: { x: W - M - 268, y: rowY + 30, right: true },
    };
  }
  refCache.set(key, r); if (refCache.size > 30) refCache.delete(refCache.keys().next().value);
  return r;
}

// Setup screen pins (Start / Back) for the portrait list; landscape lays them out itself (menus.js).
export function setupPins() {
  const bb = Math.max(0, host.b - 10), h = tap(96);
  return { start: R(30, H - 124 - bb + (96 - h), 440, h), back: R(486, H - 124 - bb + (96 - h), 204, h) };
}
