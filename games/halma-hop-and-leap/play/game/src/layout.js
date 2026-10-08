// Geometry as a function of the LIVE screen size (kit fluid viewport: the short side is always 720 units, the long side follows the screen).
// `layoutFor(w, h, variant)` returns every rectangle for that size; it is cached, so a frame never recomputes it.
//   portrait   seat chips (one per player), board as wide as the screen allows, message line, button bar - spare height is shared out
//   landscape  board as tall as the screen allows; the seat chips + message on a card at one side and the buttons on a card at the other,
//              or all on one card on a squarer screen (4:3)
import { VARIANTS } from './rules.js';
export const THINK_STEPS = [2, 5, 8, 10];
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export const R = (x, y, w, h) => ({ x, y, w, h });
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Safe areas and the host's floating back button, in virtual units. main.js keeps this current (browsers: all zero).
// px = css pixels per virtual unit (type never goes below ~11 css px); dpr = device pixel ratio (sprite resolution).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6, dpr: 2 };

const FRAME = 0.5, THICK = 0.22;
const cache = new Map();
export function layoutFor(w, h, variant = 'classic') {
  w = Math.round(w); h = Math.round(h);
  const key = `${w}x${h}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}|${variant}`;
  let L = cache.get(key);
  if (!L) { L = build(w, h, { ...host }, variant); L.key = key; cache.set(key, L); if (cache.size > 40) cache.delete(cache.keys().next().value); }
  return L;
}

function boardAt(cx, top, cell, n) {
  const OUT = n + 2 * FRAME, S = OUT * cell, x = cx - S / 2, gx = x + FRAME * cell, gy = top + FRAME * cell;
  const sq = (i) => ({ x: gx + ((i % n) + 0.5) * cell, y: gy + (((i / n) | 0) + 0.5) * cell });
  const squareAt = (px, py) => {
    const cc = Math.floor((px - gx) / cell), rr = Math.floor((py - gy) / cell);
    return cc < 0 || cc >= n || rr < 0 || rr >= n ? -1 : rr * n + cc;
  };
  return { x, y: top, S, cell, n, gx, gy, thick: THICK * cell, h: S + THICK * cell, sq, squareAt, rect: R(x, top, S, S + THICK * cell) };
}

