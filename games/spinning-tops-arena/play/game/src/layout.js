// Screen geometry as a function of the LIVE screen size (kit 1.7 fluid viewport: the short side is always 720 units, the long
// side follows the aspect, capped at 2.4:1). `layoutFor(w, h)` returns every rectangle for that size, cached by size + safe
// insets, so game.js (hit-testing) and view.js / menus.js (drawing) never disagree. Two shapes:
//   stack  portrait phones and tablets, and anything squarer than 1.15:1: the approved phone look (HUD on top, the dish in the
//          middle, a button bar below), centred in the width, bar anchored to the bottom, HUD to the top.
//   wide   landscape: a card on the left (you, status, hints), the dish in the middle (it uses the screen height), a card on
//          the right (rival, clock, buttons). Title / lists / results are art on the left and a column on the right.
// The dish itself is drawn in fixed DESIGN units (a 720 x 1280 composition: sim.js ARENA). `xf` maps design -> screen
// (uniform scale `s`), and pointer positions are mapped back, so the physics and the art never change with the screen.
import { ARENA } from './sim.js';
export { W, H } from './sim.js';

export const VIEW = { w: 720, h: 1280 };           // the live virtual size, set by game.js every frame
// Safe areas and the host's floating back button, in virtual units. main.js keeps this current (browsers: all zero).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };   // px: css pixels per virtual unit
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export const PLAY_M = [1, 1.25, 1.5, 1.75, 2];
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const THINK_STEPS = [2, 5, 8, 10];
// the smallest font that still reads as ~11 css px on this screen (virtual units, capped so buttons keep their shape)
export const minFs = () => Math.max(12, Math.min(22, Math.ceil(11 / Math.max(0.3, host.px))));

const R = (x, y, w, h) => ({ x, y, w, h });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// where the dish block sits in design units: x 56..664 (the rim and the tops), y 430..970 (far top sprite to the near rim)
const DESIGN = { cx: 360, top: 430, bottom: 970, w: 604 };
const BAR_H = [[84, 84], [100, 72], [112, 80], [124, 86], [135, 90]];   // per text-size step: [tool buttons, pause row]

const cache = new Map();
export const curLayout = () => layoutFor(VIEW.w, VIEW.h);
export function layoutFor(w, h) {
  w = Math.round(w); h = Math.round(h);
  const key = `${w}x${h}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}`;
  let S = cache.get(key);
  if (!S) { S = build(w, h, { ...host }); S.key = key; cache.set(key, S); if (cache.size > 40) cache.delete(cache.keys().next().value); }
  return S;
}

