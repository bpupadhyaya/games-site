// Geometry as a pure function of the LIVE screen size (kit 1.7 fluid viewport: the short side is always 720 units, the long
// side follows the screen, in portrait and in landscape). `layoutFor(w, h)` is cached by size + safe insets and returns the
// shapes every screen needs; nothing else in the game holds a hard-coded position.
//
// Modes: portrait (h >= w) is one vertical stack: header, opponent stand, board, your stand, message, buttons. It has a roomy
// and a tight variant (phone vs. tablet height) chosen by what fits. Wide (landscape) is three columns: a left card (title,
// opponent stand, message), the board, a right card (your stand, buttons). Menus and pages use their own flows below.
export const W = 720, H = 1560;                 // the phone-shaped default size (meta, headless runs)

export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const THINK_STEPS = [2, 5, 8, 10];
export const STAND_ORDER = [7, 6, 5, 4, 3, 2, 1];    // rook, bishop, gold, silver, knight, lance, pawn
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
const R = (x, y, w, h) => ({ x, y, w, h });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Safe areas and the host's floating back button, in virtual units. main.js keeps this current (browsers: all zero).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };   // px: css pixels per virtual unit (type never below ~11 css px)

// ---- the board, canonical (the approved art is painted once in these coordinates and drawn scaled) -----------------------
export function geom(n) {
  const cell = n === 9 ? 68 : 122, gw = cell * n, gx = (W - gw) / 2, gy = 372 + (612 - gw) / 2;
  return { n, cell, gw, gx, gy, slab: { x: gx - 26, y: gy - 30, w: gw + 52, h: gw + 56 }, thick: 34, s: 1 };
}
export const boardBlock = (n) => { const c = geom(n); return { w: c.slab.w, h: c.slab.h + c.thick }; };
// live geometry: top-left of the slab at (bx, by), uniform scale s (cell, margins and thickness all scale together)
export function liveGeom(n, bx, by, s) {
  const c = geom(n);
  return { n, s, cell: c.cell * s, gw: c.gw * s, gx: bx + 26 * s, gy: by + 30 * s, slab: R(bx, by, c.slab.w * s, c.slab.h * s), thick: c.thick * s, bx, by };
}
// board square (r,c) -> screen point, honouring the view flip (human plays Gote => the board is turned round)
export function sqCenter(g, sq, flip) {
  const r = (sq / g.n) | 0, c = sq % g.n, rr = flip ? g.n - 1 - r : r, cc = flip ? g.n - 1 - c : c;
  return { x: g.gx + (cc + 0.5) * g.cell, y: g.gy + (rr + 0.5) * g.cell };
}
export function sqAt(g, x, y, flip) {
  const cc = Math.floor((x - g.gx) / g.cell), rr = Math.floor((y - g.gy) / g.cell);
  if (cc < 0 || rr < 0 || cc >= g.n || rr >= g.n) return -1;
  const r = flip ? g.n - 1 - rr : rr, c = flip ? g.n - 1 - cc : cc;
  return r * g.n + c;
}

// A stand (komadai): a rect with 7 slots in `cols` x `rows` (the last cell is the tray's own label, 持駒).
function makeStand(rect, cols, rows, ps, vertical) {
  const padX = vertical ? 16 : 30, padY = vertical ? 14 : 0;
  const px = (rect.w - 2 * padX) / cols, py = vertical ? (rect.h - 2 * padY) / rows : rect.h;
  const slot = (i) => {
    const c = i % cols, r = Math.floor(i / cols);
    return { x: rect.x + padX + px * (c + 0.5), y: rect.y + padY + py * (r + 0.5) + (vertical ? 2 : 4 * (rect.h / 104)) };
  };
  return { rect, cols, rows, vertical, ps, k: Math.min(1, ps / 0.42), slot, label: vertical ? slot(cols * rows - 1) : { x: rect.x + rect.w - 34, y: rect.y + rect.h / 2 }, px, py };
}

