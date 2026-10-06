// Screen geometry as a function of the LIVE screen size (kit 1.7 fluid viewport: the short side is always 720 units, the long side
// grows with the aspect ratio). `layoutFor(w, h)` returns every rectangle for that size, cached by size + host insets, so game.js
// (hit-testing) and view.js (drawing) never disagree and a frame never recomputes it.
//
// Two screen shapes, one set of rectangles:
//   portrait  (w <= h)  the approved phone look: tallies on top, the board, a message panel, a button bar. The board is drawn
//                       VERTICALLY (9-point lines run up the screen, armies left and right) when that gives the larger board,
//                       or HORIZONTALLY (armies top and bottom) on shorter portrait screens (tablets, small phones).
//   wide      (w >  h)  a control column on the left (menu, tallies, message, buttons) and the board filling the rest, drawn
//                       horizontally when wide enough, vertically on squarish screens (4:3).
//   Title / result / settings / reference pages each re-flow the same way (art left + buttons right in landscape).
//
// The board is always drawn in "canonical" units (point spacing 120, frame 64) under one uniform scale `board.k`; `board.ox/oy` is
// the screen position of grid point (0,0). Everything the view draws on the board uses canonical coordinates.
import { ROWS, COLS, rowOf, colOf } from './rules.js';

export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const THINK_STEPS = [2, 5, 8, 10];
export const REVEAL_TIME = 2;
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// Safe areas and the host's floating back button, in virtual units. main.js keeps this current (browsers: all zero).
// px = css pixels per virtual unit (text never shrinks below ~11 css px).
// Tap zone of the title lockup: >= 44 css px each way, extended sideways and downward only (never into the buttons above).
export function lockHit(L) {
  const r = L.title.lock; if (!r) return null; const m = 44 / Math.max(0.05, host.px);
  const w = Math.max(r.w, m), x = r.x + r.w / 2 - w / 2, y = r.y - 2;
  return { x, y, w, h: Math.max(r.h + 2, Math.min(m, L.h - y)) };
}
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };

export const S0 = 120, F0 = 64, STONE_R = 38;           // canonical point spacing, frame thickness, stone radius
const PLATE = { v: { w: (ROWS - 1) * S0 + 2 * F0, h: (COLS - 1) * S0 + 2 * F0 }, h: { w: (COLS - 1) * S0 + 2 * F0, h: (ROWS - 1) * S0 + 2 * F0 } };
const KMAX = 1.15;

export const SIBLINGS = [
  { slug: 'tiger-and-goat', title: 'Tiger and Goat' },
  { slug: 'fox-and-geese', title: 'Fox and Geese' },
  { slug: 'mill-nine-mens-morris', title: "Nine Men's Morris" },
  { slug: 'kings-table-tafl', title: 'Tafl' },
];

// Canonical position of a point. `flip` turns the board half a turn so a Dark player also sees their army on the left / at the bottom.
export function canonXY(p, flip, orient) {
  const r = rowOf(p), c = colOf(p);
  if (orient === 'v') { const rr = flip ? ROWS - 1 - r : r, cc = flip ? COLS - 1 - c : c; return { x: rr * S0, y: (COLS - 1 - cc) * S0 }; }
  return flip ? { x: (COLS - 1 - c) * S0, y: r * S0 } : { x: c * S0, y: (ROWS - 1 - r) * S0 };
}

const R = (x, y, w, h) => ({ x, y, w, h });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const cache = new Map();
export function layoutFor(w, h) {
  w = Math.round(w); h = Math.round(h);
  const key = `${w}x${h}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}`;
  let L = cache.get(key);
  if (!L) { L = build(w, h, { ...host }); L.key = key; cache.set(key, L); if (cache.size > 40) cache.delete(cache.keys().next().value); }
  return L;
}

