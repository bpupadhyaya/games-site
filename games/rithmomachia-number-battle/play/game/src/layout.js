// Geometry as a function of the LIVE screen size (kit fluid viewport: the short side is always 720 units, the long side follows the screen).
// `layoutFor(w, h, flip)` returns every rectangle for that size; it is cached, so a frame never recomputes it.
// The board is 8 files by 16 ranks. It is drawn TALL (ranks run up the screen) or WIDE (turned a quarter turn, ranks run across), whichever
// gives the bigger squares, with the info plates, message line and buttons either stacked around it or in a card beside it:
//   tall-stack   portrait phones: opponent plate, message, board, your plate, buttons
//   wide-stack   squarish screens and tablets: both plates on one row, message, board across the width, buttons
//   wide-side    landscape: board across, one card on the right with plates, message and buttons
//   tall-side    tablets in portrait: board tall on the left, the same card on the right
export const THINK_STEPS = [2, 5, 8, 10];
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export const R = (x, y, w, h) => ({ x, y, w, h });
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Safe areas and the host's floating back button, in virtual units. main.js keeps this current (browsers: all zero).
// px = css pixels per virtual unit (type never goes below ~11 css px); dpr = device pixel ratio (sprite resolution).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6, dpr: 2 };

export const FRAME = 0.62, THICK = 0.2;
const cache = new Map();
export function layoutFor(w, h, flip = false) {
  w = Math.round(w); h = Math.round(h);
  const key = `${w}x${h}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}|${flip ? 1 : 0}`;
  let L = cache.get(key);
  if (!L) { L = build(w, h, { ...host }, flip); L.key = key; cache.set(key, L); if (cache.size > 40) cache.delete(cache.keys().next().value); }
  return L;
}

// A board of 8 x 16 squares at `cell` units, outer corner at (x, y). tall: ranks run down the screen. flip: the player holding Ink sits at the near edge.
export function boardAt(x, y, cell, tall, flip) {
  const cols = tall ? 8 : 16, rows = tall ? 16 : 8, W = (cols + 2 * FRAME) * cell, H = (rows + 2 * FRAME) * cell;
  const gx = x + FRAME * cell, gy = y + FRAME * cell;
  // logical square (rank r, file c) -> grid position (u across, v down)
  const grid = (i) => {
    let r = i >> 3, c = i & 7; if (flip) { r = 15 - r; c = 7 - c; }
    return tall ? [c, r] : [15 - r, c];
  };
  const sq = (i) => { const [u, v] = grid(i); return { x: gx + (u + 0.5) * cell, y: gy + (v + 0.5) * cell }; };
  const squareAt = (px, py) => {
    const u = Math.floor((px - gx) / cell), v = Math.floor((py - gy) / cell);
    if (u < 0 || u >= cols || v < 0 || v >= rows) return -1;
    let r, c; if (tall) { c = u; r = v; } else { r = 15 - u; c = v; }
    if (flip) { r = 15 - r; c = 7 - c; }
    return r * 8 + c;
  };
  return { x, y, W, H, cell, gx, gy, cols, rows, tall, flip, thick: THICK * cell, h: H + THICK * cell, sq, squareAt, grid, rect: R(x, y, W, H + THICK * cell) };
}

