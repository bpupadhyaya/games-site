// Geometry as a function of the LIVE screen size (kit fluid viewport: the short side is always 720 units, the long side follows the screen).
// `layoutFor(w, h)` returns every rectangle for that size; it is cached, so a frame never recomputes it.
//   portrait   opponent plate, message line, board, your plate, button bar - the free height is shared out, the board is as wide as the screen allows
//   landscape  board in the middle (as tall as the screen allows), an info card on the left and a button card on the right; on a squarer
//              screen (4:3) one card on the right carries everything
export const THINK_STEPS = [2, 5, 8, 10];
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export const R = (x, y, w, h) => ({ x, y, w, h });
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Safe areas and the host's floating back button, in virtual units. main.js keeps this current (browsers: all zero).
// px = css pixels per virtual unit (type never goes below ~11 css px); dpr = device pixel ratio (sprite resolution).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6, dpr: 2 };

const FRAME = 0.55, THICK = 0.22, OUTER = 9 + 2 * FRAME;          // board: frame margin and slab thickness in cells; outer width in cells
export const BOARD_CELLS = OUTER;
const cache = new Map();
export function layoutFor(w, h, flip = false) {
  w = Math.round(w); h = Math.round(h);
  const key = `${w}x${h}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}|${flip ? 1 : 0}`;
  let L = cache.get(key);
  if (!L) { L = build(w, h, { ...host }, flip); L.key = key; cache.set(key, L); if (cache.size > 40) cache.delete(cache.keys().next().value); }
  return L;
}

function boardAt(cx, top, cell, flip) {
  const S = OUTER * cell, x = cx - S / 2, gx = x + FRAME * cell, gy = top + FRAME * cell;
  const sq = (i) => { const r = (i / 9) | 0, c = i % 9, rr = flip ? 8 - r : r, cc = flip ? 8 - c : c; return { x: gx + (cc + 0.5) * cell, y: gy + (rr + 0.5) * cell }; };
  const squareAt = (px, py) => {
    const cc = Math.floor((px - gx) / cell), rr = Math.floor((py - gy) / cell);
    if (cc < 0 || cc > 8 || rr < 0 || rr > 8) return -1;
    return (flip ? 8 - rr : rr) * 9 + (flip ? 8 - cc : cc);
  };
  return { x, y: top, S, cell, gx, gy, thick: THICK * cell, h: S + THICK * cell, sq, squareAt, flip, rect: R(x, top, S, S + THICK * cell) };
}

