// Geometry of the fluid canvas (kit 1.7.x: the SHORT side is always 720 virtual units, the long side follows the screen).
// Every export below is a LIVE object: `applyLayout(w, h)` rewrites them in place for the current size (cached by size + insets),
// so game.js / view.js keep reading HAND, CLOTH, BTN ... as before. Modes:
//   tall   portrait phone/tablet (h >= 940): header, seats, table, message row, hand, button bar, top to bottom
//   wide   landscape (or near-square): a score/deck card on the left, the table + hand in the middle, buttons on the right
export const W = 720, H = 1560;                       // the approved phone design size (also the headless default)
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
const R = (x, y, w, h) => ({ x, y, w, h });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Safe areas and the host's floating back button, in virtual units (main.js keeps this current; browsers: all zero).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };

// ---- live geometry (mutated by applyLayout) --------------------------------------------------------------------------
export const LV = { w: W, h: H, mode: 'tall', wide: false, key: '', U: { x: 0, y: 0, w: W, h: H, x0: 0, y0: 0, x1: W, y1: H }, backBox: R(0, 0, 0, 0), sky: 200, rightCard: null };
export const HAND = { w: 192, h: 307, y: 1290, xs: [144, 360, 576], lift: 34 };
export const CLOTH = R(26, 356, 668, 674);
export const DECK = R(30, 1036, 96, 90), PILE = R(594, 1036, 96, 90), MSG = R(134, 1034, 452, 92);
export const deckPos = { x: 62, y: 1081 }, pilePos = { x: 626, y: 1081 };
export const OPP = { x: 70, y: 268, label: 214, count: 330, w: 44 };   // the opponent team's captured pile
export const HDR = R(30, 100, 660, 70);                              // score plaque (tall) / score card (wide)
export const INSTR = R(30, 202, 660, 112);                           // lesson / puzzle instruction panel
export const SEAT = { w: 54, dl: 68, dt: 92, y: 268, cx: 360, span: 160 };
export const BTN = {};
export const SET = {};
export const TITLE = {};          // title screen: rows function
export const READER = {};         // About / Controls / Rules page frame
export const ROUND = {};          // end-of-round scoring panel frame
export const POSTER = { s: 1, ox: 0, oy: 0 };   // transform for the poster screens (result, demo limit): design 720 wide -> screen

export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const AP_THINK_STEPS = [2, 5, 8, 10];

const clearObj = (o) => { for (const k of Object.keys(o)) delete o[k]; };
const cache = new Map();
export function applyLayout(w, h) {
  w = Math.round(w); h = Math.round(h);
  const key = `${w}x${h}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}`;
  if (LV.key === key) return LV;
  let L = cache.get(key);
  if (!L) { L = build(w, h); L.key = key; cache.set(key, L); if (cache.size > 30) cache.delete(cache.keys().next().value); }
  commit(L);
  return LV;
}
function commit(L) {
  Object.assign(LV, L.LV); LV.rightCard = L.rightCard || null;
  Object.assign(HAND, L.HAND); HAND.xs = L.HAND.xs.slice();
  for (const [dst, src] of [[CLOTH, L.CLOTH], [DECK, L.DECK], [PILE, L.PILE], [MSG, L.MSG], [deckPos, L.deckPos], [pilePos, L.pilePos], [OPP, L.OPP], [HDR, L.HDR], [INSTR, L.INSTR], [SEAT, L.SEAT], [POSTER, L.POSTER]]) Object.assign(dst, src);
  for (const [dst, src] of [[BTN, L.BTN], [SET, L.SET], [TITLE, L.TITLE], [READER, L.READER], [ROUND, L.ROUND]]) { clearObj(dst); Object.assign(dst, src); }
  LV.key = L.key;
}

