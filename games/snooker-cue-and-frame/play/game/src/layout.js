// Screen geometry: one place for every rectangle so game.js (hit-testing) and view.js (drawing) never disagree.
// FLUID (kit 1.7): the virtual size follows the real screen. The SHORT side is always 720 units; `W` and `H` below are LIVE bindings
// (they change on every resize because the kit writes `meta.width` / `meta.height`, which are accessors defined here).
// Three play shapes (all pure functions of W, H and the host insets):
//   tall     portrait phone (h/w >= 1.75): the approved look. Table stands up the screen, scoreboard on top, control bar below.
//   compact  portrait tablet / short portrait (1.3 <= h/w < 1.75): the table lies across the width, controls below it.
//   wide     landscape and squarish windows (h/w < 1.3): thin scoreboard on top, the table fills the width on the left,
//            a control panel on the right.
// Nothing important is painted in the outer 14 px; host insets (notch, home bar) and the floating back button are honoured.
import { makeCamera, MARGIN } from './cam.js';
import { TW, TL } from './sim.js';
export let W = 720, H = 1280;
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };   // virtual units; main.js keeps it current (browsers: zeros)
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const THINK_STEPS = [2, 5, 8, 10];
const rc = (x, y, w, h) => ({ x, y, w, h });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Live rectangles (objects are mutated in place so imports stay valid).
export const REF_BACK = rc(20, 1164, 332, 100);
export const REF_NEXT = rc(368, 1164, 332, 100);
export const TEXT_DEC = rc(20, 18, 120, 60);
export const TEXT_INC = rc(580, 18, 120, 60);
export const SETUP_PINS = { start: rc(30, 1156, 440, 96), back: rc(486, 1156, 204, 96) };
export const COL = { x: 40, w: 640, top: 0, bottom: 1280, wide: false };               // the column every flow screen scrolls in
export const DOCP = rc(34, 100, 652, 1030);                                               // the Rules / How to Play / About panel
export const MODAL = { x: 30, w: 660, ix: 60, iw: 600, top: 60, bottom: 1220 };         // pause / spin / reason popups
export const TITLE = { wide: false, heroCx: 360, heroCy: 200, colX: 40, colW: 640 };

export const modeOf = (w = W, h = H) => (h / w < 1.3 ? 'wide' : h / w < 1.75 ? 'compact' : 'tall');
export const isWide = () => modeOf() === 'wide';
// A comfortable finger target in virtual units: about 44 css px, never below 48 or above 90 units.
export const tapMin = () => clamp(Math.round(44 / Math.max(0.25, host.px)), 48, 90);
const backClear = () => (host.back ? host.l + Math.max(host.back, 56) + 12 : 0);

function relayout() {
  const mode = modeOf(), wide = mode === 'wide';
  const L = host.l, R = host.r, T = host.t, B = host.b;
  const bk = backClear();
  const inner = W - L - R;
  // flow column
  COL.wide = wide;
  COL.w = wide ? Math.min(760, inner - 80) : Math.min(640, inner - 60);
  COL.x = L + (inner - COL.w) / 2;
  COL.top = host.back ? T + Math.max(host.back, 56) + 8 : T;
  COL.bottom = H - B;
  // title: hero on the left, buttons on the right (wide); one column otherwise
  TITLE.wide = wide;
  if (wide) {
    const colW = Math.min(520, Math.max(400, inner * 0.38));
    TITLE.colW = colW; TITLE.colX = W - R - colW - Math.max(24, inner * 0.05);
    TITLE.heroCx = L + (TITLE.colX - 20 - L) / 2; TITLE.heroCy = H / 2;
  } else { TITLE.colW = COL.w; TITLE.colX = COL.x; TITLE.heroCx = W / 2; TITLE.heroCy = 200; }
  // reference pages (Rules, How to Play, About)
  const refH = Math.max(wide ? 76 : 100, tapMin()), refY = H - B - refH - (wide ? 12 : 16);
  const pw = wide ? Math.min(900, inner - 68) : Math.min(652, inner - 68);
  const py = Math.max(wide ? 76 : 100, T + (wide ? 70 : 90));
  Object.assign(DOCP, { x: L + (inner - pw) / 2, y: py, w: pw, h: refY - 10 - py });
  const bw = Math.min(332, (pw - 16) / 2), bx0 = L + (inner - 2 * bw - 16) / 2;
  Object.assign(REF_BACK, { x: bx0, y: refY, w: bw, h: refH }); Object.assign(REF_NEXT, { x: bx0 + bw + 16, y: refY, w: bw, h: refH });
  const th = Math.max(wide ? 52 : 60, tapMin());
  Object.assign(TEXT_DEC, { x: Math.max(20, L + 14, bk), y: Math.max(wide ? 10 : 18, T + 6), w: 120, h: th });
  Object.assign(TEXT_INC, { x: W - R - 140, y: TEXT_DEC.y, w: 120, h: th });
  // setup: pinned Start / Back buttons
  const sh = Math.max(wide ? 80 : 96, tapMin()), sw = COL.w + 20, sx = COL.x - 10, sy = H - B - sh - (wide ? 20 : 28);
  Object.assign(SETUP_PINS.start, { x: sx, y: sy, w: sw - 220, h: sh }); Object.assign(SETUP_PINS.back, { x: sx + sw - 204, y: sy, w: 204, h: sh });
  // popups
  const mw = wide ? Math.min(780, inner - 40) : 660;
  Object.assign(MODAL, { x: L + (inner - mw) / 2, w: mw, ix: L + (inner - mw) / 2 + 30, iw: mw - 60, top: wide ? Math.max(14, T + 6) : Math.max(60, T + 10), bottom: H - Math.max(wide ? 14 : 60, B + 6) });
}
// The kit writes meta.width / meta.height on every resize; reading them anywhere gives the live value.
export const meta = {
  fluid: { short: 720 },
  get width() { return W; }, set width(v) { if (v > 0 && v !== W) { W = v; relayout(); } },
  get height() { return H; }, set height(v) { if (v > 0 && v !== H) { H = v; relayout(); } },
};
export function setHost(next) { Object.assign(host, next); relayout(); }
relayout();

