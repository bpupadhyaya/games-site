// Screen geometry: one place for every rectangle so game.js (hit-testing), controls.js and the drawing code never disagree.
// Fluid layout (kit 1.7.x): the virtual screen is the SHORT side = 720 units and the long side follows the real aspect, in portrait AND
// landscape. W and H are live bindings: the game calls setSize(meta.width, meta.height) at the start of every update and render, and
// every rectangle below is a pure function of (w, h) plus the host's safe insets (`host`, kept current by main.js).
// Modes: portrait (the approved phone look: the pitch seen end-on, the stick and three buttons at the bottom; also tablets in portrait)
// and wide (landscape, aspect >= ~1): the pitch is seen from the side so its long axis runs across the screen, the left thumb has the
// stick, the right thumb the three buttons.
export let W = 720;
export let H = 1280;
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };      // px: CSS pixels per virtual unit (text never below ~11 css px)
export function setSize(w, h) { if (w > 0 && h > 0) { W = Math.round(w); H = Math.round(h); } }
export const isWide = (w = W, h = H) => w >= h * 0.98;
export const minFont = (u) => Math.max(u, Math.ceil(11 / Math.max(0.3, host.px || 0.6)));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const R = (x, y, w, h) => ({ x, y, w, h });
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export const inCircle = (c, x, y, pad = 14) => (x - c.cx) * (x - c.cx) + (y - c.cy) * (y - c.cy) <= (c.r + pad) * (c.r + pad);
const hostKey = () => `${host.t},${host.b},${host.l},${host.r},${host.back},${Math.round(host.px * 100)}`;

export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const THINK_STEPS = [2, 5, 8, 10];
const HL_HW = 25 / 15;                                     // pitch length / width (consts HL / HW)

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
    // the host's floating back button sits top-left: the zoom row starts to its right when it is there
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

// New-match screen: the Start / Back buttons are pinned under the scrolling list.
export function setupPins(w = W, h = H) {
  const c = colGeom(w, h);
  if (!c.wide) { const y = h - 124 - host.b, x = c.x - 10, tw = c.w + 20; return { start: R(x, y, tw - 16 - 204, 96), back: R(x + tw - 204, y, 204, 96) }; }
  const y = h - host.b - 14 - 84;
  return { start: R(c.x, y, c.w - 16 - 180, 84), back: R(c.x + c.w - 180, y, 180, 84) };
}

// The in-play HUD follows the 100-300% text size through a gentler multiplier so the pitch stays visible.
export const PLAY_M = [1, 1.25, 1.5, 1.75, 2];
const MM_PORTRAIT_W = 92, MM_WIDE_W = 128;

