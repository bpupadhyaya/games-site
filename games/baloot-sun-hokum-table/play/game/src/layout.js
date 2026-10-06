// Geometry for Baloot, as a function of the LIVE screen size (kit 1.7.1 fluid viewport: the short side is always 720 units).
//
// `layoutFor(w, h)` is PURE and cached by size + safe insets: it returns every rect for every screen. `applySize(w, h, scene)` then copies
// the current layout into the long-lived exports below (BTN, TRICK, SEAT, DECK, PANEL, ACT, OVERLAY_BTN, TEXT_DEC, ... and the `let`s W, H,
// HAND_Y, LIFT, HS, TG, LAY) so game.js / view.js / the tests read "the current layout" through ordinary imports. game.js calls applySize at
// the top of every update and view.js at the top of every render, so both always agree.
//
// Two shapes (the same card sprites, only scales and positions change):
//   portrait  w < h   a vertical stack: score plaques + contract chip on top, partner's hand, the trick cross on the felt, the panel (bids /
//                     declare) over the lower felt, YOUR 8-card fan, then the Hint / Take back / Menu row. The phone-tall screen keeps the
//                     approved look; shorter portrait screens (iPads, 7"/10" tablets, SE) shrink the cards (HS, kt) and tighten the gaps.
//   wide      w >= h  LEFT column: scores + contract (lesson / daily header in study scenes, Auto Play HUD). CENTRE: partner on top, the
//                     trick cross, your fan along the bottom (wider than in portrait). RIGHT column: Hint / Take back / Menu stacked.
//                     Left / right opponents sit on the edges of the centre column. Title and pages put art left, buttons right.
// Card faces keep their 148 x 208 sprite; `HS` scales YOUR hand, `kt` the trick cross, so rank + suit stay readable at every size.
// "Study" scenes (lesson, daily, Auto Play) show every hand face up, so they get their own table variant (L.study); play uses L.play.
//
// The felt is exported through TABLE so art.js can paint it to match.
export const CW = 148, CH = 208;          // a card sprite
export const TW = 112, TH = 157;          // a card on the table at the reference scale (0.757)
export const BW = 84, BH = 118;           // a card back in a computer player's hand (reference)
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const AUTO_THINK_STEPS = [2, 5, 8, 10];
export const AUTO_REVEAL_SECS = 2;

export const R = (x, y, w, h) => ({ x, y, w, h });
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Safe areas and the host's floating back button, in virtual units. main.js keeps this current (browsers: all zero).
// px = css pixels per virtual unit (text never goes below ~11 css px).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };

// ---- the current layout (mutated by applySize) -------------------------------------------------------------------------
export let W = 720, H = 1560;
export let HAND_Y = 1188, LIFT = 46, HS = 1;
export let LAY = null;              // the whole current layout
export let TG = null;               // the current table geometry (play or study variant)
export const BTN = { hint: R(24, 1452, 200, 86), undo: R(260, 1452, 200, 86), menu: R(496, 1452, 200, 86) };
export const TRICK = [{ x: 360, y: 905 }, { x: 492, y: 758 }, { x: 360, y: 610 }, { x: 228, y: 758 }];
export const SEAT = [{ x: 360, y: 1300 }, { x: 660, y: 760 }, { x: 360, y: 285 }, { x: 60, y: 760 }];
export const DECK = { x: 360, y: 740 };
export const TOAST = R(60, 384, 600, 88);
export const CHIP = R(170, 164, 380, 50);
export const ACT = { a: R(30, 1074, 316, 104), b: R(374, 1074, 316, 104) };
export const PANEL = { ...R(16, 976, 688, 216), col: false };
export const OVERLAY_BTN = R(160, 1290, 400, 104);
export const OVERLAY_BTN2 = R(160, 1176, 400, 90);
export const BACK = R(24, 40, 120, 60);
export const REF_BACK = R(20, 1416, 330, 116);
export const REF_NEXT = R(370, 1416, 330, 116);
export const TEXT_DEC = R(20, 20, 130, 68);
export const TEXT_INC = R(570, 20, 130, 68);
export const AUTO_BAR = R(40, 216, 640, 50);
export const AUTO_DEC = R(420, 224, 60, 34);
export const AUTO_INC = R(624, 224, 60, 34);
export const TABLE = { x: 96, y: 470, w: 528, h: 570 };   // the felt (art.js paints it)

