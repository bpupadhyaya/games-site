import { LANE_NAMES } from './consts.js';
// Screen geometry as a function of the LIVE screen size (kit 1.7 fluid viewport: the short side is always 720 virtual units, the long side
// follows the aspect ratio). Nothing here is cached across sizes: every rectangle comes from `live` (the current size) and `host` (safe areas and
// the host's floating back button), so game.js (hit-testing) and the drawing code never disagree and a rotation re-lays everything out.
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export const inCircle = (c, x, y, pad = 0) => Math.hypot(x - c.x, y - c.y) <= c.r + pad;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Safe areas and the host's floating back button in virtual units (main.js keeps this current; browsers: all zero). px = css pixels per unit.
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };
// The live virtual size. game.js calls syncSize(meta.width, meta.height) at the start of every update and render.
export const live = { w: 720, h: 1280, land: false };
export function syncSize(w, h) {
  if (w > 0 && h > 0 && (w !== live.w || h !== live.h)) {
    live.w = w; live.h = h; live.land = w > h;
    // lane words follow the picture: across the screen on a tall phone, far / near on a wide one
    LANE_NAMES.splice(0, 3, ...(live.land ? ['far', 'middle', 'near'] : ['left', 'middle', 'right']));
  }
  return live;
}
export const sizeKey = () => `${Math.round(live.w)}x${Math.round(live.h)}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}`;

export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const THINK_STEPS = [2, 5, 8, 10];
export const MIN_FONT = 22;            // 11 css px on a 360-wide phone, 12 on a 390-wide one (720 units across the short side)
export const fz = (n) => Math.max(MIN_FONT, Math.round(n));

// The in-play HUD follows the text-size setting (100-300%) through a gentler multiplier so the field stays visible.
export const PLAY_M = [1, 1.2, 1.4, 1.6, 1.8];

// ---- flow (menu) screens ---------------------------------------------------------------------------------------------------------------
// One centred column (640 wide on a phone). On a landscape screen the title puts the hero art on the left and the buttons on the right.
export function colFor(kind = 'one') {
  const w = live.w, h = live.h, I = host;
  const xl = I.l, xr = w - I.r;
  const avail = xr - xl;
  if (kind === 'title' && live.land && avail >= 880) {
    const split = Math.round(xl + avail * 0.46), x0 = split + 10, w0 = Math.min(600, xr - x0 - 24);
    return { x0, w0, top: I.t + 6, bottom: h - I.b - 6, split, hero: { x: xl, w: split - xl } };
  }
  const w0 = Math.min(kind === 'wide' && live.land ? 1000 : 640, avail - 60), x0 = Math.round(xl + (avail - w0) / 2);
  return { x0, w0, top: I.t + (live.land ? 6 : 0), bottom: h - I.b, split: 0, hero: null };
}
// the Setup screen keeps a pinned Start / Back bar at the bottom
export function setupPins() {
  const h = live.h, I = host, c = colFor('wide');
  const bh = 92, y = h - I.b - 14 - bh, tw = Math.min(c.w0 + 20, 700), x0 = Math.round((live.w - tw) / 2);
  const bw = Math.round(tw * 0.3);
  return { start: { x: x0, y, w: tw - bw - 14, h: bh }, back: { x: x0 + tw - bw, y, w: bw, h: bh }, bar: { y: y - 28, h: h - (y - 28) } };
}

// ---- reference reader (Rules, How to Play, About, role guide) ----------------------------------------------------------------------------
export function refLayout() {
  const w = live.w, h = live.h, I = host, land = live.land;
  const bh = 80, g = 10;
  if (land) {
    // landscape: the text panel takes the whole height; the four buttons stand in a column at its right (A-, A+, Back, Next)
    const colW = 200, total = Math.min(1040, w - I.l - I.r - 24), pw = total - colW - 14, px = Math.round((w - total) / 2);
    const clearBack = host.back && px < I.l + host.back + 16;
    const py = I.t + (clearBack ? host.back + 8 : 12), bottom = h - I.b - 12, ph = bottom - py, cx = px + pw + 14;
    const next = { x: cx, y: bottom - bh, w: colW, h: bh }, back = { x: cx, y: next.y - g - bh, w: colW, h: bh };
    const rowY = back.y - g - bh, half = (colW - g) / 2;
    const dec = { x: cx, y: rowY, w: half, h: bh }, inc = { x: cx + half + g, y: rowY, w: half, h: bh };
    const headH = 84, foot = 34;
    return { panel: { x: px, y: py, w: pw, h: ph }, headH, foot, view: { top: py + headH, bottom: py + ph - foot }, dec, inc, back, next, bar: { y: rowY, h: bottom - rowY }, land: true };
  }
  const bar = { y: h - I.b - 12 - bh, h: bh };
  const pw = Math.min(692, w - I.l - I.r - 24), px = Math.round((w - pw) / 2);
  const clearBack = host.back && px < I.l + host.back + 16;
  const py = I.t + (clearBack ? host.back + 8 : 12);
  const ph = bar.y - 12 - py;
  const headH = 96, foot = 56;
  const small = 104, bx0 = px, bx1 = px + pw;
  const dec = { x: bx0, y: bar.y, w: small, h: bh }, inc = { x: bx0 + small + g, y: bar.y, w: small, h: bh };
  const rest = bx1 - (inc.x + inc.w + g), half = (rest - g) / 2;
  const back = { x: inc.x + inc.w + g, y: bar.y, w: half, h: bh }, next = { x: back.x + half + g, y: bar.y, w: half, h: bh };
  return { panel: { x: px, y: py, w: pw, h: ph }, headH, foot, view: { top: py + headH, bottom: py + ph - foot }, dec, inc, back, next, bar };
}

