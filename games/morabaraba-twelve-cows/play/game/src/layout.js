// Geometry, as a function of the LIVE screen size (kit 1.7 fluid viewport: the SHORT side is always 720 units, the long side grows).
// `layoutFor(w, h)` returns every position for that size (cached by size + safe insets), so a frame never recomputes it.
//   stack   portrait (and squarish) screens: header, opponent's pen, the board, own pen, message, button bar - top to bottom.
//           Tall phones keep the approved look (title on the sky, board at full size); shorter screens drop the title / slim the
//           pens first and only then shrink the board.
//   wide    landscape: a card on the left (status, message), the board in the middle, a card on the right (pens, buttons).
// The board is a plane seen from a little above: board coordinates (u, v) in -3..3 (outer square +-3, middle +-2, inner +-1; v = -3 is
// the far side). A true projective map, so straight lines stay straight. It is painted once in canonical coordinates (art.js) and drawn
// scaled by `board.s`.
import { POINT_UV } from './morabaraba.js';

export const W = 720, H = 1560;              // the approved phone screen (canonical coordinates of the art)
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const AUTO_THINK_STEPS = [2, 5, 8, 10];
export const AUTO_REVEAL_SECONDS = 2;
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// Safe areas and the host's floating back button, in virtual units. main.js keeps this current (browsers: all zero).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };   // px: css pixels per virtual unit (text never shrinks below ~11 css px)

const CX = 360, D = 93, K = 0.032, HGT = 3200, Y_NEAR = 1070, Y_H = Y_NEAR - HGT;
export function project(u, v) { const z = 1 + K * (3 - v); return { x: CX + (u * D) / z, y: Y_H + HGT / z, s: 1 / z }; }
export const COW_R = 35;                      // half the width of a cow token at the near edge (canonical)
// The canonical board: the painted layer rectangle, and the part that matters for fitting (frame + standing cows).
export const BOARD_LAYER = { x: -20, y: 470, w: 760, h: 740 };
const BB = { top: 484, bottom: 1150, w: 700 };   // board bounding box in canonical coordinates
const BH = BB.bottom - BB.top;                    // 666

const R = (x, y, w, h) => ({ x, y, w, h });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const none = R(0, 0, 0, 0);

const cache = new Map();
export function layoutFor(w, h) {
  w = Math.round(w); h = Math.round(h);
  const key = `${w}x${h}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}`;
  let L = cache.get(key);
  if (!L) { L = build(w, h, { ...host }); L.key = key; cache.set(key, L); if (cache.size > 40) cache.delete(cache.keys().next().value); }
  return L;
}

function build(w, h, ins) {
  const L = { w, h, ins };
  const U = L.U = { x0: ins.l, y0: ins.t, x1: w - ins.r, y1: h - ins.b }; U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  const backSz = ins.back ? Math.max(ins.back, 56) : 0;
  L.backBox = ins.back ? R(ins.l, ins.t, backSz + 8, backSz + 8) : none;
  L.land = w > h; L.wide = w >= h || h < 800;     // squarish and landscape screens (and any screen too short to stack) use the side cards
  L.ox = (w - 720) / 2;                                   // portrait-shaped screens: the 720-wide column, centred
  L.mode = L.wide ? 'wide' : h >= 1500 ? 'tall' : 'compact';
  L.bottomPad = Math.max(22, ins.b + 8);
  L.barY = h - L.bottomPad - 76;
  const scenes = {};
  L.scene = (kind) => (scenes[kind] ??= L.wide ? wideScene(L, kind) : stackScene(L, kind));
  const tc = {};
  L.title = (hasSave) => (tc[hasSave ? 1 : 0] ??= buildTitle(L, !!hasSave));
  L.over = buildOver(L);
  L.info = buildInfo(L);
  L.misc = buildMisc(L);
  return L;
}