function build(w, h, ins) {
  const land = w > h, wide = land && w >= h * 1.15;
  const S = { w, h, land, wide, mode: wide ? 'wide' : 'stack', ins };
  const backSz = ins.back ? Math.max(ins.back, 56) : 0;
  S.backBox = ins.back ? R(ins.l, ins.t, backSz + 8, backSz + 8) : R(0, 0, 0, 0);
  const U = S.U = { x0: ins.l, y0: ins.t, x1: w - ins.r, y1: h - ins.b };
  U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  S.ox = Math.max(0, (w - 720) / 2);                 // the 720-wide phone composition, centred
  const bottomLift = Math.max(0, ins.b - 12);

  // ---- flow columns (menus, setup, workshop, settings, result ...) -------------------------------------------------
  const pinY = h - 124 - bottomLift;
  if (!wide) {
    const x = Math.max(S.ox + 40, ins.l + 16), cw = Math.min(640, U.x1 - 16 - x);
    S.col = { x, w: cw, top: ins.back ? Math.max(ins.t, S.backBox.y + S.backBox.h - 60) : ins.t, bottom: h - ins.b, pinned: pinY - 26, pane: null };
    S.pins = { y: pinY, gradY: pinY - 56, start: R(S.ox + 30, pinY, 440, 96), back: R(S.ox + 486, pinY, 204, 96), x0: 0, w };
  } else {
    const cw = clamp(U.w * 0.46, 460, 680), x = U.x1 - cw - 24;
    const paneX = U.x0, paneW = x - 20 - U.x0;
    S.col = { x, w: cw, top: U.y0 + 10, bottom: U.y1 - 10, pinned: U.y1 - 10 - 84 - 14, pane: R(paneX, U.y0, paneW, U.h) };
    const sw = Math.round(cw * 0.64);
    S.pins = { y: U.y1 - 94, gradY: U.y1 - 124, start: R(x, U.y1 - 94, sw, 84), back: R(x + sw + 12, U.y1 - 94, cw - sw - 12, 84), x0: x - 20, w: cw + 40 };
  }

  // ---- the title ---------------------------------------------------------------------------------------------------
  const lockW = 250, lockH = Math.round(250 * 327 / 1200);
  const lockHit = (cx, y) => { const pw = Math.max(lockW, 44 / Math.max(0.3, ins.px || 0.6)), ph = Math.max(lockH, 44 / Math.max(0.3, ins.px || 0.6)); return R(cx - pw / 2, y + lockH / 2 - ph / 2, pw, ph); };
  S.lockup = { w: lockW, h: lockH };
  S.titleGeo = (hasSave) => {
    if (!wide) {
      const bottom = h - ins.b - lockH - 28, need = hasSave ? (h < 1300 ? 540 : 650) : (h < 1300 ? 462 : 556);
      const top = Math.max(300, bottom - need);
      const topPad = Math.max(6, ins.t - 24), k = clamp((top + 10 - topPad) / 690, 0.42, 1.22);
      const artY = topPad + Math.max(0, (top + 10 - topPad - 690 * k) / 2);
      return { flow: { x: S.col.x, w: S.col.w, top, bottom }, art: { cx: w / 2, y: artY, k }, lockup: { cx: w / 2, y: h - ins.b - lockH - 8 }, lockHit: lockHit(w / 2, h - ins.b - lockH - 8), split: false, top };
    }
    const c = S.col, p = c.pane, k = clamp(Math.min((p.w - 16) / 640, (p.h - lockH - 40) / 690), 0.4, 1.25);
    const artH = 690 * k, artY = p.y + Math.max(8, (p.h - lockH - 20 - artH) / 2);
    const ly = U.y1 - lockH - 10, lcx = c.x + c.w / 2;
    return { flow: { x: c.x, w: c.w, top: c.top, bottom: lockHit(lcx, ly).y - 4 }, art: { cx: p.x + p.w / 2, y: artY, k }, lockup: { cx: lcx, y: ly }, lockHit: lockHit(lcx, ly), split: true, top: c.top };
  };
  // the quiet "More heritage games" line under a result column
  S.footLine = wide ? { cx: S.col.x + S.col.w / 2, y: U.y1 - 14 } : { cx: w / 2, y: h - ins.b - 16 };

  // ---- reference pages (About / How to play / Rules) --------------------------------------------------------------
  if (!wide) {
    const ty = Math.max(18, ins.t + 8), top = Math.max(100, ty + 82), ry = h - 116 - bottomLift;
    const pw = 652, px = (w - pw) / 2, rx = (w - 720) / 2;
    S.ref = {
      panel: R(px, top, pw, ry - 14 - top), back: R(rx + 20, ry, 332, 100), next: R(rx + 368, ry, 332, 100),
      dec: R(rx + 720 - 20 - 120 - 12 - 120, ty, 120, 60), inc: R(rx + 720 - 20 - 120, ty, 120, 60), pct: { x: w / 2, y: ty + 40 },
    };
  } else {
    const cw = 214, x = U.x0 + 14, y0 = ins.back ? S.backBox.y + S.backBox.h + 6 : U.y0 + 12;
    const panelX = x + cw + 16, pw = Math.min(U.x1 - 14 - panelX, 1100), px = panelX + (U.x1 - 14 - panelX - pw) / 2;
    S.ref = {
      panel: R(px, U.y0 + 12, pw, U.h - 24), next: R(x, U.y1 - 12 - 92, cw, 92), back: R(x, U.y1 - 12 - 92 - 12 - 92, cw, 92),
      dec: R(x, y0, 100, 60), inc: R(x + 114, y0, 100, 60), pct: { x: x + cw / 2, y: y0 + 60 + 34 },
    };
  }

  // ---- the pause card ----------------------------------------------------------------------------------------------
  const pw = wide ? Math.min(720, U.w - 80) : 660;
  S.pause = { x: (w - pw) / 2, w: pw, top: wide ? U.y0 + 16 : Math.max(70, ins.t + 10), bottom: wide ? U.y1 - 16 : h - Math.max(70, ins.b + 10) };

  // ---- the play screen, per text size ------------------------------------------------------------------------------
  const plays = [];
  // On a tiny squarish window a big text size would leave no room for the dish: step the in-play text down until it fits.
  S.play = (idx) => {
    const i = clamp(idx | 0, 0, PLAY_M.length - 1);
    if (!plays[i]) { let k = i, P = buildPlay(S, k); while (!S.wide && P.xf.s < 0.5 && k > 0) P = buildPlay(S, --k); plays[i] = P; }
    return plays[i];
  };
  return S;
}

