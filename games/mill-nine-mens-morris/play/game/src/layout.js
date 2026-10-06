// Geometry. The board is a plane seen in perspective (a true projective map, so straight lines stay straight).
// Board coordinates: u in -3..3 (left to right), v in 0..6 (0 = the far side). The board, the men and the racks are drawn in a fixed
// "stage" coordinate system (the original 720 x 1560 phone drawing); `layoutFor(w, h)` places that stage on the live screen with a
// uniform scale + shift (L.stage), so the game fills any phone or tablet in portrait and in landscape (kit 1.7 fluid viewport:
// the short side is always 720 units). Everything else (HUD, buttons, menus, reference pages) is laid out per mode:
//   tall     portrait phone (h >= 1500): the approved phone look (HUD plaque on top, stage, button bar below)
//   compact  portrait, shorter than a phone (small phones, tablets): a smaller fixed HUD, the stage scaled to fit
//   wide     landscape: a side panel (status + buttons) and the stage beside it, men racks beside the board when there is room
// layoutFor() is cached per size + safe insets, so a frame never recomputes it.
export const W = 720, H = 1560;
const CX = 360, D = 96, K = 0.03, Y_NEAR = 1262, HGT = 3200, Y_H = Y_NEAR - HGT;
export const UNIT = D / 106;
export function project(u, v) { const z = 1 + K * (6 - v); return { x: CX + (u * D) / z, y: Y_H + HGT / z, s: 1 / z }; }
// point i -> board coordinates
export const PT = [];
for (let r = 0; r < 3; r++) { const s = 3 - r; [[-s, -s], [0, -s], [s, -s], [s, 0], [s, s], [0, s], [-s, s], [-s, 0]].forEach(([u, v]) => PT.push([u, v + 3])); }
export const pointAt = (i) => project(PT[i][0], PT[i][1]);
export const PIECE_R = 39 * UNIT;
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// Safe areas and the host's floating back button, in virtual units. main.js keeps this current (browsers: all zero).
// px = css pixels per virtual unit (text never shrinks below ~11 css px).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };

// Auto Play (Watch & Learn): think-time steps in seconds, hard-capped at 10s. An index into this array, never a raw float.
export const AUTO_THINK_STEPS = [2, 5, 8, 10];
export const AUTO_REVEAL_SECONDS = 2;
// Text-size steps for the About/How/Rules reference pages (index, never a raw float; up to 300%).
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];

// Which board point a tap means (stage coordinates): the nearest point (generous radius, the men are big).
export function pointNear(x, y, max = 52) {
  let best = -1, bd = Infinity;
  for (let i = 0; i < 24; i++) { const p = pointAt(i), d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = i; } }
  return bd < max ? best : -1;
}
// The keyboard cursor moves to the nearest point in the pressed direction (stage coordinates).
export function neighbourToward(i, dx, dy) {
  const a = pointAt(i); let best = -1, bs = Infinity;
  for (let j = 0; j < 24; j++) {
    if (j === i) continue;
    const b = pointAt(j), vx = b.x - a.x, vy = b.y - a.y, along = vx * dx + vy * dy, across = Math.abs(vx * dy - vy * dx);
    if (along <= 8) continue;
    const s = along + across * 2.2; if (s < bs) { bs = s; best = j; }
  }
  return best < 0 ? i : best;
}

const R = (x, y, w, h) => ({ x, y, w, h });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// The stage's extent: with the men racks above / below the board ('h'), or in columns beside it ('v', landscape only).
const SB = { h: { x0: 0, x1: 720, y0: 586, y1: 1456 }, v: { x0: -140, x1: 860, y0: 732, y1: 1380 } };
const RACK_Y = { top: 650, bottom: 1384 };

const cache = new Map();
export function layoutFor(w, h) {
  w = Math.round(w); h = Math.round(h);
  const key = `${w}x${h}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}`;
  let L = cache.get(key);
  if (!L) { L = build(w, h, { ...host }); L.key = key; cache.set(key, L); if (cache.size > 40) cache.delete(cache.keys().next().value); }
  return L;
}

