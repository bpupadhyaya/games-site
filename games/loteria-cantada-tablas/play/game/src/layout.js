// Geometry for every screen, as a pure function of the LIVE screen size (kit 1.7 fluid viewport: the short side is always 720
// virtual units, the long side follows the aspect). `layoutFor(w, h)` is cached by size + insets, so a frame never recomputes it.
//
// Two kinds of screens:
//  * DESIGN screens (menu, setup, tabla pick, caller, settings, reference pages, pause, result, demo limit) are authored once as a
//    720 x 1280 portrait design and once as a 1280 x 720 landscape design. The design is scaled down (never up) to fit the safe
//    area and centred; view.js draws inside `L.d` (translate + scale) and game.js maps taps back with `L.d.to(x, y)`.
//  * PLAY screens (solo play, Watch & Learn, face to face) are laid out natively in screen units: a tall portrait phone, a shorter
//    portrait tablet (the same stack, tighter), and landscape (big tabla on the left, caller card + controls on the right).
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
const R = (x, y, w, h) => ({ x, y, w, h });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const THINK_STEPS = [2, 5, 8, 10];
export const AUTO_REVEAL_SECS = 2;
export const AUTO_ACT_SECS = 0.9;
export const SETUP_KEYS = ['pattern', 'pace', 'opps', 'skill', 'style', 'theme'];
export const DUO_SETUP_KEYS = ['pattern', 'pace', 'style', 'theme'];
export const CARD_RATIO = 214 / 300;

// Safe areas and the host's floating back button, in virtual units. main.js keeps this current (browsers: all zero).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };

// ---- tabla geometry --------------------------------------------------------------------------------------------
export const tablaGeom = (x, y, tile, fr) => ({ x, y, tile, fr, w: tile * 4 + fr * 2, h: tile * 4 + fr * 2 });
export function cellRect(g, i) {
  const r = Math.floor(i / 4), c = i % 4;
  return R(g.x + g.fr + c * g.tile, g.y + g.fr + r * g.tile, g.tile, g.tile);
}
export function cellAt(g, px, py) {
  const gx = px - g.x - g.fr, gy = py - g.y - g.fr;
  if (gx < 0 || gy < 0 || gx >= g.tile * 4 || gy >= g.tile * 4) return -1;
  return Math.floor(gy / g.tile) * 4 + Math.floor(gx / g.tile);
}
const tablaFit = (x, y, size) => { const fr = size < 300 ? 11 : 16, tile = (size - fr * 2) / 4; return tablaGeom(x, y, tile, fr); };

// The Arcforge lockup under the last menu row: >= ~125 css px wide on screen (kd = design scale), aspect 1200:327.
const lockSize = (kd, lo, hi) => { const w = Math.max(lo, Math.min(hi, 125 / (Math.max(0.2, host.px || 0.6) * Math.max(0.2, kd)))); return { w, h: Math.round(w * 327 / 1200) }; };

