// Geometry, as a function of the LIVE screen size (kit 1.7 fluid viewport: the short side is always 720 units).
//
// The board is a plane seen in perspective, drawn in a fixed "canonical" space (the approved phone scene, 720 x 1560): board
// coordinates (u, v) with u in -3..3 (columns) and v in 0..6 (rows, 0 = far side), a true projective map so straight lines stay
// straight. The whole board scene (slab, pieces, glows) is drawn through ONE transform `L.board = { s, tx, ty }` (screen = canonical * s
// + t) and taps are mapped back with `L.pointNear`. Everything else (header, cards, buttons) is placed in screen units by `layoutFor`.
//
// layoutFor(w, h) is a pure function of the size + the host's safe insets, cached by size key. Three modes:
//   tall     portrait phone (h >= 1540): the approved phone look, unchanged.
//   compact  every other portrait / squarish screen (small phones, tablets): header on top, the board scaled to the free height, button bar below.
//   wide     landscape: a status card on the left, the board in the middle, a button card on the right; title / result: art + a card of buttons.
import { PTS } from './rules.js';

export const W = 720, H = 1560;           // the canonical phone scene (also the kit's initial size)
const CX = 360, D = 100, K = 0.028, Y_NEAR = 1322, HGT = 4700, Y_H = Y_NEAR - HGT;
// Everything drawn on the board (lines, inlays, pieces) scales with UNIT, so the scene grows in proportion.
export const UNIT = D / 126;
export function project(u, v) {
  const z = 1 + K * (6 - v);
  return { x: CX + (u * D) / z, y: Y_H + HGT / z, s: 1 / z };
}
// Board point index (x + 7 * y) -> canonical position
export const pointAt = (idx) => project((idx % 7) - 3, Math.floor(idx / 7));
export const PIECE_R = 45 * UNIT;
// Sizes: the fox is about three quarters of a point's width, a goose about half, so 17 geese never crowd the board.
export const SIZE = { F: 1.0, G: 0.78 };
// The cached board layer's rectangle and the board's visible extent (slab, thickness, the heads standing on the far row), canonical.
export const LAYER = { x: -40, y: 540, w: 800, h: 960 };
export const BB = { x0: -10, x1: 730, y0: 560, y1: 1442 };
BB.w = BB.x1 - BB.x0; BB.h = BB.y1 - BB.y0;

export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const THINK_STEPS = [2, 5, 8, 10];
export const REVEAL_TIME = 2;
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// Safe areas and the host's floating back button, in virtual units. main.js keeps this current (browsers: all zero).
// px = css pixels per virtual unit (type never goes below ~11 css px).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };

const cache = new Map();
export function layoutFor(w, h) {
  w = Math.round(w); h = Math.round(h);
  const key = `${w}x${h}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}`;
  let L = cache.get(key);
  if (!L) { L = build(w, h, { ...host }); L.key = key; cache.set(key, L); if (cache.size > 40) cache.delete(cache.keys().next().value); }
  return L;
}

const R = (x, y, w, h) => ({ x, y, w, h });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const tx = (x, y, size, align = 'center', maxW = 0) => ({ x, y, size, align, maxW });

