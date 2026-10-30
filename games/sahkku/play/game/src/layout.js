// Geometry as a function of the LIVE screen size (kit fluid viewport: the short side is always 720 units, the long side follows the screen).
// `layoutFor(w, h)` returns every rectangle for that size; it is cached, so a frame never recomputes it.
//   portrait    opponent plate, message, board (as wide as the screen allows), dice tray, your plate, button bar
//   landscape   board next to a card with plates, message, dice and buttons; on a wide screen two cards, one each side of the board
import { N } from './rules.js';
import { FRAME } from './art.js';

export const THINK_STEPS = [2, 5, 8, 10];
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export const R = (x, y, w, h) => ({ x, y, w, h });
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Safe areas and the host's floating back button, in virtual units. main.js keeps this current (browsers: all zero).
// px = css pixels per virtual unit (type never goes below ~11 css px); dpr = device pixel ratio.
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6, dpr: 2 };

const OUTER = N + 2 * FRAME;
const cache = new Map();
export function layoutFor(w, h, flip = false) {
  w = Math.round(w); h = Math.round(h);
  const key = `${w}x${h}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}|${flip ? 1 : 0}`;
  let L = cache.get(key);
  if (!L) { L = build(w, h, { ...host }, flip); L.key = key; cache.set(key, L); if (cache.size > 40) cache.delete(cache.keys().next().value); }
  return L;
}

function boardAt(x, y, S, flip) {
  const cell = S / OUTER, gx = x + FRAME * cell, gy = y + FRAME * cell;
  const sq = (i) => { const r = Math.floor(i / N), c = i % N, rr = flip ? N - 1 - r : r, cc = flip ? N - 1 - c : c; return { x: gx + (cc + 0.5) * cell, y: gy + (rr + 0.5) * cell }; };
  const squareAt = (px, py) => {
    const cc = Math.floor((px - gx) / cell), rr = Math.floor((py - gy) / cell);
    if (cc < 0 || cc >= N || rr < 0 || rr >= N) return -1;
    return (flip ? N - 1 - rr : rr) * N + (flip ? N - 1 - cc : cc);
  };
  return { x, y, S, cell, gx, gy, sq, squareAt, flip, rect: R(x, y, S, S) };
}