function build(w, h, ins, flip) {
  const L = { w, h, land: w >= h, ins, flip };
  const land = L.land;
  const backSz = ins.back ? Math.max(ins.back, 56) : 0;
  L.backBox = ins.back ? R(ins.l, ins.t, backSz + 8, backSz + 8) : R(0, 0, 0, 0);
  const U = L.U = { x0: ins.l, y0: ins.t, x1: w - ins.r, y1: h - ins.b };
  U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  const BH = clamp(Math.round(50 / (ins.px || 0.6)), 62, 84), G = 10;
  L.BH = BH;
  const pad = 12;
  const OW_T = 8 + 2 * FRAME, OH_T = 16 + 2 * FRAME;       // outer size in cells, tall
  const plateMin = 66, msgMin = 78, backRes = ins.back ? 62 : 0;
  const top0 = Math.max(ins.t + 6, backRes ? ins.t + backRes : 0), bottom0 = h - Math.max(ins.b, 10);
  const availH = (fixed) => bottom0 - top0 - fixed;
  // candidates: [mode, cell]
  const fixTall = 2 * plateMin + msgMin + BH + 6 * G, fixWide = plateMin + msgMin + BH + 5 * G;
  const cTall = Math.min((U.w - 2 * pad) / OW_T, availH(fixTall) / (OH_T + THICK));
  const cWide = Math.min((U.w - 2 * pad) / OH_T, availH(fixWide) / (OW_T + THICK));
  const cardW = clamp(U.w * 0.22, 240, 330);
  const cWideSide = Math.min((U.w - cardW - 3 * G - 2 * pad) / OH_T, (U.h - 2 * pad) / (OW_T + THICK));
  const cardWt = clamp(U.w * 0.3, 240, 340);
  const cTallSide = Math.min((U.w - cardWt - 3 * G - 2 * pad) / OW_T, (U.h - 2 * pad - Math.max(0, backRes - 14)) / (OH_T + THICK));
  let mode = 'tall-stack', cell = cTall;
  if (cWide > cell * 1.04) { mode = 'wide-stack'; cell = cWide; }
  if (cTallSide > cell * (h / w < 1.8 ? 0.97 : 1.04)) { mode = 'tall-side'; cell = cTallSide; }
  if (cWideSide > cell * (land ? 0.92 : 1.04)) { mode = 'wide-side'; cell = cWideSide; }
  cell = Math.max(cell, 18);
  L.mode = mode; L.layoutKind = mode;
  const tall = mode === 'tall-stack' || mode === 'tall-side';
  L.tall = tall;

  if (mode === 'wide-side' || mode === 'tall-side') {
    const cw0 = mode === 'tall-side' ? cardWt : cardW;
    const bw = cell * (tall ? OW_T : OH_T), bh = cell * ((tall ? OH_T : OW_T) + THICK), gap = G + 4;
    const total = bw + gap + cw0;
    const bx = U.x0 + Math.max(pad, (U.w - total) / 2), by = U.y0 + (U.h - bh) / 2 + (tall && ins.back ? Math.max(0, backRes - 14) / 2 : 0);
    const board = boardAt(bx, by, cell, tall, flip);
    const cx = bx + bw + gap, cardTop = ins.back ? Math.max(U.y0 + pad, L.backBox.y + L.backBox.h + 2) : U.y0 + pad, cardH = U.y1 - pad - cardTop;
    L.rightCard = R(cx, cardTop, Math.min(cw0, U.x1 - 6 - cx), cardH); L.leftCard = null;
    const rc = L.rightCard, iw = { x: rc.x + 14, w: rc.w - 28 };
    const ph = clamp((cardH - 56) * 0.14, 76, 140), msgH = clamp((cardH - 56) * 0.14, 76, 150), bh2 = BH;
    let y = rc.y + 56;
    L.plateTop = R(iw.x, y, iw.w, ph); y += ph + G;
    L.msg = R(iw.x, y, iw.w, msgH); y += msgH + G;
    L.plateBot = R(iw.x, y, iw.w, ph); y += ph + G;
    const bwid = clamp(rc.w - 28, 120, 340), bxr = rc.x + (rc.w - bwid) / 2, stackH = 4 * bh2 + 3 * G;
    const y0 = Math.max(y + 6, rc.y + rc.h - 14 - stackH);
    const bh4 = clamp((rc.y + rc.h - 14 - (y + 6) - 3 * G) / 4, 56, bh2), y4 = Math.max(y + 6, rc.y + rc.h - 14 - (4 * bh4 + 3 * G));   // Auto Play has four buttons: shrink them so they always fit
    L.BTN = { menu: R(bxr, y0, bwid, bh2), undo: R(bxr, y0 + bh2 + G, bwid, bh2), hint: R(bxr, y0 + 2 * (bh2 + G), bwid, bh2) };
    L.BTN.auto = { exit: R(bxr, y4, bwid, bh4), pause: R(bxr, y4 + bh4 + G, bwid, bh4), dec: R(bxr, y4 + 2 * (bh4 + G), bwid, bh4), inc: R(bxr, y4 + 3 * (bh4 + G), bwid, bh4) };
    L.rightHead = R(rc.x + 14, rc.y + 12, rc.w - 28, 40);
    L.lessonBox = R(iw.x, rc.y + 56, iw.w, ph + G + msgH + G + ph);
    L.badge = { cx: rc.x + rc.w / 2, bottom: rc.y + rc.h - 12, w: rc.w - 28, show: rc.y + rc.h - 12 - (y0 + 4 * bh2 + 3 * G) > 90 };
    L.board = board;
  } else {
    const bh = cell * ((tall ? OH_T : OW_T) + THICK), bw = cell * (tall ? OW_T : OH_T);
    const duo = !tall, rows = duo ? 1 : 2;
    const fixed = rows * plateMin + msgMin + BH + (rows + 4) * G;
    const free = Math.max(0, bottom0 - top0 - fixed - bh);
    const plateH = plateMin + Math.min(free * 0.45, 70), air = Math.max(0, free - rows * (plateH - plateMin));
    const gA = air / (rows + 4);
    const barY = bottom0 - BH;
    const pw = Math.min(U.w - 2 * pad, 1000), px0 = U.x0 + (U.w - pw) / 2;
    let y = top0 + gA;
    if (duo) {
      const hw = (pw - G) / 2;
      L.plateTop = R(px0, y, hw, plateH); L.plateBot = R(px0 + hw + G, y, hw, plateH); y += plateH + G + gA;
      L.msg = R(px0, y, pw, msgMin); y += msgMin + G + gA;
    } else {
      L.plateTop = R(px0, y, pw, plateH); y += plateH + G + gA;
      L.msg = R(px0, y, pw, msgMin); y += msgMin + G + gA;
    }
    const board = boardAt(U.x0 + (U.w - bw) / 2, y, cell, tall, flip); y += bh + G + gA;
    if (!duo) L.plateBot = R(px0, y, pw, plateH);
    L.barY = barY;
    const bwd = Math.min(210, (U.w - 60 - 2 * 20) / 3), bx = U.x0 + (U.w - (3 * bwd + 2 * 20)) / 2;
    L.BTN = { menu: R(bx, barY, bwd, BH), undo: R(bx + bwd + 20, barY, bwd, BH), hint: R(bx + 2 * (bwd + 20), barY, bwd, BH) };
    const aw = (U.w - 2 * bx + U.x0 * 0 + 8 - 3 * 12) / 4;
    L.BTN.auto = { exit: R(bx - 4, barY, aw, BH), pause: R(bx - 4 + aw + 12, barY, aw, BH), dec: R(bx - 4 + 2 * (aw + 12), barY, aw, BH), inc: R(bx - 4 + 3 * (aw + 12), barY, aw, BH) };
    L.lessonBox = duo ? R(px0, L.plateTop.y, pw, plateH + G + msgMin) : R(px0, L.plateTop.y, pw, plateH + G + msgMin);
    L.board = board;
  }
  const board = L.board;
  L.sq = board.sq; L.squareAt = board.squareAt; L.cell = board.cell;
  // the angle a side's pieces point at: toward the other side's camp
  const base = board.tall ? 0 : Math.PI / 2;
  L.ang = (side) => ((side === 1) !== flip ? base : base + Math.PI);
  // the result card, centred over the board
  const cw = clamp(Math.min(U.w - 40, 560), 300, 600), ch = land ? Math.min(U.h - 30, 600) : Math.min(700, U.h - 60);
  L.over = { card: R(U.x0 + (U.w - cw) / 2, U.y0 + (U.h - ch) / 2, cw, ch) };
  const ow = cw - 80;
  L.over.again = R(L.over.card.x + 40, L.over.card.y + ch - 40 - 84 - 12 - 84 - 46, ow, 84);
  L.over.back = R(L.over.card.x + 40, L.over.card.y + ch - 40 - 84 - 46, ow, 84);
  L.BTN.again = L.over.again; L.BTN.back = L.over.back;
  L.BTN.next = (mode === 'wide-side' || mode === 'tall-side') ? L.BTN.undo : R(L.BTN.undo.x, L.BTN.undo.y, L.BTN.hint.x + L.BTN.hint.w - L.BTN.undo.x, L.BTN.undo.h);
  L.title = (hasSave) => buildTitle(L, !!hasSave);
  L.doc = buildDoc(L);
  return L;
}