function build(w, h) {
  const ins = { ...host };
  const wide = w >= h || h < 940;
  const U = R(ins.l, ins.t, 0, 0); U.x0 = ins.l; U.y0 = ins.t; U.x1 = w - ins.r; U.y1 = h - ins.b; U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  const backSz = ins.back ? Math.max(ins.back, 56) : 0;
  const backBox = ins.back ? R(ins.l, ins.t, backSz + 8, backSz + 8) : R(0, 0, 0, 0);
  const out = { LV: { w, h, mode: wide ? 'wide' : 'tall', wide, U, backBox, sky: wide ? 56 : 200 }, BTN: {}, SET: {}, TITLE: {}, READER: {}, ROUND: {} };
  const B = out.BTN;
  const cxm = w / 2;

  if (!wide) {
    // ================= portrait ==============================================================================
    const hy = Math.max(ins.t + 8, h >= 1400 ? 100 : 84);
    const hx = ins.back ? Math.max(30, backBox.x + backBox.w + 6) : 30;
    out.HDR = R(hx, hy, 690 - hx, 70);
    const band = h >= 1400 ? 186 : 150, clothTop = hy + 70 + band;
    const bottomLift = Math.max(0, ins.b - 16), barY = h - 98 - bottomLift, barH = 72;
    const hs = clamp(0.6 + 0.4 * (h - 1000) / 560, 0.6, 1);
    out.HAND = { w: 192 * hs, h: 307 * hs, y: barY - 19 - (307 * hs) / 2, xs: [cxm - 214 * hs, cxm, cxm + 214 * hs], lift: 34 * hs };
    const handTop = out.HAND.y - out.HAND.h / 2, mh = h >= 1400 ? 92 : 84, msgY = handTop - 10 - mh;
    out.CLOTH = R(26, clothTop, 668, Math.max(160, msgY - 4 - clothTop));
    out.DECK = R(30, msgY, 96, Math.min(90, mh)); out.PILE = R(594, msgY, 96, Math.min(90, mh)); out.MSG = R(134, msgY, 452, mh);
    const dc = out.DECK.h / 2;
    out.deckPos = { x: 62, y: msgY + dc + 1 }; out.pilePos = { x: 626, y: msgY + dc + 1 };
    const seatY = hy + 70 + Math.round(band * 98 / 186);
    out.SEAT = { w: 54, dl: 68, dt: 92, y: seatY, cx: 360, span: 160 };
    const dOpp = ins.back ? Math.max(0, backBox.y + backBox.h + 6 - (seatY - 54 - 14)) : 0;   // keep the pile clear of the host's back button
    out.OPP = { x: 70, y: seatY + dOpp, label: seatY - 54 + dOpp, count: seatY + 62 + dOpp, w: 44 };
    const iy = Math.max(hy + 70 + Math.round(band * 32 / 186), ins.back ? backBox.y + backBox.h + 6 : 0);
    out.INSTR = R(30, iy, 660, Math.max(70, Math.min(112, clothTop - 8 - iy)));
    Object.assign(B, {
      menu: R(60, barY, 190, barH), undo: R(265, barY, 190, barH), hint: R(470, barY, 190, barH),
      apExit: R(30, barY, 154, barH), apPause: R(198, barY, 154, barH), apDec: R(366, barY, 154, barH), apInc: R(534, barY, 154, barH),
      next: R(270, barY, 390, barH), share: R(270, barY, 390, barH),
    });
  } else {
    // ================= landscape / squarish ======================================================================
    const side = clamp((U.w - 600) / 2, 156, 250), cx0 = U.x0 + side, cx1 = U.x1 - side, cw = cx1 - cx0, ccx = (cx0 + cx1) / 2;
    const top = U.y0 + 6, ctop = U.y0 + Math.max(36, Math.ceil(30 / Math.max(0.3, ins.px || 0.6))), panelTop = ins.back ? Math.max(top, backBox.y + backBox.h + 4) : top;   // ctop: the centre column starts below the kit's preview badge
    const hh = clamp(U.h * 0.27, 140, 230), hw = hh * 0.625, gapH = Math.min(hw + 14, (cw - 12) / 3);
    out.HAND = { w: hw, h: hh, y: U.y1 - 8 - hh / 2, xs: [ccx - gapH, ccx, ccx + gapH], lift: 26 };
    const handTop = out.HAND.y - hh / 2, mh = 44, msgY = handTop - 6 - mh;
    const seatBand = 128;
    out.CLOTH = R(cx0 + 4, ctop + seatBand + 2, cw - 8, Math.max(140, msgY - 4 - (ctop + seatBand + 2)));
    out.MSG = R(cx0 + 8, msgY, cw - 16, mh);
    out.SEAT = { w: 46, dl: 62, dt: 86, y: ctop + 38, cx: ccx, span: Math.min(190, cw / 3.3) };
    out.INSTR = R(cx0 + 8, ctop + 4, cw - 16, 108);
    // left card: score header, the opponent pile, the deck
    const lx = U.x0 + 6, lw = side - 12;
    out.HDR = R(lx, panelTop, lw, 176);
    out.OPP = { x: lx + lw / 2, y: panelTop + 176 + 66, label: panelTop + 176 + 16, count: panelTop + 176 + 128, w: 44 };
    const dw = Math.min(lw, 130);
    out.DECK = R(lx + (lw - dw) / 2, U.y1 - 8 - 90, dw, 90); out.deckPos = { x: out.DECK.x + dw * 0.33, y: out.DECK.y + 46 };
    // right card: your pile on top, then the buttons stacked at the bottom
    const rx = U.x1 - side + 6, rw = side - 12, bw = Math.min(rw, 220), bx = rx + (rw - bw) / 2, bh = clamp(Math.round((U.h - 24 - 120) / 4.4), 60, 80), gp = 10;
    out.PILE = R(rx + (rw - dw) / 2, top + 64, dw, 90); out.pilePos = { x: out.PILE.x + dw * 0.33, y: out.PILE.y + 46 };
    const slot = (i, n = 4) => R(bx, U.y1 - 8 - (n - i) * bh - (n - i - 1) * gp, bw, bh);
    Object.assign(B, {
      menu: slot(0, 3), undo: slot(1, 3), hint: slot(2, 3),
      apExit: slot(0), apPause: slot(1), apDec: slot(2), apInc: slot(3),
      next: slot(1, 3), share: slot(1, 3),
    });
    out.rightCard = R(rx, top, rw, U.h - 12);
    out.leftCard = R(lx, panelTop, lw, U.y1 - 6 - panelTop);
  }

  // ---- poster screens (result): tall = the design box (720 wide, design y 380..1312) scaled to fit; wide = explicit rows ------------
  {
    const cy = U.y0 + U.h / 2;
    if (!wide) {
      const bh = 980, s = Math.min(1, (U.h - 24) / bh);
      out.POSTER = { s, ox: (w - 720 * s) / 2, oy: cy - (bh / 2 + 380) * s, cy };
      const P = out.POSTER, rect = (x, y, ww, hh2) => R(P.ox + x * P.s, P.oy + y * P.s, ww * P.s, hh2 * P.s);
      B.again = rect(130, 1110, 460, 92); B.back = rect(130, 1220, 460, 92);
    } else {
      out.POSTER = { s: 1, ox: 0, oy: 0, cy };
      B.again = R(w / 2 - 310, cy + 130, 300, 76); B.back = R(w / 2 + 10, cy + 130, 300, 76);
    }
  }

  // ---- title -----------------------------------------------------------------------------------------------------------
  {
    const T = out.TITLE;
    // Arcforge lockup under the last menu row: >= ~125 css px wide (aspect 1200:327)
    const lkw = Math.max(240, 125 / Math.max(0.2, ins.px || 0.6)), lkh = Math.round(lkw * 327 / 1200), lkPx = Math.max(0.2, ins.px || 0.6);
    T.lk = { w: lkw, h: lkh, px: lkPx };
    if (!wide) {
      const tail = 170 + lkh + 6, reserve = 100 + ins.b;
      T.rowsFor = (hasSave) => {
        const nFull = 5 + (hasSave ? 1 : 0);
        const pitch = clamp((h - ins.t - 330 - tail - reserve) / nFull, 62, 100);
        const bh = Math.round(pitch - 16), y0 = h - reserve - tail - nFull * pitch - 8;
        return { x: 70, w: 580, pitch, bh, y0, nFull, miniH: Math.round(bh * 0.93), cx: cxm };
      };
    } else {
      T.rowsFor = (hasSave) => {
        const nFull = 5 + (hasSave ? 1 : 0), colW = clamp(U.w * 0.4, 400, 560), x = U.x1 - colW - 16;
        const avail = U.h - 24, pitch = clamp((avail - lkh - 14) / (nFull + 1.1), 52, 92), bh = Math.round(pitch - 10);
        const total = nFull * pitch + bh * 0.95 + lkh + 14;
        return { x, w: colW, pitch, bh, y0: U.y0 + 12 + (avail - total) / 2, nFull, miniH: Math.round(bh * 0.95), cx: x + colW / 2 };
      };
    }
  }

  // ---- reference pages (About / Controls / Rules) ---------------------------------------------------------------------
  {
    const Rd = out.READER, navH = wide ? 64 : 90, navY = U.y1 - 24 - navH + (wide ? 16 : 0);
    const pw = wide ? Math.min(920, U.w - 2 * (ins.back ? backBox.w + 10 : 24)) : 648, px = (w - pw) / 2;
    const headerH = wide ? 62 : 70;
    const py = wide ? U.y0 + 8 : U.y0 + 8 + headerH + 6;
    const ph = navY - 8 - py;
    Rd.P = R(px, py, pw, ph);
    const sw = 112, sh = 56;
    if (wide) { Rd.textInc = R(px + pw - 16 - sw, py + 8, sw, sh); Rd.textDec = R(px + pw - 16 - 2 * sw - 10, py + 8, sw, sh); }
    else { Rd.textInc = R(w - 36 - sw - ins.r, U.y0 + 8, sw, sh + 6); Rd.textDec = R(Rd.textInc.x - sw - 10, U.y0 + 8, sw, sh + 6); }
    const nb = wide ? 200 : 220;
    Rd.pageBack = R(w / 2 - nb - 10, navY, nb, navH); Rd.pageNext = R(w / 2 + 10, navY, nb, navH);
    Rd.titleY = wide ? py + 50 : py + 88; Rd.titleAlign = wide ? 'left' : 'center'; Rd.titleX = wide ? px + 30 : w / 2;
    const vpTop = py + (wide ? 72 : 116);
    Rd.VP = R(px + 28, vpTop, pw - 56, py + ph - 38 - vpTop);
    Rd.indicatorY = py + ph - 14;
    Rd.bar = R(px + pw - 20, Rd.VP.y, 8, Rd.VP.h);
    B.pageBack = Rd.pageBack; B.pageNext = Rd.pageNext; B.textDec = Rd.textDec; B.textInc = Rd.textInc;
  }

  // ---- settings --------------------------------------------------------------------------------------------------------
  {
    const S = out.SET;
    if (!wide) {
      const top = U.y0 + (h >= 1400 ? 120 : 56), pitch = h >= 1400 ? 95 : 88, rh = pitch - 11;
      S.panel = R(40, top, 640, U.y1 - 30 - 90 - 16 - top); S.titleY = top + 95;
      const y0 = top + 130;
      ['level', 'sound', 'calm', 'big', 'deck', 'target'].forEach((k, i) => { S[k] = R(70, y0 + i * pitch, 580, rh); });
      S.back = R(130, U.y1 - 30 - 90, 460, 90);
      S.blurbY = y0 + 6 * pitch + 36; S.blurbX = 360; S.blurbW = 580; S.cardsY = null;
      const free = S.back.y - 40 - (S.blurbY + 70);
      if (free > 150) { S.cardsW = Math.min(120, (free - 60) / 1.6); S.cardsY = S.blurbY + 70 + 20 + S.cardsW * 0.8; S.capY = S.cardsY + S.cardsW * 0.8 + 30; }
    } else {
      const pw = Math.min(U.w - 32 - (ins.back ? backBox.w : 0), 920), px = (w - pw) / 2, top = U.y0 + 8;
      S.panel = R(px, top, pw, U.h - 16); S.titleY = top + 62; S.titleCenter = !!ins.back;
      const colW = (pw - 3 * 20) / 2, rh = 70, y0 = ins.back ? Math.max(top + 88, backBox.y + backBox.h + 8) : top + 88;
      ['level', 'sound', 'calm', 'big', 'deck', 'target'].forEach((k, i) => { S[k] = R(px + 20 + (i % 2) * (colW + 20), y0 + Math.floor(i / 2) * (rh + 12), colW, rh); });
      S.back = R(w / 2 - 150, U.y1 - 16 - 74, 300, 74);
      S.blurbY = y0 + 3 * (rh + 12) + 26; S.blurbX = w / 2; S.blurbW = pw - 60; S.cardsY = null;
    }
  }

  // ---- end-of-round scoring panel -------------------------------------------------------------------------------------------
  {
    const Rn = out.ROUND, contH = wide ? 72 : 96, avail = U.h - 24 - contH - 12, need = wide ? 640 : 1010;
    Rn.k = clamp(avail / need, wide ? 0.72 : 0.7, 1);
    const pw = wide ? 700 : 640, ph = Math.min(avail, need * Rn.k + 30);
    Rn.P = R((w - pw) / 2, U.y0 + 10, pw, ph);
    Rn.cont = R(w / 2 - 230, Rn.P.y + ph + 10, 460, contH);
    B.cont = Rn.cont;
  }
  return out;
}

