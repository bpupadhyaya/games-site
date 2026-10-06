// Geometry as a function of the LIVE screen size (kit 1.7.x fluid viewport: the short side is always 720 units, the long side follows the
// aspect, capped at 2.4:1). `applyLayout(w, h)` is called every frame by game.js; it is cached by size + safe insets, so a frame never
// recomputes it. It fills the live objects below (W, H, BOARD, MAT, L). Three shapes:
//   tall     portrait phone (h >= 1500): the approved phone look - header, cloth board, throwing rug, button row (unchanged at 720 x 1560).
//   compact  portrait tablet / small phone / squarish window: smaller header, the board centred, a one-row rug, button row.
//   wide     landscape: a left card (players, when the screen is wide enough), the board, a right column (title, message, rug, buttons).
import { geo } from './rules.js';

export let W = 720;
export let H = 1560;
export const BOARD = { cx: 360, cy: 650, S: 680 };   // the cloth's square footprint (centre and side)
export const MAT = { x: 46, y: 1032, w: 628, h: 322 }; // the throwing rug
// Safe areas and the host's floating back button, in virtual units. main.js keeps this current (browsers: all zero).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };   // px: css pixels per virtual unit (text never shrinks below ~11 css px)
export const L = { key: '', mode: 'tall', w: 720, h: 1560 };      // the live layout (filled by applyLayout)

const R4 = (x, y, w, h) => ({ x, y, w, h });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const cache = new Map();

export function applyLayout(w, h) {
  w = Math.max(240, Math.round(w) || 720); h = Math.max(240, Math.round(h) || 1560);
  const key = `${w}x${h}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}`;
  if (L.key === key) return L;
  let B = cache.get(key);
  if (!B) { B = build(w, h, { ...host }); B.key = key; cache.set(key, B); if (cache.size > 30) cache.delete(cache.keys().next().value); }
  W = w; H = h;
  Object.assign(BOARD, B.board); Object.assign(MAT, B.mat);
  for (const k of Object.keys(L)) delete L[k];
  Object.assign(L, B);
  return L;
}