// ---------------------------------------------------------------- title
const titleCache = new WeakMap();
function buildTitle(L, hasSave) {
  const memo = titleCache.get(L) || {}; titleCache.set(L, memo);
  if (memo[hasSave]) return memo[hasSave];
  const { w, h, U, ins } = L, T = { rows: {}, hero: null, card: null, lockup: null };
  const names = [hasSave ? ['resume'] : null, ['play'], ['two', 'learn'], ['auto'], ['rules', 'how'], ['about', 'settings']].filter(Boolean);
  const n = names.length;
  const place = (x0, aw, y0, pitch, bh) => names.forEach((row, i) => {
    const y = y0 + i * pitch;
    if (row.length === 1) T.rows[row[0]] = R(x0, y, aw, bh);
    else { const cw = (aw - 12) / 2; T.rows[row[0]] = R(x0, y, cw, bh); T.rows[row[1]] = R(x0 + cw + 12, y, cw, bh); }
  });
  if (!L.land) {
    const lock = 64, bottom = h - Math.max(14, ins.b + 6), bw = Math.min(U.w - 56, 560);
    const minP = clamp(Math.round(46 / (ins.px || 0.6)) + 12, 58, 98);
    const pitch = clamp((bottom - lock - (U.y0 + 470)) / n, minP, 98), bh = pitch - 12;
    const y0 = bottom - lock - n * pitch + 12;
    place(U.x0 + (U.w - bw) / 2, bw, y0, pitch, bh);
    T.lockup = { x: w / 2, y: bottom - 14 };
    const zoneTop = Math.max(ins.t + 8, ins.back ? ins.t + 60 : 0), zone = y0 - 12 - zoneTop;
    T.hero = R(U.x0 + 10, zoneTop, U.w - 20, zone);
  } else {
    const aw = clamp(w * 0.38, 380, 560), ax = U.x1 - aw - 16, lock = 56;
    const pitch = Math.min(92, (U.h - 40 - lock) / n), bh = pitch - 12, y0 = U.y0 + (U.h - n * pitch - lock) / 2 + 6;
    place(ax + 24, aw - 48, y0, pitch, bh);
    T.card = R(ax, y0 - 24, aw, n * pitch + lock + 28);
    T.lockup = { x: ax + aw / 2, y: T.card.y + T.card.h - 14 };
    T.hero = R(U.x0 + 10, U.y0 + 10, ax - U.x0 - 30, U.h - 20);
  }
  memo[hasSave] = T;
  return T;
}