// ---- helpers used by game.js / view.js ---------------------------------------------------------------------------------
export const handPos = (i) => ({ x: HAND.xs[i], y: HAND.y });
export function seatPos(n, seat) {
  if (n === 2) return { x: SEAT.cx, y: SEAT.y };
  if (!LV.wide) return { x: [0, 225, 385, 545][seat], y: SEAT.y };
  return { x: SEAT.cx + (seat - 2) * SEAT.span, y: SEAT.y };
}
// The table cards sit in fixed slots, so they never jump around when others are taken. 12 slots (24 if there are more cards),
// laid out as the grid that gives the biggest cards in the cloth.
const gridCache = new Map();
export function tableGrid(count) {
  const slots = count <= 12 ? 12 : 24, key = `${slots}|${CLOTH.x},${CLOTH.y},${CLOTH.w},${CLOTH.h}`;
  let g = gridCache.get(key);
  if (g) return g;
  const padX = 14, padY = 10, capW = LV.wide ? 118 : 128;
  let best = null;
  for (let cols = 2; cols <= 12; cols++) {
    const rows = Math.ceil(slots / cols), cellW = (CLOTH.w - 2 * padX) / cols, cellH = (CLOTH.h - 2 * padY) / rows;
    const cw = Math.min(cellW - 6, (cellH - 8) / 1.6, capW);
    if (!best || cw > best.w + 0.5) best = { cols, rows, w: cw, cellW, cellH };
  }
  const { cols, rows } = best, w = Math.max(40, best.w);
  const order = (n) => [...Array(n).keys()].sort((a, b) => Math.abs(a - (n - 1) / 2) - Math.abs(b - (n - 1) / 2) || a - b);
  g = { cols, rows, w, h: w * 1.6, px: Math.min(best.cellW, w + 30), py: Math.min(best.cellH, w * 1.6 + 20), slots, rowOrder: order(rows), colOrder: order(cols) };
  gridCache.set(key, g); if (gridCache.size > 24) gridCache.delete(gridCache.keys().next().value);
  return g;
}
export function slotPos(i, gr) {
  const r = gr.rowOrder[Math.floor(i / gr.cols)] ?? 0, c = gr.colOrder[i % gr.cols] ?? 0;
  return { x: CLOTH.x + CLOTH.w / 2 + (c - (gr.cols - 1) / 2) * gr.px, y: CLOTH.y + CLOTH.h / 2 + (r - (gr.rows - 1) / 2) * gr.py };
}

// Title screen: rects for every button, plus where the stats go.
export function titleRows(hasSave) {
  const T = TITLE.rowsFor(hasSave), out = {};
  let i = 0;
  const row = () => R(T.x, T.y0 + i++ * T.pitch, T.w, T.bh);
  if (hasSave) out.resume = row();
  out.learn = row(); out.play = row(); out.four = row(); out.daily = row(); out.autoplay = row();
  const y = T.y0 + i * T.pitch, g = 10, cw = (T.w - 3 * g) / 4;
  ['about', 'controls', 'rules', 'settings'].forEach((k, j) => { out[k] = R(T.x + j * (cw + g), y, cw, T.miniH); });
  const lk = TITLE.lk, ly = y + T.miniH + 12;
  out.lock = R(T.cx - lk.w / 2, ly, lk.w, lk.h);
  { const m = 44 / lk.px, tw = Math.max(lk.w + 24, m), th = Math.max(lk.h + 12, m); out.lockTap = R(T.cx - tw / 2, ly - 4, tw, Math.max(th, lk.h + 8)); }
  out.meta = { x: T.x, w: T.w, cx: T.cx, bottom: ly + lk.h, rowsBottom: y + T.miniH, top: T.y0 };
  return out;
}

applyLayout(W, H);