export function hudBox(sc) {
  const s = Math.min(sc, 3), wide = isWide();
  const bk = backClear(), y = Math.max(34, host.t + 6);
  let x = Math.max(10, host.l + 10, bk), xr = W - Math.max(10, host.r + 10);
  if (wide && xr - x > 1040) { const cx = (x + xr) / 2; x = cx - 520; xr = cx + 520; }
  const w = xr - x;
  if (s <= 1.25) {
    const h = Math.round(100 * s);
    return { stacked: false, x, y, w, h, bottom: y + h, fs: Math.round(24 * s) };
  }
  const fs = Math.round(24 * s), row = Math.round(fs * 1.38);
  // From 250% the scoreboard keeps two rows (names and scores, what is on) so the table keeps its size.
  const rows = s >= 2.25 ? 2 : 3;
  const h = 12 + row * rows + 8;
  return { stacked: true, rows, x, y, w, h, bottom: y + h, fs, row };
}

const cache = new Map();
// The control area. kind: 'aim' | 'roll' | 'verdict' | 'watch' | 'place'.  Returns { mode, hud, ctrl, region, regionTop, regionBottom, orient }.
export function playLayout(sc, kind = 'aim') {
  const key = `${sc}|${kind}|${W}x${H}|${host.t},${host.r},${host.b},${host.l},${host.back}|${host.px.toFixed(3)}`;
  let v = cache.get(key);
  if (!v) { v = buildPlay(sc, kind); cache.set(key, v); if (cache.size > 60) cache.delete(cache.keys().next().value); }
  return v;
}