// ---------------------------------------------------------------- scrolling documents (Rules, How to Play, About, Settings)
function buildDoc(L) {
  const { h, U, ins } = L, BH = 84, barY = h - Math.max(ins.b, 10) - BH - 12;
  const pw = Math.min(U.w - 28, 1000), px = U.x0 + (U.w - pw) / 2, py = Math.max(14, ins.t + 6, ins.back && !L.land ? ins.t + 62 : 0);
  const panel = R(px, py, pw, barY - 12 - py);
  const nw = Math.min(262, (pw - 16) / 2), navX = U.x0 + (U.w - (2 * nw + 16)) / 2;
  const headH = 84;
  const viewport = R(panel.x + 18, panel.y + headH + 8, panel.w - 36 - 14, panel.h - headH - 8 - 44);
  const hb = Math.min(104, panel.w * 0.16);
  return {
    panel, viewport, nav: { back: R(navX, barY, nw, BH), next: R(navX + nw + 16, barY, nw, BH) },
    header: { textDec: R(panel.x + panel.w - 18 - hb * 2 - 10, panel.y + 12, hb, 62), textInc: R(panel.x + panel.w - 18 - hb, panel.y + 12, hb, 62) },
    scrollbar: R(panel.x + panel.w - 30, viewport.y, 22, viewport.h), counterY: panel.y + panel.h - 16, cx: panel.x + panel.w / 2,
    bodyW: Math.min(viewport.w - 28, 860),
  };
}
