// Geometry, as a function of the LIVE screen size (kit 1.7 fluid viewport: the short side is always 720 units, the long side
// follows the aspect). `layoutFor(w, h)` returns every position for that size; it is cached, so a frame never recomputes it.
// Three shapes:
//   tall   portrait phone (h >= 1520): the approved phone look, unchanged (board tilted, hounds at the bottom, hare at the top).
//   stack  every other portrait or squarish window (tablets, small phones): header on top, board, button bar below.
//   wide   landscape: a card on the left (turn, clock, messages), the board in the middle, a card of buttons on the right.
// The board is a map of the hunt seen from one of two sides: 'v' (long axis up the screen, slight perspective) or 'h' (long axis
// across the screen, flat). Both are painted ONCE in their own canonical coordinates (art.js) and drawn scaled; `board.s` is the scale.
// Board coordinates (u, v): u in -1..1 (the three lanes), v in 0..4 (0 = the hare's end, 4 = the hounds' end).
import { AX, LAT } from './rules.js';
export const W = 720, H = 1560;
export const THINK_STEPS = [2, 5, 8, 10];
export const REVEAL_TIME = 2;
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// Safe areas and the host's floating back button, in virtual units. main.js keeps this current (browsers: all zero).
// px: css pixels per virtual unit (text never shrinks below ~11 css px).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };

// ---- the board in canonical coordinates ----------------------------------------------------------------------------------
const CX = 360, D = 215, K = 0.05, HGT = 4680, Y_NEAR = 1300, Y_H = Y_NEAR - HGT, DH = 150;
export const UNIT = D / 126;                 // everything drawn on the board (paths, rings, pieces) scales with UNIT (times board.s)
export const PIECE_R = 45 * UNIT;
export const SIZE = { H: 1.2, D: 1.14 };
export const KINDS = {
  v: { project: (u, v) => { const z = 1 + K * (4 - v); return { x: CX + (u * D) / z, y: Y_H + HGT / z, s: 1 / z }; } },
  h: { project: (u, v) => ({ x: 500 + (2 - v) * DH, y: 300 + u * DH, s: DH / D }) },
};
for (const kd of Object.values(KINDS)) {
  const cs = [[-1.5, -0.55], [1.5, -0.55], [1.5, 4.55], [-1.5, 4.55]].map(([u, v]) => kd.project(u, v));
  const x0 = Math.min(...cs.map((p) => p.x)), x1 = Math.max(...cs.map((p) => p.x)), y0 = Math.min(...cs.map((p) => p.y)), y1 = Math.max(...cs.map((p) => p.y));
  kd.mat = { x0, x1, y0, y1 };
  kd.fit = { x0: x0 - 10, x1: x1 + 10, y0: y0 - 96, y1: y1 + 30 };           // what must stay on screen (the animals stand tall above the top row)
  kd.fit.w = kd.fit.x1 - kd.fit.x0; kd.fit.h = kd.fit.y1 - kd.fit.y0; kd.fit.cx = (kd.fit.x0 + kd.fit.x1) / 2; kd.fit.cy = (kd.fit.y0 + kd.fit.y1) / 2;
  kd.layer = { x: x0 - 34, y: y0 - 26, w: x1 - x0 + 34 + 60, h: y1 - y0 + 26 + 74 };   // the cached painting: the mat, its shadow and its edge
}
export const GROUND = 1560;                  // the forest floor is one square painting, drawn "cover" on any screen

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