// ---- the three shapes -----------------------------------------------------------------------------------------------------
function build(w, h, ins) {
  const land = w >= h * 1.3, tall = !land && w < h && h >= 1500, mode = land ? 'wide' : tall ? 'tall' : 'compact';
  const U = { x0: ins.l, y0: ins.t, x1: w - ins.r, y1: h - ins.b }; U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  const B = { w, h, mode, land, tall, ins, U, cx: w / 2, cy: (U.y0 + U.y1) / 2 };
  B.backBox = ins.back ? R4(ins.l, ins.t, ins.back + 8, ins.back + 8) : R4(0, 0, 0, 0);
  B.rows = 2;

  // ---- text panels (setup, learn, settings, how to play, about, rules) ----
  if (land) { const pw = Math.min(940, w - 2 * Math.max(ins.l, ins.r, 16) - 16); B.panel = R4((w - pw) / 2, ins.t + 8, pw, h - ins.t - ins.b - 16); }
  else if (tall) { const pw = Math.min(648, w - 72), y = Math.max(118, ins.t + 10); B.panel = R4((w - pw) / 2, y, pw, h - Math.max(142, ins.b + 24) - y); }
  else { const pw = Math.min(648, w - 48); B.panel = R4((w - pw) / 2, ins.t + 10, pw, h - ins.t - ins.b - 24); }
  B.panelWide = B.panel.w >= 780;

  const stackedPlate = (hasSave) => {   // title: stack design height of the button rows
    return hasSave ? 476 : 404;
  };
  B.stackDesign = stackedPlate;

  if (!land) {
    // ---- stacked (tall / compact) -------------------------------------------------------------------------------------------
    const top = ins.t, hdrH = tall ? 278 : 172, pw = Math.min(648, w - 2 * Math.max(12, ins.l, ins.r));
    B.head = { y: top + (tall ? 120 : 54), size: tall ? 68 : 46 };
    B.plaque = R4((w - pw) / 2, top + (tall ? 150 : 66), pw, tall ? 128 : 100);
    const botPad = tall ? Math.max(90, ins.b + 14) : Math.max(20, ins.b + 10), barH = tall ? 78 : 66, barY = h - botPad - barH, bw = Math.min(644, w - 24);
    B.ctl = { x: (w - bw) / 2, y: barY, w: bw, h: barH, cols: 0 };
    const Hb = top + hdrH, avail = barY - Hb;
    B.rows = tall ? 2 : 1;
    let matH = tall ? 322 : 190, S = Math.min(680, w - 40), free = avail - S - matH;
    const MINF = 80;
    if (free < MINF) {
      let cut = Math.min(MINF - free, tall ? 60 : 36); matH -= cut; free += cut;
      if (free < MINF) { cut = Math.min(MINF - free, S - 260); S -= cut; free += cut; }
    }
    free = Math.max(free, 0);
    const k = Math.min(free / 112, 1.8), extra = Math.max(0, free - 112 * k), by = Hb + extra / 2 + 32 * k, mw = Math.min(628, w - 24);
    B.board = { cx: w / 2, cy: by + S / 2, S };
    B.mat = R4((w - mw) / 2, by + S + 42 * k, mw, matH);
    B.bar = R4(B.ctl.x, B.ctl.y, B.ctl.w, B.ctl.h);
    B.col = null; B.card = null;
    // title screen
    const T = {}, botT = Math.max(18, ins.b + 10);
    T.orn = top + (tall ? 92 : 56); T.y = top + (tall ? 190 : 138); T.size = tall ? 148 : 108; T.tagY = top + (tall ? 250 : 182); T.tagSize = tall ? 38 : 32;
    const lockH = Math.round(Math.max(0.35 * 720, 120 / Math.max(host.px, 1e-6)) / 3.66), strip = lockH + 30;
    const blockBottom = top + (tall ? 280 : 214);
    const availT = h - botT - strip - blockBottom, ptw = Math.min(648, w - 24);
    T.lock = { cx: w / 2, y: h - botT - lockH - 6, h: lockH };
    T.rowScale = (hasSave) => clamp((Math.min(availT - 250, 548) - 86) / stackedPlate(hasSave), 0.72, 1);
    T.plateFor = (hasSave) => { const sc = T.rowScale(hasSave), ph = Math.round(stackedPlate(hasSave) * sc + 86); return R4((w - ptw) / 2, h - botT - strip - ph, ptw, ph); };
    T.board = (hasSave) => { const p = T.plateFor(hasSave), a = p.y - blockBottom, S2 = clamp(a - 64, 0, 680); return { cx: w / 2, cy: blockBottom + a / 2 - 6, S: S2 < 120 ? 0 : S2 }; };
    B.title = T;
  } else {
    // ---- wide (landscape) -----------------------------------------------------------------------------------------------------
    const g = 14;
    let S = Math.min(U.h - 66, 700), Cw = Math.min(600, U.w - S - 3 * g);
    if (Cw < 340) { Cw = 340; S = Math.max(380, U.w - Cw - 3 * g); }
    const leftover = U.w - S - Cw - 4 * g, Lc = leftover >= 250 ? Math.min(380, leftover) : 0;
    const total = (Lc ? Lc + g : 0) + S + g + Cw, x0 = U.x0 + (U.w - total) / 2;
    const bx = x0 + (Lc ? Lc + g : 0), by = U.y0 + 30 + (U.h - 66 - S) / 2;
    B.board = { cx: bx + S / 2, cy: by + S / 2, S };
    const col = R4(bx + S + g, U.y0 + 10, Cw, U.h - 20);
    B.col = col;
    B.card = Lc ? R4(x0, U.y0 + 10, Lc, U.h - 20) : null;
    if (B.card && ins.back && B.card.x < B.backBox.x + B.backBox.w) { const dy = B.backBox.y + B.backBox.h + 6 - B.card.y; if (dy > 0) { B.card.y += dy; B.card.h -= dy; } }
    B.head = { y: col.y + 44, size: 46 };
    B.plaque = R4(col.x, col.y + 62, Cw, 112);
    const n3 = Cw >= 470 ? 1 : 2, ctlH = n3 === 1 ? 62 : 62 * 2 + 10;
    B.ctl = { x: col.x, y: col.y + col.h - ctlH, w: Cw, h: ctlH, cols: n3 === 1 ? 0 : 2 };
    const space = B.ctl.y - (B.plaque.y + B.plaque.h) - 28, matH = clamp(space, 190, 322), my = B.plaque.y + B.plaque.h + 14 + (space - matH) / 2;
    B.mat = R4(col.x, my, Cw, matH);
    B.bar = R4(B.ctl.x, B.ctl.y, B.ctl.w, B.ctl.h);
    const T = {};
    T.orn = col.y + 14; T.y = col.y + 104; T.size = 96; T.tagY = col.y + 142; T.tagSize = 30;
    const lockH = Math.round(Math.max(0.28 * 720, 120 / Math.max(host.px, 1e-6)) / 3.66), py = col.y + 168, ph = col.y + col.h - py - lockH - 26;
    T.lock = { cx: col.x + Cw / 2, y: col.y + col.h - lockH - 4, h: lockH };
    T.rowScale = (hasSave) => clamp((ph - 86) / stackedPlate(hasSave), 0.72, 1);
    T.plateFor = () => R4(col.x, py, Cw, ph);
    T.board = () => B.board;
    B.title = T;
  }
  return B;
}