function fitStage(kind, area, cap) {
  const b = SB[kind], bw = b.x1 - b.x0, bh = b.y1 - b.y0, s = Math.min(cap, area.w / bw, area.h / bh);
  return { kind, s, tx: area.x + (area.w - bw * s) / 2 - b.x0 * s, ty: area.y + (area.h - bh * s) / 2 - b.y0 * s };
}

function build(w, h, ins) {
  const land = w >= h, tall = !land && h >= 1500, mode = land ? 'wide' : tall ? 'tall' : 'compact';
  const L = { w, h, land, tall, mode, ins };
  const backSz = ins.back ? Math.max(ins.back, 56) : 0;
  L.backBox = ins.back ? R(ins.l, ins.t, backSz + 8, backSz + 8) : R(0, 0, 0, 0);
  const backBottom = ins.back ? L.backBox.y + L.backBox.h : 0;
  const U = L.U = { x0: ins.l, y0: ins.t, x1: w - ins.r, y1: h - ins.b }; U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  const lift = Math.max(0, ins.b - 16), barY = L.barY = h - 98 - lift, barH = 72;

  // ---- stage + HUD + buttons ------------------------------------------------------------------------------------------
  const BTN = L.BTN = {};
  let stage;
  if (!land) {
    const bar = {
      menu: R(60, barY, 190, barH), undo: R(265, barY, 190, barH), hint: R(470, barY, 190, barH),
      next: R(275, barY, 385, barH), show: R(470, barY, 190, barH), pshare: R(275, barY, 385, barH),
    };
    Object.assign(BTN, bar);
    if (tall) {
      stage = { kind: 'h', s: 1, tx: (w - 720) / 2, ty: Math.min((h - 1560) / 2, barY - 8 - SB.h.y1) };
      L.hud = { style: 'big', x: 24, y: Math.max(120, ins.back ? backBottom + 8 : 0), w: w - 48 };
      L.think = { dec: R(50, L.hud.y + 28, 120, 56), inc: R(w - 170, L.hud.y + 28, 120, 56) };
    } else {
      const top = ins.back ? backBottom + 4 : Math.max(14, ins.t + 10), Hs = 214;
      L.hud = { style: 'small', x: 24, y: top, w: w - 48, h: Hs, rect: R(24, top, w - 48, Hs) };
      L.think = { dec: R(40, top + 10, 112, 48), inc: R(w - 152, top + 10, 112, 48) };
      stage = fitStage('h', R(U.x0 + 6, top + Hs + 8, U.w - 12, barY - 10 - (top + Hs + 8)), 1);
    }
  } else {
    const cardTop = ins.back ? Math.max(U.y0 + 8, backBottom + 4) : U.y0 + 8, g = 10;
    const Lw = clamp(Math.round(U.w * 0.3), 330, 480);
    const panel = R(U.x0 + 8, cardTop, Lw, U.y1 - 8 - cardTop);
    const areaX = panel.x + panel.w + g, area = R(areaX, U.y0 + 6, U.x1 - 8 - areaX, U.h - 12);
    const sh = fitStage('h', area, 1.2), sv = fitStage('v', area, 1.2);
    stage = sv.s > sh.s * 1.08 ? sv : sh;
    // buttons: a stack at the bottom of the panel (three slots), the status text above it
    const bh = clamp(Math.round(panel.h * 0.11), 54, 72), bgap = 10, bw = panel.w - 32, bx = panel.x + 16, stackH = 3 * bh + 2 * bgap;
    const slot = (i) => R(bx, panel.y + panel.h - 16 - stackH + i * (bh + bgap), bw, bh);
    Object.assign(BTN, { menu: slot(0), undo: slot(1), hint: slot(2), next: slot(1), show: slot(1), pshare: slot(1), again: slot(0), back: slot(1), share: slot(2) });
    L.panel = panel; L.hud = { style: 'panel', x: panel.x, y: panel.y, w: panel.w, h: panel.h - stackH - 28, rect: R(panel.x, panel.y, panel.w, panel.h - stackH - 28) };
    L.think = { dec: R(panel.x + 14, panel.y + 12, 104, 46), inc: R(panel.x + panel.w - 118, panel.y + 12, 104, 46) };
  }
  L.stage = stage; L.racks = stage.kind;
  const { s, tx, ty } = stage;
  L.toScreen = (x, y) => ({ x: x * s + tx, y: y * s + ty });
  L.toStage = (x, y) => ({ x: (x - tx) / s, y: (y - ty) / s });
  L.pointScreen = (i) => { const p = pointAt(i); return L.toScreen(p.x, p.y); };
  L.hit = 52 / Math.min(1, s);                       // tap radius in stage units: never smaller than ~52 screen units
  L.tt = ty + 690 * s; L.archCx = tx + 360 * s;      // the table's back edge and the arch behind the board
  L.candles = [{ x: 74, y: 720 }, { x: 646, y: 720 }].map((c) => ({ ...L.toScreen(c.x, c.y), s: s * 0.95 }));
  // men racks (stage coordinates)
  if (stage.kind === 'h') {
    L.rackPos = (which, k) => ({ x: 360 + (k - 4) * 56, y: RACK_Y[which], s: 0.9 });
    L.rackBox = (which) => R(112, RACK_Y[which] - 36, 496, 72);
    L.rackLabel = (which) => ({ x: 360, y: which === 'top' ? RACK_Y.top - 46 : RACK_Y.bottom + 62, two: false });
  } else {
    const col = (which) => (which === 'top' ? -52 : 772), y0 = 1040 - 4 * 54;
    L.rackPos = (which, k) => ({ x: col(which), y: y0 + k * 54, s: 0.9 });
    L.rackBox = (which) => R(col(which) - 36, y0 - 33, 72, 8 * 54 + 66);
    L.rackLabel = (which) => ({ x: col(which), y: y0 - 33 - 30, two: true });
  }

  // ---- other screens ------------------------------------------------------------------------------------------------------
  const titleCache = {};
  L.title = (hasSave) => (titleCache[hasSave ? 1 : 0] ??= buildTitle(L, !!hasSave));
  L.look = buildLook(L);
  L.ref = buildRef(L);
  L.over = buildOver(L);
  if (!L.land) Object.assign(BTN, { again: L.over.again, back: L.over.back, share: L.over.share });
  L.demo = buildDemo(L);
  return L;
}

