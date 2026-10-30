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
// The 3D presenter (web/view3d) fills these in when a WebGL scene is on screen: `pick` maps a tap to a board point through the tilted
// camera, `pt` projects a point back to the screen. Off (no WebGL, tests, ?flat=1): the flat board's own geometry is used.
export const v3 = { on: false, fade: 1, pick: null, pt: null, penLabel: null };
export const boardPick = (B, x, y) => (v3.on && v3.pick ? v3.pick(x, y) : B.pointNear(x, y));
export const boardPt = (B, i) => (v3.on && v3.pt ? v3.pt(i) : B.pointAt(i));

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
  // the 3D stage: the board and both herds, leaving a band at the top and bottom for the herd name plaques
  const stage = R(Math.max(0, (w - 700) / 2), penTop + 44, Math.min(w, 700), pens.bottom.rect.y + V.ph - 44 - (penTop + 44));
  const S = { kind, mode: L.mode, board, pens, title: V.title, titleY: 92 + hdrDy + shift + (ins.t > 0 ? 27 : 0),   // below the kit's preview badge
    bs, card: null, barY, stage };
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
  S.stage = R(left.x + left.w + 6, U.y0 + 44, right.x - 6 - (left.x + left.w + 6), U.h - 50);
  S.btnCard = R(right.x, y - 14, right.w, 3 * bh + 20 + 28);
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
const LOCK_AR = 327 / 1200;
function lockRect(cx, y, maxW) { const lw = Math.min(260, maxW), lh = lw * LOCK_AR; return R(cx - lw / 2, y, lw, lh); }
// Tap zone of the title lockup: >= 44 css px each way, extended sideways and downward only (never into the buttons above).
export function lockHit(L, T) {
  const r = T.lock; if (!r) return null; const m = 44 / Math.max(0.05, host.px);
  const w = Math.max(r.w, m), x = r.x + r.w / 2 - w / 2, y = r.y - 2;
  return R(x, y, w, Math.max(r.h + 2, Math.min(m, L.h - y)));
}

// The menu: the title lettering on top, the live 3D scene (hero) in the middle, ONE dominant Play button, a grid of icon buttons,
// a one-line record, the Arcforge lockup. Settings (computer level, sound, warnings, motion, text) live in a sheet over the menu.
// rows.dark is the Play button (or, with a saved game, the slim "New game" under Continue = rows.resume).
export const GRID = ['learn', 'light', 'two', 'daily', 'auto', 'settings', 'howto', 'rules', 'about'];
function buildSheet(L) {
  const { U } = L, pw = Math.min(U.w - 40, 600), rh = 74, gap = 12, ph = 92 + 5 * (rh + gap) + 8 + 84;
  const px = U.x0 + (U.w - pw) / 2, py = U.y0 + Math.max(8, (U.h - ph) / 2), sheet = { panel: R(px, py, pw, ph) };
  ['level', 'sound', 'marks', 'calm', 'big'].forEach((id, i) => { sheet[id] = R(px + 24, py + 92 + i * (rh + gap), pw - 48, rh); });
  sheet.close = R(px + pw / 2 - 150, py + ph - 84 - 8, 300, 80);
  return sheet;
}
function buildTitle(L, hasSave) {
  const { w, h, U, ins } = L, T = { rows: {}, mode: L.mode, sheet: buildSheet(L) };
  const grid = (x0, aw, y0, cols, gh, gap = 12) => GRID.forEach((id, i) => {
    const r = Math.floor(i / cols), c = i % cols, inRow = Math.min(cols, GRID.length - r * cols), cw = (aw - gap * (cols - 1)) / cols;
    const off = (aw - (inRow * cw + (inRow - 1) * gap)) / 2;
    T.rows[id] = R(x0 + off + c * (cw + gap), y0 + r * (gh + gap), cw, gh);
  });
  if (!L.wide) {
    const topPad = Math.max(ins.t, 0), lk = lockRect(w / 2, 0, 280), lockY = h - Math.max(10, ins.b) - lk.h - 6;
    T.lock = { ...lk, y: lockY };
    const aw = Math.min(U.w - 48, 640), x0 = (w - aw) / 2, cols = h < 1150 ? 5 : 3, rowsN = Math.ceil(GRID.length / cols), gh = h < 1150 ? 84 : 96;
    T.stats = R(x0, lockY - 50, aw, 40);
    const gridH = rowsN * gh + (rowsN - 1) * 12, gy = T.stats.y - 10 - gridH;
    grid(x0, aw, gy, cols, gh);
    let y = gy - 16;
    if (hasSave) { T.rows.dark = R(x0 + aw * 0.2, y - 58, aw * 0.6, 58); y -= 58 + 10; }
    const play = R(x0, y - 112, aw, 112); y = play.y;
    if (hasSave) T.rows.resume = play; else T.rows.dark = play;
    T.play = play;
    T.titleText = { x: w / 2, y: topPad + Math.max(96, ins.back ? 112 : 96), size: 92 };
    const heroTop = T.titleText.y + 98;
    T.heroRect = R(U.x0 + 8, heroTop, U.w - 16, Math.max(160, y - 18 - heroTop));
    T.msg = R(x0, T.heroRect.y + T.heroRect.h - 52, aw, 46);
    return T;
  }
  // landscape: title + live scene on the left, a card with Play and the grid on the right
  const aw = clamp(w * 0.4, 440, 620), ax = U.x1 - aw - 14, lk = lockRect(0, 0, 260);
  const avail = U.h - 24 - lk.h - 10, fixed = 18 + 100 + 14 + (hasSave ? 64 : 0) + 10 + 40 + 16, gh = clamp((avail - fixed - 24) / 3, 64, 96);
  const cardH = fixed + gh * 3 + 24, cardY = U.y0 + Math.max(8, (U.h - cardH - lk.h - 10) / 2);
  T.card = R(ax, cardY, aw, cardH);
  let y = cardY + 18;
  const play = R(ax + 20, y, aw - 40, 100); y += 100 + 14;
  if (hasSave) { T.rows.resume = play; T.rows.dark = R(ax + aw * 0.22, y, aw * 0.56, 54); y += 64; } else T.rows.dark = play;
  T.play = play;
  grid(ax + 20, aw - 40, y, 3, gh); y += gh * 3 + 24 + 10;
  T.stats = R(ax + 20, y, aw - 40, 40);
  T.lock = lockRect(ax + aw / 2, cardY + cardH + 8, aw - 40);
  const lx0 = U.x0 + 12, lw = ax - 16 - lx0;
  T.titleText = { x: lx0 + lw / 2, y: U.y0 + 92, size: clamp(lw / 6.2, 60, 92) };
  T.heroRect = R(lx0, U.y0 + 168, lw, U.h - 168 - 12);
  T.msg = R(lx0 + 16, U.y1 - 62, lw - 32, 44);
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
  const T = L.title(false), hr = T.heroRect, cx = hr.x + hr.w / 2, y = clamp(hr.y + hr.h * 0.62, hr.y + 60, L.h - 260);
  return { cx, y, menu: R(cx - 120, y + 130, 240, 72) };
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
export const sheetRows = () => PHONE.title(false).sheet;
export const BTN = { ...PHONE.scene('play').BTN, again: PHONE.over.again, back: PHONE.over.back };
export const TEXT_STEPPER = { dec: PHONE.info.header.textDec, inc: PHONE.info.header.textInc };
export const infoFooterRects = (hasBack, hasNext) => PHONE.info.footer(hasBack, hasNext);
export const AUTO = PHONE.scene('auto').BTN.auto;
export const THINK = PHONE.scene('auto').think;
