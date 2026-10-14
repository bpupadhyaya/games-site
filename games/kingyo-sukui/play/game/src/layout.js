// Screen geometry: one place for every rectangle so game.js (hit-testing) and view.js (drawing) never disagree.
// FLUID (kit 1.7): the SHORT side of the screen is always 720 virtual units and the long side grows with the aspect ratio, so
// the live size is W x H = 720 x (960..1728) in portrait and (960..1728) x 720 in landscape. `meta` is the object the kit
// updates on every resize; syncSize() copies it into the live bindings W and H (the game calls it every frame).
import { TW, TH } from './sim.js';
import { v3, tankToScreen3, toTank3 } from './v3.js';
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
// Portrait: pause / score / think row, a paper strip (sheets, paper gauge, combo), the tank, then the bowl row.
// Landscape: the tank on the left and one panel on the right: score, paper strip, bowl, then the pause / think buttons.
// HUD text follows the text-size setting up to 160 percent (menus and pages follow it fully); the tank takes what is left.
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
  const f = (b) => Math.max(b, mf) * hz;
  return { big: Math.round(f(58)), mid: Math.round(f(24)), small: Math.round(f(17)), btn: Math.round(f(23)), lab: Math.round(f(19)), toast: Math.round(f(22)) };
};

// Watch & Learn: [ - ] [ Pause ] [ + ] [ Exit ] for the thinking time and leaving.
function demoRow(r, g) {
  const w = (r.w - 3 * g) / 4;
  return { dec: R(r.x, r.y, w, r.h), pause: R(r.x + w + g, r.y, w, r.h), inc: R(r.x + 2 * (w + g), r.y, w, r.h), exit: R(r.x + 3 * (w + g), r.y, w, r.h) };
}

function portrait(z, watch) {
  const hz = Math.min(z, 1.6), mf = minFs(), fs = fontsFor(hz, mf), g = 10;
  const T = host.back ? Math.max(0, host.t + host.back + 6 - 66) : 0;
  const top = host.t + 14 + T, M = Math.max(18, host.l, host.r), bb = Math.max(0, host.b - 8);
  const sideW = tap(Math.round(Math.max(92, fs.btn * 3.2)));
  const hudH = Math.round(Math.max(sideW, fs.big * 1.0 + fs.small * 1.5 + 12));
  const pause = R(M, top, sideW, hudH), think = R(W - M - sideW, top, sideW, hudH), score = R(M + sideW + g, top, W - 2 * M - 2 * sideW - 2 * g, hudH);
  const gaugeH = Math.round(Math.max(58, fs.lab * 2.7));
  const gauge = R(M, top + hudH + g, W - 2 * M, gaugeH);
  const sTop = gauge.y + gauge.h + g;
  let bowlH = Math.round(Math.max(96, fs.lab * 4.2));
  let y = H - 10 - bb;
  let demo = null;
  if (watch) { const dh = tap(Math.round(Math.max(60, fs.btn * 2.2))); demo = demoRow(R(M, y - dh, W - 2 * M, dh), g); y -= dh + g; }
  // a tall screen: the tank is already as wide as it can be, so the room left over goes to a bigger bowl (the catch), not to empty bands
  { const aw = Math.max(40, W - 68), need = TW * (aw / TH) + 68, extra = (y - bowlH - 8 - sTop) - need; if (extra > 24) bowlH += Math.round(Math.min(extra * 0.9, 330 - bowlH, W * 0.5)); }
  const bowl = R(M, y - bowlH, W - 2 * M, bowlH);
  const stage = R(0, sTop, W, Math.max(160, bowl.y - 8 - sTop));
  return { land: false, z, hz, fs, M, pause, think, score, gauge, bowl, stage, demo };
}

function landscape(z, watch) {
  const hz = Math.min(z, 1.6), mf = minFs(), fs = fontsFor(hz, mf), g = 10;
  const U = { x0: host.l, x1: W - host.r, y0: host.t, y1: H - host.b }; U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  const pw = Math.round(clamp(U.w * 0.34 * (1 + (hz - 1) * 0.3), 330, 520)), px0 = U.x1 - pw - 14;
  const topPad = Math.max(host.t + 10, 10), bottom = U.y1 - 8;
  const scoreH = Math.round(Math.max(96, fs.big * 0.95 + fs.small * 1.4 + 14));
  const btnH = tap(Math.round(Math.max(60, fs.btn * 2.1)));
  const score = R(px0, topPad, pw, scoreH);
  const gaugeH = Math.round(Math.max(58, fs.lab * 2.7));
  const gauge = R(px0, score.y + score.h + g, pw, gaugeH);
  let pause, think, demo = null, yb = bottom;
  if (watch) { demo = demoRow(R(px0, bottom - btnH, pw, btnH), g); yb = bottom - btnH - g; pause = demo.pause; think = demo.inc; }
  else { pause = R(px0, bottom - btnH, (pw - g) / 2, btnH); think = R(px0 + (pw + g) / 2, bottom - btnH, (pw - g) / 2, btnH); yb = bottom - btnH - g; }
  const bowl = R(px0, gauge.y + gauge.h + g, pw, Math.max(110, yb - (gauge.y + gauge.h + g)));
  const stage = R(Math.max(0, host.l), 0, px0 - 6 - Math.max(0, host.l), H);
  return { land: true, z, hz, fs, M: 0, pause, think, score, gauge, bowl, stage, demo, px0, pw, backClear: host.back ? host.l + host.back + 10 : 0 };
}

// The tank (TW x TH units, 5:4) fitted inside a stage rect with a margin for its rim. In a tall stage the tank is turned a
// quarter turn (rot) so it fills more of the screen; only the drawing is turned, the simulation never knows.
// Returns the screen rect (w, h are the screen size), the units-to-pixels scale s and rot.
export function tankRect(stage, pad = 34) {
  const aw = Math.max(40, stage.w - 2 * pad), ah = Math.max(40, stage.h - 2 * pad);
  const sN = Math.min(aw / TW, ah / TH), sR = Math.min(aw / TH, ah / TW), rot = sR > sN * 1.04, s = rot ? sR : sN;
  const w = (rot ? TH : TW) * s, h = (rot ? TW : TH) * s;
  return { x: stage.x + (stage.w - w) / 2, y: stage.y + (stage.h - h) / 2, w, h, s, rot };
}
// tank units <-> screen pixels (with the quarter turn: screen x runs against tank y, screen y along tank x)
export const tankToScreen = (tr, x, y) => (v3.on ? tankToScreen3(tr, W, H, x, y) : tr.rot ? { x: tr.x + (TH - y) * tr.s, y: tr.y + x * tr.s } : { x: tr.x + x * tr.s, y: tr.y + y * tr.s });
export const toTank = (tr, sx, sy) => (v3.on ? toTank3(tr, W, H, sx, sy) : tr.rot ? { x: (sy - tr.y) / tr.s, y: TH - (sx - tr.x) / tr.s } : { x: (sx - tr.x) / tr.s, y: (sy - tr.y) / tr.s });

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
