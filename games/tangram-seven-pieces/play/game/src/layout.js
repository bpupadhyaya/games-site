// Geometry as a pure function of the LIVE screen size (kit 1.7 fluid viewport: the SHORT side is always 720 virtual units, the
// long side grows with the aspect ratio). Drawing (view.js), hit-testing (game.js) and the text-document engine (screens.js) all
// read the same `layout()`, so what is drawn is exactly what is tapped, in portrait, landscape and on every tablet shape.
//
// Play screen: the target silhouette (board) and the piece tray are both as big as the screen allows.
//   stack  board on top, tray below, toolbar under both   (portrait phones and tablets)
//   side   board on the left, tray on the right with the toolbar under it   (landscape)
// The solver tries both for the largest piece scale `s` (pixels per puzzle unit, never above S_MAX) and keeps the better one.
// Puzzle space = lattice units relative to the silhouette centre, so pieces keep their place in the puzzle when `s` changes.
export const meta = { width: 720, height: 1560, fluid: { short: 720 } };

export const inRect = (x, y, r) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// Safe areas and the host's floating back button, in virtual units. main.js keeps this current (browsers: all zero).
// px = css pixels per virtual unit (text never shrinks below ~11 css px, tap targets stay about 44 css px).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };

export const S_MAX = 132;
export const DEFAULT_BOX = { w: 5.8, h: 6.0 };
export const TOOLBAR_IDS = ['rotL', 'flip', 'rotR', 'undo', 'hint', 'reset'];

let box = { ...DEFAULT_BOX };
export const setBox = (w, h) => { box = { w: Math.round(w * 100) / 100, h: Math.round(h * 100) / 100 }; };
export const resetBox = () => { box = { ...DEFAULT_BOX }; };

// ---- tray packing (puzzle units): every piece gets a cell big enough for any quarter turn -------------------------------------
const CELL = [[2.0, 2.0], [2.0, 2.0], [1.45, 1.45], [1.0, 1.0], [1.0, 1.0], [1.0, 1.0], [2.13, 1.75]];
const ORDER = [0, 1, 2, 6, 3, 4, 5];
const GAP = 0.12, TPAD = 0.2;

// Pack the seven cells in rows for an inner width of `wu` units. Returns the rows and the height they need, or null.
export function packRows(wu) {
  const rows = []; let row = [], rw = 0;
  for (const k of ORDER) {
    const cw = CELL[k][0];
    if (cw > wu + 1e-9) return null;
    const add = (row.length ? GAP : 0) + cw;
    if (row.length && rw + add > wu + 1e-9) { rows.push(row); row = []; rw = 0; }
    rw += (row.length ? GAP : 0) + cw; row.push(k);
  }
  rows.push(row);
  const heights = rows.map((r) => Math.max(...r.map((k) => CELL[k][1])));
  return { rows, heights, hu: heights.reduce((a, c) => a + c, 0) + GAP * (rows.length - 1) };
}

// Slot centres (px) for the seven pieces inside a tray panel at scale s, or null when it does not fit.
export function traySlots(rect, s) {
  const wu = rect.w / s - 2 * TPAD, hu = rect.h / s - 2 * TPAD;
  const pk = packRows(wu);
  if (!pk || pk.hu > hu + 1e-9) return null;
  const out = new Array(7);
  const gy = (hu - pk.heights.reduce((a, c) => a + c, 0)) / (pk.rows.length + 1);
  let y = TPAD + gy;
  pk.rows.forEach((row, ri) => {
    const sumw = row.reduce((a, k) => a + CELL[k][0], 0), gx = (wu - sumw) / (row.length + 1);
    let x = TPAD + gx;
    for (const k of row) { out[k] = [rect.x + (x + CELL[k][0] / 2) * s, rect.y + (y + pk.heights[ri] / 2) * s]; x += CELL[k][0] + gx; }
    y += pk.heights[ri] + gy;
  });
  return out;
}
const trayNeedH = (wpx, s) => { const pk = packRows(wpx / s - 2 * TPAD); return pk ? (pk.hu + 2 * TPAD) * s : null; };

// ---- play solver ----------------------------------------------------------------------------------------------------------------
const PADB = 0.2;            // board padding around the silhouette, units
const GAP_PANELS = 12, GAP_TOOLS = 30;
const tapH = () => Math.max(84, Math.min(110, 46 / Math.max(0.3, host.px)));   // about 46 css px, never huge

function solveStack(A, s, bx, by) {
  const th = tapH() + 16;
  if ((bx + 2 * PADB) * s > A.w + 1e-6) return null;
  const tn = trayNeedH(A.w, s);
  if (tn == null) return null;
  const bh = (by + 2 * PADB) * s, C = A.h - th - GAP_TOOLS;
  const left = C - bh - tn - GAP_PANELS;
  if (left < 0) return null;
  const board = { x: A.x, y: A.y, w: A.w, h: bh + left * 0.6 };
  const tray = { x: A.x, y: board.y + board.h + GAP_PANELS, w: A.w, h: tn + left * 0.4 };
  return { arr: 'stack', s, board, tray, tools: { x: A.x, y: A.y + A.h - th + 6, w: A.w, h: th - 6, cols: 6, rows: 1 } };
}

