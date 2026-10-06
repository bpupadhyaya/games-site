// Screen geometry: one place for every rectangle so game.js (hit-testing) and view.js (drawing) never disagree.
// FLUID LAYOUT (kit 1.7.1): the short side of the screen is always 720 virtual units, the long side follows the real aspect, in
// portrait and in landscape. Every rectangle below is a pure function of the LIVE size (`screen`, set by game.js each frame from
// meta.width/height) and of the host's safe insets / floating back button (`host`, kept current by main.js; browsers: zeros).
//   portrait  the approved phone look: two player cards, stage strip and coach on top, the mat, the toss pad and a button row below.
//   landscape the mat in the middle; the HUD (cards, stage, coach) in a left column; buttons and the toss pad in a right column.
// The mat is drawn in its own 660 x 800 world, scaled to the free area.
import { WORLD } from './sim.js';

export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };   // px: css pixels per virtual unit
export const screen = { w: 720, h: 1280 };
export function setScreen(w, h) { w = Math.round(w); h = Math.round(h); if (w > 0 && h > 0) { screen.w = w; screen.h = h; } }
export const isWide = () => screen.w > screen.h;
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
const R_ = (x, y, w, h) => ({ x, y, w, h });
const clampN = (v, a, b) => Math.max(a, Math.min(b, v));

// The area clear of the notch / home indicator, and the corner taken by the host's floating back button (zeros when there is none).
export const safeArea = (w = screen.w, h = screen.h) => ({ x0: host.l, y0: host.t, x1: w - host.r, y1: h - host.b, w: w - host.l - host.r, h: h - host.t - host.b });
// Room under the top inset for the kit's top-centre "Preview m:ss" pill (it sits 6 css px below the inset and is about 20 css px tall).
export const badgeRoom = () => { const k = Math.max(0.3, host.px || 0.6); return Math.ceil(6 / k + 1.7 * Math.max(16, 11.5 / k)) + 4; };
export const backClear = () => (host.back > 0 ? { r: host.l + host.back + 16, b: host.t + host.back + 8 } : { r: 0, b: 0 });
const hostKey = () => `${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}`;
const memo = (cache, key, build) => { let v = cache.get(key); if (!v) { v = build(); cache.set(key, v); if (cache.size > 40) cache.delete(cache.keys().next().value); } return v; };

// The play screen follows the text size (100-300%) with a gentler multiplier PLAY_M, so the mat stays playable.
// Every text is fitted to its slot; at the larger sizes the mat shrinks a little to make room.
export const PLAY_M = [1, 1.25, 1.5, 1.75, 2];

const playCache = new Map();
export function playLayout(idx, w = screen.w, h = screen.h) {
  const i = Math.max(0, Math.min(PLAY_M.length - 1, idx | 0));
  return memo(playCache, `${i}|${w}x${h}|${hostKey()}`, () => {
    if (w > h) return buildWide(i, w, h);
    // portrait: the HUD follows the text size, but never so much that the mat (the game itself) drops below ~0.62 scale on a short screen
    let L = buildTall(i, w, h, PLAY_M[i]);
    for (let m = PLAY_M[i] - 0.05; L.view.s < 0.62 && m >= 1; m -= 0.05) L = buildTall(i, w, h, m);
    return L;
  });
}