// ---- title stack: the menu buttons ---------------------------------------------------------------------------------
// Natural sizes, scaled down (never up) by f so the whole stack fits `availH`. `tall` = text size 250% / 300%.
function titleStack(x, y, w, availH, hasSaved, tall) {
  const gap0 = tall ? 12 : 16, narrow = w < 520, wideThird = !tall && !narrow;
  const hs = tall ? { resume: 78, play: 134, a: 108, b: 108, c: 100, d: 84, e: 84 } : { resume: 84, play: 112, a: 92, b: 92, c: 84, d: 84, e: 84 };
  const lines = (hasSaved ? 1 : 0) + 1 + 3 + (wideThird ? 1 : 2);
  const natural = (hasSaved ? hs.resume : 0) + hs.play + hs.a + hs.b + hs.c + (wideThird ? hs.d : hs.d + hs.e) + (lines - 1) * gap0;
  const f = Math.min(1, availH / natural), gap = Math.round(gap0 * f), H = (v) => Math.round(v * f);
  const half = (w - gap) / 2, third = (w - gap * 2) / 3, rows = {};
  let yy = y;
  if (hasSaved) { rows.resume = R(x, yy, w, H(hs.resume)); yy += H(hs.resume) + gap; }
  rows.play = R(x, yy, w, H(hs.play)); yy += H(hs.play) + gap;
  rows.two = R(x, yy, half, H(hs.a)); rows.learn = R(x + half + gap, yy, half, H(hs.a)); yy += H(hs.a) + gap;
  rows.watch = R(x, yy, half, H(hs.b)); rows.settings = R(x + half + gap, yy, half, H(hs.b)); yy += H(hs.b) + gap;
  rows.level = R(x, yy, half, H(hs.c)); rows.side = R(x + half + gap, yy, half, H(hs.c)); yy += H(hs.c) + gap;
  if (wideThird) { rows.howto = R(x, yy, third, H(hs.d)); rows.rules = R(x + third + gap, yy, third, H(hs.d)); rows.about = R(x + (third + gap) * 2, yy, third, H(hs.d)); yy += H(hs.d); }
  else { rows.howto = R(x, yy, w, H(hs.d)); yy += H(hs.d) + gap; rows.rules = R(x, yy, half, H(hs.e)); rows.about = R(x + half + gap, yy, half, H(hs.e)); yy += H(hs.e); }
  rows.bottom = yy; rows.f = f;
  return rows;
}

