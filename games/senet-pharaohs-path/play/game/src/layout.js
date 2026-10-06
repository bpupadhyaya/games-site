// Geometry, as a function of the LIVE screen size (kit 1.7 fluid viewport: the short side is always 720 units, the long side follows the aspect).
// `layoutFor(w, h)` returns every rectangle for that size; it is cached, so a frame never recomputes it.
//
// The board is three columns of ten squares: the path runs DOWN the left column (squares 1-10), UP the middle (11-20) and DOWN the right (21-30).
// The exit is below square 30. The board and the stick tray are painted in "canonical" units (the approved phone look) and PLACED with a uniform
// scale: screen = origin + s * canonical. Four arrangements share that idea:
//   tall    portrait phone (>= ~1500 high): the approved phone look, unchanged (s = 1).
//   stack   portrait tablet / short phone / squarish window: header on top, board, tray under it, button bar; the whole stack scales to fit.
//   side    wider portrait / squarish: header on top, the board on the left, the tray + message on the right, button bar under.
//   wide    landscape: left card (title, players, message, sticks), the board, right card (buttons).
export const THINK_STEPS = [2, 5, 8, 10];
export const AP_THINK_STEPS = THINK_STEPS;
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// Safe areas and the host's floating back button, in virtual units. main.js keeps this current (browsers: all zero).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };   // px: css pixels per virtual unit (text never shrinks below ~11 css px)

// ---- canonical board (the approved phone look) ------------------------------------------------------------------------------
export const W = 720, H = 1560;
export const CW = 164, CH = 88, BX = 114, BY = 352;            // one square, and the top-left of the 3 x 10 grid
export const BOARD = { x: BX, y: BY, w: CW * 3, h: CH * 10 };
export const BOX = { x: 56, y: 296, w: 620, h: 1040 };         // the painted board layer (frame, shadow, exit slot)
export const SIZEBOX = { x: 84, y: 320, w: 552, h: 974 };      // what has to fit on the screen
export const colRow = (i) => { const c = Math.floor(i / 10), k = i % 10; return { c, r: c === 1 ? 9 - k : k }; };
export const idxAt = (c, r) => (c === 1 ? 10 + (9 - r) : c * 10 + r);
export function cell(i) {
  const { c, r } = colRow(i);
  return { x: BX + c * CW, y: BY + r * CH, w: CW, h: CH, cx: BX + c * CW + CW / 2, cy: BY + r * CH + CH / 2 };
}
// The exit: a slot below the last square. TAP it to bring a piece home.
export const EXIT = { x: BX + 2 * CW + 12, y: BY + 10 * CH + 4, w: CW - 24, h: 50, cx: BX + 2.5 * CW, cy: BY + 10 * CH + 29 };
// Which square does a canonical point mean? -1 none, 30 = the exit.
export function squareAtCanon(x, y) {
  if (inRect(EXIT, x, y)) return 30;
  if (x < BX || x >= BX + 3 * CW || y < BY || y >= BY + 10 * CH) return -1;
  return idxAt(Math.floor((x - BX) / CW), Math.floor((y - BY) / CH));
}
// The stick tray in two shapes (local units): a row (sticks left, result bubble right) and a card (sticks above, bubble below).
export const TRAYS = {
  row: { w: 544, h: 142, sx: 255, sy: 71, bx: 468, by: 71 },
  card: { w: 372, h: 276, sx: 186, sy: 76, bx: 186, by: 196 },
};
export const TRAY = { x: 88, y: 1300, w: 544, h: 142 };         // the phone tray, canonical (kept for tests)

const R = (x, y, w, h) => ({ x, y, w, h });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const BAR_H = 72;

const cache = new Map();
export function layoutFor(w, h) {
  w = Math.round(w); h = Math.round(h);
  const key = `${w}x${h}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}`;
  let L = cache.get(key);
  if (!L) { L = build(w, h, { ...host }); L.key = key; cache.set(key, L); if (cache.size > 40) cache.delete(cache.keys().next().value); }
  return L;
}

