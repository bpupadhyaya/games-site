// Geometry. The game is drawn in a CANONICAL phone-portrait space (720 x 1560): the trail is a winding path of six straight
// rows joined by U-turns; station i sits i * STEP pixels along it. Art, animation and the tray all use these numbers.
//
// FLUID LAYOUT (kit 1.7: the short screen side is always 720 units, the long side grows with the aspect ratio):
// `layoutFor(w, h)` places every canonical block (trail, message plaque, rider chips, felt mat, ...) on the live screen with a
// "band" {s, tx, ty, r}: canonical (x, y) -> screen (tx + s*x, ty + s*y). Three shapes:
//   tall     a portrait phone: the approved phone look (the canonical layout), shrunk only enough to clear notch + home bar.
//   compact  a portrait tablet / short phone: the blocks are stacked with the dead space removed and scaled to fit the height.
//   wide     landscape: the trail (with the title) on the left, the rider chips + mat + buttons on the right.
// Menu-like screens (title, pause, result, setup, settings, Rules) take their rectangles from the same layout, see `stackFrame`.
import { FINISH } from './rules.js';

export const W = 720;
export const H = 1560;
export const ROWS = 6, ROW_Y0 = 330, ROW_DY = 104, X0 = 96, X1 = 624, UR = ROW_DY / 2;
const LS = X1 - X0, LA = Math.PI * UR;
export const PATH_LEN = ROWS * LS + (ROWS - 1) * LA;
export const STEP = PATH_LEN / FINISH;

export const TRAY = { x: 36, y: 1016, w: 648, h: 282 };
export const BONE_SPOTS = [117, 279, 441, 603].map((x) => ({ x, y: 1182 }));
export const HUD_Y = 1402;
export const ACT_Y = 1308;
export const CHIP_Y = 912;

export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// the point (and heading) at arc length s along the trail; s may run a little outside [0, PATH_LEN]
export function pathPoint(s) {
  s = Math.max(-STEP * 2, Math.min(PATH_LEN + STEP * 2, s));
  let r = 0, rem = s;
  for (;;) {
    const y = ROW_Y0 + r * ROW_DY, dir = r % 2 === 0 ? 1 : -1;
    if (rem <= LS || r === ROWS - 1) {
      const t = rem; // may be negative before the start or past the finish
      return { x: dir > 0 ? X0 + t : X1 - t, y, ang: dir > 0 ? 0 : Math.PI };
    }
    rem -= LS;
    if (rem <= LA) {
      const cx = dir > 0 ? X1 : X0, cy = y + UR, th = dir > 0 ? -Math.PI / 2 + rem / UR : -Math.PI / 2 - rem / UR;
      return { x: cx + UR * Math.cos(th), y: cy + UR * Math.sin(th), ang: dir > 0 ? th + Math.PI / 2 : th - Math.PI / 2 };
    }
    rem -= LA; r++;
  }
}
// station position (index may be fractional while a rider is moving)
export const stationXY = (i) => pathPoint(i * STEP);

// small offsets so riders sharing a station do not sit exactly on top of each other
export function slotOffset(k, n) {
  if (n <= 1) return { dx: 0, dy: 0 };
  const sp = n === 2 ? [[-8, -9], [8, 9]] : n === 3 ? [[-14, -10], [0, 10], [14, -10]] : [[-16, -11], [-6, 11], [8, -11], [18, 11]];
  const [dx, dy] = sp[k % sp.length];
  return { dx, dy };
}

// ---- host + live size ---------------------------------------------------------------------------------------------
// Safe areas and the host's floating back button, in virtual units. main.js keeps this current (browsers: all zero).
// `back` is non-zero only when the host draws its own floating back button (hub builds); a standalone build has none, so the
// game's own Menu / Leave / Back buttons are the way out and nothing is reserved at the top-left.
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };   // px: css pixels per virtual unit
export const live = { w: W, h: H };                                 // the current virtual screen size (set every frame by game.js)

const R = (x, y, w, h) => ({ x, y, w, h });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// canonical blocks (see view.js for what each one holds)
export const C = {
  ttl: R(60, 28, 600, 76),          // the 'Shagai' heading while playing
  plaque: R(36, 216, 648, 82),      // the message plaque
  trail: R(40, 296, 640, 614),      // the winding trail
  chips: R(36, CHIP_Y, 648, 74),    // the rider strip
  mat: R(36, 1004, 648, 300),       // the felt mat the bones land on
  act: R(36, ACT_Y, 648, 84),       // Toss again / Gallop
  hud: R(36, HUD_Y, 648, 82),       // Menu / Hint / Sound  (Auto Play: Menu / Pause / Think - / Think +)
  tblk: R(60, 36, 600, 232),        // title screen: 'Shagai' + tagline
  plate: R(36, 1000, 648, 430),     // title screen: the menu plate
  stats: R(36, 1436, 648, 32),      // title screen: races played line
  lock: R(234, 1468, 252, 69),      // title screen: the Arcforge lockup (about 35% of the width)
};

