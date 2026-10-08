// Screen geometry in one place. Fluid layout (kit 1.7): the virtual screen's SHORT side is 720 units and the long side follows the real
// aspect, in portrait and landscape. W and H are live bindings set by setSize() at the start of every update and render.
// Modes: portrait (also tablets in portrait and squarish windows) and wide (landscape, aspect >= 1.25). In wide mode the table is turned
// a quarter turn so its long side runs across the screen; the player's goal is on the left and a flick to the right kicks.
import { FW, FL, HW, HL, TEXT_SCALES } from './consts.js';

export let W = 720;
export let H = 1280;
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };      // px: CSS pixels per virtual unit
let RES = null;      // 'watch' | 'think': the play screen makes room for the Watch & Learn / Hint panel (wide only)
export function setReserve(k) { RES = k || null; }
export function setSize(w, h) { if (w > 0 && h > 0) { W = Math.round(w); H = Math.round(h); } }
export const isWide = (w = W, h = H) => w >= h * 1.25;
export const minFont = (u) => Math.max(u, Math.ceil(11 / Math.max(0.3, host.px || 0.6)));
export const minTap = () => Math.ceil(44 / Math.max(0.3, host.px || 0.6));   // a 44 CSS px tap target, in virtual units
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const R = (x, y, w, h) => ({ x, y, w, h });
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export { TEXT_SCALES };

export const RIM = 6;           // wooden rail thickness in table units
export const GRIP = 11;         // handle length outside the rail
export const HALF_W = HW + RIM + GRIP + 1;     // half of the whole table including handles, across
export const HALF_L = HL + RIM + 7;            // half of the table along its length, including goal pockets

export function colGeom(w = W, h = H) {
  const wide = isWide(w, h);
  const cw = wide ? Math.min(Math.round(w * 0.6), 860, w - 2 * (Math.max(host.l, host.r) + 40)) : Math.min(w - 80, 720);
  return { x: Math.round((w - cw) / 2), w: Math.round(cw), wide };
}

// Reader screens (About / How to Play / Rules): a text panel, text zoom A- / A+, Close and Next.
const readerCache = new Map();
export function readerLayout(w = W, h = H) {
  w = Math.round(w); h = Math.round(h);
  const key = `${w}x${h}|${host.t},${host.b},${host.l},${host.r},${host.back}`;
  let r = readerCache.get(key);
  if (r) return r;
  const wide = isWide(w, h);
  let panel, dec, inc, pct, back, next;
  if (!wide) {
    const pw = Math.min(w - 68, 652), px = Math.round((w - pw) / 2), bw = Math.min(w - 40, 680), bx = Math.round((w - bw) / 2);
    const barH = 100, barY = h - 16 - host.b - barH, top = Math.max(112, host.t + 108), ty = host.t + 18;
    panel = R(px, top, pw, barY - 34 - top);
    const th = Math.max(80, minTap()); dec = R(Math.round(w / 2 - 210), ty, 140, th); inc = R(Math.round(w / 2 + 70), ty, 140, th); pct = R(Math.round(w / 2 - 70), ty, 140, th);
    back = R(bx, barY, Math.round((bw - 16) / 2), barH); next = R(bx + Math.round((bw + 16) / 2), barY, Math.round((bw - 16) / 2), barH);
  } else {
    const sw = 170, lx = host.l + 16, rx = w - host.r - 16 - sw;
    const pw = Math.min(900, w - 2 * (sw + 32 + Math.max(host.l, host.r))), px = Math.round((w - pw) / 2);
    panel = R(px, host.t + 20, pw, h - host.t - host.b - 40);
    const y0 = host.t + (host.back ? host.back + 12 : 20);
    const th = Math.max(64, minTap()); dec = R(lx, y0, sw, th); pct = R(lx, y0 + th + 10, sw, 36); inc = R(lx, y0 + th + 56, sw, th);
    const bh = Math.max(92, minTap()), closeY = h - host.b - 20 - bh;
    back = R(rx, closeY, sw, bh); next = R(rx, closeY - 14 - bh, sw, bh);
  }
  r = { wide, panel, view: R(panel.x + 8, panel.y + 96, panel.w - 16, panel.h - 96 - 22), dec, inc, pct, back, next };
  readerCache.set(key, r);
  if (readerCache.size > 40) readerCache.delete(readerCache.keys().next().value);
  return r;
}

export function setupPins(w = W, h = H) {
  const c = colGeom(w, h);
  if (!c.wide) { const y = h - 124 - host.b, x = c.x - 10, tw = c.w + 20; return { start: R(x, y, tw - 16 - 204, 96), back: R(x + tw - 204, y, 204, 96) }; }
  const y = h - host.b - 14 - 84;
  return { start: R(c.x, y, c.w - 16 - 180, 84), back: R(c.x + c.w - 180, y, 180, 84) };
}

// In-play HUD follows the text-size setting through a gentler multiplier so the table stays big.
export const PLAY_M = [1, 1.2, 1.4, 1.6, 1.8];

/**
 * In-play layout: the table scene (centre cx, cy, scale s in screen units per table unit, wide flag), the score card, and the buttons.
 * portrait: score card on top, button row (Pause, Hint, Rods) at the bottom. wide: score card on top centre, buttons in a left column.
 */