function buildPlay(sc, kind) {
  const mode = modeOf(), s = Math.min(sc, 3), hud = hudBox(sc);
  const fs = Math.round(26 * s), g = 8;
  const L = host.l, R = host.r, Bm = H - host.b;
  const X0 = L, XW = W - L - R;
  const small = s < 1.5, big = s >= 2.25, TAP = tapMin();
  const ph = small ? 84 : Math.max(84, Math.round(fs * 1.45));
  const bh = Math.max(64, Math.round(fs * 1.5));
  const lab = Math.round(fs * 1.1);
  const c = { fs, bh, ph, small, big, tall: false };
  let P, region, orient = 'v';
  if (mode === 'wide') {
    orient = 'h';
    const pw = Math.min(clamp(W * 0.25, 300, 380) * (s >= 2.25 ? 1.2 : s >= 1.5 ? 1.1 : 1), W * 0.42);
    const y0 = hud.bottom + 6, y1 = Bm - 8;
    P = rc(W - R - pw - 6, y0, pw, y1 - y0);
    region = rc(L + 6, y0, P.x - 8 - (L + 6), y1 - y0);
    wideAim(c, P, kind, { fs, g, ph, big, small, lab, TAP });
  } else {
    if (mode === 'compact') orient = 'h';
    const bbot = Bm;
    // one fixed bar height per text size so the table never shifts between phases (the 'aim' bar decides the table region)
    const barFor = (k, grow = 0) => {
      const tallK = big && k !== 'aim';
      let row2;
      if (tallK) row2 = Math.max(206, 3 * bh + 2 * g); else if (big) row2 = bh; else if (small) row2 = Math.max(190, Math.min(260, 3 * TAP + 2 * g)) + grow; else row2 = Math.max(206, 3 * bh + 2 * g, 3 * TAP + 2 * g) + grow;
      return { row2, tallK, top: bbot - ((small && !tallK ? 10 : 8) + ph + g + row2 + (small && !tallK ? 12 : 14)) };
    };
    // A table lying across a tall tablet leaves empty bands above and below it: give that room to the control bar instead.
    let grow = 0;
    if (mode === 'compact' && !big) {
      const reg0 = rc(X0, hud.bottom + 4, XW, barFor('aim').top - 4 - (hud.bottom + 4)), cam0 = makeCamera(reg0, 'h');
      const ys = [[-MARGIN, -MARGIN], [TW + MARGIN, TL + MARGIN]].flatMap(([a, b]) => [cam0.px(a, b, 0)[1], cam0.px(a, b, -0.1)[1], cam0.px(TW + MARGIN, -MARGIN, 0)[1], cam0.px(-MARGIN, TL + MARGIN, 0)[1]]);
      grow = clamp((reg0.h - (Math.max(...ys) - Math.min(...ys)) - 28) * 0.85, 0, 260);
    }
    const aimBar = barFor('aim', grow), mine = barFor(kind, grow);
    const top = mine.top, row2 = mine.row2, tall = mine.tallK;
    c.tall = tall;
    P = rc(X0, top, XW, bbot - top);
    region = rc(X0, hud.bottom + 4, XW, aimBar.top - 4 - (hud.bottom + 4));
    const x14 = X0 + 14, w28 = XW - 28;
    const y1 = top + (small ? 10 : 8), y2 = y1 + ph + g;
    Object.assign(c, { top, row2, power: rc(x14, y1, w28, ph), y2 });
    c.pullT = c.power.w - 150;
    if (big && !tall) {
      const bw3 = (w28 - 2 * g) / 3;
      c.inset = null; c.guide = null;
      c.shot = rc(x14, y2, bw3, row2); c.think = rc(x14 + bw3 + g, y2, bw3, row2); c.menu = rc(x14 + 2 * (bw3 + g), y2, bw3, row2);
    } else if (small && !tall) {
      const S = clamp(row2, 172, 230);
      c.spin = rc(x14, y2 + (row2 - S) / 2, S, S);
      c.inset = rc(x14 + S + g, y2, Math.min(row2 > 200 ? 250 : 190, w28 - S - g - 150), row2);
      const bx = c.inset.x + c.inset.w + g, bw = X0 + XW - 14 - bx, b3 = (row2 - 2 * g) / 3;
      c.think = rc(bx, y2, bw, b3); c.guide = rc(bx, y2 + b3 + g, bw, b3); c.menu = rc(bx, y2 + 2 * (b3 + g), bw, b3);
    } else if (!big) {
      const iw = 206;
      c.inset = rc(x14, y2, iw, row2);
      const bx = x14 + iw + g, bw = X0 + XW - 14 - bx, b3 = (row2 - 2 * g) / 3;
      c.shot = rc(bx, y2, bw, b3); c.think = rc(bx, y2 + b3 + g, bw, b3); c.menu = rc(bx, y2 + 2 * (b3 + g), bw, b3);
      c.guide = null;
    }
    c.full = rc(x14, top + 8, w28, bbot - top - 8 - 12);
    if (kind === 'roll') {
      const ph2 = Math.max(64, TAP, Math.round(fs * 1.5)), half = (w28 - g) / 2;
      c.labelY = top + 10; c.labelH = Math.max(lab, 34);
      c.pause = rc(x14, bbot - 12 - ph2 * 2 - g, half, ph2); c.fast = rc(x14 + half + g, bbot - 12 - ph2 * 2 - g, half, ph2);
      c.stop = rc(x14, bbot - 12 - ph2, w28, ph2);
    } else if (kind === 'verdict' || kind === 'place') {
      const ah = Math.max(72, TAP, Math.round(fs * 1.6)), half = (w28 - g) / 2;
      c.go = rc(x14, bbot - 12 - ah, w28, ah);
      c.go2 = rc(x14, bbot - 12 - ah * 2 - g, w28, ah);
      c.half1 = rc(x14, bbot - 12 - ah, half, ah); c.half2 = rc(x14 + half + g, bbot - 12 - ah, half, ah);
      c.textTop = top + 8;
    } else if (kind === 'watch') {
      const ah = Math.max(70, TAP, Math.round(fs * 1.5)), half = (w28 - g) / 2;
      if (small) {
        c.pause = rc(x14, bbot - 12 - ah * 2 - g, w28, ah);
        c.dec = rc(x14, bbot - 12 - ah, 150, ah); c.exit = rc(x14 + 150 + g, bbot - 12 - ah, w28 - 300 - 2 * g, ah); c.inc = rc(X0 + XW - 14 - 150, bbot - 12 - ah, 150, ah);
      } else {
        c.pause = rc(x14, bbot - 12 - ah * 3 - 2 * g, w28, ah);
        c.dec = rc(x14, bbot - 12 - ah * 2 - g, half, ah); c.inc = rc(x14 + half + g, bbot - 12 - ah * 2 - g, half, ah);
        c.exit = rc(x14, bbot - 12 - ah, w28, ah);
      }
      c.labelY = top + 10; c.labelH = Math.max(lab, 34);
    }
  }
  c.box = P; c.mode = mode;
  return { mode, orient, hud, ctrl: c, region, regionTop: region.y, regionBottom: region.y + region.h, fs, bh };
}

