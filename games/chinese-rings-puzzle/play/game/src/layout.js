// Geometry as a function of the LIVE screen size (kit fluid viewport: the short side is always 720 units, the long side follows the screen).
// `layoutFor(w, h, n)` returns every rectangle for that size and ring count; it is cached, so a frame never recomputes it.
//   portrait   top block (chips + message, or the lesson text), the scene (bar and rings) as wide as the screen allows, the pattern lamps, the buttons
//   landscape  the scene across the top, a band below it: chips on the left, message + lamps in the middle, buttons on the right
import { sceneGeom } from './art.js';
export const THINK_STEPS = [2, 5, 8, 10];
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export const R = (x, y, w, h) => ({ x, y, w, h });
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Safe areas and the host's floating back button, in virtual units. main.js keeps this current (browsers: all zero).
// px = css pixels per virtual unit (type never goes below ~11 css px); dpr = device pixel ratio (sprite resolution).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6, dpr: 2 };

const cache = new Map();
export function layoutFor(w, h, n = 5) {
  w = Math.round(w); h = Math.round(h);
  const key = `${w}x${h}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}|${n}`;
  let L = cache.get(key);
  if (!L) { L = build(w, h, { ...host }, n); L.key = key; cache.set(key, L); if (cache.size > 60) cache.delete(cache.keys().next().value); }
  return L;
}

