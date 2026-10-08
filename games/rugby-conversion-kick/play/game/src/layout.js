// Screen geometry: one place for every rectangle so game.js (hit-testing) and the drawing code never disagree.
// Fluid layout (kit 1.7.x): the virtual screen is the SHORT side = 720 units and the long side follows the real aspect, in portrait AND landscape.
// W and H are live bindings: the game calls setSize(meta.width, meta.height) at the start of every update and render; every rectangle is a pure
// function of (w, h) plus the host's safe insets (`host`, kept current by main.js).
// Portrait: picture on top, the control panel under it. Wide (landscape): the picture on the left, the control panel in a column at the right.
export let W = 720;
export let H = 1280;
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };      // px: CSS pixels per virtual unit (text never below ~11 css px)
export function setSize(w, h) { if (w > 0 && h > 0) { W = Math.round(w); H = Math.round(h); } }
export const isWide = (w = W, h = H) => w >= h * 0.98;
export const minFont = (u) => Math.max(u, Math.ceil(11 / Math.max(0.3, host.px || 0.6)));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const R = (x, y, w, h) => ({ x, y, w, h });
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
const hostKey = () => `${host.t},${host.b},${host.l},${host.r},${host.back},${Math.round(host.px * 100)}`;
const tapMin = () => Math.ceil(44 / Math.max(0.3, host.px || 0.6));

export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const THINK_STEPS = [2, 5, 8, 10];

// The centred column used by the menu screens (portrait: 640 wide on a 720 screen; landscape: at most 700).
export function colGeom(w = W, h = H) {
  const wide = isWide(w, h);
  const cw = wide ? Math.min(700, w - 2 * (Math.max(host.l, host.r) + 40)) : w - 80;
  return { x: Math.round((w - cw) / 2), w: Math.round(cw), wide };
}

