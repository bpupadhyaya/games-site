// Screen geometry: one place for every rectangle so game.js (hit-testing) and view.js / menus.js (drawing) never
// disagree. Fluid viewport (kit 1.7.1): the SHORT side of the screen is always 720 virtual units and the long side
// follows the aspect ratio (cap 2.4:1), in portrait and in landscape. Every rectangle here is in SCREEN units.
//
// Two coordinate systems on the play screen: the WORLD (sky, kites, strings, physics: 720 x 1280 units, never changed)
// and the SCREEN (HUD, buttons, text). The world is drawn with a uniform scale z at screen offset (ox, oy); the sky art
// extends to fill the whole screen. A pointer at screen (x, y) is the world point ((x - ox) / z, (y - oy) / z).
//
//   tall  (portrait, and squarish windows): the approved phone composition. HUD on top, string/tool bar at the bottom,
//         the sky between; extra height is sky (z = 1) and the world is nudged between HUD and bar.
//   wide  (landscape, aspect >= 1.15): the sky is in the middle (z about 0.72); the left column holds YOUR string card and
//         the three string buttons, the right column holds the rival's card, the wind panel and Think / Pause; the
//         timer and round pips float in a strip above the sky.
import { W, H, BOUNDS } from './sim.js';

export { W, H };
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export const MIN_TXT = 22;           // virtual units: about 11 css px on the smallest phone (375 css wide -> 1.92 units per px)

// Host safe areas and the floating back button, in virtual units. main.js keeps this current (browsers: all zero).
// `back` is non-zero only when the host draws a back button over the game (hub); standalone builds have none.
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };

export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const THINK_STEPS = [2, 5, 8, 10];
export const PLAY_M = [1, 1.25, 1.5, 1.75, 2];
const MODE_IDS = [-1, 0, 1];
const BAR_H = [[84, 84], [100, 80], [112, 84], [124, 86], [135, 90]];   // [string buttons, tool buttons] per text step

const R = (x, y, w, h) => ({ x, y, w, h });
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const shift = (r, dx, dy) => ({ ...r, x: r.x + dx, y: r.y + dy });

// ---- play: the design-frame pieces (720 x 1280, tall mode) ------------------------------------------------------
export function designPlay(idx) {
  const i = clamp(idx | 0, 0, PLAY_M.length - 1), m = PLAY_M[i], pm = Math.min(m, 1.5);
  const centerW = Math.round(128 + 60 * (m - 1));
  const bw = (W - 48 - centerW) / 2;
  const base = 56 + 16 * m;                       // baseline of the name row
  const barY = base + 8, barH = Math.round(22 * pm), tenY = barY + barH + 7, tenH = Math.round(9 * pm);
  const panelY = tenY + tenH + 20 - 8 * (m - 1);
  const twoRow = m >= 1.5;
  const panelH = twoRow ? Math.round(70 * m - 10) : Math.round(58 * m);
  const hud = { m, pm, bw, centerW, lx: 24, rx: W - 24 - bw, base, barY, barH, tenY, tenH, twoRow, nameFs: 26 * m, numFs: 24 * m, timerFs: 34 * m };
  const panel = R(20, Math.round(panelY), 680, panelH);
  const hudBottom = panel.y + panel.h;
  const [mh, th] = BAR_H[i];
  let modes, think, pause, watch;
  if (i === 0) {
    modes = MODE_IDS.map((id, k) => ({ id, ...R(14 + k * 156, 1176, 148, 84) }));
    think = R(482, 1176, 108, 84); pause = R(598, 1176, 108, 84);
    watch = { dec: R(14, 1176, 132, 84), pause: R(154, 1176, 222, 84), inc: R(384, 1176, 132, 84), exit: R(524, 1176, 182, 84) };
  } else {
    const bottom = 1262, ty = bottom - th, my = ty - 10 - mh, cw = (W - 28 - 20) / 3;
    modes = MODE_IDS.map((id, k) => ({ id, ...R(14 + k * (cw + 10), my, cw, mh) }));
    const hw = (W - 28 - 10) / 2;
    think = R(14, ty, hw, th); pause = R(14 + hw + 10, ty, hw, th);
    watch = { dec: R(14, my, hw, mh), inc: R(14 + hw + 10, my, hw, mh), pause: R(14, ty, Math.round(hw * 1.2), th), exit: R(14 + Math.round(hw * 1.2) + 10, ty, W - 28 - Math.round(hw * 1.2) - 10, th) };
  }
  const barTop = Math.min(modes[0].y, watch.dec.y);
  return { idx: i, m, pm, hud, panel, hudBottom, modes, think, pause, watch, barTop };
}

