// Screen geometry: one place for every rectangle so game.js (hit-testing) and view.js (drawing) never disagree.
// FLUID (kit 1.7): the SHORT side of the screen is always 720 units and the long side grows with the aspect ratio, so the
// live size is W x H = 720 x (960..1728) in portrait and (960..1728) x 720 in landscape. `meta` is the object the kit
// updates on every resize; `syncSize()` copies it into the live bindings W and H (the game calls it every frame).
// Everything below is a pure function of (W, H, safe insets, host back button, text zoom), cached by that key.
export const meta = { width: 720, height: 1280, fluid: { short: 720 } };
export let W = 720;
export let H = 1280;
export function syncSize() { W = meta.width; H = meta.height; }

// Safe areas and the host's floating back button, in virtual units (main.js keeps this current; browsers: all zero).
// px = CSS pixels per virtual unit (0 = unknown). Text and tap targets are sized from it.
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0 };

export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const R = (x, y, w, h) => ({ x, y, w, h });
// A tap target about 44 CSS px tall where the screen allows (never smaller than `base`, never more than 20 units taller).
const tap = (base) => (host.px > 0 ? clamp(Math.round(44 / host.px), base, base + 20) : base);
// Smallest font (virtual units) that is still about 11 CSS px.
const minFs = () => (host.px > 0 ? Math.ceil(11 / host.px) : 0);

export const PULL = { min: 24, max: 250 };
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const THINK_STEPS = [2, 5, 8, 10];
export const BOARD_EXTENT = 724;   // 2 x (arena radius + lip + pebbles), see art.js

// ---- the play screen -----------------------------------------------------------------------------------------------
// Portrait: two score cards on top (stacked rows when the text is zoomed past 150%), an info line, the arena, and a control strip.
// Landscape: the arena at the largest size the height allows, one panel beside it (cards, info line, controls).
// The play HUD follows the text zoom up to 150% (the menus and pages follow it fully): the arena has to stay big enough to shoot at.
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
const fontSet = (zc, mf, land) => {
  const f = (b) => Math.round(Math.max(b, mf) * zc);
  return land ? { name: f(24), sub: f(17), score: f(46), info: f(21), btn: f(24), demoBtn: f(22), bTitle: f(24), bScore: f(46), bTap: f(19) }
    : { name: f(24), sub: f(17), score: f(46), info: f(21), btn: f(26), demoBtn: f(22), bTitle: f(26), bScore: f(50), bTap: f(20) };
};

function portrait(z, watch) {
  const zc = Math.min(z, 1.5), mf = minFs(), F = fontSet(zc, mf, false);
  const M = Math.max(18, host.l, host.r), GW = W - 2 * M, g = 10;
  const T = host.back ? Math.max(0, host.back + 6 - 40) : 0;
  const bb = Math.max(0, host.b - 8), top = host.t + 54 + T;
  const stacked = z > 1.51;
  const cardH = stacked ? Math.round(F.score * 1.1 + 22) : Math.round(Math.max(104 * zc, F.name * 1.2 + F.sub * 1.3 + 56));
  const cards = stacked ? [R(M, top, GW, cardH), R(M, top + cardH + 8, GW, cardH)] : [R(M, top, (GW - g) / 2, cardH), R(M + (GW + g) / 2, top, (GW - g) / 2, cardH)];
  const cardsEnd = stacked ? top + 2 * cardH + 8 : top + cardH;
  const infoH = Math.max(Math.round(F.info * 1.25) + 12, Math.round(F.info * 2 * 1.2) + 16);
  const info = R(M, cardsEnd + 8, GW, infoH);
  const btnH = tap(Math.round(F.btn * 1.1 + 28)), dBtnH = tap(Math.round(F.demoBtn * 1.1 + 26));
  let hint = null, menu = null, demo = null, barH;
  if (watch) barH = z <= 2.01 ? dBtnH * 2 + g : dBtnH * 3 + g * 2;
  else barH = btnH;
  const barY = H - 12 - bb - barH;
  if (watch) {
    if (z <= 2.01) {
      const wide = Math.round((GW - 2 * g) * 0.27), mid = GW - 2 * wide - 2 * g;
      demo = { dec: R(M, barY, wide, dBtnH), pause: R(M + wide + g, barY, mid, dBtnH), inc: R(M + wide + g + mid + g, barY, wide, dBtnH), exit: R(M, barY + dBtnH + g, GW, dBtnH) };
    } else {
      const half = (GW - g) / 2;
      demo = { pause: R(M, barY, GW, dBtnH), dec: R(M, barY + dBtnH + g, half, dBtnH), inc: R(M + half + g, barY + dBtnH + g, half, dBtnH), exit: R(M, barY + 2 * (dBtnH + g), GW, dBtnH) };
    }
  } else { const half = (GW - g) / 2; hint = R(M, barY, half, btnH); menu = R(M + half + g, barY, half, btnH); }
  const y1 = info.y + info.h + 6, y2 = barY - 8;
  const s = clamp(Math.min((y2 - y1) / BOARD_EXTENT, (W - 12) / BOARD_EXTENT), 0.3, 1.14);
  const bannerH = Math.round(F.bTitle * 1.2 + F.bScore * 1.15 + F.bTap * 1.3 + 56);
  const bannerW = Math.min(GW, 620);
  return {
    z, land: false, rows: stacked, cards, info, board: { cx: W / 2, cy: (y1 + y2) / 2, s }, zone: R(0, y1 - 8, W, y2 - y1 + 16),
    hint, menu, demo, bar: R(M, barY, GW, barH), fs: F, banner: R(W / 2 - bannerW / 2, clamp((y1 + y2) / 2 - bannerH / 2, y1, y2 - bannerH), bannerW, bannerH), pass: R(M, barY, GW, barH),
  };
}