function build(w, h, ins, flip) {
  const land = w >= h, L = { w, h, land, ins, flip };
  const backSz = ins.back ? Math.max(ins.back, 56) : 0;
  L.backBox = ins.back ? R(ins.l, ins.t, backSz + 8, backSz + 8) : R(0, 0, 0, 0);
  const U = L.U = { x0: ins.l, y0: ins.t, x1: w - ins.r, y1: h - ins.b };
  U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  const BH = clamp(Math.round(50 / (ins.px || 0.6)), 62, 84), G = 12;
  L.BH = BH;
  let board;
  const btns = (x, y, bw, vertical) => {
    const at = (i) => (vertical ? R(x, y + i * (BH + G), bw, BH) : R(x + i * (bw + G), y, bw, BH));
    return { menu: at(0), undo: at(1), hint: at(2), auto: { exit: at(0), pause: at(1), dec: at(2), inc: at(3) } };
  };
  if (!land) {
    const pad = 12, backRes = ins.back ? 62 : 0;
    const top0 = Math.max(ins.t + 6, backRes ? ins.t + backRes : 0), bottom = h - Math.max(ins.b, 10) - 6;
    const barY = bottom - BH, wMax = U.w - 2 * pad;
    const tray = clamp(U.w * 0.2, 92, 150), msgH = 56;
    const need = (ph, rows) => rows * ph + msgH + tray + BH + (rows + 5) * G;
    let rows = 2, ph = 104, S = Math.min(wMax, h - top0 - Math.max(ins.b, 10) - 6 - need(ph, rows));
    if (S < wMax * 0.8) { ph = 84; S = Math.min(wMax, h - top0 - Math.max(ins.b, 10) - 6 - need(ph, 2)); }
    if (S < wMax * 0.8) { rows = 1; ph = 92; S = Math.min(wMax, h - top0 - Math.max(ins.b, 10) - 6 - need(ph, 1)); }
    S = Math.max(S, 180);
    const free = h - top0 - Math.max(ins.b, 10) - 6 - need(ph, rows) - S;
    const plateH = ph + (rows === 2 && free > 0 ? Math.min(free * 0.45, 40) : 0), air = Math.max(0, free - (rows === 2 ? 2 * (plateH - ph) : 0)) / 6;
    const pw = U.w - 2 * pad; let y = top0 + air;
    if (rows === 2) { L.plateTop = R(U.x0 + pad, y, pw, plateH); y += plateH + G + air; }
    else { const hw = (pw - G) / 2; L.plateTop = R(U.x0 + pad, y, hw, ph); L.plateBot = R(U.x0 + pad + hw + G, y, hw, ph); y += ph + G + air; }
    L.msg = R(U.x0 + pad, y, pw - 190, msgH); L.badgeAt = { x: U.x1 - pad, y: y + (msgH - 40) / 2, align: 'right' }; y += msgH + G + air * 0.6;
    board = boardAt(U.x0 + (U.w - S) / 2, y, S, flip); y += S + G + air;
    L.tray = R(U.x0 + pad, y, pw, tray); y += tray + G + air;
    if (rows === 2) L.plateBot = R(U.x0 + pad, y, pw, plateH);
    const bw = Math.min(210, (pw - 2 * G) / 3), bx = U.x0 + (U.w - (3 * bw + 2 * G)) / 2;
    L.BTN = btns(bx, barY, bw, false);
    const aw = (pw - 3 * G) / 4;
    L.BTN.auto = { exit: R(U.x0 + pad, barY, aw, BH), pause: R(U.x0 + pad + aw + G, barY, aw, BH), dec: R(U.x0 + pad + 2 * (aw + G), barY, aw, BH), inc: R(U.x0 + pad + 3 * (aw + G), barY, aw, BH) };
    L.kind = rows === 2 ? 'portrait' : 'portrait-duo';
  } else {
    const pad = 12, gap = 14, panelMin = 270;
    const cardTop = ins.back ? Math.max(U.y0 + pad, L.backBox.y + L.backBox.h + 4) : U.y0 + pad, cardH = U.y1 - pad - cardTop;
    const sMax = U.h - 2 * pad - 8;
    const two = U.w - sMax - 2 * (panelMin + gap) - 4 * 6 >= 0;
    let S = Math.min(sMax, two ? sMax : U.w - panelMin - 3 * gap - 12);
    S = Math.max(S, 220);
    const topB = U.y0 + (U.h - S) / 2;
    const tray = clamp(cardH * 0.2, 96, 150), ph = clamp(cardH * 0.17, 82, 118), msgH = clamp(cardH * 0.1, 56, 84);
    if (two) {
      const bx = U.x0 + (U.w - S) / 2, lw = bx - U.x0 - gap - 6, rw = U.x1 - (bx + S) - gap - 6;
      board = boardAt(bx, topB, S, flip);
      L.leftCard = R(U.x0 + 6, cardTop, lw, cardH); L.rightCard = R(bx + S + gap, cardTop, rw, cardH);
      const lx = L.leftCard.x + 12, lwi = lw - 24, bh = Math.min(BH, 70);
      L.plateTop = R(lx, cardTop + 12, lwi, clamp(cardH * 0.26, 110, 170));
      L.plateBot = R(lx, cardTop + cardH - 12 - L.plateTop.h, lwi, L.plateTop.h);
      L.msg = R(lx, L.plateTop.y + L.plateTop.h + G, lwi, Math.max(56, L.plateBot.y - G - (L.plateTop.y + L.plateTop.h + G)));
      const rx = L.rightCard.x + 14, rwi = rw - 28, bw = clamp(rwi, 120, 340), bxr = L.rightCard.x + (rw - bw) / 2;
      L.rightHead = R(rx, cardTop + 12, rwi, 44);
      L.tray = R(rx, cardTop + 62, rwi, Math.min(cardH * 0.42, 250));
      const y0 = Math.max(L.tray.y + L.tray.h + G + 24, cardTop + cardH - 12 - 4 * BH - 3 * G);
      L.BTN = btns(bxr, y0, bw, true);
      L.badge = { cx: L.rightCard.x + rw / 2, bottom: cardTop + cardH - 8, w: rw - 28, show: cardTop + cardH - 8 - (y0 + 4 * BH + 3 * G) > 90 };
      L.kind = 'wide2';
    } else {
      const bx = U.x0 + gap + 4;
      board = boardAt(bx, topB, S, flip);
      const cx = bx + S + gap, cw = U.x1 - 6 - cx;
      L.rightCard = R(cx, cardTop, cw, cardH); L.leftCard = null;
      const ix = cx + 12, iw = cw - 24, bw = clamp(iw, 120, 340);
      const inner = cardH - 24, stackH = 4 * BH + 3 * G, gridH = 2 * BH + G, minRest = 2 * 76 + 48 + 84 + 4 * G;
      const grid = inner < minRest + stackH;
      const bH = grid ? gridH : stackH, rest = Math.max(240, inner - bH - 4 * G);
      const phh = clamp(rest * 0.27, 70, 130), mh = clamp(rest * 0.12, 44, 84), th = Math.max(80, rest - 2 * phh - mh);
      let y = cardTop + 12;
      L.plateTop = R(ix, y, iw, phh); y += phh + G;
      L.msg = R(ix, y, iw, mh); y += mh + G;
      L.tray = R(ix, y, iw, th); y += th + G;
      L.plateBot = R(ix, y, iw, phh); y += phh + G;
      const y0 = Math.max(y, cardTop + cardH - 12 - bH);
      if (grid) {
        const hw = (iw - G) / 2, at = (i) => R(ix + (i % 2) * (hw + G), y0 + Math.floor(i / 2) * (BH + G), hw, BH);
        L.BTN = { menu: at(0), undo: at(1), hint: at(2), auto: { exit: at(0), pause: at(1), dec: at(2), inc: at(3) } };
      } else L.BTN = btns(cx + (cw - bw) / 2, y0, bw, true);
      L.badge = { show: false };
      L.kind = 'wide1';
    }
  }
  L.board = board; L.sq = board.sq; L.squareAt = board.squareAt; L.cell = board.cell;
  // dice slots inside the tray
  const T = L.tray, ds = clamp(Math.min((T.w - 5 * 10) / 4, T.h - 40), 36, 120), tw = 4 * ds + 3 * 10, dx = T.x + (T.w - tw) / 2;
  L.dice = [0, 1, 2, 3].map((i) => R(dx + i * (ds + 10), T.y + 8 + (T.h - 30 - ds) / 2, ds, ds));
  const cw = clamp(Math.min(U.w - 40, 560), 300, 600), ch = land ? Math.min(U.h - 30, 600) : Math.min(700, U.h - 60);
  L.over = { card: R(U.x0 + (U.w - cw) / 2, U.y0 + (U.h - ch) / 2, cw, ch) };
  const ow = cw - 80;
  L.over.again = R(L.over.card.x + 40, L.over.card.y + ch - 40 - 84 - 12 - 84 - 46, ow, 84);
  L.over.back = R(L.over.card.x + 40, L.over.card.y + ch - 40 - 84 - 46, ow, 84);
  L.title = (hasSave) => buildTitle(L, !!hasSave);
  L.doc = buildDoc(L);
  return L;
}