// ---- the board in screen space -------------------------------------------------------------------------------------------
// (bx, by) is where the canonical near-centre point (CX, Y_NEAR) lands; bs the uniform scale.
function boardAt(bs, bx, by) {
  const pts = POINT_UV.map(([u, v]) => { const p = project(u, v); return { x: bx + (p.x - CX) * bs, y: by + (p.y - Y_NEAR) * bs, s: p.s * bs }; });
  const near = (x, y) => {
    let best = -1, bd = Infinity;
    for (let i = 0; i < 24; i++) { const p = pts[i], d = Math.min(Math.hypot(p.x - x, p.y - y), Math.hypot(p.x - x, p.y - 22 * p.s - y)); if (d < bd) { bd = d; best = i; } }
    return bd < Math.max(40, 58 * bs) ? best : -1;
  };
  return { s: bs, tx: bx - CX * bs, ty: by - Y_NEAR * bs, pts, pointAt: (i) => pts[i], pointNear: near };
}

// A pen of 12 cow slots: one line (portrait) or a grid inside a side card (landscape).
function rowPen(x, y, w, ph) {
  const r = Math.min(18, ph * 0.27), sp = Math.min(44, (w - 160) / 11), x0 = x + 30 + r * 0.4;
  return { rect: R(x, y, w, ph), r, kind: 'row', slot: (i) => ({ x: x0 + i * sp, y: y + ph * 0.62 }), label: { x: x + w - 16, y: y + ph * 0.62 + 7, align: 'right', size: 20 }, band: ph >= 70 };
}
function gridPen(x, y, w, sp, rows, cols) {
  const r = Math.min(18, sp * 0.4), ph = 38 + rows * sp + 6, x0 = x + (w - (cols - 1) * sp) / 2;
  return { rect: R(x, y, w, ph), r, kind: 'grid', slot: (i) => ({ x: x0 + (i % cols) * sp, y: y + 38 + sp * 0.5 + Math.floor(i / cols) * sp - 2 }), label: { x: x + 14, y: y + 27, align: 'left', size: 20 }, band: false };
}

// ---- portrait / squarish: one column ------------------------------------------------------------------------------------
const HDR = { play: 124, auto: 152, lesson: 196, puzzle: 150 };
function stackScene(L, kind) {
  const { w, h, ins, ox } = L, top = Math.max(ins.t, 34), hdrDy = Math.max(0, ins.t - 30), pad = L.bottomPad;
  const msgMin = 96, msgMax = 176;
  const variants = [
    { title: true, penTop: 356 + hdrDy, ph: 84, gA: 44, gB: 10, gC: 18, bar: 76, gD: 24 },
    { title: false, penTop: top + 8 + HDR[kind] + 10, ph: 84, gA: 44, gB: 10, gC: 14, bar: 76, gD: 16 },
    { title: false, penTop: top + 8 + HDR[kind] + 8, ph: 64, gA: 36, gB: 8, gC: 10, bar: 72, gD: 12 },
    { title: false, penTop: top + 8 + HDR[kind] + 6, ph: 54, gA: 30, gB: 6, gC: 8, bar: 70, gD: 10 },
  ];
  const fitS = (v) => (h - (v.penTop + v.ph + v.gA + v.gB + v.ph + v.gC + v.gD + v.bar + pad) - msgMin) / BH;
  const V = variants.find((v) => fitS(v) >= 0.92) || variants[variants.length - 1];
  const sMax = Math.min(1, (w - 16) / BB.w);
  const bs = clamp(Math.min(sMax, fitS(V)), 0.4, 1);
  const fixed = V.penTop + V.ph + V.gA + V.gB + V.ph + V.gC + V.gD + V.bar + pad;
  let spare = Math.max(0, h - fixed - msgMin - BH * bs);
  const grow = Math.min(spare, msgMax - msgMin), msgH = msgMin + grow; spare -= grow;
  const shift = V.title ? spare * 0.5 : Math.min(spare * 0.5, 40);       // leftover room: centre the stack a little
  const penTop = V.penTop + shift, barY = h - pad - V.bar;
  const penW = Math.min(648, w - 24), px = (w - penW) / 2;
  const pens = { top: rowPen(px, penTop, penW, V.ph) };
  const boardTop = penTop + V.ph + V.gA * bs;
  const board = boardAt(bs, w / 2, boardTop + (Y_NEAR - BB.top) * bs);
  pens.bottom = rowPen(px, boardTop + BH * bs + V.gB, penW, V.ph);
  const msgY = pens.bottom.rect.y + V.ph + V.gC;
  const S = { kind, mode: L.mode, board, pens, title: V.title, titleY: 92 + hdrDy + shift + (ins.t > 0 ? 27 : 0),   // below the kit's preview badge
    bs, card: null, barY };
  S.hdr = V.title ? R(ox, 150 + hdrDy + shift, 720, 200) : R(ox, top + 8, 720, HDR[kind]);
  S.msg = R(px, msgY, penW, Math.max(msgH, Math.min(msgMax, barY - V.gD - msgY)));
  const bw = (penW - 4 - 28) / 3, bx0 = px + 2, bh = V.bar;
  const b3 = (i) => R(bx0 + i * (bw + 14), barY, bw, bh);
  S.BTN = { menu: b3(0), undo: b3(1), hint: b3(2), next: R(b3(1).x, barY, bw * 2 + 14, bh), share: R(b3(1).x, barY, bw * 2 + 14, bh), auto: { exit: b3(0), pause: b3(1), skip: b3(2) } };
  // Auto Play's think-time stepper lives in the message slot (the message never shows in Auto Play)
  const m = S.msg, tb = 56, ty = m.y + (m.h - tb) / 2;
  S.think = { dec: R(m.x + 10, ty, 110, tb), inc: R(m.x + m.w - 120, ty, 110, tb), label: { x: m.x + m.w / 2, y: ty + tb / 2 } };
  return S;
}