function build(w, h, ins) {
  const land = w >= h;
  const L = { w, h, land, ins };
  const backSz = ins.back ? Math.max(ins.back, 56) : 0;
  L.backBox = ins.back ? R(ins.l, ins.t, backSz + 8, backSz + 8) : R(0, 0, 0, 0);
  const U = L.U = { x0: ins.l, y0: ins.t, x1: w - ins.r, y1: h - ins.b }; U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  L.fx = (w - 720) / 2;                                           // phone-shaped screens are centred when the window is wider than 720
  L.lift = Math.max(0, ins.b - 16);
  L.barY = h - 26 - BAR_H - L.lift;
  L.wide = land && w >= h * 1.3 ? wideSizes(L) : null;
  L.play = L.wide ? composeWide(L, 0) : composePortrait(L, 0);
  L.card = L.wide ? composeWide(L, 1) : composePortrait(L, 1);
  if (L.play.mode !== L.card.mode) { L.play = composePortrait(L, 0, 'stack'); L.card = composePortrait(L, 1, 'stack'); }   // one arrangement per screen size
  L.mode = L.play.mode;
  L.tall = L.mode === 'tall';
  L.wallH = L.play.wallH;
  L.doc = buildDoc(L);
  L.res = buildResult(L);
  const titleCache = {};
  L.title = (hasSave) => (titleCache[hasSave ? 1 : 0] ??= buildTitle(L, !!hasSave));
  return L;
}

// ---------------------------------------------------------------------------------------------------------------------------
// Landscape
// ---------------------------------------------------------------------------------------------------------------------------
function wideSizes(L) {
  const { U, ins } = L, wallH = 30, top = U.y0 + wallH + 10, bot = U.y1 - 10, colH = bot - top;
  const s = Math.min(1, colH / SIZEBOX.h), BW = SIZEBOX.w * s, gap = 14, mx = 10;
  const x0min = ins.back ? Math.max(U.x0 + mx, L.backBox.x + L.backBox.w + 6) : U.x0 + mx;
  const availW = U.x1 - mx - x0min - BW - 2 * gap;
  const LW = clamp(availW * 0.58, 0, 440), RW = clamp(availW - LW, 0, 300);
  if (LW < 250 || RW < 150) return null;
  const total = LW + RW + BW + 2 * gap, gx = Math.max(x0min, U.x0 + (U.w - total) / 2);
  return { wallH, top, bot, colH, s, BW, LW, RW, gap, gx };
}

