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
export function syncSize(w, h) { if (w > 0 && h > 0 && (w !== live.w || h !== live.h)) { live.w = w; live.h = h; live.land = w > h; } return live; }
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
// Portrait: Pause, the scoreboard and Think across the top, the field in the middle and three big buttons (Shield, Spur, Grab) across the
// bottom. Landscape: the scoreboard top centre of the field, Pause and Think top left, the three buttons stacked down the right. The
// buttons follow the text size through PLAY_M (gentler than the menus so the field stays visible). One set of rectangles for drawing and hit-testing.
export function playLayout(idx) {
  const w = live.w, h = live.h, land = live.land, I = host;
  const i = clamp(idx | 0, 0, PLAY_M.length - 1), m = PLAY_M[i];
  const xl = I.l, xr = w - I.r, yt = I.t, yb = h - I.b, cx = (xl + xr) / 2;
  const small = Math.round(76 + 14 * (m - 1));
  const L = { idx: i, m, land, xl, xr, yt, yb, cx, small };
  const back = I.back ? Math.round(I.back) + 8 : 0;
  if (!land) {
    const bh = Math.round(124 * Math.min(m, 1.35)), by = yb - 16 - bh, avail = xr - xl - 28, g = 12;
    const gw = Math.round(avail * 0.4), sw = Math.round((avail - gw - 2 * g) / 2);
    L.shield = { x: xl + 14, y: by, w: sw, h: bh };
    L.spur = { x: xl + 14 + sw + g, y: by, w: sw, h: bh };
    L.grab = { x: xr - 14 - gw, y: by, w: gw, h: bh };
    const ty = yt + 8;
    L.pause = { x: xl + 14, y: ty, w: small, h: small };
    L.think = { x: xr - 14 - small, y: ty, w: small, h: small };
    const bw = xr - xl - 28 - 2 * (small + 10);
    L.board = { x: xl + 14 + small + 10, y: ty, w: bw, h: small };
    L.boardH = small;
    L.arena = { x: xl, y: ty + small + 6, w: xr - xl, h: by - 8 - (ty + small + 6) };
    L.noteY = ty + small + 14; L.bannerY = Math.round(L.arena.y + L.arena.h * 0.42);
    const wg = 10, ww = Math.floor((avail - 3 * wg) / 4);
    L.watchBtns = [0, 1, 2, 3].map((k) => ({ x: xl + 14 + k * (ww + wg), y: by + Math.round((bh - 84) / 2), w: ww, h: 84 }));
  } else {
    const colW = Math.min(260, Math.round(250 * Math.min(1.15, m))), colX = xr - 14 - colW, g = 12;
    const bh = Math.round(104 * Math.min(m, 1.25));
    const gh = Math.round(bh * 1.25);
    L.grab = { x: colX, y: yb - 14 - gh, w: colW, h: gh };
    L.spur = { x: colX, y: L.grab.y - g - bh, w: colW, h: bh };
    L.shield = { x: colX, y: L.spur.y - g - bh, w: colW, h: bh };
    L.arena = { x: xl, y: yt, w: colX - 10 - xl, h: yb - yt };
    const ty = yt + 8;
    L.pause = { x: xl + 14 + back, y: ty, w: small, h: small };
    L.think = { x: L.pause.x + small + 10, y: ty, w: small, h: small };
    const bw = clamp(Math.round(470 * Math.min(m, 1.3)), 380, 640);
    L.board = { x: Math.round(L.arena.x + L.arena.w / 2 - bw / 2), y: ty, w: bw, h: small };
    if (L.board.x < L.think.x + small + 12) L.board.x = L.think.x + small + 12;
    L.boardH = small;
    L.noteY = ty + small + 10; L.bannerY = Math.round(L.arena.y + L.arena.h * 0.42);
    const wh = 84, wg = 10, top = yt + 14 + small + 20;
    L.watchBtns = [0, 1, 2, 3].map((k) => ({ x: colX, y: yb - 14 - (4 - k) * wh - (3 - k) * wg, w: colW, h: wh }));
  }
  L.top = L.board.y + L.board.h;
  return L;
}