function build(w, h, ins, flip) {
  const land = w >= h;
  const L = { w, h, land, ins, flip };
  const backSz = ins.back ? Math.max(ins.back, 56) : 0;
  L.backBox = ins.back ? R(ins.l, ins.t, backSz + 8, backSz + 8) : R(0, 0, 0, 0);
  const U = L.U = { x0: ins.l, y0: ins.t, x1: w - ins.r, y1: h - ins.b };
  U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  const BH = clamp(Math.round(50 / (ins.px || 0.6)), 62, 84), G = 12;                                                    // button height, gap
  L.BH = BH;
  L.mode = land ? 'wide' : 'tall';

  // ---------------------------------------------------------------- play layout
  let cell, board;
  if (!land) {
    const pad = 12, backRes = ins.back ? 62 : 0, cellW = (U.w - 2 * pad) / OUTER;
    const fixedFor = (mp, mh, rows) => BH + rows * mp + mh + (rows + 3) * G + Math.max(0, ins.b - 8) + Math.max(ins.t, 8) + (backRes && rows === 1 ? 0 : 0);
    let minPlate = 124, msgH = 64, rows = 2, cellH = (h - fixedFor(minPlate, msgH, 2)) / (OUTER + THICK);
    if (cellH < cellW * 0.95) { minPlate = 86; msgH = 46; cellH = (h - fixedFor(minPlate, msgH, 2)) / (OUTER + THICK); }
    if (cellH < cellW * 0.95) { rows = 1; minPlate = 100; msgH = 46; cellH = (h - fixedFor(minPlate, msgH, 1)) / (OUTER + THICK); }   // squat screen: both plates side by side above the board
    cell = Math.min(cellW, cellH);
    const bh = (OUTER + THICK) * cell, barY = h - Math.max(ins.b, 10) - BH - 12;
    const top0 = Math.max(ins.t + 6, backRes ? ins.t + backRes : 0);
    const free = barY - G - top0 - bh - msgH - rows * minPlate - (rows + 1) * G;
    // spare height first makes the plates roomier (bigger type and tray), what is left becomes even breathing room around the board
    const plateH = minPlate + (rows === 2 && free > 0 ? Math.min(free * 0.5, 120) : 0);
    const air = Math.max(0, free - (rows === 2 ? 2 * (plateH - minPlate) : 0));
    const gA = air / 5;
    let y = top0 + gA;
    const pw = w - 2 * pad - 12;
    if (rows === 2) { L.plateTop = R(pad + 6, y, pw, plateH); y += plateH + G + gA; L.msg = R(pad + 6, y, pw, msgH); y += msgH + 4 + gA * 0.5; }
    else { const hw = (pw - G) / 2; L.plateTop = R(pad + 6, y, hw, minPlate); L.plateBot = R(pad + 6 + hw + G, y, hw, minPlate); y += minPlate + G + gA; L.msg = R(pad + 6, y, pw, msgH); y += msgH + 4 + gA * 0.5; }
    board = boardAt(w / 2, y, cell, flip); y += board.h + G + gA * 1.5;
    if (rows === 2) L.plateBot = R(pad + 6, y, pw, plateH);
    L.barY = barY;
    const bw = Math.min(210, (w - 60 - 2 * 20) / 3), bx = (w - (3 * bw + 2 * 20)) / 2;
    L.BTN = { menu: R(bx, barY, bw, BH), undo: R(bx + bw + 20, barY, bw, BH), hint: R(bx + 2 * (bw + 20), barY, bw, BH) };
    const aw = (w - 2 * bx + 8 - 3 * 12) / 4;
    L.BTN.auto = { exit: R(bx - 4, barY, aw, BH), pause: R(bx - 4 + aw + 12, barY, aw, BH), dec: R(bx - 4 + 2 * (aw + 12), barY, aw, BH), inc: R(bx - 4 + 3 * (aw + 12), barY, aw, BH) };
    L.lessonBox = rows === 2 ? R(L.plateTop.x, L.plateTop.y, L.plateTop.w, L.plateTop.h + G + msgH) : R(L.plateTop.x, L.plateTop.y, pw, minPlate + G + msgH);
    L.layoutKind = rows === 2 ? 'portrait' : 'portrait-duo';
  } else {
    const pad = 12, panelMin = 250, gap = 14;
    const cellH = (U.h - 2 * pad) / (OUTER + THICK);
    const twoW = (U.w - 2 * panelMin - 4 * gap) / OUTER;
    let two = cellH <= twoW;
    cell = two ? cellH : Math.min(cellH, (U.w - panelMin - 3 * gap - 16) / OUTER);
    cell = Math.max(cell, 30);
    const bh = (OUTER + THICK) * cell, S = OUTER * cell;
    const topB = U.y0 + (U.h - bh) / 2;
    const cardTop = ins.back ? Math.max(U.y0 + pad, L.backBox.y + L.backBox.h + 4) : U.y0 + pad, cardH = U.y1 - pad - cardTop;
    if (two) {
      const bx = U.x0 + (U.w - S) / 2, lw = bx - U.x0 - gap - 6, rw = U.x1 - (bx + S) - gap - 6;
      board = boardAt(bx + S / 2, topB, cell, flip);
      L.leftCard = R(U.x0 + 6, cardTop, lw, cardH); L.rightCard = R(bx + S + gap, cardTop, rw, cardH);
      L.layoutKind = 'wide2';
    } else {
      const rw = Math.max(panelMin, U.w - S - 3 * gap - 16), bx = U.x0 + gap + 4;
      board = boardAt(bx + S / 2, topB, cell, flip);
      L.rightCard = R(bx + S + gap, cardTop, U.x1 - 6 - (bx + S + gap), cardH); L.leftCard = null;
      L.layoutKind = 'wide1';
    }
    // contents of the cards
    const rc = L.rightCard, lc = L.leftCard, bw = clamp(rc.w - 28, 120, 340), bxr = rc.x + (rc.w - bw) / 2;
    const inner = (c) => ({ x: c.x + 14, w: c.w - 28 });
    if (lc) {
      const iw = inner(lc), ph = clamp(cardH * 0.3, 120, 210);
      L.plateTop = R(iw.x, lc.y + 14, iw.w, ph);
      L.plateBot = R(iw.x, lc.y + lc.h - 14 - ph, iw.w, ph);
      L.msg = R(iw.x, L.plateTop.y + ph + G, iw.w, Math.max(60, L.plateBot.y - G - (L.plateTop.y + ph + G)));
      // buttons on the right card, vertically stacked in the middle
      const n = 3, total = n * BH + (n - 1) * G, y0 = rc.y + 70 + Math.max(0, (rc.h - 70 - 110 - total) / 2);
      L.BTN = { menu: R(bxr, y0, bw, BH), undo: R(bxr, y0 + BH + G, bw, BH), hint: R(bxr, y0 + 2 * (BH + G), bw, BH) };
      L.BTN.auto = { exit: R(bxr, y0, bw, BH), pause: R(bxr, y0 + BH + G, bw, BH), dec: R(bxr, y0 + 2 * (BH + G), bw, BH), inc: R(bxr, y0 + 3 * (BH + G), bw, BH) };
      L.rightHead = R(rc.x + 14, rc.y + 14, rc.w - 28, 48);
      L.lessonBox = R(lc.x + 10, lc.y + 14, lc.w - 20, lc.h - 28);
      L.badge = { cx: rc.x + rc.w / 2, bottom: rc.y + rc.h - 14, w: rc.w - 28, show: rc.y + rc.h - 14 - (y0 + 4 * BH + 3 * G) > 100 };
    } else {
      const iw = inner(rc), ph = clamp(cardH * 0.17, 90, 140), msgH2 = clamp(cardH * 0.17, 80, 130);
      const bh2 = BH, total = 3 * bh2 + 2 * G;
      let y = rc.y + 14;
      L.plateTop = R(iw.x, y, iw.w, ph); y += ph + G;
      L.msg = R(iw.x, y, iw.w, msgH2); y += msgH2 + G;
      L.plateBot = R(iw.x, y, iw.w, ph); y += ph + G + 4;
      const stack = rc.y + rc.h - 14 - 4 * bh2 - 3 * G;
      const y0 = Math.max(y, stack);
      L.BTN = { menu: R(bxr, y0, bw, bh2), undo: R(bxr, y0 + bh2 + G, bw, bh2), hint: R(bxr, y0 + 2 * (bh2 + G), bw, bh2) };
      L.BTN.auto = { exit: R(bxr, y0, bw, bh2), pause: R(bxr, y0 + bh2 + G, bw, bh2), dec: R(bxr, y0 + 2 * (bh2 + G), bw, bh2), inc: R(bxr, y0 + 3 * (bh2 + G), bw, bh2) };
      L.lessonBox = R(iw.x, rc.y + 14, iw.w, ph + G + msgH2);
      L.badge = { show: false };
    }
  }
  L.board = board;
  L.sq = board.sq; L.squareAt = board.squareAt;
  L.cell = board.cell;
  // the result card, centred over the board
  const cw = clamp(Math.min(U.w - 40, 560), 300, 600), ch = land ? Math.min(U.h - 30, 600) : Math.min(700, U.h - 60);
  L.over = { card: R(U.x0 + (U.w - cw) / 2, U.y0 + (U.h - ch) / 2, cw, ch) };
  const ow = cw - 80;
  L.over.again = R(L.over.card.x + 40, L.over.card.y + ch - 40 - 84 - 12 - 84 - 46, ow, 84);
  L.over.back = R(L.over.card.x + 40, L.over.card.y + ch - 40 - 84 - 46, ow, 84);
  L.BTN.again = L.over.again; L.BTN.back = L.over.back; L.BTN.next = L.land ? L.BTN.undo : L.BTN.undo;
  L.BTN.next = R(L.BTN.undo.x, L.BTN.undo.y, L.BTN.undo.w + (L.BTN.hint.x + L.BTN.hint.w - L.BTN.undo.x - L.BTN.undo.w), L.BTN.undo.h);
  if (land) L.BTN.next = L.BTN.undo;
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
    let pitch = clamp((bottom - lock - (U.y0 + 470)) / n, minP, 98), bh = pitch - 12;
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