export function playLayout(idx, w = W, h = H) {
  const i = clamp(idx | 0, 0, PLAY_M.length - 1), m = PLAY_M[i];
  const wide = isWide(w, h);
  const L0 = host.l + 14, R0 = w - host.r - 14, T0 = host.t, B0 = h - host.b - 12, gap = 10;
  if (!wide) {
    const scoreH = Math.round(96 + 40 * (m - 1)), sy = T0 + 54, top = sy + scoreH + 10;
    const bh = Math.max(minTap(), Math.round(66 + 22 * (m - 1))), by = B0 - bh, bw = (R0 - L0 - 2 * gap) / 3;
    const bottom = by - 10;
    const s = Math.min((w - 12) / (2 * HALF_W), (bottom - top) / (2 * HALF_L));
    const cx = w / 2, cy = (top + bottom) / 2;
    return { idx: i, m, wide, s, cx, cy, score: R(L0 + 20, sy, R0 - L0 - 40, scoreH), btn: { pause: R(L0, by, bw, bh), hint: R(L0 + bw + gap, by, bw, bh), rods: R(L0 + 2 * (bw + gap), by, bw, bh) }, banner: { cx: w / 2, y: cy } };
  }
  const colW = Math.round(176 * Math.min(m, 1.25)), bh = Math.max(minTap(), Math.round(62 + 14 * (m - 1))), scoreH = Math.round(150 + 24 * (m - 1));
  const top = T0 + 8, bottom = h - host.b - 8;
  const left = L0 + colW + 16;
  let right = R0, bot = bottom, res = null;
  if (RES) {
    // make room for the explainer panel: beside the table when the screen is long enough, otherwise in a band under it
    const pwS = Math.min(RES === 'think' ? 480 : 400, Math.round(w * 0.32)), sideR = R0 - pwS - 14;
    const sA = Math.min((bottom - top) / (2 * HALF_W), (sideR - left) / (2 * HALF_L));
    const bandH = RES === 'think' ? Math.round(Math.min(h * 0.46, 340)) : Math.round(Math.min(h * 0.36, 270));
    const sB = Math.min((bottom - bandH - top) / (2 * HALF_W), (R0 - left) / (2 * HALF_L));
    if (sA >= sB) { right = sideR; res = { side: true, x: sideR + 14, w: pwS, top, bottom }; }
    else { bot = bottom - bandH; res = { side: false, x: left, w: R0 - left, top: bot, bottom }; }
  }
  const s = Math.min((bot - top) / (2 * HALF_W), (right - left) / (2 * HALF_L));
  const cx = (left + right) / 2, cy = (top + bot) / 2;
  const y0 = Math.max(T0 + 8 + (host.back ? host.back + 6 : 0), top);
  const score = R(L0, y0, colW, scoreH), by0 = y0 + scoreH + gap;
  const btn = { pause: R(L0, by0, colW, bh), hint: R(L0, by0 + bh + gap, colW, bh), rods: R(L0, by0 + 2 * (bh + gap), colW, bh) };
  return { idx: i, m, wide, s, cx, cy, score, btn, res, banner: { cx, y: cy } };
}

// table <-> screen (the table is drawn rotated a quarter turn when wide)
export function toScreen(lay, tx, ty) {
  return lay.wide ? { x: lay.cx - ty * lay.s, y: lay.cy + tx * lay.s } : { x: lay.cx + tx * lay.s, y: lay.cy + ty * lay.s };
}
export function toTable(lay, sx, sy) {
  return lay.wide ? { x: (sy - lay.cy) / lay.s, y: (lay.cx - sx) / lay.s } : { x: (sx - lay.cx) / lay.s, y: (sy - lay.cy) / lay.s };
}

// Watch & Learn controls: Pause/Resume, Think -, Think +, Exit. rects[] in that order, plus the message panel.
export function watchLayout(idx, w = W, h = H) {
  const lay = playLayout(idx, w, h), gap = 10;
  const L0 = host.l + 14, R0 = w - host.r - 14, B0 = h - host.b - 12;
  const bh = lay.btn.pause.h;
  if (!lay.wide) {
    const bw = (R0 - L0 - 3 * gap) / 4, y = B0 - bh;
    return { lay, rects: [0, 1, 2, 3].map((k) => R(L0 + k * (bw + gap), y, bw, bh)), panel: { x: L0 + 6, w: R0 - L0 - 12, bottom: y - 12 } };
  }
  const colW = lay.btn.pause.w, x0 = L0, y0 = lay.btn.pause.y;
  return { lay, rects: [R(x0, y0, colW, bh), R(x0, y0 + bh + gap, colW, bh), R(x0, y0 + 2 * (bh + gap), colW, bh), R(x0, y0 + 3 * (bh + gap), colW, bh)], panel: lay.res ? { x: lay.res.x, w: lay.res.w, bottom: lay.res.bottom, side: lay.res.side } : { x: R0 - Math.min(380, Math.round(w * 0.3)), w: Math.min(380, Math.round(w * 0.3)), bottom: B0 } };
}
export { FW, FL };
