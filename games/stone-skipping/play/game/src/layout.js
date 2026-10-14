// Screen geometry: one place for every rectangle so game.js (hit-testing) and view.js (drawing) never disagree.
// FLUID (kit 1.7): the SHORT side of the screen is always 720 virtual units and the long side grows with the aspect ratio, so
// the live size is W x H = 720 x (960..1728) in portrait and (960..1728) x 720 in landscape. `meta` is the object the kit
// updates on every resize; syncSize() copies it into the live bindings W and H (the game calls it every frame).
export const meta = { width: 720, height: 1280, fluid: { short: 720 } };
export let W = 720;
export let H = 1280;
export function syncSize() { W = meta.width; H = meta.height; }

// Safe areas and the host's floating back button in virtual units (main.js keeps this current; browsers: all zero).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0 };

export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const R = (x, y, w, h) => ({ x, y, w, h });
const tap = (base) => (host.px > 0 ? clamp(Math.round(44 / host.px), base, base + 24) : base);
const minFs = () => (host.px > 0 ? Math.ceil(11 / host.px) : 0);

export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const THINK_STEPS = [2, 5, 8, 10];

// ---- the play screen -------------------------------------------------------------------------------------------------
// Portrait: pause / score / think strip, a wind strip, the pond, then the control panel (stone tray, tilt, spin, a hint row).
// Landscape: the pond on the left, one panel on the right with the score, wind, tray, tilt, spin and the pause / think buttons.
// HUD text follows the text-size setting up to 160 percent (menus and pages follow it fully); the pond takes what is left.
const cache = new Map();
export function playLayout(z = 1, watch = false) {
  const key = `${W}x${H}|${z}|${watch ? 1 : 0}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}|${host.px.toFixed(2)}`;
  let L = cache.get(key);
  if (!L) {
    L = W > H ? landscape(z) : portrait(z);
    L.key = key; L.w = W; L.h = H; cache.set(key, L);
    if (cache.size > 60) cache.delete(cache.keys().next().value);
  }
  return L;
}

const fontsFor = (hz, mf) => {
  const f = (b) => Math.max(b, mf) * hz;
  return { big: Math.round(f(60)), mid: Math.round(f(24)), small: Math.round(f(17)), wind: Math.round(f(19)), btn: Math.round(f(23)), lab: Math.round(f(20)), toast: Math.round(f(22)) };
};

function panelRows(x, w, yBottom, yLimit, fs, hz, g, land) {
  // rows from the bottom up: hint/demo row, spin, tilt, tray. They shrink (down to a floor) when the space above is short.
  let rowH = tap(Math.round(Math.max(land ? 70 : 80, fs.lab * 3.3)));
  let trayH = tap(Math.round(clamp(Math.max(110, fs.lab * 4.6) * Math.min(hz, 1.35), 110, 190)));
  let hintH = tap(Math.round(Math.max(60, fs.btn * 2.2)));
  const avail = yBottom - yLimit - 3 * g, need = trayH + 2 * rowH + hintH;
  if (need > avail) {
    const k = Math.max(0.1, avail / need), fl = (v, m) => Math.max(tap(m), Math.round(v * k));
    rowH = fl(rowH, 52); trayH = fl(trayH, 84); hintH = fl(hintH, 46);
  }
  const hint = R(x, yBottom - hintH, w, hintH);
  const spin = R(x, hint.y - g - rowH, w, rowH);
  const tilt = R(x, spin.y - g - rowH, w, rowH);
  const trayY = tilt.y - g - trayH, cw = (w - 2 * g) / 3;
  const tray = [0, 1, 2].map((i) => R(x + i * (cw + g), trayY, cw, trayH));
  return { hint, spin, tilt, tray, top: trayY };
}