// Card geometry (name row + strength bar + tension bar), used by the wide mode. y0 = top of the name row.
export function cardGeom(x, y0, bw, m) {
  const pm = Math.min(m, 1.5), nameFs = Math.max(MIN_TXT, 26 * m);
  const base = y0 + nameFs, barY = base + 8, barH = Math.round(22 * pm), tenY = barY + barH + 7, tenH = Math.round(9 * pm);
  return { x, y0, bw, m, pm, nameFs, base, barY, barH, tenY, tenH, h: tenY + tenH - y0 + 4 };
}

function buildTall(w, h, idx, ins) {
  const D = designPlay(idx), m = D.m;
  const dx = (w - W) / 2;
  const wantTop = host.back ? ins.t + host.back + 6 : ins.t + 6;
  const dyTop = Math.max(0, Math.round(wantTop - (56 - 10 * m)));
  const dyBot = (h - ins.b) - 1262 - 18;          // the bar keeps its 18 unit gap above the bottom edge
  const hudBottom = D.hudBottom + dyTop;
  const barTop = D.barTop + dyBot;
  const avail = barTop - hudBottom - 16;
  const z = clamp(avail / 930, 0.5, 1);
  // world y 250 .. 1180 (kite band + flyers) centred between the HUD and the bar, leaning to the bottom
  const oyTop = hudBottom + 8 - 250 * z, oyBot = barTop - 8 - 1180 * z;
  const oy = Math.round(oyTop + (oyBot - oyTop) * 0.6);
  const ox = Math.round(w / 2 - 360 * z);
  return {
    mode: 'tall', m, pm: D.pm, z, ox, oy, hudDx: dx, hudDy: dyTop, hud: D.hud, hudPanel: D.panel,
    modes: D.modes.map((r) => shift(r, dx, dyBot)), think: shift(D.think, dx, dyBot), pause: shift(D.pause, dx, dyBot),
    watch: Object.fromEntries(Object.entries(D.watch).map(([k, r]) => [k, shift(r, dx, dyBot)])),
    hudBottom, barTop,
    sky: R(0, hudBottom + 8, w, barTop - 8 - (hudBottom + 8)),
    capY: hudBottom + 14, capW: Math.min(640, w - 40), capCx: w / 2,
  };
}

function buildWide(w, h, idx, ins) {
  const m0 = PLAY_M[clamp(idx | 0, 0, PLAY_M.length - 1)];
  const U = { x0: ins.l, y0: ins.t, x1: w - ins.r, y1: h - ins.b }; U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  const T = ins.t + 34, strip = 46;     // 34: room above for the kit's free-preview pill
  let z = clamp((U.y1 - T - strip) / 920, 0.45, 0.8);
  z = Math.max(0.45, Math.min(z, (U.w - 2 * 200 - 40) / 720));
  const cx = (U.x0 + U.x1) / 2;
  const ox = Math.round(cx - 360 * z), oy = Math.round(T + strip - 270 * z);
  const stageW = 720 * z;
  const colW = Math.min(440, Math.floor(ox + 30 * z - U.x0 - 24));
  const m = clamp(Math.min(m0, 1.5, colW / 190), 1, 1.5);
  const hb = Math.max(84, Math.round(66 * m)), gap = 10;
  const xL = U.x0 + 12, xR = U.x1 - 12 - colW;
  const yL0 = host.back ? Math.max(T, ins.t + host.back + 10) : T;
  const cardL = cardGeom(xL, yL0, colW, m), cardR = cardGeom(xR, T, colW, m);
  const bottom = U.y1 - 12;
  const modeY0 = bottom - (3 * hb + 2 * gap);
  const modes = MODE_IDS.map((id, k) => ({ id, ...R(xL, modeY0 + k * (hb + gap), colW, hb) }));
  const pause = R(xR, bottom - hb, colW, hb), think = R(xR, bottom - 2 * hb - gap, colW, hb);
  const watch = { pause: R(xL, modeY0, colW, hb), dec: R(xL, modeY0 + hb + gap, colW, hb), inc: R(xL, modeY0 + 2 * (hb + gap), colW, hb), exit: R(xR, bottom - hb, colW, hb) };
  const panelH = Math.round(70 * m - 10) + 14;
  const panel = R(xR, cardR.y0 + cardR.h + 14, colW, panelH);
  const timer = R(cx - 130, T, 260, strip - 4);
  const capW = Math.min(640, Math.max(300, stageW + 80));
  return {
    mode: 'wide', m, pm: Math.min(m, 1.5), z, ox, oy, cards: [cardL, cardR], panel, twoRow: true, timer,
    modes, think, pause, watch, hudBottom: T + strip, barTop: modeY0,
    sky: R(U.x0, U.y0, U.w, U.h), capY: T + strip + 6, capW, capCx: cx, colW,
  };
}