// ---- design screens ---------------------------------------------------------------------------------------------------
// hx = left start of the top row (kept clear of the host's floating back button).
function designPortrait(hx, kd = 1) {
  const W = 720, H = 1280;
  const menuRows = (scale = 1) => {
    const big = scale > 1.2, bw = big ? 640 : 580, x = (W - bw) / 2;
    const h = big ? 122 : 84, gap = big ? 12 : 14, small = big ? 96 : 76, settings = big ? 90 : 70;
    let y = big ? 250 : 560;
    const row = (hh = h) => { const r = R(x, y, bw, hh); y += hh + gap; return r; };
    const m = { big, fan: !big, art: { cx: 360, py: 560 }, titleY: big ? 130 : 468, subY: big ? 200 : 540, lockup: null };
    m.play = row(); m.duo = row(); m.caller = row(); m.watch = row();
    const third = (bw - gap * 2) / 3;
    m.howto = R(x, y, third, small); m.rules = R(x + third + gap, y, third, small); m.about = R(x + (third + gap) * 2, y, third, small);
    y += small + gap;
    const half = (bw - gap) / 2;
    m.es = R(x, y, half, small); m.en = R(x + half + gap, y, half, small);
    y += small + gap;
    m.settings = R(x, y, bw, settings);
    { const lk = lockSize(kd, 210, 256); m.lockup = R(W / 2 - lk.w / 2, y + settings + 8, lk.w, lk.h); }
    return m;
  };
  const setupRows = (keys) => {
    const x = 40, w = W - 80, out = {}; let y = 104;
    for (const k of keys) { const hh = k === 'pattern' ? 190 : 118; out[k] = R(x, y, w, hh); y += hh + 14; }
    out.start = R(60, y + 14, W - 120, 100);
    return out;
  };
  const settings = {}; { let y = 130; for (const k of ['lang', 'sound', 'text', 'theme', 'reset']) { settings[k] = R(40, y, W - 80, 112); y += 124; } }
  return {
    W, H, land: false, menuRows, setupRows, settings,
    back: R(hx, 14, 110, 60), sound: R(W - 124, 14, 110, 60), textDec: R(hx, 18, 120, 60), textInc: R(W - 140, 18, 120, 60),
    refBack: R(20, 1164, 332, 100), refNext: R(368, 1164, 332, 100),
    panel: { x: 34, y: 90, w: W - 68, maxH: 1010 }, pageNumY: 1134, pctY: 48,
    titleY: 62,
    pick: {
      slots: [0, 1, 2].map((i) => tablaGeom(34 + (i % 2) * 340, 190 + Math.floor(i / 2) * 372, 74, 16)),
      deal: R(34 + 340, 190 + 372, 312, 312), play: R(60, 960, W - 120, 100), hintY: 150, patY: 1100,
    },
    caller: {
      menu: R(hx, 14, 110, 60), titleY: 44, countX: W - 80, countY: 44,
      card: R(120, 92, 480, 672), riddle: R(30, 790, 660, 130), riddleCx: W / 2, readyY: 820,
      history: R(30, 932, 660, 100), prev: R(30, 1060, 150, 100), next: R(196, 1060, 328, 100), auto: R(540, 1060, 150, 100),
      reshuffle: R(30, 1176, 330, 80), speed: R(380, 1176, 310, 80), toastY: 1040,
    },
    pause: { titleY: 380, resume: R(130, 480, 460, 96), rules: R(130, 590, 460, 84), menu: R(130, 688, 460, 84) },
    result: {
      again: R(60, 1030, 290, 96), menu: R(370, 1030, 290, 96), rules: R(60, 1138, 600, 72), more: { x: W / 2, y: 1244 },
      bigY: 118, titleY: 160, titleYBig: 214, tabla: tablaGeom(142, 262, 104, 20), linesY: 752, x0: 130, x1: W - 130, cx: W / 2,
    },
    demo: { panel: R(70, 380, W - 140, 460), back: R(130, 900, 460, 96), titleY: 470, msgY: 560 },
  };
}

function designLandscape(hx, kd = 1) {
  const W = 1280, H = 720;
  const menuRows = (scale = 1) => {
    const big = scale > 1.2, bw = 560, x = W - 40 - bw;
    const h = big ? 90 : 84, gap = big ? 8 : 12, small = big ? 68 : 70, settings = big ? 60 : 60;
    let y = big ? 22 : 30;
    const row = (hh = h) => { const r = R(x, y, bw, hh); y += hh + gap; return r; };
    const m = { big, fan: true, art: { cx: 340, py: 560 }, titleY: 468, subY: 540, lockup: null };
    m.play = row(); m.duo = row(); m.caller = row(); m.watch = row();
    const third = (bw - gap * 2) / 3;
    m.howto = R(x, y, third, small); m.rules = R(x + third + gap, y, third, small); m.about = R(x + (third + gap) * 2, y, third, small);
    y += small + gap;
    const half = (bw - gap) / 2;
    m.es = R(x, y, half, small); m.en = R(x + half + gap, y, half, small);
    y += small + gap;
    m.settings = R(x, y, bw, settings);
    { const lk = lockSize(kd, 190, 256); m.lockup = R(x + bw / 2 - lk.w / 2, y + settings + 8, lk.w, lk.h); }
    return m;
  };
  const setupRows = (keys) => {
    const out = {}, colW = 580, xs = [50, W - 50 - colW], half = Math.ceil(keys.length / 2);
    const ys = [100, 100];
    keys.forEach((k, i) => { const c = i < half ? 0 : 1, hh = k === 'pattern' ? 190 : 118; out[k] = R(xs[c], ys[c], colW, hh); ys[c] += hh + 14; });
    out.start = R(340, 586, 600, 100);
    return out;
  };
  const settings = {}; {
    const xs = [40, 660], ys = [130, 130];
    ['lang', 'sound', 'text', 'theme', 'reset'].forEach((k, i) => { const c = i < 3 ? 0 : 1; settings[k] = R(xs[c], ys[c], 580, 112); ys[c] += 124; });
  }
  return {
    W, H, land: true, menuRows, setupRows, settings,
    back: R(hx, 14, 110, 60), sound: R(540, 14, 110, 60), textDec: R(hx, 14, 120, 60), textInc: R(W - 140, 14, 120, 60),
    refBack: R(80, 628, 420, 78), refNext: R(780, 628, 420, 78),
    panel: { x: 80, y: 78, w: W - 160, maxH: 536 }, pageNumY: 668, pctY: 44,
    titleY: 50,
    pick: {
      slots: [0, 1, 2].map((i) => tablaGeom(38 + i * 308, 170, 62, 16)),
      deal: R(38 + 3 * 308, 170, 280, 280), play: R(380, 530, 520, 100), hintY: 128, patY: 672,
    },
    caller: {
      menu: R(hx, 14, 110, 60), titleY: 44, countX: W - 80, countY: 44,
      card: R(50, 96, 429, 600), riddle: R(520, 100, 720, 220), riddleCx: 880, readyY: 300,
      history: R(520, 330, 720, 80), prev: R(520, 450, 150, 96), next: R(686, 450, 328, 96), auto: R(1030, 450, 150, 96),
      reshuffle: R(520, 590, 330, 80), speed: R(870, 590, 310, 80), toastY: 428,
    },
    pause: { titleY: 150, resume: R(410, 230, 460, 96), rules: R(410, 342, 460, 84), menu: R(410, 440, 460, 84) },
    result: {
      again: R(560, 538, 300, 84), menu: R(880, 538, 300, 84), rules: R(560, 632, 620, 56), more: { x: 640, y: 706 },
      bigY: 88, titleY: 130, titleYBig: 182, tabla: tablaGeom(110, 226, 84, 20), linesY: 262, x0: 560, x1: 1180, cx: 640,
    },
    demo: { panel: R(320, 120, 640, 470), back: R(410, 480, 460, 96), titleY: 215, msgY: 300 },
  };
}