let curKey = '';
const put = (dst, src) => { for (const k of Object.keys(src)) dst[k] = src[k]; };

// Make `layoutFor(w, h)` the current layout. `scene` picks the table variant (study = lesson / daily / auto: every hand face up).
// Returns true when anything changed (size, insets or table variant).
export function applySize(w, h, scene = 'play') {
  const L = layoutFor(w, h), study = scene === 'lesson' || scene === 'daily' || scene === 'auto';
  const T = study ? L.study : L.play, key = L.key + '|' + (study ? 's' : 'p');
  if (key === curKey) return false;
  curKey = key;
  W = L.w; H = L.h; LAY = L; TG = T;
  HAND_Y = T.handY; LIFT = T.lift; HS = T.hs;
  put(BTN, T.btn); T.trick.forEach((p, i) => put(TRICK[i], p)); T.seat.forEach((p, i) => put(SEAT[i], p));
  put(DECK, T.deck); put(TOAST, T.toast); put(CHIP, T.chip); put(ACT.a, T.act.a); put(ACT.b, T.act.b); put(PANEL, T.panel);
  put(OVERLAY_BTN, L.overlay.a); put(OVERLAY_BTN2, L.overlay.b);
  put(BACK, L.back); put(REF_BACK, L.ref.back); put(REF_NEXT, L.ref.next); put(TEXT_DEC, L.ref.dec); put(TEXT_INC, L.ref.inc);
  put(AUTO_BAR, T.bar); put(AUTO_DEC, T.autoDec); put(AUTO_INC, T.autoInc); put(TABLE, T.felt);
  return true;
}

const cache = new Map();
export function layoutFor(w, h) {
  w = Math.round(w); h = Math.round(h);
  const key = `${w}x${h}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)},${Math.round(host.px * 100)}`;
  let L = cache.get(key);
  if (!L) { L = build(w, h, { ...host }); L.key = key; cache.set(key, L); if (cache.size > 40) cache.delete(cache.keys().next().value); }
  return L;
}
applySize(720, 1560, 'play');

// slot (top-left) of the i-th of n cards in YOUR hand (a fan of fully visible, overlapping cards)
export function handSlot(i, n) {
  const T = TG, cw = CW * HS;
  const step = n <= 1 ? 0 : Math.min(T.stepMax, (T.handW - cw) / (n - 1));
  const total = cw + step * (n - 1);
  return { x: T.handCx - total / 2 + step * i, y: HAND_Y, step };
}

export function titleRows(hasSave) { return LAY.title(hasSave).rows; }
export function titleLockTap(hasSave) { return LAY.title(hasSave).lockTap; }
export function titleGeo(hasSave) { return LAY.title(hasSave); }
export function bidButtons(n, round) {
  const P = PANEL;
  if (P.col) {   // a column of big buttons (wide screens): the text block on top
    const top = P.y + 104, area = P.h - 104 - 10, bh = Math.min(92, (area - (n - 1) * 10) / n);
    return Array.from({ length: n }, (_, i) => R(P.x + 8, top + i * (bh + 10), P.w - 16, bh));
  }
  if (round === 1 || n <= 3) {
    const w = (P.w - 28 - 2 * 16) / n, bh = Math.min(108, P.h - 74 - 12);
    return Array.from({ length: n }, (_, i) => R(P.x + 14 + i * (w + 16), P.y + 74, w, bh));
  }
  return [];
}
// Second-round layout: 3 trump-suit buttons on top, Sun and Pass below (wide screens: five stacked buttons)
export function bid2Buttons(withText = false) {
  const P = PANEL;
  if (P.col) {
    const top = P.y + (withText ? 60 : 8), area = P.h - (withText ? 60 : 8) - 8, bh = Math.min(74, (area - 4 * 8) / 5);
    const at = (i) => R(P.x + 8, top + i * (bh + 8), P.w - 16, bh);
    return { suits: [at(0), at(1), at(2)], sun: at(3), pass: at(4) };
  }
  const iw = P.w - 28, w = (iw - 32) / 3, bh = Math.min(84, (P.h - 22 - 12 - 12) / 2);
  const top = [0, 1, 2].map((i) => R(P.x + 14 + i * (w + 16), P.y + 22, w, bh));
  const w2 = (iw - 16) / 2, y2 = P.y + 22 + bh + 12;
  return { suits: top, sun: R(P.x + 14, y2, w2, bh), pass: R(P.x + 14 + w2 + 16, y2, w2, bh) };
}
export const settingsRows = () => LAY.settings.rows;
export const lessonRow = (i) => LAY.lessons.rows[i];

