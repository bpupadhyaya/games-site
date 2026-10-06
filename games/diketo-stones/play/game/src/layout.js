// Screen geometry: one place for every rectangle so game.js (hit-testing) and view.js / menus.js (drawing) never disagree.
// FLUID (kit 1.7.x): the SHORT side of the screen is always 720 units and the long side follows the aspect ratio, so every
// position is a function of the live size `meta.width x meta.height` (the kit updates `meta` on every resize / rotation).
// Nothing here is cached across sizes except by size key, and no module keeps rectangles that belong to one size.
//   play: 'tall'    portrait phone (h >= 1240): HUD on top, the yard in the middle, toss pad + buttons below (the approved look)
//         'compact' portrait but shorter (tablets): the same, with slimmer HUD rows and a slimmer bar
//         'wide'    landscape: left panel (players, stage, coach), the yard in the middle as tall as it can be, right panel (toss pad + buttons)
// The yard is drawn in its own 660 x 800 world, uniformly scaled.
import { WORLD } from './sim.js';

export const meta = { width: 720, height: 1280, fluid: { short: 720 } };
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const R = (x, y, w, h) => ({ x, y, w, h });

// Safe areas and the host's floating back button, in virtual units. main.js keeps this current (browsers: all zero).
// `px` = css pixels per virtual unit, so text can be kept at 11 css px or more (`minU()` = that size in units).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };
// Room under the top inset for the kit's top-centre "Preview m:ss" pill (it sits 6 css px below the inset and is about 20 css px tall).
const badgeRoom = () => { const k = Math.max(0.3, host.px || 0.6); return Math.ceil(6 / k + 1.7 * Math.max(16, 11.5 / k)) + 4; };
export const minU = () => Math.max(11, 11.3 / Math.max(0.2, host.px));

const hostKey = () => `${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}`;
const cacheOf = new Map();
const memo = (key, build) => {
  let v = cacheOf.get(key);
  if (!v) { v = build(); cacheOf.set(key, v); if (cacheOf.size > 80) cacheOf.delete(cacheOf.keys().next().value); }
  return v;
};

// The screen as a whole: the area clear of notch and home indicator, and the box of the host's back button.
export function screenOf(w = meta.width, h = meta.height) {
  w = Math.round(w); h = Math.round(h);
  return memo(`s|${w}x${h}|${hostKey()}`, () => {
    const U = { x0: host.l, y0: host.t, x1: w - host.r, y1: h - host.b };
    U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
    const bs = host.back ? Math.max(host.back, 56) + 8 : 0;
    const back = bs ? R(host.l, host.t, bs, bs) : R(0, 0, 0, 0);
    return { w, h, land: w >= h, U, back, hasBack: !!bs };
  });
}

// The play screen follows the text size (100-300%) with a gentler multiplier PLAY_M, so the yard stays playable.
export const PLAY_M = [1, 1.25, 1.5, 1.75, 2];
export function playLayout(idx = 0, w = meta.width, h = meta.height) {
  const i = clamp(idx | 0, 0, PLAY_M.length - 1);
  w = Math.round(w); h = Math.round(h);
  return memo(`p|${i}|${w}x${h}|${hostKey()}`, () => buildPlay(i, w, h));
}

function buildPlay(i, w, h) {
  const m = PLAY_M[i], S = screenOf(w, h), U = S.U, bb = S.back;
  const L = { idx: i, m, w, h, land: S.land, mode: S.land ? 'wide' : h >= 1240 ? 'tall' : 'compact' };
  const g = 14;
  if (L.mode === 'wide') return buildWide(L, m, S, U, bb, g);
  const clearLeft = (y) => (S.hasBack && y < bb.y + bb.h ? Math.max(U.x0 + g, bb.x + bb.w + 6) : U.x0 + g);
  // ---- portrait: HUD, bar, yard between
  const k = L.mode === 'tall' ? 1 : 0.84;                       // compact rows are slimmer
  const cardH = Math.round(70 * m * k), stripH = Math.round(40 * m * k), coachH = Math.round((m >= 1.5 ? 78 : 50) * Math.min(m, 1.6) * (L.mode === 'tall' ? 1 : 0.9));
  const cardY = U.y0 + Math.max(host.t > 0 ? 12 : 40, badgeRoom()), stripY = cardY + cardH + 8, coachY = stripY + stripH + 6;
  const hudBottom = coachY + coachH;
  const x0 = U.x0 + g, bandW = U.w - 2 * g;
  const cx0 = clearLeft(cardY), cw = (U.x1 - g - cx0 - 10) / 2;
  L.cards = [R(cx0, cardY, cw, cardH), R(cx0 + cw + 10, cardY, cw, cardH)];
  const sx = clearLeft(stripY), cox = clearLeft(coachY);
  L.strip = R(sx, stripY, U.x1 - g - sx, stripH);
  L.coach = R(cox, coachY, U.x1 - g - cox, coachH);
  L.hudBottom = hudBottom;
  const btnH = Math.round((L.mode === 'tall' ? 84 : 64) * Math.min(m, 1.5)), padH = Math.round((L.mode === 'tall' ? 112 : 96) * (1 + (m - 1) * 0.45));
  const bottom = U.y1 - 16, btnY = bottom - btnH, padY = btnY - 10 - padH;
  const bw = (bandW - 10) / 2;
  L.think = R(x0, btnY, bw, btnH); L.pause = R(x0 + bw + 10, btnY, bw, btnH);
  const qw = (bandW - 30) / 4;
  L.watch = { dec: R(x0, btnY, qw, btnH), pause: R(x0 + qw + 10, btnY, qw, btnH), inc: R(x0 + 2 * (qw + 10), btnY, qw, btnH), exit: R(x0 + 3 * (qw + 10), btnY, qw, btnH) };
  L.pad = R(x0, padY, bandW, padH);
  L.barTop = padY;
  const top = hudBottom + 8, availH = padY - 8 - top, availW = U.w - 20;
  const s = Math.min(availW / WORLD.w, availH / WORLD.h, 1.06);
  L.view = { s, ox: U.x0 + 10 + (availW - WORLD.w * s) / 2, oy: top + (availH - WORLD.h * s) / 2 };
  L.field = R(U.x0, hudBottom, U.w, padY - hudBottom);
  L.hintBox = { x: U.x0 + 22, w: U.w - 44, bottom: padY - 14, maxH: Math.max(200, padY - 8 - (hudBottom + 8) - 20) };
  L.bannerC = { cx: U.x0 + U.w / 2, w: Math.min(U.w - 120, 600), y: hudBottom + 40 + (padY - hudBottom - 80) * 0.3 };
  L.panels = null;
  return L;
}