function build(w, h, ins) {
  const wide = w >= h * 1.15, tall = !wide && h >= 1540, mode = wide ? 'wide' : tall ? 'tall' : 'compact';
  const L = { w, h, wide, tall, mode, ins };
  const backSz = ins.back ? Math.max(ins.back, 56) : 0;
  L.backBox = ins.back ? R(ins.l, ins.t, backSz + 8, backSz + 8) : R(0, 0, 0, 0);
  const U = L.U = { x0: ins.l, y0: ins.t, x1: w - ins.r, y1: h - ins.b };      // the area clear of the notch / home indicator
  U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  const oy = L.oy = tall ? (h - H) / 2 : 0;                                       // vertical centring of the phone-shaped screens
  const barY = L.barY = h - 98 - Math.max(0, ins.b - 16), barH = 72;
  const top = Math.max(14, ins.t + 6);
  const HB = top + 290;                                                           // compact: the header's bottom edge

  // ---- the board's place -----------------------------------------------------------------------------------------------
  const place = (fx, fy, fw, fh, maxS = 1) => {
    const s = clamp(Math.min(fw / BB.w, fh / BB.h), 0.2, maxS);
    return { s, tx: fx + (fw - BB.w * s) / 2 - BB.x0 * s, ty: fy + (fh - BB.h * s) / 2 - BB.y0 * s };
  };
  let Lw = 0, Rw = 0;
  if (tall) L.board = { s: 1, tx: 0, ty: oy };
  else if (!wide) L.board = place(0, HB, w, barY - 8 - HB);
  else {
    const g = 12, Lmin = 200, Rmin = 190, fh = U.h - 20, s0 = clamp(Math.min(fh / BB.h, (U.w - Lmin - Rmin - 2 * g) / BB.w), 0.3, 1);
    const bw = BB.w * s0, side = (U.w - bw) / 2 - g, cap = 430;
    if (side >= Lmin && side >= Rmin) Lw = Rw = Math.min(side, cap); else { const extra = Math.max(0, U.w - bw - 2 * g - Lmin - Rmin); Lw = Lmin + extra / 2; Rw = Rmin + extra / 2; }
    const cluster = Lw + g + bw + g + Rw, x0 = U.x0 + (U.w - cluster) / 2;      // centre the left card + board + right card
    L.cluster = { x0, Lw, Rw, g, bw };
    L.board = place(x0 + Lw + g, U.y0 + 10, bw, fh, 1);
  }
  const B = L.board;
  L.toCanon = (x, y) => ({ x: (x - B.tx) / B.s, y: (y - B.ty) / B.s });
  L.toScreen = (x, y) => ({ x: B.tx + x * B.s, y: B.ty + y * B.s });
  L.pointScreen = (i) => { const p = pointAt(i); return L.toScreen(p.x, p.y); };
  // which board point a tap means: the nearest point or the head standing on it (all in canonical units)
  const reach = clamp(30 / Math.max(0.2, (ins.px || 0.6) * B.s), 56, 74);
  L.pointNear = (x, y) => {
    const c = L.toCanon(x, y); let best = -1, bd = Infinity;
    for (const i of PTS) { const p = pointAt(i), d = Math.min(Math.hypot(p.x - c.x, p.y - c.y), Math.hypot(p.x - c.x, p.y - 26 * p.s - c.y)); if (d < bd) { bd = d; best = i; } }
    return bd < reach ? best : -1;
  };

  // ---- buttons while playing / lessons / puzzles / results -------------------------------------------------------------
  const BTN = L.BTN = {};
  let leftCard = null, rightCard = null;
  if (!wide) {
    const bx = (w - 720) / 2;
    Object.assign(BTN, {
      menu: R(bx + 60, barY, 190, barH), undo: R(bx + 265, barY, 190, barH), hint: R(bx + 470, barY, 190, barH), stop: R(bx + 470, barY, 190, barH),
      next: R(bx + 265, barY, 395, barH), share: R(bx + 265, barY, 395, barH),
      auto: { exit: R(bx + 24, barY, 128, barH), pause: R(bx + 166, barY, 140, barH), skip: R(bx + 320, barY, 120, barH), dec: R(bx + 454, barY, 118, barH), inc: R(bx + 582, barY, 114, barH) },
    });
  } else {
    const cardTop = ins.back ? Math.max(U.y0 + 10, L.backBox.y + L.backBox.h + 4) : U.y0 + 10, cardH = U.y1 - 10 - cardTop, c0 = L.cluster;
    leftCard = L.leftCard = R(c0.x0 + 4, cardTop, c0.Lw - 4, cardH);
    rightCard = L.rightCard = R(c0.x0 + c0.Lw + c0.g + c0.bw + c0.g, cardTop, c0.Rw - 4, cardH);
    // the right card is a computed vertical stack of button slots, then (only if it truly fits) the brand badge
    const bw = clamp(Rw - 28, 100, 300), bx = rightCard.x + (rightCard.w - bw) / 2, badgeH = 112, pad = 14, nSlots = 4;
    let bh = Rw >= 220 ? 88 : 80, gap = 12, showBadge = true, avail = cardH - 2 * pad - badgeH - 12;
    if (nSlots * bh + (nSlots - 1) * gap > avail) { gap = 10; bh = Math.max(54, Math.min(bh, (avail - (nSlots - 1) * gap) / nSlots)); }
    if (nSlots * bh + (nSlots - 1) * gap > avail) { showBadge = false; avail = cardH - 2 * pad; bh = Math.max(54, Math.min(bh, (avail - (nSlots - 1) * gap) / nSlots)); }
    const ys = rightCard.y + pad + (avail - (nSlots * bh + (nSlots - 1) * gap)) / 2;
    L.badgeFits = showBadge;
    const slot = (i) => R(bx, ys + i * (bh + gap), bw, bh), half = (i, k) => { const hw = (bw - 10) / 2, r = slot(i); return R(r.x + k * (hw + 10), r.y, hw, r.h); };
    Object.assign(BTN, {
      menu: slot(0), undo: slot(1), hint: slot(2), stop: slot(2), next: slot(1), share: slot(1),
      auto: { exit: slot(0), pause: slot(1), skip: slot(2), dec: half(3, 0), inc: half(3, 1) },
    });
  }

  // ---- the header furniture around the board (every scene that shows the board) -----------------------------------------
  const hud = L.hud = { trayK: 0.5 };
  const trayRow = (k, n, x0, x1, y, sp0 = 36.5) => { const sp = Math.min(sp0, (x1 - x0) / Math.max(1, n - 1)); return { x: (x0 + x1) / 2 - ((n - 1) * sp) / 2 + k * sp, y, s: 1 }; };
  if (tall) {
    hud.tray = (k) => ({ x: 74 + k * 36.5, y: 530 + oy, s: 1 }); hud.apTray = hud.tray;
    Object.assign(hud, {
      title: null,   // the kit's top-centre "Preview m:ss" pill sits where the game title was; the title adds nothing during play
       icon: { x: 110, y: 372 + oy, k: 1 }, turn: tx(180, 350 + oy, 36, 'left', 500), mode: tx(180, 388 + oy, 23, 'left', 500),
      left: tx(64, 462 + oy, 26, 'left', 330), foxwins: tx(656, 462 + oy, 22, 'right', 330),
      msg: { auto: true, x: 40, w: 640, maxW: 590, y: ins.back ? Math.max(168 + oy, L.backBox.y + L.backBox.h + 8) : 168 + oy, lowY: 500 + oy },
      lesson: { label: tx(410, 130 + oy, 26), title: tx(360, 250 + oy, 46, 'center', 640), body: { x: 50, y: 300 + oy, w: 620, h: 180, size: 29, bigSize: 34, lh: 40, align: 'center' } },
      puzzle: { label: tx(410, 130 + oy, 26), icon: { x: 110, y: 330 + oy, k: 1 }, title: tx(180, 270 + oy, 40, 'left', 500), body: { x: 64, y: 352 + oy, w: 600, h: 100, size: 27, bigSize: 32, lh: 36, align: 'left' }, streak: tx(64, 462 + oy, 24, 'left', 600) },
      ap: { label: tx(410, 130 + oy, 24), think: tx(410, 92 + oy, 21), icon: { x: 110, y: 372 + oy, k: 1 }, turn: tx(180, 350 + oy, 34, 'left', 500), phase: { x: 180, y: 362 + oy, w: 480, h: 56, size: 22, lh: 27, align: 'left' }, left: tx(64, 462 + oy, 24, 'left', 330), level: tx(656, 462 + oy, 20, 'right', 330) },
    });
  } else if (!wide) {
    const ix = Math.max(52, L.backBox.x + L.backBox.w + 30), tw = w - ix - 44 - 24, sw = w - 48, tray = (k, n) => trayRow(k, n, 40, w - 40, top + 258);
    hud.tray = tray; hud.apTray = tray; hud.trayK = 0.46;
    Object.assign(hud, {
      title: null, icon: { x: ix, y: top + 68, k: 0.55 }, turn: tx(ix + 44, top + 48, 32, 'left', tw), mode: tx(ix + 44, top + 80, 22, 'left', tw),
      left: tx(24, top + 202, 24, 'left', sw * 0.55), foxwins: tx(w - 24, top + 202, 21, 'right', sw * 0.45),
      msg: { rect: R(24, top + 96, sw, 68), size: 24, lh: 29, min: 12, maxLines: 2, lowRect: R(24, top + 200, sw, 70) },
      lesson: { label: tx(w / 2, top + 26, 24), title: tx(w / 2, top + 68, 40, 'center', w - 60), body: { x: 24, y: top + 78, w: sw, h: 190, size: 27, bigSize: 30, lh: 33, align: 'center' } },
      puzzle: { label: tx(w / 2, top + 26, 24), icon: { x: ix, y: top + 100, k: 0.6 }, title: tx(ix + 40, top + 88, 34, 'left', tw - 6), body: { x: 24, y: top + 124, w: sw, h: 90, size: 26, bigSize: 28, lh: 31, align: 'left' }, streak: tx(24, top + 244, 22, 'left', sw) },
      ap: { label: tx(w / 2, top + 26, 24), think: tx(w / 2, top + 58, 21), icon: { x: ix, y: top + 124, k: 0.55 }, turn: tx(ix + 44, top + 112, 30, 'left', tw), phase: { x: ix + 44, y: top + 122, w: tw, h: 70, size: 22, lh: 26, align: 'left' }, left: tx(24, top + 218, 24, 'left', sw * 0.55), level: tx(w - 24, top + 218, 20, 'right', sw * 0.45) },
    });
  } else {
    const c = leftCard, cw = c.w, inner = cw - 24, cxL = c.x + cw / 2, t0 = c.y + 12, ccols = Math.max(4, Math.min(17, Math.floor(inner / 34))), csp = Math.min(32, (inner - 24) / ccols);
    const grid = (y0) => (k, n) => { const cols = Math.min(n, ccols), r = Math.floor(k / cols), cc = k % cols, inRow = Math.min(cols, n - r * cols); return { x: cxL - ((inRow - 1) * csp) / 2 + cc * csp, y: y0 + r * csp * 0.95, s: 1 }; };
    hud.tray = grid(t0 + 316); hud.apTray = grid(t0 + 420); hud.trayK = 0.44;
    let my = c.y + 430, mh = c.y + c.h - 8 - my; if (mh < 90) { my = c.y + c.h - 98; mh = 90; }
    Object.assign(hud, {
      title: null, icon: { x: cxL, y: t0 + 100, k: 0.85 }, turn: tx(cxL, t0 + 164, 28, 'center', inner), mode: tx(cxL, t0 + 194, 21, 'center', inner),
      left: tx(cxL, t0 + 236, 23, 'center', inner), foxwins: tx(cxL, t0 + 264, 20, 'center', inner),
      msg: { rect: R(c.x + 8, my, cw - 16, mh), size: cw < 270 ? 23 : 25, lh: cw < 270 ? 28 : 31, min: 12 },
      lesson: { label: tx(cxL, t0 + 28, 24, 'center', inner), title: tx(cxL, t0 + 72, 34, 'center', inner), body: { x: c.x + 10, y: t0 + 86, w: cw - 20, h: Math.max(120, my - t0 - 96), size: 25, bigSize: 28, lh: 31, align: 'center' } },
      puzzle: { label: tx(cxL, t0 + 28, 24, 'center', inner), icon: { x: cxL, y: t0 + 116, k: 0.9 }, title: tx(cxL, t0 + 190, 30, 'center', inner), body: { x: c.x + 10, y: t0 + 204, w: cw - 20, h: Math.max(100, my - t0 - 250), size: 24, bigSize: 27, lh: 30, align: 'center' }, streak: tx(cxL, my - 10, 22, 'center', inner) },
      ap: { label: tx(cxL, t0 + 28, 22, 'center', inner), think: tx(cxL, t0 + 58, 21, 'center', inner), icon: { x: cxL, y: t0 + 150, k: 0.8 }, turn: tx(cxL, t0 + 206, 28, 'center', inner), phase: { x: c.x + 10, y: t0 + 216, w: cw - 20, h: 84, size: 22, lh: 26, align: 'center' }, left: tx(cxL, t0 + 338, 23, 'center', inner), level: tx(cxL, t0 + 366, 20, 'center', inner) },
    });
  }

  const titleCache = {};
  L.title = (hasSave) => (titleCache[hasSave ? 1 : 0] ??= buildTitle(L, !!hasSave));
  L.look = buildLook(L);
  L.over = buildOver(L);
  L.rules = buildRules(L);
  return L;
}

