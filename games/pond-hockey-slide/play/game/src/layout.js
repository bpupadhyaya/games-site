// Screen geometry: one place for every rectangle so game.js (hit-testing) and view.js (drawing) never disagree.
// FLUID (kit 1.7): the SHORT side of the screen is always 720 units and the long side grows with the aspect ratio, so the
// live size is W x H = 720 x (960..1728) in portrait and (960..1728) x 720 in landscape. `meta` is the object the kit
// updates on every resize; `syncSize()` copies it into the live bindings W and H (the game calls it every frame).
// The pond is 600 x 900 world units (680 x 980 with the snowbanks). In portrait it stands upright (you attack the top);
// in landscape it is turned a quarter turn so it fills the width (you attack the right). Everything is a pure function
// of (W, H, safe insets, host back button, text zoom), cached by that key.
import { HW, HH } from './sim.js';
export const meta = { width: 720, height: 1280, fluid: { short: 720 } };
export let W = 720;
export let H = 1280;
export function syncSize() {
  W = meta.width; H = meta.height;
  // The kit's preview pill: top centre in portrait; tucked into the top-right corner in landscape so it never sits on the pond.
  meta.previewBadge = W > H ? { x: W - Math.max(host.r, 0) - 12, y: Math.max(host.t, 0) + 6, align: 'right' } : null;
}

// Safe areas and the host's floating back button, in virtual units (main.js keeps this current; browsers: all zero).
// px = CSS pixels per virtual unit (0 = unknown). Text and tap targets are sized from it.
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0 };

export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const R = (x, y, w, h) => ({ x, y, w, h });
// A tap target about 44 CSS px tall where the screen allows (never smaller than `base`, never more than 20 units taller).
export const tap = (base) => (host.px > 0 ? clamp(Math.round(44 / host.px), base, base + 20) : base);
const minFs = () => (host.px > 0 ? Math.ceil(11 / host.px) : 0);

export const PULL = { min: 22, max: 200 };         // pull length in screen units: below min nothing happens, at max full power
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const THINK_STEPS = [2, 5, 8, 10];
const EXT_W = 2 * (HW + 46) + 14, EXT_H = 2 * (HH + 46) + 14;     // the pond with its snowbanks, world units

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

const fontsFor = (z) => {
  const mf = minFs(), zc = Math.min(z, 3), f = (b) => Math.round(Math.max(b, mf) * zc);
  return { name: f(22), score: f(46), sub: f(17), toast: f(21), btn: f(24), demoBtn: f(21), goals: f(18) };
};

function portrait(z, watch) {
  const fs = fontsFor(Math.min(z, 2.2));
  const M = Math.max(14, host.l, host.r);
  const T = host.back ? Math.max(0, host.t + host.back + 6 - 14) : 0;
  const sq = H < 1.5 * W;   // squarish portrait (4:3 tablets): trim the furniture so the pond gets the height
  // below the kit's preview pill (about 27 css px tall incl. its gap), whatever the phone's scale
  const pill = host.px > 0 ? Math.max(16, 11.5 / host.px) * 1.7 + 6 / host.px + 4 : 40;
  const top = Math.max(36, Math.round(pill)) + Math.max(host.t, T);
  const sbH = Math.round(Math.max(sq ? 80 : 96, fs.score * 1.4 + fs.name * 1.3 + (sq ? 8 : 22)));
  const sb = R(M, top, W - 2 * M, sbH);
  const toastH = Math.round(fs.toast * (sq ? 1.8 : 2.5) + (sq ? 2 : 8));
  const toast = R(M, sb.y + sb.h + 6, W - 2 * M, toastH);
  const bb = Math.max(0, host.b - 6);
  const btnH = tap(Math.round(fs.btn * 1.1 + 26)), dBtnH = tap(Math.round(fs.demoBtn * 1.1 + 24));
  const gap = 10;
  let ctrl, hint = null, menu = null, demo = null;
  if (watch) {
    const rows = z > 1.6 ? 3 : 2, hh = rows * dBtnH + (rows - 1) * gap;
    const y = H - 12 - bb - hh;
    ctrl = R(M, y, W - 2 * M, hh);
    if (rows === 2) {
      const wide = Math.round((ctrl.w - 2 * gap) * 0.27), mid = ctrl.w - 2 * wide - 2 * gap;
      demo = { dec: R(M, y, wide, dBtnH), pause: R(M + wide + gap, y, mid, dBtnH), inc: R(M + wide + gap + mid + gap, y, wide, dBtnH), exit: R(M, y + dBtnH + gap, ctrl.w, dBtnH) };
    } else {
      const half = (ctrl.w - gap) / 2;
      demo = { pause: R(M, y, ctrl.w, dBtnH), dec: R(M, y + dBtnH + gap, half, dBtnH), inc: R(M + half + gap, y + dBtnH + gap, half, dBtnH), exit: R(M, y + 2 * (dBtnH + gap), ctrl.w, dBtnH) };
    }
  } else {
    const y = H - 12 - bb - btnH;
    ctrl = R(M, y, W - 2 * M, btnH);
    const half = (ctrl.w - gap) / 2;
    hint = R(M, y, half, btnH); menu = R(M + half + gap, y, half, btnH);
  }
  const y0 = toast.y + toast.h + (sq ? 0 : 4), y1 = ctrl.y - (sq ? 4 : 8);
  const s = clamp(Math.min((y1 - y0) / EXT_H, (W - 2 * 8) / EXT_W), 0.3, 1.06);
  return { land: false, rot: 0, s, cx: W / 2, cy: (y0 + y1) / 2, sb, toast, ctrl, hint, menu, demo, fs, panel: false, M };
}