// ---- landscape: card | board | card -------------------------------------------------------------------------------------
function wideScene(L, kind) {
  const { w, ins, U } = L, g = 12, Lmin = w < 900 ? 200 : 250, Rmin = w < 900 ? 184 : 215;
  const sH = (U.h - 24) / BH, sW = (U.w - Lmin - Rmin - 4 * g) / BB.w;
  const bs = clamp(Math.min(1.12, sH, sW), 0.45, 1.12);
  const bw = BB.w * bs, extra = Math.max(0, U.w - bw - 4 * g - Lmin - Rmin);
  const Lw = Math.min(Lmin + extra * 0.5, 400), Rw = Math.min(Rmin + extra * 0.5, 340);
  const cx = (U.x0 + Lw + g + U.x1 - Rw - g) / 2, boardTop = U.y0 + (U.h - BH * bs) / 2;
  const board = boardAt(bs, cx, boardTop + (Y_NEAR - BB.top) * bs);
  const cardTop = ins.back ? Math.max(U.y0 + 10, L.backBox.y + L.backBox.h + 4) : U.y0 + 10;
  const left = R(U.x0 + 8, cardTop, Lw - 8, U.y1 - 10 - cardTop);
  const right = R(U.x1 - Rw, U.y0 + 10, Rw - 8, U.h - 20);
  const S = { kind, mode: 'wide', board, bs, card: { left, right }, title: false };
  // right card: opponent's pen, own pen, then the buttons
  const pw = right.w - 20, px = right.x + 10;
  const cols = clamp(Math.floor((pw - 12) / 46), 3, 12), rows = Math.ceil(12 / cols);
  let sp = Math.min(48, (pw - 12) / cols);
  const nb = 3, bh0 = 74, gap = 12;
  const need = (spx) => 2 * (38 + rows * spx + 6) + gap * 3 + nb * bh0 + (nb - 1) * 10 + 20;
  while (need(sp) > right.h && sp > 34) sp -= 2;
  let bh = bh0; if (need(sp) > right.h) bh = Math.max(56, bh0 - (need(sp) - right.h) / nb);
  const pens = {}; let y = right.y + 10;
  pens.top = gridPen(px, y, pw, sp, rows, cols); y += pens.top.rect.h + gap;
  pens.bottom = gridPen(px, y, pw, sp, rows, cols); y += pens.bottom.rect.h + gap + 6;
  S.pens = pens;
  const bwid = Math.min(pw, 300), bx = right.x + (right.w - bwid) / 2, sl = (i) => R(bx, y + i * (bh + 10), bwid, bh);
  S.BTN = { menu: sl(0), undo: sl(1), hint: sl(2), next: sl(1), share: sl(1), auto: { exit: sl(0), pause: sl(1), skip: sl(2) } };
  // left card: header block on top, message (or Auto Play's think stepper) at the bottom
  const msgH = kind === 'lesson' ? 150 : kind === 'puzzle' ? 130 : 160;
  S.hdr = R(left.x + 6, left.y + 8, left.w - 12, left.h - msgH - 16);
  S.msg = R(left.x + 8, left.y + left.h - msgH - 4, left.w - 16, msgH);
  const m = S.msg, tb = 52, bwT = Math.min(96, (m.w - 24) / 3);
  S.think = { dec: R(m.x + 6, m.y + m.h - tb - 8, bwT, tb), inc: R(m.x + m.w - 6 - bwT, m.y + m.h - tb - 8, bwT, tb), label: { x: m.x + m.w / 2, y: m.y + m.h - tb / 2 - 8 } };
  S.barY = U.y1 - 90;
  return S;
}

