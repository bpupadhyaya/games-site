// Screen geometry as a function of the LIVE size (kit fluid viewport: the short side is always 720 units, the long side follows the screen).
// `layoutFor(w, h, n)` returns every rectangle for that size and player count, cached by size key + safe insets, so a frame never recomputes it.
// The painted board keeps its canonical 668-unit geometry (squareXY etc.); L.board maps it onto the screen:
//   screen = (canonical - (BOARD_X, BOARD_Y)) * s + (L.board.x, L.board.y).
// Modes:
//   tall     portrait phone: header, board, players, caption, dice table, button bar (the approved phone look, stretched to fill taller screens).
//   compact  portrait but shorter than a phone (tablets, split windows): same stack, tighter.
//   two      landscape that is not very wide (4:3 .. 1.75:1): an info/controls column on the left, the board on the right.
//   three    wide landscape: players + caption on the left, the board in the middle, dice + buttons on the right.
import { cellOf } from './rules.js';

export const W = 720, H = 1280;            // canonical (design) size; the live size comes from layoutFor
export const FRAME = 34;                   // painted border thickness
export const CELL = 60;
export const GRID = CELL * 10;             // 600
export const BOARD_SIZE = GRID + FRAME * 2;   // 668
export const BOARD_X = (W - BOARD_SIZE) / 2;  // 26
export const BOARD_Y = 112;
export const GRID_X = BOARD_X + FRAME;
export const GRID_Y = BOARD_Y + FRAME;

export const THINK_STEPS = [2, 3, 5, 8, 10];
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];

// Safe areas and the host's floating back button, in virtual units. main.js keeps this current (browsers: all zero).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };   // px: css pixels per virtual unit

export function squareXY(n) {
  if (n <= 0) return null;
  const { col, row } = cellOf(n);
  return { x: GRID_X + col * CELL + CELL / 2, y: GRID_Y + (9 - row) * CELL + CELL / 2 };
}
// Pawns that have not entered yet wait on the painted bottom border.
export function startXY(i) { return { x: GRID_X + 34 + i * 40, y: GRID_Y + GRID + FRAME / 2 + 1 }; }
export function posXY(n, i) { return n <= 0 ? startXY(i) : squareXY(n); }
// canonical board coordinates -> square number (or -1)
export function squareAt(x, y) {
  if (x < GRID_X || x >= GRID_X + GRID || y < GRID_Y || y >= GRID_Y + GRID) return -1;
  const col = Math.floor((x - GRID_X) / CELL), row = 9 - Math.floor((y - GRID_Y) / CELL);
  return row * 10 + (row % 2 === 0 ? col : 9 - col) + 1;
}
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
const R = (x, y, w, h) => ({ x, y, w, h });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// screen <-> canonical board coordinates
export const toCanon = (L, x, y) => ({ x: BOARD_X + (x - L.board.x) / L.board.s, y: BOARD_Y + (y - L.board.y) / L.board.s });
export const boardCentre = (L) => ({ x: L.board.x + (BOARD_SIZE / 2) * L.board.s, y: L.board.y + (BOARD_SIZE / 2) * L.board.s });

// Dice sit on the table; positions are stored as offsets from the table centre in "design units" (die edge 108) so a rotation mid-throw is harmless.
export const dieK = (L, n) => clamp(Math.min(L.table.w / (n === 2 ? 400 : 250), L.table.h / 196), 0.42, 1.25);
export const tableAt = (L, n, ox, oy) => { const k = dieK(L, n); return { x: L.dieHome.x + ox * k, y: L.dieHome.y + oy * k }; };
export const tableOffset = (L, n, x, y) => { const k = dieK(L, n); return { x: (x - L.dieHome.x) / k, y: (y - L.dieHome.y) / k }; };

export function chipRect(L, i, n) {
  const c = L.chipBox;
  if (c.mode === 'row') { const gap = 10, w = (c.w - gap * (n - 1)) / n; return R(c.x + i * (w + gap), c.y, w, c.h); }
  if (n <= 2) return R(c.x, c.y + i * (c.h + 8), c.w, c.h);
  const gap = 8, w = (c.w - gap) / 2; return R(c.x + (i % 2) * (w + gap), c.y + Math.floor(i / 2) * (c.h + 8), w, c.h);
}
export function chipsHeight(c, n) {
  if (c.mode === 'row') return c.h;
  const rows = n <= 2 ? n : Math.ceil(n / 2);
  return rows * c.h + (rows - 1) * 8;
}

const cache = new Map();
export function layoutFor(w, h, n = 2) {
  w = Math.round(w); h = Math.round(h);
  const key = `${w}x${h}|${n}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}`;
  let L = cache.get(key);
  if (!L) { L = build(w, h, n, { ...host }); L.key = key; cache.set(key, L); if (cache.size > 60) cache.delete(cache.keys().next().value); }
  return L;
}