// a band maps the canonical rect `c` so that its top-left lands on screen (sx, sy), at scale s
const band = (s, c, sx, sy) => ({ s, tx: sx - s * c.x, ty: sy - s * c.y, r: R(sx, sy, c.w * s, c.h * s) });
export const mapRect = (B, r) => R(B.tx + B.s * r.x, B.ty + B.s * r.y, B.s * r.w, B.s * r.h);
export const toCanon = (B, x, y) => ({ x: (x - B.tx) / B.s, y: (y - B.ty) / B.s });

const cache = new Map();
export function layoutFor(w, h) {
  w = Math.round(w); h = Math.round(h);
  const key = `${w}x${h}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}`;
  let L = cache.get(key);
  if (!L) { L = build(w, h, { ...host }); L.key = key; cache.set(key, L); if (cache.size > 40) cache.delete(cache.keys().next().value); }
  return L;
}
export const curLayout = () => layoutFor(live.w, live.h);

function build(w, h, ins) {
  const U = { x0: ins.l, y0: ins.t, x1: w - ins.r, y1: h - ins.b }; U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  const back = ins.back ? Math.max(ins.back, 56) + 12 : 0;      // vertical room the host's back button needs at the top-left
  const sWide = Math.min(1, (U.w - 24) / (640 + 648 + 16), (U.h - 6) / 700);
  const sTall = Math.min(1, (U.h - 10) / 1486, (U.w - 8) / 720);
  const mode = w >= h && sWide >= 0.6 ? 'wide' : h > w && sTall >= 0.88 ? 'tall' : 'compact';
  const L = { w, h, ins, U, back, mode, land: w >= h };
  L.play = buildPlay(L);
  L.title = buildTitle(L);
  L.panel = buildPanel(L);
  L.reader = buildReader(L);
  return L;
}

// the one band every canonical block shares in 'tall' mode
function tallBand(L, b = 1510) {
  const { w, h, ins, U } = L, a = 24;
  const s = Math.min(1, (U.h - 10) / (b - a), (U.w - 8) / 720);
  const tx = U.x0 + (U.w - 720 * s) / 2, ty0 = (h - 1560 * s) / 2;
  const ty = Math.max(ins.t + 6 - a * s, Math.min(h - ins.b - 4 - b * s, ty0));
  return { s, tx, ty };
}

// ---- the play screens -----------------------------------------------------------------------------------------------
function buildPlay(L) {
  const { U, back, mode } = L, P = { mode };
  const mk = (rect, B) => ({ s: B.s, tx: B.tx, ty: B.ty, r: mapRect(B, rect) });
  if (mode === 'tall') {
    const K = tallBand(L); P.s = K.s;
    for (const k of ['ttl', 'plaque', 'trail', 'chips', 'mat', 'act', 'hud']) P[k] = mk(C[k], K);
  } else if (mode === 'compact') {
    const sum = 76 + 82 + 614 + 74 + 300 + 84 + 82, gap = 10;
    const s = Math.min(1, back ? (U.h - 38 - back) / (sum - 76 + gap * 6) : (U.h - 38) / (sum + gap * 6), (U.w - 8) / 720);
    const ttlH = Math.max(76 * s, back), total = ttlH + s * (sum - 76) + gap * 6 * s;
    let y = U.y0 + Math.max(30, (U.h - total) / 2); const X = U.x0 + (U.w - 720 * s) / 2; P.s = s;
    P.ttl = band(s, C.ttl, X + C.ttl.x * s, y + (ttlH - 76 * s) / 2); y += ttlH + gap * s;
    const put = (k, hh) => { P[k] = band(s, C[k], X + C[k].x * s, y); y += hh + gap * s; };
    put('plaque', 82 * s); put('trail', 614 * s); put('chips', 74 * s); put('mat', 300 * s); put('act', 84 * s); put('hud', 82 * s);
  } else {
    const s = Math.min(1, (U.w - 24) / (640 + 648 + 16), (U.h - (back ? Math.max(0, back - 76) : 0) - 6) / 700), slack = U.w - (640 + 648) * s, m = clamp(slack / 3, 12, 140);
    const xl = U.x0 + m, xr = U.x0 + 2 * m + 640 * s; P.s = s;
    const ttlH = Math.max(76 * s, back), lh = ttlH + 8 * s + 614 * s, yl = U.y0 + Math.max(2, (U.h - lh) / 2);
    P.ttl = band(s, C.ttl, xl + 20 * s, yl + (ttlH - 76 * s) / 2);              // canonical x 360 sits at the middle of the left column
    P.trail = band(s, C.trail, xl, yl + ttlH + 8 * s);
    const g = 10 * s, rh = (82 + 74 + 300 + 84 + 82) * s + 4 * g;
    let y = U.y0 + Math.max(2, (U.h - rh) / 2); const X = xr - 36 * s;           // canonical x 36 -> xr
    const put = (k, hh) => { P[k] = band(s, C[k], X + C[k].x * s, y); y += hh + g; };
    put('plaque', 82 * s); put('chips', 74 * s); put('mat', 300 * s); put('act', 84 * s); put('hud', 82 * s);
  }
  // swipe-up zone: the mat plus the area just below it
  const m = P.mat.r; P.swipe = R(m.x - 20, m.y - 30, m.w + 40, m.h + 30 + 90 * P.s);
  // buttons (screen rects); their text scales with P.s
  const A = P.act.r, Hh = P.hud.r, s = P.s;
  P.btn = {
    fs: s,
    toss: R(A.x, A.y, 316 * s, A.h), gallop: R(A.x + 332 * s, A.y, 316 * s, A.h),
    menu: R(Hh.x + 2 * s, Hh.y, 200 * s, Hh.h), hint: R(Hh.x + 224 * s, Hh.y, 200 * s, Hh.h), sound: R(Hh.x + 446 * s, Hh.y, 200 * s, Hh.h),
    ap: [0, 1, 2, 3].map((i) => R(Hh.x + (i * 172 - 12) * s, Hh.y, 156 * s, Hh.h)),
  };
  // where particles / pops (canonical y) belong: the trail band above the mat, the mat band below it
  P.bandAt = (y) => (y < 990 ? P.trail : P.mat);
  return P;
}

