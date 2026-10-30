// Screen geometry: one place for every rectangle so game.js (hit-testing) and view.js (drawing) never disagree.
// FLUID (kit 1.7): the SHORT side of the screen is always 720 virtual units and the long side grows with the aspect ratio, so the live
// size is W x H = 720 x (960..1728) in portrait and (960..1728) x 720 in landscape. `meta` is the object the kit updates on every
// resize; syncSize() copies it into the live bindings W and H (the game calls it every frame).
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

// ---- the play screen -------------------------------------------------------------------------------------------------------
// Portrait: pause / title / think row on top, the square with the tower, then one panel along the bottom (tier header, the slots of
// the tier being built, the tray of people, the Raise button). Landscape: the square on the left, the same panel on the right.
// While climbing the tray becomes the steadying controls. HUD text follows the text size up to 160 percent.
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
  return { big: f(40), mid: f(25), small: f(20), tiny: f(17), btn: f(27), card: f(21), cardSub: f(18), toast: f(23) };
};

// The panel's insides. P = panel rect. Returns every rectangle the panel needs, for both build and climb.
function inside(P, fs, hz, watch, land) {
  const g = 10, pad = 14, x = P.x + pad, w = P.w - 2 * pad;
  const sortH = Math.round(Math.max(44, fs.small * 2.2));
  const hdrH = Math.round(Math.max(86, sortH + fs.small * 1.5 + 18));
  const slotH = Math.round(Math.max(86, fs.card * 3.5 + 16));
  const btnH = tap(Math.round(Math.max(76, fs.btn * 2.4)));
  const dBtn = tap(Math.round(Math.max(60, fs.btn * 2.1)));
  const ctlH = watch ? 2 * dBtn + g : btnH;
  const bottom = P.y + P.h - pad;
  const y0 = P.y + pad;
  const hdr = R(x, y0, w, hdrH);
  const sortW = Math.round(clamp(w * 0.3, 118, 190) * Math.min(hz, 1.4));
  const sort = R(x + w - sortW, y0, sortW, sortH);
  const slots = R(x, hdr.y + hdr.h + g, w, slotH);
  const ctl = R(x, bottom - ctlH, w, ctlH);
  const gy = slots.y + slots.h + g;
  const grid = R(x, gy, w, Math.max(60, ctl.y - g - gy));
  let raise, lower, demo;
  if (watch) {
    demo = { pause: R(x, ctl.y, (w - g) / 2, dBtn), exit: R(x + (w + g) / 2, ctl.y, (w - g) / 2, dBtn), dec: R(x, ctl.y + dBtn + g, (w - g) / 2, dBtn), inc: R(x + (w + g) / 2, ctl.y + dBtn + g, (w - g) / 2, dBtn) };
  } else {
    const lw = Math.round(w * 0.3);
    raise = R(x + lw + g, ctl.y, w - lw - g, btnH);
    lower = R(x, ctl.y, lw, btnH);
  }
  // climb controls: status, gauge and the two pads
  const status = R(x, y0, w, Math.round(Math.max(56, fs.mid * 2.2)));
  const gauge = R(x, status.y + status.h + g, w, Math.round(Math.max(44, fs.small * 2.2)));
  const tens = R(x, gauge.y + gauge.h + 8, w, 12);
  const aH = Math.round(Math.max(74, fs.btn * 2.3));
  const aleta = R(x, tens.y + tens.h + g * 1.2, w, aH);
  const padTop = aleta.y + aleta.h + g;
  const padH = Math.max(90, bottom - padTop);
  const padL = R(x, padTop, (w - g) / 2, padH), padR = R(x + (w + g) / 2, padTop, (w - g) / 2, padH);
  return { hdr, sort, slots, grid, raise, lower, demo, ctl, status, gauge, tens, padL, padR, aleta, x, w, g };
}

function portrait(z, watch) {
  const hz = Math.min(z, 1.6), mf = minFs(), fs = fontsFor(hz, mf), g = 10;
  const T = host.back ? Math.max(0, host.t + host.back + 6 - 66) : 0;
  const top = host.t + 12 + T, M = Math.max(16, host.l, host.r), bb = Math.max(0, host.b - 8);
  const sideW = tap(Math.round(Math.max(92, fs.btn * 3.2)));
  const hudH = Math.round(Math.max(sideW * 0.82, fs.big + fs.small * 1.5 + 10));
  const pause = R(M, top, sideW, hudH), think = R(W - M - sideW, top, sideW, hudH), info = R(M + sideW + g, top, W - 2 * M - 2 * sideW - 2 * g, hudH);
  const ph = clamp(Math.round(H * (0.37 + 0.1 * (hz - 1))), 420, Math.round(H * 0.68));
  const panelTop = H - 10 - bb - ph;
  const P = R(M - 4 < 8 ? 8 : M - 4, panelTop, W - 2 * (M - 4 < 8 ? 8 : M - 4), ph);
  const stage = R(0, top + hudH + g, W, panelTop - 8 - (top + hudH + g));
  return { land: false, z, hz, fs, M, pause, think, info, panel: P, stage, ...inside(P, fontsFor(Math.min(hz, 1.3), mf), Math.min(hz, 1.3), watch, false) };
}

function landscape(z, watch) {
  const hz = Math.min(z, 1.6), mf = minFs(), fs = fontsFor(hz, mf), g = 10;
  const U = { x0: host.l, x1: W - host.r, y0: host.t, y1: H - host.b }; U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  const pw = Math.round(clamp(U.w * 0.4 * (1 + (hz - 1) * 0.25), 400, 620));
  const px0 = U.x1 - pw - 10;
  const topPad = Math.max(host.t + 8, 8);
  const btnH = tap(Math.round(Math.max(64, fs.btn * 2.1)));
  const half = (pw - g) / 2;
  const pause = R(px0, topPad, half, btnH), think = R(px0 + half + g, topPad, half, btnH);
  const infoH = Math.round(Math.max(60, fs.big * 0.9 + fs.tiny * 1.3 + 8));
  const info = R(px0, topPad + btnH + g, pw, infoH);
  const pTop = info.y + info.h + 4;
  const P = R(px0, pTop, pw, H - host.b - 8 - pTop);
  const stage = R(0, 0, px0 - 6, H);
  return { land: true, z, hz, fs, M: 0, pause, think, info, panel: P, stage, backClear: host.back ? host.l + host.back + 10 : 0, ...inside(P, fontsFor(Math.min(hz, 1.3), mf), Math.min(hz, 1.3), watch, true) };
}

// ---- reference pages (About / How to play / Rules) --------------------------------------------------------------------------
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