function landscape(z, watch, ze = z) {
  const L0 = landscape1(z, watch, ze);
  if (L0.overflow && ze > 1.01) return landscape(z, watch, Math.max(1, ze - 0.25));
  return L0;
}
function landscape1(z0, watch, z) {
  const g = 12, zc = Math.min(z, 1.5), mf = minFs(), F = fontSet(zc, mf, true);
  const U = { x0: host.l, x1: W - host.r, y0: host.t, y1: H - host.b };
  U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  const backBox = host.back ? R(host.l, host.t, host.back + 8, host.back + 8) : null;
  const rowH = Math.round(Math.max(F.score * 1.05, F.name * 1.2 + F.sub * 1.2) + 22);
  const infoH = Math.max(Math.round(F.info * 1.25) + 12, Math.round(F.info * 2 * 1.2) + 16);
  const btnH = tap(Math.round(F.btn * 1.1 + 26)), dBtnH = tap(Math.round(F.demoBtn * 1.1 + 24));
  const ctrlH = watch ? 3 * dBtnH + 2 * g : btnH;
  const bannerH = Math.round(F.bTitle * 1.2 + F.bScore * 1.15 + F.bTap * 1.3 + 56);
  const topPad = 34;   // the kit's preview pill sits at the top centre
  const sMax = Math.min(1.14, (U.h - 12 - topPad) / BOARD_EXTENT);
  const pw = clamp(Math.round(U.w * 0.3), 300, 440 + Math.round(80 * (zc - 1)));
  const s = Math.max(0.3, Math.min(sMax, (U.w - pw - 3 * g) / BOARD_EXTENT)), bs = BOARD_EXTENT * s;
  const group = bs + g + pw, gx = U.x0 + Math.max(g, (U.w - group) / 2);
  const bx = gx, px = gx + bs + g, cx = bx + bs / 2, cy = U.y0 + topPad + (U.h - topPad) / 2;
  let yTop = U.y0 + g;
  if (backBox && px < backBox.x + backBox.w) yTop = Math.max(yTop, backBox.y + backBox.h + g / 2);
  const cards = [R(px, yTop, pw, rowH), R(px, yTop + rowH + 8, pw, rowH)];
  const info = R(px, yTop + 2 * rowH + 8 + g, pw, infoH);
  const ctrlY = U.y1 - g - ctrlH;
  let hint = null, menu = null, demo = null;
  if (watch) { const half = (pw - g) / 2; demo = { pause: R(px, ctrlY, pw, dBtnH), dec: R(px, ctrlY + dBtnH + g, half, dBtnH), inc: R(px + half + g, ctrlY + dBtnH + g, half, dBtnH), exit: R(px, ctrlY + 2 * (dBtnH + g), pw, dBtnH) }; }
  else { const half = (pw - g) / 2; hint = R(px, ctrlY, half, btnH); menu = R(px + half + g, ctrlY, half, btnH); }
  const tallyY = info.y + info.h + g, tally = ctrlY - g - tallyY >= 130 ? R(px, tallyY, pw, ctrlY - g - tallyY) : null;
  const overflow = info.y + info.h + g > ctrlY;
  const bw = Math.min(bs - 20, 520), banner = R(cx - bw / 2, cy - bannerH / 2, bw, bannerH);
  return {
    z, overflow, land: true, rows: false, cards, info, board: { cx, cy, s }, zone: R(bx - g, 0, bs + 2 * g, H), hint, menu, demo, bar: R(px, ctrlY, pw, ctrlH),
    fs: F, banner, tally, pass: R(px, ctrlY, pw, ctrlH), backBox, panels: [R(px, U.y0, pw, U.h)],
  };
}

// ---- reference pages (About / How to play / Rules) --------------------------------------------------------------------
// The page panel and its buttons. Portrait: text size controls at the top right (the top left stays free for the host back
// button), Back / Next along the bottom. Landscape: one bottom row Back | A- 100% A+ | Next and a wide panel above it.
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

// Setup screen pins (Start / Back) for the portrait list; landscape lays them out itself (menus.js).
export function setupPins() {
  const bb = Math.max(0, host.b - 10), h = tap(96);
  return { start: R(30, H - 124 - bb + (96 - h), 440, h), back: R(486, H - 124 - bb + (96 - h), 204, h) };
}
