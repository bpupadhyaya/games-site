// Screen geometry as a function of the LIVE screen size (kit 1.7 fluid viewport: the short side is always 720 units, the long side grows).
// `setScreen(w, h)` is called by game.js at the top of every update and render; the exported W / H / SW / OX are live bindings.
//   SW x H   the whole screen in virtual units (HUD and the 3D picture use this)
//   W, OX    the width and left offset of the CURRENT menu column (menus and readers are drawn in a column centred on the screen, so W = 720
//            on every portrait screen and 440-900 in landscape). `column(kind)` switches between 'screen', 'menu', 'title' and 'reader'.
export let SW = 720, H = 1280, W = 720, OX = 0, LAND = false;
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export const inCircle = (c, x, y) => !!c && Math.hypot(x - c.x, y - c.y) <= c.r;

// Safe areas and the host's floating back button, in virtual units. main.js keeps this current (browsers: all zero).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };      // px: css pixels per virtual unit

export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const THINK_STEPS = [2, 5, 8, 10];
// Reader chrome and the pinned setup bar are live objects (updated by column()), so the many importers always see the current rectangles.
export const REF_CLOSE = { x: 20, y: 1164, w: 680, h: 100 };
export const TEXT_DEC = { x: 20, y: 12, w: 120, h: 72 };
export const TEXT_INC = { x: 580, y: 12, w: 120, h: 72 };
export const SETUP_PINS = { start: { x: 30, y: 1156, w: 440, h: 96 }, back: { x: 486, y: 1156, w: 204, h: 96 } };
export const PANEL = { x: 8, y: 96, w: 704, h: 1050 };
export const MENU = { top: 0, bottom: 1280, pinBottom: 1130 };           // vertical extents of the current column (inset-aware)

// The in-play HUD follows the text-size setting (100-300%) through a gentler multiplier so the pitch stays visible.
export const PLAY_M = [1, 1.2, 1.4, 1.6, 1.8];

// 11 CSS pixels in virtual units: the smallest text the game ever draws
export const minU = () => Math.ceil(11 / Math.max(0.2, host.px));
const backClear = () => (host.back ? host.l + host.back + 8 : 0);

export function setScreen(w, h) {
  SW = Math.round(w) || 720; H = Math.round(h) || 1280; LAND = SW > H;
}

let KIND = '';
export const currentKind = () => KIND;
// Which column the following menu code lays out in. Returns the x offset the caller translates the canvas by.
export function column(kind) {
  KIND = kind;
  const land = LAND, usable = SW - host.l - host.r;
  if (kind === 'screen' || !land) { W = SW; OX = 0; }
  else if (kind === 'reader') { W = Math.min(usable - 24, 900); OX = host.l + (usable - W) / 2; }
  else if (kind === 'title') { W = Math.min(560, Math.max(500, usable * 0.42)); OX = SW - host.r - W - Math.max(16, usable * 0.04); }
  else { W = Math.min(usable - 24, 780); OX = host.l + (usable - W) / 2; }
  MENU.top = host.t; MENU.bottom = H - host.b; MENU.pinBottom = H - host.b - 150;
  const ps = Math.round((W - 60) * 0.68);
  SETUP_PINS.start = { x: 30, y: H - host.b - 124, w: ps, h: 96 };
  SETUP_PINS.back = { x: 30 + ps + 16, y: H - host.b - 124, w: W - 60 - ps - 16, h: 96 };
  const bc = backClear();
  if (!land || kind === 'screen') {
    // portrait reader: A- / % / A+ on the top row (clear of the host back button), Close along the bottom
    TEXT_DEC.x = Math.max(20, bc + 6); TEXT_DEC.y = host.t + 10; TEXT_DEC.w = 120; TEXT_DEC.h = 76;
    TEXT_INC.x = W - 20 - 120; TEXT_INC.y = host.t + 10; TEXT_INC.w = 120; TEXT_INC.h = 76;
    REF_CLOSE.x = 20; REF_CLOSE.w = W - 40; REF_CLOSE.h = 96; REF_CLOSE.y = H - host.b - 112;
    PANEL.x = 8; PANEL.w = W - 16; PANEL.y = host.t + 100; PANEL.h = REF_CLOSE.y - 14 - PANEL.y;
  } else {
    // landscape reader: A- / % / A+ on the left of the top bar, Close on the right; the panel takes the rest of the height
    TEXT_DEC.x = Math.max(8, bc - OX + 6); TEXT_DEC.y = host.t + 8; TEXT_DEC.w = 110; TEXT_DEC.h = 72;
    TEXT_INC.x = TEXT_DEC.x + 110 + 100; TEXT_INC.y = host.t + 8; TEXT_INC.w = 110; TEXT_INC.h = 72;
    REF_CLOSE.w = 220; REF_CLOSE.h = 72; REF_CLOSE.x = W - 8 - 220; REF_CLOSE.y = host.t + 8;
    PANEL.x = 8; PANEL.w = W - 16; PANEL.y = host.t + 90; PANEL.h = H - host.b - 10 - PANEL.y;
  }
  return OX;
}