function solveSide(A, s, bx, by) {
  const needBoardW = (bx + 2 * PADB) * s, needBoardH = (by + 2 * PADB) * s;
  if (needBoardH > A.h + 1e-6) return null;
  const gapC = 14;
  for (let wt = 2.6 * s; wt <= A.w - gapC - needBoardW + 1e-6; wt += 6) {
    const rows = wt >= 6 * 84 + 5 * 8 + 24 ? 1 : 2;
    const tbh = rows === 1 ? tapH() : 2 * 84 + 8;
    const tn = trayNeedH(wt, s);
    if (tn == null || tn + GAP_TOOLS + tbh > A.h + 1e-6) continue;
    const bw = Math.min(A.w - gapC - wt, needBoardW * 1.55);
    const group = bw + gapC + wt, x0 = A.x + (A.w - group) / 2;
    const board = { x: x0, y: A.y, w: bw, h: A.h };
    const tray = { x: x0 + bw + gapC, y: A.y, w: wt, h: A.h - GAP_TOOLS - tbh };
    return { arr: 'side', s, board, tray, tools: { x: tray.x, y: A.y + A.h - tbh, w: wt, h: tbh, cols: rows === 1 ? 6 : 3, rows } };
  }
  return null;
}

function solvePlay(A, bx, by, land) {
  let st = null, sd = null;
  for (let s = S_MAX; s >= 24 && !(st && sd); s -= 1) {
    if (!st) st = solveStack(A, s, bx, by);
    if (!sd) sd = solveSide(A, s, bx, by);
  }
  const pick = !st ? sd : !sd ? st : (land ? (sd.s >= st.s * 0.97 ? sd : st) : (st.s >= sd.s * 0.97 ? st : sd));
  if (pick) return pick;
  // a degenerate window: stack the panels at the smallest scale and let them share what there is
  const s = 24, th = 90;
  const board = { x: A.x, y: A.y, w: A.w, h: A.h * 0.45 }, tray = { x: A.x, y: A.y + A.h * 0.45 + GAP_PANELS, w: A.w, h: A.h * 0.55 - th - GAP_PANELS - 10 };
  return { arr: 'stack', s, board, tray, tools: { x: A.x, y: A.y + A.h - th, w: A.w, h: th, cols: 6, rows: 1 } };
}

function toolRects(T) {
  const gap = 8, out = [];
  const bw = Math.min(150, (T.w - gap * (T.cols - 1)) / T.cols), bh = T.rows === 1 ? T.h : (T.h - gap) / 2;
  const total = bw * T.cols + gap * (T.cols - 1), x0 = T.x + (T.w - total) / 2;
  for (let i = 0; i < 6; i++) out.push({ x: x0 + (i % T.cols) * (bw + gap), y: T.y + Math.floor(i / T.cols) * (bh + gap), w: bw, h: bh });
  return out;
}

// ---- the layout object ------------------------------------------------------------------------------------------------------------
const cache = new Map();
export function layoutFor(w = meta.width, h = meta.height, bx = box.w, by = box.h) {
  const key = `${w.toFixed(2)}|${h.toFixed(2)}|${host.t.toFixed(1)}|${host.r.toFixed(1)}|${host.b.toFixed(1)}|${host.l.toFixed(1)}|${host.back.toFixed(1)}|${host.px.toFixed(3)}|${bx}|${by}`;
  let L = cache.get(key);
  if (L) return L;
  L = build(w, h, bx, by, key);
  if (cache.size > 24) cache.clear();
  cache.set(key, L);
  return L;
}
export const layout = () => layoutFor(meta.width, meta.height);

