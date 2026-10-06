// Geometry as a pure function of the LIVE screen size (kit 1.7 fluid viewport: the short side is always 720 units, the long side
// grows with the aspect ratio). `layoutFor(w, h)` returns every rectangle for that size, cached by size + safe insets, so
// rendering and pointer hit-testing always read the same numbers. No DOM, no canvas.
//
// Three shapes (see STATUS.md "Fluid layout"):
//   tall     portrait phone with room for the big look: header, board, crown tally, Hint/Undo/Menu row, Colours row, hint line.
//   compact  portrait but shorter (tablets, small phones): header with three chips, a larger board, one row of four buttons.
//   wide     landscape / squarish: the board is a square (left, or centred between two cards); cards hold status and buttons.
// The square board always takes the largest size that fits; controls never overlap it.

export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
// Auto Play ("Watch & Learn"): index-based THINK steps (never a raw float), hard-capped at 10 s; REVEAL is fixed.
export const AUTO_THINK_STEPS = [2, 5, 8, 10];
export const AUTO_REVEAL_SECS = 2;

// "More from Arcforge" chips on the solved screen: paid games only, never another free game (owner decision 2026-09-23).
export const SIBLINGS = [
  { slug: 'tiger-and-goat', title: 'Tiger and Goat' },
  { slug: 'go-stones-and-territory', title: 'Go' },
  { slug: 'carrom-striker-and-queen', title: 'Carrom' },
  { slug: 'word-game', title: 'Word Game' },
];

export const inRect = (x, y, r) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// Safe areas and the host's floating back button, in virtual units. main.js keeps this current (browsers: all zero).
// px = css pixels per virtual unit, so text can be kept at >= ~11 css px.
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };

const R = (x, y, w, h) => ({ x, y, w, h });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const frameOf = (px) => Math.max(12, px * 0.03);       // the gold frame round the board (view.js paintBoard uses the same rule)

const cache = new Map();
export function layoutFor(w, h) {
  w = Math.round(w); h = Math.round(h);
  const key = `${w}x${h}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}`;
  let L = cache.get(key);
  if (!L) {
    L = build(w, h, { ...host });
    L.key = key;
    cache.set(key, L);
    if (cache.size > 40) cache.delete(cache.keys().next().value);
  }
  return L;
}

// Flat cell index (row*size+col) under (x, y), or -1.
export function hitTestCell(L, x, y, size) {
  const b = L.play.board, cs = b.px / size;
  const col = Math.floor((x - b.x) / cs), row = Math.floor((y - b.y) / cs);
  if (row < 0 || row >= size || col < 0 || col >= size) return -1;
  return row * size + col;
}
export function cellCenter(L, size, row, col) {
  const b = L.play.board, cs = b.px / size;
  return { x: b.x + col * cs + cs / 2, y: b.y + row * cs + cs / 2 };
}

function build(w, h, ins) {
  const land = w >= h;
  const U = { x0: ins.l, y0: ins.t, x1: w - ins.r, y1: h - ins.b };
  U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  const bs = ins.back ? Math.max(ins.back, 56) + 8 : 0;
  const back = R(ins.l, ins.t, bs, bs);                       // the host's floating back button (empty when there is none)
  const L = { w, h, land, U, back, ins };
  L.title = land ? titleWide(w, h, U, back, ins) : titleTall(w, h, U, ins);
  L.play = land ? playWide(w, h, U, back) : playPortrait(w, h, U, back);
  L.mode = land ? 'wide' : L.play.tall ? 'tall' : 'compact';
  L.card = solvedCard(L);
  L.rules = rulesLayout(w, h, U, back);
  const dw = Math.min(620, U.w - 40);
  L.demo = { card: R(U.x0 + (U.w - dw) / 2, U.y0 + (U.h - 470) / 2, dw, 470) };
  return L;
}

// ---------------------------------------------------------------------------------------------------------------------
// Title
// ---------------------------------------------------------------------------------------------------------------------
// The tap zone of the title lockup: the lockup padded to at least 44 x 44 css px (never reaching into a button above it).
function padHit(r, ins) {
  const m = 44 / Math.max(0.3, ins.px || 0.6), pw = Math.max(0, m - r.w) / 2, ph = Math.max(0, m - r.h) / 2;
  return R(r.x - pw, r.y - Math.min(ph, 6), r.w + 2 * pw, r.h + Math.min(ph, 6) + ph);
}