function makeFrame(U, D) {
  const k = Math.min(1, U.w / D.W, U.h / D.H);
  return { k, dx: U.x0 + (U.w - D.W * k) / 2, dy: U.y0 + (U.h - D.H * k) / 2 };
}

// ---- play screens -------------------------------------------------------------------------------------------------------
function headRects(xl, xr, y, scoreW, rightW, auto) {
  const score = R(xl, y, scoreW, 54), x0 = xl + scoreW + 12, x1 = xr - rightW - 12;
  const hd = { score, pat: R(x0, y, Math.max(60, x1 - x0), 54), chip: R(xr - rightW, y, rightW, 54) };
  hd.pause = auto ? null : R(xr - rightW, y - 8, rightW, 70);
  return hd;
}
function barRects(x, y, w, h, auto, wide) {
  if (!auto) return { hint: R(x, y, 150, h), claim: R(x + 166, y, w - 166, h) };
  if (wide) {
    const g = 8, h1 = (h - g) / 2;
    const hw = (w - g) / 2;
    return {
      pause: R(x, y, w * 0.46, h1), speed: R(x + w * 0.46 + g, y, w * 0.27 - g, h1), exit: R(x + w * 0.73 + g, y, w * 0.27 - g, h1),
      dec: R(x, y + h1 + g, hw, h1), inc: R(x + hw + g, y + h1 + g, hw, h1),
    };
  }
  const g = 10, wts = [1, 1, 1.05, 1, 1], tot = wts.reduce((s, v) => s + v, 0), unit = (w - g * 4) / tot;
  let cx = x; const rs = wts.map((wt) => { const r = R(cx, y, unit * wt, h); cx += unit * wt + g; return r; });
  return { exit: rs[0], dec: rs[1], pause: rs[2], inc: rs[3], speed: rs[4] };
}
function playPortrait(L, auto) {
  const { U } = L, X0 = U.x0, X1 = U.x1, Y0 = U.y0, Uw = U.w, headH = 78, histH = 64, minisH = 70, barH = 80, g = 6;
  const toastH = 40, fixed = headH + histH + minisH + barH + toastH + 5 * g + 6;   // toastH: a slot of its own for the 'Es ... / Está en tu tabla' pill
  const S = clamp(U.h - fixed - 200, 240, Math.min(Uw - 40, 668));
  const Rh = clamp(U.h - fixed - S, 200, 300);
  const e = Math.max(0, U.h - fixed - S - Rh) / 5;
  const P = { mode: 'portrait', auto };
  const cx = (X0 + X1) / 2;
  let y = Y0;
  P.head = headRects(L.hx, X1 - 14, Y0 + 14, 190, auto ? 200 : 130, auto);
  y += headH + e;
  P.card = R(X0 + 30, y, Rh * CARD_RATIO, Rh);
  const tx = P.card.x + P.card.w + 18;
  P.text = { x: tx, y, w: X1 - 30 - tx, h: Rh };
  y += Rh + g + e;
  P.toastY = y + toastH / 2; y += toastH + g;
  P.hist = R(X0 + 30, y, Uw - 60, histH); y += histH + g + e;
  P.tabla = tablaFit(cx - S / 2, y, S); y += S + g + e;
  P.minis = R(X0 + 30, y, Uw - 60, minisH); y += minisH + g + e;
  P.bar = barRects(X0 + 30, y, Uw - 60, barH, auto, false);
  P.barTop = y;
  P.toastX = cx; P.toastW = Math.min(520, Uw - 40);
  return P;
}
function playWide(L, auto) {
  const { U } = L, m = 20, gap = 24, panelMin = 420;
  const backRes = host.back ? host.back + 6 : 0;
  const availH = U.h - 2 * m - backRes;
  const S = clamp(Math.min(availH, U.w - 2 * m - gap - panelMin), 220, 700);
  const Pw = Math.min(760, U.w - 2 * m - gap - S);
  const gx0 = U.x0 + (U.w - (S + gap + Pw)) / 2;
  const P = { mode: 'wide', auto };
  P.tabla = tablaFit(gx0, U.y1 - m - S - (availH - S) / 2, S);
  const px0 = gx0 + S + gap, py0 = U.y0 + m, py1 = U.y1 - m;
  const headH = 54, histH = 64, minisH = 70, g = 10, barH = auto ? 128 : 84, toastH = 40;
  const fixed = headH + histH + minisH + barH + toastH + 5 * g;
  const Rh = clamp(py1 - py0 - fixed, 170, 300);
  const e = Math.max(0, py1 - py0 - fixed - Rh) / 4;
  P.head = headRects(px0, px0 + Pw, py0, 150, 120, auto);
  let y = py0 + headH + g + e;
  P.card = R(px0, y, Rh * CARD_RATIO, Rh);
  const tx = P.card.x + P.card.w + 16;
  P.text = { x: tx, y, w: px0 + Pw - tx, h: Rh };
  y += Rh + g + e;
  P.toastY = y + toastH / 2; y += toastH + g;
  P.hist = R(px0, y, Pw, histH); y += histH + g + e;
  P.minis = R(px0, y, Pw, minisH); y += minisH + g + e;
  P.bar = barRects(px0, y, Pw, barH, auto, true);
  P.barTop = y;
  P.toastX = px0 + Pw / 2; P.toastW = Math.min(520, Pw - 10);
  return P;
}