// In-play layout (all in SW x H units). A strip on top (round, setting, pull score, clock), the tug bar under it (where the flag is between the two win lines),
// Pause / Think in the corners, and at the bottom the beat ring with the stamina and sync bars and the two calls (ANCHOR, COACH).
// Two-player split screen lays one `halfLayout` into each player's half; a single player uses one covering the whole screen.
const cache = new Map();
export function hudLayout(idx, versus = false) {
  const key = `${SW}x${H}|${idx}|${versus ? 1 : 0}|${Math.round(host.px * 100)}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}`;
  let L = cache.get(key);
  if (!L) { L = buildHud(idx, versus); L.key = key; cache.set(key, L); if (cache.size > 60) cache.delete(cache.keys().next().value); }
  return L;
}
export function halfLayout(r, M, o = {}) {
  const wide = r.w > r.h * 1.5 && r.w > 900;
  const m = Math.min(M, 1.4);
  const minTap = Math.min(96, Math.ceil(44 / Math.max(0.3, host.px)));
  const bw = Math.round((wide ? 190 : 166) * m), bh = Math.max(Math.round(104 * m), minTap);
  const rr = Math.round((wide ? 64 : 78) * (1 + 0.08 * (M - 1)));
  const bottom = r.y + r.h - (o.bottomInset || 0) - 18;
  const ring = { x: r.x + r.w / 2, y: bottom - rr - 6, r: rr };
  const bh2 = Math.round(26 * Math.min(M, 1.3));
  let anchor, coach, stam, sync;
  if (wide) {
    anchor = { x: r.x + 22, y: bottom - bh, w: bw, h: bh };
    coach = { x: r.x + r.w - 22 - bw, y: bottom - bh, w: bw, h: bh };
    const sw = Math.min(380, (ring.x - rr - 40) - (anchor.x + bw + 24));
    stam = { x: ring.x - rr - 24 - sw, y: ring.y - bh2 - 6, w: sw, h: bh2 };
    sync = { x: stam.x, y: ring.y + 10, w: sw, h: bh2 };
  } else {
    anchor = { x: r.x + 16, y: ring.y - bh / 2, w: Math.min(bw, ring.x - rr - r.x - 28), h: bh };
    coach = { x: r.x + r.w - 16 - Math.min(bw, ring.x - rr - r.x - 28), y: ring.y - bh / 2, w: Math.min(bw, ring.x - rr - r.x - 28), h: bh };
    stam = { x: r.x + 28, y: ring.y - rr - 28 - bh2 * 2 - 20, w: r.w - 56, h: bh2 };
    sync = { x: r.x + 28, y: stam.y + bh2 + 20, w: r.w - 56, h: bh2 };
  }
  const topH = Math.round((o.compact ? 52 : wide ? 66 : 84) * Math.min(M, 1.5));
  const x0 = Math.max(r.x + 14, o.backClear || 0);
  const top = { x: x0, y: r.y + (o.topInset || 0) + 8, w: r.x + r.w - 14 - x0, h: topH };
  const barW = wide ? Math.min(820, r.w * 0.5) : r.w - 40 - (o.sideInset || 0);
  const bar = { x: r.x + (r.w - barW) / 2, y: top.y + topH + 12, w: barW, h: Math.round((o.compact ? 24 : 30) * Math.min(M, 1.3)) };
  return { r, wide, ring, anchor, coach, stam, sync, bh2, top, bar, mid: { x: r.x + r.w / 2, y: r.y + r.h * 0.4 } };
}
function buildHud(idx, versus) {
  const land = SW > H;
  const i = Math.max(0, Math.min(PLAY_M.length - 1, idx | 0)), m0 = PLAY_M[i];
  const T = host.t, bc = backClear();
  const minTap = Math.min(90, Math.ceil(44 / Math.max(0.3, host.px)));
  const uh = Math.max(Math.round(58 * Math.min(m0, 1.5)), minTap), uw = Math.round(138 * Math.min(m0, 1.5));
  let halves, pause, think = null;
  const bottomInset = host.b;
  if (versus) {
    if (land) halves = [halfLayout({ x: host.l, y: 0, w: SW / 2 - host.l, h: H }, m0, { bottomInset, topInset: T, compact: true, backClear: bc }), halfLayout({ x: SW / 2, y: 0, w: SW / 2 - host.r, h: H }, m0, { bottomInset, topInset: T, compact: true })];
    else halves = [halfLayout({ x: 0, y: H / 2, w: SW, h: H / 2 }, m0, { bottomInset, compact: true, topInset: 18 }), halfLayout({ x: 0, y: 0, w: SW, h: H / 2 }, m0, { bottomInset: T, compact: true, topInset: 18 })];
    pause = land ? { x: SW / 2 - uw / 2, y: halves[0].bar.y + halves[0].bar.h + 10, w: uw, h: uh } : { x: SW / 2 - uw / 2, y: H / 2 - uh / 2, w: uw, h: uh };
  } else {
    halves = [halfLayout({ x: host.l, y: 0, w: SW - host.l - host.r, h: H }, m0, { bottomInset, topInset: T, backClear: bc }), null];
    const h0 = halves[0];
    const py = land ? (h0.wide ? h0.top.y + h0.top.h + 8 : h0.bar.y + h0.bar.h + 10) : h0.bar.y + h0.bar.h + 12;
    pause = { x: h0.top.x, y: py, w: uw, h: uh };
    think = { x: SW - host.r - 14 - uw, y: py, w: uw, h: uh };
    if (host.back && pause.y < T + host.back + 10) pause.y = T + host.back + 10;
  }
  return { idx: i, m0, land, T, pause, think, uh, uw, halves, versus, top: halves[0].top, bar: halves[0].bar };
}