function build(w, h, ins) {
  const wide = w >= h * 1.3, tall = !wide && w < h && h >= 1520, mode = wide ? 'wide' : tall ? 'tall' : 'stack';
  const L = { w, h, wide, tall, mode, ins };
  const bsz = ins.back ? Math.max(ins.back, 56) : 0;
  L.backBox = ins.back ? R(ins.l, ins.t, bsz + 8, bsz + 8) : R(0, 0, 0, 0);
  const U = L.U = { x0: ins.l, y0: ins.t, x1: w - ins.r, y1: h - ins.b };
  U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  const barH = 72, barY = L.barY = h - 98 - Math.max(0, ins.b - 16);
  const cardTop = ins.back ? Math.max(U.y0 + 10, L.backBox.y + L.backBox.h + 4) : U.y0 + 10;
  L.oy = tall ? (h - 1560) / 2 : 0;                                  // vertical centring of the phone-shaped screens (title, result...)

  // ---- the board ---------------------------------------------------------------------------------------------------------
  const place = (kind, s, cx, cy) => { const kd = KINDS[kind]; return makeBoard(kind, s, cx - kd.fit.cx * s, cy - kd.fit.cy * s); };
  const bestKind = (freeW, freeH, prefer) => {
    const sz = (k) => Math.min(1.45, freeW / KINDS[k].fit.w, freeH / KINDS[k].fit.h);
    const sv = sz('v'), sh = sz('h');
    const kind = prefer === 'h' ? (sv > sh * 1.15 ? 'v' : 'h') : (sh > sv * 1.1 ? 'h' : 'v');
    return { kind, s: kind === 'v' ? sv : sh };
  };
  const BTN = L.BTN = {};
  if (tall) {
    const y0 = ins.back ? Math.max(96, L.backBox.y + L.backBox.h + 6) : Math.max(92, ins.t + 56), infoH = ins.back ? 190 : 240;
    L.info = R(24, y0, w - 48, infoH);
    // the approved phone board (scale 1) when it fits between the header and the button bar, a little smaller on screens with big insets
    const fy0 = y0 + infoH, fy1 = barY - 2; let s = Math.min(1, (fy1 - fy0) / KINDS.v.fit.h); if (s > 0.985) s = 1;
    L.board = place('v', s, w / 2, (fy0 + fy1) / 2);
    L.msgTop = { x: 40, y: Math.max(y0 - 2, 156), w: 640 };       // banner over the header while playing
    L.msgBottom = { x: 40, yb: barY - 130, w: 640 };               // lessons / puzzles / Auto Play: low on the screen, above the bar
  } else if (!wide) {
    const x0 = ins.back ? Math.max(U.x0 + 16, L.backBox.x + L.backBox.w + 6) : U.x0 + 16, top0 = U.y0 + Math.max(6, Math.ceil(6 / Math.max(0.3, host.px || 0.6) + 1.7 * Math.max(16, 11.5 / Math.max(0.3, host.px || 0.6)) + 4));   // below the kit's top-centre "Preview m:ss" pill
    const Hi = clamp(h * 0.27, 200, 330);
    const fy0 = top0 + Hi + 6, fy1 = barY - 8;
    const bk = bestKind(U.w - 16, fy1 - fy0, 'v');
    const extra = clamp((fy1 - fy0 - KINDS[bk.kind].fit.h * bk.s) * 0.5, 0, 150);        // spare height goes to the header, so the board is never lost in empty space
    L.info = R(x0, top0, U.x1 - 16 - x0, Hi + extra);
    L.board = place(bk.kind, bk.s, w / 2, (fy0 + extra + fy1) / 2);
    L.infoPanel = R(L.info.x - 10, L.info.y - 4, L.info.w + 20, L.info.h + 8);
    L.msgTop = L.msgBottom = { x: L.info.x, yb: L.info.y + L.info.h - 4, w: L.info.w };      // the banner sits at the foot of the header
  } else {
    const minC = clamp(U.w * 0.21, 200, 290), g = 12, fy0 = U.y0 + 12, fy1 = U.y1 - 12;
    const bk = bestKind(U.w - 2 * minC - 3 * g, fy1 - fy0, 'h');
    const kd = KINDS[bk.kind], bw = kd.fit.w * bk.s;
    const cw = clamp((U.w - bw - 3 * g) / 2, minC, 400);
    const total = 2 * cw + bw + 2 * g, sx = U.x0 + (U.w - total) / 2;
    L.leftCard = R(sx, cardTop, cw, U.y1 - 10 - cardTop);
    L.rightCard = R(sx + cw + g + bw + g, cardTop, cw, U.y1 - 10 - cardTop);
    L.board = place(bk.kind, bk.s, sx + cw + g + bw / 2, (fy0 + fy1) / 2);
    L.info = R(L.leftCard.x + 12, L.leftCard.y + 12, L.leftCard.w - 24, L.leftCard.h - 24);
    L.msgTop = L.msgBottom = { x: L.info.x, y: L.info.y + L.info.h - 170, yb: L.info.y + L.info.h, w: L.info.w };
  }
  L.pointAt = L.board.at;
  L.pointNear = L.board.near;

  // ---- buttons while playing / lessons / puzzles / Auto Play -----------------------------------------------------------------
  if (!wide) {
    const bw = 190, gp = 15, x0 = (w - (3 * bw + 2 * gp)) / 2;
    const ab = Math.min(150, (U.w - 40 - 4 * 10) / 5), ax = (w - (5 * ab + 40)) / 2;
    Object.assign(BTN, {
      menu: R(x0, barY, bw, barH), undo: R(x0 + bw + gp, barY, bw, barH), hint: R(x0 + 2 * (bw + gp), barY, bw, barH),
      next: R(x0 + bw + gp, barY, 2 * bw + gp, barH), share: R(x0 + bw + gp, barY, 2 * bw + gp, barH),
      auto: { exit: R(ax, barY, ab, barH), pause: R(ax + ab + 10, barY, ab, barH), skip: R(ax + 2 * (ab + 10), barY, ab, barH), dec: R(ax + 3 * (ab + 10), barY, ab, barH), inc: R(ax + 4 * (ab + 10), barY, ab, barH) },
    });
  } else {
    const c = L.rightCard, pad = 14, gap = 12, n = 4, bh = clamp((c.h - 2 * pad - (n - 1) * gap) / n, 52, 92), bw = clamp(c.w - 24, 100, 320);
    const ys = c.y + pad + (c.h - 2 * pad - (n * bh + (n - 1) * gap)) / 2, bx = c.x + (c.w - bw) / 2;
    const slot = (i) => R(bx, ys + i * (bh + gap), bw, bh), half = (i, j) => R(bx + j * (bw / 2 + 6), ys + i * (bh + gap), bw / 2 - 6, bh);
    Object.assign(BTN, {
      menu: slot(0), undo: slot(1), hint: slot(2), next: slot(1), share: slot(1),
      auto: { exit: slot(0), pause: slot(1), skip: slot(2), dec: half(3, 0), inc: half(3, 1) },
    });
  }

  const titles = [null, null];
  L.title = (hasSave) => (titles[hasSave ? 1 : 0] ??= buildTitle(L, !!hasSave));
  L.look = buildLook(L);
  L.over = buildOver(L);
  L.camp = buildCamp(L);
  L.rules = buildRules(L);
  return L;
}