// Face to face. Everything is laid out for the BOTTOM player; the top player's view is the same layout turned 180 degrees about
// the screen centre (game.js maps their taps with rot(x, y) = (w - x, h - y)).
function duoLayout(L) {
  const { U, w, h } = L, sym = Math.max(host.t, host.b), cy = h / 2, sides = L.land && w >= 1000;
  const bandH = sides ? 150 : h >= 1270 ? 280 : 224;
  const band = R(0, cy - bandH / 2, w, bandH);
  const top = band.y + band.h + 6, bot = h - sym - 6, lh = bot - top;
  const cx = w / 2, claimH = 64, colW = 230;
  const sStack = Math.min(U.w - 48, lh - claimH - 18 - 40), sSide = Math.min(lh - 12, U.w - 48 - colW);
  const D = { mode: 'duo', band, sides, cx, cy, bandH };
  if (sStack >= sSide * 0.9) {
    const S = clamp(Math.min(sStack, 640), 160, 640); D.variant = 'stack';
    const ty = top + (lh - (S + 18 + claimH + 36)) / 2 + 2;
    D.tabla = tablaFit(cx - S / 2, ty, S);
    D.claim = R(cx - 170, ty + S + 14, 340, claimH);
    D.name = { x: Math.max(U.x0 + 70, D.claim.x - 80), y: D.claim.y + 20 }; D.need = { x: D.name.x, y: D.claim.y + 46 }; D.labelW = 130;
  } else {
    const S = clamp(Math.min(sSide, 520), 160, 520); D.variant = 'side';
    const gw = S + 24 + colW, gx = cx - gw / 2, ty = top + (lh - S) / 2;
    D.tabla = tablaFit(gx, ty, S);
    D.claim = R(gx + S + 24, ty + S / 2 - claimH / 2 + 24, colW, claimH);
    D.name = { x: D.claim.x + colW / 2, y: D.claim.y - 42 }; D.need = { x: D.claim.x + colW / 2, y: D.claim.y - 16 }; D.labelW = colW;
  }
  D.pause = R(U.x0 + 8, cy - 41, 82, 82);
  if (!sides) {
    const ch = bandH - 132, cw = ch * 122 / 140;
    D.card = R(cx - cw / 2, band.y + 66, cw, ch);
    D.textBottom = R(U.x0 + 20, band.y + band.h - 60, U.w - 40, 54);
    D.nameX = cx - 170; D.metaL = { x: cx - 220, y: D.card.y + 6 }; D.metaR = { x: cx + 220, y: D.card.y + 6 };
    D.timer = { x: cx - 180, y: band.y + 58, w: 360, h: 8 };
  } else {
    const ch = 126, cw = ch * 122 / 140;
    D.card = R(cx - cw / 2, cy - ch / 2, cw, ch);
    const x0 = D.card.x + D.card.w + 24;
    D.textBottom = R(x0, band.y + 8, Math.max(260, U.x1 - 100 - x0), band.h - 16);
    D.timer = { x: cx - 60, y: D.card.y + ch + 6, w: 120, h: 6 };
  }
  D.rot = (x, y) => ({ x: w - x, y: h - y });
  return D;
}

