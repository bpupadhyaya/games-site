// Geometry as a function of the LIVE screen size (kit fluid viewport: the short side is always 720 units, the long side follows the screen).
// `layoutFor(w, h, flip)` returns every rectangle for that size and is cached, so a frame never recomputes it.
//   portrait    rival plate, message, boat board (as wide as the screen), throwing stick tray, your plate, button bar
//   landscape   boat board next to a card with the plates, message, tray and buttons
// The board is always drawn lengthwise; `flip` turns it half a turn so the human's own row is always the one nearest the thumb.
import { v3 } from './v3.js';
export const THINK_STEPS = [2, 5, 8, 10];
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export const R = (x, y, w, h) => ({ x, y, w, h });
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Safe areas and the host's floating back button, in virtual units. main.js keeps this current (browsers: all zero).
// px = css pixels per virtual unit (type never goes below ~11 css px); dpr = device pixel ratio.
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6, dpr: 2 };

const cache = new Map();
export function layoutFor(w, h, flip = false) {
  w = Math.round(w); h = Math.round(h);
  const key = `${w}x${h}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}|${flip ? 1 : 0}|${v3.on ? 1 : 0}`;
  let L = cache.get(key);
  if (!L) { L = build(w, h, { ...host }, flip); L.key = key; cache.set(key, L); if (cache.size > 40) cache.delete(cache.keys().next().value); }
  return L;
}