// The hero art (title + fox + goose) is drawn in canonical coordinates through { sc, hx, hy }: screen = hero * sc + (hx, hy).
// Its extent in canonical units is about x 60..680, y 100..690.
const HERO = { x0: 30, x1: 690, y0: 96, y1: 640 };
const heroFit = (x, y, w, h, maxSc = 1.15) => {
  const sc = clamp(Math.min(w / (HERO.x1 - HERO.x0), h / (HERO.y1 - HERO.y0)), 0.3, maxSc);
  return { sc, hx: x + (w - (HERO.x1 - HERO.x0) * sc) / 2 - HERO.x0 * sc, hy: y + (h - (HERO.y1 - HERO.y0) * sc) / 2 - HERO.y0 * sc, dx: 0 };
};

// Title rows: the phone's single column (kept exactly), or a two-column grid for every other shape.
const LOCK_AR = 327 / 1200;
function lockRect(cx, y, maxW) { const lw = Math.min(260, maxW), lh = lw * LOCK_AR; return R(cx - lw / 2, y, lw, lh); }
// Tap zone of the title lockup (>= 44 css px each way; sideways and downward only, never into the buttons above).
export function lockHit(L, T) {
  const r = T.lock; if (!r) return null; const m = 44 / Math.max(0.05, host.px);
  const w = Math.max(r.w, m), x = r.x + r.w / 2 - w / 2, y = r.y - 2;
  return R(x, y, w, Math.max(r.h + 2, Math.min(m, L.h - y)));
}
function buildTitle(L, hasSave) {
  const { w, h, U, oy, ins } = L, T = { hero: null, rows: {}, card: null, dim: null, stars: null, dev: null, zone: null };
  const names1 = (hasSave ? ['resume'] : []).concat(['learn', 'fox', 'geese', 'two', 'daily']);
  if (L.tall) {
    const n = names1.length;
    const lk = lockRect(w / 2, 0, 300), lockY = h - Math.max(10, ins.b) - lk.h - 8; T.lock = { ...lk, y: lockY };
    let base = 770 + oy; const need = n * 78 + 4 + 2 * 70 + 62 + 36 + 56, avail = lockY - 10 - base;
    const shift = Math.min(Math.max(0, need - avail), 60), f = Math.min(1, (avail + shift) / need);
    const rowH = 68 * f, rowP = 78 * f, smH = 62 * f, smP = 70 * f;
    base -= shift;
    names1.forEach((nm, i) => { T.rows[nm] = R(90, base + i * rowP, 540, rowH); });
    const y = base + n * rowP + 4 * f;
    T.rows.level = R(90, y, 262, smH); T.rows.flock = R(368, y, 262, smH);
    T.rows.sound = R(90, y + smP, 262, smH); T.rows.marks = R(368, y + smP, 262, smH);
    const y3 = y + 2 * smP;
    T.rows.calm = R(90, y3, 129, smH); T.rows.look = R(227, y3, 129, smH); T.rows.rules = R(364, y3, 129, smH); T.rows.auto = R(501, y3, 129, smH);
    T.hero = { sc: 1, hx: 0, hy: oy, dx: 50 };
    const by = y3 + smH + 40 * f;
    T.stars = { x: 360, y: by, show: by + 46 <= lockY - 6 };
    T.dim = R(0, Math.min(760 + oy, base - 10), w, h); T.dim.h = h - T.dim.y; T.msgY = T.dim.y - 12; T.drawBoard = true;
    T.zone = R(40, T.dim.y, w - 80, h - T.dim.y); T.dev = R(470, Math.max(40 + oy, ins.t + 6), 220, 56); T.makingMenu = L.BTN.menu;
    return T;
  }
  const rowsDef = [['resume'], ['learn'], ['fox', 'geese'], ['two', 'daily'], ['level', 'flock'], ['sound', 'marks'], ['calm', 'look'], ['rules', 'auto']].filter((r) => hasSave || r[0] !== 'resume');
  const n = rowsDef.length;
  const place = (x0, aw, y0, pitch, bh) => rowsDef.forEach((row, i) => {
    const y = y0 + i * pitch;
    if (row.length === 1) T.rows[row[0]] = R(x0, y, aw, bh);
    else { const cw = (aw - 14) / 2; T.rows[row[0]] = R(x0, y, cw, bh); T.rows[row[1]] = R(x0 + cw + 14, y, cw, bh); }
  });
  T.drawBoard = false;
  if (!L.wide) {                                                  // compact portrait: art on top, two-column grid below
    const lk = lockRect(w / 2, 0, 300), lockY = h - Math.max(10, ins.b) - lk.h - 8; T.lock = { ...lk, y: lockY };
    const pitch = clamp((h - 330 - lk.h) / n, 54, 78), bh = pitch - 10, rowsH = n * pitch, y0 = lockY - 8 - 62 - rowsH + (pitch - bh);
    place(U.x0 + 40, U.w - 80, y0, pitch, bh);
    const zone = y0 - 14, topPad = Math.max(10, ins.t + 6);
    T.hero = heroFit(24, topPad, w - 48, zone - topPad - 4);
    T.stars = { x: w / 2, y: y0 + rowsH - (pitch - bh) + 30, show: true };
    T.dim = R(0, y0 - 14, w, h - y0 + 14); T.msgY = y0 - 24; T.zone = R(40, y0, w - 80, rowsH); T.dev = R(U.x1 - 236, Math.max(ins.t + 4, 8), 220, 52);
    T.makingMenu = L.BTN.menu;
    return T;
  }
  // wide: art on the left, a card of buttons on the right
  const aw = clamp(w * 0.46, 470, 700), ax = U.x1 - aw - 16, lk = lockRect(0, 0, 300), pitch = Math.min(66, (U.h - 130 - lk.h - 12) / n), bh = pitch - 10, rowsH = n * pitch;
  const y0 = U.y0 + (U.h - rowsH - 64 - lk.h - 12) / 2 + (pitch - bh) / 2;
  place(ax + 22, aw - 44, y0, pitch, bh);
  T.card = R(ax, y0 - 22, aw, rowsH + 94); T.lock = lockRect(ax + aw / 2, y0 - 22 + rowsH + 94 + 8, aw - 40);
  T.stars = { x: ax + aw / 2, y: y0 + rowsH - (pitch - bh) + 28, show: true };
  const leftW = ax - U.x0 - 8;
  T.hero = heroFit(U.x0 + 12, U.y0 + 12, leftW - 24, U.h - 24, 1.2);
  T.msgY = U.y1 - 14; T.msgX = U.x0 + leftW / 2; T.zone = R(ax + 22, y0, aw - 44, rowsH); T.dev = R(ax + aw - 232, Math.max(U.y0 + 6, 6) - 0, 220, 48);
  T.makingMenu = R(ax + aw / 2 - 110, T.zone.y + T.zone.h / 2 + 40, 220, 64);
  return T;
}