// ---- title / menu ----------------------------------------------------------------------------------------------------------
// Rows of buttons: [names, height, pitch]. The first form keeps the approved phone menu; the second packs two or three to a row.
const rowsSingle = (hasSave) => (hasSave ? [[['resume'], 64, 72]] : []).concat([[['learn'], 64, 72], [['play'], 64, 72], [['two'], 64, 72], [['daily'], 64, 72],
  [['level', 'side'], 58, 66], [['sound', 'calm'], 58, 66], [['look', 'auto'], 58, 66], [['about', 'how', 'rules'], 58, 66]]);
const rowsDouble = (hasSave) => (hasSave ? [[['resume'], 64, 72]] : []).concat([[['learn', 'play'], 64, 72], [['two', 'daily'], 64, 72],
  [['level', 'side'], 58, 66], [['sound', 'calm'], 58, 66], [['look', 'auto'], 58, 66], [['about', 'how', 'rules'], 58, 66]]);
function placeRows(spec, x0, aw, y0, f) {
  const rows = {}; let y = y0;
  for (const [names, bh, pitch] of spec) {
    const gap = 14, cw = (aw - gap * (names.length - 1)) / names.length;
    names.forEach((n, i) => { rows[n] = R(x0 + i * (cw + gap), y, cw, bh * f); });
    y += pitch * f;
  }
  return { rows, end: y };
}
const sumPitch = (spec) => spec.reduce((a, r) => a + r[2], 0);