function titleTall(w, h, U, ins) {
  const top = U.y0 + 8, bot = U.y1 - 10;
  const big = bot - top >= 1380;
  const T = { big, wide: false };
  const lockH = 68, lockW = Math.round(lockH * 1200 / 327);
  T.hintY = bot - 4;                                               // baseline of the one-line hint / progress pill (bottom line)
  T.footRow = R(24, T.hintY - 26, w - 48, 34);
  T.lockup = R((w - lockW) / 2, T.footRow.y - 8 - lockH, lockW, lockH);   // centred directly under the last button, above the foot line
  T.lockHit = padHit(T.lockup, ins);
  const blockH = big ? 360 : 230;
  Object.assign(T, big
    ? { crown: { x: w / 2, y: top + 150, r: 62 }, titleY: top + 292, titleSize: 70, tagY: top + 338 }
    : { crown: { x: w / 2, y: top + 72, r: 44 }, titleY: top + 168, titleSize: 58, tagY: top + 206 });
  T.cx = w / 2; T.titleMaxW = 640;
  const gap = big ? 22 : 12;
  let y;
  if (big) {
    const btnH = 124 + 100 + 100 + 96 + 64 + 4 * gap, btnTop = T.lockup.y - 14 - btnH;
    y = btnTop;
    T.play7 = R(90, y, 540, 124); y += 124 + gap;
    T.expert = R(90, y, 540, 100); y += 100 + gap;
    T.daily = R(90, y, 540, 100); y += 100 + gap;
    T.colour = R(90, y, 262, 96); T.rules = R(368, y, 262, 96); y += 96 + gap;
    T.auto = R(90, y, 540, 64);
    T.btnTop = btnTop;
  } else {
    const btnH = 84 + 64 + 64 + 56 + 3 * gap, btnTop = T.lockup.y - 12 - btnH;
    y = btnTop;
    const cw = (600 - 14) / 2;
    T.play7 = R(60, y, 600, 84); y += 84 + gap;
    T.expert = R(60, y, cw, 64); T.daily = R(60 + cw + 14, y, cw, 64); y += 64 + gap;
    T.colour = R(60, y, cw, 64); T.rules = R(60 + cw + 14, y, cw, 64); y += 64 + gap;
    T.auto = R(60, y, 600, 56);
    T.btnTop = btnTop;
  }
  const space = T.btnTop - (top + blockH) - 10;
  const px = Math.min(big ? 420 : 460, Math.floor((space - 2 * 16) / 1.06));
  if (px >= 150) { const F = frameOf(px); T.hero = { x: (w - px) / 2, y: top + blockH + 6 + (space - px - 2 * F) / 2 + F, px, n: 5 }; }
  else T.hero = null;
  return T;
}

function titleWide(w, h, U, back, ins) {
  const T = { big: false, wide: true };
  const m = 14, gap = 28;
  let px = Math.min(U.h - 2 * (m + 20), U.w - 2 * m - gap - 380);
  px = clamp(Math.floor(px), 160, 640);
  const F = frameOf(px);
  let colW = clamp(U.w - 2 * m - gap - (px + 2 * F), 340, 560);
  const total = px + 2 * F + gap + colW;
  const gx = U.x0 + Math.max(m, (U.w - total) / 2);
  const hx = gx + F;
  let hy = U.y0 + (U.h - px) / 2;
  const hf = R(hx - F - 6, hy - F - 6, px + 2 * F + 12, px + 2 * F + 12);
  if (back.w && hf.x < back.x + back.w && hf.y < back.y + back.h) {                       // keep the hero clear of the host back button
    hy = Math.max(hy, back.y + back.h + F + 10); px = Math.min(px, Math.floor(U.y1 - m - F - hy));
  }
  T.hero = px >= 150 ? { x: hx, y: hy, px, n: 5 } : null;
  const cx0 = gx + px + 2 * F + gap, cw = U.x1 - cx0 - m, colX = cx0 + Math.max(0, (cw - colW) / 2);
  colW = Math.min(colW, cw);
  const gp = 12, lockH = 68, lockW = Math.round(lockH * 1200 / 327);
  const blockH = 196, btnH = 84 + 64 + 64 + 56 + 3 * gp, footH = lockH + 8 + 34;
  const need = blockH + 16 + btnH + 16 + footH;
  let y = U.y0 + Math.max(6, (U.h - need) / 2);
  const cx = colX + colW / 2;
  T.crown = { x: cx, y: y + 40, r: 38 };
  T.titleY = y + 122; T.titleSize = 54; T.tagY = y + 160; T.cx = cx; T.titleMaxW = colW;
  y += blockH + 16;
  const cw2 = (colW - 14) / 2;
  T.btnTop = y;
  T.play7 = R(colX, y, colW, 84); y += 84 + gp;
  T.expert = R(colX, y, cw2, 64); T.daily = R(colX + cw2 + 14, y, cw2, 64); y += 64 + gp;
  T.colour = R(colX, y, cw2, 64); T.rules = R(colX + cw2 + 14, y, cw2, 64); y += 64 + gp;
  T.auto = R(colX, y, colW, 56); y += 56 + 10;
  T.lockup = R(cx - lockW / 2, y, lockW, lockH); T.lockHit = padHit(T.lockup, ins);
  T.footRow = R(colX, y + lockH + 8, colW, 34);
  T.hintY = T.footRow.y + 26;
  return T;
}