// ---- builder --------------------------------------------------------------------------------------------------------------
const cache = new Map();
export function layoutFor(w, h) {
  w = Math.round(w); h = Math.round(h);
  const key = `${w}x${h}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}|${Math.round(host.px * 100)}`;
  let L = cache.get(key);
  if (!L) { L = build(w, h); L.key = key; cache.set(key, L); if (cache.size > 40) cache.delete(cache.keys().next().value); }
  return L;
}

function build(w, h) {
  const U = { x0: host.l, y0: host.t, x1: w - host.r, y1: h - host.b };
  U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  const land = w >= h;
  const L = { w, h, land, U, mode: land ? 'wide' : U.h >= 1270 ? 'tall' : 'compact' };
  // design frame: the orientation whose design fits at the larger scale (ties go to the screen's own orientation)
  // design screens start below the papel-picado garland drawn along the top edge
  const UD = { x0: U.x0, y0: U.y0 + 44, w: U.w, h: U.h - 44 };
  const kP = Math.min(1, UD.w / 720, UD.h / 1280), kL = Math.min(1, UD.w / 1280, UD.h / 720);
  const useLand = kL > kP + 1e-6 || (Math.abs(kL - kP) < 1e-6 && land);
  const dim = useLand ? { W: 1280, H: 720 } : { W: 720, H: 1280 };
  const fr = makeFrame(UD, dim);
  L.hx = host.back ? U.x0 + host.back + 12 : U.x0 + 14;
  const hxd = host.back ? Math.max(14, (L.hx - fr.dx) / fr.k) : 14;
  const D = useLand ? designLandscape(hxd, fr.k) : designPortrait(hxd, fr.k);
  L.d = Object.assign(D, fr, {
    to: (x, y) => ({ x: (x - fr.dx) / fr.k, y: (y - fr.dy) / fr.k }),
    scr: (r) => R(fr.dx + r.x * fr.k, fr.dy + r.y * fr.k, r.w * fr.k, r.h * fr.k),
  });
  const memo = new Map();
  L.menuRows = (scale = 1) => { const k = scale > 1.2 ? 'b' : 's'; if (!memo.has(k)) memo.set(k, D.menuRows(scale)); return memo.get(k); };
  L.setupRows = (keys) => D.setupRows(keys);
  // tap zone of the title lockup, in screen units: the lockup padded to >= 44 css px, never above the Settings row
  L.lockTap = (m) => { const q = L.d.scr(m.lockup), st = L.d.scr(m.settings), mm = 44 / Math.max(0.2, host.px || 0.6), tw = Math.max(q.w + 24, mm), th = Math.max(q.h + 12, mm), y0 = Math.max(q.y - 4, st.y + st.h + 2);
    return R(q.x + q.w / 2 - tw / 2, y0, tw, Math.max(q.y + q.h + 6 - y0, Math.min(th, L.h - y0))); };
  L.play = land ? playWide(L, false) : playPortrait(L, false);
  L.auto = land ? playWide(L, true) : playPortrait(L, true);
  L.duo = duoLayout(L);
  return L;
}