function buildWide(L, m, S, U, bb, g) {
  const minPW = 196, maxPW = 430;
  const sH = (U.h - 2 * g) / WORLD.h, sW = (U.w - 2 * minPW - 6 * g) / WORLD.w;
  const s = Math.max(0.3, Math.min(sH, sW, 1.2));
  const yardW = WORLD.w * s, yardH = WORLD.h * s;
  const pw = clamp((U.w - yardW - 6 * g) / 2, minPW, maxPW);
  const total = 2 * pw + yardW + 6 * g, sx = U.x0 + (U.w - total) / 2;
  const lx = sx + g, yx = lx + pw + 2 * g, rx0 = yx + yardW + 2 * g;
  const mm = Math.min(m, 1.6);
  // ---- left panel: two player cards, the stage strip, the coach line
  const topY = U.y0 + g + (S.hasBack && lx < bb.x + bb.w + 6 ? bb.h : 0);
  const cardH = Math.round(66 * mm), stripH = Math.round(72 * mm);
  L.cards = [R(lx, topY, pw, cardH), R(lx, topY + cardH + 8, pw, cardH)];
  const stripY = topY + 2 * cardH + 16;
  L.strip = R(lx, stripY, pw, stripH);
  const coachY = stripY + stripH + 8;
  L.coach = R(lx, coachY, pw, Math.max(64, Math.min(U.y1 - g - coachY, 300)));
  L.hudBottom = coachY;
  // ---- right panel: the toss pad (as tall as it may be) and the buttons under it
  const bw = pw, btnH = Math.round(60 * Math.min(m, 1.5)), bottom = U.y1 - g;
  L.pause = R(rx0, bottom - btnH, bw, btnH);
  L.think = R(rx0, bottom - 2 * btnH - 10, bw, btnH);
  const hw = (bw - 10) / 2;
  L.watch = { dec: R(rx0, bottom - 2 * btnH - 10, hw, btnH), inc: R(rx0 + hw + 10, bottom - 2 * btnH - 10, hw, btnH), pause: R(rx0, bottom - btnH, hw, btnH), exit: R(rx0 + hw + 10, bottom - btnH, hw, btnH) };
  const padTop = U.y0 + g, padBottom = L.think.y - 12, padH = clamp(padBottom - padTop, 120, Math.round(430 * (1 + (m - 1) * 0.3)));
  L.pad = R(rx0, padBottom - padH, bw, padH);
  L.barTop = L.pad.y;
  L.view = { s, ox: yx, oy: U.y0 + (U.h - yardH) / 2 };
  L.field = R(lx + pw + g, U.y0, yardW + 2 * g, U.h);
  L.hintBox = { x: yx, w: yardW, bottom: U.y0 + (U.h + yardH) / 2 - 10, maxH: Math.max(200, yardH * 0.62) };
  L.bannerC = { cx: yx + yardW / 2, w: Math.min(yardW - 20, 600), y: U.y0 + (U.h - yardH) / 2 + yardH * 0.3 };
  L.panels = [R(lx - 6, U.y0 + 4, pw + 12, U.h - 8), R(rx0 - 6, U.y0 + 4, bw + 12, U.h - 8)];
  return L;
}
export const toWorld = (v, x, y) => ({ x: (x - v.ox) / v.s, y: (y - v.oy) / v.s });
export const toScreen = (v, x, y) => ({ x: v.ox + x * v.s, y: v.oy + y * v.s });

// ---- menu screens ---------------------------------------------------------------------------------------------
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const THINK_STEPS = [2, 5, 8, 10];