const MX = 1.5, MY = 0.3;            // hull margin: in cell widths (ends) and cell heights (sides)
// A boat board fitted into the box (bx, by, bw, bh): returns the hull rectangle, grid and the point mapper.
function boardIn(bx, by, bw, bh, flip, maxAspect = 1.9) {
  let cw = bw / (8 + 2 * MX), ch = Math.min(cw * maxAspect, bh / (3 + 2 * MY));
  if (ch < cw * 0.82) cw = ch / 0.82;
  const w = cw * (8 + 2 * MX), h = ch * (3 + 2 * MY), x = bx + (bw - w) / 2, y = by + (bh - h) / 2;
  const gx = x + cw * MX, gy = y + ch * MY;
  const pt = (row, col) => { const r = flip ? 2 - row : row, c = flip ? 7 - col : col; return { x: gx + (c + 0.5) * cw, y: gy + (r + 0.5) * ch }; };
  const cellAt = (px, py) => {
    const c = Math.floor((px - gx) / cw), r = Math.floor((py - gy) / ch);
    if (c < 0 || c > 7 || r < 0 || r > 2) return null;
    return { row: flip ? 2 - r : r, col: flip ? 7 - c : c };
  };
  return { x, y, w, h, cw, ch, gx, gy, flip, pt, cellAt, rowOf: (s) => ((s === 0) !== flip ? 2 : 0), rect: R(x, y, w, h) };
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
    return { menu: at(0), hint: at(1), auto: { exit: at(0), pause: at(1), dec: at(2), inc: at(3) } };
  };
  if (!land) {
    const pad = 12, backRes = ins.back ? 62 : 0;
    const top0 = Math.max(ins.t + 6, backRes ? ins.t + backRes : 0, ins.t + Math.round(30 / (ins.px || 0.6))), bottom = h - Math.max(ins.b, 10) - 6;
    const barY = bottom - BH, pw = U.w - 2 * pad;
    if (v3.on) {
      // 3D on: the boat stands up the screen (the camera turns it a quarter turn), so its 11 cells use the whole height: the board is the
      // tall element on the left, the throwing tray and the message sit beside it, slim plates above and below, buttons at the bottom
      const ph = clamp(U.w * 0.11, 64, 84), G2 = 10, bandTop = top0 + ph + G2, bandBot = barY - G2 - ph - G2, bandH = Math.max(300, bandBot - bandTop);
      const AR = (3 + 2 * MY) / (8 + 2 * MX), bw2 = Math.min(bandH * AR, pw * 0.62), bh2 = bw2 / AR;
      L.plateTop = R(U.x0 + pad, top0, pw, ph);
      board = { x: U.x0 + pad, y: bandTop + (bandH - bh2) / 2, w: bw2, h: bh2, cw: bh2 / (8 + 2 * MX), ch: bw2 / (3 + 2 * MY), flip, vertical: true, pt: () => ({ x: 0, y: 0 }), cellAt: () => null, rowOf: (sd) => ((sd === 0) !== flip ? 2 : 0), rect: R(U.x0 + pad, bandTop + (bandH - bh2) / 2, bw2, bh2) };
      const cx2 = board.x + bw2 + G2 + 4, cw3 = U.x0 + pad + pw - cx2, trayH = clamp(cw3 * 0.95, 200, 380), msgH2 = clamp(bandH * 0.22, 120, 220);
      const colH = trayH + G2 + msgH2, cy2 = bandTop + Math.max(0, (bandH - colH) / 2);
      L.tray = R(cx2, cy2, cw3, trayH); L.msg = R(cx2, cy2 + trayH + G2, cw3, msgH2);
      L.plateBot = R(U.x0 + pad, bandBot + G2, pw, ph);
      const bw3 = Math.min(210, (pw - 2 * G) / 3), bx3 = U.x0 + (U.w - (2 * bw3 + G)) / 2;
      L.BTN = btns(bx3, barY, bw3, false);
      const aw3 = (pw - 3 * G) / 4;
      L.BTN.auto = { exit: R(U.x0 + pad, barY, aw3, BH), pause: R(U.x0 + pad + aw3 + G, barY, aw3, BH), dec: R(U.x0 + pad + 2 * (aw3 + G), barY, aw3, BH), inc: R(U.x0 + pad + 3 * (aw3 + G), barY, aw3, BH) };
      L.kind = 'portrait'; L.vertical = true;
    } else {
    const tray = clamp(U.w * 0.27, 120, 190), msgH = 60, ph = clamp(U.w * 0.15, 82, 104);
    const fixed = 2 * ph + msgH + tray + BH + 6 * G;
    const avail = Math.max(150, bottom - top0 - fixed);        // what is left for the board
    const fit = boardIn(U.x0 + pad, 0, pw, avail, flip);
    const spare = Math.max(0, avail - fit.h), bonus = Math.min(spare * 0.5, 120);
    const ph2 = ph + bonus * 0.3, tray2 = tray + bonus * 0.4, air = (spare - bonus) / 4;
    let y = top0 + air * 0.5;
    L.plateTop = R(U.x0 + pad, y, pw, ph2); y += ph2 + G;
    L.msg = R(U.x0 + pad, y, pw, msgH); y += msgH + G + air;
    board = boardIn(U.x0 + pad, y, pw, fit.h, flip); y += fit.h + G + air;
    L.tray = R(U.x0 + pad, y, pw, tray2); y += tray2 + G + air * 0.5;
    L.plateBot = R(U.x0 + pad, Math.min(y, barY - G - ph2), pw, ph2);
    const bw = Math.min(210, (pw - 2 * G) / 3), bx = U.x0 + (U.w - (2 * bw + G)) / 2;
    L.BTN = btns(bx, barY, bw, false);
    const aw = (pw - 3 * G) / 4;
    L.BTN.auto = { exit: R(U.x0 + pad, barY, aw, BH), pause: R(U.x0 + pad + aw + G, barY, aw, BH), dec: R(U.x0 + pad + 2 * (aw + G), barY, aw, BH), inc: R(U.x0 + pad + 3 * (aw + G), barY, aw, BH) };
    L.kind = 'portrait';
    }
  } else {
    const pad = 12, gap = 14, panelW = clamp(U.w * 0.27, 280, 420);
    const cardTop = ins.back ? Math.max(U.y0 + pad, L.backBox.y + L.backBox.h + 4) : U.y0 + pad, cardH = U.y1 - pad - cardTop;
    const bw = U.w - panelW - 3 * gap - 6, bh = U.h - 2 * pad;
    const rsv = Math.round(30 / (ins.px || 0.6));            // room above the board for the kit's preview pill
    board = boardIn(U.x0 + gap, U.y0 + pad + rsv, bw, bh - rsv, flip, 2.1);
    L.badgeAt = { x: board.x + board.w / 2, y: U.y0 + Math.round(6 / (ins.px || 0.6)) };
    const cx = U.x0 + gap + bw + gap, cw = U.x1 - 6 - cx;
    L.rightCard = R(cx, cardTop, cw, cardH); L.leftCard = null;
    const ix = cx + 12, iw = cw - 24, bwid = clamp(iw, 120, 340);
    const inner = cardH - 24, stackH = 4 * BH + 3 * G, gridH = 2 * BH + G, minRest = 2 * 84 + 48 + 80 + 4 * G;
    const grid = inner < minRest + stackH + 20;
    const bH = grid ? gridH : stackH, rest = Math.max(240, inner - bH - 4 * G);
    const phh = clamp(rest * 0.27, 84, 150), mh = clamp(rest * 0.12, 48, 90), th = Math.max(90, rest - 2 * phh - mh);
    let y = cardTop + 12;
    L.plateTop = R(ix, y, iw, phh); y += phh + G;
    L.msg = R(ix, y, iw, mh); y += mh + G;
    L.tray = R(ix, y, iw, th); y += th + G;
    L.plateBot = R(ix, y, iw, phh); y += phh + G;
    const y0 = Math.max(y, cardTop + cardH - 12 - bH);
    if (grid) {
      const hw = (iw - G) / 2, at = (i) => R(ix + (i % 2) * (hw + G), y0 + Math.floor(i / 2) * (BH + G), hw, BH);
      L.BTN = { menu: at(0), hint: at(1), auto: { exit: at(0), pause: at(1), dec: at(2), inc: at(3) } };
    } else L.BTN = btns(cx + (cw - bwid) / 2, y0, bwid, true);
    L.badge = { show: false };
    L.kind = 'landscape';
  }
  L.board = board; L.pt = board.pt; L.cellAt = board.cellAt; L.cw = board.cw; L.ch = board.ch;
  // over card
  const cw2 = clamp(Math.min(U.w - 40, 560), 300, 600), ch2 = land ? Math.min(U.h - 30, 560) : Math.min(660, U.h - 60);
  L.over = { card: R(U.x0 + (U.w - cw2) / 2, U.y0 + (U.h - ch2) / 2, cw2, ch2) };
  const ow = cw2 - 80;
  L.over.again = R(L.over.card.x + 40, L.over.card.y + ch2 - 40 - 84 - 12 - 84 - 46, ow, 84);
  L.over.back = R(L.over.card.x + 40, L.over.card.y + ch2 - 40 - 84 - 46, ow, 84);
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
  const place = (x0, aw, y0, pitch, bh) => names.forEach((row, i) => {
    const y = y0 + i * pitch;
    if (row.length === 1) T.rows[row[0]] = R(x0, y, aw, bh);
    else { const cw = (aw - 12) / 2; T.rows[row[0]] = R(x0, y, cw, bh); T.rows[row[1]] = R(x0 + cw + 12, y, cw, bh); }
  });
  if (!L.land) {
    const lock = 64, bottom = h - Math.max(14, ins.b + 6), bw = Math.min(U.w - 56, 560);
    const minP = clamp(Math.round(46 / (ins.px || 0.6)) + 12, 58, 98);
    const pitch = clamp((bottom - lock - (U.y0 + 430)) / n, minP, 104), bh = pitch - 12;
    const y0 = bottom - lock - n * pitch + 12;
    place(U.x0 + (U.w - bw) / 2, bw, y0, pitch, bh);
    T.lockup = { x: w / 2, y: bottom - 14 };
    const zoneTop = Math.max(ins.t + 8, ins.back ? ins.t + 60 : 0);
    T.hero = R(U.x0 + 10, zoneTop, U.w - 20, y0 - 12 - zoneTop);
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
