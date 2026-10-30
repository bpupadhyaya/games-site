// Screen geometry: one place for every rectangle so game.js (hit-testing) and view.js (drawing) never disagree.
// FLUID (kit 1.7): the SHORT side of the screen is always 720 virtual units and the long side grows with the aspect ratio, so
// the live size is W x H = 720 x (960..1728) in portrait and (960..1728) x 720 in landscape. `meta` is the object the kit
// updates on every resize; syncSize() copies it into the live bindings W and H (the game calls it every frame).
export const meta = { width: 720, height: 1280, fluid: { short: 720 } };
export let W = 720;
export let H = 1280;
export function syncSize() { W = meta.width; H = meta.height; }

// Safe areas and the host's floating back button in virtual units (main.js keeps this current; browsers: all zero).
// px = CSS pixels per virtual unit (0 = unknown).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0 };

export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const R = (x, y, w, h) => ({ x, y, w, h });
const tap = (base) => (host.px > 0 ? clamp(Math.round(44 / host.px), base, base + 24) : base);
const minFs = () => (host.px > 0 ? Math.ceil(11 / host.px) : 0);

export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const THINK_STEPS = [2, 5, 8, 10];

// ---- the play screen -------------------------------------------------------------------------------------------------
// The beach fills the whole screen (portrait) or the left part (landscape); the HUD floats over it as dark chips.
// Portrait: pause / round / think strip on top, a rhythm strip, and a wide DIVE band along the bottom (Watch & Learn swaps it for
// its control buttons). Landscape: the beach on the left, one panel on the right with round, rhythm, DIVE and buttons.
// HUD text follows the text-size setting up to 160 percent (menus and pages follow it fully).
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

const fontsFor = (hz, mf) => {
  const f = (b) => Math.round(Math.max(b, mf) * hz);
  return { big: f(46), mid: f(24), small: f(17), gauge: f(19), btn: f(23), toast: f(22) };
};

function portrait(z, watch) {
  const hz = Math.min(z, 1.6), mf = minFs(), fs = fontsFor(hz, mf), g = 10;
  const T = host.back ? Math.max(0, host.t + host.back + 6 - 66) : 0;
  const top = host.t + 12 + T, M = Math.max(18, host.l, host.r), bb = Math.max(0, host.b - 8);
  const sideW = tap(Math.round(Math.max(92, fs.btn * 3.2)));
  const hudH = Math.round(Math.max(sideW * 0.82, fs.big * 0.9 + fs.small * 1.4 + 10));
  const pause = R(M, top, sideW, hudH), think = R(W - M - sideW, top, sideW, hudH), score = R(M + sideW + g, top, W - 2 * M - 2 * sideW - 2 * g, hudH);
  const gaugeH = Math.round(Math.max(60, fs.gauge * 2.9));
  const gauge = R(M, top + hudH + g, W - 2 * M, gaugeH);
  const dBtn = tap(Math.round(Math.max(62, fs.btn * 2.2)));
  const diveH = Math.round(clamp(H * 0.12, tap(96), 190) * Math.min(1.2, 0.9 + (hz - 1) * 0.3));
  const barH = watch ? 2 * dBtn + 3 * g : diveH + g;
  const yBar = H - 8 - bb - barH;
  const cw = (W - 2 * M - 2 * g) / 3;
  const demo = { dec: R(M, yBar + g, cw, dBtn), pause: R(M + cw + g, yBar + g, cw, dBtn), inc: R(M + 2 * (cw + g), yBar + g, cw, dBtn), exit: R(M, yBar + g + dBtn + g, W - 2 * M, dBtn) };
  const dive = R(M, H - 8 - bb - diveH, W - 2 * M, diveH);
  return { land: false, z, hz, fs, M, pause, think, score, gauge, dive, demo, world: R(0, 0, W, H), tapTop: gauge.y + gauge.h, barTop: yBar, watch };
}

function landscape(z, watch) {
  const hz = Math.min(z, 1.6), mf = minFs(), fs = fontsFor(hz, mf), g = 10;
  const U = { x0: host.l, x1: W - host.r, y0: host.t, y1: H - host.b }; U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  const pw = Math.round(clamp(U.w * 0.25 * (1 + (hz - 1) * 0.3), 300, 420)), px0 = U.x1 - pw - 14;
  const topPad = Math.max(host.t + 12, 12);
  const scoreH = Math.round(Math.max(110, fs.big * 0.95 + fs.small * 1.5 + 18));
  const gaugeH = Math.round(Math.max(70, fs.gauge * 3.2));
  const btnH = tap(Math.round(Math.max(66, fs.btn * 2.2)));
  const bottom = U.y1 - 10;
  const pause = R(px0, bottom - btnH, (pw - g) / 2, btnH), think = R(px0 + (pw + g) / 2, bottom - btnH, (pw - g) / 2, btnH);
  const score = R(px0, topPad, pw, scoreH), gauge = R(px0, topPad + scoreH + g, pw, gaugeH);
  const dB = tap(Math.round(Math.max(60, fs.btn * 2.1)));
  const dTop = bottom - (3 * dB + 2 * g);
  const demo = { pause: R(px0, dTop, pw, dB), dec: R(px0, dTop + dB + g, (pw - g) / 2, dB), inc: R(px0 + (pw + g) / 2, dTop + dB + g, (pw - g) / 2, dB), exit: R(px0, dTop + 2 * (dB + g), pw, dB) };
  const diveTop = gauge.y + gauge.h + g * 2, diveBottom = pause.y - g * 2;
  const dive = R(px0, diveTop, pw, Math.max(tap(90), diveBottom - diveTop));
  return { land: true, z, hz, fs, M: 0, pause, think, score, gauge, dive, demo, world: R(0, 0, px0 - 6, H), px0, pw, backClear: host.back ? host.l + host.back + 10 : 0, watch, tapTop: 0, barTop: H };
}

// ---- reference pages (About / How to play / Rules) --------------------------------------------------------------------
// Portrait: text size controls top right, Back / Done along the bottom. Landscape: one bottom row Back | A- 100% A+ | Done.
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

// Result / pause pins are flow widgets; the only pinned pair is the courtyard picker's Back.