// A board painted in canonical coordinates, placed on the screen by a scale and an offset: screen = canonical * s + (ox, oy).
function makeBoard(kind, s, ox, oy) {
  const kd = KINDS[kind];
  const to = (p) => ({ x: ox + p.x * s, y: oy + p.y * s, s: p.s * s });
  const pts = Array.from({ length: 11 }, (_, i) => to(kd.project(LAT[i] - 1, 4 - AX[i])));
  return {
    kind, s, ox, oy, layer: kd.layer, project: (u, v) => to(kd.project(u, v)),
    box: { x0: ox + kd.mat.x0 * s, x1: ox + kd.mat.x1 * s, y0: oy + kd.mat.y0 * s, y1: oy + kd.mat.y1 * s },
    at: (i) => pts[i],
    near(x, y) {
      let best = -1, bd = Infinity;
      for (let i = 0; i < 11; i++) { const p = pts[i], d = Math.min(Math.hypot(p.x - x, p.y - y), Math.hypot(p.x - x, p.y - 34 * p.s - y)); if (d < bd) { bd = d; best = i; } }
      return bd < Math.max(46, 80 * s) ? best : -1;
    },
  };
}

// ---- a column of buttons, in rows of one, two or three ---------------------------------------------------------------------
function placeRows(rows, x0, aw, y0, pitch, bh, out) {
  rows.forEach((row, i) => {
    const y = y0 + i * pitch, n = row.length, cw = (aw - (n - 1) * 14) / n;
    row.forEach((nm, j) => { out[nm] = R(x0 + j * (cw + 14), y, cw, bh); });
  });
}