const LOCK_AR = 327 / 1200, HALF_TITLE = 285;   // half the width of the title block at scale 1
function lockRect(cx, y, maxW) { const lw = Math.min(260, maxW), lh = lw * LOCK_AR; return R(cx - lw / 2, y, lw, lh); }
// Tap zone of the title lockup: >= 44 css px each way, extended sideways and downward only (never into the buttons above).
export function lockHit(L, T) {
  const r = T.lock; if (!r) return null; const m = 44 / Math.max(0.05, host.px);
  const w = Math.max(r.w, m), x = r.x + r.w / 2 - w / 2, y = r.y - 2;
  return R(x, y, w, Math.max(r.h + 2, Math.min(m, L.h - y)));
}

function buildTitle(L, hasSave) {
  const { w, h, U, ins } = L, T = { rows: {}, hero: null, board: null, card: null, candles: [], msg: null, note: null, tt: 0, archCx: w / 2 };
  const BLOCK = 310, bottomPad = Math.max(10, ins.b), noteH = 38;
  if (L.land && w >= h) {
    // landscape: the art on the left, a card of buttons on the right
    const spec = rowsDouble(hasSave), n = spec.length;
    const Rw = clamp(Math.round(U.w * 0.46), 520, 640), cardX = U.x1 - Rw - 10;
    const lk = lockRect(0, 0, 300), pitchF = Math.min(1.15, (U.h - 40 - lk.h - 12) / sumPitch(spec)), cardH = sumPitch(spec) * pitchF + 28, cardY = U.y0 + (U.h - lk.h - 12 - cardH) / 2;
    const leftX0 = U.x0 + 8, leftX1 = cardX - 10, leftW = leftX1 - leftX0, narrow = leftW < 300;
    if (!narrow) {
      T.card = R(cardX, cardY, Rw, cardH); T.lock = lockRect(cardX + Rw / 2, cardY + cardH + 8, Rw - 36);
      const pr = placeRows(spec, cardX + 18, Rw - 36, T.card.y + 14, pitchF); T.rows = pr.rows;
      let cxL = leftX0 + leftW / 2, y0 = Math.max(ins.t + 14, 26); const ts = clamp((leftW - 30) / 620, 0.5, 1);
      { const bb = L.backBox; if (bb && bb.h && y0 < bb.y + bb.h) { const need = bb.x + bb.w + 40 + HALF_TITLE * ts, maxCx = leftX1 - HALF_TITLE * ts; if (cxL < need) cxL = Math.min(need, maxCx); if (cxL < need) y0 = bb.y + bb.h + 6; } }   // the title clears the host back button
      T.hero = { cx: cxL, y0, ts };
      const blockBottom = y0 + BLOCK * ts, rem = U.y1 - noteH - blockBottom;
      const k = clamp((rem - 24) / 650, 0, 0.6);
      if (k >= 0.3) {
        const bcy = blockBottom + (U.y1 - noteH - blockBottom) / 2 + 4;
        T.board = { cx: cxL, cy: bcy, k }; T.tt = bcy - 15; T.archCx = cxL;
        const hw = 354 * k + 52; T.candles = [{ x: cxL - hw, y: bcy + 330 * k, s: 0.8 }, { x: cxL + hw, y: bcy + 330 * k, s: 0.8 }];
      } else { T.tt = blockBottom + 40; T.archCx = cxL; }
      T.msg = R(leftX0 + 10, blockBottom - 8, leftW - 20, 92); T.note = { x: cxL, y: U.y1 - 12 };
      return T;
    }
    // narrow landscape (about square): everything in one column, no demo board
    const lk2 = lockRect(0, 0, 300), spec2 = rowsDouble(hasSave), pitchF2 = Math.min(1, (U.h - 150 - lk2.h - 8) / sumPitch(spec2)), aw = Math.min(U.w - 40, 620), x0 = U.x0 + (U.w - aw) / 2;
    const ts = clamp((U.h - sumPitch(spec2) * pitchF2 - noteH - 40) / BLOCK, 0.45, 0.8), y0 = Math.max(ins.t + 10, 18);
    T.hero = { cx: U.x0 + U.w / 2, y0, ts };
    const pr = placeRows(spec2, x0, aw, U.y1 - noteH - lk2.h - 8 - sumPitch(spec2) * pitchF2, pitchF2); T.rows = pr.rows; T.lock = lockRect(U.x0 + U.w / 2, U.y1 - noteH - lk2.h - 4, 300);
    T.tt = y0 + BLOCK * ts; T.archCx = U.x0 + U.w / 2; T.msg = R(x0, y0 + BLOCK * ts - 10, aw, 92); T.note = { x: U.x0 + U.w / 2, y: U.y1 - 12 };
    return T;
  }
  // portrait: title block, the demo board, the buttons anchored at the bottom
  const single = h >= 1440, spec = single ? rowsSingle(hasSave) : rowsDouble(hasSave), btnH = sumPitch(spec);
  const lkp = lockRect(w / 2, 0, 300), noteH2 = noteH + lkp.h + 10, topMargin = Math.max(56, ins.t + 24), avail = h - topMargin - noteH2 - bottomPad - 8;
  let ts = 1, fb = 1;
  if (BLOCK + 250 + btnH > avail) {
    ts = clamp((avail - 250 - btnH) / BLOCK, 0.5, 1);
    if (BLOCK * ts + 250 + btnH > avail) fb = clamp((avail - 250 - BLOCK * ts) / btnH, 0.86, 1);
  }
  const btnTotal = btnH * fb, btop = h - noteH2 - bottomPad - btnTotal;
  const pr = placeRows(spec, 90, 540, btop, fb); T.rows = pr.rows;
  T.hero = { cx: w / 2, y0: topMargin, ts }; T.lock = lockRect(w / 2, btop + btnTotal + 6, 300);
  { const bb = L.backBox; if (bb && bb.h && topMargin < bb.y + bb.h) ts = Math.max(0.45, Math.min(ts, (w / 2 - (bb.x + bb.w) - 40) / HALF_TITLE)); T.hero.ts = ts; }   // the title clears the host back button
  const blockBottom = topMargin + BLOCK * ts, gap = btop - blockBottom, k = clamp((gap - 36) / 650, 0, 0.6);
  if (k >= 0.24) {
    const bcy = blockBottom + gap / 2; T.board = { cx: w / 2, cy: bcy, k }; T.tt = bcy - 15;
    const hw = 354 * k + 52; T.candles = [{ x: w / 2 - hw, y: bcy + 330 * k, s: 0.8 }, { x: w / 2 + hw, y: bcy + 330 * k, s: 0.8 }];
  } else T.tt = blockBottom + 30;
  T.msg = R(60, blockBottom - 20, 600, 92); T.note = { x: w / 2, y: h - Math.max(14, ins.b + 4) };
  return T;
}