// ---------------------------------------------------------------------------------------------------------------------------
function build(w, h, ins) {
  const wide = w >= h;
  const L = { w, h, wide, ins };
  const U = L.U = { x0: ins.l, y0: ins.t, x1: w - ins.r, y1: h - ins.b };
  U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  const bkSz = ins.back ? Math.max(ins.back, 56) + 8 : 0;
  const bk = L.bk = ins.back ? R(U.x0, U.y0, bkSz, bkSz) : R(0, 0, 0, 0);    // the host's floating back button: keep it clear
  const px = ins.px || 0.6;
  L.minU = Math.max(12, 11 / px);                                              // smallest type (units) that is still ~11 css px
  const tallish = !wide && U.h >= 1300;
  const cxU = (U.x0 + U.x1) / 2;

  // ---- table geometry -------------------------------------------------------------------------------------------------
  const table = (study) => {
    const T = { study };
    const plH = tallish ? 88 : 76, chipH = tallish ? 50 : 46, barH = 70;
    if (!wide) {
      // ---------------- portrait ----------------
      const cx = cxU;
      const y0 = U.y0 + (tallish ? 44 : 8);
      const bkR = ins.back ? bk.x + bk.w + 6 : 0;
      const xa = ins.back ? Math.max(bkR, U.x0 + 24) : U.x0 + 92, xb = ins.back ? U.x1 - 24 : U.x1 - 92;
      const gapC = tallish ? 36 : 130, pw = (xb - xa - gapC) / 2;      // the kit's preview clock sits at the top centre: keep the gap clear of it
      T.sPl = [R(xa, y0, pw, plH), R(xa + pw + gapC, y0, pw, plH)];
      T.chip = R((xa + xb) / 2 - 190, y0 + plH + (tallish ? 24 : 8), 380, chipH);
      T.bar = R(U.x0 + 40, T.chip.y + chipH + 2, Math.min(640, U.w - 80), barH);
      // the study header (lesson / daily) takes the place of plaques + chip + bar
      const hdrBottom = study ? y0 + (tallish ? 214 : 190) : T.chip.y + chipH;
      T.lessonHdr = R(U.x0 + 30, y0, U.w - 60, hdrBottom - y0);
      const faces = hdrBottom + 8;
      const zoneBottom = study ? faces + 104 + 14 + 40 : hdrBottom + 10 + 83 + 14 + 40;   // under the partner's plate
      // bottom: the button row, then the fan, then the prompt line
      const btnH = tallish ? 86 : 74, btnY = U.y1 - (tallish ? 22 : 14) - btnH;
      const bw = (U.w - 48 - 32) / 3;
      T.btn = { hint: R(U.x0 + 24, btnY, bw, btnH), undo: R(U.x0 + 24 + bw + 16, btnY, bw, btnH), menu: R(U.x0 + 24 + 2 * (bw + 16), btnY, bw, btnH) };
      const gapH = tallish ? 56 : 24;
      const Rr = btnY - gapH - zoneBottom - 12 - 34;          // room for: fan (+ lift) and the trick cross
      const f = (Rr - 50) / 685;                         // one budget for the fan (+ lift) and the trick cross; the fan gets a little more
      const hs = clamp(1.12 * f, 0.5, 1), lift = 0.22 * CH * hs; let kt = clamp(0.9 * f, 0.5, 1);
      const handY = btnY - gapH - CH * hs;
      T.hs = hs; T.kt = kt; T.handY = handY; T.lift = lift;
      T.handCx = cx; T.handW = U.w - 32; T.stepMax = 98 * hs;
      const bandTop = zoneBottom, bandBot = handY - lift - 34;
      kt = clamp(Math.min(kt, (bandBot - bandTop - 70) / 570), 0.4, 1); T.kt = kt;      // the table keeps clear of the partner's plate above and your fan below
      const cy = (bandTop + bandBot) / 2 + (tallish ? 8 : 0);
      T.cy = cy; T.cx = cx;
      const dxo = 132 * kt, dyo = 147 * kt;
      T.ts = 0.757 * kt;
      T.trick = [{ x: cx, y: cy + dyo }, { x: cx + dxo, y: cy }, { x: cx, y: cy - dyo }, { x: cx - dxo, y: cy }];
      const fh = 451 * kt + 119 * kt, fw = 376 * kt + 152;
      T.felt = R(cx - fw / 2, cy - fh / 2, fw, fh);
      if (study) T.partner = { faces: { cx, y: faces, maxW: 420, step: 58 }, plate: { x: cx, y: faces + 104 + 14, w: 150 } };
      else T.partner = { backs: { cx, y: zoneBottom - 40 - 14 - 83, pitch: 34, sc: 0.4 }, plate: { x: cx, y: zoneBottom - 40, w: 150 } };
      const pitch = clamp((bandBot - bandTop - 120) / 7, 26, 44), stackH = 7 * pitch + 104;
      const sideTop = Math.max(cy - stackH / 2 + 12, zoneBottom + 52);
      const sxL = U.x0 + 56, sxR = U.x1 - 56;
      T.side = { top: sideTop, pitch, left: { x: sxL, plateX: sxL + 6 }, right: { x: sxR, plateX: sxR }, plateY: sideTop - 52 };
      T.bubble = [{ x: cx + 200, y: handY - 24 }, { x: sxR - 130, y: sideTop + 54 }, { x: cx + 180, y: T.partner.plate.y + 20 }, { x: sxL + 130, y: sideTop + 54 }];
      T.seat = [{ x: cx, y: handY + CH * hs / 2 }, { x: sxR, y: sideTop + stackH / 2 }, { x: cx, y: T.partner.plate.y - 30 }, { x: sxL, y: sideTop + stackH / 2 }];
      T.takeY = cy + 225 * kt + 27; T.promptY = handY - 38;
      // panel (bids / declare) over the lower felt, bottom at the fan
      const ph = Math.min(216, handY + 4 - (zoneBottom + 6));
      T.panel = { ...R(U.x0 + 16, handY + 4 - ph, U.w - 32, ph), col: false };
      const aw = (U.w - 60 - 28) / 2, ah = Math.min(104, ph - 108);
      T.act = { a: R(U.x0 + 30, T.panel.y + 98, aw, ah), b: R(U.x0 + 30 + aw + 28, T.panel.y + 98, aw, ah) };
      const deckSc = clamp((T.panel.y - 40 - bandTop - 8) / 187, 0.45, 0.9);
      T.deckSc = deckSc; T.deck = { x: cx, y: Math.min(cy, T.panel.y - 40 - 94 * deckSc - 6) };
      const tw = Math.min(600, U.w - 40);
      T.toast = R(cx - tw / 2, zoneBottom + 6, tw, 88);
      T.zoneBottom = zoneBottom;
    } else {
      // ---------------- wide ----------------
      const colW = clamp(Math.round(w * (w < 1100 ? 0.19 : 0.215)), 150, 300), pad = 8;
      const colL = study ? clamp(Math.round(w * 0.27), 210, 360) : colW;      // study scenes: wider left column for the lesson / daily text
      T.colW = colW;
      const lx = U.x0 + pad, rx = U.x1 - pad - colW;
      T.leftCol = R(lx, U.y0 + pad, colL, U.h - 2 * pad);
      T.rightCol = R(rx, U.y0 + pad, colW, U.h - 2 * pad);
      const cx0 = lx + colL + pad, cx1 = rx - pad, Cw = cx1 - cx0, cx = (cx0 + cx1) / 2;
      const topL = U.y0 + pad + (ins.back ? bk.h : 0);                 // left column content starts below the host back button
      const sh = clamp(Math.round(U.h * 0.105), 64, 80);
      T.sPl = [R(lx, topL, colL, sh), R(lx, topL + sh + 8, colL, sh)];
      T.chip = R(lx, topL + 2 * sh + 16, colL, 78);
      T.bar = R(lx, T.chip.y + T.chip.h + 8, colL, 128);
      T.lessonHdr = R(lx, topL, colL, U.y1 - pad - topL);
      // right column: the three buttons stacked on top, the bid / declare panel (a column of big buttons) under them
      const btnH = clamp(Math.round(46 / px), 66, 90);
      T.btn = { hint: R(rx, U.y0 + pad, colW, btnH), undo: R(rx, U.y0 + pad + btnH + 12, colW, btnH), menu: R(rx, U.y0 + pad + 2 * (btnH + 12), colW, btnH) };
      const zoneTop = U.y0 + Math.max(pad, 30), zoneH = study ? 104 + 14 + 40 + 6 : 67 + 14 + 40 + 4, zoneBottom = zoneTop + zoneH;   // the kit's preview clock sits at the very top centre
      const Rr = U.y1 - 10 - zoneBottom - 10 - 30;
      const f = (Rr - 40) / 685;
      const hs = clamp(1.12 * f, 0.5, 1), lift = 0.2 * CH * hs;
      const handY = U.y1 - 10 - CH * hs;
      T.hs = hs; T.handY = handY; T.lift = lift;
      T.handCx = cx; T.handW = Cw - 16; T.stepMax = CW * hs * 0.8;
      const bandTop = zoneBottom, bandBot = handY - lift - 30;
      // the table keeps 22 (rim) + 14 clear of the side hands and of the partner's plate above and your fan below
      const kt = clamp(Math.min(0.9 * f, (Cw - 230 - 60) / 376, (bandBot - bandTop - 2 * 36) / 570), 0.4, 1);
      T.kt = kt;
      const cy = (bandTop + bandBot) / 2;
      T.cy = cy; T.cx = cx;
      const fh = 451 * kt + 119 * kt, fw = clamp(Cw - 230, 376 * kt + 60, 1000);
      const dxo = clamp(fw * 0.2, 132 * kt, 260), dyo = 147 * kt;
      T.ts = 0.757 * kt;
      T.trick = [{ x: cx, y: cy + dyo }, { x: cx + dxo, y: cy }, { x: cx, y: cy - dyo }, { x: cx - dxo, y: cy }];
      T.felt = R(cx - fw / 2, cy - fh / 2, fw, fh);
      if (study) T.partner = { faces: { cx, y: zoneTop, maxW: Math.min(420, Cw - 200), step: 58 }, plate: { x: cx, y: zoneTop + 104 + 14, w: 150 } };
      else T.partner = { backs: { cx, y: zoneTop, pitch: 28, sc: 0.32 }, plate: { x: cx, y: zoneTop + 67 + 14, w: 150 } };
      const pitch = clamp((bandBot - bandTop - 100) / 7, 22, 44), stackH = 7 * pitch + 104;
      const sideTop = Math.max(bandTop + 46, cy - stackH / 2 + 12);
      const sxL = cx0 + 46, sxR = cx1 - 46;
      T.side = { top: sideTop, pitch, left: { x: sxL, plateX: sxL + 6 }, right: { x: sxR, plateX: sxR }, plateY: sideTop - 46 };
      T.bubble = [{ x: cx + 200, y: handY - 24 }, { x: sxR - 130, y: sideTop + 54 }, { x: cx + 190, y: T.partner.plate.y + 20 }, { x: sxL + 130, y: sideTop + 54 }];
      T.seat = [{ x: cx, y: handY + CH * hs / 2 }, { x: sxR, y: sideTop + stackH / 2 }, { x: cx, y: T.partner.plate.y - 30 }, { x: sxL, y: sideTop + stackH / 2 }];
      T.takeY = cy + 225 * kt + 27; T.promptY = handY - 34;
      const py0 = T.btn.menu.y + btnH + 16;
      T.panel = { ...R(rx, py0, colW, U.y1 - pad - py0), col: true };
      const abh = Math.min(92, (T.panel.h - 104 - 12 - 10) / 2);
      T.act = { a: R(rx + 8, T.panel.y + 104, colW - 16, abh), b: R(rx + 8, T.panel.y + 104 + abh + 10, colW - 16, abh) };
      const deckSc = clamp((bandBot - bandTop - 50) / 187, 0.45, 0.9);
      T.deckSc = deckSc; T.deck = { x: cx, y: cy - 12 };
      const tw = Math.min(600, Cw - 24);
      T.toast = R(cx - tw / 2, zoneBottom + 6, tw, 88);
      T.zoneBottom = zoneBottom;
    }
    // Auto Play HUD: status text + the think-time stepper
    const B = T.bar;
    if (!wide) {
      const bh = B.h - 8;
      T.autoInc = R(B.x + B.w - 8 - 64, B.y + (B.h - bh) / 2, 64, bh);
      T.autoLabel = { x: T.autoInc.x - 8 - 50, y: B.y + B.h / 2 + 6, size: 18 };
      T.autoDec = R(T.autoLabel.x - 50 - 8 - 64, T.autoInc.y, 64, bh);
      T.autoText = { x: B.x + 16, y: B.y + B.h / 2 + 7, size: 20, maxW: T.autoDec.x - B.x - 24 };
      T.autoPaused = { x: cxU, y: B.y - 6 };
    } else {
      const bh = 62;
      T.autoInc = R(B.x + B.w - 8 - 64, B.y + B.h - 8 - bh, 64, bh);
      T.autoDec = R(B.x + 8, B.y + B.h - 8 - bh, 64, bh);
      T.autoLabel = { x: B.x + B.w / 2, y: B.y + B.h - 8 - bh / 2 + 7, size: 20 };
      T.autoText = { x: B.x + 12, y: B.y + 30, size: 20, maxW: B.w - 24, wrap: true };
      T.autoPaused = { x: B.x + B.w / 2, y: B.y - 6 };
    }
    return T;
  };
  L.play = table(false);
  L.study = table(true);
  const T0 = L.play;

  // ---- overlay buttons (summary / result / lesson done / daily retry) -----------------------------------------------------
  if (!wide) {
    const by = T0.btn.hint.y - 14 - 104, bx = cxU - 200;
    L.overlay = { a: R(bx, by, 400, 104), b: R(bx, by - 14 - 90, 400, 90) };
  } else {
    const rc = T0.rightCol, bh = clamp(Math.round(48 / px), 70, 96);
    L.overlay = { a: R(rc.x, rc.y + rc.h - bh, rc.w, bh), b: R(rc.x, rc.y + rc.h - 2 * bh - 12, rc.w, bh) };
  }

  // ---- simple pages (Learn, Settings): header band, BACK ------------------------------------------------------------------
  const hdr = L.hdr = wide || !tallish
    ? { size: 52, base: U.y0 + 74, div: U.y0 + 96, top: U.y0 + 116 }
    : { size: 64, base: U.y0 + 120, div: U.y0 + 174, top: U.y0 + 200 };
  hdr.cx = cxU;
  // Back: top-left, unless the host's own back button sits there (then top-right)
  L.back = ins.back ? R(U.x1 - 24 - 120, hdr.base - 56, 120, 60) : R(U.x0 + 24, hdr.base - 56, 120, 60);
  {
    const n = 10;
    if (!wide) {
      const avail = U.y1 - 24 - hdr.top - 40, pitch = Math.min(116, avail / n), rowH = Math.min(100, pitch - 12);
      L.lessons = { rows: Array.from({ length: n }, (_, i) => R(U.x0 + 40, hdr.top + i * pitch, U.w - 80, rowH)), noteY: hdr.top + n * pitch + 24, compact: rowH < 90, note: pitch >= 100 };
    } else {
      const colw = Math.min(520, (U.w - 80) / 2), gap = 24, x0 = cxU - colw - gap / 2;
      const pitch = (U.y1 - 16 - hdr.top) / 5, rowH = Math.min(100, pitch - 10);
      L.lessons = { rows: Array.from({ length: n }, (_, i) => R(x0 + Math.floor(i / 5) * (colw + gap), hdr.top + (i % 5) * pitch, colw, rowH)), compact: rowH < 90, note: false };
    }
  }
  {
    if (!wide) {
      const top = hdr.top + (tallish ? 20 : 4), pitch = tallish ? 150 : 124, rh = tallish ? 116 : 104;
      const rows = ['sound', 'calm', 'big', 'four'].map((key, i) => ({ key, r: R(U.x0 + 60, top + i * pitch, U.w - 120, rh) }));
      const pvY = top + 4 * pitch + 24, sc = tallish ? 0.85 : 0.7;
      L.settings = { rows, previewLabelY: pvY, previewY: pvY + 24, previewSc: sc, previewGap: 140 * sc / 0.85, noteY: pvY + 24 + CH * sc + 40 };
    } else {
      const colw = Math.min(480, (U.w - 72) / 2), gap = 24, x0 = cxU - colw - gap / 2, rh = 96, pitch = 112;
      const rows = ['sound', 'calm', 'big', 'four'].map((key, i) => ({ key, r: R(x0 + (i % 2) * (colw + gap), hdr.top + Math.floor(i / 2) * pitch, colw, rh) }));
      const pvY = hdr.top + 2 * pitch + 22, sc = clamp((U.y1 - 24 - pvY - 30) / CH, 0.5, 0.8);
      L.settings = { rows, previewLabelY: pvY, previewY: pvY + 18, previewSc: sc, previewGap: CW * sc * 1.15, noteY: pvY + 18 + CH * sc + 24 };
    }
  }

  // ---- reference pages (About / Controls / Rules): a framed reader card + nav --------------------------------------------
  {
    const Ref = L.ref = {};
    if (!wide) {
      const ctrlY = U.y0 + 12, dh = 68, nh = tallish ? 116 : 90, navY = U.y1 - 20 - nh;
      Ref.inc = R(U.x1 - 20 - 130, ctrlY, 130, dh);
      Ref.dec = ins.back ? R(Ref.inc.x - 12 - 130, ctrlY, 130, dh) : R(U.x0 + 20, ctrlY, 130, dh);
      Ref.back = R(U.x0 + 20, navY, (U.w - 60) / 2, nh); Ref.next = R(U.x0 + 40 + (U.w - 60) / 2, navY, (U.w - 60) / 2, nh);
      Ref.pageY = navY - 24; Ref.pageX = cxU;
      const py = ctrlY + dh + 12;
      Ref.panel = R(U.x0 + 30, py, U.w - 60, Ref.pageY - 28 - py);
    } else {
      const colW = clamp(Math.round(w * 0.2), 190, 280), x1 = U.x1 - 16, x0 = x1 - colW, nh = clamp(Math.round(48 / px), 70, 92);
      Ref.dec = R(x0, U.y0 + 8, (colW - 12) / 2, 64); Ref.inc = R(x0 + (colW + 12) / 2, U.y0 + 8, (colW - 12) / 2, 64);
      Ref.next = R(x0, U.y1 - 12 - nh, colW, nh); Ref.back = R(x0, U.y1 - 12 - 2 * nh - 12, colW, nh);
      Ref.pageY = Ref.back.y - 14; Ref.pageX = x0 + colW / 2;
      const px0 = U.x0 + (ins.back ? bk.w + 8 : 16);
      Ref.panel = R(px0, U.y0 + 8, x0 - 16 - px0, U.h - 16);
    }
  }

  // ---- title -------------------------------------------------------------------------------------------------------------
  const titleCache = new Map();
  L.title = (hasSave) => {
    const k = hasSave ? 1 : 0;
    if (titleCache.has(k)) return titleCache.get(k);
    const n = hasSave ? 4 : 3, rows = {}, G = { rows, wide };
    if (!wide) {
      const g = tallish ? 22 : 12, lvl = tallish ? 76 : 60, sm = tallish ? 84 : 64, x = cxU - 270, wd = 540;
      const lockW = Math.max(240, 125 / px), lockH = Math.round(lockW * 327 / 1200), blurbH = 46;
      // the rows give way so the art keeps at least ~40 % of the height
      const rh = tallish ? 104 : clamp((U.h * 0.6 - lvl - 16 - sm - blurbH - lockH - 22 - n * g) / n, 54, 88);
      const RB = n * (rh + g) + lvl + 16 + sm + blurbH + lockH + 12;
      let y = U.y1 - 12 - RB; const top = y;
      const row = () => { const r = R(x, y, wd, rh); y += rh + g; return r; };
      if (hasSave) rows.resume = row();
      rows.play = row(); rows.learn = row(); rows.daily = row();
      rows.level = R(x, y, wd, lvl); y += lvl + 16;
      const smw = (wd - 4 * 10) / 5;
      ['settings', 'about', 'how', 'rules', 'auto'].forEach((nm, i) => { rows[nm] = R(x + i * (smw + 10), y, smw, sm); });
      G.lockup = { cx: cxU, y: y + sm + 12, w: lockW, h: lockH };
      G.blurbY = y + sm + 12 + lockH + 32;
      const artTop = U.y0 + 6, artBot = top - 8;
      const aH = artBot - artTop - 44, sa = clamp(Math.min(aH / 640, U.w / 720), 0.4, 1.2);
      G.artW = U.w - 40;
      G.art = { cx: cxU, cy: artTop + aH / 2 + 4, s: sa };
      G.tagY = artBot - 12;
      G.coffee = U.h >= 1500 ? { x: U.x0 + 70, y: top - 20, s: 0.5 } : null;
    } else {
      const rw = clamp(w * 0.34, 380, 560), x = U.x1 - 28 - rw, g = 12;
      const lockW = Math.min(rw, Math.max(228, 125 / px)), lockH = Math.round(lockW * 327 / 1200);
      const rh = clamp((U.h - 20 - 60 - 14 - 62 - 40 - lockH - 12 - n * g) / n, 52, 84), lvl = 60, sm = 62;
      const RB = n * (rh + g) + lvl + 14 + sm + 40 + lockH + 12;
      let y = U.y0 + Math.max(8, (U.h - RB) / 2);
      const row = () => { const r = R(x, y, rw, rh); y += rh + g; return r; };
      if (hasSave) rows.resume = row();
      rows.play = row(); rows.learn = row(); rows.daily = row();
      rows.level = R(x, y, rw, lvl); y += lvl + 14;
      const smw = (rw - 4 * 8) / 5;
      ['settings', 'about', 'how', 'rules', 'auto'].forEach((nm, i) => { rows[nm] = R(x + i * (smw + 8), y, smw, sm); });
      G.lockup = { cx: x + rw / 2, y: y + sm + 12, w: lockW, h: lockH };
      G.blurbY = y + sm + 12 + lockH + 28;
      const ax0 = U.x0 + 12, ax1 = x - 24, aw = ax1 - ax0;
      const aH = U.h - 56 - 24, sa = clamp(Math.min(aH / 700, aw / 720), 0.5, 1.2);
      G.art = { cx: (ax0 + ax1) / 2, cy: U.y0 + 34 + aH / 2, s: sa };
      G.tagY = U.y0 + 34 + aH + 22;
      G.artW = aw; G.coffee = null;
    }
    { const q = G.lockup, m = 44 / px, tw = Math.max(q.w + 24, m), th = Math.max(q.h + 12, m);
      G.lockTap = R(q.cx - tw / 2, q.y - 4, tw, Math.max(th, q.h + 8)); }
    titleCache.set(k, G);
    return G;
  };

  // ---- result page (match over) and the hand result card ------------------------------------------------------------------
  if (!wide) {
    const top = U.y0 + 16, bot = L.overlay.b.y - 14;
    L.over = { wide: false, s: clamp((bot - top) / 1130, 0.55, 1), top, cx: cxU, bot };
    const bot2 = L.overlay.b.y - 12, s = clamp((bot2 - top) / 1030, 0.6, 1);
    L.summary = { wide: false, s, cx: cxU, top: top + Math.max(0, ((bot2 - top) - 1030 * s) / 2) };
  } else {
    const rc = T0.rightCol;
    L.over = { wide: true, s: 1, left: R(U.x0 + 24, U.y0 + 12, rc.x - U.x0 - 48, U.h - 24), rightCol: rc };
    const x0 = U.x0 + 16, x1 = rc.x - 12;
    L.summary = { wide: true, s: 1, box: R(x0, U.y0 + 8, x1 - x0, U.h - 16) };
  }
  return L;
}