function build(w, h, ins, n) {
  const land = w >= h, G = sceneGeom(n), L = { w, h, land, ins, n, G };
  const backSz = ins.back ? Math.max(ins.back, 56) : 0;
  L.backBox = ins.back ? R(ins.l, ins.t, backSz + 8, backSz + 8) : R(0, 0, 0, 0);
  const U = L.U = { x0: ins.l, y0: ins.t, x1: w - ins.r, y1: h - ins.b };
  U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  const BH = clamp(Math.round(50 / (ins.px || 0.6)), 62, 84), GAP = 12;
  L.BH = BH;
  const place = (rect, k) => { const sw = G.W * k, sh = G.H * k; L.sc = { ox: rect.x + (rect.w - sw) / 2, oy: rect.y + (rect.h - sh) / 2, k, G }; L.scene = R(L.sc.ox, L.sc.oy, sw, sh); };
  if (!land) {
    const pad = 12, backRes = ins.back ? 62 : 0, top0 = Math.max(ins.t + 8, backRes ? ins.t + backRes : 0);
    const TB = clamp(Math.round(U.h * 0.17), 150, 230), lampsH = 64, barY = h - Math.max(ins.b, 10) - BH - 12, pw = U.w - 2 * pad;
    const availH = barY - GAP - top0 - TB - lampsH - 3 * GAP;
    const k = Math.min(pw / G.W, availH / G.H, 2.5);
    const sceneH = G.H * k, free = Math.max(0, availH - sceneH), air = free / 4;
    let y = top0 + air * 0.6;
    L.top = R(U.x0 + pad, y, pw, TB);                                      // chips + message (play) / lesson text
    L.chips = [0, 1, 2].map((i) => { const cw = (pw - 2 * GAP) / 3; return R(L.top.x + i * (cw + GAP), L.top.y, cw, Math.min(92, TB * 0.5)); });
    L.msg = R(L.top.x, L.top.y + Math.min(92, TB * 0.5) + GAP, pw, TB - Math.min(92, TB * 0.5) - GAP);
    y += TB + GAP + air * 1.3;
    place(R(U.x0 + pad, y, pw, sceneH), k);
    y += sceneH + GAP + air * 1.1;
    L.lamps = R(U.x0 + pad, y, pw, lampsH);
    L.lessonBox = L.top;
    const bw = (U.w - 2 * pad - 3 * 14) / 4;
    L.BTN = { menu: R(U.x0 + pad, barY, bw, BH), undo: R(U.x0 + pad + (bw + 14), barY, bw, BH), hint: R(U.x0 + pad + 2 * (bw + 14), barY, bw, BH), restart: R(U.x0 + pad + 3 * (bw + 14), barY, bw, BH) };
    L.BTN.auto = { exit: R(U.x0 + pad, barY, bw, BH), pause: L.BTN.undo, dec: L.BTN.hint, inc: L.BTN.restart };
    L.layoutKind = 'portrait';
  } else {
    const pad = 12, bandH = clamp(Math.round(U.h * 0.3), 150, 250);
    const topY = ins.back ? Math.max(U.y0 + 8, L.backBox.y + 40) : U.y0 + 8;
    const availH = U.y1 - bandH - 16 - topY, availW = U.w - 2 * pad;
    const k = Math.min(availW / G.W, availH / G.H, 2.4);
    place(R(U.x0 + pad, topY, availW, availH), k);
    const by = U.y1 - bandH - 8, bw = U.w - 2 * pad;
    L.band = R(U.x0 + pad, by, bw, bandH);
    const lw = Math.min(520, bw * 0.4), rw = Math.min(380, bw * 0.28), mw = bw - lw - rw - 2 * GAP;
    const chipH = Math.min(92, bandH * 0.5), cw = (lw - 2 * GAP) / 3;
    L.chips = [0, 1, 2].map((i) => R(L.band.x + i * (cw + GAP), L.band.y, cw, chipH));
    L.lamps = R(L.band.x, L.band.y + chipH + GAP, lw, bandH - chipH - GAP);
    L.msg = R(L.band.x + lw + GAP, L.band.y, mw, bandH);
    const rx = L.band.x + lw + mw + 2 * GAP, bh = Math.min(BH, (bandH - GAP) / 2), bw2 = (rw - GAP) / 2;
    L.BTN = { menu: R(rx, L.band.y, bw2, bh), undo: R(rx + bw2 + GAP, L.band.y, bw2, bh), hint: R(rx, L.band.y + bh + GAP, bw2, bh), restart: R(rx + bw2 + GAP, L.band.y + bh + GAP, bw2, bh) };
    L.BTN.auto = { exit: L.BTN.menu, pause: L.BTN.undo, dec: L.BTN.hint, inc: L.BTN.restart };
    const lampRow = Math.min(56, bandH * 0.3);
    L.lessonBox = R(L.band.x, L.band.y, lw + mw + GAP, bandH - lampRow - GAP);
    L.lessonLamps = R(L.band.x, L.band.y + bandH - lampRow, lw, lampRow);
    L.layoutKind = 'landscape';
    L.rightCard = R(rx - 8, L.band.y - 4, rw + 16, bandH + 8);
  }
  // which ring does a press at (x, y) mean? the ring whose column it is in (anywhere between the top of the scene and the base)
  const sc = L.sc;
  L.ringAt = (px, py) => {
    const gx = (px - sc.ox) / sc.k, gy = (py - sc.oy) / sc.k;
    if (gy < -20 || gy > G.baseTop + 40) return -1;
    let best = -1, bd = G.p * 0.62;
    for (let i = 0; i < n; i++) { const d = Math.abs(gx - G.ringX(i)); if (d < bd) { bd = d; best = i; } }
    return best;
  };
  L.ringXY = (i, pos = 1) => ({ x: sc.ox + G.ringX(i) * sc.k, y: sc.oy + (G.yOff + (G.barY - G.yOff) * pos) * sc.k });
  const cw = clamp(Math.min(U.w - 40, 560), 300, 600), ch = land ? Math.min(U.h - 30, 600) : Math.min(700, U.h - 60);
  L.over = { card: R(U.x0 + (U.w - cw) / 2, U.y0 + (U.h - ch) / 2, cw, ch) };
  const ow = cw - 80;
  L.over.again = R(L.over.card.x + 40, L.over.card.y + ch - 40 - 84 - 12 - 84 - 46, ow, 84);
  L.over.back = R(L.over.card.x + 40, L.over.card.y + ch - 40 - 84 - 46, ow, 84);
  L.BTN.again = L.over.again; L.BTN.back = L.over.back;
  L.BTN.next = R(L.BTN.undo.x, L.BTN.undo.y, L.BTN.hint.x + L.BTN.hint.w - L.BTN.undo.x, L.BTN.undo.h);
  if (land) L.BTN.next = L.BTN.undo;
  L.title = (hasSave) => buildTitle(L, !!hasSave);
  L.doc = buildDoc(L);
  return L;
}