function composeWide(L, kind) {
  const S = L.wide, { wallH, top, colH, s, BW, LW, RW, gap, gx } = S;
  const C = { mode: 'wide', wallH, kind };
  const bx0 = gx + LW + gap;
  C.board = { s, ox: bx0 - SIZEBOX.x * s, oy: top + (colH - SIZEBOX.h * s) / 2 - SIZEBOX.y * s };
  C.leftCard = R(gx, top, LW, colH);
  C.rightCard = R(bx0 + BW + gap, top, RW, colH);
  const innerW = LW - 24, cxL = gx + LW / 2;
  // header (play): title, two player panels, caption
  const ph = innerW >= 290 ? 82 : 96;
  const p1y = top + 66, p2y = p1y + ph + 8, capY = p2y + ph + 22;
  const headEnd = capY + 8;
  // tray: the card shape when it fits, else the row
  const msgMin = 90;
  let v = 'card', ts = Math.min(1, innerW / TRAYS.card.w, (colH - (kind ? 150 : headEnd - top) - msgMin - 50) / TRAYS.card.h);
  const tsRow = Math.min(1, innerW / TRAYS.row.w);
  if (ts < tsRow * 1.1) { v = 'row'; ts = tsRow; }
  ts = Math.max(0.3, ts);
  C.tray = { v, s: ts, x: cxL - TRAYS[v].w * ts / 2, y: top + colH - 12 - TRAYS[v].h * ts };
  const msgTop = (kind ? top + 8 : headEnd) + 6, msgBot = C.tray.y - 38 * ts;
  C.hud = {
    title: { x: cxL, y: top + 50, size: 48, maxW: innerW },
    panels: [R(gx + 12, p1y, innerW, ph), R(gx + 12, p2y, innerW, ph)],
    cap: { x: cxL, y: capY, size: 18 },
  };
  if (kind) {
    const cardBot = msgBot - 100 - 6;                               // the lesson card takes what is above the message slot
    C.hud.card = R(gx + 8, top + 8, LW - 16, Math.max(120, cardBot - top - 8));
    const my = C.hud.card.y + C.hud.card.h + 8;
    C.msg = { fixed: true, rect: R(gx + 10, my, LW - 20, Math.max(60, msgBot - my)) };
  } else C.msg = { fixed: true, rect: R(gx + 10, msgTop, LW - 20, Math.max(60, msgBot - msgTop)) };
  // buttons: a column in the right card
  const bw = clamp(RW - 24, 120, 300), bh = RW >= 200 ? 76 : 68, bgap = 14, bx = C.rightCard.x + (RW - bw) / 2, y0 = top + 22;
  const slot = (i) => R(bx, y0 + i * (bh + bgap), bw, bh);
  C.BTN = { menu: slot(0), undo: slot(1), hint: slot(2), apExit: slot(0), apPause: slot(1), apDec: slot(2), apInc: slot(3), next: slot(1), share: slot(1) };
  C.brand = { cx: C.rightCard.x + RW / 2, bottom: top + colH - 14, w: RW - 24, room: top + colH - 14 - (y0 + 4 * bh + 3 * bgap) >= 96 };
  C.lamps = [[gx - 30, top + colH * 0.3], [gx - 30, top + colH * 0.75], [C.rightCard.x + RW + 30, top + colH * 0.3], [C.rightCard.x + RW + 30, top + colH * 0.75]];
  C.throwRect = R(C.tray.x - 20 * ts, C.tray.y - 40 * ts, TRAYS[v].w * ts + 40 * ts, TRAYS[v].h * ts + 60 * ts);
  return C;
}