// Flow a vertical list [{h, min, fixed}] into [top, top+avail]: shrinks toward `min` when short, spreads spare room into the gaps.
export function flow(items, top, avail, gap = 10, maxGap = 36) {
  const mn = (i) => (i.fixed ? i.h : (i.min ?? i.h * 0.7));
  const n = items.length, need = items.reduce((s, i) => s + i.h, 0) + gap * (n - 1);
  let k = 1, g = gap;
  if (need > avail) {
    const room = items.reduce((s, i) => s + (i.h - mn(i)), 0);
    k = room > 0 ? Math.min(1, (need - avail) / room) : 0;
  } else if (n > 1) g = Math.min(maxGap, gap + (avail - need) / (n - 1));
  let y = top;
  return items.map((it) => { const h = it.h - (it.h - mn(it)) * k, r = { y, h }; y += h + g; return r; });
}

const cache = new Map();
export function layoutFor(w, h) {
  w = Math.round(w); h = Math.round(h);
  const key = `${w}x${h}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}|${Math.round(host.px * 100)}`;
  let L = cache.get(key);
  if (!L) { L = build(w, h, { ...host }); L.key = key; cache.set(key, L); if (cache.size > 40) cache.delete(cache.keys().next().value); }
  return L;
}

function build(w, h, ins) {
  const land = w > h;
  const U = { x0: ins.l, y0: ins.t, x1: w - ins.r, y1: h - ins.b }; U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  const backSz = ins.back ? Math.max(ins.back, 56) : 0;
  const backBox = ins.back ? R(ins.l, ins.t, backSz + 8, backSz + 8) : R(0, 0, 0, 0);
  const L = { w, h, land, mode: land ? 'wide' : h >= 1500 ? 'tall' : 'compact', U, backBox, ins, memo: new Map(),
    minU: Math.max(12, 11 / (ins.px || 0.6)) };
  // widest a centred single line may be on the top row, so it never runs under the floating back button
  L.topMaxW = ins.back ? Math.min(w - 2 * (backBox.x + backBox.w + 8), U.w - 40) : U.w - 40;
  L.cx = U.x0 + U.w / 2;
  L.memoFn = (key, fn) => { let v = L.memo.get(key); if (v === undefined) { v = fn(); L.memo.set(key, v); } return v; };
  L.board = (n, teach) => L.memoFn(`b${n}${teach ? 't' : ''}`, () => (land ? boardWide(L, n, teach) : boardPortrait(L, n, teach)));
  L.title = (saved) => L.memoFn(`t${saved ? 1 : 0}`, () => titleLayout(L, !!saved));
  L.page = () => L.memoFn('pg', () => pageRect(L));
  L.setup = () => L.memoFn('setup', () => setupLayout(L));
  L.settings = () => L.memoFn('settings', () => settingsLayout(L));
  L.learn = (count) => L.memoFn('learn' + count, () => learnLayout(L, count));
  L.reader = (scale, hasPiece) => L.memoFn(`r${scale}${hasPiece ? 'p' : ''}`, () => readerLayout(L, scale, hasPiece));
  L.menuStack = (n) => L.memoFn(`m${n}`, () => menuStack(L, n));
  L.promo = () => L.memoFn('promo', () => promoLayout(L));
  L.limit = () => L.memoFn('limit', () => limitLayout(L));
  return L;
}