function portrait(z) {
  const hz = Math.min(z, 1.6), mf = minFs(), fs = fontsFor(hz, mf), g = 10;
  const T = host.back ? Math.max(0, host.t + host.back + 6 - 66) : 0;
  const top = host.t + 14 + T, M = Math.max(18, host.l, host.r), bb = Math.max(0, host.b - 8);
  const sideW = tap(Math.round(Math.max(92, fs.btn * 3.2)));
  const hudH = Math.round(Math.max(sideW, fs.big * 1.0 + fs.small * 1.5 + 12));
  const pause = R(M, top, sideW, hudH), think = R(W - M - sideW, top, sideW, hudH), score = R(M + sideW + g, top, W - 2 * M - 2 * sideW - 2 * g, hudH);
  const windH = Math.round(Math.max(50, fs.wind * 2.5));
  const wind = R(M, top + hudH + g, W - 2 * M, windH);
  const sTop = wind.y + wind.h + g;
  const rows = panelRows(M, W - 2 * M, H - 10 - bb, sTop + Math.min(260, H * 0.3), fs, hz, g, false);
  const stage = R(0, sTop, W, Math.max(120, rows.top - 8 - sTop));
  return { land: false, z, hz, fs, M, pause, think, score, wind, stage, tray: rows.tray, tilt: rows.tilt, spin: rows.spin, hint: rows.hint, demo: demoRow(rows.hint, g), panelTop: rows.top };
}

function landscape(z) {
  const hz = Math.min(z, 1.6), mf = minFs(), fs = fontsFor(hz, mf), g = 10;
  const U = { x0: host.l, x1: W - host.r, y0: host.t, y1: H - host.b }; U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  const pw = Math.round(clamp(U.w * 0.4 * (1 + (hz - 1) * 0.3), 380, 600)), px0 = U.x1 - pw - 14;
  const topPad = Math.max(host.t + 10, 10);
  const scoreH = Math.round(Math.max(96, fs.big * 0.95 + fs.small * 1.4 + 14));
  const windH = Math.round(Math.max(46, fs.wind * 2.3));
  const btnH = tap(Math.round(Math.max(60, fs.btn * 2.1)));
  const bottom = U.y1 - 8;
  const pause = R(px0, bottom - btnH, (pw - g) / 2, btnH), think = R(px0 + (pw + g) / 2, bottom - btnH, (pw - g) / 2, btnH);
  const score = R(px0, topPad, pw, scoreH), wind = R(px0, topPad + scoreH + g, pw, windH);
  const rows = panelRows(px0, pw, bottom - btnH - g, wind.y + wind.h + g, fs, hz, g, true);
  const stage = R(0, 0, px0 - 6, H);
  // in a short landscape the hint row is dropped (the pond has the toast) and the demo row takes its place
  return { land: true, z, hz, fs, M: 0, pause, think, score, wind, stage, tray: rows.tray, tilt: rows.tilt, spin: rows.spin, hint: rows.hint, demo: demoRow(rows.hint, g), panelTop: rows.top, px0, pw, backClear: host.back ? host.l + host.back + 10 : 0 };
}

// Watch & Learn: the hint row holds [ - ] [ Pause ] [ + ] [ Exit ] for the thinking time and leaving.
function demoRow(r, g) {
  const w = (r.w - 3 * g) / 4;
  return { dec: R(r.x, r.y, w, r.h), pause: R(r.x + w + g, r.y, w, r.h), inc: R(r.x + 2 * (w + g), r.y, w, r.h), exit: R(r.x + 3 * (w + g), r.y, w, r.h) };
}

// The stone cradle: where the player's stone rests and where a throw is pulled from, in the lower middle of the pond.
import { GL } from './glbridge.js';
export function cradleOf(stage) {
  if (GL.on) {   // the 3D scene shows the thrower on the left: the stone plaque sits at the lower right, beside the power gauge
    const cw3 = Math.min(stage.w * 0.5, 300), ch3 = Math.min(stage.h * 0.36, 200);
    return R(stage.x + stage.w - cw3 - 96, stage.y + stage.h - ch3 - 10, cw3, ch3);
  }
  const cw = Math.min(stage.w * 0.9, 460), ch = Math.min(stage.h * 0.42, 280);
  return R(stage.x + (stage.w - cw) / 2, stage.y + stage.h - ch - 6, cw, ch);
}
// The slider track inside a slider row (label above, track below).
export function trackOf(row) {
  const pad = 26, h = Math.round(row.h * 0.36);
  return R(row.x + pad, row.y + row.h - h - Math.round(row.h * 0.18), row.w - 2 * pad, h);
}

// ---- reference pages (About / How to play / Rules) --------------------------------------------------------------------
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