// The hero art (title, the two pieces, the brand credit), in canonical phone coordinates: x 0..720, y ~105..760.
// Fits `zone` at the largest scale that fits; null when there is no room.
function heroIn(zone, minSc = 0.3) {
  const sc = Math.min(1.15, (zone.w - 16) / 720, zone.h / 660);
  if (sc < minSc) return null;
  return { sc, hx: zone.x + zone.w / 2 - 360 * sc, hy: zone.y + (zone.h - 660 * sc) / 2 - 105 * sc, dx: 0 };
}

// The Arcforge lockup rect (aspect 1200:327): bottom centre, directly under the last menu row; ~36% of the short side wide.
const LOCK_AR = 327 / 1200;
// Tap zone of the title lockup: at least 44 css px each way, extended sideways and down only (never into the buttons above).
export function lockHit(L, T) {
  const r = T.lock; if (!r) return null; const m = 44 / Math.max(0.05, host.px);
  const w = Math.max(r.w, m), x = r.x + r.w / 2 - w / 2, y = r.y - 2;
  return R(x, y, w, Math.max(r.h + 2, Math.min(m, L.h - y)));
}
function lockRect(cx, y, maxW) { const lw = Math.min(260, maxW), lh = lw * LOCK_AR; return R(cx - lw / 2, y, lw, lh); }

// Title: the phone's single column (kept exactly), or a grid for every other shape.
function buildTitle(L, hasSave) {
  const { w, h, U, oy, ins } = L, T = { hero: null, rows: {}, badges: null, dim: null, card: null, board: null, msgY: 0, msgX: w / 2 };
  if (L.tall) {
    const big = (hasSave ? [['resume']] : []).concat([['learn'], ['campaign'], ['hare', 'hound'], ['two'], ['daily']]), n = big.length;
    const lk = lockRect(w / 2, 0, 300), lockY = h - Math.max(10, ins.b) - lk.h - 8, base = 770 + oy, need = n * 78 + 4 + 140 + 62, avail = lockY - 10 - base, f = Math.min(1, avail / need);
    T.lock = { ...lk, y: lockY };
    placeRows(big, 90, 540, base, 78 * f, 68 * f, T.rows);
    placeRows([['level', 'sound'], ['marks', 'calm'], ['look', 'rules', 'auto']], 90, 540, base + n * 78 * f + 4 * f, 70 * f, 62 * f, T.rows);
    T.hero = { sc: 1, hx: 0, hy: oy, dx: 50 };
    const by = T.rows.look.y + 62 * f + 42;
    if (by + 50 <= lockY - 6) T.badges = { rows: [{ label: 'Hare', side: 'H', x: 96, y: by }, { label: 'Hounds', side: 'D', x: 396, y: by }], games: { x: w / 2, y: by + 44 } };
    T.dim = R(0, 760 + oy, w, h - 760 - oy); T.msgY = T.dim.y - 12;
    T.board = { kind: 'v', s: 1, ox: 0, oy };
    return T;
  }
  const rows = [['resume'], ['learn', 'campaign'], ['hare', 'hound'], ['two', 'daily'], ['level', 'sound'], ['marks', 'calm'], ['look', 'rules', 'auto']].filter((r) => hasSave || r[0] !== 'resume');
  const n = rows.length;
  if (!L.wide) {                                                   // stack: art on top, a grid below
    const lk = lockRect(w / 2, 0, 300), lockY = h - Math.max(10, ins.b) - lk.h - 8; T.lock = { ...lk, y: lockY };
    const pitch = Math.min(78, (h * 0.6) / n), bh = pitch - 10, y0 = lockY - 10 - n * pitch + (pitch - bh);
    placeRows(rows, U.x0 + 40, U.w - 80, y0, pitch, bh, T.rows);
    const top = Math.max(10, ins.t + 6);
    T.hero = heroIn(R(U.x0, top, U.w, y0 - 14 - top), 0.34);
    T.dim = R(0, y0 - 14, w, h - y0 + 14); T.msgY = y0 - 28;
    return T;
  }
  // wide: art on the left, a card of buttons on the right
  const aw = clamp(w * 0.5, 440, 720), ax = U.x1 - aw - 16, lk = lockRect(ax + aw / 2, 0, aw - 40), pitch = Math.min(86, (U.h - 36 - lk.h - 14) / n), bh = pitch - 12, y0 = U.y0 + (U.h - lk.h - 14 - n * pitch) / 2 + (pitch - bh) / 2;
  placeRows(rows, ax + 20, aw - 40, y0, pitch, bh, T.rows);
  T.card = R(ax, y0 - 22, aw, n * pitch + 12);
  T.lock = { ...lk, y: Math.min(T.card.y + T.card.h + 8, U.y1 - lk.h - 4) };
  const leftW = ax - U.x0 - 8;
  T.hero = heroIn(R(U.x0 + 4, U.y0 + 8, leftW - 8, U.h - 16), 0.3);
  T.msgY = U.y1 - 22; T.msgX = U.x0 + leftW / 2;
  return T;
}