// ---------------------------------------------------------------- title
const titleCache = new WeakMap();
function buildTitle(L, hasSave) {
  const memo = titleCache.get(L) || {}; titleCache.set(L, memo);
  if (memo[hasSave]) return memo[hasSave];
  const { w, h, U, ins } = L, T = { rows: {}, hero: null, card: null, lockup: null };
  const names = [hasSave ? ['resume'] : null, ['play'], ['setup'], ['learn', 'auto'], ['rules', 'how'], ['about', 'settings']].filter(Boolean);
  const n = names.length;
  const place = (x0, aw, y0, pitch, bh) => names.forEach((row, i) => {
    const y = y0 + i * pitch;
    if (row[0] === 'setup') {                                   // mode toggle (left) and ring count stepper (right)
      const cw = (aw - 12) / 2; T.rows.mode = R(x0, y, cw, bh);
      const sw = Math.min(bh, 64); T.rows.ringsMinus = R(x0 + cw + 12, y, sw, bh); T.rows.ringsPlus = R(x0 + aw - sw, y, sw, bh); T.rows.ringsLabel = R(x0 + cw + 12 + sw, y, cw - 2 * sw, bh);
    } else if (row.length === 1) T.rows[row[0]] = R(x0, y, aw, bh);
    else { const cw = (aw - 12) / 2; T.rows[row[0]] = R(x0, y, cw, bh); T.rows[row[1]] = R(x0 + cw + 12, y, cw, bh); }
  });
  if (!L.land) {
    const lock = 64, bottom = h - Math.max(14, ins.b + 6), bw = Math.min(U.w - 56, 560);
    const minP = clamp(Math.round(46 / (ins.px || 0.6)) + 12, 58, 98);
    const pitch = clamp((bottom - lock - (U.y0 + 430)) / n, minP, 98), bh = pitch - 12;
    const y0 = bottom - lock - n * pitch + 12;
    place(U.x0 + (U.w - bw) / 2, bw, y0, pitch, bh);
    T.lockup = { x: w / 2, y: bottom - 14 };
    const zoneTop = Math.max(ins.t + 8, ins.back ? ins.t + 60 : 0), zone = y0 - 12 - zoneTop;
    T.hero = R(U.x0 + 10, zoneTop, U.w - 20, zone);
  } else {
    const aw = clamp(w * 0.38, 380, 560), ax = U.x1 - aw - 16, lock = 56;
    const pitch = Math.min(88, (U.h - 40 - lock) / n), bh = pitch - 12, y0 = U.y0 + (U.h - n * pitch - lock) / 2 + 6;
    place(ax + 24, aw - 48, y0, pitch, bh);
    T.card = R(ax, y0 - 24, aw, n * pitch + lock + 28);
    T.lockup = { x: ax + aw / 2, y: T.card.y + T.card.h - 14 };
    T.hero = R(U.x0 + 10, U.y0 + 10, ax - U.x0 - 30, U.h - 20);
  }
  memo[hasSave] = T;
  return T;
}

// ---------------------------------------------------------------- scrolling documents (Rules, How to Play, About, Settings)
function buildDoc(L) {
  const { h, U, ins } = L, BH = 84, barY = h - Math.max(ins.b, 10) - BH - 12;
  const pw = Math.min(U.w - 28, 1000), px = U.x0 + (U.w - pw) / 2, py = Math.max(14, ins.t + 6, ins.back && !L.land ? ins.t + 62 : 0);
  const panel = R(px, py, pw, barY - 12 - py);
  const nw = Math.min(262, (pw - 16) / 2), navX = U.x0 + (U.w - (2 * nw + 16)) / 2;
  const headH = 84;
  const viewport = R(panel.x + 18, panel.y + headH + 8, panel.w - 36 - 14, panel.h - headH - 8 - 44);
  const hb = Math.min(104, panel.w * 0.16);
  return {
    panel, viewport, nav: { back: R(navX, barY, nw, BH), next: R(navX + nw + 16, barY, nw, BH) },
    header: { textDec: R(panel.x + panel.w - 18 - hb * 2 - 10, panel.y + 12, hb, 62), textInc: R(panel.x + panel.w - 18 - hb, panel.y + 12, hb, 62) },
    scrollbar: R(panel.x + panel.w - 30, viewport.y, 22, viewport.h), counterY: panel.y + panel.h - 16, cx: panel.x + panel.w / 2,
    bodyW: Math.min(viewport.w - 28, 860),
  };
}