function buildPlay(S, idx) {
  const { w, h, ins, U, wide } = S;
  const i = clamp(idx | 0, 0, PLAY_M.length - 1), m = PLAY_M[i], pm = Math.min(m, 1.5);
  const nameFs = 26 * m, numFs = 24 * m, timerFs = 34 * m;
  const P = { idx: i, m, pm, wide, nameFs, numFs, timerFs };
  const [mh, th] = BAR_H[i];
  const twoRow = m >= 1.5;
  const block = (x0, bw, base) => { const barY = base + 8, barH = Math.round(22 * pm), tenY = barY + barH + 7, tenH = Math.round(12 * pm); return { x: x0, w: bw, base, barY, barH, tenY, tenH, bottom: tenY + tenH }; };

  if (!wide) {
    // ---- HUD (the approved phone composition, shifted to clear the notch / the host back button)
    const centerW = Math.round(128 + 60 * (m - 1)), bw = (720 - 48 - centerW) / 2;
    const top0 = 56 - 4.8 * m, dy = Math.max(0, ins.t + 6 - top0, ins.back ? S.backBox.y + S.backBox.h + 2 - top0 : 0);
    const base = 56 + 16 * m + dy;
    const a = block(S.ox + 24, bw, base), b = block(S.ox + 720 - 24 - bw, bw, base);
    const panelH = twoRow ? Math.round(70 * m - 6) : Math.round(58 * m);
    const panel = R(S.ox + 20, Math.round(a.tenY + a.tenH + 20 - 8 * (m - 1)), 680, panelH);
    const hudBottom = panel.y + panel.h;
    P.hud = { sides: [a, b], timer: { cx: w / 2, base: base + 6 * m, w: centerW - 8 }, pips: { cx: w / 2, cy: a.barY + a.barH + 4 + 8 * pm * 0.9, w: centerW } };
    P.panel = panel; P.hudBottom = hudBottom;
    // ---- bottom bar
    const bottom = h - Math.max(i === 0 ? 20 : 18, ins.b + 8), ox = S.ox;
    if (i === 0) {
      const y = bottom - 84;
      P.tools = [0, 1].map((k) => ({ id: k, x: ox + 14 + k * 244, y, w: 236, h: 84 }));
      P.pause = R(ox + 498, y, 208, 84);
      P.watch = { dec: R(ox + 14, y, 132, 84), pause: R(ox + 154, y, 222, 84), inc: R(ox + 384, y, 132, 84), exit: R(ox + 524, y, 182, 84) };
    } else {
      const ty = bottom - th, my = ty - 10 - mh, hw = (720 - 28 - 10) / 2;
      P.tools = [0, 1].map((k) => ({ id: k, x: ox + 14 + k * (hw + 10), y: my, w: hw, h: mh }));
      P.pause = R(ox + 14, ty, 720 - 28, th);
      const pwid = Math.round(hw * 1.2);
      P.watch = { dec: R(ox + 14, my, hw, mh), inc: R(ox + 14 + hw + 10, my, hw, mh), pause: R(ox + 14, ty, pwid, th), exit: R(ox + 14 + pwid + 10, ty, 720 - 28 - pwid - 10, th) };
    }
    P.barTop = Math.min(P.tools[0].y, P.watch.dec.y);
    // ---- the dish: as large as the free zone allows (never wider than the screen), a little high so the pull has room below
    const zoneTop = hudBottom + 10, zoneBot = P.barTop - 10, zh = zoneBot - zoneTop;
    const s = clamp(Math.min((zh - 90) / (DESIGN.bottom - DESIGN.top), (Math.min(w, 760) - 24) / DESIGN.w), 0.45, 1.18);
    const blockH = (DESIGN.bottom - DESIGN.top) * s + 90, top = zoneTop + Math.max(0, (zh - blockH) * 0.38);
    P.xf = { s, tx: w / 2 - DESIGN.cx * s, ty: top - DESIGN.top * s };
    P.field = R(0, zoneTop, w, zh);
    P.fieldBottom = P.barTop - 8;
    P.cap = { x: w / 2 - 320, y: hudBottom + 14, w: 640, h: 200 };
    P.centerW = Math.min(w, 760);
  } else {
    const Cmin = 236;
    const zoneTop = U.y0 + 8, zoneBot = U.y1 - 8, zh = zoneBot - zoneTop;
    const sH = (zh - 88) / (DESIGN.bottom - DESIGN.top), sW = (U.w - 2 * Cmin - 28 - 24) / DESIGN.w;
    const s = clamp(Math.min(sH, sW, 1.2), 0.4, 1.2);
    const arenaW = DESIGN.w * s, centerW = arenaW + 28;
    const Cw = clamp((U.w - centerW - 24) / 2, Cmin, 360);
    const gx0 = U.x0 + (U.w - (2 * Cw + centerW)) / 2;
    const lc = R(gx0, ins.back ? Math.max(zoneTop, S.backBox.y + S.backBox.h + 4) : zoneTop, Cw, 0), rc = R(gx0 + Cw + centerW, zoneTop, Cw, 0);
    lc.h = zoneBot - lc.y; rc.h = zoneBot - rc.y;
    P.cards = [lc, rc];
    const cxS = gx0 + Cw + centerW / 2, pad = 12;
    const blockH = (DESIGN.bottom - DESIGN.top) * s + 88, top = zoneTop + Math.max(0, (zh - blockH) * 0.4);
    P.xf = { s, tx: cxS - DESIGN.cx * s, ty: top - DESIGN.top * s };
    P.field = R(lc.x + lc.w, U.y0, centerW, U.h);
    P.fieldBottom = U.y1 - 6;
    P.centerW = centerW;
    // ---- left card: you, status, hints
    const ix = lc.x + pad, iw = lc.w - 2 * pad, a = block(ix, iw, lc.y + pad + nameFs * 0.95);
    const panelH = Math.round(Math.min(92 * Math.min(m, 1.6), Math.max(70, lc.y + lc.h - a.bottom - 150)));
    P.panel = R(ix, a.bottom + 14, iw, panelH);
    P.hudBottom = P.panel.y + P.panel.h;
    P.cap = { x: ix, y: P.panel.y + P.panel.h + 10, w: iw, h: Math.max(60, lc.y + lc.h - pad - (P.panel.y + P.panel.h + 10)) };
    // ---- right card: rival, clock + round pips, buttons
    const jx = rc.x + pad, jw = rc.w - 2 * pad, b = block(jx, jw, rc.y + pad + nameFs * 0.95);
    P.hud = { sides: [a, b] };
    const tBase = b.bottom + 18 + timerFs * 0.8;
    P.hud.timer = { cx: rc.x + rc.w / 2, base: tBase, w: jw - 8 };
    P.hud.pips = { cx: rc.x + rc.w / 2, cy: tBase + 22 + 8 * pm, w: jw * 0.8 };
    const bTop = P.hud.pips.cy + 16 * pm + 14, avail = rc.y + rc.h - pad - bTop;
    const stack = (n, hh) => { const gp = 10, bh = clamp((avail - gp * (n - 1)) / n, 48, hh); const used = n * bh + (n - 1) * gp, y0 = bTop + Math.max(0, (avail - used) / 2); return Array.from({ length: n }, (_, k) => R(jx, y0 + k * (bh + gp), jw, bh)); };
    const t3 = stack(3, mh), t4 = stack(4, mh);
    P.tools = [{ id: 0, ...t3[0] }, { id: 1, ...t3[1] }]; P.pause = t3[2];
    P.watch = { dec: t4[0], pause: t4[1], inc: t4[2], exit: t4[3] };
    P.barTop = U.y1;
  }
  // ---- the dish, in screen terms
  const { s, tx, ty } = P.xf;
  const gaugeTop = ty + (ARENA.cy + (ARENA.R + 40) * ARENA.sy + 6) * s, gw = Math.min(580, P.centerW - 10);
  const gBottom = P.fieldBottom - 4;
  P.gauge = R(tx + DESIGN.cx * s - gw / 2, gaugeTop, gw, Math.max(56, Math.min(104, gBottom - gaugeTop)));
  // how far a finger can pull back (design units) before the bar, the HUD or the screen edge is in the way
  const anchor = (side) => ty + (ARENA.cy + (side === 0 ? 1 : -1) * 0.74 * ARENA.R * ARENA.sy) * s;
  P.pullMax = [Math.max(110, Math.min(230, (P.fieldBottom - 10 - anchor(0)) / s)), Math.max(110, Math.min(230, (anchor(1) - (wide ? U.y0 + 8 : P.hudBottom + 8)) / s))];
  P.dishC = { x: tx + ARENA.cx * s, y: ty + ARENA.cy * s };
  P.toDesign = (x, y) => ({ x: (x - tx) / s, y: (y - ty) / s });
  return P;
}