// The 'Board and pieces' screen: three boards, two pieces, message size, back.
function buildLook(L) {
  const { w, h, U, oy } = L;
  if (L.tall) return {
    hero: { sc: 1, hx: 0, hy: oy, dx: 50, pieces: false }, board: { kind: 'v', s: 1, ox: 0, oy }, dim: R(0, 760 + oy, w, h - 760 - oy),
    labels: [{ t: 'Board', x: 90, y: 786 + oy, align: 'left' }, { t: 'Pieces', x: 90, y: 946 + oy, align: 'left' }, { t: 'Message text', x: 90, y: 1106 + oy, align: 'left' }],
    woods: [0, 1, 2].map((i) => R(90 + i * 184, 800 + oy, 172, 76)), sets: [0, 1].map((i) => R(90 + i * 278, 960 + oy, 262, 76)), text: [0, 1].map((i) => R(90 + i * 278, 1120 + oy, 262, 76)),
    back: R(140, 1290 + oy, 440, 84), msg: { x: 360, y: 1236 + oy, w: 620 }, wins: { x: 360, y: 1420 + oy },
  };
  const colH = 3 * 104 + 12 + 72 + 56;
  const stack = (x0, aw, y0) => {
    const cw3 = (aw - 24) / 3, cw2 = (aw - 16) / 2, bh = 64, gp = 104;
    return {
      labels: ['Board', 'Pieces', 'Message text'].map((t, i) => ({ t, x: x0, y: y0 + i * gp, align: 'left' })),
      woods: [0, 1, 2].map((i) => R(x0 + i * (cw3 + 12), y0 + 14, cw3, bh)), sets: [0, 1].map((i) => R(x0 + i * (cw2 + 16), y0 + gp + 14, cw2, bh)),
      text: [0, 1].map((i) => R(x0 + i * (cw2 + 16), y0 + 2 * gp + 14, cw2, bh)),
      back: R(x0 + (aw - Math.min(aw, 380)) / 2, y0 + 3 * gp + 12, Math.min(aw, 380), 72), msg: { x: x0 + aw / 2, y: y0 + 3 * gp + 118, w: aw - 10 }, wins: { x: x0 + aw / 2, y: y0 + 3 * gp + 146 },
    };
  };
  const tag = (hero) => hero && { ...hero, pieces: true, title: 'Board and pieces' };
  if (!L.wide) {
    const y0 = h - Math.max(20, L.ins.b + 6) - colH, top = Math.max(10, L.ins.t + 6);
    return { hero: tag(heroIn(R(U.x0, top, U.w, y0 - 40 - top), 0.34)), board: null, dim: null, ...stack(U.x0 + 40, U.w - 80, y0) };
  }
  const aw = clamp(w * 0.5, 440, 720), ax = U.x1 - aw - 16, leftW = ax - U.x0 - 8, y0 = U.y0 + (U.h - colH) / 2 + 14;
  return { hero: tag(heroIn(R(U.x0 + 4, U.y0 + 8, leftW - 8, U.h - 16), 0.3)), board: null, dim: null, card: R(ax, y0 - 30, aw, colH + 34), ...stack(ax + 20, aw - 40, y0) };
}

