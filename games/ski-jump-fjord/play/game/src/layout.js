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
  else if (kind === 'title') { W = Math.min(600, Math.max(500, usable * 0.46)); OX = SW - host.r - W - Math.max(16, usable * 0.04); }
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

// In-play layout (all in SW x H units). A scoreboard strip on top with Pause / Think under it; the take-off / landing ring sits bottom centre, the angle
// gauge runs up the right edge, the lean gauge runs along the bottom. Landscape keeps the same pieces, the gauges move to the sides.
const cache = new Map();
export function hudLayout(idx) {
  const key = `${SW}x${H}|${idx}|${Math.round(host.px * 100)}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}`;
  let L = cache.get(key);
  if (!L) { L = buildHud(idx); L.key = key; cache.set(key, L); if (cache.size > 60) cache.delete(cache.keys().next().value); }
  return L;
}
function buildHud(idx) {
  const land = SW > H;
  const i = Math.max(0, Math.min(PLAY_M.length - 1, idx | 0)), m0 = PLAY_M[i];
  const T = host.t, bc = backClear();
  const minTap = Math.min(90, Math.ceil(44 / Math.max(0.3, host.px)));
  const uh = Math.max(Math.round(58 * Math.min(m0, 1.5)), minTap), uw = Math.round(138 * Math.min(m0, 1.5));
  const topH = Math.round((land ? 74 : 92) * Math.min(m0, 1.5));
  const top = { x: Math.max(host.l + 14, bc ? bc + 6 : 0), y: T + 8, w: SW - host.r - 14 - Math.max(host.l + 14, bc ? bc + 6 : 0), h: topH };
  const py = top.y + topH + 8;
  const pause = { x: top.x, y: py, w: uw, h: uh };
  const think = { x: SW - host.r - 14 - uw, y: py, w: uw, h: uh };
  if (host.back && pause.y < T + host.back + 10) pause.y = T + host.back + 10;
  const rr = Math.round((land ? 62 : 74) * (1 + 0.08 * (m0 - 1)));
  const lean = { x: SW / 2 - Math.min(230, (SW - host.l - host.r) * 0.3), y: H - host.b - 54, w: Math.min(460, (SW - host.l - host.r) * 0.6), h: 22 };
  const ring = { x: SW / 2, y: lean.y - 74 - rr, r: rr };
  const gh = Math.min(land ? H * 0.46 : H * 0.34, 440);
  const ang = { x: SW - host.r - 62, y: Math.max(think.y + think.h + 70, H * 0.5 - gh / 2), w: 26, h: gh };
  const info = { x: top.x, y: pause.y + pause.h + 12, w: Math.min(300, SW * 0.4), h: 120 };
  return { idx: i, m0, land, T, top, pause, think, lean, ring, ang, info, uh, uw, mid: { x: SW / 2, y: land ? H * 0.3 : Math.max(H * 0.22, info.y + info.h + 50) } };
}