// ---- the title screen -------------------------------------------------------------------------------------------------
function buildTitle(L) {
  const { U, back, mode } = L, T = { mode };
  const bk = back ? Math.max(0, back - 20) : 0;
  if (mode === 'tall') {
    const K = tallBand(L, 1546), mk = (rect) => ({ s: K.s, tx: K.tx, ty: K.ty, r: mapRect(K, rect) });
    T.s = K.s; T.tblk = mk(C.tblk); T.trail = mk(C.trail); T.plate = mk(C.plate); T.stats = mk(C.stats); T.lock = mk(C.lock); T.bones = K;
    T.tsc = 1;
  } else if (mode === 'compact') {
    const tsc = 0.8, hs = [232 * tsc, 614, 430, 32, 69], gap = 10, sum = hs.reduce((a, b) => a + b, 0) + gap * 4;
    const s = Math.min(1, (U.h - 36 - bk) / sum, (U.w - 8) / 720), X = U.x0 + (U.w - 720 * s) / 2;
    let y = U.y0 + bk + Math.max(24, (U.h - bk - sum * s) / 2); T.s = s; T.tsc = tsc;
    T.tblk = band(s * tsc, C.tblk, X + (720 - 600 * tsc) / 2 * s, y); y += hs[0] * s + gap * s;
    T.trail = band(s, C.trail, X + C.trail.x * s, y); y += 614 * s + gap * s;
    T.plate = band(s, C.plate, X + C.plate.x * s, y); y += 430 * s + gap * s;
    T.stats = band(s, C.stats, X + C.stats.x * s, y); y += 32 * s + gap * s;
    T.lock = band(s, C.lock, X + C.lock.x * s, y);
  } else {
    const tsc = 0.8, rh = 232 * tsc + 430 + 32 + 20 + 69 + 12, lhc = 614 + 10 + bk;
    const s = Math.min(1, (U.w - 24) / (640 + 648 + 16), (U.h - 6) / Math.max(rh, lhc)), slack = U.w - (640 + 648) * s, m = clamp(slack / 3, 12, 140);
    const xl = U.x0 + m, xr = U.x0 + 2 * m + 640 * s; T.s = s; T.tsc = tsc;
    const lh = 614 * s, yl = U.y0 + bk + Math.max(2, (U.h - bk - lh) / 2);
    T.trail = band(s, C.trail, xl, yl);
    const X = xr - 36 * s; let y = U.y0 + Math.max(2, (U.h - rh * s) / 2);
    T.tblk = band(s * tsc, C.tblk, X + (720 - 600 * tsc) / 2 * s, y); y += 232 * tsc * s + 10 * s;
    T.plate = band(s, C.plate, X + C.plate.x * s, y); y += 430 * s + 10 * s;
    T.stats = band(s, C.stats, X + C.stats.x * s, y); y += 32 * s + 6 * s;
    T.lock = band(s, C.lock, X + C.lock.x * s, y);   // bottom-centre of the menu column, directly under it
  }
  // the title's menu plate holds a scrolling stack, scaled by the band (u)
  const p = T.plate.r, u = T.plate.s;
  T.region = R(p.x + 24 * u, p.y + 20 * u, p.w - 48 * u, p.h - 40 * u); T.u = u;
  return T;
}