// Result screen: the heading block is drawn in canonical (phone) coordinates (centre x 360, y 290..900) and translated to where it
// belongs; the buttons are a column of n rects.
function buildOver(L) {
  const { w, h, U } = L;
  const col = (n, x, aw, y0, bh, gap) => Array.from({ length: n }, (_, i) => R(x + (aw - Math.min(aw, 440)) / 2, y0 + i * (bh + gap), Math.min(aw, 440), bh));
  if (L.tall) return { sc: 1, tx: 0, ty: L.oy, cx: w / 2, board: true, rects: (n) => col(n, 0, w, 900 + L.oy, 96, 20), more: (n) => ({ x: w / 2, y: 900 + L.oy + n * 116 + 34 }) };
  if (!L.wide) {
    const top = Math.max(10, L.ins.t + 6), bottom = h - Math.max(16, L.ins.b + 8), bh = 80, gap = 14, btnsH = 3 * (bh + gap) + 40;
    const sc = clamp((bottom - top - btnsH) / 620, 0.4, 1);
    return {
      sc, tx: w / 2 - 360 * sc, ty: top - 290 * sc + 6, cx: w / 2, board: false,
      rects: (n) => col(n, U.x0, U.w, bottom - 40 - n * (bh + gap) + gap, bh, gap), more: () => ({ x: w / 2, y: bottom - 8 }),
    };
  }
  const aw = clamp(w * 0.5, 440, 720), ax = U.x1 - aw - 16, leftW = ax - U.x0 - 8, lcx = U.x0 + leftW / 2;
  const sc = clamp(Math.min((leftW - 24) / 640, (U.h - 60) / 640), 0.45, 1), bh = 84, gap = 14;
  return {
    sc, tx: lcx - 360 * sc, ty: h / 2 - 600 * sc, cx: lcx, board: false, card: R(ax, h / 2 - 200, aw, 400),
    rects: (n) => col(n, ax + 20, aw - 40, h / 2 - (n * (bh + gap) - gap) / 2 - 12, bh, gap),
    more: (n) => ({ x: ax + aw / 2, y: h / 2 + (n * (bh + gap) - gap) / 2 + 30 }),
  };
}