// The 'Board and pieces' screen: three boards, two piece sets, message size, back.
function buildLook(L) {
  const { w, h, U, oy, ins } = L;
  if (L.tall) return {
    hero: { sc: 1, hx: 0, hy: oy, dx: 50 }, drawBoard: true, dim: R(0, 760 + oy, w, h - 760 - oy),
    labels: [{ t: 'Board', x: 90, y: 786 + oy }, { t: 'Pieces', x: 90, y: 946 + oy }, { t: 'Message text', x: 90, y: 1106 + oy }],
    boards: [0, 1, 2].map((i) => R(90 + i * 184, 800 + oy, 172, 76)), sets: [0, 1].map((i) => R(90 + i * 278, 960 + oy, 262, 76)), text: [0, 1].map((i) => R(90 + i * 278, 1120 + oy, 262, 76)),
    back: R(140, 1290 + oy, 440, 84), msg: { x: 360, y: 1236 + oy, w: 620, maxLines: 3 }, wins: { x: 360, y: 1420 + oy },
  };
  const stack = (x0, aw, y0, avail) => {
    const k = clamp(avail / 640, 0.62, 1), rh = Math.round(76 * k), sp = (n) => y0 + n * 130 * k;
    const cw3 = (aw - 24) / 3, cw2 = (aw - 16) / 2, bw = Math.min(aw, 440);
    return {
      labels: [{ t: 'Board', x: x0, y: sp(0) }, { t: 'Pieces', x: x0, y: sp(1) }, { t: 'Message text', x: x0, y: sp(2) }],
      boards: [0, 1, 2].map((i) => R(x0 + i * (cw3 + 12), sp(0) + 14, cw3, rh)), sets: [0, 1].map((i) => R(x0 + i * (cw2 + 16), sp(1) + 14, cw2, rh)), text: [0, 1].map((i) => R(x0 + i * (cw2 + 16), sp(2) + 14, cw2, rh)),
      back: R(x0 + (aw - bw) / 2, sp(3) + 4, bw, Math.round(80 * k)), msg: { x: x0 + aw / 2, y: sp(3) + 4 + 80 * k + 38, w: aw - 20, maxLines: 2 }, wins: { x: x0 + aw / 2, y: sp(3) + 4 + 80 * k + 38 + 64 * k },
    };
  };
  if (!L.wide) {
    const total = 660, bot = h - Math.max(24, ins.b + 8), y0 = Math.max(bot - total, h * 0.4), avail = bot - y0, topPad = Math.max(10, ins.t + 6);
    return { hero: heroFit(24, topPad, w - 48, y0 - topPad - 24), drawBoard: false, dim: R(0, y0 - 12, w, h - y0 + 12), ...stack(U.x0 + 40, U.w - 80, y0 + 6, avail) };
  }
  const aw = clamp(w * 0.46, 470, 700), ax = U.x1 - aw - 16, leftW = ax - U.x0 - 8, avail = U.h - 40, y0 = U.y0 + 36;
  return { hero: heroFit(U.x0 + 12, U.y0 + 12, leftW - 24, U.h - 24, 1.2), drawBoard: false, dim: null, card: R(ax, U.y0 + 10, aw, U.h - 20), ...stack(ax + 22, aw - 44, y0 + 18, avail - 36) };
}