// ======================================================================================================================
// Board scenes (play, lesson, puzzle, Auto Play)
function boardPortrait(L, n, teach) {
  const U = { ...L.U, y0: Math.max(L.U.y0, 36) }, w = L.w, BB = boardBlock(n), side = 30; U.h = L.U.y1 - U.y0;
  const V = [
    { hdr: 108, nameRow: 30, tray: 104, msg: 128, bar: 92, card: 186, g: 10, title: 60, sub: 25 },
    { hdr: 78, nameRow: 28, tray: 84, msg: 88, bar: 76, card: 134, g: 7, title: 46, sub: 23 },
    { hdr: 62, nameRow: 24, tray: 66, msg: 66, bar: 66, card: 100, g: 5, title: 38, sub: 20 },   // short portrait (3:4 tablets): trays and bars shrink so the board can grow
  ];
  let v = V[0], s = 1;
  for (let i = 0; i < V.length; i++) {
    v = V[i];
    const top = teach ? v.card : v.nameRow + v.tray;
    const fixed = v.hdr + top + v.nameRow + v.tray + v.msg + v.bar + v.g * 7 + 12;
    s = Math.min((U.h - fixed) / BB.h, (U.w - 2 * 14) / BB.w, 1.1);
    if (s >= (i === 0 ? 0.9 : 0.62)) break;
  }
  s = Math.max(s, 0.36);
  const top = teach ? v.card : v.nameRow + v.tray;
  const used = v.hdr + top + v.nameRow + v.tray + v.msg + v.bar + v.g * 7 + 12 + BB.h * s;
  const extra = Math.max(0, U.h - used), eg = Math.min(extra / 6, 16);       // spare height goes into the gaps, not into huge margins
  const fw = Math.min(w - 2 * side, 720 - 2 * side + 40), x = U.x0 + (U.w - fw) / 2;
  let y = U.y0 + 6 + Math.max(0, extra - eg * 6) / 2;
  const B = { mode: 'portrait', s, v, teach };
  B.hdr = { y, h: v.hdr, titleY: y + v.title * 0.92, titleSize: v.title, subY: y + v.hdr - 8, subSize: v.sub, cx: L.cx, maxW: L.topMaxW, jp: true };
  y += v.hdr + v.g + eg;
  const sps = 0.42 * (v.tray / 104);
  if (!teach) {
    B.nameTop = { x: x + 14, y: y + v.nameRow - 6, size: 27, dotX: x - 2 };
    B.think = { x: x + fw - 4, y: y + v.nameRow - 6, size: 26, align: 'right' };
    B.top = makeStand(R(x, y + v.nameRow, fw, v.tray), 7, 1, sps, false);
    y += v.nameRow + v.tray + v.g + eg;
  } else { B.card = R(x, y, fw, v.card); y += v.card + v.g + eg; }
  const bx = U.x0 + (U.w - BB.w * s) / 2;
  B.g = liveGeom(n, bx, y, s); y += BB.h * s + v.g + eg;
  B.nameBot = { x: x + 14, y: y + v.nameRow - 6, size: 27, dotX: x - 2 };
  B.bot = makeStand(R(x, y + v.nameRow, fw, v.tray), 7, 1, sps, false);
  y += v.nameRow + v.tray + v.g + eg;
  B.msg = R(x, y, fw, v.msg); B.msgSize = v.msg > 100 ? 30 : 25; y += v.msg + v.g + eg;
  B.bar = R(x, y, fw, v.bar); B.barVertical = false;
  return B;
}