// ---------------------------------------------------------------------------------------------------------------------------
// Portrait family: tall / stack / side
// ---------------------------------------------------------------------------------------------------------------------------
function composePortrait(L, kind, force) {
  const { w, h, ins, fx, barY } = L;
  const C = { kind };
  const backBottom = ins.back ? L.backBox.y + L.backBox.h : 0;
  const yTmin = Math.max(ins.t + 14, backBottom + 6 - 50);
  const hdrH = kind ? 214 : 156;
  // ---- try the approved phone look first ----
  const ytTall = Math.max(100, yTmin), hs = ytTall - 100, barShift = barY - 1462;
  const tall = w < h && h >= 1500 && hs <= barShift + 10 && w === 720;
  let yT;
  if (tall) {
    yT = ytTall; C.mode = 'tall';
    const bdy = Math.max(hs, Math.floor(barShift / 2)), tdy = Math.max(bdy, barShift);
    C.board = { s: 1, ox: fx, oy: bdy };
    C.tray = { v: 'row', s: 1, x: fx + TRAY.x, y: TRAY.y + tdy };
    C.wallH = 317 + Math.max(0, hs);
    C.lamps = [[44, 800 + bdy], [676, 800 + bdy], [44, 1180 + bdy], [676, 1180 + bdy]];
  } else {
    yT = Math.max(yTmin, 52);                                      // clear of the kit's preview chip (top centre, y 6..34)
    const HB = yT + hdrH, R0 = HB + 10, R1 = barY - 10, Rh = R1 - R0;
    C.wallH = yT + 250;                                            // the wall's lower stripe sits behind the board's top edge, clear of the header texts
    const s1 = Math.min(1, Rh / 1152);
    // side: board left, tray card + message right
    const s2 = Math.min(1, Rh / SIZEBOX.h), RCW = w - 14 * 2 - SIZEBOX.w * s2 - 14, tsSide = Math.min(1, (Math.min(RCW, 420) - 8) / TRAYS.card.w);
    const sideOk = force !== 'stack' && RCW >= 250 && TRAYS.card.h * tsSide + 110 <= Rh && s2 >= s1 * 1.1 && w > h * 0.62;
    if (sideOk) {
      C.mode = 'side';
      const RW = Math.min(RCW, 420), total = SIZEBOX.w * s2 + 14 + RW, gx = (w - total) / 2;
      const top = R0 + (Rh - SIZEBOX.h * s2) / 2;
      C.board = { s: s2, ox: gx - SIZEBOX.x * s2, oy: top - SIZEBOX.y * s2 };
      const colX = gx + SIZEBOX.w * s2 + 14;
      C.rightCard = R(colX, top, RW, SIZEBOX.h * s2);
      C.tray = { v: 'card', s: tsSide, x: colX + (RW - TRAYS.card.w * tsSide) / 2, y: top + 44 * tsSide };
      const my = C.tray.y + TRAYS.card.h * tsSide + 14;
      C.sideMsg = R(colX + 6, my, RW - 12, Math.max(60, top + SIZEBOX.h * s2 - my - 6));
    } else {
      C.mode = 'stack';
      const s = s1, y0 = R0 + (Rh - 1152 * s) / 2;
      C.board = { s, ox: w / 2 - 360 * s, oy: y0 - SIZEBOX.y * s };
      C.tray = { v: 'row', s, x: w / 2 - TRAYS.row.w * s / 2, y: y0 + (SIZEBOX.h + 36) * s };
    }
    C.lamps = [[34, h * 0.42], [w - 34, h * 0.42], [34, h * 0.72], [w - 34, h * 0.72]];
  }
  const ts = C.tray.s, TT = TRAYS[C.tray.v];
  C.throwRect = R(C.tray.x - 20 * ts, C.tray.y - 40 * ts, TT.w * ts + 40 * ts, TT.h * ts + 60 * ts);
  // ---- header furniture (phone-shaped, centred by fx) ----
  C.hud = {
    title: { x: fx + 410, y: yT + 28, size: 52, maxW: 330 },
    panels: [R(fx + 36, yT + 50, 312, 82), R(fx + 372, yT + 50, 312, 82)],
    cap: { x: fx + 360, y: yT + 146, size: 18 },
    label: { x: fx + 360, y: yT + 28 },
  };
  if (kind) C.hud.card = R(fx + 24, yT, 672, 214);
  const mTop = kind ? yT + 230 : yT + 162;
  C.msg = C.mode === 'side' ? { fixed: true, rect: C.sideMsg } : { fixed: false, x: fx + 40, w: 640, y: mTop };
  // ---- buttons: the bottom bar ----
  const bx = fx;
  C.BTN = {
    menu: R(bx + 60, barY, 190, BAR_H), undo: R(bx + 265, barY, 190, BAR_H), hint: R(bx + 470, barY, 190, BAR_H),
    next: R(bx + 265, barY, 395, BAR_H), share: R(bx + 265, barY, 395, BAR_H),
    apExit: R(bx + 60, barY, 141, BAR_H), apPause: R(bx + 213, barY, 141, BAR_H), apDec: R(bx + 366, barY, 141, BAR_H), apInc: R(bx + 519, barY, 141, BAR_H),
  };
  C.brand = null;
  return C;
}

// ---------------------------------------------------------------------------------------------------------------------------
// Result / pause card (a block about 640 units tall, centred in the screen; the phone look when the screen is 1560 high)
// ---------------------------------------------------------------------------------------------------------------------------
function buildResult(L) {
  const { w, h, ins } = L;
  const usable = h - ins.t - ins.b, k = Math.min(1, (usable - 24) / 850);
  const cy = ins.t + usable / 2;                                   // the block spans legacy y 338..1170, centred on 754
  const X = (x) => w / 2 + (x - 360) * k, Y = (y) => cy + (y - 754) * k;
  const bw = 440 * k;
  return {
    k, cx: w / 2, X, Y,
    again: R(w / 2 - bw / 2, Y(900), bw, 96 * k), back: R(w / 2 - bw / 2, Y(1016), bw, 84 * k),
    more: { x: w / 2, y: Y(1150) },
  };
}