// Reader screens (About / How to Play / Rules): a text panel, text zoom A- / A+, Close and Next.
const readerCache = new Map();
export function readerLayout(w = W, h = H) {
  w = Math.round(w); h = Math.round(h);
  const key = `${w}x${h}|${hostKey()}`;
  let r = readerCache.get(key);
  if (r) return r;
  const wide = isWide(w, h);
  let panel, dec, inc, pct, back, next;
  if (!wide) {
    const pw = Math.min(w - 68, 652), px = Math.round((w - pw) / 2), bw = Math.min(w - 40, 680), bx = Math.round((w - bw) / 2);
    const barH = 100, barY = h - 16 - host.b - barH, top = Math.max(112, host.t + 108), ty = host.t + 18;
    panel = R(px, top, pw, barY - 34 - top);
    dec = R(Math.round(w / 2 - 210), ty, 140, 80); inc = R(Math.round(w / 2 + 70), ty, 140, 80); pct = R(Math.round(w / 2 - 70), ty, 140, 80);
    if (host.back && dec.x < host.l + host.back + 8) { const sh = host.l + host.back + 8 - dec.x; dec.x += sh; pct.x += sh; inc.x += sh; if (inc.x + inc.w > w - host.r - 8) { const k = (w - host.r - 8 - dec.x) / (inc.x + inc.w - dec.x); dec.w = pct.w = inc.w = Math.round(140 * k); pct.x = dec.x + dec.w; inc.x = pct.x + pct.w; } }
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

// Pinned Start / Back buttons under a scrolling list (the practice set-up screen).
export function setupPins(w = W, h = H) {
  const c = colGeom(w, h);
  if (!c.wide) { const y = h - 124 - host.b, x = c.x - 10, tw = c.w + 20; return { start: R(x, y, tw - 16 - 204, 96), back: R(x + tw - 204, y, 204, 96) }; }
  const y = h - host.b - 14 - 84;
  return { start: R(c.x, y, c.w - 16 - 180, 84), back: R(c.x + c.w - 180, y, 180, 84) };
}

// The in-play HUD follows the 100-300% text size through a gentler multiplier so the picture stays visible.
export const PLAY_M = [1, 1.15, 1.3, 1.45, 1.6];

const hudCache = new Map();
/**
 * In-play layout (virtual units).
 * Portrait: top row (kick count, Think, Pause), wind and spot cards over the picture, the control panel (aim, tilt, power, KICK) at the bottom.
 * Wide: the control panel is a column at the right; Think and Pause top-left of the picture; the cards stack at the left.
 */
export function hudLayout(idx, w = W, h = H) {
  w = Math.round(w); h = Math.round(h);
  const key = `${idx}|${w}x${h}|${hostKey()}`;
  let c = hudCache.get(key);
  if (c) return c;
  c = buildHud(idx, w, h);
  hudCache.set(key, c);
  if (hudCache.size > 60) hudCache.delete(hudCache.keys().next().value);
  return c;
}
function panelRows(p, m, fit, wide) {
  // rows inside a panel rect p: aim, tilt, power, kick
  const pad = Math.round(16 * Math.min(m, 1.2)), gap = Math.round(10 * fit);
  const x = p.x + pad, wd = p.w - 2 * pad;
  const mm = Math.min(m, 1.35);
  const hAim = Math.max(tapMin(), Math.round(76 * mm * fit)), hTilt = Math.max(tapMin(), Math.round(92 * mm * fit)), hPow = Math.round(132 * mm * fit), hKick = Math.max(tapMin(), Math.round(96 * mm * fit));
  let y = p.y + Math.round(pad * 0.8);
  const aim = R(x, y, wd, hAim); y += hAim + gap;
  const tilt = R(x, y, wd, hTilt); y += hTilt + gap;
  const power = R(x, y, wd, hPow); y += hPow + gap;
  const kick = R(x, y, wd, hKick); y += hKick;
  void wide;
  return { aim, tilt, power, kick, total: y + Math.round(pad * 0.8) - p.y };
}
function buildHud(idx, w, h) {
  const i = clamp(idx | 0, 0, PLAY_M.length - 1), m = PLAY_M[i], wide = isWide(w, h);
  const B = h - host.b, backOff = host.back ? host.back + 6 : 0;
  const bh = Math.max(tapMin(), Math.round(64 * Math.min(m, 1.3)));
  if (!wide) {
    const t0 = host.t + 8, topY = Math.max(t0, host.back ? host.t + 6 : t0);
    const bw = Math.round(150 * Math.min(m, 1.25));
    const pause = R(w - host.r - 14 - bw, topY, bw, bh), think = R(pause.x - 10 - bw, topY, bw, bh);
    const label = R(host.l + 14 + backOff, topY, think.x - 10 - (host.l + 14 + backOff), bh);
    // panel: as tall as its rows need, capped so the picture keeps at least ~42% of the screen
    const rows0 = panelRows(R(0, 0, w - 24, 100), m, 1, false);
    const maxP = Math.round((h - host.t - host.b) * 0.5);
    const fit = Math.min(1, maxP / rows0.total);
    const ph = Math.min(maxP, rows0.total);
    const panel = R(host.l + 8, B - ph - 8, w - host.l - host.r - 16, ph);
    const rows = panelRows(panel, m, fit, false);
    const cardW = Math.min(250, Math.round(w * 0.36)), cardH = Math.round(124 * Math.min(m, 1.25));
    const cy = topY + bh + 12 + Math.ceil(26 / Math.max(0.3, host.px || 0.6));
    const wind = R(host.l + 12, cy, cardW, cardH), spot = R(w - host.r - 12 - cardW, cy, cardW, cardH);
    const band = { left: 0, right: w, top: cy + 6, bottom: panel.y - 6 };
    return { wide, m, panel, rows, pause, think, label, wind, spot, band, banner: R(w * 0.08, band.top + (band.bottom - band.top) * 0.14, w * 0.84, 150), prompt: R(w * 0.06, panel.y - 112, w * 0.88, 100), fit };
  }
  const pw = clamp(Math.round(w * 0.36), 340, 470);
  const panel = R(w - host.r - 10 - pw, host.t + 8, pw, h - host.t - host.b - 16);
  const rows0 = panelRows(R(0, 0, pw, 100), m, 1, true);
  const fit = Math.min(1.3, (panel.h - 4) / rows0.total);
  const rows = panelRows(panel, m, fit, true);
  const bw = Math.round(150 * Math.min(m, 1.25));
  const L0 = host.l + 12 + backOff, topY = Math.max(host.t + 8, host.back ? host.t + 6 : 0);
  const think = R(L0, topY, bw, bh), pause = R(L0 + bw + 10, topY, bw, bh);
  const label = R(pause.x + pause.w + 12, topY, panel.x - 20 - (pause.x + pause.w + 12), bh);
  const cardW = Math.min(230, Math.round(w * 0.2)), cardH = Math.round(120 * Math.min(m, 1.2));
  const wind = R(host.l + 12, topY + bh + 12, cardW, cardH), spot = R(host.l + 12, topY + bh + 12 + cardH + 10, cardW, cardH);
  const band = { left: 0, right: panel.x - 6, top: host.t, bottom: h - host.b };
  const cx = (band.left + band.right) / 2;
  return { wide, m, panel, rows, pause, think, label, wind, spot, band, banner: R(wind.x + wind.w + 20, band.top + (band.bottom - band.top) * 0.1, band.right - (wind.x + wind.w + 20) - 10, 150), prompt: R(cx - 290, B - 130, 580, 100), fit };
}

// Watch & Learn controls (Pause, Think -, Think +, Exit) and the message panel. rects[] in that order.
const watchCache = new Map();
export function watchLayout(idx, w = W, h = H) {
  w = Math.round(w); h = Math.round(h);
  const key = `${idx}|${w}x${h}|${hostKey()}`;
  let c = watchCache.get(key);
  if (c) return c;
  const lay = hudLayout(idx, w, h), m = lay.m, gap = 10, B0 = h - host.b - 14, L0 = host.l + 14, R0 = w - host.r - 14;
  if (!lay.wide) {
    const big = m >= 1.3, bh = Math.max(tapMin(), Math.round(66 + 14 * (m - 1))), tw = R0 - L0, rows = big ? 2 : 1, total = rows * bh + (rows - 1) * gap, y1 = B0 - total;
    const rects = big ? [R(L0, y1, (tw - gap) / 2, bh), R(L0 + (tw + gap) / 2, y1, (tw - gap) / 2, bh), R(L0, y1 + bh + gap, (tw - gap) / 2, bh), R(L0 + (tw + gap) / 2, y1 + bh + gap, (tw - gap) / 2, bh)]
      : [0, 1, 2, 3].map((k) => { const cw = (tw - 3 * gap) / 4; return R(L0 + k * (cw + gap), y1, cw, bh); });
    const pTop = Math.round(h * 0.55);
    c = { lay, m, big, rects, panel: R(L0, pTop, tw, y1 - 12 - pTop), band: { left: 0, right: w, top: host.t + 70, bottom: pTop - 8 } };
  } else {
    const bh = Math.max(Math.round(66 + 14 * (m - 1)), tapMin()), pw = lay.panel.w, x0 = lay.panel.x;
    const cw = (pw - gap) / 2, y1 = B0 - bh * 2 - gap;
    c = { lay, m, big: true, rects: [R(x0, y1, cw, bh), R(x0 + cw + gap, y1, cw, bh), R(x0, y1 + bh + gap, cw, bh), R(x0 + cw + gap, y1 + bh + gap, cw, bh)], panel: R(x0, host.t + 8, pw, y1 - 12 - host.t - 8), band: lay.band };
  }
  watchCache.set(key, c);
  if (watchCache.size > 60) watchCache.delete(watchCache.keys().next().value);
  return c;
}