// The campaign map: twelve tiles in the grid (3, 4 or 6 columns) that gives the biggest tiles.
function buildCamp(L) {
  const { w, U } = L, top = L.wide ? Math.max(U.y0 + 8, L.backBox.y + 4) : Math.max(10, L.ins.t + 6);
  const hdr = L.wide ? { title: { x: w / 2, y: top + 44, size: 40 }, sub: { x: w / 2, y: top + 78, size: 22 }, total: { x: w / 2, y: top + 108, size: 24 }, bottom: top + 126 }
    : { title: { x: w / 2, y: top + 62, size: 46 }, sub: { x: w / 2, y: top + 102, size: 24 }, total: { x: w / 2, y: top + 140, size: 26 }, bottom: top + 158 };
  const menu = L.wide ? R(w / 2 - 130, U.y1 - 78, 260, 64) : L.BTN.menu;
  const areaY = hdr.bottom + 6, areaH = menu.y - 40 - areaY, areaW = U.w - 48;
  let best = null;
  for (const cols of [3, 4, 6]) {
    const rows = 12 / cols, gap = 12, tw = Math.min(230, (areaW - (cols - 1) * gap) / cols, (areaH - (rows - 1) * gap) / rows / 1.04);
    if (!best || tw > best.tw) best = { cols, rows, tw, gap };
  }
  const { cols, rows, tw, gap } = best, th = tw * 1.04, gw = cols * tw + (cols - 1) * gap, gx = U.x0 + (U.w - gw) / 2, gy = areaY + Math.max(0, (areaH - (rows * th + (rows - 1) * gap)) / 2);
  return { hdr, menu, msg: { x: w / 2, y: menu.y - 14, w: Math.min(U.w - 40, 760) }, k: tw / 200, tile: (i) => R(gx + (i % cols) * (tw + gap), gy + Math.floor(i / cols) * (th + gap), tw, th) };
}

// Rules reference: one framed panel (header with the text-size stepper, a scrolling body, page counter) and Back / Next.
function buildRules(L) {
  const { h, U, ins } = L, barY = L.wide ? h - 98 - Math.max(0, ins.b - 16) : L.barY, barH = 72;
  const bm = L.wide && L.backBox.w ? Math.max(24, L.backBox.x + L.backBox.w + 10 - U.x0) : 24;     // landscape: keep the panel clear of the back button
  const pw = Math.min(U.w - 2 * bm, 980), px = U.x0 + (U.w - pw) / 2, py = Math.max(20, ins.t + 6);
  const panel = R(px, py, pw, barY - 14 - py);
  const nw = Math.min(262, (pw - 16) / 2), navX = U.x0 + (U.w - (2 * nw + 16)) / 2;
  const vy = L.wide ? panel.y + 92 : Math.max(panel.y + 92, L.backBox.y + L.backBox.h + 2);   // portrait: the body starts below the back button
  const viewport = R(panel.x + 20, vy, panel.w - 40 - 14, panel.y + panel.h - 52 - vy);
  const bw = Math.min(120, (pw - 300) / 2);
  return {
    panel, viewport, nav: { back: R(navX, barY, nw, barH), next: R(navX + nw + 16, barY, nw, barH) },
    header: { textDec: R(panel.x + panel.w - 24 - bw - 12 - bw, panel.y + 12, bw, 62), textInc: R(panel.x + panel.w - 24 - bw, panel.y + 12, bw, 62) },
    scrollbar: R(panel.x + panel.w - 30, viewport.y, 22, viewport.h), counterY: panel.y + panel.h - 22, cx: panel.x + panel.w / 2, titleY: panel.y + 56,
  };
}

// The buttons on the result screen (ids and labels; the rects come from layout.over.rects). A campaign level offers the next level
// after a win; every result offers a retry and the menu.
export function overButtons(camp, won, hasNext) {
  if (camp >= 0) {
    const out = [];
    if (won && hasNext) out.push({ id: 'next', label: 'Next level', primary: true });
    out.push({ id: 'again', label: 'Try again', primary: !(won && hasNext) });
    out.push({ id: 'levels', label: 'Levels' });
    return out;
  }
  return [{ id: 'again', label: 'Play again', primary: true }, { id: 'menu', label: 'Menu' }];
}

// ---- test/back-compat exports: the approved phone-portrait layout (720 x 1560) ------------------------------------------------
const PHONE = layoutFor(720, 1560);
export const pointAt = PHONE.pointAt;
export const titleRows = (hasSave) => PHONE.title(hasSave).rows;
export const BTN = PHONE.BTN, AUTOPLAY = PHONE.BTN.auto, RULES_NAV = PHONE.rules.nav, RULES_HEADER = PHONE.rules.header;
export const LOOK = { boards: PHONE.look.woods, sets: PHONE.look.sets, text: PHONE.look.text, back: PHONE.look.back };
export const TILE = PHONE.camp.tile;
