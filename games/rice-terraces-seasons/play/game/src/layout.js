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
export const PLAY_M = [1, 1.3, 1.6, 1.9, 2.2];

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

// In-play layout (all in SW x H units). Portrait: a top bar (pause, season banner, speed), a row of status pills, the hillside, a plot sheet and the Think bar at the
// bottom. Landscape: the same pieces, with the pills, the plot sheet and Think stacked in a panel on the right and the hillside filling the rest.
const cache = new Map();
export function hudLayout(idx) {
  const key = `${SW}x${H}|${idx}|${Math.round(host.px * 100)}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}`;
  let L = cache.get(key);
  if (!L) { L = buildHud(idx); L.key = key; cache.set(key, L); if (cache.size > 60) cache.delete(cache.keys().next().value); }
  return L;
}
function buildHud(idx) {
  const land = SW > H;
  const i = Math.max(0, Math.min(PLAY_M.length - 1, idx | 0)), m0 = PLAY_M[i], mm = Math.min(m0, 1.9);
  const T = host.t, bc = backClear();
  const minTap = Math.min(96, Math.ceil(46 / Math.max(0.3, host.px)));
  const pad = 12;
  const x0 = Math.max(host.l + pad, bc ? bc + 6 : 0);
  const panelW = land ? Math.round(Math.min(Math.max(SW * 0.3, 330), 440) * Math.min(1.25, 1 + 0.12 * (m0 - 1))) : 0;
  const right = SW - host.r - pad - (land ? panelW + pad : 0);
  const barH = Math.max(Math.round((land ? 70 : 82) * mm), minTap);
  const bar = { x: x0, y: T + 8, w: right - x0, h: barH };
  const pauseB = { x: bar.x, y: bar.y, w: barH, h: barH };
  const speedB = { x: bar.x + bar.w - Math.round(barH * 1.55), y: bar.y, w: Math.round(barH * 1.55), h: barH };
  const banner = { x: pauseB.x + pauseB.w + 10, y: bar.y, w: speedB.x - 10 - (pauseB.x + pauseB.w + 10), h: barH };
  const pillH = Math.max(Math.round(50 * mm), minTap - 6);
  let pills, sheet, thinkB, mapRect;
  if (!land) {
    const py = bar.y + bar.h + 8, pw = (SW - host.l - host.r - pad * 2 - 3 * 8) / 4, px0 = host.l + pad;
    pills = [0, 1, 2, 3].map((k) => ({ x: px0 + k * (pw + 8), y: py, w: pw, h: pillH }));
    const thinkH = Math.max(Math.round(72 * mm), minTap);
    thinkB = { x: host.l + pad, y: H - host.b - thinkH - 8, w: SW - host.l - host.r - pad * 2, h: thinkH };
    const shH = Math.round(Math.min(H * 0.3, 262 * (1 + 0.45 * (m0 - 1))));
    sheet = { x: host.l + pad, y: thinkB.y - 8 - shH, w: thinkB.w, h: shH };
    mapRect = { x: 6, y: py + pillH + 6, w: SW - 12, h: sheet.y - 6 - (py + pillH + 6) };
  } else {
    const px = SW - host.r - pad - panelW;
    const pw = (panelW - 8) / 2;
    const py = T + 8;
    pills = [0, 1, 2, 3].map((k) => ({ x: px + (k % 2) * (pw + 8), y: py + Math.floor(k / 2) * (pillH + 8), w: pw, h: pillH }));
    const thinkH = Math.max(Math.round(66 * mm), minTap);
    thinkB = { x: px, y: H - host.b - thinkH - 8, w: panelW, h: thinkH };
    const sy = py + 2 * (pillH + 8);
    sheet = { x: px, y: sy, w: panelW, h: thinkB.y - 8 - sy };
    mapRect = { x: host.l + 6, y: bar.y + bar.h + 6, w: right - host.l - 6, h: H - host.b - 8 - (bar.y + bar.h + 6) };
  }
  return { idx: i, m0, mm, land, T, bar, pauseB, speedB, banner, pills, sheet, thinkB, mapRect, minTap, panelW };
}
