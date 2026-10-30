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
// Portrait: Pause and Think under the corners, the scoreboard between them, the clock under it, the arena in the middle and the horse buttons
// (or Burst while riding) across the bottom. Landscape: scoreboard pill top centre, Pause / Think top right, the horse buttons / Burst in a column at
// the right, the arena (turned a quarter turn) taking the rest. Everything follows the text size through PLAY_M (gentler than the menus so the
// arena stays visible). One set of rectangles for drawing and hit-testing.
export function playLayout(idx) {
  const w = live.w, h = live.h, land = live.land, I = host;
  const i = clamp(idx | 0, 0, PLAY_M.length - 1), m = PLAY_M[i];
  const xl = I.l, xr = w - I.r, yt = I.t, yb = h - I.b, cx = (xl + xr) / 2;
  const small = Math.round(76 + 14 * (m - 1));
  const L = { idx: i, m, land, xl, xr, yt, yb, cx, small };
  const clockH = Math.round(50 * Math.min(m, 1.4));
  if (!land) {
    const chipH = Math.round(88 * Math.min(m, 1.5)), chipW = Math.min(212, Math.floor((Math.min(xr - xl - 28, 700) - 24) / 3)), chipsW = chipW * 3 + 24;
    L.chips = [0, 1, 2].map((k) => ({ x: Math.round(cx - chipsW / 2 + k * (chipW + 12)), y: yb - 22 - chipH, w: chipW, h: chipH }));
    // compact plaques: the field gets the height (the floating back button only needs the extra offset when the host shows it)
    const topY = yt + (I.back ? 42 : 14), boardH = Math.round(124 + 30 * (m - 1)), topH = topY - yt + boardH;
    Object.assign(L, {
      boardH, board: { x: xl + 14 + small + 10, y: topY, w: xr - xl - 28 - 2 * (small + 10), h: boardH },
      pause: { x: xl + 14, y: topY, w: small, h: small }, think: { x: xr - 14 - small, y: topY, w: small, h: small },
      bannerY: yt + topH + 190, noteY: yt + topH + 6,
    });
    L.clock = { x: Math.round(cx - 130), y: L.board.y + L.board.h + 6, w: 260, h: clockH };
    L.arena = { x: xl + 4, y: L.clock.y + clockH + 2, w: xr - xl - 8, h: L.chips[0].y - 20 - (L.clock.y + clockH + 2) };
    const bs = Math.round(136 * Math.min(1.2, m));
    L.burst = { x: xr - 14 - bs, y: yb - 16 - bs, w: bs, h: bs };
  } else {
    const k = Math.min(m, 1.4);
    const colW = Math.min(250, Math.round(250 * Math.min(1.15, m))), colX = xr - 14 - colW;
    const chipH = Math.round(100 * Math.min(m, 1.4)), gap = 12;
    const top = yt + 10 + small + 16, bottom = yb - 14, total = 3 * chipH + 2 * gap;
    const y0 = Math.round(Math.max(top, (top + bottom - total) / 2 + 40));
    L.chips = [0, 1, 2].map((q) => ({ x: colX, y: y0 + q * (chipH + gap), w: colW, h: chipH }));
    const bs = Math.round(150 * Math.min(1.1, m));
    L.burst = { x: colX, y: yb - 14 - bs, w: colW, h: bs };
    // option A: the scoreboard and clock above the arena
    const pillW = clamp(Math.round(520 * k), 440, 780), pillH = Math.round(112 * k);
    const A = { board: { x: Math.round((xl + colX) / 2 - pillW / 2), y: yt + 10, w: pillW, h: pillH }, clockH };
    A.clock = { x: Math.round(A.board.x + A.board.w / 2 - 130), y: A.board.y + A.board.h + 6, w: 260, h: clockH };
    A.arena = { x: xl + 4, y: A.clock.y + clockH + 2, w: colX - 12 - (xl + 4), h: yb - 6 - (A.clock.y + clockH + 2) };
    // option B: a column at the left for Pause, Think, the scoreboard and the clock; the arena takes the full height
    const lw = clamp(Math.round(300 * Math.min(m, 1.3)), 260, 400), lx = xl + 12;
    const py = yt + 10 + (I.back ? Math.round(I.back) : 0);
    const B = { pause: { x: lx, y: py, w: small, h: small }, think: { x: lx + small + 10, y: py, w: small, h: small } };
    B.board = { x: lx, y: py + small + 12, w: lw, h: Math.round(112 * k) };
    B.clock = { x: lx + Math.round((lw - 260) / 2), y: B.board.y + B.board.h + 8, w: 260, h: clockH };
    B.arena = { x: lx + lw + 8, y: yt + 4, w: colX - 12 - (lx + lw + 8), h: yb - yt - 8 };
    const sc = (r) => Math.min(r.w / 66.4, r.h / 43.6);
    const useB = sc(B.arena) > sc(A.arena) * 1.04;
    L.sideHud = useB;
    if (useB) {
      Object.assign(L, { boardH: B.board.h, board: B.board, pause: B.pause, think: B.think, clock: B.clock, arena: B.arena, bannerY: Math.round(B.arena.y + B.arena.h * 0.4), noteY: B.arena.y + 8 });
      L.noteX = lx; L.noteW = lw;
    } else {
      Object.assign(L, {
        boardH: pillH, board: A.board, pause: { x: xr - 14 - small, y: yt + 10, w: small, h: small }, think: { x: xr - 14 - 2 * small - 10, y: yt + 10, w: small, h: small },
        clock: A.clock, arena: A.arena, bannerY: yt + pillH + 150, noteY: yt + pillH + 20,
      });
    }
  }
  L.top = L.clock.y + L.clock.h;
  if (!land) L.noteY = L.top + 34;   // notes and hints sit below the clock and the preview pill, never over them
  return L;
}