// the demo (Watch & Learn) control cluster in a column: Pause on top, then Exit / - / + / speed
function demoColumn(x, y, w, hP, hR) {
  const gap = 8, cw = (w - gap * 3) / 4;
  return { pause: R(x, y, w, hP), exit: R(x, y + hP + 8, cw, hR), tdec: R(x + (cw + gap), y + hP + 8, cw, hR), tinc: R(x + (cw + gap) * 2, y + hP + 8, cw, hR), speed: R(x + (cw + gap) * 3, y + hP + 8, cw, hR) };
}
function barColumn(x, y, w, hRoll, hRow) {
  const gap = 8, cw = (w - gap * 2) / 3;
  return { roll: R(x, y, w, hRoll), menu: R(x, y + hRoll + 8, cw, hRow), hint: R(x + cw + gap, y + hRoll + 8, cw, hRow), sound: R(x + (cw + gap) * 2, y + hRoll + 8, cw, hRow) };
}

function build(w, h, n, ins) {
  const land = w >= h;
  const L = { w, h, n, land, ins };
  const backSz = ins.back ? Math.max(ins.back, 56) : 0;
  L.backBox = ins.back ? R(ins.l, ins.t, backSz + 8, backSz + 8) : R(0, 0, 0, 0);
  const U = L.U = { x0: ins.l, y0: ins.t, x1: w - ins.r, y1: h - ins.b };
  U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  L.chipBox = { mode: 'row', x: 0, y: 0, w: 0, h: 74 };
  L.head = { menu: null, sound: null, title: null };
  L.bar = {}; L.demo = {};

  // ---- bars and reference pages shared by every screen ----------------------------------------------------------------------
  const zl = ins.back ? U.x0 + backSz + 16 : U.x0 + 16;
  L.zoom = { dec: R(zl, U.y0 + 14, 110, 64), inc: R(U.x1 - 126, U.y0 + 14, 110, 64) };
  L.zoom.labelMax = Math.max(120, (L.zoom.inc.x - (L.zoom.dec.x + 110)) - 40);
  const lw0 = land ? Math.min(U.w - 32, 820) : U.w;
  L.list = { x: land ? U.x0 + (U.w - lw0) / 2 : U.x0, w: lw0, top: U.y0 + 92, bottom: U.y1 - 10 };
  // title screen in landscape: art on the left, buttons on the right
  L.titleSplit = land && w >= 1.2 * h;
  if (L.titleSplit) {
    const lw = clamp(U.w * 0.4, 400, 520), rx = U.x1 - 16 - lw;
    L.titleList = { x: rx, w: lw, top: L.list.top, bottom: L.list.bottom };
    L.titleHero = R(U.x0 + 16, L.list.top, rx - 32 - U.x0, L.list.bottom - L.list.top);
  }
  const btnH = land ? 84 : 100, btnY = U.y1 - 16 - btnH, rw = Math.min(U.w - 40, land ? 760 : 700);
  L.refBack = R(U.x0 + (U.w - rw) / 2, btnY, (rw - 20) / 2, btnH);
  L.refNext = R(L.refBack.x + L.refBack.w + 20, btnY, (rw - 20) / 2, btnH);
  L.refWide = R(L.refBack.x, btnY, rw, btnH);
  L.refCounterY = btnY - 14;
  const pw0 = Math.min(U.w - 68, 900);
  L.refPanel = { x: U.x0 + (U.w - pw0) / 2, y: U.y0 + 92, w: pw0 };
  L.refPanel.maxH = btnY - 70 - L.refPanel.y;

  if (!land) {
    const compact = h < 1230;
    L.mode = compact ? 'compact' : 'tall';
    const headY = U.y0 + 14, headH = compact ? 62 : 70, boardTop0 = Math.max(headY + headH + (compact ? 10 : 14), ins.back ? L.backBox.y + L.backBox.h + 4 : 0);
    const barH = compact ? 68 : 74, chipH = compact ? 64 : 74, msgH0 = compact ? 84 : 98, tableMin = compact ? 150 : 170;
    const bottom = U.y1 - 14, gap = 10;
    const below = (tableH, msgH) => 12 + chipH + gap + msgH + gap + tableH + 12 + barH;
    const A = bottom - boardTop0;
    let tableH = compact ? 156 : 196, msgH = msgH0;
    let B = Math.min(U.w - 24, A - below(tableH, msgH));
    if (B < 400) { tableH = tableMin; B = Math.min(U.w - 24, A - below(tableH, msgH)); }
    B = Math.max(B, 260);
    let extra = Math.max(0, A - below(tableH, msgH) - B);
    const gT = Math.min(extra * 0.55, 200); tableH += gT; extra -= gT;
    const gM = Math.min(extra * 0.4, 40); msgH += gM; extra -= gM;
    const s = B / BOARD_SIZE;
    const bx = U.x0 + (U.w - B) / 2, by = boardTop0 + extra * 0.35;
    L.board = { x: bx, y: by, s, size: B };
    let y = by + B + 12 + extra * 0.65;
    L.chipBox = { mode: 'row', x: U.x0 + 20, y, w: U.w - 40, h: chipH };
    y += chipH + gap;
    L.msg = R(U.x0 + 20, y, U.w - 40, msgH); y += msgH + gap;
    L.table = R(U.x0 + 20, y, U.w - 40, tableH); y += tableH + 12;
    const bh = Math.max(60, bottom - y);
    L.dieHome = { x: L.table.x + L.table.w / 2, y: L.table.y + L.table.h / 2 - 2 };
    const bw = U.w - 40, sideW = Math.round(bw * 0.215), midW = bw - 2 * sideW - 32;
    L.bar = { menu: R(U.x0 + 20, y, sideW, bh), roll: R(U.x0 + 20 + sideW + 16, y, midW, bh), hint: R(U.x0 + 20 + sideW + 16 + midW + 16, y, sideW, bh), sound: null };
    // demo: Exit | - | Pause | + | Speed
    const e = Math.round(bw * 0.165), t = Math.round(bw * 0.133), sp = Math.round(bw * 0.165), pw = bw - e - 2 * t - sp - 16 * 4;
    const dx = U.x0 + 20;
    L.demo = { exit: R(dx, y, e, bh), tdec: R(dx + e + 16, y, t, bh), pause: R(dx + e + t + 32, y, pw, bh), tinc: R(dx + e + t + pw + 48, y, t, bh), speed: R(dx + e + 2 * t + pw + 64, y, sp, bh) };
    L.head.menu = ins.back ? null : R(U.x0 + 16, headY, 120, headH);
    L.head.sound = R(U.x1 - 136, headY, 120, headH);
    L.head.title = { x: w / 2, y: headY + headH * 0.72, maxW: Math.max(140, L.head.sound.x - (L.head.menu ? L.head.menu.x + 120 : zl + 20) - 30) };
    L.demoLabelY = L.table.y + 28;
    L.msgMin = 22;
    return L;
  }

  // ---- landscape -------------------------------------------------------------------------------------------------------------
  const pad = 12, top = U.y0 + pad, bottom = U.y1 - pad, Hc = bottom - top;
  const backClear = ins.back ? L.backBox.h + 6 : 0;
  const wide = w >= 1.75 * h;
  L.mode = wide ? 'three' : 'two';
  L.msgMin = 18;
  const chipH = n > 2 ? 56 : 62;
  if (!wide) {
    const B = Math.min(Hc, U.w - 300 - 3 * pad), s = B / BOARD_SIZE;
    const bx = U.x1 - pad - B, by = top + (Hc - B) / 2;
    L.board = { x: bx, y: by, s, size: B };
    const cx = U.x0 + pad, cw = bx - pad - cx;
    let y = top + backClear;
    L.chipBox = { mode: 'col', x: cx, y, w: cw, h: chipH };
    y += chipsHeight(L.chipBox, n) + 8;
    const barHt = 72 + 8 + 56;                     // roll + row
    let tableH = 150, msgH = bottom - y - tableH - barHt - 16;
    if (msgH < 84) { tableH = Math.max(120, tableH - (84 - msgH)); msgH = Math.max(70, bottom - y - tableH - barHt - 16); }
    L.msg = R(cx, y, cw, msgH); y += msgH + 8;
    L.table = R(cx, y, cw, tableH); y += tableH + 8;
    L.dieHome = { x: L.table.x + L.table.w / 2, y: L.table.y + L.table.h / 2 - 2 };
    L.bar = barColumn(cx, y, cw, 72, 56);
    L.demo = demoColumn(cx, y, cw, 72, 56);
    L.demoLabelY = L.table.y + 24;
    return L;
  }
  // three columns, centred as a group
  const colMin = 250, colMax = 500;
  const B = Math.min(Hc, U.w - 2 * colMin - 4 * pad), s = B / BOARD_SIZE;
  const cw = clamp((U.w - B - 4 * pad) / 2, colMin, colMax);
  const total = B + 2 * cw + 4 * pad, gx = U.x0 + (U.w - total) / 2;
  const lx = gx + pad, bx = lx + cw + pad, rx = bx + B + pad;
  L.board = { x: bx, y: top + (Hc - B) / 2, s, size: B };
  let y = top + backClear;
  L.chipBox = { mode: 'col', x: lx, y, w: cw, h: chipH + 4 };
  y += chipsHeight(L.chipBox, n) + 10;
  L.msg = R(lx, y, cw, Math.max(100, bottom - y));
  const barHt = 84 + 8 + 60;
  const tableH = Math.min(460, bottom - top - barHt - 12);
  L.table = R(rx, top, cw, tableH);
  L.dieHome = { x: L.table.x + L.table.w / 2, y: L.table.y + L.table.h / 2 - 2 };
  L.bar = barColumn(rx, bottom - barHt, cw, 84, 60);
  L.demo = demoColumn(rx, bottom - barHt, cw, 84, 60);
  L.demoLabelY = L.table.y + 28;
  return L;
}
