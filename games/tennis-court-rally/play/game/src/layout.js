// Screen geometry: one place for every rectangle so game.js (hit-testing) and the drawing code never disagree.
// Fluid layout (kit 1.7.x): the virtual screen is the SHORT side = 720 units and the long side follows the real aspect, in portrait AND
// landscape. W and H are live bindings: the game calls setSize(meta.width, meta.height) at the start of every update and render, and
// every rectangle below is a pure function of (w, h) plus the host's safe insets (`host`, kept current by main.js).
// Modes: portrait (also tablets in portrait and squarish windows) and wide (landscape, aspect >= 1.25): the court fills the screen and
// the whole court area is the touch zone; Pause / Think / stance sit in a row at the bottom (portrait) or a column at the left (landscape).
export let W = 720;
export let H = 1280;
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };      // px: CSS pixels per virtual unit (text never below ~11 css px)
export function setSize(w, h) { if (w > 0 && h > 0) { W = Math.round(w); H = Math.round(h); } }
export const isWide = (w = W, h = H) => w >= h * 1.25;
export const minFont = (u) => Math.max(u, Math.ceil(11 / Math.max(0.3, host.px || 0.6)));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const R = (x, y, w, h) => ({ x, y, w, h });
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const THINK_STEPS = [2, 5, 8, 10];

// The centred column used by the menu screens (portrait: 640 wide on a 720 screen; landscape: at most 700).
export function colGeom(w = W, h = H) {
  const wide = isWide(w, h);
  const cw = wide ? Math.min(Math.round(w * 0.6), 860, w - 2 * (Math.max(host.l, host.r) + 40)) : w - 80;
  return { x: Math.round((w - cw) / 2), w: Math.round(cw), wide };
}

// Reader screens (About / How to Play / Rules / Role guide): a text panel, text zoom A- / A+, Close and Next.
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
    dec = R(Math.round(w / 2 - 210), ty, 140, 80); inc = R(Math.round(w / 2 + 70), ty, 140, 80); pct = R(Math.round(w / 2 - 70), ty, 140, 80);
    back = R(bx, barY, Math.round((bw - 16) / 2), barH); next = R(bx + Math.round((bw + 16) / 2), barY, Math.round((bw - 16) / 2), barH);
  } else {
    const sw = 170, lx = host.l + 16, rx = w - host.r - 16 - sw;
    const pw = Math.min(900, w - 2 * (sw + 32 + Math.max(host.l, host.r))), px = Math.round((w - pw) / 2);
    panel = R(px, host.t + 20, pw, h - host.t - host.b - 40);
    const y0 = host.t + (host.back ? host.back + 12 : 20);
    dec = R(lx, y0, sw, 64); pct = R(lx, y0 + 74, sw, 36); inc = R(lx, y0 + 120, sw, 64);
    const bh = 92, closeY = h - host.b - 20 - bh;
    back = R(rx, closeY, sw, bh); next = R(rx, closeY - 14 - bh, sw, bh);
  }
  r = { wide, panel, view: R(panel.x + 8, panel.y + 96, panel.w - 16, panel.h - 96 - 22), dec, inc, pct, back, next };
  readerCache.set(key, r);
  if (readerCache.size > 40) readerCache.delete(readerCache.keys().next().value);
  return r;
}

// New-match screen: the Start / Back buttons are pinned under the scrolling list.
export function setupPins(w = W, h = H) {
  const c = colGeom(w, h);
  if (!c.wide) { const y = h - 124 - host.b, x = c.x - 10, tw = c.w + 20; return { start: R(x, y, tw - 16 - 204, 96), back: R(x + tw - 204, y, 204, 96) }; }
  const y = h - host.b - 14 - 84;
  return { start: R(c.x, y, c.w - 16 - 180, 84), back: R(c.x + c.w - 180, y, 180, 84) };
}

// The in-play HUD follows the text-size setting (100-300%) through a gentler multiplier so the court stays visible.
export const PLAY_M = [1, 1.25, 1.5, 1.75, 2];