const hudCache = new Map();
/**
 * In-play layout (virtual units). Portrait: scoreboard on top, the fixed top-down inset under it, the pitch (3D) in the middle, the
 * stick zone (left), RUN / action buttons (right) in a block at the bottom; Think and Pause under the scoreboard. Wide: scoreboard,
 * clock and the inset in one slim top row; Think and Pause stacked at the left edge with the stick zone under them; the three round
 * buttons stacked in the lower right corner; banner and prompt stack centred under the top row.
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
function buildHud(idx, w, h) {
  const i = clamp(idx | 0, 0, PLAY_M.length - 1), m0 = PLAY_M[i], wide = isWide(w, h);
  const B = h - host.b, backOff = host.back ? host.back + 6 : 0;
  if (!wide) {
    const m = m0, u = clamp(h / 1280, 0.78, 1);
    const topH = Math.round(14 + 84 * m) + host.t;
    const bs = Math.min(m, 1.3);
    const ctrlTop = Math.round(B - 408 * u);
    const a1 = { cx: w - host.r - 134 * u, cy: B - 218 * u + (bs - 1) * 20 * u, r: 82 * bs * u };
    const a2r = 64 * bs * u, sr = 52 * bs * u;
    const a2 = { cx: Math.min(w - host.r - 290 * u, a1.cx - a1.r - a2r - 12), cy: B - 112 * u, r: a2r };       // grows with the text size without touching its neighbours
    const spr = { cx: w - host.r - 80 * u, cy: Math.min(B - 350 * u + (bs - 1) * 8 * u, a1.cy - a1.r - sr - 10), r: sr };
    const small = Math.min(100, Math.max(Math.round(64 + 16 * (m - 1)), Math.ceil(44 / Math.max(0.3, host.px || 0.6)))), tw = 196 + 20 * (m - 1);
    const yb = Math.max(topH + 10, host.back ? host.t + host.back + Math.ceil(10 / Math.max(0.3, host.px || 0.6)) : 0);
    const think = R(host.l + 16, yb, tw, small), pause = R(w - 16 - host.r - tw, yb, tw, small);
    const stickR = Math.round(w - 348 * u - host.r);
    const stick = { x: host.l, y: ctrlTop, w: stickR - host.l, h: h - ctrlTop, cx: host.l + 150 * u, cy: B - 180 * u, r: 96 * u };
    const mw = Math.round(420 * u), meter = R(Math.round((w - mw) / 2), Math.round(ctrlTop + 6 * u), mw, Math.round(54 * u));
    const colw = Math.min(240, Math.floor(w / 2 - 90 - (host.l + 16 + backOff)));
    const board = { left: R(host.l + 16 + backOff, 14 + host.t, colw, topH - 40 - host.t + 14), right: R(w - host.r - 16 - colw, 14 + host.t, colw, topH - 40 - host.t + 14), clock: R(Math.round(w / 2 - 90), host.t + 4, 180, topH - 4 - host.t) };
    const mh = Math.round(MM_PORTRAIT_W * HL_HW), minimap = R(Math.round(w / 2 - MM_PORTRAIT_W / 2), topH + 6, MM_PORTRAIT_W, mh);
    const bannerY = Math.max(yb + small + 26, topH + 6 + mh + 14);
    const rph = Math.max(150, Math.min(300, ctrlTop - 14 - (bannerY + 20))), rpw = Math.round(rph * 460 / 300);
    const replay = R(w - rpw - 16 - host.r, ctrlTop - rph - 14, rpw, rph);
    return { idx: i, m, u, bs, wide, topH, ctrlTop, a1, a2, spr, think, pause, stick, meter, board, minimap, bannerY, banner: { x: 50, w: w - 100 }, prompt: { x: 30, w: w - 60 }, replay, ks: u, sm: m };
  }
  // wide
  const m = Math.min(m0, 1.3), sm = 0.78 * m, ks = Math.min(1.15, 0.9 + 0.1 * (m - 1) * 3);
  const topH = Math.max(Math.round(14 + 84 * sm), 92) + host.t;
  const L0 = host.l + 14, R0 = w - host.r - 18, B0 = B - 18;
  const tapH = Math.max(64, Math.ceil(44 / Math.max(0.3, host.px || 0.6)));
  const uh = Math.max(Math.round(64 + 16 * (m - 1)), tapH), uw = Math.round(150 * Math.min(m, 1.25)), gap = 10;
  const yb = Math.max(topH + 8, host.back ? host.t + host.back + Math.ceil(10 / Math.max(0.3, host.px || 0.6)) : 0);
  const think = R(L0, yb, uw, uh), pause = R(L0, yb + uh + gap, uw, uh);
  const r1 = Math.round(80 * ks), r2 = Math.round(60 * ks), r3 = Math.round(50 * ks);
  const a1 = { cx: R0 - r1, cy: B0 - r1, r: r1 };
  const a2 = { cx: a1.cx - r1 - 14 - r2, cy: B0 - r2, r: r2 };
  const spr = { cx: R0 - r3, cy: a1.cy - r1 - 14 - r3, r: r3 };
  const sy = pause.y + uh + gap, sw = Math.round(Math.max(w * 0.34, 300));
  const stick = { x: host.l, y: sy, w: Math.min(sw, a2.cx - a2.r - 16 - host.l), h: h - sy, cx: L0 + Math.round(124 * ks), cy: B0 - Math.round(110 * ks), r: 96 * ks };
  const mmW = MM_WIDE_W, mmH = Math.round(mmW / HL_HW), clockW = 170, groupW = clockW + 12 + mmW, gx = Math.round(w / 2 - groupW / 2);
  const lx = host.l + 14 + backOff;
  const lw = Math.max(80, Math.min(200, gx - 16 - lx)), rw = Math.max(80, Math.min(200, w - host.r - 14 - (gx + groupW + 16)));
  const board = { left: R(lx, host.t + 8, lw, topH - host.t - 8), right: R(w - host.r - 14 - rw, host.t + 8, rw, topH - host.t - 8), clock: R(gx, host.t + 4, clockW, topH - host.t - 4) };
  const minimap = R(gx + clockW + 12, host.t + Math.round((topH - host.t - mmH) / 2), mmW, mmH);
  const mw = Math.min(420, Math.round(w * 0.42)), meter = R(Math.round((w - mw) / 2), topH + 8, mw, 54);
  const bw = Math.min(560, Math.round(w * 0.46));
  const rpw = Math.min(340, Math.round(w * 0.3)), rph = Math.round(rpw * 300 / 460);
  const replay = R(w - host.r - 14 - rpw, topH + 30, rpw, rph);
  return { idx: i, m, u: 1, bs: ks, wide, topH, ctrlTop: sy, a1, a2, spr, think, pause, stick, meter, board, minimap, bannerY: topH + 8, banner: { x: Math.round((w - bw) / 2), w: bw }, prompt: { x: Math.round((w - bw) / 2), w: bw }, replay, ks, sm };
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
    const big = m >= 1.5, bh = Math.round(66 + 14 * (m - 1)), tw = R0 - L0, rows = big ? 2 : 1, total = rows * bh + (rows - 1) * gap, y1 = B0 - total;
    const rects = big ? [R(L0, y1, (tw - gap) / 2, bh), R(L0 + (tw + gap) / 2, y1, (tw - gap) / 2, bh), R(L0, y1 + bh + gap, (tw - gap) / 2, bh), R(L0 + (tw + gap) / 2, y1 + bh + gap, (tw - gap) / 2, bh)]
      : [0, 1, 2, 3].map((k) => { const cw = (tw - 3 * gap) / 4; return R(L0 + k * (cw + gap), y1, cw, bh); });
    c = { lay, m, big, rects, panel: { x: L0 + 6, w: tw - 12, bottom: y1 - 12 } };
  } else {
    const bh = Math.max(Math.round(66 + 14 * (m - 1)), Math.ceil(44 / Math.max(0.3, host.px || 0.6))), bw = 170, x0 = R0 - 2 * bw - gap, y1 = B0 - bh * 2 - gap;
    c = { lay, m, big: true, rects: [R(x0, y1, bw, bh), R(x0 + bw + gap, y1, bw, bh), R(x0, y1 + bh + gap, bw, bh), R(x0 + bw + gap, y1 + bh + gap, bw, bh)], panel: { x: L0, w: Math.min(540, x0 - L0 - 20), bottom: B0 } };
  }
  watchCache.set(key, c);
  if (watchCache.size > 60) watchCache.delete(watchCache.keys().next().value);
  return c;
}

// The play band the 3D pitch must fit into (virtual units, text-size independent so the picture never jumps when the text size changes).
export function pitchBand(w = W, h = H) {
  const wide = isWide(w, h);
  if (wide) return { wide, top: 92 + host.t + 6, bottom: h - host.b - 8, left: host.l + 10, right: w - host.r - 10 };
  const u = clamp(h / 1280, 0.78, 1), B = h - host.b, ctrlTop = B - 408 * u;
  const bandB = ctrlTop - 98 * u, bandT = host.t + 98 + 6 + Math.round(MM_PORTRAIT_W * HL_HW) + 60;
  return { wide, top: bandT, bottom: bandB, left: 0, right: w, ctrlTop };
}