// The right-hand panel of the wide layout: everything stacked, sized to the panel height.
function wideAim(c, P, kind, { fs, g, ph, big, small, lab, TAP }) {
  const pad = 8, x = P.x + pad, w = P.w - 2 * pad, bot = P.y + P.h - pad;
  c.full = rc(x, P.y + pad, w, P.h - 2 * pad);
  c.labelY = P.y + 10; c.labelH = Math.max(lab, 34);
  const bt = Math.max(TAP, Math.min(Math.round(fs * 1.5), 96));
  if (kind === 'roll') {
    c.pause = rc(x, bot - bt * 2 - g, w, bt); c.fast = rc(x, bot - bt, w, bt); c.stop = c.fast;
  } else if (kind === 'verdict' || kind === 'place') {
    const ah = Math.max(TAP, Math.min(Math.round(fs * 1.6), 96));
    c.go = rc(x, bot - ah, w, ah); c.go2 = rc(x, bot - ah * 2 - g, w, ah);
    c.half1 = rc(x, bot - ah * 2 - g, w, ah); c.half2 = rc(x, bot - ah, w, ah);   // two choices: stacked (upper, lower)
    c.textTop = P.y + 8;
  } else if (kind === 'watch') {
    const ah = Math.max(TAP, Math.min(Math.round(fs * 1.5), 90)), half = (w - g) / 2;
    c.pause = rc(x, bot - ah * 3 - 2 * g, w, ah);
    c.dec = rc(x, bot - ah * 2 - g, half, ah); c.inc = rc(x + half + g, bot - ah * 2 - g, half, ah);
    c.exit = rc(x, bot - ah, w, ah);
  }
  // the aim panel
  const pPow = big ? Math.max(96, Math.round(fs * 1.45)) : 96;
  c.top = P.y; c.power = rc(x, P.y + pad, w, pPow); c.pullT = Math.max(150, w * 0.9);
  let y = c.power.y + pPow + g;
  const rest = bot - y;
  const bh = clamp(Math.round(fs * 1.55) + 8, TAP, big ? 96 : Math.max(72, TAP));
  c.inset = null; c.guide = null; c.shot = null; c.spin = null;
  if (small) {
    const row2 = Math.max(3 * bh + 2 * g, 150), S = Math.min(row2, Math.round(w * 0.46));
    const ih = Math.min(rest - row2 - g, 250);
    if (ih >= 110) { c.inset = rc(x, y, w, ih); y += ih + g; }
    const ry = c.inset ? y : y + Math.max(0, (rest - row2) / 2);
    c.spin = rc(x, ry + (row2 - S) / 2, S, S);
    const bx = x + S + g, bw = x + w - bx, b3 = (row2 - 2 * g) / 3;
    c.think = rc(bx, ry, bw, b3); c.guide = rc(bx, ry + b3 + g, bw, b3); c.menu = rc(bx, ry + 2 * (b3 + g), bw, b3);
  } else {
    const nb = 3, bb = Math.min(bh, Math.floor((rest - (nb - 1) * g) / nb));
    const need = nb * bb + (nb - 1) * g;
    const ih = big ? 0 : Math.min(rest - need - g, 230);
    if (ih >= 110) { c.inset = rc(x, y, w, ih); y += ih + g; }
    c.shot = rc(x, y, w, bb); c.think = rc(x, y + bb + g, w, bb); c.menu = rc(x, y + 2 * (bb + g), w, bb);
  }
}