// ---------------------------------------------------------------------------------------------------------------------
// Play (also Auto Play, solved)
// ---------------------------------------------------------------------------------------------------------------------
// Fit the largest square board (plus its gold frame) into the free box, centred in it.
function fitBoard(x0, y0, availW, availH) {
  let px = Math.floor(Math.min(availW, availH) / 1.06);
  const F = frameOf(px);
  px = Math.floor(Math.min(availW, availH) - 2 * F);
  return { x: x0 + (availW - px) / 2, y: y0 + (availH - px) / 2, px, F: frameOf(px) };
}

function playPortrait(w, h, U, back) {
  const P = { wide: false };
  const top = U.y0 + 10, bot = U.y1 - 16;
  const tall = bot - top >= 1330;
  P.tall = tall;
  const rowH = tall ? 96 : 72, gap = 12;
  const chipY = Math.max(top + (tall ? 100 : 64), back.h ? back.y + back.h + 6 : 0);
  let ctlTop;
  P.msg = R(24, bot - 30, w - 48, 30);
  if (tall) {
    P.title = { x: w / 2, y: top + 84, size: 50, label: { y: top + 18, size: 24 }, maxW: 600 };
    P.chips = [R(116, chipY, 232, 62), R(372, chipY, 232, 62)];
    P.chipKinds = ['time', 'moves'];
    P.headBottom = chipY + 62;
    const colourY = P.msg.y - gap - 84;
    const rowY = colourY - gap - rowH;
    const cw = (640 - 2 * 14) / 3;
    const slots = [R(40, rowY, cw, rowH), R(40 + cw + 14, rowY, cw, rowH), R(40 + 2 * (cw + 14), rowY, cw, rowH), R(40, colourY, 640, 84)];
    P.slots = slots;
    P.btn = { hint: slots[0], undo: slots[1], menu: slots[2], colour: slots[3] };
    P.abtn = { exit: slots[0], pause: slots[1], skip: slots[2], think: slots[3] };
    P.tally = { cx: w / 2, labelY: rowY - gap - 62, rowY: rowY - gap - 24, maxW: 580 };
    ctlTop = P.tally.labelY - 28;
  } else {
    P.title = { x: w / 2, y: top + 46, size: 40, label: null, maxW: 600 };
    const cw = (w - 48 - 2 * 12) / 3;
    P.chips = [0, 1, 2].map((i) => R(24 + i * (cw + 12), chipY, cw, 54));
    P.chipKinds = ['time', 'moves', 'crowns'];
    P.headBottom = chipY + 54;
    const rowY = P.msg.y - 10 - rowH, cw4 = (w - 48 - 3 * 10) / 4;
    const slots = [0, 1, 2, 3].map((i) => R(24 + i * (cw4 + 10), rowY, cw4, rowH));
    P.slots = slots;
    P.btn = { hint: slots[0], undo: slots[1], colour: slots[2], menu: slots[3] };
    P.abtn = { exit: slots[0], pause: slots[1], skip: slots[2], think: slots[3] };
    P.tally = null;
    ctlTop = rowY;
  }
  const y0 = P.headBottom + 14, y1 = ctlTop - 14;
  const b = fitBoard(12, y0, w - 24, y1 - y0);
  P.board = { x: b.x, y: b.y, px: b.px, F: b.F };
  P.panels = [];
  return P;
}

