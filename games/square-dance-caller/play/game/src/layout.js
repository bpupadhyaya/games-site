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
// tallest floor rectangle (height / width) used in the stacked arrangement
export const TALL = 1.06;
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
// Two arrangements, whichever gives the larger floor: A (stacked: header, beat strip, floor, then the call card and the Call it bar) and B (the floor
// on the left, one column on the right holding the header, the beat strip, the call card and the Call it bar). One set of rectangles for drawing and
// hit-testing; everything follows the text size through PLAY_M (gentler than the menus so the floor stays large).
export function playLayout(idx, n = 4) {
  const w = live.w, h = live.h, I = host;
  const i = clamp(idx | 0, 0, PLAY_M.length - 1), m = PLAY_M[i];
  const xl = I.l, xr = w - I.r, yt = I.t, yb = h - I.b, cx = (xl + xr) / 2;
  const small = Math.round(72 + 12 * (m - 1)), g = 10;
  const btnH = Math.round(84 * Math.min(1.25, m)), callH = Math.round(88 * Math.min(1.2, m));
  const stripH = 52;
  const backW = I.back ? Math.round(I.back + 8) : 0;
  const L = { idx: i, m, xl, xr, yt, yb, cx, small, land: w > h, side: false };
  const gridFor = (x, y, wid, maxH, colsList, cap = btnH) => {
    let best = null;
    for (const cols of colsList) {
      const rows = Math.ceil(n / cols), cw = (wid - g * (cols - 1)) / cols;
      const ch = Math.min(cap, (maxH - g * (rows - 1)) / rows);
      if (ch < 54 || cw < 120) continue;
      const score = ch * 10 + cols * -1;
      if (!best || score > best.score) best = { cols, rows, cw, ch, score };
    }
    if (!best) { const cols = colsList[colsList.length - 1], rows = Math.ceil(n / cols); best = { cols, rows, cw: (wid - g * (cols - 1)) / cols, ch: Math.max(46, (maxH - g * (rows - 1)) / rows) }; }
    const rects = [];
    for (let k = 0; k < n; k++) {
      const r = Math.floor(k / best.cols), c = k % best.cols;
      // a short last row is centred
      const inRow = r === best.rows - 1 ? n - r * best.cols : best.cols;
      const rowW = inRow * best.cw + (inRow - 1) * g, x0 = x + (wid - rowW) / 2;
      rects.push({ x: Math.round(x0 + c * (best.cw + g)), y: Math.round(y + r * (best.ch + g)), w: Math.round(best.cw), h: Math.round(best.ch) });
    }
    return { rects, h: best.rows * best.ch + (best.rows - 1) * g };
  };
  // A: stacked
  const A = (() => {
    const wid = Math.min(xr - xl - 16, 760), x0 = Math.round(cx - wid / 2);
    const head = { y: yt + 6, h: small };
    const strip = { x: x0, y: head.y + head.h + 6, w: wid, h: stripH };
    const callIt = { x: x0, y: yb - 14 - callH, w: wid, h: callH };
    const bottom = callIt.y - 10;
    let best = null;
    for (const cols of [2, 3, 4]) {
      const rows = Math.ceil(n / cols), ch = btnH, gh = rows * ch + (rows - 1) * g;
      const top = strip.y + strip.h + 6, side = Math.min(xr - xl - 8, bottom - gh - 8 - top);
      if (!best || side > best.side + 6) best = { cols, side };
    }
    const cols = best.cols, rowsN = Math.ceil(n / cols);
    // the preview pill gets its own row above the floor (never over a far dancer's number tag)
    const pill = { x: x0, y: strip.y + strip.h + 4, w: wid, h: 38 };
    // the floor rectangle may be taller than wide on a tall screen (the camera then looks down more steeply and the floor fills the height);
    // whatever height is still spare after that goes to taller call buttons
    const topY = pill.y + pill.h + 4, widthCap = xr - xl - 8;
    const gh0 = rowsN * btnH + (rowsN - 1) * g, availH0 = bottom - gh0 - 8 - topY;
    const rectH = availH0 >= widthCap ? Math.min(availH0, Math.round(widthCap * TALL)) : Math.max(120, availH0);
    const rectW = availH0 >= widthCap ? widthCap : Math.max(120, Math.min(widthCap, availH0));
    const spare = availH0 - rectH;
    const chA = Math.min(Math.round(btnH * 2.1), btnH + Math.max(0, Math.floor(spare / rowsN)));
    const grid = gridFor(x0, 0, wid, rowsN * chA + (rowsN - 1) * g, [cols], chA);
    const gh = grid.h, gy = bottom - gh;
    const rects = grid.rects.map((r) => ({ ...r, y: r.y + gy }));
    const side = rectW, top = topY, room = Math.max(120, gy - 8 - top);
    const fh = Math.min(rectH, room);
    const floor = { x: Math.round(cx - rectW / 2), y: Math.round(top + (room - fh) / 2), w: rectW, h: fh };
    const pause = { x: xl + 8 + backW, y: head.y, w: small, h: small }, think = { x: xr - 8 - small, y: head.y, w: small, h: small };
    const board = { x: pause.x + small + 8, y: head.y, w: think.x - 8 - (pause.x + small + 8), h: small };
    return { side, floor, cards: rects, callIt, strip, pause, think, board, pill, watchY: callIt.y };
  })();
  // B: floor left, column right
  const B = (() => {
    const colW = clamp(Math.round((xr - xl) * 0.4), 300, 560);
    const colX = xr - 8 - colW;
    const head = { y: yt + 6, h: small };
    const pause = { x: colX, y: head.y, w: small, h: small }, think = { x: colX + colW - small, y: head.y, w: small, h: small };
    const board = { x: pause.x + small + 8, y: head.y, w: think.x - 8 - (pause.x + small + 8), h: small };
    const strip = { x: colX, y: head.y + head.h + 6, w: colW, h: stripH };
    const callIt = { x: colX, y: yb - 14 - callH, w: colW, h: callH };
    const pill = { x: colX, y: strip.y + strip.h + 4, w: colW, h: 38 };
    const gy = pill.y + pill.h + 4, maxH = callIt.y - 10 - gy;
    const grid = gridFor(colX, gy, colW, maxH, [1, 2, 3]);
    const avail = { x: xl + 6, y: yt + 6 + (backW && !L.land ? 0 : 0), w: colX - 14 - (xl + 6), h: yb - yt - 12 };
    const side = Math.max(120, Math.min(avail.w, avail.h));
    const floor = { x: Math.round(avail.x + (avail.w - side) / 2), y: Math.round(avail.y + (avail.h - side) / 2), w: side, h: side };
    // keep the floating back button clear: the column starts right of it anyway (the back button sits at the far left)
    return { side, floor, cards: grid.rects, callIt, strip, pause, think, board, pill, watchY: callIt.y };
  })();
  const pick = B.side > A.side * 1.04 ? B : A;
  L.side = pick === B;
  Object.assign(L, pick);
  L.bannerY = L.floor.y + L.floor.h / 2;
  L.noteY = L.strip.y + L.strip.h + 8;
  return L;
}