// ---- the 'Board and men' screen -----------------------------------------------------------------------------------------------
function buildLook(L) {
  const { w, h, U } = L, aw = Math.min(620, U.w - 40), x0 = U.x0 + (U.w - aw) / 2;
  const topMin = L.backBox.h ? (L.land ? U.y0 + 8 : L.backBox.y + L.backBox.h + 6) : U.y0 + 8;
  const f = clamp((U.y1 - 10 - topMin) / 700, 0.86, 1.45), cardH = 700 * f, cy = clamp(U.y0 + (U.h - cardH) / 2, topMin, Math.max(topMin, U.y1 - 10 - cardH));
  const o = (v) => cy + v * f, cw3 = (aw - 56 - 24) / 3, cw2 = (aw - 56 - 16) / 2, ix = x0 + 28, iw = aw - 56;
  return {
    card: R(x0, cy, aw, cardH), cx: x0 + aw / 2, title: { y: o(80), size: 46 },
    labels: [{ t: 'Board wood', y: o(132) }, { t: 'Men', y: o(272) }],
    woods: [0, 1, 2].map((i) => R(ix + i * (cw3 + 12), o(146), cw3, 70)), sets: [0, 1].map((i) => R(ix + i * (cw2 + 16), o(286), cw2, 70)),
    lockedY: [o(146) + 70 + 24, o(286) + 70 + 24], men: { y: o(430) }, marks: R(ix, o(480), iw, 62), note: { y: o(590) }, back: R(x0 + (aw - Math.min(aw - 60, 440)) / 2, o(606), Math.min(aw - 60, 440), 78),
  };
}