// Portrait: the approved phone look. Extra height (taller phones) goes to the mat. With a host back button the rows that sit beside it start to its right.
function buildTall(i, w, h, m) {
  const U = safeArea(w, h), bc = backClear();
  const cardH = Math.round(70 * m), stripH = Math.round(40 * m), coachH = Math.round((m >= 1.5 ? 78 : 50) * Math.min(m, 1.6));
  const cardY = Math.max(40, U.y0 + badgeRoom()), stripY = cardY + cardH + 8, coachY = stripY + stripH + 6;
  const hudBottom = coachY + coachH;
  const lx = (y) => (bc.r && y < bc.b ? bc.r : U.x0 + 14), rx = U.x1 - 14;
  const c0x = lx(cardY), cw = (rx - c0x - 12) / 2;
  const cards = [R_(c0x, cardY, cw, cardH), R_(rx - cw, cardY, cw, cardH)];
  const strip = R_(lx(stripY), stripY, rx - lx(stripY), stripH);
  const coach = R_(lx(coachY), coachY, rx - lx(coachY), coachH);
  const x0 = U.x0 + 14, span = rx - x0;
  const btnH = Math.round(84 * Math.min(m, 1.5)), padH = Math.round(112 * (1 + (m - 1) * 0.45));
  const bottom = Math.min(h - 16, U.y1 - 8), btnY = bottom - btnH, padY = btnY - 10 - padH;
  const bw = (span - 20) / 3;
  const think = R_(x0, btnY, bw, btnH), clear = R_(x0 + bw + 10, btnY, bw, btnH), pause = R_(x0 + 2 * (bw + 10), btnY, bw, btnH);
  const qw = (span - 30) / 4;
  const q = (k) => R_(x0 + k * (qw + 10), btnY, qw, btnH);
  const watch = { dec: q(0), pause: q(1), inc: q(2), exit: q(3) };
  const pad = R_(x0, padY, span, padH);
  const top = hudBottom + 8, availH = padY - 8 - top, availW = U.w - 20;
  const s = Math.max(0.2, Math.min(availW / WORLD.w, availH / WORLD.h, 1.06));
  const view = { s, ox: U.x0 + 10 + (availW - WORLD.w * s) / 2, oy: top + (availH - WORLD.h * s) / 2 };
  return {
    mode: 'tall', idx: i, m, cards, strip, coach, hudBottom, pad, watchPad: pad, think, clear, pause, watch, view, barTop: padY,
    hudRect: R_(0, 0, w, hudBottom), world: R_(U.x0, hudBottom, U.w, padY - hudBottom),
    hint: { x: U.x0 + 22, w: U.w - 44, bottom: padY - 14, maxH: Math.max(160, (padY - 8) - (hudBottom + 8) - 20) },
    banner: { x: U.x0 + 60, w: U.w - 120, cy: hudBottom + 40 + (padY - hudBottom - 80) * 0.3 },
  };
}

// Landscape: left column = HUD, middle = the mat, right column = buttons on top and the toss pad (thumb reach) below.
function buildWide(i, w, h) {
  const m = Math.min(PLAY_M[i], 1.35), U = safeArea(w, h), bc = backClear();
  const gap = 12, colMin = 208, colMax = 380;
  const mt = Math.max(U.y0 + badgeRoom(), 40), mb = U.y1 - 10;                       // mt clears the kit's top-centre preview chip
  let s = Math.min((mb - mt) / WORLD.h, 1.06);
  s = Math.max(0.2, Math.min(s, (U.w - 2 * colMin - 4 * gap) / WORLD.w));
  const matW = WORLD.w * s, matH = WORLD.h * s;
  const colW = clampN((U.w - matW - 4 * gap) / 2, colMin, colMax);
  const x0 = U.x0 + (U.w - (2 * colW + matW + 4 * gap)) / 2;
  const lcx = x0 + gap, matX = lcx + colW + gap, rcx = matX + matW + gap;
  const matY = mt + (mb - mt - matH) / 2;
  const view = { s, ox: matX, oy: matY };
  // ---- left column: two stacked cards, the stage strip, the coach line
  const leftTop = bc.r && lcx < bc.r ? Math.max(mt, bc.b + 6) : mt;
  const cardH = Math.round(82 * m), stripH = Math.round(92 * m), coachH = Math.round(124 * Math.min(m, 1.4));
  const cards = [R_(lcx, leftTop, colW, cardH), R_(lcx, leftTop + cardH + 8, colW, cardH)];
  const stripY = leftTop + 2 * cardH + 16, strip = R_(lcx, stripY, colW, stripH);
  const coachY = stripY + stripH + 8, coach = R_(lcx, coachY, colW, coachH);
  const hudBottom = coachY + coachH;
  // ---- right column
  const btnH = Math.round(clampN((mb - mt - 14 - 150 - 30) / 4, 56, 80 * Math.min(m, 1.2)));
  const slot = (k) => R_(rcx, mt + k * (btnH + 10), colW, btnH);
  const think = slot(0), clear = slot(1), pause = slot(2);
  const watch = { dec: slot(0), pause: slot(1), inc: slot(2), exit: slot(3) };
  const padFor = (n) => { const top = mt + n * (btnH + 10) + 2, ph = Math.min(mb - top, 360); return R_(rcx, mb - ph, colW, ph); };
  const pad = padFor(3), watchPad = padFor(4);
  const barTop = Math.min(pad.y, watchPad.y);
  return {
    mode: 'wide', idx: i, m, cards, strip, coach, hudBottom, pad, watchPad, think, clear, pause, watch, view, barTop,
    hudRect: R_(lcx - gap / 2, leftTop - 4, colW + gap, hudBottom - leftTop + 8), world: R_(matX - 4, matY - 4, matW + 8, matH + 8),
    hint: { x: matX + 6, w: matW - 12, bottom: matY + matH - 14, maxH: matH * 0.62 },
    banner: { x: matX + 6, w: matW - 12, cy: matY + matH * 0.3 },
  };
}
export const toWorld = (v, x, y) => ({ x: (x - v.ox) / v.s, y: (y - v.oy) / v.s });
export const toScreen = (v, x, y) => ({ x: v.ox + x * v.s, y: v.oy + y * v.s });

