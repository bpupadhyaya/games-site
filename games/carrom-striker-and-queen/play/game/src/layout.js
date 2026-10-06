// Screen geometry, as a function of the LIVE screen size (kit 1.7 fluid viewport: the short side is always 720 units, the long
// side follows the screen). `layoutFor(w, h, left)` returns every rectangle for that size; it is cached by size, insets and the
// left-handed flag, so a frame never recomputes it.
//
// The board is a square drawn in its own CANONICAL space (the playing surface is PLAY units wide, the frame FRAME units thick,
// centred on CX, CY). A board scene draws it through one transform (scale f, centre cx, cy), and pointer positions are mapped
// back with `toBoard`, so the physics, the art and the aiming code never see the screen size.
//
// Shapes:
//   tall     portrait phone (h >= 1500): header (players, message), board, power meter, tip, three buttons.
//   compact  portrait but shorter (tablets, small phones): the same stack, tighter, the board scaled to what is left.
//   wide     landscape: the board as large as the height allows, a card of players + message on one side and the controls
//            on the other (mirrored for left-handed play).
import { S } from './physics.js';
export { S };
export const PLAY = 570, K = PLAY / S;                 // playing surface in canonical units, canonical units per board unit
export const CX = 360, CY = 800;
export const BX = CX - PLAY / 2, BY = CY - PLAY / 2;   // top-left of the playing surface (canonical)
export const FRAME = 62;                               // wooden frame thickness
export const FR = PLAY + FRAME * 2;                    // the framed board, canonical
export const sx = (x) => BX + x * K;
export const sy = (y) => BY + y * K;
export const ux = (px) => (px - BX) / K;
export const uy = (py) => (py - BY) / K;
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export const rect = (x, y, w, h) => ({ x, y, w, h });
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const AUTO_THINK_STEPS = [2, 5, 8, 10];
export const AUTO_REVEAL_SECS = 2;

// Safe areas and the host's floating back button, in virtual units. main.js keeps this current (browsers: all zero).
// px = css pixels per virtual unit (text never shrinks below ~11 css px).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };

const cache = new Map();
export function layoutFor(w, h, left = false) {
  w = Math.round(w); h = Math.round(h);
  const key = `${w}x${h}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}|${Math.round(host.px * 100)}|${left ? 1 : 0}`;
  let L = cache.get(key);
  if (!L) { L = build(w, h, { ...host }, !!left); L.key = key; cache.set(key, L); if (cache.size > 40) cache.delete(cache.keys().next().value); }
  return L;
}

const R = rect;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Rows of a grid inside `area` (cols columns, row-major), each as tall as fits up to maxH, the block centred vertically.
function grid(count, area, cols, gap, maxH) {
  const rows = Math.ceil(count / cols), cw = (area.w - gap * (cols - 1)) / cols, rh = Math.min(maxH, (area.h - gap * (rows - 1)) / rows), out = [];
  const total = rows * rh + (rows - 1) * gap, y0 = area.y + Math.max(0, (area.h - total) / 2);
  for (let i = 0; i < count; i++) out.push(R(area.x + (i % cols) * (cw + gap), y0 + Math.floor(i / cols) * (rh + gap), cw, rh));
  return out;
}