/**
 * In-play layout. The whole court area is the touch zone (press, drag, release). Buttons: Think, Pause and the Net/Back stance.
 * portrait: a button row along the bottom; wide: a column at the left edge under the host back button corner.
 */
export function hudLayout(idx, w = W, h = H) {
  const i = clamp(idx | 0, 0, PLAY_M.length - 1), m0 = PLAY_M[i];
  const wide = isWide(w, h);
  const L0 = host.l + 14, R0 = w - host.r - 14, T0 = host.t, B0 = h - host.b - 14, gap = 10;
  if (!wide) {
    const m = m0, topH = Math.round(36 + 96 * m) + T0;
    const bh = Math.round(62 + 22 * (m - 1) * 1.4), bw = (R0 - L0 - 2 * gap) / 3;
    const y = B0 - bh;
    const util = { stance: R(L0, y, bw, bh), think: R(L0 + bw + gap, y, bw, bh), pause: R(L0 + 2 * (bw + gap), y, bw, bh) };
    return { idx: i, m, sm: m, wide, topH, util, barTop: y, zone: R(0, topH, w, y - topH - 6), prompt: { x: 30, w: w - 60, bottom: y - 14 }, bannerW: w - 80, cx: w / 2 };
  }
  const m = Math.min(m0, 1.3), sm = 0.75 * m;
  const topH = Math.round(30 + 90 * sm) + T0;
  const bh = Math.round(60 + 22 * (m - 1) * 1.4), bw = Math.round(150 * Math.min(m, 1.25));
  const y0 = Math.max(topH + 6, host.back ? T0 + host.back + 12 : 0);
  const util = { pause: R(L0, y0, bw, bh), think: R(L0, y0 + bh + gap, bw, bh), stance: R(L0, y0 + 2 * (bh + gap), bw, bh) };
  const pw = Math.min(380, Math.round(w * 0.3));
  return { idx: i, m, sm, wide, topH, util, barTop: h, zone: R(0, topH, w, h - topH), prompt: { x: R0 - pw, w: pw, bottom: B0 }, bannerW: Math.min(560, Math.round(w * 0.5)), cx: w / 2 };
}

// Watch & Learn controls (Pause, Think -, Think +, Exit) and the message panel. rects[] in that order; panel = { x, w, bottom }.
export function watchLayout(idx, w = W, h = H) {
  const lay = hudLayout(idx, w, h), m = lay.m, u = lay.util.think, bh = u.h, gap = 10;
  const L0 = host.l + 14, R0 = w - host.r - 14, B0 = h - host.b - 14;
  if (!lay.wide) {
    const tw = R0 - L0, big = m >= 1.5, y1 = u.y;
    if (big) { const cw = (tw - gap) / 2; return { lay, m, big, rects: [R(L0, y1 - bh - gap, cw, bh), R(L0 + cw + gap, y1 - bh - gap, cw, bh), R(L0, y1, cw, bh), R(L0 + cw + gap, y1, cw, bh)], panel: { x: L0 + 6, w: tw - 12, bottom: y1 - bh - gap - 12 } }; }
    const cw = (tw - 3 * gap) / 4;
    return { lay, m, big, rects: [0, 1, 2, 3].map((k) => R(L0 + k * (cw + gap), y1, cw, bh)), panel: { x: L0 + 6, w: tw - 12, bottom: y1 - 12 } };
  }
  const bw = 180, x0 = R0 - 2 * bw - gap, y1 = B0 - bh * 2 - gap, pw = Math.min(520, x0 - L0 - 24);
  return { lay, m, big: true, rects: [R(x0, y1, bw, bh), R(x0 + bw + gap, y1, bw, bh), R(x0, y1 + bh + gap, bw, bh), R(x0 + bw + gap, y1 + bh + gap, bw, bh)], panel: { x: L0, w: pw, bottom: B0 } };
}