function boardWide(L, n, teach) {
  const U = { ...L.U, y0: Math.max(L.U.y0, 38) }, BB = boardBlock(n), gap = 14, minP = 252; U.h = L.U.y1 - U.y0;
  let s = Math.min((U.h - 16) / BB.h, 1.15);
  s = Math.max(0.42, Math.min(s, (U.w - 2 * minP - 2 * gap) / BB.w));
  const bw = BB.w * s, pw = clamp((U.w - bw - 2 * gap) / 2, 200, 400);
  const total = 2 * pw + bw + 2 * gap, x0 = U.x0 + (U.w - total) / 2, bxx = x0 + pw + gap, rx = bxx + bw + gap;
  const B = { mode: 'wide', s, teach, pw };
  const top = L.U.y0 + 8, bottom = U.y1 - 8;
  const ly = L.ins.back > 0 && x0 < L.backBox.x + L.backBox.w + 4 ? Math.max(top, L.backBox.y + L.backBox.h + 2) : top;
  const gy = U.y0 + (U.h - BB.h * s) / 2;
  B.g = liveGeom(n, bxx, gy, s);
  // stands: 2 columns x 4 rows in a narrow card, 4 x 2 in a wide one
  const cols = pw >= 330 ? 4 : 2, rows = Math.ceil(8 / cols), pitchX = cols === 4 ? 72 : 66, pitchY = 66;
  const tw = Math.min(pw - 4, cols * pitchX + 32), th = rows * pitchY + 28;
  const stand = (x, y) => makeStand(R(x + (pw - tw) / 2, y, tw, th), cols, rows, 0.42, true);
  // left card: title block, opponent name + stand (or the teaching card), thinking line, message
  const hdrH = 128;
  B.hdr = { x: x0 + 8, y: ly, w: pw - 16, h: hdrH, cx: x0 + pw / 2, titleY: ly + 46, titleSize: 44, subY: ly + 74, subSize: 23, maxW: pw - 20, jp: true, wide: true };
  let y = ly + hdrH + 4;
  if (!teach) {
    B.nameTop = { x: x0 + 18, y: y + 24, size: 26, dotX: x0 + 6 }; y += 32;
    B.top = stand(x0, y); y += th + 6;
    B.think = { x: x0 + pw / 2, y: y + 24, size: 25, align: 'center' }; y += 34;
  } else {
    const avail = bottom - y - 12 - 120;
    B.card = R(x0, y, pw, clamp(avail, 150, 330)); y += B.card.h + 10;
  }
  B.msg = R(x0, y, pw, Math.max(80, bottom - y)); B.msgSize = B.msg.h > 150 ? 27 : 24;
  // right card: your name + stand, then the button stack
  let yr = top;
  B.nameBot = { x: rx + 18, y: yr + 24, size: 26, dotX: rx + 6 }; yr += 32;
  B.bot = stand(rx, yr); yr += th + 14;
  B.bar = R(rx + 6, yr, pw - 12, Math.max(100, bottom - yr)); B.barVertical = true;
  return B;
}

// ======================================================================================================================
// Tap zone of the title lockup (>= 44 css px each way; sideways and downward only, never into the buttons above).
export function lockHit(L, T) {
  const w0 = T.lockupH * 1200 / 327, m = 44 / Math.max(0.05, host.px), w = Math.max(w0, m), y = T.lockupY - 2;
  return R(T.lockupX - w / 2, y, w, Math.max(T.lockupH + 2, Math.min(m, L.h - y)));
}
// Title screen: art + buttons. Portrait stacks them; landscape puts the art left and the buttons right.
function titleLayout(L, saved) {
  const { U, w } = L, rows = saved ? 7 : 6;      // button rows (half-width pairs count as one); then the Language label and Auto Play
  const T = { rows };
  if (!L.land) {
    // Art block on top, list below. Phone height: the full art with the floating koma; shorter: a compact mark; spare height goes to the art.
    const credit = 88, lab = 34, statsH = 30, fixed = credit + lab + statsH + 10, nr = rows + 1.25;
    let A = 620, p = (U.h - A - fixed) / nr;
    const roomy = p >= 78;
    if (!roomy) { A = 292; p = (U.h - A - fixed) / nr; }
    if (p > 104) { A += (p - 104) * nr; p = 104; }
    p = clamp(p, 58, 104);
    const withParade = (A - 54) / 416 >= 0.9, ks = Math.min(1.05, (A - 54) / (withParade ? 416 : 300));
    T.roomy = roomy; T.cx = L.cx; T.pitch = p; T.bh = p - 12; T.fullW = Math.min(560, U.w - 100);
    T.markSize = 190 * ks; T.markY = U.y0 + 30 + 0.78 * T.markSize + (A - 54 - (withParade ? 416 : 300) * ks) * 0.25;
    T.shogiSize = 104 * ks; T.shogiY = T.markY + 100 * ks; T.tagSize = Math.max(24, 29 * ks); T.tagY = T.shogiY + 52 * ks;
    T.parade = withParade ? { y: T.tagY + 24 + 58 * ks, dx: 200 * ks, s: 0.78 * ks } : null;
    T.lanterns = [{ x: U.x0 + 130, y: U.y0 - 4, s: 0.9 * Math.min(1, ks + 0.1), ph: 0 }, { x: U.x1 - 96, y: U.y0 + 14, s: 0.8 * Math.min(1, ks + 0.1), ph: 1.7 }];
    T.listY = U.y0 + A + 4;
    T.x = T.cx - T.fullW / 2;
  } else {
    const leftW = clamp(U.w * 0.46, 380, 760), rightW = U.w - leftW;
    const bw = Math.min(560, rightW - 56), p = clamp((U.h - 40 - 86) / (rows + 1.9), 52, 96);
    T.roomy = false; T.cx = U.x0 + leftW / 2; T.pitch = p; T.bh = p - 12; T.fullW = bw;
    const listH = (rows + 1.55) * p;
    T.listY = U.y0 + Math.max(12, (U.h - 86 - listH) / 2); T.x = U.x0 + leftW + (rightW - bw) / 2;
    const ay = U.y0 + U.h / 2 - 20, big = U.h >= 640 && leftW >= 440, ak = clamp(U.h / 720, 0.7, 1.15);
    T.markSize = (big ? 170 : 130) * ak; T.markY = ay - 70 * ak; T.shogiSize = (big ? 96 : 76) * ak; T.shogiY = ay + 32 * ak;
    T.tagY = ay + 80 * ak; T.tagSize = 27 * ak;
    T.parade = U.h >= 600 ? { y: ay + 190 * ak, dx: Math.min(190, leftW * 0.3), s: 0.7 * ak } : null;
    T.lanterns = [{ x: U.x0 + leftW * 0.2, y: U.y0 - 4, s: 0.9, ph: 0 }, { x: U.x0 + leftW * 0.84, y: U.y0 + 10, s: 0.8, ph: 1.7 }];
    T.split = U.x0 + leftW;
  }
  // brand lockup (themed AF + ARCFORGE + WORLD HERITAGE GAMES): under the art on the left, or at the foot of the list in portrait
  T.lockupH = Math.min(260 * 327 / 1200, (L.land ? T.fullW : Math.min(U.w - 40, 300)) * 327 / 1200);
  T.lockupX = L.land ? T.x + T.fullW / 2 : T.cx; T.lockupY = L.land ? Math.min(U.y1 - 8 - T.lockupH, T.listY + (rows + 1.55) * T.pitch + 6) : U.y1 - 14 - T.lockupH;
  return T;
}

