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
  else if (kind === 'title') { W = Math.min(560, Math.max(440, usable * 0.42)); OX = SW - host.r - W - Math.max(16, usable * 0.04); }
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

// In-play layout (all in SW x H units). Portrait: scoreboard row on top, Pause and Think under it, stick bottom-left, four round buttons bottom-right.
// Landscape: a compact scoreboard strip in the middle of the top, Pause and Think under it at the corners, smaller round buttons in the lower corners.
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
  const m = land ? Math.min(m0, 1.3) : m0;               // landscape is short: the scoreboard grows less
  const big = !land && m > 1.3;
  const T = host.t, bc = backClear();
  const kf = land ? 0.88 : 1;                              // landscape: slightly smaller round buttons
  const s = (1 + 0.4 * (m0 - 1) / 0.8) * kf;               // button size factor
  const topH = Math.round(118 * m) + (big ? Math.round(52 * m) : 0);
  const mu = Math.min(m0, 1.6);
  const minTap = Math.min(90, Math.ceil(44 / Math.max(0.3, host.px)));
  const uh = Math.max(Math.round(62 * mu), minTap), uw = Math.round(150 * mu);
  const R1 = Math.round(84 * s), R2 = Math.round(60 * s), D = R1 + R2 + 12;
  const sx = SW - 14 - host.r - R1, sy = H - 14 - host.b - R1;
  const strike = { x: sx, y: sy, r: R1 };
  const pass = { x: sx - D, y: sy, r: R2 };
  const rise = { x: sx - D * 0.707, y: sy - D * 0.707, r: R2 };
  const hook = { x: sx, y: sy - D, r: R2 };
  const sr = Math.round(96 * s);
  const stick = { x: host.l + 130 + Math.round(20 * s), y: H - 150 - Math.round(20 * s) - host.b, r: sr, zone: { x: 0, y: land ? Math.round(H * 0.3) : H - 720, w: land ? Math.round(SW * 0.42) : 420, h: 0 } };
  if (land) { stick.x = host.l + 40 + sr; stick.y = H - host.b - 30 - sr; }
  stick.zone.h = H - stick.zone.y;
  // Pause / Think under the top strip; Pause is also kept below the host back button zone
  const py = T + topH + 8;
  const pause = { x: host.l + 14, y: py, w: uw, h: uh };
  const think = { x: SW - 14 - host.r - uw, y: py, w: uw, h: uh };
  if (host.back && py < T + host.back + 14) pause.y = T + host.back + 14;
  // scoreboard bounds
  let colw = big ? 320 : 250, lx0, rx1;
  const cx = SW / 2;
  if (!land) { lx0 = Math.max(16 + host.l, bc ? bc + 4 : 0); rx1 = SW - 16 - host.r; colw = Math.min(colw, Math.max(160, Math.floor(SW / 2 - 12 - lx0 - (big ? 0 : 60)))); }
  else { const tw = Math.min(700, SW - 2 * (Math.max(host.l, host.r) + 16)); colw = Math.floor(Math.min(colw, (tw - 150) / 2)); lx0 = cx - tw / 2; rx1 = cx + tw / 2; }
  return { idx: i, m, m0, s, topH, mu, strike, pass, rise, hook, stick, util: { pause, think }, tiles: { y: py + uh + 22 }, land, big, T, score: { colw, lx0, rx1, cx } };
}