// ---- the throwing rug: where the six cowries (or the die) rest, and the hint / result pill -----------------------------------
// Everything is a fraction of the live rug, so the rug can be any size. At the tall phone size these are the original numbers.
export function throwGeo() {
  const { x, y, w, h } = MAT, rows = L.rows || 2, cols = rows === 2 ? 3 : 6, zoneH = h - 76, cx = x + w / 2;
  const sx = rows === 2 ? Math.min(170, (w - 140) / 2) : Math.min(110, (w - 110) / 5), sy = rows === 2 ? Math.min(96, zoneH * 0.4) : 0;
  const mid = y + 41 * (h / 322) + zoneH / 2, spots = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) spots.push([cx + (c - (cols - 1) / 2) * sx, rows === 2 ? mid + (r - 0.5) * sy : mid]);
  const k = rows === 2 ? 1.3 * Math.min(1, sx / 150, (sy || 96) / 80) : 1.2 * Math.min(1, sx / 100);
  const pillY = y + h - 38, pw = Math.min(500, w - 40), mw = Math.min(420, w - 40);
  return { spots, k, cx, dieXY: [cx, mid + (rows === 2 ? 0 : 0)], dieK: rows === 2 ? 1.2 : 1.0, arrowY: rows === 2 ? spots[0][1] - 26 : null, pillY, pill: R4(cx - pw / 2, pillY - 34, pw, 62), medal: R4(cx - mw / 2, pillY - 34, mw, 62), glow: { cx, cy: mid, rx: Math.min(300, w / 2 - 20), ry: Math.max(60, zoneH * 0.5) }, zone: R4(x, y - 20, w, h + 40) };
}

// The row / grid of n buttons in the control area (play screens). 1 row across the bar, or 2 columns in a narrow side column.
export function barRects(n) {
  const c = L.ctl, cols = c.cols || n, rows = Math.ceil(n / cols), gap = c.cols ? 10 : 22, bw = (c.w - gap * (cols - 1)) / cols, bh = c.cols ? 62 : c.h, out = [];
  void rows;
  for (let i = 0; i < n; i++) { const r = Math.floor(i / cols), col = i % cols, inRow = Math.min(cols, n - r * cols), ww = inRow === cols ? bw : (c.w - gap * (inRow - 1)) / inRow, cc = inRow === cols ? col : col; out.push({ x: c.x + cc * (ww + gap), y: c.y + r * (bh + 10), w: ww, h: bh }); }
  return out;
}

export const cellSize = (mode) => BOARD.S / (geo(mode).R * 2 + 4);

// rotate an offset a quarter-turns anticlockwise (as seen on screen): bottom arm -> right arm -> top -> left
export function rot(x, y, a) { for (let k = 0; k < a; k++) { const t = x; x = y; y = -t; } return [x, y]; }

// screen point of a grid offset
export function gridXY(mode, x, y) { const cs = cellSize(mode); return { x: BOARD.cx + x * cs, y: BOARD.cy + y * cs }; }

// offset (in squares) of outer square t
export function trackOffset(mode, t) {
  const G = geo(mode), a = Math.floor(t / G.A), j = t % G.A, R = G.R;
  let u, v;
  if (j < R) { u = -1; v = j + 1; } else if (j === R) { u = 0; v = R; } else { u = 1; v = 2 * R + 1 - j; }
  return rot(u, v + 1, a);
}
export const homeOffset = (mode, arm, row) => rot(0, row + 1, arm);
export const yardOffset = (mode, arm) => { const R = geo(mode).R, d = R / 2 + 1.75; return rot(-d, d, arm); };
export const yardSlot = (mode, arm, k) => { const [x, y] = yardOffset(mode, arm), s = 1.15, o = [[-s, -s], [s, -s], [-s, s], [s, s]][k % 4]; return [x + o[0], y + o[1]]; };
export const centreSlot = (mode, arm, k) => { const [x, y] = rot(-0.3 + (k % 2) * 0.6, 0.62 + Math.floor(k / 2) * 0.0, arm); return [x, y]; };

// where a pawn (player pl, pawn i) stands when at position p (screen point + lift-free)
export function posXY(g, pl, i, p) {
  const G = geo(g.mode), arm = g.players[pl].arm;
  let o;
  if (p < 0) o = yardSlot(g.mode, arm, i);
  else if (p < G.T) o = trackOffset(g.mode, (G.A * arm + G.R + 1 + p) % G.T);
  else if (p < G.END) o = homeOffset(g.mode, arm, G.R - 1 - (p - G.T));
  else o = centreSlot(g.mode, arm, i);
  return gridXY(g.mode, o[0], o[1]);
}

// the squares a hopping pawn crosses, in screen points
export function hopPath(g, pl, i, from, to) {
  if (from < 0) return [posXY(g, pl, i, from), posXY(g, pl, i, 0)];
  const pts = [posXY(g, pl, i, from)];
  for (let p = from + 1; p <= to; p++) pts.push(posXY(g, pl, i, p));
  return pts;
}

// generic button hit test
export const inRect = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// Tap zone of the Arcforge lockup (title screen): at least 44 x 44 css px, grown sideways/downwards only.
export const creditHit = (k) => { const m = 44 / Math.max(host.px, 1e-6), lw = k.h * 3.66, w = Math.max(lw, m), h = Math.max(k.h, m); return { x: Math.round(k.cx - w / 2), y: Math.round(k.y), w: Math.round(w), h: Math.round(h) }; };
