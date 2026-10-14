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
// Portrait: pause / score / think row, a load-and-clock strip, the track scene, a dashboard of three gauges, then the controls
// (gear up / gear display / gear down on the left, the throttle lever on the right) and a message row.
// Landscape: the scene on the left; on the right one panel with the score, the strip, the gauges, the controls and the buttons.
// HUD text follows the text-size setting up to 160 percent (menus and pages follow it fully); the scene takes what is left.
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
  return { big: Math.round(f(58)), mid: Math.round(f(24)), small: Math.round(f(17)), wind: Math.round(f(19)), btn: Math.round(f(23)), lab: Math.round(f(19)), toast: Math.round(f(22)) };
};

// The control block: gears on the left (Up, the gear display, Down) and the throttle lever on the right.
function controlRects(x, y, w, h, g) {
  const gw = Math.round(clamp(w * 0.38, 150, 300));
  const bh = Math.floor((h - 2 * g) * 0.38), mh = h - 2 * g - 2 * bh;
  const gears = { up: R(x, y, gw, bh), show: R(x, y + bh + g, gw, mh), down: R(x, y + bh + g + mh + g, gw, bh) };
  const lever = R(x + gw + g, y, w - gw - g, h);
  return { gears, lever };
}
// The slot the throttle knob travels in, inside the lever rect (value 0 at the bottom end, 1 at the top end).
export function leverTrack(r) {
  const top = Math.max(64, Math.round(r.h * 0.22)), bot = Math.max(30, Math.round(r.h * 0.1));
  return R(r.x + r.w * 0.5 - 26, r.y + top, 52, Math.max(10, r.h - top - bot));
}
export const leverValue = (r, y) => { const t = leverTrack(r); return clamp(1 - (y - t.y) / t.h, 0, 1); };

function dashRects(x, y, w, h, g) {
  const cw = (w - 2 * g) / 3;
  return [0, 1, 2].map((i) => R(x + i * (cw + g), y, cw, h));
}

// A tablet held upright (about 4:3): the gauges and the gear buttons share the left of the bottom panel and the lever takes the right,
// so the track keeps about half the screen.
function portraitShort(z) {
  const hz = Math.min(z, 1.35), mf = minFs(), fs = fontsFor(hz, mf), g = 10;
  const T = host.back ? Math.max(0, host.t + host.back + 6 - 66) : 0;
  const top = host.t + 14 + T, M = Math.max(18, host.l, host.r), bb = Math.max(0, host.b - 8);
  const sideW = tap(Math.round(Math.max(92, fs.btn * 3.2)));
  const hudH = Math.round(Math.max(sideW, fs.big * 1.0 + fs.small * 1.5 + 12));
  const pause = R(M, top, sideW, hudH), think = R(W - M - sideW, top, sideW, hudH), score = R(M + sideW + g, top, W - 2 * M - 2 * sideW - 2 * g, hudH);
  const stripH = Math.round(Math.max(52, fs.wind * 2.5));
  const strip = R(M, top + hudH + g, W - 2 * M, stripH);
  const sTop = strip.y + strip.h + g;
  const hintH = tap(Math.round(Math.max(54, fs.btn * 2.0)));
  const yBottom = H - 10 - bb;
  const hint = R(M, yBottom - hintH, W - 2 * M, hintH);
  const panelH = Math.round(clamp(Math.max(250, fs.lab * 13) * Math.min(hz, 1.3), 230, 340));
  const py = hint.y - g - panelH, left = Math.round((W - 2 * M) * 0.6);
  const dh = Math.round(panelH * 0.54), bh = panelH - dh - g;
  const dash = dashRects(M, py, left, dh, g);
  const gw = (left - 2 * g) / 3, gy = py + dh + g;
  const gears = { up: R(M, gy, gw, bh), show: R(M + gw + g, gy, gw, bh), down: R(M + 2 * (gw + g), gy, gw, bh) };
  const lever = R(M + left + g, py, W - 2 * M - left - g, panelH);
  const stage = R(0, sTop, W, Math.max(120, py - 8 - sTop));
  return { land: false, z, hz, fs, M, pause, think, score, strip, stage, dash, gears, lever, hint, demo: demoRow(hint, g), panelTop: py, short: true };
}