// ---------------------------------------------------------------------------------------------------------------------------
// Reference pages (About, How to play, Rules): title row, framed scrolling body, three-slot nav row
// ---------------------------------------------------------------------------------------------------------------------------
function buildDoc(L) {
  const { h, U, ins } = L;
  const topY = Math.max(ins.t + 10, 18), navH = 84, navY = h - 36 - navH - L.lift;
  const sw = 84, sh = 62;
  const step = { inc: R(U.x1 - 16 - sw, topY, sw, sh), dec: R(U.x1 - 16 - 2 * sw - 10, topY, sw, sh) };
  const backR = L.backBox.w ? L.backBox.x + L.backBox.w : U.x0 + 16;
  const pw = Math.min(U.w - 32, 1000), px = U.x0 + (U.w - pw) / 2, py = topY + sh + 14;
  const panel = R(px, py, pw, navY - 14 - py);
  const view = R(panel.x + 24, panel.y + 18, panel.w - 48 - 20, panel.h - 18 - 56);
  const slotW = Math.min(200, (U.w - 80) / 3), gap = 20, total = 3 * slotW + 2 * gap, nx = U.x0 + (U.w - total) / 2;
  const nav = { prev: R(nx, navY, slotW, navH), back: R(nx + slotW + gap, navY, slotW, navH), next: R(nx + 2 * (slotW + gap), navY, slotW, navH) };
  return {
    step, panel, view, nav, scrollbar: R(panel.x + panel.w - 26, view.y, 16, view.h), counterY: panel.y + panel.h - 20,
    titleBox: { x0: backR + 8, x1: step.dec.x - 12, y: topY + 46 },
  };
}