function build(w, h, bx, by, key) {
  const land = w > h;
  const t = host.t, b = host.b, l = host.l, r = host.r;
  const mx = 16, xl = l + mx, xr = w - r - mx;                  // side margins inside the safe area
  const xlHead = xl + (host.back ? host.back + 8 : 0);          // the host's floating back button owns the top-left corner
  const L = { key, w, h, land, t, b, l, r, xl, xr, xlHead };

  // ---- play header, message strip, panels
  // keep the title block clear of the kit's preview badge (top centre, below the safe inset)
  const kc = Math.max(0.3, host.px), badgeBottom = t + 6 / kc + 1.7 * Math.max(16, 11.5 / kc);
  const y0 = Math.max(t + (land ? 8 : 22), badgeBottom - 16), hh = 80;
  L.back = { x: xlHead, y: y0, w: 84, h: hh };
  L.pause = { x: xr - 84, y: y0, w: 84, h: hh };
  L.titleC = { x: w / 2, y: y0 + 40, ySub: y0 + 76 };
  const stripY = y0 + hh + 4;
  L.strip = { x: xl, y: stripY, w: xr - xl, h: 52 };
  const A = { x: xl, y: stripY + 54, w: xr - xl, h: h - b - 14 - (stripY + 54) };
  const sol = solvePlay(A, bx, by, land);
  L.s = sol.s; L.arr = sol.arr;
  L.board = sol.board; L.tray = sol.tray;
  L.boardC = { x: sol.board.x + sol.board.w / 2, y: sol.board.y + sol.board.h / 2 };
  L.slots = traySlots(sol.tray, sol.s) ?? traySlots({ ...sol.tray, h: sol.tray.h + 600 }, sol.s) ?? CELL.map((c, i) => [sol.tray.x + 60 + i * 20, sol.tray.y + 60]);
  L.bounds = {
    x0: Math.min(sol.board.x, sol.tray.x), y0: Math.min(sol.board.y, sol.tray.y),
    x1: Math.max(sol.board.x + sol.board.w, sol.tray.x + sol.tray.w), y1: Math.max(sol.board.y + sol.board.h, sol.tray.y + sol.tray.h),
  };
  L.toolSlot = sol.tools;
  L.tools = toolRects(sol.tools);
  const ts = sol.tools, ah = Math.min(ts.h, 110), ay = ts.y + ts.h - ah, g = 10, wSide = (ts.w - 2 * g) * 0.28;
  L.auto = {
    slower: { x: ts.x, y: ay, w: wSide, h: ah },
    pause: { x: ts.x + wSide + g, y: ay, w: ts.w - 2 * wSide - 2 * g, h: ah },
    faster: { x: ts.x + ts.w - wSide, y: ay, w: wSide, h: ah },
    label: { x: ts.x + ts.w / 2, y: ay - 8 },
  };

  // ---- document screens (levels, rules, how to play, about, settings)
  const dy = t + 20, dh = 80;
  const pw = Math.min(xr - xl, 1000), px0 = (w - pw) / 2;
  L.doc = {
    back: { x: xlHead, y: dy, w: 140, h: dh },
    zoomInc: { x: xr - 84, y: dy, w: 84, h: dh },
    pct: { x: xr - 84 - 148, y: dy, w: 140, h: dh },
    zoomDec: { x: xr - 84 - 148 - 92, y: dy, w: 84, h: dh },
    panel: { x: px0, y: dy + dh + 16, w: pw, h: h - b - 24 - (dy + dh + 16) },
  };
  L.doc.body = { x: L.doc.panel.x + 24, y: L.doc.panel.y + 24, w: L.doc.panel.w - 48, h: L.doc.panel.h - 48 };

  // ---- overlay card (pause, win, Watch & Learn summary, demo limit)
  const ow = Math.min(620, xr - xl);
  L.overlay = { x: (w - ow) / 2, w: ow, maxH: Math.max(380, h - t - b - 40), cy: t + (h - t - b) / 2 };

  L.title = titleLayout(L, w, h, t, b, xl, xr);
  return L;
}

function titleLayout(L, w, h, t, b, xl, xr) {
  const chipW = 124, chipH = 80, cy = t + 24;
  const chips = { zh: { x: xr - chipW, y: cy, w: chipW, h: chipH }, en: { x: xr - chipW * 2 - 16, y: cy, w: chipW, h: chipH } };
  const room = h - t - b;
  if (!L.land && room >= 1500) {
    // The approved phone look: hero (name, art) above, stacked menu below, anchored to the bottom.
    const menuTop = h - b - 760, mw = Math.min(672, xr - xl);
    return { mode: 'tall', compact: false, chips, k: 1, tx: (w - 720) / 2, ty: Math.max(0, (menuTop - 830) / 2), menu: { x: (w - mw) / 2, y: menuTop, w: mw, h: 740 } };
  }
  if (!L.land) {
    const mh = Math.max(530, Math.min(700, Math.round(room * 0.5)));
    const menuTop = h - b - 20 - mh, mw = Math.min(672, xr - xl);
    const ra = { y: t + 8, h: menuTop - (t + 8) - 4 };
    const k = Math.max(0.3, Math.min(1, ra.h / 830, (xr - xl) / 720));
    return { mode: 'compact', compact: true, chips, k, tx: (w - 720 * k) / 2, ty: ra.y + Math.max(0, (ra.h - 830 * k) / 2), menu: { x: (w - mw) / 2, y: menuTop, w: mw, h: mh } };
  }
  // landscape: art on the left, menu on the right
  const colW = (xr - xl) * 0.5;
  const ra = { x: xl, y: t + 8, w: colW - 10, h: room - 16 };
  const k = Math.max(0.3, Math.min(1, ra.h / 830, ra.w / 720));
  const free = xr - (xl + colW + 10), mw = Math.min(600, free), my = chips.en.y + chipH + 12;
  return {
    mode: 'wide', compact: true, chips, k, tx: ra.x + (ra.w - 720 * k) / 2, ty: ra.y + Math.max(0, (ra.h - 830 * k) / 2),
    menu: { x: xr - free + (free - mw) / 2, y: my, w: mw, h: h - b - 16 - my },
  };
}
