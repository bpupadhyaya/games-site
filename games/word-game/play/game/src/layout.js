// Geometry as a pure function of the LIVE screen size (kit 1.7.x fluid viewport: the short side is always 720 units).
// `layoutFor(w, h)` returns every rect for every screen; it is cached by size + safe insets, so a frame never recomputes it.
//   stack  portrait (any phone / tablet): header, target plaque, the three drift lanes, buttons at the bottom.
//   wide   landscape (and squarish windows): a left card (clock, score, target, buttons) and the lanes filling the rest.
// Words live in a fixed LANE SPACE (x 0..720, y BAND_TOP..BAND_BOTTOM, three slices) so the simulation never depends on the
// screen; `L.wordX/wordY` map lane space to the screen, so rotating mid-round keeps every word, score and timer.
export const W = 720, H = 1560;
export const BAND_TOP = 520;
export const BAND_BOTTOM = 1340;
export const SLICE_H = (BAND_BOTTOM - BAND_TOP) / 3;
export const SLICE_MARGIN = 56;

// Word slips: width is estimated from the text length so the rules never need a canvas.
export const CHAR_W = 30;
export const CHIP_PAD_X = 20;
export const CHIP_H = 96;
export const slipWidth = (text) => text.length * CHAR_W + CHIP_PAD_X * 2;

export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const THINK_STEPS = [2, 5, 8, 10];
export const REVEAL_SECONDS = 2;

// Mouse wheel / trackpad scroll for the Rules reader (main.js adds CSS px converted to virtual units), and the reader's
// content height (filled in by the renderer each frame) so scrolling clamps to the real text.
export const wheelInput = { dy: 0 };
export const rulesMetrics = { content: 0, view: 0, max: 0 };
// Same idea for every settings/study/progress screen (the generic form reader).
export const formMetrics = { content: 0, view: 0, max: 0 };

export const inRect = (x, y, r) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// Safe areas and the host's floating back button, in virtual units. main.js keeps this current (browsers: all zero).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.54, lefty: false };

const cache = new Map();
export function layoutFor(w, h) {
  w = Math.round(w); h = Math.round(h);
  const key = `${w}x${h}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}|${host.lefty ? 1 : 0}`;
  let L = cache.get(key);
  if (!L) { L = build(w, h, { ...host }); L.key = key; cache.set(key, L); if (cache.size > 40) cache.delete(cache.keys().next().value); }
  return L;
}