// ======================================================================================================================
// Pages (setup, settings, learn, Rules / How to play / About, preview-ended)
function pageRect(L) {
  const { U } = L;
  if (!L.land) return R(U.x0 + 30, U.y0 + 8, U.w - 60, U.h - 16);
  const pw = Math.min(U.w - 48, 1080);
  return R(U.x0 + (U.w - pw) / 2, U.y0 + 8, pw, U.h - 16);
}
// two columns inside a landscape page
function cols2(L, P) {
  const inner = P.w - 60, colW = Math.min(470, (inner - 40) / 2), gapC = Math.min(60, inner - 2 * colW);
  const lx = P.x + P.w / 2 - gapC / 2 - colW, rx = P.x + P.w / 2 + gapC / 2;
  return { colW, lx, rx };
}

function setupLayout(L) {
  const P = L.page(), S = { P }, inner = P.w - 60;
  if (!L.land) {
    const roomy = P.h >= 1100, hdrH = roomy ? 190 : 140;
    S.title = { x: L.cx, y: P.y + (roomy ? 100 : 78), size: roomy ? 74 : 54, maxW: L.topMaxW }; S.sub = { x: L.cx, y: P.y + (roomy ? 160 : 118), size: roomy ? 28 : 24 };
    const it = [...Array(5).fill({ h: 86, min: 58 }), { h: 110, min: 70 }, { h: 34, min: 34, fixed: true }, { h: 84, min: 62 }, { h: 100, min: 68 }, { h: 80, min: 58 }];
    const f = flow(it, P.y + hdrH, P.h - hdrH - 40, 12, 30), w = Math.min(560, inner), x = L.cx - w / 2;
    S.levels = f.slice(0, 5).map((r) => R(x, r.y, w, r.h)); S.blurb = { x: L.cx, y: f[5].y, w: Math.min(580, inner), h: f[5].h, size: 27 };
    S.sideLabel = { x: L.cx, y: f[6].y + 26, size: 26 }; S.sides = R(x, f[7].y, w, f[7].h); S.start = R(x, f[8].y, w, f[8].h); S.back = R(x, f[9].y, w, f[9].h);
  } else {
    const { colW, lx, rx } = cols2(L, P);
    S.title = { x: lx + colW / 2, y: P.y + 78, size: 60, maxW: colW }; S.sub = { x: lx + colW / 2, y: P.y + 120, size: 24 };
    S.blurb = { x: lx + colW / 2, y: P.y + 150, w: colW, h: 130, size: 26 };
    S.sideLabel = { x: lx + colW / 2, y: P.y + 330, size: 26 }; S.sides = R(lx, P.y + 346, colW, 80);
    const it = [...Array(5).fill({ h: 78, min: 50 }), { h: 90, min: 60 }, { h: 70, min: 52 }];
    const f = flow(it, P.y + 40, P.h - 70, 10, 12);
    S.levels = f.slice(0, 5).map((r) => R(rx, r.y, colW, r.h)); S.start = R(rx, f[5].y, colW, f[5].h); S.back = R(rx, f[6].y, colW, f[6].h);
  }
  return S;
}