// ---- menus ------------------------------------------------------------------------------------------------------
// A menu column is 720 units wide, centred. Wide screens use two regions (art + buttons) on title / setup / result.
function buildMenu(w, h, ins) {
  const land = w / h >= 1.15;
  const mx = Math.max(20 + Math.max(ins.l, ins.r), host.back ? ins.l + host.back + 16 : 0);
  const colX = Math.round((w - W) / 2);
  const backClear = host.back && colX < ins.l + host.back + 16 ? ins.t + host.back + 8 : ins.t + 6;
  return { land, colX, colW: W, top: ins.t, bottom: h - ins.b, listTop: backClear, regionX0: mx, regionX1: w - mx, regionW: w - 2 * mx };
}

// Reading pages (About / How to Play / Rules): one scrolling panel.
function buildReader(w, h, ins) {
  const land = w / h >= 1.15;
  const pw = Math.min(land ? 900 : 680, w - 28 - Math.max(ins.l, ins.r) * 2);
  const px = Math.round((w - pw) / 2);
  const btnH = 84, headH = 84;
  const topBand = ins.t + 8;
  const bottomBand = h - ins.b - 14 - btnH;
  const panelTop = Math.max(topBand + headH, host.back ? ins.t + host.back + 12 : 0);
  const panel = R(px, panelTop, pw, bottomBand - 12 - panelTop);
  const close = R(Math.round(w / 2 - 210), bottomBand, 420, btnH);
  const dec = R(w - ins.r - 14 - 2 * 92 - 10, topBand, 92, 84), inc = R(w - ins.r - 14 - 92, topBand, 92, 84);
  return { panel, close, dec, inc, pct: { x: dec.x - 16, y: topBand + 42 }, title: { x: w / 2, y: topBand + headH - 6 } };
}

// Setup pins (Start / Back) at the bottom of the setup screen.
function buildPins(w, h, ins) {
  const bw = Math.min(W - 40, w - 28 - Math.max(ins.l, ins.r) * 2);
  const x0 = Math.round((w - bw) / 2), y = h - ins.b - 14 - 96;
  const back = Math.round(bw * 0.3), start = bw - back - 14;
  return { start: R(x0, y, start, 96), back: R(x0 + start + 14, y, back, 96), top: y };
}

const cache = new Map();
export function layoutFor(w, h, idx = 0) {
  w = Math.round(w); h = Math.round(h);
  const key = `${w}x${h}|${idx}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}`;
  let L = cache.get(key);
  if (!L) {
    const ins = { t: Math.round(host.t), r: Math.round(host.r), b: Math.round(host.b), l: Math.round(host.l) };
    const land = w / h >= 1.15;
    L = { key, w, h, land, ins, play: land ? buildWide(w, h, idx, ins) : buildTall(w, h, idx, ins), menu: buildMenu(w, h, ins), reader: buildReader(w, h, ins), pins: buildPins(w, h, ins) };
    cache.set(key, L);
    if (cache.size > 60) cache.delete(cache.keys().next().value);
  }
  return L;
}

// The world rectangle that is visible on screen for a world transform (so the art can extend to fill the screen).
export const visibleWorld = (w, h, ox, oy, z) => ({ x0: -ox / z, y0: -oy / z, x1: (w - ox) / z, y1: (h - oy) / z });
export const toWorld = (P, x, y) => ({ x: (x - P.ox) / P.z, y: (y - P.oy) / P.z });
export { BOUNDS };