// ---- in-play layout -----------------------------------------------------------------------------------------------------------------------
// The left thumb owns the PACE slider; the right thumb aims the ring (attack) or swipes / taps (defence). One set of rectangles for drawing
// and hit-testing. Everything follows the text size through PLAY_M (a gentler multiplier than the menus so the field stays visible).
// Portrait: scoreboard row across the top (Pause, scores, Think), javelins under it, slider bottom-left, LEAN bottom-right.
// Landscape: a compact scoreboard pill top centre, Pause / Think top right, slider bottom-left, LEAN bottom-right.
export function playLayout(idx) {
  const w = live.w, h = live.h, land = live.land, I = host;
  const i = clamp(idx | 0, 0, PLAY_M.length - 1), m = PLAY_M[i];
  const xl = I.l, xr = w - I.r, yt = I.t, yb = h - I.b, cx = (xl + xr) / 2;
  const small = Math.round(76 + 14 * (m - 1)), bw = Math.round(138 * Math.min(m, 1.5));
  const bk = host.back ? host.back + 12 : 0;
  const L = { idx: i, m, land, xl, xr, yt, yb, cx, small, bw, bk };
  // portrait: on 4:3 tablets the lanes sit lower on screen, so the slider is shorter and stays clear of the riders
  const trackH = land ? Math.min(330, (yb - yt) * 0.5) : Math.min(400, Math.round((yb - yt) * 0.3));
  const track = { x: xl + 54, y: yb - 40 - trackH, w: 56, h: trackH };
  const lean = { x: xr - 112, y: yb - 126, r: 82 };
  if (!land) {
    const topH = Math.round(150 + 40 * (m - 1)), top = yt + topH;
    Object.assign(L, {
      topH: top, boardH: topH,
      board: { x: xl + 14 + small + 10, y: yt + 50, w: xr - xl - 28 - 2 * (small + 10), h: topH - 58 },
      pause: { x: xl + 14, y: yt + 50, w: small, h: small }, think: { x: xr - 14 - small, y: yt + 50, w: small, h: small },
      track, trackZone: { x: xl, y: track.y - 40, w: 170, h: track.h + 80 },
      lean, leanZone: { x: xr - 230, y: yb - 250, w: 230, h: 250 },
      aimZone: { x: xl + 150, y: top + 20, w: xr - xl - 150, h: yb - top - 20 },
      javs: { x: xl + 18, y: top + 14 },
      banner: { cx, y: top + 130 },
      thinkBox: { x: xl + 20, w: xr - xl - 40 }, watchBox: { x: xl + 14, w: xr - xl - 28 },
    });
  } else {
    const k = Math.min(m, 1.4), pillW = clamp(Math.round(520 * k), 440, 760), pillH = Math.round(88 * k), top = yt + 38 + pillH;
    const tb = Math.min(420, (xr - xl) / 2 - 20), wb = Math.min(470, (xr - xl) / 2 - 14);
    Object.assign(L, {
      topH: top, boardH: pillH, board: { x: Math.round(cx - pillW / 2), y: yt + 38, w: pillW, h: pillH },
      pause: { x: xr - 14 - small, y: yt + 8, w: small, h: small }, think: { x: xr - 14 - 2 * small - 10, y: yt + 8, w: small, h: small },
      track, trackZone: { x: xl, y: track.y - 40, w: 170, h: track.h + 80 },
      lean, leanZone: { x: xr - 230, y: yb - 250, w: 230, h: 250 },
      aimZone: { x: xl + 160, y: yt + 70, w: xr - xl - 160, h: yb - yt - 70 },
      javs: { x: xl + 18 + bk, y: yt + 14 },
      banner: { cx, y: top + 70 },
      thinkBox: { x: Math.round(cx - tb), w: Math.round(tb * 2) },
      watchBox: { x: Math.round(cx - wb), w: Math.round(wb * 2) },
    });
  }
  return L;
}