function build(w, h, ins, left) {
  const land = w >= h, px = ins.px > 0 ? ins.px : 0.6;
  const U = { x0: ins.l, y0: ins.t, x1: w - ins.r, y1: h - ins.b }; U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  const ucx = (U.x0 + U.x1) / 2;
  const backSz = ins.back ? Math.max(ins.back, 56) : 0;
  const backBox = ins.back ? R(ins.l, ins.t, backSz + 8, backSz + 8) : R(0, 0, 0, 0);
  const tall = !land && h >= 1500, mode = land ? 'wide' : tall ? 'tall' : 'compact';
  const bh = Math.round(clamp(46 / px, 58, 84));       // a comfortable tap target (~44 css px where the screen allows)
  const minText = Math.max(16, 11 / px);               // never below ~11 css px
  const bottomPad = Math.max(16, ins.b + 8);
  const L = { w, h, land, mode, tall, ins, U, backBox, bh, minText, left, px };
  const backRight = ins.back ? backBox.x + backBox.w : 0;

  // ================================================================ board scenes: play, auto, lesson, daily
  const scenes = {};
  L.play = (sc) => (scenes[sc] ??= buildPlay(sc));
  function buildPlay(sc) {
    const P = { sc, f: 1, cx: w / 2, cy: h / 2, cards: {}, btn: {}, auto: null, meter: null, tip: null, msg: null, head: null };
    const meterH = 34, g = 12;
    if (!land) {
      const top = ins.back ? backBox.y + backBox.h + 4 : Math.max(ins.t + 10, tall ? 60 : 40);
      const cardH = tall ? 160 : h >= 1100 ? 132 : 118, mh = tall ? 92 : 64, barH = Math.max(72, Math.round(46 / px)), ltH = tall ? 150 : h >= 1100 ? 124 : 108;
      let head;
      if (sc === 'play') head = cardH + 8 + mh; else if (sc === 'auto') head = cardH + 8 + barH; else if (sc === 'lesson') head = 30 + 56 + 8 + ltH; else head = 30 + 52 + 30 + mh;
      const btnY = h - bottomPad - bh, mY = btnY - 10 - meterH, tipH = tall ? 64 : 0;
      const freeTop = top + head + 8, freeBot = mY - 10 - tipH, free = freeBot - freeTop;
      P.f = clamp(Math.min(free / FR, (U.w - 8) / FR), 0.4, 1.06);
      P.cx = ucx; P.cy = freeTop + free / 2;
      const cw = (U.w - 3 * g) / 2;
      P.cards = { W: R(U.x0 + g, top, cw, cardH), B: R(U.x0 + g * 2 + cw, top, cw, cardH) };
      P.msg = R(U.x0 + g, top + (sc === 'daily' ? 30 + 52 + 30 : cardH + 8), U.w - 2 * g, mh);
      P.lesson = { label: { x: ucx, y: top + 24 }, title: { x: ucx, y: top + 24 + 46, size: 52 }, body: R(U.x0 + g, top + 30 + 56 + 8, U.w - 2 * g, ltH) };
      P.daily = { label: { x: ucx, y: top + 24 }, title: { x: ucx, y: top + 24 + 40, size: 42 }, attempts: { x: ucx, y: top + 30 + 52 + 20 } };
      const bar = R(U.x0 + g, top + cardH + 8, U.w - 2 * g, barH), inc = R(bar.x + bar.w - 8 - 84, bar.y + 4, 84, barH - 8), dec = R(inc.x - 8 - 84, bar.y + 4, 84, barH - 8);
      P.auto = { bar, inc, dec, label: { x: bar.x + 20, y: bar.y + bar.h / 2, align: 'left' }, think: { x: dec.x - 14, y: bar.y + bar.h / 2, align: 'right' } };
      const bw = Math.min(214, (U.w - 2 * g - 28) / 3), x0 = ucx - (3 * bw + 28) / 2, slot = (i) => R(x0 + (left ? 2 - i : i) * (bw + 14), btnY, bw, bh);
      P.btn = { menu: slot(0), hint: slot(1), flick: slot(2) };
      const mw = Math.min(560, U.w - 72); P.meter = R(ucx - mw / 2, mY, mw, meterH);
      if (tall) P.tip = R(U.x0 + 30, mY - 10 - tipH, U.w - 60, tipH);
      P.area = R(U.x0, freeTop - 6, U.w, free + 12);                 // where a press starts an aim
      P.head = R(U.x0, top, U.w, head);
      return P;
    }
    // ---- landscape
    const Lmin = 214, Rmin = 190;
    P.f = clamp(Math.min((U.h - 14) / FR, (U.w - Lmin - Rmin - 2 * g) / FR), 0.4, 1.12);
    const bw = FR * P.f, extra = U.w - bw - 2 * g;
    let Lw, Rw;
    if (extra / 2 >= Math.max(Lmin, Rmin)) Lw = Rw = Math.min(extra / 2, 380); else { const s = Math.max(0, (extra - Lmin - Rmin) / 2); Lw = Lmin + s; Rw = Rmin + s; }
    const gw = Lw + g + bw + g + Rw, x0 = U.x0 + (U.w - gw) / 2;
    P.cx = x0 + Lw + g + bw / 2; P.cy = (U.y0 + U.y1) / 2;
    const panelTop = (x) => (ins.back && x < backRight + 6 ? backBox.y + backBox.h + 4 : U.y0 + 8);
    const A = R(x0, 0, Lw, 0), B = R(x0 + Lw + g + bw + g, 0, Rw, 0);
    for (const p of [A, B]) { p.y = panelTop(p.x); p.h = U.y1 - 8 - p.y; }
    const info = left ? B : A, ctrl = left ? A : B;
    P.info = info; P.ctrl = ctrl; P.head = info;
    const cardH = clamp((info.h - 100 - 16) / 2, 112, 150), cw = info.w - 8;
    P.cards = { W: R(info.x + 4, info.y, cw, cardH), B: R(info.x + 4, info.y + cardH + 8, cw, cardH) };
    const mTop = info.y + 2 * cardH + 16;
    P.msg = R(info.x + 4, mTop, cw, Math.max(80, info.y + info.h - mTop));
    P.lesson = { label: { x: info.x + info.w / 2, y: info.y + 26 }, title: { x: info.x + info.w / 2, y: info.y + 72, size: 40, wrap: true, w: info.w - 20 }, body: R(info.x + 4, info.y + 96, cw, info.h - 100) };
    P.daily = { label: { x: info.x + info.w / 2, y: info.y + 26 }, title: { x: info.x + info.w / 2, y: info.y + 68, size: 34, wrap: true, w: info.w - 20 }, attempts: { x: info.x + info.w / 2, y: info.y + 190 } };
    if (sc === 'daily') P.msg = R(info.x + 4, info.y + 212, cw, Math.max(80, info.h - 212));
    // controls: meter (or, in the auto scene, the status + think stepper) on top, three buttons below, the block centred
    const cwid = Math.min(ctrl.w - 16, 330), cxx = ctrl.x + (ctrl.w - cwid) / 2, hgap = 14, hdr = sc === 'auto' ? 110 : meterH + 18;
    const bhh = Math.min(bh, Math.floor((ctrl.h - 20 - hdr - 3 * hgap) / 3));
    const block = hdr + hgap + 3 * bhh + 2 * hgap;
    let y = ctrl.y + Math.max(0, (ctrl.h - block) / 2);
    if (sc === 'auto') {
      const dec = R(cxx, y + 38, 76, 64), inc = R(cxx + cwid - 76, y + 38, 76, 64);
      P.auto = { bar: R(cxx - 6, y - 4, cwid + 12, 114), dec, inc, label: { x: cxx + cwid / 2, y: y + 22, align: 'center' }, think: { x: cxx + cwid / 2, y: y + 38 + 32, align: 'center' } };
    } else P.meter = R(cxx, y, cwid, meterH);
    y += hdr + hgap;
    const slot = (i) => R(cxx, y + i * (bhh + hgap), cwid, bhh);
    P.btn = { menu: slot(0), hint: slot(1), flick: slot(2) };
    const gm = 8; P.area = R(P.cx - bw / 2 - gm, U.y0, bw + 2 * gm, U.h);
    return P;
  }
  // convert pointer (screen) <-> canonical board space for a play scene
  L.toBoard = (P, x, y) => ({ x: CX + (x - P.cx) / P.f, y: CY + (y - P.cy) / P.f });
  L.toScreen = (P, X, Y) => ({ x: P.cx + (X - CX) * P.f, y: P.cy + (Y - CY) * P.f });

  // ================================================================ dialogs (result, lesson complete, solved, failed)
  const dialogs = {};
  L.dialog = (kind) => (dialogs[kind] ??= buildDialog(kind));
  function buildDialog(kind) {
    const bodyH = { over: 150, lesson: 150, solved: 110, failed: 80 }[kind] ?? 120, nBtn = kind === 'over' ? 2 : 1, extra = kind === 'over' ? 44 : 0;
    const b1 = bh + 12, b2 = bh, gap = 14, btnsH = nBtn === 2 ? b1 + gap + b2 : b1;
    if (!land) {
      const dw = Math.min(U.w - 40, 620), dh = 24 + 86 + bodyH + 12 + btnsH + extra + 24;
      const x = ucx - dw / 2, y = clamp((U.y0 + U.y1) / 2 - dh / 2, U.y0 + 8, Math.max(U.y0 + 8, U.y1 - dh - 8));
      const bw = Math.min(dw - 80, 500), bx = x + (dw - bw) / 2, by = y + 24 + 86 + bodyH + 12;
      const btns = nBtn === 2 ? [R(bx, by, bw, b1), R(bx, by + b1 + gap, bw, b2)] : [R(bx, by, bw, b1)];
      return { panel: R(x, y, dw, dh), title: { x: x + dw / 2, y: y + 24 + 58 }, body: { x: x + dw / 2, y: y + 24 + 86 + 6, w: dw - 60, h: bodyH }, btns, extra: { x: x + dw / 2, y: by + btnsH + 34 }, land: false };
    }
    const dw = Math.min(U.w - 40, 900), lw = dw * 0.56, rw = dw - lw - 24;
    const dh = Math.max(24 + 86 + bodyH + 24, 24 + btnsH + extra + 24, 280);
    const x = ucx - dw / 2, y = clamp((U.y0 + U.y1) / 2 - dh / 2, U.y0 + 8, Math.max(U.y0 + 8, U.y1 - dh - 8));
    const bw = Math.min(rw - 24, 320), bx = x + lw + 12 + (rw - bw) / 2, by = y + (dh - btnsH - extra) / 2;
    const btns = nBtn === 2 ? [R(bx, by, bw, b1), R(bx, by + b1 + gap, bw, b2)] : [R(bx, by, bw, b1)];
    return { panel: R(x, y, dw, dh), title: { x: x + lw / 2 + 12, y: y + 24 + 58 }, body: { x: x + lw / 2 + 12, y: y + 24 + 86 + 6, w: lw - 40, h: bodyH }, btns, extra: { x: bx + bw / 2, y: by + btnsH + 34 }, land: true };
  }

  // ================================================================ pause menu
  {
    const n = 4, gap = 14, titleH = land ? 80 : 110, bhh = Math.min(bh + 8, Math.floor((U.h - titleH - 40 - (n - 1) * gap) / n)), bw = Math.min(500, U.w - 60);
    const total = titleH + n * bhh + (n - 1) * gap, y0 = (U.y0 + U.y1) / 2 - total / 2, x = ucx - bw / 2, cy = (i) => y0 + titleH + i * (bhh + gap);
    L.menu = { title: { x: ucx, y: y0 + titleH - 34, size: land ? 56 : 70 }, resume: R(x, cy(0), bw, bhh), restart: R(x, cy(1), bw, bhh), settings: R(x, cy(2), bw, bhh), quit: R(x, cy(3), bw, bhh) };
  }

  // ================================================================ reader pages: How to play, About, Game Rules
  {
    const navY = h - bottomPad - bh, top = !land && ins.back ? backBox.y + backBox.h + 4 : Math.max(ins.t + 8, 16);
    let pw, px0;
    if (land) { const lo = Math.max(U.x0 + 16, ins.back ? backRight + 8 : 0); pw = Math.min(U.x1 - 16 - lo, 1000); px0 = lo + (U.x1 - 16 - lo - pw) / 2; }
    else { pw = Math.min(U.w - 32, 760); px0 = ucx - pw / 2; }
    const panelY = land ? U.y0 + 8 : top, panel = R(px0, panelY, pw, navY - 12 - panelY);
    const sw = 110, sh = Math.max(60, Math.min(70, bh - 10)), inc = R(panel.x + panel.w - 16 - sw, panel.y + 14, sw, sh), dec = R(inc.x - 10 - sw, panel.y + 14, sw, sh);
    const viewport = R(panel.x + 24, panel.y + 14 + sh + 12, panel.w - 48 - 14, panel.h - (14 + sh + 12) - 44);
    const nw = Math.min(220, (pw - 28) / 3), nx = panel.x + (pw - (3 * nw + 28)) / 2;
    L.reader = {
      panel, viewport, dec, inc, title: { x: panel.x + 28, y: panel.y + 14 + sh / 2 }, counter: { x: panel.x + panel.w / 2, y: panel.y + panel.h - 16 },
      scrollbar: R(panel.x + panel.w - 22, viewport.y, 10, viewport.h), textW: Math.min(viewport.w - 4, 780), cx: viewport.x + viewport.w / 2,
      nav: { prev: R(nx, navY, nw, bh), back: R(nx + nw + 14, navY, nw, bh), next: R(nx + 2 * (nw + 14), navY, nw, bh) },
    };
  }

  // ================================================================ settings, the lesson list, the web-preview card
  {
    const doneW = Math.min(320, U.w - 80), done = R(ucx - doneW / 2, h - bottomPad - bh, doneW, bh);
    const hdrY = (ins.back && !land ? backBox.y + backBox.h : Math.max(ins.t, 0)) + (land ? 58 : 76), size = land ? 52 : 68;
    const aTop = Math.max(hdrY + 24, ins.back && land ? backBox.y + backBox.h + 6 : 0), aBot = done.y - (land ? 12 : 34), cols = land ? 2 : 1;
    const aw = Math.min(cols === 2 ? 920 : 600, U.w - 60), area = R(ucx - aw / 2, aTop, aw, aBot - aTop);
    L.settings = { title: { x: ucx, y: hdrY, size }, rows: grid(7, area, cols, 12, 104), done, note: { x: ucx, y: done.y - 12 }, noteFits: !land && aBot - aTop > 600 };
    L.lessons = { title: { x: ucx, y: hdrY, size }, rows: grid(8, area, cols, 12, 108), back: done };
    L.demo = { title: { x: ucx, y: h * 0.3, size: land ? 50 : 60 }, body: { x: ucx, y: h * 0.3 + 70, w: Math.min(U.w - 80, 600) }, back: done };
  }

  // ================================================================ title
  const titles = {};
  L.title = (hasSave) => (titles[hasSave ? 1 : 0] ??= buildTitle(!!hasSave));
  function buildTitle(hasSave) {
    const T = { rows: {}, hero: null, titleText: null, tag: null, brand: null, dim: null, card: null, dev: { x: U.x1 - 12, y: U.y0 + 28 } };
    const rowsDef = [['resume'], ['play'], ['two', 'learn'], ['daily', 'level'], ['howto', 'about', 'rules'], ['settings', 'auto']].filter((r) => hasSave || r[0] !== 'resume');
    const wt = (r) => (r[0] === 'resume' || r[0] === 'play' ? 1.2 : r[0] === 'howto' || r[0] === 'settings' ? 0.92 : 1);
    const sumW = rowsDef.reduce((a, r) => a + wt(r), 0), gapV = 10;
    const place = (x0, aw, y0, unit) => rowsDef.forEach((row) => {
      const rh = unit * wt(row) - gapV, cw = (aw - 12 * (row.length - 1)) / row.length;
      row.forEach((nm, i) => { T.rows[nm] = R(x0 + i * (cw + 12), y0, cw, rh); });
      y0 += unit * wt(row);
    });
    const LK = 0.2725;                                   // lockup aspect (327 / 1200)
    // Tap zone of the lockup: the lockup padded to >= 44 css px each way, never above the last button row (rowsBottom) or below limitY.
    const tapZone = (b, lkh, rowsBottom, limitY) => {
      const m = 44 / ins.px, tw = Math.max(b.w + 20, m), th = Math.max(lkh + 12, m);
      const y0 = Math.max(b.y - th / 2, rowsBottom + 2), y1 = Math.max(Math.min(limitY, y0 + th), b.y + lkh / 2 + 4);
      return R(b.x - tw / 2, y0, tw, Math.max(y1 - y0, lkh));
    };
    if (!land) {
      const lkw = Math.min(U.w - 80, Math.max(260, 125 / ins.px)), lkh = lkw * LK, strip = lkh + 22;
      const unit = clamp(h * 0.058, 62, 96), blockH = unit * sumW, bw = Math.min(U.w - 80, 580), bx = ucx - bw / 2;
      const btnTop = h - bottomPad - strip - blockH + gapV;
      place(bx, bw, btnTop, unit);
      const top = Math.max(ins.t + 6, 14), tsz = h >= 1100 ? 120 : 92;
      T.titleText = { x: ucx, y: top + tsz * 0.9, size: tsz }; T.tag = { x: ucx, y: top + tsz * 0.9 + 42, size: 28 };
      T.brand = { x: ucx, y: h - bottomPad - 8 - lkh / 2, w: lkw };
      T.lockTap = tapZone(T.brand, lkh, btnTop - gapV + unit * sumW, h);
      const heroTop = top + tsz * 0.9 + 42 + 14, zone = btnTop - 20 - heroTop;
      T.hero = { sc: clamp(Math.min(zone / FR, (U.w - 20) / FR), 0.3, 1), cx: ucx, cy: heroTop + zone / 2 };
      T.dim = R(0, btnTop - 14, w, h - btnTop + 14);
      return T;
    }
    const aw = clamp(U.w * 0.46, 420, 640), ax = U.x1 - aw - 16, card = R(ax, U.y0 + 8, aw, U.h - 16), pad = 16;
    const lkw = Math.min(aw - 2 * pad, Math.max(180, 125 / ins.px)), lkh = lkw * LK, strip = lkh + 20;
    const unit = Math.min(94, (card.h - 2 * pad - strip + gapV) / sumW);
    const by0 = card.y + pad + Math.max(0, (card.h - 2 * pad - strip + gapV - unit * sumW) / 2);
    place(ax + pad, aw - 2 * pad, by0, unit);
    T.card = card;
    const lx0 = Math.max(U.x0 + 8, backRight + 4), LW = ax - 8 - lx0, lcx = lx0 + LW / 2;
    const tsz = Math.min(110, (LW - 20) / 3.3), top = U.y0 + 10;
    T.titleText = { x: lcx, y: top + tsz * 0.85, size: tsz }; T.tag = { x: lcx, y: top + tsz * 0.85 + 36, size: 26 };
    T.brand = { x: ax + aw / 2, y: Math.min(card.y + card.h - pad - lkh / 2, by0 + unit * sumW - gapV + 10 + lkh / 2), w: lkw };
    T.lockTap = tapZone(T.brand, lkh, by0 + unit * sumW - gapV, card.y + card.h);
    const heroTop = top + tsz * 0.85 + 50, zone = U.y1 - 12 - heroTop;
    T.hero = { sc: clamp(Math.min(zone / FR, (LW - 16) / FR), 0.3, 1), cx: lcx, cy: heroTop + zone / 2 };
    return T;
  }
  return L;
}