function landscape(z, watch) {
  const fs = fontsFor(Math.min(z, 2.2));
  const gap = 10;
  const U = { x0: host.l, x1: W - host.r, y0: host.t, y1: H - host.b };
  const btnH = tap(Math.round(fs.btn * 1.1 + 26)), dBtnH = tap(Math.round(fs.demoBtn * 1.1 + 24));
  const backBox = host.back ? R(host.l, host.t, host.back + 8, host.back + 8) : null;
  // tight: score bar on top, controls under the pond
  const tight = (() => {
    const sbH = Math.round(Math.max(64, fs.score * 1.15 + 12));
    const top = Math.max(U.y0 + 6, 36);
    const sbx = backBox ? Math.max(U.x0 + 10, backBox.x + backBox.w + 8) : U.x0 + 10;
    const sb = R(sbx, top, U.x1 - 10 - sbx, sbH);
    let ctrl, hint = null, menu = null, demo = null, ch;
    if (watch) {
      ch = dBtnH; const y = U.y1 - 8 - ch, wd = (U.x1 - U.x0 - 20 - 3 * gap) / 4;
      ctrl = R(U.x0 + 10, y, U.x1 - U.x0 - 20, ch);
      demo = { dec: R(ctrl.x, y, wd * 0.7, ch), pause: R(ctrl.x + wd * 0.7 + gap, y, wd * 1.6, ch), inc: R(ctrl.x + wd * 2.3 + 2 * gap, y, wd * 0.7, ch), exit: R(ctrl.x + wd * 3.0 + 3 * gap, y, wd, ch) };
    } else {
      ch = btnH; const y = U.y1 - 8 - ch, wd = Math.min(260, (U.x1 - U.x0 - 20 - gap) / 2);
      ctrl = R(U.x0 + 10, y, U.x1 - U.x0 - 20, ch);
      hint = R((U.x0 + U.x1) / 2 - gap / 2 - wd, y, wd, ch); menu = R((U.x0 + U.x1) / 2 + gap / 2, y, wd, ch);
    }
    const toast = R(sb.x, sb.y + sb.h + 2, sb.w, Math.round(fs.toast * 1.5));
    const y0 = toast.y + toast.h, y1 = ctrl.y - 6;
    const s = clamp(Math.min((y1 - y0) / EXT_W, (U.x1 - U.x0 - 12) / EXT_H), 0.3, 1.06);
    return { land: true, rot: Math.PI / 2, s, cx: (U.x0 + U.x1) / 2, cy: (y0 + y1) / 2, sb, toast, ctrl, hint, menu, demo, fs, panel: false, M: 14, backBox };
  })();
  // wide: the pond as big as the height (and a panel's width each side) allows, a panel on each side
  const minSide = 214 + (z > 1.2 ? 60 : 0);
  const sh = clamp(Math.min((U.y1 - U.y0 - 16) / EXT_W, (U.x1 - U.x0 - 2 * minSide) / EXT_H), 0.3, 1.06);
  const bw = EXT_H * sh, side = (U.x1 - U.x0 - bw) / 2;
  if (side >= minSide - 0.5 && sh >= tight.s * 0.98) {
    const pw = Math.min(side - 12, 380 + (z - 1) * 60);
    const lx = U.x0 + (side - pw) / 2 + 2, rx = U.x1 - side + (side - pw) / 2 - 2;
    const sbH = Math.round(fs.score * 1.4 + fs.name * 2.7 + fs.sub * 1.2 + 40);
    const y = Math.max(U.y0 + 36, backBox ? backBox.y + backBox.h + 6 : 0);
    const sb = R(lx, y, pw, sbH);
    const toast = R(lx, sb.y + sb.h + 8, pw, Math.max(10, Math.min(U.y1 - 10 - (sb.y + sb.h + 8), Math.round(fs.toast * 4.2 + 12))));
    let ctrl, hint = null, menu = null, demo = null;
    if (watch) {
      const hh = 3 * dBtnH + 2 * gap, y1 = U.y1 - 12 - hh;
      ctrl = R(rx, y1, pw, hh);
      const half = (pw - gap) / 2;
      demo = { pause: R(rx, y1, pw, dBtnH), dec: R(rx, y1 + dBtnH + gap, half, dBtnH), inc: R(rx + half + gap, y1 + dBtnH + gap, half, dBtnH), exit: R(rx, y1 + 2 * (dBtnH + gap), pw, dBtnH) };
    } else {
      const hh = 2 * btnH + gap, y1 = U.y1 - 12 - hh;
      ctrl = R(rx, y1, pw, hh);
      hint = R(rx, y1, pw, btnH); menu = R(rx, y1 + btnH + gap, pw, btnH);
    }
    return { land: true, rot: Math.PI / 2, s: sh, cx: (U.x0 + U.x1) / 2, cy: (U.y0 + U.y1) / 2, sb, toast, ctrl, hint, menu, demo, fs, panel: true, M: 14, backBox };
  }
  return tight;
}

// board <-> screen. A world point is scaled, turned (landscape) and moved to the pond's centre.
export function toScreen(L, x, y) {
  const c = Math.cos(L.rot), s = Math.sin(L.rot);
  return { x: L.cx + (x * c - y * s) * L.s, y: L.cy + (x * s + y * c) * L.s };
}
export function toWorld(L, px, py) {
  const dx = (px - L.cx) / L.s, dy = (py - L.cy) / L.s, c = Math.cos(-L.rot), s = Math.sin(-L.rot);
  return { x: dx * c - dy * s, y: dx * s + dy * c };
}

// ---- reference pages (About / How to play / Rules) ------------------------------------------------------------------
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

export function setupPins() {
  const bb = Math.max(0, host.b - 10), h = tap(96);
  return { start: R(30, H - 124 - bb + (96 - h), 440, h), back: R(486, H - 124 - bb + (96 - h), 204, h) };
}