// ---- panels (setup, settings, How to Play, About, Rules, free-demo end) --------------------------------------------------
function buildPanel(L) {
  const { U, ins, back, land } = L;
  const mx = Math.max(24, (U.w - 860) / 2), px = U.x0 + mx, pw = U.w - 2 * mx;
  const py = land ? U.y0 + 12 : U.y0 + 40, ph = L.h - py - Math.max(16, ins.b + 10);
  const head = land ? 150 : 170;          // top of the content, measured from the panel's top edge
  return { x: px, y: py, w: pw, h: ph, head, titleY: py + (land ? 98 : 106), titleSize: land ? 46 : 62, titleMaxW: pw - 2 * (back ? back + 16 : 60), land };
}

function buildReader(L) {
  const P = L.panel, one = L.land || P.w >= 700;
  const bw = Math.min(P.w - 108, 720), bx = P.x + (P.w - bw) / 2;
  const out = { P, one };
  if (!one) {
    const rowY = P.y + P.h - 124;
    out.body = R(bx, P.y + P.head, bw, P.h - P.head - 300);
    out.captionY = P.y + P.h - 224; out.textY = P.y + P.h - 163; out.textX = P.x + P.w / 2;
    const nw = (P.w - 108 - 16) / 2;
    out.btn = {
      textDec: R(P.x + 54, P.y + P.h - 198, 110, 52), textInc: R(P.x + P.w - 54 - 110, P.y + P.h - 198, 110, 52),
      back: R(P.x + 54, rowY, nw, 78), page: R(P.x + 54 + nw + 16, rowY, nw, 78),
    };
  } else {
    const rowY = P.y + P.h - 94, rh = 68, gap = 12, wB = 150, wN = 176, wS = 84, wT = 120, tot = wB + wN + 2 * wS + wT + 4 * gap, x0 = P.x + (P.w - tot) / 2;
    out.body = R(bx, P.y + P.head, bw, rowY - 40 - P.y - P.head);
    out.captionY = rowY - 16; out.textY = rowY + rh / 2 + 10; out.textX = x0 + wB + gap + wS + gap + wT / 2;
    out.btn = {
      back: R(x0, rowY, wB, rh), textDec: R(x0 + wB + gap, rowY, wS, rh), textInc: R(x0 + wB + gap + wS + gap + wT + gap, rowY, wS, rh), page: R(x0 + tot - wN, rowY, wN, rh),
    };
  }
  return out;
}

// ---- stack frames: where each menu-like screen's list lives ---------------------------------------------------------------
// Returns { region, footer: {x, w, bottom, row}, card?, u }. `u` scales the whole stack (cards shrink on small screens).
export function stackFrame(L, key) {
  const { U } = L;
  if (key === 'title') return { region: L.title.region, footer: null, u: L.title.u };
  if (key === 'over' || key === 'menu') {
    const cw0 = key === 'over' ? 600 : 560, ch0 = key === 'over' ? 840 : 600;
    const u = Math.min(1, (U.h - 16) / ch0, (U.w - 16) / cw0), cw = cw0 * u, ch = ch0 * u;
    const card = R(U.x0 + (U.w - cw) / 2, U.y0 + (U.h - ch) / 2, cw, ch);
    const top = key === 'over' ? 42 : 120;
    return { card, u, region: R(card.x + 44 * u, card.y + top * u, cw - 88 * u, (key === 'over' ? 640 : 440) * u), footer: { x: card.x + 40 * u, w: cw - 80 * u, bottom: card.y + ch - 40 * u, row: false } };
  }
  // setup / settings / demo-limit live on the panel
  const P = L.panel, rw = Math.min(P.w - 108, 600), rx = P.x + (P.w - rw) / 2;
  return { region: R(rx, P.y + P.head - 8, rw, 0), footer: { x: rx, w: rw, bottom: P.y + P.h - (P.land ? 22 : 56), row: P.land }, u: 1, panel: P };
}

// Tap zone of the Arcforge lockup (title screen): at least 44 x 44 css px, grown sideways/downwards only.
export const creditHit = (r) => { const m = 44 / Math.max(host.px, 1e-6), w = Math.max(r.w, m), h = Math.max(r.h, m); return { x: Math.round(r.x + r.w / 2 - w / 2), y: Math.round(r.y), w: Math.round(w), h: Math.round(h) }; };