// Result screen: the heading block (figure + texts) in canonical coordinates, translated and scaled to where it belongs; buttons are placed here too.
const OVER = { y0: 300, y1: 880 };       // the heading block's canonical vertical extent
function buildOver(L) {
  const { w, h, U, oy, ins } = L, bBottom = h - Math.max(18, ins.b + 8);
  if (L.tall) return {
    sc: 1, tx: 0, ty: oy, cx: w / 2, drawBoard: true, again: R(140, 900 + oy, 440, 96), back: R(140, 1016 + oy, 440, 84), more: { x: 360, y: 1160 + oy },
  };
  if (!L.wide) {
    const bhA = 88, bhB = 76, extra = bhA + 18 + bhB + 18 + 54, topPad = Math.max(16, ins.t + 10);
    const sc = clamp((bBottom - topPad - extra - 8) / (OVER.y1 - OVER.y0), 0.45, 1), bh = (OVER.y1 - OVER.y0) * sc, total = bh + 14 + extra, y0 = Math.max(topPad, (h - total) / 2 - 10);
    const bw = Math.min(440, w - 80), bx = w / 2 - bw / 2, by = y0 + bh + 14;
    return { sc, tx: w / 2 - 360 * sc, ty: y0 - OVER.y0 * sc, cx: w / 2, drawBoard: true, again: R(bx, by, bw, bhA), back: R(bx, by + bhA + 18, bw, bhB), more: { x: w / 2, y: by + bhA + 18 + bhB + 40 } };
  }
  const aw = clamp(w * 0.46, 470, 700), ax = U.x1 - aw - 16, leftW = ax - U.x0 - 8, lcx = U.x0 + leftW / 2;
  const sc = clamp(Math.min((leftW - 24) / 600, (U.h - 40) / (OVER.y1 - OVER.y0)), 0.5, 1.05);
  const bw = Math.min(440, aw - 56), bx = ax + (aw - bw) / 2, cy = h / 2, card = R(ax, cy - 175, aw, 350);
  return { sc, tx: lcx - 360 * sc, ty: cy - ((OVER.y0 + OVER.y1) / 2) * sc, cx: lcx, drawBoard: false, card, again: R(bx, card.y + 28, bw, 92), back: R(bx, card.y + 138, bw, 80), more: { x: ax + aw / 2, y: card.y + 276 } };
}