function playWide(w, h, U, back) {
  const P = { tall: false, wide: true };
  const m = 14, g = 14, pad = 14;
  const full = Math.floor((U.h - 2 * m) / 1.06);                    // largest board the height allows
  const threeCol = U.w >= full * 1.06 + 2 * 250 + 4 * g;
  let px, F, bx, leftCard, rightCard, single = null;
  if (threeCol) {
    px = full; F = frameOf(px);
    const sideW = Math.min(360, (U.w - px - 2 * F - 4 * g) / 2);
    const total = px + 2 * F + 2 * sideW + 4 * g;
    const x0 = U.x0 + (U.w - total) / 2;
    leftCard = R(x0 + g, U.y0 + m, sideW, U.h - 2 * m);
    bx = x0 + g + sideW + g + F;
    rightCard = R(bx + px + F + g, U.y0 + m, sideW, U.h - 2 * m);
    if (back.w) { const t = back.y + back.h + 6, y = Math.max(leftCard.y, t); leftCard = R(leftCard.x, y, leftCard.w, U.y1 - m - y); }
  } else {
    px = Math.floor(Math.min(full, (U.w - 2 * m - 2 * g - 280) / 1.06));
    px = Math.max(220, px);
    F = frameOf(px);
    const panelW = clamp(U.w - 2 * m - 2 * g - px - 2 * F, 280, 440);
    const total = px + 2 * F + g + panelW;
    const x0 = U.x0 + Math.max(m, (U.w - total) / 2);
    const boardLeft = !back.w;                                      // with a host back button the card goes on the left (it starts below it)
    const cardX = boardLeft ? x0 + px + 2 * F + g : x0;
    bx = boardLeft ? x0 + F : x0 + panelW + g + F;
    let cy = U.y0 + m, ch = U.h - 2 * m;
    if (!boardLeft) { cy = Math.max(cy, back.y + back.h + 6); ch = U.y1 - m - cy; }
    single = R(cardX, cy, panelW, ch);
  }
  P.board = { x: Math.round(bx), y: Math.round(U.y0 + (U.h - px) / 2), px, F };
  P.threeCol = threeCol;
  P.panels = threeCol ? [leftCard, rightCard] : [single];
  P.chipKinds = ['time', 'moves', 'crowns'];
  P.tally = null;
  if (threeCol) {
    // left card: heading + three chips ; right card: four buttons with the message under them
    const c = leftCard, iw = c.w - 2 * pad;
    let y = c.y + 16;
    P.title = { x: c.x + c.w / 2, y: y + 66, size: 38, label: { y: y + 12, size: 22 }, maxW: iw };
    y += 92;
    P.chips = [0, 1, 2].map((i) => R(c.x + pad, y + i * 62, iw, 54));
    const r = rightCard, bw = r.w - 2 * pad, bh = 64, bg = 12, msgH = 76;
    const stackH = 4 * bh + 3 * bg + msgH + 16;
    const by0 = r.y + Math.max(16, (r.h - stackH) / 2);
    const slots = [0, 1, 2, 3].map((i) => R(r.x + pad, by0 + i * (bh + bg), bw, bh));
    P.slots = slots;
    P.msg = R(r.x + pad, by0 + 4 * (bh + bg) + 4, bw, msgH);
    P.cardFor = rightCard;
  } else {
    const c = single, iw = c.w - 2 * pad, bg = 8;
    const need = 90 + 3 * 54 + 14 + 4 * 56 + 3 * bg + 14 + 64;
    const k = Math.min(1, (c.h - 20) / need), bh = Math.max(46, Math.round(56 * k)), chh = Math.max(40, Math.round(46 * k));
    let y = c.y + 12;
    P.title = { x: c.x + c.w / 2, y: y + 62, size: 36, label: { y: y + 12, size: 22 }, maxW: iw };
    y += 84;
    P.chips = [0, 1, 2].map((i) => R(c.x + pad, y + i * (chh + 8), iw, chh));
    y += 3 * (chh + 8) + 6;
    const slots = [0, 1, 2, 3].map((i) => R(c.x + pad, y + i * (bh + bg), iw, bh));
    y += 4 * (bh + bg);
    P.slots = slots;
    P.msg = R(c.x + pad, y + 2, iw, Math.max(40, c.y + c.h - y - 8));
    P.cardFor = single;
  }
  const slots = P.slots;
  P.btn = { hint: slots[0], undo: slots[1], colour: slots[2], menu: slots[3] };
  P.abtn = { exit: slots[0], pause: slots[1], skip: slots[2], think: slots[3] };
  return P;
}