const R = (x, y, w, h) => ({ x, y, w, h });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function build(w, h, ins) {
  const wide = w >= h;
  const L = { w, h, wide, mode: wide ? 'wide' : 'stack', ins };
  const backSz = ins.back ? Math.max(ins.back, 56) : 0;
  L.backBox = ins.back ? R(ins.l, ins.t, backSz + 8, backSz + 8) : R(0, 0, 0, 0);
  const U = L.U = { x0: ins.l, y0: ins.t, x1: w - ins.r, y1: h - ins.b };
  U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  const ox = L.ox = wide ? 0 : Math.max(0, (w - 720) / 2);       // the 720-wide column of a portrait screen, centred when wider
  L.chipK = 1; L.chipH = CHIP_H;

  // =========================================================== title
  {
    const T = L.title = {};
    const BH = 84;
    if (!wide) {
      let y = h - ins.b - 20;
      T.footY = y; y -= 32; T.previewY = y; y -= 24;
      T.lockup = R(ox + 360 - 125, y - 68, 250, 68); y -= 68 + 8;      // the Arcforge lockup directly under the last button
      T.auto = R(ox + 56, y - BH, 296, BH); T.more = R(ox + 368, y - BH, 296, BH); y -= BH + 12;
      T.review = R(ox + 56, y - BH, 296, BH); T.prog = R(ox + 368, y - BH, 296, BH); y -= BH + 12;
      T.setup = R(ox + 56, y - BH, 296, BH); T.study = R(ox + 368, y - BH, 296, BH); y -= BH + 14;
      T.journey = R(ox + 56, y - BH, 608, BH); y -= BH + 14;
      T.play = R(ox + 110, y - 128, 500, 128); y -= 128 + 12;
      T.sum = R(ox + 56, y - 46, 608, 46); T.sumY = y - 12; y -= 46 + 6;
      T.bestY = y - 10; y -= 36;
      const modesTop = y - 8;
      const topBase = Math.max(ins.t + 120, L.backBox.h ? ins.t + L.backBox.h + 95 : 0);   // the 124 px title starts below the host back button
      const heroTop0 = topBase + 56 + 46;
      const avail = modesTop - heroTop0;
      let heroH = 0, mode = 'none';
      if (avail >= 428) { heroH = Math.min(avail, 500); mode = 'full'; } else if (avail >= 170) { heroH = 132; mode = 'plaque'; }
      const slack = avail - heroH, shift = mode === 'none' ? Math.max(0, Math.min(slack, 200)) * 0.3 : slack * 0.35;
      T.cx = w / 2; T.titleBase = topBase + shift; T.taglineY = T.titleBase + 54; T.creditY = T.taglineY + 42; T.titleMaxW = Math.min(w - 40, 680);
      T.hero = { mode, x: w / 2 - 320, y: heroTop0 + shift + (mode === 'none' ? 0 : slack * 0.2), w: 640, h: heroH };
    } else {
      const RC = clamp(w * 0.38, 380, 560), rx = U.x1 - 16 - RC, hw = RC / 2 - 8;
      const BW = 70, PH = 112, fixed = 46 + 30 + PH + BW * 4 + 68 + 26 + 28, gaps0 = 8 + 12 + 12 + 12 + 12 + 6 + 10;
      const g = clamp((U.h - 16 - fixed) / gaps0, 0.25, 1.2);
      const total = fixed + gaps0 * g;
      let y = U.y0 + (U.h - total) / 2;
      T.sum = R(rx, y, RC, 46); T.sumY = y + 32; y += 46 + 8 * g;
      T.bestY = y + 22; y += 30 + 12 * g;
      T.play = R(rx + 20, y, RC - 40, PH); y += PH + 12 * g;
      T.journey = R(rx, y, RC, BW); y += BW + 12 * g;
      T.setup = R(rx, y, hw, BW); T.study = R(rx + hw + 16, y, hw, BW); y += BW + 12 * g;
      T.review = R(rx, y, hw, BW); T.prog = R(rx + hw + 16, y, hw, BW); y += BW + 12 * g;
      T.auto = R(rx, y, hw, BW); T.more = R(rx + hw + 16, y, hw, BW); y += BW + 6 * g;
      T.lockup = R(rx + RC / 2 - 125, y, 250, 68); y += 68 + 10 * g;
      T.previewY = y + 20; y += 28; T.footY = y + 18;
      const lx0 = U.x0 + 16, lw = rx - 16 - lx0;
      T.cx = lx0 + lw / 2; T.titleMaxW = Math.max(220, lw - 150);
      const topBase = Math.max(U.y0 + 100, L.backBox.h ? U.y0 + L.backBox.h + 95 : 0);
      T.titleBase = topBase; T.taglineY = topBase + 50; T.creditY = T.taglineY + 40;
      const heroTop = T.creditY + 26, avail = U.y1 - 12 - heroTop;
      let heroH = 0, mode = 'none';
      if (avail >= 428) { heroH = Math.min(avail, 470); mode = 'full'; } else if (avail >= 170) { heroH = 132; mode = 'plaque'; }
      T.hero = { mode, x: lx0, y: heroTop + (avail - heroH) * 0.3, w: lw, h: heroH };
    }
    const lk = T.lockup, m = 44 / Math.max(0.3, ins.px || 0.54), ph = Math.max(lk.h, m), pw = Math.max(lk.w, m);
    T.lockHit = R(lk.x + lk.w / 2 - pw / 2, lk.y + lk.h / 2 - ph / 2, pw, ph);
  }

  // =========================================================== play / Auto Play
  {
    const P = L.play = {};
    if (!wide) {
      const kc = Math.max(0.3, ins.px || 0.54), hudY = Math.max(ins.t + 16, Math.ceil(ins.t + 6 / kc + 1.7 * Math.max(16, 11.5 / kc) + 4));   // clear of the kit's preview clock (top centre)
      P.clock = R(ox + 250, hudY, 252, 80); P.score = R(ox + 528, hudY, 152, 80);
      P.bar = R(ox + 40, hudY + 96, 640, 16);
      const btnH = h >= 1200 ? 96 : 84, btnY = h - ins.b - 28 - btnH;
      const top0 = P.bar.y + 16 + 20, thinkH = 64;
      let ph = 236;
      const bandOf = (p) => btnY - 22 - (top0 + p + 8 + thinkH + 10);
      if (bandOf(ph) < 3 * 168) ph = clamp(236 - (3 * 168 - bandOf(ph)), 150, 236);
      P.plaque = R(ox + 50, top0, 620, ph);
      P.thinkY = top0 + ph + 8; P.think = R(ox + 160, P.thinkY, 400, thinkH);
      P.dec = R(ox + 160, P.thinkY, 100, thinkH); P.inc = R(ox + 460, P.thinkY, 100, thinkH);
      P.thinkLabel = { x: ox + 360, y: P.thinkY + thinkH / 2 + 8, maxW: 190 };
      const by = P.thinkY + thinkH + 10;
      P.band = R(0, by, w, btnY - 22 - by);
      P.combo = R(ox + 40, hudY, 200, 80);
      P.stop = R(ox + 40, btnY, 202, btnH); P.pause = R(ox + 259, btnY, 202, btnH); P.hint = R(ox + 478, btnY, 202, btnH); P.colour = P.hint;
      P.aexit = R(ox + 70, btnY, 180, btnH); P.apause = R(ox + 270, btnY, 180, btnH); P.acolour = R(ox + 470, btnY, 180, btnH);
      P.panel = null;
    } else {
      const LW = clamp(w * 0.34, 400, 460), lx = U.x0 + 12;
      const hudY = U.y0 + 12, hudH = 76, backW = ins.back ? backSz + 12 : 0;
      const scoreW = 124, clockW = LW - backW - 10 - scoreW;
      P.clock = R(lx + backW, hudY, clockW, hudH); P.score = R(lx + LW - scoreW, hudY, scoreW, hudH);
      P.bar = R(lx + backW, hudY + hudH + 10, LW - backW, 14);
      const btnH = 84, rowB = 72, thinkH = 64;
      const bottom = U.y1 - 12, autoBlock = btnH + 8 + rowB;
      P.combo = R(lx, P.bar.y + 14 + 10, LW, 44);
      const topUsed = P.bar.y + 14 + 14 + 54;
      const ph = clamp(bottom - autoBlock - 12 - thinkH - 8 - topUsed, 150, 250);
      P.plaque = R(lx, topUsed, LW, ph);
      P.thinkY = topUsed + ph + 8; P.think = R(lx, P.thinkY, LW, thinkH);
      P.dec = R(lx + 10, P.thinkY, 100, thinkH); P.inc = R(lx + LW - 110, P.thinkY, 100, thinkH);
      P.thinkLabel = { x: lx + LW / 2, y: P.thinkY + thinkH / 2 + 8, maxW: LW - 240 };
      const tw3 = (LW - 16) / 3;
      P.stop = R(lx, bottom - btnH, tw3, btnH); P.pause = R(lx + tw3 + 8, bottom - btnH, tw3, btnH); P.hint = R(lx + 2 * tw3 + 16, bottom - btnH, tw3, btnH); P.colour = P.hint;
      P.aexit = R(lx, bottom - autoBlock, LW / 2 - 6, btnH); P.apause = R(lx + LW / 2 + 6, bottom - autoBlock, LW / 2 - 6, btnH);
      P.acolour = R(lx, bottom - rowB, LW, rowB);
      P.panel = R(lx - 8, U.y0 + 4, LW + 16, U.h - 8);
      const bx = lx + LW + 16;
      P.band = R(bx, U.y0 + 8, w - bx, U.h - 16);
    }
    // lane space -> screen
    const laneH = P.band.h / 3;
    L.chipH = clamp(laneH - 36, 80, CHIP_H);
    L.chipK = clamp(P.band.w / 640, 0.62, 1);
    L.slipW = (text) => slipWidth(text) * L.chipK;
    L.wordX = (lx) => P.band.x + (lx / W) * P.band.w;
    L.wordY = (slot, ly) => {
      const s0 = BAND_TOP + slot * SLICE_H + SLICE_MARGIN, s1 = BAND_TOP + (slot + 1) * SLICE_H - SLICE_MARGIN;
      const f = clamp((ly - s0) / (s1 - s0), 0, 1), top = P.band.y + slot * laneH + L.chipH / 2 + 6;
      return top + f * Math.max(0, laneH - L.chipH - 12);
    };
    L.laneY = (k) => P.band.y + (k + 0.5) * laneH;
    L.laneH = laneH;
  }

  // =========================================================== Rules reader
  {
    const Q = L.rules = {};
    Q.padX = 26;
    if (!wide) {
      const hy = ins.t + 18, pw = 130, ph = 68;
      Q.inc = R(w - ins.r - 20 - pw, hy, pw, ph); Q.dec = R(Q.inc.x - 12 - pw, hy, pw, ph);
      Q.titleX = w / 2 - 20; Q.titleBase = Math.max(hy + 62, L.backBox.h + 56);
      const btnH = h >= 1200 ? 96 : 84, btnY = h - ins.b - 24 - btnH;
      const py = Math.max(Q.titleBase + 36, hy + ph + 16);
      Q.panel = R(ox + 24, py, 720 - 48, btnY - 16 - py);
      Q.back = R(ox + 24, btnY, 330, btnH); Q.next = R(ox + 366, btnY, 330, btnH);
      Q.titleSize = 58;
    } else {
      const RC = clamp(w * 0.2, 210, 260), rx = U.x1 - 16 - RC;
      const py = Math.max(U.y0 + 12, ins.back ? L.backBox.h + 4 : 0);
      Q.panel = R(U.x0 + 16, py, rx - 16 - (U.x0 + 16), U.y1 - 12 - py);
      Q.titleX = rx + RC / 2; Q.titleBase = U.y0 + 96;
      Q.dec = R(rx, Q.titleBase + 30, RC / 2 - 6, 68); Q.inc = R(rx + RC / 2 + 6, Q.titleBase + 30, RC / 2 - 6, 68);
      Q.next = R(rx, U.y1 - 12 - 84, RC, 84); Q.back = R(rx, U.y1 - 12 - 84 - 12 - 84, RC, 84);
      Q.titleSize = 52;
    }
    Q.sbW = 14;
    Q.viewport = R(Q.panel.x + 10, Q.panel.y + 12, Q.panel.w - 20 - Q.sbW - 8, Q.panel.h - 24);
    Q.scrollbar = R(Q.panel.x + Q.panel.w - 10 - Q.sbW, Q.viewport.y, Q.sbW, Q.viewport.h);
    Q.textW = Q.viewport.w - 2 * Q.padX;
    // flashcards: the reader panel is the card, two answer buttons sit inside its lower edge
    const C = L.cards = {}, pn = Q.panel, bw = (pn.w - 60) / 2;
    C.card = R(pn.x, pn.y, pn.w, pn.h);
    C.know = R(pn.x + 20, pn.y + pn.h - 104, bw, 84); C.learn = R(pn.x + 40 + bw, pn.y + pn.h - 104, bw, 84);
    C.body = R(pn.x + 20, pn.y + 20, pn.w - 40, pn.h - 148);
    const side = Math.max(160, Math.min(pn.w - 60, pn.h - 250)), TR = L.trace = R(pn.x + (pn.w - side) / 2, pn.y + 120 + Math.max(0, (pn.h - 250 - side) / 2), side, side);
    L.traceHear = R(pn.x + 20, pn.y + 14, pn.w - 40, 96); void TR;
  }

  // =========================================================== session review
  {
    const O = L.over = {};
    O.rowH = 142; O.rowGap = 12;
    if (!wide) {
      const comp = h < 1300;
      O.cx = w / 2; O.titleY = Math.max(128, ins.t + 100); O.subY = O.titleY + 40;
      const cardH = comp ? 150 : 170;
      O.card = R(ox + 40, O.subY + 20, 640, cardH); O.card.stack = false;
      const bH = comp ? 92 : 112, by = h - ins.b - 44 - bH;
      O.again = R(ox + 40, by, 312, bH); O.change = R(ox + 368, by, 312, bH);
      const pagerH = comp ? 68 : 84, pagerY = by - 12 - pagerH;
      O.prev = R(ox + 40, pagerY, 200, pagerH); O.next = R(ox + 480, pagerY, 200, pagerH);
      O.rowsX = ox + 40; O.rowsW = 640;
      O.rowsTop = O.card.y + cardH + 34;
      O.rowsBottom = pagerY - 10;
      O.moreY = h - ins.b - 14;
    } else {
      const LW = clamp(w * 0.38, 340, 560), lx = U.x0 + 16;
      O.cx = lx + LW / 2; O.titleY = Math.max(U.y0 + 78, L.backBox.h + 56); O.subY = O.titleY + 36;
      const bH = 84, bottom = U.y1 - 42;
      O.change = R(lx, bottom - bH, LW, bH); O.again = R(lx, bottom - 2 * bH - 10, LW, bH);
      O.moreY = U.y1 - 10;
      const cardTop = O.subY + 18, cardBottom = O.again.y - 14;
      O.card = R(lx, cardTop, LW, clamp(cardBottom - cardTop, 150, 210)); O.card.stack = LW < 540;
      const rx = lx + LW + 16, rw = U.x1 - 16 - rx;
      O.rowsX = rx; O.rowsW = rw;
      const pagerH = 68, pagerY = U.y1 - 12 - pagerH;
      const pw = Math.min(190, (rw - 12) / 2);
      O.prev = R(rx, pagerY, pw, pagerH); O.next = R(rx + rw - pw, pagerY, pw, pagerH);
      O.rowsTop = U.y0 + 14; O.rowsBottom = pagerY - 10;
    }
    O.perPage = Math.max(2, Math.floor((O.rowsBottom - O.rowsTop + O.rowGap) / O.rowH));
    O.rowRect = (i, top) => R(O.rowsX, top + i * O.rowH, O.rowsW, O.rowH - 12);
    O.lookRect = (i, top) => { const r = O.rowRect(i, top); return R(r.x + r.w - 150, r.y + 8, 134, 46); };
    O.pageY = O.prev.y + O.prev.h / 2 + 9;
  }

  // left-handed layout: mirror the controls that sit side by side along the bottom
  if (ins.lefty) {
    const sw = (a, b) => { if (!a || !b) return; const t = a.x; a.x = b.x; b.x = t; };
    sw(L.play.stop, L.play.hint); sw(L.play.aexit, L.play.acolour); sw(L.rules.back, L.rules.next); sw(L.over.again, L.over.change); sw(L.over.prev, L.over.next); sw(L.cards.know, L.cards.learn);
  }

  // =========================================================== web-preview limit
  L.limit = { plaque: R(w / 2 - 310, h / 2 - 210, 620, 250), lineY: h / 2 + 100 };
  return L;
}