// Rules reference: one framed panel (header with the text-size stepper, a scrolling body, page counter) and Back / Next.
function buildRules(L) {
  const { h, U, ins } = L, barY = L.wide ? h - 98 - Math.max(0, ins.b - 16) : L.barY, barH = 72;
  const pw = Math.min(U.w - 60, 960), px = U.x0 + (U.w - pw) / 2, py = Math.max(24, ins.t + 8);
  const panel = R(px, py, pw, barY - 16 - py);
  const nw = Math.min(262, (pw - 16) / 2), navX = U.x0 + (U.w - (2 * nw + 16)) / 2;
  const viewport = R(panel.x + 20, panel.y + 92, panel.w - 40 - 14, panel.h - 92 - 52);
  return {
    panel, viewport, nav: { back: R(navX, barY, nw, barH), next: R(navX + nw + 16, barY, nw, barH) },
    header: { textDec: R(panel.x + panel.w - 24 - 110 - 12 - 110, panel.y + 12, 110, 66), textInc: R(panel.x + panel.w - 24 - 110, panel.y + 12, 110, 66) },
    scrollbar: R(panel.x + panel.w - 30, viewport.y, 22, viewport.h), counterY: panel.y + panel.h - 24, textW: Math.min(viewport.w - 40, 820), cx: panel.x + panel.w / 2,
  };
}

// ---- test / back-compat exports: the approved phone-portrait layout (720 x 1560) ------------------------------------------
const PHONE = layoutFor(W, H);
export const BTN = PHONE.BTN, LOOK = PHONE.look, RULES_NAV = PHONE.rules.nav, RULES_TEXT = PHONE.rules.header;
export const AUTOPLAY = { ...PHONE.BTN.auto };
export const titleRows = (hasSave) => PHONE.title(hasSave).rows;