// ---- title -----------------------------------------------------------------------------------------------------------------
// Title art ("hero") is drawn in canonical coordinates through translate(hx, hy) + scale(sc): title y 90-240, cows and a little board ~450-650.
const HERO_H = 560, HERO_TOP = 90;
const LOCK_AR = 327 / 1200;
function lockRect(cx, y, maxW) { const lw = Math.min(260, maxW), lh = lw * LOCK_AR; return R(cx - lw / 2, y, lw, lh); }
// Tap zone of the title lockup: >= 44 css px each way, extended sideways and downward only (never into the buttons above).
export function lockHit(L, T) {
  const r = T.lock; if (!r) return null; const m = 44 / Math.max(0.05, host.px);
  const w = Math.max(r.w, m), x = r.x + r.w / 2 - w / 2, y = r.y - 2;
  return R(x, y, w, Math.max(r.h + 2, Math.min(m, L.h - y)));
}

function buildTitle(L, hasSave) {
  const { w, h, U, ins, ox } = L, T = { hero: null, rows: {}, stats: null, msg: null, card: null, mode: L.mode };
  if (L.mode === 'tall') {
    // the approved single column; rows squeeze a little only when the home indicator / a saved game need the room
    const list = (hasSave ? ['resume'] : []).concat(['learn', 'pair-dl', 'two', 'daily']);
    const hy = Math.max(0, ins.t - 50), base = 740 + hy;
    const need = list.reduce((a, id) => a + (id === 'pair-dl' ? 68 : 76), 0) + 6 + 68 * 4 + 100;
    const lk = lockRect(w / 2, 0, 300), lockY = h - Math.max(10, ins.b) - lk.h - 6, avail = lockY - 8 - base, f = Math.min(1, avail / need), P = (n) => n * f;
    T.lock = { ...lk, y: lockY };
    let y = base;
    for (const id of list) {
      if (id === 'pair-dl') { T.rows.dark = R(ox + 80, y, 272, P(60)); T.rows.light = R(ox + 368, y, 272, P(60)); y += P(68); }
      else { T.rows[id] = R(ox + 80, y, 560, P(66)); y += P(76); }
    }
    y += P(6);
    const pair = (a, b) => { T.rows[a] = R(ox + 80, y, 272, P(60)); T.rows[b] = R(ox + 368, y, 272, P(60)); y += P(68); };
    pair('level', 'sound'); pair('marks', 'calm'); pair('big', 'howto');
    const gap = 14, cw = (560 - gap * 2) / 3;
    T.rows.about = R(ox + 80, y, cw, P(60)); T.rows.rules = R(ox + 80 + cw + gap, y, cw, P(60)); T.rows.auto = R(ox + 80 + 2 * (cw + gap), y, cw, P(60)); y += P(68);
    T.stats = R(ox + 80, y + P(14), 560, 80);
    T.hero = { sc: 1, hx: ox, hy };
    T.msg = R(ox + 60, 640 + hy, 600, 46);
    return T;
  }
  // compact + wide: a two-column grid of buttons
  const rowsDef = (hasSave ? [['resume']] : []).concat([['learn'], ['dark', 'light'], ['two', 'daily'], ['level', 'sound'], ['marks', 'calm'], ['big', 'howto'], ['about', 'rules', 'auto']]);
  const place = (x0, aw, y0, pitch, bh) => rowsDef.forEach((row, i) => {
    const y = y0 + i * pitch, gp = 12, cw = (aw - gp * (row.length - 1)) / row.length;
    row.forEach((id, k) => { T.rows[id] = R(x0 + k * (cw + gp), y, cw, bh); });
  });
  const n = rowsDef.length;
  if (L.mode === 'compact') {
    const lk = lockRect(w / 2, 0, 300), pad = Math.max(16, ins.b + 8) + lk.h + 6, topPad = Math.max(10, ins.t + 6), aw = Math.min(U.w - 48, 640), x0 = (w - aw) / 2;
    let pitch = 68;
    for (; pitch > 50; pitch -= 2) { const zone = h - pad - 76 - n * pitch - 60 - topPad; if (zone / HERO_H >= 0.78) break; }
    const bh = pitch - 10, rowsH = n * pitch, y0 = h - pad - 76 - rowsH;
    place(x0, aw, y0, pitch, bh);
    T.stats = R(x0, y0 + rowsH + 2, aw, 72); T.lock = { ...lk, y: h - Math.max(10, ins.b) - lk.h - 4 };
    const zone = y0 - 56 - topPad, sc = clamp(zone / HERO_H, 0.35, 1);
    T.hero = { sc, hx: w / 2 - 360 * sc, hy: topPad + (zone - HERO_H * sc) / 2 - HERO_TOP * sc };
    T.msg = R(x0, y0 - 52, aw, 44);
    return T;
  }
  // wide: art on the left, a card of buttons on the right
  const aw = clamp(w * 0.46, 500, 700), ax = U.x1 - aw - 16, lk = lockRect(0, 0, 300), rowsAvail = U.h - 24 - 84 - lk.h - 10;
  const pitch = Math.min(72, rowsAvail / n), bh = pitch - 10, rowsH = n * pitch, cardH = rowsH + 84 + 24;
  const cardY = U.y0 + (U.h - cardH - lk.h - 10) / 2, y0 = cardY + 16;
  place(ax + 20, aw - 40, y0, pitch, bh);
  T.stats = R(ax + 20, y0 + rowsH + 2, aw - 40, 72);
  T.card = R(ax, cardY, aw, cardH); T.lock = lockRect(ax + aw / 2, cardY + cardH + 8, aw - 40);
  const leftW = ax - U.x0 - 8, lcx = U.x0 + leftW / 2;
  const sc = clamp(Math.min((leftW - 30) / 540, (U.h - 130) / HERO_H), 0.3, 1.2);
  T.hero = { sc, hx: lcx - 360 * sc, hy: U.y0 + (U.h - HERO_H * sc) / 2 - HERO_TOP * sc - 10 };
  T.msg = R(U.x0 + 16, U.y1 - 62, leftW - 16, 44);
  return T;
}