// The column the flow screens (title, setup, lessons, settings, result, demo limit) lay their widgets in. `pinned` screens
// (setup, lesson intro) keep a Start / Back bar at the bottom. The title in landscape uses the right half for its buttons.
export const LOCK_H = 68, LOCK_STRIP = LOCK_H + 30;
export function flowFrame(key, w = meta.width, h = meta.height) {
  const S = screenOf(w, h), U = S.U, bb = S.back;
  return memo(`f|${key}|${S.w}x${S.h}|${hostKey()}`, () => {
    const pinned = key === 'setup' || key === 'lessonintro';
    let cw = Math.min(640, U.w - 40), x0 = U.x0 + (U.w - cw) / 2, top = U.y0, bottom = U.y1, split = false, hero = null;
    if (key === 'title' && S.land && U.w >= 900) {
      // landscape title: art on the left half, buttons on the right
      split = true;
      const half = U.w / 2;
      cw = Math.min(560, half - 50); x0 = U.x0 + half + (half - cw) / 2;
      hero = R(U.x0, U.y0, half, U.h);
    } else if (key !== 'title' && S.hasBack && x0 < bb.x + bb.w + 6) top = bb.y + bb.h - 6;
    // two columns for the long option lists on a wide landscape screen
    let cols = null;
    if ((key === 'setup' || key === 'settings' || key === 'lessons') && S.land && U.w >= 900) {
      const cwid = Math.min(500, (U.w - 80) / 2), gap = 24, x1 = U.x0 + (U.w - 2 * cwid - gap) / 2;
      cols = [{ x: x1, w: cwid }, { x: x1 + cwid + gap, w: cwid }]; x0 = x1; cw = 2 * cwid + gap;
    }
    if (key === 'title') bottom = U.y1 - LOCK_STRIP;   // the Arcforge lockup lives in the strip under the menu (pinned there when the menu scrolls)
    let pins = null;
    if (pinned) {
      const pw = Math.min(660, U.w - 40), px0 = U.x0 + (U.w - pw) / 2, ph = S.land && S.h < 800 ? 72 : 96, py = U.y1 - 24 - ph;
      const st = Math.round((pw - 16) * 0.68);
      pins = { start: R(px0, py, st, ph), back: R(px0 + st + 16, py, pw - st - 16, ph), y: py };
      bottom = py - 18;
    }
    return { x: x0, w: cw, top, bottom, pins, split, hero, cols, land: S.land };
  });
}
export const pinFrame = (w = meta.width, h = meta.height) => flowFrame('setup', w, h).pins;

// The pause sheet: a centred panel with its own scrolling column.
export function pauseFrame(w = meta.width, h = meta.height) {
  const S = screenOf(w, h), U = S.U;
  return memo(`pz|${S.w}x${S.h}|${hostKey()}`, () => {
    const pw = Math.min(660, U.w - 40), px = U.x0 + (U.w - pw) / 2, edge = S.land ? 18 : 70;
    return { panel: R(px, U.y0 + edge, pw, U.h - 2 * edge), x: px + 30, w: pw - 60, top: U.y0 + edge + 6, bottom: U.y1 - edge - 6, px, pw };
  });
}

// About / How to play / Rules: a panel with a header (title, A- / A+) and one scrolling body, and a Close button below.
export function refFrame(w = meta.width, h = meta.height) {
  const S = screenOf(w, h), U = S.U, bb = S.back;
  return memo(`r|${S.w}x${S.h}|${hostKey()}`, () => {
    const pw = Math.min(S.land ? 900 : 652, U.w - 68), px = U.x0 + (U.w - pw) / 2;
    const short = S.land && S.h < 800;                 // phone landscape: Close joins the header so the text gets the height
    const closeH = short ? 56 : 92, cw = Math.min(680, pw);
    let py = U.y0 + 14;
    if (S.hasBack && !S.land) py = Math.max(py, bb.y + bb.h + 2);
    const head = short ? 80 : S.hasBack && S.land && px < bb.x + bb.w + 6 ? Math.max(96, bb.y + bb.h - py + 4) : 96;
    const close = short ? R(0, py + 12, 140, closeH) : R(U.x0 + (U.w - cw) / 2, U.y1 - 16 - closeH, cw, closeH);
    const panel = short ? R(px, py, pw, U.y1 - 10 - py) : R(px, py, pw, close.y - 14 - py);
    const bwid = 64, pctW = 76, bh = 56, right = px + pw - 16, hy = py + (short ? 12 : 16);
    const inc = R(right - bwid, hy, bwid, bh), pct = R(right - bwid - pctW, hy, pctW, bh), dec = R(right - 2 * bwid - pctW, hy, bwid, bh);
    if (short) close.x = dec.x - 14 - close.w;
    const titleR = short ? close.x : dec.x;
    return { panel, rTop: py + head, rBottom: panel.y + panel.h - 18, close, dec, inc, pct, titleCx: (px + titleR) / 2 + (S.hasBack && S.land && px < bb.x + bb.w + 6 ? 20 : 0), titleR, head, short };
  });
}