// ---- reference pages (About / How to play / Rules) --------------------------------------------------------------------
// Portrait: text-size buttons on a top row, Back / Next at the bottom. Landscape: one bottom row [Back][A-][pct][A+][Next], a wide panel above.
const refCache = new Map();
export function refLayout() {
  return memo(refCache, `${screen.w}x${screen.h}|${hostKey()}`, () => {
    const { w, h } = screen, U = safeArea(), bc = backClear();
    if (w <= h) {
      const rowY = Math.max(18, U.y0 + 8), left = bc.r && rowY < bc.b ? bc.r : Math.max(20, U.x0 + 20);
      const backY = Math.min(h - 116, U.y1 - 104), bw = (U.w - 40 - 16) / 2, py = rowY + 98;
      return {
        dec: R_(left, rowY, 120, 80), inc: R_(U.x1 - 140, rowY, 120, 80), pct: { x: w / 2, y: rowY + 48 },
        back: R_(U.x0 + 20, backY, bw, 100), next: R_(U.x0 + 20 + bw + 16, backY, bw, 100),
        panel: R_(U.x0 + 34, py, U.w - 68, Math.max(300, backY - 34 - py)),
      };
    }
    const rowH = 80, rowY = U.y1 - 10 - rowH, pm = Math.max(24, bc.r), pw = Math.min(980, w - 2 * pm), px = (w - pw) / 2;
    // [A-][pct][A+] on the left, the wide Close button takes the rest of the row (it never covers the text-size controls).
    const dec = R_(px, rowY, 96, rowH), pctR = R_(dec.x + 96 + 12, rowY, 110, rowH), inc = R_(pctR.x + 110 + 12, rowY, 96, rowH);
    const closeR = R_(inc.x + 96 + 16, rowY, px + pw - (inc.x + 96 + 16), rowH), back = closeR, next = closeR;
    const py = U.y0 + 10;
    return { dec, inc, pct: { x: pctR.x + 55, y: rowY + rowH / 2 + 8 }, back, next, panel: R_(px, py, pw, rowY - 10 - py) };
  });
}

// ---- flow screens (title, setup, settings, lessons, result, pause) and the pinned Start / Back buttons ------------------------
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const THINK_STEPS = [2, 5, 8, 10];

const pinCache = new Map();
export function setupPins() {
  return memo(pinCache, `${screen.w}x${screen.h}|${hostKey()}`, () => {
    const U = safeArea(), wide = screen.w > screen.h, ph = wide ? 84 : 96, pw = Math.min(660, U.w - 30), x = U.x0 + (U.w - pw) / 2, y = U.y1 - 12 - ph;
    return { start: R_(x, y, 440, ph), back: R_(x + 456, y, pw - 456, ph) };
  });
}
// Kept as an object with live getters so older callers (and tests) can still read SETUP_PINS.start / .back.
export const SETUP_PINS = { get start() { return setupPins().start; }, get back() { return setupPins().back; } };

// The scrolling column of a flow screen: x / w of the widgets, the visible top / bottom, and a height factor for short landscape screens.
// The Arcforge lockup under the title menu: >= ~125 css px wide (aspect 1200:327); `strip` is the room kept for it under the buttons.
export function lockSize(maxW) { const w = Math.min(Math.max(240, 125 / Math.max(0.2, host.px || 0.6)), maxW); const h = w * 327 / 1200; return { w, h, strip: Math.round(h + 26) }; }
export function flowFrame(key) {
  const { w, h } = screen, U = safeArea(), wide = w > h;
  const f = { x: U.x0 + (U.w - Math.min(640, U.w - 40)) / 2, w: Math.min(640, U.w - 40), top: U.y0, bottom: U.y1, hs: 1, wide, split: false };
  if (key === 'setup' || key === 'lessonintro') f.bottom = setupPins().start.y - 10;
  else if (key === 'result') f.bottom = U.y1 - 52;
  else if (key === 'title') {
    if (wide) {                              // art on the left half, the buttons on the right half
      const half = U.w / 2, cw = Math.min(520, half - 40);
      f.split = true; f.w = cw; f.x = U.x0 + half + (half - cw) / 2; f.hs = h < 800 ? 0.92 : 1; f.top = U.y0 + 4; f.bottom = U.y1 - 6 - lockSize(cw).strip;
    } else { f.bottom = U.y1 - lockSize(Math.min(640, U.w - 40)).strip - 10; f.tight = true; f.hs = 0.78; }
  }
  return f;
}