function settingsLayout(L) {
  const P = L.page(), S = { P }, inner = P.w - 60;
  if (!L.land) {
    const roomy = P.h >= 1100, hdrH = roomy ? 170 : 100;
    S.title = { x: L.cx, y: P.y + (roomy ? 110 : 80), size: roomy ? 74 : 54, maxW: L.topMaxW };
    const it = [...Array(4).fill({ h: 88, min: 58 }), { h: 32, min: 32, fixed: true }, { h: 84, min: 60 }, { h: 80, min: 58 }, { h: 260, min: 120 }];
    const f = flow(it, P.y + hdrH, P.h - hdrH - 30, 12, 30), w = Math.min(560, inner), x = L.cx - w / 2;
    S.toggles = f.slice(0, 4).map((r) => R(x, r.y, w, r.h)); S.langLabel = { x: L.cx, y: f[4].y + 24, size: 26 };
    S.lang = R(x, f[5].y, w, f[5].h); S.back = R(x, f[6].y, w, f[6].h); S.note = { x: L.cx, y: f[7].y, w: Math.min(580, inner), h: f[7].h, size: 25 };
  } else {
    const { colW, lx, rx } = cols2(L, P);
    S.title = { x: lx + colW / 2, y: P.y + 90, size: 64, maxW: colW };
    S.note = { x: lx + colW / 2, y: P.y + 130, w: colW, h: P.h - 150, size: 25 };
    const it = [...Array(4).fill({ h: 76, min: 50 }), { h: 30, min: 30, fixed: true }, { h: 74, min: 52 }, { h: 70, min: 52 }];
    const f = flow(it, P.y + 30, P.h - 52, 10, 14);
    S.toggles = f.slice(0, 4).map((r) => R(rx, r.y, colW, r.h)); S.langLabel = { x: rx + colW / 2, y: f[4].y + 22, size: 26 };
    S.lang = R(rx, f[5].y, colW, f[5].h); S.back = R(rx, f[6].y, colW, f[6].h);
  }
  return S;
}

function learnLayout(L, count) {
  const P = L.page(), S = { P }, inner = P.w - 60;
  const cols = !L.land ? 2 : 3, rows = Math.ceil(count / cols);
  const roomy = !L.land && P.h >= 1100;
  S.title = { x: L.cx, y: P.y + (roomy ? 100 : L.land ? 72 : 78), size: roomy ? 70 : L.land ? 52 : 54, maxW: L.topMaxW };
  S.sub = { x: L.cx, y: P.y + (roomy ? 150 : L.land ? 108 : 118), size: roomy ? 27 : 24 };
  const top = P.y + (roomy ? 190 : L.land ? 128 : 140);
  const it = [...Array(rows).fill({ h: 100, min: 56 }), { h: 30, min: 30, fixed: true }, { h: 76, min: 56 }];
  const f = flow(it, top, P.y + P.h - top - 40, 12, 30), gapX = 16, tw = Math.min(L.land ? 330 : 300, (inner - gapX * (cols - 1)) / cols);
  const x0 = L.cx - (tw * cols + gapX * (cols - 1)) / 2;
  S.tiles = Array.from({ length: count }, (_, i) => R(x0 + (i % cols) * (tw + gapX), f[Math.floor(i / cols)].y, tw, f[Math.floor(i / cols)].h));
  S.count = { x: L.cx, y: f[rows].y + 24, size: 28 };
  const bw = Math.min(560, inner); S.back = R(L.cx - bw / 2, f[rows + 1].y, bw, f[rows + 1].h);
  return S;
}