// ---------------------------------------------------------------------------------------------------------------------
// Solved card (real play and Auto Play's finished board): crown, SOLVED, stats, chips, two buttons.
// ---------------------------------------------------------------------------------------------------------------------
function solvedCard(L) {
  const { w, U, play: P } = L;
  let rect, overlay = false;
  if (L.land) rect = P.cardFor;
  else if (P.tall) {
    const y = P.board.y + P.board.px + P.board.F + 14;
    rect = R(50, y, w - 100, Math.max(300, U.y1 - 12 - y));
  } else {
    const cw = Math.min(640, w - 40), ch = Math.min(540, U.h - 24);
    const cy = clamp(P.board.y + P.board.px / 2 - ch / 2, U.y0 + 12, U.y1 - 12 - ch);
    rect = R((w - cw) / 2, cy, cw, ch);
    overlay = true;
  }
  const C = { rect, overlay };
  const pad = 16, iw = rect.w - 2 * pad;
  const cols = rect.w >= 420 ? 2 : 1;
  const chH = rect.h >= 480 ? 46 : 40, chG = 8, rows = Math.ceil(SIBLINGS.length / cols);
  const chipsH = rows * chH + (rows - 1) * chG;
  const btnH = 58;
  let y = rect.y + 14;
  if (rect.h >= 470 + (cols === 1 ? 110 : 0)) { C.crown = { x: rect.x + rect.w / 2, y: y + 48, r: 44 }; y += 100; }
  C.solvedSize = rect.h >= 420 ? 64 : 52;
  C.solvedY = y + C.solvedSize * 0.8; y += C.solvedSize + 10;
  C.statsY = y + 26; y += 40;
  C.hintsY = y + 18; y += 32;
  C.moreY = y + 16; y += 28;
  const cwid = (iw - (cols - 1) * chG) / cols;
  C.chips = SIBLINGS.map((_, i) => R(rect.x + pad + (i % cols) * (cwid + chG), y + Math.floor(i / cols) * (chH + chG), cwid, chH));
  y += chipsH + 14;
  const by = Math.min(y, rect.y + rect.h - pad - btnH);
  const bw = (iw - 12) / 2;
  C.next = R(rect.x + pad, by, bw, btnH); C.menu = R(rect.x + pad + bw + 12, by, bw, btnH);
  C.bottom = by + btnH;
  return C;
}

// ---------------------------------------------------------------------------------------------------------------------
// Rules reader: one scrolling column (drag, wheel, keys, scroll bar) with text zoom; A- / A+ / Done in a bar at the bottom.
// ---------------------------------------------------------------------------------------------------------------------
function rulesLayout(w, h, U, back) {
  const m = 14, navH = 72;
  const pw = Math.min(U.w - 2 * m, 980), px0 = U.x0 + (U.w - pw) / 2;
  const nav = R(px0, U.y1 - m - navH, pw, navH);
  const panel = R(px0, U.y0 + m, pw, nav.y - 12 - (U.y0 + m));
  const headH = back.w ? Math.max(64, back.y + back.h + 6 - panel.y) : 64;      // the reader starts below the host back button
  const vp = R(panel.x + 18, panel.y + headH, panel.w - 18 - 40, panel.h - headH - 16);
  const sb = R(panel.x + panel.w - 30, vp.y + 4, 14, vp.h - 8);
  const gap = 12, bw = Math.min(180, (pw - 2 * gap) / 3), dw = pw - 2 * bw - 2 * gap;
  return { panel, nav, vp, sb, headH, dec: R(nav.x, nav.y, bw, navH), inc: R(nav.x + bw + gap, nav.y, bw, navH), done: R(nav.x + nav.w - dw, nav.y, dw, navH) };
}