// ---- result screen --------------------------------------------------------------------------------------------------------
// The heading block (cow, verdict, counts) is drawn in canonical coordinates y 470-880 through translate(tx, ty) + scale(sc).
function buildOver(L) {
  const { w, h, U, ins } = L;
  if (!L.wide) {
    const sc = clamp((h - ins.t - ins.b - 40) / 720, 0.55, 1), ty = h / 2 - 785 * sc;
    const r = (x, y, bw, bh) => R(w / 2 + (x - 360) * sc, ty + y * sc, bw * sc, bh * sc);
    return { sc, tx: w / 2 - 360 * sc, ty, lcx: w / 2, again: r(140, 900, 440, 96), back: r(140, 1016, 440, 84), more: { x: w / 2, y: ty + 1150 * sc }, card: null };
  }
  const half = U.w / 2, lcx = U.x0 + half * 0.5, rcx = U.x0 + half * 1.5;
  const sc = clamp((h - 48) / 430, 0.5, 1), bw = Math.min(440, half - 60), by = h / 2 - 120;
  return {
    sc, tx: lcx - 360 * sc, ty: h / 2 - 669 * sc, lcx, again: R(rcx - bw / 2, by, bw, 90), back: R(rcx - bw / 2, by + 104, bw, 80),
    more: { x: rcx, y: by + 240 }, card: R(rcx - bw / 2 - 30, by - 40, bw + 60, 330),
  };
}