function build(w, h, ins) {
  const land = w > h;
  const L = { w, h, land, ins, mode: land ? 'wide' : 'portrait' };
  const back = ins.back > 0, backSz = back ? Math.max(ins.back, 56) : 0;
  const backBox = L.backBox = back ? R(ins.l, ins.t, backSz + 8, backSz + 8) : R(ins.l, ins.t, 0, 0);
  const U = L.U = { x0: ins.l, y0: ins.t, x1: w - ins.r, y1: h - ins.b }; U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  const mL = Math.max(24, ins.l + 10), mR = Math.max(24, ins.r + 10), cw = w - mL - mR;
  const headY = back ? backBox.y + (backBox.h - 62) / 2 : Math.max(18, ins.t + 8);       // top of the Menu / sound row
  const menuX = back ? backBox.x + backBox.w + 8 : mL;
  const bottomPad = Math.max(12, ins.b);
  L.headY = headY;

  // ---- play / Watch & Learn / Learn -------------------------------------------------------------------------------------
  const HDR = L.HDR = {}, BTN = L.BTN = {}, AUTO = L.AUTO = {}, LEARN = L.LEARN = {}, CHOICE = L.CHOICE = {};
  const slots = (x, y, wTot, hh, weights, gap) => {                 // a row of rects with relative widths
    const total = weights.reduce((a, b) => a + b, 0), avail = wTot - gap * (weights.length - 1);
    let xx = x; return weights.map((wt) => { const r = R(xx, y, (avail * wt) / total, hh); xx += r.w + gap; return r; });
  };
  const fillBars = (x, y, wTot, hh, gap) => {                       // portrait bars (one row)
    const [u, hi, d, e] = slots(x, y, wTot, hh, [1, 1, 1, 1], gap); Object.assign(BTN, { undo: u, hint: hi, danger: d, end: e });
    const a = slots(x, y, wTot, hh, [150, 14, 196, 14, 100, 98, 100], 0);   // weights include the gaps
    Object.assign(AUTO, { exit: a[0], pause: a[2], dec: a[4], val: a[5], inc: a[6] });
    const l = slots(x, y, wTot, hh, [150, 14, 150, 14, 150, 14, 180], 0);
    Object.assign(LEARN, { menu: l[0], hint: l[2], reset: l[4], next: l[6] });
  };

  if (!land) {
    const dense = h < 1500;
    const mH = dense ? 84 : 96, bH = dense ? 92 : 104, iH = dense ? 36 : 44, gap1 = dense ? 10 : 14, gap2 = dense ? 12 : 18;
    HDR.menu = R(menuX, headY, 120, 62); HDR.sound = R(w - mR - 120, headY, 120, 62);
    HDR.title = { x: (HDR.menu.x + HDR.menu.w + HDR.sound.x) / 2, y: headY + 31, maxW: HDR.sound.x - HDR.menu.x - HDR.menu.w - 24 };
    const tallyY = back ? Math.max(headY + 62, backBox.y + backBox.h) + 6 : headY + 62 + 16, th = (cw - 12) / 2;
    HDR.tallyL = R(mL, tallyY, th, 64); HDR.tallyR = R(mL + th + 12, tallyY, th, 64); HDR.strip = R(mL, tallyY, cw, 64);
    const boardTop = tallyY + 64 + 10;
    const infoY = h - bottomPad - iH, barY = infoY - gap2 - bH;
    L.INFO = R(mL, infoY, cw, iH); L.barY = barY; L.barH = bH;
    fillBars(mL, barY, cw, bH, 14);
    const regionH = barY - gap1 - boardTop, availH = regionH - mH - gap1;
    const kv = Math.min(availH / PLATE.v.h, cw / PLATE.v.w, KMAX), kh = Math.min(cw / PLATE.h.w, availH / PLATE.h.h, KMAX);
    const orient = kv >= kh ? 'v' : 'h', k = Math.max(0.2, orient === 'v' ? kv : kh), pl = PLATE[orient];
    const groupH = pl.h * k + gap1 + mH, gy = boardTop + Math.max(0, (regionH - groupH) / 2);
    L.board = { orient, k, plate: R(mL + (cw - pl.w * k) / 2, gy, pl.w * k, pl.h * k) };
    L.MSG = R(mL, gy + pl.h * k + gap1, cw, mH); L.MSGL = L.MSG;
    const hw = (cw - 16) / 2; CHOICE.approach = R(mL, L.MSG.y, hw, mH); CHOICE.withdraw = R(mL + hw + 16, L.MSG.y, hw, mH);
  } else {
    const pad = 14, x0 = U.x0 + pad, x1 = U.x1 - pad, y0 = U.y0 + pad, y1 = U.y1 - pad, availH = y1 - y0;
    const fitK = (P) => { const colW = x1 - x0 - P - pad; return { v: Math.min(colW / PLATE.v.w, availH / PLATE.v.h, KMAX), h: Math.min(colW / PLATE.h.w, availH / PLATE.h.h, KMAX) }; };
    const k0 = fitK(300), orient = k0.v >= k0.h ? 'v' : 'h', k = Math.max(0.2, k0[orient]), pl = PLATE[orient];
    const P = clamp(x1 - x0 - pl.w * k - pad, 300, 500), groupW = P + pad + pl.w * k, gx = x0 + Math.max(0, (x1 - x0 - groupW) / 2);
    L.board = { orient, k, plate: R(gx + P + pad, y0 + (availH - pl.h * k) / 2, pl.w * k, pl.h * k) };
    // the control column
    const cx0 = gx, cWd = P, conflict = back && cx0 < backBox.x + backBox.w;
    // the kit's "Preview m:ss" badge sits top-centre (y 6-34): keep the Menu / sound row clear of it
    const rowTop0 = conflict ? backBox.y + (backBox.h - 56) / 2 : y0, rowTop = (gx < w / 2 + 80 && gx + P > w / 2 - 80) ? Math.max(rowTop0, 40) : rowTop0, rowLeft = conflict ? backBox.x + backBox.w + 8 : cx0;
    const bw0 = (cx0 + cWd - rowLeft - 10) / 2;
    HDR.menu = R(rowLeft, rowTop, bw0, 56); HDR.sound = R(rowLeft + bw0 + 10, rowTop, bw0, 56);
    let yy = Math.max(rowTop + 56, conflict ? backBox.y + backBox.h : 0) + 10;
    HDR.title = { x: cx0 + cWd / 2, y: yy + 17, maxW: cWd }; yy += 36;
    HDR.tallyL = R(cx0, yy + 68, cWd, 60); HDR.tallyR = R(cx0, yy, cWd, 60); HDR.strip = R(cx0, yy, cWd, 60);   // top army first, you below
    yy += 128 + 12;
    let bh = 84; const gap = 10;
    let infoH = 36, msgH = y1 - yy - (infoH + 10) - (2 * bh + gap + 10);
    if (msgH < 120) { bh = 70; msgH = y1 - yy - (infoH + 10) - (2 * bh + gap + 10); }
    if (msgH < 100) { infoH = 30; bh = 62; msgH = y1 - yy - (infoH + 10) - (2 * bh + gap + 10); }
    L.MSG = R(cx0, yy, cWd, Math.max(80, msgH));
    L.MSGL = R(cx0, HDR.strip.y + 60 + 8, cWd, L.MSG.y + L.MSG.h - (HDR.strip.y + 68));      // Learn has no tallies: its lesson text gets their room
    const by = L.MSG.y + L.MSG.h + 10;
    L.INFO = R(cx0, by + 2 * bh + gap + 10, cWd, infoH);
    const c2 = slots(cx0, by, cWd, bh, [1, 1], gap), r2 = slots(cx0, by + bh + gap, cWd, bh, [1, 1], gap);
    Object.assign(BTN, { undo: c2[0], hint: c2[1], danger: r2[0], end: r2[1] });
    const a3 = slots(cx0, by + bh + gap, cWd, bh, [30, 40, 30], gap);
    Object.assign(AUTO, { exit: c2[0], pause: c2[1], dec: a3[0], val: a3[1], inc: a3[2] });
    Object.assign(LEARN, { menu: c2[0], hint: c2[1], reset: r2[0], next: r2[1] });
    const stack = L.MSG.h >= 116;                                    // approach / withdraw: stacked when the panel is tall enough
    if (stack) { const ch = (L.MSG.h - 10) / 2; CHOICE.approach = R(cx0, L.MSG.y, cWd, ch); CHOICE.withdraw = R(cx0, L.MSG.y + ch + 10, cWd, ch); }
    else { const hw = (cWd - 10) / 2; CHOICE.approach = R(cx0, L.MSG.y, hw, L.MSG.h); CHOICE.withdraw = R(cx0 + hw + 10, L.MSG.y, hw, L.MSG.h); }
  }
  // board transform + point helpers
  const B = L.board; B.ox = B.plate.x + F0 * B.k; B.oy = B.plate.y + F0 * B.k;
  const canon = [0, 1].map((f) => Array.from({ length: ROWS * COLS }, (_, p) => canonXY(p, !!f, B.orient)));
  L.cpt = (p, flip) => canon[flip ? 1 : 0][p];
  L.pt = (p, flip) => { const c = canon[flip ? 1 : 0][p]; return { x: B.ox + c.x * B.k, y: B.oy + c.y * B.k }; };
  L.toCanon = (x, y) => ({ x: (x - B.ox) / B.k, y: (y - B.oy) / B.k });
  L.pointAt = (x, y, flip, tolFrac = 0.46) => {
    const q = L.toCanon(x, y), pts = canon[flip ? 1 : 0]; let best = -1, bd = S0 * tolFrac;
    for (let p = 0; p < pts.length; p++) { const d = Math.hypot(pts[p].x - q.x, pts[p].y - q.y); if (d < bd) { bd = d; best = p; } }
    return best;
  };

  // ---- title ---------------------------------------------------------------------------------------------------------------
  const T = L.title = {};
  const LOCK = 327 / 1200;                                      // the themed Arcforge lockup image's aspect (web/brand/arcforge-lockup.png)
  if (!land) {
    const lw = Math.min(300, w - 80), lh = lw * LOCK, bw = Math.min(620, U.w - 60), x0 = (w - bw) / 2;
    T.card = false;
    T.lock = R((w - lw) / 2, h - Math.max(12, ins.b) - lh - 4, lw, lh);
    const tail = h - T.lock.y + 52;
    T.rows = (hasSaved, tall) => {
      // the stack at its natural size decides how much room the hero gets; the hero never grows past 640 or shrinks below 300
      const nat = titleStack(x0, 0, bw, 1e9, hasSaved, tall), heroH = clamp(h - nat.bottom - 14 - tail, 300, 820);
      const rows = titleStack(x0, heroH + 14, bw, h - tail - heroH - 14, hasSaved, tall); rows.hero = R(0, 0, w, heroH); return rows;
    };
    T.sound = R(w - mR - 120, T.lock.y + (T.lock.h - 62) / 2, 120, 62);       // beside the lockup: the hero title keeps the whole top
    T.foot = (rows) => Math.min(T.lock.y - 14, rows.bottom + 44);
  } else {
    const rowsW = clamp(w * 0.36, 380, 560), colX = U.x1 - 14 - rowsW, hero0 = R(U.x0 + 14, U.y0 + 14, colX - 14 - (U.x0 + 14), U.y1 - U.y0 - 28), bs = host.back ? Math.round(58 / Math.max(0.05, host.px)) : 0, hero = R(hero0.x + bs, hero0.y, hero0.w - bs, hero0.h);   // the card clears the host back button
    const lw = Math.min(300, rowsW - 20), lh = lw * LOCK;
    T.card = true;
    T.lock = R(colX + (rowsW - lw) / 2, U.y1 - 14 - lh, lw, lh);
    T.rows = (hasSaved, tall) => {
      const top = U.y0 + 14, availH = T.lock.y - 52 - top, rows = titleStack(colX, top, rowsW, availH, hasSaved, tall);
      const off = Math.max(0, (availH - (rows.bottom - top)) / 2);
      for (const kk of Object.keys(rows)) if (rows[kk] && rows[kk].x !== undefined) rows[kk].y += off;
      rows.bottom += off; rows.hero = hero; return rows;
    };
    T.sound = R(hero.x + hero.w - 14 - 120, hero.y + 14, 120, 62);
    T.foot = (rows) => Math.min(T.lock.y - 12, rows.bottom + 40);
    T.colX = colX; T.colW = rowsW;
  }

  // ---- result overlay (play / Watch & Learn) ---------------------------------------------------------------------------
  const RES = L.RESULT = {};
  if (!land) {
    const pw = Math.min(640, w - 60), top = Math.max(back ? backBox.y + backBox.h + 8 : 40, ins.t + 12), bottom = h - Math.max(24, ins.b + 8), avail = bottom - top;
    const ph = Math.min(1180, avail), f = Math.min(1, ph / 1180), hb = Math.round(92 * Math.max(f, 0.78)), Hh = (v) => Math.round(v * f);
    const P = R((w - pw) / 2, top + (avail - ph) * 0.35, pw, ph), cx = w / 2;
    RES.panel = P; RES.dec = R(P.x + 18, P.y + 18, 96, 56); RES.inc = R(P.x + P.w - 114, P.y + 18, 96, 56);
    RES.title = { cx, x: P.x + 50, w: P.w - 100, y: P.y + Hh(84), h: Hh(170) };
    RES.art = { cx, cy: P.y + Hh(260) + Hh(210) / 2, h: Hh(210), s: Math.max(0.6, f) };
    RES.sub = { cx, w: P.w - 90, y: P.y + Hh(480), h: Hh(230) };
    RES.again = R(P.x + 40, P.y + Hh(725), P.w - 80, hb); RES.menu = R(P.x + 40, RES.again.y + hb + 12, P.w - 80, hb);
    RES.chipsY = RES.menu.y + hb + Hh(64);
    const cwid = (P.w - 52) / 2, ch = Math.round(64 * Math.max(f, 0.85)), cp = Math.round(78 * Math.max(f, 0.9));
    RES.chip = (i) => R(P.x + 20 + (i % 2) * (cwid + 12), RES.chipsY + Math.floor(i / 2) * cp, cwid, ch);
  } else {
    const pw = Math.min(U.w - 28, 1040), P = R(U.x0 + (U.w - pw) / 2, U.y0 + 14, pw, U.h - 28), colW = pw * 0.5 - 30;
    const cl = P.x + 20 + colW / 2, rx = P.x + P.w * 0.5 + 10, bhh = Math.min(88, Math.max(64, P.h * 0.13));
    RES.panel = P; RES.inc = R(P.x + P.w - 114, P.y + 14, 96, 52); RES.dec = R(P.x + P.w - 114 * 2, P.y + 14, 96, 52);
    const fz = Math.min(1, (P.h - 40) / 600);
    RES.title = { cx: cl, x: cl - colW / 2, w: colW, y: P.y + 34, h: Math.round(130 * fz) };
    RES.art = { cx: cl, cy: P.y + 34 + Math.round(130 * fz) + 20 + Math.round(190 * fz) / 2, h: Math.round(190 * fz), s: Math.max(0.6, fz) };
    const sy = RES.art.cy + RES.art.h / 2 + 18; RES.sub = { cx: cl, w: colW, y: sy, h: P.y + P.h - 20 - sy };
    RES.again = R(rx, P.y + 84, colW, bhh); RES.menu = R(rx, RES.again.y + bhh + 12, colW, bhh);
    RES.chipsY = RES.menu.y + bhh + 54;
    const cwid = (colW - 12) / 2, ch = Math.min(60, Math.max(46, (P.y + P.h - 20 - RES.chipsY - 12) / 2));
    RES.chip = (i) => R(rx + (i % 2) * (cwid + 12), RES.chipsY + Math.floor(i / 2) * (ch + 12), cwid, ch);
  }

  // ---- reference pages (How to Play / About / Rules) -----------------------------------------------------------------------
  const REF = L.ref = {};
  if (!land) {
    const btnH = h >= 1300 ? 104 : 92, bm = Math.max(h >= 1300 ? 46 : 24, ins.b + 8), gx = Math.max(20, ins.l + 10), gr = Math.max(20, ins.r + 10), bw = (w - gx - gr - 16) / 2;
    REF.back = R(gx, h - bm - btnH, bw, btnH); REF.next = R(gx + bw + 16, h - bm - btnH, bw, btnH);
    REF.dec = R(back ? menuX : gx, headY, 130, 64); REF.inc = R(w - gr - 130, headY, 130, 64);
    REF.pct = { x: (REF.dec.x + REF.dec.w + REF.inc.x) / 2, y: headY + 32 };
    const top = headY + 64 + 18, px = Math.max(28, ins.l + 10);
    REF.panel = R(px, top, w - px - Math.max(28, ins.r + 10), REF.back.y - 48 - top); REF.counterY = REF.back.y - 14;
  } else {
    const colW = 210, colX = U.x1 - 14 - colW, bh = 84;
    REF.next = R(colX, U.y1 - Math.max(14, ins.b) - bh, colW, bh); REF.back = R(colX, REF.next.y - 12 - bh, colW, bh);
    REF.dec = R(colX, U.y0 + 14, 66, 64); REF.inc = R(colX + colW - 66, U.y0 + 14, 66, 64); REF.pct = { x: colX + colW / 2, y: U.y0 + 14 + 32 };
    REF.counterY = REF.back.y - 14;
    const top = back ? backBox.y + backBox.h + 6 : U.y0 + 14, px = U.x0 + 14;
    REF.panel = R(px, top, colX - 14 - px, U.y1 - 14 - top);
  }
  REF.vp = R(REF.panel.x + 10, REF.panel.y + 72, REF.panel.w - 20, REF.panel.h - 72 - 12);

  // ---- settings --------------------------------------------------------------------------------------------------------------
  const ST = L.settings = {};
  {
    const twoCol = land && U.w >= 880, btnH = h >= 1300 ? 104 : 80, bm = Math.max(h >= 1300 ? 46 : 18, ins.b + 8);
    const bwid = twoCol ? 420 : w - 80;
    ST.back = R((w - bwid) / 2, h - bm - btnH, bwid, btnH);
    ST.titleY = back ? backBox.y + backBox.h / 2 : land ? 54 : 80;
    const top = back ? backBox.y + backBox.h + 14 : land ? 100 : 140, availH = ST.back.y - 14 - top, n = twoCol ? 4 : 7;
    const total = twoCol ? Math.min(U.w - 60, 1200) : w - 80, colW = twoCol ? (total - 24) / 2 : total, x0 = (w - total) / 2;
    const mk = (pitchMax, rowMax) => { const pitch = Math.min(pitchMax, availH / n), rh = Math.min(rowMax, Math.round(pitch * (rowMax / pitchMax))); return (i) => { const col = twoCol && i >= 4 ? 1 : 0, j = col ? i - 4 : i; return R(x0 + col * (colW + 24), top + j * pitch, colW, rh); }; };
    ST.row = mk(138, 118); ST.rowTall = mk(182, 168);
  }

  // ---- demo limit --------------------------------------------------------------------------------------------------------------
  const LM = L.limit = {};
  { const pw = Math.min(w - 80, 640); LM.panel = R((w - pw) / 2, clamp(h * 0.27, back ? backBox.y + backBox.h + 10 : 20, h - 540), pw, 520); LM.btn = R(LM.panel.x + 60, LM.panel.y + 390, pw - 120, 90); }
  return L;
}