// ---- About / How to play / Rules: one framed reader with a scrolling body --------------------------------------------------
function buildRef(L) {
  const { w, h, U, ins } = L, lift = Math.max(0, ins.b - 16);
  if (!L.land) {
    const top = Math.max(L.tall ? 130 : 14, L.backBox.h ? L.backBox.y + L.backBox.h + 6 : ins.t + 10);
    const navY = h - 160 - lift, panel = R(30, top, w - 60, navY - 14 - top);
    const vp = R(panel.x + 26, panel.y + 188, panel.w - 52, panel.h - 188 - 46);
    return {
      panel, dec: R(panel.x + 20, panel.y + 16, 120, 56), inc: R(panel.x + panel.w - 140, panel.y + 16, 120, 56),
      headY: panel.y + 124, headSize: 38, secY: panel.y + 174, secSize: 24, viewport: vp, counterY: panel.y + panel.h - 18, textW: Math.min(vp.w - 10, 600), cx: w / 2,
      back: R(140, navY, 212, 84), next: R(368, navY, 212, 84),
    };
  }
  const backW = L.backBox.w ? L.backBox.w + 12 : 40, pw = Math.min(U.w - 2 * Math.max(40, backW), 1000), px = U.x0 + (U.w - pw) / 2;
  const nh = 70, navY = U.y1 - 8 - nh, panel = R(px, U.y0 + 8, pw, navY - 10 - (U.y0 + 8));
  const vp = R(panel.x + 26, panel.y + 92, panel.w - 52, panel.h - 92 - 40), nw = Math.min(230, (pw - 16) / 2), nx = U.x0 + (U.w - 2 * nw - 16) / 2;
  return {
    panel, dec: R(panel.x + 16, panel.y + 12, 104, 52), inc: R(panel.x + panel.w - 120, panel.y + 12, 104, 52),
    headY: panel.y + 38, headSize: 32, secY: panel.y + 72, secSize: 22, viewport: vp, counterY: panel.y + panel.h - 14, textW: Math.min(vp.w - 20, 860), cx: panel.x + panel.w / 2,
    back: R(nx, navY, nw, nh), next: R(nx + nw + 16, navY, nw, nh),
  };
}

// ---- result screens ------------------------------------------------------------------------------------------------------------
function buildOver(L) {
  const { w, h, U } = L;
  if (L.land) { const p = L.panel; return { panel: true, rect: p, cx: p.x + p.w / 2, brandY: p.y + p.h - 4 }; }
  const backBottom = L.backBox.h ? L.backBox.y + L.backBox.h : 0;
  let oy = L.tall ? (h - 1560) / 2 : (h - 870) / 2 - 440;
  oy = Math.max(oy, backBottom + 8 - 440);
  const Rr = (x, y, ww, hh) => R(x, y + oy, ww, hh);
  return {
    panel: false, oy, plaque: Rr(60, 440, 600, 440), plaqueAuto: Rr(60, 440, 600, 460), cx: w / 2,
    again: Rr(140, 930, 440, 96), back: Rr(140, 1046, 440, 84), share: Rr(140, 1150, 440, 84), brandY: 1150 + oy + 84 + 46,
  };
}
// The free-preview-finished card.
function buildDemo(L) {
  const { U } = L, aw = Math.min(620, U.w - 40), ah = 500, x = U.x0 + (U.w - aw) / 2, y = Math.max(U.y0 + 10, U.y0 + (U.h - ah) / 2);
  return { card: R(x, y, aw, ah), back: R(x + (aw - 440) / 2, y + ah - 76 - 30, Math.min(440, aw - 40), 76), cx: x + aw / 2 };
}

// ---- test/back-compat exports: the approved phone-portrait layout (720 x 1560) ------------------------------------------------
const PHONE = layoutFor(720, 1560);
export const BTN = PHONE.BTN;
export const titleRows = (hasSave) => PHONE.title(hasSave).rows;