// ---- misc full screens (preparing the puzzle, demo limit) -----------------------------------------------------------------
function buildMisc(L) {
  const { w, h, U } = L;
  if (!L.wide) {
    const hero = L.title(false).hero, y = Math.min(Math.max(hero.hy + 700 * hero.sc, h * 0.55), h - 260);
    return { cx: w / 2, y, menu: R(w / 2 - 120, y + 130, 240, 72) };
  }
  const aw = clamp(w * 0.46, 500, 700), cx = U.x1 - aw / 2 - 16;
  return { cx, y: h / 2 - 30, menu: R(cx - 120, h / 2 + 90, 240, 72) };
}

// ---- Rules / About / How to play -------------------------------------------------------------------------------------------
function buildInfo(L) {
  const { U, ins } = L, barH = 76, barY = L.barY;
  const pw = Math.min(U.w - 30, 720), px = U.x0 + (U.w - pw) / 2, py = Math.max(10, ins.t + 6);
  const panel = R(px, py, pw, barY - 14 - py);
  const sw = 96, stepY = panel.y + 12, headX0 = ins.back ? Math.max(panel.x + 16, L.backBox.x + L.backBox.w + 8) : panel.x + 16;
  const textDec = R(panel.x + panel.w - 16 - sw * 2 - 10, stepY, sw, 58), textInc = R(panel.x + panel.w - 16 - sw, stepY, sw, 58);
  const headCx = (headX0 + textDec.x - 8) / 2;
  const viewport = R(panel.x + 16, panel.y + 92, panel.w - 32 - 16, panel.h - 92 - 44);
  const span = Math.min(U.w - 24, 628), x0 = U.x0 + (U.w - span) / 2, gap = 14;
  const footer = (hasBack, hasNext) => {
    const n = 1 + (hasBack ? 1 : 0) + (hasNext ? 1 : 0), bw = (span - gap * (n - 1)) / n; let x = x0;
    const nx = () => { const r = R(x, barY, bw, barH); x += bw + gap; return r; };
    return { menu: nx(), back: hasBack ? nx() : null, next: hasNext ? nx() : null };
  };
  return { panel, viewport, headCx, headW: textDec.x - 8 - headX0, header: { textDec, textInc }, scrollbar: R(panel.x + panel.w - 30, viewport.y, 22, viewport.h), counterY: panel.y + panel.h - 16, footer, bandY: panel.y + 76 };
}

// ---- back-compat exports for the tests: the approved phone portrait layout (720 x 1560) ---------------------------------------
const PHONE = layoutFor(720, 1560);
export const pointAt = (i) => PHONE.scene('play').board.pointAt(i);
export const titleRows = (hasSave) => PHONE.title(hasSave).rows;
export const BTN = { ...PHONE.scene('play').BTN, again: PHONE.over.again, back: PHONE.over.back };
export const TEXT_STEPPER = { dec: PHONE.info.header.textDec, inc: PHONE.info.header.textInc };
export const infoFooterRects = (hasBack, hasNext) => PHONE.info.footer(hasBack, hasNext);
export const AUTO = PHONE.scene('auto').BTN.auto;
export const THINK = PHONE.scene('auto').think;