function build(w, h, ins, variant) {
  const V = VARIANTS[variant], n = V.n, seats = V.corners.length, OUT = n + 2 * FRAME, land = w >= h;
  const L = { w, h, land, ins, variant, n, seats };
  const backSz = ins.back ? Math.max(ins.back, 56) : 0;
  L.backBox = ins.back ? R(ins.l, ins.t, backSz + 8, backSz + 8) : R(0, 0, 0, 0);
  const U = L.U = { x0: ins.l, y0: ins.t, x1: w - ins.r, y1: h - ins.b };
  U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  const BH = clamp(Math.round(50 / (ins.px || 0.6)), 62, 84), G = 12;                                                    // button height, gap
  L.BH = BH;
  let cell, board;
  if (!land) {
    const pad = 12, backRes = ins.back ? 62 : 0, cellW = (U.w - 2 * pad) / OUT;
    const fixedFor = (ch, mh) => BH + ch + mh + 4 * G + Math.max(0, ins.b - 8) + Math.max(ins.t, 8);
    let chipH = seats > 2 ? 104 : 112, msgH = 64, cellH = (h - fixedFor(chipH, msgH)) / (OUT + THICK);
    if (cellH < cellW * 0.95) { chipH = seats > 2 ? 84 : 78; msgH = 46; cellH = (h - fixedFor(chipH, msgH)) / (OUT + THICK); }
    cell = Math.min(cellW, cellH);
    const bh = (OUT + THICK) * cell, barY = h - Math.max(ins.b, 10) - BH - 12;
    const top0 = Math.max(ins.t + 6, backRes ? ins.t + backRes : 0);
    const free = barY - G - top0 - bh - msgH - chipH - 3 * G;
    const grow = free > 0 ? Math.min(free * 0.45, seats > 2 ? 40 : 70) : 0, air = Math.max(0, free - grow), gA = air / 4;
    const cH = chipH + grow;
    let y = top0 + gA;
    const pw = w - 2 * pad - 12, cw = (pw - (seats - 1) * G) / seats;
    L.chips = Array.from({ length: seats }, (_, k) => R(pad + 6 + k * (cw + G), y, cw, cH));
    y += cH + G + gA;
    board = boardAt(w / 2, y, cell, n); y += board.h + G + gA * 1.5;
    L.msg = R(pad + 6, y, pw, msgH);
    L.barY = barY;
    const bw = Math.min(210, (w - 60 - 2 * 20) / 3), bx = (w - (3 * bw + 2 * 20)) / 2;
    L.BTN = { menu: R(bx, barY, bw, BH), undo: R(bx + bw + 20, barY, bw, BH), hint: R(bx + 2 * (bw + 20), barY, bw, BH) };
    const aw = (w - 2 * bx + 8 - 3 * 12) / 4;
    L.BTN.auto = { exit: R(bx - 4, barY, aw, BH), pause: R(bx - 4 + aw + 12, barY, aw, BH), dec: R(bx - 4 + 2 * (aw + 12), barY, aw, BH), inc: R(bx - 4 + 3 * (aw + 12), barY, aw, BH) };
    L.lessonBox = R(pad + 6, top0 + gA, pw, cH + G + msgH);
    L.layoutKind = 'portrait';
  } else {
    const pad = 12, panelMin = 250, gap = 14;
    const cellH = (U.h - 2 * pad) / (OUT + THICK);
    const twoW = (U.w - 2 * panelMin - 4 * gap) / OUT;
    const two = cellH <= twoW;
    cell = two ? cellH : Math.min(cellH, (U.w - panelMin - 3 * gap - 16) / OUT);
    cell = Math.max(cell, 22);
    const bh = (OUT + THICK) * cell, S = OUT * cell, topB = U.y0 + (U.h - bh) / 2;
    const cardTop = ins.back ? Math.max(U.y0 + pad, L.backBox.y + L.backBox.h + 4) : U.y0 + pad, cardH = U.y1 - pad - cardTop;
    const inner = (c) => ({ x: c.x + 14, w: c.w - 28 });
    if (two) {
      const bx = U.x0 + (U.w - S) / 2, lw = bx - U.x0 - gap - 6, rw = U.x1 - (bx + S) - gap - 6;
      board = boardAt(bx + S / 2, topB, cell, n);
      L.leftCard = R(U.x0 + 6, cardTop, lw, cardH); L.rightCard = R(bx + S + gap, cardTop, rw, cardH);
      L.layoutKind = 'wide2';
      const lc = L.leftCard, rc = L.rightCard, iw = inner(lc), bw = clamp(rc.w - 28, 120, 340), bxr = rc.x + (rc.w - bw) / 2;
      const msgH = clamp(cardH * 0.22, 74, 140), chipH = clamp((cardH - 28 - msgH - seats * G) / seats, 56, 150);
      L.chips = Array.from({ length: seats }, (_, k) => R(iw.x, lc.y + 14 + k * (chipH + G), iw.w, chipH));
      L.msg = R(iw.x, lc.y + 14 + seats * (chipH + G), iw.w, Math.max(60, lc.y + lc.h - 14 - (lc.y + 14 + seats * (chipH + G))));
      const total = 4 * BH + 3 * G, y0 = rc.y + 70 + Math.max(0, (rc.h - 70 - 110 - total) / 2);
      L.BTN = { menu: R(bxr, y0, bw, BH), undo: R(bxr, y0 + BH + G, bw, BH), hint: R(bxr, y0 + 2 * (BH + G), bw, BH) };
      L.BTN.auto = { exit: R(bxr, y0, bw, BH), pause: R(bxr, y0 + BH + G, bw, BH), dec: R(bxr, y0 + 2 * (BH + G), bw, BH), inc: R(bxr, y0 + 3 * (BH + G), bw, BH) };
      L.rightHead = R(rc.x + 14, rc.y + 14, rc.w - 28, 48);
      L.lessonBox = R(lc.x + 10, lc.y + 14, lc.w - 20, lc.h - 28);
      L.badge = { cx: rc.x + rc.w / 2, bottom: rc.y + rc.h - 14, w: rc.w - 28, show: rc.y + rc.h - 14 - (y0 + 4 * BH + 3 * G) > 100 };
    } else {
      const bx = U.x0 + gap + 4;
      board = boardAt(bx + S / 2, topB, cell, n);
      L.rightCard = R(bx + S + gap, cardTop, U.x1 - 6 - (bx + S + gap), cardH); L.leftCard = null;
      L.layoutKind = 'wide1';
      const rc = L.rightCard, iw = inner(rc), bw = clamp(rc.w - 28, 120, 340), bxr = rc.x + (rc.w - bw) / 2, bh2 = Math.min(BH, 66);
      const btnH = 4 * bh2 + 3 * G, msgH = clamp(cardH * 0.16, 52, 110);
      const chipH = clamp((cardH - 28 - btnH - msgH - (seats + 1) * G - 8) / seats, 50, 120);
      let y = rc.y + 14;
      L.chips = Array.from({ length: seats }, (_, k) => R(iw.x, y + k * (chipH + G), iw.w, chipH)); y += seats * (chipH + G);
      L.msg = R(iw.x, y, iw.w, msgH); y += msgH + G;
      const y0 = Math.max(y, rc.y + rc.h - 14 - btnH);
      L.BTN = { menu: R(bxr, y0, bw, bh2), undo: R(bxr, y0 + bh2 + G, bw, bh2), hint: R(bxr, y0 + 2 * (bh2 + G), bw, bh2) };
      L.BTN.auto = { exit: R(bxr, y0, bw, bh2), pause: R(bxr, y0 + bh2 + G, bw, bh2), dec: R(bxr, y0 + 2 * (bh2 + G), bw, bh2), inc: R(bxr, y0 + 3 * (bh2 + G), bw, bh2) };
      L.lessonBox = R(iw.x, rc.y + 14, iw.w, rc.h - 28 - btnH - G);
      L.badge = { show: false };
    }
  }
  L.board = board; L.sq = board.sq; L.squareAt = board.squareAt; L.cell = board.cell;
  const cw = clamp(Math.min(U.w - 40, 560), 300, 600), ch = land ? Math.min(U.h - 30, 600) : Math.min(700, U.h - 60);
  L.over = { card: R(U.x0 + (U.w - cw) / 2, U.y0 + (U.h - ch) / 2, cw, ch) };
  const ow = cw - 80;
  L.over.again = R(L.over.card.x + 40, L.over.card.y + ch - 40 - 84 - 12 - 84 - 46, ow, 84);
  L.over.back = R(L.over.card.x + 40, L.over.card.y + ch - 40 - 84 - 46, ow, 84);
  L.BTN.again = L.over.again; L.BTN.back = L.over.back;
  L.BTN.next = land ? L.BTN.undo : R(L.BTN.undo.x, L.BTN.undo.y, L.BTN.hint.x + L.BTN.hint.w - L.BTN.undo.x, L.BTN.undo.h);
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