const titleCache = new WeakMap();
function buildTitle(L, hasSave) {
  const memo = titleCache.get(L) || {}; titleCache.set(L, memo);
  if (memo[hasSave]) return memo[hasSave];
  const { w, h, U, ins } = L, T = { rows: {}, hero: null, card: null, lockup: null };
  const names = [hasSave ? ['resume'] : null, ['play'], ['two', 'auto'], ['rules', 'how'], ['about', 'settings']].filter(Boolean);
  const n = names.length;
  // the Play row is dominant (1.55 x a secondary row); `pitch` is the secondary row pitch, `bh` its button height
  const rowH = (row, pitch, bh) => (row[0] === 'play' ? { h: bh * 1.5, step: pitch * 1.5 } : row[0] === 'resume' ? { h: bh, step: pitch } : { h: bh, step: pitch });
  const place = (x0, aw, y0, pitch, bh) => { let y = y0; names.forEach((row) => {
    const { h: rh, step } = rowH(row, pitch, bh);
    if (row.length === 1) T.rows[row[0]] = R(x0, y, aw, rh);
    else { const cw = (aw - 12) / 2; T.rows[row[0]] = R(x0, y, cw, rh); T.rows[row[1]] = R(x0 + cw + 12, y, cw, rh); }
    y += step;
  }); };
  const units = names.reduce((a, r) => a + (r[0] === 'play' ? 1.5 : 1), 0);
  if (!L.land) {
    const lock = 64, bottom = h - Math.max(14, ins.b + 6), bw = Math.min(U.w - 56, 560);
    const minP = clamp(Math.round(46 / (ins.px || 0.6)) + 12, 58, 98);
    const pitch = clamp((bottom - lock - (U.y0 + 430)) / units, minP * 0.9, 76), bh = pitch - 12;
    const y0 = bottom - lock - units * pitch + 12;
    place(U.x0 + (U.w - bw) / 2, bw, y0, pitch, bh);
    T.lockup = { x: w / 2, y: bottom - 14 };
    const zoneTop = Math.max(ins.t + 8, ins.back ? ins.t + 60 : 0);
    T.hero = R(U.x0 + 10, zoneTop, U.w - 20, y0 - 12 - zoneTop);
  } else {
    const aw = clamp(w * 0.38, 380, 560), ax = U.x1 - aw - 16, lock = 56;
    const pitch = Math.min(84, (U.h - 40 - lock) / units), bh = pitch - 12, y0 = U.y0 + (U.h - units * pitch - lock) / 2 + 6;
    place(ax + 24, aw - 48, y0, pitch, bh);
    T.card = R(ax, y0 - 24, aw, units * pitch + lock + 28);
    T.lockup = { x: ax + aw / 2, y: T.card.y + T.card.h - 14 };
    T.hero = R(U.x0 + 10, U.y0 + 10, ax - U.x0 - 30, U.h - 20);
  }
  memo[hasSave] = T;
  return T;
}

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