// The text pages. `scale` = the A-/A+ step. Returns the frame; the body text is laid out (and scrolled) by view.js inside the viewport.
function readerLayout(L, scale, hasPiece) {
  const P = L.page(), S = { P }, inner = P.w - 60, navH = L.land ? 74 : P.h >= 1100 ? 88 : 76;
  const nw = Math.min(210, (inner - 3 * 12) / 4), nx = P.x + (P.w - (nw * 4 + 36)) / 2, ny = P.y + P.h - 14 - navH;
  S.nav = { prev: R(nx, ny, nw, navH), dec: R(nx + nw + 12, ny, nw, navH), inc: R(nx + 2 * (nw + 12), ny, nw, navH), next: R(nx + 3 * (nw + 12), ny, nw, navH) };
  S.counterY = ny - 14;
  const ts = Math.min(scale, 1.15);
  S.titleSize = Math.round((L.land ? 46 : 56) * ts); S.titleY = P.y + 22 + S.titleSize; S.ruleY = S.titleY + 20;
  S.ruleX0 = L.cx - Math.min(240, inner / 2 - 20); S.ruleX1 = L.cx + Math.min(240, inner / 2 - 20);
  S.pageTitle = { cx: L.cx, maxW: inner - 20, size: L.land ? 34 : 40, scale: Math.min(scale, 1.3), top: S.ruleY + 14 };
  const sideCol = hasPiece && L.land;
  const colX = sideCol ? P.x + 30 + 250 : P.x + 30, avail = P.x + P.w - 30 - colX;
  S.textW = Math.min(L.land ? 860 : 570, avail);
  S.textX = sideCol ? colX + (avail - S.textW) / 2 : L.cx - S.textW / 2;
  S.pieceCol = sideCol ? { x: P.x + 30, w: 230 } : null;
  S.bodyBottom = ny - 14;
  return S;
}

function menuStack(L, n) {
  const { U } = L, bw = Math.min(560, U.w - 80), titleH = 100, gp = 16;
  const bh = clamp((U.h - titleH - 40 - (n - 1) * gp) / n, 52, 92), total = titleH + n * bh + (n - 1) * gp, top = U.y0 + (U.h - total) / 2;
  return { title: { x: L.cx, y: top + 62, size: clamp(bh * 0.7, 44, 64) }, buttons: Array.from({ length: n }, (_, i) => R(L.cx - bw / 2, top + titleH + i * (bh + gp), bw, bh)) };
}

// The promotion question: a design-space cluster (360 = centre) scaled to fit and centred on screen.
function promoLayout(L) {
  const { U } = L, DH = 700, k = Math.min(1, (U.h - 16) / DH), cx = L.cx, top = U.y0 + (U.h - DH * k) / 2;
  const tr = (r) => R(cx + (r.x - 360) * k, top + r.y * k, r.w * k, r.h * k);
  const d = { yes: R(70, 240, 270, 320), no: R(380, 240, 270, 320), cancel: R(260, 590, 200, 76) };
  return { k, cx, top, d, yes: tr(d.yes), no: tr(d.no), cancel: tr(d.cancel) };
}

function limitLayout(L) {
  const P = L.page(), bw = Math.min(560, P.w - 60);
  return { P, title: { x: L.cx, y: P.y + P.h * 0.26, size: 70 }, text: { x: L.cx, y: P.y + P.h * 0.26 + 40, w: Math.min(580, P.w - 60), h: P.h * 0.42, size: 31 }, back: R(L.cx - bw / 2, P.y + P.h - 130, bw, 96) };
}