// ---------------------------------------------------------------------------------------------------------------------------
// Title screen
// ---------------------------------------------------------------------------------------------------------------------------
function buildTitle(L, hasSave) {
  const { w, h, U, ins } = L, T = { rows: {} };
  const lockW0 = Math.max((L.tall || !L.wide ? 0.35 : 0.28) * 720, 120 / Math.max(host.px, 1e-6)), LK = Math.round(lockW0 * 327 / 1200) + 34;   // lockup width and the strip it needs under the menu
  const pair = [['resume'], ['learn', 'play'], ['two', 'daily'], ['how', 'autoplay'], ['about', 'rules'], ['level', 'sound'], ['calm', 'big']].filter((r) => hasSave || r[0] !== 'resume');
  if (L.tall) {                                                   // the phone's single column (kept exactly), shifted when the screen is taller
    const oy = Math.max(0, Math.floor((h - 1560) / 2)), names = (hasSave ? ['resume'] : []).concat(['learn', 'play', 'two', 'daily', 'how', 'autoplay']), n = names.length;
    let base = 790 + oy;
    const need = (n + 1) * 76 + 6 + 68 + 96 + 46 + LK, avail = h - Math.max(22, ins.b + 8) - base, shift = Math.min(Math.max(0, need - avail), 60), f = Math.min(1, (avail + shift) / need);
    base -= shift;
    const rp = 76 * f, rh = 66 * f, sp = 68 * f, sh = 60 * f;
    names.forEach((nm, i) => { T.rows[nm] = R(90, base + i * rp, 540, rh); });
    const ar = base + n * rp, half = (540 - 14) / 2;
    T.rows.about = R(90, ar, half, rh); T.rows.rules = R(90 + half + 14, ar, half, rh);
    const y = base + (n + 1) * rp + 6 * f;
    T.rows.level = R(90, y, 262, sh); T.rows.sound = R(368, y, 262, sh); T.rows.calm = R(90, y + sp, 262, sh); T.rows.big = R(368, y + sp, 262, sh);
    T.hero = { hs: 1, hx: L.fx, hy: oy, dx: 50 };
    T.stars = { x: 96, y: y + sp + 96 * f, played: y + sp + 142 * f, cx: 360 };
    T.drawBoard = true; T.dimMode = 'tall'; T.oy = oy;
    T.lockup = { cx: 360, y: T.stars.played + 26, w: Math.min(lockW0, 600) }; T.msg = { x: 360, y: 770 + oy, w: 620 };
    return T;
  }
  const n = pair.length;
  const place = (x0, aw, y0, pitch, bh) => pair.forEach((row, i) => {
    const y = y0 + i * pitch;
    if (row.length === 1) T.rows[row[0]] = R(x0, y, aw, bh);
    else { const cw = (aw - 14) / 2; T.rows[row[0]] = R(x0, y, cw, bh); T.rows[row[1]] = R(x0 + cw + 14, y, cw, bh); }
  });
  const bottomPad = Math.max(14, ins.b + 8);
  if (!L.wide) {                                                   // art on top, a two-column grid below
    const topPad = Math.max(10, ins.t + 6), aw = Math.min(U.w - 48, 640);
    let pitch = 76, withLock = true;
    const need = (p, lock) => n * p + 96 + (lock ? LK : 0) + bottomPad;
    const minHero = 340;
    while (h - topPad - need(pitch, true) < minHero && pitch > 58) pitch -= 2;
    if (h - topPad - need(pitch, true) < minHero) withLock = false;
    const bh = pitch - 10, blockH = need(pitch, withLock), y0 = h - blockH;
    place(U.x0 + (U.w - aw) / 2, aw, y0 + 8, pitch, bh);
    const sy = y0 + 8 + n * pitch + 8;
    T.stars = { x: w / 2 - 150, y: sy + 24, played: sy + 66, cx: w / 2 };
    T.lockup = withLock ? { cx: w / 2, y: sy + 84, w: Math.min(lockW0, aw) } : null;
    const zone = y0 - 10 - topPad, hs = clamp((zone - 10) / 660, 0.4, 1);
    T.hero = { hs, hx: (w - 720 * hs) / 2, hy: topPad + (zone - 660 * hs) / 2 - 126 * hs, dx: 0 };
    T.dim = R(0, y0 - 6, w, h - y0 + 6); T.dimMode = 'compact'; T.msg = { x: w / 2, y: y0 - 14, w: aw }; T.drawBoard = false;
    return T;
  }
  // wide: art on the left, a card of buttons on the right
  const aw = clamp(w * 0.46, 460, 700), ax = U.x1 - aw - 16, pitch = Math.min(80, (U.h - 40 - 100 - LK) / n), bh = pitch - 10;
  const blockH = n * pitch + 96 + LK, y0 = U.y0 + (U.h - blockH) / 2;
  place(ax + 20, aw - 40, y0 + 6, pitch, bh);
  const sy = y0 + 6 + n * pitch + 6;
  T.stars = { x: ax + aw / 2 - 150, y: sy + 24, played: sy + 66, cx: ax + aw / 2 };
  T.card = R(ax, y0 - 10, aw, blockH + 20);
  const leftW = ax - U.x0 - 8, lcx = U.x0 + leftW / 2, hs = clamp(Math.min((leftW - 24) / 720, (U.h - 130) / 660), 0.35, 1.1);
  T.hero = { hs, hx: lcx - 360 * hs, hy: U.y0 + (U.h - 90 - 660 * hs) / 2 - 126 * hs + 10, dx: 0 };
  T.lockup = { cx: ax + aw / 2, y: sy + 84, w: Math.min(lockW0, aw - 40) };
  T.dimMode = 'wide'; T.msg = { x: lcx, y: U.y1 - 18, w: leftW - 30 }; T.drawBoard = false;
  return T;
}

// ---- test / back-compat exports: the approved phone-portrait layout (720 x 1560) ---------------------------------------------
const PHONE = layoutFor(720, 1560);
export const BTN = { ...PHONE.play.BTN, again: PHONE.res.again, back: PHONE.res.back };
export const PAGE = PHONE.doc.nav;
export const TEXT_STEPPER = PHONE.doc.step;
export const titleRows = (hasSave) => PHONE.title(hasSave).rows;

// Tap zone of the Arcforge lockup (title screen): at least 44 x 44 css px, grown sideways/downwards only.
export const creditHit = (k) => { const m = 44 / Math.max(host.px, 1e-6), lh = k.w * 327 / 1200, w = Math.max(k.w, m), h = Math.max(lh, m); return { x: Math.round(k.cx - w / 2), y: Math.round(k.y), w: Math.round(w), h: Math.round(h) }; };