function portrait(z) {
  if (H < W * 1.55) return portraitShort(z);
  const hz = Math.min(z, 1.35), mf = minFs(), fs = fontsFor(hz, mf), g = 10;
  const T = host.back ? Math.max(0, host.t + host.back + 6 - 66) : 0;
  const top = host.t + 14 + T, M = Math.max(18, host.l, host.r), bb = Math.max(0, host.b - 8);
  const sideW = tap(Math.round(Math.max(92, fs.btn * 3.2)));
  const hudH = Math.round(Math.max(sideW, fs.big * 1.0 + fs.small * 1.5 + 12));
  const pause = R(M, top, sideW, hudH), think = R(W - M - sideW, top, sideW, hudH), score = R(M + sideW + g, top, W - 2 * M - 2 * sideW - 2 * g, hudH);
  const stripH = Math.round(Math.max(52, fs.wind * 2.5));
  const strip = R(M, top + hudH + g, W - 2 * M, stripH);
  const sTop = strip.y + strip.h + g;
  // from the bottom up: message / demo row, controls, dashboard
  let hintH = tap(Math.round(Math.max(60, fs.btn * 2.2)));
  let ctlH = Math.round(clamp(Math.max(210, fs.lab * 9.5) * Math.min(hz, 1.3), 200, 330));
  let dashH = Math.round(clamp(Math.max(136, fs.lab * 7.4) * Math.min(hz, 1.3), 120, 210));
  const yBottom = H - 10 - bb, avail = yBottom - (sTop + Math.min(250, H * 0.28)) - 3 * g, need = hintH + ctlH + dashH;
  if (need > avail) {
    const k = Math.max(0.1, avail / need), fl = (v, m) => Math.max(tap(m), Math.round(v * k));
    hintH = fl(hintH, 46); ctlH = fl(ctlH, 150); dashH = fl(dashH, 92);
  }
  const hint = R(M, yBottom - hintH, W - 2 * M, hintH);
  const ctl = controlRects(M, hint.y - g - ctlH, W - 2 * M, ctlH, g);
  const dash = dashRects(M, ctl.lever.y - g - dashH, W - 2 * M, dashH, g);
  const stage = R(0, sTop, W, Math.max(120, dash[0].y - 8 - sTop));
  return { land: false, z, hz, fs, M, pause, think, score, strip, stage, dash, gears: ctl.gears, lever: ctl.lever, hint, demo: demoRow(hint, g), panelTop: dash[0].y };
}

function landscape(z) {
  const hz = Math.min(z, 1.35), mf = minFs(), fs = fontsFor(hz, mf), g = 10;
  const U = { x0: host.l, x1: W - host.r, y0: host.t, y1: H - host.b }; U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  const pw = Math.round(clamp(U.w * 0.4 * (1 + (hz - 1) * 0.3), 380, 600)), px0 = U.x1 - pw - 14;
  const topPad = Math.max(host.t + 10, 10);
  const scoreH = Math.round(Math.max(96, fs.big * 0.95 + fs.small * 1.4 + 14));
  const stripH = Math.round(Math.max(48, fs.wind * 2.4));
  const btnH = tap(Math.round(Math.max(60, fs.btn * 2.1)));
  const bottom = U.y1 - 8;
  const row = R(px0, bottom - btnH, pw, btnH);
  const pause = R(px0, row.y, (pw - g) / 2, btnH), think = R(px0 + (pw + g) / 2, row.y, (pw - g) / 2, btnH);
  const score = R(px0, topPad, pw, scoreH), strip = R(px0, topPad + scoreH + g, pw, stripH);
  let dashH = Math.round(clamp(Math.max(112, fs.lab * 6), 100, 170));
  const free = row.y - g - (strip.y + strip.h + g);
  let ctlMin = 170;
  if (free - dashH - g < ctlMin) dashH = Math.max(84, free - ctlMin - g);
  const dash = dashRects(px0, strip.y + strip.h + g, pw, dashH, g);
  const cy = dash[0].y + dashH + g, ch = Math.max(100, row.y - g - cy);
  const ctl = controlRects(px0, cy, pw, ch, g);
  const stage = R(0, 0, px0 - 6, H);
  return { land: true, z, hz, fs, M: 0, pause, think, score, strip, stage, dash, gears: ctl.gears, lever: ctl.lever, hint: row, demo: demoRow(row, g), panelTop: score.y, px0, pw, backClear: host.back ? host.l + host.back + 10 : 0 };
}

// Watch & Learn: the bottom row holds [ - ] [ Pause ] [ + ] [ Exit ] for the thinking time and leaving.
function demoRow(r, g) {
  const w = (r.w - 3 * g) / 4;
  return { dec: R(r.x, r.y, w, r.h), pause: R(r.x + w + g, r.y, w, r.h), inc: R(r.x + 2 * (w + g), r.y, w, r.h), exit: R(r.x + 3 * (w + g), r.y, w, r.h) };
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
